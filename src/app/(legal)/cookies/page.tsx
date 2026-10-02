import type { Metadata } from "next";
import Link from "next/link";
import { NAV_COOKIE } from "@/components/layout/nav-cookie";
import { siteConfig } from "@/config/site";
import { WELCOME_COOKIE } from "@/modules/feed/welcome";
import { AUTH_COOKIE_PREFIX } from "@/modules/identity/constants";

export const metadata: Metadata = { title: "Cookies" };

// BORRADOR: requiere revisión legal antes del lanzamiento público. Es el inventario REAL del código
// (docs/legal/00-marco-legal-2026.md §2.6): si se agrega una cookie, un almacenamiento o un proveedor
// externo, se actualiza aquí antes de publicarlo.
export const COOKIES_NOTICE_UPDATED = "2026-10-01";

const COOKIES = [
  {
    name: `${AUTH_COOKIE_PREFIX}… (sesión)`,
    purpose: "Mantener tu sesión abierta y proteger tu cuenta.",
    duration: "Hasta 30 días sin usar la cuenta; se borra al cerrar sesión.",
    kind: "Necesaria",
  },
  {
    name: NAV_COOKIE,
    purpose: "Recordar si plegaste la columna izquierda en escritorio.",
    duration: "1 año.",
    kind: "Preferencia",
  },
  {
    name: WELCOME_COOKIE,
    purpose: "Mostrar una sola vez el mensaje de bienvenida al terminar tu perfil.",
    duration: "10 minutos.",
    kind: "Preferencia",
  },
] as const;

const SECTION_LINK = "font-semibold text-primary-text underline underline-offset-4";

export default function CookiesPage() {
  return (
    <>
      <p className="rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground">
        Borrador para revisión legal · actualizado el {COOKIES_NOTICE_UPDATED}
      </p>
      <h1 className="text-3xl font-extrabold">Cookies</h1>
      <p>
        Una cookie es un dato pequeño que el navegador guarda para que un sitio te reconozca entre
        una página y otra. {siteConfig.name} usa solo las suyas, para que la plataforma funcione y
        recuerde tus preferencias. Aquí están todas, con nombre y duración.
      </p>

      <h2 id="cuales">Cuáles usamos</h2>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left">
            <th scope="col" className="border-b py-2 pr-3 font-semibold">
              Cookie
            </th>
            <th scope="col" className="border-b py-2 pr-3 font-semibold">
              Para qué
            </th>
            <th scope="col" className="border-b py-2 pr-3 font-semibold">
              Dura
            </th>
            <th scope="col" className="border-b py-2 font-semibold">
              Tipo
            </th>
          </tr>
        </thead>
        <tbody>
          {COOKIES.map((cookie) => (
            <tr key={cookie.name} className="align-top">
              <td className="border-b py-2 pr-3 font-mono text-xs">{cookie.name}</td>
              <td className="border-b py-2 pr-3">{cookie.purpose}</td>
              <td className="border-b py-2 pr-3">{cookie.duration}</td>
              <td className="border-b py-2">{cookie.kind}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 id="que-no">Lo que no hacemos</h2>
      <ul>
        <li>No hay cookies de terceros, ni de publicidad, ni píxeles de seguimiento.</li>
        <li>
          No te seguimos en otros sitios ni compramos datos de nadie. Lo único que medimos ocurre
          dentro de {siteConfig.name}: qué publicaciones ves en pantalla, como explica el{" "}
          <Link href="/privacidad#publicaciones-en-pantalla" className={SECTION_LINK}>
            aviso de privacidad
          </Link>
          .
        </li>
        <li>
          Por eso no te pedimos «aceptar cookies» al entrar: no hay nada opcional que aceptar. Si
          algún día agregamos una herramienta externa que las use, te lo pediremos antes.
        </li>
      </ul>

      <h2 id="almacenamiento">Lo que guarda tu navegador sin ser cookie</h2>
      <ul>
        <li>El tema (claro u oscuro) se guarda en tu navegador, en este dispositivo.</li>
        <li>
          Si ocultas un aviso o las sugerencias de personas, se recuerda solo en esa pestaña y se
          borra al cerrarla.
        </li>
      </ul>

      <h2 id="borrar">Cómo borrarlas</h2>
      <p>
        Desde la configuración de tu navegador puedes ver y borrar las cookies de {siteConfig.name}{" "}
        en cualquier momento. Al borrar la de sesión se cierra tu sesión; las de preferencia solo
        vuelven la columna y el mensaje de bienvenida a su estado inicial. Cerrar sesión desde la
        plataforma borra la cookie de sesión por ti.
      </p>

      <h2 id="mas">Más sobre tus datos</h2>
      <p>
        Qué datos pedimos y por qué, en el{" "}
        <Link href="/privacidad" className={SECTION_LINK}>
          aviso de privacidad
        </Link>
        ; cómo los cuidamos, en{" "}
        <Link href="/seguridad" className={SECTION_LINK}>
          seguridad
        </Link>
        .
      </p>
    </>
  );
}
