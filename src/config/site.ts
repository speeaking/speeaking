/**
 * Marca y mercado (ADR-070). «speeaking» es la marca de la plataforma, en minúsculas como en el
 * logotipo, también al empezar una frase; «Sube y vende» es la función del vendedor. Cambiar estas
 * constantes basta para renombrar la interfaz (el logotipo dibujado está en `components/brand`).
 */
export const siteConfig = {
  name: "speeaking",
  tagline: "Donde las conversaciones cobran vida.",
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
