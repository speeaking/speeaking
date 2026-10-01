import sharp from "sharp";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type * as ImageProcessing from "@/modules/media/image-processing";

const getSession = vi.fn();
const findUnique = vi.fn();
/** Comprobantes vigentes (`proofMediaIds`) y de envíos anteriores (bitácora). */
const currentProofs = vi.fn();
const pastProofs = vi.fn();
const hiddenProductLinks = vi.fn();
/** Adjuntos públicos: una fila (`findFirst` por `mediaId`) o `null`. */
const publicPostLink = vi.fn();
const publicProductLink = vi.fn();
/** Fotos de Pruébatelo (ADR-045): la foto de la persona y el resultado, por `mediaId`. */
const tryOnPhoto = vi.fn();
const tryOnResult = vi.fn();
/** Foto de perfil o portada de alguien (ADR-058). */
const profileLink = vi.fn();
/** Portada de un video adjunto a algo público (ADR-062): el video, por `posterId`. */
const posterOfLink = vi.fn();
/** Videos (ADR-062): la entrega la hace su almacenamiento (redirección o rangos). */
const deliverVideo = vi.fn(
  async (_key: string, _request: Request, headers: Record<string, string>) =>
    new Response(null, { status: 302, headers: { ...headers, Location: "https://r2/firmada" } }),
);
const findUserRole = vi.fn();

/** Almacenamiento en memoria: originales y variantes (`variants/...`). */
const files = new Map<string, Buffer>();
const get = vi.fn(async (key: string) => {
  const data = files.get(key);
  return data ? { data, contentType: "image/webp" } : null;
});
const put = vi.fn(async (key: string, data: Buffer) => void files.set(key, data));

/** Para simular la cola llena o un original que no se decodifica. */
const resizeFailure = vi.hoisted(() => ({ error: null as Error | null }));

vi.mock("@/modules/identity/session", () => ({ getSession }));
vi.mock("@/modules/admin/queries", () => ({ findUserRole }));
vi.mock("@/server/db", () => ({
  db: {
    media: { findUnique, findFirst: posterOfLink },
    authenticityCheck: { findMany: currentProofs },
    authenticityProofHistory: { findMany: pastProofs },
    postMedia: { findFirst: publicPostLink },
    productMedia: { count: hiddenProductLinks, findFirst: publicProductLink },
    tryOnPhoto: { findUnique: tryOnPhoto },
    tryOnResult: { findUnique: tryOnResult },
    profile: { findFirst: profileLink },
  },
}));
vi.mock("@/server/providers/storage", () => ({
  getStorage: () => ({ get, put }),
  getVideoStore: () => ({ deliver: deliverVideo }),
}));
vi.mock("@/modules/media/image-processing", async (importOriginal) => {
  const actual = await importOriginal<typeof ImageProcessing>();
  return {
    ...actual,
    resizeForDelivery: vi.fn(async (input: Buffer, width: number) => {
      if (resizeFailure.error) throw resizeFailure.error;
      return actual.resizeForDelivery(input, width);
    }),
  };
});

const { GET } = await import("./route");
const { resizeForDelivery, ImageBusyError } = await import("@/modules/media/image-processing");
const { variantKey } = await import("@/modules/media/variant-keys");

const OWNER = "0199a000-0000-7000-8000-000000000001";
const ADMIN = "0199a000-0000-7000-8000-0000000000ad";
const STRANGER = "0199a000-0000-7000-8000-0000000000ff";
const KEY = "images/2026/09/0199a000-0000-7000-8000-00000000000a.webp";
const PUBLIC_CACHE = "public, max-age=3600, stale-while-revalidate=86400";
const ORIGINAL_WIDTH = 1200;

let original: Buffer;

beforeAll(async () => {
  original = await sharp({
    create: { width: ORIGINAL_WIDTH, height: 900, channels: 3, background: "#ca2352" },
  })
    .webp()
    .toBuffer();
});

function request(
  key = KEY,
  { search = "", headers }: { search?: string; headers?: HeadersInit } = {},
) {
  return GET(new Request(`http://localhost/media/${key}${search}`, { headers }), {
    params: Promise.resolve({ key: key.split("/") }),
  } as RouteContext<"/media/[...key]">);
}

const MEDIA_ID = "0199a000-0000-7000-8000-00000000000b";

/**
 * `links`: adjuntos públicos (publicación publicada con producto visible o sin producto). La fila de
 * `media` ya no trae conteos: el route pregunta por `mediaId` (índice) con `findFirst`.
 */
const row = (links: number, status = "READY") => {
  publicPostLink.mockResolvedValue(links > 0 ? { mediaId: MEDIA_ID } : null);
  return { id: MEDIA_ID, ownerId: OWNER, status, width: ORIGINAL_WIDTH };
};

const as = (userId: string | null) =>
  getSession.mockResolvedValue(userId ? { user: { id: userId } } : null);

/** El producto de la foto se oculta por moderación: ya nada público la tiene. */
function hide() {
  findUnique.mockResolvedValue(row(0));
  hiddenProductLinks.mockResolvedValue(1);
}

beforeEach(() => {
  vi.clearAllMocks();
  files.clear();
  files.set(KEY, original);
  resizeFailure.error = null;
  as(null);
  currentProofs.mockResolvedValue([]);
  pastProofs.mockResolvedValue([]);
  hiddenProductLinks.mockResolvedValue(0);
  publicPostLink.mockResolvedValue(null);
  publicProductLink.mockResolvedValue(null);
  tryOnPhoto.mockResolvedValue(null);
  tryOnResult.mockResolvedValue(null);
  profileLink.mockResolvedValue(null);
  posterOfLink.mockResolvedValue(null);
  findUserRole.mockImplementation(async (id: string) => (id === ADMIN ? "ADMIN" : "USER"));
});

describe("GET /media/[...key]: videos cortos (ADR-062)", () => {
  const VIDEO_KEY = "videos/2026/10/0199a000-0000-7000-8000-00000000000c.mp4";
  const video = (links: number) => ({ ...row(links), kind: "VIDEO" });

  it("público: el almacenamiento lo entrega (nunca se carga en la app), caché solo del navegador", async () => {
    findUnique.mockResolvedValue(video(1));

    const response = await request(VIDEO_KEY);

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("https://r2/firmada");
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=600");
    expect(response.headers.get("Content-Security-Policy")).toContain("sandbox");
    expect(deliverVideo).toHaveBeenCalledWith(VIDEO_KEY, expect.any(Request), expect.any(Object));
    expect(get).not.toHaveBeenCalled();
  });

  it("sin publicar: 404 a los demás y a su dueño sin caché", async () => {
    findUnique.mockResolvedValue(video(0));
    expect((await request(VIDEO_KEY)).status).toBe(404);
    expect(deliverVideo).not.toHaveBeenCalled();

    as(OWNER);
    const own = await request(VIDEO_KEY);
    expect(own.status).toBe(302);
    expect(own.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("su portada es pública solo mientras el video está en algo publicado", async () => {
    findUnique.mockResolvedValue(row(0));
    expect((await request()).status).toBe(404);

    posterOfLink.mockResolvedValue({ id: "video" });
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(PUBLIC_CACHE);
    expect(posterOfLink).toHaveBeenCalledWith({
      where: {
        posterId: MEDIA_ID,
        postLinks: {
          some: { post: { status: "PUBLISHED", AND: [expect.any(Object)] } },
        },
      },
      select: { id: true },
    });
  });
});

describe("GET /media/[...key] (SEC-14)", () => {
  it("adjunta: pública con caché de una hora (no inmutable)", async () => {
    findUnique.mockResolvedValue(row(1));

    const response = await request();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(PUBLIC_CACHE);
    expect(response.headers.get("Cache-Control")).not.toContain("immutable");
    expect(response.headers.get("Content-Type")).toBe("image/webp");
    expect(response.headers.get("Content-Security-Policy")).toContain("sandbox");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(Buffer.from(await response.arrayBuffer()).equals(original)).toBe(true);
    expect(getSession).not.toHaveBeenCalled();
  });

  it("adjunta solo a un producto visible (sin publicación): también pública", async () => {
    findUnique.mockResolvedValue(row(0));
    publicProductLink.mockResolvedValue({ mediaId: MEDIA_ID });

    const response = await request();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(PUBLIC_CACHE);
  });

  it("foto de perfil o portada de alguien (ADR-058): pública, sin sesión", async () => {
    findUnique.mockResolvedValue(row(0));
    profileLink.mockResolvedValue({ userId: OWNER });

    const response = await request();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(PUBLIC_CACHE);
    expect(profileLink).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ avatarMediaId: MEDIA_ID }, { coverMediaId: MEDIA_ID }] },
      }),
    );
  });

  it("sin adjuntar: 404 para cualquiera que no sea su dueño (no es hosting público)", async () => {
    findUnique.mockResolvedValue(row(0));

    expect((await request()).status).toBe(404);
    as(STRANGER);
    expect((await request()).status).toBe(404);
    expect(get).not.toHaveBeenCalled();
  });

  it("sin adjuntar: su dueño sí la ve, sin caché", async () => {
    findUnique.mockResolvedValue(row(0));
    getSession.mockResolvedValue({ user: { id: OWNER } });

    const response = await request();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("sin fila (cuenta borrada) o sin terminar de procesar: 404 aunque el archivo exista", async () => {
    findUnique.mockResolvedValueOnce(null);
    expect((await request()).status).toBe(404);
    findUnique.mockResolvedValueOnce(row(1, "PROCESSING"));
    expect((await request()).status).toBe(404);
    expect(get).not.toHaveBeenCalled();
  });

  it("solo cuenta como pública lo publicado con producto visible y los productos visibles", async () => {
    findUnique.mockResolvedValue(row(1));

    await request();

    // Sin `_count` (un GROUP BY sobre toda la tabla de adjuntos): una fila por `mediaId`.
    expect(findUnique.mock.calls[0]![0].select).toEqual({
      id: true,
      ownerId: true,
      status: true,
      width: true,
      kind: true,
    });
    expect(publicProductLink).toHaveBeenCalledWith({
      where: { mediaId: MEDIA_ID, product: { moderationStatus: "VISIBLE" } },
      select: { mediaId: true },
    });
    const postQuery = publicPostLink.mock.calls[0]![0];
    expect(postQuery.where.mediaId).toBe(MEDIA_ID);
    expect(postQuery.where.post).toMatchObject({ status: "PUBLISHED" });
    expect(JSON.stringify(postQuery.where.post)).toContain('{"productId":null}');
  });

  it("de un producto oculto (sin nada público): su dueño y el equipo; 404 a los demás", async () => {
    hide();

    expect((await request()).status).toBe(404);
    as(STRANGER);
    expect((await request()).status).toBe(404);

    as(OWNER);
    const asOwner = await request();
    expect(asOwner.status).toBe(200);
    expect(asOwner.headers.get("Cache-Control")).toBe("private, no-store");

    as(ADMIN);
    const asAdmin = await request();
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.headers.get("Cache-Control")).toBe("private, no-store");
    expect(hiddenProductLinks).toHaveBeenCalledWith({
      where: { mediaId: MEDIA_ID, product: { moderationStatus: "HIDDEN" } },
    });
  });

  it("sin adjuntar ni de un producto oculto: el equipo tampoco la ve por aquí", async () => {
    findUnique.mockResolvedValue(row(0));
    as(ADMIN);

    expect((await request()).status).toBe(404);
    expect(get).not.toHaveBeenCalled();
  });

  it("un comprobante nunca es público, aunque su dueño lo adjunte a algo publicado", async () => {
    findUnique.mockResolvedValue(row(1));
    currentProofs.mockResolvedValue([{ proofMediaIds: [MEDIA_ID] }]);

    expect((await request()).status).toBe(404);
    as(STRANGER);
    expect((await request()).status).toBe(404);
    // El equipo lo ve por /admin/moderacion/prueba/[id], no por /media.
    as(ADMIN);
    expect((await request()).status).toBe(404);
    // Consulta con índice GIN (`&&`), no `= ANY(...)`.
    expect(currentProofs).toHaveBeenCalledWith({
      where: { proofMediaIds: { hasSome: [MEDIA_ID] } },
      select: { proofMediaIds: true },
    });

    as(OWNER);
    const asOwner = await request();
    expect(asOwner.status).toBe(200);
    expect(asOwner.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("un comprobante en un producto oculto: tampoco para el equipo por aquí", async () => {
    hide();
    currentProofs.mockResolvedValue([{ proofMediaIds: [MEDIA_ID] }]);
    as(ADMIN);

    expect((await request()).status).toBe(404);
  });

  it("una foto de Pruébatelo la ve solo su dueña o dueño: ni el equipo, ni aunque se adjunte a algo público", async () => {
    findUnique.mockResolvedValue(row(1));
    tryOnPhoto.mockResolvedValue({ id: "0199a000-0000-7000-8000-0000000000e1" });

    expect((await request()).status).toBe(404);
    as(STRANGER);
    expect((await request()).status).toBe(404);
    as(ADMIN);
    expect((await request()).status).toBe(404);
    expect(tryOnPhoto).toHaveBeenCalledWith({ where: { mediaId: MEDIA_ID }, select: { id: true } });

    as(OWNER);
    const asOwner = await request();
    expect(asOwner.status).toBe(200);
    expect(asOwner.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("un resultado de Pruébatelo en un producto oculto: tampoco para el equipo por aquí", async () => {
    hide();
    tryOnResult.mockResolvedValue({ id: "0199a000-0000-7000-8000-0000000000e2" });
    as(ADMIN);

    expect((await request()).status).toBe(404);
    expect(tryOnResult).toHaveBeenCalledWith({
      where: { resultMediaId: MEDIA_ID },
      select: { id: true },
    });
    as(OWNER);
    expect((await request()).status).toBe(200);
  });

  it("un comprobante REEMPLAZADO (solo en la bitácora) tampoco es público: solo su dueño, sin caché", async () => {
    findUnique.mockResolvedValue(row(1));
    // Otro comprobante vigente del mismo producto no la incluye.
    currentProofs.mockResolvedValue([]);
    pastProofs.mockResolvedValue([{ mediaId: MEDIA_ID }]);

    expect((await request()).status).toBe(404);
    as(STRANGER);
    expect((await request()).status).toBe(404);
    as(ADMIN);
    expect((await request()).status).toBe(404);
    expect(pastProofs).toHaveBeenCalledWith({
      where: { mediaId: { in: [MEDIA_ID] } },
      distinct: ["mediaId"],
      select: { mediaId: true },
    });

    as(OWNER);
    const asOwner = await request();
    expect(asOwner.status).toBe(200);
    expect(asOwner.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("pública y sin comprobante: la caché pública nunca se da a lo privado", async () => {
    findUnique.mockResolvedValue(row(1));
    currentProofs.mockResolvedValue([{ proofMediaIds: ["0199a000-0000-7000-8000-0000000000cc"] }]);

    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(PUBLIC_CACHE);
  });

  it("claves peligrosas: 400 sin consultar la base", async () => {
    expect((await request("images/../../.env")).status).toBe(400);
    expect(findUnique).not.toHaveBeenCalled();
  });
});

describe("GET /media/[...key]?w=N: variantes (ADR-039)", () => {
  it.each([
    "?w=641",
    "?w=0",
    "?w=0640",
    "?w=640.0",
    "?w=",
    "?w",
    "?w=640&q=75",
    "?w=640&w=828",
    "?q=75",
    "?v=1",
    "?url=%2Fmedia%2Fx.webp",
  ])("query inválida %s → 400 sin consultar la base (SEC-35)", async (search) => {
    findUnique.mockResolvedValue(row(1));

    const response = await request(KEY, { search });

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("un video no tiene variantes: 400", async () => {
    expect((await request("videos/2026/09/clip.mp4", { search: "?w=640" })).status).toBe(400);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("genera la variante WebP del ancho pedido, la guarda y la reutiliza", async () => {
    findUnique.mockResolvedValue(row(1));

    const first = await request(KEY, { search: "?w=640" });

    expect(first.status).toBe(200);
    expect(first.headers.get("Content-Type")).toBe("image/webp");
    expect(first.headers.get("Cache-Control")).toBe(PUBLIC_CACHE);
    const body = Buffer.from(await first.arrayBuffer());
    const meta = await sharp(body).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 640, 480]);
    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith(variantKey(KEY, 640), body);

    const second = await request(KEY, { search: "?w=640" });

    expect(second.status).toBe(200);
    expect(Buffer.from(await second.arrayBuffer()).equals(body)).toBe(true);
    expect(resizeForDelivery).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledTimes(1);
    expect(second.headers.get("ETag")).toBe(first.headers.get("ETag"));
  });

  it("peticiones simultáneas de la misma variante la generan una sola vez", async () => {
    findUnique.mockResolvedValue(row(1));

    const responses = await Promise.all([1, 2, 3].map(() => request(KEY, { search: "?w=384" })));

    expect(responses.map((response) => response.status)).toEqual([200, 200, 200]);
    expect(resizeForDelivery).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledTimes(1);
  });

  it("un ancho igual o mayor que la foto entrega el original, sin variante", async () => {
    findUnique.mockResolvedValue(row(1));

    const response = await request(KEY, { search: "?w=1600" });

    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer()).equals(original)).toBe(true);
    expect(resizeForDelivery).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it("una variante a medio escribir en la caché no se entrega: se genera de nuevo", async () => {
    findUnique.mockResolvedValue(row(1));
    const full = await request(KEY, { search: "?w=640" });
    const body = Buffer.from(await full.arrayBuffer());
    files.set(variantKey(KEY, 640), body.subarray(0, body.length - 10));

    const response = await request(KEY, { search: "?w=640" });

    expect(Buffer.from(await response.arrayBuffer()).length).toBe(body.length);
    expect(resizeForDelivery).toHaveBeenCalledTimes(2);
  });

  it("la variante en caché NO se entrega si la foto se ocultó: la autorización va primero", async () => {
    findUnique.mockResolvedValue(row(1));
    expect((await request(KEY, { search: "?w=640" })).status).toBe(200);
    expect(files.has(variantKey(KEY, 640))).toBe(true);
    get.mockClear();

    hide();
    for (const viewer of [null, STRANGER]) {
      as(viewer);
      const response = await request(KEY, { search: "?w=640" });
      expect(response.status).toBe(404);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
    // Ni el archivo ni la variante se leyeron.
    expect(get).not.toHaveBeenCalled();

    // Su dueño y el equipo sí, sin caché.
    for (const viewer of [OWNER, ADMIN]) {
      as(viewer);
      const response = await request(KEY, { search: "?w=640" });
      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    }
  });

  it("un comprobante con variante en caché: tampoco sale para los demás", async () => {
    findUnique.mockResolvedValue(row(1));
    expect((await request(KEY, { search: "?w=256" })).status).toBe(200);

    currentProofs.mockResolvedValue([{ proofMediaIds: [MEDIA_ID] }]);
    for (const viewer of [null, STRANGER, ADMIN]) {
      as(viewer);
      expect((await request(KEY, { search: "?w=256" })).status).toBe(404);
    }
    as(OWNER);
    const asOwner = await request(KEY, { search: "?w=256" });
    expect(asOwner.status).toBe(200);
    expect(asOwner.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("sin adjuntar (huérfana) con variante en caché: solo su dueño", async () => {
    findUnique.mockResolvedValue(row(0));
    as(OWNER);
    expect((await request(KEY, { search: "?w=828" })).status).toBe(200);
    expect(files.has(variantKey(KEY, 828))).toBe(true);

    for (const viewer of [null, STRANGER, ADMIN]) {
      as(viewer);
      expect((await request(KEY, { search: "?w=828" })).status).toBe(404);
    }
  });

  it("cola llena u original ilegible: entrega el original sin caché", async () => {
    findUnique.mockResolvedValue(row(1));
    resizeFailure.error = new ImageBusyError();

    const busy = await request(KEY, { search: "?w=640" });

    expect(busy.status).toBe(200);
    expect(busy.headers.get("Cache-Control")).toBe("no-store");
    expect(Buffer.from(await busy.arrayBuffer()).equals(original)).toBe(true);
    expect(put).not.toHaveBeenCalled();

    // Privada y degradada: sigue siendo `private, no-store`.
    hide();
    as(OWNER);
    const privateBusy = await request(KEY, { search: "?w=640" });
    expect(privateBusy.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("original borrado del disco: 404", async () => {
    findUnique.mockResolvedValue(row(1));
    files.delete(KEY);

    expect((await request(KEY, { search: "?w=640" })).status).toBe(404);
    expect((await request()).status).toBe(404);
  });
});

describe("GET /media/[...key]: ETag / If-None-Match", () => {
  it("304 sin cuerpo con el mismo validador y la misma caché", async () => {
    findUnique.mockResolvedValue(row(1));
    const first = await request(KEY, { search: "?w=640" });
    const etag = first.headers.get("ETag");
    expect(etag).toMatch(/^"[A-Za-z0-9_-]{32}"$/);

    for (const ifNoneMatch of [etag!, `W/${etag}`, `"otro", ${etag}`, "*"]) {
      const response = await request(KEY, {
        search: "?w=640",
        headers: { "If-None-Match": ifNoneMatch },
      });
      expect(response.status).toBe(304);
      expect(await response.text()).toBe("");
      expect(response.headers.get("ETag")).toBe(etag);
      expect(response.headers.get("Cache-Control")).toBe(PUBLIC_CACHE);
    }

    const changed = await request(KEY, {
      search: "?w=640",
      headers: { "If-None-Match": '"otro"' },
    });
    expect(changed.status).toBe(200);
  });

  it("el original y cada ancho tienen su propio validador", async () => {
    findUnique.mockResolvedValue(row(1));
    const tags = await Promise.all(
      ["", "?w=256", "?w=640"].map(async (search) =>
        (await request(KEY, { search })).headers.get("ETag"),
      ),
    );
    expect(new Set(tags).size).toBe(3);
  });

  it("un validador viejo no se salta la autorización: oculta → 404, no 304", async () => {
    findUnique.mockResolvedValue(row(1));
    const etag = (await request(KEY, { search: "?w=640" })).headers.get("ETag")!;

    hide();
    const response = await request(KEY, {
      search: "?w=640",
      headers: { "If-None-Match": etag },
    });

    expect(response.status).toBe(404);
  });
});
