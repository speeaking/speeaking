import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { LEGAL_VERSIONS } from "@/modules/identity/constants";
import { OPERATOR } from "../operator";
import { PendingData } from "../pending-data";

export const metadata: Metadata = { title: "Aviso de privacidad" };

// BORRADOR: requiere revisión de un abogado (LFPDPPP) antes del lanzamiento público. Cambiar este
// texto es subir LEGAL_VERSIONS.privacyNotice (el consentimiento queda ligado a la versión).

// Proveedor de IA real (docs/deploy.md §6, ADR-076): OpenRouter enruta a quien aloja el modelo, y la
// app pide en cada llamada `data_collection: "deny"` y `zdr: true`
// (`server/providers/ai/openai-compatible.ts`). Si cambia el proveedor, cambia este texto y la versión.
const AI_PROCESSOR = "OpenRouter, Inc. (Estados Unidos)";

// PENDIENTE (revisión legal): la empresa de TikTok con la que está la cuenta de anunciante y su país,
// según el contrato que se aceptó al crear el pixel (ADR-072). No se inventa.
const ADS_RECIPIENT = "[Empresa de TikTok de la cuenta de anunciante y país — pendiente]";

// PENDIENTE (revisión legal, antes del lanzamiento): plazos máximos de conservación que el código aún
// no aplica. Hoy esos registros no se borran solos: no se publica un plazo que no se cumple.
const ACTIVITY_RETENTION =
  "[Plazo máximo — pendiente; propuesta: 180 días y después solo cifras agregadas]";
const MODERATION_RETENTION = "[Plazo máximo — pendiente]";
// Expedientes de avisos de derechos y contra-avisos (ADR-076): hoy tampoco se borran solos.
const NOTICE_RETENTION = "[Plazo máximo de los expedientes — pendiente]";

const SECTION_LINK = "font-semibold text-primary-text underline underline-offset-4";

export default function PrivacyNoticePage() {
  return (
    <>
      <p className="rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground">
        Borrador para revisión legal · versión {LEGAL_VERSIONS.privacyNotice}
      </p>
      <h1 className="text-3xl font-extrabold">Aviso de privacidad</h1>
      <section aria-labelledby="novedades" className="rounded-xl border border-border px-4 py-3">
        <h2 id="novedades" className="mt-0! text-base!">
          Qué cambió en esta versión
        </h2>
        <ul className="mt-2 flex flex-col gap-1">
          <li>
            Quién es responsable de tus datos y cómo contactarlo (ver{" "}
            <a className={SECTION_LINK} href="#responsable">
              «Responsable y contacto de datos»
            </a>
            ), y cómo ejercer tus derechos o revocar un permiso, con sus plazos (ver{" "}
            <a className={SECTION_LINK} href="#derechos-arco">
              «Tus derechos (ARCO)»
            </a>
            ).
          </li>
          <li>
            El nombre y el país de cada proveedor que trata tus datos, incluido el de inteligencia
            artificial (ver{" "}
            <a className={SECTION_LINK} href="#encargados">
              «Encargados y transferencias»
            </a>
            ).
          </li>
          <li>
            Qué datos llevan los avisos de derechos de autor y los contra-avisos, y a quién se
            envían (ver{" "}
            <a className={SECTION_LINK} href="#avisos-de-derechos">
              «Avisos de derechos, reportes y solicitudes de autoridades»
            </a>
            ).
          </li>
          <li>
            Qué no hacemos con tu foto de prueba (ver{" "}
            <a className={SECTION_LINK} href="#pruebatelo">
              «Pruébatelo: tu foto»
            </a>
            ), que {siteConfig.name} es solo para personas de 18 años o más (ver{" "}
            <a className={SECTION_LINK} href="#menores">
              «Menores de edad»
            </a>
            ), cómo cuidamos tus datos y qué decide un sistema automático.
          </li>
          <li>
            Si eliges «Continuar con Google», qué nos envía Google LLC (Estados Unidos) y para qué
            lo usamos (ver{" "}
            <a className={SECTION_LINK} href="#entrar-con-google">
              «Entrar con Google»
            </a>
            ).
          </li>
          <li>
            La medición de nuestros anuncios en TikTok, solo si la permites y nunca en lo privado
            (ver{" "}
            <a className={SECTION_LINK} href="#medicion-de-anuncios">
              «Medición de anuncios»
            </a>
            ).
          </li>
          <li>
            Qué enviamos al buscar con una foto y que la foto no se guarda (ver{" "}
            <a className={SECTION_LINK} href="#buscar-con-una-foto">
              «Buscar con una foto»
            </a>
            ).
          </li>
          <li>
            El resumen de las publicaciones largas (ver{" "}
            <a className={SECTION_LINK} href="#contexto">
              «Contexto»
            </a>
            ).
          </li>
          <li>
            Qué ven la tienda y quien publica cuando se recomienda un producto (ver{" "}
            <a className={SECTION_LINK} href="#colaboraciones">
              «Colaboraciones con tiendas»
            </a>
            ).
          </li>
          <li>
            A los videos, como a las fotos, les quitamos la ubicación y los datos del teléfono antes
            de publicarlos (ver{" "}
            <a className={SECTION_LINK} href="#videos">
              «Videos»
            </a>
            ).
          </li>
        </ul>
      </section>
      <p>
        Quien opera {siteConfig.name} es responsable del tratamiento de tus datos personales (ver
        «Responsable y contacto de datos») conforme a la Ley Federal de Protección de Datos
        Personales en Posesión de los Particulares publicada en el Diario Oficial de la Federación
        el 20 de marzo de 2025. La autoridad que vigila esa ley es la Secretaría Anticorrupción y
        Buen Gobierno. Fecha de última actualización: {LEGAL_VERSIONS.privacyNotice}.
      </p>

      {/* LFPDPPP arts. 15 fr. I y 29 (ADR-076). Los datos son del fundador: `../operator.ts`. */}
      <h2 id="responsable">Responsable y contacto de datos</h2>
      <ul>
        <li>
          Responsable: <PendingData>{OPERATOR.legalName}</PendingData>, que opera {siteConfig.name},
          con RFC <PendingData>{OPERATOR.rfc}</PendingData>.
        </li>
        <li>
          Domicilio para oír y recibir notificaciones:{" "}
          <PendingData>{OPERATOR.domicile}</PendingData>.
        </li>
        <li>
          Persona o área de datos personales:{" "}
          <PendingData>{OPERATOR.dataProtectionContact}</PendingData>, en{" "}
          <PendingData>{OPERATOR.privacyEmail}</PendingData>. Atiende tus solicitudes de acceso,
          rectificación, cancelación y oposición, y las de revocar tu consentimiento.
        </li>
      </ul>

      <h2>Datos que tratamos</h2>
      <ul>
        <li>Identificación y contacto: nombre, correo, nombre de usuario y foto de perfil.</li>
        <li>
          Si entras con Google: tu nombre, tu correo, la liga a tu foto de perfil de Google y un
          identificador de tu cuenta de Google (ver «Entrar con Google»).
        </li>
        <li>
          Datos técnicos de tu conexión: dirección IP y tipo de navegador o dispositivo de cada
          sesión, para mantenerla abierta, mostrarte tus sesiones y proteger tu cuenta. La IP
          también sirve para limitar intentos repetidos (inicio de sesión, registro, publicaciones)
          y frenar abusos.
        </li>
        <li>
          Actividad dentro de la plataforma: publicaciones (con sus fotos y videos), comentarios, a
          quién sigues, me gusta, guardados, búsquedas, productos vistos, qué publicaciones
          aparecieron en tu pantalla, de qué publicación llegaste a un producto, carrito y compras.
        </li>
        <li>Gustos que tú declaras: comunidades, marcas y lo que estás buscando.</li>
        <li>
          Si compras: el domicilio de entrega (nombre de quien recibe, calle, número, colonia,
          ciudad, estado, código postal y referencias) y un teléfono de contacto.
        </li>
        <li>
          Si vendes: datos de tus productos (incluido su costo, que solo ves tú), ciudad y estado
          (nunca tu domicilio exacto publicado), lo que escribes en «Sube y vende» y, si te lo
          pedimos, las fotos de tu comprobante de compra.
        </li>
        <li>
          Si reportas algo: qué reportaste, el motivo y el texto que agregues (ver «Reportes y
          moderación»).
        </li>
        <li>
          Si mandas un aviso de derechos o un contra-aviso: los datos del formulario (ver «Avisos de
          derechos, reportes y solicitudes de autoridades»).
        </li>
        <li>
          De cada foto o video que subes, su huella digital: un código que identifica ese archivo
          exacto, no a ti (ver «Reportes y moderación»).
        </li>
        <li>
          Tus decisiones de privacidad, tu declaración de que tienes 18 años o más y la versión de
          cada documento que aceptas, con su fecha.
        </li>
      </ul>
      <p>
        No obtenemos datos de otras redes sociales ni de terceros para perfilarte. Usamos la cookie
        de sesión y las necesarias para que la plataforma funcione; la única de publicidad es la del
        pixel de TikTok, y solo si la permites (ver «Medición de anuncios»).
      </p>
      <p>
        No te pedimos datos sensibles. La foto de «Pruébatelo» la cuidamos como si lo fuera (ver
        «Pruébatelo: tu foto»). No publiques datos sensibles tuyos ni de otras personas, como su
        salud, su origen étnico, su religión o sus preferencias sexuales.
      </p>

      <h2>Lo que es público</h2>
      <p>
        Tu nombre, nombre de usuario y foto de perfil permiten identificarte y son públicos. Tu
        biografía, ciudad y portada solo pueden verlas tú y tus amigos aceptados. En cada
        publicación eliges Público, Amigos o Solo yo; esa elección también controla sus fotos,
        videos y comentarios. Las publicaciones nuevas son públicas por defecto, pero puedes elegir
        otra audiencia antes de publicar o cambiarla después. Las publicaciones antiguas conservan
        su audiencia hasta que su autor la cambie. Seguirte o comprarte no da acceso a publicaciones
        para amigos. Quitar una amistad o bloquear sus mensajes cierra ese acceso. Los buscadores
        pueden indexar publicaciones públicas. Un producto publicado en la tienda sigue siendo
        público aunque una publicación que lo etiquete tenga otra audiencia. Tu correo, teléfono,
        domicilios, búsquedas y compras nunca son públicos; cada tienda solo ve sus compradores y
        pedidos.
      </p>

      <h2>Finalidades principales</h2>
      <ul>
        <li>Crear y proteger tu cuenta.</li>
        <li>Mostrar contenido, permitir publicar, comprar y vender.</li>
        <li>
          Entregar tus compras: la tienda a la que le compras recibe el nombre de quien recibe, el
          domicilio de entrega y el teléfono del pedido, solo cuando el pago se aprueba.
        </li>
        <li>
          Prevenir fraudes, falsificaciones y abusos: revisar el riesgo de imitación de los
          productos y atender reportes.
        </li>
        <li>
          Atender avisos de derechos, contra-avisos y órdenes de autoridad, evitar que se vuelva a
          subir un archivo retirado y cumplir las obligaciones que nos imponen las leyes.
        </li>
      </ul>

      <h2>Finalidades secundarias (puedes negarte)</h2>
      <ul>
        <li>Personalizar tu feed y recomendaciones con tu actividad dentro de la plataforma.</li>
        <li>
          Sugerirte personas para seguir y mostrarte como sugerencia a otras personas en «Gente de
          tus comunidades».
        </li>
        <li>
          Medir y mejorar la plataforma con métricas agregadas (por ejemplo, cuántas veces se vio de
          verdad cada publicación y si un cambio al feed ayuda o estorba).
        </li>
        <li>
          Medir si nuestros anuncios en TikTok traen personas a {siteConfig.name}, solo si lo
          aceptas (ver «Medición de anuncios»).
        </li>
      </ul>
      <p>
        Mientras no terminas tu registro, tu actividad se guarda sin ligarla a tu cuenta. Puedes
        desactivar la personalización en cualquier momento desde Ajustes: desde ese momento, y
        también hacia atrás, tu actividad deja de estar ligada a tu cuenta y solo se cuenta de forma
        anónima y agregada (sin tus búsquedas, sin datos que te identifiquen y con la hora
        redondeada). En Ajustes también puedes ver y borrar tu historial de búsqueda.
      </p>

      {/* ADR-049 y docs/deploy.md 6 bis.0. Alcances por omisión de Better Auth (openid, email,
          profile); `sanitizeUserWrite` deja `image` vacía. */}
      <h2 id="entrar-con-google">Entrar con Google</h2>
      <p>
        Si eliges «Continuar con Google» para crear tu cuenta o entrar, Google LLC, en Estados
        Unidos, confirma que eres tú y nos envía tu nombre, tu correo (que Google ya verificó), la
        liga a tu foto de perfil de Google y un identificador de tu cuenta de Google. Solo pedimos
        esos datos básicos (los permisos «openid», «email» y «profile»): nunca vemos tu contraseña
        de Google, tus contactos, tus correos ni tus archivos.
      </p>
      <p>
        Los usamos solo para crear tu cuenta y dejarte entrar. Guardamos tu nombre, tu correo, el
        identificador y los datos de acceso que Google entrega al entrar, para reconocerte la
        próxima vez; no usamos la foto de Google como tu foto de perfil. Google sabe que usaste tu
        cuenta para entrar a {siteConfig.name}; lo que Google hace con sus propios datos se rige por
        su aviso de privacidad. Si prefieres no usar Google, crea tu cuenta con correo y contraseña.
      </p>

      <h2 id="publicaciones-en-pantalla">Publicaciones que ves en pantalla</h2>
      <p>
        Cuando una publicación del feed o de una comunidad está al menos a la mitad dentro de tu
        pantalla (o, si es más alta que la pantalla, ocupa al menos la mitad de ella) durante 1
        segundo seguido, con la pestaña a la vista, tu navegador nos avisa que apareció. Solo manda
        qué publicación era, si estaba en el feed o en una comunidad y en qué lugar de la lista iba.
        No manda cuánto tiempo la miraste, cómo te desplazaste ni nada de lo que escribes.
      </p>
      <p>
        Sirve para medir lo que de verdad se ve (no solo lo que se cargó) y decidir con datos reales
        si un cambio al feed ayuda o estorba. Cada publicación cuenta a lo más una vez al día por
        persona (o por conexión), y solo si antes te la mostramos. Para decidir cambios al feed solo
        cuentan las personas con sesión y la personalización activada; lo demás solo se describe en
        las métricas.
      </p>
      <p>
        Con la personalización activada, cada vista queda ligada a tu cuenta como el resto de tu
        actividad, junto con el lugar en que se te mostró y, si participas en una prueba de un
        cambio al feed, el grupo que te tocó. Si desactivaste la personalización (o aún no terminas
        tu registro), se guarda sin ligarla a tu cuenta: sin tu cuenta, sin el grupo de prueba y con
        la hora redondeada, como el resto de tu actividad anónima. Si navegas sin cuenta, se guarda
        sin cuenta a la cual ligarla, sin tu IP y sin grupo de prueba; en ese caso la hora no se
        redondea, igual que el resto de la actividad de visitantes sin cuenta.
      </p>
      <p>
        Para no contar dos veces la misma publicación y comprobar que sí se te mostró, usamos por
        unas horas un código hecho con tu cuenta o tu conexión (IP) y la publicación. El código no
        guarda ninguna de las dos en claro (solo se puede comprobar con una llave secreta de nuestro
        servidor), vence a más tardar a las 25 horas y después se borra.
      </p>

      <h2 id="gente-de-tus-comunidades">«Gente de tus comunidades»</h2>
      <p>
        Te sugerimos personas que quizá quieras seguir, y a otras personas les podemos sugerir tu
        perfil. Para elegirlas usamos solo señales dentro de la plataforma:
      </p>
      <ul>
        <li>las comunidades que comparten y la actividad reciente en ellas (publicar o unirse);</li>
        <li>
          las personas que siguen varias de las personas con las que tú te sigues mutuamente (al
          menos dos: nunca decimos quiénes ni cuántas);
        </li>
        <li>quién comentó tus publicaciones (los comentarios ya son públicos).</li>
      </ul>
      <p>
        Para esto no usamos los «me gusta»: nunca revelamos quién dio «me gusta». Y nunca usamos los
        contactos de tu teléfono, tus cuentas de otras redes sociales ni datos de terceros.
      </p>
      <p>
        Si tienes activado «Aparecer en sugerencias», a quién sigues puede contar, junto con otras
        personas y sin decir quién, para sugerir perfiles a quienes se siguen mutuamente contigo.
        Seguirte no basta para ver a quién sigues.
      </p>
      <p>
        Cada sugerencia muestra solo tu nombre, tu foto, si tienes tienda y la razón (por ejemplo,
        «También está en Gaming»); nunca tu correo ni otros datos de tu cuenta. Las cuentas
        editoriales no se sugieren.
      </p>
      <p>
        Para dejar de aparecer, desactiva «Aparecer en sugerencias» en Ajustes; está activado por
        omisión. Desactivado, tampoco usamos a quién sigues para sugerir personas. Tu perfil seguirá
        siendo público y te podrán seguir. Guardamos cada cambio de este ajuste, con su fecha. Si
        una sugerencia no te interesa, toca «Quitar» y no te volveremos a sugerir a esa persona.
      </p>

      <h2 id="sube-y-vende">Inteligencia artificial: «Sube y vende» y «Kit de anuncios»</h2>
      <p>
        Lo que escribes para pedir una propuesta de venta, y los datos que confirmas (producto,
        piezas, costo y precio), se usan solo para generarla. Para el kit de anuncios usamos los
        datos de tu producto que ya son públicos (nombre, descripción, etiquetas, precio, categoría,
        condición, ciudad y estado, envío, garantía y devoluciones). Guardamos el texto sin correos,
        teléfonos, ligas ni cuentas bancarias, y a los 90 días lo borramos por completo. No escribas
        datos personales de nadie en ese texto.
      </p>
      <p>
        Para escribir estos textos usamos un proveedor externo de inteligencia artificial: una
        empresa que nos da acceso por internet (API) a modelos de lenguaje y nos cobra por uso. Solo
        le enviamos tu texto, ya sin correos, teléfonos, ligas, cuentas ni el costo que hayas
        escrito, y los datos del producto. Nunca le enviamos el costo de tu producto, tu nombre, tu
        correo ni datos de tus clientes. En cada solicitud le pedimos enviarla solo a empresas que
        no guardan lo enviado ni lo usan para entrenar sus modelos (cero retención). El proveedor y
        esas empresas procesan los datos fuera de México.
      </p>
      <p>
        Proveedor de inteligencia artificial (encargado): {AI_PROCESSOR}, que dirige cada solicitud
        a la empresa que aloja el modelo (por ejemplo, Google para los modelos Gemini).
      </p>
      <p>
        Todo lo que escribe la IA se marca como «Creado con ayuda de IA» y tú lo revisas antes de
        publicarlo o compartirlo. Para elegir qué modelo usar lo probamos con casos ficticios; si
        algún día usamos textos reales de vendedores para esas pruebas, será con su permiso y sin
        datos personales.
      </p>

      <h2 id="estilista">Estilista: «¿Qué necesitas?», «Crea mi look» y «Completa mi look»</h2>
      <p>
        Lo que escribes en «¿Qué necesitas?» se usa para interpretar tu necesidad (ocasión, estilo,
        presupuesto, colores) y armar looks con productos reales de la plataforma. Guardamos ese
        texto sin correos, teléfonos ni cuentas, junto con los looks que armamos para ti, y lo
        convertimos en una intención de compra vigente por 30 días («Lo que buscas»), que puedes
        quitar cuando quieras. Si tienes cuenta y la función está activa, el texto se envía al
        proveedor de inteligencia artificial descrito arriba, sin tu nombre; el presupuesto lo
        calcula nuestro código, no el modelo.
      </p>

      <h2 id="buscar-con-una-foto">Buscar con una foto</h2>
      <p>
        Si buscas con una foto, tu navegador la reduce y nuestro servidor la vuelve a reducir y le
        quita los metadatos (incluida la ubicación) antes de enviarla al proveedor de inteligencia
        artificial descrito arriba, solo para que describa la ropa y los objetos que se pueden
        comprar. Le pedimos no conservarla ni usarla para entrenar sus modelos, y no describir ni
        reconocer a las personas que aparezcan. La foto no se guarda en ningún lado: ni en nuestro
        almacenamiento ni en el registro de la solicitud, donde solo queda que hubo una búsqueda con
        foto (fecha, modelo y costo).
      </p>
      <p>
        Lo que el modelo describió (por ejemplo, «camisa de lino blanca») se guarda como una
        búsqueda más, con las mismas reglas que tus búsquedas escritas. Solo funciona con sesión y
        con un límite de búsquedas por hora y por día. No uses fotos de otras personas sin su
        permiso.
      </p>

      <h2 id="contexto">«Contexto» de publicaciones largas</h2>
      <p>
        En una publicación larga puedes tocar «Contexto» para leer un resumen neutral de dos o tres
        oraciones. Para escribirlo enviamos al proveedor de inteligencia artificial solo el texto de
        la publicación, que ya es público, sin correos, teléfonos, ligas ni cuentas, y sin decirle
        quién lo pidió. El resumen se marca como hecho con IA, se guarda y se muestra a todos; si el
        texto de la publicación cambia, se hace otro.
      </p>

      <h2 id="spyke">Spyke: lectura y órdenes de voz</h2>
      <p>
        Spyke usa el micrófono solo cuando lo activas y das permiso al navegador, con la app
        abierta. Al cerrar su ventana o salir de la app se detienen el micrófono y la lectura.
        speeaking no guarda grabaciones. El reconocimiento y la voz de lectura los proporciona tu
        navegador: según el navegador y la voz elegida, puede enviar audio o texto a sus propios
        proveedores. La disponibilidad depende de tu dispositivo y de tu conexión.
      </p>
      <p>
        Para interpretar una orden que no sea un control básico, enviamos su texto al proveedor de
        IA descrito arriba, quitando correos, teléfonos, ligas y cuentas. No enviamos la publicación
        ni tu lista de amigos. El registro de IA guarda el tipo de acción y su costo, sin el
        dictado, destinatario ni mensaje privado. Antes de compartir eliges un amigo aceptado y
        confirmas el destinatario y el mensaje. Solo se envía el enlace de la publicación y tu
        mensaje corto: compartir no cambia su audiencia y ambas personas deben tener acceso. El
        mensaje se conserva en la conversación con las reglas de mensajes privados.
      </p>

      <h2 id="colaboraciones">Colaboraciones con tiendas</h2>
      <p>
        Si etiquetas en tu publicación un producto de otra tienda (solo se puede si esa tienda
        acepta colaboraciones), la tienda recibe un aviso con tu nombre visible y la liga a tu
        publicación, que ya es pública. Si la tienda quita la etiqueta de su producto, te avisamos.
      </p>
      <p>
        Quien publica y la tienda ven, por publicación, números agregados de lo que salió de ella:
        visitas al producto, pruebas con «Pruébatelo», productos agregados al carrito y compras
        pagadas. Nunca ven quién visitó, se probó o compró. Para contarlo guardamos, en tu
        actividad, en tu carrito y en tus pedidos, de qué publicación llegaste al producto.
      </p>

      <h2 id="videos">Videos</h2>
      <p>
        Los videos se guardan y se entregan como las fotos: son privados hasta que los publicas y
        solo salen por nuestro sitio, que revisa quién puede verlos. Los teléfonos suelen guardar
        dentro del video el lugar donde se grabó, la marca y el modelo: tu navegador los quita antes
        de subirlo y nuestro servidor no publica un video que todavía los traiga. La portada es un
        cuadro del video que se guarda como una foto nueva, sin metadatos.
      </p>

      <h2 id="pruebatelo">«Pruébatelo»: tu foto</h2>
      <p>
        Para simular cómo podría verse una prenda en ti, subes una foto tuya (debe ser tuya y ser
        mayor de edad) y aceptas expresamente su uso. La usamos solo para generar esas simulaciones.
        La foto y cada simulación son privadas por defecto: solo tú las ves, ni el equipo ni los
        vendedores tienen acceso. No se pueden adjuntar a publicaciones ni productos. Se borran
        solas a los 30 días y puedes borrarlas antes desde Ajustes («Mis fotos de prueba»); al
        borrar la foto se borran sus simulaciones.
      </p>
      {/* ADR-076: una cara puede revelar origen étnico o salud (LFPDPPP art. 2 fr. VI); se cuida
          como dato sensible aunque no se use para identificar a nadie. */}
      <p>
        No la usamos para reconocerte ni identificarte, no creamos una plantilla biométrica y no se
        usa para entrenar modelos. Como una imagen puede revelar rasgos físicos, la cuidamos con
        medidas reforzadas, como si fuera un dato sensible. Tu consentimiento es expreso: una
        casilla sin marcar que aceptas con tu sesión iniciada y que guardamos con su versión y su
        fecha. Para generar cada simulación la procesa {AI_PROCESSOR} junto con la empresa que aloja
        el modelo de imágenes (ver «Encargados y transferencias»). Solo puedes subir tu propia foto:
        nunca fotos de otras personas, de menores, de artistas ni de figuras públicas.
      </p>
      <p>
        Si eliges «Compartir mi look» y aceptas compartir, damos acceso solo a la simulación
        elegida: a la persona que selecciones en el chat, o a quien reciba el enlace secreto si
        decides usar WhatsApp. Tu foto original y tus otras pruebas siguen privadas. El acceso vence
        en un máximo de siete días y puedes desactivarlo antes; borrar la foto también retira sus
        resultados compartidos. Esto no borra copias que alguien ya haya guardado. La tarjeta
        incluye tu nombre, tu mensaje y las prendas con sus tallas solicitadas y precios, pero
        ningún domicilio guardado.
      </p>
      <p>
        Para generar la imagen enviamos al proveedor de inteligencia artificial tu foto, las fotos
        públicas de los productos y una instrucción sin tu nombre ni tus datos; le pedimos no
        conservarla ni usarla para entrenar sus modelos. Guardamos el registro de cada solicitud
        (fecha, modelo, costo y qué productos) sin la imagen, para medir y auditar el uso. Cada
        simulación se muestra como lo que es: una imagen generada con IA, no una garantía de talla,
        color o caída.
      </p>

      <h2 id="saldo">Saldo y recargas</h2>
      <p>
        Si recargas saldo guardamos el monto, la fecha, la referencia del proveedor de pagos y cada
        movimiento (recargas, cargos por simulaciones, devoluciones). Nunca vemos ni guardamos los
        datos de tu tarjeta: los maneja el proveedor de pagos. El saldo no es dinero ni se
        transfiere; los precios y las condiciones de devolución están en la página de precios y en
        los términos.
      </p>

      <h2 id="autenticidad">Autenticidad de los productos</h2>
      <p>
        Para proteger a quien compra de falsificaciones revisamos el riesgo de imitación de cada
        producto con reglas automáticas: su precio comparado con productos parecidos de otras
        tiendas o con un precio de referencia, palabras como «réplica» junto a una marca, si se
        declara original, si la tienda es nueva (su antigüedad y cuántas ventas ha completado) y los
        reportes de la comunidad. Esta revisión mide riesgo: no acusa a nadie ni certifica nada.
        Guardamos el resultado vigente de cada producto (nivel de riesgo, señales que se activaron y
        versión de las reglas).
      </p>
      <p>
        Si declaras que un producto es original, te podemos pedir un comprobante de compra (ticket,
        factura, empaque o número de serie). Sus fotos son privadas: solo las ven tú y el equipo, y
        nunca se publican.
      </p>
      <p>
        <strong>Señal opcional de inteligencia artificial.</strong> Si la activamos (por omisión
        está apagada), cuando las reglas ya encontraron alguna señal le enviamos al proveedor de
        inteligencia artificial el título, la descripción y las etiquetas del producto, que ya son
        públicos, sin correos, teléfonos, ligas ni cuentas, para detectar lenguaje de imitación que
        una lista de palabras no alcanza. No le enviamos fotos, el costo, tu nombre ni tus datos de
        contacto. Guardamos su respuesta (si el texto sugiere una imitación, qué tan segura está y
        una razón breve), el modelo y la fecha. Solo puede sumar un poco al riesgo que ya
        encontraron las reglas: nunca decide sola, y un producto de riesgo bajo no pasa a riesgo
        alto por ella.
      </p>

      <h2 id="reportes-y-moderacion">Reportes y moderación</h2>
      <p>
        Si reportas una publicación, un comentario, un producto o una cuenta, guardamos quién
        reportó, qué reportaste, el motivo, el texto que agregues (opcional, hasta 1,000
        caracteres), la fecha, su estado (abierto, atendido o descartado) y quién del equipo lo
        atendió y cuándo. Si es un reporte de la comunidad (botón «Reportar»), quien publica o vende
        nunca sabe quién lo reportó ni cuántas personas lo hicieron; los avisos formales de derechos
        no son anónimos (ver abajo). Los reportes de contenido íntimo sin consentimiento y de riesgo
        para menores se atienden primero. Los reportes de posible falsificación cuentan como una
        señal más en la revisión de autenticidad (contamos personas distintas; los descartados no
        cuentan). No escribas datos personales de nadie en el texto del reporte.
      </p>
      <p>
        Solo personas del equipo de {siteConfig.name} con ese rol pueden moderar; la inteligencia
        artificial nunca lo hace. El equipo puede ocultar una publicación, un comentario o un
        producto (deja de verse en la plataforma), restaurarlo si fue un error, descartar reportes,
        revisar un comprobante de compra (y mostrar «Comprobante revisado por {siteConfig.name}») o
        rechazar una declaración de original (el producto pasa a «genérico o compatible»). Cada
        acción queda registrada con quién la tomó, cuándo, qué cambió y la nota del equipo; la nota
        de una revisión de autenticidad se le muestra a quien vende.
      </p>
      <p>
        Al subir una foto o un video calculamos su huella digital (un código que identifica ese
        archivo exacto, no a ti, y que no permite reconstruirlo). Cuando retiramos un archivo por un
        aviso de derechos, guardamos su huella para que el mismo archivo no se pueda volver a subir
        desde ninguna cuenta.
      </p>

      {/* LFDA art. 114 Octies fr. III; RLFDA arts. 37 Quáter, 37 Septies y 37 Octies; LFPDPPP
          arts. 35 y 36 fr. I y V (ADR-076). Campos: `RightsNotice` y `CounterNotice`. */}
      <h2 id="avisos-de-derechos">Avisos de derechos, reportes y solicitudes de autoridades</h2>
      <p>
        <strong>Si mandas un aviso de derechos</strong> (derechos de autor, marca o imagen de una
        persona artista), guardamos tu nombre, tu correo y, si los das, tu domicilio, tu correo
        alterno y tu teléfono; si eres titular o representante y a quién representas; la obra o el
        derecho que reclamas y, si los cuentas, los hechos; las direcciones del contenido; el número
        de registro de la marca, si es una marca; tu declaración bajo protesta de decir verdad y que
        reconoces la multa por avisos falsos, y tu cuenta, si lo mandaste con la sesión iniciada.
        Los usamos para atender el aviso, retirar el contenido y seguir el procedimiento de
        contra-aviso. Si retiramos el contenido, quien lo publicó recibe tu nombre, tu correo, la
        descripción de tu aviso y, si representas a alguien, el nombre de quien representas, para
        saber quién reclama y poder responder; el formulario te lo advierte antes de enviarlo.
      </p>
      <p>
        <strong>Si mandas un contra-aviso</strong>, guardamos tu nombre, tu correo, tu domicilio,
        por qué tu uso es válido, tu explicación, tu declaración bajo protesta de decir verdad, que
        reconoces la multa por declaraciones falsas y la cuenta con la que lo mandaste. La Ley
        Federal del Derecho de Autor nos obliga a enviarle a quien mandó el aviso una copia completa
        de tu contra-aviso, con tu nombre, tu contacto y tu domicilio; por eso no necesitamos tu
        consentimiento para ese envío.
      </p>
      <p>
        <strong>Autoridades.</strong> Transferimos datos, sin necesitar tu consentimiento, a las
        autoridades competentes (por ejemplo, el IMPI, el INDAUTOR, los jueces, el Ministerio
        Público y la Fiscalía General de la República) cuando una ley lo exige o una autoridad lo
        ordena dentro de un procedimiento, y para denunciar delitos contra niñas, niños y
        adolescentes. Entregamos solo lo que se pide y lo que la ley permite.
      </p>
      <p>
        Los expedientes de avisos y contra-avisos hoy no se borran solos. Plazo máximo:{" "}
        <PendingData>{NOTICE_RETENTION}</PendingData>. Si eliminas tu cuenta, el expediente se
        conserva sin ligarse a ella.
      </p>

      <h2 id="medicion-de-anuncios">Medición de anuncios</h2>
      <p>
        Anunciamos {siteConfig.name} en TikTok. Si lo permites en el aviso que aparece en las
        páginas públicas (o en la página de{" "}
        <a className={SECTION_LINK} href="/cookies#anuncios">
          Cookies
        </a>
        ), cargamos el pixel de TikTok en la portada sin sesión, Comprar, los productos, las páginas
        informativas, el registro y la bienvenida: nunca en tus mensajes, pedidos, perfiles ni en tu
        feed. Sin tu permiso no se carga.
      </p>
      <p>
        TikTok recibe qué página pública visitas, si terminaste de crear tu cuenta y datos técnicos
        de tu navegador (dirección IP, tipo de navegador e identificadores guardados en cookies),
        para saber si uno de nuestros anuncios trajo a alguien. No le mandamos tu nombre, correo ni
        teléfono. TikTok trata esos datos bajo sus propias condiciones para anunciantes y su aviso
        de privacidad, y puede hacerlo fuera de México.
      </p>
      <p>
        Puedes cambiar tu decisión cuando quieras en Cookies: al no permitirlo dejamos de cargar el
        pixel y borramos sus cookies de tu navegador. Lo que TikTok ya recibió lo resguarda TikTok.
      </p>

      <h2>Cuánto tiempo guardamos tus datos</h2>
      <ul>
        <li>Tu cuenta, perfil y contenido: mientras tengas la cuenta.</li>
        <li>
          Si entras con Google, el identificador y los datos de acceso de Google: mientras tengas la
          cuenta.
        </li>
        <li>Tus sesiones: hasta que cierres sesión o venzan (30 días sin uso).</li>
        <li>
          Los registros de intentos por IP: se borran al terminar su ventana (de minutos a unos
          días).
        </li>
        <li>El texto de «Sube y vende» y el de «¿Qué necesitas?»: 90 días.</li>
        <li>Tu foto de «Pruébatelo» y cada simulación: 30 días, o antes si las borras.</li>
        <li>La foto de «Buscar con una foto»: no se guarda.</li>
        <li>
          El resumen de «Contexto»: mientras exista la publicación (o hasta que cambie su texto).
        </li>
        <li>Los movimientos de tu saldo: mientras tengas la cuenta (registro contable).</li>
        <li>
          Tu actividad, incluidas las publicaciones que viste en pantalla: ligada a tu cuenta
          mientras la tengas y tengas activada la personalización. Al desactivarla se desliga,
          también la anterior, y queda solo como dato anónimo para métricas agregadas. Plazo máximo
          de los registros detallados: <PendingData>{ACTIVITY_RETENTION}</PendingData>.
        </li>
        <li>
          El código para no contar dos veces una publicación vista: vence a las 25 horas como
          máximo.
        </li>
        <li>
          La revisión de autenticidad de un producto, con la respuesta de la IA si se usó: mientras
          exista el producto.
        </li>
        <li>
          Reportes, fotos de comprobante y registro de las acciones del equipo: hoy no se borran
          solos; se conservan como historial de moderación. Plazo máximo:{" "}
          <PendingData>{MODERATION_RETENTION}</PendingData>. Si eliminas tu cuenta, tus reportes se
          conservan sin ligarse a ti.
        </li>
        <li>
          Avisos de derechos y contra-avisos: hoy no se borran solos. Plazo máximo:{" "}
          <PendingData>{NOTICE_RETENTION}</PendingData>.
        </li>
        <li>
          La huella digital de un archivo: mientras exista el archivo; la de un archivo retirado por
          un aviso de derechos se conserva para que no se vuelva a subir, salvo que lo restauremos.
        </li>
        <li>
          Tu historial de búsqueda: hasta que lo borres, desactives la personalización o elimines tu
          cuenta.
        </li>
        <li>
          Pedidos, pagos y domicilios de entrega: el tiempo que exijan las leyes fiscales y de
          protección al consumidor.
        </li>
      </ul>

      {/* LFPDPPP arts. 21–34 y 40; procedimiento interno en docs/legal/03 §3 (ADR-076). No existe
          exportar datos: no se promete una descarga. */}
      <h2 id="derechos-arco">Tus derechos (ARCO)</h2>
      <p>
        En cualquier momento puedes acceder a tus datos, rectificarlos, cancelarlos u oponerte a que
        los tratemos; ejercer uno no depende de otro. Es gratis: solo podríamos cobrarte el costo de
        copias o de envío, si lo pides así.
      </p>
      <ul>
        <li>
          <strong>Cómo pedirlo.</strong> Escribe a{" "}
          <PendingData>{OPERATOR.privacyEmail}</PendingData> con tu nombre y un medio para
          responderte, qué datos y qué derecho quieres ejercer (si es para rectificar, qué cambio y
          el documento que lo respalde) y cualquier dato que nos ayude a encontrarlos.
        </li>
        <li>
          <strong>Comprobamos que eres tú</strong> antes de responder: con el correo de tu cuenta y,
          si hace falta, una identificación oficial. Si actúas por otra persona, también el
          documento que acredite la representación.
        </li>
        <li>
          <strong>Plazos.</strong> Te respondemos en un máximo de 20 días hábiles desde que
          recibimos tu solicitud y, si procede, la hacemos efectiva en los 15 días hábiles
          siguientes. Cada plazo puede ampliarse una sola vez por un periodo igual, si hay razón y
          te avisamos antes de que venza.
        </li>
        <li>
          <strong>Acceso.</strong> Te entregamos tus datos en un archivo electrónico, después de
          comprobar tu identidad.
        </li>
        <li>
          <strong>Cancelación.</strong> Puedes eliminar tu cuenta desde Ajustes: se borra de
          inmediato. Si tienes pedidos, la cuenta queda anonimizada y conservamos solo los datos de
          esos pedidos que exigen las leyes fiscales y de protección al consumidor. Si pides la
          cancelación por correo, primero bloqueamos tus datos (solo se guardan para responder por
          obligaciones legales, sin usarlos para nada más) y después los suprimimos, y avisamos a
          quien los haya recibido de nosotros.
        </li>
        <li>
          <strong>Oposición.</strong> Por ejemplo, a la personalización (en Ajustes) o a una
          decisión automatizada (ver «Decisiones automatizadas y tu derecho a oponerte»).
        </li>
        <li>
          <strong>Si no te respondemos o no estás de acuerdo</strong>, puedes presentar una
          solicitud de protección de derechos ante la Secretaría Anticorrupción y Buen Gobierno
          dentro de los 15 días hábiles siguientes a nuestra respuesta o a que venza el plazo para
          responder.
        </li>
      </ul>

      {/* LFPDPPP art. 7, último párrafo: cómo se revoca cada consentimiento. */}
      <h2 id="revocar">Cómo revocar tu consentimiento</h2>
      <ul>
        <li>Personalización del feed y «Aparecer en sugerencias»: en Ajustes, al momento.</li>
        <li>
          Medición de anuncios de TikTok: en{" "}
          <a className={SECTION_LINK} href="/cookies#anuncios">
            Cookies, «Medición de anuncios»
          </a>
          ; al no permitirlo dejamos de cargar el pixel y borramos sus cookies de ese navegador.
        </li>
        <li>
          «Pruébatelo»: en Ajustes, «Mis fotos de prueba», borra tu foto; se borran sus simulaciones
          y dejamos de usarla.
        </li>
        <li>
          Todo lo demás, incluido cerrar tu cuenta: elimina tu cuenta desde Ajustes o escribe a{" "}
          <PendingData>{OPERATOR.privacyEmail}</PendingData>. Lo atendemos en los plazos de arriba
          y, si lo pides, te confirmamos que dejamos de usar tus datos.
        </li>
      </ul>
      <p>
        Revocar es gratis y no tiene efectos hacia atrás. Lo que la ley nos obliga a conservar queda
        bloqueado.
      </p>

      <h2 id="menores">Menores de edad</h2>
      <p>
        {siteConfig.name} es solo para personas de 18 años o más, y no recabamos a sabiendas datos
        de menores. Si detectamos o nos reportan una cuenta de una persona menor, la cerramos y
        borramos sus datos, salvo lo que la ley nos obligue a conservar. Madres, padres o quien
        tenga la tutela pueden avisarnos con «Reportar» o escribirnos a{" "}
        <PendingData>{OPERATOR.privacyEmail}</PendingData>.
      </p>

      {/* LFPDPPP arts. 18 y 19. Lo técnico, en /seguridad (cada punto con su archivo). */}
      <h2 id="seguridad">Seguridad y vulneraciones</h2>
      <p>
        Cuidamos tus datos con medidas administrativas, técnicas y físicas: todo viaja cifrado, las
        contraseñas se guardan transformadas, hay límites de intentos, solo las personas del equipo
        que lo necesitan tienen acceso y las fotos y videos pierden su ubicación antes de
        publicarse. Si ocurre una vulneración de seguridad que afecte de forma significativa tus
        derechos patrimoniales o morales, te avisaremos de inmediato, al correo de tu cuenta, con lo
        que pasó, qué datos se comprometieron, qué te recomendamos hacer, qué estamos haciendo y
        dónde obtener más información.
      </p>

      {/* LFPDPPP art. 26 fr. II. Lo que decide una regla y lo que decide una persona. */}
      <h2 id="decisiones-automatizadas">Decisiones automatizadas y tu derecho a oponerte</h2>
      <ul>
        <li>
          La revisión de autenticidad evalúa con reglas automáticas cada producto y algunas señales
          de la tienda (su antigüedad, sus ventas completadas y los reportes) y puede mostrar una
          leyenda a quien compra. Ocultar, verificar o sancionar siempre lo decide una persona del
          equipo. Si crees que una leyenda es un error, puedes pedir que una persona la revise u
          oponerte, en <PendingData>{OPERATOR.privacyEmail}</PendingData>.
        </li>
        <li>
          Al publicar, unas reglas automáticas revisan el texto para frenar artículos prohibidos, y
          un archivo idéntico a uno retirado no se puede volver a subir. Si crees que es un error,
          escríbenos.
        </li>
        <li>
          El orden de tu feed y las sugerencias de personas son un perfilamiento con tu actividad
          dentro de {siteConfig.name}; los puedes apagar en Ajustes. Las pruebas de cambios al feed
          asignan grupos y no deciden nada sobre tu cuenta.
        </li>
        <li>
          Lo que redacta la inteligencia artificial son borradores que tú revisas; la IA nunca
          modera ni sanciona.
        </li>
      </ul>

      {/* docs/deploy.md §17 (ADR-076): proveedores y regiones reales de producción. */}
      <h2 id="encargados">Encargados y transferencias</h2>
      <p>
        Compartimos solo lo necesario con proveedores que tratan datos por nuestra cuenta, bajo
        contrato y obligaciones de confidencialidad:
      </p>
      <ul>
        <li>
          Alojamiento: Vercel Inc. (Estados Unidos, región de Washington D. C.), donde corre la
          plataforma y quedan los registros técnicos de cada solicitud.
        </li>
        <li>Base de datos: Neon (Databricks, Inc., Estados Unidos), donde se guardan tus datos.</li>
        <li>
          Fotos, videos y verificación de seguridad: Cloudflare, Inc. (Estados Unidos). Guarda tus
          fotos y videos en un almacenamiento privado (R2) y, con Turnstile, comprueba que quien se
          registra, pide recuperar su contraseña o manda un aviso de derechos es una persona (ver{" "}
          <a className={SECTION_LINK} href="/cookies#turnstile">
            Cookies, «Verificación de seguridad»
          </a>
          ).
        </li>
        <li>
          Pagos: hoy los pagos son simulados y no se comparte ningún dato de pago. Cuando conectemos
          un procesador de pagos real, lo nombraremos aquí antes de activarlo; él recibirá lo
          necesario para cobrar (monto, pedido y los datos que tú le des).
        </li>
        <li>
          Correo: Resend (Estados Unidos) envía el correo para recuperar tu contraseña, si lo pides,
          y los de los avisos de derechos (el acuse a quien avisa, el aviso a quien publicó el
          contenido y la copia del contra-aviso); recibe la dirección de quien recibe cada correo y
          el mensaje.
        </li>
        <li>
          Inteligencia artificial: {AI_PROCESSOR}, que da acceso por API a modelos de lenguaje y de
          imágenes y cobra por uso, y las empresas que alojan esos modelos, a las que solo les llega
          lo que les enviamos si no lo guardan ni lo usan para entrenar (cero retención). Reciben tu
          texto sin datos de contacto y los datos del producto, nunca su costo (ver «Inteligencia
          artificial»). Si activamos la señal de autenticidad, también el texto público de los
          productos con alguna señal de riesgo (ver «Autenticidad de los productos»). Si buscas con
          una foto, la foto reducida y sin metadatos, que no se guarda (ver «Buscar con una foto»);
          si usas «Pruébatelo», tu foto y las fotos públicas de los productos (ver «Pruébatelo: tu
          foto»); y el texto público de las publicaciones largas que alguien resume (ver
          «Contexto»).
        </li>
      </ul>
      <p>
        Estos proveedores tratan los datos fuera de México, en Estados Unidos (Cloudflare también
        usa su red en otros países para la verificación de seguridad, y las empresas que alojan los
        modelos de inteligencia artificial pueden procesarlos en otros países). No vendemos tus
        datos.
      </p>
      <p>
        Google LLC, en Estados Unidos, no es nuestro encargado: si eliges «Continuar con Google»,
        Google confirma que eres tú y nos envía tu nombre, tu correo y la liga a tu foto de perfil,
        solo para autenticar tu cuenta, y trata sus propios datos como responsable, bajo tu relación
        con Google (ver «Entrar con Google»).
      </p>
      <p>
        Transferencia, solo si la permites: a TikTok (<PendingData>{ADS_RECIPIENT}</PendingData>),
        lo descrito en «Medición de anuncios», para medir nuestros anuncios.
      </p>
      <p>
        Transferencias que no necesitan tu consentimiento: a la tienda a la que le compras, lo
        necesario para entregarte el pedido (ver «Finalidades principales»); en un aviso de
        derechos, la copia del contra-aviso a quien avisó, porque la ley lo exige; y a las
        autoridades, cuando la ley lo exige. El nombre y el contacto de quien avisa llegan a quien
        publicó el contenido porque quien avisa lo acepta al enviar el aviso (ver «Avisos de
        derechos, reportes y solicitudes de autoridades»).
      </p>

      <h2>Cambios</h2>
      <p>
        Si este aviso cambia, te lo avisaremos dentro de la plataforma (un mensaje en la parte de
        arriba con la liga a los cambios) y registraremos la versión que aceptes, con su fecha.
      </p>
    </>
  );
}
