import type { ProductStatus } from "@/generated/prisma/enums";

/**
 * Estados de un producto que cambia su vendedor (editar, pausar, reactivar). El checkout aplica
 * las mismas reglas al vender o devolver piezas: activo sin piezas → agotado y al revés.
 */

export type ToggleTarget = "ACTIVE" | "PAUSED";

/** Borrador y archivado no se pausan ni se reactivan desde el Studio. */
const TOGGLEABLE: readonly ProductStatus[] = ["ACTIVE", "SOLD_OUT", "PAUSED"];

/** Estado de un producto a la venta según sus piezas disponibles. */
export function availabilityStatus(stock: number): "ACTIVE" | "SOLD_OUT" {
  return stock > 0 ? "ACTIVE" : "SOLD_OUT";
}

/**
 * Tras editar el inventario: activo sin piezas → agotado; agotado con piezas → activo otra vez.
 * Un producto pausado sigue pausado (su vendedor decide cuándo reactivarlo).
 */
export function statusAfterEdit(current: ProductStatus, stock: number): ProductStatus {
  return current === "ACTIVE" || current === "SOLD_OUT" ? availabilityStatus(stock) : current;
}

/** Pausar o reactivar. Reactivar sin piezas lo deja agotado. `null` si no aplica a su estado. */
export function statusAfterToggle(
  current: ProductStatus,
  target: ToggleTarget,
  stock: number,
): "ACTIVE" | "PAUSED" | "SOLD_OUT" | null {
  if (!TOGGLEABLE.includes(current)) return null;
  return target === "PAUSED" ? "PAUSED" : availabilityStatus(stock);
}

/** Acción que el Studio ofrece para un producto: pausar, reactivar o ninguna. */
export function toggleTargetFor(status: ProductStatus): ToggleTarget | null {
  if (status === "PAUSED") return "ACTIVE";
  return TOGGLEABLE.includes(status) ? "PAUSED" : null;
}
