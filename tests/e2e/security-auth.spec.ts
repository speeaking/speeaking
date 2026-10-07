import { type APIResponse, expect, type Page, test } from "@playwright/test";
import { completeOnboarding, register, type TestUser } from "./helpers";

/**
 * Regresiones de la auditoría 2026-09-26 sobre registro e inicio de sesión (SEC-02, SEC-04, SEC-09,
 * SEC-11, SEC-18, SEC-30), por HTTP y por la interfaz, como se reprodujeron.
 */

function fixUser(): TestUser {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return {
    name: "Prueba Seguridad",
    email: `e2e.fix.${id}@example.com`,
    password: "clave-de-prueba-segura",
    username: `e2e.fix.${id}`,
  };
}

/** Envía el formulario de /entrar y espera la respuesta de la Server Action. */
async function submitSignIn(page: Page, email: string, password: string) {
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" && new URL(response.url()).pathname === "/entrar",
    ),
    page.getByRole("button", { name: "Entrar" }).click(),
  ]);
}

/**
 * Un intento que se queda en /entrar. Espera a que React reinicie el formulario tras la acción (la
 * contraseña queda vacía): si se escribe antes, el reinicio borra lo escrito.
 */
async function attemptSignIn(page: Page, email: string, password: string) {
  await submitSignIn(page, email, password);
  await expect(page.getByLabel("Contraseña")).toHaveValue("");
  return page.locator("form").getByRole("alert");
}

/**
 * Adónde manda una respuesta: la cabecera `Location` de un 3xx o, si la página ya transmitía (el
 * `loading.tsx` raíz cubre /entrar y /bienvenida), la `<meta id="__next-page-redirect"
 * http-equiv="refresh" content="…;url=…">` que Next inserta en un 200 y que el navegador sigue
 * (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md`). `null` si no
 * redirige.
 */
async function redirectTarget(response: APIResponse) {
  if (response.status() >= 300 && response.status() < 400) {
    return response.headers().location ?? null;
  }
  const html = await response.text();
  const tag = html.match(/<meta[^>]*id="__next-page-redirect"[^>]*>/)?.[0];
  const url = tag?.match(/content="\d+;url=([^"]*)"/)?.[1];
  return url === undefined ? null : url.replaceAll("&amp;", "&");
}

async function fillSignUp(page: Page, user: Pick<TestUser, "name" | "email" | "password">) {
  await page.goto("/registro");
  await page.getByLabel("Nombre", { exact: true }).fill(user.name);
  await page.getByLabel("Correo").fill(user.email);
  await page.getByLabel("Contraseña").fill(user.password);
  await page.getByLabel(/Acepto los/).check();
  await page.getByLabel("Tengo 18 años o más").check();
  await page.getByRole("button", { name: "Crear cuenta" }).click();
}

test.describe("límite de intentos (SEC-02)", () => {
  test("el sexto intento de inicio de sesión se bloquea, aun con la contraseña correcta", async ({
    page,
  }) => {
    const user = fixUser();
    await register(page, user);
    await page.context().clearCookies();

    await page.goto("/entrar");
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const alert = await attemptSignIn(page, user.email, `incorrecta-${attempt}-xyz`);
      await expect(alert).toHaveText("Correo o contraseña incorrectos.");
    }

    const alert = await attemptSignIn(page, user.email, user.password);

    await expect(alert).toHaveText(/^Demasiados intentos\. Intenta de nuevo en \d+ minutos?\.$/);
    await expect(page).toHaveURL(/\/entrar$/);
  });

  test("el mismo límite aplica a un correo sin cuenta: no revela si existe", async ({ page }) => {
    const { email } = fixUser();

    await page.goto("/entrar");
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const alert = await attemptSignIn(page, email, `incorrecta-${attempt}-xyz`);
      await expect(alert).toHaveText("Correo o contraseña incorrectos.");
    }
    const alert = await attemptSignIn(page, email, "incorrecta-6-xyz");

    await expect(alert).toHaveText(/^Demasiados intentos\./);
  });
});

test.describe("redirección después de entrar (SEC-04)", () => {
  test("con sesión, un `next` que se normaliza a otro dominio vuelve al inicio", async ({
    page,
    baseURL,
  }) => {
    await register(page, fixUser());

    for (const next of [
      "/.//evil.example/phish",
      "/%2e//evil.example",
      "/%2E%2E//evil.example",
      "/..//evil.example",
      "/a/..//evil.example",
      "/./\\evil.example",
    ]) {
      // `page.request` comparte las cookies de la página: responde como a quien ya tiene sesión.
      // La página transmite (200 con la redirección en el HTML) o responde 307; en los dos casos el
      // destino es el inicio, nunca el `next` normalizado.
      const response = await page.request.get(`/entrar?next=${encodeURIComponent(next)}`, {
        maxRedirects: 0,
      });
      expect([200, 307], next).toContain(response.status());
      expect(await redirectTarget(response), next).toBe("/");
    }

    // Y el navegador, que sigue esa redirección, se queda en el sitio.
    await page.goto(`/entrar?next=${encodeURIComponent("/.//evil.example/phish")}`);
    await expect(page).toHaveURL("/");
    expect(new URL(page.url()).host).toBe(new URL(baseURL!).host);
  });

  test("la cadena /bienvenida → /entrar termina dentro del sitio", async ({ page, baseURL }) => {
    const user = fixUser();
    await register(page, user);
    await completeOnboarding(page, user);
    await expect(page).toHaveURL("/");

    // Ya incorporado: /bienvenida manda a `next` sin mostrar el onboarding; este se normaliza a otro
    // dominio, así que manda al inicio (por 307 o por la redirección en el HTML de un 200).
    const direct = await page.request.get("/bienvenida?next=%2F.%2F%2Fevil.example%2Fentrar", {
      maxRedirects: 0,
    });
    expect([200, 307]).toContain(direct.status());
    expect(await redirectTarget(direct)).toBe("/");
    expect(await direct.text()).not.toContain("Cuéntanos de ti");

    // Sin sesión: el proxy manda a /entrar con la cadena anidada y, al entrar, se queda en el sitio.
    await page.context().clearCookies();
    await page.goto("/bienvenida?next=%2F.%2F%2Fevil.example%2Fentrar");
    await expect(page).toHaveURL(/\/entrar\?next=/);
    await submitSignIn(page, user.email, user.password);

    await expect(page).toHaveURL("/");
    expect(new URL(page.url()).host).toBe(new URL(baseURL!).host);
  });
});

test.describe("guardia de Studio en el servidor", () => {
  test("una cookie de sesión inventada pasa el proxy pero la página manda a entrar", async ({
    page,
    context,
  }) => {
    // El proxy solo revisa que exista la cookie (optimista); la barrera real es la página.
    await context.addCookies([
      { name: "speeaking.session_token", value: "inventada", domain: "localhost", path: "/" },
    ]);
    await page.goto("/studio/analitica");
    await expect(page).toHaveURL(/\/entrar\?next=%2Fstudio%2Fanalitica/);
  });
});

test.describe("API HTTP de Better Auth cerrada (SEC-09)", () => {
  test("no se puede crear una cuenta sin aceptar términos ni escribir el perfil por la API", async ({
    page,
    request,
    baseURL,
  }) => {
    const user = fixUser();
    const origin = new URL(baseURL!).origin;
    const signUp = await request.post("/api/auth/sign-up/email", {
      data: { name: "a".repeat(5000), email: user.email, password: user.password },
      headers: { origin },
    });
    expect(signUp.status()).toBe(404);

    for (const [path, data] of [
      ["/api/auth/sign-in/email", { email: user.email, password: user.password }],
      ["/api/auth/update-user", { name: "a".repeat(5000), image: "javascript:alert(1)" }],
    ] as const) {
      const response = await request.post(path, { data, headers: { origin } });
      expect(response.status(), path).toBe(404);
    }
    expect((await request.get("/api/auth/get-session")).status()).toBe(404);

    // La cuenta nunca se creó: el correo sigue sin cuenta.
    await page.goto("/entrar");
    const alert = await attemptSignIn(page, user.email, user.password);
    await expect(alert).toHaveText("Correo o contraseña incorrectos.");
  });
});

test.describe("registro", () => {
  test("un correo ya registrado recibe el mensaje genérico (SEC-11)", async ({ page }) => {
    const user = fixUser();
    await register(page, user);
    await page.context().clearCookies();

    await fillSignUp(page, { ...user, password: "otra-clave-distinta-9" });

    await expect(page.locator("form").getByRole("alert")).toHaveText(
      "No pudimos crear la cuenta con ese correo. Si ya tienes cuenta, inicia sesión.",
    );
    await expect(page).toHaveURL(/\/registro$/);
  });

  test("rechaza nombres que suplantan a la plataforma y contraseñas comunes (SEC-18, SEC-30)", async ({
    page,
  }) => {
    const user = fixUser();
    await fillSignUp(page, { ...user, name: "Equipo speeaking", password: "Contraseña2026!" });

    await expect(page.getByText("Ese nombre está reservado. Elige otro.")).toBeVisible();
    await expect(page.getByText(/Esa contraseña es muy común/)).toBeVisible();
    await expect(page).toHaveURL(/\/registro$/);

    // Con una «l» minúscula en lugar de la «I» se ve igual en la tipografía de la app.
    await fillSignUp(page, { ...user, name: "Equipo VendelA" });

    await expect(page.getByText("Ese nombre está reservado. Elige otro.")).toBeVisible();
    await expect(page).toHaveURL(/\/registro$/);
  });

  test("el onboarding no acepta usuarios ni nombres de la plataforma (SEC-18)", async ({
    page,
  }) => {
    const user = fixUser();
    await register(page, user);

    await page.getByLabel("¿Cómo te llamas?").fill("Soporte speeaking");
    await completeOnboarding(page, { ...user, username: "equipo.soporte" });

    // El servidor rechaza los dos y el formulario vuelve al paso 1 para corregirlos.
    await expect(page.getByText("Ese nombre de usuario no está disponible.")).toBeVisible();
    await expect(page.getByText("Ese nombre está reservado. Elige otro.")).toBeVisible();
    await expect(page).toHaveURL(/\/bienvenida/);
  });
});
