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
    </>
  );
}
