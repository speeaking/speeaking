import { type Browser, expect, type Page, test } from "@playwright/test";
import { chooseImages, registerAndOnboard, TINY_PNG, waitForHydration } from "./helpers";

const SALE_TEXT = "Tengo 50 AirPods Pro 2. Me costaron $2,400 y quiero venderlos a $3,499.";

/** Vendedor: Sube y vende → propuesta → activar tienda → producto prellenado → publicado. */
/** Tiempo máximo de un paso que espera al modelo real: su plazo (45 s) más el margen del servicio. */
export const AI_STEP_TIMEOUT = 60_000;

async function sellWithAi(page: Page) {
  // Con un modelo real, la propuesta puede tardar lo que tarde el proveedor (hasta su plazo).
  test.slow();
  await page.goto("/studio/sube-y-vende");
  await page.getByLabel("¿Qué quieres vender hoy?").fill(SALE_TEXT);

  // Los números se detectan del texto y la persona los confirma (P2).
  await expect(page.getByLabel("Precio c/u")).toHaveValue("3,499");
  await expect(page.getByLabel("Costo c/u")).toHaveValue("2,400");
  await expect(page.getByLabel("Piezas")).toHaveValue("50");
  await page.getByRole("button", { name: "Crear mi propuesta" }).click();

  await expect(page.getByRole("heading", { name: "Tus números" })).toBeVisible({
    timeout: AI_STEP_TIMEOUT,
  });
  await expect(page.getByText("$1,099 (31.4 %)")).toBeVisible();
  await page.getByRole("link", { name: "Crear producto con esta propuesta" }).click();

  // P6: la tienda se activa en el momento.
  await page.getByLabel("Ciudad").fill("Ciudad de México");
  await page.getByLabel("Estado").fill("CDMX");
  await page.getByRole("button", { name: "Activar mi tienda" }).click();

  // P3: el formulario llega prellenado con la propuesta.
  await expect(page.getByLabel("Nombre del producto")).toHaveValue("AirPods Pro 2");
  await expect(page.getByLabel("Precio (MXN)")).toHaveValue("3499");
  await chooseImages(page, { name: "airpods.png", mimeType: "image/png", buffer: TINY_PNG });
  await expect(page.locator('input[name="mediaIds"]')).toHaveCount(1);
  await page.getByLabel("Costo de envío").fill("99");
  await page.getByLabel(/son míos o tengo permiso/).check();
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

/**
 * Piezas del carrito según la navegación. En escritorio, el ícono de la barra superior («Carrito
 * (n)»). En móvil el carrito vive en el menú de tu cuenta (c52810a, docs/social-activity.md): la
 * opción dice «Carrito (n)», o solo «Carrito» si está vacío.
 */
async function expectCartCount(page: Page, isMobile: boolean, count: number) {
  if (!isMobile) {
    await expect(page.getByRole("link", { name: /^Carrito/ })).toHaveAccessibleName(
      `Carrito (${count})`,
    );
    return;
  }
  const account = page
    .getByRole("navigation", { name: "Navegación principal" })
    .getByRole("button", { name: /^Tu cuenta:/ });
  await waitForHydration(account);
  await account.click();
  const cart = page.getByRole("menuitem", { name: /^Carrito/ });
  await expect(cart).toHaveAccessibleName(count ? `Carrito (${count})` : "Carrito");
  await page.keyboard.press("Escape");
  await expect(cart).toBeHidden();
}

/**
 * «Comprar ahora» en la ficha. El botón solo actúa con React (no es un formulario): un clic antes de
 * que la página termine de cargar se pierde y el checkout nunca abre.
 */
async function buyNow(page: Page) {
  const button = page.getByRole("button", { name: "Comprar ahora" });
  await waitForHydration(button);
  await button.click();
}

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
  test("Sube y vende crea un producto publicado y su costo nunca llega al comprador", async ({
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

  test("venta completa: comprar, pagar (simulado); el vendedor no envía lo que no se cobró y lo cancela", async ({
    page,
    browser,
    isMobile,
  }) => {
    // Dos cuentas, venta, Studio, cancelación y regreso al producto: más que el tiempo por omisión.
    test.slow();
    await registerAndOnboard(page);
    const productUrl = await sellWithAi(page);

    const { context, page: buyer } = await newBuyer(browser, isMobile);
    await buyer.goto(productUrl);
    await buyNow(buyer);
    await expect(buyer).toHaveURL("/checkout");
    await expectCartCount(buyer, isMobile, 1);

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
    await expectCartCount(buyer, isMobile, 0);
    await buyer.getByRole("button", { name: "Pagar (simulado)" }).click();
    await expect(buyer).toHaveURL(/\/pedidos\/[0-9a-f-]{36}$/);
    await expect(buyer.getByRole("heading", { level: 1, name: "Pagado" })).toBeVisible();
    await expect(buyer.getByText(/Pago simulado: no se cobró nada/)).toBeVisible();
    const orderUrl = buyer.url();

    // Vendedor: el beneficio refleja la venta (3,499 − 2,400 − 3.5 % estimado), avisando que el pago
    // fue simulado (SEC-01).
    await page.goto("/studio");
    await expect(page.getByText("$976.53")).toBeVisible();
    await expect(
      page.getByText("Incluye 1 venta con pago simulado: no se cobró dinero."),
    ).toBeVisible();
    // Panel (ADR-056): la venta entra en la semana y el pago simulado aparece como pendiente.
    await expect(page.getByRole("region", { name: "Tu semana" })).toContainText("$3,499");
    await expect(
      page
        .getByRole("region", { name: "Pendientes en tus ventas" })
        .getByRole("link", { name: /Pagos simulados por cancelar/ }),
    ).toContainText("1");

    // El pedido aparece pagado y marcado como simulado, sin "Marcar enviado" y sin el domicilio del
    // comprador: no se cobró dinero, así que no hay nada que enviar (SEC-01, SEC-08).
    await page.goto("/studio/pedidos");
    const sale = page.getByRole("listitem").filter({ hasText: "Pago simulado" });
    await expect(sale.getByText("1 × AirPods Pro 2")).toBeVisible();
    await expect(sale.getByText("Pagado", { exact: true })).toBeVisible();
    await expect(sale.getByText("Pago simulado", { exact: true })).toBeVisible();
    await expect(sale.getByText(/No se cobró dinero: no envíes mercancía/)).toBeVisible();
    await expect(page.getByText(/Insurgentes/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Marcar enviado" })).toHaveCount(0);

    // Lo cancela (SEC-25): la pieza regresa al inventario.
    await sale.getByText("Cancelar pedido", { exact: true }).click();
    await sale.getByRole("button", { name: "Sí, cancelar pedido" }).click();
    await expect(sale.getByText("Cancelado", { exact: true })).toBeVisible();
    // Cancelar un pago simulado era lo correcto: ya no queda nada pendiente en ventas.
    await page.goto("/studio");
    await expect(
      page
        .getByRole("region", { name: "Pendientes en tus ventas" })
        .getByText("Todo en orden: ninguna venta está esperando."),
    ).toBeVisible();

    // El comprador ve la cancelación y la pieza volvió a estar disponible.
    await buyer.goto(orderUrl);
    await expect(buyer.getByRole("heading", { level: 1, name: "Cancelado" })).toBeVisible();
    await expect(buyer.getByText(/El vendedor canceló tu pedido/)).toBeVisible();
    await buyer.goto(productUrl);
    await buyer.getByRole("button", { name: "¿Sigue disponible?" }).click();
    await expect(buyer.getByRole("status").filter({ hasText: "quedan 50 piezas" })).toBeVisible();
    await context.close();
  });

  test("un pago rechazado cancela la compra y los productos regresan al carrito", async ({
    page,
    browser,
    isMobile,
  }) => {
    // Comprador y vendedor (que revisa sus pedidos al final): más que el tiempo por omisión.
    test.slow();
    await registerAndOnboard(page);
    const productUrl = await sellWithAi(page);

    const { context, page: buyer } = await newBuyer(browser, isMobile);
    await buyer.goto(productUrl);
    await buyNow(buyer);
    await fillAddress(buyer);
    await buyer.getByRole("button", { name: "Continuar al pago" }).click();
    await expect(buyer).toHaveURL(/\/checkout\/pago\/mock_/);
    await buyer.getByText("Opciones de prueba").click();
    await buyer.getByRole("button", { name: "Simular pago rechazado" }).click();

    await expect(buyer.getByRole("heading", { level: 1, name: "Pago rechazado" })).toBeVisible();
    await expect(buyer.getByText("Cancelado")).toBeVisible();
    await expectCartCount(buyer, isMobile, 1);

    // Volver a intentar: el producto está otra vez en el carrito, con el envío a domicilio.
    await buyer.getByRole("link", { name: "Volver a intentar" }).click();
    await expect(buyer).toHaveURL("/carrito");
    const cart = buyer.getByRole("main");
    await expect(cart.getByRole("link", { name: "AirPods Pro 2" })).toBeVisible();
    await expect(cart.getByText("Total con envío a domicilio")).toBeVisible();
    await expect(cart.getByText("$3,598")).toBeVisible();
    await context.close();

    // SEC-08: el vendedor no ve un intento de compra que nunca se pagó (ni el domicilio).
    await page.goto("/studio/pedidos");
    await expect(page.getByText("Sin pedidos todavía")).toBeVisible();
    await expect(page.getByText(/Insurgentes/)).toHaveCount(0);
  });

  test("una cuenta no puede apartar más de 10 piezas de un producto sin pagar", async ({
    page,
    browser,
    isMobile,
  }) => {
    // Dos checkouts completos de dos cuentas: más que el tiempo por omisión.
    test.slow();
    await registerAndOnboard(page);
    const productUrl = await sellWithAi(page);

    // SEC-05: aparta 10 piezas y no paga.
    const { context, page: buyer } = await newBuyer(browser, isMobile);
    await buyer.goto(productUrl);
    const plus = buyer.getByRole("button", { name: "Agregar una pieza" });
    const pieces = buyer.locator('span[aria-live="polite"]').first();
    await waitForHydration(plus);
    for (let piece = 2; piece <= 10; piece++) {
      await plus.click();
      await expect(pieces).toHaveText(String(piece));
    }
    await buyNow(buyer);
    await fillAddress(buyer);
    await buyer.getByRole("button", { name: "Continuar al pago" }).click();
    await expect(buyer).toHaveURL(/\/checkout\/pago\/mock_/);

    // Una pieza más del mismo producto ya no se aparta: el checkout avisa y no reserva.
    await buyer.goto(productUrl);
    await buyNow(buyer);
    await expect(buyer).toHaveURL("/checkout");
    await buyer.getByRole("button", { name: "Continuar al pago" }).click();
    await expect(buyer.getByText(/Ya apartaste el máximo de 10 piezas/)).toBeVisible();
    await expect(buyer).toHaveURL("/checkout");
    await context.close();
  });
});
