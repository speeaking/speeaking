import { type Browser, expect, test } from "@playwright/test";
import { registerAndOnboard, TINY_PNG } from "./helpers";

async function secondUser(browser: Browser, isMobile: boolean) {
  const context = await browser.newContext(
    isMobile ? { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true } : {},
  );
  const page = await context.newPage();
  const user = await registerAndOnboard(page);
  return { context, page, user };
}

const png = (name: string) => ({ name, mimeType: "image/png", buffer: TINY_PNG });

test.describe("perfil (ADR-058)", () => {
  test("editar perfil: portada propia, foto, ciudad y presentación; la foto es pública", async ({
    page,
    browser,
  }) => {
    test.slow();
    const me = await registerAndOnboard(page);
    await page.goto("/perfil");
    await page.getByRole("link", { name: "Editar perfil" }).click();
    await expect(page).toHaveURL("/perfil/editar");

    await page.getByLabel("Portada: elegir imagen").setInputFiles(png("portada.png"));
    await page.getByLabel("Foto de perfil: elegir imagen").setInputFiles(png("foto.png"));
    // Cada imagen queda subida antes de guardar: el campo oculto ya trae su id.
    await expect(page.locator('input[name="cover"]')).toHaveValue(/^[0-9a-f-]{36}$/);
    await expect(page.locator('input[name="avatar"]')).toHaveValue(/^[0-9a-f-]{36}$/);
    await page.getByLabel("Ciudad").fill("Guadalajara");
    await page.getByLabel("Presentación").fill("Vendo plantas y macetas pintadas a mano");
    await page.getByRole("button", { name: "Guardar" }).click();

    await expect(page).toHaveURL(`/u/${me.username}`);
    await expect(page.getByText("Vendo plantas y macetas pintadas a mano")).toBeVisible();
    await expect(page.getByText("Guadalajara")).toBeVisible();
    // La portada va primero; el avatar, encima de ella (un <img> simple, sin variantes).
    const images = page.locator('[data-slot="profile-cover"] img');
    await expect(images).toHaveCount(2);
    const coverPath = new URL((await images.nth(0).getAttribute("src"))!, page.url()).pathname;
    const avatarPath = new URL((await images.nth(1).getAttribute("src"))!, page.url()).pathname;
    expect(coverPath).toMatch(/^\/media\//);
    expect(avatarPath).toMatch(/^\/media\//);
    expect(avatarPath).not.toBe(coverPath);

    // La foto de perfil identifica a la persona: se sirve también a quien no tiene sesión. La
    // portada es contenido personal (54f37e8, docs/friendships.md): solo su dueño y sus amigos.
    const visitor = await browser.newContext();
    try {
      const avatar = await visitor.request.get(new URL(avatarPath, page.url()).toString());
      expect(avatar.status()).toBe(200);
      expect(avatar.headers()["cache-control"]).toBe("public, max-age=300, must-revalidate");
      const coverForVisitor = await visitor.request.get(new URL(coverPath, page.url()).toString());
      expect(coverForVisitor.status()).toBe(404);
    } finally {
      await visitor.close();
    }
    const ownCover = await page.request.get(coverPath);
    expect(ownCover.status()).toBe(200);
    expect(ownCover.headers()["cache-control"]).toBe("private, no-store");
  });

  test("lo que escribe la persona se muestra como texto: un intento de XSS no corre", async ({
    page,
  }) => {
    await registerAndOnboard(page);
    const attack = '<img src=x onerror="window.__xss = true"><script>window.__xss = true</script>';
    await page.goto("/perfil/editar");
    await page.getByLabel("Presentación").fill(attack);
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page).toHaveURL(/\/u\/[a-z0-9._-]+$/);

    // Se ve tal cual, como texto, y no se ejecutó nada.
    await expect(page.getByText(attack)).toBeVisible();
    expect(
      await page.evaluate(() => (window as unknown as { __xss?: boolean }).__xss),
    ).toBeUndefined();
    await expect(page.locator("main img[src='x']")).toHaveCount(0);
  });

  test("seguidores: quien te sigue aparece en tu lista y puedes seguirle de vuelta", async ({
    page,
    browser,
    isMobile,
  }) => {
    test.slow();
    const me = await registerAndOnboard(page);
    const fan = await secondUser(browser, isMobile);

    await fan.page.goto(`/u/${me.username}`);
    await fan.page
      .getByRole("button", { name: /^Seguir a / })
      .first()
      .click();
    await expect(fan.page.getByRole("button", { name: /^Siguiendo/ }).first()).toBeVisible();

    // El contador abre la lista (se consulta hasta que el seguimiento se guardó).
    await expect(async () => {
      await page.goto(`/u/${me.username}`);
      await expect(page.getByRole("link", { name: "1 seguidor" })).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await page.getByRole("link", { name: "1 seguidor" }).click();
    await expect(page).toHaveURL(`/u/${me.username}/seguidores`);
    await expect(page.getByRole("heading", { level: 1, name: "Seguidores" })).toBeVisible();
    const row = page.getByRole("listitem").filter({ hasText: `@${fan.user.username}` });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: /^Seguir a / }).click();
    await expect(row.getByRole("button", { name: /^Siguiendo/ })).toBeVisible();

    // Y la otra pestaña: a quién sigo.
    await page
      .getByRole("link", { name: /^Siguiendo/ })
      .first()
      .click();
    await expect(page).toHaveURL(`/u/${me.username}/siguiendo`);
    await fan.context.close();
  });
});

// Perfil ancho (ADR-065): en escritorio el perfil ocupa el ancho de la página, sin las columnas
// laterales, y los botones del perfil propio llevan a vender y a comprar.
test("en escritorio el perfil se abre sin columnas laterales y con accesos a vender y comprar", async ({
  page,
  isMobile,
}) => {
  await registerAndOnboard(page);
  await page.goto("/perfil");
  await expect(page).toHaveURL(/\/u\//);
  await expect(page.getByRole("heading", { level: 1, name: "Prueba Automática" })).toBeVisible();
  const header = page.getByRole("main").locator("header").first();
  // Quien aún no tiene tienda ve la invitación a vender; sus compras y editar, siempre.
  await expect(header.getByRole("link", { name: "Vender" })).toHaveAttribute("href", "/studio");
  await expect(header.getByRole("link", { name: "Editar perfil" })).toBeVisible();

  const sideNav = page.getByRole("navigation", { name: "Navegación principal" });
  const rail = page.getByRole("complementary", { name: "Más para ti" });
  if (!isMobile) {
    await expect(sideNav).toBeHidden();
    await expect(rail).toBeHidden();
    const cover = (await page.locator('[data-slot="profile-cover"]').boundingBox())!;
    expect(cover.width).toBeGreaterThan(900);
  }

  // Al salir del perfil, la página vuelve a su forma de siempre.
  await header.getByRole("link", { name: "Mis compras" }).click();
  await expect(page).toHaveURL("/pedidos");
  if (!isMobile) {
    await expect(sideNav).toBeVisible();
  }
});
