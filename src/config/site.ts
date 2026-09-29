/**
 * Marca y mercado (ADR-041). «Estreno» es la marca de la plataforma; «Sube y vende» es la función
 * del vendedor. Cambiar estas constantes debe bastar para renombrar la interfaz: el nombre técnico
 * del paquete, la base de datos y las cookies (`vendeia`) son internos y no cambian.
 */
export const siteConfig = {
  name: "Estreno",
  tagline: "Descubre, pruébatelo, estrena.",
  sellerFeatureName: "Sube y vende",
  /** Ruta de la función del vendedor (la anterior, `/studio/vende-con-ia`, redirige aquí). */
  sellerFeaturePath: "/studio/sube-y-vende",
  description:
    "Descubre contenido y productos de gente real, pruébatelos con una foto y compra a quien te inspira.",
  country: "MX",
  locale: "es-MX",
  currency: "MXN",
  timeZone: "America/Mexico_City",
} as const;
