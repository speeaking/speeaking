import { describe, expect, it } from "vitest";
import {
  BIG_TYPE_MAX_CHARS,
  COVER_MIN_WIDTH,
  extractHeadline,
  findCoverIndex,
  HEADLINE_MAX_CHARS,
  headlineSize,
  pickCardVariant,
  pickCardVariants,
} from "./card-variant";
import type { FeedItemDTO } from "./dto";

type Item = Pick<FeedItemDTO, "body" | "media" | "product" | "community">;

const gaming = { slug: "gaming", name: "Gaming", emoji: "🎮", hue: 285 };
const photo: FeedItemDTO["media"][number] = {
  url: "/media/foto.webp",
  width: 800,
  height: 1000,
  blurDataUrl: null,
  alt: null,
  credit: null,
};
const product = { slug: "tenis" } as NonNullable<FeedItemDTO["product"]>;

const item = (overrides: Partial<Item> = {}): Item => ({
  body: "Un texto cualquiera.",
  media: [],
  product: null,
  community: gaming,
  ...overrides,
});

describe("pickCardVariant", () => {
  it("la portada es la primera pieza con fotos de la lista", () => {
    const items = [
      item({ body: "x".repeat(BIG_TYPE_MAX_CHARS + 1) }),
      item({ media: [photo] }),
      item({ media: [photo] }),
    ];

    expect(pickCardVariants(items)).toEqual(["standard", "cover", "standard"]);
  });

  it("el comercio y las piezas sin comunidad no son portada", () => {
    const items = [
      item({ media: [photo], product }),
      item({ media: [photo], community: null }),
      item({ media: [photo] }),
    ];

    expect(findCoverIndex(items)).toBe(2);
    expect(pickCardVariants(items)).toEqual(["standard", "standard", "cover"]);
  });

  it("sin piezas con fotos no hay portada", () => {
    expect(findCoverIndex([item(), item()])).toBe(-1);
  });

  it("una foto chica no es portada: se vería borrosa a media tarjeta", () => {
    const tiny = { ...photo, width: COVER_MIN_WIDTH - 1, height: COVER_MIN_WIDTH - 1 };
    const items = [
      item({ media: [tiny] }),
      item({ media: [{ ...photo, width: COVER_MIN_WIDTH }] }),
    ];

    expect(pickCardVariants(items)).toEqual(["standard", "cover"]);
  });

  it("la portada no se mueve al cargar más páginas", () => {
    const firstPage = [item(), item({ media: [photo] })];
    const withMore = [...firstPage, item({ media: [photo] }), item({ media: [photo] })];

    expect(findCoverIndex(withMore)).toBe(findCoverIndex(firstPage));
  });

  it("tipográfica: solo texto de hasta 160 caracteres con comunidad", () => {
    const short = "¿Control o teclado y mouse para shooters? 🎯";
    expect(pickCardVariant(item({ body: short }), 0, -1)).toBe("bigType");
    expect(pickCardVariant(item({ body: "x".repeat(BIG_TYPE_MAX_CHARS) }), 0, -1)).toBe("bigType");
    // Los emojis cuentan como un carácter, no como dos.
    expect(pickCardVariant(item({ body: `${"x".repeat(BIG_TYPE_MAX_CHARS - 1)}🎯` }), 0, -1)).toBe(
      "bigType",
    );
  });

  it("estándar: texto largo, con fotos que no son portada, comercio o sin comunidad", () => {
    expect(pickCardVariant(item({ body: "x".repeat(BIG_TYPE_MAX_CHARS + 1) }), 0, -1)).toBe(
      "standard",
    );
    expect(pickCardVariant(item({ media: [photo] }), 3, 1)).toBe("standard");
    expect(pickCardVariant(item({ product }), 0, -1)).toBe("standard");
    expect(pickCardVariant(item({ community: null }), 0, -1)).toBe("standard");
    expect(pickCardVariant(item({ body: "   " }), 0, -1)).toBe("standard");
  });
});

describe("extractHeadline", () => {
  it("usa la primera oración como titular y la quita del cuerpo", () => {
    expect(
      extractHeadline(
        "¿Algo para jugar con amigos este fin? Nuestro top: 1) It Takes Two 2) Overcooked 2.",
      ),
    ).toEqual({
      headline: "¿Algo para jugar con amigos este fin?",
      rest: "Nuestro top: 1) It Takes Two 2) Overcooked 2.",
    });
  });

  it("un salto de línea también cierra la oración", () => {
    expect(extractHeadline("Tacos al pastor en casa\nMarinada rápida con achiote.")).toEqual({
      headline: "Tacos al pastor en casa",
      rest: "Marinada rápida con achiote.",
    });
  });

  it("si todo el texto es una oración corta, todo es titular (sin cuerpo repetido)", () => {
    const body = "Cuando suena la alarma del lunes y tu cuerpo decide que hoy no.";
    expect(extractHeadline(body)).toEqual({ headline: body, rest: "" });
    expect(extractHeadline("  Miren lo que encontré  ")).toEqual({
      headline: "Miren lo que encontré",
      rest: "",
    });
  });

  it("una sola oración larga no es titular: se queda como texto", () => {
    const body = `${"Palabra ".repeat(12).trim()}.`;
    expect(extractHeadline(body)).toEqual({ headline: null, rest: body });
  });

  it("no hay titular si la primera oración pasa de 90 caracteres", () => {
    const long = `${"Palabra ".repeat(12).trim()}.`;
    expect(long.length).toBeGreaterThan(HEADLINE_MAX_CHARS);
    const body = `${long} Y luego más texto.`;
    expect(extractHeadline(body)).toEqual({ headline: null, rest: body });
  });

  it("los puntos de precios, dominios o números no cortan la oración", () => {
    expect(extractHeadline("Cuesta $1.5 mil en speeaking.com hoy. Corre por él.").headline).toBe(
      "Cuesta $1.5 mil en speeaking.com hoy.",
    );
    // «1.» no es un titular.
    expect(extractHeadline("1. Compra harina. 2. Hornea.").headline).toBeNull();
  });

  it("conserva comillas o paréntesis de cierre en el titular", () => {
    expect(extractHeadline("Dijo «¡vámonos!» Y nos fuimos.").headline).toBe("Dijo «¡vámonos!»");
  });
});

describe("headlineSize", () => {
  it("baja de tamaño con el largo para no pasar de 3 líneas en la portada", () => {
    expect(headlineSize("¿Algo para jugar con amigos este fin?")).toBe("lg");
    expect(headlineSize("Tenis blancos: ¿siempre impecables o con historia y uso?")).toBe("md");
    expect(
      headlineSize(
        "Cuando suena la alarma del lunes y tu cuerpo decide que hoy no es buen día para existir.",
      ),
    ).toBe("sm");
  });

  it("los límites son 40 y 60 caracteres visibles (un emoji cuenta como uno)", () => {
    expect(headlineSize("a".repeat(40))).toBe("lg");
    expect(headlineSize("a".repeat(41))).toBe("md");
    expect(headlineSize(`${"a".repeat(59)}🎮`)).toBe("md");
    expect(headlineSize("a".repeat(61))).toBe("sm");
  });
});
