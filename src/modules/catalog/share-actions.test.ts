import { beforeEach, describe, expect, it, vi } from "vitest";

// Compartir un producto se puede sin cuenta: la acción valida, pasa por el límite (SEC-15) y solo
// entonces registra el evento. Aquí se simulan sesión, límite y bitácora.
const { session, limits, track } = vi.hoisted(() => ({
  session: { getViewer: vi.fn() },
  limits: { checkSocialLimit: vi.fn() },
  track: vi.fn(),
}));
vi.mock("@/modules/identity/session", () => session);
vi.mock("@/modules/social/limits", () => limits);
vi.mock("@/modules/analytics/track", () => ({ track }));

const { recordProductShareAction } = await import("./share-actions");

const PRODUCT = "0199a000-0000-7000-8000-00000000000b";
const USER = "0199a000-0000-7000-8000-00000000000a";

beforeEach(() => {
  vi.clearAllMocks();
  session.getViewer.mockResolvedValue(null);
  limits.checkSocialLimit.mockResolvedValue({ ok: true });
});

describe("recordProductShareAction", () => {
  it("sin cuenta registra el evento con el límite por IP; con cuenta, también por cuenta", async () => {
    await recordProductShareAction(PRODUCT, "copy");
    expect(limits.checkSocialLimit).toHaveBeenCalledWith("share", null);
    expect(track).toHaveBeenCalledWith(
      expect.objectContaining({ type: "SHARE", entityType: "PRODUCT", entityId: PRODUCT }),
    );

    session.getViewer.mockResolvedValue({ userId: USER });
    await recordProductShareAction(PRODUCT, "native");
    expect(limits.checkSocialLimit).toHaveBeenLastCalledWith("share", USER);
    expect(track).toHaveBeenLastCalledWith(expect.objectContaining({ userId: USER }));
  });

  it("con el límite agotado no registra nada", async () => {
    limits.checkSocialLimit.mockResolvedValue({ ok: false, error: "x", retryAfterSeconds: 10 });

    await recordProductShareAction(PRODUCT, "copy");

    expect(track).not.toHaveBeenCalled();
  });

  it("descarta ids y canales inválidos sin consultar nada", async () => {
    await recordProductShareAction("no-es-uuid", "copy");
    await recordProductShareAction(PRODUCT, "sms" as unknown as "copy");

    expect(limits.checkSocialLimit).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });
});
