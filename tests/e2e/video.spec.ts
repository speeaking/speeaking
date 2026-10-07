import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { registerAndOnboard, TINY_PNG, waitForHydration } from "./helpers";

// Videos cortos (ADR-062). En las pruebas el almacenamiento es el disco: el navegador sube el
// archivo a la ruta local de desarrollo (en producción, directo a R2 con una URL firmada).
const VIDEO = readFileSync("tests/fixtures/video/video-corto.mp4");

/**
 * «Video» en «Añadir a tu publicación» (cf289a4: un botón que se queda presionado, ya no un radio).
 * Un clic antes de que React tome el botón no cambia nada: se espera a que la página cargue.
 */
async function chooseVideoMode(page: Page) {
  const video = page
    .getByRole("group", { name: "Añadir a tu publicación" })
    .getByRole("button", { name: "Video" });
  await waitForHydration(video);
  await video.click();
  await expect(video).toHaveAttribute("aria-pressed", "true");
}

test("publicar un video corto: se sube, el servidor lo revisa y se reproduce en su publicación", async ({
  page,
}) => {
  test.slow();
  await registerAndOnboard(page);
  await page.goto("/crear/publicacion");
  await chooseVideoMode(page);
  await page
    .getByLabel("Elegir video")
    .setInputFiles({ name: "video-corto.mp4", mimeType: "video/mp4", buffer: VIDEO });
  await expect(page.getByText("Video listo para publicar.")).toBeAttached();
  await expect(page.getByText("0:02")).toBeVisible();

  await page.getByLabel("¿Qué quieres compartir?").fill("Mi primer video en speeaking");
  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}$/);

  const video = page.locator("article video").first();
  await expect(video).toHaveAttribute("src", /^\/media\/videos\/.+\.mp4$/);
  await expect(video).toHaveAttribute("controls", "");
  // El navegador lo lee de verdad: su duración sale del archivo servido por `/media`.
  await expect
    .poll(() => video.evaluate((element) => (element as HTMLVideoElement).duration))
    .toBeCloseTo(2, 0);

  // Ya publicado se sirve por rangos (Safari no reproduce sin ellos) y su portada es pública.
  const src = (await video.getAttribute("src"))!;
  const partial = await page.request.get(src, { headers: { Range: "bytes=0-99" } });
  expect(partial.status()).toBe(206);
  expect(partial.headers()["content-range"]).toBe(`bytes 0-99/${VIDEO.byteLength}`);
  const poster = (await video.getAttribute("poster"))!;
  expect(poster).toMatch(/^\/media\/images\/.+\?w=828$/);
  expect((await page.request.get(poster)).status()).toBe(200);
});

test("lo que no es un video se rechaza al revisarlo, con un motivo claro", async ({ page }) => {
  await registerAndOnboard(page);
  await page.goto("/crear/publicacion");
  await chooseVideoMode(page);
  // Una foto con nombre y tipo de video: el navegador no la abre y el servidor la revisa.
  await page
    .getByLabel("Elegir video")
    .setInputFiles({ name: "falso.mp4", mimeType: "video/mp4", buffer: TINY_PNG });

  await expect(page.locator("form").getByRole("alert")).toHaveText(
    "Ese archivo no es un video MP4 o MOV.",
  );
  await expect(page.getByRole("button", { name: "Elegir otro video" })).toBeVisible();
});
