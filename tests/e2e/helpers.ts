import { expect, type Locator, type Page } from "@playwright/test";

/** PNG de 1×1 válido para probar subidas sin archivos externos. */
export const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

export function uniqueUser() {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return {
    name: "Prueba Automática",
    email: `e2e.${id}@example.com`,
    password: "clave-de-prueba-segura",
    username: `e2e.${id}`,
  };
}

export type TestUser = ReturnType<typeof uniqueUser>;

export async function register(page: Page, user: TestUser) {
  await page.goto("/registro");
  await page.getByLabel("Nombre", { exact: true }).fill(user.name);
  await page.getByLabel("Correo").fill(user.email);
  await page.getByLabel("Contraseña").fill(user.password);
  await page.getByLabel(/Acepto los/).check();
  await page.getByLabel("Tengo 18 años o más").check();
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/bienvenida/);
}

/** Onboarding de 3 pasos: perfil, comunidades (mínimo 3) y gustos opcionales. */
export async function completeOnboarding(
  page: Page,
  user: TestUser,
  options: { sell?: boolean; lookingFor?: string } = {},
) {
  await page.getByLabel("Nombre de usuario").fill(user.username);
  await page.getByText("Entretenerme").click();
  if (options.sell) await page.getByText("Vender mis productos").click();
  await page.getByRole("button", { name: "Siguiente" }).click();

  for (const community of ["Gaming", "Tecnología", "Comida"]) {
    await page.getByText(community, { exact: true }).click();
  }
  await page.getByRole("button", { name: "Siguiente" }).click();

  if (options.lookingFor) await page.getByLabel("¿Qué buscas?").fill(options.lookingFor);
  await page.getByRole("button", { name: "Empezar" }).click();
}

/** Activa la tienda desde una página del Studio que la pide (P6). */
export async function activateStore(page: Page) {
  await page.getByLabel("Ciudad").fill("Ciudad de México");
  await page.getByLabel("Estado").fill("CDMX");
  await page.getByRole("button", { name: "Activar mi tienda" }).click();
}

/**
 * Elige imágenes en el `ImageUploader`. `setInputFiles` llena el campo oculto sin pasar por
 * «Agregar» (que solo abre el selector con la página ya cargada): justo después de `goto`, o de
 * activar la tienda antes de que cargue la página, el `change` llega antes que React, se pierde y no
 * se sube nada. Por eso espera a que React tome el campo.
 */
export async function chooseImages(page: Page, files: Parameters<Locator["setInputFiles"]>[0]) {
  const input = page.getByLabel("Elegir imágenes");
  await waitForHydration(input);
  await input.setInputFiles(files);
}

/**
 * Vendedor nuevo: activa su tienda y publica un producto a mano con foto. Devuelve la URL pública.
 * `title` distinto por prueba evita chocar con lo que otras pruebas publican en paralelo.
 */
export async function createProduct(
  page: Page,
  { title, price = "12,500", cost = "8134.79" }: { title: string; price?: string; cost?: string },
) {
  await page.goto("/studio/productos/nuevo");
  await activateStore(page);
  await chooseImages(page, { name: "producto.png", mimeType: "image/png", buffer: TINY_PNG });
  await expect(page.locator('input[name="mediaIds"]')).toHaveCount(1);
  await page.getByLabel("Nombre del producto").fill(title);
  await page.getByLabel("Descripción").fill("Producto de prueba publicado a mano.");
  await page.getByLabel("Categoría").selectOption({ index: 1 });
  await page.getByLabel("Precio (MXN)").fill(price);
  await page.getByLabel("Tu costo (MXN)").fill(cost);
  await page.getByLabel("Piezas disponibles").fill("5");
  await page.getByLabel("Costo de envío").fill("99");
  await page.getByLabel(/son míos o tengo permiso/).check();
  await page.getByRole("button", { name: "Publicar producto" }).click();
  await expect(page).toHaveURL(/\/producto\/[a-z0-9-]+\?nuevo=1/);
  return page.url().split("?")[0]!;
}

export async function registerAndOnboard(page: Page) {
  const user = uniqueUser();
  await register(page, user);
  await completeOnboarding(page, user);
  await expect(page).toHaveURL("/");
  return user;
}

/**
 * Espera a que React tome el elemento (la página terminó de cargar). Los botones de la barra que
 * abren su panel ahí mismo (ADR-068) son enlaces a su página completa hasta entonces.
 */
export async function waitForHydration(locator: Locator) {
  await locator.evaluate(
    (element) =>
      new Promise<void>((resolve) => {
        const check = () =>
          Object.keys(element).some((key) => key.startsWith("__reactProps"))
            ? resolve()
            : requestAnimationFrame(check);
        check();
      }),
  );
}

/**
 * «No encontrada» de una página que transmite: el `loading.tsx` raíz cubre casi todas, así que
 * cuando `notFound()` llega la respuesta ya empezó y Next no puede cambiar el estado HTTP. Responde
 * 200 con la página «No encontramos esta página» y el `<meta name="robots" content="noindex">` que
 * inserta Next (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md`,
 * «Status Codes»). Se acepta también un 404 de verdad, nunca una redirección (no se anuncia el área
 * ni se manda a iniciar sesión) y nada de `hidden` aparece en la página ni en el HTML (que incluye
 * la carga RSC).
 */
export async function expectStreamedNotFoundPage(
  page: Page,
  path: string,
  { hidden = [] }: { hidden?: readonly string[] } = {},
) {
  const response = await page.goto(path);
  expect(response, path).not.toBeNull();
  expect([200, 404], `${path}: estado ${response!.status()}`).toContain(response!.status());
  expect(new URL(page.url()).pathname, path).toBe(new URL(path, page.url()).pathname);
  await expect(
    page.getByRole("heading", { name: "No encontramos esta página" }),
    path,
  ).toBeVisible();
  // El `noindex` exacto es el de Next para «no encontrada» (el del layout dice «noindex, follow»).
  await expect(page.locator('meta[name="robots"][content="noindex"]').first(), path).toBeAttached();
  const html = await response!.text();
  for (const text of hidden) {
    expect(html, `${path}: el HTML no debe decir «${text}»`).not.toContain(text);
    await expect(page.getByText(text), `${path}: «${text}» en la página`).toHaveCount(0);
  }
}
