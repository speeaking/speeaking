# rights

Aviso y retirada de la LFDA (art. 114 Octies; RLFDA arts. 37 Ter–37 Nonies, ADR-076): el canal
formal para derechos de autor, marcas registradas e imagen o voz de artistas. Es aparte de
«Reportar» (anónimo, módulo `trust`): el aviso formal NO es anónimo. Lo decide siempre una persona
del equipo; el código guarda las fechas, calcula los plazos y cuenta las faltas (P2).

- Página pública `/derechos-de-autor` (explicación, formulario `#aviso` sin cuenta, `#contra-aviso`,
  `#reincidencia`) y `/derechos-de-autor/contra-aviso?caso=DA-…` (con sesión de quien subió algo
  señalado: ve quién avisó y qué reclama, y manda su contra-aviso). Equipo: `/admin/avisos`.
- `schemas.ts`: un campo por requisito del reglamento (37 Quáter y 37 Septies). Nunca certificados
  ni documentos obligatorios (37 Quinquies); marcas exigen su registro del IMPI. Las dos
  declaraciones (bajo protesta de decir verdad y la multa del art. 232 Quinquies) nunca vienen
  marcadas. En el aviso, el domicilio y los hechos se piden pero no lo detienen (la ley no los
  exige para retirar; los Términos lo prometen); el contra-aviso sí exige domicilio.
- `urls.ts`: las direcciones se guardan tal como se escribieron; las de speeaking se resuelven a
  `RightsNoticeTarget` (`/p/<uuid>` → publicación, `/producto/<slug>` → producto, `/u/<usuario>` →
  perfil, `/media/<clave>` → lo que usa esa foto o video) con quien lo subió. Los comentarios no
  tienen dirección propia.
- `owner-cases.ts`: **un caso por cada cuenta** que subió lo señalado. Si un aviso señala cosas de
  varias cuentas, quien avisa recibe un número de caso por cada una; así cada quien recibe su aviso,
  manda (o no) su contra-aviso, y restaurar lo de quien respondió nunca vuelve a mostrar lo de quien
  no respondió (37 Nonies: se restaura «el contenido objeto del contra-aviso»). Las direcciones que
  no apuntan a nada de speeaking van en el primer caso.
- Quien subió el contenido ve su caso (quién avisó, qué reclama) solo después del retiro: un aviso
  pendiente o rechazado no expone a quien lo mandó (los números de caso son consecutivos).
- `service.ts`: retirar oculta publicaciones y productos por la moderación de `trust`
  (`moderateForRightsNotice`, bitácora `moderation.rights_*`), bloquea sus archivos contra la nueva
  subida (`stay-down.ts`) y avisa en la campana (`CONTENT_REMOVED`; el caso viaja en `dedupeKey`,
  `notification-key.ts`). Perfiles y comentarios se retiran a mano y el equipo lo confirma.
  Restaurar (o «retirado por quien avisó») solo toca lo que la última decisión de moderación ocultó
  por un aviso, desbloquea sus archivos y avisa (`CONTENT_RESTORED`) solo de lo que vuelve a verse.
  Lo que también señala otro aviso vigente (p. ej. el mismo aviso mandado dos veces) sigue retirado
  y sus archivos siguen bloqueados, ahora a nombre de ese aviso. «Mantener retirado» (quien
  avisó acreditó una acción legal) avisa a quien lo subió (`CONTENT_REMOVED`, evento `kept`, sin
  ofrecer otro contra-aviso); sobre lo ya restaurado tras un contra-aviso lo vuelve a retirar como
  «Retirar contenido». Si un evento se repite en el mismo caso, su aviso de la campana se renueva.
  Cada acción deja `decidedById`, `decisionNote` y una entrada `moderation.rights.<acción>` en
  `PlatformDecision`.
- Contra-aviso: uno por persona y caso, después del retiro; `restoreDueAt` = 10 días hábiles
  (`business-days.ts`). **Solo descuenta sábados y domingos: los días festivos oficiales todavía no
  se consideran**; el equipo lo revisa antes de restaurar. Restaurar antes de esa fecha, o sin
  contra-aviso, exige nota. No hay restauración automática.
- Faltas (`strikes.ts`): avisos retirados, que se mantienen retirados o con contra-aviso en plazo,
  de los últimos 12 meses. Con 3, `/admin/avisos` pide revisar el cierre en `/admin/usuarios`
  (nunca automático).
- Correos (`email.ts`, `messages.ts`): acuse a quien avisa, copia del contra-aviso a quien avisó
  (`forwardedAt`) y aviso a quien subió el contenido, solo con Resend configurado. Sin proveedor la
  interfaz no promete correos y el equipo manda la copia a mano y la marca en `/admin/avisos`.
- Límites (`limits.ts`): aviso por IP y por correo; contra-aviso y acciones del equipo por cuenta.
  Turnstile en el aviso si está configurado.
