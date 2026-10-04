import { z } from "zod";
import { isPlatformImpersonation } from "./reserved-names";
import { RESERVED_NAME_MESSAGE } from "./schemas";

/** Largos máximos del perfil (ADR-058). */
export const PROFILE_BIO_MAX = 160;
export const PROFILE_CITY_MAX = 60;

/**
 * Qué hacer con la foto de perfil o la portada al guardar: dejarla como está, quitarla o poner la
 * recién subida (su id).
 */
export type ProfileImageChange =
  { kind: "keep" } | { kind: "remove" } | { kind: "set"; mediaId: string };

const imageChange = z
  .string()
  .trim()
  .transform((value, context): ProfileImageChange => {
    if (value === "" || value === "keep") return { kind: "keep" };
    if (value === "remove") return { kind: "remove" };
    if (z.uuid().safeParse(value).success) return { kind: "set", mediaId: value };
    context.addIssue({ code: "custom", message: "Esa imagen no es válida." });
    return z.NEVER;
  });

const displayName = z
  .string()
  .trim()
  .min(2, "Escribe tu nombre.")
  .max(50, { error: "Máximo 50 caracteres.", abort: true });

/** Editar perfil: nombre visible, ciudad, presentación, foto y portada. El usuario no cambia. */
export const profileEditSchema = z.object({
  displayName: displayName
    // Nadie más se llama «Equipo speeaking» o «Soporte» (SEC-18).
    .refine((value) => !isPlatformImpersonation(value), RESERVED_NAME_MESSAGE),
  city: z
    .string()
    .trim()
    .max(PROFILE_CITY_MAX, `Máximo ${PROFILE_CITY_MAX} caracteres.`)
    .transform((value) => value || null),
  bio: z
    .string()
    .trim()
    .max(PROFILE_BIO_MAX, `Máximo ${PROFILE_BIO_MAX} caracteres.`)
    .transform((value) => value || null),
  avatar: imageChange,
  cover: imageChange,
});

export type ProfileEditInput = z.output<typeof profileEditSchema>;

/** El servidor puede autorizar conservar un nombre oficial existente; no permite adoptar otro. */
export function parseProfileEdit(
  formData: FormData,
  { preservedPlatformName }: { preservedPlatformName?: string } = {},
) {
  const field = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  const schema =
    preservedPlatformName === undefined
      ? profileEditSchema
      : profileEditSchema.extend({
          displayName: displayName.refine(
            (value) => value === preservedPlatformName || !isPlatformImpersonation(value),
            RESERVED_NAME_MESSAGE,
          ),
        });
  return schema.safeParse({
    displayName: field("displayName"),
    city: field("city"),
    bio: field("bio"),
    avatar: field("avatar"),
    cover: field("cover"),
  });
}
