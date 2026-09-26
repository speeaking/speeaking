import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrackedEvent } from "./event";

const db = vi.hoisted(() => ({
  post: { findMany: vi.fn() },
  product: { findMany: vi.fn() },
  aIResponse: { findMany: vi.fn() },
}));
/** `rateLimit` en memoria: mismo contrato (cada llamada suma; pasa mientras count ≤ limit). */
const buckets = vi.hoisted(() => new Map<string, number>());
const rateLimit = vi.hoisted(() =>
  vi.fn(async ({ key, limit }: { key: string; limit: number }) => {
    const count = (buckets.get(key) ?? 0) + 1;
    buckets.set(key, count);
    return count <= limit ? { ok: true } : { ok: false, retryAfterSeconds: 60 };
  }),
);

vi.mock("@/server/db", () => ({ db }));
vi.mock("@/server/rate-limit", () => ({ rateLimit }));
vi.mock("@/server/env", () => ({
  env: { BETTER_AUTH_SECRET: "s".repeat(32), TRUSTED_PROXY_HOPS: 0, NODE_ENV: "test" },
}));

const { filterTrustedEvents, needsClientIp } = await import("./integrity");

const USER = "0199a000-0000-7000-8000-000000000001";
const OTHER_USER = "0199a000-0000-7000-8000-000000000002";
const POST = "0199a000-0000-7000-8000-0000000000a1";
const OTHER_POST = "0199a000-0000-7000-8000-0000000000a2";
const PRODUCT = "0199a000-0000-7000-8000-0000000000b1";
const OTHER_PRODUCT = "0199a000-0000-7000-8000-0000000000b2";
const RESPONSE = "0199a000-0000-7000-8000-0000000000c1";

const productView = (extra: Partial<TrackedEvent> = {}): TrackedEvent => ({
  type: "PRODUCT_VIEW",
  userId: USER,
  entityType: "PRODUCT",
  entityId: PRODUCT,
  ...extra,
});
const postShare = (extra: Partial<TrackedEvent> = {}): TrackedEvent => ({
  type: "SHARE",
  userId: USER,
  entityType: "POST",
  entityId: POST,
  sourcePostId: POST,
  metadata: { channel: "copy" },
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  buckets.clear();
  // POST es una publicación publicada del producto PRODUCT; OTHER_POST no existe o no es visible.
  db.post.findMany.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) =>
    where.id.in.includes(POST) ? [{ id: POST, productId: PRODUCT }] : [],
  );
  db.product.findMany.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) =>
    where.id.in.includes(PRODUCT) ? [{ id: PRODUCT }] : [],
  );
  db.aIResponse.findMany.mockResolvedValue([
    { id: RESPONSE, request: { userId: USER, provider: "openai_compatible" } },
  ]);
});

describe("deduplicación por persona, entidad y ventana (SEC-20)", () => {
  it("vistas repetidas de la misma persona cuentan una vez; otra persona sí cuenta", async () => {
    const context = { ip: null };

    expect(await filterTrustedEvents([productView()], context)).toHaveLength(1);
    expect(await filterTrustedEvents([productView()], context)).toHaveLength(0);
    expect(await filterTrustedEvents([productView({ userId: OTHER_USER })], context)).toHaveLength(
      1,
    );
    expect(
      await filterTrustedEvents([productView({ entityId: OTHER_PRODUCT })], context),
    ).toHaveLength(1);
  });

  it("25 compartidos anónimos desde la misma IP cuentan uno (antes: 25 filas)", async () => {
    const shares = Array.from({ length: 25 }, () => postShare({ userId: null }));
    let kept = 0;
    for (const share of shares) {
      kept += (await filterTrustedEvents([share], { ip: "203.0.113.7" })).length;
    }

    expect(kept).toBe(1);
    // Otro canal es otro compartido; otra IP, otra persona.
    expect(
      await filterTrustedEvents([postShare({ userId: null, metadata: { channel: "native" } })], {
        ip: "203.0.113.7",
      }),
    ).toHaveLength(1);
    expect(
      await filterTrustedEvents([postShare({ userId: null })], { ip: "198.51.100.9" }),
    ).toHaveLength(1);
  });

  it("IPv6: la misma red /64 es la misma persona", async () => {
    const share = () => postShare({ userId: null });

    expect(await filterTrustedEvents([share()], { ip: "2001:db8:1:2::1" })).toHaveLength(1);
    expect(await filterTrustedEvents([share()], { ip: "2001:db8:1:2:ffff::9" })).toHaveLength(0);
  });

  it("sin persona ni IP: los compartidos se descartan y las vistas tienen tope por hora", async () => {
    expect(await filterTrustedEvents([postShare({ userId: null })], { ip: null })).toEqual([]);

    let views = 0;
    for (let index = 0; index < 130; index++) {
      views += (await filterTrustedEvents([productView({ userId: null })], { ip: null })).length;
    }
    expect(views).toBe(120);
  });

  it("la llave no guarda quién ni qué en claro (HMAC)", async () => {
    await filterTrustedEvents([productView()], { ip: null });

    const key = rateLimit.mock.calls[0]![0].key as string;
    expect(key).toMatch(/^evt\.product_view:[0-9a-f]{32}$/);
    expect(key).not.toContain(USER);
    expect(key).not.toContain(PRODUCT);
  });

  it("los eventos que no se deduplican (búsquedas, compras) pasan sin tocar el limitador", async () => {
    const events: TrackedEvent[] = [
      { type: "SEARCH", userId: USER, query: "tenis" },
      { type: "PURCHASE", userId: USER, entityType: "PRODUCT", entityId: PRODUCT },
    ];

    expect(await filterTrustedEvents(events, { ip: null })).toHaveLength(2);
    expect(rateLimit).not.toHaveBeenCalled();
  });
});

describe("referencias verificadas (SEC-20)", () => {
  it("un compartido de una publicación o producto inexistente o no visible no se guarda", async () => {
    const events = [
      postShare({ entityId: OTHER_POST, sourcePostId: OTHER_POST }),
      postShare({ entityType: "PRODUCT", entityId: OTHER_PRODUCT, sourcePostId: null }),
      postShare({ entityId: "no-es-uuid" }),
    ];

    expect(await filterTrustedEvents(events, { ip: null })).toEqual([]);
    expect(
      await filterTrustedEvents(
        [postShare({ entityType: "PRODUCT", entityId: PRODUCT, sourcePostId: null })],
        { ip: null },
      ),
    ).toHaveLength(1);
  });

  it("sourcePostId inventado o de otro producto: el evento se guarda SIN atribución", async () => {
    const [invented] = await filterTrustedEvents(
      [productView({ sourcePostId: OTHER_POST, surface: "FEED" })],
      { ip: null },
    );
    const [wrongProduct] = await filterTrustedEvents(
      [
        {
          type: "ADD_TO_CART",
          userId: USER,
          entityType: "PRODUCT",
          entityId: OTHER_PRODUCT,
          sourcePostId: POST,
        },
      ],
      { ip: null },
    );
    const [genuine] = await filterTrustedEvents(
      [productView({ userId: OTHER_USER, sourcePostId: POST.toUpperCase() })],
      { ip: null },
    );

    expect(invented).toMatchObject({ type: "PRODUCT_VIEW", sourcePostId: null });
    expect(wrongProduct).toMatchObject({ type: "ADD_TO_CART", sourcePostId: null });
    expect(genuine?.sourcePostId).toBe(POST.toUpperCase());
  });

  it("AI_PROPOSAL_ACCEPTED solo con una propuesta propia, y una sola vez", async () => {
    const accepted = (userId: string, responseId: string, entityId = PRODUCT): TrackedEvent => ({
      type: "AI_PROPOSAL_ACCEPTED",
      userId,
      entityType: "PRODUCT",
      entityId,
      metadata: { responseId },
    });

    expect(await filterTrustedEvents([accepted(OTHER_USER, RESPONSE)], { ip: null })).toEqual([]);
    expect(
      await filterTrustedEvents([accepted(USER, "0199a000-0000-7000-8000-0000000000ff")], {
        ip: null,
      }),
    ).toEqual([]);
    expect(await filterTrustedEvents([accepted(USER, RESPONSE)], { ip: null })).toHaveLength(1);
    expect(
      await filterTrustedEvents([accepted(USER, RESPONSE, OTHER_PRODUCT)], { ip: null }),
    ).toEqual([]);
  });

  it("una propuesta de la IA simulada no cuenta como generación de IA (ADR-038)", async () => {
    const SIMULATED = "0199a000-0000-7000-8000-0000000000c2";
    db.aIResponse.findMany.mockResolvedValue([
      { id: RESPONSE, request: { userId: USER, provider: "openai_compatible" } },
      { id: SIMULATED, request: { userId: USER, provider: "mock" } },
    ]);
    const proposal = (
      type: "AI_PROPOSAL_GENERATED" | "AI_PROPOSAL_ACCEPTED",
      responseId: string,
    ): TrackedEvent => ({
      type,
      userId: USER,
      ...(type === "AI_PROPOSAL_ACCEPTED" ? { entityType: "PRODUCT", entityId: PRODUCT } : {}),
      surface: "STUDIO",
      metadata: { responseId },
    });

    const kept = await filterTrustedEvents(
      [
        proposal("AI_PROPOSAL_GENERATED", SIMULATED),
        proposal("AI_PROPOSAL_GENERATED", RESPONSE),
        proposal("AI_PROPOSAL_ACCEPTED", SIMULATED),
        proposal("AI_PROPOSAL_ACCEPTED", RESPONSE),
      ],
      { ip: null },
    );
    expect(
      kept.map((event) => [event.type, (event.metadata as { responseId: string }).responseId]),
    ).toEqual([
      ["AI_PROPOSAL_GENERATED", RESPONSE],
      ["AI_PROPOSAL_ACCEPTED", RESPONSE],
    ]);
    // Se consulta el proveedor de la solicitud de cada propuesta.
    expect(db.aIResponse.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true, request: { select: { userId: true, provider: true } } },
      }),
    );
  });
});

describe("needsClientIp", () => {
  it("solo con eventos deduplicables sin persona", () => {
    expect(needsClientIp([productView()])).toBe(false);
    expect(needsClientIp([productView({ userId: null })])).toBe(true);
    expect(needsClientIp([{ type: "SEARCH", query: "x" }])).toBe(false);
  });
});
