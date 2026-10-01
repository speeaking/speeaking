import { execSync } from "node:child_process";
import { type Browser, expect, type Page, test } from "@playwright/test";
import { register, TINY_PNG, type TestUser, uniqueUser } from "./helpers";

// P14: el equipo oculta un producto (después de un reporte) y desaparece de todo lo público: el
// feed («Siguiendo»), la búsqueda, Comprar, «También te puede gustar», el carrito y su página; su
// foto da 404 a los demás. Su dueño lo sigue viendo en el Studio con el motivo («Oculto por
// moderación»). También se reporta la publicación del producto desde /p/[id].

function intUser() {
  const user = uniqueUser();
  const id = user.email.slice("e2e.".length, -"@example.com".length);
  return { ...user, email: `e2e.int.${id}@example.com`, username: `e2e.int.${id}`, id };
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

/**
 * La bienvenida de `helpers.ts` (perfil, 3 comunidades, empezar), reintentando cada paso: con el
 * servidor de desarrollo recompilando (Fast Refresh), un clic antes de que el router termine de
 * iniciar se pierde («Router action dispatched before initialization») y el paso no avanza.
 */
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
  const user = intUser();
  await register(page, user);
  await onboard(page, user);
  await expect(page).toHaveURL("/");
  return { context, page, user };
}

async function listProduct(
  page: Page,
  title: string,
  { activateStore, publishToFeed }: { activateStore: boolean; publishToFeed: boolean },
) {
  await page.goto("/studio/productos/nuevo");
  if (activateStore) {
    await page.getByLabel("Ciudad").fill("Ciudad de México");
    await page.getByLabel("Estado").fill("CDMX");
    await page.getByRole("button", { name: "Activar mi tienda" }).click();
  }
  await page
    .getByLabel("Elegir imágenes")
    .setInputFiles({ name: "termo.png", mimeType: "image/png", buffer: TINY_PNG });
  await expect(page.locator('input[name="mediaIds"]')).toHaveCount(1);
  await page.getByLabel("Nombre del producto").fill(title);
  await page.getByLabel("Descripción").fill("Termo de acero inoxidable de 1 litro.");
  await page.getByLabel("Categoría").selectOption({ label: "Audio y audífonos" });
  await page.getByLabel("Precio (MXN)").fill("300");
  await page.getByLabel("Tu costo (MXN)").fill("120");
  await page.getByLabel("Piezas disponibles").fill("5");
  await page.getByLabel("Costo de envío").fill("99");
  if (!publishToFeed) await page.getByLabel("Publicar también en el feed").uncheck();
  await page.getByRole("button", { name: "Publicar producto" }).click();
  await expect(page).toHaveURL(/\/producto\/[a-z0-9-]+\?nuevo=1/);
  return new URL(page.url()).pathname;
}

/** Publicación de texto (el feed mezcla 1 pieza comercial cada 4: hace falta contenido antes). */
async function publishText(page: Page, body: string) {
  await page.goto("/crear/publicacion");
  await page.getByLabel("¿Qué quieres compartir?").fill(body);
  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}$/);
}

type FeedPage = { items: { id: string; product: { slug: string } | null }[] };

async function followingFeed(page: Page) {
  const response = await page.request.get("/api/feed?following=1");
  expect(response.status()).toBe(200);
  return ((await response.json()) as FeedPage).items;
}

/** Ruta `/media/…` de la primera foto de la página (`next/image` la pide por `/_next/image`). */
async function firstPhotoPath(page: Page) {
  const src = await page.locator('main img[src*="media"]').first().getAttribute("src");
  expect(src).toBeTruthy();
  const url = new URL(src!, "http://localhost");
  const path = url.pathname === "/_next/image" ? url.searchParams.get("url") : url.pathname;
  expect(path).toMatch(/^\/media\/.+/);
  return path!;
}

/**
 * La página responde «No encontramos esta página» (sin el producto). Se espera al contenido, no al
 * evento `load`: en desarrollo, la respuesta 404 de /p/[id] con sesión a veces no termina de
 * transmitirse (el contenido ya llegó); se reintenta la navegación.
 */
async function expectNotFound(page: Page, path: string, hiddenText: string) {
  await expect(async () => {
    await page.goto(path, { waitUntil: "commit", timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible({
      timeout: 10_000,
    });
  }).toPass({ timeout: 90_000 });
  await expect(page.getByText(hiddenText)).toHaveCount(0);
}

async function report(page: Page, noun: string, reason: string) {
  await page.getByRole("button", { name: "Reportar" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: `Reportar ${noun}` })).toBeVisible();
  await dialog.getByLabel(reason).check();
  await dialog.getByRole("button", { name: "Enviar reporte" }).click();
  await expect(page.getByText(/Gracias\. Revisaremos tu reporte/)).toBeVisible();
  await expect(page.getByText("Reportado")).toBeVisible();
}

test("el equipo oculta un producto: desaparece de todo lo público y su dueño lo sigue viendo", async ({
  browser,
  isMobile,
  request,
}) => {
  // Tres cuentas, dos productos y tres publicaciones contra el servidor de desarrollo.
  test.setTimeout(480_000);
  const seller = await test.step("vendedor", () => newAccount(browser, isMobile));
  const word = `termo${seller.user.id.slice(-6)}`;
  const title = `Termo ${word} oculto`;
  // «testigo» y no «control»: otra prueba busca «control» en Comprar y lo encontraría.
  const controlTitle = `Termo ${word} testigo`;
  const { productPath, controlPath } = await test.step("el vendedor publica", async () => {
    const product = await listProduct(seller.page, title, {
      activateStore: true,
      publishToFeed: true,
    });
    const control = await listProduct(seller.page, controlTitle, {
      activateStore: false,
      publishToFeed: false,
    });
    for (const n of [1, 2, 3]) await publishText(seller.page, `Hoy estrené termo (${n}) ${word}`);
    return { productPath: product, controlPath: control };
  });
  const slug = productPath.split("/").at(-1)!;

  // Quien compra: lo ve en todas partes antes de que el equipo actúe.
  const buyer = await test.step("comprador", () => newAccount(browser, isMobile));
  const postId = await test.step("antes: en «Siguiendo»", async () => {
    await buyer.page.goto(`/u/${seller.user.username}`);
    // El del encabezado del perfil (las tarjetas de sus publicaciones también tienen «Seguir»).
    await buyer.page
      .getByRole("button", { name: /^Seguir a / })
      .first()
      .click();
    await expect(buyer.page.getByRole("button", { name: /^Siguiendo/ }).first()).toBeVisible();
    // «Siguiendo» cambia de inmediato (optimista): se consulta hasta que el seguimiento se guardó.
    let id: string | undefined;
    await expect(async () => {
      id = (await followingFeed(buyer.page)).find((item) => item.product?.slug === slug)?.id;
      expect(id, "la publicación del producto está en «Siguiendo»").toBeTruthy();
    }).toPass({ timeout: 30_000 });
    return id!;
  });
  const postPath = `/p/${postId}`;

  await test.step("antes: búsqueda, Comprar y similares", async () => {
    await buyer.page.goto(`/buscar?q=${word}`);
    await expect(buyer.page.getByRole("link", { name: title }).first()).toBeVisible();
    await buyer.page.goto(`/comprar?q=${word}`);
    await expect(buyer.page.getByRole("link", { name: title }).first()).toBeVisible();
    await buyer.page.goto(controlPath);
    await expect(
      buyer.page.getByRole("heading", { name: "También te puede gustar" }),
    ).toBeVisible();
    await expect(buyer.page.getByRole("link", { name: title }).first()).toBeVisible();
  });

  const photoPath = await test.step("antes: foto pública, carrito y reportes", async () => {
    await buyer.page.goto(productPath);
    const path = await firstPhotoPath(buyer.page);
    expect((await buyer.page.request.get(path)).status()).toBe(200);
    await buyer.page.getByRole("button", { name: "Al carrito" }).click();
    // El carrito abre como panel (ADR-052): se cierra para seguir en la ficha.
    const cartSheet = buyer.page.getByRole("dialog", { name: "Agregado al carrito" });
    await expect(cartSheet).toBeVisible();
    await cartSheet.getByRole("button", { name: "Seguir viendo" }).click();
    await expect(cartSheet).toHaveCount(0);
    await report(buyer.page, "este producto", "Estafa o engaño");

    // Reportar la publicación desde su página (/p/[id]); quien la publicó no ve el botón.
    await buyer.page.goto(postPath);
    await report(buyer.page, "esta publicación", "Spam");
    await seller.page.goto(postPath);
    await expect(seller.page.getByRole("article").first()).toBeVisible();
    await expect(seller.page.getByRole("button", { name: "Reportar" })).toHaveCount(0);

    await buyer.page.goto("/carrito");
    await expect(buyer.page.getByRole("main").getByRole("link", { name: title })).toBeVisible();
    return path;
  });

  // El equipo: ve ambos reportes y oculta el producto.
  const admin = await test.step("equipo", () => newAccount(browser, isMobile));
  makeAdmin(admin.user.email);
  try {
    await test.step("el equipo oculta el producto", async () => {
      await admin.page.goto("/admin/moderacion");
      await expect(admin.page.getByRole("heading", { name: "Moderación", level: 1 })).toBeVisible();
      await expect(
        admin.page
          .getByRole("article", { name: "Reportes de publicación" })
          .filter({ hasText: title })
          .getByText("Spam · 1"),
      ).toBeVisible();
      const productReports = admin.page
        .getByRole("article", { name: "Reportes de producto" })
        .filter({ hasText: title });
      await expect(productReports.getByText("Estafa o engaño · 1")).toBeVisible();
      await productReports.getByRole("button", { name: "Ocultar producto" }).click();
      await expect(admin.page.getByText("Listo: se ocultó de todo lo público.")).toBeVisible();
    });

    await test.step("después: fuera del feed, la búsqueda, Comprar y similares", async () => {
      const feedAfter = await followingFeed(buyer.page);
      expect(feedAfter.map((item) => item.id)).not.toContain(postId);
      expect(feedAfter.some((item) => item.product?.slug === slug)).toBe(false);

      await buyer.page.goto(`/buscar?q=${word}`);
      // Las publicaciones de texto del vendedor siguen (no se ocultaron), el producto no.
      await expect(buyer.page.getByText(`Hoy estrené termo (1) ${word}`)).toBeVisible();
      await expect(buyer.page.getByText(title)).toHaveCount(0);
      await buyer.page.goto(`/comprar?q=${word}`);
      await expect(buyer.page.getByRole("link", { name: controlTitle }).first()).toBeVisible();
      await expect(buyer.page.getByText(title)).toHaveCount(0);
      await buyer.page.goto(controlPath);
      await expect(buyer.page.getByRole("heading", { level: 1, name: controlTitle })).toBeVisible();
      await expect(buyer.page.getByText(title)).toHaveCount(0);
    });

    await test.step("después: fuera del carrito; su página y su publicación dan 404", async () => {
      await buyer.page.goto("/carrito");
      await expect(buyer.page.getByText("Tu carrito está vacío")).toBeVisible();
      await expect(buyer.page.getByText(title)).toHaveCount(0);
      for (const path of [productPath, postPath]) await expectNotFound(buyer.page, path, title);
    });

    await test.step("después: la foto solo para su dueño y el equipo", async () => {
      // 404 para quien compra y sin sesión; su dueño y el equipo sí (sin caché).
      expect((await buyer.page.request.get(photoPath)).status()).toBe(404);
      expect((await request.get(photoPath)).status()).toBe(404);
      for (const viewer of [seller.page, admin.page]) {
        const photo = await viewer.request.get(photoPath);
        expect(photo.status()).toBe(200);
        expect(photo.headers()["cache-control"]).toBe("private, no-store");
      }
    });

    await test.step("su dueño lo sigue viendo en el Studio con el motivo", async () => {
      await seller.page.goto("/studio/productos");
      const item = seller.page.getByRole("listitem").filter({ hasText: title });
      await expect(item.getByText("Oculto por moderación")).toBeVisible();
      await seller.page.goto(productPath);
      await expect(seller.page.getByText(/El equipo ocultó este producto/)).toBeVisible();
    });
  } finally {
    makeAdmin(admin.user.email, "--revoke");
    await Promise.all([seller.context.close(), buyer.context.close(), admin.context.close()]);
  }
});
