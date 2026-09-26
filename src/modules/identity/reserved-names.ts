/**
 * Nombres que suplantan a la plataforma (SEC-18): nadie más puede llamarse «Equipo VendeIA»,
 * «Soporte» o `equipo.gaming`. Las cuentas editoriales reales las crea el seed directo en la base,
 * sin pasar por estos esquemas.
 *
 * Se compara en una forma «plegada»: sin acentos ni variantes de ancho (NFKD), en minúsculas, con
 * las letras cirílicas/griegas que parecen latinas y los dígitos que imitan letras (0→o, 1→i/l,
 * 3→e, 4→a, 5→s, 7→t, @→a, $→s) cambiados, y sin separadores. Así «Equipo VendeIA»,
 * «équipo.vende1a» y «EQUIPO_VENDE-IA» son lo mismo.
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

/** La palabra leída sin «leet»; el 1 se prueba como i y como l (dos lecturas, nunca más). */
function unLeet(word: string, one: "i" | "l") {
  return word.replace(/[013457@$]/g, (char) => (char === "1" ? one : (LEET[char] ?? char)));
}

const ONE_READINGS = ["i", "l"] as const;

/**
 * `true` si un nombre visible (nombre de la cuenta, nombre en el perfil, nombre de tienda) suplanta a
 * la plataforma: contiene la marca o está hecho solo de palabras de rol («Soporte», «Equipo de
 * soporte», «Admin 24»).
 */
export function isPlatformImpersonation(name: string): boolean {
  const raw = tokens(name);
  return ONE_READINGS.some((one) => {
    const readable = raw.map((word) => unLeet(word, one));
    // La marca, aunque venga partida («Vende IA», «V.e.n.d.e.I.A») o con dígitos en vez de letras.
    if (readable.join("").includes(BRAND)) return true;

    let hasRole = false;
    for (const [index, word] of readable.entries()) {
      // Un número suelto («Soporte 24») no le quita el sentido de rol.
      if (/^\d+$/.test(raw[index] ?? "")) continue;
      if (ROLE_WORDS.has(word)) hasRole = true;
      else if (!FILLER_WORDS.has(word)) return false;
    }
    return hasRole;
  });
}

/**
 * `true` si el nombre de usuario (ya normalizado: minúsculas, `[a-z0-9._]`) está reservado: rutas
 * propias, la marca en cualquier parte, o empieza con / contiene como segmento una palabra de rol
 * (`equipo.soporte`, `vendeia.oficial`, `admin_mx`, `tienda.oficial`, `s0porte`).
 */
export function isReservedUsername(username: string): boolean {
  if (RESERVED_USERNAMES.has(username)) return true;
  const segments = username.split(/[._]+/).filter(Boolean);
  return ONE_READINGS.some((one) => {
    const readable = segments.map((segment) => unLeet(segment, one));
    const compact = readable.join("");
    return (
      compact.includes(BRAND) ||
      RESERVED_USERNAME_PREFIXES.some((prefix) => compact.startsWith(prefix)) ||
      readable.some((segment) => RESERVED_USERNAME_SEGMENTS.has(segment))
    );
  });
}
