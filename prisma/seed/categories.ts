export type CategorySeed = {
  slug: string;
  name: string;
  children?: { slug: string; name: string }[];
};

/** Taxonomía inicial de productos. */
export const categories: CategorySeed[] = [
  {
    slug: "electronica",
    name: "Electrónica",
    children: [
      { slug: "audio", name: "Audio y audífonos" },
      { slug: "celulares", name: "Celulares y accesorios" },
      { slug: "computacion", name: "Computación" },
    ],
  },
  {
    slug: "videojuegos",
    name: "Videojuegos",
    children: [
      { slug: "consolas", name: "Consolas" },
      { slug: "accesorios-gaming", name: "Accesorios gaming" },
    ],
  },
  {
    slug: "moda",
    name: "Moda",
    // Los huecos de un look (ADR-043, `stylist/slots.ts`) salen de estas categorías; «Ropa» queda
    // como genérica y se clasifica por palabras.
    children: [
      { slug: "camisas-y-blusas", name: "Camisas, blusas y playeras" },
      { slug: "pantalones-y-faldas", name: "Pantalones, jeans y faldas" },
      { slug: "vestidos", name: "Vestidos y conjuntos" },
      { slug: "chamarras-y-sacos", name: "Chamarras, sacos y suéteres" },
      { slug: "ropa", name: "Otra ropa" },
      { slug: "tenis", name: "Tenis y calzado" },
      { slug: "bolsas", name: "Bolsas y mochilas" },
      { slug: "relojes-y-joyeria", name: "Relojes y joyería" },
      { slug: "accesorios-moda", name: "Accesorios" },
    ],
  },
  { slug: "belleza", name: "Belleza y cuidado personal" },
  {
    slug: "hogar",
    name: "Hogar",
    children: [
      { slug: "cocina", name: "Cocina" },
      { slug: "decoracion", name: "Decoración y plantas" },
    ],
  },
  { slug: "deportes", name: "Deportes y fitness" },
  { slug: "mascotas", name: "Mascotas" },
  { slug: "comida", name: "Comida y bebida" },
  { slug: "autos", name: "Autos y motos" },
  { slug: "musica-instrumentos", name: "Música e instrumentos" },
  { slug: "libros", name: "Libros y cursos" },
  { slug: "hecho-a-mano", name: "Hecho a mano" },
  { slug: "servicios", name: "Servicios" },
];
