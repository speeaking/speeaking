import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ $queryRaw: vi.fn(), $executeRaw: vi.fn() }));
vi.mock("@/server/db", () => ({ db }));

const {
  UNREAD_CAP,
  UNREAD_WINDOW_DAYS,
  countUnread,
  getUnreadCounts,
  markCommunitySeen,
  toUnreadCounts,
  unreadCountsSql,
} = await import("./unread");
const { postVisibleToSql } = await import("@/modules/relationships/privacy");

const VIEWER = "0199a000-0000-7000-8000-00000000000a";
const GAMING = "0199a000-0000-7000-8000-0000000000c1";
const DEPORTES = "0199a000-0000-7000-8000-0000000000c2";
const NOW = new Date("2026-09-25T18:00:00.000Z");
/** Inicio de la ventana del feed (45 días antes de NOW). */
const WINDOW_START = new Date(NOW.getTime() - UNREAD_WINDOW_DAYS * 24 * 60 * 60 * 1000);

/** SQL en una línea, para buscar reglas sin depender de sangrías. */
const flat = (text: string) => text.replace(/\s+/g, " ");

/**
 * Parámetros propios de la consulta, al final; antes van los de la audiencia (`postVisibleToSql`,
 * todos son quien ve).
 */
function ownValues(values: unknown[]) {
  const audience = values.slice(0, -4);
  expect(audience.length).toBeGreaterThan(0);
  expect(audience.every((value) => value === VIEWER)).toBe(true);
  return values.slice(-4);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("unreadCountsSql", () => {
  it("todo dato variable viaja como parámetro, nunca dentro del texto SQL", () => {
    const sql = unreadCountsSql(VIEWER, NOW);

    expect(sql.text).not.toContain(VIEWER);
    expect(sql.text).not.toContain("2026");
    // Las fechas van como Date: el adaptador las codifica igual que las escrituras de Prisma.
    expect(ownValues(sql.values)).toEqual([WINDOW_START, NOW, UNREAD_CAP + 1, VIEWER]);
    expect(WINDOW_START.toISOString()).toBe("2026-08-11T18:00:00.000Z");
  });

  it("cuenta solo lo visible y nuevo: publicado, después de la última visita, de otras personas", () => {
    const sql = unreadCountsSql(VIEWER, NOW);
    const text = flat(sql.text);
    // Posición ($n) de cada parámetro propio.
    const n = sql.values.length;

    expect(text).toContain(`m."userId" = $${n}::uuid`);
    expect(text).toContain(`p."status" = 'PUBLISHED'`);
    // La misma audiencia que el feed: «N nuevas» no cuenta lo que la persona no podría abrir
    // (Amigos sin amistad aceptada, Solo yo de otra persona, autores con bloqueo).
    expect(text).toContain(flat(postVisibleToSql(VIEWER).text));
    // Sin visitas cuenta desde que se unió.
    expect(text).toContain(`p."publishedAt" > COALESCE(m."lastSeenAt", m."createdAt")`);
    // Lo que el feed de la comunidad ya no muestra (más de 45 días) no se anuncia como nuevo.
    expect(text).toContain(`p."publishedAt" >= $${n - 3}::timestamptz`);
    expect(text).toContain(`p."publishedAt" <= $${n - 2}::timestamptz`);
    expect(text).toContain(`p."authorId" <> m."userId"`);
    // Igual que el feed: sin productos agotados o pausados.
    expect(text).toContain(`pr."status" = 'ACTIVE' AND pr."stock" > 0`);
    // Costo acotado: cada comunidad deja de contar en 100 («99+»).
    expect(text).toContain(`LIMIT $${n - 1}`);
    // Solo comunidades con algo nuevo.
    expect(text).toContain(`fresh."count" > 0`);
  });
});

describe("toUnreadCounts", () => {
  it("quita los ceros, acepta bigint y nunca pasa del tope", () => {
    expect(
      toUnreadCounts([
        { communityId: GAMING, count: BigInt(3) },
        { communityId: DEPORTES, count: 0 },
        { communityId: "otra", count: 5000 },
      ]),
    ).toEqual({ [GAMING]: 3, otra: UNREAD_CAP + 1 });
  });

  it("sin filas, un mapa vacío", () => {
    expect(toUnreadCounts([])).toEqual({});
  });
});

describe("countUnread / getUnreadCounts", () => {
  it("una sola consulta para todas las comunidades", async () => {
    db.$queryRaw.mockResolvedValue([
      { communityId: GAMING, count: 1 },
      { communityId: DEPORTES, count: 100 },
    ]);

    await expect(countUnread(VIEWER, NOW)).resolves.toEqual({ [GAMING]: 1, [DEPORTES]: 100 });
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    const sql = db.$queryRaw.mock.calls[0]![0] as { values: unknown[] };
    expect(ownValues(sql.values)).toEqual([WINDOW_START, NOW, UNREAD_CAP + 1, VIEWER]);
  });

  it("getUnreadCounts cuenta hasta este momento", async () => {
    vi.useFakeTimers({ now: NOW });
    try {
      db.$queryRaw.mockResolvedValue([]);
      await expect(getUnreadCounts(VIEWER)).resolves.toEqual({});
      const sql = db.$queryRaw.mock.calls[0]![0] as { values: unknown[] };
      const [, now, , viewer] = ownValues(sql.values);
      expect(now).toEqual(NOW);
      expect(viewer).toBe(VIEWER);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("markCommunitySeen", () => {
  it("solo toca la membresía de esa persona en esa comunidad, y la fecha solo avanza", async () => {
    db.$executeRaw.mockResolvedValue(1);
    const at = new Date("2026-09-25T18:30:00.000Z");

    await markCommunitySeen(VIEWER, GAMING, at);

    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
    const [strings, ...values] = db.$executeRaw.mock.calls[0]! as [TemplateStringsArray, unknown[]];
    const text = flat(strings.join("?"));
    expect(text).toContain(`UPDATE "community_memberships" SET "lastSeenAt" = ?::timestamptz`);
    expect(text).toContain(`WHERE "userId" = ?::uuid AND "communityId" = ?::uuid`);
    expect(text).toContain(`("lastSeenAt" IS NULL OR "lastSeenAt" < ?::timestamptz)`);
    expect(values).toEqual([at, VIEWER, GAMING, at]);
  });

  it("sin fecha, marca hasta ahora", async () => {
    vi.useFakeTimers({ now: NOW });
    try {
      db.$executeRaw.mockResolvedValue(0);
      await markCommunitySeen(VIEWER, GAMING);
      const [, ...values] = db.$executeRaw.mock.calls[0]! as [TemplateStringsArray, unknown[]];
      expect(values[0]).toEqual(NOW);
    } finally {
      vi.useRealTimers();
    }
  });
});
