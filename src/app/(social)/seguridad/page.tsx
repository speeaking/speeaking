import { KeyRound, Lock, ShieldCheck, Trash2 } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { OPERATOR } from "@/app/(legal)/operator";
import { PendingData } from "@/app/(legal)/pending-data";
import { PageHeader } from "@/components/layout/page-header";
import { siteConfig } from "@/config/site";

const CARD_LINK = "font-semibold text-primary-text underline-offset-2 hover:underline";

export const metadata: Metadata = {
  title: "Seguridad y privacidad",
  description: `Qué datos pide ${siteConfig.name}, cómo los guarda y qué puedes borrar. Explicado sin letra chica.`,
};

/**
 * /seguridad (ADR-048): la respuesta a «¿por qué darle mi correo y contraseña a un proyecto sin
 * empresa?». Solo afirma lo que el código hace (nada de promesas): cada punto tiene su archivo.
 */
export default function SecurityPage() {
  const points = [
    {
      icon: KeyRound,
      title: "Tu contraseña no la conocemos ni nosotros",
      text: "Se guarda transformada con scrypt, una función pensada para que ni quien tenga la base pueda recuperarla. Nunca viaja ni se guarda en texto plano, y el inicio de sesión tiene límite de intentos.",
    },
    {
      icon: Lock,
      title: "Pedimos lo mínimo",
      text: "Para tener cuenta basta un nombre, un correo y una contraseña. No pedimos teléfono, dirección ni identificación. La dirección de envío solo existe si compras algo, y se borra cuando el pedido se cancela.",
    },
    {
      icon: ShieldCheck,
      title: "Ninguna tarjeta pasa por aquí",
      text: `Los pagos van con un proveedor de pagos; ${siteConfig.name} nunca ve ni guarda números de tarjeta. En esta etapa no se cobra nada: los pagos de los pedidos son simulados y las recargas de saldo llegan con el primer medio de pago real.`,
    },
    {
      icon: Trash2,
      title: "Tus fotos y tus mensajes son tuyos",
      text: "La foto de «Ver cómo me veo» es privada (ni el equipo la ve), se borra sola a los 30 días y antes si tú quieres. Los mensajes solo los ven las dos personas de la conversación. Y puedes borrar tu cuenta completa desde Ajustes cuando quieras.",
    },
  ];
  const technical = [
    "Todo viaja cifrado (https) y las cookies de sesión no las puede leer ninguna página ajena.",
    "Cada página lleva una política de seguridad de contenido con firma por petición: un script que no pusimos nosotros no corre.",
    "Límites de intentos en inicio de sesión, registro, subidas, publicaciones, mensajes e IA.",
    "Las fotos se vuelven a codificar al subirlas y pierden su ubicación y demás datos ocultos.",
    "El costo de cada producto es privado del vendedor: nunca llega al navegador de quien compra.",
    "Auditoría de seguridad propia con 40 hallazgos revisados y corregidos antes del piloto, documentada en el repositorio.",
  ];
  return (
    <>
      <PageHeader
        title="Seguridad y privacidad"
        description={`${siteConfig.name} es un proyecto independiente hecho en México. No hay una empresa grande detrás, así que te decimos exactamente qué hacemos con tus datos, y lo que decimos aquí es lo que hace el código.`}
      />
      <div className="flex flex-col gap-4 px-4 md:px-0">
        <section className="grid gap-3 sm:grid-cols-2">
          {points.map(({ icon: Icon, title, text }) => (
            <article key={title} className="flex flex-col gap-2 rounded-3xl border bg-card p-5">
              <h2 className="flex items-center gap-2 font-heading text-base font-bold">
                <Icon aria-hidden="true" className="size-5 shrink-0 text-primary-text" />
                {title}
              </h2>
              <p className="text-sm text-ink-2">{text}</p>
            </article>
          ))}
        </section>

        <section className="flex flex-col gap-2 rounded-3xl border bg-card p-5">
          <h2 className="font-heading text-lg font-bold">Lo técnico, en corto</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
            {technical.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        {/* ADR-076: a dónde ir según lo que pase. Los motivos son los del formulario de reporte
            (`trust/labels.ts`); /derechos-de-autor tiene los formularios formales. */}
        <section className="flex flex-col gap-2 rounded-3xl border bg-card p-5">
          <h2 className="font-heading text-lg font-bold">Si algo te afecta</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-ink-2">
            <li>
              <strong>Algo rompe las reglas:</strong> usa «Reportar» en la publicación, el
              comentario, el producto o la conversación. Quien lo publicó no sabe quién lo reportó.
            </li>
            <li>
              <strong>
                Contenido íntimo de alguien sin su permiso, o algo que pone en riesgo a una niña, un
                niño o un adolescente:
              </strong>{" "}
              repórtalo con el motivo «Contenido íntimo sin consentimiento» o «Pone en riesgo a un
              menor»; esos reportes se atienden primero. Si alguien está en peligro inmediato, llama
              al 911.
            </li>
            <li>
              <strong>Usan tu obra, tu marca o tu imagen de artista sin permiso:</strong>{" "}
              <Link href={"/derechos-de-autor#aviso" as Route} className={CARD_LINK}>
                Mandar un aviso de derechos
              </Link>
              . Funciona sin cuenta, y ese aviso no es anónimo.
            </li>
            <li>
              <strong>Retiraron algo tuyo por un aviso:</strong>{" "}
              <Link href={"/derechos-de-autor#contra-aviso" as Route} className={CARD_LINK}>
                Responder con un contra-aviso
              </Link>
              . Las cuentas que infringen derechos una y otra vez se cierran (ver la{" "}
              <Link href={"/derechos-de-autor#reincidencia" as Route} className={CARD_LINK}>
                política de reincidentes
              </Link>
              ).
            </li>
            <li>
              <strong>Eres una autoridad:</strong> escríbenos a{" "}
              <PendingData>{OPERATOR.legalEmail}</PendingData>.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-2 rounded-3xl border bg-card p-5">
          <h2 className="font-heading text-lg font-bold">Quién responde</h2>
          {/* Solo lo publicado: el aviso ya explica cómo ejercer los derechos, pero el responsable,
              su domicilio y el correo siguen marcados como pendientes. Al llenarlos, esto dice
              dónde están. */}
          <p className="text-sm text-ink-2">
            Una persona, no un buzón automático. El aviso de privacidad explica qué datos tratamos,
            para qué, tus derechos de acceso, rectificación, cancelación y oposición, y cómo y en
            qué plazos ejercerlos. El nombre de la persona responsable de tus datos, su domicilio y
            el correo para ejercer esos derechos todavía no están publicados: se agregarán al aviso
            antes del lanzamiento. Mientras tanto, desde Ajustes puedes borrar tu historial de
            búsqueda, tus fotos de prueba o tu cuenta completa. Los términos tienen las reglas de la
            comunidad.
          </p>
          <p className="flex flex-wrap gap-3 text-sm font-semibold text-primary-text">
            <Link href={"/privacidad" as Route} className="underline-offset-2 hover:underline">
              Aviso de privacidad
            </Link>
            <Link href={"/terminos" as Route} className="underline-offset-2 hover:underline">
              Términos y reglas
            </Link>
            <Link href={"/apoya" as Route} className="underline-offset-2 hover:underline">
              Cómo se sostiene el proyecto
            </Link>
          </p>
        </section>
      </div>
    </>
  );
}
