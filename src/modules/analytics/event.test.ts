import { describe, expect, it } from "vitest";
import { anonymousMetadata, prepareEvent, truncateToHour } from "./event";

const base = {
  type: "PRODUCT_VIEW" as const,
  userId: "0199a000-0000-7000-8000-000000000001",
  anonymousId: "anon-1",
  entityType: "PRODUCT" as const,
  entityId: "0199a000-0000-7000-8000-000000000002",
  sourcePostId: "0199a000-0000-7000-8000-000000000003",
  surface: "FEED" as const,
  position: 3,
};

const NOW = new Date("2026-09-26T14:37:52.123Z");

describe("prepareEvent", () => {
  it("con personalización conserva la vinculación con la persona y la atribución", () => {
    const data = prepareEvent({ ...base, metadata: { checkoutId: "x", quantity: 2 } }, true, NOW);

    expect(data.userId).toBe(base.userId);
    expect(data.sourcePostId).toBe(base.sourcePostId);
    expect(data.position).toBe(3);
    expect(data.metadata).toEqual({ checkoutId: "x", quantity: 2 });
    // La hora exacta la pone la base.
    expect(data.createdAt).toBeUndefined();
  });

  it("sin personalización anonimiza pero conserva el evento para métricas agregadas", () => {
    const data = prepareEvent(base, false, NOW);

    expect(data.userId).toBeNull();
    expect(data.anonymousId).toBeNull();
    expect(data.entityId).toBe(base.entityId);
    expect(data.sourcePostId).toBe(base.sourcePostId);
  });

  it("recorta las búsquedas largas y descarta las vacías", () => {
    expect(
      prepareEvent({ type: "SEARCH", query: "  " + "a".repeat(300) }, true).query,
    ).toHaveLength(120);
    expect(prepareEvent({ type: "SEARCH", query: "   " }, true).query).toBeUndefined();
  });
});

describe("prepareEvent sin personalización no deja con qué re-identificar (SEC-16)", () => {
  it("descarta los ids de la metadata (checkoutId, orderId, responseId) y conserva los conteos", () => {
    const checkout = prepareEvent(
      {
        type: "CHECKOUT_STARTED",
        userId: base.userId,
        entityType: "PRODUCT",
        entityId: base.entityId,
        metadata: { checkoutId: "0199a000-0000-7000-8000-00000000000c", quantity: 2 },
      },
      false,
      NOW,
    );
    const purchase = prepareEvent(
      { type: "PURCHASE", metadata: { orderId: "0199a000-0000-7000-8000-00000000000d" } },
      false,
      NOW,
    );

    expect(checkout.metadata).toEqual({ quantity: 2 });
    expect(purchase.metadata).toBeUndefined();
  });

  it("descarta el texto de la búsqueda", () => {
    const data = prepareEvent(
      { type: "SEARCH", userId: base.userId, query: "dermatólogo acné", metadata: { products: 0 } },
      false,
      NOW,
    );

    expect(data.query).toBeUndefined();
    expect(data.metadata).toEqual({ products: 0 });
  });

  it("trunca la hora: una marca al milisegundo se une con checkouts.createdAt o con los UUIDv7", () => {
    expect(prepareEvent(base, false, NOW).createdAt).toEqual(new Date("2026-09-26T14:00:00.000Z"));
  });

  it("en las propuestas de IA descarta la entidad: es el producto de la propia persona", () => {
    const generated = prepareEvent(
      { type: "AI_PROPOSAL_GENERATED", userId: base.userId, metadata: { responseId: "r" } },
      false,
      NOW,
    );
    const accepted = prepareEvent(
      {
        type: "AI_PROPOSAL_ACCEPTED",
        userId: base.userId,
        entityType: "PRODUCT",
        entityId: base.entityId,
        metadata: { responseId: "0199a000-0000-7000-8000-00000000000e" },
      },
      false,
      NOW,
    );

    expect(generated.metadata).toBeUndefined();
    expect(accepted.entityType).toBeUndefined();
    expect(accepted.entityId).toBeUndefined();
    expect(accepted.metadata).toBeUndefined();
  });
});

describe("anonymousMetadata", () => {
  it("solo deja llaves permitidas con números, booleanos o categorías sin dígitos", () => {
    expect(
      anonymousMetadata({
        channel: "copy",
        slot: "commerce",
        reason: "explore",
        scope: "global",
        quantity: 3,
        responseId: "0199a000-0000-7000-8000-000000000001",
        email: "ana@example.com",
      }),
    ).toEqual({ channel: "copy", slot: "commerce", reason: "explore", scope: "global", quantity: 3 });
  });

  it("descarta un valor permitido que parezca id, teléfono o texto libre", () => {
    expect(
      anonymousMetadata({
        channel: "0199a000-0000-7000-8000-000000000001",
        reason: "55 1234 5678",
        scope: "busco a Ana López",
        quantity: Number.NaN,
      }),
    ).toBeUndefined();
  });

  it("ignora metadata que no es un objeto", () => {
    expect(anonymousMetadata(["checkoutId"])).toBeUndefined();
    expect(anonymousMetadata("orderId")).toBeUndefined();
    expect(anonymousMetadata(undefined)).toBeUndefined();
  });
});

describe("truncateToHour", () => {
  it("baja al inicio de la hora (UTC; México no tiene desfase de minutos)", () => {
    expect(truncateToHour(new Date("2026-09-26T00:59:59.999Z"))).toEqual(
      new Date("2026-09-26T00:00:00.000Z"),
    );
  });
});
