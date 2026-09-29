"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { addToCart, CartError } from "@/modules/commerce/cart";
import { getViewer } from "@/modules/identity/session";
import { limitOrError, rateLimit, rateLimitKey } from "@/server/rate-limit";
import { getLook, StylistError, swapLookItem } from "./service";
import { OUTFIT_SLOTS } from "./slots";

export type LookActionResult = { ok: true; message: string } | { ok: false; error: string };

const swapSchema = z.object({
  lookId: z.uuid(),
  slot: z.enum(OUTFIT_SLOTS),
  direction: z.enum(["next", "cheaper"]).default("next"),
});

async function stylistLimit(userId: string) {
  return limitOrError(
    await rateLimit({
      key: rateLimitKey("stylist.actions", "user", userId)!,
      limit: 60,
      windowSeconds: 60 * 60,
    }),
  );
}

/** «Quiero otros zapatos» / «Busca algo más barato»: cambia una pieza del look guardado. */
export async function swapLookItemAction(input: {
  lookId: string;
  slot: string;
  direction?: string;
}): Promise<LookActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Inicia sesión para cambiar piezas del look." };
  const limited = await stylistLimit(viewer.userId);
  if (limited) return { ok: false, error: limited };
  const parsed = swapSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "No entendimos qué pieza cambiar." };
  try {
    const look = await swapLookItem({ userId: viewer.userId, ...parsed.data });
    revalidatePath("/estilista");
    revalidatePath("/probar");
    if (!look) {
      return {
        ok: false,
        error:
          parsed.data.direction === "cheaper"
            ? "No hay una opción más barata que quepa en tu presupuesto."
            : "No hay otra opción para ese hueco por ahora.",
      };
    }
    return { ok: true, message: "Listo: cambiamos la pieza." };
  } catch (error) {
    if (error instanceof StylistError) return { ok: false, error: "Ese look ya no existe." };
    throw error;
  }
}

/** «Comprar look»: agrega al carrito cada pieza que siga disponible y lleva al carrito. */
export async function buyLookAction(lookId: string): Promise<LookActionResult> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/entrar?next=${encodeURIComponent("/estilista")}` as Route);
  const limited = await stylistLimit(viewer.userId);
  if (limited) return { ok: false, error: limited };
  if (!z.uuid().safeParse(lookId).success) return { ok: false, error: "Ese look ya no existe." };
  const look = await getLook(lookId, viewer.userId);
  if (!look) return { ok: false, error: "Ese look ya no existe." };
  let added = 0;
  for (const item of look.items) {
    try {
      await addToCart(viewer.userId, item.product.id, 1, null);
      added += 1;
    } catch (error) {
      if (!(error instanceof CartError)) throw error;
    }
  }
  if (added === 0) return { ok: false, error: "Ninguna pieza del look se puede comprar ahora." };
  revalidatePath("/carrito");
  redirect("/carrito");
}
