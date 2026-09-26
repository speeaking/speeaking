import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { config } from "dotenv";
import { Client } from "pg";
import { completeOnboarding, register, uniqueUser } from "./helpers";

// Motor de automejora en /admin (Reporte semanal, Decisiones, Experimentos). Solo ADMIN lo ve; a los
// demás les responde el mismo 404 que una ruta inexistente. Las acciones del equipo se prueban con
// datos sembrados que NO cambian el feed de nadie: una propuesta de riesgo alto (solo propuesta), una
// de riesgo bajo que se rechaza, un cambio «aplicado» cuyo valor anterior es el vigente (revertirlo no
// mueve nada) y un experimento con 0 % al tratamiento.

config({ quiet: true });

const CEO_PAGES = ["/admin/resumen", "/admin/decisiones", "/admin/experimentos"] as const;

function ceoUser() {
  const user = uniqueUser();
  const id = user.email.slice("e2e.".length, -"@example.com".length);
  return { ...user, email: `e2e.ceo.${id}@example.com`, username: `e2e.ceo.${id}` };
}

function makeAdmin(email: string, ...flags: string[]) {
  return execSync(["pnpm exec tsx scripts/make-admin.ts", email, ...flags].join(" "), {
    encoding: "utf8",
    timeout: 90_000,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function expectNotFound(page: Page, path: string) {
  const response = await page.goto(path);
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
  await expect(page).not.toHaveTitle(/Administración|Decisiones|Experimentos|Reporte/);
  await expect(page.getByText("Administración")).toHaveCount(0);
}

async function withDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** Valor vigente de un campo de la política del feed (o el de por omisión). */
async function currentPolicyValue(client: Client, field: string, fallback: number) {
  const { rows } = await client.query<{ value: Record<string, unknown> }>(
    `SELECT "value" FROM "platform_settings" WHERE "key" = 'feed.policy'`,
  );
  const value = rows[0]?.value?.[field];
  return typeof value === "number" ? value : fallback;
}

type Seed = {
  tag: string;
  highId: string;
  lowId: string;
  appliedId: string;
  experimentId: string;
  experimentKey: string;
};

async function seed(): Promise<Seed> {
  const tag = randomUUID().slice(0, 8);
  const seedData = {
    tag,
    highId: randomUUID(),
    lowId: randomUUID(),
    appliedId: randomUUID(),
    experimentId: randomUUID(),
    experimentKey: `e2e.minGap.${tag}`,
  };
  await withDb(async (client) => {
    const authorWindow = await currentPolicyValue(client, "authorWindow", 4);
    const minGap = await currentPolicyValue(client, "minGapBetweenCommerce", 3);
    const insert = `
      INSERT INTO "platform_decisions"
        ("id", "actor", "kind", "title", "hypothesis", "settingKey", "previousValue", "newValue",
         "riskLevel", "status", "expectedImpact", "evaluation", "appliedAt")
      VALUES ($1, 'AI', 'e2e.test', $2, $3, $4, $5::jsonb, $6::jsonb, $7::"RiskLevel",
              $8::"DecisionStatus", $9, '{"trail": []}'::jsonb, $10)`;
    await client.query(insert, [
      seedData.highId,
      `E2E ${tag}: revisar la moderación`,
      "Suben los reportes (prueba E2E).",
      null,
      null,
      null,
      "HIGH",
      "PROPOSED",
      "Lo decide una persona.",
      null,
    ]);
    await client.query(insert, [
      seedData.lowId,
      `E2E ${tag}: ventana de autor`,
      "Propuesta de riesgo bajo que se rechaza (prueba E2E).",
      "feed.policy.authorWindow",
      JSON.stringify(authorWindow),
      JSON.stringify(authorWindow < 10 ? authorWindow + 1 : authorWindow - 1),
      "LOW",
      "PROPOSED",
      null,
      null,
    ]);
    // Aplicada «sin cambio real»: revertirla deja el mismo valor (no mueve el feed de nadie).
    await client.query(insert, [
      seedData.appliedId,
      `E2E ${tag}: cambio aplicado`,
      "Cambio aplicado para probar la reversión (prueba E2E).",
      "feed.policy.authorWindow",
      JSON.stringify(authorWindow),
      JSON.stringify(authorWindow),
      "LOW",
      "APPLIED",
      null,
      new Date(),
    ]);
    await client.query(
      `INSERT INTO "experiments"
         ("id", "key", "settingKey", "hypothesis", "status", "variants", "allocation",
          "minSamplePerVariant", "primaryMetric", "guardrails", "updatedAt")
       VALUES ($1, $2, 'feed.policy.minGapBetweenCommerce', $3, 'DRAFT', $4::jsonb, 0, 1000,
               'feed.product_visits.rate', '{}'::jsonb, now())`,
      [
        seedData.experimentId,
        seedData.experimentKey,
        `E2E ${tag}: experimento con 0 % al tratamiento.`,
        JSON.stringify({ control: minGap, treatment: minGap < 12 ? minGap + 1 : minGap - 1 }),
      ],
    );
  });
  return seedData;
}

async function cleanup(seedData: Seed, userEmail: string) {
  await withDb(async (client) => {
    await client.query(`DELETE FROM "experiments" WHERE "id" = $1`, [seedData.experimentId]);
    await client.query(
      `DELETE FROM "platform_decisions"
       WHERE "id" = ANY($1::uuid[])
          OR ("kind" = 'autonomy.mode' AND "approvedById" = (SELECT "id" FROM "users" WHERE "email" = $2))`,
      [[seedData.highId, seedData.lowId, seedData.appliedId], userEmail],
    );
  });
}

function decisionCard(page: Page, title: string) {
  return page.locator("article").filter({ has: page.getByRole("heading", { name: title }) });
}

async function confirmInDialog(page: Page, button: string) {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: button, exact: true }).click();
  await expect(dialog).toBeHidden();
}

test("sin sesión, las páginas del motor y el cron responden 404", async ({ page, request }) => {
  for (const path of CEO_PAGES) await expectNotFound(page, path);
  expect((await request.post("/api/cron/daily")).status()).toBe(404);
  expect((await request.get("/api/cron/daily")).status()).toBe(404);
  const wrong = await request.post("/api/cron/daily", {
    headers: { Authorization: "Bearer un-secreto-que-no-es-el-bueno-y-es-largo" },
  });
  expect(wrong.status()).toBe(404);
});

test.describe("con una cuenta del equipo", () => {
  test.describe.configure({ mode: "serial" });

  test("sin el rol ADMIN es 404; con el rol decide, prueba y cambia la autonomía", async ({
    page,
  }, testInfo) => {
    // Cambia estado global (autonomía, un experimento): una sola vez, no en paralelo por proyecto.
    test.skip(
      testInfo.project.name !== "desktop",
      "Estado global: solo en el proyecto de escritorio.",
    );
    test.setTimeout(240_000);

    const user = ceoUser();
    await register(page, user);
    await completeOnboarding(page, user);
    await expect(page).toHaveURL("/");
    for (const path of CEO_PAGES) await expectNotFound(page, path);

    makeAdmin(user.email);
    const seeded = await seed();
    try {
      // Reporte semanal y autonomía (observador ↔ riesgo bajo con confirmación).
      const response = await page.goto("/admin/resumen");
      expect(response?.status()).toBe(200);
      await expect(page).toHaveTitle(/Reporte semanal/);
      await expect(page.getByRole("heading", { name: "Reporte semanal", level: 1 })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Costo de IA contra el tope" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Métricas de la semana" })).toBeVisible();
      const mode = page.getByTestId("autonomy-mode");
      if ((await mode.textContent())?.includes("Riesgo bajo")) {
        await page.getByRole("button", { name: "Volver a observador" }).click();
        await confirmInDialog(page, "Volver a observador");
      }
      await expect(mode).toHaveText("Observador");
      await page.getByRole("button", { name: "Activar riesgo bajo" }).click();
      await expect(page.getByRole("dialog")).toContainText(
        "Lo de riesgo alto nunca se aplica solo",
      );
      await confirmInDialog(page, "Activar riesgo bajo");
      await expect(mode).toHaveText("Riesgo bajo");
      await page.getByRole("button", { name: "Volver a observador" }).click();
      await confirmInDialog(page, "Volver a observador");
      await expect(mode).toHaveText("Observador");

      // Cola de decisiones: riesgo alto = solo propuesta.
      await page.goto("/admin/decisiones");
      const high = decisionCard(page, `E2E ${seeded.tag}: revisar la moderación`);
      await expect(high).toContainText("Solo propuesta");
      await expect(high).toContainText("Riesgo alto");
      await high.getByRole("button", { name: "Aprobar (la ejecutas tú)" }).click();
      await expect(page.getByRole("dialog")).toContainText("Es solo propuesta");
      await confirmInDialog(page, "Confirmar");
      await expect(page.getByText(/Aprobada\. Es solo propuesta/)).toBeVisible();
      await expect(high).toHaveCount(0);

      // Riesgo bajo: rechazar (con nota para la bitácora).
      const low = decisionCard(page, `E2E ${seeded.tag}: ventana de autor`);
      await low.getByRole("button", { name: "Rechazar" }).click();
      await page
        .getByRole("dialog")
        .getByLabel("Nota para la bitácora (opcional)")
        .fill("Prueba E2E");
      await confirmInDialog(page, "Rechazar");
      await expect(low).toHaveCount(0);

      // Filtros: la aprobada queda con quién decidió; la rechazada, con su nota.
      await page.goto("/admin/decisiones?estado=aprobadas&riesgo=alto");
      await expect(decisionCard(page, `E2E ${seeded.tag}: revisar la moderación`)).toContainText(
        `Decidió: @${user.username}`,
      );
      await page.goto("/admin/decisiones?estado=rechazadas");
      await expect(decisionCard(page, `E2E ${seeded.tag}: ventana de autor`)).toContainText(
        "Nota: Prueba E2E",
      );

      // Revertir un cambio aplicado.
      await page.goto("/admin/decisiones?estado=aplicadas");
      const applied = decisionCard(page, `E2E ${seeded.tag}: cambio aplicado`);
      await applied.getByRole("button", { name: "Revertir" }).click();
      await confirmInDialog(page, "Revertir");
      await expect(page.getByText(/Revertida: el ajuste volvió/)).toBeVisible();
      await page.goto("/admin/decisiones?estado=revertidas");
      await expect(decisionCard(page, `E2E ${seeded.tag}: cambio aplicado`)).toContainText(
        "Revertida por el equipo.",
      );

      // Experimentos: iniciar el borrador (0 % al tratamiento) y detenerlo.
      await page.goto("/admin/experimentos");
      const experiment = page.locator("article").filter({ hasText: seeded.experimentKey });
      await experiment.getByRole("button", { name: "Iniciar" }).click();
      await confirmInDialog(page, "Iniciar");
      await expect(page.getByText("Experimento iniciado.")).toBeVisible();
      await expect(experiment).toContainText("En curso");
      await experiment.getByRole("button", { name: "Detener" }).click();
      await confirmInDialog(page, "Detener");
      await expect(experiment).toContainText("Detenido");
    } finally {
      await cleanup(seeded, user.email);
      makeAdmin(user.email, "--revoke");
    }
    for (const path of CEO_PAGES) await expectNotFound(page, path);
  });
});
