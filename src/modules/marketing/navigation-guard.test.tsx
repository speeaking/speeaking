import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { installNavigationGuard } from "./navigation-guard";

// Lo que el pixel permite: solo páginas públicas (como `pixelAllowedOn` sin sesión).
const PUBLIC = new Set(["/comprar", "/precios", "/registro", "/bienvenida"]);
const allowed = (pathname: string) => PUBLIC.has(pathname) || pathname.startsWith("/producto/");

let uninstall: () => void = () => {};
let navigate: Mock<(url: string, how: "assign" | "reload") => void>;
const originalPush = History.prototype.pushState;
const originalReplace = History.prototype.replaceState;

beforeEach(() => {
  window.history.replaceState(null, "", "/comprar");
  navigate = vi.fn<(url: string, how: "assign" | "reload") => void>();
  uninstall = installNavigationGuard({ allowed, navigate });
});

afterEach(() => {
  uninstall();
  // La página vuelve a los métodos del navegador.
  delete (window.history as unknown as Record<string, unknown>).pushState;
  delete (window.history as unknown as Record<string, unknown>).replaceState;
  History.prototype.pushState = originalPush;
  History.prototype.replaceState = originalReplace;
  document.body.innerHTML = "";
});

describe("installNavigationGuard (ADR-072): el pixel nunca ve una página privada", () => {
  it("navegar dentro de la app a una página no permitida se vuelve una carga completa", () => {
    window.history.pushState(null, "", "/c/hogar");

    expect(navigate).toHaveBeenCalledWith("http://localhost:3000/c/hogar", "assign");
    expect(window.location.pathname).toBe("/comprar");
  });

  it("entre páginas públicas sigue siendo navegación de la app (sin recargar)", () => {
    window.history.pushState(null, "", "/producto/vela-9b0c59");
    window.history.pushState(null, "", "/comprar?categoria=decoracion");
    window.history.replaceState({ scroll: 1 }, "", "/comprar?categoria=decoracion");

    expect(navigate).not.toHaveBeenCalled();
    expect(window.location.pathname + window.location.search).toBe("/comprar?categoria=decoracion");
  });

  it("si TikTok envuelve pushState después, el guardián sigue por fuera y TikTok no se entera", () => {
    const tiktokSaw: string[] = [];
    const inner = window.history.pushState;
    window.history.pushState = function (data, unused, url) {
      tiktokSaw.push(String(url));
      return inner.call(window.history, data, unused, url);
    };

    window.history.pushState(null, "", "/precios");
    window.history.pushState(null, "", "/mensajes/abc");

    expect(tiktokSaw).toEqual(["/precios"]);
    expect(navigate).toHaveBeenCalledWith("http://localhost:3000/mensajes/abc", "assign");
  });

  it("un clic en un enlace a una página no permitida recarga antes de que la app la muestre", () => {
    document.body.innerHTML =
      '<a href="/u/issac"><span>Perfil</span></a><a href="/precios">Precios</a>';
    const [privateLink, publicLink] = document.querySelectorAll("a");

    const privateClick = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    privateLink!.querySelector("span")!.dispatchEvent(privateClick);
    const publicClick = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    publicLink!.dispatchEvent(publicClick);

    expect(privateClick.defaultPrevented).toBe(true);
    expect(navigate).toHaveBeenCalledWith("http://localhost:3000/u/issac", "assign");
    expect(publicClick.defaultPrevented).toBe(false);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it("no toca enlaces externos, en otra pestaña ni con teclas de modificación", () => {
    document.body.innerHTML =
      '<a href="https://www.tiktok.com/@speeaking">TikTok</a><a href="/u/a" target="_blank">A</a><a href="/u/b">B</a>';
    const [external, newTab, modified] = document.querySelectorAll("a");

    external!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    newTab!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    modified!.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true }),
    );

    expect(navigate).not.toHaveBeenCalled();
  });

  it("atrás o adelante hacia una página no permitida recarga y TikTok no recibe el aviso", () => {
    const tiktokPopstate = vi.fn();
    // TikTok escucha después del guardián (carga más tarde).
    window.addEventListener("popstate", tiktokPopstate);
    originalReplace.call(window.history, null, "", "/c/hogar");

    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(navigate).toHaveBeenCalledWith("http://localhost:3000/c/hogar", "reload");
    expect(tiktokPopstate).not.toHaveBeenCalled();
    window.removeEventListener("popstate", tiktokPopstate);
  });
});
