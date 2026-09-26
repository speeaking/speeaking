/**
 * Fotos de stock con licencia libre para el contenido semilla (decisión del fundador, 2026-09-25).
 * Cada foto se verificó en su página: licencia de Unsplash (no Unsplash+) o de Pexels, autor y URL.
 * `pnpm seed:photos` las descarga, las recorta (4:5 publicaciones, 1:1 productos) y las guarda en
 * `prisma/seed/photos/`. La semilla usa ese archivo y guarda el crédito en `Media`.
 * Claves: `<comunidad>-<índice de la publicación>` o `product:<slug>`.
 */
export type SeedPhoto = {
  source: "unsplash" | "pexels";
  pageUrl: string;
  imageUrl: string;
  photographer: string;
  photographerUrl: string;
  alt: string;
  /** Punto de interés para el recorte (0–1); por omisión, el centro. */
  focus?: { x: number; y: number };
  /** `contain` encuadra el objeto completo sobre un fondo claro en vez de recortarlo. */
  fit?: "contain";
};

export const PHOTO_LICENSES = {
  unsplash: { name: "Unsplash", license: "Licencia de Unsplash" },
  pexels: { name: "Pexels", license: "Licencia de Pexels" },
} as const;

export const seedPhotos: Record<string, SeedPhoto> = {
  "humor-0": {
    source: "unsplash",
    pageUrl: "https://unsplash.com/photos/nqr6-Ix22EQ",
    imageUrl:
      "https://images.unsplash.com/photo-1721815714586-73849a2a163b?w=1600&q=80&fm=jpg&fit=max",
    photographer: "Solving Healthcare",
    photographerUrl: "https://unsplash.com/@solvinghealthcare",
    alt: "Mano golpeando un despertador junto a la cama en una mañana de lunes",
    focus: { x: 0.36, y: 0.5 },
  },
  "humor-2": {
    source: "unsplash",
    pageUrl: "https://unsplash.com/photos/PjoJga8EovQ",
    imageUrl:
      "https://images.unsplash.com/photo-1619658535018-5a55d32e4628?w=1600&q=80&fm=jpg&fit=max",
    photographer: "Asterfolio",
    photographerUrl: "https://unsplash.com/@asterfolio",
    alt: "Manos de una persona sentada escribiendo en su celular con una conversación de chat abierta",
  },
  "gaming-0": {
    source: "unsplash",
    pageUrl: "https://unsplash.com/photos/eCktzGjC-iU",
    imageUrl:
      "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=1600&q=80&fm=jpg&fit=max",
    photographer: "JESHOOTS.COM",
    photographerUrl: "https://unsplash.com/@jeshoots",
    alt: "Dos personas con controles jugando videojuegos juntas frente a la tele",
  },
  "gaming-2": {
    source: "unsplash",
    pageUrl: "https://unsplash.com/photos/uwL_JvIhtLM",
    imageUrl:
      "https://images.unsplash.com/photo-1544205497-14a3194fe440?w=1600&q=80&fm=jpg&fit=max",
    photographer: "Fabian Albert",
    photographerUrl: "https://unsplash.com/@fabiraw",
    alt: "Audífonos gamer sobre el escritorio junto al teclado y el monitor encendido, con luz roja",
  },
  "tecnologia-0": {
    source: "unsplash",
    pageUrl: "https://unsplash.com/photos/ivtjHB_pxq4",
    imageUrl:
      "https://images.unsplash.com/photo-1536692192939-f1547f1cde39?w=1600&q=80&fm=jpg&fit=max",
    photographer: "Alexander Andrews",
    photographerUrl: "https://unsplash.com/@alex_andrews",
    alt: "Mano sosteniendo un celular que muestra el ícono de batería vacía",
  },
  "tecnologia-2": {
    source: "unsplash",
    pageUrl: "https://unsplash.com/photos/UlHSF20AHu0",
    imageUrl:
      "https://images.unsplash.com/photo-1764096534662-a194a348c4a0?w=1600&q=80&fm=jpg&fit=max",
    photographer: "Yen Vu",
    photographerUrl: "https://unsplash.com/@yenvu2410",
    alt: "Escritorio de estudio de noche con laptop, libros y apuntes",
  },
  "comida-0": {
    source: "unsplash",
    pageUrl: "https://unsplash.com/photos/sVABqsPQoEE",
    imageUrl:
      "https://images.unsplash.com/photo-1660803173003-712884ff62f1?w=1600&q=80&fm=jpg&fit=max",
    photographer: "Alexandra Tran",
    photographerUrl: "https://unsplash.com/@alexgoesglobal",
    alt: "Taco al pastor con cilantro servido en un plato de cerámica azul",
  },
  "comida-2": {
    source: "pexels",
    pageUrl:
      "https://www.pexels.com/photo/refreshing-agua-de-jamaica-drink-with-hibiscus-37228408/",
    imageUrl:
      "https://images.pexels.com/photos/37228408/pexels-photo-37228408.jpeg?auto=compress&cs=tinysrgb&w=1600",
    photographer: "Cristian Arteaga",
    photographerUrl: "https://www.pexels.com/@cristian-arteaga-1679611/",
    alt: "Vaso de agua de jamaica con hielo y flores de jamaica secas",
  },
  "musica-0": {
    source: "unsplash",
    pageUrl: "https://unsplash.com/photos/BShMIbt__LM",
    imageUrl:
      "https://images.unsplash.com/photo-1766338055584-5ffe426a7e57?w=1600&q=80&fm=jpg&fit=max",
    photographer: "An Nhien",
    photographerUrl: "https://unsplash.com/@awnhien",
    alt: "Audífonos color crema sobre un libro abierto encima de una cama",
  },
  "musica-2": {
    source: "unsplash",
    pageUrl: "https://unsplash.com/photos/IEhdpoA9zrY",
    imageUrl:
      "https://images.unsplash.com/photo-1547357812-4a336d835928?w=1600&q=80&fm=jpg&fit=max",
    photographer: "Priscilla Du Preez",
    photographerUrl: "https://unsplash.com/@priscilladupreez",
    alt: "Manos tocando una guitarra acústica en primer plano",
  },
  "deportes-0": {
    source: "unsplash",
    pageUrl: "https://unsplash.com/photos/W2pBsQaT6FQ",
    imageUrl:
      "https://images.unsplash.com/photo-1759674861540-afed9f86f94a?w=1600&q=80&fm=jpg&fit=max",
    photographer: "Pierre-Antoine FRANCK",
    photographerUrl: "https://unsplash.com/@pierreantoinef",
    alt: "Piernas de corredores en plena carrera sobre el asfalto, con efecto de movimiento",
  },
  "deportes-2": {
    source: "unsplash",
    pageUrl: "https://unsplash.com/photos/qa1wvrlWCio",
    imageUrl:
      "https://images.unsplash.com/photo-1586439496903-c96e9f18f212?w=1600&q=80&fm=jpg&fit=max",
    photographer: "Kari Shea",
    photographerUrl: "https://unsplash.com/@karishea",
    alt: "Mujer de espaldas haciendo un estiramiento lateral sobre un tapete en casa frente a una laptop",
  },
  "mascotas-0": {
    source: "unsplash",
    pageUrl: "https://unsplash.com/photos/sjYKio1FfZw",
    imageUrl:
      "https://images.unsplash.com/photo-1511657304136-7d9f56e0d574?w=1600&q=80&fm=jpg&fit=max",
    photographer: "Jordon Conner",
    photographerUrl: "https://unsplash.com/@jordonsconner",
    alt: "Mano sujetando la correa de un perro negro que jala hacia el campo",
  },
  "mascotas-2": {
    source: "unsplash",
    pageUrl: "https://unsplash.com/photos/Ivzo69e18nk",
    imageUrl:
      "https://images.unsplash.com/photo-1563460716037-460a3ad24ba9?w=1600&q=80&fm=jpg&fit=max",
    photographer: "Alec Favale",
    photographerUrl: "https://unsplash.com/@alecfavale",
    alt: "Perro y gatito atigrado acurrucados juntos sobre un piso de loseta",
  },
  "moda-0": {
    source: "unsplash",
    pageUrl: "https://unsplash.com/photos/j2Abvzsq8z4",
    imageUrl:
      "https://images.unsplash.com/photo-1739384879592-79903b12b2a6?w=1600&q=80&fm=jpg&fit=max",
    photographer: "philippe wehrli",
    photographerUrl: "https://unsplash.com/@philippewehrli",
    alt: "Prendas básicas extendidas sobre un piso de madera: jeans, chamarra, playera blanca y tenis blancos",
  },
  "moda-2": {
    source: "unsplash",
    pageUrl: "https://unsplash.com/photos/Z0KXvonqYZc",
    imageUrl:
      "https://images.unsplash.com/photo-1636262899511-dc5865c774dc?w=1600&q=80&fm=jpg&fit=max",
    photographer: "Ervan M Wirawan",
    photographerUrl: "https://unsplash.com/@ervan_me",
    alt: "Tenis blancos junto a un limpiador, un cepillo y hormas de madera sobre fondo blanco",
    focus: { x: 0.38, y: 0.5 },
  },
  "hogar-0": {
    source: "unsplash",
    pageUrl: "https://unsplash.com/photos/-Lh6tVzDdMg",
    imageUrl:
      "https://images.unsplash.com/photo-1687552212914-03a30c82053c?w=1600&q=80&fm=jpg&fit=max",
    photographer: "Parker Sturdivant",
    photographerUrl: "https://unsplash.com/@parkerdesignsss",
    alt: "Sansevieria (lengua de suegra) en maceta de barro sobre una mesa de madera",
  },
  "hogar-2": {
    source: "pexels",
    pageUrl: "https://www.pexels.com/photo/authentic-mexican-cafe-de-olla-pouring-ritual-34944778/",
    imageUrl:
      "https://images.pexels.com/photos/34944778/pexels-photo-34944778.jpeg?auto=compress&cs=tinysrgb&w=1600",
    photographer: "umberto dez",
    photographerUrl: "https://www.pexels.com/@umberto-dez-6691815/",
    alt: "Café de olla servido desde una jarra verde en un jarrito de barro pintado a mano, con canela y piloncillo",
  },
  "autos-0": {
    source: "pexels",
    pageUrl: "https://www.pexels.com/photo/a-person-holding-a-dipstick-of-a-car-8470253/",
    imageUrl:
      "https://images.pexels.com/photos/8470253/pexels-photo-8470253.jpeg?auto=compress&cs=tinysrgb&w=1600",
    photographer: "Anastasia Shuraeva",
    photographerUrl: "https://www.pexels.com/@anastasia-shuraeva/",
    alt: "Mano sosteniendo la varilla medidora de aceite del motor de un auto",
  },
  "autos-2": {
    source: "unsplash",
    pageUrl: "https://unsplash.com/photos/Q_CJmTlNpAQ",
    imageUrl:
      "https://images.unsplash.com/photo-1693718641851-fd3ac0b7af4e?w=1600&q=80&fm=jpg&fit=max",
    photographer: "Koons Automotive",
    photographerUrl: "https://unsplash.com/@koons",
    alt: "Pinza roja de cables pasacorriente conectada al borne de la batería de un auto",
  },
  "belleza-0": {
    source: "unsplash",
    pageUrl: "https://unsplash.com/photos/W71jxsXrwyQ",
    imageUrl:
      "https://images.unsplash.com/photo-1613803745799-ba6c10aace85?w=1600&q=80&fm=jpg&fit=max",
    photographer: "Birgith Roosipuu",
    photographerUrl: "https://unsplash.com/@msbirgith",
    alt: "Productos de cuidado de la piel sin marca: frasco con gotero, botella dosificadora y crema abierta",
    focus: { x: 0.5, y: 0.3 },
  },
  "belleza-2": {
    source: "unsplash",
    pageUrl: "https://unsplash.com/photos/IKl2pPdEBlg",
    imageUrl:
      "https://images.unsplash.com/photo-1687716432612-2a46da37a43b?w=1600&q=80&fm=jpg&fit=max",
    photographer: "Natallia Photo",
    photographerUrl: "https://unsplash.com/@natallia_jpeg",
    alt: "Brochas de maquillaje limpias sobre fondo rosa con un tulipán amarillo",
  },
  "emprendedores-0": {
    source: "pexels",
    pageUrl: "https://www.pexels.com/photo/person-using-black-calculator-6801680/",
    imageUrl:
      "https://images.pexels.com/photos/6801680/pexels-photo-6801680.jpeg?auto=compress&cs=tinysrgb&w=1600",
    photographer: "Hanna Pad",
    photographerUrl: "https://www.pexels.com/@anna-nekrashevich/",
    alt: "Mano usando una calculadora sobre una libreta abierta junto a hojas con cifras",
    focus: { x: 0.5, y: 0.3 },
  },
  "emprendedores-2": {
    source: "unsplash",
    pageUrl: "https://unsplash.com/photos/4yPGdNaaLoE",
    imageUrl:
      "https://images.unsplash.com/photo-1551986784-9ab9e1566563?w=1600&q=80&fm=jpg&fit=max",
    photographer: "Riss Design",
    photographerUrl: "https://unsplash.com/@rissdesign",
    alt: "Mano sosteniendo un celular que muestra la foto de un flat lay de papelería y flores con luz natural",
  },
  "product:airpods-pro-2-demo": {
    source: "unsplash",
    pageUrl: "https://unsplash.com/photos/6hQB-U2nWG8",
    imageUrl:
      "https://images.unsplash.com/photo-1587523459887-e669248cf666?w=1600&q=80&fm=jpg&fit=max",
    photographer: "Andres Jasso",
    photographerUrl: "https://unsplash.com/@andresjasso",
    alt: "Audífonos inalámbricos blancos junto a su estuche de carga sobre una mesa de madera clara",
  },
  "product:control-inalambrico-demo": {
    source: "unsplash",
    pageUrl: "https://unsplash.com/photos/Y56xXBtlL0k",
    imageUrl:
      "https://images.unsplash.com/photo-1632312527375-bd5d5a0d3484?w=1600&q=80&fm=jpg&fit=max",
    photographer: "James Jeremy Beckers",
    photographerUrl: "https://unsplash.com/@jerrografie",
    alt: "Control inalámbrico gris oscuro con detalles turquesa sobre un fondo azul cian",
  },
  "product:cargador-usb-c-30w-demo": {
    source: "unsplash",
    pageUrl: "https://unsplash.com/photos/CLMmcaiyeeY",
    imageUrl:
      "https://images.unsplash.com/photo-1770417999317-64fb254c9e3a?w=1600&q=80&fm=jpg&fit=max",
    photographer: "Arturo Añez",
    photographerUrl: "https://unsplash.com/@americanaez225",
    alt: "Cargador de pared blanco y compacto con clavijas planas sobre una superficie de madera",
  },
  "product:teclado-mecanico-compacto-demo": {
    source: "unsplash",
    pageUrl: "https://unsplash.com/photos/KYw1eUx1J7Y",
    imageUrl:
      "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=1600&q=80&fm=jpg&fit=max",
    photographer: "Stefen Tan",
    photographerUrl: "https://unsplash.com/@stefentan",
    alt: "Teclado mecánico compacto con teclas gris oscuro y dos teclas naranjas sobre mármol blanco",
  },
  "product:tenis-running-ligeros-demo": {
    source: "unsplash",
    pageUrl: "https://unsplash.com/photos/VeW_kL0isfs",
    imageUrl:
      "https://images.unsplash.com/photo-1726133731483-d4b8bcabeb43?w=1600&q=80&fm=jpg&fit=max",
    photographer: "Rohit Sharma",
    photographerUrl: "https://unsplash.com/@rohitsharma1785",
    alt: "Tenis para correr de malla verde oscuro con suela blanca gruesa y amortiguada",
    fit: "contain",
  },
  "product:prensa-francesa-1l-demo": {
    source: "unsplash",
    pageUrl: "https://unsplash.com/photos/k7B2UiFRhTk",
    imageUrl:
      "https://images.unsplash.com/photo-1585206031605-0a1a0ff48640?w=1600&q=80&fm=jpg&fit=max",
    photographer: "Oxa Roxa",
    photographerUrl: "https://unsplash.com/@oxaroxa",
    alt: "Prensa francesa de vidrio con tapa, émbolo y asa negros sobre una mesa clara",
    focus: { x: 0.5, y: 0.52 },
  },
  "product:maceta-barro-pintada-demo": {
    source: "unsplash",
    pageUrl: "https://unsplash.com/photos/yTKCYey385Q",
    imageUrl:
      "https://images.unsplash.com/photo-1649445005761-11b8ad385113?w=1600&q=80&fm=jpg&fit=max",
    photographer: "Kate Darmody",
    photographerUrl: "https://unsplash.com/@kdarmody",
    alt: "Planta de hule variegada en una maceta de barro pintada a mano con figuras de colores sobre un plato naranja",
    focus: { x: 0.5, y: 0.75 },
  },
  "product:correa-retractil-5m-demo": {
    source: "unsplash",
    pageUrl: "https://unsplash.com/photos/XB5d-wHKOaw",
    imageUrl:
      "https://images.unsplash.com/photo-1644416225353-adc117940526?w=1600&q=80&fm=jpg&fit=max",
    photographer: "Tug Pet Products",
    photographerUrl: "https://unsplash.com/@tugleash",
    alt: "Persona sujeta una correa retráctil negra junto a un perro color arena sentado sobre pasto sintético",
  },
};

/** Nombre del archivo procesado para una clave del manifiesto. */
export const photoFileName = (key: string) => `${key.replace(":", "-")}.webp`;
