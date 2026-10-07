import { expect, test } from "@playwright/test";

test.describe("smoke", () => {
  test("la página de inicio carga en español de México sin errores", async ({ page, baseURL }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    // Registramos la URL exacta de cualquier respuesta fallida de nuestra app.
    page.on("response", (response) => {
      if (response.status() >= 400 && baseURL && response.url().startsWith(baseURL)) {
        errors.push(`${response.status()} ${response.url()}`);
      }
    });

    const response = await page.goto("/");
    await page.waitForLoadState("networkidle");

    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", "es-MX");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("Buscar es público y Guardados pide iniciar sesión", async ({ page }) => {
    await page.goto("/buscar");
    await expect(page.getByRole("heading", { level: 1, name: "Buscar" })).toBeVisible();

    await page.goto("/guardados");
    await expect(page).toHaveURL(/\/entrar\?next=%2Fguardados/);
  });

  test("la rejilla de escritorio se adapta al ancho sin desbordar", async ({ page, isMobile }) => {
    test.skip(isMobile, "En móvil no hay columnas laterales.");
    const nav = page.getByRole("navigation", { name: "Navegación principal" }).first();
    const rightRail = page.getByRole("complementary", { name: "Más para ti" });
    const search = page.getByRole("searchbox", {
      name: "Buscar personas, comunidades, publicaciones, videos o productos",
    });

    // [ancho, columna izquierda con texto, columna derecha visible]
    const layouts = [
      [820, false, false],
      [1100, true, false],
      [1352, true, true],
    ] as const;
    for (const [width, labels, aside] of layouts) {
      await page.setViewportSize({ width, height: 760 });
      await page.goto("/");
      await expect(search).toBeVisible();
      const railWidth = (await nav.boundingBox())?.width ?? 0;
      expect(railWidth, `columna izquierda a ${width}px`).toBeLessThanOrEqual(labels ? 232 : 72);
      expect(railWidth).toBeGreaterThan(labels ? 150 : 0);
      await expect(rightRail).toBeVisible({ visible: aside });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, `desborde horizontal a ${width}px`).toBeLessThanOrEqual(0);
    }
  });

  test("en móvil, los controles de las barras miden al menos 44 px", async ({ page, isMobile }) => {
    test.skip(!isMobile, "El mínimo táctil aplica a las barras móviles.");
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const controls = [
      ...(await page.getByRole("banner").getByRole("link").all()),
      ...(await page.getByRole("banner").getByRole("button").all()),
      ...(await page
        .getByRole("navigation", { name: "Navegación principal" })
        .getByRole("link")
        .all()),
    ];
    expect(controls.length).toBeGreaterThanOrEqual(8);
    for (const control of controls) {
      if (!(await control.isVisible())) continue;
      // Área táctil: la caja del control o la de su ::after (que la estira sin cambiar el diseño).
      const size = await control.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const after = getComputedStyle(element, "::after");
        const extra = (value: string) => (value.endsWith("px") ? -parseFloat(value) : 0);
        const grow =
          after.position === "absolute"
            ? Math.max(0, extra(after.top)) + Math.max(0, extra(after.bottom))
            : 0;
        return { width: box.width, height: box.height + grow };
      });
      const name = (await control.getAttribute("aria-label")) ?? (await control.textContent());
      expect(size.width, `ancho de «${name}»`).toBeGreaterThanOrEqual(44);
      expect(size.height, `alto de «${name}»`).toBeGreaterThanOrEqual(44);
    }
  });

  test("responde con las cabeceras de seguridad base", async ({ request }) => {
    const response = await request.get("/");
    const headers = response.headers();

    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-powered-by"]).toBeUndefined();
  });
});
