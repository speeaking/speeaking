import { beforeEach, describe, expect, it, vi } from "vitest";

const getAdminViewer = vi.hoisted(() => vi.fn());
const checkTrustLimit = vi.hoisted(() => vi.fn());
const getProofFileForAdmin = vi.hoisted(() => vi.fn());

vi.mock("@/modules/admin/guard", () => ({ getAdminViewer }));
vi.mock("@/modules/trust/limits", () => ({ checkTrustLimit }));
vi.mock("@/modules/trust/service", () => ({ getProofFileForAdmin }));
vi.mock("@/server/db", () => ({ db: {} }));

const { AdminAuthorizationError } = await import("@/modules/admin/service");
const { GET } = await import("./route");

const ADMIN = "0199a000-0000-7000-8000-00000000000a";
const MEDIA = "0199a000-0000-7000-8000-0000000000f1";

function get(mediaId = MEDIA) {
  return GET(new Request(`http://localhost/admin/moderacion/prueba/${mediaId}`), {
    params: Promise.resolve({ mediaId }),
  });
}

/** El 404 estándar de Next (`notFound()`): la ruta no arma su propia respuesta. */
async function expectNextNotFound(response: Promise<Response>) {
  await expect(response).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
}

beforeEach(() => {
  vi.clearAllMocks();
  getAdminViewer.mockResolvedValue({ userId: ADMIN });
  checkTrustLimit.mockResolvedValue(null);
  getProofFileForAdmin.mockResolvedValue({ data: Buffer.from("jpeg"), contentType: "image/jpeg" });
});

describe("/admin/moderacion/prueba/[mediaId] (P14)", () => {
  it("ADMIN ve la foto, sin caché y aislada", async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Content-Security-Policy")).toContain("sandbox");
  });

  it("a cualquier otra persona, el 404 de `notFound()`: no revela si la foto existe", async () => {
    getAdminViewer.mockResolvedValue(null);
    await expectNextNotFound(get());
    expect(getProofFileForAdmin).not.toHaveBeenCalled();
  });

  it("id inválido, foto inexistente o rol retirado a medio camino: el mismo 404", async () => {
    await expectNextNotFound(get("../../etc/passwd"));

    getProofFileForAdmin.mockResolvedValueOnce(null);
    await expectNextNotFound(get());

    getProofFileForAdmin.mockRejectedValueOnce(new AdminAuthorizationError());
    await expectNextNotFound(get());
  });
});
