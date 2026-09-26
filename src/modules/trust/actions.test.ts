import { beforeEach, describe, expect, it, vi } from "vitest";

// Las acciones traducen: sesión, límite, validación y mensajes. Las reglas viven en el servicio.
const { session, guard, limits, service, redirect, revalidatePath } = vi.hoisted(() => {
  class TrustError extends Error {
    constructor(readonly code: string) {
      super(code);
    }
  }
  class AdminAuthorizationError extends Error {}
  return {
    session: { getViewer: vi.fn(), requireOnboardedViewer: vi.fn() },
    guard: { getAdminViewer: vi.fn() },
    limits: { checkTrustLimit: vi.fn() },
    service: {
      TrustError,
      AdminAuthorizationError,
      createReport: vi.fn(),
      submitProof: vi.fn(),
      declareGeneric: vi.fn(),
      applyModerationAction: vi.fn(),
    },
    redirect: vi.fn((to: string) => {
      throw new Error(`redirect:${to}`);
    }),
    revalidatePath: vi.fn(),
  };
});
vi.mock("@/modules/identity/session", () => session);
vi.mock("@/modules/admin/guard", () => guard);
vi.mock("@/modules/admin/service", () => ({
  AdminAuthorizationError: service.AdminAuthorizationError,
}));
vi.mock("./limits", () => limits);
vi.mock("./service", () => service);
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/cache", () => ({ revalidatePath }));

const { moderationAction, reportAction, submitProofAction } = await import("./actions");

const BUYER = "0199a000-0000-7000-8000-00000000000c";
const ADMIN = "0199a000-0000-7000-8000-0000000000ad";
const PRODUCT = "0199a000-0000-7000-8000-00000000000b";
const MEDIA = "0199a000-0000-7000-8000-0000000000e1";

function form(values: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(key, item);
  }
  return data;
}

const reportForm = (overrides: Record<string, string> = {}) =>
  form({
    targetType: "PRODUCT",
    targetId: PRODUCT,
    reason: "COUNTERFEIT",
    details: "",
    ...overrides,
  });

beforeEach(() => {
  vi.clearAllMocks();
  session.getViewer.mockResolvedValue({ userId: BUYER, profile: { onboarded: true } });
  session.requireOnboardedViewer.mockResolvedValue({ userId: BUYER, profile: { onboarded: true } });
  limits.checkTrustLimit.mockResolvedValue(null);
  guard.getAdminViewer.mockResolvedValue({ userId: ADMIN });
});

describe("reportAction", () => {
  it("sin sesión no reporta ni gasta cupo", async () => {
    session.getViewer.mockResolvedValue(null);
    await expect(reportAction({}, reportForm())).resolves.toEqual({
      error: "Inicia sesión para reportar.",
    });
    expect(limits.checkTrustLimit).not.toHaveBeenCalled();
  });

  it("con el límite agotado no llega al servicio (cada intento cuenta, también los inválidos)", async () => {
    limits.checkTrustLimit.mockResolvedValue(
      "Demasiados intentos. Intenta de nuevo en 12 minutos.",
    );
    await expect(reportAction({}, reportForm({ reason: "INVENTADO" }))).resolves.toEqual({
      error: "Demasiados intentos. Intenta de nuevo en 12 minutos.",
    });
    expect(limits.checkTrustLimit).toHaveBeenCalledWith("report", BUYER);
    expect(service.createReport).not.toHaveBeenCalled();
  });

  it("valida motivo y largo; quien reporta sale de la sesión", async () => {
    await expect(reportAction({}, reportForm({ reason: "" }))).resolves.toEqual({
      error: "Elige un motivo.",
    });
    await expect(reportAction({}, reportForm({ details: "x".repeat(1001) }))).resolves.toEqual({
      error: "Máximo 1000 caracteres.",
    });

    service.createReport.mockResolvedValue({ alreadyReported: false });
    const result = await reportAction(
      {},
      reportForm({ details: "  Dice réplica en la caja  ", reporterId: ADMIN }),
    );
    expect(result).toMatchObject({ ok: true, message: expect.stringContaining("no sabrá quién") });
    expect(service.createReport).toHaveBeenCalledWith(BUYER, {
      targetType: "PRODUCT",
      targetId: PRODUCT,
      reason: "COUNTERFEIT",
      details: "Dice réplica en la caja",
    });
  });

  it("repetir el reporte no duplica (sin prometer que sigue en revisión: quizá ya se resolvió)", async () => {
    service.createReport.mockResolvedValue({ alreadyReported: true });
    await expect(reportAction({}, reportForm())).resolves.toMatchObject({
      ok: true,
      message: "Ya habías reportado esto antes; no hace falta enviarlo otra vez.",
    });
  });

  it("lo propio o lo que no existe responde un mensaje claro", async () => {
    service.createReport.mockRejectedValue(new service.TrustError("OWN_CONTENT"));
    await expect(reportAction({}, reportForm())).resolves.toEqual({
      error: "No puedes reportar lo que tú publicaste.",
    });
  });
});

describe("submitProofAction", () => {
  it("el producto viene del formulario, pero quien lo envía de la sesión; con límite", async () => {
    service.submitProof.mockResolvedValue({ slug: "airpods" });
    await expect(
      submitProofAction({}, form({ productId: PRODUCT, proofMediaIds: [MEDIA], userId: ADMIN })),
    ).rejects.toThrow(`redirect:/studio/productos/${PRODUCT}/autenticidad?enviado=1`);
    expect(limits.checkTrustLimit).toHaveBeenCalledWith("proof", BUYER);
    expect(service.submitProof).toHaveBeenCalledWith(BUYER, {
      productId: PRODUCT,
      mediaIds: [MEDIA],
    });
  });

  it("sin fotos, repetidas o de más: error sin llamar al servicio", async () => {
    await expect(submitProofAction({}, form({ productId: PRODUCT }))).resolves.toEqual({
      error: "Agrega al menos una foto del comprobante.",
    });
    await expect(
      submitProofAction({}, form({ productId: PRODUCT, proofMediaIds: [MEDIA, MEDIA] })),
    ).resolves.toEqual({ error: "Hay fotos repetidas." });
    expect(service.submitProof).not.toHaveBeenCalled();
  });
});

describe("moderationAction", () => {
  it("a quien no es ADMIN le responde como si no existiera", async () => {
    guard.getAdminViewer.mockResolvedValue(null);
    await expect(
      moderationAction({}, form({ action: "hide", targetType: "PRODUCT", targetId: PRODUCT })),
    ).resolves.toEqual({ error: "No encontrado." });
    expect(service.applyModerationAction).not.toHaveBeenCalled();
    expect(limits.checkTrustLimit).not.toHaveBeenCalled();
  });

  it("con límite por persona del equipo", async () => {
    limits.checkTrustLimit.mockResolvedValue("Demasiados intentos. Intenta de nuevo en 3 minutos.");
    await expect(
      moderationAction({}, form({ action: "hide", targetType: "PRODUCT", targetId: PRODUCT })),
    ).resolves.toEqual({ error: "Demasiados intentos. Intenta de nuevo en 3 minutos." });
    expect(limits.checkTrustLimit).toHaveBeenCalledWith("moderation", ADMIN);
  });

  it("verificar exige la casilla de «revisé el comprobante»", async () => {
    await expect(
      moderationAction({}, form({ action: "verify", productId: PRODUCT })),
    ).resolves.toEqual({
      error: "Marca la casilla para confirmar que revisaste el comprobante.",
    });
    // Sin las fotos que el equipo vio, no hay verificación.
    await expect(
      moderationAction({}, form({ action: "verify", productId: PRODUCT, confirmed: "on" })),
    ).resolves.toEqual({ error: "Acción inválida." });
    expect(service.applyModerationAction).not.toHaveBeenCalled();

    service.applyModerationAction.mockResolvedValue({ paths: ["/producto/airpods"] });
    await expect(
      moderationAction(
        {},
        form({
          action: "verify",
          productId: PRODUCT,
          proofIds: `${MEDIA},${ADMIN}`,
          confirmed: "on",
          note: "",
        }),
      ),
    ).resolves.toMatchObject({ ok: true });
    expect(service.applyModerationAction).toHaveBeenCalledWith(ADMIN, {
      action: "verify",
      productId: PRODUCT,
      proofIds: [MEDIA, ADMIN],
      confirmed: true,
      note: undefined,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/producto/airpods");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/moderacion");
  });

  it("si el servicio niega el rol (lo revocaron a media sesión), tampoco revela nada", async () => {
    service.applyModerationAction.mockRejectedValue(new service.AdminAuthorizationError());
    await expect(
      moderationAction({}, form({ action: "dismiss", targetType: "POST", targetId: PRODUCT })),
    ).resolves.toEqual({ error: "No encontrado." });
  });
});
