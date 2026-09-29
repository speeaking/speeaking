import { expect, type Page, test } from "@playwright/test";
import { registerAndOnboard } from "./helpers";

/** Marca la página: si hubo una recarga completa, la marca desaparece. */
async function markDocument(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { __sinRecargar?: boolean }).__sinRecargar = true;
  });
}

async function expectSameDocument(page: Page) {
  expect(
    await page.evaluate(() => (window as unknown as { __sinRecargar?: boolean }).__sinRecargar),
  ).toBe(true);
}

/** Enlaces de producto dentro de un contenedor (sin repetir). */
async function productHrefs(page: Page, scope = page.locator("main")) {
  const hrefs = await scope
    .locator('a[href^="/producto/"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  return [...new Set(hrefs)].sort();
}

test.describe("unirse y salir de una comunidad", () => {
  test("desde /c/gaming, la columna izquierda se actualiza sin recargar y «Deshacer» vuelve a unir", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "La columna izquierda solo existe en escritorio.");
    // El onboarding de prueba une a Gaming, Tecnología y Comida.
    await registerAndOnboard(page);
    await page.goto("/c/gaming");
    const yours = page.getByRole("region", { name: "Tus comunidades" });
    const gamingInRail = yours.getByRole("link", { name: /^Gaming/ });
    await expect(gamingInRail).toBeVisible();
    await markDocument(page);

    // Salir: el nombre empieza con lo que se ve («Miembro»), dice lo que hace y avisa con «Deshacer».
    await page.getByRole("main").getByRole("button", { name: "Miembro, salir de Gaming" }).click();
    await expect(page.getByText("Saliste de Gaming")).toBeVisible();
    await expect(gamingInRail).toHaveCount(0);
    // Ya no es suya: vuelve a «Para descubrir».
    await expect(
      page.getByRole("region", { name: "Para descubrir" }).getByRole("link", { name: /^Gaming/ }),
    ).toBeVisible();

    // Unirse desde la página de la comunidad: la columna la muestra de nuevo sin recargar.
    const join = page.getByRole("main").getByRole("button", { name: "Unirme a Gaming" });
    await join.click();
    await expect(gamingInRail).toBeVisible();
    await expect(
      page.getByRole("main").getByRole("button", { name: "Miembro, salir de Gaming" }),
    ).toBeVisible();

    // Salir otra vez, ahora con el teclado: el foco se queda en el botón mientras espera y después.
    const member = page.getByRole("main").getByRole("button", { name: "Miembro, salir de Gaming" });
    await member.focus();
    await page.keyboard.press("Enter");
    const joinAgain = page.getByRole("main").getByRole("button", { name: "Unirme a Gaming" });
    await expect(joinAgain).toBeFocused();
    await expect(gamingInRail).toHaveCount(0);
    await expect(joinAgain).toBeFocused();
    await page.getByRole("button", { name: "Deshacer" }).click();
    await expect(gamingInRail).toBeVisible();
    await expect(
      page.getByRole("main").getByRole("button", { name: "Miembro, salir de Gaming" }),
    ).toBeVisible();
    await expectSameDocument(page);
  });

  test("en móvil el botón mide 44 px y el aviso no tapa la barra superior", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "Medidas táctiles y posición del aviso en móvil.");
    await registerAndOnboard(page);
    await page.goto("/c/gaming");

    const leave = page.getByRole("main").getByRole("button", { name: "Miembro, salir de Gaming" });
    expect((await leave.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await leave.click();

    const toast = page.locator("[data-sonner-toast]").filter({ hasText: "Saliste de Gaming" });
    await expect(toast).toBeVisible();
    const bar = (await page.getByRole("banner").first().boundingBox())!;
    // El aviso entra deslizándose desde arriba: se mide cuando termina la animación.
    await expect
      .poll(async () => (await toast.boundingBox())?.y ?? -1)
      .toBeGreaterThanOrEqual(bar.y + bar.height);

    // «Deshacer» se ve pequeño, pero su área táctil llega a 44 px: 8 px arriba y abajo de su borde
    // todavía es el botón.
    const undo = toast.getByRole("button", { name: "Deshacer" });
    const undoBox = (await undo.boundingBox())!;
    for (const y of [undoBox.y - 8, undoBox.y + undoBox.height + 8]) {
      const hit = await page.evaluate(
        ([x, y]) => document.elementFromPoint(x!, y!)?.textContent ?? "",
        [undoBox.x + undoBox.width / 2, y],
      );
      expect(hit).toBe("Deshacer");
    }

    // Deja la cuenta como estaba.
    await undo.click();
    await expect(
      page.getByRole("main").getByRole("button", { name: "Miembro, salir de Gaming" }),
    ).toBeVisible();
  });

  test("al visitante, «Unirme a Gaming» lo lleva a crear cuenta con la comunidad", async ({
    page,
  }) => {
    await page.goto("/c/gaming");
    const join = page.getByRole("main").getByRole("link", { name: "Unirme a Gaming" });
    await expect(join).toHaveAttribute("href", "/registro?next=%2Fc%2Fgaming&unirse=gaming");
    const box = await join.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(40);
  });
});

test.describe("búsqueda de Comprar", () => {
  test("sin acentos ni mayúsculas y por palabras, igual que /buscar", async ({ page }) => {
    // «mecánico» es una etiqueta real de la semilla (el teclado) y ninguna otra prueba publica
    // teclados: la comparación no depende de lo que otras pruebas creen en paralelo.
    await page.goto("/comprar?q=mecanico");
    const main = page.getByRole("main");
    const keyboard = main.getByRole("link", { name: /Teclado mecánico/ });
    await expect(keyboard).toBeVisible();
    const plain = await productHrefs(page);
    expect(plain.some((href) => href?.includes("teclado-mecanico"))).toBe(true);

    // Con acento y en mayúsculas es la misma búsqueda.
    await page.goto(`/comprar?q=${encodeURIComponent("MECÁNICO")}`);
    await expect(keyboard).toBeVisible();
    expect(await productHrefs(page)).toEqual(plain);

    // Coincide con la sección de productos de /buscar.
    await page.goto("/buscar?q=mecanico");
    const section = page.getByRole("region", { name: "Productos" });
    await expect(section).toBeVisible();
    expect(await productHrefs(page, section)).toEqual(plain);

    // Por palabras: «control inalambrico» exige ambas (el control sí, los AirPods no).
    await page.goto(`/comprar?q=${encodeURIComponent("control inalambrico")}`);
    await expect(main.getByRole("link", { name: /Control inalámbrico/ })).toBeVisible();
    await expect(main.getByRole("link", { name: /AirPods Pro 2/ })).toHaveCount(0);
  });

  test("sin resultados en una categoría, ofrece buscar en todas", async ({ page }) => {
    await page.goto("/comprar?categoria=electronica&q=control");
    const main = page.getByRole("main");
    await expect(
      main.getByRole("heading", { name: "Sin resultados para “control” en Electrónica" }),
    ).toBeVisible();
    await expect(main.getByRole("link", { name: "Todo" })).not.toHaveAttribute("aria-current");

    await main.getByRole("link", { name: "Buscar en todas las categorías" }).click();
    await expect(page).toHaveURL("/comprar?q=control");
    await expect(main.getByRole("link", { name: /Control inalámbrico/ })).toBeVisible();
    await expect(main.getByRole("link", { name: "Todo" })).toHaveAttribute("aria-current", "page");
  });
});
