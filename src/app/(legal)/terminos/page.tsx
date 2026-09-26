import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { LEGAL_VERSIONS } from "@/modules/identity/constants";

export const metadata: Metadata = { title: "Términos y condiciones" };

// BORRADOR: requiere revisión legal antes del lanzamiento público.
export default function TermsPage() {
  return (
    <>
      <p className="rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground">
        Borrador para revisión legal · versión {LEGAL_VERSIONS.terms}
      </p>
      <h1 className="text-3xl font-extrabold">Términos y condiciones</h1>
      <section aria-labelledby="novedades" className="rounded-xl border border-border px-4 py-3">
        <h2 id="novedades" className="mt-0! text-base!">
          Qué cambió en esta versión
        </h2>
        <ul className="mt-2 flex flex-col gap-1">
          <li>
            La revisión de autenticidad puede usar, si la activamos, una señal de inteligencia
            artificial que nunca decide sola.
          </li>
          <li>
            El equipo puede ocultar publicaciones, no solo productos, y restaurar lo que haya
            ocultado por error; reporta de buena fe.
          </li>
          <li>«Comprobante revisado» también se quita si sube el riesgo del producto.</li>
        </ul>
      </section>
      <p>
        Al usar {siteConfig.name} (nombre provisional) aceptas estas reglas básicas de convivencia y
        comercio.
      </p>

      <h2>Contenido</h2>
      <ul>
        <li>Publica solo contenido propio o que tengas derecho a compartir.</li>
        <li>No se permite contenido engañoso, discriminatorio, violento o ilegal.</li>
        <li>El contenido generado con IA se identifica como tal.</li>
      </ul>

      <h2>Compra y venta</h2>
      <ul>
        <li>
          Quien vende es responsable de la veracidad de su producto, precio, inventario y envío.
        </li>
        <li>
          Está prohibido vender artículos ilegales, falsificados o que infrinjan derechos de
          terceros.
        </li>
        <li>
          Las estimaciones de la IA (precios sugeridos, presupuestos, resultados) son orientativas y
          no garantizan ventas.
        </li>
      </ul>

      <h2>Artículos prohibidos, falsificaciones y autenticidad</h2>
      <ul>
        <li>
          Está prohibido vender falsificaciones: réplicas, imitaciones o artículos que usen una
          marca sin autorización de su titular, aunque se anuncien como «réplica», «AAA», «1:1» o
          «tipo original». La Ley Federal de Protección a la Propiedad Industrial protege las marcas
          registradas en México.
        </li>
        <li>
          Si declaras que un producto es original, debes poder demostrarlo (ticket, factura o
          empaque con número de serie). Si no es de la marca, publícalo como «genérico o compatible»
          y sin usar la marca como si fuera suya.
        </li>
        <li>
          Revisamos el riesgo de imitación con reglas automáticas y reportes de la comunidad y, si
          la activamos, con una señal de inteligencia artificial que solo lee el texto público del
          producto y nunca decide sola. Si declaraste que un producto es original, podemos pedirte
          un comprobante; mientras no lo revisemos, se muestra con la leyenda «Autenticidad sin
          verificar». Esta revisión mide riesgo: no acusa a nadie ni certifica nada.
        </li>
        <li>
          «Comprobante revisado por {siteConfig.name}» solo indica que nuestro equipo revisó un
          comprobante de compra que envió quien vende, para el artículo publicado en ese momento (si
          cambia el artículo o sube su riesgo, la leyenda se quita). No es una certificación ni una
          garantía de autenticidad.
        </li>
        <li>
          Podemos ocultar una publicación o un producto que incumpla estas reglas, cambiar un
          producto a «genérico» y restaurar lo que hayamos ocultado por error. Estas acciones las
          toma una persona del equipo, nunca la inteligencia artificial, y quedan registradas
          (quién, cuándo y qué cambió). También podemos suspender la venta de una cuenta que
          incumpla estas reglas; esa decisión también la toma una persona del equipo.
        </li>
        <li>
          Las personas titulares de una marca o de otros derechos pueden pedir que retiremos un
          producto que los infrinja con el botón «Reportar» del producto; el medio de contacto para
          solicitudes formales se publicará antes del lanzamiento. Quien reporta es anónimo para
          quien vende.
        </li>
        <li>
          Reporta de buena fe: cada persona puede reportar una vez cada publicación o producto, y el
          equipo descarta los reportes que no proceden.
        </li>
      </ul>

      <h2>Pagos</h2>
      <p>
        Durante la etapa de prueba los pagos son simulados: no se realizan cargos reales ni se
        entrega mercancía.
      </p>

      <h2>Cuenta</h2>
      <p>
        Cuida tu contraseña. Podemos suspender cuentas que incumplan estos términos o pongan en
        riesgo a otras personas.
      </p>

      <h2>Cambios</h2>
      <p>
        Si estos términos cambian, te lo avisaremos dentro de la plataforma (un mensaje en la parte
        de arriba con la liga a los cambios) y registraremos la versión que aceptes, con su fecha.
      </p>
    </>
  );
}
