# Procedimientos internos de datos personales y contenidos (Estreno, septiembre de 2026)

> **BORRADOR INTERNO PARA REVISIÓN LEGAL. NO ES ASESORÍA LEGAL NI FISCAL.** Este documento propone
> los procedimientos que Estreno necesita antes de abrir al público: conservación de datos, derechos
> ARCO, vulneraciones de seguridad, retiro de contenidos, registro de encargados y los pendientes
> legales del fundador. **Todo debe revisarlo un abogado mexicano (y la parte fiscal, un contador)
> antes de aplicarse o publicarse.** Lo marcado **[VERIFICAR CON ABOGADO]** o **[VERIFICAR CON
> CONTADOR]** es una interpretación nuestra o un punto donde la ley no es clara.
>
> - **Fecha de corte:** 2026-09-26. Complementa `docs/legal/00-marco-legal-2026.md` (lo citamos como
>   **[00 §n]**); ahí están el análisis de fondo y las demás fuentes.
> - **Cómo citamos:** `[n, art. x]` remite a la sección 9 (Fuentes). Todas las fuentes se consultaron
>   el 2026-09-26; las leyes se leyeron en el texto vigente que publica la Cámara de Diputados.
> - **«Plazo legal» frente a «propuesta».** Un plazo legal sale de una ley citada. Una **propuesta** es
>   una decisión interna nuestra, razonada pero no exigida por ninguna ley; el fundador y el abogado
>   la confirman o la cambian.
> - **Datos que faltan** (se quedan visibles hasta tenerlos): [NOMBRE O RAZÓN SOCIAL DEL
>   RESPONSABLE], [RFC], [DOMICILIO PARA OÍR Y RECIBIR NOTIFICACIONES], [CORREO DE PRIVACIDAD],
>   [CORREO DE SOPORTE], [FECHA DE ÚLTIMA ACTUALIZACIÓN]. Para uso interno agregamos [RESPONSABLE
>   TÉCNICO], [ABOGADO EXTERNO], [CONTADOR] y [TELÉFONO DE GUARDIA].
> - **Código:** este documento no cambia código. Donde un procedimiento necesita trabajo técnico, lo
>   anotamos como tarea (2.13).

---

## 0. Resumen

| Sección                     | Qué deja listo                                                                                                                                                            | Bloquea abrir al público                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 2 · Conservación            | Plazo propuesto y fundamento para cada dato que guarda el sistema, qué pasa al vencer, cómo se borra una cuenta y qué hacer con los respaldos.                            | Sí: el aviso no debe publicar un plazo que el código no cumple.      |
| 3 · ARCO                    | Canal, plazos en días hábiles, verificación de identidad, cómo atender cada derecho a mano mientras no exista el centro de privacidad (SEC-26), registro y 11 plantillas. | Sí (SEC-26 y [1, arts. 29 y 31]).                                    |
| 4 · Vulneraciones           | Niveles, roles, línea de tiempo, pasos por tipo de incidente, aviso a las personas afectadas con el contenido mínimo del Reglamento y registro.                           | Sí: antes del primer despliegue público (plan §4.1).                 |
| 5 · Retiro de contenidos    | Flujos para derechos de autor (aviso y contra-aviso), titulares de marcas, órdenes del IMPI, violencia digital y solicitudes de autoridades, con plantillas.              | Sí para derechos de autor y marcas; el resto, antes del primer caso. |
| 6 · Encargados              | Registro de Vercel, Neon, Cloudflare R2, OpenRouter y el proveedor de correo, con lo que dice cada contrato y lo que falta frente al Reglamento.                          | Sí: contrato aceptado con cada encargado antes de usarlo.            |
| 7 · Pendientes del fundador | Entidad (SAS o persona física), RFC, marca en el IMPI, abogado y contador, con prioridad y semana.                                                                        | Parcial (ver prioridades).                                           |

**Cinco decisiones que el fundador debe tomar con el abogado** (el detalle está en la sección 8):

1. Periodo de **bloqueo** tras cancelar una cuenta: el Código de Comercio sugiere 10 años para
   contratos de comerciantes; la LFPC, 1 año para acciones del consumidor (2.1).
2. Plazo de conservación de la **actividad detallada** (propuesta: 180 días) y de la **bitácora de
   moderación** (propuesta: 2 años).
3. Cómo **verificar la identidad** en una solicitud ARCO sin pedir copias de identificación de más
   (3.6).
4. Si Estreno adopta un procedimiento de **aviso y retiro para marcas** aunque la ley no lo exija
   (5.4).
5. **SAS o persona física** como responsable durante el piloto (7.1).

---

## 1. Hechos del sistema que condicionan estos procedimientos (verificados en el código)

Lo que hace hoy el código respecto a conservar, borrar y entregar datos. Revisado el 2026-09-26.

| Tema                  | Lo que hay hoy                                                                                                                                                                                                                                                                                                                                                                                                                                    | Dónde                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Borrado y exportación | **No hay** borrado de cuenta (Better Auth `deleteUser` no está habilitado) ni exportación. Lo único borrable por la persona: historial de búsqueda, gustos declarados e intenciones de compra.                                                                                                                                                                                                                                                    | `server/auth.ts`, `identity/privacy-actions.ts`, `analytics/privacy.ts`                   |
| Tarea diaria          | Vercel Cron llama `/api/cron/daily` a las 09:00 UTC. Hace cuatro tareas de mantenimiento: vence checkouts sin pagar, borra fotos huérfanas (sin adjuntar tras 24 h), redacta entradas de IA de más de 90 días y borra fotos y simulaciones de «Pruébatelo» vencidas (30 días).                                                                                                                                                                    | `vercel.json`, `ceo/scheduled.ts`, `media/orphans.ts`, `ai/retention.ts`                  |
| Sesiones              | Duran 30 días y se renuevan cada día. Cada fila guarda **IP y navegador** (`ipAddress`, `userAgent`). No encontramos una limpieza de sesiones vencidas en nuestro código **[VERIFICAR técnico: si Better Auth las borra sola]**.                                                                                                                                                                                                                  | `server/auth.ts`, `schema.prisma` (`Session`)                                             |
| Límites de frecuencia | Cubetas con llave por IP en claro, por cuenta o por correo en hash (SHA-256). Ventanas de 1 minuto a 7 días (el código no admite más). Se borran al vencer, a lo más una vez por minuto por proceso. La tabla de Better Auth (`rate_limits`) se limpia sola con su ventana de 60 s.                                                                                                                                                               | `server/rate-limit.ts`, `analytics/integrity.ts`, `schema.prisma`                         |
| Actividad             | `AnalyticsEvent` **no tiene llave foránea** a la cuenta. Al desactivar la personalización, toda la actividad previa se desliga (id nuevo, hora truncada, sin búsqueda). **No hay plazo máximo**: los eventos no se borran.                                                                                                                                                                                                                        | `analytics/privacy.ts`; aviso actual                                                      |
| IA                    | La entrada se guarda sin contactos y se redacta a los 90 días (`{ redacted: true }`); la fila se queda por el costo. La **salida** (`AIResponse.output`) no tiene plazo.                                                                                                                                                                                                                                                                          | `ai/retention.ts`, `schema.prisma`                                                        |
| Pedidos               | `Order.shippingAddress` guarda una copia de nombre, teléfono y domicilio. Se borra al cancelarse o vencer el pedido, y con pago simulado el vendedor no la ve (SEC-08 corregido); después de la entrega no tiene plazo. Si se borrara la cuenta del comprador, sus pedidos se borrarían en cascada (`onDelete: Cascade`); la cuenta de un vendedor con pedidos no se puede borrar (`Restrict`). Hoy los pagos son simulados y la comisión es 0 %. | `commerce/checkout.ts`, `commerce/seller-order-dto.ts`, `schema.prisma`, ADR-032, ADR-033 |
| Comprobantes          | Fotos privadas (vendedor y equipo). Se conservan las vigentes y las reemplazadas mientras exista el producto; al borrarse el producto, su historial se borra en cascada y las fotos quedan huérfanas y se borran en la tarea diaria.                                                                                                                                                                                                              | `trust/README.md`, `media/orphans.ts`                                                     |
| Moderación            | Cada acción del equipo queda en `PlatformDecision` (`kind` `moderation.*` o `authenticity.*`) con quién, cuándo, antes, después y la nota. Los reportes quedan sin autor si se borra su cuenta. **Sin plazo de conservación.**                                                                                                                                                                                                                    | `trust/service.ts`, `schema.prisma` (`Report`)                                            |
| Mensajes directos     | **No existen.** Hay comentarios públicos en publicaciones.                                                                                                                                                                                                                                                                                                                                                                                        | `schema.prisma`                                                                           |
| Respaldos             | Aún no hay (plan: respaldo gestionado de Neon, `pg_dump` semanal cifrado y simulacro mensual de restauración).                                                                                                                                                                                                                                                                                                                                    | `plan-90-dias.md` §2.1                                                                    |
| Regiones              | Funciones de Vercel en `iad1`, que Vercel ubica en Washington, D.C., EE. UU. [17]. La base de ejemplo de `.env.example` está en `us-east-1` de AWS **[VERIFICAR en la consola de Neon]**. El bucket de R2 aún no existe.                                                                                                                                                                                                                          | `vercel.json`, `.env.example`                                                             |

---

## 2. (a) Calendario de conservación

### 2.1 Reglas legales que usamos

- **Suprimir lo que ya no se necesita.** Cuando los datos dejan de ser necesarios para las
  finalidades del aviso, se suprimen, previo bloqueo en su caso, al concluir su plazo de conservación
  [1, art. 10 párr. 2].
- **72 meses como máximo** para los datos sobre incumplimiento de obligaciones contractuales,
  contados desde el incumplimiento [1, art. 10 párr. 3]. Aplica a sanciones por violar los términos
  **[VERIFICAR CON ABOGADO]**.
- **Cancelación y bloqueo.** La cancelación abre un periodo de bloqueo «equivalente al plazo de
  prescripción de las acciones derivadas de la relación jurídica». Después se suprime el dato y se
  avisa a la persona. Si los datos se transmitieron a terceros, hay que comunicarles la cancelación
  [1, art. 24]. El bloqueo impide todo tratamiento salvo el almacenamiento [2, art. 108].
- **Casos en que no se cancela:** contrato vigente, disposición legal, actuaciones judiciales o
  administrativas, entre otros [1, art. 25].
- **Documentar los plazos y poder probarlos.** El responsable establece y documenta los plazos de
  conservación, bloqueo y supresión, y le toca demostrar que los cumple [2, arts. 37–39]. Este
  documento es ese procedimiento, una vez aprobado.
- **Plazos de otras leyes que pueden fijar el bloqueo o la conservación:**
  - contabilidad y documentación fiscal: **5 años** [8, art. 30];
  - comerciantes: comprobantes de sus operaciones, libros y registros, y mensajes de datos con
    contratos: **10 años** [9, arts. 38, 46 y 49];
  - prescripción ordinaria mercantil: **10 años** [9, art. 1047]; civil: **10 años** [10, art. 1159];
  - reparación de daños (responsabilidad extracontractual): **2 años** [10, art. 1934];
  - derechos y obligaciones de la LFPC: **1 año**, salvo otros términos de esa ley [3, art. 14];
  - daños por infracciones de propiedad industrial: **2 años** desde que el IMPI declara la infracción
    [5, art. 399].

  **Cuál aplica a cada dato de Estreno es la pregunta principal para el abogado.** Depende de si
  Estreno es «comerciante» y de si su relación con quien usa la plataforma es de consumo, civil o
  mercantil **[VERIFICAR CON ABOGADO]**.

### 2.2 Cómo leer las tablas

- **Hoy:** lo que hace el código el 2026-09-26.
- **Plazo propuesto:** cuánto se conserva, y desde cuándo se cuenta. Si no hay ley detrás, dice
  «propuesta».
- **Al vencer:**
  - **suprimir**: borrar de la base, del almacenamiento de fotos y, por rotación, de los respaldos;
  - **anonimizar**: quitar todo lo que liga el registro a una persona, de forma que no se pueda
    revertir;
  - **bloquear**: sacar el dato de todo uso; solo lo guarda el responsable para defenderse o para
    cumplir una ley, con acceso registrado (2.11).
- **Retención legal** (_legal hold_): si hay una orden de autoridad, un procedimiento o una
  controversia abierta, se suspende el borrado de los datos afectados hasta que termine (2.14).

### 2.3 Cuenta e identidad

| Dato (tabla)                                                                     | Hoy                                                        | Plazo propuesto                                                                                                                                                                                                                                             | Al vencer                       | Fundamento                                                                     |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------ |
| Cuenta: nombre, correo, hash de contraseña (`users`, `accounts`)                 | Sin borrado                                                | Mientras exista la cuenta. **Opcional (decisión del fundador):** 24 meses sin iniciar sesión → aviso por correo → 30 días → cancelación.                                                                                                                    | Cancelación con bloqueo (2.11)  | [1, arts. 10 y 24]; propuesta                                                  |
| Perfil: usuario, nombre visible, biografía, ciudad, foto, objetivos (`profiles`) | Sin borrado                                                | Mientras exista la cuenta                                                                                                                                                                                                                                   | Suprimir                        | [1, art. 10]                                                                   |
| Sesiones: IP y navegador (`sessions`)                                            | Vencen a los 30 días sin uso; no confirmamos que se borren | Hasta que venzan o se cierren, más **7 días** (propuesta, para investigar abusos)                                                                                                                                                                           | Suprimir con tarea diaria       | Minimización [1, art. 12]; propuesta                                           |
| Tokens de verificación (`verifications`)                                         | Tienen `expiresAt`                                         | Hasta su vencimiento + 1 día (propuesta)                                                                                                                                                                                                                    | Suprimir                        | Propuesta                                                                      |
| Consentimientos y aceptaciones (`user_consents`)                                 | Historial inmutable; se borraría con la cuenta (cascada)   | Mientras exista la cuenta. Al cancelarla: conservar solo la prueba de aceptación de términos y aviso (tipo, versión, fecha, un hash del correo), **bloqueada**, durante el plazo que fije el abogado: **10 años** si aplica el Código de Comercio, o menos. | Suprimir al terminar el bloqueo | [9, arts. 49 y 1047]; [3, art. 14]; [1, art. 24] **[VERIFICAR CON ABOGADO]**   |
| Gustos declarados y comunidades (`user_interests`, `community_memberships`)      | Borrables por la persona (gustos); cascada con la cuenta   | Mientras exista la cuenta o hasta que la persona los borre                                                                                                                                                                                                  | Suprimir                        | [1, arts. 10 y 24]                                                             |
| Intenciones de compra con presupuesto opcional (`shopping_intents`)              | Borrables por la persona; tienen estado y vencimiento      | Activas: hasta que la persona las borre o venzan. Vencidas, cumplidas o descartadas: **90 días** más (propuesta).                                                                                                                                           | Suprimir                        | Minimización [1, art. 12]; el presupuesto puede ser dato patrimonial [00 §2.3] |
| Seguidos, me gusta, guardados, sugerencias quitadas                              | Cascada con la cuenta                                      | Mientras exista la cuenta o hasta que la persona los quite                                                                                                                                                                                                  | Suprimir                        | [1, art. 10]                                                                   |
| Rol de equipo (`profiles.role`)                                                  | Solo lo cambia `scripts/make-admin.ts`                     | Mientras la persona sea del equipo; bitácora de cambios de rol pendiente (admin/README)                                                                                                                                                                     | Quitar el rol el día que sale   | Seguridad [1, art. 18]                                                         |

### 2.4 Contenido, fotos y catálogo

| Dato (tabla)                                                       | Hoy                                                                                        | Plazo propuesto                                                                                                                                                                                | Al vencer                                                                               | Fundamento                                                                                   |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Publicaciones y comentarios publicados (`posts`, `comments`)       | Sin borrado por la persona (SEC-26)                                                        | Mientras la persona no los borre y tenga la cuenta. Borrados por la persona: suprimir en **30 días** (propuesta).                                                                              | Suprimir                                                                                | [1, arts. 10 y 24]                                                                           |
| Contenido ocultado o retirado por moderación (`HIDDEN`, `REMOVED`) | Se conserva sin plazo                                                                      | **2 años** desde la decisión (propuesta), o lo que dure una retención legal                                                                                                                    | Suprimir                                                                                | Defensa ante reclamaciones: [10, art. 1934]; [5, art. 399] **[VERIFICAR CON ABOGADO]**       |
| Fotos en el almacenamiento (`media` + objetos en R2)               | Huérfanas: 24 h. Si se borra la fila por cascada, **el archivo puede quedar** en el bucket | Siguen a su publicación o producto. Archivo sin fila en la base: suprimir en **30 días** (barrido; propuesta).                                                                                 | Suprimir el archivo y sus variantes                                                     | [1, art. 10]; [2, art. 37]                                                                   |
| Productos (`products`, `product_media`)                            | Un producto con pedidos no se puede borrar (`Restrict`)                                    | Activos o pausados: mientras el vendedor los mantenga. Archivados sin pedidos: **12 meses** (propuesta). Con pedidos: los datos mínimos del producto, mientras se conserven sus pedidos (2.5). | Suprimir; con pedidos, conservar título y precio en el pedido (ya se copian al comprar) | [1, art. 10]                                                                                 |
| Costo privado (`product_costs`; `order_items.unitCostCents`)       | Nunca sale al navegador                                                                    | Mientras exista el producto; en pedidos, mientras exista la cuenta del vendedor. Al cancelar la cuenta del vendedor: poner el costo en cero en sus pedidos (propuesta).                        | Suprimir o poner en cero                                                                | Posible dato patrimonial del vendedor persona física [1, art. 7] **[VERIFICAR CON ABOGADO]** |
| Perfil de vendedor (`seller_profiles`)                             | Métodos de pago aceptados, ciudad, estado; `SUSPENDED` si se suspende                      | Mientras exista la cuenta. El motivo de una suspensión por violar los términos: **72 meses como máximo** desde el incumplimiento.                                                              | Suprimir el motivo; conservar solo el dato de que existió, si el abogado lo permite     | [1, art. 10 párr. 3]                                                                         |

### 2.5 Comercio: carrito, domicilios y pedidos

Hoy la plataforma no cobra ni retiene dinero y el pago es directo al vendedor (ADR-033). Los pedidos
no son contabilidad de Estreno mientras la comisión sea 0 % **[VERIFICAR CON CONTADOR]**.

| Dato (tabla)                                                                                       | Hoy                                                                                 | Plazo propuesto                                                                                                                                                                                                                                       | Al vencer                                              | Fundamento                                                                                                 |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Carrito (`carts`, `cart_items`)                                                                    | Cascada con la cuenta                                                               | Mientras exista la cuenta; vaciar un carrito sin cambios en **180 días** (propuesta)                                                                                                                                                                  | Suprimir                                               | Minimización [1, art. 12]                                                                                  |
| Domicilios guardados (`addresses`: nombre, teléfono, domicilio)                                    | Sin borrado por la persona                                                          | Mientras la persona los tenga guardados                                                                                                                                                                                                               | Suprimir                                               | [1, arts. 10 y 24]                                                                                         |
| Copia del domicilio en el pedido (`orders.shippingAddress`)                                        | Se borra al cancelarse o vencer el pedido (SEC-08); sin plazo después de la entrega | Cancelado o vencido: ya se borra. Entregado: **90 días** después de la entrega (propuesta: cubre la garantía mínima de 90 días desde la entrega, si se ofrece [3, art. 77], y la atención de quejas del botón «Tengo un problema» que prevé el plan). | Suprimir la copia; el pedido se queda sin domicilio    | [1, arts. 10 y 12]; [3, art. 77] **[VERIFICAR CON ABOGADO]**                                               |
| Pedido sin datos de contacto (`orders`, `order_items`: productos, montos, fechas, estado, cuentas) | Se borraría con la cuenta del comprador (cascada)                                   | **5 años** desde el pedido (propuesta). Cubre la prescripción de 1 año de la LFPC y deja margen por si el SAT o un cobro futuro lo vuelven documentación fiscal.                                                                                      | Anonimizar (quitar la cuenta del comprador) o suprimir | [3, art. 14]; [8, art. 30]; si Estreno es comerciante, [9, art. 38] **[VERIFICAR CON ABOGADO Y CONTADOR]** |
| Checkouts y pagos (`checkouts`, `payments`, `payment_events`)                                      | Simulados; los checkouts sin pagar vencen solos                                     | Mismo plazo que el pedido. Cuando haya pagos reales: el que fije el contador (5 años fiscales o 10 mercantiles).                                                                                                                                      | Suprimir                                               | [8, art. 30]; [9, arts. 38 y 46] **[VERIFICAR CON CONTADOR]**                                              |

### 2.6 Actividad y analítica

La analítica es solo propia y no hay rastreadores de terceros [00 §1]. Las cifras agregadas
(`daily_metrics`) no identifican a nadie y permiten borrar el detalle sin perder la historia.

| Dato (tabla)                                                                                                                                                              | Hoy                                                                           | Plazo propuesto                                                  | Al vencer | Fundamento                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------- | --------------------------------------------- |
| Eventos ligados a una persona: impresiones servidas y visibles, clics, me gusta, guardados, visitas, carrito, exposición a experimentos (`analytics_events` con `userId`) | Sin plazo; se desligan al desactivar la personalización                       | **180 días** (propuesta que ya aparece en el borrador del aviso) | Suprimir  | [1, arts. 10 y 12]; [2, art. 37]              |
| Búsquedas con su texto (`SEARCH` con `query`)                                                                                                                             | Hasta que la persona las borre o desactive la personalización                 | **90 días** (propuesta; alimentan «Porque buscaste…»)            | Suprimir  | Minimización [1, art. 12]                     |
| Eventos anónimos (sin persona, hora truncada)                                                                                                                             | Sin plazo                                                                     | **180 días** (propuesta)                                         | Suprimir  | [2, art. 37]                                  |
| Cifras diarias, experimentos y decisiones del motor (`daily_metrics`, `experiments`, `platform_decisions` que no son de moderación)                                       | Sin plazo; no guardan datos de personas (solo la cuenta del ADMIN que aprobó) | Sin plazo, con revisión anual                                    | —         | No son datos personales, salvo `approvedById` |
| Asignación a experimentos                                                                                                                                                 | No se guarda: se calcula con un hash de la cuenta                             | —                                                                | —         | —                                             |

**Cuidado con los experimentos.** Un experimento puede necesitar más de 180 días de datos. En ese
caso, la cifra por variante ya queda en `daily_metrics` (dimensión `variant:…`); el evento crudo no
hace falta.

### 2.7 Inteligencia artificial

| Dato (tabla)                                                                                                                              | Hoy                                                                                                                                | Plazo propuesto                                                                                                                                                                                                                        | Al vencer                                        | Fundamento                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Entrada de «Sube y vende» y del kit de anuncios (`ai_requests.input`)                                                                     | 90 días y después `{ redacted: true }` (tarea diaria)                                                                              | **90 días** (se mantiene)                                                                                                                                                                                                              | Redactar; la fila queda para el costo            | [1, arts. 10 y 12]; ADR-031                                                                                      |
| Salida generada (`ai_responses.output`)                                                                                                   | Sin plazo                                                                                                                          | **90 días** para lo que no se convirtió en producto (propuesta); lo que el vendedor publicó ya es su contenido y sigue su plazo (2.4). El borrador `01` §11 dice «mientras tengas la cuenta»: si se aprueba esta propuesta, cambiarlo. | Redactar el texto; conservar tokens y costo      | [1, art. 12]                                                                                                     |
| Costo de IA por solicitud (`ai_responses` sin texto; `platform_ledger_entries` `AI_COST`)                                                 | Sin plazo; la cuenta se desliga si se borra (`SetNull`)                                                                            | Mismo plazo que la contabilidad (2.8)                                                                                                                                                                                                  | Suprimir                                         | [8, art. 30] **[VERIFICAR CON CONTADOR]**                                                                        |
| Señal de IA de autenticidad (`authenticity_checks.aiSignal`)                                                                              | Mientras exista el producto                                                                                                        | Mientras exista el producto                                                                                                                                                                                                            | Suprimir con el producto                         | [1, art. 10]                                                                                                     |
| Evaluaciones de modelos (`ai_eval_runs`, `evals/*.jsonl`)                                                                                 | Casos ficticios                                                                                                                    | Sin plazo                                                                                                                                                                                                                              | —                                                | No son datos personales; si algún día se usan textos reales, es finalidad nueva [00 §2.3]                        |
| Foto de la persona para «Pruébatelo» (`try_on_photos` + `media`) y cada simulación (`try_on_results.resultMediaId`) — agregado 2026-09-29 | 30 días (`expiresAt`); paso `tryon-retention` de la tarea diaria; borrable antes desde Ajustes                                     | **30 días** (se mantiene); el registro de la solicitud (fecha, modelo, costo, productos) sin la imagen se queda para el costo                                                                                                          | Suprimir filas y archivos (original y variantes) | [1, arts. 10 y 12]; consentimiento expreso (`TRY_ON_PHOTOS`); ADR-045 **[VERIFICAR CON ABOGADO: dato sensible]** |
| Copias en OpenRouter y en el proveedor del modelo                                                                                         | El adaptador pide `data_collection: "deny"` y, desde un cambio del 2026-09-26 aún sin commit, `zdr: true` (`openai-compatible.ts`) | Ninguna: con retención cero (ZDR), OpenRouter no guarda la carga útil después de la respuesta [24]                                                                                                                                     | —                                                | [2, art. 50 fr. V]; [24]                                                                                         |

### 2.8 Confianza, moderación y cumplimiento

| Dato (tabla)                                                                                                      | Hoy                         | Plazo propuesto                                                                                                                                                                                       | Al vencer                                                                    | Fundamento                                                                       |
| ----------------------------------------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Reportes abiertos (`reports` `OPEN`)                                                                              | Sin plazo                   | Hasta resolverse                                                                                                                                                                                      | Pasan a la fila siguiente                                                    | —                                                                                |
| Reportes descartados (`DISMISSED`)                                                                                | Sin plazo                   | **6 meses** desde la resolución (propuesta)                                                                                                                                                           | Suprimir el texto libre y quién reportó; conservar el conteo                 | [1, art. 12]                                                                     |
| Reportes con acción (`ACTIONED`) y bitácora de moderación (`platform_decisions` `moderation.*`, `authenticity.*`) | Sin plazo                   | **2 años** desde la decisión (propuesta). Si documenta una sanción por violar los términos: nunca más de **72 meses**. Con orden de autoridad o procedimiento abierto: hasta que termine, más 2 años. | Anonimizar: quitar título, nota y cuentas; conservar tipo, fecha y resultado | [10, art. 1934]; [5, art. 399]; [1, art. 10 párr. 3] **[VERIFICAR CON ABOGADO]** |
| Comprobante vigente (`authenticity_checks.proofMediaIds` + fotos)                                                 | Mientras exista el producto | Mientras el producto muestre «Comprobante revisado» o siga en revisión                                                                                                                                | Suprimir las fotos                                                           | [1, arts. 7 y 12]; los tickets pueden traer datos financieros [00 §2.3]          |
| Comprobantes reemplazados (`authenticity_proof_history` + fotos)                                                  | Mientras exista el producto | **12 meses** desde que se reemplazaron (propuesta)                                                                                                                                                    | Suprimir fila y fotos                                                        | [1, art. 12]; [2, art. 37]                                                       |
| Revisión de autenticidad (`authenticity_checks`)                                                                  | Una fila por producto       | Mientras exista el producto                                                                                                                                                                           | Suprimir con el producto                                                     | [1, art. 10]                                                                     |
| Registro de solicitudes ARCO (nuevo, 3.10)                                                                        | No existe                   | **2 años** desde que se cierra la solicitud (propuesta). Copias de identificación: **30 días** desde el cierre.                                                                                       | Suprimir                                                                     | Prueba de cumplimiento [2, art. 39]; procedimiento ante la SABG [1, arts. 40–42] |
| Registro de vulneraciones (nuevo, 4.9)                                                                            | No existe                   | **5 años** (propuesta), sin datos de personas afectadas más allá de conteos y categorías                                                                                                              | Suprimir                                                                     | [2, arts. 62 y 66]                                                               |
| Registro de avisos de retiro y solicitudes de autoridades (nuevo, 5.2)                                            | No existe                   | Hasta que termine el procedimiento, más **2 años** (propuesta)                                                                                                                                        | Suprimir                                                                     | [4, art. 114 Octies]; [5, art. 399]                                              |

### 2.9 Operación, seguridad y contabilidad

| Dato                                                                   | Hoy                                                         | Plazo propuesto                                                                                                                        | Al vencer              | Fundamento                                                    |
| ---------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------- |
| Cubetas de límites de frecuencia (`rate_limit_buckets`, `rate_limits`) | Se borran al vencer (ventana máxima de 7 días en el código) | Igual que hoy                                                                                                                          | Suprimir               | Seguridad [1, art. 18]                                        |
| Bitácora de tareas (`job_runs`)                                        | Sin datos personales                                        | **1 año** (propuesta)                                                                                                                  | Suprimir               | —                                                             |
| Libro de la plataforma (`platform_ledger_entries`)                     | Costos de IA e infraestructura                              | **5 años** (fiscal) o **10 años** si Estreno es comerciante                                                                            | Suprimir               | [8, art. 30]; [9, arts. 38 y 46] **[VERIFICAR CON CONTADOR]** |
| Registros de ejecución de Vercel (ruta, parámetros, navegador, estado) | Plan Pro: 1 día; con Observability Plus: 30 días [18]       | Lo que da el plan Pro, sin Observability Plus salvo necesidad. **Regla:** nunca escribir datos personales en `console.*` ni en la URL. | Los borra Vercel       | [18]; minimización [1, art. 12]                               |
| Registros del proveedor de correo                                      | Sin proveedor                                               | El que fije su contrato **[VERIFICAR al contratar]**                                                                                   | Los borra el proveedor | [23]                                                          |

### 2.10 Navegador

| Mecanismo                                               | Duración                                           | Nota                              |
| ------------------------------------------------------- | -------------------------------------------------- | --------------------------------- |
| Cookies de sesión de Better Auth (prefijo `vendeia`)    | Hasta 30 días sin uso                              | Técnicamente necesarias [00 §2.6] |
| `vendeia_bienvenida`                                    | 10 minutos                                         | Solo muestra la bienvenida        |
| Tema (`localStorage`, next-themes)                      | Hasta que la persona borre los datos del navegador | No se envía al servidor           |
| «Ocultar» del aviso y de sugerencias (`sessionStorage`) | Hasta cerrar la pestaña                            | No se envía al servidor           |

### 2.11 Cancelación de una cuenta: secuencia propuesta (para construir SEC-26)

Mientras no exista el centro de privacidad, esta secuencia se hace **a mano** con la base de datos,
en respuesta a una solicitud ARCO (3.7). Después se automatiza. El orden importa por las llaves
foráneas del esquema (sección 1).

1. **Confirmar identidad y alcance** (3.6): ¿toda la cuenta o solo algunos datos? [2, art. 106].
2. **Revisar excepciones** [1, art. 25]: pedidos en curso, una controversia abierta, una orden de
   autoridad o una retención legal (2.14). Si hay una, se responde con negativa parcial (3.8).
3. **Cortar el acceso de inmediato:** cerrar todas las sesiones y ocultar perfil, publicaciones y
   productos.
4. **Dentro de los 15 días hábiles** siguientes a la respuesta [1, art. 31]:
   - suprimir perfil, gustos, intenciones, seguidos, me gusta, guardados, membresías, carrito,
     domicilios, publicaciones, comentarios y sus fotos (fila **y archivo** en R2);
   - analítica: desligar con `anonymizeUserActivity` y suprimir los eventos ligados que queden;
   - IA: la cuenta ya se desliga de `ai_requests` (`SetNull`); redactar entradas y salidas;
   - reportes hechos por la persona: quedan sin autor (ya ocurre);
   - **pedidos:** no borrarlos en cascada. Quitar la cuenta del comprador y la copia del domicilio, y
     conservar el pedido anónimo durante su plazo (2.5). Hoy el esquema los borraría: hay que
     cambiar ese comportamiento antes de habilitar el borrado (2.13);
   - **vendedor con pedidos:** archivar sus productos y anonimizar su perfil, porque el esquema no
     permite borrarlo (`Restrict`);
   - consentimientos: dejar solo la prueba de aceptación, bloqueada (2.3).
5. **Avisar a terceros que recibieron los datos** [1, art. 24 párr. 4]: los vendedores que
   recibieron nombre, domicilio o teléfono del comprador en un pedido reciben la plantilla P11 (3.11).
   Pedir a los encargados que borren lo que tengan (sección 6).
6. **Respaldos:** los datos borrados salen de los respaldos por rotación (2.12). Si se restaura un
   respaldo, se vuelven a aplicar las supresiones.
7. **Confirmar a la persona** (plantilla P6) y, al terminar el bloqueo, avisarle de la supresión
   (plantilla P7) [1, art. 24 párr. 3].

**Cómo bloquear sin herramientas nuevas (propuesta técnica).** Mover lo bloqueado a un esquema o
tabla aparte, sin acceso desde la app, con quién y por qué lo consultó. El bloqueo solo permite el
almacenamiento [2, art. 108].

### 2.12 Respaldos y restauraciones

- **Historial de Neon (restauración a un punto en el tiempo):** en el plan Launch, 1 día por omisión
  y 7 como máximo; en Scale, hasta 30 días [20]. **Propuesta:** 7 días.
- **Copia semanal cifrada con `pg_dump`** (plan §2.1). **Propuesta:** conservar 5 copias (unas 5
  semanas) y borrar la más vieja cada semana.
- **Consecuencia:** un dato suprimido puede seguir hasta unas 5 semanas en una copia cifrada que
  nadie consulta. La respuesta ARCO lo dice así (plantillas P6 y P7).
- **Restaurar no revive borrados:** se guarda una lista mínima de supresiones hechas (ids, sin otros
  datos) y se vuelve a aplicar después de cualquier restauración.
- **R2:** sin versiones de objetos (propuesta). Si se activan, fijar su plazo.
- Neon cobra el historial como almacenamiento [20]; ver el costo en `plan-90-dias.md` §6.1.

### 2.13 Trabajo técnico para cumplir los plazos

El borrador del aviso ya sigue la regla correcta: **no publicar un plazo que el código no cumple**.
Por eso, antes de poner cualquier plazo de esta sección en el aviso, hay que construirlo. Por
prioridad:

| #   | Tarea                                                                                                      | Plazo que habilita | Prioridad                                  |
| --- | ---------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------ |
| T1  | Suprimir `shippingAddress` a los 90 días de entregado el pedido (al cancelar o vencer ya se borra)         | 2.5                | Antes de pedidos reales                    |
| T2  | Tarea diaria: suprimir eventos de más de 180 días y búsquedas de más de 90                                 | 2.6                | Antes de abrir                             |
| T3  | Tarea diaria: suprimir sesiones vencidas (+7 días) y tokens vencidos                                       | 2.3                | Antes de abrir                             |
| T4  | Redactar `ai_responses.output` a los 90 días, igual que la entrada                                         | 2.7                | Antes de la IA real                        |
| T5  | Comprobantes reemplazados: suprimir a los 12 meses (fila y archivo)                                        | 2.8                | Antes de pedir comprobantes a desconocidos |
| T6  | Moderación: anonimizar a los 2 años; reportes descartados a los 6 meses                                    | 2.8                | Antes de abrir                             |
| T7  | Barrido de R2: archivos sin fila en `media` de más de 30 días                                              | 2.4                | Antes de habilitar borrados                |
| T8  | Borrado de cuenta (SEC-26) con la secuencia de 2.11; cambiar la cascada de `Order.buyer` por anonimización | 2.11               | Antes de abrir                             |
| T9  | Exportación de datos para el derecho de acceso (DTO sin hash de contraseña ni secretos)                    | 3.7                | Antes de abrir (manual mientras tanto)     |
| T10 | Lista de supresiones para reaplicar tras restaurar un respaldo                                             | 2.12               | Con los respaldos                          |

Cada tarea nueva va en la tarea diaria existente (`ceo/scheduled.ts`) y deja conteos en `JobRun`,
sin datos personales. Así queda la prueba de cumplimiento [2, art. 39].

### 2.14 Retención legal

- **Cuándo:** orden de autoridad (5.5 a 5.7), procedimiento ante la SABG, el IMPI o la PROFECO,
  controversia judicial o una vulneración en investigación (4).
- **Qué hace:** suspende el borrado automático de los datos afectados. Se anota en el registro de 5.2
  con el motivo, el alcance y la fecha de revisión.
- **Fin:** al cerrar el asunto, los datos siguen su plazo normal; si ya venció, se suprimen.

### 2.15 Revisión

El responsable revisa este calendario **una vez al año** y cada vez que se agregue un dato, una
finalidad o un encargado. Un cambio que afecte el aviso sube `LEGAL_VERSIONS.privacyNotice`.

---

## 3. (b) Procedimiento ARCO (acceso, rectificación, cancelación y oposición)

### 3.1 Marco

- **Derechos:** acceso [1, art. 22], rectificación [1, art. 23], cancelación [1, arts. 24–25] y
  oposición [1, art. 26], más la revocación del consentimiento [1, art. 7]. Ejercer uno no impide
  ejercer otro [1, art. 21].
- **Quién puede pedirlos:** la persona o su representante legal [1, arts. 21 y 27].
- **Contenido de la solicitud** [1, art. 28]:
  - nombre y domicilio o medio para recibir notificaciones;
  - documentos que acrediten la identidad (o la representación);
  - descripción de los datos (salvo en el acceso);
  - el derecho que se ejerce;
  - lo que ayude a localizar los datos.
- **Plazos:** 20 días para responder y 15 para hacer efectiva la respuesta procedente; cada uno se
  puede ampliar **una vez** por un periodo igual si se justifica [1, art. 31]. Son **días hábiles**
  [1, art. 2 fr. VIII].
- **Gratuidad:** solo se cobran reproducción, copias o envío. Si la misma persona repite la
  solicitud en menos de 12 meses, el cobro no pasa de 3 UMA (≈ $351.93 con la UMA 2026 de $117.31
  [13]), salvo cambios sustanciales al aviso [1, art. 34]. **Propuesta:** no cobrar nada en el
  piloto.
- **Persona o departamento de datos:** todo responsable designa uno que tramite las solicitudes
  [1, art. 29].
- **Reglamento de 2011** (supletorio mientras no haya uno nuevo **[VERIFICAR CON ABOGADO]**, ver
  [00 §2.1]): acreditación de identidad, medios, requerimientos, ampliaciones, negativas, bloqueo
  [2, arts. 87–110]. **Ojo:** sus remisiones usan la numeración de la ley de 2010. Por ejemplo, donde
  dice «artículo 32 de la Ley» (plazos), en la ley de 2025 es el art. 31. Las equivalencias de este
  documento son nuestras **[VERIFICAR CON ABOGADO]**.
- **Qué calendario de días hábiles usar** (inhábiles oficiales, vacaciones de la SABG):
  **[VERIFICAR CON ABOGADO]**. Mientras tanto: lunes a viernes, sin días de descanso obligatorio.

### 3.2 Quién lo atiende

- **Persona de datos personales** [1, art. 29]: [NOMBRE O RAZÓN SOCIAL DEL RESPONSABLE] (en el
  piloto, el fundador). Suplente: [RESPONSABLE TÉCNICO].
- Solo ellos consultan o modifican datos por una solicitud ARCO, con una cuenta ADMIN y dejando
  rastro en el registro (3.10).
- **El abogado** revisa toda negativa, toda solicitud de un representante y toda solicitud que venga
  con amenaza de queja o demanda.

### 3.3 Canales

- **Correo:** [CORREO DE PRIVACIDAD]. Es el canal principal y debe aparecer en el aviso [1, art. 15
  fr. V].
- **Dentro de la app:** un formulario en Ajustes cuando exista (el Reglamento permite formularios y
  métodos simplificados, si se informan en el aviso [2, art. 90]).
- **Por escrito:** [DOMICILIO PARA OÍR Y RECIBIR NOTIFICACIONES].
- **Atención general:** una solicitud ARCO que llegue por [CORREO DE SOPORTE] o, cuando exista, por
  el botón «Tengo un problema» se atiende igual, con los mismos plazos [2, art. 91]. Quien la recibe
  la pasa a [CORREO DE PRIVACIDAD] el mismo día.
- Ningún canal puede tener costo si es el único [2, art. 93].

### 3.4 Plazos

| Paso                                                  | Plazo                                                                                                         | Fundamento                                     |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Acuse con la fecha de recepción                       | El mismo día hábil (propuesta)                                                                                | El plazo corre desde la recepción [2, art. 95] |
| Pedir información o documentos que faltan             | Una sola vez, dentro de **5 días hábiles** desde la recepción                                                 | [2, art. 96]                                   |
| La persona contesta el requerimiento                  | **10 días hábiles**; si no contesta, la solicitud se tiene por no presentada                                  | [2, art. 96]                                   |
| Solicitud sin medio para notificar                    | Se tiene por no presentada, dejando constancia                                                                | [2, art. 94]                                   |
| Comunicar la respuesta                                | **20 días hábiles** desde la recepción (o desde que se contestó el requerimiento)                             | [1, art. 31]; [2, art. 96]                     |
| Hacer efectiva la respuesta procedente                | **15 días hábiles** desde que se comunica                                                                     | [1, art. 31]                                   |
| Ampliar un plazo                                      | Una vez, por un periodo igual, con justificación notificada **dentro** del plazo original                     | [1, art. 31]; [2, art. 97]                     |
| **Meta interna**                                      | Responder en **10 días hábiles** y ejecutar en **5**                                                          | Propuesta                                      |
| Si la persona no queda conforme o no recibe respuesta | Puede pedir protección a la SABG dentro de los 15 días siguientes a la respuesta, o desde que venció el plazo | [1, art. 40]                                   |
| La SABG da traslado a Estreno                         | **15 días** para responder, ofrecer pruebas y manifestar lo que convenga; **5** para alegatos                 | [1, art. 40]                                   |
| Resolución de la SABG                                 | **50 días**, ampliable una vez                                                                                | [1, art. 42]                                   |

### 3.5 Paso a paso

1. **Recibir y registrar.** Abrir un folio en el registro (3.10) y mandar el acuse (plantilla P1).
2. **Revisar que esté completa** [1, art. 28]. Si falta algo, mandar un solo requerimiento
   (plantilla P2) dentro de 5 días hábiles.
3. **Verificar la identidad** (3.6). Sin verificar no se entrega ni se cambia nada [1, art. 31;
   1, art. 33 fr. I].
4. **Buscar los datos** en todas las tablas de la sección 2, en el almacenamiento de fotos y, si
   aplica, en los encargados (sección 6). Anotar dónde se buscó.
5. **Decidir** si procede, procede en parte o no procede (3.8). Si hay duda, consultar al abogado
   antes del día 10.
6. **Responder** por el mismo medio de la solicitud [1, art. 33], con la plantilla que corresponda.
   Si se niega, decir el motivo y el derecho a acudir a la SABG [2, art. 100].
7. **Ejecutar** dentro de 15 días hábiles y confirmar.
8. **Cerrar el folio** con fechas, resultado y evidencia. Borrar copias de identificación a los 30
   días (2.8).

### 3.6 Verificación de identidad

La ley pide «documentos que acrediten la identidad» [1, art. 28 fr. II]. El Reglamento acepta
también medios electrónicos que identifiquen «fehacientemente» a la persona o mecanismos de
autenticación ya establecidos por el responsable [2, art. 89 fr. I]. Si la solicitud llega por un
canal de atención, la identidad se acredita con los medios que el responsable usa para identificar
a sus clientes, siempre que la garanticen [2, art. 91].

**Propuesta para Estreno** (minimiza datos; **[VERIFICAR CON ABOGADO]** que basta):

| Caso                                                                        | Cómo se verifica                                                                                                                                                                                          |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La solicitud llega desde la app con sesión iniciada                         | Sesión válida, más volver a pedir la contraseña para exportar o cancelar                                                                                                                                  |
| La solicitud llega por correo desde el mismo correo de la cuenta            | Mandar un enlace o código de confirmación a ese correo y pedir que la persona entre a su cuenta y confirme desde ahí (cuando exista el proveedor de correo)                                               |
| La persona ya no tiene acceso al correo o pide datos de otra cuenta         | Identificación oficial (se puede tapar la CURP y la foto salvo el nombre), comparada con el nombre de la cuenta y con información que solo el titular conoce. La copia se borra a los 30 días del cierre. |
| Representante                                                               | Identidad de la persona, identidad del representante y la representación: instrumento público, carta poder ante dos testigos o declaración en comparecencia [2, art. 89 fr. II]                           |
| Menores de edad (no deberían tener cuenta: el mínimo es 18 años [00 §2.13]) | Reglas de representación del Código Civil Federal [2, art. 89]. Si una cuenta resulta de un menor, cancelarla y avisar al abogado.                                                                        |

**Nunca:** pedir la contraseña por correo, pedir más documentos de los necesarios ni guardar la
identificación en la base de datos de la app.

### 3.7 Cómo se atiende cada derecho hoy (a mano)

| Derecho o solicitud                                           | Qué hacer en Estreno                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Acceso** [1, arts. 22 y 32]                                 | Consulta de sólo lectura de todas las tablas de la sección 2 con el `userId`, incluida `analytics_events`, más la lista de fotos. Entregar un archivo legible (JSON y un resumen en español) **sin** hash de contraseña, tokens ni secretos, y **sin** datos de terceros (p. ej., quién reportó a esa persona) [1, art. 33 fr. III]. Explicar los códigos y siglas [2, art. 98]. Agregar las condiciones del tratamiento con la liga al aviso [1, art. 22]. |
| **Rectificación** [1, arts. 23 y 30]                          | La mayoría se corrige en Ajustes o en Studio. Si no, corregir en la base con la documentación que la sustente [2, art. 104]. Avisar a los vendedores que recibieron el dato (plantilla P11) [1, art. 24 párr. 4].                                                                                                                                                                                                                                           |
| **Cancelación** [1, arts. 24–25]                              | Secuencia de 2.11. En la respuesta: qué se bloquea, por cuánto tiempo y por qué [2, art. 107 fr. I].                                                                                                                                                                                                                                                                                                                                                        |
| **Oposición** [1, art. 26]                                    | Personalización: `setPersonalization(false)` (desliga toda la actividad previa). «Aparecer en sugerencias»: `setDiscoverable(false)`. Correos de marketing: baja. No procede contra un tratamiento exigido por ley [1, art. 26].                                                                                                                                                                                                                            |
| **Oposición a una decisión automatizada** [1, art. 26 fr. II] | Si un vendedor se opone a la leyenda de riesgo de falsificación, una persona del equipo revisa el caso a mano y decide; se anota en la bitácora de moderación. Ver [00 §2.9].                                                                                                                                                                                                                                                                               |
| **Revocación del consentimiento** [1, art. 7]                 | Los mismos interruptores de Ajustes; cada cambio queda en `user_consents`.                                                                                                                                                                                                                                                                                                                                                                                  |
| **Información de mercadotecnia** [3, art. 16]                 | Si Estreno usa datos con fines de mercadotecnia, cualquiera puede preguntar si tenemos información suya, con quién la compartimos y qué recomendaciones se hicieron. Se responde en **30 días** y se corrige en otros 30. Se atiende con este mismo procedimiento.                                                                                                                                                                                          |

### 3.8 Negativas y excepciones

- **Causas para negar** [1, art. 33]:
  - la persona o su representante no están acreditados;
  - los datos no están en poder de Estreno;
  - se lesionan derechos de un tercero;
  - hay un impedimento legal o una resolución de autoridad;
  - la rectificación, cancelación u oposición ya se hizo.
- **Negativa parcial:** se atiende lo que sí procede [1, art. 33].
- **No se cancela** cuando aplica el art. 25 [1]; en Estreno, lo más común será un pedido en curso o
  una retención legal (2.14).
- **Siempre se responde,** aunque no haya datos de la persona [2, art. 98]. Si quien recibe la
  solicitud no es el responsable, basta decirlo [1, art. 32].
- **Restricciones** por seguridad nacional, orden público, salud o derechos de terceros, en los casos
  que prevean las leyes o con resolución de autoridad [2, art. 88].

### 3.9 Casos especiales

- **Datos que tiene un vendedor.** El vendedor que recibió nombre, domicilio y teléfono en un pedido
  es un tercero que recibió una transferencia [00 §2.7]. Estreno atiende lo que está en su poder y
  avisa al vendedor de la rectificación o cancelación [1, art. 24 párr. 4]. Si la persona quiere
  ejercer derechos frente al vendedor, se le dan los datos de contacto que el vendedor autorizó.
- **Solicitudes masivas o abusivas:** no hay en la ley una causa de negativa por «abuso»; se
  atienden **[VERIFICAR CON ABOGADO]**.
- **Personas que no tienen cuenta** (p. ej., alguien que aparece en una foto): se atienden igual; la
  cancelación de una foto de terceros sigue también las reglas de contenido (sección 5).

### 3.10 Registro de solicitudes

Hoja de cálculo privada o tabla fuera de la app, con acceso solo para las personas de 3.2. Campos:

| Campo                                   | Ejemplo                                                  |
| --------------------------------------- | -------------------------------------------------------- |
| Folio                                   | ARCO-2026-001                                            |
| Fecha y hora de recepción, canal        | 2026-10-05 10:14, correo                                 |
| Derecho o derechos                      | Acceso + cancelación                                     |
| Cuenta relacionada (id)                 | UUID, no el correo                                       |
| Verificación de identidad               | Método y fecha; si hubo documento, fecha en que se borró |
| Requerimiento                           | Fecha de envío y de respuesta                            |
| Vencimiento de respuesta y de ejecución | Calculados en días hábiles                               |
| Ampliación                              | Sí/no, motivo, fecha de aviso                            |
| Resultado                               | Procedente, parcial, improcedente (causa)                |
| Terceros y encargados avisados          | Vendedores, proveedores                                  |
| Fecha de cierre y evidencia             | Enlace a la respuesta enviada                            |
| Quién atendió                           | Nombre                                                   |

### 3.11 Plantillas de respuesta

Textos en español de México, en segunda persona («tú»), como el resto de la plataforma. El abogado
puede preferir «usted». Cambiar lo que va entre corchetes.

**P1 · Acuse de recibo**

> Asunto: Recibimos tu solicitud [FOLIO]
>
> Hola, [NOMBRE]:
>
> Recibimos tu solicitud para ejercer tu derecho de [ACCESO / RECTIFICACIÓN / CANCELACIÓN /
> OPOSICIÓN] sobre tus datos personales el [FECHA DE RECEPCIÓN]. Tu número de folio es [FOLIO].
>
> Te responderemos a más tardar el [FECHA: 20 DÍAS HÁBILES]. Si procede, lo haremos efectivo dentro
> de los 15 días hábiles siguientes a nuestra respuesta.
>
> Si necesitamos algún dato o documento para atenderte, te lo pediremos una sola vez en los próximos
> 5 días hábiles.
>
> [NOMBRE O RAZÓN SOCIAL DEL RESPONSABLE] · [CORREO DE PRIVACIDAD]

**P2 · Requerimiento de información**

> Asunto: Necesitamos un dato para atender tu solicitud [FOLIO]
>
> Hola, [NOMBRE]:
>
> Para atender tu solicitud [FOLIO] necesitamos lo siguiente: [QUÉ FALTA: p. ej., confirmar desde tu
> cuenta con el código que te enviamos / indicar qué dato quieres corregir y el dato correcto /
> acreditar la representación].
>
> Tienes 10 días hábiles, contados a partir de mañana, para enviárnoslo. Si no lo recibimos en ese
> plazo, tendremos tu solicitud por no presentada y podrás presentarla de nuevo cuando quieras. El
> plazo para responderte empezará a correr al día siguiente de que nos lo envíes.

**P3 · Ampliación del plazo**

> Asunto: Necesitamos más tiempo para tu solicitud [FOLIO]
>
> Hola, [NOMBRE]:
>
> Por [MOTIVO CONCRETO: p. ej., la búsqueda abarca registros de varios sistemas y proveedores],
> ampliamos una sola vez el plazo para [RESPONDERTE / HACER EFECTIVA LA RESPUESTA]. La nueva fecha
> límite es el [FECHA].

**P4 · Acceso procedente**

> Asunto: Tus datos personales [FOLIO]
>
> Hola, [NOMBRE]:
>
> Tu solicitud de acceso procede. Adjuntamos [UN ARCHIVO / UN ENLACE QUE VENCE EL [FECHA]] con los
> datos personales que tenemos sobre ti, organizados por tema, con una explicación de cada campo.
>
> - No incluimos tu contraseña: solo guardamos una versión cifrada que no se puede leer.
> - No incluimos datos de otras personas, como quién reportó tus publicaciones.
>
> Cómo y para qué tratamos tus datos, a quién los comunicamos y cuánto tiempo los guardamos está en
> nuestro aviso de privacidad: [LIGA]. La entrega es gratuita.

**P5 · Rectificación procedente**

> Asunto: Corregimos tus datos [FOLIO]
>
> Hola, [NOMBRE]:
>
> Corregimos [DATO] de [VALOR ANTERIOR] a [VALOR NUEVO] el [FECHA]. [Si aplica: También avisamos del
> cambio a [NÚMERO] vendedor(es) que recibieron ese dato por un pedido, para que lo corrijan.]

**P6 · Cancelación procedente**

> Asunto: Cancelamos tus datos [FOLIO]
>
> Hola, [NOMBRE]:
>
> Tu solicitud de cancelación procede. Esto es lo que haremos a más tardar el [FECHA: 15 DÍAS
> HÁBILES]:
>
> - **Suprimimos:** [LISTA: perfil, publicaciones, fotos, comentarios, gustos, actividad…].
> - **Bloqueamos** (sin ningún uso, solo guardados para cumplir la ley o defendernos de reclamaciones
>   relacionadas con su tratamiento): [LISTA: p. ej., registro de tu aceptación de términos; pedidos
>   sin tus datos de contacto]. El bloqueo dura hasta el [FECHA], que corresponde a [PLAZO Y SU
>   FUNDAMENTO]. Después los suprimiremos y te avisaremos.
> - **Respaldos:** las copias de seguridad cifradas se renuevan solas; tus datos desaparecerán de
>   ellas a más tardar el [FECHA: ≈ 5 SEMANAS].
> - [Si aplica: Avisamos de tu cancelación a [NÚMERO] vendedor(es) que recibieron tu nombre, domicilio
>   o teléfono por un pedido, para que también los cancelen.]
>
> [Si es toda la cuenta: Tu cuenta quedará cerrada y ya no podrás iniciar sesión.]

**P7 · Aviso de supresión al terminar el bloqueo**

> Asunto: Terminamos de suprimir tus datos [FOLIO]
>
> Hola, [NOMBRE]:
>
> Como te informamos el [FECHA DE P6], el periodo de bloqueo de [DATOS] terminó el [FECHA]. Ya los
> suprimimos de nuestros sistemas; las copias de seguridad se renuevan a más tardar el [FECHA].

**P8 · Oposición o revocación procedente**

> Asunto: Dejamos de usar tus datos para [FINALIDAD] [FOLIO]
>
> Hola, [NOMBRE]:
>
> Desde el [FECHA] dejamos de usar tus datos para [FINALIDAD: personalizar tu feed / sugerirte a
> otras personas / enviarte correos promocionales / …]. [Si es personalización: También desligamos
> de tu cuenta toda la actividad que ya teníamos; queda solo como dato anónimo en cifras agregadas.]
> Puedes cambiar esta opción cuando quieras en Ajustes.

**P9 · Negativa total o parcial**

> Asunto: Respuesta a tu solicitud [FOLIO]
>
> Hola, [NOMBRE]:
>
> [No podemos / Solo podemos en parte] atender tu solicitud de [DERECHO] por esta razón: [CAUSA DEL
> ART. 33 O 25 DE LA LFPDPPP, EXPLICADA EN LENGUAJE CLARO, CON SUS PRUEBAS]. [Si es parcial: Sí
> atendimos lo siguiente: [LISTA].]
>
> Si no estás de acuerdo, puedes pedir la protección de tus derechos ante la Secretaría Anticorrupción
> y Buen Gobierno dentro de los 15 días hábiles siguientes a esta respuesta.

**P10 · No encontramos datos**

> Asunto: Respuesta a tu solicitud [FOLIO]
>
> Hola, [NOMBRE]:
>
> Buscamos en todos nuestros sistemas con los datos que nos diste ([CORREO / USUARIO]) y no
> encontramos datos personales tuyos. Si crees que usaste otro correo o usuario, dínoslo y volvemos a
> buscar.

**P11 · Aviso a un vendedor que recibió datos (art. 24 párr. 4)**

> Asunto: Una persona compradora pidió [CORREGIR / CANCELAR] sus datos
>
> Hola, [NOMBRE DEL VENDEDOR]:
>
> Por un pedido del [FECHA] recibiste el nombre, domicilio o teléfono de [NOMBRE DE LA PERSONA
> COMPRADORA]. Esa persona ejerció su derecho de [RECTIFICACIÓN: el dato correcto es … / CANCELACIÓN]
> ante Estreno. Como indican los términos para vendedores, te pedimos
> [CORREGIRLO / BORRARLO] de tus registros (chats, libretas, hojas de cálculo) salvo que lo necesites
> para cumplir una obligación legal, y confirmarnos por este medio.

---

## 4. (c) Plan de respuesta a vulneraciones de seguridad

### 4.1 Marco

- **Medidas de seguridad** administrativas, técnicas y físicas, no menores a las que el responsable
  usa para su propia información [1, art. 18]. Confidencialidad de todos los que intervienen, aun
  después de terminar su relación [1, art. 20].
- **Aviso a las personas afectadas:** las vulneraciones que **afecten de forma significativa sus
  derechos patrimoniales o morales** se les informan **de forma inmediata** [1, art. 19]. El
  Reglamento lo precisa: en cuanto se confirme que ocurrió y se hayan tomado las acciones para
  iniciar una revisión exhaustiva de su magnitud, **sin dilación** [2, art. 64].
- **Contenido mínimo del aviso** [2, art. 65]:
  1. la naturaleza del incidente;
  2. los datos comprometidos;
  3. recomendaciones para que la persona proteja sus intereses;
  4. las acciones correctivas inmediatas;
  5. dónde obtener más información.
- **Qué es una vulneración** [2, art. 63]: pérdida o destrucción no autorizada; robo, extravío o
  copia no autorizada; uso, acceso o tratamiento no autorizado; daño, alteración o modificación no
  autorizada.
- **Después:** analizar las causas e implementar acciones correctivas, preventivas y de mejora [2,
  art. 66], y actualizar la relación de medidas de seguridad [2, art. 62 fr. III].
- **Autoridad:** no encontramos en la ley [1] ni en el Reglamento [2] una obligación de avisar a la
  SABG. **[VERIFICAR CON ABOGADO]** si conviene avisar de forma voluntaria o si la SABG emitió algún
  criterio.
- **Riesgo:** vulnerar la seguridad de las bases de datos, cuando sea imputable al responsable, es
  infracción [1, art. 58 fr. XI], con multa de 200 a 320,000 UMA [1, art. 59 fr. III] (≈ $23,462 a
  $37,539,200 con la UMA 2026 [13]).
- **Delitos:** si alguien autorizado para tratar los datos provoca la vulneración con ánimo de
  lucro, o si alguien los obtiene con engaño, hay pena de prisión [1, arts. 62 y 63]. Valorar la
  denuncia ante el Ministerio Público con el abogado.

### 4.2 Niveles

«Significativa» no está definida en la ley. Propuesta de criterio: afecta el patrimonio (fraude,
cobros, extorsión) o la persona (acoso, exposición del domicilio, daño a la reputación)
**[VERIFICAR CON ABOGADO]**.

| Nivel            | Ejemplos en Estreno                                                                                                                                                                                           | ¿Aviso a las personas?                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **S1 · Crítico** | Acceso no autorizado confirmado a la base; fuga de domicilios y teléfonos de pedidos; fotos de comprobantes expuestas; secretos de producción publicados (`BETTER_AUTH_SECRET`, `DATABASE_URL`, llaves de R2) | Sí, casi seguro                       |
| **S2 · Alto**    | Toma de varias cuentas; una foto privada accesible para otra persona; un encargado avisa de una vulneración que incluye nuestros datos                                                                        | Probable: decidir con el abogado      |
| **S3 · Medio**   | Vulnerabilidad confirmada sin evidencia de uso; error que mostró a una persona un dato no sensible de otra                                                                                                    | Normalmente no; decidir caso por caso |
| **S4 · Bajo**    | Intento bloqueado (fuerza bruta frenada por los límites, escaneos)                                                                                                                                            | No                                    |

### 4.3 Roles

En el piloto, una misma persona puede tener varios roles. Lo importante es que cada rol tenga nombre.

| Rol                            | Quién                                   | Qué hace                                                                                    |
| ------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Coordinación del incidente** | [NOMBRE O RAZÓN SOCIAL DEL RESPONSABLE] | Abre el registro, decide el nivel, aprueba los avisos, habla con abogado y proveedores      |
| **Responsable técnico**        | [RESPONSABLE TÉCNICO]                   | Contiene, preserva evidencia, rota secretos, corrige, restaura                              |
| **Asesoría legal**             | [ABOGADO EXTERNO]                       | Decide si la vulneración es significativa, revisa avisos, valora denuncia y autoridad       |
| **Enlace con proveedores**     | Coordinación                            | Pide a Vercel, Neon, Cloudflare, OpenRouter o el proveedor de correo su informe (sección 6) |

**Hoja de contactos** (llenar antes de abrir y guardar fuera de la app, también impresa):
[TELÉFONO DE GUARDIA], abogado, contador y el canal de soporte o seguridad de cada proveedor según
su contrato.

### 4.4 Línea de tiempo

| Momento                                                      | Qué se hace                                                                                                                                                                                                                                                                        | Fundamento                       |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **H+0** · detección                                          | Llega por un reporte, una alerta, un proveedor, la auditoría o `JobRun`. Quien lo ve avisa a Coordinación por [TELÉFONO DE GUARDIA].                                                                                                                                               | —                                |
| **≤ 1 h**                                                    | Abrir el registro (4.9) y fijar un nivel preliminar. **Contener** (4.5). **Preservar evidencia:** exportar los registros de Vercel ya, porque el plan Pro los guarda 1 día [18]; crear una rama de Neon en un punto anterior al incidente, dentro de su ventana de historial [20]. | [1, art. 18]                     |
| **≤ 24 h**                                                   | Saber qué datos, de quiénes, desde cuándo y cómo. Pedir su informe a los encargados involucrados. Decidir con el abogado si es significativa.                                                                                                                                      | [2, art. 64]                     |
| **En cuanto se confirme** y se inicie la revisión exhaustiva | Avisar a las personas afectadas (4.6). **Meta interna:** ≤ 72 h desde la confirmación. No es un plazo legal: la ley dice «de forma inmediata».                                                                                                                                     | [1, art. 19]; [2, arts. 64 y 65] |
| **≤ 5 días hábiles**                                         | Acciones correctivas y preventivas; actualizar la relación de medidas de seguridad.                                                                                                                                                                                                | [2, arts. 62 fr. III y 66]       |
| **≤ 10 días hábiles**                                        | Informe posterior: causa raíz, cronología, datos y personas afectadas, avisos enviados, qué cambió. Sin culpas personales.                                                                                                                                                         | [2, art. 66]                     |
| **≤ 30 días**                                                | Revisar este plan con lo aprendido.                                                                                                                                                                                                                                                | Propuesta                        |

### 4.5 Qué hacer según el caso

**Secreto expuesto** (en un commit, un registro o una captura de pantalla):

1. Revocar y crear uno nuevo en su proveedor, cambiar la variable en Vercel y volver a desplegar:
   - `BETTER_AUTH_SECRET`: cambiarlo invalida las sesiones;
   - credenciales de Neon (`DATABASE_URL`, `DATABASE_URL_UNPOOLED`);
   - token de R2 (`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`);
   - `AI_API_KEY` (revisar además el gasto en la consola del proveedor);
   - `CRON_SECRET`.
2. Revisar en los registros de cada proveedor si se usó el secreto mientras estuvo expuesto.
3. Quitarlo del historial de git no basta: se da por comprometido.

**Acceso no autorizado a la base o a fotos privadas:**

1. Cortar el acceso: rotar credenciales, restringir IPs si el proveedor lo permite, desactivar la
   función afectada con su variable o ajuste.
2. Cerrar todas las sesiones (borrar las filas de `sessions`).
3. Averiguar qué tablas y qué filas se consultaron; comparar con la rama de Neon previa.
4. Si hubo contraseñas en juego (aunque sea el hash), pedir cambio de contraseña. Hace falta el
   proveedor de correo (plan T3).

**Ola de cuentas tomadas** (contraseñas reutilizadas de otros sitios):

1. Endurecer los límites de inicio de sesión y cerrar las sesiones de las cuentas afectadas.
2. Avisar a esas personas; recomendar una contraseña única (SEC-30 pendiente).

**Un encargado avisa de una vulneración:**

1. Pedir por escrito el alcance: qué datos nuestros, cuántas personas, desde cuándo y qué hicieron.
   Los plazos y la forma del aviso de cada uno están en la sección 6.
2. La obligación de avisar a las personas sigue siendo nuestra [1, art. 19]: seguimos 4.4 y 4.6.

**Pérdida de datos sin fuga** (borrado accidental o corrupción):

1. Restaurar desde la rama o el respaldo.
2. Volver a aplicar la lista de supresiones (2.12).
3. Es vulneración (pérdida o destrucción no autorizada [2, art. 63]). Se avisa solo si es
   significativa.

**Dispositivo perdido o robado de alguien del equipo:** cerrar sus sesiones de proveedor y de la
app, rotar lo que tuviera guardado y revisar los accesos recientes.

### 4.6 Aviso a las personas afectadas

- **Medio:** correo a cada persona (cuando exista el proveedor) **y** aviso dentro de la app al
  iniciar sesión. Si no se puede localizar a alguien, aviso general visible en la plataforma
  **[VERIFICAR CON ABOGADO]** si basta.
- **Contenido:** los cinco puntos del art. 65 del Reglamento [2], en lenguaje claro y sin minimizar.
- **No incluir** datos de la persona en el correo más allá de su nombre.

**Plantilla V1 · Aviso de vulneración**

> Asunto: Aviso importante sobre la seguridad de tus datos en Estreno
>
> Hola, [NOMBRE]:
>
> Te escribimos para avisarte de un incidente de seguridad que afecta datos tuyos.
>
> **Qué pasó.** El [FECHA O PERIODO], [DESCRIPCIÓN CLARA: p. ej., una persona no autorizada tuvo
> acceso a una copia de la base de datos de pedidos]. Lo detectamos el [FECHA] y ese mismo día
> [ACCIÓN INMEDIATA].
>
> **Qué datos tuyos se vieron afectados.** [LISTA EXACTA: nombre, domicilio de entrega, teléfono,
> fotos de comprobantes…]. [Lo que NO se afectó: p. ej., tu contraseña no se guarda en texto y Estreno
> no guarda datos de tarjetas.]
>
> **Qué te recomendamos hacer.** [RECOMENDACIONES CONCRETAS: desconfía de llamadas o mensajes que
> digan venir de Estreno y te pidan pagos o códigos; cambia tu contraseña si la usas en otros
> sitios…].
>
> **Qué hicimos.** [ACCIONES CORRECTIVAS INMEDIATAS: cerramos el acceso, cambiamos todas las
> credenciales, cerramos todas las sesiones…].
>
> **Dónde saber más.** Escríbenos a [CORREO DE PRIVACIDAD] o consulta [LIGA A LA PÁGINA DEL
> INCIDENTE]. Te seguiremos informando si sabemos algo nuevo.
>
> [NOMBRE O RAZÓN SOCIAL DEL RESPONSABLE]

### 4.7 Simulacro

Antes de abrir al público: un ejercicio de mesa de una hora con el caso «se publicó
`DATABASE_URL` en un commit». Medir cuánto se tarda en rotar todos los secretos y en exportar los
registros de Vercel.

### 4.8 Prevención que reduce el daño

Ya existe en el código [00 §1]: fotos sin EXIF, costo del vendedor fuera del navegador, CSP estricta,
bucket privado detrás de `/media`, límites de frecuencia. **Falta:** respaldos, monitoreo de errores
y alertas (plan T3), 2FA para ADMIN y la bitácora de cambios de rol (admin/README).

### 4.9 Registro de incidentes

Uno por incidente, incluidos los S3 y S4. Campos: folio; fechas de ocurrencia, detección,
contención, confirmación y cierre; nivel; tipo según el art. 63 del Reglamento [2]; sistemas y
encargados involucrados; categorías de datos y número de personas (sin listarlas); si se avisó, a
quién y cuándo; decisión sobre la autoridad y su motivo; acciones correctivas; enlace al informe.
Plazo: 2.8.

---

## 5. (d) Retiro de contenidos y solicitudes de autoridades

### 5.1 Marco

- **No hay una ley general** mexicana de responsabilidad de plataformas por contenido de usuarios
  [00 §7] **[VERIFICAR CON ABOGADO]**. Hay regímenes concretos:
  - **Derechos de autor:** un «Proveedor de Servicios en Línea» que almacena material a petición de
    usuarios [4, art. 114 Septies fr. II b)] no responde por daños si cumple el art. 114 Octies [4]:
    - retirar «de manera expedita y eficaz» al recibir un aviso del titular o una resolución de
      autoridad;
    - tomar medidas razonables para que el mismo contenido no se vuelva a subir;
    - avisar a la persona cuyo material retira por su cuenta;
    - tener una política **pública** de terminación de cuentas de infractores reincidentes;
    - no recibir un beneficio financiero atribuible a la infracción cuando pueda controlarla.

    No está obligado a monitorear [4, art. 114 Octies fr. IV].

  - **Multas de la LFDA** de 1,000 a 20,000 UMA (≈ $117,310 a $2,346,200 [13]) [4, art. 232
    Quinquies]:
    - a quien haga una **declaración falsa** en un aviso o contra-aviso;
    - al proveedor que **no retire de forma expedita** tras un aviso o una orden;
    - al proveedor que **no entregue a la autoridad**, previo requerimiento, la información que
      identifique al presunto infractor.
  - **Propiedad industrial:** el IMPI puede ordenar al presunto infractor **o a terceros** la
    suspensión o el cese de actos [5, art. 344 fr. V] y la «suspensión, bloqueo, remoción de
    contenidos o cese» por cualquier medio digital [5, art. 344 fr. VII]. Puede hacerlo **de
    oficio**. No acatarla se sanciona con el art. 388 fr. I o III [5, art. 344].
  - **Violencia digital o mediática:** el Ministerio Público o el juez ordenan a las plataformas
    interrumpir, bloquear, destruir o eliminar imágenes, audios o videos. La plataforma **avisa de
    inmediato** a quien compartió el contenido que se inhabilita por orden judicial. La autoridad debe
    pedir el **resguardo** del contenido. Hay audiencia en 5 días [6, art. 20 Sexies].
  - **Investigación penal:**
    - intervenir comunicaciones privadas requiere autorización de un juez federal de control [7,
      art. 291];
    - la entrega de «datos conservados» por «proveedores de servicios de aplicaciones y contenidos»
      de equipos móviles se pide al juez de control. Solo en casos urgentes (vida en riesgo,
      secuestro, extorsión, delincuencia organizada) la ordena directamente el fiscal y el juez debe
      ratificarla en 48 h [7, art. 303];
    - el mismo artículo prevé pedir la **conservación inmediata** de datos hasta por 90 días a los
      sujetos obligados de la ley de telecomunicaciones [7, art. 303].

    Si Estreno es un «proveedor de servicios de aplicaciones y contenidos» para estos efectos:
    **[VERIFICAR CON ABOGADO]**.

  - **Datos personales:** entregarlos a una autoridad sin consentimiento cabe cuando hay orden
    judicial o mandato fundado y motivado de autoridad competente [1, art. 9 fr. VII], o cuando la
    transferencia está prevista en ley o es necesaria para la procuración o administración de
    justicia [1, art. 36 fr. I y V].

### 5.2 Canales, acuse y registro

- **Titulares de derechos (autor y marcas):** [CORREO DE SOPORTE] con el asunto «Aviso de
  infracción», o el formulario público cuando exista. Los datos que debe traer el aviso y el
  contra-aviso están en los anexos 1 y 2 del borrador de términos (`02-terminos-y-reglas.md`, A15).
- **Autoridades:** oficio en [DOMICILIO PARA OÍR Y RECIBIR NOTIFICACIONES] o por el medio que
  indique la orden; copia a [CORREO DE SOPORTE].
- **Acuse** en un máximo de **2 días hábiles**, como prometen los términos (02, A15); meta interna:
  el mismo día.
- **Registro** (plazo en 2.8), campos:
  - folio y fecha;
  - quién lo presenta y en qué calidad;
  - tipo (autor, marca, IMPI, violencia digital, penal, otro);
  - contenido afectado (ids);
  - fundamento que invoca;
  - verificación;
  - acción y fecha;
  - aviso a la persona usuaria;
  - contra-aviso;
  - cierre.

### 5.3 Flujo A · Aviso de derechos de autor (fotos o textos copiados)

1. **Revisar que el aviso tenga el mínimo legal** [4, art. 114 Octies fr. III]:
   1. nombre del titular o representante y medio de contacto;
   2. el contenido que se reclama;
   3. el interés o derecho sobre los derechos de autor;
   4. la ubicación electrónica (enlace a la publicación o al producto).

   Si falta algo, pedirlo. El plazo de «expedito» empieza con el aviso completo **[VERIFICAR CON
   ABOGADO]**.

2. **Retirar de forma expedita.** Meta: **≤ 1 día hábil** desde el aviso completo (propuesta; la ley
   no fija horas). Se usa «ocultar» en `/admin/moderacion`, que deja la bitácora.
3. **Avisar a la persona usuaria** con el motivo y cómo presentar un contra-aviso (plantilla R2).
4. **Contra-aviso:** la persona demuestra titularidad o autorización, o justifica el uso en una
   limitación o excepción de la ley. Estreno informa al titular original y **restaura** el contenido,
   salvo que el titular inicie un procedimiento judicial o administrativo, una denuncia penal o un
   mecanismo alterno de solución de controversias en **15 días hábiles** desde que se le informó [4,
   art. 114 Octies fr. III].
5. **Evitar que se vuelva a subir:** guardar la huella (hash) de la foto retirada y revisar las
   subidas nuevas contra esa lista (propuesta técnica).
6. **Reincidencia:** aplicar 5.8.

### 5.4 Flujo B · Aviso de un titular de marca (posible falsificación)

La ley no trae para marcas un procedimiento de aviso y retiro como el de derechos de autor [00 §4.1]
**[VERIFICAR CON ABOGADO]**. El borrador de términos ya promete aplicar a marcas «el mismo
procedimiento» (02, A15). Tiene sentido: el IMPI puede ordenar a Estreno retirar contenidos [5, art.
344 fr. VII] y el procedimiento encaja con P14 (riesgo, nunca acusar).

1. **Qué debe traer el aviso** (además del anexo 1 de 02):
   - titular y representante, con contacto;
   - número de registro de la marca en el IMPI y los productos que cubre;
   - enlace al producto;
   - por qué considera que infringe (p. ej., logotipo idéntico en un producto que el titular no
     fabricó);
   - declaración de buena fe.
2. **Revisión en ≤ 2 días hábiles** (propuesta). Una persona del equipo compara el aviso con la
   publicación y con la revisión de autenticidad del producto (reglas, reportes, comprobantes).
3. **Si procede, retirar o inhabilitar sin demora** (`moderationStatus = HIDDEN`) y anotarlo en la
   bitácora.
4. **Avisar al vendedor** (plantilla R4). Puede subir un comprobante (el flujo que ya existe),
   corregir la publicación a «genérico» o mandar un contra-aviso (anexo 2 de 02).
5. **Contra-aviso:** se le pasa al titular. Se vuelve a habilitar el producto salvo que el titular
   acredite, dentro de **15 días hábiles**, que inició un procedimiento ante el IMPI o un juez, una
   denuncia o un mecanismo alterno. Es el mismo plazo de derechos de autor, adoptado de forma
   voluntaria (02, A15).
6. **Decide una persona, nunca la IA** (ADR-036). Estreno no resuelve si hubo infracción: eso le toca
   al IMPI o a un juez. Se informa a ambas partes de esa vía.
7. **Reincidencia:** aplicar 5.8.

### 5.5 Flujo C · Orden o medida del IMPI

1. **Verificar la autenticidad** del oficio (número de expediente, firma, contacto oficial del IMPI)
   sin usar los datos de contacto que trae el propio oficio **[VERIFICAR CON ABOGADO: cómo validarlo
   con el IMPI]**.
2. **Cumplir de inmediato** lo que ordene: suspensión, bloqueo, remoción o cese [5, art. 344 fr. V y
   VII]. Conservar el contenido retirado **bloqueado** (retención legal, 2.14).
3. **Informar al IMPI** del cumplimiento por escrito, con fecha y alcance.
4. **Avisar al vendedor,** salvo que la orden lo impida **[VERIFICAR CON ABOGADO]**.
5. **Nunca** ignorar ni dejar vencer una orden: el incumplimiento tiene sanción [5, arts. 344 y 388].

### 5.6 Flujo D · Solicitudes de datos de autoridades (Fiscalía, jueces, SAT, otras)

**Lista de verificación antes de entregar cualquier dato:**

| Pregunta                                                                                              | Si la respuesta es «no»                                                          |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| ¿Es un documento escrito de una autoridad identificable, con número, firma y fecha?                   | No se entrega. Se pide por escrito.                                              |
| ¿Se pudo confirmar por un canal oficial independiente que la autoridad lo emitió?                     | No se entrega hasta confirmarlo.                                                 |
| ¿Está **fundado y motivado** y la autoridad es competente [1, art. 9 fr. VII]?                        | Consultar al abogado antes de responder.                                         |
| Si pide **comunicaciones privadas**, ¿trae autorización de un juez federal [7, art. 291]?             | No se entrega. Hoy Estreno no tiene mensajes directos.                           |
| Si pide **datos conservados**, ¿trae orden del juez de control o es el caso urgente del art. 303 [7]? | Consultar al abogado.                                                            |
| ¿Pide solo lo necesario (cuentas, fechas, tipo de dato concretos)?                                    | Entregar solo lo que pide; si es desproporcionado, el abogado pide que se acote. |

**Qué tenemos y cuánto dura**, para no prometer lo que no existe:

- IP y navegador de la sesión: hasta que vence (30 días) más 7 (2.3);
- registros de Vercel: 1 día en el plan Pro [18];
- no hay mensajes directos.

**Pasos:**

1. Registrar (5.2) y avisar al abogado el mismo día.
2. Si es **urgente** (vida o integridad en riesgo), el abogado decide en horas; se documenta.
3. Si pide **conservar** datos, aplicar la retención legal (2.14) aunque todavía no pida entregarlos.
4. Entregar por un medio seguro, con acuse y la lista exacta de lo que se entregó.
5. **¿Avisar a la persona usuaria?** Solo si la ley y la orden lo permiten **[VERIFICAR CON
   ABOGADO]**.
6. **SAT:** una solicitud relacionada con plataformas digitales (CFF 30-B o informativas) va además
   al contador [00 §5].

### 5.7 Flujo E · Violencia digital (orden del art. 20 Sexies)

1. **Verificar** que venga del Ministerio Público o de un juez, con la ubicación precisa del
   contenido (URL) [6, art. 20 Sexies].
2. **Inhabilitar de inmediato** el contenido (ocultar en `/admin/moderacion`).
3. **Resguardar** una copia del contenido, bloqueada, con fecha y hash (la autoridad debe pedir su
   resguardo y conservación) [6, art. 20 Sexies].
4. **Avisar de inmediato** a quien lo compartió que se inhabilitó por una orden judicial (plantilla
   R5). Es obligatorio [6, art. 20 Sexies].
5. **Estar atentos a la audiencia** (5 días) y aplicar lo que el juez resuelva: cancelar, ratificar o
   modificar la medida.
6. Si una persona reporta violencia digital **sin** orden, se revisa como cualquier reporte con las
   reglas de contenido. El contenido íntimo sin consentimiento se oculta de inmediato mientras se
   revisa (propuesta).

### 5.8 Reincidencia

La política pública está en el borrador de términos (02, C14): **3 infracciones confirmadas de marcas
o derechos de autor en 12 meses** cierran la tienda de forma definitiva, y las faltas graves cierran
la cuenta de inmediato. Lo que este procedimiento agrega para aplicarla:

- **Qué cuenta como infracción confirmada:** un retiro por derechos de autor cuyo contra-aviso no
  prosperó o que no se impugnó; un retiro por marca en las mismas condiciones; una orden del IMPI o
  de un juez; una falsificación confirmada por el equipo.
- **Registro:** hoy no se cuentan infracciones por cuenta (02, §0 #15). Mientras no exista en el
  código, se llevan en el registro de 5.2 por cuenta, con fecha y tipo.
- **Decide una persona;** se avisa con el motivo y se puede pedir revisión.
- **Plazo:** el motivo de una sanción se conserva **72 meses como máximo** [1, art. 10 párr. 3].
- **Pública:** tiene que estar en los términos para conservar el puerto seguro de derechos de autor
  [4, art. 114 Octies fr. II c)].

### 5.9 Plantillas

**R1 · Acuse al titular de derechos o a la autoridad** (formal)

> Asunto: Acuse de recibo · [FOLIO]
>
> Recibimos su [AVISO / OFICIO NÚM. …] el [FECHA] respecto de [ENLACE O IDENTIFICADOR]. Quedó
> registrado con el folio [FOLIO]. [Si falta información: Para atenderlo necesitamos [DATO FALTANTE].]
> Le informaremos por este medio las acciones que tomemos.

**R2 · Aviso a la persona usuaria: retiro por derechos de autor**

> Asunto: Ocultamos una de tus publicaciones por un aviso de derechos de autor
>
> Hola, [NOMBRE]:
>
> Recibimos un aviso de [TITULAR] que dice que [LA FOTO / EL TEXTO] de [ENLACE] se usa sin su
> permiso. Por ley la ocultamos mientras se aclara.
>
> Si crees que es un error porque la foto es tuya, tienes permiso o tu uso está permitido por la ley,
> puedes enviarnos un **contra-aviso** respondiendo a este correo. Incluye cómo lo demuestras. Se lo
> haremos saber al titular y volveremos a mostrar tu publicación, salvo que él inicie un
> procedimiento legal en los 15 días hábiles siguientes.
>
> Ojo: hacer una declaración falsa en un aviso o contra-aviso puede ser multado por la ley.

**R3 · Informe al titular sobre un contra-aviso**

> Asunto: Contra-aviso sobre [FOLIO]
>
> La persona usuaria presentó un contra-aviso (adjunto). Conforme al artículo 114 Octies de la Ley
> Federal del Derecho de Autor, restableceremos el contenido el [FECHA: 15 DÍAS HÁBILES], salvo que
> antes nos acredite haber iniciado un procedimiento judicial o administrativo, una denuncia penal o
> un mecanismo alterno de solución de controversias.

**R4 · Aviso al vendedor: aviso de un titular de marca**

> Asunto: Ocultamos tu producto «[TÍTULO]» mientras revisamos un aviso
>
> Hola, [NOMBRE]:
>
> [TITULAR], que tiene registrada la marca [MARCA] ante el IMPI, nos avisó que tu producto
> «[TÍTULO]» podría no ser original. Lo revisamos y, por ahora, dejamos de mostrarlo. **No te
> estamos acusando:** Estreno no decide si hubo una infracción; eso le corresponde al IMPI o a un
> juez.
>
> Qué puedes hacer:
>
> - subir un comprobante (ticket, factura o foto de la etiqueta) desde Studio;
> - si no es original, corregir la publicación a «genérico o compatible»;
> - si crees que es un error, enviarnos un contra-aviso respondiendo a este correo. Se lo pasaremos a
>   quien mandó el aviso y volveremos a mostrar tu producto, salvo que esa persona inicie un
>   procedimiento legal en los 15 días hábiles siguientes.
>
> Una persona del equipo revisará tu respuesta y te dirá qué decidió.

**R5 · Aviso por orden judicial (art. 20 Sexies)**

> Asunto: Contenido inhabilitado por orden judicial
>
> Hola, [NOMBRE]:
>
> Te informamos que [LA PUBLICACIÓN / LA FOTO] de [ENLACE O FECHA] fue inhabilitada por el
> cumplimiento de una orden judicial emitida por [AUTORIDAD], conforme al artículo 20 Sexies de la
> Ley General de Acceso de las Mujeres a una Vida Libre de Violencia. [Si la orden lo permite:
> Número de oficio: [NÚMERO].]

**R6 · Respuesta de cumplimiento a una autoridad** (formal)

> En atención a su oficio [NÚMERO] de fecha [FECHA], recibido el [FECHA], informamos que el [FECHA]
> [DESCRIPCIÓN EXACTA: se inhabilitó el contenido ubicado en … / se entrega la información
> siguiente: …]. La información se entrega exclusivamente para los fines señalados en el oficio y
> con carácter confidencial. [NOMBRE O RAZÓN SOCIAL DEL RESPONSABLE], [DOMICILIO PARA OÍR Y RECIBIR
> NOTIFICACIONES].

---

## 6. (e) Registro de encargados y cláusulas del contrato

### 6.1 Marco

- **Encargado** es quien trata datos «por cuenta del responsable» [1, art. 2 fr. XII]. Mandarle datos
  **no es transferencia**, aunque esté en otro país [1, art. 2 fr. XX]. Las remisiones nacionales e
  internacionales a encargados no requieren informarse ni consentirse [2, art. 53]. Aun así,
  proponemos nombrarlos en el aviso con su país, por transparencia [00 §2.7].
- **Obligaciones del encargado** [2, art. 50]:
  - tratar los datos solo según las instrucciones del responsable;
  - no usarlos para otras finalidades;
  - aplicar medidas de seguridad;
  - guardar confidencialidad;
  - suprimirlos al terminar la relación o cuando se le instruya, salvo que una ley exija
    conservarlos;
  - no transferirlos, salvo instrucción, subcontratación o requerimiento de autoridad.
- **Contrato:** la relación debe constar en cláusulas contractuales u otro instrumento que acredite su
  existencia, alcance y contenido [2, art. 51].
- **Nube por adhesión** [2, art. 52]. Solo se pueden usar servicios cuyo proveedor:
  - tenga políticas de protección de datos afines a la ley;
  - transparente sus subcontrataciones;
  - no se quede con la titularidad de la información;
  - guarde confidencialidad;
  - avise de cambios a sus políticas o condiciones;
  - permita limitar el tratamiento;
  - tenga medidas de seguridad adecuadas;
  - garantice la supresión al terminar;
  - impida accesos sin privilegio o, si hay una solicitud fundada de autoridad, **informe al
    responsable**.
- **Subcontratación:** toda subcontratación del encargado debe autorizarla el responsable; la
  autorización puede darse en el contrato [2, arts. 54 y 55].
- **Vigencia del Reglamento de 2011:** **[VERIFICAR CON ABOGADO]** [00 §2.1].

### 6.2 Registro

Lo que dice cada contrato según lo que leímos el 2026-09-26. «No encontrado» significa que no lo
vimos en el texto revisado, no que no exista.

| Campo                                                  | Vercel                                                                                                                                  | Neon (Databricks)                                                                                                                                                                                                            | Cloudflare R2                                                                                                                            | OpenRouter                                                                                                                                             | Correo (candidato: Resend)                                                                                             |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| **Servicio**                                           | Alojamiento, funciones, CDN, Cron                                                                                                       | Base de datos Postgres                                                                                                                                                                                                       | Almacenamiento de fotos (públicas y comprobantes privados)                                                                               | Enrutador de modelos de IA por API                                                                                                                     | Correos de verificación, recuperación y avisos                                                                         |
| **Datos**                                              | Todo lo que pasa por las peticiones (IP, cookies, rutas); registros de ejecución                                                        | Todos los datos de la sección 2                                                                                                                                                                                              | Fotos (sin EXIF) y comprobantes                                                                                                          | Texto del vendedor sin contactos ni costo; datos del producto; salida generada                                                                         | Correo, nombre y contenido del mensaje; registros de entrega                                                           |
| **Ubicación**                                          | Funciones en `iad1`, Washington, D.C. [17]. Procesamiento principal en EE. UU.; puede procesar «en cualquier otro lugar del mundo» [16] | AWS `us-east-1` según `.env.example` **[VERIFICAR en la consola]**                                                                                                                                                           | Automática (la región más cercana a quien crea el bucket) si no se fija una pista o jurisdicción (`us`, `eu`) [22]. No hay opción México | GCP en regiones de EE. UU. [24]. Cada proveedor de modelo, en su país                                                                                  | Procesamiento principal en EE. UU. [23]                                                                                |
| **Contrato y cómo obliga**                             | DPA (act. 17-03-2026, vigente 31-03-2026). Obliga al aceptar el contrato del servicio [16]                                              | Anexo de producto de Neon (act. 05-08-2026) dentro del MCSA de Databricks (act. 20-02-2026), que **incorpora por referencia** el DPA de Databricks (v3, 21-07-2023). Contraparte: Databricks, Inc., matriz de Neon, LLC [19] | DPA v6.4 (vigente 03-04-2026); forma parte del contrato principal [21]. Cómo se acepta en el plan de autoservicio: **[VERIFICAR]**       | DPA (act. 26-08-2026), parte de los términos al aceptarlos [24]                                                                                        | DPA (act. 31-12-2025). Obliga al aceptar los términos [23]                                                             |
| **Aviso de vulneración**                               | «Sin demora indebida» tras confirmarla; sin plazo en horas [16]                                                                         | Sin demora indebida y **≤ 72 h** [19]                                                                                                                                                                                        | «Sin demora indebida» [21]                                                                                                               | Sin demora indebida y **≤ 72 h** [24]                                                                                                                  | «Sin demora indebida» [23]                                                                                             |
| **Subencargados**                                      | Lista en security.vercel.com; objeción en 5 días naturales tras el aviso; si no se resuelve, terminar sin reembolso [16]                | Autorización general; lista pública; aviso **30 días** antes; objeción en 10 días [19]                                                                                                                                       | Aviso **30 días** antes; objeción en 10 días [21]                                                                                        | Aviso **30 días** antes, **excepto los proveedores de modelos**; objeción en 30 días [24]                                                              | Aviso **14 días** antes; objeción [23]                                                                                 |
| **Supresión al terminar**                              | Borra en un «plazo comercialmente razonable» [16]                                                                                       | Borra en **30 días** tras la solicitud escrita [19]                                                                                                                                                                          | Borra o devuelve, a elección del cliente [21]                                                                                            | Borra de sus bases y respaldos en **30 días hábiles** tras la solicitud [24]                                                                           | Devuelve o borra; si no se puede, bloquea [23]                                                                         |
| **Solicitudes de autoridades** (Reg. art. 52 fr. II e) | **No encontrado** en el DPA [16]                                                                                                        | Intenta redirigir a la autoridad al cliente; avisa si lo obligan, salvo prohibición [19]                                                                                                                                     | Avisa de inmediato salvo prohibición; impugna antes de entregar; informe de transparencia [21]                                           | Avisa con un resumen salvo prohibición; impugna si hay motivos [24]                                                                                    | Intenta redirigir al cliente; avisa y coopera [23]                                                                     |
| **Ayuda con ARCO**                                     | Sí, a costo del cliente; remite a la persona al cliente [16]                                                                            | **[VERIFICAR]** en el DPA                                                                                                                                                                                                    | Avisa al cliente y no responde sin su consentimiento; ayuda razonable [21]                                                               | Avisa al cliente y no responde por su cuenta [24]                                                                                                      | Avisa y remite al cliente [23]                                                                                         |
| **Auditoría**                                          | Copia del informe de auditoría más reciente (SOC 2 Tipo 2) a solicitud [16]                                                             | Información y auditorías, con los cambios del anexo de producto [19]                                                                                                                                                         | Informes de ≤ 13 meses; una auditoría en sitio al año [21]                                                                               | Una al año, por auditor independiente [24]                                                                                                             | Una al año, con 14 días de aviso y a costo del cliente [23]                                                            |
| **Ley del contrato**                                   | Irlanda [16]                                                                                                                            | Delaware para clientes de América [19]                                                                                                                                                                                       | **[VERIFICAR]**                                                                                                                          | Nueva York, según sus términos [00 §2.7]                                                                                                               | **[VERIFICAR]**                                                                                                        |
| **Pendientes**                                         | Confirmar que el plan contratado incluye el DPA; nada de datos personales en URLs ni en `console.*`                                     | Confirmar región; fijar el historial en 7 días (2.12); guardar PDF de los tres documentos                                                                                                                                    | Crear el bucket con jurisdicción o pista explícita y anotarla; bucket privado (ADR-040)                                                  | Aceptar el DPA; desplegar el cambio que ya manda `zdr: true`; documentar la autorización de subencargados; nombrarlo con su país en el aviso [00 §2.7] | Revisar el contrato del proveedor que se elija (Resend o SES) antes del primer correo; registro de entregas y su plazo |

### 6.3 Qué falta frente al Reglamento

| Requisito                                                                                    | Vercel            | Neon                 | Cloudflare         | OpenRouter                             | Resend           |
| -------------------------------------------------------------------------------------------- | ----------------- | -------------------- | ------------------ | -------------------------------------- | ---------------- |
| Contrato que acredite la relación [2, art. 51]                                               | ✓                 | ✓                    | ✓                  | ✓                                      | ✓ (al contratar) |
| Transparentar subcontrataciones [2, art. 52 fr. I b)]                                        | ✓                 | ✓                    | ✓                  | Parcial: sin aviso para modelos        | ✓                |
| Autorizar la subcontratación [2, arts. 54 y 55]                                              | Por el contrato   | Autorización general | Por el contrato    | Documentarla, sobre todo la de modelos | Por el contrato  |
| Supresión garantizada al terminar [2, art. 52 fr. II d)]                                     | Sin plazo         | ✓ 30 días            | ✓                  | ✓ 30 días hábiles                      | ✓                |
| Informar accesos de autoridades [2, art. 52 fr. II e)]                                       | **No encontrado** | ✓                    | ✓                  | ✓                                      | ✓                |
| Seguridad [2, art. 52 fr. II c)]                                                             | ✓ SOC 2           | ✓                    | ✓ ISO 27001, SOC 2 | ✓ SOC 2 Tipo II                        | **[VERIFICAR]**  |
| Tratar solo según instrucciones; no apropiarse de la información [2, arts. 50 y 52 fr. I c)] | **[VERIFICAR]**   | **[VERIFICAR]**      | **[VERIFICAR]**    | **[VERIFICAR]**                        | **[VERIFICAR]**  |

**Pregunta para el abogado:** los cinco son contratos de adhesión extranjeros. ¿Basta con aceptarlos
si cumplen el art. 52 del Reglamento, o conviene pedir una adenda? ¿Qué hacer con los huecos
marcados? **[VERIFICAR CON ABOGADO]**

### 6.4 Cláusulas mínimas que debe tener todo contrato de encargado

Lista para revisar cada proveedor nuevo. Las de la primera parte vienen del Reglamento; las de la
segunda son recomendación nuestra.

**Del Reglamento** [2, arts. 50–55]:

1. Objeto, finalidades y tipos de datos; tratar solo según instrucciones.
2. Prohibición de usar los datos para fines propios (incluido entrenar modelos).
3. Medidas de seguridad.
4. Confidencialidad del personal, que sigue después de terminar.
5. Supresión o devolución al terminar, con plazo.
6. No transferir salvo instrucción, subcontratación autorizada o requerimiento de autoridad.
7. Subcontratación: autorización (general o caso por caso), mismas obligaciones para el
   subcontratado y prueba de la autorización a cargo del encargado.
8. Para la nube por adhesión, además: no apropiarse de la información, aviso de cambios, forma de
   limitar el tratamiento, e informar al responsable de solicitudes de autoridades.

**Recomendadas:**

9. Aviso de vulneraciones en un plazo en horas, con el contenido que necesitamos para cumplir el
   art. 65 del Reglamento [2].
10. Ayuda con solicitudes ARCO y remisión de la persona al responsable.
11. Ubicación de los datos y de los subencargados.
12. Informes de auditoría o certificaciones.
13. Borrado en respaldos y su plazo.

### 6.5 Encargados futuros

Antes de encender cualquiera de estos: registro (6.2), contrato, aviso de privacidad (nueva versión)
y, si corre en el navegador, CSP.

- monitoreo de errores (Sentry, plan T3);
- procesador de pagos real;
- cualquier analítica externa o SDK de publicidad (hoy no hay ninguno [00 §1]);
- WhatsApp Business u otro canal de mensajería.

### 6.6 Quién no es encargado

- **Vendedores:** reciben datos del comprador para cumplir el pedido por su cuenta: es una
  **transferencia** [1, arts. 35 y 36] [00 §2.7].
- **Autoridades:** transferencias por ley o por mandato (5.6).
- **Otras personas usuarias:** ven lo que es público por diseño (perfil, publicaciones).

---

## 7. (f) Pendientes legales del fundador

### 7.1 Entidad: SAS o persona física

No es una recomendación: son los hechos para decidir con el contador y el abogado (ADR-033 #5:
decidir antes del vendedor 11).

| Tema                            | SAS (sociedad por acciones simplificada)                                                                                                                                                                             | Persona física con actividad empresarial                                                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Quién puede**                 | Una o más personas físicas [11, art. 260]                                                                                                                                                                            | El fundador                                                                                                                                      |
| **Cómo se crea**                | En línea, en el sistema de la Secretaría de Economía, sin escritura pública. Requisitos: autorización de denominación y **e.firma vigente de todos los accionistas** [11, arts. 262 y 263]                           | Inscripción o actualización en el RFC [8, art. 27]                                                                                               |
| **Responsabilidad**             | Los accionistas solo responden por sus aportaciones [11, art. 260]                                                                                                                                                   | El deudor responde con todos sus bienes, salvo los inembargables [10, art. 2964]                                                                 |
| **Tope de ingresos**            | **$7,678,849.94** al año (monto actualizado por acuerdo DOF 26-12-2025). Si se rebasa hay que transformarla; si no, los accionistas responden de forma subsidiaria, solidaria e ilimitada [11, art. 260]             | Sin tope por la forma jurídica                                                                                                                   |
| **Obligaciones de la forma**    | Informe anual de situación financiera en el sistema de la Secretaría de Economía; no presentarlo dos años seguidos disuelve la sociedad [11, art. 272]. Los estatutos piden el RFC de cada accionista [11, art. 264] | Las fiscales de su régimen                                                                                                                       |
| **Régimen de ISR posible**      | RESICO de personas morales si solo tiene socios personas físicas e ingresos ≤ $35 millones [12, art. 206] **[VERIFICAR CON CONTADOR]**                                                                               | RESICO de personas físicas si sus ingresos no pasan de $3.5 millones y solo tiene esas actividades [12, art. 113-E] **[VERIFICAR CON CONTADOR]** |
| **Si algún día cobra comisión** | El ISR de plataformas nombra a «personas morales» como retenedoras [00 §5.2]                                                                                                                                         | El texto literal del ISR no incluye a la persona física; la LIVA sí habla de contribuyentes [00 §5.2] **[VERIFICAR CON CONTADOR]**               |
| **Datos personales**            | La SAS pasa a ser la responsable: nuevo aviso, nueva versión y re-aceptación; ¿cómo se pasan las bases de datos de la persona física a la SAS? **[VERIFICAR CON ABOGADO]**                                           | El fundador es el responsable desde el día 1 [00 §2.2]                                                                                           |
| **Inversión y socios**          | Admite varios accionistas; si se requieren otras formas de organización hay que transformarla ante fedatario [11, art. 269]                                                                                          | No admite socios                                                                                                                                 |

### 7.2 Lista con prioridad

**P0** = antes de abrir al público o de cualquier dato real; **P1** = antes del vendedor 11 o del día
25 del plan; **P2** = antes de terminar el piloto de 90 días.

| #   | Pendiente                                                                                                                                                                                                                                                                                  | Prioridad | Cuándo (plan de 90 días)               | Depende de |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | -------------------------------------- | ---------- |
| 1   | **Tres cotizaciones de abogado** (datos personales, consumo, propiedad intelectual) y una de **contador**. Alcance: revisar 00, este documento, aviso integral y simplificado, términos, y resolver las preguntas de 00 §10 y de la sección 8.                                             | P0        | Semana 1                               | —          |
| 2   | **Definir al responsable del piloto** (el fundador como persona física mientras exista la SAS) y llenar los datos: [NOMBRE O RAZÓN SOCIAL DEL RESPONSABLE], [RFC], [DOMICILIO PARA OÍR Y RECIBIR NOTIFICACIONES].                                                                          | P0        | Semana 1                               | 1          |
| 3   | **RFC:** inscribirse o actualizar las actividades y obligaciones ante el SAT; e.firma vigente (la necesita la SAS) [8, art. 27; 11, art. 262].                                                                                                                                             | P0        | Semanas 1–2                            | Contador   |
| 4   | **Correos:** crear [CORREO DE PRIVACIDAD] y [CORREO DE SOPORTE] en el dominio definitivo; designar a la persona de datos [1, art. 29].                                                                                                                                                     | P0        | Semana 2                               | Dominio    |
| 5   | **Aceptar los contratos de encargado** y llenar el registro (6.2); desplegar `zdr: true`; región de Neon y jurisdicción de R2.                                                                                                                                                             | P0        | Antes del primer despliegue público    | —          |
| 6   | **ARCO manual funcionando** (sección 3) y registro de solicitudes.                                                                                                                                                                                                                         | P0        | Antes de abrir                         | 4          |
| 7   | **Plan de vulneraciones** (sección 4): hoja de contactos y simulacro.                                                                                                                                                                                                                      | P0        | Antes del primer despliegue público    | 1          |
| 8   | **Conservación:** tareas T1–T8 (2.13) antes de publicar los plazos en el aviso.                                                                                                                                                                                                            | P0        | Olas 0–1                               | Desarrollo |
| 9   | **Canal de avisos de infracción** y política de reincidentes publicada en los términos (sección 5).                                                                                                                                                                                        | P0        | Antes de abrir                         | 1          |
| 10  | **Búsqueda en el IMPI** del nombre «Estreno» y variantes: Acervo de Marcas y MARCia; clases en ClasNiza. Clases probables: servicios de mercado en línea, software y redes sociales en línea **[VERIFICAR CON ABOGADO las clases exactas]** [14].                                          | P1        | Día 21 (ADR-033 #16)                   | —          |
| 11  | **Solicitud de registro de marca** si la búsqueda sale limpia: en línea, **$2,695.18 + IVA por clase**, vigencia de **10 años**, trámite de **4 a 6 meses** según el IMPI [14]. El plan citaba $2,994.62 + IVA de una fuente secundaria; confirmar la tarifa vigente al pagar.             | P1        | Después de 10                          | 10         |
| 12  | **Descuento de 90 % del IMPI** para personas de 12 a 29 años nacidas en México: campaña «Marcas para el Bienestar 2026-III Jóvenes», del 5 al 16 de octubre de 2026, con autorización de la secretaría de desarrollo económico del estado [15]. Solo si el fundador cumple los requisitos. | P1        | 5–16 de octubre de 2026                | 10         |
| 13  | **Decidir la entidad** (7.1) con el contador; si es SAS: denominación, e.firma de accionistas, constitución en línea, RFC de la SAS, cuenta bancaria, y nuevo aviso y términos con la SAS como responsable.                                                                                | P1        | Decisión día 25; antes del vendedor 11 | 1, 3       |
| 14  | **Opinión escrita del contador** sobre el régimen de plataformas con comisión 0 % [00 §5.3].                                                                                                                                                                                               | P1        | Antes del vendedor 11                  | 1          |
| 15  | **Revisión legal final** de aviso, términos y este documento; subir versiones y pedir re-aceptación.                                                                                                                                                                                       | P0        | Antes de abrir                         | 1, 2       |
| 16  | **Concilianet de la PROFECO:** evaluar el convenio cuando exista la sociedad [00 §3.6].                                                                                                                                                                                                    | P2        | Después de 13                          | 13         |
| 17  | **Revisión anual** de este documento y del registro de encargados.                                                                                                                                                                                                                         | P2        | Cada año                               | —          |

### 7.3 Preguntas para el contador (además de 00 §5.3)

1. Persona física en el piloto: ¿qué régimen y qué actividad registrar, si la plataforma no cobra
   nada todavía?
2. ¿Los pedidos entre compradores y vendedores deben conservarse como documentación fiscal de
   Estreno aunque no pasen por ella? (2.5)
3. ¿Qué plazo de conservación aplica al libro de la plataforma y a los costos de IA? (2.9)
4. SAS: ¿conviene el RESICO de personas morales? ¿Qué cambia al rebasar el tope de la SAS?
5. Gastos en dólares con proveedores extranjeros (Vercel, Neon, Cloudflare, OpenRouter): ¿qué
   comprobante se necesita para deducirlos?

---

## 8. Puntos [VERIFICAR CON ABOGADO] de este documento

1. **Reglamento de 2011:** ¿sigue aplicando como supletorio (encargados, bloqueo, ARCO,
   vulneraciones)? ¿Las remisiones a la numeración de la ley de 2010 se leen como proponemos (p. ej.,
   «art. 32» → art. 31)? (3.1, 6.1)
2. **Periodo de bloqueo** tras cancelar una cuenta: ¿10 años (Código de Comercio arts. 49 y 1047), 1
   año (LFPC art. 14) u otro? ¿Estreno es «comerciante» para el art. 49? (2.1, 2.3)
3. ¿Se puede conservar, bloqueada, la **prueba de aceptación de términos** tras cancelar la cuenta?
   ¿Cuánto tiempo? ¿Basta un hash del correo? (2.3)
4. **Pedidos:** ¿5 años sin datos de contacto es razonable? ¿Qué plazo aplica si Estreno no es parte
   de la compraventa? (2.5)
5. **Copia del domicilio en el pedido:** ¿90 días después de la entrega es suficiente? (2.5)
6. **Costo privado del vendedor:** ¿es dato patrimonial que pide consentimiento expreso? (2.4)
7. **Moderación:** ¿2 años para contenido retirado y bitácora es adecuado? ¿Aplica el límite de 72
   meses del art. 10 a las sanciones por violar los términos? (2.4, 2.8, 5.8)
8. **Días hábiles:** ¿qué calendario de inhábiles usar para los plazos ARCO? (3.1)
9. **Verificación de identidad:** ¿basta la sesión o la confirmación por correo, sin copia de
   identificación, frente al art. 28 fr. II? (3.6)
10. ¿Hay una causa para negar solicitudes ARCO **reiteradas o abusivas**? (3.9)
11. **Vulneraciones:** ¿hay que avisar a la SABG? ¿Qué es «significativa»? ¿Basta un aviso general si
    no se puede localizar a alguien? (4.1, 4.2, 4.6)
12. **Derechos de autor:** ¿desde cuándo corre el retiro «expedito» si el aviso llega incompleto?
    (5.3)
13. **Marcas:** ¿conviene aplicarles de forma voluntaria el aviso, contra-aviso y plazo de 15 días
    hábiles de derechos de autor, como ya promete el borrador de términos? ¿Retirar un producto por
    un aviso de marca expone a Estreno frente al vendedor? (5.4)
14. **Órdenes del IMPI:** ¿cómo validar su autenticidad? ¿Se puede avisar al vendedor? (5.5)
15. **Autoridades penales:** ¿Estreno es «proveedor de servicios de aplicaciones y contenidos» para
    el art. 303 del CNPP? ¿Debe conservar datos 90 días si se lo piden? ¿Puede avisar a la persona
    usuaria? (5.1, 5.6)
16. **No hay ley general** de responsabilidad de plataformas por contenido de usuarios: confirmarlo.
    (5.1)
17. **Contratos de encargado de adhesión y extranjeros:** ¿cumplen el art. 52 del Reglamento? ¿Qué
    hacer con los huecos de 6.3 (p. ej., Vercel no dice nada de solicitudes de autoridades)? (6.3)
18. **Clases de Niza** para registrar «Estreno». (7.2 #10)
19. **Cambio de responsable** de la persona física a la SAS: ¿cómo se pasan las bases de datos y qué
    se avisa a las personas usuarias? (7.1)
20. **Sanciones de vendedores:** ¿se puede conservar el dato de que existió una suspensión después de
    borrar el motivo? (2.4)

**Para el contador:** 7.3, más los puntos marcados **[VERIFICAR CON CONTADOR]** en 2.5, 2.7, 2.9 y
7.1.

**Técnicos** (no son del abogado): si Better Auth borra sesiones vencidas (sección 1); región real
de Neon (6.2); cómo se acepta el DPA de Cloudflare en autoservicio (6.2).

---

## 9. Fuentes

Todas consultadas el **2026-09-26**. Las leyes son el texto vigente que publica la Cámara de
Diputados; leímos los artículos citados.

**Leyes y reglamentos**

1. Cámara de Diputados, _Ley Federal de Protección de Datos Personales en Posesión de los
   Particulares_. Nueva ley DOF 20-03-2025; última reforma DOF 14-11-2025. Arts. 2, 7, 9, 10, 12,
   15, 18–36, 40–42, 58–60, 62 y 63. https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf
2. Cámara de Diputados, _Reglamento de la LFPDPPP_, DOF 21-12-2011 (publicado como «texto
   vigente»). Arts. 37–39, 49–55, 57–66 y 87–110.
   https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LFPDPPP.pdf
3. Cámara de Diputados, _Ley Federal de Protección al Consumidor_, última reforma DOF 12-12-2025.
   Arts. 14, 16 y 76 BIS. https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPC.pdf
4. Cámara de Diputados, _Ley Federal del Derecho de Autor_, última reforma DOF 14-05-2026. Arts. 114
   Septies, 114 Octies y 232 Quinquies. https://www.diputados.gob.mx/LeyesBiblio/pdf/LFDA.pdf
5. Cámara de Diputados, _Ley Federal de Protección a la Propiedad Industrial_, última reforma DOF
   03-04-2026. Arts. 344 y 399. https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPPI.pdf
6. Cámara de Diputados, _Ley General de Acceso de las Mujeres a una Vida Libre de Violencia_, última
   reforma DOF 15-01-2026. Art. 20 Sexies. https://www.diputados.gob.mx/LeyesBiblio/pdf/LGAMVLV.pdf
7. Cámara de Diputados, _Código Nacional de Procedimientos Penales_, última reforma DOF 28-11-2025.
   Arts. 291 y 303. https://www.diputados.gob.mx/LeyesBiblio/pdf/CNPP.pdf
8. Cámara de Diputados, _Código Fiscal de la Federación_, última reforma DOF 09-04-2026. Arts. 27 y 30. https://www.diputados.gob.mx/LeyesBiblio/pdf/CFF.pdf
9. Cámara de Diputados, _Código de Comercio_, última reforma DOF 14-11-2025. Arts. 38, 46, 49 y 1047. https://www.diputados.gob.mx/LeyesBiblio/pdf/CCom.pdf
10. Cámara de Diputados, _Código Civil Federal_, última reforma DOF 14-11-2025. Arts. 1159, 1934 y 2964. https://www.diputados.gob.mx/LeyesBiblio/pdf/CCF.pdf
11. Cámara de Diputados, _Ley General de Sociedades Mercantiles_, última reforma DOF 20-10-2023;
    monto del art. 260 actualizado por acuerdo DOF 26-12-2025 (según la nota del propio texto). Arts.
    260–273. https://www.diputados.gob.mx/LeyesBiblio/pdf/LGSM.pdf
12. Cámara de Diputados, _Ley del Impuesto sobre la Renta_, última reforma DOF 01-04-2024. Arts.
    113-E y 206. https://www.diputados.gob.mx/LeyesBiblio/pdf/LISR.pdf

**Oficiales**

13. INEGI, Comunicado de prensa 1/26, _Unidad de Medida y Actualización (UMA)_, 08-01-2026: diario
    $117.31 desde el 01-02-2026.
    https://www.inegi.org.mx/contenidos/saladeprensa/boletines/2026/uma/uma2026.pdf
14. IMPI, «Registro de MARCAS» (gob.mx): pasos, ClasNiza, Acervo de Marcas, MARCia, $2,695.18 + IVA
    por clase en línea, 10 años, 4 a 6 meses. https://www.gob.mx/impi/documentos/registro-de-marcas
15. IMPI, «IMPI impulsa el registro de marcas de personas jóvenes emprendedoras con un descuento del
    90 %», 14-09-2026.
    https://www.gob.mx/impi/prensa/impi-impulsa-el-registro-de-marcas-de-personas-jovenes-emprendedoras-con-un-descuento-del-90

**Proveedores**

16. Vercel, _Data Processing Addendum_, act. 17-03-2026, vigente 31-03-2026.
    https://vercel.com/legal/dpa
17. Vercel, _Global network and regions_, act. 2026-08-11. https://vercel.com/docs/regions
18. Vercel, _Runtime Logs_, act. 2026-08-28 (retención por plan). https://vercel.com/docs/logs/runtime
19. Neon y Databricks: anexo de producto y términos de Neon, act. 05-08-2026
    (https://neon.com/terms-of-service; https://neon.com/dpa); _Master Cloud Services Agreement_,
    act. 20-02-2026 (https://www.databricks.com/legal/mcsa); _Data Processing Addendum_ v3, 21-07-2023
    (https://www.databricks.com/sites/default/files/legal/dpa-20230721.pdf, enlazado desde
    https://www.databricks.com/legal/dpa).
20. Neon, _Restore window_ (historial por plan y costo). https://neon.com/docs/introduction/restore-window
21. Cloudflare, _Customer Data Processing Addendum_, versión 6.4, vigente 03-04-2026.
    https://www.cloudflare.com/cloudflare-customer-dpa/
22. Cloudflare, _R2 · Data location_. https://developers.cloudflare.com/r2/reference/data-location/
23. Resend, _Data Processing Addendum_, act. 31-12-2025. https://resend.com/legal/dpa
24. OpenRouter, _Data Processing Agreement_, act. 26-08-2026.
    https://openrouter.ai/data-processing-agreement

**Documentos internos:** `docs/legal/00-marco-legal-2026.md` (citado como [00 §n], con sus propias
fuentes); `docs/decisions.md` (ADR-030 a ADR-040); `docs/plan-90-dias.md` §2.1, §4.1, §6.1, §7.1 y
§8; `docs/security/auditoria-2026-09-26.md` (SEC-08, SEC-26, SEC-27, SEC-29, SEC-30, SEC-34);
`prisma/schema.prisma` y el código citado en la sección 1.
