/**
 * Contraseñas demasiado comunes (SEC-30), revisadas en local y sin llamadas externas. Solo importan
 * las de 10 caracteres o más (el mínimo de la app). Tres filtros:
 *
 * 1. Lista exacta de contraseñas largas que encabezan las filtraciones públicas (y variantes en
 *    español).
 * 2. Palabra base común con números o símbolos alrededor: «Contraseña2026!», «p@ssw0rd123»,
 *    «123teamo456».
 * 3. Forma trivial: sin ninguna letra (teléfonos y fechas), un patrón corto repetido
 *    («aaaaaaaaaa», «abcabcabca») o una secuencia («abcdefghij», «9876543210»).
 */

const COMMON = new Set([
  "1234567890",
  "12345678910",
  "123456789a",
  "1234567890a",
  "a123456789",
  "q123456789",
  "123456789q",
  "123456789z",
  "aa12345678",
  "abc1234567",
  "abcd123456",
  "abcde12345",
  "12345abcde",
  "1234512345",
  "123456123456",
  "1231231231",
  "123123123123",
  "1122334455",
  "1357924680",
  "1472583690",
  "147258369a",
  "1q2w3e4r5t",
  "1q2w3e4r5t6y",
  "1q2w3e4r5t6y7u",
  "1qaz2wsx3edc",
  "1qazxsw23edc",
  "zaq12wsxcde3",
  "zaq1zaq1zaq1",
  "1234qwerasdf",
  "qwer1234asdf",
  "qazwsxedc123",
  "qazwsxedcrfv",
  "trustno1234",
  "iloveyou!1",
  "tqm1234567",
  "passw0rd123",
  "cristiano7",
  "cristiano07",
  "pumasunam1",
]);

/** Palabras base que, con números o símbolos alrededor, siguen siendo contraseñas comunes. */
const COMMON_BASES = new Set([
  "password",
  "contrasena",
  "micontrasena",
  "miclave",
  "clave",
  "qwerty",
  "qwertyuiop",
  "asdfghjkl",
  "asdfghjkln",
  "zxcvbnm",
  "qazwsxedc",
  "iloveyou",
  "teamo",
  "teamomucho",
  "tequiero",
  "tqm",
  "miamor",
  "miamorcito",
  "amor",
  "amoramor",
  "admin",
  "administrador",
  "administrator",
  "adminadmin",
  "welcome",
  "bienvenido",
  "bienvenida",
  "hola",
  "holahola",
  "holamundo",
  "letmein",
  "changeme",
  "secret",
  "secreto",
  "abc",
  "abcd",
  "abcde",
  "abcdef",
  "mexico",
  "mexicolindo",
  "america",
  "chivas",
  "guadalajara",
  "cruzazul",
  "tigres",
  "pumas",
  "monterrey",
  "barcelona",
  "realmadrid",
  "liverpool",
  "manchester",
  "chelsea",
  "arsenal",
  "princess",
  "princesa",
  "mariposa",
  "estrella",
  "corazon",
  "chocolate",
  "sunshine",
  "football",
  "futbol",
  "baseball",
  "basketball",
  "superman",
  "batman",
  "spiderman",
  "dragon",
  "dragonball",
  "dragonballz",
  "pokemon",
  "naruto",
  "onepiece",
  "minecraft",
  "fortnite",
  "roblox",
  "starwars",
  "monkey",
  "shadow",
  "master",
  "michael",
  "jessica",
  "charlie",
  "vendeia",
]);

const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
};

/** Minúsculas y sin acentos («Contraseña» → «contrasena»). */
function normalize(password: string) {
  return password.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "");
}

/** La palabra sin lo que no es letra en los extremos y sin «leet» («P@ssw0rd123!» → «password»). */
function baseWord(value: string) {
  const core = value.replace(/^\P{L}+|\P{L}+$/gu, "");
  return core.replace(/[013457@$]/g, (char) => LEET[char] ?? char);
}

function isRepeatedPattern(value: string) {
  for (let size = 1; size <= 4; size += 1) {
    const unit = value.slice(0, size);
    if (unit.repeat(Math.ceil(value.length / size)).startsWith(value)) return true;
  }
  return false;
}

/** «0123456789», «abcdefghij», «9876543210»: cada carácter a ±1 del anterior. */
function isSequence(value: string) {
  const step = value.charCodeAt(1) - value.charCodeAt(0);
  if (Math.abs(step) !== 1) return false;
  for (let index = 2; index < value.length; index += 1) {
    if (value.charCodeAt(index) - value.charCodeAt(index - 1) !== step) return false;
  }
  return true;
}

/** `true` si la contraseña es demasiado común o trivial para aceptarla al crear la cuenta. */
export function isCommonPassword(password: string): boolean {
  const value = normalize(password);
  if (COMMON.has(value) || isRepeatedPattern(value) || isSequence(value)) return true;
  const base = baseWord(value);
  // Sin ninguna letra («1234567890!», un teléfono, una fecha) o una base común con adornos.
  return base.length === 0 || COMMON_BASES.has(base);
}
