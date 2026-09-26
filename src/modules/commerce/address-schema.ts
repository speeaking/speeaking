import { z } from "zod";

/** Dirección de entrega en México (el código postal tiene 5 dígitos). */
export const addressSchema = z.object({
  recipientName: z.string().trim().min(3, "Escribe quién recibe.").max(80),
  phone: z
    .string()
    .transform((value) => value.replace(/[\s()-]/g, "").replace(/^\+?52/, ""))
    .pipe(z.string().regex(/^\d{10}$/, "Escribe un teléfono de 10 dígitos.")),
  street: z.string().trim().min(2, "Escribe la calle.").max(120),
  exteriorNumber: z.string().trim().min(1, "Número exterior.").max(20),
  interiorNumber: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((value) => value || undefined),
  neighborhood: z.string().trim().min(2, "Escribe la colonia.").max(80),
  city: z.string().trim().min(2, "Escribe el municipio o alcaldía.").max(80),
  state: z.string().trim().min(2, "Escribe el estado.").max(60),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "El código postal tiene 5 dígitos."),
  references: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((value) => value || undefined),
});

export type AddressInput = z.output<typeof addressSchema>;
