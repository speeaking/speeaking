import { describe, expect, it } from "vitest";
import { EMPTY_METRICS, metricsByPost, totalMetrics } from "./metrics";

const POST = "post-1";
const OTHER = "post-2";
const PRODUCT = "producto-1";

describe("metricsByPost (ADR-063)", () => {
  it("suma visitas, pruebas, carritos y pedidos de cada publicación", () => {
    const metrics = metricsByPost(
      [
        { id: POST, productId: PRODUCT },
        { id: OTHER, productId: "producto-2" },
      ],
      [
        { sourcePostId: POST, entityId: PRODUCT, type: "PRODUCT_VIEW", count: 40 },
        { sourcePostId: POST, entityId: PRODUCT, type: "TRY_ON_GENERATED", count: 9 },
        { sourcePostId: POST, entityId: PRODUCT, type: "TRY_ON_REQUESTED", count: 3 },
        { sourcePostId: POST, entityId: PRODUCT, type: "ADD_TO_CART", count: 5 },
      ],
      [{ sourcePostId: POST, productId: PRODUCT, orders: 2, units: 3 }],
    );

    expect(metrics.get(POST)).toEqual({ views: 40, tryOns: 12, carts: 5, orders: 2, units: 3 });
    // Una publicación sin actividad aparece en ceros.
    expect(metrics.get(OTHER)).toEqual(EMPTY_METRICS);
  });

  it("no cuenta lo que no es del producto de la publicación ni otros tipos de evento", () => {
    const metrics = metricsByPost(
      [{ id: POST, productId: PRODUCT }],
      [
        // Liga armada a mano: otra ficha con `?from=` de esta publicación.
        { sourcePostId: POST, entityId: "otro-producto", type: "PRODUCT_VIEW", count: 99 },
        { sourcePostId: POST, entityId: PRODUCT, type: "IMPRESSION", count: 500 },
        { sourcePostId: "desconocida", entityId: PRODUCT, type: "PRODUCT_VIEW", count: 7 },
        { sourcePostId: null, entityId: PRODUCT, type: "PRODUCT_VIEW", count: 7 },
      ],
      [{ sourcePostId: POST, productId: "otro-producto", orders: 4, units: 4 }],
    );

    expect(metrics.get(POST)).toEqual(EMPTY_METRICS);
    expect(metrics.size).toBe(1);
  });
});

describe("totalMetrics", () => {
  it("suma varias publicaciones", () => {
    expect(
      totalMetrics([
        { views: 10, tryOns: 2, carts: 1, orders: 1, units: 2 },
        { views: 5, tryOns: 0, carts: 0, orders: 0, units: 0 },
      ]),
    ).toEqual({ views: 15, tryOns: 2, carts: 1, orders: 1, units: 2 });
    expect(totalMetrics([])).toEqual(EMPTY_METRICS);
  });
});
