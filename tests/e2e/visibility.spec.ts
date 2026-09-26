import { expect, type Locator, type Page, test } from "@playwright/test";
import { config } from "dotenv";
import { Client } from "pg";
import { completeOnboarding, register, uniqueUser } from "./helpers";

// Impresiones VISIBLES (T5, ADR-037): una pieza del feed cuenta cuando al menos la mitad estuvo en
// pantalla 1 segundo seguido, una vez por persona, publicación y día, y solo si se le sirvió. Se
// revisa en la base lo que quedó registrado para una cuenta de prueba `e2e.int.*`.

config({ quiet: true });

function intUser() {
  const user = uniqueUser();
  const id = user.email.slice("e2e.".length, -"@example.com".length);
  return { ...user, email: `e2e.int.${id}@example.com`, username: `e2e.int.${id}` };
}

async function withDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function userIdOf(email: string) {
  return withDb(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `SELECT "id" FROM "users" WHERE "email" = $1`,
      [email],
    );
    return rows[0]!.id;
  });
}

async function visibleRows(userId: string, postId: string) {
  return withDb(async (client) => {
    const { rows } = await client.query<{ position: number | null; surface: string }>(
      `SELECT "position", "surface"::text AS "surface" FROM "analytics_events"
       WHERE "type" = 'VISIBLE_IMPRESSION' AND "userId" = $1 AND "entityId" = $2`,
      [userId, postId],
    );
    return rows;
  });
}

/** ¿Alguna parte de la pieza está dentro de la ventana? */
async function inViewport(page: Page, card: Locator) {
  const box = await card.boundingBox();
  const viewport = page.viewportSize();
  if (!box || !viewport) return false;
  return box.y < viewport.height && box.y + box.height > 0;
}

async function centerOn(card: Locator) {
  await card.evaluate((element) =>
    element.scrollIntoView({ block: "center", behavior: "instant" }),
  );
}

test("una pieza en pantalla más de 1 s cuenta exactamente una vez; un destello de 200 ms no", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const user = intUser();
  await register(page, user);
  await completeOnboarding(page, user);
  // Con el servidor de desarrollo ocupado, preparar el feed puede tardar más de 15 s.
  await expect(page).toHaveURL("/", { timeout: 60_000 });
  const userId = await userIdOf(user.email);

  // Primera página del feed (10 piezas, servidas al pintar el inicio).
  const cards = page.locator("[data-impression-post]");
  await expect(cards.nth(9)).toBeAttached();
  const flashed = cards.nth(3);
  const target = cards.nth(9);
  const flashedId = (await flashed.getAttribute("data-impression-post"))!;
  const targetId = (await target.getAttribute("data-impression-post"))!;
  const targetPosition = Number(await target.getAttribute("data-impression-position"));
  expect(await inViewport(page, flashed)).toBe(false);
  expect(await inViewport(page, target)).toBe(false);

  // Destello: 200 ms en pantalla y de inmediato a la otra pieza (que se queda 2.5 s).
  await centerOn(flashed);
  await page.waitForTimeout(200);
  await centerOn(target);
  expect(await inViewport(page, flashed)).toBe(false);
  await page.waitForTimeout(2_500);

  // Se manda cada 5 s: aparece exactamente una, con la posición en que se le sirvió.
  await expect
    .poll(async () => (await visibleRows(userId, targetId)).length, { timeout: 20_000 })
    .toBe(1);
  expect(await visibleRows(userId, targetId)).toEqual([
    { position: targetPosition, surface: "FEED" },
  ]);
  expect(await visibleRows(userId, flashedId)).toHaveLength(0);

  // Otra vez en pantalla en la misma vista de la página: no se vuelve a contar.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(300);
  await centerOn(target);
  await page.waitForTimeout(1_500);
  // Al salir de la página se manda lo pendiente (sendBeacon).
  await page.goto("/descubrir");

  // Aunque se reporte de nuevo (otra vista, u otra pestaña), el servidor la cuenta una vez al día.
  const again = await page.request.post("/api/impressions", {
    data: { items: [{ postId: targetId, surface: "FEED", position: targetPosition }] },
  });
  expect(again.status()).toBe(200);
  expect(await again.json()).toEqual({ recorded: 0, duplicates: 1, rejected: 0, failed: 0 });
  expect(await visibleRows(userId, targetId)).toHaveLength(1);
  expect(await visibleRows(userId, flashedId)).toHaveLength(0);
});

test("una pieza que no se le sirvió no cuenta, aunque se reporte", async ({ page }) => {
  const user = intUser();
  await register(page, user);
  await completeOnboarding(page, user);
  // Con el servidor de desarrollo ocupado, preparar el feed puede tardar más de 15 s.
  await expect(page).toHaveURL("/", { timeout: 60_000 });
  const userId = await userIdOf(user.email);

  // Una publicación real que NO se le sirvió a esta cuenta (la más vieja publicada).
  const unserved = await withDb(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `SELECT p."id" FROM "posts" p
       WHERE p."status" = 'PUBLISHED' AND NOT EXISTS (
         SELECT 1 FROM "analytics_events" e
         WHERE e."type" = 'IMPRESSION' AND e."userId" = $1 AND e."entityId" = p."id")
       ORDER BY p."publishedAt" ASC LIMIT 1`,
      [userId],
    );
    return rows[0]!.id;
  });
  const response = await page.request.post("/api/impressions", {
    data: { items: [{ postId: unserved, surface: "FEED", position: 0 }] },
  });
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ recorded: 0, duplicates: 0, rejected: 1, failed: 0 });
  expect(await visibleRows(userId, unserved)).toHaveLength(0);
});
