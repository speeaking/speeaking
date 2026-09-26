import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type * as TrustService from "./service";

/**
 * Moderación y revisión de autenticidad contra la base de desarrollo (`pnpm db:start`): las
 * consultas reales deciden qué es público. Un producto oculto desaparece del feed, la búsqueda,
 * Comprar, «similares», Guardados, los perfiles y su página (salvo para su dueño y el equipo). Usa
 * cuentas `e2e.fix.trust*@example.com` propias y una categoría temporal; borra todo al final.
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
  env: {
    NODE_ENV: "test",
    TRUSTED_PROXY_HOPS: 0,
    AI_PROVIDER: "mock",
    STORAGE_LOCAL_ROOT: ".data",
  },
}));
vi.mock("@/server/providers/storage", () => ({
  getStorage: () => ({ publicUrl: (key: string) => `/media/${key}` }),
}));
// La revisión que `updateProduct` corre después de su transacción es la real, salvo cuando una prueba
// simula que falla (`evaluateProductAuthenticity` nunca lanza: devuelve null).
vi.mock("./service", async (importOriginal) => {
  const real = await importOriginal<typeof TrustService>();
  return { ...real, evaluateProductAuthenticity: vi.fn(real.evaluateProductAuthenticity) };
});

const { db } = await import("@/server/db");
const catalog = await import("@/modules/catalog/queries");
const { productCardsByIds } = await import("@/modules/search/queries");
const { hydratePosts } = await import("@/modules/social/post-queries");
const { getPublicProfile } = await import("@/modules/social/queries");
const { loadCandidates } = await import("@/modules/feed/queries");
const q = await import("./queries");
const { evaluateProductAuthenticity, refreshAuthenticityCheck } = await import("./service");
const { updateProduct } = await import("@/modules/catalog/service");
const { isProofMedia, isProofMediaLinkError, proofMediaIdsAmong } = await import("./proof-media");
const { Prisma } = await import("@/generated/prisma/client");

const tag = randomUUID().slice(0, 8);
const OTHER_STORES = ["store2", "store3", "store4", "store5"];
const emails = ["seller", "rival", "buyer", ...OTHER_STORES].map(
  (who) => `e2e.fix.trust${who}${tag}@example.com`,
);

type Ids = {
  category: { id: string; slug: string };
  seller: string;
  sellerProfile: string;
  sellerUsername: string;
  rival: string;
  rivalProfile: string;
  buyer: string;
  visible: { id: string; slug: string };
  hidden: { id: string; slug: string };
  postVisible: string;
  postHidden: string;
  postPlain: string;
  privateMedia: string;
  attachedMedia: string;
};
let ids: Ids;

async function account(email: string, username: string, seller: boolean) {
  const user = await db.user.create({
    data: {
      name: "Prueba confianza",
      email,
      profile: { create: { username, displayName: username, onboardedAt: new Date() } },
      ...(seller ? { sellerProfile: { create: { displayName: `Tienda ${username}` } } } : {}),
    },
    select: { id: true, sellerProfile: { select: { id: true } } },
  });
  return { id: user.id, sellerProfile: user.sellerProfile?.id ?? "" };
}

function productData(
  sellerId: string,
  categoryId: string,
  title: string,
  extra: Record<string, unknown> = {},
) {
  return {
    sellerId,
    categoryId,
    slug: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${randomUUID().slice(0, 6)}`,
    title,
    description: "Producto de prueba de moderación.",
    priceCents: 500_000,
    stock: 5,
    status: "ACTIVE" as const,
    condition: "NEW" as const,
    city: "Ciudad de México",
    state: "CDMX",
    publishedAt: new Date(),
    ...extra,
  };
}

function media(ownerId: string) {
  return db.media.create({
    data: {
      ownerId,
      storageKey: `images/test/${randomUUID()}.webp`,
      mimeType: "image/webp",
      width: 1,
      height: 1,
      sizeBytes: 1,
    },
    select: { id: true },
  });
}

describe.skipIf(!databaseUrl)("moderación contra PostgreSQL", () => {
  beforeAll(async () => {
    const category = await db.category.create({
      data: { slug: `trust-test-${tag}`, name: `Prueba ${tag}` },
      select: { id: true, slug: true },
    });
    const sellerUsername = `e2e.fix.trustseller${tag}`;
    const seller = await account(emails[0]!, sellerUsername, true);
    const rival = await account(emails[1]!, `e2e.fix.trustrival${tag}`, true);
    const buyer = await account(emails[2]!, `e2e.fix.trustbuyer${tag}`, false);

    const visible = await db.product.create({
      data: productData(seller.sellerProfile, category.id, `Bocina Bose visible ${tag}`),
      select: { id: true, slug: true },
    });
    const hidden = await db.product.create({
      data: productData(seller.sellerProfile, category.id, `Bocina Bose oculta ${tag}`, {
        moderationStatus: "HIDDEN",
        moderatedAt: new Date(),
      }),
      select: { id: true, slug: true },
    });
    // Parecidos para la mediana: un precio por tienda. La tienda rival tiene 3 (cuenta su mediana,
    // $5,000) y otras 4 tiendas uno cada una; oculto, usado y propio no cuentan.
    for (const price of [500_000, 520_000, 480_000]) {
      await db.product.create({
        data: productData(rival.sellerProfile, category.id, `Bose QuietComfort ${tag}`, {
          priceCents: price,
        }),
      });
    }
    for (const [index, price] of [510_000, 490_000, 505_000, 495_000].entries()) {
      const store = await account(
        emails[3 + index]!,
        `e2e.fix.trust${OTHER_STORES[index]}${tag}`,
        true,
      );
      await db.product.create({
        data: productData(store.sellerProfile, category.id, `Bose QC ${index} ${tag}`, {
          priceCents: price,
        }),
      });
    }
    await db.product.create({
      data: productData(rival.sellerProfile, category.id, `Bose QC oculto ${tag}`, {
        priceCents: 10,
        moderationStatus: "HIDDEN",
      }),
    });
    await db.product.create({
      data: productData(rival.sellerProfile, category.id, `Bose QC usado ${tag}`, {
        priceCents: 20,
        condition: "USED_GOOD",
      }),
    });

    const post = (productId: string | null, body: string) =>
      db.post.create({
        data: { authorId: seller.id, body, productId, type: productId ? "PRODUCT" : "POST" },
        select: { id: true },
      });
    const postVisible = await post(visible.id, `Visible ${tag}`);
    const postHidden = await post(hidden.id, `Oculta ${tag}`);
    const postPlain = await post(null, `Sin producto ${tag}`);

    const privateMedia = await media(seller.id);
    const attachedMedia = await media(seller.id);
    await db.productMedia.create({ data: { productId: visible.id, mediaId: attachedMedia.id } });

    ids = {
      category,
      seller: seller.id,
      sellerProfile: seller.sellerProfile,
      sellerUsername,
      rival: rival.id,
      rivalProfile: rival.sellerProfile,
      buyer: buyer.id,
      visible,
      hidden,
      postVisible: postVisible.id,
      postHidden: postHidden.id,
      postPlain: postPlain.id,
      privateMedia: privateMedia.id,
      attachedMedia: attachedMedia.id,
    };
  });

  afterAll(async () => {
    if (ids) {
      const products = await db.product.findMany({
        where: { categoryId: ids.category.id },
        select: { id: true },
      });
      const targets = [
        ...products.map((product) => product.id),
        ids.postVisible,
        ids.postHidden,
        ids.postPlain,
      ];
      await db.report.deleteMany({ where: { targetId: { in: targets } } });
      await db.platformDecision.deleteMany({ where: { approvedById: ids.seller } });
    }
    await db.user.deleteMany({ where: { email: { in: emails } } });
    if (ids) await db.category.deleteMany({ where: { id: ids.category.id } });
    await db.$disconnect();
  });

  it("Comprar y «similares» no muestran ocultos", async () => {
    const shop = await catalog.listShopProducts({ categorySlug: ids.category.slug, limit: 50 });
    expect(shop.map((p) => p.id)).toContain(ids.visible.id);
    expect(shop.map((p) => p.id)).not.toContain(ids.hidden.id);
    expect(shop.some((p) => p.title.includes("oculto"))).toBe(false);

    const related = await catalog.listRelatedProducts(ids.category.id, ids.visible.id, 50);
    expect(related.map((p) => p.id)).not.toContain(ids.hidden.id);
  });

  it("la página de un oculto es 404 salvo para su dueño y el equipo", async () => {
    await expect(catalog.getPublicProduct(ids.hidden.slug)).resolves.toBeNull();
    await expect(
      catalog.getPublicProduct(ids.hidden.slug, { viewerUserId: ids.buyer, isAdmin: false }),
    ).resolves.toBeNull();
    const asOwner = await catalog.getPublicProduct(ids.hidden.slug, {
      viewerUserId: ids.seller,
      isAdmin: false,
    });
    expect(asOwner?.moderation.hidden).toBe(true);
    const asAdmin = await catalog.getPublicProduct(ids.hidden.slug, {
      viewerUserId: ids.buyer,
      isAdmin: true,
    });
    expect(asAdmin?.product.id).toBe(ids.hidden.id);
    // El DTO público nunca trae el estado interno de la revisión.
    expect(JSON.stringify(asAdmin?.product)).not.toMatch(/moderationStatus|signals|score/);
  });

  it("búsqueda y Guardados (tarjetas por id) no muestran ocultos", async () => {
    const cards = await productCardsByIds([ids.visible.id, ids.hidden.id], ["ACTIVE"]);
    expect(cards.map((card) => card.id)).toEqual([ids.visible.id]);
  });

  it("las publicaciones de un producto oculto desaparecen del feed, perfiles y su página", async () => {
    const posts = await hydratePosts([ids.postVisible, ids.postHidden, ids.postPlain], null);
    expect(posts.map((post) => post.id)).toEqual([ids.postVisible, ids.postPlain]);

    const candidates = await loadCandidates(new Date(Date.now() + 1000), {
      authorIds: [ids.seller],
    });
    const candidateIds = candidates.map((candidate) => candidate.id);
    expect(candidateIds).toContain(ids.postVisible);
    expect(candidateIds).toContain(ids.postPlain);
    expect(candidateIds).not.toContain(ids.postHidden);

    const profile = await getPublicProfile(ids.sellerUsername, null);
    expect(profile?.postCount).toBe(2);
  });

  it("productos parecidos: un precio por tienda (otras), misma marca y categoría, visibles, misma condición", async () => {
    const prices = await q.withProductTrustLock(ids.visible.id, (tx) =>
      q.loadComparablePrices(tx, {
        productId: ids.visible.id,
        categoryId: ids.category.id,
        sellerId: ids.sellerProfile,
        currency: "MXN",
        condition: "NEW",
        aliases: ["bose"],
      }),
    );
    expect([...prices].sort()).toEqual([490_000, 495_000, 500_000, 505_000, 510_000]);
  });

  it("reportes: uno por persona y objetivo; se cuentan personas distintas", async () => {
    const report = (reporterId: string, targetType: "PRODUCT" | "POST", targetId: string) =>
      q.insertReport({
        reporterId,
        targetType,
        targetId,
        reason: "COUNTERFEIT",
        details: undefined,
      });

    await expect(report(ids.buyer, "PRODUCT", ids.visible.id)).resolves.toBe(true);
    await expect(report(ids.buyer, "PRODUCT", ids.visible.id)).resolves.toBe(false);
    // La misma persona sobre la publicación del producto cuenta una sola vez.
    await expect(report(ids.buyer, "POST", ids.postVisible)).resolves.toBe(true);
    await expect(report(ids.rival, "PRODUCT", ids.visible.id)).resolves.toBe(true);
    const count = () =>
      q.withProductTrustLock(ids.visible.id, (tx) =>
        q.countCounterfeitReporters(tx, ids.visible.id),
      );
    await expect(count()).resolves.toBe(2);

    await db.report.updateMany({
      where: { reporterId: ids.rival, targetId: ids.visible.id },
      data: { status: "DISMISSED" },
    });
    await expect(count()).resolves.toBe(1);
  });

  it("fotos de comprobante: solo propias y sin adjuntar (siguen privadas)", async () => {
    await expect(q.countPrivateReadyMedia(ids.seller, [ids.privateMedia])).resolves.toBe(1);
    await expect(q.countPrivateReadyMedia(ids.seller, [ids.attachedMedia])).resolves.toBe(0);
    await expect(q.countPrivateReadyMedia(ids.buyer, [ids.privateMedia])).resolves.toBe(0);
  });

  it("de punta a punta: riesgo alto, prueba enviada y la foto solo es de un comprobante", async () => {
    const product = await db.product.create({
      data: productData(
        ids.sellerProfile,
        ids.category.id,
        `Bose QuietComfort réplica AAA ${tag}`,
        {
          priceCents: 50_000,
          authenticity: "DECLARED_ORIGINAL",
        },
      ),
      select: { id: true },
    });
    const outcome = await refreshAuthenticityCheck(product.id);
    expect(outcome).toMatchObject({ status: "NEEDS_PROOF", level: "HIGH" });
    const check = await db.authenticityCheck.findUniqueOrThrow({
      where: { productId: product.id },
      select: { signals: true, rulesVersion: true },
    });
    expect(check.rulesVersion).toBe("v2");
    expect((check.signals as { rule: string }[]).map((signal) => signal.rule)).toEqual([
      "price_below_comparables",
      "counterfeit_terms",
      "original_claim_conflict",
    ]);

    await expect(q.findProofMedia(ids.privateMedia)).resolves.toBeNull();
    const saved = await q.withProductTrustLock(product.id, (tx) =>
      q.saveProof(tx, product.id, [ids.privateMedia], new Date()),
    );
    expect(saved.count).toBe(1);
    await expect(q.findProofMedia(ids.privateMedia)).resolves.toMatchObject({ status: "READY" });
    // Reevaluar no borra la prueba: queda «en revisión».
    await expect(refreshAuthenticityCheck(product.id)).resolves.toMatchObject({
      status: "PROOF_SUBMITTED",
    });
  });

  it("reemplazar el comprobante deja el anterior en la bitácora, igual de protegido", async () => {
    const product = await db.product.create({
      data: productData(ids.sellerProfile, ids.category.id, `Sony XM5 réplica AAA ${tag}`, {
        priceCents: 60_000,
        authenticity: "DECLARED_ORIGINAL",
      }),
      select: { id: true },
    });
    await expect(refreshAuthenticityCheck(product.id)).resolves.toMatchObject({
      status: "NEEDS_PROOF",
    });
    const first = await media(ids.seller);
    const second = await media(ids.seller);
    const firstAt = new Date(Date.now() - 60_000);
    const secondAt = new Date();
    const submit = (mediaIds: string[], now: Date) =>
      q.withProductTrustLock(product.id, async (tx) => {
        expect(await q.lockPrivateReadyMedia(tx, ids.seller, mediaIds)).toBe(mediaIds.length);
        return q.saveProof(tx, product.id, mediaIds, now);
      });

    await expect(submit([first.id], firstAt)).resolves.toEqual({ count: 1 });
    await expect(submit([second.id], secondAt)).resolves.toEqual({ count: 1 });

    const check = await db.authenticityCheck.findUniqueOrThrow({
      where: { productId: product.id },
      select: { proofMediaIds: true, status: true },
    });
    expect(check).toEqual({ proofMediaIds: [second.id], status: "PROOF_SUBMITTED" });
    const history = await db.authenticityProofHistory.findMany({
      where: { productId: product.id },
      orderBy: { submittedAt: "asc" },
      select: { mediaId: true, submittedAt: true, replacedAt: true },
    });
    expect(history).toEqual([
      { mediaId: first.id, submittedAt: firstAt, replacedAt: secondAt },
      { mediaId: second.id, submittedAt: secondAt, replacedAt: null },
    ]);

    // La foto reemplazada sigue siendo un comprobante: el equipo la ve (auditoría), no se puede
    // volver a mandar como «privada sin adjuntar»… ni adjuntar a nada.
    await expect(isProofMedia(db, first.id)).resolves.toBe(true);
    await expect(q.findProofMedia(first.id)).resolves.toMatchObject({ status: "READY" });
    await expect(proofMediaIdsAmong(db, [first.id, second.id, ids.attachedMedia])).resolves.toEqual(
      new Set([first.id, second.id]),
    );
    await expect(
      db.productMedia.create({ data: { productId: ids.visible.id, mediaId: first.id } }),
    ).rejects.toThrow(/proof_media_link/);
    // El error REAL del trigger (no un simulado) es el que reconocen `social/actions.ts` y
    // `catalog/service.ts` para responder «foto inválida» en lugar de un 500.
    const real = await db.productMedia
      .createMany({ data: [{ productId: ids.visible.id, mediaId: second.id }] })
      .then(
        () => null,
        (error: unknown) => error,
      );
    expect(isProofMediaLinkError(real)).toBe(true);
  });

  it("comprobante y adjunto a la vez: quien llega segundo espera el candado y se rechaza", async () => {
    const product = await db.product.create({
      data: productData(ids.sellerProfile, ids.category.id, `JBL Flip réplica AAA ${tag}`, {
        priceCents: 30_000,
        authenticity: "DECLARED_ORIGINAL",
      }),
      select: { id: true },
    });
    await refreshAuthenticityCheck(product.id);
    const gate = () => {
      let open!: () => void;
      const opened = new Promise<void>((resolve) => (open = resolve));
      return { open, opened };
    };

    // 1) Se está adjuntando a una publicación (sin confirmar): el comprobante espera y lo ve.
    const photo = await media(ids.seller);
    const inserted = gate();
    const commit = gate();
    const attaching = db.$transaction(
      async (tx) => {
        await tx.post.create({
          data: {
            authorId: ids.seller,
            body: `Con foto ${tag}`,
            media: { create: [{ mediaId: photo.id }] },
          },
        });
        inserted.open();
        await commit.opened;
      },
      { timeout: 20_000 },
    );
    await inserted.opened;
    const proving = q.withProductTrustLock(product.id, (tx) =>
      q.lockPrivateReadyMedia(tx, ids.seller, [photo.id]),
    );
    await new Promise((resolve) => setTimeout(resolve, 200));
    commit.open();
    await attaching;
    await expect(proving).resolves.toBe(0);

    // 2) Se está guardando como comprobante (bloqueada, sin confirmar): el adjunto espera y el
    // trigger ya ve el comprobante.
    const proof = await media(ids.seller);
    const locked = gate();
    const release = gate();
    const saving = q.withProductTrustLock(product.id, async (tx) => {
      expect(await q.lockPrivateReadyMedia(tx, ids.seller, [proof.id])).toBe(1);
      locked.open();
      await release.opened;
      return q.saveProof(tx, product.id, [proof.id], new Date());
    });
    await locked.opened;
    const attachingProof = db.post.create({
      data: {
        authorId: ids.seller,
        body: `Con ticket ${tag}`,
        media: { create: [{ mediaId: proof.id }] },
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
    release.open();
    await expect(saving).resolves.toEqual({ count: 1 });
    await expect(attachingProof).rejects.toThrow(/proof_media_link/);
    await expect(db.postMedia.count({ where: { mediaId: proof.id } })).resolves.toBe(0);
  });

  it("editar QUÉ se vende quita el «Comprobante revisado» aunque la revisión de después falle", async () => {
    const photo = await media(ids.seller);
    const product = await db.product.create({
      data: productData(ids.sellerProfile, ids.category.id, `Bocina Bose revisada ${tag}`, {
        authenticity: "DECLARED_ORIGINAL",
        tags: ["bose"],
        media: { create: [{ mediaId: photo.id }] },
      }),
      select: { id: true, title: true },
    });
    await db.authenticityCheck.create({
      data: {
        productId: product.id,
        riskLevel: "LOW",
        score: 0,
        signals: [],
        status: "VERIFIED_BY_ADMIN",
        reviewedAt: new Date(),
      },
    });
    const input = {
      title: product.title,
      description: "Producto de prueba de moderación.",
      priceCents: 500_000,
      unitCostCents: 300_000,
      stock: 5,
      categoryId: ids.category.id,
      condition: "NEW" as const,
      tags: ["bose"],
      city: "Ciudad de México",
      state: "CDMX",
      pickupAvailable: true,
      localDeliveryAvailable: false,
      localDeliveryZones: [],
      nationalShippingAvailable: false,
      shippingPriceCents: null,
      deliveryMinDays: null,
      deliveryMaxDays: null,
      warrantyType: "NONE" as const,
      warrantyDays: null,
      returnWindowDays: 0,
      authenticity: "DECLARED_ORIGINAL" as const,
      mediaIds: [photo.id],
      publishToFeed: false,
      communitySlug: undefined,
      postBody: undefined,
    };
    const statusOf = async () =>
      (
        await db.authenticityCheck.findUniqueOrThrow({
          where: { productId: product.id },
          select: { status: true },
        })
      ).status;

    // Mismo artículo (solo cambia la descripción): el sello se conserva.
    vi.mocked(evaluateProductAuthenticity).mockResolvedValueOnce(null);
    await updateProduct(ids.seller, product.id, { ...input, description: "Otra descripción." });
    await expect(statusOf()).resolves.toBe("VERIFIED_BY_ADMIN");

    // Otro artículo y la revisión de después «falla»: la ficha ya no dice «Comprobante revisado».
    vi.mocked(evaluateProductAuthenticity).mockResolvedValueOnce(null);
    await updateProduct(ids.seller, product.id, { ...input, title: `Bocina JBL otra ${tag}` });
    await expect(statusOf()).resolves.toBe("AUTO_CLEAR");
    const page = await catalog.getPublicProduct(
      (await db.product.findUniqueOrThrow({ where: { id: product.id }, select: { slug: true } }))
        .slug,
    );
    expect(page?.product.authenticityReview.claim).toBe("declared");
  });

  it("«¿es un comprobante?» usa el índice GIN (y la bitácora, su índice por foto)", async () => {
    const plans = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL enable_seqscan = off`;
      const explain = async (query: ReturnType<typeof Prisma.sql>) =>
        (await tx.$queryRaw<{ "QUERY PLAN": string }[]>(query))
          .map((row) => row["QUERY PLAN"])
          .join(" | ");
      return {
        // `@>`: el recolector y el trigger; `&&`: `proofMediaIdsAmong` (Prisma `hasSome`, `/media`).
        current: await explain(
          Prisma.sql`EXPLAIN SELECT 1 FROM "authenticity_checks" WHERE "proofMediaIds" @> ARRAY[${ids.privateMedia}::uuid]`,
        ),
        overlap: await explain(
          Prisma.sql`EXPLAIN SELECT 1 FROM "authenticity_checks" WHERE "proofMediaIds" && ARRAY[${ids.privateMedia}::uuid]`,
        ),
        past: await explain(
          Prisma.sql`EXPLAIN SELECT 1 FROM "authenticity_proof_history" WHERE "mediaId" = ${ids.privateMedia}::uuid`,
        ),
      };
    });
    expect(plans.current).toContain("authenticity_checks_proofMediaIds_idx");
    expect(plans.overlap).toContain("authenticity_checks_proofMediaIds_idx");
    expect(plans.past).toContain("authenticity_proof_history_mediaId_idx");
  });
});
