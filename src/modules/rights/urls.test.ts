import { describe, expect, it } from "vitest";
import { normalizeUrl, sameSiteUrl, siteHosts, siteRefFromUrl, splitUrlLines } from "./urls";

const HOSTS = siteHosts(["https://www.speeaking.com", "http://localhost:3000"]);
const POST_ID = "0192f0c4-7b1a-7c3e-9d2f-1a2b3c4d5e6f";

function ref(raw: string) {
  const url = normalizeUrl(raw);
  return url ? siteRefFromUrl(url, HOSTS) : "invalid";
}

describe("direcciones del aviso", () => {
  it("una por renglón, sin vacías ni repetidas", () => {
    expect(splitUrlLines(" https://a.mx/1 \r\n\n https://a.mx/1\nhttps://a.mx/2  \n")).toEqual([
      "https://a.mx/1",
      "https://a.mx/2",
    ]);
  });

  it("sin esquema se asume https; solo http y https", () => {
    expect(normalizeUrl("www.speeaking.com/p/x")?.href).toBe("https://www.speeaking.com/p/x");
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("ftp://speeaking.com/p/x")).toBeNull();
    expect(normalizeUrl("mailto:hola@speeaking.com")).toBeNull();
    expect(normalizeUrl("no es una dirección")).toBeNull();
    expect(normalizeUrl("")).toBeNull();
  });

  it("los dominios del sitio cuentan con y sin www, y el de desarrollo", () => {
    expect(HOSTS).toEqual(
      expect.arrayContaining(["www.speeaking.com", "speeaking.com", "localhost:3000"]),
    );
  });

  it("reconoce publicaciones, productos, perfiles y archivos de speeaking", () => {
    expect(ref(`https://www.speeaking.com/p/${POST_ID}`)).toEqual({
      kind: "POST",
      postId: POST_ID,
    });
    // Mayúsculas, panel de comentarios, parámetros y fragmentos no cambian el destino.
    expect(ref(`https://SPEEAKING.com/p/${POST_ID.toUpperCase()}/comentarios?x=1#c`)).toEqual({
      kind: "POST",
      postId: POST_ID,
    });
    expect(ref("speeaking.com/producto/tenis-blancos-a1b2")).toEqual({
      kind: "PRODUCT",
      slug: "tenis-blancos-a1b2",
    });
    expect(ref("https://www.speeaking.com/u/%40Ana.Luz/seguidores")).toEqual({
      kind: "USER",
      username: "ana.luz",
    });
    expect(ref("http://localhost:3000/media/uploads/2026/abc.webp?w=640")).toEqual({
      kind: "MEDIA",
      storageKey: "uploads/2026/abc.webp",
    });
  });

  it("lo de otros sitios o de otras páginas no apunta a nada (pero se conserva aparte)", () => {
    expect(ref(`https://www.speeaking.com.mx/p/${POST_ID}`)).toBeNull();
    expect(ref(`https://evil.example/p/${POST_ID}`)).toBeNull();
    expect(ref(`https://speeaking.com.evil.example/p/${POST_ID}`)).toBeNull();
    expect(ref("https://www.speeaking.com/")).toBeNull();
    expect(ref("https://www.speeaking.com/p/no-es-uuid")).toBeNull();
    expect(ref("https://www.speeaking.com/producto/")).toBeNull();
    expect(ref("https://www.speeaking.com/u/a")).toBeNull();
    expect(ref("https://www.speeaking.com/media/../secreto")).toBeNull();
    expect(ref("https://www.speeaking.com/terminos")).toBeNull();
  });
});

describe("prellenar el aviso desde «Reportar»", () => {
  const ORIGINS = ["https://www.speeaking.com"];

  it("acepta una dirección de speeaking, con o sin www", () => {
    expect(sameSiteUrl(`https://www.speeaking.com/p/${POST_ID}`, ORIGINS)).toBe(
      `https://www.speeaking.com/p/${POST_ID}`,
    );
    expect(sameSiteUrl("https://speeaking.com/producto/bolsa-de-piel", ORIGINS)).toBe(
      "https://speeaking.com/producto/bolsa-de-piel",
    );
  });

  it("ignora direcciones de otros sitios, raras o vacías", () => {
    for (const raw of [undefined, "", "https://evil.example/p/1", "javascript:alert(1)", "a b"]) {
      expect(sameSiteUrl(raw, ORIGINS)).toBeUndefined();
    }
  });
});
