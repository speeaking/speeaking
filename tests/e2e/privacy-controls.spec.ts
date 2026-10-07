import { expect, type Page, test } from "@playwright/test";
import { completeOnboarding, register } from "./helpers";

/**
 * SEC-27 (ADR-030): la actividad previa al onboarding no queda ligada a la cuenta, el historial de
 * búsqueda se ve y se borra en Ajustes, y desactivar la personalización desliga lo anterior.
 */

function fixUser() {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return {
    name: "Prueba Privacidad",
    email: `e2e.fix.${id}@example.com`,
    password: "clave-de-prueba-segura",
    username: `e2e.fix.${id}`,
  };
}

/**
 * Búsqueda real en Productos: la página la registra en segundo plano (`after`). Solo las búsquedas
 * comerciales guardan su texto (Productos, o Todo cuando devuelve productos): buscar a una persona no
 * deja su nombre como intención de compra (`src/modules/search/README.md`, P5).
 */
async function search(page: Page, text: string) {
  await page.goto(`/buscar?q=${encodeURIComponent(text)}&tipo=productos`);
  await expect(page.getByRole("heading", { level: 1, name: "Buscar" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Buscar en" }).getByRole("link", { name: "Productos" }),
  ).toHaveAttribute("aria-current", "page");
}

function searches(page: Page) {
  return page.getByRole("list", { name: "Búsquedas recientes" });
}

/** Ajustes, recargando hasta que los eventos en segundo plano ya estén guardados. */
async function expectHistory(page: Page, visible: string[], hidden: string[] = []) {
  await expect(async () => {
    await page.goto("/ajustes");
    for (const text of visible) await expect(searches(page).getByText(text)).toBeVisible();
    for (const text of hidden) await expect(page.getByText(text)).toHaveCount(0);
  }).toPass({ timeout: 20_000 });
}

test("historial de búsqueda: sin ligar antes del onboarding, visible, borrable y desligado al desactivar", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const user = fixUser();
  const tag = user.username.slice(-6);
  const before = `antes del registro ${tag}`;
  const first = `audifonos ${tag}`;
  const second = `tenis ${tag}`;

  await register(page, user);
  // Antes de decidir sobre la personalización: la búsqueda se guarda anónima.
  await search(page, before);
  await page.goto("/bienvenida");
  // Para ver su historial, la persona activa «Personalizar mi feed» (ya no viene marcada).
  await completeOnboarding(page, user, { personalize: true });
  await expect(page).toHaveURL("/");

  await search(page, first);
  await expectHistory(page, [first], [before]);

  await page.getByRole("button", { name: "Borrar historial de búsqueda" }).click();
  await expect(page.getByText("No tienes búsquedas guardadas.")).toBeVisible();
  await expect(page.getByText(first)).toHaveCount(0);

  await search(page, second);
  await expectHistory(page, [second]);

  // Desactivar desliga también lo anterior: el historial deja de ser de la cuenta.
  await page.getByRole("button", { name: "Desactivar personalización" }).click();
  await expect(page.getByRole("button", { name: "Activar personalización" })).toBeVisible();
  await expect(
    page.getByText("Con la personalización desactivada no guardamos tus búsquedas."),
  ).toBeVisible();
  await expect(page.getByText(second)).toHaveCount(0);

  // Y lo nuevo tampoco se liga.
  await search(page, `gorras ${tag}`);
  await page.goto("/ajustes");
  await expect(searches(page)).toHaveCount(0);
});
