/** Cálculos del panel del vendedor (P2: código determinista y probado). */

export function conversionRate({ orders, visits }: { orders: number; visits: number }) {
  if (visits <= 0) return 0;
  return (orders / visits) * 100;
}

/** Camino de activación hacia la métrica norte (beneficio por vendedor). */
export function sellerActivationSteps(state: {
  products: number;
  shares: number;
  paidOrders: number;
}) {
  return [
    { id: "store", label: "Activa tu tienda", done: true },
    { id: "product", label: "Publica tu primer producto", done: state.products > 0 },
    { id: "share", label: "Compártelo en WhatsApp o Instagram", done: state.shares > 0 },
    { id: "sale", label: "Consigue tu primera venta", done: state.paidOrders > 0 },
  ] as const;
}
