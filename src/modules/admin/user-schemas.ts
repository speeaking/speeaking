import { z } from "zod";

export const ADMIN_USER_PAGE_SIZE = 20;
export const ADMIN_USER_REASON_MAX = 500;

export const adminUserFiltersSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  status: z.enum(["all", "active", "blocked", "deleted"]).catch("all"),
  type: z.enum(["all", "people", "sellers", "admins", "editorial"]).catch("all"),
  page: z.coerce.number().int().min(1).max(100_000).catch(1),
});

export type AdminUserFilters = z.infer<typeof adminUserFiltersSchema>;

export const adminUserActionSchema = z
  .object({
    userId: z.uuid(),
    action: z.enum(["block", "unblock", "delete"]),
    reason: z
      .string()
      .trim()
      .min(3, "Escribe el motivo de esta acción.")
      .max(ADMIN_USER_REASON_MAX, `Máximo ${ADMIN_USER_REASON_MAX} caracteres.`),
    confirmed: z.literal(true, { error: "Marca la casilla para confirmar la acción." }),
    confirmationEmail: z.string().trim().toLowerCase().max(320).optional(),
  })
  .refine((input) => input.action !== "delete" || Boolean(input.confirmationEmail), {
    path: ["confirmationEmail"],
    message: "Escribe el correo de la cuenta para confirmar la eliminación.",
  });

export type AdminUserActionInput = z.infer<typeof adminUserActionSchema>;

export const ACCOUNT_ACTION_KINDS = [
  "moderation.account.block",
  "moderation.account.unblock",
  "moderation.account.delete",
] as const;

export function isDeletedAccountEmail(email: string) {
  return /^eliminada-.+@speeaking\.invalid$/i.test(email);
}
