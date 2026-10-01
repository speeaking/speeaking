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
    const cover = page.locator('[data-slot="profile-cover"] img').first();
    await expect(cover).toHaveAttribute("src", /\/media\//);

    // La portada se sirve también a quien no tiene sesión (es pública mientras sea su portada).
    const visitor = await browser.newContext();
    const coverSrc = new URL((await cover.getAttribute("src"))!, page.url());
    const mediaPath = decodeURIComponent(coverSrc.searchParams.get("url") ?? coverSrc.pathname);
    const response = await visitor.request.get(new URL(mediaPath, page.url()).toString());
    expect(response.status()).toBe(200);
    await visitor.close();
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
