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

// ADR-068 y ADR-069: la bandeja y el hilo se abren en un recuadro sin salir de la página, y tocar a
// la persona abre sus opciones (bloquear sus mensajes).
test("desde el recuadro: leer, responder y bloquear sin salir del feed", async ({
  page,
  browser,
  isMobile,
}) => {
  test.setTimeout(180_000);
  const ana = await registerAndOnboard(page);
  const beto = await secondUser(browser, isMobile);

  await page.goto(`/u/${beto.user.username}`);
  await page.getByRole("link", { name: "Mensaje", exact: true }).click();
  await expect(page).toHaveURL(/\/mensajes\/[0-9a-f-]{36}/);
  await page.getByLabel("Escribe un mensaje").fill("¿Me apartas la chamarra?");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByRole("list", { name: "Mensajes" })).toContainText("chamarra");

  // Beto abre el recuadro: la bandeja y el hilo, sin salir del inicio.
  await beto.page.goto("/");
  const chat = beto.page.getByRole("button", { name: "Mensajes (1 sin leer)" }).first();
  await expect(chat).toHaveAttribute("aria-haspopup", "dialog");
  await chat.click();
  const panel = beto.page.getByRole("dialog", { name: "Mensajes" });
  const inbox = panel.getByRole("list", { name: "Conversaciones" });
  await inbox.getByRole("button", { name: new RegExp(ana.name) }).click();
  const thread = beto.page.getByRole("list", { name: "Mensajes" });
  await expect(thread).toContainText("¿Me apartas la chamarra?");
  await expect(beto.page).toHaveURL("/");
  // El hilo lleva el nombre de la persona y el globo bajó al abrirlo (en teléfono, el panel tapa la
  // barra: fuera del árbol accesible mientras está abierto).
  await expect(beto.page.getByRole("dialog", { name: ana.name })).toBeVisible();
  await expect(
    beto.page.getByRole("button", { name: "Mensajes", exact: true, includeHidden: true }).first(),
  ).toBeAttached();

  // Responde desde el recuadro.
  await beto.page.getByLabel("Escribe un mensaje").fill("Claro, te la guardo hasta el viernes");
  await beto.page.getByLabel("Escribe un mensaje").press("Enter");
  await expect(thread).toContainText("te la guardo hasta el viernes");

  // Tocar a la persona: sus opciones. Bloquea sus mensajes.
  await beto.page
    .getByRole("button", { name: `Opciones de la conversación con ${ana.name}` })
    .click();
  await beto.page.getByRole("menuitem", { name: "Bloquear mensajes" }).click();
  await expect(beto.page.getByText(`Bloqueaste los mensajes de ${ana.name}`).first()).toBeVisible();
  await expect(beto.page.getByLabel("Escribe un mensaje")).toHaveCount(0);

  // Ana ya no puede responder (sin decirle que la bloquearon).
  await page.reload();
  await expect(page.getByText("No puedes responder a esta conversación.")).toBeVisible();
  await expect(page.getByLabel("Escribe un mensaje")).toHaveCount(0);

  // Beto lo quita y Ana vuelve a poder escribir.
  await beto.page.getByRole("button", { name: "Desbloquear", exact: true }).click();
  await expect(beto.page.getByLabel("Escribe un mensaje")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Escribe un mensaje")).toBeVisible();
  await beto.context.close();
});

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
    beto.page.getByRole("button", { name: "Mensajes (1 sin leer)" }).first(),
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
  await expect(beto.page.getByRole("button", { name: "Mensajes (1 sin leer)" })).toHaveCount(0);

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
