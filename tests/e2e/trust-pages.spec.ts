import { expect, test } from "@playwright/test";
import { registerAndOnboard, uniqueUser, register, completeOnboarding } from "./helpers";

// Confianza sin empresa (ADR-048): páginas públicas de seguridad y apoyo, y borrar la cuenta.

test("las páginas de seguridad y apoyo son públicas y se enlazan desde el registro y el pie", async ({
  page,
  isMobile,
}) => {
  await page.goto("/seguridad");
  await expect(
    page.getByRole("heading", { level: 1, name: "Seguridad y privacidad" }),
  ).toBeVisible();
  await expect(page.getByText("Tu contraseña no la conocemos ni nosotros")).toBeVisible();
  await expect(page.getByRole("link", { name: "Cómo se sostiene el proyecto" })).toHaveAttribute(
    "href",
    "/apoya",
  );

  await page.goto("/apoya");
  await expect(page.getByRole("heading", { level: 1, name: /Apoya a Estreno/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Qué cuesta mantenerlo/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "De dónde sale el dinero" })).toBeVisible();

  await page.goto("/registro");
  await expect(page.getByRole("link", { name: "Cómo cuidamos tus datos" })).toHaveAttribute(
    "href",
    "/seguridad",
  );
  if (!isMobile) {
    await page.goto("/");
    // Un <footer> dentro de <aside> no es «contentinfo»: se busca por etiqueta.
    const footer = page.getByRole("complementary").locator("footer");
    await expect(footer.getByRole("link", { name: "Seguridad" })).toHaveAttribute(
      "href",
      "/seguridad",
    );
    await expect(footer.getByRole("link", { name: "Apoya" })).toHaveAttribute("href", "/apoya");
  }
});

test("borrar mi cuenta la elimina de verdad: se cierra la sesión y ya no se puede entrar", async ({
  page,
}) => {
  const user = uniqueUser();
  await register(page, user);
  await completeOnboarding(page, user);
  await expect(page).toHaveURL("/");

  await page.goto("/ajustes");
  const section = page.getByRole("region", { name: "Borrar mi cuenta" });
  await expect(section).toBeVisible();
  const submit = section.getByRole("button", { name: "Eliminar mi cuenta" });
  await expect(submit).toBeDisabled();
  await section.getByRole("checkbox", { name: /Entiendo que se borra todo/ }).check();
  await submit.click();

  // Sin sesión: la barra ofrece crear cuenta y el correo ya no existe para entrar.
  await expect(page).toHaveURL(/\/\?cuenta=eliminada$/);
  await expect(page.getByRole("status")).toContainText("Tu cuenta se eliminó");
  await page.goto("/entrar");
  await page.getByLabel("Correo").fill(user.email);
  await page.getByLabel("Contraseña").fill(user.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/entrar/);
});

test("la cuenta de prueba de otra persona no se ve afectada", async ({ page }) => {
  // Registro normal como control: sigue funcionando después de que alguien más borró la suya.
  await registerAndOnboard(page);
  await page.goto("/ajustes");
  await expect(page.getByRole("region", { name: "Borrar mi cuenta" })).toBeVisible();
});
