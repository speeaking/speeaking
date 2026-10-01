import { expect, test } from "@playwright/test";
import { registerAndOnboard } from "./helpers";

// «Contexto» (ADR-060): una publicación larga ofrece un resumen corto, hecho una sola vez y guardado.
test("una publicación larga ofrece «Contexto»: un resumen corto con su nota de IA", async ({
  page,
}) => {
  test.slow();
  await registerAndOnboard(page);
  const long =
    "Les cuento lo que pasó en la junta vecinal de anoche. ".repeat(9) +
    "Al final se acordó pedir pipas de agua para el fin de semana y volver a juntarnos el jueves.";
  await page.goto("/crear/publicacion");
  await page.getByLabel("¿Qué quieres compartir?").fill(long);
  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}$/);

  const card = page.getByRole("article").first();
  const button = card.getByRole("button", { name: "Contexto" });
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await button.click();
  const panel = card.getByRole("region", { name: "Contexto" });
  // Las pruebas corren con la IA simulada: el resumen sale de las primeras oraciones y se marca.
  await expect(panel).toContainText("Les cuento lo que pasó en la junta vecinal de anoche.");
  await expect(panel).toContainText("Texto de ejemplo (IA simulada)");

  // Ya guardado, una segunda visita lo muestra igual (sin volver a generarlo).
  await page.reload();
  await page.getByRole("article").first().getByRole("button", { name: "Contexto" }).click();
  await expect(
    page.getByRole("article").first().getByRole("region", { name: "Contexto" }),
  ).toContainText("junta vecinal");
});

test("una publicación corta no ofrece «Contexto»", async ({ page }) => {
  await registerAndOnboard(page);
  await page.goto("/crear/publicacion");
  await page
    .getByLabel("¿Qué quieres compartir?")
    .fill("¿Alguien sabe a qué hora abre el mercado?");
  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}$/);

  await expect(
    page.getByRole("article").first().getByRole("button", { name: "Contexto" }),
  ).toHaveCount(0);
});
