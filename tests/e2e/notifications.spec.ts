import { type Browser, expect, type Locator, test } from "@playwright/test";
import { registerAndOnboard, waitForHydration } from "./helpers";

async function secondUser(browser: Browser, isMobile: boolean) {
  const context = await browser.newContext(
    isMobile ? { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true } : {},
  );
  const page = await context.newPage();
  const user = await registerAndOnboard(page);
  return { context, page, user };
}

// La campana (ADR-059): seguir, reaccionar y comentar avisan a quien publicó. En escritorio se abre
// ahí mismo, en un recuadro (ADR-068), y abrirla los marca leídos. En teléfono, Notificaciones es una
// pestaña bajo el logo que lleva a /avisos (c52810a), donde las nuevas se conservan hasta abrirlas o
// marcarlas leídas (docs/social-activity.md).
test("la campana avisa quién te sigue, reacciona y comenta, y se apaga al abrirla", async ({
  page,
  browser,
  isMobile,
}) => {
  test.slow();
  const author = await registerAndOnboard(page);
  await page.goto("/crear/publicacion");
  await page.getByLabel("¿Qué quieres compartir?").fill("¿Cuál es su taquería favorita?");
  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}$/);
  const postPath = new URL(page.url()).pathname;

  const fan = await secondUser(browser, isMobile);
  await fan.page.goto(`/u/${author.username}`);
  await fan.page
    .getByRole("button", { name: /^Seguir a / })
    .first()
    .click();
  await expect(fan.page.getByRole("button", { name: /^Siguiendo/ }).first()).toBeVisible();
  await fan.page.goto(postPath);
  const like = fan.page
    .getByRole("article")
    .first()
    .getByRole("button", { name: /^Me gusta/ });
  await like.click();
  await expect(like).toHaveAttribute("aria-pressed", "true");
  await fan.page.getByLabel("Escribe un comentario").fill("¡La de mi barrio, sin duda!");
  await fan.page.getByRole("button", { name: "Comentar" }).click();
  await expect(fan.page.getByText("¡La de mi barrio, sin duda!")).toBeVisible();

  // La autora ve el número (se consulta hasta que llegan los tres avisos): en escritorio, en la
  // campana de la barra, que ya cargada abre su recuadro (antes es solo el enlace a /avisos); en
  // teléfono, en la pestaña Notificaciones.
  const nav = page.getByRole("navigation", { name: "Navegación principal" }).first();
  const unread = isMobile
    ? nav.getByRole("link", { name: "Notificaciones (3 sin leer)" })
    : page.getByRole("banner").getByRole("button", { name: "Notificaciones (3 sin leer)" });
  await expect(async () => {
    await page.goto("/");
    await expect(unread).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });

  const expectTheThree = async (fresh: Locator) => {
    await expect(fresh.getByText("empezó a seguirte")).toBeVisible();
    await expect(fresh.getByText("reaccionó a tu publicación")).toBeVisible();
    await expect(fresh.getByText("comentó tu publicación")).toBeVisible();
    await expect(fresh.getByText("«¡La de mi barrio, sin duda!»")).toBeVisible();
  };

  if (isMobile) {
    await unread.click();
    await expect(page).toHaveURL("/avisos");
    await expectTheThree(page.getByRole("region", { name: "Nuevos" }));
    // Verlas en la página no las da por leídas; «Marcar leídas» apaga el número sin recargar.
    await expect(unread).toBeVisible();
    const markRead = page.getByRole("button", { name: "Marcar leídas" });
    await waitForHydration(markRead);
    await markRead.click();
    await expect(nav.getByRole("link", { name: "Notificaciones", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Nuevos" })).toHaveCount(0);
  } else {
    await expect(unread).toHaveAttribute("aria-haspopup", "dialog");
    await unread.click();
    const panel = page.getByRole("dialog", { name: "Notificaciones" });
    await expectTheThree(panel.getByRole("region", { name: "Nuevos" }));
    await expect(page).toHaveURL("/");
    await expect(panel.getByRole("link", { name: "Ver todos" })).toHaveAttribute("href", "/avisos");

    // Abrirla los marca leídos: el globo se apaga sin recargar la página.
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("banner").getByRole("button", { name: "Notificaciones", exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL("/");
    await page.goto("/avisos");
  }
  await expect(page.getByRole("region", { name: "Anteriores" })).toContainText(
    "comentó tu publicación",
  );
  await fan.context.close();
});
