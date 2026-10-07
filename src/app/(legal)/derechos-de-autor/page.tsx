import type { Metadata, Route } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { NONCE_HEADER } from "@/lib/csp";
import { LEGAL_VERSIONS } from "@/modules/identity/constants";
import { turnstileSiteKey } from "@/modules/identity/turnstile";
import { RESTORE_AFTER_BUSINESS_DAYS } from "@/modules/rights/business-days";
import { NoticeForm } from "@/modules/rights/components/notice-form";
import { formatLegalDate } from "@/modules/rights/messages";
import { STRIKE_THRESHOLD } from "@/modules/rights/strikes";
import { sameSiteUrl } from "@/modules/rights/urls";
import { OPERATOR } from "../operator";
import { PendingData } from "../pending-data";

export const metadata: Metadata = { title: "Derechos de autor y marcas" };

// BORRADOR: forma parte de los Términos y requiere revisión legal antes del lanzamiento público
// (LFDA art. 114 Octies; RLFDA arts. 37 Ter–37 Nonies, ADR-076). El canal formal (formulario) ya
// funciona: las condiciones del puerto seguro aplican hoy. Los datos del responsable y los buzones
// salen de `OPERATOR` (pendientes hasta que el fundador los dé; nunca se inventan).

// PENDIENTE (fundador): plazo de respuesta que el equipo puede cumplir.
const RESPONSE_TIME = "[Plazo — pendiente; propuesta: de 24 a 48 horas tras un aviso completo]";

const SECTION_LINK = "font-semibold text-primary-text underline underline-offset-4";

/** «2026-10-08» → «8 de octubre de 2026» (las versiones legales tienen forma de fecha). */
function effectiveDate(version: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(version)
    ? formatLegalDate(new Date(`${version}T12:00:00Z`))
    : null;
}

/**
 * Aviso y retirada (ADR-076): qué se puede usar, qué necesita un aviso, qué pasa después, el
 * formulario sin cuenta (#aviso), el contra-aviso (#contra-aviso) y la política de reincidencia
 * (#reincidencia). Los Términos, /seguridad y «Reportar» enlazan a estas anclas.
 */
export default async function CopyrightPage({ searchParams }: PageProps<"/derechos-de-autor">) {
  const nonce = (await headers()).get(NONCE_HEADER) ?? undefined;
  // Desde «Reportar» llega la dirección de lo reportado (`?url=`): solo de este sitio, para no
  // prellenar el formulario con enlaces ajenos.
  const { url } = await searchParams;
  const initialUrl = sameSiteUrl(typeof url === "string" ? url : undefined, [siteConfig.url]);
  const effective = effectiveDate(LEGAL_VERSIONS.terms);
  return (
    <>
      <p className="rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground">
        Borrador para revisión legal · forma parte de los{" "}
        <Link href="/terminos" className="underline underline-offset-2">
          Términos
        </Link>
        , versión {LEGAL_VERSIONS.terms}
        {effective ? `, vigente desde el ${effective}` : ""}
      </p>
      <h1 className="text-3xl font-extrabold">Derechos de autor y marcas</h1>
      <p>
        En {siteConfig.name} las personas suben sus fotos, videos, textos y productos. No revisamos
        todo antes de que se publique ni tenemos la obligación de vigilarlo, pero si algo de lo que
        se publica infringe tus derechos, aquí puedes avisarnos. El aviso es gratis y no necesitas
        cuenta.
      </p>
      <p>
        Para todo lo demás (estafas, falsificaciones, contenido ofensivo o que te pone en riesgo)
        usa «Reportar» en la publicación: ese reporte es anónimo. El contenido íntimo sin
        consentimiento y lo que pone en riesgo a menores se reporta ahí y se atiende primero; si
        alguien está en peligro inmediato, llama al 911. El aviso de esta página es un trámite
        formal y <strong>no es anónimo</strong>.
      </p>
      <nav aria-label="En esta página" className="rounded-xl border border-border px-4 py-3">
        <p className="text-sm font-semibold">En esta página</p>
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          <li>
            <a className={SECTION_LINK} href="#usos-permitidos">
              Antes de avisar: usos permitidos
            </a>
          </li>
          <li>
            <a className={SECTION_LINK} href="#requisitos">
              Qué necesita un aviso
            </a>
          </li>
          <li>
            <a className={SECTION_LINK} href="#que-pasa">
              Qué pasa después
            </a>
          </li>
          <li>
            <a className={SECTION_LINK} href="#aviso">
              Enviar un aviso
            </a>
          </li>
          <li>
            <a className={SECTION_LINK} href="#contra-aviso">
              Contra-aviso: si retiramos algo tuyo
            </a>
          </li>
          <li>
            <a className={SECTION_LINK} href="#reincidencia">
              Política de reincidencia
            </a>
          </li>
          <li>
            <a className={SECTION_LINK} href="#contacto">
              Contacto para avisos
            </a>
          </li>
        </ul>
      </nav>

      <h2 id="usos-permitidos">Antes de avisar: usos permitidos</h2>
      <p>
        En México no existe el «uso justo» (fair use) de otros países. La Ley Federal del Derecho de
        Autor (art. 148) permite usar sin autorización una obra ya divulgada solo en casos
        concretos, siempre citando la fuente y sin alterarla. Por ejemplo:
      </p>
      <ul>
        <li>Citar fragmentos breves dando el crédito.</li>
        <li>Reseñas, críticas o investigación que muestran partes pequeñas de la obra.</li>
        <li>
          Noticias, fotos y comentarios de actualidad publicados por los medios, salvo que lo
          prohíban.
        </li>
        <li>Fotografiar obras que se ven desde lugares públicos, como murales y edificios.</li>
      </ul>
      <p>
        Los memes y las parodias que usan obras ajenas no tienen una excepción clara en México: si
        quien es titular los reclama, se retiran.
      </p>

      <h2 id="requisitos">Qué necesita un aviso</h2>
      <p>Para enviarlo necesitas:</p>
      <ul>
        <li>Tu nombre completo o razón social y tu correo.</li>
        <li>Las direcciones del contenido en {siteConfig.name}, una por renglón.</li>
        <li>La obra, la marca o la interpretación, y el derecho que tienes sobre ella.</li>
        <li>Si eres titular o representante (en ese caso, el nombre de quien es titular).</li>
        <li>
          Tu declaración, bajo protesta de decir verdad, de que la información es cierta, y que
          sabes que un aviso falso puede recibir una multa de 1,000 a 20,000 UMA (art. 232
          Quinquies).
        </li>
      </ul>
      <p>
        También te pedimos, si los tienes, tu domicilio, un correo alterno, un teléfono y una
        descripción breve de los hechos. Los pide el reglamento de la ley y nos ayudan a revisarlo,
        pero tu aviso no se detiene si faltan.
      </p>
      <p>
        Para retirar el contenido no te pedimos certificados de registro, títulos ni otros
        documentos. Si los tienes, puedes mencionarlos en tu aviso.
      </p>
      <p>
        <strong>Marcas.</strong> Es un trámite aparte, según nuestros Términos: necesitamos el
        número de registro de la marca en el IMPI. No atendemos por aquí desacuerdos sobre precios,
        distribución o reventa de productos originales.
      </p>
      <p>
        <strong>Imagen o voz de artistas.</strong> La imagen y la voz de las personas artistas
        intérpretes también están protegidas (art. 87), también en lo que se genera con inteligencia
        artificial: por ejemplo, una clonación o suplantación que engañe al público. La parodia, la
        sátira y la imitación creativa no infringen este derecho. Se avisan con este mismo
        formulario.
      </p>

      <h2 id="que-pasa">Qué pasa después</h2>
      <ul>
        <li>
          Te damos un número de caso (por ejemplo, «DA-000123») en cuanto envías el aviso. Si lo que
          señalas lo subieron varias cuentas, abrimos un caso para cada una: cada quien responde por
          lo suyo.
        </li>
        <li>
          Una persona del equipo lo revisa. Si está completo, retiramos el contenido sin demora.
          Plazo de respuesta: <PendingData>{RESPONSE_TIME}</PendingData>.
        </li>
        <li>
          Avisamos a quien lo subió con el motivo y cómo mandar un contra-aviso. Esa persona recibe
          tu nombre, tu correo y la descripción de tu aviso.
        </li>
        <li>
          Tomamos medidas para que el mismo archivo no se vuelva a subir desde ninguna cuenta.
        </li>
        <li>Si recibimos un contra-aviso, te mandamos una copia (ver abajo).</li>
      </ul>

      <h2 id="aviso">Enviar un aviso</h2>
      <NoticeForm turnstileSiteKey={turnstileSiteKey()} nonce={nonce} initialUrl={initialUrl} />

      <h2 id="contra-aviso">Contra-aviso: si retiramos algo tuyo</h2>
      <p>
        Si retiramos algo que subiste por un aviso, te avisamos en la campana con el número de caso.
        Desde ese aviso ves quién lo mandó y qué reclama, y puedes mandar un contra-aviso con la
        cuenta que subió el contenido si:
      </p>
      <ul>
        <li>la obra es tuya;</li>
        <li>tienes licencia o permiso de quien es titular;</li>
        <li>es un uso permitido por la ley (ver «Antes de avisar»), o</li>
        <li>la obra es de dominio público.</li>
      </ul>
      <p>
        El contra-aviso pide tu nombre, tu correo, tu domicilio y tu fundamento, con las mismas
        declaraciones bajo protesta de decir verdad y sobre la multa. Por ley, mandamos una copia de
        tu contra-aviso, con tu nombre, tu contacto y tu domicilio, a quien presentó el aviso.
      </p>
      <p>
        Volvemos a mostrar el contenido a partir de {RESTORE_AFTER_BUSINESS_DAYS} días hábiles (y a
        más tardar 15) después de recibir tu contra-aviso, salvo que quien avisó nos compruebe,
        dentro de los 15 días hábiles siguientes a la copia, que inició un juicio, un procedimiento
        administrativo, una denuncia penal o un medio alterno de solución (como la avenencia, la
        mediación o el arbitraje ante el INDAUTOR). En ese caso, el contenido sigue retirado
        mientras se resuelve.
      </p>
      <p>
        Retirar o restaurar no significa que {siteConfig.name} decida quién tiene la razón: eso lo
        resuelven las autoridades.
      </p>

      <h2 id="reincidencia">Política de reincidencia</h2>
      <ul>
        <li>
          Cada aviso por el que retiramos algo tuyo cuenta como una falta, salvo que se revierta:
          porque prosperó tu contra-aviso o porque quien avisó lo retiró. Cuentan publicaciones,
          comentarios, fotos de perfil, videos y productos.
        </li>
        <li>Con {STRIKE_THRESHOLD} faltas en 12 meses cerramos la cuenta y su tienda.</li>
        <li>Las cuentas dedicadas a la piratería se cierran a la primera.</li>
        <li>
          Una persona del equipo revisa cada cierre. Abrir otra cuenta para evitar un cierre también
          está prohibido.
        </li>
      </ul>

      <h2 id="contacto">Contacto para avisos</h2>
      <p>
        El formulario de esta página siempre está disponible y es gratis. También puedes escribir a:
      </p>
      <ul>
        <li>
          Correo para avisos: <PendingData>{OPERATOR.rightsEmail}</PendingData>
        </li>
        <li>
          Correo alterno: <PendingData>{OPERATOR.rightsAltEmail}</PendingData>
        </li>
        <li>
          Responsable de {siteConfig.name}: <PendingData>{OPERATOR.legalName}</PendingData>
        </li>
        <li>
          Domicilio para recibir notificaciones: <PendingData>{OPERATOR.domicile}</PendingData>
        </li>
      </ul>
      <p>
        Qué hacemos con los datos de un aviso o de un contra-aviso: ver el{" "}
        <Link className={SECTION_LINK} href={"/privacidad" as Route}>
          aviso de privacidad
        </Link>
        .
      </p>
    </>
  );
}
