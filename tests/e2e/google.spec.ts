import { expect, test } from "@playwright/test";

// Entrar con Google (ADR-049) solo existe con credenciales. Sin ellas (como en esta suite): sin
// botón y el callback de OAuth cerrado, igual que el resto del router HTTP de Better Auth.

test("sin credenciales de Google no hay botón ni callback abierto", async ({ page, request }) => {
  await page.goto("/entrar");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar con Google" })).toHaveCount(0);
  await page.goto("/registro");
  await expect(page.getByRole("button", { name: "Continuar con Google" })).toHaveCount(0);

  const callback = await request.get("/api/auth/callback/google?code=x&state=y", {
    maxRedirects: 0,
  });
  expect(callback.status()).toBe(404);

  // El aviso de error de Google se muestra si alguien llega con él (sin exponer nada más).
  await page.goto("/entrar?error=google");
  await expect(page.getByRole("alert")).toContainText("No pudimos entrar con Google");
});
