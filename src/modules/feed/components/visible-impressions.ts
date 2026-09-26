import type {
  VisibleImpressionReport,
  VisibleImpressionSurface,
} from "@/modules/analytics/visible-impression-contract";

/**
 * Impresiones VISIBLES en el navegador (T5, ADR-037). Una pieza cuenta cuando al menos la mitad
 * está en pantalla durante 1 segundo continuo con la pestaña a la vista (el estándar de display).
 * Cuenta una vez por pieza y vista de la página; se juntan y se mandan cada 5 s, o con
 * `navigator.sendBeacon` al ocultar o dejar la página, a `POST /api/impressions`, que solo acepta
 * piezas servidas a quien las reporta (`analytics/visible-impressions.ts`).
 *
 * Aquí no hay datos de la persona: solo el id de la publicación, la superficie y la posición. Con la
 * personalización desactivada el servidor la guarda anónima (ADR-030).
 */

/** Fracción de la pieza que debe estar en pantalla. */
export const VISIBLE_RATIO = 0.5;
/** Tiempo continuo en pantalla (con la pestaña visible) para contar. */
export const VISIBLE_DWELL_MS = 1_000;
/** Cada cuánto se manda lo visto. */
export const FLUSH_INTERVAL_MS = 5_000;
/** Piezas por petición: el mismo tope que valida el servidor (`MAX_VISIBLE_IMPRESSIONS_PER_REQUEST`). */
export const MAX_BATCH = 50;
export const IMPRESSIONS_ENDPOINT = "/api/impressions";
/** Umbrales del observador: cada 10 % (así también se detecta una pieza más alta que la pantalla). */
export const OBSERVER_THRESHOLDS = Array.from({ length: 11 }, (_, index) => index / 10);

/** Atributos que `FeedList` pone en el contenedor de cada pieza del feed. */
export const IMPRESSION_POST_ATTRIBUTE = "data-impression-post";
export const IMPRESSION_POSITION_ATTRIBUTE = "data-impression-position";

type Timer = ReturnType<typeof setTimeout>;

type EntryLike = {
  isIntersecting: boolean;
  intersectionRatio: number;
  intersectionRect?: { height: number } | null;
  rootBounds?: { height: number } | null;
};

/**
 * ¿La pieza está «en pantalla»? Al menos la mitad de ella. Una pieza más alta que dos pantallas nunca
 * llega a la mitad: cuenta si ocupa al menos media pantalla (si no, las publicaciones largas nunca
 * contarían).
 */
export function isViewable(entry: EntryLike): boolean {
  if (!entry.isIntersecting) return false;
  if (entry.intersectionRatio >= VISIBLE_RATIO) return true;
  const root = entry.rootBounds?.height ?? 0;
  return root > 0 && (entry.intersectionRect?.height ?? 0) >= root * VISIBLE_RATIO;
}

/**
 * Cronómetro de cada pieza: arranca cuando entra en pantalla (y la pestaña está visible), se cancela
 * si sale antes de 1 s o si la pestaña se oculta (al volver, el segundo empieza de nuevo: debe ser
 * continuo), y al cumplirse avisa UNA sola vez por pieza.
 */
export class ViewabilityTracker {
  private readonly inView = new Set<string>();
  private readonly timers = new Map<string, Timer>();
  private readonly counted = new Set<string>();
  private pageVisible: boolean;
  private readonly dwellMs: number;

  constructor(
    private readonly onVisible: (id: string) => void,
    options: { pageVisible?: boolean; dwellMs?: number } = {},
  ) {
    this.pageVisible = options.pageVisible ?? true;
    this.dwellMs = options.dwellMs ?? VISIBLE_DWELL_MS;
  }

  /** La pieza entró (`true`) o salió (`false`) de la pantalla. */
  update(id: string, visible: boolean) {
    if (this.counted.has(id)) return;
    if (visible) {
      this.inView.add(id);
      this.arm(id);
    } else {
      this.inView.delete(id);
      this.disarm(id);
    }
  }

  /** La pestaña se ocultó (se pausa todo) o volvió (se reanuda lo que sigue en pantalla). */
  setPageVisible(visible: boolean) {
    this.pageVisible = visible;
    if (visible) {
      for (const id of this.inView) this.arm(id);
    } else {
      for (const id of [...this.timers.keys()]) this.disarm(id);
    }
  }

  /** La pieza ya no está en la lista. */
  forget(id: string) {
    this.inView.delete(id);
    this.disarm(id);
  }

  hasCounted(id: string) {
    return this.counted.has(id);
  }

  dispose() {
    for (const id of [...this.timers.keys()]) this.disarm(id);
    this.inView.clear();
  }

  private arm(id: string) {
    if (!this.pageVisible || this.timers.has(id) || this.counted.has(id)) return;
    this.timers.set(
      id,
      setTimeout(() => {
        this.timers.delete(id);
        this.inView.delete(id);
        this.counted.add(id);
        this.onVisible(id);
      }, this.dwellMs),
    );
  }

  private disarm(id: string) {
    const timer = this.timers.get(id);
    if (timer === undefined) return;
    clearTimeout(timer);
    this.timers.delete(id);
  }
}

export type TransportMode = "fetch" | "beacon";
export type ImpressionTransport = (items: VisibleImpressionReport[], mode: TransportMode) => void;

/** Cola de lo visto: se vacía en lotes de a lo más `MAX_BATCH`. */
export class ImpressionBatcher {
  private queue: VisibleImpressionReport[] = [];

  constructor(private readonly send: ImpressionTransport) {}

  add(item: VisibleImpressionReport) {
    this.queue.push(item);
  }

  get size() {
    return this.queue.length;
  }

  flush(mode: TransportMode) {
    while (this.queue.length > 0) {
      this.send(this.queue.splice(0, MAX_BATCH), mode);
    }
  }
}

/**
 * Manda un lote. Al salir de la página, `sendBeacon` (sobrevive a la navegación) como `text/plain`
 * (no necesita permiso previo); si no se puede, `fetch` con `keepalive`. Un error se ignora: se
 * cuenta de menos, nunca de más.
 */
export function sendImpressions(items: VisibleImpressionReport[], mode: TransportMode) {
  const body = JSON.stringify({ items });
  if (mode === "beacon" && typeof navigator !== "undefined" && "sendBeacon" in navigator) {
    try {
      const blob = new Blob([body], { type: "text/plain;charset=UTF-8" });
      if (navigator.sendBeacon(IMPRESSIONS_ENDPOINT, blob)) return;
    } catch {
      // Sin beacon: se intenta con fetch.
    }
  }
  if (typeof fetch !== "function") return;
  fetch(IMPRESSIONS_ENDPOINT, {
    method: "POST",
    body,
    keepalive: true,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
  }).catch(() => {});
}

type Target = { postId: string; position: number };

/**
 * Todo lo de una vista del feed: observador, cronómetros, cola y oyentes de la página. `observe`
 * lee el id y la posición de los atributos del contenedor de cada pieza.
 */
export class VisibleImpressionSession {
  private readonly targets = new Map<Element, Target>();
  private readonly positions = new Map<string, number>();
  private readonly tracker: ViewabilityTracker;
  private readonly batcher: ImpressionBatcher;
  private observer: IntersectionObserver | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;
  private started = false;

  constructor(
    readonly surface: VisibleImpressionSurface,
    readonly transport: ImpressionTransport = sendImpressions,
  ) {
    this.batcher = new ImpressionBatcher(transport);
    this.tracker = new ViewabilityTracker(
      (postId) => {
        const position = this.positions.get(postId);
        if (position === undefined) return;
        this.batcher.add({ postId, surface: this.surface, position });
      },
      { pageVisible: pageIsVisible() },
    );
  }

  start() {
    if (this.started || typeof IntersectionObserver === "undefined") return;
    this.started = true;
    this.observer = new IntersectionObserver(this.onEntries, { threshold: OBSERVER_THRESHOLDS });
    for (const element of this.targets.keys()) this.observer.observe(element);
    this.tracker.setPageVisible(pageIsVisible());
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    window.addEventListener("pagehide", this.onPageHide);
    this.interval = setInterval(() => this.batcher.flush("fetch"), FLUSH_INTERVAL_MS);
  }

  stop() {
    if (!this.started) return;
    this.started = false;
    this.observer?.disconnect();
    this.observer = null;
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    window.removeEventListener("pagehide", this.onPageHide);
    if (this.interval !== null) clearInterval(this.interval);
    this.interval = null;
    this.tracker.dispose();
    // Lo que ya cumplió su segundo se manda aunque la lista se desmonte (p. ej. al navegar).
    this.batcher.flush("beacon");
  }

  observe(element: Element) {
    const postId = element.getAttribute(IMPRESSION_POST_ATTRIBUTE);
    const position = Number(element.getAttribute(IMPRESSION_POSITION_ATTRIBUTE));
    if (!postId || !Number.isInteger(position) || position < 0) return;
    this.targets.set(element, { postId, position });
    this.positions.set(postId, position);
    this.observer?.observe(element);
  }

  unobserve(element: Element) {
    const target = this.targets.get(element);
    if (!target) return;
    this.targets.delete(element);
    this.observer?.unobserve(element);
    this.tracker.forget(target.postId);
  }

  private readonly onEntries = (entries: readonly (EntryLike & { target?: Element })[]) => {
    for (const entry of entries) {
      const target = entry.target ? this.targets.get(entry.target) : undefined;
      if (target) this.tracker.update(target.postId, isViewable(entry));
    }
  };

  private readonly onVisibilityChange = () => {
    const visible = pageIsVisible();
    this.tracker.setPageVisible(visible);
    // Al ocultar la pestaña (cambiar de app en el teléfono) puede no volver: se manda ya.
    if (!visible) this.batcher.flush("beacon");
  };

  private readonly onPageHide = () => {
    this.batcher.flush("beacon");
  };
}

function pageIsVisible() {
  return typeof document === "undefined" || document.visibilityState === "visible";
}
