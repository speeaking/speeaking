import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { completeOnboarding, expectStreamedNotFoundPage, register, uniqueUser } from "./helpers";

// Redacción diaria (ADR-066): la IA deja borradores y solo el equipo decide qué se publica. En la
// suite la IA es simulada (y con `pnpm start` la redacción no redacta con el simulador), así que el
// borrador se crea con `fixtures/editorial-draft.ts` y aquí se prueba la revisión: ajustar el texto,
// publicarlo como la cuenta editorial de la comunidad y descartar otro.

function deskUser() {
  const user = uniqueUser();
  const id = user.email.slice("e2e.".length, -"@example.com".length);
  return { ...user, id, email: `e2e.red.${id}@example.com`, username: `e2e.red.${id}` };
}

const run = (command: string) =>
  execSync(command, { encoding: "utf8", timeout: 90_000, stdio: ["ignore", "pipe", "pipe"] });

/** Corre el script real contra la base de desarrollo (la misma que usa `pnpm dev`). */
function makeAdmin(email: string) {
  run(`pnpm exec tsx scripts/make-admin.ts ${email}`);
}

/** Un borrador pendiente de la comunidad, sin IA. Devuelve su id. */
function createDraft(community: string, body: string) {
  const output = run(`pnpm exec tsx tests/e2e/fixtures/editorial-draft.ts ${community} "${body}"`);
  const id = output.trim().split(/\s+/).pop() ?? "";
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  return id;
}

test("el equipo ajusta y publica un borrador como la cuenta editorial, y descarta otro", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const user = deskUser();
  await register(page, user);
  await completeOnboarding(page, user);
  await expect(page).toHaveURL("/");

  // Sin el rol, la redacción no existe: la misma página «no encontrada» que una ruta inexistente
  // (200 con `noindex`: transmite con el `loading.tsx` raíz).
  await expectStreamedNotFoundPage(page, "/admin/redaccion", {
    hidden: ["Redacción", "Administración", "La IA redacta y tú publicas"],
  });

  makeAdmin(user.email);
  const tag = `${testInfo.project.name} ${user.id}`;
  const toPublish = `E2E pregunta de la redaccion ${tag}`;
  const toDiscard = `E2E borrador para descartar ${tag}`;
  const publishId = createDraft("comida", toPublish);
  const discardId = createDraft("comida", toDiscard);

  await page.goto("/admin/redaccion");
  await expect(page.getByRole("heading", { name: "Redacción", level: 1 })).toBeVisible();
  const card = page.locator(`#borrador-${publishId}`);
  const text = card.getByRole("textbox", { name: "Texto de la publicación" });
  await expect(text).toHaveValue(toPublish);
  // Lo escribió el simulador: se marca como ejemplo para el equipo.
  await expect(card.getByText("Texto de ejemplo")).toBeVisible();
  await expect(card.getByText("Pregunta", { exact: true })).toBeVisible();

  // Ajustar y publicar: el borrador sale de la cola y queda en «Publicadas».
  const edited = `${toPublish} ajustado por el equipo`;
  await text.fill(edited);
  await card.getByRole("button", { name: "Publicar" }).click();
  await expect(card).toHaveCount(0, { timeout: 30_000 });
  const published = page.getByRole("link", { name: edited });
  await expect(published).toBeVisible();

  // La publicación es de la cuenta editorial de Comida, con el texto ajustado y la marca de IA.
  const href = await published.getAttribute("href");
  expect(href).toMatch(/^\/p\/[0-9a-f-]{36}$/);
  await page.goto(href!);
  const article = page.getByRole("article").filter({ hasText: edited }).first();
  await expect(article).toBeVisible();
  await expect(article.getByText("Editorial", { exact: true })).toBeVisible();
  await expect(article.getByRole("link", { name: "Equipo speeaking" })).toBeVisible();
  await expect(article.getByText("Con ayuda de IA")).toBeVisible();
  await expect(article.getByRole("link", { name: "Comida" }).first()).toBeVisible();

  // Descartar: sale de la cola y no se publica.
  await page.goto("/admin/redaccion");
  const other = page.locator(`#borrador-${discardId}`);
  await other.getByRole("button", { name: "Descartar" }).click();
  await expect(other).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByRole("link", { name: toDiscard })).toHaveCount(0);
});
