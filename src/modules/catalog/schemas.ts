import { z } from "zod";
import { Authenticity, ProductCondition, WarrantyType } from "@/generated/prisma/enums";
import { parsePesosToCents } from "./pricing";

export const MAX_PRODUCT_IMAGES = 10;

const pesos = (label: string, { allowZero = false } = {}) =>
  z.string().transform((raw, context) => {
    const cents = parsePesosToCents(raw);
    if (cents === null || (!allowZero && cents === 0)) {
      context.addIssue({ code: "custom", message: `Escribe ${label} válido.` });
      return z.NEVER;
    }
    return cents;
  });

const integer = (label: string, min: number, max: number) =>
  z.coerce
    .number({ error: `Escribe ${label}.` })
    .int(`${label} debe ser un número entero.`)
    .min(min, `Mínimo ${min}.`)
    .max(max, `Máximo ${max}.`);

/** Lista separada por comas → valores limpios y sin duplicados. */
const commaList = (maxItems: number, maxLength: number) =>
  z
    .string()
    .transform((raw) => [
      ...new Set(
        raw
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ])
    .pipe(z.array(z.string().max(maxLength)).max(maxItems, `Máximo ${maxItems}.`));

const checkbox = z
  .string()
  .optional()
  .transform((value) => value === "on");

export const productFormSchema = z
  .object({
    title: z.string().trim().min(3, "Escribe un nombre de al menos 3 letras.").max(120),
    description: z
      .string()
      .trim()
      .min(10, "Describe tu producto (mínimo 10 caracteres).")
      .max(5000),
    price: pesos("un precio"),
    cost: pesos("un costo", { allowZero: true }),
    stock: integer("el inventario", 0, 100_000),
    categoryId: z.uuid("Elige una categoría."),
    condition: z.enum(ProductCondition),
    tags: commaList(10, 30),
    city: z.string().trim().min(2, "Escribe la ciudad.").max(60),
    state: z.string().trim().min(2, "Escribe el estado.").max(60),
    pickupAvailable: checkbox,
    localDeliveryZones: commaList(20, 60),
    nationalShippingAvailable: checkbox,
    shippingPrice: z.string().optional(),
    deliveryMinDays: z.string().optional(),
    deliveryMaxDays: z.string().optional(),
    warrantyType: z.enum(WarrantyType),
    warrantyDays: z.string().optional(),
    returnWindowDays: integer("los días de devolución", 0, 90),
    authenticity: z.enum(Authenticity),
    mediaIds: z
      .array(z.uuid())
      .min(1, "Agrega al menos una foto.")
      .max(MAX_PRODUCT_IMAGES, `Máximo ${MAX_PRODUCT_IMAGES} fotos.`),
    publishToFeed: checkbox,
    communitySlug: z
      .string()
      .regex(/^[a-z0-9-]*$/)
      .optional(),
    postBody: z.string().trim().max(2000).optional(),
  })
  .transform((data, context) => {
    // Envío nacional: costo (0 = gratis) y tiempos obligatorios.
    let shippingPriceCents: number | null = null;
    let deliveryMinDays: number | null = null;
    let deliveryMaxDays: number | null = null;
    if (data.nationalShippingAvailable) {
      shippingPriceCents = parsePesosToCents(data.shippingPrice ?? "");
      deliveryMinDays = Number(data.deliveryMinDays);
      deliveryMaxDays = Number(data.deliveryMaxDays);
      if (shippingPriceCents === null) {
        context.addIssue({
          code: "custom",
          path: ["shippingPrice"],
          message: "Escribe el costo de envío (0 si es gratis).",
        });
      }
      if (
        !Number.isInteger(deliveryMinDays) ||
        !Number.isInteger(deliveryMaxDays) ||
        deliveryMinDays < 1 ||
        deliveryMaxDays > 60 ||
        deliveryMinDays > deliveryMaxDays
      ) {
        context.addIssue({
          code: "custom",
          path: ["deliveryMaxDays"],
          message: "Indica días de entrega válidos (mínimo ≤ máximo, hasta 60).",
        });
      }
    }
    // Garantía: con días si la da el vendedor.
    let warrantyDays: number | null = null;
    if (data.warrantyType !== "NONE" && data.warrantyDays) {
      warrantyDays = Number(data.warrantyDays);
      if (!Number.isInteger(warrantyDays) || warrantyDays < 1 || warrantyDays > 3650) {
        context.addIssue({
          code: "custom",
          path: ["warrantyDays"],
          message: "Días de garantía inválidos.",
        });
      }
    } else if (data.warrantyType === "SELLER") {
      context.addIssue({
        code: "custom",
        path: ["warrantyDays"],
        message: "Indica cuántos días de garantía das.",
      });
    }
    return {
      title: data.title,
      description: data.description,
      priceCents: data.price,
      unitCostCents: data.cost,
      stock: data.stock,
      categoryId: data.categoryId,
      condition: data.condition,
      tags: data.tags,
      city: data.city,
      state: data.state,
      pickupAvailable: data.pickupAvailable,
      localDeliveryAvailable: data.localDeliveryZones.length > 0,
      localDeliveryZones: data.localDeliveryZones,
      nationalShippingAvailable: data.nationalShippingAvailable,
      shippingPriceCents,
      deliveryMinDays,
      deliveryMaxDays,
      warrantyType: data.warrantyType,
      warrantyDays,
      returnWindowDays: data.returnWindowDays,
      authenticity: data.authenticity,
      mediaIds: data.mediaIds,
      publishToFeed: data.publishToFeed,
      communitySlug: data.communitySlug || undefined,
      postBody: data.postBody || undefined,
    };
  });

export type ProductFormInput = z.output<typeof productFormSchema>;

/**
 * Campos extra del formulario de edición: qué producto es (el servidor comprueba que sea de quien
 * edita) y el inventario que se mostró al abrirlo, para no pisar ventas hechas mientras tanto.
 */
export const productEditMetaSchema = z.object({
  productId: z.uuid(),
  stockShown: z.coerce.number().int().min(0).optional(),
});

/** Lee el formulario HTML (fotos como lista repetida) y lo valida. */
export function parseProductForm(formData: FormData) {
  const entries: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && key !== "mediaIds") entries[key] = value;
  }
  entries.mediaIds = formData.getAll("mediaIds").filter((value) => typeof value === "string");
  return productFormSchema.safeParse(entries);
}

/** Nombre legible para la URL: "AirPods Pro 2" → "airpods-pro-2-k3j9x2". */
export function productSlug(title: string, suffix: string) {
  const base = title
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return `${base || "producto"}-${suffix}`;
}
