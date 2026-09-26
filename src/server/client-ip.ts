import "server-only";
import { isIP } from "node:net";
import { env } from "./env";

/**
 * IP del cliente con una política de proxies de confianza (SEC-07). La comparten el limitador
 * (`rate-limit.ts`), las Server Actions, los route handlers y Better Auth, para que todos vean la
 * misma IP.
 *
 * API:
 * - `clientIp(headers)`: IP canónica del cliente (IPv4 o IPv6 comprimida) o `null` si no hay una
 *   confiable. `null` significa "no sé quién es": los límites por IP se omiten en lugar de juntar a
 *   todos en una sola cubeta (bloquearía el acceso de toda la plataforma, SEC-07 caso B).
 * - `withClientIpHeader(headers)` / `withClientIpRequest(request)`: copia con `CLIENT_IP_HEADER`
 *   igual a `clientIp(...)` y sin el valor que haya mandado el cliente. Es lo que recibe Better Auth
 *   (`auth.api.*` y el handler HTTP de `/api/auth`).
 * - `authIpAddressOptions`: `advanced.ipAddress` de Better Auth para que lea solo esa cabecera.
 * - `normalizeIp(value)` / `ipNetwork(ip)`: validación y agrupación (IPv6 por /64) para llaves.
 *
 * Política (`TRUSTED_PROXY_HOPS`):
 * - 0 (por omisión): Next expuesto directo. Se ignora `X-Forwarded-For` y el resultado es `null`. El
 *   App Router no expone la dirección del socket, y Next solo la escribe en `X-Forwarded-For` cuando
 *   el cliente no mandó esa cabecera (`??=` en `next/dist/server/base-server.js`): el valor no se
 *   distingue de uno falsificado.
 * - N ≥ 1: detrás de exactamente N proxies que AGREGAN la dirección de quien los llamó (nginx con
 *   `$proxy_add_x_forwarded_for`, Cloudflare, balanceadores). La IP es la N-ésima entrada contando
 *   desde la derecha; lo que queda a su izquierda lo escribió el cliente y se descarta. Si la cadena
 *   tiene menos de N entradas, la petición no pasó por todos los proxies y el resultado es `null`.
 *   Solo es seguro si el origen no es alcanzable sin pasar por ellos.
 *
 * Nunca se usa un valor de cabecera sin validar: texto, "unknown", zonas (`%eth0`) o formatos raros
 * dan `null`.
 */

/** Cabecera interna con la IP ya resuelta; solo la escriben `withClientIpHeader`/`withClientIpRequest`. */
export const CLIENT_IP_HEADER = "x-vendeia-client-ip";

/**
 * `advanced.ipAddress` de Better Auth: lee únicamente la IP resuelta por esta política. Sin proxies de
 * confianza, Better Auth acepta una cabecera de un solo valor, que es justo lo que escribimos.
 */
export const authIpAddressOptions = { ipAddressHeaders: [CLIENT_IP_HEADER] };

const FORWARDED_FOR = "x-forwarded-for";
// Una IPv6 con IPv4 incrustada mide a lo más 45 caracteres; con corchetes y puerto, un poco más.
const MAX_ENTRY_LENGTH = 64;

let warnedMissingIp = false;

/** IP del cliente según `TRUSTED_PROXY_HOPS`, o `null` si no hay una confiable. */
export function clientIp(headers: Headers): string | null {
  const ip = resolveClientIp(headers, env.TRUSTED_PROXY_HOPS);
  if (ip === null && env.NODE_ENV === "production" && !warnedMissingIp) {
    warnedMissingIp = true;
    console.warn(
      `[client-ip] no hay IP confiable del cliente (TRUSTED_PROXY_HOPS=${env.TRUSTED_PROXY_HOPS}); ` +
        "los límites por IP no se aplican. Ajusta la variable a la cantidad de proxies.",
    );
  }
  return ip;
}

/** La política pura, con los saltos explícitos (para pruebas y scripts). */
export function resolveClientIp(headers: Headers, trustedProxyHops: number): string | null {
  if (!Number.isInteger(trustedProxyHops) || trustedProxyHops < 1) return null;
  const header = headers.get(FORWARDED_FOR);
  if (!header) return null;
  // `Headers.get` une varias líneas de la misma cabecera con ", ", en orden: equivale a una cadena.
  const chain = header.split(",");
  if (chain.length < trustedProxyHops) return null;
  return normalizeIp(chain[chain.length - trustedProxyHops] ?? "");
}

/** Copia de las cabeceras con `CLIENT_IP_HEADER` = `clientIp(headers)`; descarta el del cliente. */
export function withClientIpHeader(headers: Headers): Headers {
  const copy = new Headers(headers);
  copy.delete(CLIENT_IP_HEADER);
  const ip = clientIp(headers);
  if (ip) copy.set(CLIENT_IP_HEADER, ip);
  return copy;
}

/** La misma petición (cuerpo incluido) con las cabeceras de `withClientIpHeader`. */
export function withClientIpRequest(request: Request): Request {
  return new Request(request, { headers: withClientIpHeader(request.headers) });
}

/**
 * Valida una IP y la deja en forma canónica: IPv4 tal cual, IPv6 comprimida en minúsculas y las IPv4
 * mapeadas (`::ffff:1.2.3.4`) como IPv4. Acepta corchetes y puerto (`[::1]:443`, `1.2.3.4:80`), que
 * algunos proxies incluyen. Cualquier otra cosa da `null`.
 */
export function normalizeIp(value: string): string | null {
  let candidate = value.trim();
  if (candidate.length === 0 || candidate.length > MAX_ENTRY_LENGTH) return null;
  const bracketed = /^\[([^\]]+)\](?::\d{1,5})?$/.exec(candidate);
  const ipv4WithPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/.exec(candidate);
  candidate = bracketed?.[1] ?? ipv4WithPort?.[1] ?? candidate;
  // Una zona (`fe80::1%eth0`) solo existe en enlaces locales: nunca es la IP pública de un cliente.
  if (candidate.includes("%")) return null;

  const family = isIP(candidate);
  if (family === 4) return candidate;
  if (family !== 6) return null;
  const canonical = canonicalIpv6(candidate);
  if (canonical === null) return null;
  const groups = ipv6Groups(canonical);
  const isIpv4Mapped = groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff;
  if (isIpv4Mapped) {
    const [high = 0, low = 0] = groups.slice(6);
    return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
  }
  return canonical;
}

/**
 * Red a la que se atribuyen los intentos: IPv4 tal cual; IPv6 por su prefijo /64, porque un cliente
 * suele tener un /64 completo y rotar dentro de él no debe dar cubetas nuevas (como Better Auth).
 */
export function ipNetwork(value: string): string | null {
  const ip = normalizeIp(value);
  if (ip === null || isIP(ip) === 4) return ip;
  const prefix = ipv6Groups(ip)
    .slice(0, 4)
    .map((group) => group.toString(16))
    .join(":");
  return `${prefix}::/64`;
}

/** Forma canónica (WHATWG URL: comprimida, minúsculas, hexadecimal puro) o `null`. */
function canonicalIpv6(ip: string): string | null {
  try {
    return new URL(`http://[${ip}]/`).hostname.slice(1, -1);
  } catch {
    return null;
  }
}

/** Los 8 grupos de 16 bits de una IPv6 canónica. */
function ipv6Groups(canonical: string): number[] {
  const [head = "", tail] = canonical.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const zeros = tail === undefined ? [] : Array<string>(8 - left.length - right.length).fill("0");
  return [...left, ...zeros, ...right].map((group) => Number.parseInt(group, 16));
}
