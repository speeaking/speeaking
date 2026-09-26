import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as RateLimit from "@/server/rate-limit";

// Volver a aceptar los documentos legales: la comparación de versiones es pura; la consulta, el
// registro y la acción se prueban con la base, la sesión y el límite simulados.
const mocks = vi.hoisted(() => {
  const db = {
    userConsent: { findFirst: vi.fn(), createMany: vi.fn() },
    $executeRaw: vi.fn(),
    // La transacción corre con el mismo cliente simulado (el candado queda en `$executeRaw`).
    $transaction: vi.fn(),
  };
  return {
    db,
    session: { getViewer: vi.fn(), requireOnboardedViewer: vi.fn() },
    rateLimit: vi.fn(),
  };
});
vi.mock("@/server/db", () => ({ db: mocks.db }));
vi.mock("@/server/env", () => ({ env: { NODE_ENV: "test", TRUSTED_PROXY_HOPS: 0 } }));
vi.mock("@/server/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimit>()),
  rateLimit: mocks.rateLimit,
}));
vi.mock("./session", () => mocks.session);
vi.mock("@/modules/discovery/service", () => ({ setDiscoverable: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const {
  acceptPendingLegalDocuments,
  currentLegalVersion,
  getPendingLegalDocuments,
  isOutdatedConsent,
  pendingLegalDocuments,
} = await import("./consent-refresh");
const { acceptUpdatedLegalAction } = await import("./privacy-actions");
const { LEGAL_VERSIONS } = await import("./constants");

const USER_ID = "0199a000-0000-7000-8000-000000000001";
/** Lo que el aviso mostró: las versiones vigentes de ambos documentos. */
const SHOWN_CURRENT = [
  { type: "PRIVACY_NOTICE", version: LEGAL_VERSIONS.privacyNotice },
  { type: "TERMS", version: LEGAL_VERSIONS.terms },
] as const;
const VERSIONS = { terms: "2026-09-27", privacyNotice: "2026-09-27" };
const accepted = (version: string) => ({ version, granted: true });

type Row = { version: string; granted: boolean } | null;

/** Última fila por documento, como la devolvería la base. */
function storedConsents(rows: { TERMS?: Row; PRIVACY_NOTICE?: Row }) {
  mocks.db.userConsent.findFirst.mockImplementation(
    async ({ where }: { where: { type: "TERMS" | "PRIVACY_NOTICE" } }) => rows[where.type] ?? null,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.$transaction.mockImplementation(async (fn: (tx: typeof mocks.db) => unknown) =>
    fn(mocks.db),
  );
  mocks.rateLimit.mockResolvedValue({ ok: true });
  mocks.session.getViewer.mockResolvedValue({ userId: USER_ID });
});

describe("isOutdatedConsent", () => {
  it("una versión anterior está desactualizada; la misma, no", () => {
    expect(isOutdatedConsent(accepted("2026-09-26"), "2026-09-27")).toBe(true);
    expect(isOutdatedConsent(accepted("2025-12-31"), "2026-01-01")).toBe(true);
    expect(isOutdatedConsent(accepted("2026-09-27"), "2026-09-27")).toBe(false);
  });

  it("una versión posterior a la vigente no vuelve a preguntar (p. ej. tras regresar el código)", () => {
    expect(isOutdatedConsent(accepted("2026-10-01"), "2026-09-27")).toBe(false);
  });

  it("sin aceptación o con la última retirada, hay que preguntar", () => {
    expect(isOutdatedConsent(null, "2026-09-27")).toBe(true);
    expect(isOutdatedConsent(undefined, "2026-09-27")).toBe(true);
    expect(isOutdatedConsent({ version: "2026-09-27", granted: false }, "2026-09-27")).toBe(true);
  });

  it("versiones que no son fechas: solo cuenta si son distintas", () => {
    expect(isOutdatedConsent(accepted("v2"), "v2")).toBe(false);
    expect(isOutdatedConsent(accepted("v3"), "v2")).toBe(true);
    expect(isOutdatedConsent(accepted("2026-09-27"), "v2")).toBe(true);
  });
});

describe("pendingLegalDocuments", () => {
  it("devuelve solo lo que cambió, con la versión vigente, aviso de privacidad primero", () => {
    expect(
      pendingLegalDocuments(
        { TERMS: accepted("2026-09-26"), PRIVACY_NOTICE: accepted("2026-09-26") },
        VERSIONS,
      ),
    ).toEqual([
      { type: "PRIVACY_NOTICE", version: "2026-09-27" },
      { type: "TERMS", version: "2026-09-27" },
    ]);
    expect(
      pendingLegalDocuments(
        { TERMS: accepted("2026-09-27"), PRIVACY_NOTICE: accepted("2026-09-26") },
        VERSIONS,
      ),
    ).toEqual([{ type: "PRIVACY_NOTICE", version: "2026-09-27" }]);
  });

  it("al día: nada pendiente", () => {
    expect(
      pendingLegalDocuments(
        { TERMS: accepted("2026-09-27"), PRIVACY_NOTICE: accepted("2026-09-27") },
        VERSIONS,
      ),
    ).toEqual([]);
  });

  it("usa LEGAL_VERSIONS por omisión", () => {
    expect(currentLegalVersion("TERMS")).toBe(LEGAL_VERSIONS.terms);
    expect(currentLegalVersion("PRIVACY_NOTICE")).toBe(LEGAL_VERSIONS.privacyNotice);
    expect(pendingLegalDocuments({})).toEqual([
      { type: "PRIVACY_NOTICE", version: LEGAL_VERSIONS.privacyNotice },
      { type: "TERMS", version: LEGAL_VERSIONS.terms },
    ]);
  });
});

describe("getPendingLegalDocuments / acceptPendingLegalDocuments", () => {
  it("lee la ÚLTIMA fila de cada documento de esa persona", async () => {
    storedConsents({
      TERMS: accepted(LEGAL_VERSIONS.terms),
      PRIVACY_NOTICE: accepted("2020-01-01"),
    });

    expect(await getPendingLegalDocuments(USER_ID)).toEqual([
      { type: "PRIVACY_NOTICE", version: LEGAL_VERSIONS.privacyNotice },
    ]);
    for (const type of ["PRIVACY_NOTICE", "TERMS"]) {
      expect(mocks.db.userConsent.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: USER_ID, type },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        }),
      );
    }
  });

  it("registra filas nuevas solo de lo pendiente que se mostró, con candado por persona", async () => {
    storedConsents({ TERMS: accepted("2020-01-01"), PRIVACY_NOTICE: accepted("2020-01-01") });

    expect(await acceptPendingLegalDocuments(USER_ID, SHOWN_CURRENT)).toEqual({
      accepted: SHOWN_CURRENT,
      stale: [],
    });

    expect(mocks.db.$transaction).toHaveBeenCalledOnce();
    // El candado va antes de leer: dos «Aceptar» simultáneos (dos pestañas) no repiten filas.
    const lock = mocks.db.$executeRaw.mock.calls[0]!;
    expect(lock[0].join("?")).toContain("pg_advisory_xact_lock");
    expect(lock[1]).toBe(`consent-refresh:${USER_ID}`);
    expect(mocks.db.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.db.userConsent.findFirst.mock.invocationCallOrder[0]!,
    );
    expect(mocks.db.userConsent.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: USER_ID,
          type: "PRIVACY_NOTICE",
          version: LEGAL_VERSIONS.privacyNotice,
          granted: true,
        },
        { userId: USER_ID, type: "TERMS", version: LEGAL_VERSIONS.terms, granted: true },
      ],
    });
  });

  it("no registra una versión que el aviso no mostró (cambió con la pestaña abierta)", async () => {
    storedConsents({ TERMS: accepted("2020-01-01"), PRIVACY_NOTICE: accepted("2020-01-01") });
    const shown = [
      { type: "PRIVACY_NOTICE", version: "2020-06-01" },
      { type: "TERMS", version: LEGAL_VERSIONS.terms },
    ] as const;

    expect(await acceptPendingLegalDocuments(USER_ID, shown)).toEqual({
      accepted: [{ type: "TERMS", version: LEGAL_VERSIONS.terms }],
      stale: [{ type: "PRIVACY_NOTICE", version: LEGAL_VERSIONS.privacyNotice }],
    });
    expect(mocks.db.userConsent.createMany).toHaveBeenCalledWith({
      data: [{ userId: USER_ID, type: "TERMS", version: LEGAL_VERSIONS.terms, granted: true }],
    });
  });

  it("un documento que no se mostró tampoco se registra", async () => {
    storedConsents({ TERMS: accepted("2020-01-01"), PRIVACY_NOTICE: accepted("2020-01-01") });

    const result = await acceptPendingLegalDocuments(USER_ID, [SHOWN_CURRENT[1]]);

    expect(result.stale).toEqual([SHOWN_CURRENT[0]]);
    expect(mocks.db.userConsent.createMany).toHaveBeenCalledWith({
      data: [{ userId: USER_ID, type: "TERMS", version: LEGAL_VERSIONS.terms, granted: true }],
    });
  });

  it("al día no escribe nada (aceptar dos veces no repite filas)", async () => {
    storedConsents({
      TERMS: accepted(LEGAL_VERSIONS.terms),
      PRIVACY_NOTICE: accepted(LEGAL_VERSIONS.privacyNotice),
    });

    expect(await acceptPendingLegalDocuments(USER_ID, SHOWN_CURRENT)).toEqual({
      accepted: [],
      stale: [],
    });
    expect(mocks.db.userConsent.createMany).not.toHaveBeenCalled();
  });
});

describe("acceptUpdatedLegalAction", () => {
  it("con sesión: limita por persona y registra la aceptación de lo mostrado", async () => {
    storedConsents({ TERMS: accepted("2020-01-01"), PRIVACY_NOTICE: accepted("2020-01-01") });

    expect(await acceptUpdatedLegalAction(SHOWN_CURRENT)).toEqual({ ok: true });
    expect(mocks.rateLimit).toHaveBeenCalledWith({
      key: `consent.accept:user:${USER_ID}`,
      limit: 10,
      windowSeconds: 3600,
    });
    expect(mocks.db.userConsent.createMany).toHaveBeenCalledOnce();
  });

  it("si la versión vigente ya no es la mostrada, responde `stale` para volver a pintar el aviso", async () => {
    storedConsents({ TERMS: accepted("2020-01-01"), PRIVACY_NOTICE: accepted("2020-01-01") });

    const result = await acceptUpdatedLegalAction([
      { type: "PRIVACY_NOTICE", version: "2020-06-01" },
      { type: "TERMS", version: "2020-06-01" },
    ]);

    expect(result).toMatchObject({ ok: false, stale: true });
    expect(mocks.db.userConsent.createMany).not.toHaveBeenCalled();
  });

  it("lo que manda el navegador se valida (tipos y tamaño)", async () => {
    for (const shown of [
      [{ type: "PERSONALIZATION", version: "2026-09-24" }],
      [{ type: "TERMS", version: "x".repeat(41) }],
      [{ type: "TERMS", version: LEGAL_VERSIONS.terms, granted: false }],
      [...SHOWN_CURRENT, SHOWN_CURRENT[0]],
      "TERMS",
    ]) {
      expect(await acceptUpdatedLegalAction(shown as never)).toEqual({
        ok: false,
        error: "No pudimos guardar tu aceptación. Recarga la página.",
      });
    }
    expect(mocks.rateLimit).not.toHaveBeenCalled();
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });

  it("con el límite agotado no escribe y responde el mensaje de espera", async () => {
    mocks.rateLimit.mockResolvedValue({ ok: false, retryAfterSeconds: 600 });
    storedConsents({});

    expect(await acceptUpdatedLegalAction(SHOWN_CURRENT)).toEqual({
      ok: false,
      error: "Demasiados intentos. Intenta de nuevo en 10 minutos.",
    });
    expect(mocks.db.userConsent.findFirst).not.toHaveBeenCalled();
    expect(mocks.db.userConsent.createMany).not.toHaveBeenCalled();
  });

  it("sin sesión no toca la base ni el límite", async () => {
    mocks.session.getViewer.mockResolvedValue(null);

    expect(await acceptUpdatedLegalAction(SHOWN_CURRENT)).toEqual({
      ok: false,
      error: "Inicia sesión para continuar.",
    });
    expect(mocks.rateLimit).not.toHaveBeenCalled();
    expect(mocks.db.userConsent.createMany).not.toHaveBeenCalled();
  });
});
