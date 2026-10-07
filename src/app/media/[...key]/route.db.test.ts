import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { afterAll, describe, expect, it, vi } from "vitest";

/**
 * `/media` contra la base de desarrollo (`pnpm db:start`): la consulta real decide qué es público
 * (SEC-14). Una foto solo en una publicación oculta o retirada deja de ser pública.
 */
const { databaseUrl } = await vi.hoisted(async () => {
  const { config } = await import("dotenv");
  const local: Record<string, string | undefined> = {};
  config({ quiet: true, processEnv: local });
  return { databaseUrl: process.env.DATABASE_URL ?? local.DATABASE_URL };
});

const getSession = vi.hoisted(() => vi.fn());
vi.mock("@/modules/identity/session", () => ({ getSession }));
vi.mock("@/server/db", async () => {
  const { createPrismaClient } = await import("@/server/db-client");
  return { db: createPrismaClient(databaseUrl ?? "postgresql://localhost:1/sin-base") };
});
/** Originales: una foto real de 1200×900 para cualquier clave; variantes: en memoria. */
const storage = vi.hoisted(() => ({
  original: Buffer.alloc(0),
  variants: new Map<string, Buffer>(),
}));
vi.mock("@/server/providers/storage", () => ({
  getStorage: () => ({
    get: async (key: string) => {
      const data = key.startsWith("variants/") ? storage.variants.get(key) : storage.original;
      return data ? { data, contentType: "image/webp" } : null;
    },
    put: async (key: string, data: Buffer) => void storage.variants.set(key, data),
  }),
}));

const { db } = await import("@/server/db");
const { GET } = await import("./route");
const { variantKey } = await import("@/modules/media/variant-keys");

storage.original = await sharp({
  create: { width: 1200, height: 900, channels: 3, background: "#ca2352" },
})
  .webp()
  .toBuffer();

/** Solo producto visible, avatar o portada pública (SEC-14). */
const PUBLIC_CACHE = "public, max-age=300, must-revalidate";
/** Lo privado y todo lo que está en una publicación: su audiencia puede cambiar. */
const PRIVATE_CACHE = "private, no-store";

function request(key: string, search = "") {
  return GET(new Request(`http://localhost/media/${key}${search}`), {
    params: Promise.resolve({ key: key.split("/") }),
  } as RouteContext<"/media/[...key]">);
}

describe.skipIf(!databaseUrl)("GET /media contra PostgreSQL (SEC-14)", () => {
  const tag = randomUUID().slice(0, 8);
  const email = `e2e.fix.${tag}@example.com`;
  const adminEmail = `e2e.fix.admin${tag}@example.com`;
  const strangerEmail = `e2e.fix.otro${tag}@example.com`;
  let categoryId: string | null = null;

  afterAll(async () => {
    await db.user.deleteMany({ where: { email: { in: [email, adminEmail, strangerEmail] } } });
    if (categoryId) await db.category.deleteMany({ where: { id: categoryId } });
    await db.$disconnect();
  });

  const newMedia = (ownerId: string) =>
    db.media.create({
      data: {
        ownerId,
        storageKey: `images/test/${randomUUID()}.webp`,
        mimeType: "image/webp",
        width: 1200,
        height: 900,
        sizeBytes: 1,
      },
      select: { id: true, storageKey: true },
    });

  it("pública solo mientras la publicación está publicada; oculta, solo para su dueño", async () => {
    const user = await db.user.create({ data: { name: "Prueba", email }, select: { id: true } });
    const media = await db.media.create({
      data: {
        ownerId: user.id,
        storageKey: `images/test/${randomUUID()}.webp`,
        mimeType: "image/webp",
        width: 1,
        height: 1,
        sizeBytes: 1,
      },
      select: { id: true, storageKey: true },
    });
    const post = await db.post.create({
      data: {
        authorId: user.id,
        body: "prueba de /media",
        media: { create: [{ mediaId: media.id }] },
      },
      select: { id: true },
    });
    getSession.mockResolvedValue(null);

    // Pública por omisión (docs/post-audience.md), pero sin caché: la audiencia puede cambiar.
    const published = await request(media.storageKey);
    expect(published.status).toBe(200);
    expect(published.headers.get("Cache-Control")).toBe(PRIVATE_CACHE);

    // «Solo yo»: deja de servirse en la siguiente petición; vuelve al regresar a Público.
    await db.post.update({ where: { id: post.id }, data: { audience: "ONLY_ME" } });
    expect((await request(media.storageKey)).status).toBe(404);
    await db.post.update({ where: { id: post.id }, data: { audience: "PUBLIC" } });
    expect((await request(media.storageKey)).status).toBe(200);

    await db.post.update({ where: { id: post.id }, data: { status: "REMOVED" } });
    expect((await request(media.storageKey)).status).toBe(404);

    getSession.mockResolvedValue({ user: { id: user.id } });
    const asOwner = await request(media.storageKey);
    expect(asOwner.status).toBe(200);
    expect(asOwner.headers.get("Cache-Control")).toBe(PRIVATE_CACHE);
  });

  it("producto oculto: sus fotos (y las de su publicación) solo para su dueño y el equipo", async () => {
    const owner = await db.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
    const seller = await db.sellerProfile.create({
      data: { userId: owner.id, displayName: "Tienda /media" },
      select: { id: true },
    });
    const admin = await db.user.create({
      data: {
        name: "Equipo",
        email: adminEmail,
        profile: {
          create: { username: `e2e.fix.admin${tag}`, displayName: "Equipo", role: "ADMIN" },
        },
      },
      select: { id: true },
    });
    const stranger = await db.user.create({
      data: { name: "Otra persona", email: strangerEmail },
      select: { id: true },
    });
    const category = await db.category.create({
      data: { slug: `media-test-${tag}`, name: "Prueba /media" },
      select: { id: true },
    });
    categoryId = category.id;
    const photo = await newMedia(owner.id);
    // Otra foto de la ficha que no está en la publicación.
    const gallery = await newMedia(owner.id);
    const product = await db.product.create({
      data: {
        sellerId: seller.id,
        categoryId: category.id,
        slug: `media-test-${tag}`,
        title: "Producto de prueba de /media",
        description: "Prueba",
        priceCents: 100_000,
        stock: 1,
        city: "Ciudad de México",
        state: "CDMX",
        media: { create: [{ mediaId: photo.id }, { mediaId: gallery.id, position: 1 }] },
      },
      select: { id: true },
    });
    // La publicación del producto comparte sus fotos (así se crean desde el Studio).
    await db.post.create({
      data: {
        authorId: owner.id,
        type: "PRODUCT",
        body: "¡Nuevo!",
        productId: product.id,
        media: { create: [{ mediaId: photo.id }] },
      },
    });

    getSession.mockResolvedValue(null);
    // También está en la publicación: pública, pero sin caché (la audiencia puede cambiar).
    const visible = await request(photo.storageKey);
    expect(visible.status).toBe(200);
    expect(visible.headers.get("Cache-Control")).toBe(PRIVATE_CACHE);
    // Solo en la ficha: caché pública corta.
    const onlyProduct = await request(gallery.storageKey, "?w=640");
    expect(onlyProduct.status).toBe(200);
    expect(onlyProduct.headers.get("Cache-Control")).toBe(PUBLIC_CACHE);
    // La variante que pide `next/image` queda en la caché de variantes (ADR-039).
    const variant = await request(photo.storageKey, "?w=640");
    expect(variant.status).toBe(200);
    expect(variant.headers.get("Cache-Control")).toBe(PRIVATE_CACHE);
    expect(storage.variants.has(variantKey(photo.storageKey, 640))).toBe(true);
    // La variante guardada no se puede pedir por su propia clave: no tiene fila en `media`.
    expect((await request(variantKey(photo.storageKey, 640))).status).toBe(404);

    await db.product.update({
      where: { id: product.id },
      data: { moderationStatus: "HIDDEN", moderatedAt: new Date() },
    });
    // Oculta: 404 para los demás aunque la variante siga en la caché.
    for (const search of ["", "?w=640"]) {
      getSession.mockResolvedValue(null);
      expect((await request(photo.storageKey, search)).status).toBe(404);
      getSession.mockResolvedValue({ user: { id: stranger.id } });
      expect((await request(photo.storageKey, search)).status).toBe(404);
    }

    getSession.mockResolvedValue({ user: { id: owner.id } });
    const asOwner = await request(photo.storageKey);
    expect(asOwner.status).toBe(200);
    expect(asOwner.headers.get("Cache-Control")).toBe("private, no-store");
    getSession.mockResolvedValue({ user: { id: admin.id } });
    const asAdmin = await request(photo.storageKey, "?w=640");
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.headers.get("Cache-Control")).toBe("private, no-store");

    // Restaurado: vuelve a ser pública.
    await db.product.update({ where: { id: product.id }, data: { moderationStatus: "VISIBLE" } });
    getSession.mockResolvedValue(null);
    expect((await request(photo.storageKey)).status).toBe(200);
  });

  it("comprobante (vigente o reemplazado): nunca público; solo su dueño por aquí", async () => {
    const owner = await db.user.findUniqueOrThrow({
      where: { email },
      select: { id: true, sellerProfile: { select: { id: true } } },
    });
    const admin = await db.user.findUniqueOrThrow({
      where: { email: adminEmail },
      select: { id: true },
    });
    const proof = await newMedia(owner.id);
    const replaced = await newMedia(owner.id);
    // Datos anteriores al trigger: las fotos ya estaban en una publicación publicada cuando se
    // guardaron como comprobante (hoy ese orden lo impide `submitProof` y el contrario, el trigger).
    await db.post.create({
      data: {
        authorId: owner.id,
        body: "mi ticket",
        media: { create: [{ mediaId: proof.id }, { mediaId: replaced.id, position: 1 }] },
      },
    });
    const product = await db.product.create({
      data: {
        sellerId: owner.sellerProfile!.id,
        categoryId: categoryId!,
        slug: `media-proof-${tag}`,
        title: "Producto con comprobante",
        description: "Prueba",
        priceCents: 100_000,
        stock: 1,
        city: "Ciudad de México",
        state: "CDMX",
        authenticity: "DECLARED_ORIGINAL",
        authenticityCheck: {
          create: {
            riskLevel: "HIGH",
            score: 0.7,
            signals: [],
            status: "PROOF_SUBMITTED",
            proofMediaIds: [proof.id],
          },
        },
      },
      select: { id: true },
    });
    // `replaced` fue el primer envío: solo queda en la bitácora.
    const sent = new Date(Date.now() - 60_000);
    await db.authenticityProofHistory.createMany({
      data: [
        { productId: product.id, mediaId: replaced.id, submittedAt: sent, replacedAt: new Date() },
        { productId: product.id, mediaId: proof.id, submittedAt: new Date() },
      ],
    });

    for (const photo of [proof, replaced]) {
      getSession.mockResolvedValue(null);
      expect((await request(photo.storageKey)).status).toBe(404);
      getSession.mockResolvedValue({ user: { id: admin.id } });
      expect((await request(photo.storageKey)).status).toBe(404);
      getSession.mockResolvedValue({ user: { id: owner.id } });
      const asOwner = await request(photo.storageKey);
      expect(asOwner.status).toBe(200);
      expect(asOwner.headers.get("Cache-Control")).toBe("private, no-store");
    }

    // Hoy ya no se pueden adjuntar (trigger `reject_proof_media_link`), ni la vigente ni la anterior.
    for (const photo of [proof, replaced]) {
      await expect(
        db.post.create({
          data: {
            authorId: owner.id,
            body: "otra vez",
            media: { create: [{ mediaId: photo.id }] },
          },
        }),
      ).rejects.toThrow(/proof_media_link/);
      await expect(
        db.productMedia.create({ data: { productId: product.id, mediaId: photo.id } }),
      ).rejects.toThrow(/proof_media_link/);
    }
  });
});
