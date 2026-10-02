import type { PaymentMethod } from "../../src/generated/prisma/enums";

/**
 * Cuenta de prueba LOCAL (2026-09-29, a pedido del fundador): una persona registrada, con el
 * onboarding completo y una tienda activa, para recorrer la red social, el estilista y el Studio sin
 * registrarse cada vez. `pnpm db:seed` la crea solo fuera de producción y contra una base de esta
 * máquina (`isProductionTarget`); en cualquier otra base no existe.
 *
 * Son valores de prueba: no los uses en ningún otro servicio. El área del equipo (/admin) se abre
 * con `pnpm make-admin prueba@speeaking.test`, el único camino que da ese rol.
 */
export const testAccount = {
  email: "prueba@speeaking.test",
  password: "prueba-local-2026",
  /** Se lee como nombre de pila en el inicio: «¿Qué quieres compartir, Alex?». */
  name: "Alex Prueba",
  username: "cuenta.prueba",
  bio: "Cuenta de prueba local para recorrer la plataforma.",
  /** Al menos 3, como pide el onboarding. */
  communities: ["humor", "comida", "moda", "tecnologia"],
  store: {
    displayName: "Tienda de prueba",
    city: "Ciudad de México",
    state: "CDMX",
    paymentMethods: ["TRANSFER", "CASH_ON_DELIVERY"] satisfies PaymentMethod[],
  },
} as const;
