import { expect, type Page, test } from "@playwright/test";
import { registerAndOnboard } from "./helpers";

/** Navegación principal visible: columna izquierda en escritorio, barra inferior en móvil. */
const mainNav = (page: Page) =>
  page.getByRole("navigation", { name: "Navegación principal" }).first();

test.describe("navegación", () => {
  test("las secciones principales responden y marcan la activa", async ({ page, isMobile }) => {
    const sections = [
      { name: "Descubrir", url: "/descubrir", heading: "Descubrir" },
      { name: "Comprar", url: "/comprar", heading: "Comprar" },
      { name: "Inicio", url: "/", heading: "Para ti" },
    ];

    await page.goto("/");
    const nav = mainNav(page);

    for (const section of sections) {
      await nav.getByRole("link", { name: section.name, exact: true }).click();
      await expect(page).toHaveURL(section.url);
      await expect(page.getByRole("heading", { level: 1, name: section.heading })).toBeVisible();
      await expect(nav.getByRole("link", { name: section.name, exact: true })).toHaveAttribute(
        "aria-current",
        "page",
      );
    }

    // Una comunidad pertenece a Descubrir: la pestaña sigue marcada.
    await page.goto("/c/gaming");
    await expect(nav.getByRole("link", { name: "Descubrir", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );

    const banner = page.getByRole("banner");
    if (isMobile) {
      // Perfil y Crear requieren sesión: llevan a "Entrar" y recuerdan a dónde volver.
      await nav.getByRole("link", { name: "Perfil", exact: true }).click();
      await expect(page).toHaveURL(/\/entrar\?next=%2Fperfil/);
      await page.goto("/");
      await nav.getByRole("link", { name: "Crear" }).click();
      await expect(page).toHaveURL(/\/entrar\?next=%2Fcrear/);
      // El visitante ve «Únete» en la barra superior.
      await page.goto("/");
      await expect(banner.getByRole("link", { name: "Únete" })).toHaveAttribute(
        "href",
        "/registro",
      );
    } else {
      // Sin sesión: ni Guardados ni Mis pedidos; la barra ofrece Entrar y Crear cuenta.
      await expect(nav.getByRole("link", { name: "Guardados" })).toHaveCount(0);
      await expect(nav.getByRole("link", { name: "Mis pedidos" })).toHaveCount(0);
      await expect(banner.getByRole("link", { name: "Entrar", exact: true })).toHaveAttribute(
        "href",
        "/entrar",
      );
      await expect(banner.getByRole("link", { name: "Crear cuenta" })).toHaveAttribute(
        "href",
        "/registro",
      );
      // Y la columna muestra todas las comunidades y la entrada a Sube y vende (sin Studio).
      await expect(
        page
          .getByRole("region", { name: "Comunidades", exact: true })
          .getByRole("link", { name: "Gaming", exact: true }),
      ).toBeVisible();
      const sell = page.getByRole("region", { name: "Para vender", exact: true });
      await expect(sell.getByRole("link", { name: "Sube y vende" })).toHaveAttribute(
        "href",
        "/studio/sube-y-vende",
      );
      await expect(sell.getByRole("link", { name: "Ir a Studio" })).toHaveCount(0);
    }
  });

  test("con sesión: tus comunidades, menú del avatar y pestañas en pantallas anidadas", async ({
    page,
    isMobile,
  }) => {
    const user = await registerAndOnboard(page);
    const nav = mainNav(page);

    if (isMobile) {
      // Perfil se marca en el perfil propio, en Ajustes y en Guardados; Comprar en los pedidos.
      for (const url of [`/u/${user.username}`, "/ajustes", "/guardados"]) {
        await page.goto(url);
        await expect(nav.getByRole("link", { name: "Perfil", exact: true })).toHaveAttribute(
          "aria-current",
          "page",
        );
      }
      await page.goto("/pedidos");
      await expect(nav.getByRole("link", { name: "Comprar", exact: true })).toHaveAttribute(
        "aria-current",
        "page",
      );
      return;
    }

    // Tus comunidades: las del onboarding. Para descubrir: solo las que faltan, con «Unirme».
    const yours = page.getByRole("region", { name: "Tus comunidades", exact: true });
    for (const community of ["Gaming", "Tecnología", "Comida"]) {
      // «Gaming, 1 publicación nueva» si alguien publicó justo después del onboarding (otra prueba).
      await expect(
        yours.getByRole("link", { name: new RegExp(`^${community}(,|$)`) }),
      ).toBeVisible();
    }
    const toDiscover = page.getByRole("region", { name: "Para descubrir", exact: true });
    await expect(toDiscover.getByRole("button", { name: "Unirme" })).toHaveCount(3);
    await expect(toDiscover.getByRole("link", { name: "Gaming", exact: true })).toHaveCount(0);
    await expect(toDiscover.getByRole("link", { name: /^Ver las \d+$/ })).toHaveAttribute(
      "href",
      "/descubrir",
    );

    // Menú del avatar → Mis pedidos, que queda marcado en la columna.
    await page.getByRole("button", { name: /^Tu cuenta/ }).click();
    await page.getByRole("menuitem", { name: "Mis pedidos" }).click();
    await expect(page).toHaveURL("/pedidos");
    await expect(nav.getByRole("link", { name: "Mis pedidos" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    // Guardados empieza vacío y lo dice.
    await nav.getByRole("link", { name: "Guardados" }).click();
    await expect(page).toHaveURL("/guardados");
    await expect(
      page.getByRole("heading", { level: 2, name: "Aún no guardas nada" }),
    ).toBeVisible();

    // En una ventana baja la columna tiene scroll propio: Sube y vende siempre se alcanza.
    await page.setViewportSize({ width: 1352, height: 643 });
    const rail = nav.locator("..");
    const box = await rail.evaluate((element) => ({
      overflowY: getComputedStyle(element).overflowY,
      bottom: element.getBoundingClientRect().bottom,
      viewport: window.innerHeight,
    }));
    expect(box.overflowY).toBe("auto");
    expect(box.bottom).toBeLessThanOrEqual(box.viewport);
    const sell = rail.getByRole("link", { name: "Sube y vende" });
    await sell.scrollIntoViewIfNeeded();
    await expect(sell).toBeInViewport({ ratio: 1 });
    await sell.click();
    await expect(page).toHaveURL("/studio/sube-y-vende");
  });

  test("la búsqueda global no distingue acentos y dice cuando no hay resultados", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/");
    const input = page.getByRole("searchbox", { name: "Buscar comunidades, temas o productos" });

    if (isMobile) {
      await page.getByRole("banner").getByRole("link", { name: "Buscar" }).click();
      await expect(page).toHaveURL("/buscar");
      await expect(input).toBeFocused();
    } else {
      // «/» enfoca la búsqueda desde cualquier parte (en cuanto la página está lista).
      await expect(async () => {
        await page.keyboard.press("/");
        await expect(input).toBeFocused({ timeout: 1_000 });
      }).toPass();
      await expect(input).toHaveValue("");
    }
    await input.fill("tecnologia");
    await input.press("Enter");

    await expect(page).toHaveURL("/buscar?q=tecnologia");
    await expect(input).toHaveValue("tecnologia");
    const found = page.getByRole("main").getByRole("region", { name: "Comunidades", exact: true });
    await expect(found.getByRole("link", { name: /^Tecnología/ })).toBeVisible();

    await page.goto("/buscar?q=zzqxjw");
    await expect(
      page.getByRole("heading", { level: 2, name: "Sin resultados para “zzqxjw”" }),
    ).toBeVisible();
  });

  test("abrir un perfil desde el feed «pasa la página» (ADR-055)", async ({ page }) => {
    // Se anota cada transición de vista que inicia la página, con sus tipos.
    await page.addInitScript(() => {
      const recorded: string[][] = [];
      (window as unknown as { __viewTransitions: string[][] }).__viewTransitions = recorded;
      const original = Document.prototype.startViewTransition;
      if (typeof original !== "function") return;
      Document.prototype.startViewTransition = function (this: Document, options?: unknown) {
        const types =
          options && typeof options === "object" && "types" in options
            ? [...((options as { types?: Iterable<string> }).types ?? [])]
            : [];
        recorded.push(types);
        return original.call(this, options as never);
      };
    });
    await page.goto("/");
    const author = page.locator("article").first().locator('a[href^="/u/"]').first();
    const href = await author.getAttribute("href");
    expect(href).toMatch(/^\/u\/[a-z0-9._-]+$/);
    // La animación es una mejora: un toque en el primer segundo, mientras React todavía termina de
    // tomar la página, abre el perfil igual pero sin el tipo de transición (otro trabajo de React se
    // lleva los tipos pendientes). Aquí se prueba la animación, así que se espera a que la página
    // esté quieta: el enlace ya hidratado y la red en calma.
    await author.evaluate(
      (element) =>
        new Promise<void>((resolve) => {
          const check = () =>
            Object.keys(element).some((key) => key.startsWith("__reactProps"))
              ? resolve()
              : requestAnimationFrame(check);
          check();
        }),
    );
    await page.waitForLoadState("networkidle");
    await author.click();

    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.locator("main h1")).toBeVisible();
    const recorded = await page.evaluate(
      () => (window as unknown as { __viewTransitions: string[][] }).__viewTransitions,
    );
    expect(recorded.some((types) => types.includes("perfil"))).toBe(true);
  });

  test("una ruta inexistente muestra la página 404 en español", async ({ page }) => {
    const response = await page.goto("/esta-ruta-no-existe");

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
  });

  test("expone el manifiesto de la app instalable", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    const manifest = (await response.json()) as { display: string; icons: unknown[] };

    expect(manifest.display).toBe("standalone");
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
  });

  test("los documentos legales son públicos", async ({ page }) => {
    await page.goto("/privacidad");
    await expect(
      page.getByRole("heading", { level: 1, name: "Aviso de privacidad" }),
    ).toBeVisible();
    await page.goto("/terminos");
    await expect(
      page.getByRole("heading", { level: 1, name: "Términos y condiciones" }),
    ).toBeVisible();
  });
  test("en escritorio, la columna izquierda se pliega a íconos y lo recuerda al recargar", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "La columna izquierda no existe en móvil.");
    await page.goto("/");
    const frame = page.locator("[data-nav]");
    await expect(frame).toHaveAttribute("data-nav", "open");
    // El botón solo responde cuando React ya tomó la página (`data-ready`).
    await expect(frame).toHaveAttribute("data-ready", "true");
    const nav = mainNav(page);
    const label = nav.getByText("Descubrir");
    // Un texto solo para lectores de pantalla (sr-only) mide 1 px: así se distingue de uno visible.
    const labelWidth = () => label.evaluate((element) => getComputedStyle(element).width);
    await expect.poll(labelWidth).not.toBe("1px");

    await page.getByRole("button", { name: "Contraer el menú" }).click();
    await expect(frame).toHaveAttribute("data-nav", "closed");
    // Plegada: los íconos siguen y el nombre queda solo para lectores de pantalla.
    await expect(nav.getByRole("link", { name: "Descubrir", exact: true })).toBeVisible();
    await expect.poll(labelWidth).toBe("1px");

    await page.reload();
    await expect(page.locator("[data-nav]")).toHaveAttribute("data-nav", "closed");
    await expect(page.locator("[data-nav]")).toHaveAttribute("data-ready", "true");
    await expect.poll(labelWidth).toBe("1px");
    await page.getByRole("button", { name: "Expandir el menú" }).click();
    await expect(page.locator("[data-nav]")).toHaveAttribute("data-nav", "open");
    await expect.poll(labelWidth).not.toBe("1px");
  });
});
