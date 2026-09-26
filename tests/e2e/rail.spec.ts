import { expect, type Page, test } from "@playwright/test";
import { register, registerAndOnboard, type TestUser, uniqueUser } from "./helpers";

/** Onboarding con una búsqueda declarada y su presupuesto («¿Buscas algo ahora?»). */
async function onboardLookingFor(page: Page, user: TestUser, query: string, budget: string) {
  await page.getByLabel("Nombre de usuario").fill(user.username);
  await page.getByText("Entretenerme").click();
  await page.getByRole("button", { name: "Siguiente" }).click();

  for (const community of ["Gaming", "Tecnología", "Comida"]) {
    await page.getByText(community, { exact: true }).click();
  }
  await page.getByRole("button", { name: "Siguiente" }).click();

  await page.getByLabel("¿Qué buscas?").fill(query);
  await page.getByLabel("¿Hasta cuánto quieres gastar?").fill(budget);
  await page.getByRole("button", { name: "Empezar" }).click();
  await expect(page).toHaveURL("/");
}

test.describe("columna «Para ti»", () => {
  // La columna (F4 + F6b) solo existe en escritorio ancho (xl+).
  test.skip(({ isMobile }) => isMobile, "La columna derecha solo se muestra en escritorio.");

  test("el visitante ve la bienvenida y nada para vendedores ni búsquedas", async ({ page }) => {
    await page.goto("/");

    const welcome = page.getByRole("region", { name: "Arma tu propio inicio" });
    await expect(welcome).toBeVisible();
    await expect(welcome.getByRole("link", { name: "Crear cuenta gratis" })).toHaveAttribute(
      "href",
      "/registro",
    );
    await expect(welcome.getByRole("link", { name: "Entra", exact: true })).toHaveAttribute(
      "href",
      "/entrar",
    );

    const rail = page.getByRole("complementary").filter({ has: welcome });
    await expect(rail.getByRole("region", { name: "Lo que buscas" })).toHaveCount(0);
    await expect(rail.getByRole("region", { name: "Gente de tus comunidades" })).toHaveCount(0);
    // Ni productos ni la fila de Vende con IA: el visitante solo ve la invitación de la bienvenida.
    await expect(rail.locator('a[href^="/producto/"]')).toHaveCount(0);
    await expect(
      rail.getByText("Tú tienes el producto. La IA encuentra cómo venderlo."),
    ).toHaveCount(0);
    await expect(rail.getByRole("link", { name: "Privacidad" })).toBeVisible();

    // «Unirme» lleva al visitante a crear cuenta y regresar (sin marcarlo «Miembro» antes).
    const moving = rail.getByRole("region", { name: "Comunidades en movimiento" });
    if ((await moving.count()) > 0) {
      // Con la comunidad ya elegida para el onboarding (`unirse`).
      await expect(moving.getByRole("link", { name: /^Unirme a / }).first()).toHaveAttribute(
        "href",
        /^\/registro\?next=%2F&unirse=[a-z-]+$/,
      );
      await expect(moving.getByRole("button", { name: "Unirme" })).toHaveCount(0);
    }
  });

  test("con sesión, «Lo que buscas» trae la búsqueda del onboarding y se puede descartar", async ({
    page,
  }) => {
    const user = uniqueUser();
    await register(page, user);
    await onboardLookingFor(page, user, "tenis para correr", "2,000");

    const intent = page.getByRole("region", { name: "Lo que buscas" });
    await expect(intent).toBeVisible();
    await expect(intent.getByText("tenis para correr", { exact: true })).toBeVisible();
    await expect(intent.getByText("Hasta $2,000 · la guardaste al registrarte")).toBeVisible();
    await expect(page.getByRole("region", { name: "Arma tu propio inicio" })).toHaveCount(0);

    // Esperamos la hidratación: antes de ella el botón aún no tiene su manejador.
    await page.waitForLoadState("networkidle");
    await intent.getByRole("button", { name: "Ya no busco «tenis para correr»" }).click();
    await expect(intent).toHaveCount(0);

    // Queda descartada en el servidor, no solo en la pantalla.
    await page.reload();
    await expect(page.getByRole("region", { name: "Debates abiertos" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Lo que buscas" })).toHaveCount(0);
  });
});

test.describe("ajuste «Aparecer en sugerencias»", () => {
  test("está activo por omisión y el cambio se guarda", async ({ page }) => {
    await registerAndOnboard(page);
    await page.goto("/ajustes");

    const setting = page.getByRole("switch", { name: /Aparecer en sugerencias/ });
    await expect(setting).toBeChecked();
    await page.waitForLoadState("networkidle");
    // El cambio se ve al instante; se espera la respuesta de la acción antes de recargar.
    const saved = page.waitForResponse(
      (response) => response.request().method() === "POST" && response.url().includes("/ajustes"),
    );
    await setting.click();
    await expect(
      page.getByText("No apareces como sugerencia para nadie.", { exact: false }),
    ).toBeVisible();
    await saved;

    await page.reload();
    await expect(page.getByRole("switch", { name: /Aparecer en sugerencias/ })).not.toBeChecked();
  });
});
