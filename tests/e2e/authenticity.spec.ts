import { execSync } from "node:child_process";
import { type Browser, expect, type Page, test } from "@playwright/test";
import { completeOnboarding, register, TINY_PNG, uniqueUser } from "./helpers";

// P14: riesgo de falsificación, no certificación. Un vendedor publica «AirPods Pro réplica AAA»
// como original a $300 → quien compra ve «Autenticidad sin verificar» y puede reportarlo; el
// vendedor sube un comprobante privado; el equipo lo ve en /admin/moderacion, no puede marcarlo
// «revisado» mientras diga «réplica» y lo oculta. Otro producto sin esas palabras sí se marca como
// «Comprobante revisado» (con las mismas fotos que el equipo tiene en pantalla).

function ceoUser() {
  const user = uniqueUser();
  const id = user.email.slice("e2e.".length, -"@example.com".length);
  return { ...user, email: `e2e.ceo.${id}@example.com`, username: `e2e.ceo.${id}`, id };
}

/** Corre el script real contra la base de desarrollo (la misma que usa `pnpm dev`). */
function makeAdmin(email: string, ...flags: string[]) {
  return execSync(["pnpm exec tsx scripts/make-admin.ts", email, ...flags].join(" "), {
    encoding: "utf8",
    timeout: 90_000,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function newAccount(browser: Browser, isMobile: boolean) {
  const context = await browser.newContext(
    isMobile ? { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true } : {},
  );
  const page = await context.newPage();
  const user = ceoUser();
  await register(page, user);
  await completeOnboarding(page, user);
  await expect(page).toHaveURL("/");
  return { context, page, user };
}

const image = (name: string) => ({ name, mimeType: "image/png", buffer: TINY_PNG });

async function listReplica(page: Page, title: string, { activateStore = true } = {}) {
  await page.goto("/studio/productos/nuevo");
  if (activateStore) {
    await page.getByLabel("Ciudad").fill("Ciudad de México");
    await page.getByLabel("Estado").fill("CDMX");
    await page.getByRole("button", { name: "Activar mi tienda" }).click();
  }

  await page.getByLabel("Elegir imágenes").setInputFiles(image("airpods.png"));
  await expect(page.locator('input[name="mediaIds"]')).toHaveCount(1);
  await page.getByLabel("Nombre del producto").fill(title);
  await page.getByLabel("Descripción").fill("Audífonos inalámbricos con estuche de carga.");
  await page.getByLabel("Categoría").selectOption({ label: "Audio y audífonos" });
  await page.getByLabel("Precio (MXN)").fill("300");
  await page.getByLabel("Tu costo (MXN)").fill("120");
  await page.getByLabel("Piezas disponibles").fill("5");
  await page.getByLabel("Costo de envío").fill("99");
  await page.getByLabel("¿Es de marca original?").selectOption("DECLARED_ORIGINAL");
  await page.getByRole("button", { name: "Publicar producto" }).click();
  await expect(page).toHaveURL(/\/producto\/airpods-pro-[a-z0-9-]+\?nuevo=1/);
  return page.url().split("?")[0]!;
}

/** Sube un comprobante desde el Studio y devuelve el id de la foto. */
async function submitProof(page: Page, title: string, file: string) {
  await page.goto("/studio/productos");
  const item = page.getByRole("listitem").filter({ hasText: title });
  await expect(item.getByText("Falta comprobante")).toBeVisible();
  const proofLink = item.getByRole("link", { name: /^Subir comprobante/ });
  await expect(proofLink).toHaveAttribute(
    "href",
    /^\/studio\/productos\/[0-9a-f-]{36}\/autenticidad$/,
  );
  await page.goto((await proofLink.getAttribute("href"))!);
  await expect(page.getByRole("heading", { name: "Te pedimos un comprobante" })).toBeVisible();
  await page.getByLabel("Elegir imágenes").setInputFiles(image(file));
  const proofInput = page.locator('input[name="proofMediaIds"]');
  await expect(proofInput).toHaveCount(1);
  const proofId = await proofInput.inputValue();
  await page.getByRole("button", { name: "Enviar comprobante" }).click();
  await expect(page).toHaveURL(/autenticidad\?enviado=1$/);
  await expect(page.getByText(/Recibimos tu comprobante/)).toBeVisible();
  return proofId;
}

test("una réplica declarada original: sin verificar para quien compra, reporte, comprobante privado y el equipo la oculta", async ({
  browser,
  isMobile,
}) => {
  // Tres cuentas, dos productos y dos comprobantes contra el servidor de desarrollo.
  test.setTimeout(480_000);
  const seller = await newAccount(browser, isMobile);
  const title = `AirPods Pro réplica AAA ${seller.user.id.slice(-5)}`;
  const productUrl = await listReplica(seller.page, title);
  const productPath = new URL(productUrl).pathname;

  // El vendedor ve la petición de comprobante; nadie lo acusa de nada.
  await expect(seller.page.getByText("Pedimos un comprobante de autenticidad")).toBeVisible();
  await expect(seller.page.getByText("Autenticidad sin verificar").first()).toBeVisible();

  // Quien compra: la declaración «original» se oculta y hay una nota neutral del precio.
  const buyer = await newAccount(browser, isMobile);
  const response = await buyer.page.goto(productPath);
  expect(response?.status()).toBe(200);
  const html = (await response?.text()) ?? "";
  expect(html).not.toMatch(/falso|signals|riskLevel|price_below/i);
  await expect(buyer.page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(buyer.page.getByText("Autenticidad sin verificar").first()).toBeVisible();
  await expect(
    buyer.page.getByText("Revisa: el precio es muy inferior al de productos similares."),
  ).toBeVisible();
  await expect(buyer.page.getByText(/Aún no hemos revisado un comprobante/)).toBeVisible();
  await expect(buyer.page.getByText("El vendedor declara que es original")).toHaveCount(0);

  // Reportar: anónimo para el vendedor, uno por persona.
  await buyer.page.getByRole("button", { name: "Reportar" }).click();
  const dialog = buyer.page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Reportar este producto" })).toBeVisible();
  await dialog.getByLabel("Posible falsificación").check();
  await dialog.getByLabel("Detalles (opcional)").fill("La caja dice réplica.");
  await dialog.getByRole("button", { name: "Enviar reporte" }).click();
  await expect(buyer.page.getByText(/Gracias\. Revisaremos tu reporte/)).toBeVisible();
  await expect(buyer.page.getByText("Reportado")).toBeVisible();

  // El vendedor sube su comprobante desde el Studio: fotos privadas.
  const proofId = await submitProof(seller.page, title, "ticket.png");
  await expect(seller.page.getByText(/«réplica», «AAA»/)).toBeVisible();
  // Nunca le decimos cuántos lo reportaron (podría adivinar quién fue).
  await expect(seller.page.getByText(/\d+ reportes? de compradores/)).toHaveCount(0);

  // Otro producto del mismo vendedor, sin palabras de imitación pero a un precio inverosímil para
  // un original: también pide comprobante, y este sí se puede marcar como revisado.
  const plainTitle = `AirPods Pro 2 ${seller.user.id.slice(-5)}`;
  const plainPath = new URL(await listReplica(seller.page, plainTitle, { activateStore: false }))
    .pathname;
  await submitProof(seller.page, plainTitle, "factura.png");

  // La foto del comprobante no es pública: 404 para quien no es ADMIN.
  const proofPath = `/admin/moderacion/prueba/${proofId}`;
  expect((await buyer.page.request.get(proofPath)).status()).toBe(404);

  // El equipo: cola de moderación con la revisión, el comprobante y el reporte.
  const admin = await newAccount(browser, isMobile);
  expect((await admin.page.goto("/admin/moderacion"))?.status()).toBe(404);
  makeAdmin(admin.user.email);
  try {
    await admin.page.goto("/admin/moderacion");
    await expect(admin.page.getByRole("heading", { name: "Moderación", level: 1 })).toBeVisible();
    const review = admin.page.getByRole("article", { name: `Revisión de ${title}` });
    await expect(review.getByText("Comprobante por revisar")).toBeVisible();
    await expect(review.getByText(/muy por debajo de la referencia aproximada/)).toBeVisible();
    await expect(review.getByRole("img", { name: /Comprobante 1/ })).toBeVisible();
    const proof = await admin.page.request.get(proofPath);
    expect(proof.status()).toBe(200);
    expect(proof.headers()["cache-control"]).toBe("private, no-store");

    const reports = admin.page
      .getByRole("article", { name: "Reportes de producto" })
      .filter({ hasText: title });
    await expect(reports.getByText("Posible falsificación · 1")).toBeVisible();
    await expect(reports.getByText("La caja dice réplica.")).toBeVisible();

    // Con «réplica» en la publicación no se puede marcar como revisado (se contradiría).
    await expect(review.getByRole("button", { name: "Marcar comprobante revisado" })).toHaveCount(
      0,
    );
    await expect(review.getByText(/No se puede marcar como revisado mientras/)).toBeVisible();

    // El otro sí: exige la casilla y las mismas fotos que el equipo tiene en pantalla.
    const plainReview = admin.page.getByRole("article", { name: `Revisión de ${plainTitle}` });
    await expect(plainReview.getByText("Comprobante por revisar")).toBeVisible();
    await plainReview.getByLabel("Revisé el comprobante y corresponde a este producto.").check();
    await plainReview.getByRole("button", { name: "Marcar comprobante revisado" }).click();
    await expect(
      admin.page.getByText("Listo: el producto muestra «Comprobante revisado»."),
    ).toBeVisible();
    await buyer.page.goto(plainPath);
    await expect(buyer.page.getByText("Comprobante revisado por speeaking").first()).toBeVisible();
    await expect(buyer.page.getByText(/No es una certificación ni una garantía/)).toBeVisible();

    await review.getByRole("button", { name: "Ocultar producto" }).click();
    await expect(admin.page.getByText("Listo: se ocultó de todo lo público.")).toBeVisible();

    // Oculto: 404 para quien compra; su dueño y el equipo lo siguen viendo con un aviso.
    // (La página de producto transmite con `loading.tsx`: su 404 es la misma página «no
    // encontrada» con `noindex`, igual que la de un producto que no existe.)
    await buyer.page.goto(productPath);
    await expect(
      buyer.page.getByRole("heading", { name: "No encontramos esta página" }),
    ).toBeVisible();
    await expect(buyer.page.getByRole("heading", { level: 1, name: title })).toHaveCount(0);
    await buyer.page.goto(`/comprar?q=${encodeURIComponent("replica aaa")}`);
    await expect(buyer.page.getByText(title)).toHaveCount(0);

    await seller.page.goto(productPath);
    await expect(seller.page.getByText(/El equipo ocultó este producto/)).toBeVisible();
    await seller.page.goto("/studio/productos");
    await expect(
      seller.page
        .getByRole("listitem")
        .filter({ hasText: title })
        .getByText("Oculto por moderación"),
    ).toBeVisible();

    await admin.page.goto("/admin/moderacion");
    await expect(
      admin.page.getByRole("listitem").filter({ hasText: title }).getByRole("button", {
        name: "Restaurar producto",
      }),
    ).toBeVisible();
  } finally {
    makeAdmin(admin.user.email, "--revoke");
    await Promise.all([seller.context.close(), buyer.context.close(), admin.context.close()]);
  }
});
