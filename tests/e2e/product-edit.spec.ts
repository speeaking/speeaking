import { type Browser, expect, type Page, test } from "@playwright/test";
import { registerAndOnboard, TINY_PNG } from "./helpers";

const TITLE = "Lámpara de escritorio LED";
const NEW_TITLE = "Lámpara de escritorio LED Pro";
/** Costos con cifras poco comunes para buscarlos en el HTML público sin falsos positivos. */
const COST = { typed: "8134.79", cents: "813479" };
const NEW_COST = { typed: "9051.37", cents: "905137" };

const image = (name: string) => ({ name, mimeType: "image/png", buffer: TINY_PNG });

/** Activa la tienda desde una página del Studio que la pide (P6). */
async function activateStore(page: Page) {
  await page.getByLabel("Ciudad").fill("Ciudad de México");
  await page.getByLabel("Estado").fill("CDMX");
  await page.getByRole("button", { name: "Activar mi tienda" }).click();
}

/** Vendedor nuevo: activa su tienda y publica un producto a mano. Devuelve la URL pública. */
async function createProduct(page: Page) {
  await page.goto("/studio/productos/nuevo");
  await activateStore(page);

  await page.getByLabel("Elegir imágenes").setInputFiles(image("lampara.png"));
  await expect(page.locator('input[name="mediaIds"]')).toHaveCount(1);
  await page.getByLabel("Nombre del producto").fill(TITLE);
  await page.getByLabel("Descripción").fill("Lámpara LED con brazo flexible y tres tonos de luz.");
  await page.getByLabel("Categoría").selectOption({ index: 1 });
  await page.getByLabel("Precio (MXN)").fill("12,500");
  await page.getByLabel("Tu costo (MXN)").fill(COST.typed);
  await page.getByLabel("Piezas disponibles").fill("5");
  await page.getByLabel("Costo de envío").fill("99");
  await page.getByRole("button", { name: "Publicar producto" }).click();

  await expect(page).toHaveURL(/\/producto\/lampara-de-escritorio-led-[a-z0-9]+\?nuevo=1/);
  return page.url().split("?")[0]!;
}

async function newUser(browser: Browser, isMobile: boolean) {
  const context = await browser.newContext(
    isMobile ? { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true } : {},
  );
  const page = await context.newPage();
  await registerAndOnboard(page);
  return { context, page };
}

const mediaIds = (page: Page) =>
  page
    .locator('input[name="mediaIds"]')
    .evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));

/** El costo es privado: no aparece en el HTML que recibe quien compra (ni el anterior ni el nuevo). */
function expectNoCost(html: string) {
  for (const value of [COST.typed, COST.cents, NEW_COST.typed, NEW_COST.cents]) {
    expect(html).not.toContain(value);
  }
  expect(html).not.toMatch(/unitCost/i);
}

test.describe("editar productos", () => {
  test("el vendedor edita, reordena fotos, pausa y reactiva; nadie más puede editarlo", async ({
    page,
    browser,
    isMobile,
  }) => {
    await registerAndOnboard(page);
    const productUrl = await createProduct(page);

    // Studio: cada producto muestra su estado y se puede editar.
    await page.goto("/studio/productos");
    const item = page.getByRole("listitem").filter({ hasText: TITLE });
    await expect(item.getByText("Activo", { exact: true })).toBeVisible();
    await item.getByRole("link", { name: /^Editar/ }).click();
    await expect(page).toHaveURL(/\/studio\/productos\/[0-9a-f-]{36}\/editar$/);
    const editUrl = page.url();

    // Prellenado con los datos actuales, incluido el costo privado (solo su dueño lo ve aquí).
    await expect(page.getByRole("heading", { level: 1, name: "Editar producto" })).toBeVisible();
    await expect(page.getByLabel("Nombre del producto")).toHaveValue(TITLE);
    await expect(page.getByLabel("Tu costo (MXN)")).toHaveValue(COST.typed);
    await expect(page.getByLabel("Piezas disponibles")).toHaveValue("5");
    await expect(page.getByLabel("Publicar también en el feed")).toHaveCount(0);

    // Un error de validación no borra lo que ya se cambió.
    await page.getByLabel("Nombre del producto").fill(NEW_TITLE);
    await page.getByLabel("Precio (MXN)").fill("abc");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Escribe un precio válido.")).toBeVisible();
    await expect(page.getByLabel("Nombre del producto")).toHaveValue(NEW_TITLE);

    // Otra foto que pasa a ser la portada: el servidor guarda el orden elegido.
    await page.getByLabel("Elegir imágenes").setInputFiles(image("lampara-2.png"));
    await expect(page.locator('input[name="mediaIds"]')).toHaveCount(2);
    const [first, second] = await mediaIds(page);
    await page.getByRole("button", { name: "Mover foto 2 a la izquierda" }).click();
    expect(await mediaIds(page)).toEqual([second, first]);

    await page.getByLabel("Precio (MXN)").fill("11,000");
    await page.getByLabel("Tu costo (MXN)").fill(NEW_COST.typed);
    await page.getByLabel("Piezas disponibles").fill("3");
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(page).toHaveURL("/studio/productos?guardado=1");
    await expect(
      page.getByRole("status").filter({ hasText: "Guardamos tus cambios." }),
    ).toBeVisible();
    const edited = page.getByRole("listitem").filter({ hasText: NEW_TITLE });
    await expect(edited.getByText(/3 en inventario/)).toBeVisible();

    await page.goto(editUrl);
    await expect(page.getByLabel("Tu costo (MXN)")).toHaveValue(NEW_COST.typed);
    expect(await mediaIds(page)).toEqual([second, first]);

    // Quien compra ve los cambios en la misma URL (el slug no cambia) y nunca el costo.
    const { context, page: buyer } = await newUser(browser, isMobile);
    const response = await buyer.goto(productUrl);
    expectNoCost((await response?.text()) ?? "");
    await expect(buyer.getByRole("heading", { level: 1, name: NEW_TITLE })).toBeVisible();
    await expect(buyer.getByText("$11,000", { exact: true }).first()).toBeVisible();
    await expect(buyer.getByText(/Disponible · 3 piezas/)).toBeVisible();
    await expect(buyer.getByRole("button", { name: "Comprar ahora" })).toBeVisible();

    // Pausado: la página sigue existiendo (enlaces compartidos) pero ya no se puede comprar.
    await page.goto("/studio/productos");
    await edited.getByRole("button", { name: /^Pausar/ }).click();
    await expect(edited.getByText("Pausado", { exact: true })).toBeVisible();
    await buyer.reload();
    await expect(buyer.getByText("Pausado por el vendedor")).toBeVisible();
    await expect(buyer.getByRole("button", { name: "Comprar ahora" })).toHaveCount(0);

    // Reactivado: se vuelve a vender.
    await edited.getByRole("button", { name: /^Reactivar/ }).click();
    await expect(edited.getByText("Activo", { exact: true })).toBeVisible();
    await buyer.reload();
    await expect(buyer.getByRole("button", { name: "Comprar ahora" })).toBeVisible();

    // Otra persona con su propia tienda no puede abrir el editor (ni ver el costo).
    await buyer.goto("/studio/productos");
    await activateStore(buyer);
    await expect(buyer.getByText("Aún no tienes productos")).toBeVisible();
    const denied = await buyer.goto(editUrl);
    // Bajo carga, confirmar que la navegación llegó al editor antes de buscar el 404.
    await buyer.waitForURL((url) => url.pathname.endsWith("/editar"));
    await expect(buyer.getByText("No encontramos esta página")).toBeVisible();
    await expect(buyer.getByRole("button", { name: "Guardar cambios" })).toHaveCount(0);
    expectNoCost((await denied?.text()) ?? "");
    await context.close();
  });
});
