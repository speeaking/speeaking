import { expect, test } from "@playwright/test";
import { completeOnboarding, register, registerAndOnboard, uniqueUser } from "./helpers";

test.describe("cuenta", () => {
  test("registro + onboarding de 3 pasos lleva al feed y crea el perfil", async ({ page }) => {
    const user = uniqueUser();
    await register(page, user);
    await completeOnboarding(page, user, { lookingFor: "audífonos para el metro" });

    await expect(page).toHaveURL("/");
    // El inicio ya no tiene un «Para ti» visible (su h1 es solo para lectores de pantalla): el
    // compositor saluda por su nombre a la cuenta recién creada.
    const firstName = user.name.split(" ")[0];
    await expect(
      page
        .getByRole("region", { name: "Crear publicación" })
        .getByRole("link", { name: `¿Qué quieres compartir, ${firstName}?` }),
    ).toBeVisible();

    await page.goto("/perfil");
    await expect(page).toHaveURL(`/u/${user.username}`);
    await expect(page.getByRole("heading", { level: 1, name: user.name })).toBeVisible();
  });

  test("el botón Atrás del navegador regresa un paso del onboarding sin perder lo elegido", async ({
    page,
  }) => {
    const user = uniqueUser();
    await register(page, user);
    await page.getByLabel("Nombre de usuario").fill(user.username);
    await page.getByRole("button", { name: "Siguiente" }).click();

    await expect(page).toHaveURL(/\/bienvenida\?paso=2$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Elige tus comunidades" }),
    ).toBeFocused();
    await page.getByText("Gaming", { exact: true }).click();

    await page.goBack();
    await expect(page).toHaveURL(/\/bienvenida$/);
    await expect(page.getByRole("heading", { level: 1, name: "Cuéntanos de ti" })).toBeVisible();
    await expect(page.getByLabel("Nombre de usuario")).toHaveValue(user.username);

    await page.goForward();
    await expect(page.getByRole("checkbox", { name: /Gaming/ })).toBeChecked();
  });

  test("se puede ver la contraseña mientras la escribes", async ({ page }) => {
    await page.goto("/entrar");
    const password = page.getByLabel("Contraseña");
    await password.fill("clave-visible-123");
    await expect(password).toHaveAttribute("type", "password");

    await page.getByRole("button", { name: "Mostrar contraseña" }).click();

    await expect(password).toHaveAttribute("type", "text");
    await expect(password).toHaveValue("clave-visible-123");
  });

  test("elegir 'Vender' en el onboarding empieza en el feed y Sube y vende queda en Crear", async ({
    page,
  }) => {
    // Desde f1ea818 toda cuenta nueva empieza en el feed con «¡Listo, …!» (red social primero) y
    // vender se abre desde sus accesos, como Crear.
    const user = uniqueUser();
    await register(page, user);
    await completeOnboarding(page, user, { sell: true });

    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("region", { name: `¡Listo, ${user.name.split(" ")[0]}!` }),
    ).toBeVisible();

    await page.goto("/crear");
    await page
      .getByRole("main")
      .getByRole("link", { name: /^Sube y vende/ })
      .click();
    await expect(page).toHaveURL("/studio/sube-y-vende");
    await expect(page.getByLabel("¿Qué quieres vender hoy?")).toBeVisible();
  });

  test("cerrar sesión e iniciar sesión de nuevo", async ({ page, isMobile }) => {
    const user = await registerAndOnboard(page);

    await page.goto(`/u/${user.username}`);
    await page.getByRole("main").getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL("/");
    // Sin sesión la barra superior invita a entrar: «Entrar» en escritorio y «Únete» en móvil (el
    // inicio ya no tiene banner con «Entrar»).
    await expect(
      page
        .getByRole("banner")
        .getByRole("link", { name: isMobile ? "Únete" : "Entrar", exact: true }),
    ).toBeVisible();

    await page.goto("/entrar");
    await page.getByLabel("Correo").fill(user.email);
    await page.getByLabel("Contraseña").fill(user.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL("/");
  });

  test("una contraseña incorrecta muestra un error que no revela si la cuenta existe", async ({
    page,
  }) => {
    // Correo único: el límite por correo (SEC-02) bloquearía uno fijo tras varias corridas.
    await page.goto("/entrar");
    await page.getByLabel("Correo").fill(uniqueUser().email);
    await page.getByLabel("Contraseña").fill("incorrecta-123");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page.locator("form").getByRole("alert")).toHaveText(
      "Correo o contraseña incorrectos.",
    );
  });

  test("una ruta protegida pide iniciar sesión y regresa a ella después", async ({ page }) => {
    const user = uniqueUser();
    await register(page, user);
    await completeOnboarding(page, user);
    await page.context().clearCookies();

    await page.goto("/crear/publicacion");
    await expect(page).toHaveURL(/\/entrar\?next=%2Fcrear%2Fpublicacion/);
    await page.getByLabel("Correo").fill(user.email);
    await page.getByLabel("Contraseña").fill(user.password);
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page).toHaveURL("/crear/publicacion");
  });
});
