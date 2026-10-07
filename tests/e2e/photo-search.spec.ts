import { expect, test } from "@playwright/test";
import { registerAndOnboard, TINY_PNG, waitForHydration } from "./helpers";

// Buscar con una foto (ADR-061). La suite corre con la IA simulada: sin ver la foto, siempre «ve»
// una camisa blanca y unos jeans azules, y la plataforma busca eso en el catálogo semilla.
test("una foto se convierte en cosas para buscar, con productos reales de las tiendas", async ({
  page,
}) => {
  test.slow();
  await registerAndOnboard(page);
  await page.goto("/buscar");
  // El acceso es el botón con la cámara junto al título (f244990).
  await page.getByRole("link", { name: "Buscar productos con una foto" }).click();
  await expect(page).toHaveURL(/\/buscar\/foto$/);
  await expect(page.getByRole("heading", { name: "Buscar con una foto" })).toBeVisible();
  // La promesa de privacidad se lee ANTES de elegir la foto.
  await expect(page.getByText(/Tu foto no se guarda/)).toBeVisible();
  await expect(page.getByText(/Nunca reconocemos a las personas/)).toBeVisible();

  // Con el campo ya en manos de React: un `change` antes de cargar la página se pierde.
  const input = page.getByLabel("Elegir foto para buscar");
  await waitForHydration(input);
  await input.setInputFiles({ name: "outfit.png", mimeType: "image/png", buffer: TINY_PNG });

  const results = page.getByRole("region", { name: "Esto vimos en tu foto" });
  await expect(results).toBeVisible();
  await expect(results).toContainText("Texto de ejemplo (IA simulada)");
  const chips = results.getByRole("group", { name: "Cosas en tu foto" });
  const shirt = chips.getByRole("button", { name: "Camisa blanca" });
  const jeans = chips.getByRole("button", { name: "Jeans azul" });
  await expect(shirt).toHaveAttribute("aria-pressed", "true");
  await expect(results.getByRole("list", { name: "Parecidos a: Camisa blanca" })).toContainText(
    "Camisa blanca de vestir slim",
  );

  await jeans.click();
  await expect(jeans).toHaveAttribute("aria-pressed", "true");
  await expect(results.getByRole("list", { name: "Parecidos a: Jeans azul" })).toContainText(
    "Jeans rectos azul claro",
  );
});

test("sin cuenta, buscar con una foto pide entrar", async ({ page }) => {
  await page.goto("/buscar/foto");
  await expect(page).toHaveURL(/\/entrar/);
});
