import { type Browser, expect, type Page, test } from "@playwright/test";
import { registerAndOnboard, TINY_PNG } from "./helpers";

const SALE_TEXT = "Tengo 50 AirPods Pro 2. Me costaron $2,400 y quiero venderlos a $3,499.";

/** Vendedor: Vende con IA → propuesta → activar tienda → producto prellenado → publicado. */
async function sellWithAi(page: Page) {
  await page.goto("/studio/vende-con-ia");
  await page.getByLabel("¿Qué quieres vender hoy?").fill(SALE_TEXT);

  // Los números se detectan del texto y la persona los confirma (P2).
  await expect(page.getByLabel("Precio c/u")).toHaveValue("3,499");
  await expect(page.getByLabel("Costo c/u")).toHaveValue("2,400");
  await expect(page.getByLabel("Piezas")).toHaveValue("50");
  await page.getByRole("button", { name: "Crear mi propuesta" }).click();

  await expect(page.getByRole("heading", { name: "Tus números" })).toBeVisible();
  await expect(page.getByText("$1,099 (31.4 %)")).toBeVisible();
  await page.getByRole("link", { name: "Crear producto con esta propuesta" }).click();

  // P6: la tienda se activa en el momento.
  await page.getByLabel("Ciudad").fill("Ciudad de México");
  await page.getByLabel("Estado").fill("CDMX");
  await page.getByRole("button", { name: "Activar mi tienda" }).click();

  // P3: el formulario llega prellenado con la propuesta.
  await expect(page.getByLabel("Nombre del producto")).toHaveValue("AirPods Pro 2");
  await expect(page.getByLabel("Precio (MXN)")).toHaveValue("3499");
  await page.getByLabel("Elegir imágenes").setInputFiles({
    name: "airpods.png",
    mimeType: "image/png",
    buffer: TINY_PNG,
  });
  await expect(page.locator('input[name="mediaIds"]')).toHaveCount(1);
  await page.getByLabel("Costo de envío").fill("99");
  await page.getByRole("button", { name: "Publicar producto" }).click();

  await expect(page).toHaveURL(/\/producto\/airpods-pro-2-[a-z0-9]+\?nuevo=1/);
  await expect(page.getByText("¡Listo! Tu producto ya está publicado.")).toBeVisible();
  return page.url().split("?")[0]!;
}

async function newBuyer(browser: Browser, isMobile: boolean) {
  const context = await browser.newContext(
    isMobile ? { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true } : {},
  );
  const page = await context.newPage();
  await registerAndOnboard(page);
  return { context, page };
}

/** Enlace al carrito de la navegación (barra superior en móvil, lateral en escritorio). */
const cartLink = (page: Page) => page.getByRole("link", { name: /^Carrito/ });

async function fillAddress(page: Page) {
  await page.getByLabel("Quién recibe").fill("Ana López");
  await page.getByLabel("Teléfono").fill("55 1234 5678");
  await page.getByLabel("Calle").fill("Av. Insurgentes Sur");
  await page.getByLabel("Número exterior").fill("1234");
  await page.getByLabel("Colonia").fill("Del Valle");
  await page.getByLabel("Municipio o alcaldía").fill("Benito Juárez");
  await page.getByLabel("Estado").fill("CDMX");
  await page.getByLabel("Código postal").fill("03100");
}

test.describe("comercio", () => {
  test("Vende con IA crea un producto publicado y su costo nunca llega al comprador", async ({
    page,
    browser,
    isMobile,
  }) => {
    await registerAndOnboard(page);
    const productUrl = await sellWithAi(page);

    const { context, page: buyer } = await newBuyer(browser, isMobile);
    const response = await buyer.goto(productUrl);
    const html = (await response?.text()) ?? "";
    expect(html).not.toContain("240000");
    expect(html).not.toContain("2,400");
    expect(html).not.toMatch(/unitCost/i);

    await buyer.getByRole("button", { name: "¿Sigue disponible?" }).click();
    await expect(buyer.getByRole("status").filter({ hasText: "quedan 50 piezas" })).toBeVisible();
    await context.close();
  });

  test("venta completa: comprar, pagar (simulado) y el vendedor ve el pedido y su beneficio", async ({
    page,
    browser,
    isMobile,
  }) => {
    await registerAndOnboard(page);
    const productUrl = await sellWithAi(page);

    const { context, page: buyer } = await newBuyer(browser, isMobile);
    await buyer.goto(productUrl);
    await buyer.getByRole("button", { name: "Comprar ahora" }).click();
    await expect(buyer).toHaveURL("/checkout");
    await expect(cartLink(buyer)).toHaveAccessibleName(/1/);

    // Un error de validación no borra lo que ya escribió.
    await fillAddress(buyer);
    await buyer.getByLabel("Teléfono").fill("55 1234 567");
    await buyer.getByRole("button", { name: "Continuar al pago" }).click();
    await expect(buyer.getByText("Escribe un teléfono de 10 dígitos.")).toBeVisible();
    await expect(buyer.getByLabel("Teléfono")).toHaveValue("55 1234 567");
    await expect(buyer.getByLabel("Quién recibe")).toHaveValue("Ana López");
    await expect(buyer.getByLabel("Calle")).toHaveValue("Av. Insurgentes Sur");
    await expect(buyer.getByLabel("Colonia")).toHaveValue("Del Valle");
    await expect(buyer.getByLabel("Código postal")).toHaveValue("03100");
    await buyer.getByLabel("Teléfono").fill("55 1234 5678");
    await buyer.getByRole("button", { name: "Continuar al pago" }).click();

    await expect(buyer).toHaveURL(/\/checkout\/pago\/mock_/);
    // El carrito se vació al confirmar: la navegación ya no muestra la pieza (antes de pagar).
    await expect(cartLink(buyer)).not.toHaveAccessibleName(/1/);
    await buyer.getByRole("button", { name: "Pagar (simulado)" }).click();
    await expect(buyer).toHaveURL(/\/pedidos\/[0-9a-f-]{36}$/);
    await expect(buyer.getByRole("heading", { level: 1, name: "Pagado" })).toBeVisible();
    await expect(buyer.getByText(/Pago simulado: no se cobró nada/)).toBeVisible();
    const orderUrl = buyer.url();

    // Vendedor: el pedido aparece y el beneficio refleja la venta (3,499 − 2,400 − 3.5 % estimado).
    await page.goto("/studio/pedidos");
    await expect(page.getByText("1 × AirPods Pro 2")).toBeVisible();
    await expect(page.getByText("Pagado", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Marcar enviado" }).click();
    await expect(page.getByText("Enviado", { exact: true })).toBeVisible();

    // El comprador ve el avance que marcó el vendedor.
    await buyer.goto(orderUrl);
    await expect(buyer.getByRole("heading", { level: 1, name: "Enviado" })).toBeVisible();
    await context.close();

    await page.goto("/studio");
    await expect(page.getByText("$976.53")).toBeVisible();
  });

  test("un pago rechazado cancela la compra y los productos regresan al carrito", async ({
    page,
    browser,
    isMobile,
  }) => {
    await registerAndOnboard(page);
    const productUrl = await sellWithAi(page);

    const { context, page: buyer } = await newBuyer(browser, isMobile);
    await buyer.goto(productUrl);
    await buyer.getByRole("button", { name: "Comprar ahora" }).click();
    await fillAddress(buyer);
    await buyer.getByRole("button", { name: "Continuar al pago" }).click();
    await expect(buyer).toHaveURL(/\/checkout\/pago\/mock_/);
    await buyer.getByText("Opciones de prueba").click();
    await buyer.getByRole("button", { name: "Simular pago rechazado" }).click();

    await expect(buyer.getByRole("heading", { level: 1, name: "Pago rechazado" })).toBeVisible();
    await expect(buyer.getByText("Cancelado")).toBeVisible();
    await expect(cartLink(buyer)).toHaveAccessibleName(/1/);

    // Volver a intentar: el producto está otra vez en el carrito, con el envío a domicilio.
    await buyer.getByRole("link", { name: "Volver a intentar" }).click();
    await expect(buyer).toHaveURL("/carrito");
    const cart = buyer.getByRole("main");
    await expect(cart.getByRole("link", { name: "AirPods Pro 2" })).toBeVisible();
    await expect(cart.getByText("Total con envío a domicilio")).toBeVisible();
    await expect(cart.getByText("$3,598")).toBeVisible();
    await context.close();
  });
});
