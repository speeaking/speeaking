import { z } from "zod";
import { UserGoal } from "@/generated/prisma/enums";
import { MIN_COMMUNITIES } from "./onboarding-options";
import { isPlatformImpersonation, isReservedUsername } from "./reserved-names";
import { RESERVED_NAME_MESSAGE, usernameSchema } from "./schemas";

/** Minúsculas y sin acentos, para comparar intereses ("L'Oréal" = "l'oreal"). */
export function normalizeInterest(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

/** Propone un nombre de usuario válido (y no reservado) a partir del nombre de la persona. */
export function suggestUsername(name: string) {
  const base = normalizeInterest(name)
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 30)
    .replace(/\.+$/, "");
  if (!base || isReservedUsername(base)) return "usuario";
  return base.length < 3 ? `usuario.${base}` : base;
}

const MAX_BUDGET_PESOS = 10_000_000;

/** Presupuesto escrito en pesos ("25,000", "$1 500") → centavos; vacío = sin presupuesto. */
const budgetInPesos = z.string().transform((raw, context) => {
  const value = raw.replace(/[\s,$]/g, "");
  if (!value) return undefined;
  const pesos = Number(value);
  if (!Number.isFinite(pesos) || pesos <= 0) {
    context.addIssue({ code: "custom", message: "Escribe un monto mayor a cero." });
    return z.NEVER;
  }
  if (pesos > MAX_BUDGET_PESOS) {
    context.addIssue({ code: "custom", message: "Ese presupuesto es demasiado alto." });
    return z.NEVER;
  }
  return Math.round(pesos * 100);
});

const schema = z.object({
  username: usernameSchema,
  displayName: z
    .string()
    .trim()
    .min(2, "Escribe tu nombre.")
    .max(50, { error: "Máximo 50 caracteres.", abort: true })
    // Nadie más se llama «Equipo VendeIA» o «Soporte» (SEC-18).
    .refine((value) => !isPlatformImpersonation(value), RESERVED_NAME_MESSAGE),
  goals: z.array(z.enum(UserGoal)).max(6),
  communities: z
    .array(z.string().regex(/^[a-z0-9-]+$/))
    .min(MIN_COMMUNITIES, `Elige al menos ${MIN_COMMUNITIES} comunidades.`)
    .max(12),
  brands: z
    .array(z.string().trim().min(1).max(40))
    .max(15, "Elige hasta 15 marcas.")
    .transform((brands) => {
      const seen = new Set<string>();
      return brands.filter((brand) => {
        const key = normalizeInterest(brand);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }),
  intentQuery: z
    .string()
    .trim()
    .max(120, "Máximo 120 caracteres.")
    .transform((value) => value || undefined),
  budgetMaxCents: budgetInPesos,
  personalizationEnabled: z.boolean(),
});

export type OnboardingInput = z.output<typeof schema>;

export const onboardingSchema = {
  schema,
  /** Lee el formulario HTML (listas repetidas con `getAll`) y lo valida. */
  fromFormData(formData: FormData) {
    const text = (key: string) => {
      const value = formData.get(key);
      return typeof value === "string" ? value : "";
    };
    const list = (key: string) =>
      formData.getAll(key).filter((value): value is string => typeof value === "string");

    return schema.safeParse({
      username: text("username"),
      displayName: text("displayName"),
      goals: list("goals"),
      communities: list("communities"),
      brands: list("brands"),
      intentQuery: text("intentQuery"),
      budgetMaxCents: text("budgetMax"),
      personalizationEnabled: text("personalization") === "on",
    });
  },
};
