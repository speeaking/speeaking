import { execSync } from "node:child_process";
import { type APIRequestContext, type Browser, expect, type Page, test } from "@playwright/test";
import sharp from "sharp";
import { chooseImages, register, type TestUser, uniqueUser } from "./helpers";

// ADR-039: las fotos subidas se entregan por `/media/<clave>?w=N` (loader propio de `next/image`),
// que autoriza cada petición. Ninguna página pide `/_next/image` para `/media`, y la foto de un
// producto que el equipo oculta da 404 a los demás en cuanto se oculta, aunque su variante ya se
// hubiera pedido (y guardado en la caché de variantes) antes.

const PUBLIC_CACHE = "public, max-age=3600, stale-while-revalidate=86400";
const WIDTHS = "256|384|640|828|1080|1600";
/** `/media/<clave>?w=<ancho>` dentro del HTML (src, srcset o preload). */
const MEDIA_VARIANT_URL = new RegExp(`/media/[a-z0-9/_-]+\\.(?:webp|jpg|png)\\?w=(?:${WIDTHS})\\b`);

function finUser() {
  const user = uniqueUser();
  const id = user.email.slice("e2e.".length, -"@example.com".length);
  return { ...user, email: `e2e.fin.${id}@example.com`, username: `e2e.fin.${id}`, id };
}

/** Corre el script real contra la base de desarrollo (la misma que usa `pnpm dev`). */
function makeAdmin(email: string, ...flags: string[]) {
  return execSync(["pnpm exec tsx scripts/make-admin.ts", email, ...flags].join(" "), {
    encoding: "utf8",
    timeout: 90_000,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** Marca una opción de la bienvenida (casilla oculta dentro de su etiqueta) si no lo está. */
async function checkChip(page: Page, name: string) {
  const box = page.getByRole("checkbox", { name: new RegExp(`^${name}`) });
  if (!(await box.isChecked())) await page.locator("label").filter({ has: box }).click();
  await expect(box).toBeChecked();
}

/** Bienvenida reintentando cada paso (con el servidor de desarrollo recompilando se pierden clics). */
async function onboard(page: Page, user: TestUser) {
  await expect(async () => {
    const username = page.getByLabel("Nombre de usuario");
    if (await username.isVisible()) {
      await username.fill(user.username);
      await checkChip(page, "Entretenerme");
      await page.getByRole("button", { name: "Siguiente" }).click();
    }
    await expect(page.getByText("Gaming", { exact: true })).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 90_000 });
  await expect(async () => {
    for (const community of ["Gaming", "Tecnología", "Comida"]) await checkChip(page, community);
    await page.getByRole("button", { name: "Siguiente" }).click();
    await expect(page.getByRole("button", { name: "Empezar" })).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 90_000 });
  await page.getByRole("button", { name: "Empezar" }).click();
}

async function newAccount(browser: Browser, isMobile: boolean) {
  const context = await browser.newContext(
    isMobile ? { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true } : {},
  );
  const page = await context.newPage();
  const user = finUser();
  await register(page, user);
  await onboard(page, user);
  await expect(page).toHaveURL("/");
  return { context, page, user };
}

/** Producto con una foto de 1200×900 (más ancha que 640: tiene variantes reales). */
async function listProduct(page: Page, title: string) {
  const photo = await sharp({
    create: { width: 1200, height: 900, channels: 3, background: "#ca2352" },
  })
    .jpeg()
    .toBuffer();
  await page.goto("/studio/productos/nuevo");
  await page.getByLabel("Ciudad").fill("Ciudad de México");
  await page.getByLabel("Estado").fill("CDMX");
  await page.getByRole("button", { name: "Activar mi tienda" }).click();
  await chooseImages(page, { name: "termo.jpg", mimeType: "image/jpeg", buffer: photo });
  // La primera subida compila `/api/uploads` en el servidor de desarrollo.
  await expect(page.locator('input[name="mediaIds"]')).toHaveCount(1, { timeout: 60_000 });
  await page.getByLabel("Nombre del producto").fill(title);
  await page.getByLabel("Descripción").fill("Termo de acero inoxidable de 1 litro.");
  await page.getByLabel("Categoría").selectOption({ label: "Audio y audífonos" });
  await page.getByLabel("Precio (MXN)").fill("300");
  await page.getByLabel("Tu costo (MXN)").fill("120");
  await page.getByLabel("Piezas disponibles").fill("5");
  await page.getByLabel("Costo de envío").fill("99");
  await page.getByLabel("Publicar también en el feed").uncheck();
  await page.getByRole("button", { name: "Publicar producto" }).click();
  await expect(page).toHaveURL(/\/producto\/[a-z0-9-]+\?nuevo=1/, { timeout: 45_000 });
  return new URL(page.url()).pathname;
}

/** Ruta `/media/…` (sin query) de la primera foto de la página. */
async function firstPhotoPath(page: Page) {
  const src = await page.locator('main img[src*="/media/"]').first().getAttribute("src");
  expect(src, "la foto se pide directo a /media").toMatch(MEDIA_VARIANT_URL);
  return new URL(src!, "http://localhost").pathname;
}

async function expectNoOptimizerUrls(request: APIRequestContext, path: string) {
  const html = await (await request.get(path)).text();
  expect(html, `${path}: sin /_next/image para /media`).not.toContain("/_next/image?url=%2Fmedia");
  expect(html, `${path}: sin /_next/image`).not.toContain("/_next/image?url=");
  return html;
}

test.describe("entrega de fotos por /media (ADR-039)", () => {
  test("el HTML del feed y de Comprar pide las fotos a /media?w=, nunca a /_next/image", async ({
    request,
  }) => {
    test.setTimeout(120_000);
    await expectNoOptimizerUrls(request, "/");
    const html = await expectNoOptimizerUrls(request, "/comprar");
    const url = MEDIA_VARIANT_URL.exec(html)?.[0];
    expect(url, "hay al menos una foto semilla en /comprar").toBeTruthy();
    const path = url!.split("?")[0]!;

    // El optimizador de Next ya no atiende nada (loader propio): ni /media ni otras rutas.
    for (const target of [path, "/icons/icon-192.png"]) {
      const optimized = await request.get(
        `/_next/image?url=${encodeURIComponent(target)}&w=256&q=75`,
      );
      expect(optimized.status(), `/_next/image ${target}`).toBe(404);
    }

    // Variante pública: caché de una hora (no inmutable) y validador.
    const variant = await request.get(url!);
    expect(variant.status()).toBe(200);
    expect(variant.headers()["content-type"]).toMatch(/^image\//);
    expect(variant.headers()["cache-control"]).toBe(PUBLIC_CACHE);
    const etag = variant.headers()["etag"];
    expect(etag).toBeTruthy();
    const revalidated = await request.get(url!, { headers: { "If-None-Match": etag! } });
    expect(revalidated.status()).toBe(304);

    // Solo `?w=<ancho permitido>`: lo demás es 400 (SEC-35).
    for (const search of ["?w=641", "?w=640&q=75", "?v=1"]) {
      expect((await request.get(`${path}${search}`)).status(), search).toBe(400);
    }
  });

  test("una foto ya pedida da 404 a los demás en cuanto el equipo oculta el producto", async ({
    browser,
    isMobile,
    request,
  }) => {
    // Dos cuentas completas, un producto y una acción de moderación contra el servidor de desarrollo.
    test.setTimeout(360_000);
    const seller = await test.step("vendedor", () => newAccount(browser, isMobile));
    const title = `Termo ${seller.user.id.slice(-6)} entrega`;
    const productPath = await test.step("publica un producto con foto", () =>
      listProduct(seller.page, title));

    const admin = await test.step("equipo", () => newAccount(browser, isMobile));
    makeAdmin(admin.user.email);
    try {
      const { photoPath, etag } = await test.step("antes: la foto es pública", async () => {
        await admin.page.goto(productPath);
        await expect(admin.page.getByRole("heading", { level: 1, name: title })).toBeVisible();
        const photoPath = await firstPhotoPath(admin.page);
        await expectNoOptimizerUrls(request, productPath);

        // Sin sesión (como cualquier visitante o una CDN): se genera y se guarda la variante.
        const first = await request.get(`${photoPath}?w=640`);
        expect(first.status()).toBe(200);
        expect(first.headers()["content-type"]).toBe("image/webp");
        expect(first.headers()["cache-control"]).toBe(PUBLIC_CACHE);
        const size = await sharp(await first.body()).metadata();
        expect([size.width, size.height]).toEqual([640, 480]);
        // La segunda sale de la caché de variantes: mismos bytes, mismo validador.
        const again = await request.get(`${photoPath}?w=640`);
        expect(again.headers()["etag"]).toBe(first.headers()["etag"]);
        expect((await request.get(`${photoPath}?w=256`)).status()).toBe(200);
        return { photoPath, etag: first.headers()["etag"]! };
      });

      await test.step("el equipo lo reporta y lo oculta", async () => {
        await admin.page.getByRole("button", { name: "Reportar" }).click();
        const dialog = admin.page.getByRole("dialog");
        await dialog.getByLabel("Estafa o engaño").check();
        await dialog.getByRole("button", { name: "Enviar reporte" }).click();
        await expect(admin.page.getByText(/Gracias\. Revisaremos tu reporte/)).toBeVisible();

        await admin.page.goto("/admin/moderacion");
        await admin.page
          .getByRole("article", { name: "Reportes de producto" })
          .filter({ hasText: title })
          .getByRole("button", { name: "Ocultar producto" })
          .click();
        await expect(admin.page.getByText("Listo: se ocultó de todo lo público.")).toBeVisible();
      });

      await test.step("después: 404 para los demás de inmediato, con o sin variante", async () => {
        for (const search of ["?w=640", "?w=256", "?w=1080", ""]) {
          const response = await request.get(`${photoPath}${search}`);
          expect(response.status(), `sin sesión ${search}`).toBe(404);
          expect(response.headers()["cache-control"]).toBe("no-store");
        }
        // Un validador de antes no sirve para obtener un 304.
        const conditional = await request.get(`${photoPath}?w=640`, {
          headers: { "If-None-Match": etag },
        });
        expect(conditional.status()).toBe(404);
      });

      await test.step("su dueño y el equipo la siguen viendo, sin caché", async () => {
        for (const viewer of [seller.page, admin.page]) {
          const photo = await viewer.request.get(`${photoPath}?w=640`);
          expect(photo.status()).toBe(200);
          expect(photo.headers()["cache-control"]).toBe("private, no-store");
        }
        // En el Studio, la foto del producto oculto carga (la pide el navegador con su sesión).
        await seller.page.goto("/studio/productos");
        const item = seller.page.getByRole("listitem").filter({ hasText: title });
        const thumbnail = item.locator('img[src*="/media/"]');
        await expect(thumbnail).toHaveAttribute("src", MEDIA_VARIANT_URL);
        await thumbnail.scrollIntoViewIfNeeded();
        await expect
          .poll(() =>
            thumbnail.evaluate((img: HTMLImageElement) => (img.complete ? img.naturalWidth : 0)),
          )
          .toBeGreaterThan(0);
      });
    } finally {
      makeAdmin(admin.user.email, "--revoke");
      await Promise.all([seller.context.close(), admin.context.close()]);
    }
  });
});
