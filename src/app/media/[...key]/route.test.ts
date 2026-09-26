import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const findUnique = vi.fn();
const get = vi.fn();

vi.mock("@/modules/identity/session", () => ({ getSession }));
vi.mock("@/server/db", () => ({ db: { media: { findUnique } } }));
vi.mock("@/server/providers/storage", () => ({ getStorage: () => ({ get }) }));

const { GET } = await import("./route");

const OWNER = "0199a000-0000-7000-8000-000000000001";
const KEY = "images/2026/09/0199a000-0000-7000-8000-00000000000a.webp";

function request(key = KEY) {
  return GET(new Request(`http://localhost/media/${key}`), {
    params: Promise.resolve({ key: key.split("/") }),
  } as RouteContext<"/media/[...key]">);
}

const row = (links: number, status = "READY") => ({
  ownerId: OWNER,
  status,
  _count: { postLinks: links, productLinks: 0 },
});

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(null);
  get.mockResolvedValue({ data: Buffer.from("webp"), contentType: "image/webp" });
});

describe("GET /media/[...key] (SEC-14)", () => {
  it("adjunta: pública con caché corta (ya no inmutable de un año)", async () => {
    findUnique.mockResolvedValue(row(1));

    const response = await request();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=86400");
    expect(response.headers.get("Content-Type")).toBe("image/webp");
    expect(response.headers.get("Content-Security-Policy")).toContain("sandbox");
    expect(getSession).not.toHaveBeenCalled();
  });

  it("sin adjuntar: 404 para cualquiera que no sea su dueño (no es hosting público)", async () => {
    findUnique.mockResolvedValue(row(0));

    expect((await request()).status).toBe(404);
    getSession.mockResolvedValue({ user: { id: "0199a000-0000-7000-8000-0000000000ff" } });
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

  it("claves peligrosas: 400 sin consultar la base", async () => {
    expect((await request("images/../../.env")).status).toBe(400);
    expect(findUnique).not.toHaveBeenCalled();
  });
});
