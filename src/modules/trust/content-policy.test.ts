import { afterEach, describe, expect, it, vi } from "vitest";
import {
  blockedByPolicy,
  type ManualCategory,
  PROHIBITED_HELP,
  prohibitedForAi,
  prohibitedInListing,
  prohibitedInPost,
  prohibitedMessage,
} from "./content-policy";

/**
 * Cada categoría con lo que SÍ detiene y lo que NO (un falso positivo deja a alguien sin publicar
 * algo legítimo): «cargador» del celular, «carey» de unos lentes, «crack» de un futbolista…
 */
const BLOCKED: [ManualCategory, string][] = [
  // Armas, partes y accesorios (LFAFE arts. 52 y 83 Sexies).
  ["weapons", "Pistola 9 mm con cargador"],
  ["weapons", "Revólver calibre 38"],
  ["weapons", "Cartuchos calibre .22"],
  ["weapons", "Cargador para rifle AR-15 de 30 tiros"],
  ["weapons", "Cargador de 30 tiros"],
  ["weapons", "Cargador extendido tipo tambor"],
  ["weapons", "Mira holográfica para cacería"],
  ["weapons", "Mira térmica con retícula"],
  ["weapons", "Visor de visión nocturna"],
  ["weapons", "Visión nocturna para casco táctico"],
  ["weapons", "Archivo STL de pistola para imprimir"],
  ["weapons", "Kit de conversión para pistola"],
  ["weapons", "Funda para arma corta"],
  ["weapons", "Portacargador táctico"],
  ["weapons", "Municiones 9 mm"],
  ["weapons", "Caja de municiones"],
  // Drogas y medicamentos con receta (sin cambios).
  ["drugs", "Gomitas con THC"],
  ["prescription", "Clonazepam 2 mg"],
  // Vapeadores, líquidos y cápsulas (LGS art. 282 Quater).
  ["vapes", "Vape desechable sabor mango"],
  ["vapes", "Pods desechables de sabores"],
  ["vapes", "Elf Bar 5000 puffs"],
  ["vapes", "Desechable 15k puffs"],
  ["vapes", "Desechable de 12,000 caladas"],
  ["vapes", "Líquido para vapeo de fresa"],
  ["vapes", "Sales de nicotina 30 ml"],
  // Tabaco por internet y marcas de cigarros (LGCT art. 16 fr. IV y VI).
  ["tobacco", "Cigarros Marlboro rojos"],
  ["tobacco", "Cajetilla de 20"],
  ["tobacco", "Puros cubanos en caja de madera"],
  ["tobacco", "Tabaco para pipa sabor vainilla"],
  ["tobacco", "Chamarra Marlboro vintage"],
  // Piratería y elusión de protecciones (LFDA 231 y 232 Bis).
  ["piracy", "Servicio IPTV 3 meses"],
  ["piracy", "Fire Stick cargado con todo"],
  ["piracy", "TV Box 4K cargado"],
  ["piracy", "Box Android cargado"],
  ["piracy", "Roku cargado"],
  ["piracy", "Cargado con canales y películas"],
  ["piracy", "Magis TV de por vida"],
  ["piracy", "Cuenta Netflix compartida 1 mes"],
  ["piracy", "Pantalla de Disney+ por $60"],
  ["piracy", "Spotify compartido"],
  ["piracy", "Cuenta de Netflix"],
  ["piracy", "Vendo mi cuenta de Netflix"],
  ["piracy", "Vendo perfil de Spotify"],
  ["piracy", "Curso completo PDF"],
  ["piracy", "Curso completo de inglés en PDF"],
  ["piracy", "Mega pack de cursos de diseño"],
  ["piracy", "+500 libros en PDF"],
  ["piracy", "Office 2021 crackeado"],
  ["piracy", "Crack de Photoshop"],
  ["piracy", "Crack para juegos de PC"],
  ["piracy", "Juegos crackeados para PC"],
  ["piracy", "Activador de Windows 11"],
  ["piracy", "Desbloqueo de iCloud"],
  ["piracy", "Quitamos cuenta Google (FRP)"],
  ["piracy", "Xbox 360 chipeado con juegos"],
  // Venta de facturas (CFF art. 113 Bis).
  ["fake_invoices", "Vendo facturas"],
  ["fake_invoices", "Facturas deducibles para tu empresa"],
  ["fake_invoices", "Facturas al 3%"],
  ["fake_invoices", "Facturas con 8% de comisión"],
  ["fake_invoices", "Compramos facturas"],
  ["fake_invoices", "Facturas de todos los giros"],
  ["fake_invoices", "Facturación sin compra"],
  // Servicios sexuales y reclutamiento (LGPSEDMTP arts. 32, 33 y 106).
  ["sexual_services", "Servicios de acompañante"],
  ["sexual_services", "Escorts independientes"],
  ["sexual_services", "Masajes con final feliz"],
  ["sexual_services", "Masaje erótico a domicilio"],
  ["sexual_services", "Chicas de compañía"],
  ["sexual_services", "Vendo mis packs"],
  ["sexual_services", "Se solicitan señoritas para bar"],
  ["sexual_services", "Se solicita señorita para cantina"],
  ["sexual_services", "Se solicitan meseras para table dance"],
  ["sexual_services", "Se solicitan chicas de 17 a 25 años, gana $3,000 diarios"],
  ["sexual_services", "Se solicitan chicas, gana $1,500 diarios"],
  ["sexual_services", "Buscamos señoritas, gana hasta $5,000 a la semana"],
  ["sexual_services", "Buscamos modelos, trabajo en el extranjero con viaje pagado"],
  ["sexual_services", "Modelos webcam desde casa"],
  ["sexual_services", "Se solicitan ficheras"],
  // Fauna silvestre protegida (LGVS; CPF art. 420).
  ["wildlife", "Peine de concha de carey"],
  ["wildlife", "Carey auténtico de tortuga"],
  ["wildlife", "Huevos de tortuga"],
  ["wildlife", "Guacamaya bebé"],
  ["wildlife", "Loro cabeza amarilla"],
  ["wildlife", "Pichones de loro"],
  ["wildlife", "Vendo loro que habla"],
  ["wildlife", "Buche de totoaba"],
  ["wildlife", "Piel de jaguar"],
];

const ALLOWED = [
  // Cargadores, miras y «pistolas» que no son armas.
  "Cargador para iPhone 15 de carga rápida",
  "Cargador portátil 20,000 mAh",
  "Cargador para pistola de impacto DeWalt",
  "Pistola de silicón para manualidades",
  "Pistola Nerf con dardos",
  "Pistola de calor para vinil",
  "Pistola térmica industrial",
  "Pistola lectora de código de barras",
  "Rifle de juguete",
  "Cámara de seguridad WiFi con visión nocturna",
  "Lentes de visión nocturna para manejar",
  "Cable THW calibre 12",
  "Cable calibre 22 AWG",
  "Aguja calibre 22",
  "Playera de Calibre 50",
  "Pala para revolver la mezcla",
  "Pistola de paintball",
  "Municiones de hidrogel, 10,000 piezas",
  "Municiones para pistola de hidrogel",
  "Municiones para Nerf",
  // Vapores y tabaco que no son lo prohibido.
  "Vaporizador facial",
  "Vaporizador de aceites esenciales",
  "Pantalón corte cigarro",
  "Pantalón tipo cigarro negro",
  "Botas color tabaco",
  "Perfume notas de tabaco y vainilla",
  "Zapatos color habano",
  "Cigarros de chocolate",
  "Encendedor para cigarros",
  "Cajetilla de cerillos",
  "Abrigo color camel",
  "Puff para sala",
  "Juego de 2 puffs de terciopelo",
  // Tecnología legítima.
  "Celular liberado",
  "Celular desbloqueado de fábrica, desbloqueo facial",
  "Smart TV con Netflix y YouTube",
  "Inicia sesión con tu cuenta de Netflix",
  "Antena HD, canales gratis sin mensualidad",
  "Decodificador digital",
  "Switch inteligente con chip WiFi",
  "Nintendo Switch nuevo",
  "Celular cargado al 100 %",
  "Box cargado de dulces para regalo",
  "Tablet para niños cargada con aplicaciones educativas",
  "Tablet cargada con contenido educativo",
  "Playera oficial de la banda, escúchanos en nuestro perfil de Spotify",
  "Mi guía de recetas en PDF",
  "Paquete de 3 libros digitales para colorear",
  "Curso de bordado presencial",
  "Activador de rizos",
  "Gel activador de bronceado",
  // Facturas legítimas.
  "Emitimos facturas deducibles",
  "Se entrega factura deducible",
  "Precio más IVA, factura con 16% de IVA",
  "Contamos con facturas deducibles",
  "Ofrecemos facturas electrónicas",
  "Factura con 16% adicional",
  // Trabajo y servicios legítimos.
  "Masaje relajante y descontracturante",
  "Se solicita señorita para mostrador, sueldo atractivo",
  "Se solicitan meseras para hotel, con hospedaje, no menores de edad",
  "Se solicitan meseras para bar, sueldo base más propinas",
  "Se solicitan edecanes para bar",
  "Se solicitan meseras para restaurante, ganas $2,500 a la semana más propinas",
  "Dama de compañía para adulto mayor",
  "Ford Escort 1998",
  "Pack de 6 cervezas",
  "Vendo pack de calcetas",
  "Pack Hot Wheels de 5",
  // Animales que no son fauna protegida a la venta.
  "Lentes de carey",
  "Armazón carey para lentes",
  "Peluche de guacamaya",
  "Cojín guacamaya",
  "Peluche de loro que habla",
  "Figura de tortuga carey de resina",
  "Perico australiano bebé",
  "Collar de tortuga marina",
  "Vestido color marfil",
  // Sin relación.
  "AirPods Pro 2 originales",
  "Lentes de sol sin receta",
  "Pilas AAA recargables",
  "Cuchara para revolver",
];

describe("prohibitedInListing (ficha de producto)", () => {
  it.each(BLOCKED)("detiene %s: «%s»", (category, text) => {
    expect(prohibitedInListing(text)).toBe(category);
  });

  it.each(ALLOWED)("no detiene: «%s»", (text) => {
    expect(prohibitedInListing(text)).toBeNull();
  });

  it("revisa título, descripción y etiquetas juntos", () => {
    expect(prohibitedInListing("Caja negra", "Viene cargada con canales y series", "tv")).toBe(
      "piracy",
    );
  });

  it("no detiene las réplicas: las evalúa el motor de riesgo de falsificación", () => {
    expect(prohibitedInListing("AirPods Pro réplica AAA")).toBeNull();
    expect(prohibitedInListing("100 % originales, no es réplica")).toBeNull();
  });

  it("revisa el texto normalizado (ancho completo, invisibles, acentos y mayúsculas)", () => {
    expect(prohibitedInListing("ＩＰＴＶ premium")).toBe("piracy");
    expect(prohibitedInListing("IP​TV premium")).toBe("piracy");
    expect(prohibitedInListing("VENDO FACTURAS")).toBe("fake_invoices");
    expect(prohibitedInListing("MIRA HOLOGRÁFICA")).toBe("weapons");
  });

  it("un texto muy largo se revisa rápido (hasta 60,000 caracteres en una publicación)", () => {
    const long = "Bolsa de piel hecha a mano con cargador para celular. ".repeat(1_100);
    const started = performance.now();
    expect(prohibitedInListing(long)).toBeNull();
    expect(prohibitedInPost(long, { offer: true })).toBeNull();
    expect(performance.now() - started).toBeLessThan(1_000);
  });
});

describe("prohibitedInPost (publicación)", () => {
  it.each([
    ["piracy", "Tengo IPTV con todos los canales"],
    ["piracy", "Cuentas de Netflix compartidas, pregunten"],
    ["fake_invoices", "¿Necesitas facturas deducibles? Mándame mensaje"],
    ["sexual_services", "Masajes con final feliz, zona Roma"],
    ["sexual_services", "Se solicitan chicas, gana $20,000 a la semana, viaje pagado"],
    ["wildlife", "Vendo guacamaya"],
  ] as const)("una oferta se detiene aunque no diga precio: %s «%s»", (category, text) => {
    expect(prohibitedInPost(text, { offer: false })).toBe(category);
  });

  it.each([
    "Dejé el vape hace un mes y me siento mejor",
    "Vi una guacamaya bebé en Palenque",
    "¿Alguien sabe cómo quitar la cuenta de Google de un celular?",
    "Messi es un crack",
    "Ese chavo es el crack del juego",
    "Fue el crack del programa de anoche",
    "Busco diseñador que sea un crack de Photoshop",
    "Ayer vi una película de ficheras con mi abuelo",
    "Las tortugas carey anidan en Quintana Roo",
    "Mi abuelo fumaba cigarros sin filtro",
    "La mira del concierto estuvo increíble",
  ])("hablar de algo no es venderlo: «%s»", (text) => {
    expect(prohibitedInPost(text, { offer: false })).toBeNull();
  });

  it.each([
    ["vapes", "Vapes desechables, envíos a todo México"],
    ["tobacco", "Cigarros sueltos a $5, pregunta por inbox"],
    ["weapons", "Pistola 9 mm, precio a tratar"],
    ["wildlife", "Loro cabeza amarilla, informes por WhatsApp"],
    ["piracy", "Desbloqueo de iCloud, precios económicos"],
  ] as const)(
    "los artículos se detienen cuando el texto ofrece algo: %s «%s»",
    (category, text) => {
      expect(prohibitedInPost(text, { offer: false })).toBe(category);
    },
  );

  it.each([
    "Escucha mi música en mi perfil de Spotify, envíos de discos a todo México",
    "Box cargado de dulces, pedidos por inbox",
  ])("una oferta legítima con palabras parecidas se publica: «%s»", (text) => {
    expect(prohibitedInPost(text, { offer: false })).toBeNull();
  });

  it("etiquetar un producto ya es ofrecer algo", () => {
    expect(prohibitedInPost("Mi vape favorito 😍", { offer: false })).toBeNull();
    expect(prohibitedInPost("Mi vape favorito 😍", { offer: true })).toBe("vapes");
  });
});

describe("prohibitedForAi (la IA, con las categorías de siempre)", () => {
  it("sigue deteniendo réplicas y suma las partes de armas y los líquidos de vapeo", () => {
    expect(prohibitedForAi("Bolsa Louis Vuitton réplica AAA")).toBe("counterfeit");
    expect(prohibitedForAi("Mira holográfica")).toBe("weapons");
    expect(prohibitedForAi("Pods desechables")).toBe("vapes");
  });

  it("las categorías nuevas se revisan al publicar, no en la IA (todavía)", () => {
    expect(prohibitedForAi("Servicio IPTV 3 meses")).toBeNull();
  });
});

describe("mensaje y registro del bloqueo", () => {
  afterEach(() => vi.restoreAllMocks());

  it("nombra la categoría, no acusa y dice dónde ver la lista", () => {
    const message = prohibitedMessage("piracy");
    expect(message).toMatch(/^No se puede publicar\. Tu texto menciona copias sin licencia/);
    expect(message).toContain("Si se trata de otra cosa, cambia esas palabras.");
    // El nombre de la sección tal como aparece en /terminos.
    expect(message).toContain("«Artículos prohibidos y restringidos» en los Términos");
    expect(PROHIBITED_HELP.href).toBe("/terminos#prohibidos");
  });

  it("registra la categoría y el lugar, nunca el texto ni quién lo escribió", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(blockedByPolicy("post.create", "fake_invoices")).toEqual({
      error: prohibitedMessage("fake_invoices"),
      helpLink: PROHIBITED_HELP,
    });
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      "[trust] publicación detenida por la política de contenido: fake_invoices (post.create)",
    );
  });
});
