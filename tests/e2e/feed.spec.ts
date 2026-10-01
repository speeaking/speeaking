import { expect, test } from "@playwright/test";
import { registerAndOnboard, TINY_PNG } from "./helpers";

test.describe("feed", () => {
  test("sin sesión se ve contenido y el comercio aparece integrado, no como catálogo", async ({
    page,
  }) => {
    await page.goto("/");
    const articles = page.locator("article");
    await expect(articles.nth(5)).toBeVisible();

    // La primera pieza comercial llega después de varias piezas de contenido (tope ~1 de cada 4).
    const firstProductIndex = await articles.evaluateAll((nodes) =>
      nodes.findIndex((node) => node.querySelector('a[href^="/producto/"]')),
    );
    expect(firstProductIndex).toBeGreaterThanOrEqual(3);
  });

  test("dar like sin sesión lleva directo a crear cuenta", async ({ page }) => {
    await page.goto("/");
    // Sin sesión «Me gusta» es un enlace (no un toggle): funciona incluso antes de hidratar.
    await page.getByRole("link", { name: "Me gusta" }).first().click();

    await expect(page).toHaveURL(/\/registro\?next=%2F$/);
  });

  test("con sesión: like, comentar y crear una publicación con imagen", async ({ page }) => {
    await registerAndOnboard(page);

    // El nombre no cambia al presionar («Me gusta» o «Me gusta, 3»): el estado va en aria-pressed.
    const like = page.getByRole("button", { name: "Me gusta" }).first();
    await expect(like).toHaveAttribute("aria-pressed", "false");
    await like.click();
    await expect(like).toHaveAttribute("aria-pressed", "true");

    // Reacciones (ADR-054): la tira también se abre desde el teclado con «Elegir reacción»; la
    // elegida se queda en el botón y sobrevive a la recarga.
    await page.getByRole("button", { name: "Elegir reacción" }).first().focus();
    await page.keyboard.press("Enter");
    await page
      .getByRole("group", { name: "Reacciones" })
      .getByRole("button", { name: "Me divierte" })
      .click();
    await expect(page.getByRole("button", { name: /^Me divierte/ }).first()).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.reload();
    await expect(page.getByRole("button", { name: /^Me divierte/ }).first()).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Red social primero: en Crear, compartir va antes que vender.
    await page.goto("/crear");
    const createOptions = page
      .getByRole("main")
      .getByRole("link", { name: /^(Publicación|Sube y vende|Producto a mano)/ });
    await expect(createOptions.first()).toContainText("Publicación");
    await page.goto("/crear/publicacion");
    await page.getByLabel("¿Qué quieres compartir?").fill("Mi primera publicación de prueba 🎉");
    await page.getByLabel("Elegir imágenes").setInputFiles({
      name: "foto.png",
      mimeType: "image/png",
      buffer: TINY_PNG,
    });
    await expect(page.locator('input[name="mediaIds"]')).toHaveCount(1);
    await page.getByRole("button", { name: "Publicar" }).click();

    await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}$/);
    // La primera tarjeta es la publicación; abajo, «Más de…» puede traer otras de la comunidad.
    await expect(
      page.getByRole("article").first().getByText("Mi primera publicación de prueba"),
    ).toBeVisible();

    await page.getByLabel("Escribe un comentario").fill("¡Qué buena!");
    await page.getByRole("button", { name: "Comentar" }).click();
    await expect(page.getByText("¡Qué buena!")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Comentarios (1)" })).toBeVisible();
  });

  test("las comunidades se pueden explorar y unirse pide sesión", async ({ page }) => {
    await page.goto("/descubrir");
    // En escritorio Gaming también aparece en las columnas laterales: se elige la del contenido.
    await page
      .getByRole("main")
      .getByRole("link", { name: /^Gaming/ })
      .first()
      .click();

    await expect(page).toHaveURL("/c/gaming");
    await expect(page.getByRole("heading", { level: 1, name: "Gaming" })).toBeVisible();
    // Sin sesión, unirse lleva a crear cuenta y regresa a la comunidad. Es un botón o, si la página
    // ya sabe que no hay sesión, un enlace directo.
    const main = page.getByRole("main");
    const join = main.getByRole("button", { name: "Unirme" });
    await join
      .or(main.getByRole("link", { name: "Unirme" }))
      .first()
      .click();
    await expect(page).toHaveURL(/\/registro\?next=%2Fc%2Fgaming/);
  });
});
