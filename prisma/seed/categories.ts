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
    children: [
      { slug: "ropa", name: "Ropa" },
      { slug: "tenis", name: "Tenis y calzado" },
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
