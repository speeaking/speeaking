import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_REFERENCE_PRICES } from "./reference-prices";

// Las reglas y el estado se prueban puros (rules/status.test); aquí, la orquestación, los permisos
// y lo que se escribe. La base está simulada.
const { q, admin, runner, storage } = vi.hoisted(() => {
  const tx = {};
  return {
    q: {
      tx,
      readReferencePrices: vi.fn(),
      readAiSignalEnabled: vi.fn(),
      withProductTrustLock: vi.fn((_id: string, work: (client: object) => unknown) => work(tx)),
      inTransaction: vi.fn((work: (client: object) => unknown) => work(tx)),
      loadProductForEvaluation: vi.fn(),
      loadComparablePrices: vi.fn(),
      countCompletedSales: vi.fn(),
      countCounterfeitReporters: vi.fn(),
      findCheck: vi.fn(),
      upsertCheck: vi.fn(),
      saveAiSignal: vi.fn(),
      loadProductText: vi.fn(),
      findReportTarget: vi.fn(),
      insertReport: vi.fn(),
      findOwnedProduct: vi.fn(),
      countPrivateReadyMedia: vi.fn(),
      // Por omisión, todas las fotos siguen ahí y quedan bloqueadas.
      lockPrivateReadyMedia: vi.fn(
        async (_tx: object, _owner: string, ids: readonly string[]) => ids.length,
      ),
      saveProof: vi.fn(),
      markOwnedProductGeneric: vi.fn(),
      findSellerCase: vi.fn(),
      listOpenReports: vi.fn(),
      listReviewChecks: vi.fn(),
      listHiddenContent: vi.fn(),
      findMediaByIds: vi.fn(),
      findProductsForQueue: vi.fn(),
      findPostsForQueue: vi.fn(),
      findProfilesForQueue: vi.fn(),
      findCommentsForQueue: vi.fn(),
      findProofMedia: vi.fn(),
      resolveOpenReports: vi.fn(),
      setProductModeration: vi.fn(),
      setPostModeration: vi.fn(),
      setCommentModeration: vi.fn(),
      findCommentState: vi.fn(),
      findCheckForReview: vi.fn(),
      markCheckReviewed: vi.fn(),
      forceGeneric: vi.fn(),
      logModeration: vi.fn(),
      findProductState: vi.fn(),
      findPostState: vi.fn(),
    },
    admin: {
      assertAdmin: vi.fn(),
      AdminAuthorizationError: class AdminAuthorizationError extends Error {},
    },
    runner: { runAuthenticityTask: vi.fn() },
    storage: { get: vi.fn() },
  };
});
vi.mock("./queries", () => q);
vi.mock("@/modules/admin/service", () => admin);
vi.mock("./ai-runner", () => runner);
vi.mock("@/server/providers/storage", () => ({ getStorage: () => storage }));

const {
  applyModerationAction,
  createReport,
  getModerationQueue,
  getProofFileForAdmin,
  getSellerAuthenticityCase,
  refreshAiSignal,
  refreshAuthenticityCheck,
  submitProof,
  TrustError,
} = await import("./service");

const NOW = new Date("2026-09-26T18:00:00Z");
const SELLER = "0199a000-0000-7000-8000-00000000000a";
const BUYER = "0199a000-0000-7000-8000-00000000000c";
const ADMIN = "0199a000-0000-7000-8000-0000000000ad";
const PRODUCT = "0199a000-0000-7000-8000-00000000000b";
const MEDIA = "0199a000-0000-7000-8000-0000000000e1";

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: PRODUCT,
    title: "AirPods Pro réplica AAA",
    description: "Audífonos inalámbricos.",
    tags: [],
    priceCents: 30_000,
    currency: "MXN",
    condition: "NEW",
    authenticity: "DECLARED_ORIGINAL",
    categoryId: "cat",
    sellerId: "seller-profile",
    seller: { createdAt: new Date(NOW.getTime() - 86_400_000), userId: SELLER },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  q.readReferencePrices.mockResolvedValue(DEFAULT_REFERENCE_PRICES);
  q.loadComparablePrices.mockResolvedValue([]);
  q.countCompletedSales.mockResolvedValue(0);
  q.countCounterfeitReporters.mockResolvedValue(0);
  q.findCheck.mockResolvedValue(null);
  q.upsertCheck.mockImplementation((_tx, _id, data: { status: string; riskLevel: string }) =>
    Promise.resolve({ status: data.status, riskLevel: data.riskLevel, score: 1 }),
  );
  admin.assertAdmin.mockResolvedValue(undefined);
});

describe("refreshAuthenticityCheck (alta y edición del catálogo)", () => {
  it("el ejemplo del fundador queda en riesgo alto con comprobante pedido", async () => {
    q.loadProductForEvaluation.mockResolvedValue(product());

    await expect(refreshAuthenticityCheck(PRODUCT, NOW)).resolves.toMatchObject({
      status: "NEEDS_PROOF",
      level: "HIGH",
    });
    expect(q.withProductTrustLock).toHaveBeenCalledWith(PRODUCT, expect.any(Function));
    const [, id, data] = q.upsertCheck.mock.calls[0]!;
    expect(id).toBe(PRODUCT);
    expect(data).toMatchObject({ riskLevel: "HIGH", score: 1, rulesVersion: "v2", aiSignal: null });
    // Compara solo contra la misma marca (Apple) y otras tiendas.
    expect(q.loadComparablePrices).toHaveBeenCalledWith(
      q.tx,
      expect.objectContaining({
        sellerId: "seller-profile",
        aliases: expect.arrayContaining(["airpods"]),
      }),
    );
  });

  it("en simulación calcula el mismo resultado sin guardar nada", async () => {
    q.loadProductForEvaluation.mockResolvedValue(product());

    await expect(refreshAuthenticityCheck(PRODUCT, NOW, { dryRun: true })).resolves.toEqual({
      status: "NEEDS_PROOF",
      level: "HIGH",
      score: 1,
    });
    expect(q.upsertCheck).not.toHaveBeenCalled();
  });

  it("un producto sin señales queda AUTO_CLEAR", async () => {
    q.loadProductForEvaluation.mockResolvedValue(
      product({ title: "Lámpara de escritorio LED", priceCents: 50_000 }),
    );
    await refreshAuthenticityCheck(PRODUCT, NOW);
    expect(q.upsertCheck.mock.calls[0]![2]).toMatchObject({
      status: "AUTO_CLEAR",
      riskLevel: "LOW",
      signals: [],
    });
  });

  it("no reescribe una verificación del equipo si el riesgo no subió", async () => {
    q.loadProductForEvaluation.mockResolvedValue(product());
    q.findCheck.mockResolvedValue({
      status: "VERIFIED_BY_ADMIN",
      riskLevel: "HIGH",
      score: 1,
      proofMediaIds: [MEDIA],
      aiSignal: null,
    });
    await expect(refreshAuthenticityCheck(PRODUCT, NOW)).resolves.toEqual({
      status: "VERIFIED_BY_ADMIN",
      level: "HIGH",
      score: 1,
    });
    expect(q.upsertCheck).not.toHaveBeenCalled();
  });

  it("descarta la señal de la IA si el texto cambió", async () => {
    q.loadProductForEvaluation.mockResolvedValue(product());
    q.findCheck.mockResolvedValue({
      status: "NEEDS_PROOF",
      riskLevel: "HIGH",
      score: 1,
      proofMediaIds: [],
      aiSignal: {
        provider: "mock",
        model: "mock",
        promptVersion: "p",
        fingerprint: "otra-version-del-texto",
        mentionsImitation: true,
        confidence: "high",
        reason: "",
        weight: 0.15,
        requestId: "r",
        at: NOW.toISOString(),
      },
    });
    await refreshAuthenticityCheck(PRODUCT, NOW);
    expect(q.upsertCheck.mock.calls[0]![2]).toMatchObject({ aiSignal: null });
  });

  it("un producto que ya no existe no escribe nada", async () => {
    q.loadProductForEvaluation.mockResolvedValue(null);
    await expect(refreshAuthenticityCheck(PRODUCT, NOW)).resolves.toBeNull();
    expect(q.upsertCheck).not.toHaveBeenCalled();
  });
});

describe("refreshAiSignal (opcional)", () => {
  it("apagada por omisión: no llama a la IA", async () => {
    q.readAiSignalEnabled.mockResolvedValue(false);
    await expect(refreshAiSignal(PRODUCT, NOW)).resolves.toBeNull();
    expect(runner.runAuthenticityTask).not.toHaveBeenCalled();
  });

  it("encendida: solo si las reglas vieron algo y el riesgo no es alto", async () => {
    q.readAiSignalEnabled.mockResolvedValue(true);
    q.loadProductText.mockResolvedValue({
      title: "Lámpara",
      description: "x",
      tags: [],
      authenticityCheck: { riskLevel: "LOW", signals: [], aiSignal: null },
    });
    await refreshAiSignal(PRODUCT, NOW);
    q.loadProductText.mockResolvedValue({
      title: "AirPods",
      description: "x",
      tags: [],
      authenticityCheck: {
        riskLevel: "HIGH",
        signals: [{ rule: "counterfeit_terms", weight: 0.6, message: "m" }],
        aiSignal: null,
      },
    });
    await refreshAiSignal(PRODUCT, NOW);
    expect(runner.runAuthenticityTask).not.toHaveBeenCalled();
  });

  it("guarda la señal con el peso que decide el código y reevalúa", async () => {
    q.readAiSignalEnabled.mockResolvedValue(true);
    q.loadProductText.mockResolvedValue({
      title: "Audífonos tipo AirPods",
      description: "No son originales.",
      tags: [],
      authenticityCheck: {
        riskLevel: "MEDIUM",
        signals: [{ rule: "counterfeit_terms", weight: 0.45, message: "m" }],
        aiSignal: null,
      },
    });
    runner.runAuthenticityTask.mockResolvedValue({
      output: {
        mentionsImitation: true,
        confidence: "high",
        reason: "  Dice que no son originales. ",
      },
      provider: "mock",
      model: "mock",
      promptVersion: "trust-ai-signal@1",
      requestId: "req-1",
    });
    q.loadProductForEvaluation.mockResolvedValue(null);
    await refreshAiSignal(PRODUCT, NOW);
    const [, , signal] = q.saveAiSignal.mock.calls[0]!;
    expect(signal).toMatchObject({
      weight: 0.15,
      reason: "Dice que no son originales.",
      requestId: "req-1",
    });
    expect(q.loadProductForEvaluation).toHaveBeenCalled();
  });
});

describe("createReport", () => {
  it("no se puede reportar lo que no existe o no está visible", async () => {
    q.findReportTarget.mockResolvedValue(null);
    await expect(
      createReport(BUYER, {
        targetType: "PRODUCT",
        targetId: PRODUCT,
        reason: "SPAM",
        details: undefined,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    q.findReportTarget.mockResolvedValue({
      ownerUserId: SELLER,
      visible: false,
      productId: PRODUCT,
    });
    await expect(
      createReport(BUYER, {
        targetType: "PRODUCT",
        targetId: PRODUCT,
        reason: "SPAM",
        details: undefined,
      }),
    ).rejects.toBeInstanceOf(TrustError);
    expect(q.insertReport).not.toHaveBeenCalled();
  });

  it("nadie reporta lo propio", async () => {
    q.findReportTarget.mockResolvedValue({
      ownerUserId: SELLER,
      visible: true,
      productId: PRODUCT,
    });
    await expect(
      createReport(SELLER, {
        targetType: "PRODUCT",
        targetId: PRODUCT,
        reason: "SCAM",
        details: undefined,
      }),
    ).rejects.toMatchObject({ code: "OWN_CONTENT" });
  });

  it("uno por persona y objetivo; «posible falsificación» reevalúa el producto", async () => {
    q.findReportTarget.mockResolvedValue({
      ownerUserId: SELLER,
      visible: true,
      productId: PRODUCT,
    });
    q.insertReport.mockResolvedValue(true);
    q.loadProductForEvaluation.mockResolvedValue(product({ title: "Lámpara", priceCents: 50_000 }));
    await expect(
      createReport(BUYER, {
        targetType: "POST",
        targetId: MEDIA,
        reason: "COUNTERFEIT",
        details: "Se ve distinto al original",
      }),
    ).resolves.toEqual({ alreadyReported: false });
    expect(q.insertReport).toHaveBeenCalledWith({
      reporterId: BUYER,
      targetType: "POST",
      targetId: MEDIA,
      reason: "COUNTERFEIT",
      details: "Se ve distinto al original",
    });
    expect(q.loadProductForEvaluation).toHaveBeenCalledWith(q.tx, PRODUCT);

    vi.clearAllMocks();
    q.findReportTarget.mockResolvedValue({
      ownerUserId: SELLER,
      visible: true,
      productId: PRODUCT,
    });
    q.insertReport.mockResolvedValue(false);
    await expect(
      createReport(BUYER, {
        targetType: "PRODUCT",
        targetId: PRODUCT,
        reason: "COUNTERFEIT",
        details: undefined,
      }),
    ).resolves.toEqual({ alreadyReported: true });
    expect(q.loadProductForEvaluation).not.toHaveBeenCalled();
  });
});

describe("submitProof (prueba privada del vendedor)", () => {
  it("solo el dueño; las fotos deben ser suyas y no estar publicadas", async () => {
    q.findOwnedProduct.mockResolvedValue(null);
    await expect(
      submitProof(BUYER, { productId: PRODUCT, mediaIds: [MEDIA] }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    q.findOwnedProduct.mockResolvedValue({
      id: PRODUCT,
      slug: "airpods",
      authenticity: "DECLARED_ORIGINAL",
    });
    q.countPrivateReadyMedia.mockResolvedValue(0);
    await expect(
      submitProof(SELLER, { productId: PRODUCT, mediaIds: [MEDIA] }),
    ).rejects.toMatchObject({
      code: "INVALID_MEDIA",
    });
    expect(q.countPrivateReadyMedia).toHaveBeenCalledWith(SELLER, [MEDIA]);
    expect(q.saveProof).not.toHaveBeenCalled();
  });

  it("solo si se pidió; queda «en revisión»", async () => {
    q.findOwnedProduct.mockResolvedValue({
      id: PRODUCT,
      slug: "airpods",
      authenticity: "DECLARED_ORIGINAL",
    });
    q.countPrivateReadyMedia.mockResolvedValue(1);
    q.saveProof.mockResolvedValue({ count: 0 });
    await expect(
      submitProof(SELLER, { productId: PRODUCT, mediaIds: [MEDIA] }),
    ).rejects.toMatchObject({
      code: "NOT_REQUESTED",
    });
    q.saveProof.mockResolvedValue({ count: 1 });
    await expect(submitProof(SELLER, { productId: PRODUCT, mediaIds: [MEDIA] })).resolves.toEqual({
      slug: "airpods",
    });
  });

  it("bloquea las fotos al guardarlas; si el recolector ya las borró, se rechaza", async () => {
    q.findOwnedProduct.mockResolvedValue({
      id: PRODUCT,
      slug: "airpods",
      authenticity: "DECLARED_ORIGINAL",
    });
    q.countPrivateReadyMedia.mockResolvedValue(1);
    q.saveProof.mockResolvedValue({ count: 1 });
    q.lockPrivateReadyMedia.mockResolvedValueOnce(0);

    await expect(
      submitProof(SELLER, { productId: PRODUCT, mediaIds: [MEDIA] }),
    ).rejects.toMatchObject({ code: "INVALID_MEDIA" });
    expect(q.lockPrivateReadyMedia).toHaveBeenCalledWith(q.tx, SELLER, [MEDIA]);
    expect(q.saveProof).not.toHaveBeenCalled();

    const now = new Date("2026-09-26T18:00:00Z");
    await expect(
      submitProof(SELLER, { productId: PRODUCT, mediaIds: [MEDIA] }, now),
    ).resolves.toEqual({ slug: "airpods" });
    // La fecha del envío va a la bitácora de comprobantes.
    expect(q.saveProof).toHaveBeenCalledWith(q.tx, PRODUCT, [MEDIA], now);
  });

  it("un genérico no manda comprobante (no demostraría nada y nadie podría revisarlo)", async () => {
    q.findOwnedProduct.mockResolvedValue({ id: PRODUCT, slug: "airpods", authenticity: "GENERIC" });
    q.countPrivateReadyMedia.mockResolvedValue(1);
    q.saveProof.mockResolvedValue({ count: 1 });
    await expect(
      submitProof(SELLER, { productId: PRODUCT, mediaIds: [MEDIA] }),
    ).rejects.toMatchObject({ code: "NOT_REQUESTED" });
    expect(q.saveProof).not.toHaveBeenCalled();
  });

  it("el vendedor no ve cuántos reportes hubo (podría adivinar quién fue)", async () => {
    q.findSellerCase.mockResolvedValue({
      product: {
        id: PRODUCT,
        slug: "a",
        title: "A",
        authenticity: "DECLARED_ORIGINAL",
        hidden: false,
      },
      check: {
        status: "NEEDS_PROOF",
        riskLevel: "HIGH",
        signals: [
          {
            rule: "buyer_reports",
            weight: 0.25,
            message: "2 reportes de compradores por posible falsificación.",
          },
          { rule: "counterfeit_terms", weight: 0.6, message: "Usa «réplica»." },
        ],
        proofs: [],
        reviewNote: null,
        reviewedAt: null,
      },
    });
    const found = await getSellerAuthenticityCase(SELLER, PRODUCT);
    expect(found?.check?.reasons).toEqual([
      "Recibimos reportes de otras personas sobre esta publicación.",
      "Usa «réplica».",
    ]);
    expect(JSON.stringify(found)).not.toMatch(/\d+ reportes/);
  });
});

describe("equipo: autorización y bitácora", () => {
  it("sin rol ADMIN no lee la cola, no actúa y no sirve comprobantes", async () => {
    admin.assertAdmin.mockRejectedValue(new admin.AdminAuthorizationError());
    await expect(getModerationQueue(BUYER, NOW)).rejects.toBeInstanceOf(
      admin.AdminAuthorizationError,
    );
    await expect(
      applyModerationAction(BUYER, {
        action: "hide",
        targetType: "PRODUCT",
        targetId: PRODUCT,
        note: undefined,
      }),
    ).rejects.toBeInstanceOf(admin.AdminAuthorizationError);
    await expect(getProofFileForAdmin(BUYER, MEDIA)).rejects.toBeInstanceOf(
      admin.AdminAuthorizationError,
    );
    expect(q.listOpenReports).not.toHaveBeenCalled();
    expect(q.setProductModeration).not.toHaveBeenCalled();
    expect(q.findProofMedia).not.toHaveBeenCalled();
  });

  it("ocultar un producto: estado, reportes atendidos y bitácora con quién", async () => {
    q.findProductState.mockResolvedValue({
      slug: "airpods",
      title: "AirPods",
      moderationStatus: "VISIBLE",
      authenticity: "DECLARED_ORIGINAL",
    });
    q.setProductModeration.mockResolvedValue({ count: 1 });
    q.resolveOpenReports.mockResolvedValue({ count: 2 });

    const result = await applyModerationAction(
      ADMIN,
      { action: "hide", targetType: "PRODUCT", targetId: PRODUCT, note: "Réplica evidente" },
      NOW,
    );
    expect(admin.assertAdmin).toHaveBeenCalledWith(ADMIN);
    expect(q.setProductModeration).toHaveBeenCalledWith(q.tx, PRODUCT, "HIDDEN", NOW);
    expect(q.resolveOpenReports).toHaveBeenCalledWith(
      q.tx,
      { targetType: "PRODUCT", targetId: PRODUCT },
      "ACTIONED",
      ADMIN,
      NOW,
    );
    expect(q.logModeration).toHaveBeenCalledWith(
      q.tx,
      expect.objectContaining({
        kind: "moderation.hide_product",
        actorUserId: ADMIN,
        reason: "Réplica evidente",
        previousValue: expect.objectContaining({ moderationStatus: "VISIBLE" }),
        newValue: expect.objectContaining({ moderationStatus: "HIDDEN" }),
      }),
    );
    expect(result.paths).toContain("/producto/airpods");
  });

  it("«Comprobante revisado» exige un comprobante enviado y la declaración de original", async () => {
    q.findProductState.mockResolvedValue({
      slug: "airpods",
      title: "AirPods",
      moderationStatus: "VISIBLE",
      authenticity: "DECLARED_ORIGINAL",
    });
    q.findCheckForReview.mockResolvedValue({
      status: "NEEDS_PROOF",
      proofMediaIds: [],
      product: { authenticity: "DECLARED_ORIGINAL", title: "AirPods" },
    });
    await expect(
      applyModerationAction(ADMIN, {
        action: "verify",
        productId: PRODUCT,
        proofIds: [MEDIA],
        confirmed: true,
        note: undefined,
      }),
    ).rejects.toMatchObject({ code: "NOT_ALLOWED" });
    expect(q.markCheckReviewed).not.toHaveBeenCalled();

    q.findCheckForReview.mockResolvedValue({
      status: "PROOF_SUBMITTED",
      proofMediaIds: [MEDIA],
      product: { authenticity: "DECLARED_ORIGINAL", title: "AirPods" },
    });
    // El vendedor reemplazó el comprobante mientras el equipo miraba otro: no procede.
    q.findMediaByIds.mockResolvedValue([{ id: MEDIA }]);
    await expect(
      applyModerationAction(ADMIN, {
        action: "verify",
        productId: PRODUCT,
        proofIds: [SELLER],
        confirmed: true,
        note: undefined,
      }),
    ).rejects.toMatchObject({ code: "NOT_ALLOWED" });
    // Las fotos ya no existen (p. ej. las borró el recolector): no hay nada que revisar.
    q.findMediaByIds.mockResolvedValue([]);
    await expect(
      applyModerationAction(ADMIN, {
        action: "verify",
        productId: PRODUCT,
        proofIds: [MEDIA],
        confirmed: true,
        note: undefined,
      }),
    ).rejects.toMatchObject({ code: "NOT_ALLOWED" });
    expect(q.markCheckReviewed).not.toHaveBeenCalled();

    q.findMediaByIds.mockResolvedValue([{ id: MEDIA }]);
    // «Comprobante revisado» junto a «réplica» se contradice: primero se corrige la publicación.
    q.findCheckForReview.mockResolvedValueOnce({
      status: "PROOF_SUBMITTED",
      proofMediaIds: [MEDIA],
      signals: [{ rule: "counterfeit_terms", weight: 0.6, message: "«réplica»" }],
      product: { authenticity: "DECLARED_ORIGINAL", title: "AirPods réplica" },
    });
    await expect(
      applyModerationAction(ADMIN, {
        action: "verify",
        productId: PRODUCT,
        proofIds: [MEDIA],
        confirmed: true,
        note: undefined,
      }),
    ).rejects.toMatchObject({ code: "IMITATION_TERMS" });
    expect(q.markCheckReviewed).not.toHaveBeenCalled();

    await applyModerationAction(
      ADMIN,
      {
        action: "verify",
        productId: PRODUCT,
        proofIds: [MEDIA],
        confirmed: true,
        note: "Factura válida",
      },
      NOW,
    );
    expect(q.markCheckReviewed).toHaveBeenCalledWith(q.tx, PRODUCT, {
      status: "VERIFIED_BY_ADMIN",
      reviewedById: ADMIN,
      reviewNote: "Factura válida",
      now: NOW,
    });
    expect(q.logModeration).toHaveBeenCalledWith(
      q.tx,
      expect.objectContaining({ kind: "authenticity.verify", actorUserId: ADMIN }),
    );
  });

  it("rechazar la declaración la cambia a genérico", async () => {
    q.findProductState.mockResolvedValue({
      slug: "airpods",
      title: "AirPods",
      moderationStatus: "VISIBLE",
      authenticity: "DECLARED_ORIGINAL",
    });
    q.findCheckForReview.mockResolvedValue({
      status: "PROOF_SUBMITTED",
      proofMediaIds: [MEDIA],
      product: { authenticity: "DECLARED_ORIGINAL", title: "AirPods" },
    });
    await applyModerationAction(
      ADMIN,
      { action: "reject", productId: PRODUCT, note: undefined },
      NOW,
    );
    expect(q.forceGeneric).toHaveBeenCalledWith(q.tx, PRODUCT);
    expect(q.markCheckReviewed).toHaveBeenCalledWith(
      q.tx,
      PRODUCT,
      expect.objectContaining({ status: "REJECTED", reviewNote: null }),
    );
  });

  it("una acción sin efecto (ya atendida) no deja bitácora", async () => {
    q.findPostState.mockResolvedValue({ id: MEDIA, status: "HIDDEN", productId: null });
    q.setPostModeration.mockResolvedValue({ count: 0 });
    await expect(
      applyModerationAction(ADMIN, {
        action: "hide",
        targetType: "POST",
        targetId: MEDIA,
        note: undefined,
      }),
    ).rejects.toMatchObject({ code: "NOT_ALLOWED" });
    expect(q.logModeration).not.toHaveBeenCalled();
  });

  it("solo sirve fotos que son comprobantes", async () => {
    q.findProofMedia.mockResolvedValue(null);
    await expect(getProofFileForAdmin(ADMIN, MEDIA)).resolves.toBeNull();
    expect(storage.get).not.toHaveBeenCalled();
    q.findProofMedia.mockResolvedValue({ storageKey: "images/2026/09/x.webp", status: "READY" });
    storage.get.mockResolvedValue({ data: Buffer.from("x"), contentType: "image/webp" });
    await expect(getProofFileForAdmin(ADMIN, MEDIA)).resolves.toMatchObject({
      contentType: "image/webp",
    });
  });
});

describe("cola: urgentes primero y comentarios", () => {
  const POST = "0199a000-0000-7000-8000-0000000000f1";
  const COMMENT = "0199a000-0000-7000-8000-0000000000f2";
  const OLD = new Date(NOW.getTime() - 3 * 86_400_000);
  const RECENT = new Date(NOW.getTime() - 3_600_000);

  function report(overrides: Record<string, unknown>) {
    return {
      id: `r-${String(overrides.targetId)}-${String(overrides.reason)}`,
      details: null,
      createdAt: OLD,
      reporter: { profile: { username: "alguien" } },
      ...overrides,
    };
  }

  beforeEach(() => {
    q.listReviewChecks.mockResolvedValue([]);
    q.listHiddenContent.mockResolvedValue([[], [], []]);
    q.findMediaByIds.mockResolvedValue([]);
    q.findProductsForQueue.mockResolvedValue([]);
    q.findProfilesForQueue.mockResolvedValue([]);
    q.findPostsForQueue.mockResolvedValue([
      { id: POST, body: "Mi outfit de hoy", status: "PUBLISHED", author: { profile: null } },
    ]);
    q.findCommentsForQueue.mockResolvedValue([
      {
        id: COMMENT,
        body: "Un comentario reportado",
        status: "PUBLISHED",
        postId: POST,
        author: { profile: { username: "beto" } },
      },
    ]);
  });

  it("lo íntimo sin consentimiento o que pone en riesgo a un menor va primero y marcado", async () => {
    q.listOpenReports.mockResolvedValue([
      report({ targetType: "POST", targetId: POST, reason: "SPAM", createdAt: OLD }),
      report({
        targetType: "COMMENT",
        targetId: COMMENT,
        reason: "CHILD_SAFETY",
        createdAt: RECENT,
      }),
    ]);

    const queue = await getModerationQueue(ADMIN, NOW);

    expect(queue.reports.map((group) => [group.targetType, group.urgent])).toEqual([
      ["COMMENT", true],
      ["POST", false],
    ]);
    expect(queue.reports[0]?.target).toEqual({
      kind: "COMMENT",
      excerpt: "Un comentario reportado",
      href: `/p/${POST}`,
      author: "beto",
      hidden: false,
    });
  });

  it("entre los urgentes (y entre los demás) sigue primero lo más antiguo", async () => {
    q.listOpenReports.mockResolvedValue([
      report({ targetType: "POST", targetId: POST, reason: "INTIMATE_WITHOUT_CONSENT" }),
      report({
        targetType: "COMMENT",
        targetId: COMMENT,
        reason: "CHILD_SAFETY",
        createdAt: RECENT,
      }),
    ]);

    const queue = await getModerationQueue(ADMIN, NOW);

    expect(queue.reports.map((group) => group.targetType)).toEqual(["POST", "COMMENT"]);
    expect(queue.reports.every((group) => group.urgent)).toBe(true);
  });

  it("ocultar un comentario: estado, reportes atendidos y bitácora; restaurar lo regresa", async () => {
    q.findCommentState.mockResolvedValue({ id: COMMENT, status: "PUBLISHED", postId: POST });
    q.setCommentModeration.mockResolvedValue({ count: 1 });
    q.resolveOpenReports.mockResolvedValue({ count: 1 });

    const hidden = await applyModerationAction(
      ADMIN,
      { action: "hide", targetType: "COMMENT", targetId: COMMENT, note: "Acoso" },
      NOW,
    );
    expect(q.setCommentModeration).toHaveBeenCalledWith(q.tx, COMMENT, true);
    expect(q.resolveOpenReports).toHaveBeenCalledWith(
      q.tx,
      { targetType: "COMMENT", targetId: COMMENT },
      "ACTIONED",
      ADMIN,
      NOW,
    );
    expect(q.logModeration).toHaveBeenCalledWith(
      q.tx,
      expect.objectContaining({
        kind: "moderation.hide_comment",
        actorUserId: ADMIN,
        reason: "Acoso",
        previousValue: expect.objectContaining({ status: "PUBLISHED" }),
        newValue: expect.objectContaining({ status: "HIDDEN" }),
      }),
    );
    expect(hidden.paths).toContain(`/p/${POST}`);
    expect(q.setPostModeration).not.toHaveBeenCalled();

    vi.clearAllMocks();
    q.findCommentState.mockResolvedValue({ id: COMMENT, status: "HIDDEN", postId: POST });
    q.setCommentModeration.mockResolvedValue({ count: 1 });
    await applyModerationAction(
      ADMIN,
      { action: "restore", targetType: "COMMENT", targetId: COMMENT, note: undefined },
      NOW,
    );
    expect(q.setCommentModeration).toHaveBeenCalledWith(q.tx, COMMENT, false);
    expect(q.resolveOpenReports).not.toHaveBeenCalled();
    expect(q.logModeration).toHaveBeenCalledWith(
      q.tx,
      expect.objectContaining({ kind: "moderation.restore_comment" }),
    );
  });

  it("descartar los reportes de un comentario no lo toca", async () => {
    q.findCommentState.mockResolvedValue({ id: COMMENT, status: "PUBLISHED", postId: POST });
    q.resolveOpenReports.mockResolvedValue({ count: 2 });

    await applyModerationAction(
      ADMIN,
      { action: "dismiss", targetType: "COMMENT", targetId: COMMENT, note: undefined },
      NOW,
    );
    expect(q.resolveOpenReports).toHaveBeenCalledWith(
      q.tx,
      { targetType: "COMMENT", targetId: COMMENT },
      "DISMISSED",
      ADMIN,
      NOW,
    );
    expect(q.setCommentModeration).not.toHaveBeenCalled();
    expect(q.logModeration).toHaveBeenCalledWith(
      q.tx,
      expect.objectContaining({ kind: "moderation.dismiss_comment" }),
    );
  });

  it("un comentario que ya no existe no deja bitácora", async () => {
    q.findCommentState.mockResolvedValue(null);
    await expect(
      applyModerationAction(ADMIN, {
        action: "hide",
        targetType: "COMMENT",
        targetId: COMMENT,
        note: undefined,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(q.logModeration).not.toHaveBeenCalled();
  });
});
