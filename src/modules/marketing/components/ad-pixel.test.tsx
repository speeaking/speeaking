import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/comprar" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

const { AdPixel } = await import("./ad-pixel");
const { RegistrationEvent } = await import("./registration-event");

const PIXEL_ID = "DB2LL7RC77UA626EHMOG";

type Queued = [string, ...unknown[]];

function tiktokScripts() {
  return [...document.querySelectorAll("script")].filter((script) =>
    script.src.startsWith("https://analytics.tiktok.com/"),
  );
}

/** Llamadas que el pixel dejó en la cola de `ttq` (se envían cuando carga el script de TikTok). */
function queued(): Queued[] {
  return ((window as unknown as { ttq?: Queued[] }).ttq ?? []).filter(Array.isArray);
}

function clearCookies() {
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=; Max-Age=0; Path=/`;
  }
}

beforeEach(() => {
  navigation.pathname = "/comprar";
  // Un <script> previo donde el pixel inserta el suyo, como en una página real.
  document.head.append(Object.assign(document.createElement("script"), { id: "app" }));
});

afterEach(() => {
  clearCookies();
  localStorage.clear();
  for (const script of document.querySelectorAll("script")) script.remove();
  delete (window as unknown as { ttq?: unknown }).ttq;
  delete (window as unknown as { TiktokAnalyticsObject?: unknown }).TiktokAnalyticsObject;
  // El guardián de navegación vuelve a los métodos del navegador.
  delete (window.history as unknown as Record<string, unknown>).pushState;
  delete (window.history as unknown as Record<string, unknown>).replaceState;
});

describe("AdPixel (ADR-072): el pixel de TikTok solo con permiso y solo en páginas públicas", () => {
  it("sin pixel configurado no muestra nada ni carga nada", () => {
    const { container } = render(<AdPixel pixelId={null} signedIn={false} />);

    expect(container).toBeEmptyDOMElement();
    expect(tiktokScripts()).toHaveLength(0);
  });

  it("sin decidir, pregunta antes de cargar y explica dónde nunca se usa", () => {
    render(<AdPixel pixelId={PIXEL_ID} signedIn={false} />);

    expect(screen.getByRole("region", { name: "Medición de anuncios" })).toHaveTextContent(
      /nunca en tus mensajes, pedidos ni tu perfil/i,
    );
    expect(screen.getByRole("link", { name: "Más información" })).toHaveAttribute(
      "href",
      "/cookies#anuncios",
    );
    expect(tiktokScripts()).toHaveLength(0);
  });

  it("al aceptar guarda la decisión, carga el pixel con permiso y cuenta la página", async () => {
    render(<AdPixel pixelId={PIXEL_ID} signedIn={false} />);

    await userEvent.click(screen.getByRole("button", { name: "Aceptar" }));

    expect(document.cookie).toContain("speeaking_anuncios=si");
    expect(screen.queryByRole("region", { name: "Medición de anuncios" })).not.toBeInTheDocument();
    expect(tiktokScripts().map((script) => script.src)).toEqual([
      `https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${PIXEL_ID}&lib=ttq`,
    ]);
    expect(queued().map(([method]) => method)).toEqual(["holdConsent", "grantConsent", "page"]);
  });

  it("con el pixel cargado, la app ya no puede navegar por dentro a una página privada", async () => {
    // Sin pixel, la navegación de la app queda intacta.
    expect(Object.getOwnPropertyDescriptor(window.history, "pushState")).toBeUndefined();
    render(<AdPixel pixelId={PIXEL_ID} signedIn={false} />);

    await userEvent.click(screen.getByRole("button", { name: "Aceptar" }));

    // El guardián (navigation-guard.ts) queda por fuera de pushState antes del script de TikTok.
    expect(Object.getOwnPropertyDescriptor(window.history, "pushState")?.get).toBeTypeOf(
      "function",
    );
  });

  it("al rechazar guarda la decisión y no carga nada", async () => {
    render(<AdPixel pixelId={PIXEL_ID} signedIn={false} />);

    await userEvent.click(screen.getByRole("button", { name: "No, gracias" }));

    expect(document.cookie).toContain("speeaking_anuncios=no");
    expect(screen.queryByRole("region", { name: "Medición de anuncios" })).not.toBeInTheDocument();
    expect(tiktokScripts()).toHaveLength(0);
  });

  it("con permiso guardado carga sin preguntar; en una página privada no pregunta ni carga", () => {
    document.cookie = "speeaking_anuncios=si; Path=/";
    const { unmount } = render(<AdPixel pixelId={PIXEL_ID} signedIn={false} />);
    expect(screen.queryByRole("region", { name: "Medición de anuncios" })).not.toBeInTheDocument();
    expect(tiktokScripts()).toHaveLength(1);
    unmount();

    clearCookies();
    for (const script of tiktokScripts()) script.remove();
    delete (window as unknown as { ttq?: unknown }).ttq;
    navigation.pathname = "/mensajes";
    render(<AdPixel pixelId={PIXEL_ID} signedIn={false} />);
    expect(screen.queryByRole("region", { name: "Medición de anuncios" })).not.toBeInTheDocument();
    expect(tiktokScripts()).toHaveLength(0);
  });

  it("con sesión (el feed) no carga aunque haya permiso, y si ya estaba cargado retira el permiso", () => {
    document.cookie = "speeaking_anuncios=si; Path=/";
    navigation.pathname = "/registro";
    const { rerender } = render(<AdPixel pixelId={PIXEL_ID} signedIn={false} />);
    expect(tiktokScripts()).toHaveLength(1);

    // Entró a su cuenta y llegó al feed: nada de lo que vea ahí sale hacia TikTok.
    navigation.pathname = "/";
    rerender(<AdPixel pixelId={PIXEL_ID} signedIn />);
    expect(queued().map(([method]) => method)).toEqual([
      "holdConsent",
      "grantConsent",
      "page",
      "revokeConsent",
    ]);
    expect(tiktokScripts()).toHaveLength(1);
  });

  it("al volver a una página pública con permiso, lo devuelve y cuenta la nueva página", () => {
    document.cookie = "speeaking_anuncios=si; Path=/";
    navigation.pathname = "/comprar";
    const { rerender } = render(<AdPixel pixelId={PIXEL_ID} signedIn={false} />);
    navigation.pathname = "/entrar";
    rerender(<AdPixel pixelId={PIXEL_ID} signedIn={false} />);
    navigation.pathname = "/precios";
    rerender(<AdPixel pixelId={PIXEL_ID} signedIn={false} />);

    expect(queued().map(([method]) => method)).toEqual([
      "holdConsent",
      "grantConsent",
      "page",
      "revokeConsent",
      "grantConsent",
      "page",
    ]);
  });
});

describe("RegistrationEvent: el registro completo, una sola vez y solo con permiso", () => {
  it("con permiso, en la bienvenida, manda CompleteRegistration una vez por navegador", () => {
    document.cookie = "speeaking_anuncios=si; Path=/";
    navigation.pathname = "/bienvenida";
    const { unmount } = render(
      <>
        <AdPixel pixelId={PIXEL_ID} signedIn />
        <RegistrationEvent />
      </>,
    );
    unmount();
    render(
      <>
        <AdPixel pixelId={PIXEL_ID} signedIn />
        <RegistrationEvent />
      </>,
    );

    expect(queued().filter(([method]) => method === "track")).toEqual([
      ["track", "CompleteRegistration"],
    ]);
  });

  it("si acepta en la bienvenida, el registro se manda en ese momento", async () => {
    navigation.pathname = "/bienvenida";
    render(
      <>
        <AdPixel pixelId={PIXEL_ID} signedIn />
        <RegistrationEvent />
      </>,
    );
    expect(queued()).toEqual([]);

    await userEvent.click(screen.getByRole("button", { name: "Aceptar" }));

    expect(queued().filter(([method]) => method === "track")).toEqual([
      ["track", "CompleteRegistration"],
    ]);
  });

  it("sin permiso no manda nada", async () => {
    navigation.pathname = "/bienvenida";
    render(
      <>
        <AdPixel pixelId={PIXEL_ID} signedIn />
        <RegistrationEvent />
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: "No, gracias" }));
    await act(async () => {});

    expect(queued()).toEqual([]);
    expect(tiktokScripts()).toHaveLength(0);
  });
});
