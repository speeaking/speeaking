import { type Browser, expect, test } from "@playwright/test";
import { registerAndOnboard } from "./helpers";

async function secondUser(browser: Browser, isMobile: boolean) {
  const context = await browser.newContext(
    isMobile ? { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true } : {},
  );
  const page = await context.newPage();
  const user = await registerAndOnboard(page);
  return { context, page, user };
}

// La campana (ADR-059): seguir, reaccionar y comentar avisan a quien publicó; abrirla los marca leídos.
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

  // La autora ve el número en la campana (se consulta hasta que llegan los tres avisos).
  await expect(async () => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Avisos (3 sin leer)" }).first()).toBeVisible({
      timeout: 2_000,
    });
  }).toPass({ timeout: 20_000 });
  await page.getByRole("link", { name: "Avisos (3 sin leer)" }).first().click();
  await expect(page).toHaveURL("/avisos");
  const fresh = page.getByRole("region", { name: "Nuevos" });
  await expect(fresh.getByText("empezó a seguirte")).toBeVisible();
  await expect(fresh.getByText("reaccionó a tu publicación")).toBeVisible();
  await expect(fresh.getByText("comentó tu publicación")).toBeVisible();
  await expect(fresh.getByText("«¡La de mi barrio, sin duda!»")).toBeVisible();

  // Abrirla los marca leídos: el globo se apaga.
  await expect(page.getByRole("link", { name: "Avisos", exact: true }).first()).toBeVisible();
  await fan.context.close();
});
