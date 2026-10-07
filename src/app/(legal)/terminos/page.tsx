import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { LEGAL_VERSIONS } from "@/modules/identity/constants";
import { OPERATOR } from "../operator";
import { PendingData } from "../pending-data";

export const metadata: Metadata = { title: "Términos y condiciones" };

const SECTION_LINK = "font-semibold text-primary-text underline underline-offset-4";

// BORRADOR: requiere revisión legal antes del lanzamiento público. Lo que promete debe hacerlo el
// código; la base legal y lo pendiente de cada sección están en ADR-076 y docs/legal/02.
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
            Quién opera {siteConfig.name}, cómo contactarnos y que solo pueden usarlo personas de 18
            años o más (ver{" "}
            <a className={SECTION_LINK} href="#quienes-somos">
              «Quiénes somos y cómo contactarnos»
            </a>
            ).
          </li>
          <li>
            Lo que no se puede subir ni vender, con la lista completa (ver{" "}
            <a className={SECTION_LINK} href="#reglas-de-la-comunidad">
              «Reglas de la comunidad»
            </a>{" "}
            y{" "}
            <a className={SECTION_LINK} href="#articulos-prohibidos">
              «Artículos prohibidos y restringidos»
            </a>
            ).
          </li>
          <li>
            Cómo avisarnos si algo infringe tus derechos de autor o tu marca, cómo responder con un
            contra-aviso y cuándo cerramos cuentas reincidentes (ver{" "}
            <a className={SECTION_LINK} href="#derechos-de-autor">
              «Derechos de autor y marcas»
            </a>
            ).
          </li>
          <li>
            El permiso que nos das sobre tu contenido y, si vendes, sobre las fotos y los textos de
            tus productos (ver{" "}
            <a className={SECTION_LINK} href="#tu-contenido">
              «Tu contenido y el permiso que nos das»
            </a>{" "}
            y{" "}
            <a className={SECTION_LINK} href="#si-vendes">
              «Si vendes: permiso sobre tus productos y fotos»
            </a>
            ).
          </li>
          <li>
            Cómo moderamos y cómo pedir revisión, con cuánto tiempo te avisamos de un cambio, la ley
            que aplica y la PROFECO (ver{" "}
            <a className={SECTION_LINK} href="#moderacion">
              «Moderación, sanciones y cómo pedir revisión»
            </a>
            ).
          </li>
          <li>
            «Pruébatelo» no cambia tus derechos de cancelación, garantía y devolución frente a quien
            vende, y las reglas para usar la IA (ver{" "}
            <a className={SECTION_LINK} href="#inteligencia-artificial">
              «Inteligencia artificial»
            </a>
            ).
          </li>
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
        Al usar {siteConfig.name} aceptas estas reglas de convivencia y comercio. Estos términos,
        las reglas de la comunidad y, si vendes, las reglas para vender forman un solo contrato
        entre tú y quien opera {siteConfig.name}. El aviso de privacidad es un documento aparte.
      </p>

      {/* Los datos del operador y los buzones son del fundador: `../operator.ts` (ADR-076). */}
      <h2 id="quienes-somos">Quiénes somos y cómo contactarnos</h2>
      <p>
        {siteConfig.name} es el nombre comercial de la plataforma. La opera{" "}
        <PendingData>{OPERATOR.legalName}</PendingData>, con RFC{" "}
        <PendingData>{OPERATOR.rfc}</PendingData> y domicilio para oír y recibir notificaciones en{" "}
        <PendingData>{OPERATOR.domicile}</PendingData>.
      </p>
      <ul>
        <li>
          <strong>Soporte, quejas y aclaraciones:</strong>{" "}
          <PendingData>{OPERATOR.supportEmail}</PendingData> ·{" "}
          <PendingData>{OPERATOR.phone}</PendingData> · <PendingData>{OPERATOR.hours}</PendingData>.
        </li>
        <li>
          <strong>Privacidad y tus derechos sobre tus datos:</strong>{" "}
          <PendingData>{OPERATOR.privacyEmail}</PendingData> (ver el{" "}
          <a className={SECTION_LINK} href="/privacidad">
            aviso de privacidad
          </a>
          ).
        </li>
        <li>
          <strong>Avisos de derechos de autor, marcas e imagen de artistas:</strong> el{" "}
          <a className={SECTION_LINK} href="/derechos-de-autor#aviso">
            formulario de avisos
          </a>
          , que funciona sin cuenta y siempre está disponible, o los correos{" "}
          <PendingData>{OPERATOR.rightsEmail}</PendingData> y{" "}
          <PendingData>{OPERATOR.rightsAltEmail}</PendingData>.
        </li>
        <li>
          <strong>Autoridades:</strong> <PendingData>{OPERATOR.legalEmail}</PendingData>, o por
          escrito en el domicilio de arriba.
        </li>
      </ul>
      <p>Todos estos canales son gratuitos.</p>
      <p>
        <strong>Quejas y aclaraciones.</strong> Si tienes una queja sobre {siteConfig.name}, o sobre
        un pedido que no se resolvió con quien vende, escríbenos al correo de soporte. Te
        confirmamos que la recibimos en un máximo de 1 día hábil y te respondemos en un máximo de 10
        días hábiles. Puedes acudir a la PROFECO en cualquier momento, sin esperar nuestra respuesta
        (ver{" "}
        <a className={SECTION_LINK} href="#ley-aplicable">
          «Ley aplicable, PROFECO y tribunales»
        </a>
        ).
      </p>

      <h2 id="edad-minima">Edad mínima: 18 años</h2>
      <ul>
        <li>
          Para crear una cuenta, comprar, vender o usar «Pruébatelo» debes tener 18 años cumplidos.
          Al crear tu cuenta lo declaras.
        </li>
        <li>
          Si sabemos que una cuenta es de una persona menor de edad, la cerramos y borramos sus
          datos, salvo lo que la ley nos obligue a conservar.
        </li>
        <li>
          Madres, padres o quien tenga la tutela pueden avisarnos con «Reportar» o escribirnos al
          correo de soporte.
        </li>
      </ul>

      <h2 id="tu-contenido">Tu contenido y el permiso que nos das</h2>
      <ul>
        <li>
          <strong>Lo que publicas es tuyo.</strong> Tus fotos, videos, textos, comentarios,
          productos y tu perfil siguen siendo tuyos: no nos cedes tus derechos.
        </li>
        <li>
          <strong>El permiso que nos das.</strong> Al publicar nos das un permiso no exclusivo y
          gratuito (a cambio de usar el servicio), válido en cualquier país, para guardar tu
          contenido, reproducirlo, adaptarlo en lo técnico (tamaño, formato, recorte para miniaturas
          y compresión), mostrarlo y ponerlo a disposición de otras personas dentro de{" "}
          {siteConfig.name}, con la audiencia que elijas: en el feed, tu perfil, las comunidades, la
          búsqueda y las miniaturas, y en lo que pidas a nuestras funciones de inteligencia
          artificial.
        </li>
        <li>
          <strong>Cuánto dura.</strong> Mientras tu contenido esté publicado, más el tiempo que
          tarda en salir de los respaldos de nuestra base de datos (hoy, 7 días) y lo que la ley o
          una autoridad nos obliguen a conservar.
        </li>
        <li>
          <strong>Fuera de {siteConfig.name}</strong> (por ejemplo, en anuncios en otras redes o en
          videos que explican la plataforma) solo usamos tu contenido si nos das permiso aparte.
        </li>
        <li>
          <strong>Tus derechos morales siguen siendo tuyos.</strong> Solo hacemos adaptaciones
          técnicas que no cambian el sentido de tu obra, y siempre mostramos quién la publicó.
        </li>
        <li>
          <strong>No vendemos tu contenido</strong> ni lo usamos para entrenar modelos de
          inteligencia artificial.
        </li>
        <li>
          <strong>Lo que nos garantizas.</strong> Que el contenido es tuyo o tienes permiso de
          usarlo; que las personas que se pueden reconocer en él están de acuerdo (y te dieron su
          consentimiento expreso si lo usas para vender o anunciar algo), y que no quitaste marcas
          de agua ni créditos de nadie. Si alguien nos reclama por algo que subiste incumpliendo
          estas reglas, tú respondes por ese reclamo.
        </li>
        <li>Guardamos la versión de estos términos que aceptaste, con su fecha.</li>
      </ul>

      <h2>Cuentas del equipo y contenido hecho con IA</h2>
      <ul>
        <li>
          Lo que generan nuestras funciones de inteligencia artificial se identifica como tal.
        </li>
        <li>
          Las cuentas «Equipo {siteConfig.name}» de cada comunidad son del equipo y se identifican
          como «Editorial». Publican textos redactados con ayuda de inteligencia artificial que una
          persona del equipo revisa y aprueba antes de publicar; no son personas reales ni simulan
          serlo.
        </li>
      </ul>

      {/* `#reglas`: la liga del compositor de publicaciones (`social/components/create-post-form.tsx`). */}
      <h2 id="reglas-de-la-comunidad">
        <span id="reglas" />
        Reglas de la comunidad: lo que no se puede subir
      </h2>
      <p>
        Aplican a todo lo que se sube o se escribe en {siteConfig.name}: perfiles, publicaciones,
        comentarios, mensajes, productos, fotos, videos y nombres de tienda. No se permite:
      </p>
      <ul>
        <li>
          <strong>Contenido íntimo sin consentimiento:</strong> fotos, videos o audios íntimos o
          sexuales de una persona sin su permiso, reales o simulados, editados o hechos con IA.
          Tampoco amenazar con compartirlos ni pedirle a cualquier herramienta de IA que cree
          imágenes desnudas o sexuales de una persona real.
        </li>
        <li>
          <strong>Contenido sexual con menores:</strong> cualquier contenido sexual o sexualizado de
          niñas, niños o adolescentes, real, simulado, dibujado o hecho con IA, y cualquier intento
          de contactar a una persona menor con fines sexuales. Lo retiramos, lo reportamos a las
          autoridades y cerramos la cuenta, sin posibilidad de pedir revisión.
        </li>
        <li>
          <strong>Exponer a menores:</strong> imágenes de niñas, niños o adolescentes que los
          humillen, los expongan o los identifiquen como víctimas, y fotos de hijas o hijos de otras
          personas sin permiso de su madre, padre o tutor.
        </li>
        <li>
          <strong>Usar la imagen o la voz de otra persona</strong> sin su consentimiento. Para
          vender o anunciar algo con ella hace falta su consentimiento expreso.
        </li>
        <li>
          <strong>Clones de artistas:</strong> imitaciones hechas con IA, «parecidos» o simulaciones
          de la voz de actrices, actores, cantantes y otras personas artistas sin su autorización.
        </li>
        <li>
          <strong>Difamar:</strong> afirmar como hechos cosas falsas que dañan a una persona. Opinar
          y criticar sí se vale.
        </li>
        <li>
          <strong>Odio y discriminación:</strong> atacar, deshumanizar o incitar a excluir o a
          agredir a personas por su origen étnico o nacional, género, edad, discapacidad, condición
          social, condiciones de salud, religión, opiniones, preferencias sexuales, estado civil o
          cualquier otro motivo que atente contra su dignidad. Informar sobre el odio o denunciarlo
          para combatirlo no cuenta.
        </li>
        <li>
          <strong>Servicios sexuales y reclutamiento engañoso:</strong> pornografía, anuncios de
          servicios sexuales, «acompañantes» o masajes eróticos, y ofertas de trabajo o de modelaje
          que esconden un reclutamiento.
        </li>
        <li>
          <strong>Promover vapeadores, tabaco o drogas,</strong> aunque no tengan precio, incluidas
          reseñas y «unboxings».
        </li>
        <li>
          <strong>Prometer curas:</strong> anunciar suplementos, remedios o cosméticos como cura o
          tratamiento de una enfermedad.
        </li>
        <li>
          <strong>IA que engaña:</strong> presentar una imagen hecha con IA como foto real de un
          producto que vendes. Las imágenes o videos realistas hechos o editados con IA deben decir
          que lo son.
        </li>
        <li>
          <strong>Piratería:</strong> películas, series, música, libros, cursos o PDF, programas,
          juegos o cuentas de streaming compartidas sin permiso de quien tiene los derechos.
        </li>
        <li>
          <strong>Música comercial sin licencia</strong> en tus videos. En los videos de tiendas,
          que son publicidad, solo música propia, con licencia o sin música.
        </li>
        <li>
          <strong>Quitar marcas de agua o créditos</strong> de fotos o videos de otras personas.
        </li>
        <li>
          <strong>Copiar fotos o textos</strong> de otras tiendas, marcas o plataformas.
        </li>
        <li>
          Tampoco amenazar o incitar a la violencia, acosar, publicar datos personales de otras
          personas, estafar o pedir pagos fuera del pedido, crear cuentas o interacciones falsas,
          hacerte pasar por otra persona, por una marca o por {siteConfig.name}, ni publicar nada
          ilegal.
        </li>
      </ul>
      <p>
        <strong>Lo que sí se vale:</strong> citar fragmentos breves de una obra dando el crédito,
        mostrar partes pequeñas de una obra para criticarla o reseñarla y fotografiar edificios y
        murales que están en la calle. Los memes y las parodias hechos con obras ajenas no tienen
        una excepción clara en la ley mexicana: si quien tiene los derechos los reclama, se retiran.
      </p>
      <p>
        <strong>Cómo lo cuidamos.</strong> No revisamos todo antes de que se publique. Al publicar,
        unas reglas automáticas revisan el texto para frenar artículos prohibidos, y podemos usar
        herramientas para encontrar contenido que atente contra la dignidad de las personas o que
        haga apología de la violencia o del delito, como lo permite la Ley Federal del Derecho de
        Autor (art. 114 Octies, fracción IV). Ninguna sanciona sola: lo decide una persona del
        equipo.
      </p>
      <p>
        Si ves algo que rompe estas reglas, usa «Reportar». Los reportes de contenido íntimo sin
        consentimiento y de riesgo para menores se atienden primero. Si alguien está en peligro
        inmediato, llama al 911.
      </p>

      {/* LFDA art. 114 Octies y RLFDA arts. 37 Ter–37 Nonies (ADR-076). El formulario, los plazos y
          el detalle de reincidencia viven en /derechos-de-autor; aquí, el resumen que obliga. */}
      <h2 id="derechos-de-autor">
        Derechos de autor y marcas: avisos, contra-avisos y reincidentes
      </h2>
      <p>
        {siteConfig.name} guarda y muestra el contenido que suben las personas usuarias, a petición
        de ellas. No lo revisamos antes de que se publique y no tenemos la obligación de vigilar
        todo lo que se sube. Lo que publican las cuentas «Equipo {siteConfig.name}» y lo que generan
        nuestras funciones de inteligencia artificial (como «Pruébatelo» y los looks del estilista)
        es responsabilidad de {siteConfig.name}.
      </p>
      <ul>
        <li>
          <strong>Cómo avisarnos.</strong> Si tienes derechos de autor sobre una obra (una foto, un
          video, una canción, un texto), una marca registrada, o eres una persona artista cuya
          imagen o voz se usa sin tu permiso, tú o quien te represente pueden mandarnos un aviso con
          el{" "}
          <a className={SECTION_LINK} href="/derechos-de-autor#aviso">
            formulario de avisos de derechos
          </a>
          , que funciona sin cuenta, o a <PendingData>{OPERATOR.rightsEmail}</PendingData> o{" "}
          <PendingData>{OPERATOR.rightsAltEmail}</PendingData>. Es gratis.
        </li>
        <li>
          <strong>Qué debe decir.</strong> Como mínimo, tu nombre y un medio de contacto, qué
          contenido infringe tus derechos, cuál es tu derecho o interés y la dirección (URL) del
          contenido en {siteConfig.name}. También te pedimos una breve descripción de los hechos, si
          eres titular o representante (y a quién representas), un correo alterno, tu domicilio, una
          declaración bajo protesta de decir verdad y que reconozcas la multa por avisos falsos. Los
          documentos que lo prueben son opcionales: nunca condicionamos el retiro a certificados de
          registro ni a pruebas de representación, y no detenemos un aviso que trae los datos
          mínimos porque falten los demás.
        </li>
        <li>
          <strong>Qué hacemos.</strong> Te mostramos un número de caso por cada cuenta que publicó
          el contenido que señalas. Una persona del equipo revisa el aviso y, si cumple, retira el
          contenido sin demora, toma medidas razonables para que el mismo archivo no se vuelva a
          subir desde ninguna cuenta y le avisa a quien lo publicó el motivo y cómo presentar un
          contra-aviso.
        </li>
        <li>
          <strong>Los avisos formales no son anónimos.</strong> Si retiramos el contenido, quien lo
          publicó recibe tu nombre, tu correo y la descripción de tu aviso. Si responde con un
          contra-aviso, te enviamos una copia, con su nombre, su contacto y su domicilio, porque la
          ley lo exige. Los reportes de la comunidad con «Reportar» sí son anónimos.
        </li>
        <li>
          <strong>Contra-aviso.</strong> Si retiramos algo tuyo por un aviso y crees que es un
          error, puedes responder desde el aviso que te llega en la campana, con la cuenta que subió
          el contenido (ver{" "}
          <a className={SECTION_LINK} href="/derechos-de-autor#contra-aviso">
            cómo funciona el contra-aviso
          </a>
          ). Pide tu nombre, tu correo, tu domicilio, por qué tu uso es válido (la obra es tuya,
          tienes licencia o permiso, la ley lo permite sin autorización, como una cita con crédito o
          una crítica, o la obra es de dominio público), tu declaración bajo protesta de decir
          verdad y que reconoces la multa por declaraciones falsas. Se lo enviamos de inmediato a
          quien mandó el aviso.
        </li>
        <li>
          <strong>Cuándo vuelve.</strong> Volvemos a mostrar el contenido entre 10 y 15 días hábiles
          después de recibir un contra-aviso completo, salvo que quien mandó el aviso nos demuestre,
          dentro de los 15 días hábiles siguientes a que le avisamos, que inició un juicio, un
          procedimiento administrativo, una denuncia penal o un mecanismo alterno, como la
          avenencia, la mediación o el arbitraje ante el INDAUTOR. Contamos los días hábiles con el
          calendario oficial federal.
        </li>
        <li>
          <strong>Retiros por nuestra cuenta.</strong> Si retiramos algo por estas reglas sin que
          haya un aviso, también tomamos medidas razonables para que lo sepas y puedas pedir
          revisión (ver «Moderación, sanciones y cómo pedir revisión»).
        </li>
        {/* `rights/strikes.ts`: una falta por aviso; el código cuenta por cuenta y el cierre lo decide
            una persona, que también puede sumar otras cuentas de la misma persona. */}
        <li>
          <strong>Reincidentes.</strong> Cada aviso de derechos por el que retiramos algo tuyo y que
          no se revierte cuenta como una falta, aunque señale varias cosas; se revierte si prospera
          el contra-aviso o si quien avisó retira su aviso. Con 3 faltas en 12 meses cerramos la
          cuenta y su tienda; las cuentas dedicadas a la piratería se cierran a la primera. Cuentan
          las faltas por publicaciones, comentarios, fotos de perfil, videos y productos, y podemos
          sumar las de otras cuentas de la misma persona. Quien tuvo una cuenta cerrada por esto no
          puede abrir otra. Lo decide una persona del equipo. El detalle está en la{" "}
          <a className={SECTION_LINK} href="/derechos-de-autor#reincidencia">
            política de reincidentes
          </a>
          .
        </li>
        <li>
          <strong>Marcas.</strong> Los avisos sobre marcas usan el mismo canal, pero son un
          procedimiento nuestro: la Ley Federal del Derecho de Autor no los cubre. Pedimos el número
          de registro de la marca en el IMPI y no aceptamos avisos sobre control de precios ni sobre
          contratos de distribución. Quien vende puede responder con su comprobante de compra o con
          la autorización de la marca, y una persona del equipo decide.
        </li>
        <li>
          <strong>Imagen y voz de artistas.</strong> Las personas artistas, o quien las represente,
          pueden reclamar por el mismo canal el uso de su imagen o de su voz sin permiso, incluidos
          los resultados hechos con IA.
        </li>
        <li>
          <strong>Declarar en falso tiene consecuencias.</strong> La Ley Federal del Derecho de
          Autor multa con 1,000 a 20,000 UMA a quien da información falsa en un aviso o en un
          contra-aviso, además de la responsabilidad por los daños que cause.
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
        <li>
          {siteConfig.name} no es quien vende: pone en contacto a quien compra con quien vende, y la
          compra es entre ellos. Respondemos por las fallas de nuestro propio servicio que nos sean
          imputables, conforme a la ley. Nada de estos términos limita los derechos que te da la Ley
          Federal de Protección al Consumidor, que no se pueden renunciar.
        </li>
      </ul>

      <h2 id="si-vendes">Si vendes: permiso sobre tus productos y fotos</h2>
      <ul>
        <li>
          <strong>El permiso que nos das.</strong> Al publicar un producto nos das un permiso no
          exclusivo y gratuito sobre sus fotos, videos, textos y marcas para mostrarlos en tu
          tienda, en la búsqueda y en Comprar, en los looks del estilista, en los lugares
          «Patrocinado» y en las publicaciones que etiqueten el producto (si aceptas
          colaboraciones), y para generar las simulaciones de «Pruébatelo», que combinan la foto del
          producto con la foto de quien se lo prueba.
        </li>
        <li>
          <strong>Cuánto dura.</strong> Mientras el producto esté publicado, más el tiempo que tarda
          en salir de nuestros respaldos. No nos cedes ningún derecho.
        </li>
        <li>
          <strong>Lo que garantizas.</strong> Que eres titular o tienes permiso de usar cada foto,
          video, música y texto de tus productos, incluidas las fotos del catálogo de una marca (si
          distribuyes productos de una marca, necesitas el permiso de la marca), y que tienes la
          autorización de las personas que aparecen en ellas.
        </li>
        <li>
          <strong>Si alguien reclama.</strong> Si una persona reclama a {siteConfig.name} por tus
          productos, fotos o textos, tú respondes por ese reclamo y nos cubres los daños y gastos
          que nos cause, salvo los que se deban a un error nuestro.
        </li>
      </ul>

      {/* LFDA art. 114 Octies fr. II e): sin beneficio de lo que se puede controlar. Ocultar deja el
          producto fuera de «Patrocinado» y de «Pruébatelo» (`billing/service.ts`, `tryon/service.ts`). */}
      <h2 id="publicidad-pagada">Publicidad pagada e infracciones</h2>
      <ul>
        <li>
          Antes de destacar un producto o de pagar sus simulaciones de «Pruébatelo» («Ver cómo me
          veo»), garantizas que tienes los derechos de cada foto, video, música y texto que
          promueves.
        </li>
        <li>
          Un producto retirado por un aviso de derechos u oculto por moderación no se puede destacar
          y deja de mostrarse en todos lados, también como «Patrocinado». Mientras siga oculto,
          nadie puede probárselo, así que tu tienda no paga simulaciones de ese producto.
        </li>
        <li>
          Los días de destacado que ya habías pagado siguen corriendo mientras el producto está
          oculto. Si se devuelven: <PendingData>[pendiente de revisión legal]</PendingData>.
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

      {/* `#prohibidos`: la liga del aviso de un texto detenido (`trust/content-policy.ts`). */}
      <h2 id="articulos-prohibidos">
        <span id="prohibidos" />
        Artículos prohibidos y restringidos
      </h2>
      <p>No puedes vender, ofrecer ni promover:</p>
      <ul>
        <li>
          <strong>Armas:</strong> armas de fuego y municiones, y también sus accesorios, partes y
          componentes (cargadores, miras, silenciadores), que la ley prohíbe vender por internet;
          archivos o planos para imprimir armas en 3D, kits de conversión y visores nocturnos,
          térmicos u holográficos; pólvora, explosivos y pirotecnia; armas de aire o gas de más de
          140 joules, y navajas automáticas, manoplas u otros objetos anunciados para agredir.
        </li>
        <li>
          <strong>Vapeadores</strong> (desechables, líquidos, cápsulas y accesorios): venderlos o
          anunciarlos es delito. Tampoco tabaco ni artículos con marcas de tabaco.
        </li>
        <li>
          <strong>Drogas</strong> y objetos anunciados para consumirlas.
        </li>
        <li>
          <strong>Medicamentos</strong> con o sin receta (incluidos antibióticos, controlados,
          inyectables y los que se anuncian para bajar de peso), muestras médicas y dispositivos
          médicos que requieren registro sanitario.
        </li>
        <li>
          <strong>Piratería y acceso sin permiso:</strong> copias no autorizadas de libros, cursos o
          PDF, películas, música, programas y juegos; IPTV pirata, «box» o «firestick» cargados,
          decodificadores, cuentas premium compartidas, «cracks», activadores y servicios de
          «desbloqueo»; equipos de telecomunicaciones no homologados e inhibidores de señal.
        </li>
        <li>
          <strong>Personajes y marcas sin licencia</strong> en ropa estampada o mercancía, y
          productos que usan la imagen de una persona artista sin su licencia.
        </li>
        <li>
          <strong>Facturas o comprobantes fiscales (CFDI) a la venta.</strong>
        </li>
        <li>
          <strong>Fauna silvestre protegida</strong> y sus partes: carey o caparazones de tortuga,
          huevos de tortuga, loros, guacamayas y pericos nativos, marfil y pieles sin legal
          procedencia.
        </li>
        <li>
          <strong>Artículos robados</strong> o cuyo origen no puedas demostrar.
        </li>
        <li>
          <strong>Productos retirados del mercado</strong> por la PROFECO, la COFEPRIS u otra
          autoridad, o con alertas sanitarias o de seguridad.
        </li>
        <li>
          <strong>Servicios sexuales</strong>, órganos, tejidos y sangre, y rifas, sorteos o
          apuestas.
        </li>
      </ul>
      <p>
        <strong>Con condiciones:</strong> las copias industriales de diseños, bordados o textiles de
        pueblos y comunidades indígenas o afromexicanas solo se permiten con autorización de la
        comunidad. Si eres artesana o artesano, di de qué comunidad viene tu trabajo.
      </p>
      <p>
        Esta lista no es exhaustiva: también está prohibido todo lo que prohíba la ley, aunque no
        aparezca aquí.
      </p>

      <h2>Falsificaciones y autenticidad</h2>
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
          Quien tiene una marca y ve un producto que la infringe puede mandarnos un aviso por el
          canal formal (ver «Derechos de autor y marcas»).
        </li>
      </ul>

      <h2 id="inteligencia-artificial">Inteligencia artificial y «Pruébatelo»</h2>
      <p>
        «Pruébatelo» simula con inteligencia artificial cómo podría verse una prenda en ti (ver
        abajo). Para usarla, y para todo lo que generan nuestras funciones de IA:
      </p>
      <ul>
        <li>Usa solo tu propia foto, y solo si tienes 18 años o más.</li>
        <li>
          Nunca subas fotos de otras personas, de menores, de artistas ni de figuras públicas.
        </li>
        <li>No intentes obtener imágenes desnudas, en ropa interior o sexuales.</li>
        <li>
          El resultado se marca como una simulación generada con IA. Si lo compartes, es tu
          responsabilidad y necesitas el permiso de quien aparezca en él.
        </li>
        <li>
          Podemos rechazar una simulación, apagar la función o suspender la cuenta de quien incumpla
          estas reglas.
        </li>
        <li>
          {siteConfig.name} no reclama la propiedad de lo que generan sus funciones de IA, sean
          imágenes o textos. Lo que hace solo la IA puede no estar protegido por derechos de autor y
          otra persona podría recibir algo parecido: no hay exclusividad.
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
        producto en ti; no garantiza talla, color, caída ni el aspecto real del producto. La
        simulación es una imagen generada con IA, orientativa, y no forma parte de la descripción
        del producto. Tus derechos de cancelación, garantía y devolución frente a quien vende no
        cambian por ella. Al subir tu foto declaras que es tuya, que eres mayor de edad y aceptas el
        uso descrito en el aviso de privacidad. No subas fotos de otras personas.
      </p>
      {/* Quién paga (ADR-046): el orden de `tryon/funding.ts`. */}
      <p>
        Quien compra nunca paga por «Pruébatelo» (el botón «Ver cómo me veo» de las prendas). Cada
        simulación la paga la tienda que vende el producto principal, desde su saldo, si activó «Ver
        cómo me veo» y no ha llegado al tope diario que ella misma fija; si no, la paga{" "}
        {siteConfig.name} con las pruebas de cortesía que le da a cada tienda, mientras le queden.
        Si no hay ninguna de las dos, la simulación no se genera: solo registramos que alguien quiso
        probarse el producto, y la tienda ve cuántas veces pasó, nunca quién. Solo las tiendas
        tienen saldo, al precio vigente publicado en la página de precios, que puede bajar conforme
        crece el uso de la plataforma y nunca baja de nuestro costo. El saldo se recarga en los
        montos publicados, no es dinero, no genera intereses, no se transfiere entre cuentas ni se
        retira en efectivo, y sirve solo para usos dentro de la plataforma. La tienda puede pedir la
        devolución del saldo no usado dentro de los 5 días hábiles siguientes a una recarga. Si una
        simulación falla, no se cobra (o se devuelve el cargo). Durante la etapa de prueba no se
        cobra nada: las recargas se habilitan cuando haya un medio de pago real.
      </p>

      <h2>Pagos</h2>
      <p>
        Durante la etapa de prueba los pagos son simulados: no se realizan cargos reales ni se
        entrega mercancía.
      </p>

      {/* LFDA art. 114 Octies fr. II b), LGAMVLV art. 20 Sexies, LFPPI art. 344 fr. VII y LFDA
          art. 232 Quinquies fr. III. Las sanciones las decide una persona (ADR-035, ADR-036). */}
      <h2 id="moderacion">Moderación, sanciones y cómo pedir revisión</h2>
      <ul>
        <li>
          <strong>Tu cuenta.</strong> Cuida tu contraseña. Una cuenta es de una sola persona y no se
          presta ni se vende.
        </li>
        <li>
          <strong>Cómo moderamos.</strong> Combinamos reportes de la comunidad, reglas automáticas
          que miden riesgo y la revisión de nuestro equipo. No revisamos todo antes de que se
          publique ni tenemos que vigilar todo lo que se sube, pero actuamos cuando sabemos de algo
          que incumple estas reglas o la ley.
        </li>
        <li>
          <strong>Por qué podemos sancionar.</strong> Solo por motivos objetivos: subir o vender
          algo prohibido (ver «Reglas de la comunidad» y «Artículos prohibidos y restringidos»),
          infringir derechos de otras personas, estafar, crear actividad falsa, poner en riesgo a
          alguien o evadir una sanción.
        </li>
        <li>
          <strong>Qué podemos hacer</strong>, según la gravedad: ocultar una publicación, un
          comentario o un producto, cambiar un producto a «genérico», suspender tus ventas y
          suspender o cerrar tu cuenta. Restauramos lo que hayamos ocultado por error. Toda sanción
          la decide una persona del equipo, nunca la inteligencia artificial.
        </li>
        {/* Retiro por aviso: `CONTENT_REMOVED` en la campana (`rights/service.ts`). Retiro por cuenta
            propia: `applyModerationAction` aún no notifica; solo marca lo oculto (ADR-076). */}
        <li>
          <strong>Te avisamos.</strong> Si retiramos algo tuyo por un aviso de derechos, te avisamos
          dentro de {siteConfig.name} con el motivo y cómo presentar un contra-aviso. Si lo
          retiramos por nuestra cuenta, lo ves marcado: un producto oculto aparece como «Oculto por
          moderación» en tu Studio y una publicación oculta, en «Mi contenido». Si quieres saber el
          motivo y la regla, escríbenos al correo de soporte; solo no te lo decimos si una autoridad
          o la ley lo impiden o si decirlo pone en riesgo a alguien.
        </li>
        <li>
          <strong>Pedir revisión.</strong> Tienes 30 días naturales para pedir que revisemos una
          decisión, en el correo de soporte; si fue por un aviso de derechos, responde con un
          contra-aviso. Cuando sea posible, la revisa una persona distinta de quien decidió, y te
          respondemos en un máximo de 5 días hábiles.
        </li>
        <li>
          <strong>Casos graves</strong> (contenido sexual con menores, contenido íntimo sin
          consentimiento, armas, drogas, amenazas o fraude): actuamos de inmediato y, cuando
          corresponde, avisamos a las autoridades.
        </li>
        <li>
          <strong>Órdenes de autoridad.</strong> Cumplimos las órdenes de autoridades competentes:
          del Ministerio Público o de un juez para interrumpir, bloquear o eliminar contenido de
          violencia digital (te avisamos de inmediato que el contenido se inhabilitó por orden
          judicial, salvo que la orden diga otra cosa), del IMPI, del INDAUTOR y de los tribunales.
          Cuando la ley lo exige, entregamos los datos que tengamos para identificar a quien
          presuntamente cometió la infracción, y conservamos el contenido cuando una autoridad nos
          lo pide.
        </li>
        <li>
          <strong>Evadir una sanción.</strong> Crear otra cuenta para evadir una suspensión o un
          cierre está prohibido, y también la cerramos.
        </li>
        <li>
          <strong>Reporta de buena fe.</strong> Cada persona puede reportar una vez cada
          publicación, comentario, producto o cuenta, y el equipo descarta los reportes que no
          proceden. Reportar en falso o en masa va contra estas reglas.
        </li>
      </ul>

      {/* LFPC art. 90 fr. I: un cambio unilateral no vale; se avisa antes y se puede salir. */}
      <h2 id="cambios">Cambios</h2>
      <ul>
        <li>
          Si cambiamos estos términos de forma importante, te avisaremos dentro de la plataforma (un
          mensaje en la parte de arriba con la liga a lo que cambió) al menos 15 días naturales
          antes de que apliquen. Si un cambio lo exige la ley o es urgente por seguridad, puede
          aplicar antes, y te diremos por qué.
        </li>
        <li>
          La nueva versión te aplica cuando la aceptas, y registramos la versión que aceptes, con su
          fecha. Si no estás de acuerdo, puedes dejar de usar {siteConfig.name} y eliminar tu cuenta
          desde Ajustes, sin costo.
        </li>
        <li>
          Los pedidos en curso, los días de destacado ya pagados y el saldo que ya tenías siguen con
          las condiciones con las que se contrataron.
        </li>
      </ul>

      {/* LFPC arts. 85, 90 fr. VI y 99; NMX-COE-001 5.2.1.8 (ADR-076). */}
      <h2 id="ley-aplicable">Ley aplicable, PROFECO y tribunales</h2>
      <ul>
        <li>
          Estos términos se rigen por las leyes federales de México, en especial la Ley Federal de
          Protección al Consumidor.
        </li>
        <li>
          <strong>PROFECO.</strong> Como persona consumidora, puedes presentar una queja ante la
          Procuraduría Federal del Consumidor en cualquier momento, sin esperar nuestra respuesta:
          por escrito, por teléfono o en línea. Teléfono del Consumidor: 55 5568 8722 y 800 468
          8722.
        </li>
        <li>
          <strong>Tribunales.</strong> Como persona consumidora, para un juicio puedes elegir los
          tribunales de tu domicilio o los de la Ciudad de México. Nunca te pediremos acudir a
          tribunales extranjeros ni a un arbitraje obligatorio.
        </li>
        <li>Si una parte de estos términos no fuera válida, el resto sigue vigente.</li>
        <li>Estos términos están en español, que es la única versión que vale.</li>
      </ul>
    </>
  );
}
