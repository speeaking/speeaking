import { describe, expect, it } from "vitest";
import {
  cancellationLevel,
  dailySeries,
  dispatchLevel,
  funnel,
  isProductPending,
  median,
  PERFORMANCE_MIN_ORDERS,
  PRODUCT_PENDINGS,
  productPendingFromSlug,
  productPendings,
  rankProductActivity,
  salesPendings,
  sellerPerformance,
  trend,
} from "./seller-panel";

const HOUR = 60 * 60 * 1000;
// 1 de octubre de 2026, 12:00 en Ciudad de México (UTC−6, sin horario de verano).
const NOW = new Date("2026-10-01T18:00:00Z");

describe("trend", () => {
  it("compara con el periodo anterior en porcentaje con un decimal", () => {
    expect(trend(110_275, 118_300)).toEqual({ value: 110_275, previous: 118_300, changePct: -6.8 });
    expect(trend(150, 100).changePct).toBe(50);
  });

  it("sin periodo anterior no hay porcentaje (no es «+∞ %»)", () => {
    expect(trend(500, 0).changePct).toBeNull();
    expect(trend(0, 0).changePct).toBeNull();
  });
});

describe("dailySeries", () => {
  it("siete días terminando hoy, con el día de la semana en español y en hora de México", () => {
    const series = dailySeries(
      [
        { at: new Date("2026-10-01T15:00:00Z"), value: 649 },
        // 30 de septiembre a las 23:30 en México (ya es 1 de octubre en UTC).
        { at: new Date("2026-10-01T05:30:00Z"), value: 100 },
        { at: new Date("2026-09-25T18:00:00Z"), value: 50 },
        // Fuera de la ventana: no cuenta.
        { at: new Date("2026-09-20T18:00:00Z"), value: 999 },
      ],
      7,
      NOW,
    );

    expect(series.map((point) => point.day)).toEqual([
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
    ]);
    expect(series.map((point) => point.value)).toEqual([50, 0, 0, 0, 0, 100, 649]);
    expect(series.at(-1)?.label).toBe("jue");
    expect(series[0]?.label).toBe("vie");
  });
});

describe("median", () => {
  it("con números impares y pares; sin datos, null", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("niveles de desempeño", () => {
  it("despacho: hasta 24 h excelente, hasta 72 h bien, después por mejorar", () => {
    expect(dispatchLevel(24)).toBe("excelente");
    expect(dispatchLevel(24.1)).toBe("bien");
    expect(dispatchLevel(72)).toBe("bien");
    expect(dispatchLevel(73)).toBe("por_mejorar");
  });

  it("cancelaciones: menos de 2 % excelente, menos de 5 % bien", () => {
    expect(cancellationLevel(0)).toBe("excelente");
    expect(cancellationLevel(0.019)).toBe("excelente");
    expect(cancellationLevel(0.02)).toBe("bien");
    expect(cancellationLevel(0.049)).toBe("bien");
    expect(cancellationLevel(0.05)).toBe("por_mejorar");
  });
});

describe("sellerPerformance", () => {
  const paid = (hoursAgo: number, dispatchedAfterHours: number | null, cancelled = false) => ({
    paidAt: new Date(NOW.getTime() - hoursAgo * HOUR),
    dispatchedAt:
      dispatchedAfterHours === null
        ? null
        : new Date(NOW.getTime() - hoursAgo * HOUR + dispatchedAfterHours * HOUR),
    cancelled,
  });

  it(`con menos de ${PERFORMANCE_MIN_ORDERS} pedidos con cobro real no califica`, () => {
    expect(sellerPerformance({ paidOrders: [paid(50, 10), paid(40, 5)], now: NOW })).toEqual({
      enough: false,
      orders: 2,
      needed: PERFORMANCE_MIN_ORDERS,
    });
  });

  it("mediana de horas para despachar, pedidos atrasados y tasa de cancelación", () => {
    const result = sellerPerformance({
      paidOrders: [
        paid(200, 10),
        paid(150, 20),
        paid(120, 30),
        paid(100, 80),
        paid(90, null), // atrasado: lleva 90 h sin despachar
        paid(10, null), // reciente: todavía a tiempo
        paid(60, null, true),
      ],
      now: NOW,
    });

    expect(result).toEqual({
      enough: true,
      orders: 7,
      dispatch: { medianHours: 25, level: "bien", overdue: 1 },
      cancellation: { rate: 1 / 7, level: "por_mejorar", cancelled: 1 },
    });
  });

  it("sin despachos todavía, el despacho queda sin nivel", () => {
    const orders = Array.from({ length: 5 }, () => paid(5, null));
    const result = sellerPerformance({ paidOrders: orders, now: NOW });
    expect(result.enough && result.dispatch).toEqual({
      medianHours: null,
      level: null,
      overdue: 0,
    });
  });
});

describe("funnel", () => {
  it("cada paso dice cuántas de cada 100 visitas llegaron hasta ahí", () => {
    expect(funnel({ visits: 200, saves: 30, carts: 9, orders: 3 })).toEqual([
      { id: "visits", label: "Visitas", count: 200, per100: 100 },
      { id: "saves", label: "Guardados", count: 30, per100: 15 },
      { id: "carts", label: "Al carrito", count: 9, per100: 4.5 },
      { id: "orders", label: "Pedidos", count: 3, per100: 1.5 },
    ]);
  });

  it("sin visitas no hay porcentajes", () => {
    expect(funnel({ visits: 0, saves: 0, carts: 0, orders: 0 }).map((step) => step.per100)).toEqual(
      [null, null, null, null],
    );
  });
});

describe("productPendings", () => {
  const product = (overrides: Partial<Parameters<typeof productPendings>[0][number]> = {}) => ({
    status: "ACTIVE" as const,
    stock: 3,
    hidden: false,
    hasImage: true,
    authenticityStatus: null,
    ...overrides,
  });

  it("cuenta ocultos, agotados, sin foto, borradores y comprobantes pendientes", () => {
    expect(
      productPendings([
        product(),
        product({ hidden: true }),
        product({ stock: 0 }),
        product({ status: "SOLD_OUT", stock: 0 }),
        product({ hasImage: false }),
        product({ status: "DRAFT", hasImage: false }),
        product({ authenticityStatus: "NEEDS_PROOF" }),
        // Lo archivado ya no pide nada.
        product({ status: "ARCHIVED", hidden: true, hasImage: false }),
      ]),
    ).toEqual({ hidden: 1, soldOut: 2, noPhoto: 2, drafts: 1, needsProof: 1, total: 7 });
  });

  it("un producto oculto no se cuenta además como agotado", () => {
    expect(productPendings([product({ hidden: true, stock: 0 })])).toMatchObject({
      hidden: 1,
      soldOut: 0,
    });
  });

  it("cada pendiente tiene su filtro en Productos con la misma regla", () => {
    expect(productPendingFromSlug("agotados")).toBe("soldOut");
    expect(productPendingFromSlug("sin-foto")).toBe("noPhoto");
    expect(productPendingFromSlug("lo-que-sea")).toBeNull();
    expect(productPendingFromSlug(undefined)).toBeNull();
    expect(PRODUCT_PENDINGS.needsProof.slug).toBe("comprobante");
    expect(isProductPending(product({ stock: 0 }), "soldOut")).toBe(true);
    expect(isProductPending(product({ status: "ARCHIVED", stock: 0 }), "soldOut")).toBe(false);
  });
});

describe("salesPendings", () => {
  const order = (
    status: "PAID" | "SHIPPED" | "DELIVERED" | "CANCELLED",
    hoursAgo: number,
    simulated = false,
  ) => ({ status, paidAt: new Date(NOW.getTime() - hoursAgo * HOUR), simulated });

  it("por despachar con el más antiguo, en camino y pagos simulados por cancelar", () => {
    expect(
      salesPendings(
        [
          order("PAID", 5),
          order("PAID", 30),
          order("SHIPPED", 40),
          order("PAID", 2, true),
          order("DELIVERED", 90),
          order("CANCELLED", 3),
        ],
        NOW,
      ),
    ).toEqual({
      toDispatch: 2,
      oldestToDispatchHours: 30,
      inTransit: 1,
      simulatedToCancel: 1,
      total: 4,
    });
  });

  it("sin pendientes todo en cero", () => {
    expect(salesPendings([order("DELIVERED", 10)], NOW)).toEqual({
      toDispatch: 0,
      oldestToDispatchHours: null,
      inTransit: 0,
      simulatedToCancel: 0,
      total: 0,
    });
  });
});

describe("rankProductActivity", () => {
  it("ordena por visitas, luego pedidos, y calcula la conversión", () => {
    const row = (id: string, views: number, orders: number) => ({
      productId: id,
      title: id,
      views,
      saves: 0,
      carts: 0,
      tryOns: 0,
      orders,
    });

    const ranked = rankProductActivity([row("a", 10, 0), row("b", 50, 1), row("c", 10, 2)]);

    expect(ranked.map((item) => item.productId)).toEqual(["b", "c", "a"]);
    expect(ranked[0]?.conversion).toBe(2);
    expect(rankProductActivity([row("a", 0, 0)])[0]?.conversion).toBe(0);
  });
});
