import { expect, test } from "@playwright/test";
import { registerAndOnboard, TINY_PNG } from "./helpers";

// Estilista (ADR-043), Pruébatelo (ADR-045) y saldo (ADR-044) con la IA simulada: sin red ni costo.
// Usa los productos de moda de la semilla («Ropero Demo Roma»).

const NEED = "Tengo una boda de noche y quiero algo moderno por menos de $3,000";

test.describe("estilista", () => {
  test("una persona visitante pide un look y recibe combinaciones con productos reales", async ({
    page,
  }) => {
    // Red social primero: el inicio no abre con el estilista; su entrada está arriba de Comprar.
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Para ti" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "¿Qué necesitas?" })).toHaveCount(0);
    await page.goto("/comprar");
    await expect(page.getByRole("heading", { name: "¿Qué necesitas?" })).toBeVisible();

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
    // Desde Comprar, cada prenda ofrece «Ver cómo me veo» sobre su foto (ADR-046).
    await page.goto("/comprar?categoria=moda");
    await expect(
      page.getByRole("main").getByRole("link", { name: /^Ver cómo me veo: Camisa blanca/ }),
    ).toHaveAttribute("href", /\/producto\/camisa-blanca-vestir-demo\?probar=1/);

    await page.goto("/producto/camisa-blanca-vestir-demo");
    // Visitante: el botón lleva a crear cuenta y regresa a la ficha (exacto: las tarjetas de
    // relacionados también ofrecen «Ver cómo me veo: <producto>»).
    await expect(page.getByRole("link", { name: "Ver cómo me veo", exact: true })).toHaveAttribute(
      "href",
      /\/registro\?next=/,
    );
    await page.getByRole("link", { name: "Completa mi look" }).click();
    await expect(page).toHaveURL(/\/estilista\/completa\/camisa-blanca-vestir-demo/);
    await expect(page.getByRole("heading", { level: 1, name: "Completa mi look" })).toBeVisible();
    await expect(page.getByText("fijo en todos los looks")).toBeVisible();
    await expect(page.getByRole("article").first()).toBeVisible();

    await page.goto("/producto/prensa-francesa-1l-demo");
    await expect(page.getByRole("link", { name: "Ver cómo me veo" })).toHaveCount(0);
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

    // «Ver cómo me veo» desde la ficha, en un solo paso (ADR-046): la foto, el consentimiento y
    // la simulación aparecen en el mismo diálogo. La prueba la paga la tienda (semilla) o speeaking;
    // quien compra, nunca.
    // Llegar con ?probar=1 (desde una tarjeta del feed o de Comprar) abre el diálogo solo.
    await page.goto("/producto/camisa-blanca-vestir-demo?probar=1");
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/Es gratis para ti/)).toBeVisible();
    // Sin `chooseImages`: el diálogo va en un portal que solo existe en el navegador, así que su
    // campo ya es de React cuando aparece.
    await dialog
      .getByLabel("Elegir imágenes")
      .setInputFiles({ name: "yo.png", mimeType: "image/png", buffer: TINY_PNG });
    await expect(dialog.locator('input[name="mediaId"]')).toHaveCount(1);
    await dialog.getByRole("checkbox", { name: /Acepto que speeaking use esta foto/ }).check();
    await dialog.getByRole("button", { name: "Ver cómo me veo" }).click();
    await expect(dialog.getByRole("heading", { name: "Así podrías verte" })).toBeVisible({
      timeout: 60_000,
    });
    await expect(
      dialog.getByRole("img", { name: /Simulación de cómo podría verse/ }),
    ).toBeVisible();
    await expect(dialog.getByText(/Cortesía de (la tienda|speeaking)/)).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Comprar ahora" })).toBeVisible();
    // «Agrégale…»: complementos reales de otros huecos.
    await expect(dialog.getByRole("heading", { name: /Agrégale/ })).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: /Calzado|Parte de abajo/ }).first(),
    ).toBeVisible();
    // Comprar desde el diálogo lleva al checkout con la prenda.
    await dialog.getByRole("button", { name: "Comprar ahora" }).click();
    await expect(page).toHaveURL(/\/checkout/);

    // El estudio (/probar) sigue para looks completos: la foto guardada ya aparece ahí.
    await page.goto(`/estilista?necesidad=${encodeURIComponent(NEED)}`);
    await page.getByRole("article").first().getByRole("link", { name: "Pruébatelo" }).click();
    await expect(page).toHaveURL(/\/probar\?look=/);
    await expect(page.getByRole("list", { name: "Tus fotos" }).getByRole("button")).toHaveCount(1);
    await expect(page.getByText(/cortesía de (la tienda|speeaking)/)).toBeVisible();

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

  test("el saldo es de las tiendas: se recarga (simulado) en el Studio y los precios son públicos", async ({
    page,
  }) => {
    await page.goto("/precios");
    await expect(page.getByRole("heading", { level: 1, name: "Precios" })).toBeVisible();
    await expect(page.getByText("Si compras: gratis, siempre")).toBeVisible();
    await expect(page.getByText("nivel 1")).toBeVisible();
    await expect(page.getByText("$3.50").first()).toBeVisible();
    await expect(page.getByText("Arranque")).toBeVisible();

    const user = await registerAndOnboard(page);
    // Sin tienda: para quien compra todo es gratis.
    await page.goto("/saldo");
    await expect(page.getByRole("heading", { name: "Para ti todo es gratis" })).toBeVisible();

    // Con tienda: el saldo vive en el Studio y se recarga (simulado).
    await page.goto("/studio/saldo");
    await page.getByLabel("Nombre de tu tienda").fill(`Tienda de ${user.name}`);
    await page.getByLabel("Ciudad").fill("Ciudad de México");
    await page.getByLabel("Estado").fill("CDMX");
    await page.getByRole("button", { name: "Activar mi tienda" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Saldo y «Ver cómo me veo»" }),
    ).toBeVisible();
    await expect(page.getByText("$0", { exact: true })).toBeVisible();
    await expect(page.getByText(/te quedan 10/)).toBeVisible();
    await page.getByRole("button", { name: "Recargar" }).first().click();
    await expect(
      page.getByRole("status").filter({ hasText: "Recarga simulada aplicada" }),
    ).toBeVisible();
    await expect(page.getByText("$99", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Recarga (simulada)")).toBeVisible();
  });
});
