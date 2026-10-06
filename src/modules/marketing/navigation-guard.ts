/**
 * Con el pixel de TikTok cargado, la app nunca navega «por dentro» hacia una página donde el pixel
 * no va (ADR-072). El script de TikTok detecta solo los cambios de URL de la app (`pushState`,
 * atrás/adelante) y manda la página vista ANTES de que nuestro código pueda retirarle el permiso:
 * así se colaban `/c/hogar` o el feed con sesión (prueba en vivo del 2026-10-06). Aquí esas
 * navegaciones se vuelven cargas completas: el documento con TikTok se descarta y la página privada
 * se abre en uno nuevo, sin pixel.
 *
 * - Clic en un enlace propio hacia una página no permitida: se recarga antes de que la app la pinte.
 * - `pushState` / `replaceState` (redirecciones de acciones del servidor, `router.push`): el
 *   guardián queda siempre por fuera, aunque TikTok envuelva esos métodos después de cargar.
 * - Atrás o adelante: se escucha antes que TikTok y se le corta el aviso.
 */

type HistoryMethod = (data: unknown, unused: string, url?: string | URL | null) => void;
type Navigate = (url: string, how: "assign" | "reload") => void;

const METHODS = ["pushState", "replaceState"] as const;

export function installNavigationGuard({
  allowed,
  navigate,
}: {
  /** ¿El pixel puede estar en esta ruta (con la sesión de ahora)? */
  allowed: (pathname: string) => boolean;
  /** Carga completa (`location.assign` o `location.reload`). */
  navigate: Navigate;
}): () => void {
  const leaves = (url: URL) =>
    url.origin === location.origin && url.pathname !== location.pathname && !allowed(url.pathname);

  for (const name of METHODS) {
    const native = window.history[name] as HistoryMethod;
    // Quien envuelva el método después (TikTok) guarda el guardián y lo llama dentro de su
    // envoltorio: la primera llamada pasa por el envoltorio y la de regreso va al navegador.
    let wrapper: HistoryMethod | null = null;
    let insideWrapper = false;
    const guard: HistoryMethod = (data, unused, url) => {
      if (url !== undefined && url !== null) {
        const target = new URL(String(url), location.href);
        if (leaves(target)) {
          navigate(target.href, "assign");
          return;
        }
      }
      if (wrapper && !insideWrapper) {
        insideWrapper = true;
        try {
          wrapper.call(window.history, data, unused, url);
        } finally {
          insideWrapper = false;
        }
        return;
      }
      native.call(window.history, data, unused, url);
    };
    // El guardián queda siempre por fuera: asignar el método solo cambia el envoltorio interno.
    Object.defineProperty(window.history, name, {
      configurable: true,
      get: () => guard,
      set: (value: HistoryMethod) => {
        if (value !== guard) wrapper = value;
      },
    });
  }

  const onClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element | null)?.closest?.("a[href]");
    if (!(link instanceof HTMLAnchorElement) || (link.target && link.target !== "_self")) return;
    if (link.hasAttribute("download")) return;
    const target = new URL(link.href, location.href);
    if (!leaves(target)) return;
    event.preventDefault();
    navigate(target.href, "assign");
  };

  const onPopState = (event: PopStateEvent) => {
    if (allowed(location.pathname)) return;
    // Antes que TikTok (que escucha después): no se entera de la página privada.
    event.stopImmediatePropagation();
    navigate(location.href, "reload");
  };

  document.addEventListener("click", onClick, true);
  window.addEventListener("popstate", onPopState);

  return () => {
    document.removeEventListener("click", onClick, true);
    window.removeEventListener("popstate", onPopState);
  };
}
