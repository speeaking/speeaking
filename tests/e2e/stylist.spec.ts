import { expect, test } from "@playwright/test";
import { registerAndOnboard, TINY_PNG } from "./helpers";

// Estilista (ADR-043), Pruébatelo (ADR-045) y saldo (ADR-044) con la IA simulada: sin red ni costo.
// Usa los productos de moda de la semilla («Ropero Demo Roma»).

const NEED = "Tengo una boda de noche y quiero algo moderno por menos de $3,000";

test.describe("estilista", () => {
  test("una persona visitante pide un look y recibe combinaciones con productos reales", async ({
    page,
  }) => {
    await page.goto(`/estilista?necesidad=${encodeURIComponent(NEED)}`);
    await expect(page.getByRole("heading", { level: 1, name: "Tu estilista" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: /Entendí: boda/ })).toBeVisible();
    await expect(page.getByText(/hasta \$3,000/).first()).toBeVisible();

    const looks = page.getByRole("article");
    await expect(looks.first()).toBeVisible();
    expect(await looks.count()).toBeGreaterThanOrEqual(1);
    // Cada pieza es un producto real: enlaza a su ficha y muestra precio y vendedor.
    const first = looks.first();
    await expect(first.locator('a[href^="/producto/"]').first()).toBeVisible();
    await expect(first.getByText("Ropero Demo Roma").first()).toBeVisible();
    // La visita no puede comprar ni cambiar piezas: «Pruébatelo» la manda a crear cuenta.
    await expect(first.getByRole("button", { name: "Comprar look" })).toHaveCount(0);
    await expect(first.getByRole("link", { name: "Pruébatelo" })).toHaveAttribute(
      "href",
      /\/registro\?next=/,
    );
  });

  test("la ficha de una prenda ofrece probársela y completar el look; la de otro producto, no", async ({
    page,
  }) => {
    await page.goto("/producto/camisa-blanca-vestir-demo");
    await expect(page.getByRole("link", { name: "Pruébatelo con tu foto" })).toBeVisible();
    await page.getByRole("link", { name: "Completa mi look" }).click();
    await expect(page).toHaveURL(/\/estilista\/completa\/camisa-blanca-vestir-demo/);
    await expect(page.getByRole("heading", { level: 1, name: "Completa mi look" })).toBeVisible();
    await expect(page.getByText("fijo en todos los looks")).toBeVisible();
    await expect(page.getByRole("article").first()).toBeVisible();

    await page.goto("/producto/prensa-francesa-1l-demo");
    await expect(page.getByRole("link", { name: "Pruébatelo con tu foto" })).toHaveCount(0);
  });

  test("con cuenta: cambia una pieza, compra el look, sube su foto y genera una simulación gratis", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await registerAndOnboard(page);

    await page.goto(`/estilista?necesidad=${encodeURIComponent(NEED)}`);
    const look = page.getByRole("article").first();
    await expect(look).toBeVisible();
    const shoes = look.locator("li").filter({ hasText: "Calzado" }).first();
    const before = await shoes.locator('a[href^="/producto/"]').first().getAttribute("href");
    await shoes.getByRole("button", { name: "Otra opción" }).click();
    await expect
      .poll(async () => shoes.locator('a[href^="/producto/"]').first().getAttribute("href"))
      .not.toBe(before);

    // «Pruébatelo» con el look guardado: sube la foto con consentimiento y genera (simulador).
    await look.getByRole("link", { name: "Pruébatelo" }).click();
    await expect(page).toHaveURL(/\/probar\?look=/);
    await expect(page.getByRole("heading", { level: 1, name: "Pruébatelo" })).toBeVisible();
    await page
      .getByLabel("Elegir imágenes")
      .setInputFiles({ name: "yo.png", mimeType: "image/png", buffer: TINY_PNG });
    await expect(page.locator('input[name="mediaId"]')).toHaveCount(1);
    await page.getByRole("checkbox", { name: /Acepto que Estreno use esta foto/ }).check();
    await page.getByRole("button", { name: "Guardar foto" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Foto guardada" })).toBeVisible();

    await expect(page.getByText(/quedan 3 pruebas gratis/)).toBeVisible();
    await page.getByRole("button", { name: "Pruébatelo", exact: true }).click();
    await expect(page).toHaveURL(/\/probar\/[0-9a-f-]{36}/, { timeout: 60_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Tu simulación" })).toBeVisible();
    await expect(page.getByText(/Simulación generada con IA/)).toBeVisible();
    await expect(page.getByText("Prueba gratis del mes")).toBeVisible();
    await expect(page.getByRole("img", { name: /Simulación de cómo podría verse/ })).toBeVisible();

    // La foto es privada: aparece en Ajustes con su fecha de borrado.
    await page.goto("/ajustes");
    await expect(page.getByRole("heading", { name: "Mis fotos de prueba" })).toBeVisible();
    await expect(page.getByText(/Se borra el/)).toBeVisible();

    // Comprar el look lleva al carrito con sus piezas.
    await page.goto(`/estilista?necesidad=${encodeURIComponent(NEED)}`);
    await page.getByRole("button", { name: "Comprar look" }).first().click();
    await expect(page).toHaveURL(/\/carrito/);
    await expect(page.locator('a[href^="/producto/"]').first()).toBeVisible();
  });

  test("el saldo se recarga (simulado) y los precios son públicos", async ({ page }) => {
    await page.goto("/precios");
    await expect(page.getByRole("heading", { level: 1, name: "Precios" })).toBeVisible();
    await expect(page.getByText("nivel 1")).toBeVisible();
    await expect(page.getByText("$3.50").first()).toBeVisible();

    await registerAndOnboard(page);
    await page.goto("/saldo");
    await expect(page.getByRole("heading", { level: 1, name: "Tu saldo" })).toBeVisible();
    // El saldo se muestra sin centavos cuando son cero («$0», «$39»).
    await expect(page.getByText("$0", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Recargar" }).first().click();
    await expect(
      page.getByRole("status").filter({ hasText: "Recarga simulada aplicada" }),
    ).toBeVisible();
    await expect(page.getByText("$39", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Recarga (simulada)")).toBeVisible();
  });
});
