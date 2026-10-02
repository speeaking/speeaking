import { expect, test } from "@playwright/test";
import { completeOnboarding, register, uniqueUser } from "./helpers";

/** Enlaces que abren una publicación: /p/<id> o /p/<id>?foto=N, sin el panel de comentarios. */
const OPEN_POST = 'main article a[href^="/p/"]:not([href*="/comentarios"])';

test.describe("inicio: visitante", () => {
  test("sin banner rosa: el feed empieza arriba con su subtítulo", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1, name: "Para ti" })).toBeVisible();
    await expect(page.getByText("Lo más nuevo de las comunidades")).toBeVisible();
    await expect(
      page.getByText("Descubre contenido, productos y personas de tu comunidad."),
    ).toHaveCount(0);
  });

  test("el carrusel de productos va después de la 4.ª publicación con su razón escrita (ADR-051)", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/");
    // Dentro de <main>: la columna derecha también tiene un bloque «Patrocinado».
    const carousel = page.getByRole("main").getByRole("region", {
      name: /^(Lo más vendido|Populares|Nuevo en speeaking|De tus comunidades|Según tu búsqueda)$/,
    });
    await expect(carousel).toBeVisible();
    await expect(carousel.getByRole("link", { name: "Ver todo" })).toHaveAttribute(
      "href",
      "/comprar",
    );
    expect(await carousel.locator('a[href^="/producto/"]').count()).toBeGreaterThanOrEqual(3);
    // Antes del carrusel hay exactamente cuatro publicaciones.
    const handle = await carousel.elementHandle();
    const before = await page
      .locator("main article")
      .evaluateAll(
        (nodes, region) =>
          nodes.filter(
            (node) =>
              region && node.compareDocumentPosition(region) & Node.DOCUMENT_POSITION_FOLLOWING,
          ).length,
        handle,
      );
    expect(before).toBe(4);

    // Con mouse hay flechas (en táctil se desliza): la de «más» avanza la fila.
    if (!isMobile) {
      const list = carousel.getByRole("list");
      const next = carousel.getByRole("button", { name: "Ver más productos" });
      await expect(next).toBeVisible();
      await expect(
        carousel.getByRole("button", { name: "Ver productos anteriores" }),
      ).toBeDisabled();
      await next.click();
      await expect.poll(() => list.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
    }
  });

  test("una publicación se abre en capa sobre el feed y «atrás» la cierra (ADR-052)", async ({
    page,
  }) => {
    await page.goto("/");
    // El enlace que abre la publicación (no «Comentar», que abre el panel de comentarios, ADR-057).
    const open = page.locator(OPEN_POST).first();
    await expect(open).toBeVisible();
    await open.click();

    await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}/);
    const layer = page.getByRole("dialog", { name: "Publicación" });
    await expect(layer).toBeVisible();
    await expect(layer.getByRole("heading", { name: /^Comentarios/ })).toBeVisible();
    // El feed sigue detrás (la capa lo deja inerte para lectores: por eso se busca por CSS, no por rol).
    await expect(page.locator("main h1")).toHaveText("Para ti");

    await page.goBack();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("«Arma tu feed» aparece después de la 2.ª publicación solo sin columna derecha", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/");
    const card = page.getByRole("region", { name: "Arma tu feed" });

    if (!isMobile) {
      // En escritorio ancho la bienvenida vive en la columna derecha.
      await expect(card).toBeHidden();
      return;
    }
    await card.scrollIntoViewIfNeeded();
    await expect(card).toBeVisible();
    const articlesBefore = await card.evaluate((node) => {
      let count = 0;
      for (let el = node.previousElementSibling; el; el = el.previousElementSibling) {
        // Cada publicación va dentro del contenedor que mide si se vio (impresiones visibles).
        if (el.matches("article") || el.querySelector(":scope > article")) count += 1;
      }
      return count;
    });
    expect(articlesBefore).toBe(2);
    await expect(card.getByRole("link", { name: "Gaming: crear cuenta y unirme" })).toHaveAttribute(
      "href",
      "/registro?unirse=gaming",
    );
  });

  test("una publicación compartida invita a unirse a su comunidad", async ({ page }) => {
    await page.goto("/");
    await page.locator(OPEN_POST).first().click();
    await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}/);

    const prompt = page.getByRole("region", { name: /^Únete a .+ en speeaking$/ });
    await expect(prompt).toBeVisible();
    await expect(prompt.getByRole("link", { name: "Crear cuenta gratis" })).toHaveAttribute(
      "href",
      /^\/registro\?next=%2Fp%2F[0-9a-f-]{36}&unirse=[a-z0-9-]+$/,
    );
    await expect(page.getByRole("link", { name: "Crea tu cuenta gratis" })).toHaveAttribute(
      "href",
      /^\/registro\?next=%2Fp%2F/,
    );
  });
});

test.describe("inicio: con sesión", () => {
  test("/registro?unirse=gaming llega al onboarding con Gaming ya marcada", async ({ page }) => {
    const user = uniqueUser();
    await page.goto("/registro?unirse=gaming");
    await expect(page.getByText("Empezarás en")).toBeVisible();
    await page.getByLabel("Nombre", { exact: true }).fill(user.name);
    await page.getByLabel("Correo").fill(user.email);
    await page.getByLabel("Contraseña").fill(user.password);
    await page.getByLabel(/Acepto los/).check();
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    await expect(page).toHaveURL(/\/bienvenida\?unirse=gaming$/);
    await page.getByLabel("Nombre de usuario").fill(user.username);
    await page.getByRole("button", { name: "Siguiente" }).click();

    await expect(page.getByRole("checkbox", { name: /Gaming/ })).toBeChecked();
    await expect(page.getByText("Te faltan 2")).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /Comida/ })).not.toBeChecked();
  });

  test("si el servidor rechaza el usuario, el onboarding conserva lo elegido", async ({ page }) => {
    const user = uniqueUser();
    await page.goto("/registro?unirse=gaming");
    await page.getByLabel("Nombre", { exact: true }).fill(user.name);
    await page.getByLabel("Correo").fill(user.email);
    await page.getByLabel("Contraseña").fill(user.password);
    await page.getByLabel(/Acepto los/).check();
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page).toHaveURL(/\/bienvenida\?unirse=gaming$/);

    // Un usuario de la semilla: el servidor lo rechaza al final.
    await page.getByLabel("Nombre de usuario").fill("demo.electro");
    await page.getByText("Entretenerme").click();
    await page.getByRole("button", { name: "Siguiente" }).click();
    for (const community of ["Tecnología", "Comida"]) {
      await page.getByText(community, { exact: true }).click();
    }
    await page.getByRole("button", { name: "Siguiente" }).click();
    await page.getByRole("button", { name: "Empezar" }).click();

    // Regresa al paso 1 con el error junto a lo que escribió (React no vacía el formulario).
    await expect(page.getByText("Ese nombre de usuario ya está ocupado.")).toBeVisible();
    await expect(page.getByLabel("Nombre de usuario")).toHaveValue("demo.electro");
    await page.getByLabel("Nombre de usuario").fill(user.username);
    await page.getByRole("button", { name: "Siguiente" }).click();
    for (const community of [/^Gaming/, /^Tecnología/, /^Comida/]) {
      await expect(page.getByRole("checkbox", { name: community })).toBeChecked();
    }
    await page.getByRole("button", { name: "Siguiente" }).click();
    await page.getByRole("button", { name: "Empezar" }).click();
    await expect(page.getByRole("heading", { name: /^¡Listo, / })).toBeVisible();
  });

  test("después del onboarding aparece «¡Listo!» una sola vez y se puede cerrar", async ({
    page,
  }) => {
    const user = uniqueUser();
    await register(page, user);
    await completeOnboarding(page, user, { lookingFor: "audífonos para el metro" });

    const welcome = page.getByRole("region", { name: "¡Listo, Prueba!" });
    await expect(welcome).toBeVisible();
    await expect(welcome.getByRole("link", { name: "Gaming" })).toHaveAttribute(
      "href",
      "/c/gaming",
    );
    await expect(
      welcome.getByRole("link", { name: /^Buscando: audífonos para el metro/ }),
    ).toHaveAttribute("href", "/ajustes");
    // La URL queda limpia: recargar no la vuelve a mostrar.
    await expect(page).toHaveURL("/");

    await welcome.getByRole("button", { name: "Cerrar bienvenida" }).click();
    await expect(welcome).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Para ti" })).toBeVisible();
    await expect(page.getByRole("region", { name: "¡Listo, Prueba!" })).toHaveCount(0);
  });
});
