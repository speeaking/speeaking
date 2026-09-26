import type { Authenticity, ProductCondition, WarrantyType } from "@/generated/prisma/enums";
import { centsToPesosInput } from "./pricing";

/** Valores iniciales del formulario de producto, como los escribiría el vendedor (texto). */
export type ProductFormDefaults = {
  title?: string;
  description?: string;
  price?: string;
  cost?: string;
  stock?: string;
  tags?: string;
  categoryId?: string;
  condition?: ProductCondition;
  city?: string;
  state?: string;
  pickupAvailable?: boolean;
  localDeliveryZones?: string;
  nationalShippingAvailable?: boolean;
  shippingPrice?: string;
  deliveryMinDays?: string;
  deliveryMaxDays?: string;
  warrantyType?: WarrantyType;
  warrantyDays?: string;
  returnWindowDays?: string;
  authenticity?: Authenticity;
  postBody?: string;
  /** Propuesta de "Vende con IA" que originó el producto (P3). */
  proposalId?: string;
  initialMedia?: { id: string; url: string; width: number; height: number }[];
};

/** Producto propio con lo que necesita el formulario de edición (incluye el costo privado). */
export type EditableProductRow = {
  title: string;
  description: string;
  priceCents: number;
  stock: number;
  categoryId: string;
  condition: ProductCondition;
  tags: string[];
  city: string;
  state: string;
  pickupAvailable: boolean;
  localDeliveryZones: string[];
  nationalShippingAvailable: boolean;
  shippingPriceCents: number | null;
  deliveryMinDays: number | null;
  deliveryMaxDays: number | null;
  warrantyType: WarrantyType;
  warrantyDays: number | null;
  returnWindowDays: number;
  authenticity: Authenticity;
  cost: { unitCostCents: number } | null;
};

/**
 * Formulario de edición prellenado campo por campo. Solo para la página del Studio de su dueño:
 * lleva el costo privado.
 */
export function editFormDefaults(
  row: EditableProductRow,
  initialMedia: NonNullable<ProductFormDefaults["initialMedia"]>,
): ProductFormDefaults {
  return {
    title: row.title,
    description: row.description,
    price: centsToPesosInput(row.priceCents),
    cost: centsToPesosInput(row.cost?.unitCostCents ?? 0),
    stock: String(row.stock),
    tags: row.tags.join(", "),
    categoryId: row.categoryId,
    condition: row.condition,
    city: row.city,
    state: row.state,
    pickupAvailable: row.pickupAvailable,
    localDeliveryZones: row.localDeliveryZones.join(", "),
    nationalShippingAvailable: row.nationalShippingAvailable,
    shippingPrice: row.shippingPriceCents === null ? "" : centsToPesosInput(row.shippingPriceCents),
    // Sin envío nacional se proponen los mismos días que al crear, por si lo activa.
    deliveryMinDays: String(row.deliveryMinDays ?? 2),
    deliveryMaxDays: String(row.deliveryMaxDays ?? 5),
    warrantyType: row.warrantyType,
    // Garantía sin días (p. ej. del fabricante) se queda sin días al guardar.
    warrantyDays:
      row.warrantyDays !== null
        ? String(row.warrantyDays)
        : row.warrantyType === "NONE"
          ? "30"
          : "",
    returnWindowDays: String(row.returnWindowDays),
    authenticity: row.authenticity,
    initialMedia,
  };
}
