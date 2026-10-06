import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProductAction, toggleProductStatusAction, updateProductAction } from "./actions";

// La acción solo traduce: quién edita sale de la sesión (nunca del formulario) y los errores del
// servicio se vuelven mensajes. Las reglas de propiedad e inventario se prueban en service.test.
const { session, limits, service, redirect, revalidatePath } = vi.hoisted(() => {
  class ProductEditError extends Error {
    constructor(
      readonly code: string,
      readonly currentStock?: number,
    ) {
      super(code);
    }
  }
  return {
    session: { requireOnboardedViewer: vi.fn() },
    limits: { checkCatalogLimit: vi.fn() },
    service: { ProductEditError, updateProduct: vi.fn(), setProductStatus: vi.fn() },
    redirect: vi.fn((to: string) => {
      throw new Error(`redirect:${to}`);
    }),
    revalidatePath: vi.fn(),
  };
});
vi.mock("@/modules/identity/session", () => session);
vi.mock("./service", () => service);
vi.mock("./limits", () => limits);
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/modules/analytics/track", () => ({ track: vi.fn() }));
const { db, trust, background } = vi.hoisted(() => {
  const tx = {
    product: {
      create: vi.fn(() => Promise.resolve({ id: "0199a000-0000-7000-8000-0000000000aa" })),
    },
    post: { create: vi.fn() },
  };
  return {
    db: {
      tx,
      media: { findMany: vi.fn() },
      category: { findUnique: vi.fn() },
      community: { findUnique: vi.fn() },
      $transaction: vi.fn((run: (client: typeof tx) => unknown) => run(tx)),
    },
    trust: { evaluateProductAuthenticity: vi.fn() },
    background: { scheduleAuthenticityAiSignal: vi.fn() },
  };
});
vi.mock("@/server/db", () => ({ db }));
// Revisión de autenticidad (P14): la lógica vive en src/modules/trust; aquí, que se llame.
vi.mock("@/modules/trust/service", () => trust);
vi.mock("@/modules/trust/background", () => background);
// IndexNow (SEO): después de responder se avisa que la ficha cambió; aquí, que se programe.
const { indexNow } = vi.hoisted(() => ({ indexNow: { scheduleIndexNow: vi.fn() } }));
vi.mock("@/server/seo/schedule-indexnow", () => indexNow);

const SELLER = "0199a000-0000-7000-8000-00000000000a";
const OTHER = "0199a000-0000-7000-8000-00000000000f";
const PRODUCT = "0199a000-0000-7000-8000-00000000000b";
const uuid = "0199a000-0000-7000-8000-000000000001";

function editForm(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    productId: PRODUCT,
    stockShown: "5",
    title: "AirPods Pro 2",
    description: "Audífonos con cancelación de ruido, nuevos y sellados.",
    price: "3,499",
    cost: "2,400",
    stock: "6",
    categoryId: uuid,
    condition: "NEW",
    tags: "",
    city: "Ciudad de México",
    state: "CDMX",
    localDeliveryZones: "",
    warrantyType: "NONE",
    returnWindowDays: "0",
    authenticity: "NOT_APPLICABLE",
    mediaIds: uuid,
    // Un navegador manipulado no puede elegir por quién edita.
    sellerUserId: OTHER,
    userId: OTHER,
    ...overrides,
  };
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.append(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  session.requireOnboardedViewer.mockResolvedValue({ userId: SELLER, sellerProfileId: "s-1" });
  limits.checkCatalogLimit.mockResolvedValue(null);
});

describe("createProductAction", () => {
  it("con el límite de altas agotado responde el mensaje y no toca la base (SEC-15)", async () => {
    limits.checkCatalogLimit.mockResolvedValue(
      "Demasiados intentos. Intenta de nuevo en 12 minutos.",
    );

    await expect(createProductAction({}, editForm())).resolves.toEqual({
      error: "Demasiados intentos. Intenta de nuevo en 12 minutos.",
    });
    expect(limits.checkCatalogLimit).toHaveBeenCalledWith("create", SELLER);
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.media.findMany).not.toHaveBeenCalled();
  });

  it("revisa la autenticidad del producto nuevo antes de mostrarlo (P14)", async () => {
    session.requireOnboardedViewer.mockResolvedValue({ userId: SELLER, sellerProfileId: "s-1" });
    db.media.findMany.mockResolvedValue([{ id: uuid }]);
    db.category.findUnique.mockResolvedValue({ id: uuid });
    const created = "0199a000-0000-7000-8000-0000000000aa";

    await expect(
      createProductAction({}, editForm({ title: "AirPods Pro réplica AAA", price: "300" })),
    ).rejects.toThrow(/^redirect:\/producto\/airpods-pro-replica-aaa-[a-z0-9]+\?nuevo=1$/);
    expect(trust.evaluateProductAuthenticity).toHaveBeenCalledWith(created);
    expect(background.scheduleAuthenticityAiSignal).toHaveBeenCalledWith(created);
    // Los buscadores se enteran de la ficha nueva (IndexNow).
    expect(indexNow.scheduleIndexNow).toHaveBeenCalledWith([
      expect.stringMatching(/^\/producto\/airpods-pro-replica-aaa-[a-z0-9]+$/),
    ]);
    // Primero se guarda el producto, después se revisa.
    expect(db.$transaction.mock.invocationCallOrder[0]!).toBeLessThan(
      trust.evaluateProductAuthenticity.mock.invocationCallOrder[0]!,
    );
  });
});

describe("updateProductAction", () => {
  it("edita como la persona de la sesión y guarda con el inventario que se mostró", async () => {
    service.updateProduct.mockResolvedValue({ slug: "airpods-pro-2-abc123", status: "ACTIVE" });

    await expect(updateProductAction({}, editForm())).rejects.toThrow(
      "redirect:/studio/productos?guardado=1",
    );
    expect(service.updateProduct).toHaveBeenCalledWith(
      SELLER,
      PRODUCT,
      expect.objectContaining({ stock: 6, priceCents: 349_900, unitCostCents: 240_000 }),
      { stockShown: 5 },
    );
    expect(revalidatePath).toHaveBeenCalledWith("/producto/airpods-pro-2-abc123");
    expect(indexNow.scheduleIndexNow).toHaveBeenCalledWith(["/producto/airpods-pro-2-abc123"]);
    // La señal opcional de IA se pide después de responder (apagada por omisión).
    expect(background.scheduleAuthenticityAiSignal).toHaveBeenCalledWith(PRODUCT);
  });

  it("un producto ajeno o un ID inválido no revela nada", async () => {
    service.updateProduct.mockRejectedValue(new service.ProductEditError("NOT_FOUND"));
    await expect(updateProductAction({}, editForm())).resolves.toEqual({
      error: "No encontramos este producto en tu tienda.",
      stockShown: "5",
    });

    await expect(updateProductAction({}, editForm({ productId: "../otro" }))).resolves.toEqual({
      error: "No encontramos este producto en tu tienda.",
    });
    expect(service.updateProduct).toHaveBeenCalledTimes(1);
  });

  it("si el inventario cambió mientras editaba, muestra el número real y lo usa al reintentar", async () => {
    service.updateProduct.mockRejectedValue(new service.ProductEditError("STOCK_CHANGED", 1));

    const state = await updateProductAction({}, editForm());

    expect(state.stockShown).toBe("1");
    expect(state.fieldErrors?.stock?.[0]).toContain("ahora tienes 1 disponible.");
    expect(redirect).not.toHaveBeenCalled();

    // Otro error después (un campo inválido) no regresa a la referencia vieja.
    const next = await updateProductAction(state, editForm({ stockShown: "1", title: "" }));
    expect(next.fieldErrors?.title).toBeDefined();
    expect(next.stockShown).toBe("1");
  });
});

describe("toggleProductStatusAction", () => {
  it("al pausar o reactivar, los buscadores se enteran (IndexNow)", async () => {
    session.requireOnboardedViewer.mockResolvedValue({ userId: SELLER, sellerProfileId: "s-1" });
    service.setProductStatus.mockResolvedValue({ slug: "airpods-pro-2-abc123", status: "PAUSED" });

    await expect(toggleProductStatusAction(PRODUCT, "PAUSED")).resolves.toEqual({
      ok: true,
      status: "PAUSED",
    });
    expect(indexNow.scheduleIndexNow).toHaveBeenCalledWith(["/producto/airpods-pro-2-abc123"]);
  });
});
