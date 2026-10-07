import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Páginas «Comprar en …» (SEO nacional) contra la base de desarrollo (`pnpm db:start`): el estado
 * escrito como sea se suma en su estado canónico y solo cuentan los productos a la venta. Crea una
 * categoría y una cuenta `e2e.fix.places*@example.com` propias y las borra al final.
 */
const { databaseUrl } = await vi.hoisted(async () => {
  const { config } = await import("dotenv");
  const local: Record<string, string | undefined> = {};
  config({ quiet: true, processEnv: local });
  return { databaseUrl: process.env.DATABASE_URL ?? local.DATABASE_URL };
});

vi.mock("@/server/db", async () => {
  const { createPrismaClient } = await import("@/server/db-client");
  return { db: createPrismaClient(databaseUrl ?? "postgresql://localhost:1/sin-base") };
});
vi.mock("@/server/env", () => ({
  env: { NODE_ENV: "test", TRUSTED_PROXY_HOPS: 0, STORAGE_LOCAL_ROOT: ".data" },
}));
vi.mock("@/server/providers/storage", () => ({
  getStorage: () => ({ publicUrl: (key: string) => `/media/${key}` }),
}));

const { db } = await import("@/server/db");
const { categoryPlaceCounts, listPlaceProducts, placeCounts, statePageFor } =
  await import("./queries");
const { sitemapRows } = await import("@/server/seo/sitemaps");

const RUN = randomUUID().slice(0, 8);
const PARENT = `e2e-fix-places-${RUN}`;
const CHILD = `${PARENT}-hija`;
const ids = { user: "", seller: "", parent: "", child: "" };
const slugs = { forSale: [] as string[], paused: "", soldOut: "" };

async function product(
  state: string,
  options: { status?: "ACTIVE" | "PAUSED"; stock?: number } = {},
) {
  const slug = `${PARENT}-${randomUUID().slice(0, 8)}`;
  await db.product.create({
    data: {
      sellerId: ids.seller,
      slug,
      title: `Vela ${state}`,
      description: "Producto de prueba",
      priceCents: 11_000,
      stock: options.stock ?? 5,
      status: options.status ?? "ACTIVE",
      publishedAt: new Date(),
      categoryId: ids.child,
      city: "Ciudad",
      state,
      pickupAvailable: true,
      cost: { create: { unitCostCents: 5_000 } },
    },
  });
  return slug;
}

describe.skipIf(!databaseUrl)("páginas por estado contra PostgreSQL", () => {
  beforeAll(async () => {
    ids.parent = (
      await db.category.create({
        data: { slug: PARENT, name: "Prueba lugares" },
        select: { id: true },
      })
    ).id;
    ids.child = (
      await db.category.create({
        data: { slug: CHILD, name: "Prueba lugares hija", parentId: ids.parent },
        select: { id: true },
      })
    ).id;
    ids.user = (
      await db.user.create({
        data: { name: "Lugares", email: `e2e.fix.places.${RUN}@example.com` },
        select: { id: true },
      })
    ).id;
    ids.seller = (
      await db.sellerProfile.create({
        data: { userId: ids.user, displayName: "Tienda lugares", acceptedPaymentMethods: [] },
        select: { id: true },
      })
    ).id;
    for (const state of [
      "CDMX",
      "CDMX",
      "CDMX",
      "CDMX",
      "Ciudad de México",
      "Ciudad de México",
      "D.F.",
    ]) {
      slugs.forSale.push(await product(state));
    }
    await product("Jalisco");
    await product("Jalisco");
    slugs.paused = await product("CDMX", { status: "PAUSED" });
    slugs.soldOut = await product("CDMX", { stock: 0 });
  });

  afterAll(async () => {
    if (ids.seller) await db.product.deleteMany({ where: { sellerId: ids.seller } });
    if (ids.user) await db.user.deleteMany({ where: { id: ids.user } });
    if (ids.child) await db.category.delete({ where: { id: ids.child } });
    if (ids.parent) await db.category.delete({ where: { id: ids.parent } });
    await db.$disconnect();
  });

  it("cuenta por estado canónico, sumando las variantes y solo lo que está a la venta", async () => {
    const places = await placeCounts(PARENT);

    expect(places.get("ciudad-de-mexico")?.count).toBe(7);
    expect(places.get("ciudad-de-mexico")?.values.sort()).toEqual(
      ["CDMX", "Ciudad de México", "D.F."].sort(),
    );
    expect(places.get("jalisco")?.count).toBe(2);
  });

  it("lista los productos del estado en la categoría (y su padre), sin pausados ni agotados", async () => {
    const page = await listPlaceProducts({ stateSlug: "ciudad-de-mexico", categorySlug: PARENT });

    expect(page?.place.state.name).toBe("Ciudad de México");
    expect(page?.products.map((item) => item.slug).sort()).toEqual([...slugs.forSale].sort());
    expect(await listPlaceProducts({ stateSlug: "no-existe", categorySlug: PARENT })).toBeNull();
  });

  it("para el sitemap: categoría/estado en la categoría y en su padre", async () => {
    const counts = await categoryPlaceCounts();

    expect(counts.get(`${CHILD}/ciudad-de-mexico`)).toBe(7);
    expect(counts.get(`${PARENT}/ciudad-de-mexico`)).toBe(7);
    expect(counts.get(`${PARENT}/jalisco`)).toBe(2);
  });

  it("el sitemap lista solo los lugares con al menos 6 productos (sin páginas vacías)", async () => {
    const urls = (await sitemapRows("places", 0)).map((row) => row.url);

    expect(urls).toContain(`https://www.speeaking.com/comprar/${PARENT}/en/ciudad-de-mexico`);
    expect(urls).toContain(`https://www.speeaking.com/comprar/${CHILD}/en/ciudad-de-mexico`);
    expect(urls).toContain("https://www.speeaking.com/comprar/en/ciudad-de-mexico");
    // Jalisco tiene 2 en esta categoría: no hay página.
    expect(urls).not.toContain(`https://www.speeaking.com/comprar/${PARENT}/en/jalisco`);
  });

  it("la ficha enlaza «Más productos de …» solo si el estado ya tiene página", async () => {
    // Las cuentas de toda la base: CDMX llega a 6 aunque haya otros productos de prueba.
    expect((await statePageFor("D.F."))?.slug).toBe("ciudad-de-mexico");
    expect(await statePageFor("Narnia")).toBeNull();
  });
});
