"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { DeliveryMethod, PaymentMethod } from "@/generated/prisma/enums";
import { track } from "@/modules/analytics/track";
import { getViewer, requireOnboardedViewer } from "@/modules/identity/session";
import { db } from "@/server/db";
import {
  isSimulatedPayment,
  SIMULATED_PAYMENT_PROVIDER,
  simulatedPaymentsEnabled,
} from "@/server/providers/payments";
import { limitOrError, rateLimitMany, rateLimitKey } from "@/server/rate-limit";
import { addressSchema } from "./address-schema";
import { addToCart, CartError, MAX_QUANTITY_PER_ITEM, setCartItemQuantity } from "./cart";
import {
  advanceOrder,
  applyPaymentEvent,
  cancelOrderBySeller,
  CheckoutError,
  expireStaleCheckouts,
  placeOrder,
} from "./checkout";
import { MAX_PENDING_CHECKOUTS_PER_BUYER } from "./fees";

const addSchema = z.object({
  productId: z.uuid(),
  quantity: z.int().min(1).max(MAX_QUANTITY_PER_ITEM),
  sourcePostId: z.uuid().nullable(),
});

const CART_MESSAGES: Record<CartError["code"], string> = {
  NOT_AVAILABLE: "Este producto ya no está disponible.",
  OWN_PRODUCT: "No puedes comprar tu propio producto.",
  NOT_ENOUGH_STOCK: "No hay suficientes piezas disponibles.",
};

export type CartActionResult =
  { ok: true; count: number } | { ok: false; error: string; needsAuth?: boolean };

async function add(
  input: z.input<typeof addSchema>,
): Promise<CartActionResult & { userId?: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Inicia sesión para comprar.", needsAuth: true };
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Solicitud inválida." };
  try {
    const count = await addToCart(
      viewer.userId,
      parsed.data.productId,
      parsed.data.quantity,
      parsed.data.sourcePostId,
    );
    track({
      type: "ADD_TO_CART",
      userId: viewer.userId,
      entityType: "PRODUCT",
      entityId: parsed.data.productId,
      sourcePostId: parsed.data.sourcePostId,
      surface: "PRODUCT_PAGE",
      metadata: { quantity: parsed.data.quantity },
    });
    revalidatePath("/carrito");
    return { ok: true, count, userId: viewer.userId };
  } catch (error) {
    if (error instanceof CartError) return { ok: false, error: CART_MESSAGES[error.code] };
    throw error;
  }
}

export async function addToCartAction(input: z.input<typeof addSchema>): Promise<CartActionResult> {
  const { userId: _userId, ...result } = await add(input);
  return result;
}

/** "Comprar ahora": agrega al carrito y lleva directo al checkout. */
export async function buyNowAction(input: z.input<typeof addSchema>): Promise<CartActionResult> {
  const result = await add(input);
  if (!result.ok) return result;
  redirect("/checkout");
}

export async function updateCartItemAction(itemId: string, quantity: number) {
  const viewer = await getViewer();
  if (!viewer || !z.uuid().safeParse(itemId).success || !Number.isInteger(quantity)) return;
  await setCartItemQuantity(
    viewer.userId,
    itemId,
    Math.max(0, Math.min(quantity, MAX_QUANTITY_PER_ITEM)),
  );
  revalidatePath("/carrito");
}

export type PlaceOrderState = {
  error?: string;
  fieldErrors?: Partial<Record<string, string[]>>;
  /** Lo que la persona eligió y escribió, para no borrarlo si algo falla. */
  values?: Record<string, string>;
};

/**
 * Dirección y método de pago tal cual los mandó la persona, para regresarlos si hay un error
 * (entrega y dirección guardada viven en el estado del formulario).
 */
function checkoutValues(formData: FormData) {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    const known = Object.hasOwn(addressSchema.shape, key) || key === "paymentMethod";
    if (known && typeof value === "string") values[key] = value;
  }
  return values;
}

const CHECKOUT_MESSAGES: Record<CheckoutError["code"], string> = {
  EMPTY_CART: "Tu carrito está vacío.",
  NOT_AVAILABLE: "Uno de tus productos ya no está disponible. Revisa tu carrito.",
  DELIVERY_NOT_ALLOWED: "Elige una forma de entrega válida para cada vendedor.",
  PAYMENT_NOT_ALLOWED: "Ese método de pago no lo aceptan todos los vendedores.",
  ADDRESS_REQUIRED: "Agrega una dirección de entrega.",
  OUT_OF_STOCK: "Alguien se adelantó: uno de tus productos ya no tiene piezas suficientes.",
  CART_CHANGED: "Tu carrito cambió. Revisa los productos y el total antes de continuar.",
  TOO_MANY_PENDING: `Ya tienes ${MAX_PENDING_CHECKOUTS_PER_BUYER} pedidos esperando pago. Págalos desde Mis pedidos o espera a que venzan para hacer otro.`,
  RESERVATION_LIMIT: `Ya apartaste el máximo de ${MAX_QUANTITY_PER_ITEM} piezas de uno de estos productos en pedidos sin pagar. Págalos desde Mis pedidos o espera a que venzan.`,
  TOTAL_TOO_LARGE: "El total es demasiado alto para un solo pedido. Divide tu compra en varios.",
  PAYMENT_UNAVAILABLE: "No pudimos iniciar el pago y no se cobró nada. Intenta de nuevo en unos minutos.",
};

/**
 * Confirmaciones de compra por persona (SEC-05). Cada una aparta stock durante el tiempo de pago:
 * alcanza para corregir y reintentar varias veces, no para apartar y soltar inventario sin parar.
 * Por cuenta y no por IP: comprar exige sesión, y muchas personas comparten IP en la red celular.
 */
const PLACE_ORDER_LIMIT = { limit: 10, windowSeconds: 60 * 60 };

export async function placeOrderAction(
  _previous: PlaceOrderState,
  formData: FormData,
): Promise<PlaceOrderState> {
  const viewer = await requireOnboardedViewer("/checkout");
  const values = checkoutValues(formData);

  const delivery: Record<string, DeliveryMethod> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("delivery:") && typeof value === "string") {
      const parsed = z.enum(DeliveryMethod).safeParse(value);
      if (parsed.success) delivery[key.slice("delivery:".length)] = parsed.data;
    }
  }
  const paymentMethod = z.enum(PaymentMethod).safeParse(formData.get("paymentMethod"));
  if (!paymentMethod.success) return { error: "Elige cómo quieres pagar.", values };

  const addressChoice = String(formData.get("addressId") ?? "");
  let newAddress = null;
  if (addressChoice === "nueva") {
    const parsedAddress = addressSchema.safeParse(Object.fromEntries(formData));
    const needsAddress = Object.values(delivery).some((method) => method !== "PICKUP");
    if (needsAddress && !parsedAddress.success) {
      return {
        error: "Revisa tu dirección.",
        fieldErrors: z.flattenError(parsedAddress.error).fieldErrors,
        values,
      };
    }
    newAddress = parsedAddress.success ? parsedAddress.data : null;
  }

  let redirectUrl: string;
  try {
    ({ redirectUrl } = await placeOrder(viewer.userId, {
      cartKey: String(formData.get("cartKey") ?? ""),
      delivery,
      paymentMethod: paymentMethod.data,
      addressId: z.uuid().safeParse(addressChoice).success ? addressChoice : null,
      newAddress,
    }));
  } catch (error) {
    if (error instanceof CheckoutError) {
      // Carrito distinto al que revisó: se vuelve a pintar /checkout con lo que hay ahora.
      if (error.code === "CART_CHANGED") revalidatePath("/", "layout");
      return { error: CHECKOUT_MESSAGES[error.code], values };
    }
    throw error;
  }
  // El carrito se vació: el contador de la navegación (layout) debe actualizarse.
  revalidatePath("/", "layout");
  redirect(redirectUrl as Route);
}

const simulatedOutcome = z.enum(["APPROVED", "DECLINED"]);

/** Simulación del proveedor de pagos (V0.1): entra por el mismo camino que un webhook real. */
export async function simulatePaymentAction(providerRef: string, outcome: "APPROVED" | "DECLINED") {
  const viewer = await requireOnboardedViewer("/pedidos");
  // Los argumentos llegan del navegador: solo se aceptan los dos resultados simulados.
  if (typeof providerRef !== "string" || !simulatedOutcome.safeParse(outcome).success) {
    redirect("/pedidos");
  }
  const payment = await db.payment.findUnique({
    where: { providerRef },
    select: { provider: true, checkoutId: true, checkout: { select: { buyerId: true } } },
  });
  if (!payment || payment.provider !== "mock" || payment.checkout.buyerId !== viewer.userId) {
    redirect("/pedidos");
  }
  await applyPaymentEvent({
    provider: "mock",
    providerEventId: `sim_${randomUUID()}`,
    providerRef,
    status: outcome,
    payload: { simulated: true },
  });
  // Si se rechaza, los productos regresan al carrito: el contador de la navegación cambia.
  revalidatePath("/", "layout");
  redirect(`/pedidos/${payment.checkoutId}` as Route);
}

export async function advanceOrderAction(orderId: string, to: "SHIPPED" | "DELIVERED") {
  const viewer = await requireOnboardedViewer("/studio/pedidos");
  if (!z.uuid().safeParse(orderId).success) return;
  await advanceOrder(viewer.userId, orderId, to);
  revalidatePath("/studio/pedidos");
}
