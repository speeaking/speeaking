"use server";

import { revalidatePath } from "next/cache";
import { getAdminViewer } from "./guard";
import { AdminAuthorizationError } from "./service";
import { adminUserActionSchema } from "./user-schemas";
import { AdminUserError, applyAdminUserAction } from "./user-service";
import { limitOrError, rateLimit, rateLimitKey } from "@/server/rate-limit";

export type AdminUserActionState = { ok?: boolean; message?: string; error?: string };

const ERRORS = {
  NOT_FOUND: "Esta cuenta ya no existe. Actualiza la lista.",
  PROTECTED:
    "Las cuentas administradoras están protegidas: no se pueden bloquear ni eliminar aquí.",
  DELETED: "Esta cuenta ya fue eliminada.",
  CONFIRMATION: "El correo escrito no coincide con el de la cuenta. Revisa la confirmación.",
} as const;

export async function adminUserAction(
  _previous: AdminUserActionState,
  formData: FormData,
): Promise<AdminUserActionState> {
  const admin = await getAdminViewer();
  if (!admin) return { error: "No encontrado." };
  const limited = limitOrError(
    await rateLimit({
      key: rateLimitKey("admin.users", "user", admin.userId)!,
      limit: 30,
      windowSeconds: 60 * 60,
    }),
  );
  if (limited) return { error: limited };
  const parsed = adminUserActionSchema.safeParse({
    userId: formData.get("userId"),
    action: formData.get("action"),
    reason: formData.get("reason"),
    confirmed: formData.get("confirmed") === "on",
    confirmationEmail: formData.get("confirmationEmail") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Acción inválida." };
  try {
    const result = await applyAdminUserAction(admin.userId, parsed.data);
    revalidatePath("/", "layout");
    const message =
      result.action === "delete"
        ? "deletionMode" in result && result.deletionMode === "anonymized"
          ? "Cuenta anonimizada y acceso eliminado. Se conservaron sus registros de pedidos."
          : "Cuenta y contenido eliminados."
        : result.action === "block"
          ? "Cuenta bloqueada. Sus sesiones se cerraron y no podrá iniciar sesión."
          : "Cuenta desbloqueada. Ya puede volver a iniciar sesión.";
    return { ok: true, message };
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return { error: "No encontrado." };
    if (error instanceof AdminUserError) return { error: ERRORS[error.code] };
    // No incluir el correo, la nota, credenciales o el error del proveedor en los registros.
    console.error("[admin] no se pudo administrar una cuenta", { action: parsed.data.action });
    return { error: "No se pudo completar la acción. Actualiza la lista e intenta de nuevo." };
  }
}
