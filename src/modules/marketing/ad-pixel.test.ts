import { describe, expect, it } from "vitest";
import {
  AD_CONSENT_COOKIE,
  adConsentCookie,
  parseAdConsent,
  pixelAllowedOn,
  tiktokPixelId,
} from "./ad-pixel";

describe("pixelAllowedOn: el pixel solo en páginas públicas, el registro y la bienvenida", () => {
  it.each([
    "/",
    "/comprar",
    "/comprar/decoracion",
    "/producto/vela-personalizada-9b0c59",
    "/descubrir",
    "/creadores",
    "/precios",
    "/seguridad",
    "/apoya",
    "/como-funciona",
    "/preguntas-frecuentes",
    "/registro",
    "/bienvenida",
  ])("visitante sin sesión: sí en %s", (path) => {
    expect(pixelAllowedOn(path, { signedIn: false })).toBe(true);
  });

  it.each([
    "/entrar",
    "/recuperar-contrasena",
    "/mensajes",
    "/mensajes/abc",
    "/pedidos",
    "/carrito",
    "/checkout",
    "/u/issac",
    "/p/123",
    "/c/hogar",
    "/buscar",
    "/studio",
    "/ajustes",
    "/cookies",
    "/privacidad",
    "/comprarlo",
    "/productos",
  ])("visitante sin sesión: no en %s", (path) => {
    expect(pixelAllowedOn(path, { signedIn: false })).toBe(false);
  });

  it("con sesión, solo en la bienvenida (el registro recién hecho); nunca el feed ni lo demás", () => {
    expect(pixelAllowedOn("/bienvenida", { signedIn: true })).toBe(true);
    for (const path of ["/", "/comprar", "/producto/vela-9b0c59", "/precios", "/mensajes"]) {
      expect(pixelAllowedOn(path, { signedIn: true })).toBe(false);
    }
  });
});

describe("la decisión de quien visita (cookie propia)", () => {
  it("lee «sí», «no» o sin decidir", () => {
    expect(parseAdConsent("si")).toBe("granted");
    expect(parseAdConsent("no")).toBe("denied");
    expect(parseAdConsent(undefined)).toBeNull();
    expect(parseAdConsent("cualquier-cosa")).toBeNull();
  });

  it("se guarda un año, en todo el sitio, y segura en https", () => {
    expect(adConsentCookie(true, { https: true })).toBe(
      `${AD_CONSENT_COOKIE}=si; Max-Age=31536000; Path=/; SameSite=Lax; Secure`,
    );
    expect(adConsentCookie(false, { https: false })).toBe(
      `${AD_CONSENT_COOKIE}=no; Max-Age=31536000; Path=/; SameSite=Lax`,
    );
  });
});

describe("tiktokPixelId: activo solo con la variable y nunca en vistas previas", () => {
  it("devuelve el ID configurado", () => {
    expect(tiktokPixelId({ TIKTOK_PIXEL_ID: "DB2LL7RC77UA626EHMOG" })).toBe("DB2LL7RC77UA626EHMOG");
  });

  it("sin variable, con un ID mal formado o en una vista previa de Vercel, no hay pixel", () => {
    expect(tiktokPixelId({})).toBeNull();
    expect(tiktokPixelId({ TIKTOK_PIXEL_ID: "" })).toBeNull();
    expect(tiktokPixelId({ TIKTOK_PIXEL_ID: "abc');alert(1);//" })).toBeNull();
    expect(
      tiktokPixelId({ TIKTOK_PIXEL_ID: "DB2LL7RC77UA626EHMOG", VERCEL_ENV: "preview" }),
    ).toBeNull();
  });
});
