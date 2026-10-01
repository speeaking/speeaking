import { type Browser, expect, test } from "@playwright/test";
import { createProduct, registerAndOnboard } from "./helpers";

async function secondUser(browser: Browser, isMobile: boolean) {
  const context = await browser.newContext(
    isMobile ? { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true } : {},
  );
  const page = await context.newPage();
  const user = await registerAndOnboard(page);
  return { context, page, user };
}

// Colaboraciones con creadores (ADR-063): la tienda las activa, otra persona etiqueta su producto
// en una publicación, las visitas que llegan desde ahí se cuentan y la tienda puede quitar la etiqueta.
test("una tienda acepta colaboraciones y otra persona recomienda su producto", async ({
  page,
  browser,
  isMobile,
}) => {
  test.slow();
  await registerAndOnboard(page);
  const title = `Lámpara de colaboración ${Date.now().toString(36)}`;
  const productPath = new URL(await createProduct(page, { title })).pathname;

  // Sin activar, nadie más puede etiquetar el producto: ni desde la ficha ni con la liga directa.
  const creator = await secondUser(browser, isMobile);
  await creator.page.goto(productPath);
  await expect(creator.page.getByRole("heading", { name: title })).toBeVisible();
  await expect(
    creator.page.getByRole("link", { name: "Crear contenido con este producto" }),
  ).toHaveCount(0);
  await creator.page.goto(`/crear/publicacion?producto=${productPath.split("/").pop()}`);
  await expect(creator.page.getByLabel("¿Qué quieres compartir?")).toBeVisible();
  await expect(creator.page.getByRole("group", { name: "Producto etiquetado" })).toHaveCount(0);

  // La tienda activa las colaboraciones.
  await page.goto("/studio/colaboraciones");
  await page.getByLabel(/Aceptar colaboraciones/).check();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("status")).toContainText("ya pueden etiquetar tus productos");

  // La otra persona llega desde la ficha, declara su acuerdo y publica.
  await creator.page.goto(productPath);
  await creator.page.getByRole("link", { name: "Crear contenido con este producto" }).click();
  await expect(creator.page).toHaveURL(/\/crear\/publicacion\?producto=/);
  const tagged = creator.page.getByRole("group", { name: "Producto etiquetado" });
  await expect(tagged).toContainText(title);
  await creator.page.getByLabel("¿Qué quieres compartir?").fill("La puse en mi sala y cambió todo");
  await tagged.getByLabel(/Recibí algo de esta tienda/).check();
  await creator.page.getByRole("button", { name: "Publicar" }).click();
  await expect(creator.page).toHaveURL(/\/p\/[0-9a-f-]{36}$/);
  const postPath = new URL(creator.page.url()).pathname;
  const card = creator.page.getByRole("article").first();
  await expect(card).toContainText("Colaboración con Prueba Automática");
  await expect(card).toContainText("Vendido por Prueba Automática");

  // Alguien más (sin cuenta) abre el producto desde la publicación: cuenta como una visita de esa
  // publicación. (Quien publicó ya había visto la ficha: una persona cuenta una vez por hora.)
  const visitor = await browser.newContext(
    isMobile ? { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true } : {},
  );
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(postPath);
  await visitorPage
    .getByRole("article")
    .first()
    .getByRole("link", { name: /^Ver producto/ })
    .click();
  await expect(visitorPage).toHaveURL(/\/producto\/.+\?from=[0-9a-f-]{36}/);
  await expect(visitorPage.getByRole("heading", { name: title })).toBeVisible();
  await visitor.close();
  await expect(async () => {
    await creator.page.goto("/creadores");
    await expect(creator.page.getByLabel(`Lo que logró tu publicación de ${title}`)).toContainText(
      /Visitas\s*1/,
      { timeout: 2_000 },
    );
  }).toPass({ timeout: 20_000 });

  // La tienda recibe el aviso, ve la publicación con sus números y quita la etiqueta.
  await page.goto("/avisos");
  await expect(page.getByText("etiquetó uno de tus productos en una publicación")).toBeVisible();
  await page.goto("/studio/colaboraciones");
  const collaborations = page.getByRole("region", {
    name: "Publicaciones que etiquetan tus productos",
  });
  await expect(collaborations).toContainText("La puse en mi sala y cambió todo");
  await expect(collaborations.getByLabel(/^Lo que logró la publicación de/)).toContainText(
    /Visitas\s*1/,
  );
  await collaborations.getByRole("button", { name: "Quitar etiqueta" }).click();
  await collaborations.getByRole("button", { name: "Sí, quitar etiqueta" }).click();
  await expect(collaborations).toContainText("Todavía nadie etiqueta tus productos");

  // La publicación sigue, ya sin el producto, y quien publicó recibe un aviso.
  await creator.page.goto(postPath);
  const untagged = creator.page.getByRole("article").first();
  await expect(untagged).toContainText("La puse en mi sala y cambió todo");
  await expect(untagged).not.toContainText("Vendido por");
  await expect(untagged).not.toContainText("Colaboración con");
  await creator.page.goto("/avisos");
  await expect(
    creator.page.getByText("quitó la etiqueta de su producto de tu publicación"),
  ).toBeVisible();
  await creator.context.close();
});

test("la sección de creadores es pública: explica cómo funciona e invita a crear cuenta", async ({
  page,
}) => {
  await page.goto("/creadores");
  await expect(page.getByRole("heading", { name: "Creadores", level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Cómo funciona" })).toContainText(
    "Quien te ve se lo prueba y lo compra",
  );
  await expect(page.getByText(/Estreno todavía no paga ni cobra comisiones/)).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Crear cuenta" })).toBeVisible();
});
