import { expect, test } from "@playwright/test";
import { registerAndOnboard, TINY_PNG } from "./helpers";

// Visor de la capa (ADR-064): al abrir una publicación con fotos desde un mosaico, en escritorio la
// foto queda a la izquierda, ajustada a la ventana, y los comentarios a la derecha; en teléfono va
// apilada. En la capa no hay «Más de…» (el feed ya está detrás).
test("abrir una foto del mosaico muestra el visor, sin un feed debajo", async ({
  page,
  isMobile,
}) => {
  test.slow();
  await registerAndOnboard(page);
  await page.goto("/crear/publicacion");
  await page.getByLabel("¿Qué quieres compartir?").fill("Dos fotos del mercado de hoy");
  await page.getByLabel("Elegir imágenes").setInputFiles([
    { name: "uno.png", mimeType: "image/png", buffer: TINY_PNG },
    { name: "dos.png", mimeType: "image/png", buffer: TINY_PNG },
  ]);
  await expect(page.locator('input[name="mediaIds"]')).toHaveCount(2);
  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}$/);

  // Desde el perfil, la segunda foto del mosaico abre la publicación en capa, en esa foto.
  await page.goto("/perfil");
  const card = page.getByRole("article").filter({ hasText: "Dos fotos del mercado de hoy" });
  await card.locator('a[href*="?foto=2"]').click();
  await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}\?foto=2$/);
  const layer = page.getByRole("dialog", { name: "Publicación" });
  const post = layer.getByRole("article");
  await expect(post).toHaveAttribute("data-layout", "theater");
  const stage = post.locator('[data-slot="post-stage"]');
  await expect(stage.getByRole("region", { name: /^Fotos de la publicación/ })).toBeVisible();
  await expect(stage.getByText("Foto 2 de 2")).toBeAttached();
  const comments = post.getByRole("region", { name: "Comentarios" });
  await expect(comments).toBeVisible();
  // En la capa no hay más publicaciones: solo esta.
  await expect(layer.getByRole("article")).toHaveCount(1);
  await expect(layer.getByText(/^Más de /)).toHaveCount(0);

  const stageBox = (await stage.boundingBox())!;
  const commentsBox = (await comments.boundingBox())!;
  const viewport = page.viewportSize()!;
  if (isMobile) {
    // Apilado: los comentarios van debajo de la foto.
    expect(commentsBox.y).toBeGreaterThan(stageBox.y + stageBox.height - 1);
  } else {
    // Lado a lado, y la foto completa cabe en la ventana sin desplazarse.
    expect(commentsBox.x).toBeGreaterThanOrEqual(stageBox.x + stageBox.width - 1);
    expect(stageBox.y).toBeGreaterThanOrEqual(0);
    expect(stageBox.y + stageBox.height).toBeLessThanOrEqual(viewport.height);
  }

  // Se puede comentar desde el visor.
  await layer.getByLabel("Escribe un comentario").fill("¡Qué buenas fotos!");
  await layer.getByRole("button", { name: "Comentar" }).click();
  await expect(comments.getByText("¡Qué buenas fotos!")).toBeVisible();
});
