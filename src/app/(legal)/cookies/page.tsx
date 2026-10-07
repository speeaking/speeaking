import type { Metadata } from "next";
import Link from "next/link";
import { NAV_COOKIE } from "@/components/layout/nav-cookie";
import { siteConfig } from "@/config/site";
import { WELCOME_COOKIE } from "@/modules/feed/welcome";
import { AUTH_COOKIE_PREFIX } from "@/modules/identity/constants";
import { AD_CONSENT_COOKIE } from "@/modules/marketing/ad-pixel";
import { AdConsentControl } from "@/modules/marketing/components/ad-consent-control";

export const metadata: Metadata = { title: "Cookies" };

// BORRADOR: requiere revisión legal antes del lanzamiento público. Es el inventario REAL del código
// (docs/legal/00-marco-legal-2026.md §2.6): si se agrega una cookie, un almacenamiento o un proveedor
// externo, se actualiza aquí antes de publicarlo.
// 2026-10-08: Cloudflare Turnstile, la verificación de seguridad del registro, de la recuperación de
// contraseña y del formulario de avisos de derechos (ADR-076).
export const COOKIES_NOTICE_UPDATED = "2026-10-08";

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
  {
    name: AD_CONSENT_COOKIE,
    purpose: "Recordar si permitiste o no la medición de anuncios.",
    duration: "1 año.",
    kind: "Preferencia",
  },
  {
    name: "_ttp, ttcsid… (TikTok)",
    purpose:
      "Las pone el pixel de TikTok para saber si llegaste desde uno de nuestros anuncios. Solo si lo permites.",
    duration: "Las fija TikTok (la de _ttp, hasta 13 meses).",
    kind: "Medición de anuncios (opcional)",
  },
  {
    // No es una cookie nuestra: la verificación de Cloudflare (`identity/turnstile.ts`).
    name: "Cloudflare Turnstile",
    purpose:
      "Comprobar que quien se registra, pide recuperar su contraseña o manda un aviso de derechos es una persona y no un programa automático.",
    duration: "Lo que dura la verificación; el pase vence a los 5 minutos.",
    kind: "Necesaria (seguridad)",
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
        una página y otra. {siteConfig.name} usa las suyas para que la plataforma funcione y
        recuerde tus preferencias, y las del pixel de TikTok solo si lo permites. Aquí están todas,
        con nombre y duración, junto con la verificación de seguridad de algunos formularios.
      </p>

      <h2 id="cuales">Cuáles usamos</h2>
      {/* En el celular la tabla se desliza sola: la página no se sale de la pantalla. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] border-collapse text-sm">
          <thead>
            <tr className="text-left">
              <th scope="col" className="border-b py-2 pr-3 font-semibold">
                Cookie o tecnología
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
      </div>

      {/* `identity/turnstile.ts`: un token de un solo uso (5 minutos) que el servidor valida con
          Cloudflare junto con la IP; no se registran tokens, IP ni correos. Lo cargan /registro,
          /recuperar-contrasena y /derechos-de-autor (`rights/actions.ts`). */}
      <h2 id="turnstile">Verificación de seguridad (Cloudflare Turnstile)</h2>
      <p>
        Para frenar cuentas falsas y abusos, en el registro, al pedir recuperar tu contraseña y en
        el formulario de avisos de derechos usamos Turnstile, de Cloudflare, Inc. (Estados Unidos).
        Se carga desde Cloudflare solo en esas páginas, revisa señales técnicas de tu navegador y de
        tu conexión (como tu dirección IP y el tipo de navegador) y nos da un pase que vence a los 5
        minutos y sirve una sola vez. Nuestro servidor comprueba el pase con Cloudflare, junto con
        tu IP. No guardamos el pase ni tu IP de esta verificación. Es necesaria: sin ella no se
        puede crear una cuenta con correo, pedir el correo de recuperación ni mandar el formulario
        de avisos. Cloudflare trata esos datos para la verificación según sus propias condiciones
        (ver{" "}
        <Link href="/privacidad#encargados" className={SECTION_LINK}>
          Encargados y transferencias
        </Link>
        ).
      </p>

      <h2 id="anuncios">Medición de anuncios (TikTok)</h2>
      <p>
        Anunciamos {siteConfig.name} en TikTok. Para saber si un anuncio trajo a alguien usamos el
        pixel de TikTok. Solo se carga si aceptas, y solo en las páginas públicas (la portada sin
        sesión, Comprar, los productos y las páginas informativas), el registro y la bienvenida:
        nunca en tus mensajes, pedidos, perfiles ni en tu feed.
      </p>
      <p>
        Si lo permites, TikTok recibe qué página pública visitas y, cuando terminas de crear tu
        cuenta, que te registraste, junto con datos técnicos de tu navegador (dirección IP, tipo de
        navegador y sus cookies). No le mandamos tu nombre, correo ni teléfono. Más detalle en el{" "}
        <Link href="/privacidad#medicion-de-anuncios" className={SECTION_LINK}>
          aviso de privacidad
        </Link>
        .
      </p>
      <AdConsentControl />
      <p>
        Si eliges «No permitir», dejamos de cargar el pixel y borramos sus cookies de este
        navegador.
      </p>

      <h2 id="que-no">Lo que no hacemos</h2>
      <ul>
        <li>
          No te seguimos en otros sitios ni compramos datos de nadie. Fuera del pixel de TikTok
          (solo si lo permites), lo que medimos ocurre dentro de {siteConfig.name}: qué
          publicaciones ves en pantalla, como explica el{" "}
          <Link href="/privacidad#publicaciones-en-pantalla" className={SECTION_LINK}>
            aviso de privacidad
          </Link>
          .
        </li>
        <li>
          No cargamos nada opcional sin preguntarte antes. Si agregamos otra herramienta externa que
          use cookies, también te lo pediremos antes.
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
