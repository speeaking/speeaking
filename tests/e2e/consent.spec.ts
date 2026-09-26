import { execSync } from "node:child_process";
import { expect, type Page, test } from "@playwright/test";
import { config } from "dotenv";
import { Client } from "pg";
import { completeOnboarding, register, uniqueUser } from "./helpers";

// Volver a aceptar los documentos legales (`identity/consent-refresh.ts`): quien aceptó una versión
// ANTERIOR de los términos y del aviso de privacidad ve un aviso que no bloquea, en la red social, en
// el Studio y en /admin. «Aceptar» queda guardado; «Ocultar» solo dura en esa pestaña. Para simular
// la versión anterior se cambia en la base la de las filas que dejó el registro (cuentas `e2e.fin.*`).

config({ quiet: true });

const OLD_VERSION = "2026-01-01";
const BANNER = "Cambios en los documentos legales";

function finUser() {
  const user = uniqueUser();
  const id = user.email.slice("e2e.".length, -"@example.com".length);
  return { ...user, email: `e2e.fin.${id}@example.com`, username: `e2e.fin.${id}` };
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

/** Como si la persona se hubiera registrado cuando los dos documentos iban en `OLD_VERSION`. */
async function ageLegalConsents(email: string) {
  const updated = await withDb(async (client) => {
    const { rowCount } = await client.query(
      `UPDATE "user_consents" SET "version" = $2
       WHERE "userId" = (SELECT "id" FROM "users" WHERE "email" = $1)
         AND "type" IN ('TERMS', 'PRIVACY_NOTICE')`,
      [email, OLD_VERSION],
    );
    return rowCount ?? 0;
  });
  expect(updated).toBeGreaterThanOrEqual(2);
}

/** Filas de términos y aviso de privacidad de la cuenta, de la más reciente a la más antigua. */
async function legalConsents(email: string) {
  return withDb(async (client) => {
    const { rows } = await client.query<{ type: string; version: string; granted: boolean }>(
      `SELECT c."type"::text AS "type", c."version", c."granted"
       FROM "user_consents" c JOIN "users" u ON u."id" = c."userId"
       WHERE u."email" = $1 AND c."type" IN ('TERMS', 'PRIVACY_NOTICE')
       ORDER BY c."createdAt" DESC, c."id" DESC`,
      [email],
    );
    return rows;
  });
}

/** Corre el script real contra la base de desarrollo (la misma que usa `pnpm dev`). */
function makeAdmin(email: string, ...flags: string[]) {
  return execSync(["pnpm make-admin", email, ...flags].join(" "), {
    encoding: "utf8",
    timeout: 90_000,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function banner(page: Page) {
  return page.getByRole("region", { name: BANNER });
}

/** Cuenta con los documentos aceptados en una versión anterior, en el inicio con el aviso visible. */
async function userWithOldConsent(page: Page) {
  const user = finUser();
  await register(page, user);
  await completeOnboarding(page, user);
  await expect(page).toHaveURL("/");
  // Recién registrada está al día: no hay aviso.
  await expect(banner(page)).toHaveCount(0);

  await ageLegalConsents(user.email);
  await page.reload();
  await expect(banner(page)).toBeVisible();
  await expect(banner(page)).toContainText(
    "Actualizamos el aviso de privacidad y los términos. Revisa los cambios",
  );
  await expect(banner(page).getByRole("link", { name: "Aviso de privacidad" })).toBeVisible();
  await expect(banner(page).getByRole("link", { name: "Términos y condiciones" })).toBeVisible();
  return user;
}

test("«Aceptar» queda guardado: después de recargar y en otra pestaña ya no aparece", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const user = await userWithOldConsent(page);
  const before = await legalConsents(user.email);

  await banner(page).getByRole("button", { name: "Aceptar" }).click();
  await expect(page.getByText("Gracias. Guardamos tu aceptación.")).toBeVisible();
  await expect(banner(page)).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("main")).toBeVisible();
  await expect(banner(page)).toHaveCount(0);

  // No es solo esta pestaña: el servidor ya no lo pide (tampoco en el Studio).
  const other = await page.context().newPage();
  await other.goto("/studio");
  await expect(other.getByRole("main")).toBeVisible();
  await expect(banner(other)).toHaveCount(0);
  await other.close();

  // El historial solo crece: una fila nueva por documento, con la versión vigente.
  const after = await legalConsents(user.email);
  expect(after).toHaveLength(before.length + 2);
  const latest = new Map<string, { version: string; granted: boolean }>();
  for (const row of after) if (!latest.has(row.type)) latest.set(row.type, row);
  for (const type of ["TERMS", "PRIVACY_NOTICE"]) {
    expect(latest.get(type)?.granted).toBe(true);
    expect(latest.get(type)?.version).not.toBe(OLD_VERSION);
  }
});

test("«Ocultar» solo dura en esa pestaña; el aviso también sale en el Studio y en /admin", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const user = await userWithOldConsent(page);

  await banner(page).getByRole("button", { name: "Ocultar por ahora" }).click();
  await expect(banner(page)).toHaveCount(0);

  // En la misma pestaña sigue oculto al recargar y al ir al Studio (sessionStorage).
  await page.reload();
  await expect(page.getByRole("main")).toBeVisible();
  await expect(banner(page)).toBeHidden();
  await page.goto("/studio");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(banner(page)).toBeHidden();

  // Otra pestaña: vuelve a aparecer, en la red social y en el Studio. Nada se guardó.
  const other = await page.context().newPage();
  await other.goto("/");
  await expect(banner(other)).toBeVisible();
  await other.goto("/studio");
  await expect(banner(other)).toBeVisible();
  const versions = (await legalConsents(user.email)).map((row) => row.version);
  expect(new Set(versions)).toEqual(new Set([OLD_VERSION]));

  // Y en /admin, con el rol de equipo (se quita al terminar).
  makeAdmin(user.email);
  try {
    await other.goto("/admin");
    await expect(other).toHaveTitle(/Administración/);
    await expect(banner(other)).toBeVisible();
  } finally {
    makeAdmin(user.email, "--revoke");
  }
  await other.close();
});
