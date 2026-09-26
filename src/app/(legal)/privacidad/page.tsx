import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { LEGAL_VERSIONS } from "@/modules/identity/constants";

export const metadata: Metadata = { title: "Aviso de privacidad" };

// BORRADOR: requiere revisión de un abogado (LFPDPPP) antes del lanzamiento público. Cambiar este
// texto es subir LEGAL_VERSIONS.privacyNotice (el consentimiento queda ligado a la versión).
export default function PrivacyNoticePage() {
  return (
    <>
      <p className="rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground">
        Borrador para revisión legal · versión {LEGAL_VERSIONS.privacyNotice}
      </p>
      <h1 className="text-3xl font-extrabold">Aviso de privacidad</h1>
      <p>
        {siteConfig.name} (nombre provisional) es responsable del tratamiento de tus datos
        personales conforme a la Ley Federal de Protección de Datos Personales en Posesión de los
        Particulares. Los datos del responsable y del domicilio se completarán antes del
        lanzamiento.
      </p>

      <h2>Datos que tratamos</h2>
      <ul>
        <li>Identificación y contacto: nombre, correo, nombre de usuario y foto de perfil.</li>
        <li>
          Datos técnicos de tu conexión: dirección IP y tipo de navegador o dispositivo de cada
          sesión, para mantenerla abierta, mostrarte tus sesiones y proteger tu cuenta. La IP
          también sirve para limitar intentos repetidos (inicio de sesión, registro, publicaciones)
          y frenar abusos.
        </li>
        <li>
          Actividad dentro de la plataforma: publicaciones, comentarios, a quién sigues, me gusta,
          guardados, búsquedas, productos vistos, carrito y compras.
        </li>
        <li>Gustos que tú declaras: comunidades, marcas y lo que estás buscando.</li>
        <li>
          Si compras: el domicilio de entrega (nombre de quien recibe, calle, número, colonia,
          ciudad, estado, código postal y referencias) y un teléfono de contacto.
        </li>
        <li>
          Si vendes: datos de tus productos (incluido su costo, que solo ves tú), ciudad y estado
          (nunca tu domicilio exacto publicado) y lo que escribes en «Vende con IA».
        </li>
        <li>
          Tus decisiones de privacidad y la versión de cada documento que aceptas, con su fecha.
        </li>
      </ul>
      <p>
        No obtenemos datos de otras redes sociales ni de terceros para perfilarte. No usamos cookies
        de publicidad ni de rastreo: solo la cookie de sesión y las necesarias para que la
        plataforma funcione.
      </p>

      <h2>Lo que es público</h2>
      <p>
        Tu perfil (nombre, nombre de usuario, foto, ciudad si la pones), tus publicaciones,
        comentarios y productos son públicos: cualquiera puede verlos, también sin cuenta, y los
        buscadores de internet pueden indexarlos. Tu correo, tu teléfono, tus domicilios, tus
        búsquedas y tus compras nunca son públicos.
      </p>

      <h2>Finalidades principales</h2>
      <ul>
        <li>Crear y proteger tu cuenta.</li>
        <li>Mostrar contenido, permitir publicar, comprar y vender.</li>
        <li>
          Entregar tus compras: la tienda a la que le compras recibe el nombre de quien recibe, el
          domicilio de entrega y el teléfono del pedido, solo cuando el pago se aprueba.
        </li>
        <li>Prevenir fraudes y abusos.</li>
      </ul>

      <h2>Finalidades secundarias (puedes negarte)</h2>
      <ul>
        <li>Personalizar tu feed y recomendaciones con tu actividad dentro de la plataforma.</li>
        <li>
          Sugerirte personas para seguir y mostrarte como sugerencia a otras personas en «Gente de
          tus comunidades».
        </li>
        <li>Medir y mejorar la plataforma con métricas agregadas.</li>
      </ul>
      <p>
        Mientras no terminas tu registro, tu actividad se guarda sin ligarla a tu cuenta. Puedes
        desactivar la personalización en cualquier momento desde Ajustes: desde ese momento, y
        también hacia atrás, tu actividad deja de estar ligada a tu cuenta y solo se cuenta de forma
        anónima y agregada (sin tus búsquedas, sin datos que te identifiquen y con la hora
        redondeada). En Ajustes también puedes ver y borrar tu historial de búsqueda.
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

      <h2 id="vende-con-ia">«Vende con IA»</h2>
      <p>
        Lo que escribes para pedir una propuesta de venta, y los datos que confirmas (producto,
        piezas, costo y precio), se usan solo para generarla. Guardamos el texto sin correos,
        teléfonos, ligas ni cuentas bancarias, y a los 90 días lo borramos por completo. No escribas
        datos personales de nadie en ese texto.
      </p>
      <p>
        Hoy la propuesta la genera un sistema propio que no envía tu texto fuera de nuestros
        servidores. Cuando usemos un proveedor externo de inteligencia artificial, lo nombraremos
        aquí antes de activarlo, junto con el país donde procesa los datos, y le exigiremos por
        contrato no usar tu texto para entrenar sus modelos ni conservarlo.
      </p>

      <h2>Cuánto tiempo guardamos tus datos</h2>
      <ul>
        <li>Tu cuenta, perfil y contenido: mientras tengas la cuenta.</li>
        <li>Tus sesiones: hasta que cierres sesión o venzan (30 días sin uso).</li>
        <li>
          Los registros de intentos por IP: se borran al terminar su ventana (de minutos a unos
          días).
        </li>
        <li>El texto de «Vende con IA»: 90 días.</li>
        <li>
          Tu historial de búsqueda: hasta que lo borres, desactives la personalización o elimines tu
          cuenta.
        </li>
        <li>
          Pedidos, pagos y domicilios de entrega: el tiempo que exijan las leyes fiscales y de
          protección al consumidor.
        </li>
      </ul>

      <h2>Tus derechos (ARCO)</h2>
      <p>
        Puedes acceder, rectificar, cancelar u oponerte al tratamiento de tus datos, así como
        revocar tu consentimiento. Desde Ajustes podrás descargar y eliminar tus datos; el medio de
        contacto para solicitudes se publicará antes del lanzamiento.
      </p>

      <h2>Encargados y transferencias</h2>
      <p>
        Compartimos solo lo necesario con proveedores que tratan datos por nuestra cuenta, bajo
        contrato y obligaciones de confidencialidad:
      </p>
      <ul>
        <li>
          Alojamiento y base de datos: los servidores donde corre la plataforma y se guardan tus
          datos, fotos incluidas.
        </li>
        <li>
          Pagos: hoy los pagos son simulados y no se comparte ningún dato de pago. Cuando conectemos
          un procesador de pagos real, lo nombraremos aquí antes de activarlo; él recibirá lo
          necesario para cobrar (monto, pedido y los datos que tú le des).
        </li>
        <li>
          Correo: cuando te enviemos correos (por ejemplo, para verificar tu cuenta), el proveedor
          de envío recibirá tu correo y el mensaje.
        </li>
        <li>Inteligencia artificial: ver «Vende con IA».</li>
      </ul>
      <p>
        Si alguno de estos proveedores procesa datos fuera de México, lo indicaremos aquí con su
        nombre y país. No vendemos tus datos.
      </p>

      <h2>Cambios</h2>
      <p>Si este aviso cambia, te lo informaremos y registraremos la versión que aceptes.</p>
    </>
  );
}
