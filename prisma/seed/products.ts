import type {
  Authenticity,
  PaymentMethod,
  ProductCondition,
  WarrantyType,
} from "../../src/generated/prisma/enums";

/**
 * Vendedores y productos de DEMOSTRACIÓN (solo desarrollo). Sus perfiles lo dicen explícitamente.
 * Los precios y costos están en pesos; el seed los convierte a centavos.
 */
export type ProductSeed = {
  slug: string;
  title: string;
  description: string;
  price: number;
  cost: number;
  stock: number;
  categorySlug: string;
  communitySlug: string;
  condition: ProductCondition;
  authenticity: Authenticity;
  warrantyType: WarrantyType;
  warrantyDays?: number;
  returnWindowDays: number;
  pickupAvailable: boolean;
  localDeliveryZones: string[];
  nationalShipping?: { price: number; minDays: number; maxDays: number };
  tags: string[];
  postBody: string;
};

export type SellerSeed = {
  key: string;
  username: string;
  displayName: string;
  city: string;
  state: string;
  paymentMethods: PaymentMethod[];
  products: ProductSeed[];
};

export const demoSellers: SellerSeed[] = [
  {
    key: "electro",
    username: "demo.electro",
    displayName: "Electro Demo CDMX",
    city: "Ciudad de México",
    state: "CDMX",
    paymentMethods: ["CARD", "TRANSFER", "CASH_ON_DELIVERY"],
    products: [
      {
        slug: "airpods-pro-2-demo",
        title: "AirPods Pro 2",
        description:
          "Audífonos inalámbricos con cancelación activa de ruido, modo ambiente y estuche de carga. Nuevos y sellados.",
        price: 3499,
        cost: 2400,
        stock: 50,
        categorySlug: "audio",
        communitySlug: "tecnologia",
        condition: "NEW",
        authenticity: "DECLARED_ORIGINAL",
        warrantyType: "SELLER",
        warrantyDays: 90,
        returnWindowDays: 7,
        pickupAvailable: true,
        localDeliveryZones: ["Benito Juárez", "Coyoacán", "Cuauhtémoc", "Miguel Hidalgo"],
        nationalShipping: { price: 99, minDays: 2, maxDays: 5 },
        tags: ["audífonos", "inalámbricos", "cancelación de ruido"],
        postBody:
          "Silencio total en el metro 🎧 AirPods Pro 2 nuevos, con entrega en CDMX o envío a todo México.",
      },
      {
        slug: "control-inalambrico-demo",
        title: "Control inalámbrico para consola y PC",
        description:
          "Control Bluetooth con vibración, batería recargable de 20 horas y compatibilidad con PC y consolas.",
        price: 1199,
        cost: 780,
        stock: 20,
        categorySlug: "accesorios-gaming",
        communitySlug: "gaming",
        condition: "NEW",
        authenticity: "GENERIC",
        warrantyType: "SELLER",
        warrantyDays: 60,
        returnWindowDays: 7,
        pickupAvailable: true,
        localDeliveryZones: ["Benito Juárez", "Coyoacán"],
        nationalShipping: { price: 99, minDays: 2, maxDays: 5 },
        tags: ["control", "gaming", "bluetooth"],
        postBody:
          "Para las retas del fin 🎮 Control inalámbrico con 20 h de batería. ¿Quién se apunta?",
      },
      {
        slug: "cargador-usb-c-30w-demo",
        title: "Cargador rápido USB-C 30 W",
        description:
          "Cargador compacto de carga rápida para celulares y tabletas. Incluye cable USB-C de 1 m.",
        price: 349,
        cost: 150,
        stock: 120,
        categorySlug: "celulares",
        communitySlug: "tecnologia",
        condition: "NEW",
        authenticity: "GENERIC",
        warrantyType: "SELLER",
        warrantyDays: 30,
        returnWindowDays: 7,
        pickupAvailable: true,
        localDeliveryZones: ["Benito Juárez", "Cuauhtémoc"],
        nationalShipping: { price: 0, minDays: 3, maxDays: 6 },
        tags: ["cargador", "usb-c", "carga rápida"],
        postBody: "Del 0 al 50 % en media hora ⚡ Cargador USB-C de 30 W con envío gratis.",
      },
      {
        slug: "teclado-mecanico-compacto-demo",
        title: "Teclado mecánico compacto 65 %",
        description:
          "Teclado mecánico con switches rojos, retroiluminación RGB y conexión USB-C. Distribución en español.",
        price: 1299,
        cost: 820,
        stock: 15,
        categorySlug: "computacion",
        communitySlug: "gaming",
        condition: "NEW",
        authenticity: "GENERIC",
        warrantyType: "SELLER",
        warrantyDays: 90,
        returnWindowDays: 7,
        pickupAvailable: true,
        localDeliveryZones: [],
        nationalShipping: { price: 129, minDays: 3, maxDays: 6 },
        tags: ["teclado", "mecánico", "rgb"],
        postBody:
          "Ese clic-clac que te hace escribir más rápido ⌨️ Teclado mecánico compacto 65 %.",
      },
    ],
  },
  {
    key: "casa",
    username: "demo.casa",
    displayName: "Casa y Estilo Demo",
    city: "Guadalajara",
    state: "Jalisco",
    paymentMethods: ["CARD", "TRANSFER", "OXXO"],
    products: [
      {
        slug: "tenis-running-ligeros-demo",
        title: "Tenis para correr ultraligeros",
        description:
          "Tenis de running con suela amortiguada y malla transpirable. Tallas 23 a 29. Ideales para tu primera carrera.",
        price: 1499,
        cost: 900,
        stock: 30,
        categorySlug: "tenis",
        communitySlug: "deportes",
        condition: "NEW",
        authenticity: "GENERIC",
        warrantyType: "NONE",
        returnWindowDays: 15,
        pickupAvailable: false,
        localDeliveryZones: ["Zapopan", "Guadalajara Centro"],
        nationalShipping: { price: 149, minDays: 3, maxDays: 7 },
        tags: ["tenis", "running", "deporte"],
        postBody: "Tus primeros 5 km merecen buenos tenis 🏃 Ultraligeros y con amortiguación.",
      },
      {
        slug: "prensa-francesa-1l-demo",
        title: "Prensa francesa de 1 L",
        description:
          "Cafetera de émbolo de vidrio borosilicato y acero inoxidable. Rinde 8 tazas. Fácil de limpiar.",
        price: 459,
        cost: 230,
        stock: 40,
        categorySlug: "cocina",
        communitySlug: "hogar",
        condition: "NEW",
        authenticity: "GENERIC",
        warrantyType: "SELLER",
        warrantyDays: 30,
        returnWindowDays: 15,
        pickupAvailable: true,
        localDeliveryZones: ["Zapopan", "Tlaquepaque"],
        nationalShipping: { price: 119, minDays: 3, maxDays: 7 },
        tags: ["café", "cocina", "cafetera"],
        postBody: "El café de la mañana, pero mejor ☕ Prensa francesa de 1 litro.",
      },
      {
        slug: "maceta-barro-pintada-demo",
        title: "Maceta de barro pintada a mano",
        description:
          "Maceta de barro de Tonalá pintada a mano, 15 cm de diámetro. Cada pieza es única.",
        price: 289,
        cost: 120,
        stock: 25,
        categorySlug: "hecho-a-mano",
        communitySlug: "hogar",
        condition: "NEW",
        authenticity: "NOT_APPLICABLE",
        warrantyType: "NONE",
        returnWindowDays: 0,
        pickupAvailable: true,
        localDeliveryZones: ["Tonalá", "Guadalajara Centro"],
        nationalShipping: { price: 99, minDays: 4, maxDays: 8 },
        tags: ["artesanía", "plantas", "barro"],
        postBody: "Hecha a mano en Tonalá 🌱 Cada maceta es única, como tus plantas.",
      },
      {
        slug: "correa-retractil-5m-demo",
        title: "Correa retráctil para perro de 5 m",
        description:
          "Correa retráctil con freno de un toque y mango antiderrapante. Para perros de hasta 25 kg.",
        price: 329,
        cost: 160,
        stock: 35,
        categorySlug: "mascotas",
        communitySlug: "mascotas",
        condition: "NEW",
        authenticity: "GENERIC",
        warrantyType: "SELLER",
        warrantyDays: 30,
        returnWindowDays: 7,
        pickupAvailable: false,
        localDeliveryZones: ["Zapopan"],
        nationalShipping: { price: 99, minDays: 3, maxDays: 7 },
        tags: ["perros", "paseo", "correa"],
        postBody: "Paseos más tranquilos 🐕 Correa retráctil de 5 m con freno de un toque.",
      },
    ],
  },
];
