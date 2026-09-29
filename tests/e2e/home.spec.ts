import { expect, type Page, test } from "@playwright/test";
import { completeOnboarding, register, registerAndOnboard, uniqueUser } from "./helpers";

/** Filtro de burbujas: botón con aria-pressed dentro del grupo «Filtra tu feed». */
/** Burbuja de filtro por nombre; tolera «, 1 publicación nueva» si otra prueba publicó ahí. */
function bubble(page: Page, name: string) {
  return page
    .getByRole("group", { name: "Filtra tu feed" })
    .getByRole("button", { name: new RegExp(`^${name}(,|$)`) });
}

test.describe("inicio: visitante", () => {
  test("sin banner rosa: el feed empieza arriba con su subtítulo y burbujas", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1, name: "Para ti" })).toBeVisible();
    await expect(page.getByText("Lo más nuevo de las comunidades")).toBeVisible();
    await expect(
      page.getByText("Descubre contenido, productos y personas de tu comunidad."),
    ).toHaveCount(0);
    await expect(bubble(page, "Para ti")).toHaveAttribute("aria-pressed", "true");
    // El visitante no sigue a nadie: no hay «Siguiendo».
    await expect(bubble(page, "Siguiendo")).toHaveCount(0);
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

  test("con mouse, la flecha de las burbujas llega a las que no caben", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "En táctil la fila se desliza con el dedo: no hay flechas.");
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const group = page.getByRole("group", { name: "Filtra tu feed" });
    const row = group.locator("ul");
    // Las 12 comunidades del visitante no caben en la columna de 680 px.
    const arrow = group.locator("button[aria-hidden='true']");
    await expect(arrow).toHaveCount(1);
    await arrow.click();
    await expect.poll(() => row.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
    // Ya hay algo a la izquierda: aparece la flecha de regreso.
    await expect(group.locator("button[data-side='before']")).toBeVisible();
  });

  test("una publicación compartida invita a unirse a su comunidad", async ({ page }) => {
    await page.goto("/");
    await page.locator('main article a[href^="/p/"]').first().click();
    await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}/);

    const prompt = page.getByRole("region", { name: /^Únete a .+ en Estreno$/ });
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
  test("las burbujas filtran el feed por comunidad y regresan a «Para ti»", async ({ page }) => {
    // El onboarding del helper elige Gaming, Tecnología y Comida.
    await registerAndOnboard(page);
    await page.waitForLoadState("networkidle");

    await expect(bubble(page, "Para ti")).toHaveAttribute("aria-pressed", "true");
    await expect(bubble(page, "Siguiendo")).toBeVisible();
    await expect(page.getByRole("region", { name: "Crear publicación" })).toBeVisible();

    await bubble(page, "Comida").click();
    await expect(bubble(page, "Comida")).toHaveAttribute("aria-pressed", "true");
    await expect(bubble(page, "Para ti")).toHaveAttribute("aria-pressed", "false");

    // Todas las piezas son de Comida (su chip o su cabecera enlazan a la comunidad).
    const articles = page.locator("main article");
    await expect(articles.first()).toBeVisible();
    const fromComida = await articles.evaluateAll((nodes) =>
      nodes.slice(0, 5).map((node) => node.querySelector('a[href="/c/comida"]') !== null),
    );
    expect(fromComida.length).toBeGreaterThan(0);
    expect(fromComida.every(Boolean)).toBe(true);

    await bubble(page, "Para ti").click();
    await expect(bubble(page, "Para ti")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("region", { name: "Crear publicación" })).toBeVisible();
  });

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
