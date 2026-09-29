import { type Browser, expect, test } from "@playwright/test";
import { registerAndOnboard } from "./helpers";

// Mensajes privados (ADR-047): desde el perfil, en un hilo, con no leídos en la barra superior.

async function secondUser(browser: Browser, isMobile: boolean) {
  const context = await browser.newContext(
    isMobile ? { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true } : {},
  );
  const page = await context.newPage();
  const user = await registerAndOnboard(page);
  return { context, page, user };
}

test("dos personas se escriben: el hilo, el globo de no leídos y la respuesta", async ({
  page,
  browser,
  isMobile,
}) => {
  test.setTimeout(180_000);
  const ana = await registerAndOnboard(page);
  const beto = await secondUser(browser, isMobile);

  // Ana abre el perfil de Beto y le escribe.
  await page.goto(`/u/${beto.user.username}`);
  // «Mensaje» exacto: la barra superior también tiene «Mensajes».
  await page.getByRole("link", { name: "Mensaje", exact: true }).click();
  await expect(page).toHaveURL(/\/mensajes\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { level: 1, name: beto.user.name })).toBeVisible();
  await page.getByLabel("Escribe un mensaje").fill("¡Hola Beto! ¿Sigue disponible la lámpara?");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByRole("list", { name: "Mensajes" })).toContainText("¿Sigue disponible");
  await expect(page.getByLabel("Escribe un mensaje")).toHaveValue("");

  // Beto ve el globo y el mensaje; su bandeja lo marca sin leer hasta que lo abre.
  await beto.page.goto("/");
  await expect(
    beto.page.getByRole("link", { name: "Mensajes (1 sin leer)" }).first(),
  ).toBeVisible();
  await beto.page.goto("/mensajes");
  const inbox = beto.page.getByRole("list", { name: "Conversaciones" });
  await expect(inbox).toContainText(ana.name);
  await expect(inbox.getByLabel("Sin leer")).toHaveCount(1);
  await inbox.getByRole("link", { name: new RegExp(ana.name) }).click();
  await expect(beto.page.getByRole("list", { name: "Mensajes" })).toContainText(
    "¿Sigue disponible la lámpara?",
  );
  await beto.page
    .getByLabel("Escribe un mensaje")
    .fill("Sí, todavía la tengo. Deposita a la CLABE 012345678901234567");
  await beto.page.getByRole("button", { name: "Enviar" }).click();
  await expect(beto.page.getByRole("status")).toContainText("los pagos van dentro del pedido");
  await beto.page.goto("/");
  await expect(beto.page.getByRole("link", { name: "Mensajes (1 sin leer)" })).toHaveCount(0);

  // Ana recibe la respuesta sin recargar a mano (el hilo se refresca solo).
  await expect(page.getByRole("list", { name: "Mensajes" })).toContainText("todavía la tengo", {
    timeout: 30_000,
  });
  await beto.context.close();
});

test("no se puede escribir a una cuenta editorial ni a uno mismo; sin sesión, pide cuenta", async ({
  page,
}) => {
  await page.goto("/mensajes/nuevo?para=equipo.humor");
  await expect(page).toHaveURL(/\/entrar\?next=/);

  const me = await registerAndOnboard(page);
  await page.goto("/mensajes/nuevo?para=equipo.humor");
  await expect(page).toHaveURL(/\/mensajes\?error=/);
  const alert = page.getByRole("main").getByRole("alert");
  await expect(alert).toContainText("cuentas editoriales");
  await page.goto(`/mensajes/nuevo?para=${me.username}`);
  await expect(alert).toContainText("a ti");
  await page.goto(`/u/${me.username}`);
  await expect(page.getByRole("link", { name: "Mensaje", exact: true })).toHaveCount(0);
});
