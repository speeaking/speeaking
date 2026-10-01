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
            Puedes recomendar productos de tiendas que aceptan colaboraciones; si recibiste algo a
            cambio, tu publicación lleva la etiqueta «Colaboración» (ver{" "}
            <a
              className="font-semibold text-primary-text underline underline-offset-4"
              href="#colaboraciones"
            >
              «Colaboraciones con tiendas»
            </a>
            ).
          </li>
          <li>
            Cada tienda decide si acepta colaboraciones y puede quitar la etiqueta de su producto
            cuando quiera.
          </li>
          <li>
            Las cuentas «Equipo {siteConfig.name}» publican textos redactados con ayuda de IA que
            una persona del equipo revisa antes de publicar.
          </li>
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
        <li>
          Las cuentas «Equipo {siteConfig.name}» de cada comunidad son del equipo y se identifican
          como «Editorial». Publican textos redactados con ayuda de inteligencia artificial que una
          persona del equipo revisa y aprueba antes de publicar; no son personas reales ni simulan
          serlo.
        </li>
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

      <h2 id="colaboraciones">Colaboraciones con tiendas</h2>
      <p>
        Puedes recomendar en tus fotos y videos productos de otras tiendas para que quien te ve se
        los pruebe y los compre. Estas son las reglas:
      </p>
      <ul>
        <li>
          <strong>La tienda decide.</strong> Solo se pueden etiquetar productos de las tiendas que
          activaron «Aceptar colaboraciones» en su Studio (viene apagado) y solo mientras estén a la
          venta. Al activarlo, la tienda nos autoriza a mostrar el nombre, la foto, el precio y la
          liga de sus productos junto al contenido de quien los etiqueta. Si una tienda lo apaga,
          nadie puede etiquetar sus productos en publicaciones nuevas; las que ya los tenían siguen
          igual hasta que la tienda quite cada etiqueta.
        </li>
        <li>
          <strong>Quién vende.</strong> Tu publicación dice «Vendido por» la tienda: la compra es
          entre quien compra y esa tienda, con el precio y las condiciones de su ficha. Tu opinión
          es tuya; los datos del producto (precio, existencias, envío, garantía) los pone la tienda.
          No digas del producto lo que no es verdad.
        </li>
        <li>
          <strong>Si recibiste algo, dilo.</strong> Si la tienda o la marca te dio dinero, el
          producto, una comisión, un descuento o cualquier otro beneficio por publicar, márcalo al
          publicar. Tu publicación llevará la etiqueta «Colaboración», visible durante todo el
          contenido (en un video, también encima del video). Promocionar algo que te dieron sin
          decirlo es publicidad escondida y va contra estas reglas.
        </li>
        <li>
          <strong>Lo que puede hacer la tienda.</strong> Recibe un aviso cuando alguien etiqueta su
          producto. Puede marcar la publicación como «Colaboración» si tienen un acuerdo (esa
          etiqueta ya no se quita mientras el producto siga etiquetado) o quitar la etiqueta de su
          producto cuando quiera: la publicación sigue, ya sin el producto ni la etiqueta, y quien
          la publicó recibe un aviso. Si hubo un acuerdo, quien publicó debe seguir diciéndolo en su
          contenido.
        </li>
        <li>
          <strong>Resultados sin datos personales.</strong> Quien publica y la tienda ven, por
          publicación, cuántas visitas al producto, pruebas con «Pruébatelo», productos en el
          carrito y compras pagadas salieron de ella. Son números agregados: nunca ven quién visitó,
          se probó o compró.
        </li>
        <li>
          <strong>{siteConfig.name} no es parte de sus acuerdos.</strong> No negociamos los acuerdos
          entre quien publica y las tiendas, no cobramos ni pagamos comisiones por ellos y no
          intervenimos en sus pagos. Cada quien responde por lo que acuerda, por sus impuestos y por
          la publicidad que publica, que debe ser verdadera.
        </li>
        <li>
          Podemos quitar una etiqueta u ocultar una publicación que incumpla estas reglas, como
          cualquier otra.
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

      <h2>Estilista, «Pruébatelo» y saldo</h2>
      <p>
        El estilista arma looks con productos reales publicados por vendedores; cada pieza se compra
        a quien la vende, con el precio y las condiciones de su ficha. Los looks son sugerencias, no
        una oferta de la plataforma, y pueden dejar de estar disponibles.
      </p>
      <p>
        «Pruébatelo» genera con inteligencia artificial una simulación de cómo podría verse un
        producto en ti. Es una imagen orientativa: no garantiza talla, color, caída ni el aspecto
        real del producto, y no da derecho a devolución por diferencias con la simulación (aplican
        las condiciones de devolución de cada vendedor). Al subir tu foto declaras que es tuya, que
        eres mayor de edad y aceptas el uso descrito en el aviso de privacidad. No subas fotos de
        otras personas.
      </p>
      <p>
        Tienes un número de simulaciones gratis al mes; las demás se pagan con saldo al precio
        vigente publicado en la página de precios, que puede bajar conforme crece el uso de la
        plataforma y nunca baja de nuestro costo. El saldo se recarga en los montos publicados, no
        es dinero, no genera intereses, no se transfiere entre cuentas ni se retira en efectivo, y
        sirve solo para usos dentro de la plataforma. Puedes pedir la devolución del saldo no usado
        dentro de los 5 días hábiles siguientes a una recarga. Si una simulación falla, no se cobra
        (o se devuelve el cargo). Los vendedores pueden patrocinar simulaciones sobre sus productos
        con un tope diario que ellos fijan; el cargo sale de su saldo por cada simulación generada.
        Durante la etapa de prueba las recargas son simuladas y no se cobra nada.
      </p>

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
