import { expect, test } from "@playwright/test";
import { registerAndOnboard, waitForHydration } from "./helpers";

// Lo que se abre ahí mismo, sin salir de donde estabas (ADR-068): «Crear» y la ventana para
// escribir una publicación encima del feed. La campana y los mensajes: notifications y messages.

test("«Crear» abre sus opciones y la publicación se escribe encima del feed; al cerrar sigues ahí", async ({
  page,
  isMobile,
}) => {
  test.slow();
  await registerAndOnboard(page);
  await expect(page).toHaveURL("/");

  // «Crear» abre un menú, no otra página: en escritorio, el botón de la barra; en teléfono, el «+»
  // «Crear publicación» del encabezado (c52810a: la barra de abajo ya no lleva «Crear»).
  const create = page
    .getByRole("banner")
    .getByRole("button", { name: isMobile ? "Crear publicación" : "Crear", exact: true });
  await expect(create).toHaveAttribute("aria-haspopup", "menu");
  // Antes de que React tome la barra es solo el enlace a /crear.
  await waitForHydration(create);
  await create.click();
  await page.getByRole("menuitem", { name: /^Publicación/ }).click();

  const composer = page.getByRole("dialog", { name: "Crear publicación" });
  await expect(composer).toBeVisible();
  await expect(page).toHaveURL("/crear/publicacion");
  // El feed sigue detrás (tapado por la ventana: fuera del árbol accesible mientras está abierta,
  // por eso se busca por CSS): el compositor del inicio sigue en <main>.
  await expect(page.locator('main section[aria-label="Crear publicación"]')).toBeAttached();

  const text = `Escrita encima del feed ${Date.now()}`;
  await composer.getByLabel("¿Qué quieres compartir?").fill(text);
  await composer.getByRole("button", { name: "Publicar" }).click();

  // La publicación nueva se abre en su capa…
  await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}$/);
  const layer = page.getByRole("dialog", { name: "Publicación" });
  await expect(layer.getByText(text)).toBeVisible();

  // …y al cerrarla se regresa al feed (no al formulario ya enviado), con la publicación ahí.
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText(text).first()).toBeAttached();
});

test("el campo «¿Qué quieres compartir?» del inicio abre la misma ventana; recargar abre la página", async ({
  page,
}) => {
  test.slow();
  await registerAndOnboard(page);
  const field = page.getByRole("link", { name: /¿Qué quieres compartir/ });
  await waitForHydration(field);
  await field.click();
  await expect(page.getByRole("dialog", { name: "Crear publicación" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "Nueva publicación" })).toBeVisible();
});
