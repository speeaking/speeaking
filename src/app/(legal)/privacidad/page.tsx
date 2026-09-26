import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { LEGAL_VERSIONS } from "@/modules/identity/constants";

export const metadata: Metadata = { title: "Aviso de privacidad" };

// BORRADOR: requiere revisión de un abogado (LFPDPPP) antes del lanzamiento público.
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
          Actividad dentro de la plataforma: publicaciones, me gusta, guardados, búsquedas,
          productos vistos, carrito y compras.
        </li>
        <li>Gustos que tú declaras: comunidades, marcas y lo que estás buscando.</li>
        <li>
          Si vendes: datos de tus productos, ciudad y estado (nunca tu domicilio exacto publicado).
        </li>
      </ul>
      <p>No obtenemos datos de otras redes sociales ni de terceros para perfilarte.</p>

      <h2>Finalidades principales</h2>
      <ul>
        <li>Crear y proteger tu cuenta.</li>
        <li>Mostrar contenido, permitir publicar, comprar y vender.</li>
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
        Puedes desactivar la personalización en cualquier momento desde Ajustes. Tu actividad se
        seguirá contando solo de forma anónima y agregada.
      </p>

      <h2 id="gente-de-tus-comunidades">«Gente de tus comunidades»</h2>
      <p>
        Te sugerimos personas que quizá quieras seguir, y a otras personas les podemos sugerir tu
        perfil. Para elegirlas usamos solo señales dentro de la plataforma:
      </p>
      <ul>
        <li>las comunidades que comparten y la actividad reciente en ellas (publicar o unirse);</li>
        <li>las personas que siguen quienes tú sigues;</li>
        <li>quién comentó tus publicaciones (los comentarios ya son públicos).</li>
      </ul>
      <p>
        Para esto no usamos los «me gusta»: nunca revelamos quién dio «me gusta». Y nunca usamos los
        contactos de tu teléfono, tus cuentas de otras redes sociales ni datos de terceros.
      </p>
      <p>
        Cada sugerencia muestra solo tu nombre, tu foto, si tienes tienda y la razón (por ejemplo,
        «También está en Gaming»); nunca tu correo ni otros datos de tu cuenta. Las cuentas
        editoriales no se sugieren.
      </p>
      <p>
        Para dejar de aparecer, desactiva «Aparecer en sugerencias» en Ajustes; está activado por
        omisión. Tu perfil seguirá siendo público y te podrán seguir. Guardamos cada cambio de este
        ajuste, con su fecha. Si una sugerencia no te interesa, toca «Quitar» y no te volveremos a
        sugerir a esa persona.
      </p>

      <h2>Tus derechos (ARCO)</h2>
      <p>
        Puedes acceder, rectificar, cancelar u oponerte al tratamiento de tus datos, así como
        revocar tu consentimiento. Desde Ajustes podrás descargar y eliminar tus datos; el medio de
        contacto para solicitudes se publicará antes del lanzamiento.
      </p>

      <h2>Transferencias</h2>
      <p>
        Compartimos solo lo necesario con proveedores que nos ayudan a operar (alojamiento, pagos,
        envío de correos), bajo obligaciones de confidencialidad.
      </p>

      <h2>Cambios</h2>
      <p>Si este aviso cambia, te lo informaremos y registraremos la versión que aceptes.</p>
    </>
  );
}
