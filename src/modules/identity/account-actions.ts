"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { getStorage } from "@/server/providers/storage";
import { limitOrError, rateLimit, rateLimitKey } from "@/server/rate-limit";
import { deleteAccount } from "./account-deletion";
import { requireViewer } from "./session";

export type DeleteAccountState = { error?: string };

/**
 * «Eliminar mi cuenta» (ADR-048): con la casilla marcada, borra o anonimiza la cuenta
 * (`account-deletion.ts`), cierra la sesión y manda al inicio con el aviso.
 */
export async function deleteAccountAction(
  _previous: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const viewer = await requireViewer("/ajustes");
  if (formData.get("confirm") !== "on") {
    return { error: "Marca la casilla para confirmar que quieres borrar tu cuenta." };
  }
  const limited = limitOrError(
    await rateLimit({
      key: rateLimitKey("account.delete", "user", viewer.userId)!,
      limit: 3,
      windowSeconds: 60 * 60,
    }),
  );
  if (limited) return { error: limited };
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch (error) {
    console.error("[identity] no se pudo cerrar la sesión antes de borrar la cuenta", error);
  }
  await deleteAccount(db, getStorage(), viewer.userId);
  redirect("/?cuenta=eliminada");
}
