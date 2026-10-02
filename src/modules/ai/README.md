# ai

Vende con IA, kit de anuncios, proveedores de IA por tarea, guardián de presupuesto, evaluaciones y
registro de tokens/costo (ADR-005, ADR-006, ADR-020, ADR-031, ADR-033, ADR-034, ADR-038).

**IA simulada en producción (ADR-038).** `AI_PROVIDER=mock` (por omisión) da textos de PLANTILLA,
sin modelo. Con `NODE_ENV=production` el arranque falla con `mock` salvo `ALLOW_SIMULATED_AI=true`
(build local o piloto cerrado, como decisión explícita); `simulatedAIAllowed(env)` en
`server/env-schema.ts`. Una ruta de `ai.routing` al simulador es el interruptor de apagado que
decide una persona ADMIN (`tasks/simulation.ts`, `tasks/availability.ts`):

- **Sin IA disponible** (producción, simulador y sin la bandera): la interfaz no ofrece generar
  («Por ahora escribe tu anuncio a mano» en el kit, «Por ahora publica tu producto a mano» en Vende
  con IA, en la página y en el mensaje de error) y los servicios lo comprueban ANTES de reservar
  (`assertAiAvailable` → `AIError("UNAVAILABLE")`), así nadie gasta su cuota en una llamada que no
  le daría nada. El simulador además falla solo (`simulatedOutput`) como última defensa.
- **Piloto** (con la bandera): cada texto se marca «Texto de ejemplo (IA simulada)», la lima de la
  IA no se usa (tampoco en el distintivo de Vende con IA) y la cuota se cuenta en «usos», también en
  el mensaje de límite alcanzado (`aiErrorMode`), nunca en «generaciones con IA».
- **La etiqueta es de cada registro, no de la ruta de hoy:** se decide con el proveedor que lo
  escribió (`AIRequest.provider`, `simulatedRecord`). Un kit del simulador sigue siendo de ejemplo
  aunque después se enrute a un modelo, y uno que escribió un modelo sigue siendo «Creado con ayuda
  de IA» aunque hoy la ruta vaya al simulador (sin IA disponible, un kit simulado guardado no se
  muestra; uno de un modelo, sí). Igual la propuesta de Vende con IA y su prellenado en
  /studio/productos/nuevo. En desarrollo y pruebas el simulador es lo normal y no se marca.

## Cómo se llama a la IA

```ts
const provider = await getAIProvider("ad_copy"); // ai.routing o variables de entorno
const { requestId } = await reserveAiRequest({
  userId, // null para tareas del sistema (sin cuotas por persona)
  feature: "CONTENT_GENERATION",
  provider: { id: provider.id, model: provider.model, promptVersion: task.promptVersion },
  input, // saneado: sin contactos ni costo
});
const { output, usage } = await provider.generate(task, taskInput); // ya validado con el esquema
// ...guardián de contenido, AIResponse con recordedCost(provider.model, usage)
```

Una tarea (`AITask`, `server/providers/ai/types.ts`) define prompt, esquema de Zod (se manda como
`json_schema` estricto), temperatura, tope de salida y su respuesta simulada. Tareas:
`tasks/sale-proposal.ts`, `tasks/ad-copy.ts`; `analyst_narrative` y `authenticity_text` las definen
sus módulos con la misma forma.

## Archivos

- `cost.ts`: precios por modelo (con fecha y fuente), costo máximo por llamada y costo registrado.
- `routing.ts` / `routing-store.ts`: `ai.routing` (lista blanca `ROUTABLE_MODELS`) y su lectura.
- `routing-decisions.ts`: cambiar la ruta (ADMIN, `/admin/ia`) o proponerla (IA CEO, con
  evaluación aprobada). Riesgo MEDIO. En /admin/ia una persona ADMIN también descarta una propuesta
  con su motivo (`discardAiRoutingProposal`: REJECTED, la ruta no cambia), y las que ya no
  cambiarían nada (la tarea ya usa ese modelo, por su ruta o por las variables de entorno;
  `proposalIsStale` en `routing.ts`) se cierran solas como REJECTED por el sistema, con el motivo,
  al cambiar la ruta y al abrir /admin/ia. La IA tampoco puede proponer lo que la tarea ya usa.
- `reservation.ts` + `budget-ledger.ts`: cuotas por persona (hora, día y mes: 10 y 30, ADR-033) y
  presupuesto global con candado ANTES de llamar (SEC-19). `budget-ledger.ts` recibe el cliente de
  Prisma para que lo use también el script de evaluación.
- `content-policy.ts`: productos que la IA no ayuda a vender (réplicas, armas, drogas, medicamentos
  con receta, vapeadores), antes de gastar una llamada.
- `proposal-numbers.ts`: rango de precio y presupuesto diario calculados por código (P2).
- `output-guard.ts`: revisa lo que escribió la IA contra los datos (SEC-28); reglas reutilizables.
  Quita toda frase con una marca de redacción («[costo]», «[teléfono]»…) y, en lo que ve quien
  compra, las piezas en existencia (en cifra o con letra) junto a un precio, aunque vaya en otra
  frase del campo («8 bolsas por $1,199» se lee como el precio del lote), antes de una palabra del
  producto o genérica («Hay 8 bolsas hechas a mano», «ocho piezas») o tras «tenemos / contamos con /
  quedan»; el lote junto a un precio («todas las bolsas por…», «… en total») y, en descripción y
  propuesta de valor, la primera persona del vendedor, en singular o plural («tengo», «tenemos»,
  «me salen», «nos cuestan»). «Quedan N» es urgencia. El título lo redacta la IA (singular); si no
  es del mismo producto o trae algo sin respaldo, va el nombre confirmado. Las mayúsculas las pone
  el código (`listingTitle`): la inicial, y las demás solo si el vendedor las escribió así (marcas)
  o son siglas. Con 2 piezas o más, los textos de respaldo dicen «$X por pieza».
- `sale-proposal.ts`: contrato de «Sube y vende», extracción determinista del texto (tras «vendo
  en / doy a / dejo en», el precio va justo después: «Vendo en Guadalajara 15 playeras» no es un
  precio) y `sellerTextForModel`: al modelo le llega el texto sin el costo ni el contacto, desde la
  palabra que los anuncia hasta el final de la cláusula (sin marcas que pueda copiar; en un texto
  sin puntuar se conservan los detalles de antes).
- `ad-kit/*`: kit de anuncios (datos P4, guardián con las afirmaciones que respaldan los datos,
  composición con el precio vigente y la liga con atribución, servicio y acciones). El precio lo pone
  el código siempre: sustituye `[PRECIO]` donde el modelo lo dejó y, si no lo dejó, encabeza la
  línea de datos; un anuncio nunca sale sin precio ni con uno viejo. Solo productos
  propios, activos, con existencias y visibles (uno oculto por moderación no lleva kit). La
  originalidad sigue a la ficha (`buyerAuthenticityOf` + `adKitAuthenticityClaim`): «original» solo
  con lo declarado de riesgo bajo (o aún sin revisión) o con el comprobante revisado; con riesgo
  medio («Revisa: …» en la ficha) o con el comprobante pedido o rechazado, el anuncio no lo afirma.
- `evals/*` y `scripts/ai-eval.ts`: evaluación de modelos por tarea (`pnpm ai:eval`).
- `personal-data.ts` y `retention.ts`: la entrada se guarda sin contactos ni cuentas y se redacta a
  los 90 días (SEC-29).

## Evaluar un modelo

```
pnpm ai:eval --task sale_proposal --provider mock                       # sin red ni costo
pnpm ai:eval --task ad_copy --model qwen/qwen3.5-9b --confirm-spend     # modelo de pago
```

El modelo corre en un servidor externo de pago por uso (`AI_BASE_URL`); nada se instala en la PC.
El reporte queda en `.data/evals/` y la corrida en `AIEvalRun` (se ve en `/admin/ia`). No se
programa: con un modelo de pago gasta dinero. Se corre al cambiar de modelo o de prompt y antes de
proponer una ruta (la evidencia vale 30 días).

Antes de `AI_PROVIDER=openai_compatible` en producción: evaluación aprobada de cada tarea con el
modelo elegido, el mismo límite de gasto en la consola del proveedor, nombre legal y país del
proveedor en el aviso de privacidad (hoy `[Proveedor de IA: nombre y país — pendiente]`, subir
`LEGAL_VERSIONS.privacyNotice`) y correo verificado (SEC-10).

Qué cuenta como evidencia para enrutar (`approvedEvidence`): TODAS las corridas concluyentes del
modelo con el prompt vigente en los últimos 30 días deben estar aprobadas (basta una reprobada; volver
a correr hasta que salga aprobada no sirve). No son concluyentes, y no cuentan en ningún sentido, las
corridas con errores del proveedor ni las parciales (`--limit`, que además nunca aprueban). El mínimo
de 25 casos se cuenta sobre los que respondió el modelo, no sobre los que bloqueó la política.

## Banderas, quién paga y proveedor de imágenes (ADR-043, ADR-044)

- **`features.ts` / `features-store.ts`:** las 20 funciones del plan «Ecosistema de IA» más las
  existentes, con fase y estado (`built` o `planned`). `ai.features` en `PlatformSetting`; solo
  ADMIN lo cambia en `/admin/ia` (`features-decisions.ts`, decisión HUMAN de riesgo ALTO). Los
  servicios llaman `requireFeature("virtualTryOn")` antes de gastar.
- **`AIRequest.funding`:** `PLATFORM` y `SYSTEM` consumen el presupuesto de subsidio (`ai.budget`);
  `USER_PAID` y `SELLER_PAID` se cobran del saldo (`billing/wallet.ts`) dentro de la misma
  transacción que la reserva (`reserveAiRequest({ funding, reserve })`) y no consumen presupuesto.
  Pruébatelo gratis además tiene tope diario global (`ai.budget.tryOnDailyCapUsd`, error
  `DAILY_CAP`). Cada función puede traer cuotas propias por hora y por día (`limits`).
- **Tareas nuevas:** `shopping_intent` (`stylist/need.ts`) y `look_copy` (`stylist/look-copy.ts`);
  sin evaluación todavía, así que solo usan el modelo predeterminado o el simulado (ADR-034).
- **Imágenes:** `server/providers/image` con la misma forma que el texto (`ImageTask`, simulador y
  adaptador compatible con OpenAI con `modalities: ["image","text"]`). Precio por imagen con fecha y
  fuente en `cost.ts` (`IMAGE_PRICES_USD_PER_IMAGE`); `maxCallCostMicrosUsd` de un modelo de imagen
  es el precio de una imagen. Modelo en `AI_IMAGE_MODEL`; sin él, el simulador.
