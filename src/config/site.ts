/**
 * Marca y mercado (ADR-070). «speeaking» es la marca de la plataforma, en minúsculas como en el
 * logotipo, también al empezar una frase; «Sube y vende» es la función del vendedor. Cambiar estas
 * constantes basta para renombrar la interfaz (el logotipo dibujado está en `components/brand`).
 */
export const siteConfig = {
  name: "speeaking",
  /** Origen canónico del contenido público; independiente del callback de autenticación. */
  url: "https://www.speeaking.com",
  googleSiteVerification: "h_Jp67f-8Q5W_AeCqzZzSW4jg7UOomIi6wrZIesfa7c",
  tagline: "Donde las conversaciones cobran vida.",
  sellerFeatureName: "Sube y vende",
  /** Ruta de la función del vendedor (la anterior, `/studio/vende-con-ia`, redirige aquí). */
  sellerFeaturePath: "/studio/sube-y-vende",
  description:
    "Descubre contenido y productos de gente real, pruébatelos con una foto y compra a quien te inspira.",
  country: "MX",
  /** Nombre del país para quien lee (datos estructurados: «sirve a todo México»). */
  countryName: "México",
  /**
   * Perfiles oficiales de la marca (Instagram, TikTok, Facebook…), en URL completa. Ligan la marca
   * con sus redes para buscadores y asistentes (`sameAs`). Solo los que ya existen: vacío, no se
   * publica nada.
   */
  socialProfiles: [] as readonly string[],
  locale: "es-MX",
  currency: "MXN",
  timeZone: "America/Mexico_City",
} as const;
