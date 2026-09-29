import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { config } from "dotenv";
import { Client } from "pg";
import { completeOnboarding, register, TINY_PNG, uniqueUser } from "./helpers";

// Kit de anuncios (Studio → Contenido) y /admin/ia, con el proveedor de IA simulado (sin red ni
// costo). Corre igual en desarrollo (`pnpm dev`: el simulador es lo normal y se etiqueta como IA) y
// con CI=1 (`pnpm start` con ALLOW_SIMULATED_AI=true: piloto, cada texto es «de ejemplo»): la página
// dice en qué modo está (`data-ai-availability`) y la prueba sigue a ese modo. Costo con cifras
// raras para buscarlo en el HTML sin falsos positivos.

config({ quiet: true });

const TITLE = "Termo de acero para café";
const COST = { typed: "713.29", cents: "71329" };
const AI_LABEL = "Creado con ayuda de IA";
const SIMULATED_LABEL = "Texto de ejemplo (IA simulada)";

/** Cuenta de prueba de esta suite (`e2e.fin.*`). */
function finUser() {
  const user = uniqueUser();
  const id = user.email.slice("e2e.".length, -"@example.com".length);
  return { ...user, email: `e2e.fin.${id}@example.com`, username: `e2e.fin.${id}` };
}

async function registerSeller(page: Page) {
  const user = finUser();
  await register(page, user);
  await completeOnboarding(page, user);
  await expect(page).toHaveURL("/");
  return user;
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

/** Vendedor nuevo: activa su tienda y publica un producto a mano. */
async function createProduct(page: Page) {
  await page.goto("/studio/productos/nuevo");
  await page.getByLabel("Ciudad").fill("Ciudad de México");
  await page.getByLabel("Estado").fill("CDMX");
  await page.getByRole("button", { name: "Activar mi tienda" }).click();

  await page
    .getByLabel("Elegir imágenes")
    .setInputFiles({ name: "termo.png", mimeType: "image/png", buffer: TINY_PNG });
  await expect(page.locator('input[name="mediaIds"]')).toHaveCount(1);
  await page.getByLabel("Nombre del producto").fill(TITLE);
  await page
    .getByLabel("Descripción")
    .fill("Termo de acero inoxidable que mantiene tu café caliente toda la mañana.");
  await page.getByLabel("Categoría").selectOption({ index: 1 });
  await page.getByLabel("Precio (MXN)").fill("1,349");
  await page.getByLabel("Tu costo (MXN)").fill(COST.typed);
  await page.getByLabel("Piezas disponibles").fill("7");
  await page.getByLabel("Costo de envío").fill("99");
  await page.getByRole("button", { name: "Publicar producto" }).click();
  await expect(page).toHaveURL(/\/producto\/termo-de-acero-para-cafe-[a-z0-9]+\?nuevo=1/);
}

/**
 * Copia el último kit de la persona como si lo hubiera escrito un modelo de verdad (mismo texto y
 * datos, otro proveedor). Solo para probar que la etiqueta sigue a CADA kit; se borra al final.
 */
async function seedModelWrittenKit(email: string) {
  const requestId = randomUUID();
  await withDb(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `SELECT r."id" FROM "ai_requests" r JOIN "users" u ON u."id" = r."userId"
       WHERE u."email" = $1 AND r."feature" = 'CONTENT_GENERATION' AND r."status" = 'SUCCEEDED'
       ORDER BY r."createdAt" DESC LIMIT 1`,
      [email],
    );
    const source = rows[0]?.id;
    if (!source) throw new Error("No hay un kit guardado para copiar.");
    await client.query(
      `INSERT INTO "ai_requests" ("id", "userId", "feature", "provider", "model", "promptVersion",
                                  "input", "status")
       SELECT $1, "userId", "feature", 'openai_compatible', 'qwen/qwen3.5-9b', "promptVersion",
              "input", "status"
       FROM "ai_requests" WHERE "id" = $2`,
      [requestId, source],
    );
    await client.query(
      `INSERT INTO "ai_responses" ("id", "requestId", "output")
       SELECT $1, $2, "output" FROM "ai_responses" WHERE "requestId" = $3`,
      [randomUUID(), requestId, source],
    );
  });
  return requestId;
}

async function deleteRequest(requestId: string) {
  await withDb((client) => client.query(`DELETE FROM "ai_requests" WHERE "id" = $1`, [requestId]));
}

test("el vendedor crea su kit de anuncios: 4 textos etiquetados según quién los escribió, precio del código y liga", async ({
  page,
  context,
}) => {
  test.setTimeout(180_000);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const user = await registerSeller(page);
  await createProduct(page);

  await page.goto("/studio/contenido");
  await expect(page.getByRole("heading", { name: "Contenido", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: TITLE, level: 2 })).toBeVisible();

  // El modo lo dice la página: con un modelo (o en desarrollo) «real»; en el piloto, «simulated».
  const mode = await page.locator("[data-ai-availability]").getAttribute("data-ai-availability");
  expect(["real", "simulated"]).toContain(mode);
  const simulated = mode === "simulated";
  await expect(
    page.getByText(simulated ? "Piloto: la IA está simulada" : /creados con ayuda de IA/).first(),
  ).toBeVisible();

  await page
    .getByRole("button", { name: simulated ? "Crear textos de ejemplo" : "Crear mi kit con IA" })
    .click();

  const cards = page.getByRole("article");
  // Con un modelo real, el kit tarda lo que tarde el proveedor (hasta su plazo de 45 s).
  await expect(cards).toHaveCount(4, { timeout: 60_000 });
  const label = simulated ? SIMULATED_LABEL : AI_LABEL;
  for (const title of [
    "Mensaje de WhatsApp",
    "Publicación de Facebook",
    "Pie de foto de Instagram",
    "Titular corto",
  ]) {
    const card = cards.filter({ has: page.getByRole("heading", { name: title }) });
    await expect(card.getByText(label, { exact: true })).toBeVisible();
    await expect(card.getByText(simulated ? AI_LABEL : SIMULATED_LABEL)).toHaveCount(0);
  }
  const whatsapp = cards.filter({
    has: page.getByRole("heading", { name: "Mensaje de WhatsApp" }),
  });
  // El precio y los datos de envío los pone el código; la liga lleva la atribución del canal.
  await expect(whatsapp).toContainText("$1,349");
  await expect(whatsapp).toContainText("+ $99 de envío a todo México");
  await expect(whatsapp).toContainText(
    /\/producto\/termo-de-acero-para-cafe-[a-z0-9]+\?ref=compartir&canal=whatsapp/,
  );
  await expect(whatsapp.getByRole("link", { name: "Abrir WhatsApp" })).toHaveAttribute(
    "href",
    /^https:\/\/wa\.me\/\?text=/,
  );

  await whatsapp.getByRole("button", { name: "Copiar: Mensaje de WhatsApp" }).click();
  await expect(page.getByText("Copiado. Pégalo en WhatsApp.")).toBeVisible();

  // Queda guardado: al volver, el kit sigue ahí sin gastar otra generación.
  await page.reload();
  await expect(page.getByRole("article")).toHaveCount(4);
  await expect(
    page.getByText(
      simulated ? /Llevas 1 de 30 usos este mes/ : /Llevas 1 de 30 generaciones con IA este mes/,
    ),
  ).toBeVisible();

  // El costo privado nunca llega al HTML de la página.
  const html = await page.content();
  expect(html).not.toContain(COST.typed);
  expect(html).not.toContain(COST.cents);

  // La etiqueta es de cada kit, no de la ruta de hoy: uno que escribió un modelo de verdad dice
  // «Creado con ayuda de IA» también en el piloto, aunque el botón siga ofreciendo textos de ejemplo.
  const seeded = await seedModelWrittenKit(user.email);
  try {
    await page.reload();
    await expect(page.getByRole("article")).toHaveCount(4);
    await expect(page.getByText(AI_LABEL, { exact: true })).toHaveCount(4);
    await expect(page.getByText(SIMULATED_LABEL, { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: simulated ? "Crear otros textos de ejemplo" : "Crear otro kit",
      }),
    ).toBeVisible();
  } finally {
    await deleteRequest(seeded);
  }
});

test("un producto que no es de la tienda es «no encontrado» en el kit", async ({ page }) => {
  test.setTimeout(120_000);
  await registerSeller(page);
  await createProduct(page);

  // Dentro del Studio la respuesta ya empezó (loading.tsx): es la página de «no encontrado».
  await page.goto(`/studio/contenido?producto=${randomUUID()}`);
  await expect(page.getByText("No encontramos esta página")).toBeVisible();
  await expect(page.getByRole("button", { name: /kit|ejemplo/ })).toHaveCount(0);
});

function makeAdmin(email: string, ...flags: string[]) {
  return execSync(["pnpm exec tsx scripts/make-admin.ts", email, ...flags].join(" "), {
    encoding: "utf8",
    timeout: 90_000,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/**
 * Tarea que cada proyecto cambia en /admin/ia. Ninguna otra prueba depende de su ruta y cada
 * proyecto (móvil y escritorio corren en paralelo) usa la suya, así nunca chocan. Se deja como estaba.
 */
const ADMIN_TASKS = {
  mobile: { task: "analyst_narrative", label: "Analista de la plataforma" },
  desktop: { task: "authenticity_text", label: "Revisión de autenticidad" },
} as const;

/**
 * Quita la ruta de la tarea (vuelve a la predeterminada) sin tocar las demás: limpieza de una corrida
 * anterior que se cortó a medias, o si esta falla antes de restaurarla. Con el mismo candado que
 * `changeAiRouting` (`lockRouting`): sin él, un cambio del otro proyecto que leyó el ajuste antes de
 * esta sentencia lo volvería a escribir con la ruta vieja (actualización perdida).
 */
async function resetTaskRoute(task: string) {
  await withDb(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [
        "setting:ai.routing",
      ]);
      await client.query(
        `UPDATE "platform_settings" SET "value" = jsonb_set("value", '{tasks}', ("value"->'tasks') - $1::text)
         WHERE "key" = 'ai.routing' AND ("value"->'tasks') ? $1::text`,
        [task],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

/**
 * Borra lo que dejó la prueba en la bitácora: las propuestas sembradas y las decisiones de
 * `ai.routing` que tomó esta cuenta de prueba (aplicar y descartar). Las demás no se tocan.
 */
async function deleteTestDecisions(seeded: string[], email: string) {
  await withDb((client) =>
    client.query(
      `DELETE FROM "platform_decisions"
       WHERE "id" = ANY($1::uuid[])
          OR ("kind" = 'ai.routing'
              AND "approvedById" = (SELECT "id" FROM "users" WHERE "email" = $2))`,
      [seeded, email],
    ),
  );
}

/** Propuesta de la IA pendiente (como la deja `proposeAiRoutingChange`) para la tarea. */
async function seedProposal(id: string, title: string, task: string, route: object) {
  await withDb((client) =>
    client.query(
      `INSERT INTO "platform_decisions"
         ("id", "actor", "kind", "title", "hypothesis", "settingKey", "previousValue", "newValue",
          "riskLevel", "status", "evaluation")
       VALUES ($1, 'AI', 'ai.routing', $2, 'Hipótesis de prueba (E2E).', 'ai.routing',
               '{"version": 1, "tasks": {}}'::jsonb, $3::jsonb, 'MEDIUM', 'PROPOSED',
               '{"trail": []}'::jsonb)`,
      [id, title, JSON.stringify({ version: 1, tasks: { [task]: route } })],
    ),
  );
}

async function decision(id: string) {
  return withDb(async (client) => {
    const { rows } = await client.query<{
      status: string;
      reason: string | null;
      approvedById: string | null;
    }>(`SELECT "status", "reason", "approvedById" FROM "platform_decisions" WHERE "id" = $1`, [id]);
    return rows[0];
  });
}

test("/admin/ia: solo ADMIN; rutas, gasto y evaluaciones; un cambio queda como decisión y las propuestas se descartan o se cierran solas", async ({
  page,
}, testInfo) => {
  test.setTimeout(240_000);
  const { task, label } = ADMIN_TASKS[testInfo.project.name === "mobile" ? "mobile" : "desktop"];
  const anonymous = await page.goto("/admin/ia");
  expect(anonymous?.status()).toBe(404);

  const user = await registerSeller(page);
  expect((await page.goto("/admin/ia"))?.status()).toBe(404);

  const tag = randomUUID().slice(0, 8);
  const ids = { discard: randomUUID(), stale: randomUUID() };
  await resetTaskRoute(task);
  makeAdmin(user.email);
  try {
    await page.goto("/admin/ia");
    await expect(page.getByRole("heading", { name: "IA", level: 1 })).toBeVisible();
    await expect(page).toHaveTitle(/IA · Administración/);
    for (const section of ["Gasto del mes", "Modelo por tarea", "Últimas evaluaciones"]) {
      await expect(page.getByRole("heading", { name: section, level: 2 })).toBeVisible();
    }
    await expect(page.getByRole("meter", { name: "Presupuesto de IA comprometido" })).toBeVisible();

    // Un modelo de pago sin evaluación aprobada no se puede elegir.
    await page.getByLabel("Tarea", { exact: true }).selectOption(task);
    await expect(
      page
        .getByLabel("Modelo", { exact: true })
        .locator('option[value="openai_compatible|qwen/qwen3.5-9b"]'),
    ).toBeDisabled();

    // El simulado (interruptor de apagado) sí; el cambio queda registrado con su motivo.
    await page.getByLabel("Modelo", { exact: true }).selectOption("mock|mock");
    await page
      .getByLabel("Motivo", { exact: true })
      .fill("Prueba automática: apagar la IA de pago en esta tarea.");
    await page.getByRole("button", { name: "Aplicar cambio" }).click();
    await expect(
      page.getByText("Listo: el cambio se aplicó y quedó registrado como decisión."),
    ).toBeVisible();
    const taskRoute = page
      .getByRole("list", { name: "Modelo de cada tarea" })
      .getByRole("listitem")
      .filter({ hasText: label });
    await expect(taskRoute).toContainText("Elegido en esta página");
    await expect(page.getByRole("heading", { name: "Cambios recientes de modelo" })).toBeVisible();

    // Dos propuestas de la IA para esa tarea: una a un modelo de pago (sigue pendiente hasta que
    // alguien decide) y otra al simulado, que la tarea YA usa (no hay nada que aplicar).
    await seedProposal(ids.discard, `E2E ${tag}: descartar`, task, {
      provider: "openai_compatible",
      model: "qwen/qwen3.5-9b",
    });
    await seedProposal(ids.stale, `E2E ${tag}: ya aplicada`, task, {
      provider: "mock",
      model: "mock",
    });
    await page.reload();

    const pending = page.getByRole("list", { name: "Propuestas pendientes" });
    const toDiscard = pending.getByRole("listitem").filter({ hasText: `E2E ${tag}: descartar` });
    await expect(toDiscard).toBeVisible();
    await expect(toDiscard).toContainText(`${label} → Qwen3.5 9B`);
    // La que ya no cambiaría nada se cerró sola, con el motivo.
    await expect(
      pending.getByRole("listitem").filter({ hasText: `E2E ${tag}: ya aplicada` }),
    ).toHaveCount(0);
    expect(await decision(ids.stale)).toMatchObject({
      status: "REJECTED",
      reason: expect.stringContaining("la tarea ya usa ese modelo"),
      approvedById: null,
    });

    // Descartar exige un motivo y deja la propuesta REJECTED con quién la descartó.
    await toDiscard.getByRole("button", { name: "Descartar propuesta" }).click();
    await expect(toDiscard.getByRole("alert")).toContainText("Explica en una frase");
    await toDiscard
      .getByLabel("Motivo para descartar")
      .fill("Prueba automática: ya no queremos este cambio.");
    await toDiscard.getByRole("button", { name: "Descartar propuesta" }).click();
    await expect(toDiscard).toHaveCount(0);
    // La propuesta sale de la lista en la misma respuesta: el aviso llega como toast.
    await expect(
      page.getByText("Listo: descartaste la propuesta.", { exact: false }),
    ).toBeVisible();
    expect(await decision(ids.discard)).toMatchObject({
      status: "REJECTED",
      reason: "Prueba automática: ya no queremos este cambio.",
      approvedById: expect.any(String),
    });
    // La ruta no cambió al descartar.
    await expect(taskRoute).toContainText("Elegido en esta página");

    // Volver a la ruta predeterminada deja el ajuste como estaba.
    await page.getByLabel("Tarea", { exact: true }).selectOption(task);
    await page.getByLabel("Modelo", { exact: true }).selectOption("default");
    await page
      .getByLabel("Motivo", { exact: true })
      .fill("Prueba automática: volver al modelo predeterminado.");
    await page.getByRole("button", { name: "Aplicar cambio" }).click();
    await expect(taskRoute).toContainText("Predeterminado (variables de entorno)");
  } finally {
    makeAdmin(user.email, "--revoke");
    // Si la prueba se cortó antes de restaurar, la tarea vuelve a la predeterminada.
    await resetTaskRoute(task);
    await deleteTestDecisions([ids.discard, ids.stale], user.email);
  }
  expect((await page.goto("/admin/ia"))?.status()).toBe(404);
});
