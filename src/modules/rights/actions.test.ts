import { beforeEach, describe, expect, it, vi } from "vitest";

// Las acciones traducen: límites, sesión, Turnstile, validación y mensajes. Las reglas viven en el
// servicio (probado contra la base en service.db.test.ts).
const { session, guard, limits, turnstile, service, revalidatePath } = vi.hoisted(() => {
  class RightsError extends Error {
    constructor(readonly code: string) {
      super(code);
    }
  }
  class AdminAuthorizationError extends Error {}
  return {
    session: { getViewer: vi.fn() },
    guard: { getAdminViewer: vi.fn() },
    limits: { checkRightsLimit: vi.fn() },
    turnstile: { verifyTurnstile: vi.fn() },
    service: {
      RightsError,
      AdminAuthorizationError,
      submitNotice: vi.fn(),
      submitCounterNotice: vi.fn(),
      applyRightsAction: vi.fn(),
    },
    revalidatePath: vi.fn(),
  };
});
vi.mock("@/modules/identity/session", () => session);
vi.mock("@/modules/identity/turnstile", () => turnstile);
vi.mock("@/modules/admin/guard", () => guard);
vi.mock("@/modules/admin/service", () => ({
  AdminAuthorizationError: service.AdminAuthorizationError,
}));
vi.mock("./limits", () => limits);
vi.mock("./service", () => service);
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const { rightsAdminAction, submitCounterNoticeAction, submitNoticeAction } =
  await import("./actions");
const { RIGHTS_TURNSTILE_ACTION } = await import("./constants");

const SELLER = "0199a000-0000-7000-8000-0000000000b1";
const ADMIN = "0199a000-0000-7000-8000-0000000000ad";
const NOTICE = "0199a000-0000-7000-8000-0000000000c1";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.append(key, value);
  return data;
}

const noticeForm = (overrides: Record<string, string> = {}) =>
  form({
    kind: "COPYRIGHT",
    claimantName: "Estudio Luz",
    claimantEmail: "Avisos@EstudioLuz.example",
    claimantRole: "OWNER",
    workDescription: "Fotografía «Atardecer en Bacalar».",
    rightDescription: "Soy la autora y titular de los derechos.",
    urls: "https://www.speeaking.com/p/0192f0c4-7b1a-7c3e-9d2f-1a2b3c4d5e6f",
    swornStatement: "on",
    penaltyAcknowledged: "on",
    ...overrides,
  });

beforeEach(() => {
  vi.clearAllMocks();
  session.getViewer.mockResolvedValue(null);
  guard.getAdminViewer.mockResolvedValue({ userId: ADMIN });
  limits.checkRightsLimit.mockResolvedValue(null);
  turnstile.verifyTurnstile.mockResolvedValue(null);
  service.submitNotice.mockResolvedValue({
    cases: [{ id: NOTICE, number: 123, caseNumber: "DA-000123", targetCount: 1 }],
    emailSent: false,
  });
});

describe("aviso sin cuenta", () => {
  it("recibe el aviso y devuelve el número de caso, sin prometer un correo que no salió", async () => {
    const result = await submitNoticeAction({}, noticeForm());

    expect(result).toEqual({ ok: true, caseNumbers: [123], emailSent: false });
    expect(service.submitNotice).toHaveBeenCalledWith(
      expect.objectContaining({ claimantEmail: "avisos@estudioluz.example", swornStatement: true }),
      { submittedById: null },
    );
    // Primero la IP (cada intento cuenta), después el correo de quien avisa.
    expect(limits.checkRightsLimit.mock.calls.map((call) => call[0])).toEqual([
      "noticeIp",
      "noticeEmail",
    ]);
    expect(limits.checkRightsLimit).toHaveBeenLastCalledWith(
      "noticeEmail",
      expect.any(Headers),
      "avisos@estudioluz.example",
    );
    expect(turnstile.verifyTurnstile).toHaveBeenCalledWith(
      expect.any(FormData),
      expect.any(Headers),
      RIGHTS_TURNSTILE_ACTION,
    );
  });

  it("con sesión abierta guarda quién lo mandó", async () => {
    session.getViewer.mockResolvedValue({ userId: SELLER });
    await submitNoticeAction({}, noticeForm());

    expect(service.submitNotice).toHaveBeenCalledWith(expect.anything(), {
      submittedById: SELLER,
    });
  });

  it("pasado el límite por IP no valida ni guarda nada", async () => {
    limits.checkRightsLimit.mockResolvedValueOnce("Demasiados intentos.");
    const result = await submitNoticeAction({}, noticeForm());

    expect(result.error).toBe("Demasiados intentos.");
    expect(result.values?.claimantName).toBe("Estudio Luz");
    expect(service.submitNotice).not.toHaveBeenCalled();
  });

  it("si falta algo devuelve los errores y lo escrito, nunca las casillas marcadas", async () => {
    const result = await submitNoticeAction(
      {},
      noticeForm({ claimantEmail: "no-es-correo", swornStatement: "" }),
    );

    expect(result.error).toBe("Revisa los campos marcados.");
    expect(result.fieldErrors?.claimantEmail).toBeDefined();
    expect(result.fieldErrors?.swornStatement).toBeDefined();
    expect(result.values).toMatchObject({ claimantEmail: "no-es-correo" });
    expect(result.values).not.toHaveProperty("swornStatement");
    expect(service.submitNotice).not.toHaveBeenCalled();
  });

  it("si Turnstile está configurado y no pasa, no guarda nada", async () => {
    turnstile.verifyTurnstile.mockResolvedValue("Completa la verificación de seguridad.");
    const result = await submitNoticeAction({}, noticeForm());

    expect(result.error).toBe("Completa la verificación de seguridad.");
    expect(service.submitNotice).not.toHaveBeenCalled();
  });
});

describe("contra-aviso", () => {
  const counterForm = () =>
    form({
      caseNumber: "DA-000123",
      name: "Tienda de prueba",
      email: "tienda@example.com",
      domicile: "Calle 5 de Mayo 20, Centro, 68000, Oaxaca",
      basis: "OWN_WORK",
      explanation: "La foto la tomé yo; tengo el archivo original.",
      swornStatement: "on",
      penaltyAcknowledged: "on",
    });

  it("pide la sesión de quien subió el contenido", async () => {
    const result = await submitCounterNoticeAction({}, counterForm());

    expect(result.error).toMatch(/Entra con la cuenta que subió el contenido/);
    expect(service.submitCounterNotice).not.toHaveBeenCalled();
  });

  it("lo manda con la cuenta, limitado por cuenta", async () => {
    session.getViewer.mockResolvedValue({ userId: SELLER });
    const result = await submitCounterNoticeAction({}, counterForm());

    expect(result).toEqual({ ok: true });
    expect(limits.checkRightsLimit).toHaveBeenCalledWith(
      "counterNotice",
      expect.any(Headers),
      SELLER,
    );
    expect(service.submitCounterNotice).toHaveBeenCalledWith(
      SELLER,
      expect.objectContaining({ caseNumber: 123, basis: "OWN_WORK" }),
    );
  });

  it("traduce lo que el servicio no permite", async () => {
    session.getViewer.mockResolvedValue({ userId: SELLER });
    service.submitCounterNotice.mockRejectedValue(new service.RightsError("ALREADY_FILED"));

    expect((await submitCounterNoticeAction({}, counterForm())).error).toBe(
      "Ya recibimos tu contra-aviso para este caso.",
    );
  });
});

describe("acciones del equipo", () => {
  it("a quien no es ADMIN le responde como si no existiera", async () => {
    guard.getAdminViewer.mockResolvedValue(null);
    const result = await rightsAdminAction({}, form({ action: "remove", noticeId: NOTICE }));

    expect(result).toEqual({ error: "No encontrado." });
    expect(service.applyRightsAction).not.toHaveBeenCalled();
  });

  it("mantener retirado sin motivo no llega al servicio", async () => {
    const result = await rightsAdminAction({}, form({ action: "keep_down", noticeId: NOTICE }));

    expect(result.error).toMatch(/motivo/);
    expect(service.applyRightsAction).not.toHaveBeenCalled();
  });

  it("aplica la acción, revalida lo que cambió y traduce los errores del servicio", async () => {
    service.applyRightsAction.mockResolvedValueOnce({
      paths: ["/p/x"],
      message: "Listo: se retiró el contenido.",
    });
    const ok = await rightsAdminAction(
      {},
      form({ action: "remove", noticeId: NOTICE, manualDone: "on" }),
    );
    expect(ok).toEqual({ ok: true, message: "Listo: se retiró el contenido." });
    expect(service.applyRightsAction).toHaveBeenCalledWith(ADMIN, {
      action: "remove",
      noticeId: NOTICE,
      note: undefined,
      manualDone: true,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/p/x");
    expect(limits.checkRightsLimit).toHaveBeenCalledWith("admin", expect.any(Headers), ADMIN);

    service.applyRightsAction.mockRejectedValueOnce(new service.RightsError("MANUAL_PENDING"));
    expect(
      (await rightsAdminAction({}, form({ action: "remove", noticeId: NOTICE }))).error,
    ).toMatch(/retira a mano/);
    service.applyRightsAction.mockRejectedValueOnce(new service.AdminAuthorizationError());
    expect(await rightsAdminAction({}, form({ action: "remove", noticeId: NOTICE }))).toEqual({
      error: "No encontrado.",
    });
  });
});
