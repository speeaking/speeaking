import { execSync } from "node:child_process";
import { expect, type Page, test } from "@playwright/test";
import { completeOnboarding, expectStreamedNotFoundPage, register, uniqueUser } from "./helpers";

// /admin: solo el rol ADMIN (que solo da scripts/make-admin.ts) la ve. A cualquier otra persona le
// responde la misma página «no encontrada» que una ruta inexistente: no se anuncia ni redirige a
// iniciar sesión. Como transmite (`loading.tsx` raíz), el estado es 200 con `noindex`, no 404.

function ceoUser() {
  const user = uniqueUser();
  const id = user.email.slice("e2e.".length, -"@example.com".length);
  return { ...user, email: `e2e.ceo.${id}@example.com`, username: `e2e.ceo.${id}` };
}

/** Corre el script real contra la base de desarrollo (la misma que usa `pnpm dev`). */
function makeAdmin(email: string, ...flags: string[]) {
  return execSync(["pnpm exec tsx scripts/make-admin.ts", email, ...flags].join(" "), {
    encoding: "utf8",
    timeout: 90_000,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function expectNotFound(page: Page, path: string) {
  await expectStreamedNotFoundPage(page, path, { hidden: ["Administración", "Resumen"] });
  await expect(page).not.toHaveTitle(/Administración/);
}

test("sin sesión, /admin es «no encontrada» como cualquier ruta inexistente", async ({ page }) => {
  await expectNotFound(page, "/admin");
  expect(page.url()).toMatch(/\/admin$/);
});

test("una persona sin el rol ADMIN recibe «no encontrada»; con el rol ve el área; al quitarlo, otra vez", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const user = ceoUser();
  await register(page, user);
  await completeOnboarding(page, user);
  await expect(page).toHaveURL("/");

  await expectNotFound(page, "/admin");

  makeAdmin(user.email);
  const response = await page.goto("/admin");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/Administración/);
  await expect(page.getByRole("heading", { name: "Resumen", level: 1 })).toBeVisible();
  const main = page.locator("main");
  for (const [label, href] of [
    ["Decisiones", "/admin/decisiones"],
    ["Experimentos", "/admin/experimentos"],
    ["Moderación", "/admin/moderacion"],
    ["Redacción", "/admin/redaccion"],
    ["IA", "/admin/ia"],
  ] as const) {
    await expect(main.locator(`a[href="${href}"]`)).toContainText(label);
  }
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);

  makeAdmin(user.email, "--revoke");
  await expectNotFound(page, "/admin");
});
