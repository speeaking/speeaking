import { unavailableCartNotice } from "@/modules/commerce/cart";

/**
 * Aviso de /carrito cuando `listCartRemovingHidden` borró líneas cuyo producto ocultó el equipo
 * (P14): «Quitamos un producto que ya no está disponible». Sale una sola vez: la siguiente carga ya
 * no encuentra esas líneas. Nunca dice por qué (no se revela la moderación). `null` si no se quitó
 * nada.
 */
export function removedHiddenNotice(removed: number): string | null {
  if (removed <= 0) return null;
  return removed === 1
    ? "Quitamos un producto que ya no está disponible"
    : `Quitamos ${removed} productos que ya no están disponibles`;
}

/**
 * Texto anterior del aviso («Un producto ya no está disponible y lo quitamos de tu pedido.»), de
 * cuando el carrito solo omitía las líneas ocultas sin borrarlas.
 *
 * @deprecated /carrito usa `removedHiddenNotice`. Solo lo importa todavía
 * `trust/hidden-leaks.db.test.ts`; se borra junto con `countHiddenCartLines` y
 * `unavailableCartNotice` (commerce/cart.ts) cuando esa prueba cambie.
 */
export function removedFromOrderNotice(hiddenLines: number): string | null {
  const notice = unavailableCartNotice(hiddenLines);
  if (!notice) return null;
  return `${notice} y ${hiddenLines === 1 ? "lo quitamos" : "los quitamos"} de tu pedido.`;
}
