import { expect, test } from "@playwright/test";
import { createProduct, registerAndOnboard } from "./helpers";

// Producto destacado (ADR-046): la tienda paga días desde su saldo y el producto sale como
// «Patrocinado» en Comprar, en la columna derecha y en las fichas de otros productos.

test("la tienda destaca un producto desde su saldo y aparece como «Patrocinado»", async ({
  page,
  browser,
  isMobile,
}) => {
  test.setTimeout(180_000);
  await registerAndOnboard(page);
  const title = `Termo destacado ${Date.now().toString(36)}`;
  const productUrl = await createProduct(page, { title });

  // Sin saldo no se puede destacar: primero la recarga (simulada).
  await page.goto("/studio/campanas");
  await expect(page.getByRole("heading", { level: 1, name: "Campañas" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Destacar por/ })).toBeDisabled();
  await page.goto("/studio/saldo");
  await page.getByRole("button", { name: "Recargar" }).nth(1).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Recarga simulada aplicada" }),
  ).toBeVisible();

  // Destacar 7 días cuesta $105 y se descuenta del saldo.
  await page.goto("/studio/campanas");
  await page.getByLabel("Días").selectOption("7");
  await page.getByRole("button", { name: /Destacar por \$105/ }).click();
  await expect(
    page.getByRole("status").filter({ hasText: /Listo: destacado hasta/ }),
  ).toBeVisible();
  await expect(page.getByText(/Destacado hasta el .* · 7 días/)).toBeVisible();
  await expect(page.getByText("Tienes 1 producto destacado.")).toBeVisible();
  await page.goto("/studio/saldo");
  await expect(page.getByText("Producto destacado")).toBeVisible();
  await expect(page.getByText("-$105")).toBeVisible();

  // Otra persona lo ve como «Patrocinado» arriba de Comprar; a su dueño no se le anuncia el suyo
  // (la fila puede traer destacados de otras tiendas).
  await page.goto("/comprar");
  await expect(
    page.getByRole("region", { name: /Destacados/ }).getByRole("link", { name: new RegExp(title) }),
  ).toHaveCount(0);
  const context = await browser.newContext(
    isMobile ? { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true } : {},
  );
  const visitor = await context.newPage();
  await visitor.goto("/comprar");
  // La fila rota por hora entre todos los destacados vigentes (otras pruebas también destacan):
  // se comprueba la fila y su etiqueta, no que el producto de esta prueba caiga en los 3 lugares.
  const row = visitor.getByRole("region", { name: /Destacados/ });
  await expect(row).toBeVisible();
  const cards = row.getByRole("link", { name: /Patrocinado/ });
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeLessThanOrEqual(3);
  await expect(cards.first()).toHaveAttribute("href", /\?ref=destacado$/);
  // Llegar desde un lugar patrocinado deja la visita contada para la tienda.
  await visitor.goto(`${productUrl}?ref=destacado`);
  await expect(visitor.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await context.close();

  // La visita desde el destacado le cuenta a la tienda (los eventos se guardan después de responder).
  await expect
    .poll(
      async () => {
        await page.goto("/studio/campanas");
        return page.getByText(/1 visita desde un destacado/).count();
      },
      { timeout: 30_000 },
    )
    .toBe(1);
});
