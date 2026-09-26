/**
 * Nombres que suplantan a la plataforma (SEC-18): nadie más puede llamarse «Equipo VendeIA»,
 * «Soporte» o `equipo.gaming`. Las cuentas editoriales reales las crea el seed directo en la base,
 * sin pasar por estos esquemas.
 *
 * Se compara en una forma «plegada»: sin acentos ni variantes de ancho (NFKD), en minúsculas, con
 * las letras cirílicas/griegas que parecen latinas y los dígitos que imitan letras (0→o, 1→i/l,
 * 3→e, 4→a, 5→s, 7→t, @→a, $→s) cambiados, y sin separadores. Así «Equipo VendeIA»,
 * «équipo.vende1a» y «EQUIPO_VENDE-IA» son lo mismo. Para la marca, además, la «l» minúscula se lee
 * como la «I» mayúscula que imita («VendelA») y se toleran un par de letras de otros alfabetos.
 */

/** Marca de la plataforma: no puede aparecer en ningún nombre (tampoco «Vende IA» o «vende_ia»). */
const BRAND = "vendeia";

/** Palabras de rol: un nombre formado solo por ellas («Soporte técnico») suplanta a la plataforma. */
const ROLE_WORDS = new Set([
  "equipo",
  "soporte",
  "admin",
  "administrador",
  "administradora",
  "administracion",
  "moderador",
  "moderadora",
  "moderacion",
  "staff",
  "oficial",
  "ayuda",
  "seguridad",
  "sistema",
  "plataforma",
  "atencion",
  "servicio",
  "cliente",
  "clientes",
  "tecnico",
  "verificado",
  "verificada",
  "verificacion",
  "cuenta",
  "notificaciones",
  "support",
  "official",
  "team",
  "help",
  "security",
  "trust",
  "safety",
]);

/** Palabras de relleno que no cambian el sentido («Equipo de soporte», «Soporte MX»). */
const FILLER_WORDS = new Set([
  "a",
  "al",
  "de",
  "del",
  "e",
  "el",
  "en",
  "la",
  "las",
  "los",
  "para",
  "y",
  "mx",
  "mexico",
  "latam",
]);

/** Usuarios que chocan con rutas o suplantan a la plataforma (coincidencia exacta). */
const RESERVED_USERNAMES = new Set([
  "admin",
  "administrador",
  "soporte",
  "ayuda",
  "studio",
  "api",
  "media",
  "vendeia",
  "equipo",
  "oficial",
]);

/** Un usuario no puede empezar así: `equipo.<comunidad>` es el espacio de las cuentas editoriales. */
const RESERVED_USERNAME_PREFIXES = [
  "equipo",
  BRAND,
  "admin",
  "soporte",
  "oficial",
  "staff",
  "moderador",
];

/** Un segmento de usuario (entre `.` o `_`) no puede ser uno de estos: `tienda.oficial`. */
const RESERVED_USERNAME_SEGMENTS = new Set([
  "equipo",
  "soporte",
  "admin",
  "administrador",
  "administracion",
  "moderador",
  "moderacion",
  "staff",
  "oficial",
  "support",
  "official",
]);

// Letras cirílicas y griegas que se ven como latinas (las que no desaparecen con NFKD).
const CONFUSABLES: Record<string, string> = {
  а: "a",
  в: "b",
  е: "e",
  ё: "e",
  і: "i",
  ї: "i",
  ј: "j",
  к: "k",
  м: "m",
  н: "h",
  о: "o",
  р: "p",
  с: "c",
  т: "t",
  у: "y",
  х: "x",
  ѕ: "s",
  ԁ: "d",
  α: "a",
  β: "b",
  ε: "e",
  η: "n",
  ι: "i",
  κ: "k",
  ν: "v",
  ο: "o",
  ρ: "p",
  τ: "t",
  υ: "u",
  χ: "x",
};

const LEET: Record<string, string> = {
  "0": "o",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
};

/**
 * Palabras de contexto: junto a una palabra de rol no le quitan ese sentido («Soporte de pagos»,
 * «Moderación de la comunidad»), pero solas no lo dan («Pagos», «Centro Joyero» pasan).
 */
const CONTEXT_WORDS = new Set([
  "pago",
  "pagos",
  "cobro",
  "cobros",
  "cuentas",
  "usuario",
  "usuarios",
  "vendedor",
  "vendedora",
  "vendedores",
  "vendedoras",
  "comprador",
  "compradora",
  "compradores",
  "compras",
  "ventas",
  "envio",
  "envios",
  "pedido",
  "pedidos",
  "reembolso",
  "reembolsos",
  "devoluciones",
  "centro",
  "mesa",
  "comunidad",
  "comunidades",
  "tecnica",
  "tecnicos",
  "general",
  "oficiales",
  "equipos",
  "contacto",
  "linea",
  "online",
  "app",
  "aplicacion",
  "confianza",
  "fraude",
  "fraudes",
  "prevencion",
  "payments",
  "account",
  "accounts",
  "customer",
  "service",
  "center",
  "desk",
]);

/** Marca de posición para una letra de otro alfabeto que no está en `CONFUSABLES`. */
const UNKNOWN = "?";
/** Letras desconocidas que se toleran dentro de la marca («VendeꟾA» con una I de otro alfabeto). */
const MAX_UNKNOWN_IN_BRAND = 2;

/** Sin acentos, en minúsculas y con las letras parecidas cambiadas; conserva el resto. */
function fold(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{ASCII}]/gu, (char) => CONFUSABLES[char] ?? char);
}

/** Palabras del texto plegado (letras, dígitos y los símbolos que imitan letras). */
function tokens(value: string) {
  return fold(value)
    .split(/[^a-z0-9@$]+/)
    .filter(Boolean);
}

/** La palabra sin «leet»; el 1 se lee como `one` («i» o «l»). */
function unLeet(word: string, one: "i" | "l") {
  return word.replace(/[013457@$]/g, (char) => (char === "1" ? one : (LEET[char] ?? char)));
}

/**
 * Lecturas de una palabra: el 1 como «i» o como «l» y, como la «l» y la «I» son el mismo trazo, toda
 * «l» como «i» («Soporte Oflcial», `equlpo.gaming`). Cada lectura se aplica igual a la palabra y a
 * las listas, así que tres lecturas bastan (nunca combinaciones).
 */
const READINGS = [
  (word: string) => unLeet(word, "i"),
  (word: string) => unLeet(word, "l"),
  (word: string) => unLeet(word, "i").replace(/l/g, "i"),
].map((read) => {
  const readAll = (words: Iterable<string>) => new Set([...words].map(read));
  return {
    read,
    role: readAll(ROLE_WORDS),
    filler: readAll(FILLER_WORDS),
    context: readAll(CONTEXT_WORDS),
    usernamePrefixes: [...readAll(RESERVED_USERNAME_PREFIXES)],
    usernameSegments: readAll(RESERVED_USERNAME_SEGMENTS),
  };
});

type Reading = (typeof READINGS)[number];

/**
 * En la tipografía de la app la «l» minúscula y la «I» mayúscula son el mismo trazo: «VendelA» se ve
 * como «VendeIA». Aquí la «l» se lee como «i», salvo seguida de minúscula («vende la ropa»,
 * «Véndela»), que es como se escribe en español y no imita a la marca.
 */
function readLAsI(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/l(?!\p{Ll})/gu, "i");
}

/**
 * El nombre reducido a lo que se lee: letras latinas (con la «l» como «i», «|», «!» y «¡» como «i», y
 * sin «leet»), `UNKNOWN` por cada letra de otro alfabeto y nada más (espacios, puntos, emojis y
 * caracteres invisibles desaparecen).
 */
function brandSkeleton(value: string) {
  return (
    fold(readLAsI(value))
      .replace(/[|!¡]/g, "i")
      // Un «?» escrito no cuenta como letra desconocida: solo las letras de otros alfabetos.
      .replace(/[^a-z0-9@$]/gu, (char) =>
        /[^\p{ASCII}]/u.test(char) && /\p{L}/u.test(char) ? UNKNOWN : "",
      )
      .replace(/[013457@$]/g, (char) => (char === "1" ? "i" : (LEET[char] ?? char)))
  );
}

/** La marca en el esqueleto, con a lo más `MAX_UNKNOWN_IN_BRAND` letras desconocidas en su lugar. */
function containsBrand(skeleton: string) {
  if (skeleton.includes(BRAND)) return true;
  if (!skeleton.includes(UNKNOWN)) return false;
  for (let start = 0; start + BRAND.length <= skeleton.length; start += 1) {
    let unknown = 0;
    let matches = true;
    for (let index = 0; index < BRAND.length; index += 1) {
      const char = skeleton[start + index];
      if (char === UNKNOWN) unknown += 1;
      else if (char !== BRAND[index]) {
        matches = false;
        break;
      }
    }
    if (matches && unknown <= MAX_UNKNOWN_IN_BRAND) return true;
  }
  return false;
}

/** Palabras que solo nombran un rol de la plataforma, con relleno y contexto. */
function isRoleOnly(raw: readonly string[], { read, role, filler, context }: Reading) {
  const readable = raw.map(read);
  // Letras sueltas: «S o p o r t e».
  if (role.has(readable.join(""))) return true;

  let hasRole = false;
  for (const [index, word] of readable.entries()) {
    // Un número suelto («Soporte 24») no le quita el sentido de rol.
    if (/^\d+$/.test(raw[index] ?? "")) continue;
    if (role.has(word)) hasRole = true;
    else if (!filler.has(word) && !context.has(word)) return false;
  }
  return hasRole;
}

/**
 * `true` si un nombre visible (nombre de la cuenta, nombre en el perfil, nombre de tienda) suplanta a
 * la plataforma: contiene la marca (partida, «Vende IA»; con dígitos, «Vende1A»; con letras
 * parecidas, «VendelA», «Vende|A», «VendeꟾA») o está hecho solo de palabras de rol con relleno y
 * contexto («Soporte», «Equipo de soporte», «Admin 24», «Soporte de pagos»).
 */
export function isPlatformImpersonation(name: string): boolean {
  if (containsBrand(brandSkeleton(name))) return true;
  const raw = tokens(name);
  return READINGS.some((reading) => isRoleOnly(raw, reading));
}

/**
 * `true` si el nombre de usuario (ya normalizado: minúsculas, `[a-z0-9._]`) está reservado: rutas
 * propias, la marca en cualquier parte, o empieza con / contiene como segmento una palabra de rol
 * (`equipo.soporte`, `vendeia.oficial`, `admin_mx`, `tienda.oficial`, `s0porte`, `equlpo.gaming`).
 */
export function isReservedUsername(username: string): boolean {
  if (RESERVED_USERNAMES.has(username)) return true;
  const segments = username.split(/[._]+/).filter(Boolean);
  return READINGS.some(({ read, usernamePrefixes, usernameSegments }) => {
    const readable = segments.map(read);
    const compact = readable.join("");
    return (
      compact.includes(BRAND) ||
      usernamePrefixes.some((prefix) => compact.startsWith(prefix)) ||
      readable.some((segment) => usernameSegments.has(segment))
    );
  });
}
