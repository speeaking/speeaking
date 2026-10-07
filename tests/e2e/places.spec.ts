import { expect, test } from "@playwright/test";

/**
 * «Comprar en …» (SEO nacional): páginas por estado y por categoría en un estado, solo con al menos
 * 6 productos a la venta. La semilla tiene más de 6 en CDMX (también de moda) y ninguno en Zacatecas.
 */
test.describe("comprar por estado", () => {
  test("la página de un estado con productos lista sus productos y sus datos estructurados", async ({
    page,
  }) => {
    const response = await page.goto("/comprar/en/ciudad-de-mexico");

    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: "Compra en Ciudad de México" }),
    ).toBeVisible();
    expect(await page.locator('main a[href^="/producto/"]').count()).toBeGreaterThanOrEqual(6);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/comprar\/en\/ciudad-de-mexico$/,
    );
    const structured = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(structured.join("")).toContain('"CollectionPage"');
  });

  test("también por categoría en un estado, con la ruta de vuelta", async ({ page }) => {
    const response = await page.goto("/comprar/moda/en/ciudad-de-mexico");

    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: "Moda en Ciudad de México" }),
    ).toBeVisible();
    const more = page.getByRole("navigation", { name: "Más para comprar" });
    await expect(more.getByRole("link", { name: "Todo Ciudad de México" })).toHaveAttribute(
      "href",
      "/comprar/en/ciudad-de-mexico",
    );
  });

  test("sin suficientes productos, o si no es un estado, no hay página", async ({ page }) => {
    // Comprar transmite con `loading.tsx`: su 404 es la página «no encontrada» con `noindex`
    // (Next no puede cambiar el estado HTTP una vez que empezó a transmitir).
    for (const path of [
      "/comprar/en/zacatecas",
      "/comprar/en/narnia",
      "/comprar/moda/en/zacatecas",
    ]) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { name: "No encontramos esta página" }),
        path,
      ).toBeVisible();
      await expect(page.locator('meta[name="robots"]').first(), path).toHaveAttribute(
        "content",
        /noindex/,
      );
    }
  });

  test("Comprar, la categoría y la ficha enlazan las páginas que existen", async ({ page }) => {
    await page.goto("/comprar");
    await expect(
      page
        .getByRole("navigation", { name: "Compra por estado" })
        .getByRole("link", { name: "Ciudad de México" }),
    ).toHaveAttribute("href", "/comprar/en/ciudad-de-mexico");

    await page.goto("/comprar/moda");
    await expect(
      page
        .getByRole("navigation", { name: "Moda por estado" })
        .getByRole("link", { name: "Ciudad de México" }),
    ).toHaveAttribute("href", "/comprar/moda/en/ciudad-de-mexico");

    await page.goto("/producto/airpods-pro-2-demo");
    await expect(
      page.getByRole("link", { name: "Más productos de Ciudad de México" }),
    ).toHaveAttribute("href", "/comprar/en/ciudad-de-mexico");
  });
});
