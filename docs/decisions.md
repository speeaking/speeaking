# Registro de decisiones (ADR)

Formato breve: decisión, motivo y estado. Una decisión nueva que contradiga otra la marca como
"Reemplazada".

| #       | Decisión                                                               | Estado                  |
| ------- | ---------------------------------------------------------------------- | ----------------------- |
| ADR-001 | Monolito modular en Next.js                                            | Aceptada                |
| ADR-002 | Versiones exactas fijadas y trampas conocidas                          | Aceptada                |
| ADR-003 | Mercado inicial México: MXN, es-MX, America/Mexico_City                | Aceptada                |
| ADR-004 | Better Auth para autenticación                                         | Aceptada                |
| ADR-005 | Proveedores por interfaz con implementación simulada                   | Aceptada                |
| ADR-006 | La IA redacta, el código calcula (P2)                                  | Aceptada                |
| ADR-007 | Datos verificables estructurados (P4)                                  | Aceptada                |
| ADR-008 | Proporción comercial del feed como parámetro con límites               | Aceptada                |
| ADR-009 | Eventos y atribución desde el día 1 (P5)                               | Aceptada                |
| ADR-010 | Sprint 1 solo texto e imagen; video en Sprint 2                        | Aceptada                |
| ADR-011 | Pagos simulados; una orden por vendedor; nunca retener fondos          | Aceptada                |
| ADR-012 | Una cuenta con capacidades progresivas (P6)                            | Aceptada                |
| ADR-013 | Campañas con canal; promoción interna como primer canal real (P7)      | Aceptada                |
| ADR-014 | «VendeIA» como nombre provisional interno; marca en una sola constante | Reemplazada por ADR-041 |
| ADR-015 | Herramientas de calidad y pruebas                                      | Aceptada                |
| ADR-016 | shadcn/ui con Base UI y CSS base copiado al repo                       | Aceptada                |
| ADR-017 | Base de datos de desarrollo: clúster propio con PostgreSQL 17 local    | Aceptada                |
| ADR-018 | Comunidades por nicho con contenido semilla honesto                    | Aceptada                |
| ADR-019 | Motor de automejora con autonomía por nivel de riesgo                  | Aceptada                |
| ADR-020 | IA autofinanciada: presupuesto ligado a ingresos y costo medido        | Aceptada                |

## ADR-001 · Monolito modular en Next.js

Una sola app con módulos por dominio y servicios independientes de Next. Se descartó el monorepo (sin
segunda app todavía) y el backend separado (dos despliegues, tipos duplicados). La app móvil futura
consumirá los mismos servicios vía `/api/v1`.

## ADR-002 · Versiones exactas

`save-exact` en `.npmrc` y sin rangos en `package.json`. Trampas verificadas el 2026-09-24:

- `prisma@latest` apunta a 8.0.0-rc (release candidate) mientras `@prisma/client` estable es 7.10:
  instalar siempre ambos fijados en la misma versión 7.x.
- `typescript@latest` es 7.0 y rompe typescript-eslint (`<6.1`): se fija TypeScript 5.9.3.
- ESLint 10 existe, pero `eslint-plugin-react`, `-import` y `-jsx-a11y` (usados por
  `eslint-config-next`) solo soportan ESLint 9: se queda en 9.39.5 aunque esté marcado como obsoleto.
  Revisar cuando `eslint-config-next` lo soporte.
- React se mantiene en 19.2.8 (la versión que fija la plantilla de Next 16.3.6).

## ADR-003 · México primero

País, moneda, locale y zona horaria viven en `src/config/site.ts`. Montos siempre acompañados de su
moneda para permitir la expansión a Colombia, Argentina, Chile, España y comunidades hispanas en EE. UU.

## ADR-004 · Better Auth

`next-auth` sigue publicando la v4 como estable y Auth.js pasó a manos del equipo de Better Auth.
Better Auth ofrece email + contraseña, sesiones en BD, límite de intentos y plugins (2FA, OAuth, bearer
para móvil) con adaptador de Prisma.

## ADR-005 · Proveedores por interfaz

IA, pagos, almacenamiento, email y procesamiento de medios se consumen mediante interfaces con una
implementación simulada. No se inventan APIs: los adaptadores reales se escriben con la documentación
oficial del proveedor cuando se conecte.

## ADR-006 · La IA redacta, el código calcula

Regla obligatoria. Margen, punto de equilibrio, CPA máximo, presupuestos, comisiones y beneficio se
calculan con funciones puras y probadas. La IA recibe esos valores y solo los explica. La UI marca toda
estimación como tal, con sus supuestos.

## ADR-007 · Datos verificables

Stock, entrega (recoger, local con zonas, nacional con costo y días), garantía, devoluciones, métodos de
pago y autenticidad declarada son campos estructurados. Un agente de IA solo puede citar estos datos.

## ADR-008 · Proporción comercial configurable

`FeedPolicy` (tope comercial, separación mínima, diversidad) se valida con Zod, tiene límites duros y se
guarda como `PlatformSetting` versionado. Valor inicial: 1 pieza comercial cada 4 posiciones como
máximo (≈ 1 de cada 3–4 piezas de contenido).

## ADR-009 · Eventos desde el día 1

`AnalyticsEvent` con tipo, entidad, superficie, posición, puntuación, versión del algoritmo y
publicación de origen. Se escribe en segundo plano y respeta la preferencia de personalización.

## ADR-010 · Video en Sprint 2

El modelo soporta `VIDEO` desde el inicio; la subida y transcodificación llegan en Sprint 2 con un
proveedor gestionado detrás de `MediaProcessor` (formatos de iPhone, costo y almacenamiento).

## ADR-011 · Pagos simulados

`MockPaymentProvider` en V0.1. Una orden por vendedor dentro de un checkout porque envío, comisión y
pago son por vendedor. Con pagos reales: reparto de fondos del procesador, asesoría fiscal previa.

## ADR-012 · Una cuenta, capacidades progresivas

No se elige tipo de cuenta al registrarse. "Vender" crea el `SellerProfile` en el momento;
`CreatorProfile` llega con la monetización.

## ADR-013 · Campañas con canal

`Campaign.channel`: INTERNAL, SHARE_KIT, META, GOOGLE, TIKTOK. En V0.1 "Lanzar" genera un kit de
difusión con links atribuidos; la promoción interna en el feed es el primer canal pagado.

## ADR-014 · Nombre provisional (reemplazada por ADR-041)

«VendeIA» fue el nombre provisional interno y «Vende con IA» la función del vendedor. La regla que
sigue vigente: cambiar `siteConfig` debe bastar para renombrar la plataforma. El 2026-09-29 la marca
pasó a ser **Estreno** y la función, **«Sube y vende»** (ADR-041).

## ADR-015 · Calidad y pruebas

- TypeScript estricto + `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames`.
- ESLint: reglas de Next + reglas con tipos (`no-floating-promises`, `no-misused-promises`,
  `await-thenable`, `consistent-type-imports`) + Prettier al final.
- Vitest con dos proyectos: `unit` (Node, `*.test.ts`) y `components` (jsdom, `*.test.tsx`). Vite 8
  resuelve los alias de `tsconfig` de forma nativa (sin `vite-tsconfig-paths`).
- Playwright con perfiles móvil (Pixel 7) y escritorio, usando el Chrome instalado para no descargar
  navegadores (`PLAYWRIGHT_CHANNEL` lo cambia en CI).
- React Compiler y rutas tipadas activados.
- pnpm con cuarentena de 24 h (`minimumReleaseAge`) contra paquetes comprometidos.

## ADR-016 · shadcn/ui con Base UI

shadcn 4 usa Base UI por defecto (librería mantenida activamente). El CLI agregaba el paquete `shadcn`
completo como dependencia de producción solo para un archivo CSS; ese CSS se copió a
`src/styles/shadcn-tailwind.css` (MIT) y el CLI se usa con `pnpm dlx shadcn@4.21.0`. Esto eliminó 217
paquetes del árbol. `cn` es el paquete oficial de shadcn (repo `shadcn-ui/cn`).

## ADR-017 · Base de datos de desarrollo

El servicio local de PostgreSQL 17 requiere la contraseña del superusuario. En lugar de pedirla, el
proyecto crea su propio clúster con los binarios de PostgreSQL 17 instalados (`.data/postgres`, puerto
5434, base `vendeia`, contraseña aleatoria guardada solo en `.env`). El servicio existente no se toca.
Para usar el servicio del sistema basta con cambiar `DATABASE_URL`.

## ADR-018 · Comunidades por nicho

Sin clientes no hay ventas. Comunidades curadas por la plataforma (humor, gaming, tecnología, comida,
música, deportes, mascotas, moda, hogar, autos, belleza, emprendimiento…) con contenido semilla. Reglas:
cuentas editoriales identificadas, contenido propio o con licencia, IA etiquetada, sin usuarios falsos
ni interacciones infladas. Cada comunidad se conecta con categorías de producto para el Commerce Engine.
Grupos creados por usuarios: después (requieren moderación).

## ADR-019 · Motor de automejora

La IA opera la mejora continua de la plataforma con autonomía según riesgo (ver `architecture.md`):
automática en parámetros de bajo riesgo con límites y reversión, experimental en riesgo medio y solo
propuesta con aprobación humana en precios, comisiones, políticas, dinero, código y datos. Toda acción
queda en `PlatformDecision`. Se optimizan métricas sanas; nunca patrones oscuros.

## ADR-020 · IA autofinanciada

La IA debe cubrir su costo y después generar utilidades que financien el crecimiento, siempre después
de que vendedores y creadores ganen. Desde el Sprint 1 cada solicitud de IA registra tokens y costo, y
pasa por un guardián de presupuesto (`ai.budget` en `PlatformSetting`). En Sprint 2 se agrega el libro
de plataforma (`PlatformLedgerEntry`) con ingresos y gastos para medir la cobertura
(ingresos ÷ costo de IA). El motor de automejora optimiza la cobertura eligiendo modelos por tarea,
caché y cuotas; los cambios de precios y comisiones requieren aprobación humana.

## Decisiones tomadas durante la implementación (2026-09-25)

| #       | Decisión                                                                                      | Estado   |
| ------- | --------------------------------------------------------------------------------------------- | -------- |
| ADR-021 | Subida de imágenes por `POST /api/uploads` (una por solicitud), no por Server Actions         | Aceptada |
| ADR-022 | Onboarding con cuestionario de 3 pasos: objetivos, comunidades, marcas e intención de compra  | Aceptada |
| ADR-023 | Pagos simulados por el mismo camino que un webhook real; reserva de stock de 30 min           | Aceptada |
| ADR-024 | Comisión de plataforma 0 % durante el piloto (parámetro `commerce.fees`, riesgo alto)         | Aceptada |
| ADR-025 | Better Auth 1.7.5 (1.7.6 bloqueada por la cuarentena de 24 h de pnpm)                         | Aceptada |
| ADR-026 | En desarrollo, el cliente de Prisma en caché se recrea si cambian los modelos del esquema     | Aceptada |
| ADR-027 | Paleta «rosa mexicano»: blanco y gris frío, tinta casi negra, rosa #E4007C, lima solo para IA | Aceptada |
| ADR-028 | Base de datos y cada conexión de Prisma en UTC; la zona de México solo al presentar           | Aceptada |

## ADR-021 · Subidas por ruta dedicada

Las Server Actions tienen un límite de 1 MB por defecto y no dan progreso por imagen. `POST
/api/uploads` exige sesión, límite de 60 subidas por hora, valida el contenido real con `sharp`,
re-codifica a WebP (sin EXIF/GPS) y devuelve un `mediaId`. Al publicar se verifica que cada imagen sea
de quien publica (evita adjuntar imágenes ajenas).

## ADR-022 · Cuestionario de onboarding

Pedido por producto: conocer a la persona desde el inicio. Tres pasos que se pueden saltar
(objetivos; comunidades, mínimo 3; marcas e "¿Buscas algo ahora?" con presupuesto). La intención
declarada vence en 30 días y es la señal más fuerte del Commerce Engine. Elegir "Vender" lleva directo
a Sube y vende. Todo se puede borrar desde Ajustes.

## ADR-023 · Pagos simulados realistas

`MockPaymentProvider` crea el pago y redirige a una "pasarela" propia; aprobar o rechazar llama a
`applyPaymentEvent`, el mismo código que usará el webhook real: evento único por proveedor
(idempotencia), transición solo desde PENDING, stock devuelto al rechazar o vencer, ingreso de comisión
en el libro de la plataforma al aprobar y evento `PURCHASE` con la publicación de origen.

## ADR-024 · Comisión 0 % en el piloto

La recomendación del MVP es no cobrar durante el piloto para demostrar beneficio. La comisión es un
parámetro validado (0–20 %); subirla es una decisión de riesgo alto que el motor de automejora solo
puede proponer.

## ADR-025 · Cuarentena de dependencias en acción

`better-auth@1.7.6` se publicó 13 horas antes de instalarla; pnpm la bloqueó (`minimumReleaseAge`) y
se usó 1.7.5. Es el comportamiento buscado: actualizar cuando cumpla 24 horas.

## ADR-026 · Cliente de Prisma y recarga en caliente

El cliente se guarda en `globalThis` para no abrir un pool por cada recarga; la llave incluye los
modelos del esquema para que, tras `prisma generate`, no se quede un cliente desactualizado (error real
encontrado en pruebas).

## ADR-027 · Paleta rosa mexicano

**Contexto.** El fundador rechazó la identidad «mercado cálido» (papel hueso, tinta café, jamaica y
acentos pastel) porque se veía «muy aesthetic o como viejo». Con el layout de la Revista ya aprobado
(ver [`design/rediseno-revista.md`](design/rediseno-revista.md)), se pintaron las mismas maquetas con
cuatro paletas: **jamaica eléctrico**, **noche neón**, **violeta vibrante** y **rosa mexicano**. El
fundador eligió rosa mexicano.

**Decisión.**

- Superficies blancas sobre gris frío (`#F6F7F9`), tinta casi negra (`#0F0F14`) y lienzo plano, sin
  degradados ni halos.
- Rosa mexicano `#E4007C` como marca, idéntico en claro y en oscuro. El texto rosa usa `primary-text`
  (`#C60C6D`, 5.7:1 en blanco) porque el rosa de marca apenas llega a 4.58:1 con blanco.
- Modo oscuro negro puro (OLED) con tarjetas `#101012`.
- Lima `#B7F652` **solo** para la IA.
- Titulares en Plus Jakarta Sans (tracking de −0.028em en los grandes) y texto en Figtree.
- Color por comunidad con las utilidades `community-*`, que leen `--hue` de la base de datos.

**Correcciones del crítico de diseño, aprobadas por el fundador.**

1. **Sin turquesa.** Junto al rosa se leía como TikTok o folclórico. «Unirme» usa el rosa suave
   (botón `variant="soft"`) y los estados positivos un verde limpio (`success`: `#137738` en claro,
   `#56D57B` en oscuro), AA en blanco y en negro.
2. **Croma dentro de sRGB.** Autos medía 4.38:1 porque su cian se salía de la gama y el navegador lo
   recortaba. Ahora el croma se limita tono por tono con una función lineal por tramos. La receta
   vive en `src/styles/community-tint.ts`, `pnpm tint` genera el CSS y
   `community-tint.test.ts` audita AA en los 360 tonos, en claro y en oscuro.
3. **Hogar** pasa del tono 110 (oliva, se veía café) al 160.
4. **La lima sigue reservada a la IA.** Se quitó del aviso de margen («Ganas…», que además dice
   «no es estimación de IA») y del aviso de producto publicado; ahora usan `success`.

**Consecuencias.**

- Se conservan todos los tokens de shadcn. Se agregan `primary-soft`, `primary-text`,
  `primary-strong`, `ink-2`, `line-strong` y `glass`, y se rehacen `success` y `destructive` (rojo,
  lejos del rosa).
- `--radius` es de 20 px, el radio de las tarjetas (`rounded-3xl` = `rounded-card`). El resto de la
  escala se deriva de ahí.
- Se regeneraron el favicon y los íconos de la PWA con el nuevo rosa.
- `Input` y `Textarea` tienen fondo `card` en claro para que se distingan sobre el lienzo gris.
- Ajuste a la receta de la maqueta: `--lift` se apaga desde h = 180, porque el coseno también
  aclaraba los violetas (Gaming, 285).
- Auditoría de accesibilidad (2026-09-25):
  - El anillo de foco es sólido (`ring-ring`, `outline-ring`). Al 50 % quedaba en 2.4:1 en claro y
    1.8:1 en oscuro. El botón primario separa el anillo con `ring-offset-2`.
  - El hover del botón primario usa `primary-strong` (blanco encima 6.1:1). Con `bg-primary/80`, el
    rosa se aclaraba y el texto quedaba en 3.9:1.
  - Los bloques de tinta grandes (IA, beneficio) ya no usan `bg-foreground`, que en oscuro se volvía
    un bloque blanco. Ahora son una isla oscura: `className="dark bg-card text-foreground"`.
  - El bloque del visitante es rosa sólido, como en la maqueta aprobada.
  - El botón `outline` fija `text-foreground`: dentro del cartel de comunidad, «Miembro» heredaba
    texto blanco sobre fondo claro (1.01:1).
  - Los avatares de persona sin foto no usan los tonos de la lima (105–135) ni del turquesa
    (160–215, que incluye el menta).
- Pendiente con el fundador: Hogar (160) queda a 5° de Emprendedores (165) y a 15° de Deportes (145),
  así que los tres verdes se parecen. Además, Autos (200) se ve cian junto al rosa, justo el par que
  la corrección 1 quiere evitar. Como es un dato de la semilla, necesita su visto bueno.

  **Resuelto (2026-09-25):** se repartieron los tonos para que las 12 comunidades se distingan y
  ninguna quede cian junto al rosa: Moda 20, Comida 45, Mascotas 70, Humor 95, Deportes 145,
  Hogar 170, Tecnología 230, Autos 255, Gaming 280, Emprendedores 305, Música 330 y Belleza 350.
  Los campos (`--input`) usan `line-strong` para verse mejor sobre blanco.

## ADR-028 · Base de datos y conexión en UTC

**Contexto.** El clúster de desarrollo heredó la zona de Windows (`America/Mexico_City`).
`@prisma/adapter-pg` manda y lee las fechas sin zona horaria, así que Postgres interpretaba cada fecha
como hora de México: todo lo escrito por Prisma quedaba 6 horas adelante. Prisma leía sus propios
datos bien, pero cualquier comparación en SQL con `now()` o con fechas de otra fuente se desfasaba.
Se detectó con los contadores «N nuevas» (F7).

**Decisión.**

- `createPrismaClient` abre cada conexión con `-c TimeZone=UTC`, sin importar la zona del servidor.
- El clúster de desarrollo usa `timezone = 'UTC'` (`scripts/dev-db.mts` y `ALTER DATABASE`).
- Los datos de desarrollo existentes se corrigieron una sola vez: se restaron 6 horas a las 66
  columnas `timestamptz` (México no tiene horario de verano desde 2022, así que el desfase era
  uniforme).

**Consecuencias.** Las fechas se guardan en UTC real y se presentan en `America/Mexico_City` solo en
la interfaz (`siteConfig.timeZone`). En producción, la base gestionada también debe ir en UTC.

## Decisiones de la corrección de seguridad (2026-09-26)

Tras la auditoría `docs/security/auditoria-2026-09-26.md`.

| #       | Decisión                                                                                              | Estado   |
| ------- | ----------------------------------------------------------------------------------------------------- | -------- |
| ADR-029 | CSP estricta con nonce por petición (`proxy.ts`), COOP/CORP `same-origin`, en modo de aplicación      | Aceptada |
| ADR-030 | Privacidad de la actividad y de «Gente de tus comunidades»; `userId` UUIDv7 públicos: riesgo aceptado | Aceptada |
| ADR-031 | Guardián de la IA: reserva atómica antes de llamar, cifras del código, contenido revisado, retención  | Aceptada |
| ADR-032 | Pagos simulados con falla cerrada en producción (resumen de SEC-01)                                   | Aceptada |

## ADR-029 · CSP con nonce

**Contexto.** Las páginas HTML no tenían Content-Security-Policy ni COOP/CORP (SEC-06). No había XSS
conocido, pero sin CSP cualquier regresión o dependencia comprometida ejecutaría scripts con la
sesión de la persona (Server Actions, datos ya renderizados).

**Decisión.**

- `src/proxy.ts` genera un nonce de 128 bits por petición y pone la política (`src/lib/csp.ts`) en la
  petición (de ahí Next toma el nonce para sus scripts) y en la respuesta. El cliente no puede fijar
  el nonce: la cabecera `x-nonce` se pisa siempre. El layout raíz pasa el nonce a next-themes (script
  que fija el tema antes de pintar) y al `CSPProvider` de Base UI.
- Política: `default-src 'self'`; `script-src 'self' 'nonce-…' 'strict-dynamic'` (más `'unsafe-eval'`
  solo en desarrollo, para las pilas de error de React); `style-src 'self' 'unsafe-inline'`;
  `img-src 'self' data: blob:`; `font-src 'self'`; `connect-src 'self'`; `object-src 'none'`;
  `base-uri 'none'`; `form-action 'self'`; `frame-ancestors 'none'`; `upgrade-insecure-requests` solo
  si `APP_URL` es https.
- `next.config.ts` agrega `Cross-Origin-Opener-Policy` y `Cross-Origin-Resource-Policy: same-origin`
  a todas las rutas (además de las cabeceras que ya había). `/media` conserva su CSP de sandbox y las
  API no llevan CSP de página.
- El optimizador de imágenes solo acepta `/media/**` sin query, sin orígenes remotos ni SVG (SEC-35).
- **Modo de aplicación desde el día uno**, no `Report-Only`: `tests/e2e/security-headers.spec.ts`
  recorre como visitante, registro, onboarding, inicio con sesión, producto, comunidad, Studio,
  Sube y vende, checkout y cambio de tema, y exige cero violaciones (evento
  `securitypolicyviolation` y consola), hidratación completa y que un `onerror` inyectado no corra.

**Riesgo aceptado.** `style-src 'unsafe-inline'`: la interfaz usa atributos `style` (tono de cada
comunidad, proporción y desenfoque de fotos) y sonner inyecta un `<style>` sin nonce; un nonce en
`style-src` desactivaría `'unsafe-inline'` y rompería todo eso. El CSS inyectado no ejecuta código.

**Consecuencias.** Todas las páginas se renderizan por petición (el layout lee las cabeceras): no hay
páginas estáticas ni ISR. Agregar un tercero (SDK de pagos, analítica, CDN de imágenes) es cambiar
`contentSecurityPolicy` y su prueba. Las rutas que el proxy no toca (`/api/*`, prefetch de
`next/link`) no llevan CSP; el 404 HTML de `/api/*` es estático y sin datos de la persona. La E2E corre
contra `pnpm dev` (que permite `'unsafe-eval'`) y también contra `pnpm build && pnpm start`
(modo CI), donde cualquier `eval` de una dependencia sí se bloquea: ahí apareció que Zod 4 sondea
`Function()` para compilar esquemas en cada página que valida en el cliente, así que
`src/instrumentation-client.ts` siembra `jitless` en su configuración global antes de que cargue
(sin traer Zod a todas las páginas). Pendiente: un endpoint `report-to` para recibir violaciones en
producción.

## ADR-030 · Privacidad de la actividad y de las sugerencias

**Contexto.** Los eventos «anónimos» se podían re-identificar por su metadata y su hora (SEC-16);
rechazar la personalización no desligaba lo anterior y el historial de búsqueda no se podía ver ni
borrar (SEC-27); «Gente de tus comunidades» revelaba a quién sigue una persona concreta (SEC-17); los
`userId` públicos son UUIDv7 (SEC-33).

**Decisión.**

- **Eventos anónimos de verdad** (`analytics/event.ts`): sin persona ni texto de búsqueda; metadata
  solo con llaves permitidas (conteos y categorías cortas, nunca `*Id` ni la razón del ranking, que
  sale de a quién sigue la persona); hora truncada a la hora; id aleatorio (UUIDv4, porque el UUIDv7
  por omisión lleva la hora al milisegundo); en las propuestas de IA (producto propio) sin la entidad.
- **Sin decisión no se liga:** antes de terminar el onboarding la actividad se guarda anónima.
- **Opt-out retroactivo:** desactivar la personalización en Ajustes desliga, en la misma transacción,
  toda la actividad previa con el mismo estándar (`anonymizeUserActivity`, un `UPDATE` en SQL).
- **Historial de búsqueda** visible y borrable en Ajustes.
- **Sugerencias:** los intermediarios de «La siguen personas que sigues» son solo seguidos mutuos que
  participan en las sugerencias (`discoverable`); una persona cuenta solo con al menos 2
  intermediarios distintos y la razón nunca dice cuántos.

**Riesgo residual (SEC-16/27).** Anónimo no es agregado: con poco volumen, producto + hora todavía
acota a pocas personas, y el orden físico de inserción (las impresiones de una página entran juntas)
no se oculta; la protección fuerte son contadores agregados por día. Un evento que ya leyó
«personalización activa» y se inserta justo después de desactivarla queda ligado (ventana de
milisegundos; se cierra leyendo el perfil con `FOR SHARE` en la misma transacción del insert).

**Riesgo residual (SEC-17).** Quien se sigue mutuamente con la víctima puede crear cuentas títere que
también se sigan con él y deducir a quién sigue la víctima. La corrección completa es un
consentimiento propio del intermediario (`Profile.useFollowsForSuggestions`, apagado por omisión), que
requiere migración: decisión pendiente del fundador.

**Riesgo aceptado (SEC-33).** Los `userId` que viajan en DTOs públicos (autor en el feed, vendedor del
producto, sugerencias, botón de seguir) son UUIDv7 y revelan la fecha y hora de alta de la cuenta.
Cambiarlos exige un `publicId` (o usar el `username`) en los DTOs y acciones de social, feed, catalog
y discovery. Es un dato de baja sensibilidad (muchas redes muestran «se unió en…»); se revisa antes
del lanzamiento público. La analítica anónima ya no guarda horas exactas.

**Consecuencias.** Los textos de consentimiento de «Aparecer en sugerencias» y el aviso de privacidad
cambiaron: sus versiones suben a `2026-09-26` (`LEGAL_VERSIONS`).

## ADR-031 · Guardián de la IA

**Contexto.** El presupuesto de IA tenía una carrera (contar y crear en pasos separados), no contaba
las llamadas fallidas y un solo usuario podía agotar el pool global (SEC-19). La salida solo se
validaba en forma (SEC-28) y la entrada guardaba texto libre sin retención (SEC-29). Todo es latente
mientras el proveedor sea simulado, pero es bloqueador antes de uno de pago.

**Decisión.**

- **Reservar antes de llamar** (`ai/reservation.ts`): cuotas por persona por hora y por día con el
  limitador atómico (`rateLimit`; cuentan todos los intentos) y, dentro de una transacción con
  `pg_advisory_xact_lock`, el presupuesto global del mes: costo real de lo respondido + costo máximo de
  cada solicitud pendiente o fallida + el costo máximo de esta. Si no cabe: `BLOCKED_BUDGET` y un
  mensaje sin detalles internos que ofrece publicar a mano.
- **Costo máximo por llamada** = tokens tope (`AI_MAX_INPUT_TOKENS`, `AI_MAX_OUTPUT_TOKENS`) × precio;
  un modelo sin precio no se llama. Timeout de la llamada en el servicio (`AI_CALL_TIMEOUT_MS`).
- **Cifras del código:** el rango de precio y el presupuesto diario los calcula el código y reemplazan
  lo que devuelva la IA antes de validar; la IA solo redacta su explicación, marcada como suya.
- **Guardián de contenido** (`ai/output-guard.ts`): quita frases con contacto, datos o instrucciones de
  pago, urgencia inventada, afirmaciones que exigen un dato P4 (garantía, originalidad, envío gratis,
  devoluciones, tiempos, entregas, descuentos, meses sin intereses) y montos o piezas distintos de los
  confirmados, también en otra moneda; revisa el texto normalizado (NFKC, sin caracteres invisibles) y
  las cifras sin el nombre del producto; usa el nombre confirmado por el vendedor. Se aplica al generar
  y otra vez al prellenar el producto. Es una lista de patrones (mitiga, no garantiza): el vendedor
  revisa todo antes de publicar.
- **Retención:** el texto se guarda sin correos, teléfonos, ligas ni cuentas; a los 90 días la entrada
  se reemplaza por `{ redacted: true }`. Hoy la limpieza es oportunista (al usar «Sube y vende», a lo
  más cada hora por proceso): sin uso, nada la dispara. Falta una tarea programada que llame
  `redactExpiredAiInputs` para cumplir los 90 días que promete el aviso. **Resuelto (2026-09-26):**
  es un paso de la operación diaria (`pnpm ops:daily`, `/api/cron/daily`); hay que programarla en
  el hosting (ver `architecture.md` → Operación).

**Adenda (2026-10-02): lo que dejó pasar la reevaluación en vivo.** Tras el arreglo del costo y del
precio de lote (`sale-proposal@5`), una reevaluación con el modelo real dejó huecos menores en
«Sube y vende». Se cerraron con pruebas primero y sin tocar rutas, precios, cuotas ni costos:

- **Lote con pronombre:** con 2 piezas o más, «Llévatelas por $1,199», «Te las dejo en…» o «Todas
  a $1,199» se leen como el precio de todas. No cuentan si el precio se dice por pieza ni si el
  pronombre es del nombre en plural de UN producto, según su género (tenis, botas, audífonos:
  «Tenis Nike: llévatelos»; «Funda para audífonos: llévatelas» sí cuenta).
- **Urgencia suave y escasez falsa:** «No te quedes con las ganas», «Aprovecha mientras haya», «es
  el único disponible» y «único par», además de la escasez que ya quitaba la revisión del video
  («Única pieza», «solo queda una»), con cualquier existencia: el texto puede quedarse aunque el
  stock suba. «Pieza única» (cada una es distinta), «una única pieza de piel» o «solo hay una talla»
  no.
- **Voz del vendedor** en descripción y propuesta de valor: también posesivos y quien lo hace
  («nuestras bolsas», «por mí en mi taller», «las hago yo misma»). «Mi» antes de mayúscula es una
  marca («Mi Band»).
- **Título de la IA:** pasa las mismas reglas que la descripción (voz del vendedor, lote aunque no
  traiga precio) y, con 2 piezas o más, no va en plural («Aguas de jamaica»). Si la IA copió tal
  cual el nombre del vendedor, es suyo y no cuenta como frase quitada.
- **Hallazgos con su motivo:** existencias y lote cuentan como `stock` y la voz del vendedor como
  `voice` (antes, `number`). El aviso de la propuesta dice el motivo real, no «cifras distintas a
  las tuyas», y la evaluación cuenta `stock` como falla del caso y del veredicto («Existencias o
  precio de todas», debe ser 0): antes no veía una lectura de lote que el guardián quitaba.
- **Lector y título:** la cantidad con letra («Tengo ocho cojines») se lee y sale del nombre (con
  «ocho» en el nombre, el guardián no la contaba); «tres leches» sigue siendo un producto. Una lista
  corta de marcas y sus líneas fija su escritura («Tenis Nike Air Max», «Bocina JBL Flip 6») y una
  letra que es nombre se queda («Vitamina E»).
- **Llamados sin pronombre:** «Haz tu pedido aquí» y «Aparta aquí». Ni «Aparta el tuyo» ni «Pídelo
  aquí» (el de `@6`) concuerdan con «Bolsa…». Cambia la regla común, así que suben
  `sale-proposal@7` y `ad-copy@4`; el peor caso de entrada queda en ≈ 3,189 de 3,200 tokens. Las
  corridas con las versiones anteriores ya no respaldan un cambio de ruta: hace falta una nueva.
- **Salida fuera del esquema:** el registro dice qué campos fallaron y por qué («ctas.3 (too_big)»),
  sin su contenido; la evaluación lo repite. Una de 10 llamadas en vivo falló así sin pista.

Sigue siendo una lista de patrones: mitiga, no garantiza.

**Pendiente antes de un proveedor de pago.** El adaptador real debe mandar `max_tokens` y el timeout;
exigir correo verificado (SEC-10); nombrar al proveedor en el aviso de privacidad (encargado, país,
sin entrenamiento ni retención); decidir si se aparta parte del presupuesto para vendedores con ventas.

## ADR-032 · Pagos simulados con falla cerrada

Resumen de la corrección de SEC-01 (la implementa el módulo de pagos). `PAYMENT_PROVIDER` solo acepta
proveedores conocidos (hoy `mock`); en producción el arranque falla con el simulador salvo
`ALLOW_SIMULATED_PAYMENTS=true`, una decisión explícita para un piloto cerrado. El simulador tampoco se
crea en tiempo de ejecución si no está permitido, y su pasarela y su acción responden 404. Un pago
simulado no genera ingreso en el libro de la plataforma (no sube el presupuesto de IA), el vendedor lo
ve marcado como «Pago simulado» (sin poder enviarlo ni entregarlo) y el comprador ve que no se cobra
nada. Con un proveedor real, un
pedido pasa a pagado solo por webhook con firma verificada, nunca por una acción del navegador.

## Decisiones de autonomía, confianza y operación (2026-09-26)

| #       | Decisión                                                                                                           | Estado   |
| ------- | ------------------------------------------------------------------------------------------------------------------ | -------- |
| ADR-033 | Decisiones del piloto delegadas por el fundador (zona, nichos, cobro por terceros, IA por API, moderación)         | Aceptada |
| ADR-034 | Proveedor de IA por API compatible con OpenAI, modelo por tarea con evaluación y kit de anuncios                   | Aceptada |
| ADR-035 | Rol de equipo en `Profile.role`; `/admin` responde 404 a quien no es ADMIN; el rol solo se da desde la terminal    | Aceptada |
| ADR-036 | Autenticidad: riesgo por reglas, una fila por producto, comprobante ligado al artículo; nunca acusar ni certificar | Aceptada |
| ADR-037 | Impresiones visibles (T5) aceptadas solo si la pieza se sirvió; el motor decide solo con personas con sesión       | Aceptada |
| ADR-038 | IA en producción: proveedor real o IA simulada solo con `ALLOW_SIMULATED_AI=true` (piloto cerrado)                 | Aceptada |
| ADR-040 | Hosting que escala solo: Vercel Pro + Neon Launch + Cloudflare R2 privado; migraciones en el build de producción   | Aceptada |

## Decisiones de marca, diseño sereno, estilista y autofinanciamiento (2026-09-29)

| #       | Decisión                                                                                                             | Estado                        |
| ------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| ADR-041 | Marca **Estreno** (sin «IA» en el nombre); «Sube y vende» para la función del vendedor; ADR-014 reemplazada          | Marca reemplazada por ADR-070 |
| ADR-042 | Diseño sereno: una sola acción principal por pantalla, color solo como acento, tintes de comunidad suaves            | Aceptada                      |
| ADR-043 | Núcleo de IA: funciones como módulos con bandera, proveedor de imágenes por interfaz, caché, cuotas por función      | Aceptada                      |
| ADR-044 | Autofinanciamiento: saldo en pesos, precio comunitario por volumen, pruebas gratis con tope, patrocinio del vendedor | Aceptada                      |
| ADR-045 | «Pruébatelo»: la foto es de la persona; consentimiento explícito, privada, 30 días, borrable; siempre «simulación»   | Aceptada                      |

## ADR-033 · Decisiones del piloto (delegadas por el fundador)

**Contexto.** El plan de 90 días (`plan-90-dias.md`, §8) pedía 17 decisiones. El 2026-09-26 el fundador
las dejó a consideración del equipo, con dos instrucciones propias: **los pagos no se tocan por ahora**
y **serán solo por terceros y en persona** (la plataforma no procesa dinero), y **la IA debe
automejorarse**.

**Decisión.**

| #   | Tema                       | Decisión                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Tiempo del fundador        | Mientras no se confirme tiempo completo, meta honesta: 50 vendedores en 12 semanas y 100 en la semana 16. Se ajusta con las horas reales.                                                                                                                                                                                                                                                                                                               |
| 2   | Zona                       | Ciudad de México (confirmado por el fundador). Propuesta por defecto: Benito Juárez, Coyoacán y Cuauhtémoc (contiguas, con mucha venta informal en línea, emprendedoras de comida, moda y belleza, y hogares con mascotas). Se ajusta a las alcaldías donde el fundador pueda estar en persona.                                                                                                                                                         |
| 3   | Nichos                     | Comida casera y repostería; moda y belleza de emprendedoras; mascotas.                                                                                                                                                                                                                                                                                                                                                                                  |
| 4   | Cobro                      | Pago directo al vendedor, por terceros o en persona (lo decidió el fundador). Comisión 0 %. El código de pagos no se modifica en esta etapa.                                                                                                                                                                                                                                                                                                            |
| 5   | Entidad legal              | El fundador pide 3 cotizaciones; se decide con el asesor antes del vendedor 11.                                                                                                                                                                                                                                                                                                                                                                         |
| 6   | IA: gasto                  | Modelo abierto (Qwen 3.5) **pagado por uso** en un proveedor con API compatible con OpenAI (p. ej. OpenRouter: Qwen3.5-9B a US$0.08 / US$0.13 por millón de tokens, ≈ US$0.0003 por generación [estimación]). Rentar un servidor con GPU (Hetzner GEX45 ≈ €214 al mes + €209 de alta; RunPod L4 ≈ US$0.39 la hora) solo conviene con cientos de miles de generaciones al mes. Tope inicial de US$50 al mes; cuotas por vendedor: 30 al mes y 10 al día. |
| 7   | Crecimiento                | $10,000 MXN al mes desde la semana 5. **Requiere la tarjeta del fundador: nada se gasta en automático.**                                                                                                                                                                                                                                                                                                                                                |
| 8   | Tope de 90 días            | ≈ $52,000 MXN más asesoría, en una tarjeta separada (lo ejecuta el fundador).                                                                                                                                                                                                                                                                                                                                                                           |
| 9   | Proveedor de IA            | Enrutador por tarea con evaluación: el modelo abierto más barato que pase la evaluación (0 cifras inventadas, JSON válido, ≥ 90 % de categoría correcta); Claude Haiku 4.5 como referencia de calidad. Como el modelo es abierto, se puede pasar a un servidor propio sin cambiar código cuando el volumen lo justifique.                                                                                                                               |
| 10  | Hosting                    | Vercel + Neon + R2. La IA va por API (sin servidor con GPU propio en el piloto).                                                                                                                                                                                                                                                                                                                                                                        |
| 11  | Contenido de arranque      | Piezas curadas con fecha real + ≈ 20 por nicho, solo fotos con licencia.                                                                                                                                                                                                                                                                                                                                                                                |
| 12  | Onboarding con 1 comunidad | Experimento de riesgo medio, solo en llegadas con `?unirse=`.                                                                                                                                                                                                                                                                                                                                                                                           |
| 13  | Reversión del comercio     | Revertir si las visitas a producto por vendedor activo caen más de 15 %.                                                                                                                                                                                                                                                                                                                                                                                |
| 14  | Moderación                 | Cola automática (reportes y revisión de autenticidad) + revisión del fundador en 24 h hábiles.                                                                                                                                                                                                                                                                                                                                                          |
| 15  | Tope por pedido            | $3,000 MXN como recomendación para vendedores nuevos (sin tocar el código de pagos).                                                                                                                                                                                                                                                                                                                                                                    |
| 16  | Nombre e IMPI              | Búsqueda en el IMPI antes de salir de los 15 vendedores fundadores.                                                                                                                                                                                                                                                                                                                                                                                     |
| 17  | Indexación y comisión      | Ninguna en estos 90 días.                                                                                                                                                                                                                                                                                                                                                                                                                               |

**Automejora (instrucción del fundador).** Se construye el motor completo: métricas diarias,
analista, propuestas con nivel de riesgo, experimentos, aplicación automática de lo de riesgo bajo
dentro de límites y reversión automática. El umbral estadístico de tráfico lo aplica el código (no se
decide con ruido). **Pagos, precios, comisiones y gasto quedan fuera de su alcance.**

**Consecuencias.** Las decisiones 1, 2, 5, 7 y 8 necesitan acciones o datos del fundador; el resto se
ejecuta en el código y la operación.

## ADR-034 · Proveedor de IA por API, modelo por tarea y evaluaciones

**Contexto.** ADR-033 (#6 y #9) eligió un modelo abierto pagado por uso en un servidor EXTERNO con API
compatible con OpenAI (nada se instala en la PC del fundador), con un enrutador por tarea que use el
modelo más barato que pase la evaluación. Faltaban el adaptador real, la tabla de precios de modelos
abiertos, el ajuste de rutas, las evaluaciones y el primer uso nuevo (kit de anuncios).

**Decisión.**

- **Adaptador sin SDK** (`server/providers/ai/openai-compatible.ts`): `POST {AI_BASE_URL}/chat/completions`
  con `response_format: json_schema` estricto (generado del esquema de Zod de la tarea, sin
  `minLength`/`pattern`: Zod los exige al recibir), `max_tokens` y una revisión del tamaño de la
  entrada ANTES de llamar (el costo nunca pasa de lo reservado, ADR-031). Plazo total con
  `AbortController` y hasta 2 reintentos con espera creciente solo ante 429 o 5xx (respeta
  `Retry-After`); un corte de red o un plazo vencido no se reintenta porque pudo cobrarse. La llave
  vive en un campo privado y ningún error lleva la llave ni los cuerpos. Con OpenRouter se pide
  `data_collection: "deny"` y `require_parameters: true`; otros servidores (DeepInfra, Together,
  vLLM u Ollama en un servidor rentado) no reciben campos que no conocen.
- **Tareas, no chat** (`AITask`): cada módulo define prompt, esquema, temperatura, tope de salida y
  su respuesta simulada; el proveedor solo transporta y valida. Tareas: `sale_proposal`, `ad_copy`,
  `analyst_narrative`, `authenticity_text`. `MockAIProvider` sigue siendo el predeterminado y el
  interruptor de apagado.
- **Costo:** precios con fecha y fuente en `ai/cost.ts` (Qwen3.5-9B: US$0.08 / US$0.13 por millón en
  OpenRouter; Claude como referencia). Un modelo sin precio no se llama; si aun así llegara una
  respuesta, se registra una cota superior marcada como desconocida, nunca 0. Si el proveedor no
  informa el uso, se estima y se marca.
- **Privacidad (H3):** el costo del vendedor nunca sale hacia el proveedor: no va en los datos y se
  quita del texto libre («me costaron $2,400» → «me costaron [costo]»), igual que correos,
  teléfonos, ligas y cuentas. Además, cualquier monto en pesos igual al costo confirmado por pieza o
  al costo total se quita aunque ninguna palabra lo anuncie («di $24,000 por las 10»). Desde
  `sale-proposal@5` (2026-10-02) al modelo no le llega ni la marca: de la cláusula se quita desde la
  palabra que anuncia el dato («me salen en», «mándame whats al») hasta su final, o la cláusula
  entera si ninguna lo anuncia (`sellerTextForModel`), porque un modelo pequeño copió «Me salen en
  [costo] cada una» a la descripción pública; en un texto sin puntuar se conserva lo de antes (los
  detalles del producto). El guardián además quita cualquier frase con una marca.
- **Enrutador `ai.routing`** (`PlatformSetting`, esquema con lista blanca `ROUTABLE_MODELS`, todos con
  precio): tarea → { proveedor, modelo }; sin ruta, las variables de entorno. El servidor y la llave
  son los de `AI_BASE_URL`/`AI_API_KEY`. Cambiarlo es riesgo MEDIO: una persona ADMIN lo aplica en
  `/admin/ia` (decisión HUMAN APPLIED con valor anterior y nuevo) y la IA CEO solo lo propone
  (`proposeAiRoutingChange`, decisión PROPOSED) con una evaluación aprobada como evidencia. Solo se
  enruta a un modelo de pago si tiene una evaluación aprobada de los últimos 30 días con el prompt
  vigente; las tareas sin evaluación (`analyst_narrative`, `authenticity_text`) solo usan el modelo
  predeterminado o el simulado.
- **Evaluaciones** (`pnpm ai:eval`, `evals/*.jsonl`, `ai/evals/*`): casos ficticios de vendedores
  mexicanos (35 de propuesta, 32 de anuncios) con los difíciles: sin costo, marcas, «réplica»,
  prohibidos, montos y cantidades enormes, instrucciones inyectadas en el texto. Se mide la salida
  CRUDA del modelo (antes del guardián). Para aprobar: el archivo de casos COMPLETO (una corrida con
  `--limit` nunca aprueba), ≥ 25 casos que respondió el modelo (los bloqueados por la política no
  cuentan), JSON válido en todos, 0 cifras que no estén en los datos (P2), 0 afirmaciones sin
  respaldo (P4), 0 urgencia, 0 contacto o pago por fuera, todo en español, ≥ 90 % de categoría
  correcta (o de anuncios que hablan del producto) y la política de productos sin fallas (misma
  regla que la esperada). Cada llamada pasa por el presupuesto global (`MODEL_EVALUATION`) y el
  resultado queda en `AIEvalRun` (con la huella SHA-256 del archivo de casos) y en `.data/evals/`.
  Con un modelo de pago el script exige `--confirm-spend` y dice antes el costo máximo.
- **Evidencia sin escoger resultados:** para enrutar cuentan TODAS las corridas concluyentes del
  modelo con el prompt vigente en los últimos 30 días; basta una reprobada para no aprobarlo
  (repetir hasta que salga aprobada sería escoger el resultado, y los criterios son de cero fallas).
  Las corridas con errores del proveedor o parciales no son concluyentes. El reporte dice el
  intervalo de confianza (Wilson, 95 %) de la categoría y que «0 fallas en ~30 casos» solo acota la
  tasa real a ≈ 3/n (regla de tres): con estas muestras, la evaluación descarta modelos malos, no
  prueba que uno sea perfecto.
- **Política de productos** (`ai/content-policy.ts`): la IA no ayuda a vender réplicas, armas,
  drogas, medicamentos con receta ni vapeadores; se revisa antes de gastar una llamada. Son patrones
  conservadores (mitigan, no moderan).
- **Cuotas por persona (ADR-033 #6):** 10 generaciones al día y 30 al mes, sumando todas las funciones
  de IA (`maxRequestsPerUserPerDay`, nuevo `maxRequestsPerUserPerMonth` en `ai.budget`). La mensual
  se cuenta dentro del candado del presupuesto (sin carreras). Las tareas del sistema reservan sin
  persona: sin cuotas, dentro del presupuesto global.
- **Kit de anuncios** (Studio → Contenido): 4 textos (WhatsApp, Facebook, Instagram con hasta 8
  etiquetas y un titular) para un producto propio y activo. La IA escribe `[PRECIO]` y el código pone
  el precio vigente, las frases de datos (envío, entrega, garantía, devoluciones, originalidad
  declarada) y la liga con atribución (`?ref=compartir&canal=…`). Un guardián propio solo deja las
  afirmaciones que respaldan los datos estructurados del producto. Se guarda en
  `AIRequest`/`AIResponse` (`CONTENT_GENERATION`) y, cada vez que se muestra, se vuelve a revisar
  con el guardián contra los datos VIGENTES y se compone con ellos (una promesa que dejó de aplicar,
  como un envío gratis que el vendedor quitó, ya no se muestra ni se copia); si el producto cambió,
  se avisa. Un producto que hoy no se puede comprar no muestra su kit. Hoy la visita se atribuye
  por `ref=compartir` («Links compartidos» en el Studio); el parámetro `canal` viaja en la liga pero
  la página del producto aún no lo registra, y la interfaz no promete atribución por canal.
- **Transporte:** sin redirecciones (`redirect: "error"`) y la ruta del servidor se arma sobre la
  URL base (un `AI_BASE_URL` raro no puede mandar la llave a otro host).

**Consecuencias.** Antes de poner `AI_PROVIDER=openai_compatible` en producción: correr la evaluación
de cada tarea con el modelo elegido, poner el mismo límite de gasto en la consola del proveedor,
nombrar al proveedor y el país en el aviso de privacidad (sube `LEGAL_VERSIONS.privacyNotice`) y
exigir correo verificado (SEC-10). La evaluación es de patrones: aprueba lo medible, no garantiza la
calidad; el vendedor revisa todo antes de publicar.

## ADR-035 · Rol de equipo, `/admin` con 404 y `make-admin`

**Contexto.** La moderación, el Centro de decisiones y la configuración de la IA necesitan un rol de
equipo (`plan-90-dias.md` §2.1: «rol de equipo con 2FA»). Better Auth escribe la tabla `users`
(registro, `update-user`, hooks) y su plugin `admin` usa un `role` de texto propio: un rol ahí
quedaría al alcance de caminos que no controlamos. Además, un área de administración que redirige a
«Iniciar sesión» confirma que existe.

**Decisión.**

- **El rol vive en el perfil:** `Profile.role` (`UserRole`: USER | ADMIN, por omisión USER). Ningún
  camino de Better Auth lo toca y ninguna acción, formulario ni DTO de escritura lo expone. Exige
  perfil: una cuenta que no terminó la bienvenida no puede ser ADMIN.
- **Solo desde la terminal:** `scripts/make-admin.ts <correo> [--revoke]`. Se niega con una base que
  parezca de producción (`NODE_ENV=production` o un servidor que no es esta máquina) salvo con
  `--allow-production`. El rol se lee de la base en cada petición: darlo o quitarlo aplica en la
  siguiente carga, sin cerrar sesiones.
- **404 como el de una ruta inexistente:** a quien no es ADMIN, con o sin sesión, las páginas de
  `/admin/*` le responden 404 con la misma página «No encontramos esta página», sin redirigir a
  iniciar sesión ni título o metadatos propios (`tests/e2e/admin-area.spec.ts` revisa el estado, ese
  encabezado y el título; no compara el HTML byte a byte). Por eso `/admin` no está en
  `PROTECTED_PREFIXES` ni tiene regla propia en `proxy.ts`. Ocultar el área reduce el ruido, no es la
  barrera: el route handler de fotos de comprobante (`/admin/moderacion/prueba/<id>`) responde un 404
  en texto plano, distinto del HTML, así que un visitante atento puede deducir que el área existe.
- **Tres barreras, todas obligatorias:** páginas y layouts con `requireAdmin()` (cada página lo
  vuelve a llamar: los layouts no se renderizan al navegar entre páginas hermanas); Server Actions y
  route handlers con `getAdminViewer()` (error genérico), Zod y `rateLimit` por persona (scope
  `admin.<acción>` → llave `admin.<acción>:user:<uuid>`; `rateLimitKey` rechaza `:` en el scope);
  servicios con `assertAdmin(actorUserId)`, que vuelve a leer el rol.
- **Huella:** `PlatformDecision.approvedById`, `Report.resolvedById` y
  `AuthenticityCheck.reviewedById`; las páginas llevan `noindex`.

**Riesgo aceptado (piloto).** Sin segundo factor ni reautenticación reciente: una sesión ADMIN robada
tiene acceso completo al área hasta que se revoque. Se mitiga con pocas personas ADMIN, sesiones
revocables y acciones con límite de frecuencia. No hay bitácora de cambios de rol (solo el script,
que exige acceso a la terminal y a la base).

**Pendiente.** 2FA para ADMIN y reautenticación para aprobar riesgo alto (antes de abrir a la zona);
bitácora de cambios de rol; suspender cuentas que no venden (hoy solo existe `SellerProfile.status`).

## ADR-036 · Autenticidad: riesgo, nunca acusación ni certificación

**Contexto.** En la venta informal en línea en México abundan las réplicas (P14). La plataforma debe
proteger a quien compra sin difamar a quien vende (no puede saber si algo es falso) y sin prometer
autenticidad (no la puede garantizar). La Ley Federal de Protección a la Propiedad Industrial protege
las marcas registradas.

**Decisión.**

- **Mide riesgo, no culpa.** Reglas deterministas (P2, `trust/rules.ts`, `RULES_VERSION` v2) con
  mensajes en español claro. Puntaje = suma de pesos con tope 1 → LOW, MEDIUM (≥ 0.3) o HIGH
  (≥ 0.6). Nunca dice «falso» ni «original»: quien compra ve «Autenticidad sin verificar»,
  «Comprobante revisado por Estreno» o una nota neutral («Revisa: …»).
- **Una fila por producto** (`AuthenticityCheck.productId` único) con la revisión vigente, que se
  actualiza en su lugar. La cola y la página del producto necesitan el estado actual sin
  `DISTINCT ON` ni filas viejas que compitan; la huella queda en `rulesVersion`,
  `reviewedById`/`reviewedAt`, los reportes y la bitácora (`moderation.*` y `authenticity.*` en
  `PlatformDecision`, fuera del Centro de decisiones).
- **Precio contra la mediana por tienda.** Se compara contra la mediana de al menos 5 TIENDAS
  distintas (productos parecidos, activos y visibles de otras tiendas); cada tienda aporta un solo
  precio, la mediana de los suyos, para que una cuenta con muchas publicaciones no decida la
  mediana. Sin 5 tiendas, contra un precio de referencia aproximado (`reference-prices.ts`, ajustable
  con `trust.referencePrices`).
- **Palabras de imitación con negación.** «réplica», «calidad original», «AAA», «1:1» o «tipo X»
  pesan mucho junto a una marca y poco sin ella; las negadas («no es réplica», «cero clones», «ni
  AAA»: un negador antes de la frase, con a lo más 4 palabras de relleno en medio) no cuentan.
- **Reportes con tope.** Cuentan personas distintas por posible falsificación (abiertos o con acción;
  los descartados no), con pesos 0.1, 0.2 y 0.25 (3 o más): solos nunca llegan a riesgo medio. Van a
  la cola del equipo y refuerzan otras señales, también antes de revisarse: sumados a otra regla sí
  pueden subir el nivel (p. ej. precio algo bajo 0.2 + 3 reportes = 0.45, riesgo medio) y con él lo
  que ve quien compra (la nota «Revisa: …» o, si llega a alto, el pedido de comprobante). Por eso
  cuentan personas y no reportes, y descartar un reporte lo quita del puntaje.
- **La IA solo refuerza** (`trust.aiSignal.enabled`, apagada por omisión): peso máximo 0.15; sin
  señales de reglas no suma y nunca lleva sola a riesgo alto. En producción, la IA simulada nunca
  suma riesgo.
- **El comprobante va ligado al artículo.** Solo a lo declarado original se le pide comprobante (con
  riesgo alto sin declararse original se pide corregir la publicación a «genérico»). Verificar exige
  el comprobante, las mismas fotos que vio el equipo (`proofIds`), que sigan existiendo y que la
  publicación no use palabras de imitación. El sello se pierde si el vendedor cambia QUÉ vende
  (título, etiquetas, categoría o condición) o si al reevaluar sube el puntaje de riesgo (p. ej. un
  precio mucho menor); cambiar existencias, o un precio que no sube el riesgo, no lo quita. Las fotos
  de prueba son privadas (vendedor y ADMIN) y el recolector de huérfanas no las toca.
- **Las decisiones del equipo no se deshacen solas:** reevaluar no borra un «verificado» mientras el
  riesgo no suba ni cambie el artículo, ni un «rechazado» mientras no se vuelva a declarar original.

**Consecuencias.** Los términos incluyen la cláusula de falsificaciones y explican que la revisión
«mide riesgo: no acusa a nadie ni certifica nada» (`LEGAL_VERSIONS.terms` = 2026-09-26). La versión
2026-09-27 de los términos agrega la señal opcional de IA y ocultar o restaurar publicaciones, y la
del aviso de privacidad explica la revisión, las fotos de comprobante, la señal de IA, qué guardan
los reportes y las acciones del equipo; quien aceptó una versión anterior ve un aviso para volver a
aceptar (`identity/consent-refresh.ts`, ver `architecture.md` → Privacidad). Cambiar
pesos, umbrales o reglas exige subir `RULES_VERSION` y reevaluar el catálogo
(`pnpm trust:reevaluate`). Las listas de marcas y palabras mitigan, no garantizan; con poco volumen
casi nunca habrá 5 tiendas comparables y pesará más la referencia aproximada.

**Nota: comprobantes reemplazados (conservación pendiente de decisión legal).** Cada envío deja una
fila por foto en `authenticity_proof_history` (`submittedAt`, y `replacedAt` cuando otro envío lo
reemplaza; ver `data-model.md`). Reemplazar un comprobante no libera las fotos anteriores, para
poder auditar qué vio el equipo al verificar o rechazar: siguen privadas (vendedor y ADMIN), no se
pueden adjuntar a publicaciones ni productos (trigger `reject_proof_media_link`) y el recolector de
huérfanas no las borra. Hoy **no tienen plazo**: solo desaparecen con la cuenta del vendedor
(cascada) o si se borra el producto (ningún camino de la app lo hace; sin su fila, la foto queda
huérfana y la recoge el recolector). Un ticket o una factura pueden traer nombre, domicilio, RFC o
parte de una tarjeta, así que guardarlos sin fin no es neutral. **Pendiente (revisión legal, antes
del lanzamiento):** el plazo máximo de los comprobantes reemplazados (y de los vigentes de un
producto archivado), si el vendedor puede pedir que se borren antes y qué queda de la decisión del
equipo sin la foto. El aviso de privacidad dice que hoy no se borran solos y marca el plazo como
pendiente (`MODERATION_RETENTION` en `app/(legal)/privacidad/page.tsx`). Al decidirlo: borrado
programado, subir `LEGAL_VERSIONS.privacyNotice` y actualizar esta nota.

## ADR-037 · Impresiones visibles (T5) y salvaguardas con prueba estadística

**Contexto.** El umbral de tráfico del motor de automejora se define en impresiones VISIBLES
(`plan-90-dias.md` §2.4), pero se contaban piezas SERVIDAS: cada carga registra todas las piezas
aunque solo se vea una, así que `FEED_IMPRESSIONS_ARE_VISIBLE` era `false` y en modo `low_risk` nada
se aplicaba solo. Además, las salvaguardas comparaban estimaciones puntuales: con conteos bajos
revertían de más (ruido), y un bot podría provocar reversiones enviando eventos.

**Decisión** (la construyó el grupo de autonomía; lo de abajo describe el código al 2026-09-27).

- **Impresión visible:** al menos el 50 % de la pieza dentro de la pantalla durante al menos 1
  segundo continuo, con la pestaña a la vista (el estándar de la industria para display). Se mide en
  el navegador (`feed/components/visible-impressions.ts` con el hook
  `feed/components/use-visible-impressions.ts`: IntersectionObserver y un cronómetro que se pausa con
  la pestaña oculta; manda lo visto cada 5 s o con `sendBeacon` al salir). Es un tipo de evento propio
  (`VISIBLE_IMPRESSION`) e `IMPRESSION` sigue siendo la pieza servida (`feed.impressions.served`,
  métrica descriptiva que no decide nada).
- **Validación contra lo servido** (plan §2.3, «Eventos firmados»; `analytics/visible-impressions.ts`):
  el navegador solo manda id de la publicación, superficie (`FEED` o `COMMUNITY`) y posición
  (`POST /api/impressions`, contrato en `analytics/visible-impression-contract.ts`). El servidor
  descarta, sin error, lo que no es una publicación publicada, lo del propio autor y lo repetido (una
  por persona o IP, publicación y día de México), y exige un comprobante de que se sirvió:
  - **con sesión y personalización:** su `IMPRESSION` de esa publicación en las últimas 24 h. La
    posición, la puntuación, la versión del algoritmo y el espacio comercial se copian de lo servido y
    la variante la calcula el servidor; nada de eso viene del navegador. Son las únicas con las que
    decide el motor (ver «Población que decide»);
  - **sin personalización, o sin sesión con IP de confianza:** lo servido se guardó anónimo (SEC-16),
    así que el comprobante es la cubeta que deduplicó esa pieza servida para esa cuenta o IP (vale
    una hora desde que se sirvió; lo que llega después se descarta: se cuenta de menos, nunca de más);
  - **sin sesión ni IP de confianza** (`TRUSTED_PROXY_HOPS=0`): no hay a quién atar el comprobante;
    las visibles anónimas de una publicación no pasan de sus servidas anónimas de las últimas **25 h**
    (24 h más una de margen, porque lo servido sin personalización guarda la hora truncada), con un
    tope de 600 por publicación y hora. Comparar contra un conteo leído no basta con peticiones
    simultáneas (todas leerían el mismo conteo y registrarían tantas visibles como peticiones), así
    que cada visible reserva además un lugar en un **contador atómico por publicación**
    (`claimAnonymousSlot`: `rateLimit`, un solo `INSERT … ON CONFLICT … RETURNING`, con límite igual
    a las servidas y ventana fija de 25 h). La ventana del contador es fija y la de las servidas se
    desliza, así que el **peor caso** (ráfagas simultáneas justo al renovarse el contador) es **el
    doble** de las servidas anónimas en 25 h: acotado, nunca sin límite. Cada intento suma aunque se
    rechace, así que bajo ataque se cuenta de menos.

  Además: solo peticiones del mismo origen (`Sec-Fetch-Site`), a lo más 50 piezas y 16 KB por
  petición y límites de frecuencia por minuto (sin sesión, 240 por IP y un tope común de 3,000 sin
  IP; con sesión, 60 por persona y 2,000 por IP: ver la nota al final). Se guardan con el mismo estándar de privacidad que cualquier evento (`prepareEvent`):
  sin personalización, sin persona, con la hora truncada y sin la variante; sin sesión, como en
  `track`, sin persona ni variante pero con la hora exacta (el aviso de privacidad lo dice así). Las
  cubetas de deduplicación guardan un HMAC con el secreto del servidor (nunca la cuenta ni la IP en
  claro); la de la pieza servida vale 1 h y las de las visibles vencen a las 25 h (aviso de
  privacidad, versión 2026-09-27).

- **Población que decide: solo personas con sesión (antirrobots).** No hay detección de robots
  (difiere del plan, que pide excluir robots y tráfico anómalo). Nadie puede registrar como vista
  una pieza que no se sirvió a nadie, pero un script sin cuenta sí puede marcar como vistas piezas
  servidas de forma anónima que no vio. Por eso **el umbral de tráfico, las salvaguardas (y la
  exposición mínima del monitor), las tasas del analista y los experimentos cuentan SOLO las
  impresiones visibles de personas con sesión y personalización**, y sus numeradores (reportes, «No
  me interesa», interacciones, visitas a producto) solo de esas mismas personas
  (`signedInFeedTotals` en `analytics/platform-aggregates.ts`). Un robot sin cuenta que inunde
  impresiones o visitas anónimas no puede forzar ni esconder una reversión. Las visibles anónimas
  (`feed.impressions.visible.anonymous`) y las servidas quedan como métricas descriptivas.
- **El umbral se enciende con datos reales:** `FEED_IMPRESSIONS_ARE_VISIBLE` es `true` porque los
  agregados cuentan `VISIBLE_IMPRESSION`. Las filas de `DailyMetric` por impresión anteriores a
  `VISIBLE_IMPRESSIONS_SINCE` no se comparan (`ceo/metric-rows.ts`): contaban piezas servidas y
  tráfico anónimo. Ese valor es **2026-09-27**, el primer día COMPLETO de México con visibles, y no
  2026-09-26: ese día las visibles empezaron a media tarde (13:09 de México, en la base de
  desarrollo), así que sus tasas dividirían reportes o interacciones de TODO el día entre las
  impresiones de unas horas. Al instalar T5 en otro entorno con filas anteriores, el valor debe ser
  el primer día completo después de instalarlo. Mientras el feed no mande visibles de personas con
  sesión, el umbral no se cumple y el motor solo propone.
- **Salvaguardas con significancia y ventana máxima** (`ceo/guardrails.ts`, `ceo/monitor.ts`): tras
  una exposición mínima (por omisión, 5,000 impresiones visibles de personas con sesión), una
  salvaguarda relativa revierte solo si el cambio observado pasa su umbral (reportes +25 %, «No me
  interesa» +15 %, conversión comercial −10 %, visitas a producto por vendedor activo −15 %) **y** la
  prueba unilateral en la dirección del daño rechaza «sin empeoramiento» (α = 0.05). La varianza de
  cada lado se multiplica por **el mayor entre el efecto de diseño por persona** que usa el analista
  **y la variación medida** (sobredispersión, `pearsonDispersion`: entre días en el monitor, porque
  antes contra después no cancela los días atípicos como quincenas o puentes; entre personas en un
  experimento, para que una sola cuenta no baste); si un lado tiene muy pocos días, se usa la del
  otro, y nunca menos de 1 (`varianceFactor`): la variación medida solo puede hacer la prueba más
  conservadora. Es decir, prueba que empeoró, no que el empeoramiento real pase el umbral. Las
  absolutas (contenido comercial > 30 %, 5xx > 1 %) exigen que el valor esté significativamente
  arriba del tope. Con la línea base en 0 se usa un tope absoluto (1 reporte y 5 «No me interesa»
  por mil). Sin muestra suficiente el veredicto es «sin datos suficientes», nunca un 0 inventado ni
  un «seguro». Se vigila 14 días y a lo más 28: al cumplirse sin empeoramiento significativo se
  cierra con «sin evidencia de daño con esta muestra (no quiere decir que el cambio sea seguro)».

**Riesgo aceptado.** El monitor revisa cada día (hasta 28 veces) seis salvaguardas con α = 0.05 sin
corregir por revisiones repetidas ni por comparaciones múltiples: la probabilidad de una reversión
falsa en algún momento es mayor que 5 %. El requisito de pasar también el umbral la reduce, y el
error va del lado seguro (deshace un cambio). Contar solo a personas con sesión deja fuera la
experiencia de los visitantes sin cuenta: un cambio que solo los dañara a ellos no se revertiría
solo (se ve en las métricas descriptivas).

**Consecuencias.** Menos reversiones por ruido, y ni el umbral ni las salvaguardas se mueven con
tráfico sin cuenta. El costo: con poco tráfico con sesión las salvaguardas tardan más en decidir y el
umbral de ≈ 41,000 impresiones visibles por variante tardará en cumplirse; mientras tanto el motor
solo propone. **Pendiente:** detectar tráfico anómalo de cuentas (robots con cuenta; plan §2.3). Los
parámetros exactos viven en el código (`ceo/guardrails.ts`, `analytics/visible-impressions.ts`,
`analytics/platform-aggregates.ts`, `app/api/impressions/route.ts`) y cambiarlos es una decisión
humana.

**Nota: límites por minuto con sesión y redes móviles** (decisión delegada, ADR-033). En México
mucha gente navega desde redes móviles donde el operador comparte una misma IP entre muchos clientes
(NAT del operador). Con 240 peticiones por minuto por IP para todos, unas cuantas personas con sesión
detrás de la misma IP agotaban el cupo y sus visibles, las únicas con las que decide el motor, se
perdían (429; el navegador no reintenta): el umbral tardaría más en cumplirse y las salvaguardas
verían menos exposición de la real. Ahora, **con sesión** se revisa **primero el tope por cuenta**
(60/min) y después un **techo por IP de 2,000/min** en una llave propia
(`impressions.signed-in:ip:…`); **sin sesión** no cambia nada (240/min por IP y, sin IP de
confianza, el tope común de 3,000/min). La cuenta va primero porque cada intento suma aunque se
rechace (`rateLimitMany` se detiene en la primera regla que falla): quien pasa su propio tope se
detiene ahí y no gasta el cupo de la IP que comparte con otras personas. A cada persona la acota su
cuenta; el techo por IP solo limita cuántas cuentas manda un mismo origen (≈ 33 a su tope de 60, o
≈ 160 pestañas al ritmo normal de una petición cada 5 s). Con y sin sesión ya no comparten cupo:
lo de las personas con sesión no gasta el de los visitantes sin cuenta de la misma IP, ni al revés.
**Riesgo aceptado:** quien tenga muchas cuentas en una IP puede mandar hasta 2,000 peticiones por
minuto; cada visible sigue exigiendo una pieza servida a esa cuenta y cuenta una vez por
publicación y día, y detectar cuentas anómalas sigue pendiente (arriba). Los visitantes sin cuenta
detrás de una IP compartida siguen compartiendo 240/min: sus visibles son descriptivas y no deciden.
Código: `IMPRESSIONS_LIMITS` en `app/api/impressions/route.ts`.

## ADR-038 · IA en producción: proveedor real o simulación explícita

**Contexto.** `AI_PROVIDER=mock` es el valor por omisión. En producción, un olvido de configuración
haría que los vendedores recibieran en «Sube y vende» y en el kit de anuncios textos de PLANTILLA
(deterministas, sin modelo) creyendo que son de una IA. Es el mismo riesgo que el pago simulado
(ADR-032).

**Decisión.** Espejo de `ALLOW_SIMULATED_PAYMENTS`:

- Con `NODE_ENV=production` y `AI_PROVIDER=mock`, el arranque **falla** (`serverEnvSchema`) salvo
  con `ALLOW_SIMULATED_AI=true`, una decisión explícita para un build local o un piloto cerrado. El
  mensaje dice que los vendedores recibirían textos de plantilla y cómo resolverlo.
- En desarrollo y pruebas no hace falta nada. Con `AI_PROVIDER=openai_compatible` la bandera no
  tiene efecto (y no enciende el simulador). `simulatedAIAllowed(env)` (`server/env-schema.ts`) es
  la regla reutilizable.
- Aplica también al build de producción en `localhost`, igual que los pagos: para probarlo en una
  máquina de desarrollo se agrega `ALLOW_SIMULATED_AI=true` al `.env` local (no se versiona y
  `pnpm db:setup` no la escribe); en un servidor real no se define. Playwright con `CI=1` arranca
  `pnpm start`, así que un CI futuro también la necesita.
- Una ruta de `ai.routing` que lleve una tarea al simulador es una decisión ADMIN registrada (el
  interruptor de apagado de la IA de pago), no un olvido: esta regla no la bloquea. **Hueco
  conocido:** con esa ruta, en producción y sin la bandera, los vendedores reciben textos de
  plantilla presentados como escritos por la IA («Creado con ayuda de IA» en el kit de anuncios),
  justo lo que esta regla evita para `AI_PROVIDER`.

**Consecuencias.** Para salir del piloto cerrado: proveedor real con llave, evaluación aprobada de
cada tarea (`pnpm ai:eval`), el mismo límite de gasto en la consola del proveedor, nombre legal y país
del proveedor en el aviso de privacidad (hoy marcado como pendiente) y correo verificado (SEC-10).
**Pendiente:** cuando el texto venga del simulador con vendedores reales (bandera o ruta al
simulador), la interfaz debe decir que es un ejemplo generado sin IA, o el interruptor debe apagar
la función («publica a mano») en lugar de entregar plantillas.

## ADR-039 · Fotos por `/media?w=`, no por el optimizador de Next

**Contexto.** Con el loader por omisión, `next/image` pedía las fotos subidas a
`/_next/image?url=/media/…`. El optimizador de Next guarda en disco (`.next/cache/images`, en
desarrollo `.next/dev/cache/images`) una copia por foto, ancho y calidad, con TTL = el mayor de
`minimumCacheTTL` (4 h) y el `max-age` de `/media`; pide el original sin cookies y le entrega su copia
a cualquiera. Cuando la copia vence y la revalidación falla (el original ya responde 404 porque el
equipo ocultó el producto o la foto se borró), su `response-cache` vuelve a guardar la entrada
anterior y la sigue sirviendo: la foto de un producto oculto o de una cuenta borrada seguía saliendo
por `/_next/image` sin límite de tiempo (hallazgo ALTO). Las copias anteriores a SEC-14 además tenían
TTL de un año, y como el optimizador pide sin cookies, las fotos privadas (un producto oculto, visto
por su dueño o por el equipo) se veían rotas.

**Decisión.**

- `next.config.ts`: `images.loader = "custom"` con `src/lib/image-loader.ts`. `/media/<clave>` y un
  ancho → `/media/<clave>?w=<ancho>`, redondeado hacia arriba a `MEDIA_WIDTHS` (256, 384, 640, 828,
  1080, 1600; `imageSizes` + `deviceSizes` son exactamente esos, lo comprueba
  `image-loader.test.ts`). La calidad se ignora: la codificación la decide el servidor. Cualquier otra
  fuente se devuelve tal cual. Con un loader propio, Next responde 404 a todo `/_next/image` (su
  optimizador solo corre con el loader por omisión); `localPatterns: []` y `remotePatterns: []` por si
  alguien vuelve a ese loader.
- `/media/<clave>?w=N` (`src/app/media/[...key]/route.ts`, `modules/media/delivery.ts`): N tiene que
  ser uno de `MEDIA_WIDTHS`; otro ancho, otro parámetro o `w` repetido → 400 antes de consultar la
  base (como SEC-35: una CDN no guarda una copia por cada parámetro inventado). Solo para imágenes.
  Límite: se revisa la query ya interpretada, porque Next re-arma `request.url` antes de la ruta; en
  `next dev` (comprobado con E2E) `?w=640&`, `?&w=640` o `?%77=640` llegan como `?w=640` y se
  entregan igual. Una CDN que use la URL cruda como clave de caché guardaría esas formas aparte (cada
  una pasa por la autorización); si se pone una CDN delante, su clave debe normalizar la query.
- La autorización de SEC-14/P14 corre en CADA petición, antes de leer el original o la variante; el
  304 también va después de autorizar (un ETag viejo no se salta el 404).
- Variantes WebP con sharp (`resizeForDelivery`): los mismos topes que una subida (firma, cabecera,
  píxeles, 10 s) y la MISMA cola del proceso (2 imágenes a la vez); las variantes ocupan a lo más la
  mitad de la cola de espera, para que un feed abierto en frío no deje sin lugar a las subidas. Sin
  lugar, o si el original no se decodifica, se entrega el original con `no-store`. Si el ancho pedido
  es igual o mayor que el de la foto guardada, se entrega el original. La caché de variantes vive en
  el mismo almacenamiento, `variants/w<ancho>/<clave>-<ext>.webp`: una clave que nunca tiene fila en
  `media`, así que pedirla por `/media` da 404. Peticiones simultáneas comparten la generación; una
  variante incompleta (otro proceso escribiéndola) se genera de nuevo. La caché es solo una
  optimización: nunca decide quién ve qué.
- Caché HTTP: pública → `public, max-age=3600, stale-while-revalidate=86400` (antes
  `max-age=86400`); privada → `private, no-store`; 400 y 404 → `no-store`. ETag fuerte (SHA-256 de
  los bytes entregados) e `If-None-Match` → 304.
- El recolector de huérfanas borra las variantes junto con el original (`deleteStoredMedia`).

**Ventana de retiro.** Nuestro servidor deja de servir la foto en cuanto se oculta o se borra. Una
copia que ya esté en un navegador o en una CDN que respete estas cabeceras se puede seguir viendo
hasta 1 h. Después, por `stale-while-revalidate`, un navegador puede mostrarla **una vez más** (dentro
de las 24 h siguientes) mientras revalida en segundo plano; la revalidación recibe 404 `no-store` y el
navegador descarta su copia. Una CDN compartida puede entregarla a varias personas mientras revalida y,
como el 404 no se puede guardar, no hay garantía de que descarte la copia vieja: según la CDN, podría
seguir sirviéndola dentro de esas 24 h. Por eso, con una CDN delante, un retiro inmediato (p. ej.
contenido ilegal) exige purgar la URL en la CDN; quitar `stale-while-revalidate` acota la ventana a 1 h
a cambio de más peticiones. Qué caché usa la plataforma de despliegue para estas respuestas (y, con
ello, cuántas peticiones llegan a la ruta) se verifica en el primer despliegue.

**Por qué nuestra ruta y no el optimizador de Next.** (1) Autorización: el optimizador no puede
revisar quién pide cada foto (pide el original sin cookies y comparte su copia). (2) Error de
revalidación: re-guarda y sigue sirviendo la copia vieja, y no tiene forma de invalidarla (la guía de
Next recomienda borrar `<distDir>/cache/images` a mano). (3) Costo: en plataformas como Vercel cada
transformación y su caché son del proveedor y se cobran aparte, y esa caché tampoco sabe de
moderación. El costo propio: CPU de sharp en el proceso web la primera vez de cada ancho (acotada por
la cola), disco (a lo más 5 variantes por foto: solo anchos menores que el guardado, que es de hasta
1600 px) y, en cada petición que no sale de una caché, la ruta con sus consultas de autorización
(5 con índice para una foto pública; más con sesión) y la lectura del archivo.

**Consecuencias.**

- Se borraron `.next/dev/cache/images` y `.next/cache/images` en desarrollo (2026-09-26). Un
  despliegue nuevo arranca sin esa caché y ya no la usa para `/media`. En Vercel, con loader propio,
  la plataforma no optimiza ni guarda `/media` en su caché de imágenes: verificar en el primer
  despliegue que `/_next/image?url=%2Fmedia%2F…` responde 404 o 400.
- Las fotos se piden desde el mismo origen con la sesión: su dueño y el equipo ven las de un producto
  oculto en el Studio y en su página (ya no hace falta `unoptimized`, que además en Vercel agrega
  `?dpl=` y la ruta lo rechazaría con 400).
- Si cambia la codificación (calidad o formato), hay que borrar `<STORAGE_LOCAL_ROOT>/variants/`: las
  variantes no llevan versión. Con S3/R2 (ADR-005) las variantes usan el mismo `StorageProvider`; si
  algún día las fotos se sirven directo desde el bucket o una CDN, esta autorización tiene que ir con
  ellas (p. ej. URLs firmadas).
- `scripts/clean-e2e.ts` borra los originales de las cuentas de prueba, no sus variantes (sin fila no
  se sirven; solo ocupan disco). Lo mismo con una variante que su dueño pide justo mientras el
  recolector borra esa foto: se puede escribir después del borrado y quedar en disco sin servirse.
- Pruebas: `src/lib/image-loader.test.ts`, `modules/media/{delivery,variant-keys}.test.ts`,
  `app/media/[...key]/route.test.ts` y `route.db.test.ts` (autorización con variante en caché, 304),
  `modules/media/orphans.db.test.ts` (borra variantes) y `tests/e2e/media-delivery.spec.ts`.
  **Pendiente:** actualizar `tests/e2e/security-headers.spec.ts` (el caso SEC-35 busca URLs de
  `/_next/image` en `/comprar` y espera 200) y `tests/e2e/uploads.spec.ts` (espera
  `public, max-age=86400`).

## ADR-040 · Hosting con escalado automático: Vercel + Neon + Cloudflare R2

**Contexto.** ADR-033 #10 eligió Vercel + Neon + R2 y el fundador lo confirmó el 2026-09-26 con una
condición: si la plataforma crece, que la infraestructura crezca sola, sin administrar servidores.
Faltaba lo que impedía desplegar: sin disco persistente en Vercel, las fotos (`LocalStorageProvider`)
se perderían.

**Decisión.**

- **App: Vercel Pro** con Fluid compute (instancias que se abren con el tráfico, varias peticiones
  por instancia, sin cobro de CPU sin tráfico) en `iad1`, junto a la base. Hobby queda descartado: es
  solo para uso no comercial. Tope: Spend Management con pausa de producción.
- **Base: Neon Launch** en `aws-us-east-1`, autoscaling de 0.25 a 2 CU con scale to zero, historial
  de 7 días (restauración a un instante). La app usa la cadena con pooler (PgBouncer en modo
  transacción; acepta el `-c TimeZone=UTC` de ADR-028 porque `timezone` es de los parámetros que
  rastrea); las migraciones, la directa (`DATABASE_URL_UNPOOLED`): Prisma Migrate no funciona por el
  pooler.
- **Fotos: Cloudflare R2**, bucket **privado** (`S3StorageProvider`, `STORAGE_DRIVER=s3`, AWS SDK v3
  oficial `@aws-sdk/client-s3@3.1140.0`, publicado el 2026-09-24, fuera de la cuarentena de 24 h). El
  navegador nunca recibe una URL del bucket: `publicUrl` sigue siendo `/media/<clave>` y la ruta
  autoriza cada petición (SEC-14, ADR-039); las variantes viven en el mismo bucket. Token de R2 con
  «Object Read & Write» limitado al bucket. Cada operación: conexión 3 s, 10 s por intento (lanza y se
  reintenta), 3 intentos con espera exponencial (5xx, `SlowDown`, red), tope total de 20 s;
  `Content-MD5` en cada subida (el servicio rechaza bytes alterados) y las sumas CRC32 del SDK solo
  cuando la operación las exige (desde 3.729 el SDK las agrega por omisión y no todo servicio
  compatible con S3 las acepta). Solo `NoSuchKey` es «no existe»: `NoSuchBucket` o `AccessDenied`
  lanzan (un error de configuración no se disfraza de foto borrada). `get` no carga objetos de más de
  32 MiB: cuenta los bytes mientras lee el stream y corta al pasar el tope, aunque la respuesta no
  declare su largo.
- **Falla cerrada (espejo de SEC-01):** en producción, `STORAGE_DRIVER=local` hace fallar el arranque
  salvo `ALLOW_LOCAL_STORAGE=true` (solo un servidor con disco persistente y respaldado); en Vercel
  (`VERCEL=1`) falla aunque la bandera diga `true`. Loopback se permite para el build local y E2E,
  como `CRON_SECRET`. Con `s3`, endpoint, bucket y llaves son obligatorios; el endpoint va por https
  (salvo loopback), sin credenciales ni ruta, y nunca es una URL pública `*.r2.dev` (que exista
  significa que el bucket quedó público).
- **Migraciones en el build de producción** (`pnpm vercel-build` = `scripts/vercel-build.mts`):
  `prisma generate` (el cliente no está en el repositorio y Vercel reutiliza la caché de
  dependencias), `next build` y, solo si compila y solo con `VERCEL_ENV=production`,
  `prisma migrate deploy` por la conexión directa, que se revisa antes de compilar (URL
  `postgresql://`, sin `-pooler`, con `sslmode`). Nunca `migrate dev`, `reset` ni `db push`. Una migración rota hace fallar el build y Vercel no publica; el código
  anterior solo convive con el esquema nuevo los segundos que tarda la promoción. Por eso toda
  migración es compatible con el código anterior (agregar primero, quitar después) y un Instant
  Rollback no deshace migraciones. Se descartó migrar a mano (se olvida y exige credenciales de
  producción en la PC) y migrar antes del build (deja minutos de esquema nuevo con código viejo y
  migra aunque el build falle). Las vistas previas no migran ni reciben variables de producción
  (Ignored Build Step: «Only build production»).
- **Cron:** `vercel.json` programa `/api/cron/daily` a las `0 9 * * *` (09:00 UTC = 03:00 en la
  Ciudad de México, sin horario de verano), con la precisión de minuto de Pro. Vercel manda
  `Authorization: Bearer <CRON_SECRET>`, que la ruta ya verifica; no reintenta un cron fallido y
  puede entregar uno dos veces (la operación es idempotente y no se encima). El plazo de 300 s lo
  declara la ruta (`maxDuration`); no hace falta `functions` en `vercel.json`.
- **Seed en producción:** una sola vez, a mano (`NODE_ENV=production`, `pnpm db:seed` con la cadena
  directa): solo categorías, comunidades y ajustes. El contenido editorial (ADR-033 #11) se publica a
  mano; nada se automatiza.

**Alternativas.**

| Opción                                            | Por qué no ahora                                                                                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase (base + archivos + auth)                 | Duplica lo ya resuelto (Better Auth, `/media` con autorización); su almacenamiento cobra la salida de datos y el cómputo se escala por plan |
| Railway / Render (contenedor)                     | Disco persistente y más control, pero se escala por réplicas que hay que configurar y pagar aunque no haya tráfico                          |
| Google Cloud Run en Querétaro + Cloud SQL         | Datos en México y menor latencia, pero Cloud SQL no escala a cero ni se autoescala en CPU, y hay más piezas que operar (IAM, red, CDN)      |
| AWS `mx-central-1` (México)                       | Residencia en México, pero hay que armar cómputo, base, S3 y CDN a mano: demasiada operación para un equipo sin DevOps                      |
| Servidor propio con disco (Hetzner, DigitalOcean) | El más barato, pero no crece solo y el fundador tendría que administrar servidor, respaldos y parches                                       |

**Consecuencias.**

- Guía paso a paso para el fundador: `docs/deploy.md` (cuentas, variables, dominio, seed,
  `make-admin`, verificación, respaldos y costos con fuentes). Piloto esperado ≈ US$30–40 al mes más
  la IA (tope US$50) [estimación].
- Los datos personales se tratan en Estados Unidos (Vercel, Neon, Cloudflare y, con IA real,
  OpenRouter): el aviso de privacidad debe nombrar a estos encargados con su país antes del primer
  vendedor real.
- `scripts/cleanup-orphan-media.ts`, `scripts/clean-e2e.ts` y `prisma/seed.ts` siguen con
  `LocalStorageProvider`. En producción la limpieza de huérfanas corre por el cron, que usa
  `getStorage()` (R2). Para correr esos scripts contra producción hay que cambiarlos a
  `createStorage(parseEnv(serverEnvSchema, process.env))` (`providers/storage/factory.ts`).
- Pruebas: `providers/storage/s3-storage.test.ts` (el cliente real del SDK con un manejador HTTP
  falso, sin red: firma, cabeceras, errores XML, reintentos, tope de tiempo y de tamaño) y
  `server/env.test.ts` (reglas de almacenamiento).

**Cuándo revisar.**

- **Residencia de datos:** si la ley, un contrato o un cliente exige datos en México → Cloud Run en
  Querétaro o AWS `mx-central-1` (el código ya es portable: S3 compatible y PostgreSQL estándar).
- **Latencia:** si la mayoría de las peticiones tarda por la distancia CDMX–Virginia, o Vercel abre
  una región en México.
- **Costo:** si el uso de Vercel pasa de ≈ US$150 al mes de forma sostenida, o Neon pasa de 2 CU de
  forma constante (con tráfico parejo, un servidor dedicado puede salir más barato).
- **Salida de datos y fotos:** si las fotos pasan de ≈ 100 GB o las lecturas de R2 de 10 millones al
  mes, poner una CDN delante de `/media` (con la purga y la clave de caché de ADR-039).

## ADR-041 · Marca «Estreno» y «Sube y vende» (la marca, reemplazada por ADR-070)

**Contexto.** El fundador reportó (2026-09-29) que el nombre provisional «VendeIA» provoca burlas por
el simple hecho de llevar «IA», y que la plataforma debe transmitir confianza. La marca estaba
centralizada en `siteConfig` (ADR-014) precisamente para este momento. Se revisaron candidatos con
el criterio: español de México, sin «IA», corto, cálido, que describa lo que se siente al usar la
plataforma y con dominios libres. Dominios revisados el 2026-09-29 (registrador de Vercel):
zocalo.mx / .app / .com.mx, alameda.mx / .app, vitrina.mx / .app, rumbo.app, compa.mx, luce.mx y
placita.mx están tomados; **estreno.mx, estreno.app, estreno.com.mx, estreno.shop y estreno.store
están libres**.

**Decisión.**

- La plataforma se llama **Estreno**. «Estrenar» es lo que la gente hace cuando compra algo que le
  gusta («¿vas a estrenar?», «estrené celular»), funciona para ropa y para cualquier categoría, y
  conecta con el nuevo centro de la experiencia: descubrir, probártelo y estrenar. Lema:
  «Descubre, pruébatelo, estrena».
- La función del vendedor deja de llamarse «Vende con IA»: ahora es **«Sube y vende»** (foto +
  precio → publicación lista). La IA sigue ayudando, pero no da nombre a nada. La ruta pasa de
  `/studio/vende-con-ia` a `/studio/sube-y-vende` con redirección permanente de la anterior.
- Las etiquetas honestas de contenido generado con IA («Con ayuda de IA», «Texto de ejemplo») se
  conservan (principio 5 y términos), en estilo neutro, no como distintivo de marca.
- La marca sigue viviendo en `src/config/site.ts` (`name`, `sellerFeatureName`, `tagline`); el
  nombre técnico del paquete, la base de datos, las cookies y los identificadores internos NO
  cambian (`vendeia`): renombrarlos no aporta nada y rompería sesiones y despliegues.
- Marca gráfica: una etiqueta de estreno (la que se le quita a la prenda nueva) en rosa; sin la
  chispa lima de la IA. `public/brand/mark.svg` es la fuente de los íconos (`pnpm icons`).
- Nombres reservados (SEC-18): «Estreno», «Equipo Estreno», «Soporte Estreno» y las variantes
  plegadas no pueden usarse como nombre ni usuario; «VendeIA» sigue reservado para no dejar un hueco.

**Pendiente del fundador.** Registrar estreno.mx (y .app/.com.mx) y consultar la marca en el IMPI
(clases 35, 42 y 9) con el abogado antes de la campaña pública. Mientras tanto la marca es
provisional pero coherente en toda la interfaz y los documentos legales.

## ADR-042 · Diseño sereno: confianza antes que color

**Contexto.** El fundador (2026-09-29): «hay demasiados botones por todos lados y los colores están
muy marcados; debe ser un diseño limpio y que genere confianza». Al revisar el inicio, Comprar, la
ficha de producto y el Studio: hasta 6 acciones con relleno de color por pantalla, tintes saturados
de comunidad (mosaicos, anillos, carteles y bloques tipográficos), la lima de la IA en la marca, el
compositor y el Studio, y el rosa de marca en íconos de sección, insignias y contadores.

**Decisión (se aplica en `globals.css`, `button.tsx`, `community-tint.ts` y los componentes).**

1. **Una acción principal por pantalla.** Solo ella lleva relleno rosa (`variant="default"`):
   «Crear» en la barra, «Comprar ahora» en la ficha, «Publicar» en formularios, «Crear cuenta» para
   visitantes. Todo lo demás es contorno, texto o gris (`outline`, `ghost`, `secondary`, `link`).
   `variant="soft"` deja de ser rosa suave y pasa a ser la acción secundaria neutra (gris claro con
   tinta), así «Unirme», «Seguir» en listas y «Ver producto» dejan de competir con la principal sin
   cambiar ningún nombre accesible.
2. **El color es acento, no fondo.** Íconos de sección, insignias («Tienda», «Editorial»), contadores
   («N nuevas») y el ícono activo de la navegación van en tinta o gris. El rosa queda para la marca,
   enlaces y la acción principal; el verde `success` solo para estados positivos.
3. **Tintes de comunidad suaves.** Los mosaicos del emoji bajan de croma (pastel), los anillos de las
   burbujas son neutros (seleccionada = tinta), la variante tipográfica del feed usa `community-soft`
   (fondo suave con tinta) en lugar del cartel de tinta saturada, y el titular de la portada va en
   tinta neutra. El tono sigue identificando a cada comunidad, en pequeño.
4. **Sin lima.** La lima de la IA se retira de la marca, del compositor, del Studio y de los
   distintivos; las etiquetas de IA son chips grises con texto.
5. **Menos botones.** El bloque de producto del feed es un solo enlace (sin botón «Ver producto» ni
   círculo rosa en la etiqueta de precio); la tarjeta de bienvenida es blanca con un botón; el
   Studio ofrece «Publicar producto» como única acción principal; el compositor usa íconos neutros.
6. **Aire y jerarquía.** Se mantienen las tarjetas blancas de 20 px de radio, la tipografía y los
   contrastes AA (`community-tint.test.ts` sigue auditando los 360 tonos). Nada cambia de nombre ni
   de posición en la navegación: las pruebas E2E existentes siguen válidas.

**Consecuencias.** ADR-027 sigue vigente en paleta y tokens; cambia el **uso**: menos superficie de
color y una sola acción destacada. Las maquetas de `docs/design/rediseno-revista/` quedan como
referencia histórica del layout, no del color.

## ADR-043 · Núcleo de IA: módulos con bandera, proveedor de imágenes y caché

**Contexto.** El fundador entregó (2026-09-29) el plan «Ecosistema de IA» (20 funciones en 5 fases)
con dos reglas: no construir las 20 de golpe y no acoplar nada a un proveedor. Lo que ya existía
cubre la mayor parte de la fase 1: `AIProvider` por interfaz con simulador (ADR-005), tareas
estructuradas (`AITask`), enrutador por tarea (`ai.routing`, ADR-034), guardián de presupuesto y
cuotas (ADR-031), costo por llamada, evaluaciones, retención y auditoría (`AIRequest`/`AIResponse`).
Faltaban banderas por función, un proveedor de imágenes, caché de resultados y eventos.

**Decisión.**

- **Banderas por función (`ai.features`, `PlatformSetting`).** Una lista cerrada en código
  (`src/modules/ai/features.ts`) con las 20 funciones del plan; cada una se enciende o apaga sin
  desplegar. Predeterminadas ENCENDIDAS: las de la fase 2 (`shoppingIntent`, `createLook`,
  `completeLook`, `virtualTryOn`, `buyerMatching`) y las que ya existían (`sellerListing`, `adKit`,
  `authenticitySignal`, `platformAnalyst`). Todo lo demás, APAGADO hasta que se desarrolle. Solo una
  persona ADMIN las cambia (`/admin/ia`), con una `PlatformDecision` como bitácora; la IA CEO no puede
  proponerlas (`ai.features` está en la lista prohibida: son decisiones de producto).
- **Un módulo por función.** `src/modules/stylist/` (necesidad, looks, completar look, matching),
  `src/modules/tryon/` (Pruébatelo), `src/modules/billing/` (saldo y precios). Las fases 3–5 se
  agregan como módulos nuevos detrás de su bandera, sin tocar el núcleo.
- **Proveedor de imágenes por interfaz** (`server/providers/image`): `ImageProvider.edit(task,
input)` con un simulador (`MockImageProvider`, compone la foto con las prendas y una marca de
  agua, sin red ni costo) y un adaptador para servidores compatibles con OpenAI que generan imágenes
  desde el chat (`modalities: ["image","text"]`, OpenRouter; modelo en `AI_IMAGE_MODEL`). Precio por
  imagen con fecha y fuente en `cost.ts` (`IMAGE_PRICES_USD`); un modelo sin precio no se llama.
  El mismo guardián de siempre reserva ANTES de llamar; el costo máximo de una imagen es su precio.
- **Caché de resultados.** Un resultado de Pruébatelo se identifica por (foto, productos, versión
  del prompt, modelo): pedirlo de nuevo devuelve el guardado sin cobrar ni gastar. Los textos de
  look se guardan por (firma del look, versión del prompt).
- **Cuotas por función.** Además de las cuotas globales por persona (ADR-034), cada función tiene su
  límite por hora y por día (`FEATURE_LIMITS`), y el subsidio de Pruébatelo tiene tope diario global
  (`ai.budget.tryOnDailyCapUsd`).
- **Respaldo (fallback).** Si el modelo de texto falla, «¿Qué necesitas?» usa el intérprete
  determinista (palabras clave y presupuesto por expresión regular) y lo dice; si el proveedor de
  imágenes no está disponible, Pruébatelo se muestra como «no disponible por ahora» sin gastar cuota.
- **Eventos (P5).** `NEED_SUBMITTED`, `LOOK_GENERATED`, `LOOK_ITEM_SWAPPED`, `TRY_ON_GENERATED`,
  `WALLET_TOPUP`, `WALLET_CHARGE`, en la superficie `STYLIST`; miden qué función aporta valor antes
  de invertir en la siguiente.
- **La IA nunca inventa productos.** Toda recomendación lleva `productId`; los looks los arma código
  determinista con productos activos, con existencias y visibles (P2, P4). El texto del modelo solo
  nombra y explica; se revisa con el guardián de contenido antes de mostrarse.

## ADR-044 · Autofinanciamiento: saldo, precio comunitario y patrocinio

**Contexto.** Ver `docs/modelo-de-ingresos.md`. El fundador pide detectar dónde cobrar sí o sí, que
nada sea caro porque el costo se reparte, que el precio baje al crecer la comunidad y que cada peso
se reinvierta. ADR-020 ya liga el presupuesto de IA a los ingresos; faltaba cómo cobrar.

**Decisión.**

- **Saldo en pesos** (`Wallet`, `WalletEntry`, `WalletTopUp` en `src/modules/billing/`): una sola
  cartera por cuenta (P6), en centavos MXN, con libro de movimientos inmutable y balance que nunca
  baja de cero (CHECK y candado por cartera). Recargas de $39, $99 (+5 %) y $199 (+10 %) por el
  `PaymentProvider`; con el simulado, el saldo queda marcado como simulado y no cuenta como ingreso
  (como ADR-032). Ingreso real → `PlatformLedgerEntry` `AI_PREMIUM`, que sube el presupuesto de IA.
- **Precio comunitario** (`billing/pricing.ts`, P2): tabla de 4 niveles por volumen mensual de
  pruebas de toda la plataforma ($3.50 → $3.00 → $2.50 → $2.00 MXN), piso de 1.5 × el costo unitario
  de la tabla de costos, nivel recalculado el día 1 en la operación diaria. Cambiar la tabla es
  riesgo ALTO (código + ADR); cambiar de nivel dentro de la tabla no es una decisión nueva.
- **Quién paga cada prueba, en este orden:** (1) el vendedor si patrocina el producto y tiene saldo y
  tope diario; (2) las 3 gratis del mes de la persona, mientras quede subsidio del día; (3) el saldo
  de la persona. Sin nada de eso, la interfaz ofrece recargar. Cada `AIRequest` guarda `funding`
  (`PLATFORM`, `USER_PAID`, `SELLER_PAID`, `SYSTEM`) y las pagadas NO consumen el presupuesto de
  subsidio (`committedSpendMicros` solo cuenta `PLATFORM` y `SYSTEM`).
- **Cobro atómico antes de generar:** el débito del saldo y la reserva de la `AIRequest` van en la
  misma transacción; si la generación falla, el movimiento se revierte (`REFUND`) en la misma
  operación de fallo.
- **Gratis con cuotas, no con precio:** publicar, texto de la publicación, kit de anuncios, búsqueda,
  necesidades y looks.
- **Publicidad por presupuesto, no por planes** (P12 sin cambios). Las suscripciones de vendedor de
  `docs/mvp-0.1.md` §6 quedan descartadas en favor de saldo + resultados.

**Consecuencias.** Términos y aviso de privacidad deben describir el saldo (no es dinero, no se
transfiere, devolución del no usado en 5 días hábiles, IVA incluido, CFDI a quien lo pida) antes de
cobrar de verdad; el contador confirma el tratamiento del IVA y la comisión del procesador. Página
pública `/precios` con la tabla y el nivel vigente.

## ADR-045 · «Pruébatelo»: la foto de la persona

**Contexto.** Pruébatelo necesita una foto de cuerpo (o medio cuerpo) de la persona. Es un dato
personal sensible en la práctica (imagen), aunque no se use para identificarla. LFPDPPP: finalidad
explícita, consentimiento, plazo de conservación y derechos ARCO.

**Decisión.**

- **Consentimiento explícito y versionado** (`ConsentType.TRY_ON_PHOTOS`, `LEGAL_VERSIONS.tryOn`) al
  subir la primera foto, con el texto exacto de para qué se usa y cuándo se borra.
- **Privada siempre.** La foto y cada resultado se guardan bajo `private/tryon/…`; `/media` solo se la
  sirve a su dueña o dueño, sin caché (`private, no-store`); ni el equipo ni el vendedor la ven. Nunca
  se adjunta a una publicación ni a un producto (misma protección que los comprobantes).
- **Solo lo necesario sale al proveedor:** la foto, las fotos públicas de los productos y un prompt
  sin datos personales (sin nombre, sin usuario). Con OpenRouter se exige `data_collection: "deny"` y
  `zdr: true`, como en el texto (ADR-034); por eso el modelo debe tener un endpoint con cero retención
  (los ids finales de Gemini lo tienen; los «-preview» responden 404 «data policy», visto el
  2026-09-30).
- **Retención corta:** fotos y resultados se borran a los **30 días** (`expiresAt`) en la operación
  diaria, y la persona puede borrarlos antes desde `/ajustes` («Mis fotos de prueba»). Los registros
  de costo (`AIRequest`/`AIResponse`) se quedan sin la imagen.
- **Siempre una simulación.** Cada resultado dice «Simulación generada con IA: la prenda puede verse
  distinta en la realidad» y nunca se presenta como garantía de talla, color o caída; no se puede
  compartir públicamente desde la plataforma en esta versión.
- **Menores y terceros:** los términos exigen que la foto sea de la persona misma, mayor de edad. Sin
  verificación técnica en esta versión (queda documentado como riesgo aceptado).

## ADR-046 · Quien vende paga: «Ver cómo me veo» en un paso, saldo de la tienda y destacados

**Contexto.** Al ver la primera versión, el fundador pidió tres cosas (2026-09-29): que probarse una
prenda sea un solo paso desde la ficha («sube su foto, le da en ver cómo me veo y en una ventana
emergente ve cómo se ve; solo le da en comprar o añadir accesorios»), que **quien compra no pague**
por ver cómo le queda algo («eso debe pagarlo el vendedor»), y que la columna derecha sea el espacio
de **publicidad** que también pagan las tiendas («por X cantidad sus productos salen a un costado de
otros como sugerencias»). Pidió 2 o 3 paquetes para vendedores o una idea mejor, y que cada
beneficio se cobre porque cada peso financia la plataforma.

**Decisión.**

- **Quien vende paga, en este orden (`tryon/funding.ts`):** la tienda del producto principal si
  tiene «Ver cómo me veo» activo, saldo y tope del día → las **pruebas de cortesía de esa tienda**
  (Estreno pone las primeras 10 de cada tienda, `STORE_TRIAL_TRY_ONS`, dentro del tope diario del
  subsidio) → nada. El camino «la persona paga con su saldo» (`USER_PAID`) desaparece de las
  pruebas; el valor del enum se conserva por las filas anteriores. Sin financiamiento, el botón
  sigue en la ficha: explica que la tienda no tiene pruebas activas y registra la **demanda**
  (`TRY_ON_REQUESTED`), que el vendedor ve en su Studio como «N personas quisieron probarse tu ropa
  esta semana». `TryOnResult.sellerId` guarda la tienda del producto principal.
- **Un solo paso desde la ficha:** «Ver cómo me veo» abre un diálogo (`try-on-dialog.tsx`) con la
  foto guardada o la subida de una nueva con el consentimiento (ADR-045), genera con
  `quickTryOnAction` sin cambiar de página y muestra el resultado con «Comprar ahora», «Al carrito»
  y «Agrégale…»: hasta 3 complementos reales de otros huecos (`complements.ts`, primero de la misma
  tienda, luego lo más barato) para verse con todo puesto. El estudio `/probar` queda para looks
  completos y más fotos.
- **El saldo es de la tienda.** Un solo saldo para todo lo que paga quien vende: pruebas, días de
  producto destacado y, después, Impulsar y creativos. Recargas **Arranque $99, Impulso $299 (+10 %),
  Tienda pro $799 (+15 %)** (`TOPUP_PACKS`), sin planes que venzan: se pidieron «paquetes» y la idea
  mejor es presupuesto con bono, porque un plan que caduca cobra por lo que no se usó y un saldo
  se gasta cuando trae ventas. `/saldo` explica a quien compra que todo es gratis; el saldo vive en
  `/studio/saldo`.
- **Producto destacado (la columna de publicidad):** `Product.featuredUntil`; **$15 MXN por día**,
  de 3 a 30 días, por adelantado desde el saldo (`WalletEntryKind.FEATURED`). Aparece con la
  etiqueta «Patrocinado» en la columna derecha, el primer lugar de «También te puede gustar» y una
  fila arriba de Comprar; rotación determinista por hora; nunca a su dueño; nada oculto por
  moderación (sin devolución).
- **Lo que sigue gratis para todos:** mensajes, publicar, buscar, looks, comentar. El dinero viene
  de las tiendas, que venden gracias a esa gente (principio 1).

**Consecuencias.** Términos y aviso de privacidad se actualizan (versiones 2026-09-30): el saldo es
de las tiendas, la simulación la paga la tienda o Estreno, la demanda se cuenta de forma agregada
y los destacados llevan etiqueta. Cambiar precios (tabla de niveles, recargas, precio por día) sigue
siendo decisión humana de riesgo ALTO. `docs/modelo-de-ingresos.md` es la referencia con cifras.

## ADR-047 · Mensajes privados y columna izquierda plegable

**Contexto.** «Los usuarios no tienen cómo comunicarse en privado» (fundador, 2026-09-29): una red
social sin mensajes no es red social, y quien compra necesita preguntarle a la tienda. También pidió
que la columna izquierda se pliegue, como el menú de Facebook, para que la derecha sea el espacio de
publicidad. Y recordó que cada beneficio debe cobrarse.

**Decisión.**

- **Mensajes gratis para todos.** Son el pegamento de la red social y cuestan centavos; cobrarlos
  mataría la conversación que trae ventas. El dinero sigue viniendo de las tiendas (ADR-046). Lo
  que sí queda para después y sí se cobra: respuestas con IA para tiendas (agente comercial, fase 3).
- **Modelo mínimo (`Conversation`, `Message`):** una conversación por par de personas (ids
  ordenados, único), mensajes de texto de hasta 2,000 caracteres, marca de lectura por lado. Sin
  borrado lógico: al borrar la cuenta se va todo en cascada. Sin sockets: el hilo abierto se refresca
  cada 10 s mientras la pestaña está visible.
- **Reglas:** solo cuentas con perfil terminado; nunca con uno mismo ni con las cuentas editoriales;
  antispam por persona (30 mensajes cada 10 minutos, 20 conversaciones nuevas al día); reportar a la
  otra persona desde el hilo (reporte de cuenta, cola del equipo); recordatorio automático cuando un
  mensaje parece llevar datos de pago («los pagos van dentro del pedido»). Sin filtro de contenido
  automático en esta versión: la moderación es por reporte.
- **Entradas:** «Mensaje» en el perfil, «Preguntar» junto a la tienda en la ficha (el primer mensaje
  llega con el nombre y la liga del producto), el ícono de Mensajes con globo de no leídos en la
  barra superior (escritorio y móvil) y en el menú de la cuenta. Ruta protegida `/mensajes`.
- **Columna izquierda plegable:** botón «Contraer/Expandir el menú» arriba de la columna en
  escritorio; el estado va en la cookie `estreno-nav` un año y el servidor lo lee para pintar sin
  salto; plegada, la columna es de íconos con los nombres solo para lectores de pantalla (variante
  `nav-open:` en `globals.css`, marco `shell-frame.tsx`).

**Consecuencias.** El aviso de privacidad describe los mensajes (§7 ter) y los términos sus reglas
(A11 ter); versiones 2026-09-30. Los mensajes son datos privados: ni el equipo los lee salvo por un
reporte y con la persona reportada notificada [pendiente del abogado]. Pendiente: avisos (campana)
para me gusta, comentarios y seguidores, propuesto como fase siguiente.

## ADR-048 · Lanzar sin empresa: apoyos, fondo de desarrollo, confianza y borrar la cuenta

**Contexto.** El fundador quiere lanzar ya, sin estar dado de alta todavía. Pregunta si se puede
ganar con donaciones mientras se formaliza y después con la publicidad; si el uso de la IA que
construye la plataforma («IA-CEO») puede pagarse con lo que genere el sistema; y qué hacer con la
desconfianza de dar correo y contraseña a un proyecto sin empresa detrás. También pidió que el menú
izquierdo vaya pegado al borde.

**Decisión.**

- **Apoyos voluntarios, fuera de la plataforma.** `SUPPORT_URL` (solo https) enciende la tarjeta
  «Apoya a Estreno» en la columna de publicidad y el botón de `/apoya`. El dinero nunca pasa por
  aquí: es una liga externa de pago (Mercado Pago, PayPal, Ko-fi). Un apoyo no compra nada ni da
  ventajas. `/apoya` publica qué cuesta mantener el proyecto y en qué se usa cada peso, en orden:
  servidores, pruebas de cortesía, desarrollo. Registrar el RFC y el régimen fiscal antes de cobrar
  a tiendas sigue siendo obligatorio [contador]; los apoyos recibidos como persona física son
  ingresos y se declaran [contador].
- **Fondo de desarrollo (IA-CEO).** La plataforma no puede pagar sola una suscripción externa; lo
  que sí hace es apartar: del reparto de ingresos (`revenueSharePercent`, ADR-020) sale un «fondo de
  desarrollo» que cubre el uso de la IA que construye esto, del plan más chico al más grande conforme
  los ingresos del mes lo cubran. Se documenta en `docs/modelo-de-ingresos.md` §4; el resumen del
  equipo muestra si el mes cubre el plan. Nunca se descuenta de las pruebas de cortesía ni de los
  servidores: primero lo que mantiene encendida la plataforma.
- **Confianza sin empresa.** Página pública `/seguridad` que solo afirma lo que hace el código
  (scrypt, mínimo de datos, sin tarjetas, fotos y mensajes privados, CSP, límites, auditoría),
  enlazada desde el registro, el pie y `/apoya`; el aviso de privacidad ya nombra a la persona
  responsable. **Borrar mi cuenta** desde Ajustes: elimina en cascada perfil, publicaciones,
  productos, fotos, mensajes y sesiones, y borra los archivos; los pedidos se conservan sin datos
  personales. Siguiente paso recomendado: entrar con Google o con llave de acceso (passkey) para
  que quien desconfíe no tenga que inventar una contraseña; requiere credenciales del fundador.
- **Columnas pegadas a los bordes.** La rejilla deja de centrarse: la izquierda va al borde
  izquierdo, la derecha al derecho y el feed se centra en lo que queda (`shellGrid`, `shellMain`).

**Consecuencias.** `/apoya` y `/seguridad` son públicas y se prueban en E2E; los textos de costos
son [estimación] con la misma fuente que el modelo de ingresos. El abogado revisa la naturaleza de
los apoyos y el contador su tratamiento fiscal antes de activar `SUPPORT_URL` en producción.

## ADR-049 · Entrar con Google

**Contexto.** Quien desconfía de un proyecto sin empresa no quiere inventar una contraseña. El
fundador aprobó «registro y login con Google» (2026-09-29).

**Decisión.**

- **Solo con credenciales.** `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` (las dos o ninguna,
  validado en el entorno). Sin ellas no hay botón y el callback sigue cerrado: el router HTTP de
  Better Auth (SEC-09) solo abre `/callback/google` cuando están.
- **Arranque desde el servidor.** «Continuar con Google» es un formulario que llama a
  `signInWithGoogleAction`: pide a Better Auth la URL de autorización (`auth.api.signInSocial`)
  con límite por IP y manda ahí. Una cuenta nueva cae en la bienvenida; una existente regresa a
  `next`. Google entrega solo nombre y correo (verificado).
- **Consentimiento explícito.** La cuenta creada por Google no aceptó términos ni aviso al
  registrarse: la bienvenida lo pide con una casilla en el primer paso cuando la cuenta no tiene
  consentimientos, y los guarda con la versión vigente al terminar. Sin la casilla no se completa
  el perfil.
- **Sin enlace automático de cuentas.** Si el correo de Google ya tiene una cuenta con contraseña,
  Better Auth no las une solo (evita tomar una cuenta ajena con un correo que Google reporta).

**Consecuencias.** Pasos del fundador en `docs/deploy.md` (cliente OAuth en Google Cloud, URI de
redirección `<APP_URL>/api/auth/callback/google`, orígenes autorizados). La prueba E2E cubre el
estado sin credenciales; el flujo real se prueba a mano al configurarlas. Siguiente: llaves de
acceso (passkeys) con el plugin de Better Auth.

## ADR-050 · Inicio sin la fila de burbujas

**Contexto.** La fila de burbujas (F5) arriba del feed («Para ti», «Siguiendo» y una por comunidad,
con sugerencias «+» y el conteo «N nuevas» de F7) era el filtro del inicio. El fundador pidió quitarla
(2026-09-30): el inicio debe abrir directo en lo que la gente comparte, sin una franja de navegación
encima.

**Decisión.**

- El inicio pinta el encabezado «Para ti», el compositor (o la bienvenida) y el feed. Se retiran
  `CommunityBubbles`, `HomeFeed`, `feed-filter.ts` y `getHomeBubbles`.
- Las comunidades se abren desde la columna izquierda (escritorio), Descubrir (móvil) y los chips de
  cada publicación: `/c/[slug]` tiene su propio feed, y la columna conserva el conteo «N nuevas».
- «Siguiendo» queda sin entrada en la interfaz por ahora; `/api/feed?following=1` sigue existiendo
  para cuando tenga un lugar (p. ej., la columna izquierda).

**Consecuencias.** En móvil, «N nuevas» por comunidad deja de verse en el inicio (la columna izquierda
es de escritorio). El inicio hace menos consultas por visita. Pruebas: `home.spec` sin burbujas y
`novedades.spec` verifica el conteo solo en la columna de escritorio.

## ADR-051 · Carrusel de productos en el feed

**Contexto.** El fundador pidió (2026-09-30) que, conforme la persona baja por el inicio, aparezcan
productos en carrusel «según sus búsquedas o preferencias» y que, sin información de la persona, se
llene con «los más destacados, los más vendidos, los más populares». El inicio es red social
primero (principios 1 y 2): el comercio entra intercalado, honesto y sin desplazar lo que la gente
comparte.

**Decisión.**

- **Un carrusel por página del feed**, después de la 4.ª pieza (`PRODUCTS_AFTER`), con 8 productos
  (`FEED_PRODUCTS_SIZE`); con menos de 3 no se pinta. La primera página lo trae del servidor
  (`getHomeFirstPage`); las siguientes, en `/api/feed` (`FeedPageDTO.products`). Solo en el inicio:
  ni en comunidades ni en «Siguiendo».
- **Orden de llenado** (`composeFeedProducts`, puro y probado): primero hasta 2 patrocinados
  (`listFeaturedProducts`, siempre con la etiqueta «Patrocinado» y `ref=destacado`), en la 1.ª
  página y cada tres; luego lo personal: la búsqueda declarada vigente (`findActiveIntent` +
  `scoreIntentMatch`, misma regla que «Lo que buscas») o, si no hay, productos publicados en sus
  comunidades; al final los respaldos para quien aún no nos dijo nada: lo más vendido (pedidos
  pagados, 30 días), populares (vistas de ficha, 7 días) y lo recién publicado. Los respaldos rotan
  por página y se desplazan para no repetirse al seguir bajando.
- **Razón escrita, siempre.** El título lo da el tramo que aportó primero («Según tu búsqueda»,
  «De tus comunidades», «Lo más vendido», «Populares», «Nuevo en Estreno») y debajo va la razón («“lentes
  de sol” hasta $800», «En los últimos 30 días»…). Nada de «para ti» sin decir por qué (P4, honestidad).
- **Sin repetidos ni lo propio.** Nunca un producto que ya está en esa página del feed (`dedupe.ts`),
  ni dos veces en el carrusel, ni productos de la propia persona (`productCardsByIds` con
  `excludeUserId`). Solo activos, con existencia y visibles (moderación).
- **El carrusel nunca tumba el feed.** Si su consulta falla, la página va sin él (registro en el
  servidor).

**Consecuencias.** Las tiendas que pagan «Destacar producto» ganan un lugar más (el carrusel del
feed) al mismo precio: el precio no cambia (decisión humana). Costo: una consulta de tarjetas y dos o
tres agregados ligeros por página. Pendiente: medir clics del carrusel por tramo (hoy solo los
patrocinados llevan `ref`) y la búsqueda por foto como nuevo tramo personal.

## ADR-052 · Detalles que se sienten: abrir en capa, micro-respuestas y carrito como panel

**Contexto.** El fundador señaló (2026-09-30) que la app se sentía «vieja» en lo pequeño: tocar algo
cambiaba de página completa, nada respondía al dedo y agregar al carrito te sacaba de donde estabas.
El neuromarketing y la práctica de las apps que la gente usa a diario coinciden: los detalles de
respuesta inmediata son los que se recuerdan. El diseño sigue siendo calmo (ADR-042): un detalle por
momento, movimientos de 150 a 700 ms, nada que suene y todo con salida para quien pide menos
movimiento.

**Decisión.**

- **Abrir sin salir.** Una publicación tocada desde el feed se abre en capa sobre la página
  (`@modal/(.)p/[id]` con rutas paralelas e interceptadas; `RouteModal`). La URL es la misma
  `/p/[id]`: compartirla o recargar abre la página completa; «atrás» o cerrar regresa al feed con el
  scroll intacto. Al navegar a otra ruta desde dentro, la capa se cierra sola al ver que la URL ya no
  es la suya (`RouteModal` compara `usePathname()` con su prefijo): sin ruta comodín en el slot,
  que habría convertido cualquier URL inexistente en un 200. El cuerpo de la publicación es un solo
  componente (`PostDetail`) para la página y la capa.
- **La foto viaja.** La foto de una tarjeta de producto y la primera foto de su ficha comparten el
  nombre de transición (`producto-<id>`, `<ViewTransition share="morph">` de React); el navegador la
  mueve de un lugar al otro. Donde no hay soporte, no pasa nada.
- **Micro-respuestas al tocar.** «Me gusta» salta (`animate-pop`) y el número entra animado;
  activar «me gusta» o «guardar» vibra 10 ms donde el navegador lo permite (`tapHaptic`, nunca con
  «menos movimiento»); guardar avisa «Guardado» con la liga a Guardados; doble toque sobre la foto en
  la vista abierta da «me gusta» (nunca lo quita) y muestra un corazón que crece y se va.
- **Carrito como panel.** «Al carrito» abre un panel (`CartSheet`: abajo en teléfono, derecha en
  escritorio) con las piezas, el subtotal y dos salidas: pagar o seguir viendo. El carrito completo
  sigue en `/carrito`. El DTO del panel no lleva costo (P4) y el subtotal lo suma el código (P2).

**Consecuencias.** Sin sonidos: quedan para las tiendas (venta nueva, mensaje) como opción, cuando
haya ventas reales. Pendientes de la misma línea: el momento de publicar (la pieza entra con un
brillo breve), el revelado de «Ver cómo me veo» con antes y después, mantener presionado para acciones
rápidas. Pruebas: unitarias de `CartSheet`, `toCartSheet`, `RouteModal`, `tapHaptic`, el doble toque y
las animaciones del «me gusta»; E2E del inicio: abrir en capa y regresar.

## ADR-053 · Página de cookies y pie legal en teléfono

**Contexto.** El fundador pidió (2026-09-30) tener a la vista términos, aviso de privacidad y
cookies, como en las redes grandes. El aviso y los términos ya existían y se enlazaban en el pie de la
columna derecha, que en teléfono no existe; de cookies solo había una frase en el aviso.

**Decisión.**

- `/cookies`: inventario real y público de las cookies (sesión `vendeia…`, `estreno-nav`,
  `vendeia_bienvenida`), con duración y tipo, qué guarda el navegador sin ser cookie, cómo borrarlas
  y la promesa de que no hay cookies de terceros ni de publicidad. Se actualiza antes de agregar
  cualquier cookie o proveedor (`docs/legal/00-marco-legal-2026.md` §2.6 es la fuente).
- **Sin «aceptar cookies».** Solo hay cookies necesarias y de preferencia, propias; la ley mexicana no
  exige un banner para eso y ponerlo sería teatro. Si algún día entra una herramienta externa que las
  use, el consentimiento se pide antes (y cambia la CSP, ADR-029).
- **Pie legal compartido** (`LegalFooter`): Privacidad · Términos · Cookies · Publicidad (`/precios`,
  qué pagan las tiendas y cómo se marca «Patrocinado») · Seguridad · Apoya. En escritorio al final de
  la columna derecha; en teléfono al final de Ajustes. No hay «opciones de anuncios» porque no hay
  segmentación publicitaria: lo que la persona controla (sugerencias, historial de búsqueda) vive en
  Ajustes.

**Consecuencias.** Pruebas unitarias de la página y E2E del pie. Pendiente legal: la revisión del
abogado de los tres textos antes del lanzamiento (siguen marcados como borrador).

## ADR-054 · Reacciones además de «me gusta»

**Contexto.** El fundador pidió (2026-09-30) reaccionar con más que un corazón: una noticia triste,
un chisme que da risa o algo que indigna no se expresan con «me gusta», y Facebook, la referencia de
la gente, lleva años con reacciones.

**Decisión.**

- Seis reacciones en orden fijo: ❤️ Me gusta · 🤗 Me importa · 😂 Me divierte · 😮 Me asombra ·
  😢 Me entristece · 😡 Me enoja. Emojis del sistema (gratis y se ven como el teclado de cada quien);
  una por persona y publicación.
- Datos: `Like.kind` (`ReactionKind`, por omisión LIKE: los «me gusta» existentes no cambian).
  `Post.likeCount` sigue contando todas las reacciones y el ranking del feed las pesa igual
  (Facebook puso en cero el peso de «me enoja» en 2021 para no premiar la indignación; queda como
  perilla futura en `ranking.ts`). El resumen (hasta tres tipos más usados) sale de un `groupBy` por
  lote (`reactionTops`), no se denormaliza.
- Una sola acción, `reactAction(postId, kind | null)`: repetir la misma la quita, otra la cambia sin
  mover el total; quitar funciona aunque la publicación ya no esté visible. Evento `LIKE`/`UNLIKE`
  con `metadata.reaction` (y `replaced` al cambiar); mismo límite de frecuencia que «like».
- Interfaz: un toque da ❤️ (o quita la puesta); dejar presionado (teléfono) o pasar el cursor
  (escritorio) abre la tira; con teclado, flecha arriba o el botón «Elegir reacción»
  (`aria-expanded`). El botón muestra la reacción elegida y, junto al número, el resumen de la
  publicación cuando hay reacciones distintas del corazón. El doble toque sobre la foto sigue dando
  ❤️ y nunca quita.
- Fuera por ahora: reacciones en comentarios, lista de «quién reaccionó» y emoji libre (fragmenta el
  resumen y lo vuelve ruido).

**Consecuencias.** Migración `post_reactions`; `FeedItemDTO.viewer.reaction` sustituye a `liked` y
`stats.reactions` trae el resumen (también en `/api/feed`, sin datos personales). Pruebas unitarias
(módulo puro, acción, botón y tarjeta) y E2E del feed.

## ADR-055 · Perfil nuevo en móvil y abrirlo «pasa la página»

**Contexto.** El fundador mandó (2026-10-01) una captura del perfil de Facebook en su teléfono:
«mejora el diseño y sorpréndeme»; antes había pedido que al tocar un perfil se abriera «como pasando
una página desde una esquina». Nuestro perfil era una cabecera plana con avatar, contadores y la lista
de publicaciones.

**Decisión.**

- **Portada sin pedir nada.** La cabecera usa la última foto de la persona desenfocada y más
  saturada (como la cabecera de un artista en Spotify) y, sin fotos, un tinte con «su» tono (el
  mismo del avatar de iniciales). Subir una portada propia queda para cuando haya demanda.
- **Qué se muestra.** Avatar encimado a la portada (anillo rosa si vende), nombre, «@usuario ·
  ciudad · Desde septiembre de 2026», distintivos (Tienda, Cuenta editorial), bio, contadores sin
  ceros, una sola acción primaria (Seguir en perfiles ajenos, Publicar en el propio), Mensaje y
  Compartir perfil. La línea «en común» sale solo de datos propios (principio 6): «Entre quienes
  sigues: Ana, Luis y 3 más» (gente que sigues y que sigue este perfil) y «Comparten Gaming y Moda»;
  solo con sesión y en perfiles ajenos.
- **Pestañas** Publicaciones · Fotos (cuadrícula de 3, cada foto abre su publicación en capa) ·
  Tienda (solo si vende: la misma tarjeta de Comprar; el perfil es la tienda, no hay otra página).
  `?ver=tienda` abre en Tienda, y «Vendido por» en la ficha del producto llega ahí.
- **Pasar la página.** Los enlaces de perfil llevan `transitionTypes={["perfil"]}`
  (`lib/page-turn.ts`). Con ese tipo activo (`:active-view-transition-type(perfil)`) la instantánea
  vieja de la raíz se enmascara en diagonal desde la esquina inferior derecha (560 ms, borde suave) y
  debajo ya está la pantalla nueva: primero el esqueleto del perfil (`loading.tsx`, envuelto en un
  `<ViewTransition enter>` porque sin un límite afectado React no inicia la transición) y luego la
  ficha, que entra con un fundido (`page-ink`); React espera a que termine la transición en curso
  antes de confirmar la siguiente. Solo perfiles: abrir a una persona es un gesto distinto a abrir
  un producto. «Atrás» no anima (los navegadores no mandan tipo); con «menos movimiento» o sin
  soporte, cambio normal.

**Consecuencias.** `getPublicProfile` suma ciudad, antigüedad, tienda y lo «en común» (dos consultas
más, solo con sesión); `listSellerShowcase` alimenta la pestaña Tienda. Pruebas unitarias (textos,
cabecera, pestañas) y E2E (abrir un perfil desde el feed registra el tipo «perfil»; seguir, mensaje y
cerrar sesión siguen igual). Para después: portada propia, lista de seguidores, vista rápida del perfil.

## ADR-056 · Panel del vendedor con las métricas que importan

**Contexto.** El fundador mandó (2026-09-30) una captura del panel de vendedores de Mercado Libre: «a
los vendedores les gustan las métricas, usa las más importantes». El Resumen del Studio tenía seis
cifras sueltas de 30 días y Analítica estaba vacía: quien vende no sabía qué le urgía ni cómo iba
contra la semana pasada. Aprobado el 2026-10-01 («haz los pasos que están en la mesa»).

**Decisión.**

- **Arriba, la semana** (7 días contra los 7 anteriores): Ventas con su tendencia y una línea de
  ventas por día (SVG propio, en hora de México), Por despachar, Mensajes sin leer y Visitas con su
  tendencia. Cada mosaico lleva a su lista.
- **Pendientes**, como las tarjetas de Mercado Libre: en ventas, por despachar (con la antigüedad
  del más viejo), en camino, pagos simulados por cancelar y mensajes; en productos, ocultos por
  moderación, agotados, comprobante de autenticidad pendiente, sin foto y borradores. Cada uno
  abre Productos filtrado (`?filtro=`) con la misma regla que su número (`PRODUCT_PENDINGS`). Sin
  pendientes: «Todo en orden». Los reportes abiertos no se muestran a la tienda (solo lo que el
  equipo ya resolvió: «oculto»).
- **Desempeño** en lugar de la reputación pública: tiempo para despachar (mediana entre pago y
  salida; excelente ≤ 24 h, bien ≤ 72 h) y cancelaciones (excelente < 2 %, bien < 5 %), en 30 días,
  solo con cobros reales y a partir de 5 pedidos; antes dice «aún sin datos suficientes». Un pago
  simulado se cancela por regla (SEC-01) y no cuenta en contra.
- **Embudo de 30 días** (visitas, guardados, al carrito, pedidos, con «X % de las visitas») y
  **actividad por producto** (visitas, guardados, al carrito, pruebas de «Ver cómo me veo»,
  vendidos y conversión): los 5 más vistos en el Resumen y todos en Analítica.
- Se queda el **beneficio estimado** (la métrica norte, que Mercado Libre no tiene), el camino a la
  primera venta y de dónde llegan las visitas.
- Fuera, porque no aplica o no hay datos: niveles de reputación pública, reclamos y mediaciones,
  créditos, dinero por adelantar, espacios de bodega y colecta.

**Consecuencias.** Todo lo calcula código probado (`seller-panel.ts`, P2) con consultas agrupadas
(`seller-panel-queries.ts`); sin migración. Pruebas: unitarias de los cálculos y las piezas, de
integración contra PostgreSQL (`seller-panel-queries.db.test.ts`) y la E2E de venta completa. Para
después: una insignia de «tienda confiable» con los mismos datos de desempeño cuando haya volumen.

## ADR-057 · Comentarios en un panel que sube desde abajo y mosaico de varias fotos

**Contexto.** El fundador (2026-10-01): «en Facebook al oprimir comentar se abre la pantalla de abajo
para arriba; hagamos lo mismo o mejóralo», y «si alguien sube varias imágenes deben verse así, para no
abarcar mucho espacio» (captura de un mosaico de 5 fotos). Comentar llevaba a la publicación completa
y las ventas mostraban un carrusel aun con varias fotos.

**Decisión.**

- **Comentarios en panel** (`RouteDrawer`, sobre el cajón de Base UI): «Comentar» y «¿Qué opinas?»
  abren `/p/[id]/comentarios` interceptada en el slot `@modal`. En teléfono el panel sube desde abajo
  (85 % de la pantalla, con su asa) y se cierra deslizándolo hacia abajo, con la X o con «atrás»; en
  escritorio entra por la derecha. Arriba, el total y el resumen de reacciones; en medio, la
  conversación; abajo, fijo y por encima del teclado, el campo de una línea que crece con el texto y
  un botón de enviar al alcance del pulgar (vibra al enviar). La publicación sigue detrás y el scroll
  no se pierde. Recargar la URL abre la publicación completa en sus comentarios (`#comentar`).
- No se usó el «pasar la página» del perfil: abrir a una persona es ir a otro lugar; comentar es
  quedarse en la publicación. El panel comunica eso.
- **Mosaico como Facebook** para varias fotos, también en ventas: 2 lado a lado, 3 con una grande, 4
  en 2×2 y **5 o más con dos arriba y tres abajo** y «+N» en la última. La venta con una sola foto y la
  publicación abierta siguen en carrusel con el precio encima; en el mosaico el precio va en el
  bloque del producto (una sola vez).

**Consecuencias.** `CommentList` y `CommentComposer` se comparten entre la página y el panel;
`createCommentAction` revalida también la ruta del panel. Pruebas unitarias (panel, formulario,
mosaico, tarjeta) y E2E (publicar 5 fotos, mosaico en el perfil, comentar desde el panel y cerrarlo
con «atrás»).

## ADR-058 · Editar perfil con portada propia, y listas de seguidores

**Contexto.** En la mesa estaban «portada propia» y «lista de seguidores». Al revisarlo apareció un
hueco: el botón «Editar perfil» (ADR-055) llevaba a Ajustes, donde no se podía cambiar el nombre, la
presentación ni la foto; en ningún lugar se podía subir una foto de perfil.

**Decisión.**

- **Editar perfil** (`/perfil/editar`): portada, foto de perfil, nombre visible, ciudad y presentación
  (160 caracteres con contador). El usuario (@nombre) no cambia: es la dirección del perfil y de los
  enlaces compartidos. Las imágenes se suben con el mismo `/api/uploads` (validación, re-codificación,
  sin metadatos) y solo se aplican al guardar; nunca una foto de otra persona, un comprobante de
  autenticidad o una foto de Pruébatelo (lo revisa la acción y, además, un trigger en `profiles`).
- **Datos:** `Profile.avatarMediaId` y `Profile.coverMediaId` (únicos, `SET NULL`); `avatarUrl` guarda
  la URL de la foto para no tocar a quienes ya la leen. Una foto de perfil o portada es pública en
  `/media` mientras lo sea, y el recolector de huérfanas no la borra; la que se reemplaza queda sin
  usar y se borra a las 24 h.
- **Perfil:** con portada propia se ve nítida (proporción 3:1); sin ella sigue la automática
  (ADR-055). En el perfil propio, dos atajos de cámara (portada y foto) llevan a Editar perfil, como
  en Facebook.
- **Seguidores y seguidos** (`/u/[usuario]/seguidores` y `/siguiendo`): los contadores del perfil
  abren la lista; pestañas entre las dos, cada persona con su foto, sus distintivos y «Seguir» de
  vuelta, de 30 en 30 con «Ver más». Las listas son públicas, como el perfil.

**Consecuencias.** Migración `profile_photos` con el trigger. Límite de 20 ediciones por hora por
cuenta. Pruebas: esquema y acción (dueño de la foto, fotos privadas, quitar), cabecera, lista
(unitarias), ruta de medios (foto de perfil pública) y E2E (editar con portada y foto públicas;
seguir y verlo en la lista).

## ADR-059 · La campana de avisos

**Contexto.** En la mesa desde el 2026-09-30 («centro de avisos, como la campana de Facebook»). Con
reacciones, comentarios en panel y seguidores, la gente no sabía cuándo alguien interactuaba con lo
suyo, y las tiendas no sabían que tenían un pedido nuevo hasta abrir el Studio.

**Decisión.**

- **Qué avisa:** alguien reaccionó a tu publicación (con su emoji), la comentó o empezó a seguirte;
  a quien vende, un pedido pagado; a quien compra, que su pedido salió, se entregó o la tienda lo
  canceló. Los mensajes privados conservan su propio globo (ADR-047).
- **Sin ruido:** una reacción por persona y publicación (cambiarla no avisa otra vez; quitarla
  quita el aviso), un aviso de seguimiento por persona, nada de lo que hace uno mismo, y lo retirado
  por moderación deja de avisar. Se agrupan como en Facebook: «Ana, Luis y 3 personas más
  reaccionaron a tu publicación», los comentarios por publicación (citando el más reciente) y los
  seguidores nuevos del mismo día.
- **Dónde:** una campana en la barra superior (teléfono y escritorio) con el número de avisos sin
  leer, que se mece una vez cuando hay nuevos. `/avisos` muestra «Nuevos» y «Anteriores»; cada aviso
  lleva a donde pasó (la publicación, el panel de comentarios, el perfil o el pedido) y abrir la
  página los marca leídos.
- **Datos:** `Notification` (quién recibe, quién causó, tipo, publicación, comentario, pedido,
  reacción, `dedupeKey`, leído). Se borra con cualquiera de ellos y a los 90 días (operación diaria).
  Crear un aviso nunca rompe la acción que lo causó.

**Consecuencias.** Migración `notifications`; un conteo más en el resumen de la barra. Para después:
avisos por correo o push (necesitan proveedor y consentimiento), menciones con @ y ajustes de qué
avisar. Pruebas: agrupación y textos, lista (unitarias), servicio contra PostgreSQL, acciones que
avisan y la E2E con dos cuentas.

## ADR-060 · «Contexto»: resumen de publicaciones largas

**Contexto.** Idea del fundador (2026-09-30): «hay gente que publica con demasiado texto y algunos
mejor entran a ver los comentarios, tergiversando la noticia; un botón «Contexto» que nos dé un
resumen». Aprobado con lo demás de la mesa el 2026-10-01.

**Decisión.**

- **Cuándo:** solo en publicaciones de 500 caracteres o más (unas 90 palabras); lo corto se lee solo.
  El botón «Contexto» va bajo el texto y despliega el resumen dentro de la misma tarjeta.
- **Qué dice:** 2 o 3 oraciones neutrales en tercera persona, solo con lo que dice la publicación:
  sin opinar, sin agregar datos y marcando rumores u opiniones como tales. El código limpia la salida
  (quita oraciones con teléfonos, correos, ligas o cuentas; máximo 320 caracteres) y debajo se lee
  «Resumen hecho con IA a partir de esta publicación. Puede omitir matices» (o «Texto de ejemplo» con
  la IA simulada). El nombre no lleva «IA» (ADR-041); la nota sí, por honestidad.
- **Costo (§7 del modelo de ingresos):** se genera al primer toque y se guarda para todos
  (`PostContext`, con el sha256 del texto: si la publicación cambia, se rehace). Leer uno guardado es
  gratis, también sin sesión; generar uno nuevo pide sesión, cuenta 30 por hora por persona y va sin
  cuota personal de IA (es de la publicación, no de quien la abre) pero dentro del presupuesto mensual
  y con un tope diario propio de US$0.50. Un resumen cuesta ≈ US$0.00015.
- **Interruptor:** función `postContext` en `/admin/ia` (encendida por omisión, como las demás ya
  construidas) y tarea `post_context` enrutable a otro modelo.

**Consecuencias.** Migración `post_context` (tabla y valor `POST_CONTEXT` de `AIFeature`). Pruebas:
reglas y limpieza, servicio (guardado, sesión, límite, generación, fallo), botón (unitarias) y E2E
(publicación larga con resumen; corta sin botón).

## ADR-061 · Buscar con una foto

**Contexto.** En la mesa desde el resumen del 2026-09-30 («búsqueda por foto»); aprobada con lo
demás el 2026-10-01. Es la búsqueda por imagen de la fase 4 del ecosistema de IA (`imageSearch`).

**Decisión.**

- **Cómo funciona:** en `/buscar/foto` (enlace «Con foto» en Buscar) la persona elige una foto de su
  galería o de la cámara. El navegador la reduce a 1024 px; el servidor la vuelve a reducir a 768 px,
  en JPEG y sin metadatos (sin ubicación), y se la manda a un modelo que ve imágenes. El modelo solo
  describe hasta 4 cosas que se pueden comprar, con el nombre más común en México («jeans», no
  «pantalón de mezclilla») y su color. El código (P2) limpia eso, arma búsquedas de la más precisa a
  la más general («camisa de lino blanca» → «camisa de lino» → «camisa blanca» → «camisa») y busca
  productos reales con la búsqueda de siempre (moderación y existencias incluidas). Cada cosa es un
  botón; los productos son reales y la nota lo dice («Descrito con IA; los productos son reales»).
- **Privacidad:** la foto no se guarda en ningún lado: ni en el almacenamiento ni en el registro de
  IA (solo queda que hubo una foto). El modelo tiene prohibido describir o identificar personas
  (rostro, edad, cuerpo, si es famosa) y lo que diga la foto es un dato, no una instrucción.
  OpenRouter con cero retención (`zdr`) y sin recolección de datos. La promesa se lee antes de
  elegir la foto: «Tu foto no se guarda… Nunca reconocemos a las personas».
- **Costo y topes (§7 del modelo de ingresos):** ≈ US$0.0002 por foto, medido con Gemini 2.5 Flash
  Lite (1,494 tokens de entrada y 116 de salida, proveedor Google). Solo con sesión; 10 por hora y 20
  al día por persona, dentro de las cuotas y del presupuesto mensual de IA. Antes de reducir la foto
  (CPU) cuentan los intentos: 30 por hora por cuenta y 60 por IP, también con archivos que no sirven.
- **Modelo:** `AI_VISION_MODEL` (el modelo de texto por omisión no ve imágenes) o la ruta de la
  tarea `image_search` en `/admin/ia`. Sin modelo, la página dice que no está disponible; con la IA
  simulada, el simulador «ve» una camisa blanca y unos jeans azules. Interruptor `imageSearch`.
- **Por qué no embeddings de imagen (pgvector):** con el catálogo de hoy, describir y buscar por texto
  es más barato, explicable y no obliga a procesar cada foto del catálogo. Los embeddings quedan para
  cuando el volumen lo pida (ya marcado como V2+ en `docs/mvp-0.1.md`).

**Consecuencias.** Migración `image_search` (valor `IMAGE_SEARCH` de `AIFeature`). El adaptador
OpenAI-compatible acepta fotos en el mensaje (`images`), contadas como 1,100 tokens cada una para el
tope de entrada, así el costo real no pasa del reservado. Cada búsqueda registra `SEARCH` con
`scope: "photo"` (lo que se buscó y cuántos productos salieron; nunca la foto). Pruebas: conversión a
búsquedas (el color no se repite aunque cambie de género o número), servicio (foto reducida sin
EXIF, sin modelo de visión, foto inválida antes de gastar, cuota, búsqueda más general), adaptador
con fotos y E2E (foto → cosas → productos semilla; sin sesión → entrar).

## ADR-062 · Videos cortos

**Contexto.** Último punto de la mesa aprobada el 2026-10-01. P13 pedía un proveedor de video
gestionado (Cloudflare Stream, Mux o Bunny) para transcodificar, pero cobra por minuto guardado y
visto sin que nadie lo pague: el plan de sostenibilidad (§7 del modelo de ingresos) eligió guardar
los videos en R2 tal cual, con topes, para que la función no pierda dinero.

**Decisión.**

- **Qué:** una publicación lleva fotos o un video corto (no los dos), de hasta 60 s y 50 MB, en MP4
  o MOV (lo que graba cualquier teléfono). En «Nueva publicación» se elige «Fotos | Video»; lo de la
  otra pestaña no se pierde al cambiar.
- **Sin transcodificar:** el archivo se guarda como llega. El servidor lo valida leyendo su
  estructura por rangos, unos KB (`media/video-container.ts`): `ftyp` y `moov` (también al final del
  archivo), duración de 60 s o menos, hasta 4K, video H.264 o HEVC y audio AAC u Opus (o sin audio).
  Lo demás se borra de inmediato con el motivo («Ese archivo no es un video MP4 o MOV»). Un video
  fragmentado sin duración declarada (grabado en un navegador) se rechaza. Un HEVC en un navegador
  que no lo reproduce muestra la portada con un aviso.
- **El archivo nunca pasa por la app** (Vercel corta en 4.5 MB): con R2, el navegador lo sube con una
  URL firmada (PUT con tamaño y tipo firmados, 15 minutos) y `/media` autoriza como siempre y
  redirige a una URL firmada de lectura (1 h, fechada por bloques de 10 minutos para que el navegador
  reuse lo descargado). R2 no cobra la salida. En desarrollo, una ruta local recibe el archivo y
  `/media` lo sirve por rangos (Safari no reproduce sin ellos).
- **Portada:** el navegador toma un cuadro cerca del primer segundo y lo sube como una foto (se
  re-codifica sin metadatos). Es pública solo mientras su video lo es.
- **En el feed (P13):** empieza solo y sin sonido cuando se ve al menos el 60 %; con ahorro de datos,
  red 2G o «reducir movimiento» solo baja la portada (`preload="none"`) y empieza al tocarlo. Uno a la
  vez; la bocina activa el sonido. Abierto, con los controles del navegador.
- **Privacidad y moderación, como las fotos:** privado hasta publicarse, el recolector borra lo
  abandonado a las 24 h (la portada, en la tanda siguiente a su video), reportes y ocultamiento del
  equipo. Ventana de retiro: una URL firmada ya entregada sirve hasta ~1 h, más 10 minutos de caché
  del navegador (en las fotos es la caché de 1 h, ADR-039).
- **Topes:** 5 videos por hora y 15 al día por cuenta, 30 por hora por IP; cada URL firmada sirve
  para un archivo de ese tamaño exacto.
- **En producción, apagado hasta configurar el CORS del bucket** (`VIDEO_UPLOADS=true`,
  `docs/deploy.md` paso 4 bis). Los ya publicados se ven siempre.
- **Después:** fila de Reels y visor vertical (P13), subtítulos, métricas (vista a 3 s) y
  transcodificación con un proveedor cuando haya ingresos que la paguen.

**Consecuencias.** Migración `short_videos` (`durationMs`, `videoCodec`, `posterId` único con un
CHECK: solo un video tiene portada). Dependencia `@aws-sdk/s3-request-presigner` 3.1140.0 (la misma
versión que el cliente). CSP: `media-src` y `connect-src` permiten solo el origen del bucket. Las
fotos de publicaciones, productos y Sube y vende exigen `kind: IMAGE`: un video no se cuela como
foto. Pruebas: estructura (MP4, `moov` al final, MOV girado, HEVC y cada rechazo con videos reales de
`tests/fixtures/video`), almacenamiento (rangos, recepción local, URLs firmadas), servicio, `/media`
(video y portada), recolector (portada), DTO, tarjeta y E2E (subir, revisar, publicar y reproducir;
un archivo falso se rechaza).

## ADR-063 · Creadores: recomendar productos de otras tiendas (etapa 1, sin dinero)

**Contexto.** Idea del fundador (2026-10-01): «una sección para creadores de contenido, como TikTok
Shop: enviar a la persona a ver cómo se le ve el producto y, pum, compra». La simulación de
ganancias de ese día mostró que con solo pruebas y destacados el ingreso por persona es muy bajo; la
palanca grande es la comisión por venta. Pero TikTok Shop reparte comisiones porque cobra dentro de
la app, y aquí los pagos van por fuera (decisión del fundador): sin el pago dentro no se puede
comprobar una venta ni repartir sin prestarse a fraude. Por eso son dos etapas; esta es la primera.
El fundador aprobó además que cada tienda decida si acepta colaboraciones.

**Decisión (etapa 1).**

- **La tienda lo activa.** `SellerProfile.acceptsCollaborations` (apagado por omisión) en Studio →
  Colaboraciones. Con él encendido, cualquier persona puede etiquetar un producto de esa tienda (a
  la venta y visible) en su publicación o video; lo propio se etiqueta como siempre. Reglas puras
  en `creators/rules.ts`; la acción de publicar las aplica en el servidor.
- **La tienda conserva el control.** Recibe un aviso por cada etiqueta, ve en su panel quién la
  etiquetó y puede quitar la etiqueta de cualquier publicación (la publicación sigue, ya sin el
  producto, y quien publicó recibe un aviso). Desactivar las colaboraciones impide etiquetas nuevas;
  las que existen se quitan una por una.
- **La publicidad se identifica** (LFPC art. 32). Quien etiqueta el producto de otra tienda declara
  si recibió algo por publicarlo (pago, producto o comisión); con esa declaración la tarjeta dice
  «Colaboración con <tienda>». La tienda también puede marcarla desde su panel. Solo se marca: no se
  desmarca. Siempre, con o sin acuerdo, el bloque del producto dice «Vendido por <tienda>».
- **Del video a probárselo y a comprar.** En un video con producto, el precio y «Ver cómo me veo» van
  encima del video (una sola vez por tarjeta). La ficha conserva de qué publicación llegó la persona
  también al probarse la prenda y al comprar desde ese diálogo (antes se perdía).
- **Qué ve cada quien.** `/creadores` (pública): cómo funciona, los productos que se pueden
  recomendar y, con sesión, lo que logró cada publicación propia. Studio → Colaboraciones: lo mismo
  por cada publicación que etiqueta sus productos. Cuatro conteos: visitas a la ficha, pruebas, veces
  al carrito y pedidos pagados. Solo conteos, nunca quién ni montos. Una visita solo cuenta si la
  publicación es de ESE producto (`analytics/integrity.ts`) y una vez por persona y hora.
- **Sin dinero de por medio.** Estreno no cobra ni reparte comisiones: cualquier acuerdo es entre la
  tienda y quien publica, y ambas pantallas lo dicen. Las pruebas que lleguen de esas publicaciones
  las paga la tienda como siempre (saldo con tope diario, o cortesía).

**Etapa 2 (después, decisión del fundador).** Comisión automática a quien publica por cada venta,
con una parte para Estreno. Requiere que el pago pase por la plataforma (Mercado Pago o Stripe con
reparto), retención de impuestos a quienes cobren y revisión de contador y abogado. La atribución
que hoy se guarda en cada pedido (`OrderItem.sourcePostId`) es la base.

**Consecuencias.** Migración `creator_collaborations` (`acceptsCollaborations`, `Post.collaboration`
y dos tipos de aviso). Módulo `creators`. Costo: ≈ $0 (filas en la base). Riesgos: un video muy visto
puede gastar el saldo de pruebas de una tienda (lo frena su tope diario) y una etiqueta engañosa (la
tienda la quita; los reportes y la moderación siguen igual). Pendiente del abogado: una cláusula de
colaboraciones en los términos. Pruebas: reglas, métricas, servicio contra PostgreSQL (quién ve
qué, quién marca y quién quita), acción de publicar, tarjeta, avisos y E2E del flujo completo.

**Adenda (2026-10-01).** La cláusula ya está escrita para que el abogado solo la revise: términos
versión 2026-10-01 (`/terminos#colaboraciones`; borrador con fundamento en
`docs/legal/02-terminos-y-reglas.md`, A11 quater y C16) y aviso de privacidad (qué ven la tienda y
quien publica, §7 quater). Al escribirla: en un video, la etiqueta «Colaboración» también va encima
del video, para que se vea durante todo el contenido aunque la tarjeta ya no se vea completa (guía
de publicidad de la PROFECO).

## ADR-064 · Visor de fotos y video al abrir una publicación

**Contexto.** Observación del fundador (2026-10-01): «cuando voy a ver las fotos donde son más de 5
se abre un feed hacia abajo; se ve mal». La capa que abre una publicación desde el feed (ADR-052)
pintaba la página completa en una columna de 672 px: la foto (más alta que la ventana de una
laptop), los comentarios y «Más de <comunidad>» con más publicaciones. Para ver la foto completa
había que desplazarse, y debajo seguía un feed dentro de la capa.

**Decisión.**

- **En la capa no hay «Más de…»**: el feed ya está detrás. La página completa `/p/[id]` (la puerta
  de los enlaces compartidos, P1) lo conserva.
- **Visor en escritorio.** Con fotos o video, en pantallas anchas (≥ 1024 px) la capa se ensancha y
  toma el 92 % del alto: la imagen a la izquierda sobre negro, ajustada a la ventana y fija; a la
  derecha, en una columna de 400 px que se desplaza, autor, texto, producto, acciones (barra de
  íconos) y comentarios. Es CSS: la publicación es una rejilla y la imagen una celda fija
  (`position: sticky`); el orden del documento no cambia, así que en teléfono se ve apilada como
  siempre. La capa se ensancha sola con `:has([data-layout="theater"])`.
- **La foto abierta nunca es más alta que la ventana**, también en la página completa y en teléfono:
  el marco se angosta conservando su proporción (como ya hacía el video, ADR-062).
- De paso: el marco y los controles del video usan negro fijo (con el tema oscuro, el marco salía
  claro).

**Consecuencias.** `PostCard` acepta `layout="theater"` y `children` (los comentarios van dentro de
la publicación en el visor); `PostDetail` recibe `layer`. Pruebas: tarjeta (visor con fotos, sin
fotos y sin abrir) y E2E `viewer.spec.ts` (lado a lado y dentro de la ventana en escritorio, apilado
en teléfono, una sola publicación en la capa y comentar desde el visor).

## ADR-065 · Perfil ancho en escritorio, con accesos a vender y comprar

**Contexto.** Petición del fundador (2026-10-01) con una captura de un perfil de Facebook en
escritorio: «al abrir el perfil debe verse así; que desaparezcan las secciones de los costados y que
los botones sean los del panel para vender o comprar, o a tu criterio». El perfil de ADR-055 se
diseñó para teléfono; en escritorio vivía en la columna de 680 px entre las dos columnas laterales.

**Decisión.**

- **Página ancha.** Una página pide el ancho con el atributo `data-page-wide` en su contenido; el
  marco (`AppShell`) oculta entonces las dos columnas laterales y centra el contenido a 992 px. Es
  CSS (`:has`), sin otro layout ni otra ruta: la barra de arriba y la capa de publicaciones siguen
  igual. Hoy solo la usa el perfil (y su esqueleto de carga, para que la página no cambie de forma al
  llegar). Al salir del perfil las columnas vuelven.
- **Cabecera como Facebook en escritorio.** Portada ancha pegada a la barra de arriba con las
  esquinas de abajo redondeadas, avatar grande encimado, el nombre con sus contadores al lado y las
  acciones a la derecha. Las publicaciones conservan su ancho de lectura (680 px), centradas.
- **Botones (criterio del IA-CEO).** Perfil propio: «Panel» (el Studio; es la acción primaria de
  quien vende, y dice «Vender», sin color primario, para quien aún no tiene tienda), «Mis compras»
  (pedidos) y «Editar perfil». «Publicar» ya vive en «Crear» (barra de arriba y botón central), así
  que sale del perfil: menos botones. «Cerrar sesión» queda en ícono en escritorio (el menú del
  avatar ya lo ofrece). Perfil ajeno: «Seguir», «Mensaje» y, si tiene productos a la venta, «Ver
  tienda» (abre su pestaña Tienda).
- **Teléfono:** igual que ADR-055, salvo que los contadores van bajo el nombre y los botones son los
  mismos de arriba.

**Consecuencias.** `AppShell` y `SideNav` marcan las columnas con `data-rail`. Pruebas: cabecera
(botones propios, sin tienda y «Ver tienda») y E2E (en escritorio no hay columnas laterales y la
portada pasa de 900 px; al ir a «Mis compras» vuelven).

## ADR-066 · Redacción diaria: la IA redacta y el equipo publica

**Contexto.** El fundador (2026-10-01): «cuando lancemos va a estar literalmente vacía; ¿la IA puede
ir subiendo información para enganchar a la gente?». Copiar de Facebook se descartó (derechos de
autor, términos de Meta, datos personales; ADR-018 ya lo prohíbe). Se propuso una redacción diaria
con aprobación y el fundador la pidió («agrega ambas»).

**Decisión.**

- **Qué:** cada mañana (paso `editorial-drafts` de la operación diaria, el último porque es el único
  que llama a un modelo) la IA deja un borrador por comunidad oficial para su cuenta editorial
  («Equipo Estreno»). En `/admin/redaccion` el equipo lo ajusta y lo publica con un toque, o lo
  descarta; también puede pedir uno más, con un tema propio (algo que pasa hoy). **Nada se publica
  sin aprobación.** Lo que nadie revisa en 3 días se descarta solo; con 3 borradores sin revisar, la
  comunidad deja de recibir automáticos.
- **El código decide el encargo (P2):** el tipo (dos preguntas por cada consejo; Humor, solo
  preguntas), un enfoque que rota por día y por comunidad, y las fechas del calendario mexicano
  (`editorial/calendar.ts`: fijas o con regla, como el Día del Padre y el Buen Fin), escalonadas entre
  comunidades y una sola vez por comunidad. La fecha y lo que falta los escribe el código; la IA solo
  redacta.
- **Honestidad (ADR-018, P4):** la cuenta se marca «Editorial» y cada publicación «Con ayuda de IA»,
  aunque el equipo reescriba el texto. El prompt prohíbe noticias, cifras, nombres reales, marcas,
  anécdotas propias, política, religión y consejos médicos, legales o financieros; el código además
  quita ligas, datos de contacto, montos y porcentajes, hashtags y Markdown, y rechaza lo que choque
  con la política de contenido de la IA o repita una publicación reciente. Nunca crea usuarios,
  comentarios, reacciones ni seguidores. El tema que escribe el equipo se limpia de datos de contacto
  y pasa por la misma política; si es una noticia, la debe haber comprobado el equipo (lo dice el
  formulario).
- **Privacidad:** el modelo solo recibe el nombre y la descripción de la comunidad, el encargo y el
  inicio de los textos recientes de la propia cuenta editorial; ningún dato de personas.
- **Modelo y costo:** nueva tabla `TASK_DEFAULT_MODELS` (modelo de arranque de una tarea sin ruta en
  `ai.routing`): la redacción usa Gemini 2.5 Flash Lite en lugar del modelo de texto del entorno. Con
  los mismos 5 encargos (preguntas, consejo, fecha y tema), Qwen3.5-9B escribió frases sin sentido
  («una cara rara cuando salimos de la olla») y Gemini un español de México natural, a un costo
  parecido: ≈ US$0.00007 por borrador, ≈ US$0.03 al mes con 12 comunidades. Tope diario de US$0.25,
  dentro del presupuesto mensual de IA; tarea del sistema, sin cuota personal. En producción con la
  IA simulada no redacta (las plantillas no se publican como contenido del equipo). Interruptor
  `editorialDesk` en `/admin/ia`.
- **Cuenta editorial:** `editorial/account.ts`, la misma que usa el seed. En producción el seed no la
  crea: se crea al publicar el primer borrador de la comunidad, sin contraseña (nadie puede entrar con
  ella), con correo `.invalid` y el usuario reservado `equipo.<comunidad>`. Como se crea tarde y el
  registro no verifica correos, alguien podría registrarse antes con ese correo: el registro y los
  hooks de Better Auth rechazan cualquier correo `.invalid` (`isReservedEmail`), y la redacción solo
  publica con una cuenta de perfil editorial y sin forma de iniciar sesión (si no, «la ocupa otra
  cuenta» y no publica).

**Consecuencias.** Migración `editorial_desk` (`EditorialDraft`, `EditorialDraftKind`,
`EditorialDraftStatus` y `AIFeature.EDITORIAL_DRAFT`). Módulo `src/modules/editorial`; «Redacción»
en el menú de `/admin` y su conteo en el Resumen. `pnpm db:clean-e2e` borra los borradores «E2E …» y
lo que se publicó con ellos. Términos versión 2026-10-01 (A11 quinquies del borrador). Pruebas:
calendario, encargo, limpieza del texto, prompt y simulador; servicio contra PostgreSQL (solo ADMIN,
uno por comunidad y día, cola llena, fechas, rechazos, doble toque y vencimiento); E2E
`editorial.spec.ts` (ajustar y publicar como la cuenta editorial, descartar y 404 sin el rol).
**Después:** fotos con licencia para los borradores, hora de publicación y medir qué tipo de
publicación genera conversación para que el código ajuste la mezcla.

## ADR-067 · Videos sin ubicación ni datos del teléfono

**Contexto.** Al escribir el aviso de privacidad de los videos (2026-10-01) vimos que ADR-062 guarda
el archivo tal como llega: los teléfonos guardan dentro del video el lugar donde se grabó (Android en
`udta/©xyz`; iPhone en `meta`, con `com.apple.quicktime.location.ISO6709`), la marca, el modelo y el
programa. Una tienda que graba en su casa publicaría dónde vive. Las fotos ya se re-codifican sin
metadatos (A5 de los términos).

**Decisión.**

- **El navegador los quita antes de subir:** cada caja de metadatos (`udta`, `meta` y `uuid` de
  primer nivel y de `moov`; `udta` y `meta` de cada pista) se vuelve una caja `free` del mismo tamaño
  llena de ceros. Sin transcodificar ni copiar el archivo (un `Blob` hecho de pedazos del original),
  del mismo tamaño (la URL firmada sigue valiendo) y con los cuadros en su lugar. El dato deja de
  estar en el archivo, no solo se esconde.
- **El servidor lo exige:** `assertNoMetadata` después de revisar la estructura; un video que todavía
  los traiga se borra con el motivo («Vuelve a elegirlo»).
- **Lo que no cubre:** la ubicación que algunas cámaras de acción guardan como pista de telemetría
  dentro de `mdat` (hasta donde sabemos, la cámara de los teléfonos no lo hace). Si llega a importar,
  se rechazan las pistas de metadatos con tiempo.

**Consecuencias.** `media/video-metadata.ts`, sin dependencias (navegador, servidor y pruebas);
`video-container.ts` expone su recorrido de cajas. Pruebas con los videos reales y con uno armado con
la ubicación de Android, de iPhone, de una pista y un XMP de 64 bits: después no queda rastro y se
reproduce igual; el servidor rechaza el original. Aviso de privacidad versión 2026-10-01 («Videos»).

## ADR-068 · Avisos, mensajes y «Crear» se abren ahí mismo

**Contexto.** El fundador (2026-10-01): «¿por qué las notificaciones y los mensajes se abren en otra
página? Estaría bien que al oprimir el botón de mensajes se abra un recuadro ahí mismo… y al oprimir
alguno se abra ahí mismo la conversación», y después: «lo mismo pasa al hacer una nueva
publicación». Ir a otra página sacaba a la persona del feed y perdía dónde iba.

**Decisión.**

- **Campana y mensajes en un recuadro** (`components/layout/inbox-surface.tsx`): en tableta y
  escritorio, un recuadro bajo su botón, como Facebook; en teléfono, un panel que sube desde abajo
  (Base UI Drawer, se cierra deslizando, el campo de escribir queda sobre el teclado). La página de
  atrás no se mueve. Avisos: se ven ahí y quedan leídos (igual que /avisos). Mensajes: la bandeja y,
  al tocar una conversación, el hilo en el mismo recuadro, con su campo para escribir y refresco cada
  10 s mientras está a la vista; abrirlo lo marca como leído. Los globos de la barra bajan ahí mismo,
  sin recargar la página. /avisos y /mensajes siguen para verlo todo.
- **«Crear» abre sus opciones ahí mismo** (menú, `components/layout/create-menu.tsx`), arriba en
  escritorio y en el «+» de abajo en teléfono. **«Publicación» abre una ventana encima** de donde
  estabas (ruta interceptada `@modal/(.)crear/publicacion`, como la capa de las publicaciones de
  ADR-052): el campo del inicio también. Al publicar, la publicación nueva se abre en su capa y
  reemplaza a la ventana en el historial: cerrar regresa al feed, que ya la muestra arriba. Recargar
  abre la página completa.
- **Lo tuyo va primero en tu inicio durante una hora**, como en Facebook (motor del feed v1, motivo
  `own`). Antes, una publicación sin comunidad ni reacciones competía con las de tus comunidades y
  podía quedar fuera de la primera página: al cerrar la capa no la encontrabas.
- **Mejora progresiva:** los tres botones son enlaces a su página (/avisos, /mensajes, /crear)
  hasta que la página termina de cargar y se sabe el tamaño de la pantalla; después abren su panel.
  Un toque temprano nunca se pierde.

**Consecuencias.** Acciones `loadNotificationsAction`, `loadInboxAction` y `loadThreadAction` (las
mismas consultas y reglas que las páginas); piezas compartidas con las páginas
(`ConversationSummary`, `ThreadMessages`, `NewPost`, `CREATE_OPTIONS`); `useWideScreen` en `lib`.
Pruebas de componentes (paneles, menú, barra) y E2E `in-place.spec.ts`, más avisos y mensajes desde
el recuadro.

## ADR-069 · Opciones de la conversación y bloquear mensajes

**Contexto.** El fundador mostró el menú de Messenger que se abre al tocar a la persona en un chat.
De sus opciones, aquí aplican pocas: no hay cifrado de extremo a extremo, estilos, apodos ni grupos.

**Decisión.**

- **Tocar a la persona** (en el recuadro y en /mensajes/[id]) abre: Ver perfil, Abrir en Mensajes
  (desde el recuadro), **Bloquear mensajes** / Desbloquear y Reportar (el formulario de siempre; desde
  el recuadro abre la página del hilo con `?reportar=1`, porque un diálogo encima del recuadro lo
  cerraría).
- **Bloquear mensajes** (`MessageBlock`): mientras exista, ninguna de las dos personas escribe en su
  conversación ni empieza otra; el historial se queda. Solo quien bloqueó lo quita. A quien bloqueó
  se le dice y tiene «Desbloquear» en lugar del campo para escribir; a la otra persona solo «No
  puedes responder a esta conversación», sin decirle que la bloquearon. Límite de 30 cambios por
  hora.
- Silenciar no aplica todavía (los mensajes no mandan avisos aparte del globo); archivar y borrar
  conversaciones quedan para después.

**Consecuencias.** Migración `message_blocks`. `findRecipient` y `sendMessage` rechazan con
`BLOCKED`; `getThread` dice `blocked` (`byMe`, `byThem` o nada). `ReportDialog` se separó de
`ReportButton` para abrirlo desde un menú. Pruebas contra PostgreSQL (nadie de fuera bloquea, ninguna
escribe, solo quien bloqueó quita), de componentes y E2E (bloquear desde el recuadro).

## ADR-070 · speeaking: nombre, logotipo, colores y tipografía

**Contexto.** El fundador entregó la marca nueva (2026-10-01): «speeaking», donde las dos caras del
logotipo son las «ee» de la palabra; el lema «Where conversations come to life.»; la paleta violeta
eléctrico #8B3DFF, cian tecnológico #00CFE8, navy profundo #10152F, blanco y gris frío #667085; Sora
SemiBold para el logotipo y los titulares, e Inter para el texto. Pidió cambiar el nombre en todo el
proyecto, incluida la carpeta. Reemplaza a «Estreno» (ADR-041) antes del lanzamiento, cuando el
cambio sale barato: no hay usuarios, dominio, tiendas ni redes a las que avisar.

**Decisión.**

- **Nombre:** «speeaking», en minúsculas como en el logotipo, también al empezar una frase. Vive en
  `siteConfig.name`. Lema en español: «Donde las conversaciones cobran vida.»
- **Isotipo:** dos globos de diálogo con cara: el violeta habla y el cian escucha. Es una versión
  vectorial provisional hecha a partir de la hoja de marca, hasta tener el SVG del diseñador. La boca
  del globo violeta es redonda y no en cuña, para no recordar a Pac-Man (marca de Bandai Namco).
- **Logotipo:** «sp», las dos caras en lugar de las «ee» y «aking», en Sora 600. Donde no cabe (la
  columna plegada de escritorio, el sello de las cuentas editoriales) va solo el isotipo.
- **Color:** el violeta lleva la acción principal, los enlaces y el foco (blanco encima 5:1). Como
  texto se usa #6D28D9 en claro (7.1:1 en blanco) y #B38CFF en oscuro (7.3:1). El navy #10152F es la
  tinta del texto en claro y el fondo de los íconos de la app. El texto secundario usa el gris frío
  #5F687C: el #667085 de la hoja queda en 4.4:1 sobre gris y no pasa AA. El cian va solo en el
  isotipo y en gráficas, porque como texto sobre blanco queda en 1.9:1. El modo oscuro sigue en
  negro puro (ADR-042).
- **Tipografía:** Sora en el logotipo y los titulares, Inter en el texto, ambas con `next/font`.
- **Nombres internos:** también cambian, porque antes de lanzar no hay sesiones ni datos de nadie
  que cuidar: el paquete, la base de desarrollo (base y rol `speeaking`), las cookies
  (`speeaking.session_token`, `speeaking-nav`, `speeaking_bienvenida`), la cabecera interna de IP,
  las claves del navegador, las semillas de los hashes (deduplicado de eventos y experimentos) y los
  dominios reservados (`@speeaking.invalid`, `@speeaking.test`). Una migración pasa a esos dominios
  los correos internos que ya existían y renombra a «Equipo speeaking» las cuentas editoriales.
- **Marcas reservadas (SEC-18):** «speeaking» no puede aparecer en ningún nombre. Tampoco se permiten
  «Equipo Speaking» o «Soporte Speaking», escritos con una sola «e». «Speaking» por sí solo sí se
  permite, como en «Public Speaking MX». «vendeia» sigue reservada. «estreno» queda reservada solo
  como usuario exacto (`@estreno`): es una palabra común, como en «Ropa de estreno», y nunca fue una
  marca pública.
- **No cambian:** el historial de decisiones, las maquetas de `docs/design/` y el reporte de
  seguridad del 2026-09-26 conservan los nombres que tenían en su fecha.

**Consecuencias.**

- Componentes: `BrandMark` y `BrandFaces` en `brand-mark.tsx`, y `Wordmark` y `Logo` (con
  `collapsible`) en `logo.tsx`.
- Colores: tokens `brand-*` en `globals.css`; el tono por omisión de las comunidades pasa a violeta
  (`pnpm tint`).
- Íconos: regenerados sobre navy (`pnpm icons`). La pestaña no mostraba ícono: `metadata.icons`
  del layout tapaba el `icon.svg`. Ahora Next los anuncia por convención de archivos desde `src/app`
  (`favicon.ico`, `icon.svg` y `apple-icon.png`).
- Versiones: sube la del consentimiento de «Pruébatelo» (2026-10-01) y la del prompt de la redacción
  (`editorial@2`), porque cambia su texto. Sube también la fecha de la página de cookies.
- Pendiente del fundador:
  - el SVG final del diseñador;
  - la búsqueda y el registro en el IMPI (clases 9, 35, 38, 42 y 45);
  - el dominio;
  - renombrar el repositorio de GitHub;
  - mover la carpeta a `E:\speeaking` (pasos en `docs/development.md`).

## ADR-071 · Antes de subir: modelo que se retira, nada con valores de desarrollo en Vercel y sin recargas simuladas en público

**Contexto.** Antes del primer despliegue (2026-10-01) se revisaron contra sus fuentes los links,
precios y datos de `docs/deploy.md`, y el código contra la guía. Salieron tres problemas que ninguna
prueba veía:

1. OpenRouter retira `google/gemini-2.5-flash-lite` el **2026-10-20** (`expiration_date` en
   `/api/v1/models`). Lo usan «Buscar con una foto» (`AI_VISION_MODEL`) y la redacción diaria
   (`TASK_DEFAULT_MODELS`). Además, sus únicos endpoints con cero retención (los de Vertex) son los
   que se retiran, y la app exige `zdr`: después de esa fecha las dos funciones quedarían sin modelo.
2. `APP_URL` vale `http://localhost:3000` por omisión. Si se olvida en Vercel, el build pasa: como es
   loopback, deja de exigir `CRON_SECRET`, las cookies salen sin Secure y las sesiones y Google
   esperan otro origen (pendiente de SEC-21). Lo mismo con `TRUSTED_PROXY_HOPS`: en 0 no hay IP
   confiable y los límites por IP no aplican, con solo un aviso en el registro.
3. En producción `ALLOW_SIMULATED_PAYMENTS=true` es obligatorio (no hay proveedor real) y con él
   cualquier tienda podía recargar saldo simulado gratis en `/studio/saldo` y gastarlo en pruebas
   patrocinadas de «Ver cómo me veo», que cuestan dinero real (≈ US$0.067 cada una). Lo pagado con
   saldo no pasa por el presupuesto ni por el tope diario de las pruebas gratis: el único freno era el
   límite de la llave de OpenRouter. Contradice la decisión del fundador de que el saldo se recarga de
   verdad solo con Mercado Pago o Stripe.

**Decisión.** El fundador aprobó las tres (la tercera es de dinero, riesgo ALTO).

- **Modelo:** `google/gemini-3.5-flash-lite` reemplaza a 2.5 en la lista permitida, como modelo de
  arranque de la redacción y como `AI_VISION_MODEL` recomendado. Es GA, sin fecha de retiro, ve
  imágenes y tiene endpoints con cero retención (Google en Vertex). Cuesta US$0.30 / 2.50 por millón
  de tokens contra US$0.10 / 0.40: ≈ US$0.0004 por foto (medido en vivo con una foto del catálogo
  semilla: 1,167 tokens de entrada y 18 de salida) y ≈ US$0.0004 por borrador [estimación]. No deja
  apagar el razonamiento: con `reasoning.enabled: false` OpenRouter responde 400 «Reasoning is
  mandatory». El adaptador le pide `effort: "minimal"` (`REASONING_REQUIRED_MODELS`), que respondió
  con 0 tokens de razonamiento. Cambiar solo el nombre del modelo habría roto las dos funciones. El
  precio de 2.5 se queda en `cost.ts` para lo ya registrado. Una ruta guardada con 2.5 deja de ser
  válida y `ai.routing` vuelve al predeterminado (en desarrollo no había ninguna).
- **Vercel:** con `NODE_ENV=production` y `VERCEL=1`, el build falla si `APP_URL` es loopback
  (también por omisión) o si `TRUSTED_PROXY_HOPS` es 0. Fuera de Vercel nada cambia: el build de
  producción en localhost (E2E) sigue igual.
- **Recargas:** `simulatedTopUpsAllowed` (`payments/policy.ts`) solo las permite en desarrollo,
  pruebas y en un build de producción con `APP_URL` loopback. En un sitio público, `/studio/saldo`
  dice que las recargas todavía no están disponibles y `topUpSimulated` responde
  `PAYMENTS_UNAVAILABLE`. Los pedidos simulados del piloto siguen. Las tiendas conservan sus pruebas
  de cortesía (`STORE_TRIAL_TRY_ONS`), que pagan la plataforma y su presupuesto. El patrocinio y los
  destacados llegan con el primer proveedor de pagos real.

**Consecuencias.** `src/server/loopback.ts` (compartido por el esquema y la política de pagos).
`/precios`, `/seguridad` y los Términos ya no dicen que las recargas sean simuladas en un sitio
público: `/precios` usa la misma política y los Términos dicen que las recargas se habilitan con un
medio de pago real (misma versión `2026-10-01`: cambio del mismo día, antes del lanzamiento y sin
personas reales que la hubieran aceptado). `docs/deploy.md` corregido con lo que cambió en las
fuentes: la guía de dominios de Vercel tiene otra dirección, Cloudflare Registrar vende `.mx`, el `.com` sube el 2026-11-01, Gmail retira
«Enviar como» externo en enero de 2027 (sección nueva de correo del dominio), Neon Launch apaga a los
5 minutos fijos y la tabla de variables suma `SUPPORT_URL` y las de Google.

**Pruebas que dependían de la velocidad de la máquina** (el fundador pidió cero fallas). Las tres
fallaban a veces con toda la suite corriendo:

- **Subidas (SEC-03).** La prueba E2E manda solo las cabeceras y espera la respuesta. Con el cuerpo
  en camino, el cierre de la conexión le ganaba a veces a la respuesta (ECONNRESET). Ahora también
  prueba algo más fuerte: el servidor responde sin recibir un solo byte del cuerpo.
- **«Deshacer» al salir de una comunidad.** Sonner borra por id el aviso que se está retirando, y uno
  nuevo creado con el mismo id en esos 200 ms heredaba el «borrar» y no se veía. Ahora cada aviso
  tiene un id propio, y antes de crear uno se retiran los activos de esa comunidad. Además dura 10 s
  en lugar de 4, porque con teclado o lector de pantalla hay que llegar hasta el botón.
- **Checkout doble (SEC-23).** La segunda confirmación simultánea puede rechazarse como
  `CART_CHANGED` o `EMPTY_CART`, según si leyó el carrito antes o después de que terminara la
  primera. Las dos respuestas son correctas. La prueba acepta cualquiera de las dos y sigue exigiendo
  un solo checkout y una sola reserva de stock. También la nube gris de
  Cloudflare, un solo origen, Google en el aviso de privacidad antes de activarlo, costos de imágenes y
  videos, y verificaciones nuevas.

## ADR-072 · Pixel de TikTok para medir la campaña: solo con permiso y nunca en lo privado

**Contexto.** El fundador prepara una campaña en TikTok con destino `/registro`. TikTok no deja usar
el pixel (ID `DB2LL7RC77UA626EHMOG`, solo de navegador, sin «Automatic Advanced Matching») hasta
que reciba eventos desde speeaking.com. La guía que acompañaba los archivos lo cargaba en todas las
páginas sin preguntar, pero el aviso de privacidad y `/cookies` prometían «sin cookies de
publicidad ni píxeles de seguimiento». Instalarlo así volvía falsas esas promesas (LFPDPPP,
Profeco) y, en una red social, mandaba a TikTok qué ve cada persona: mensajes, pedidos, perfiles.

**Decisión.** El fundador eligió la opción recomendada:

- **Solo con permiso.** Un aviso pequeño, sin bloquear la pantalla, con «Aceptar / No, gracias»
  y «Más información». Sin decidir o con «no», no se carga nada. La decisión vive en una cookie
  propia (`speeaking_anuncios`, 1 año) y se cambia en `/cookies`; al decir «no» se borran las
  cookies de TikTok de ese navegador. Se usa el modo de consentimiento de TikTok
  (`holdConsent` / `grantConsent` / `revokeConsent`).
- **Solo en lo público.** Portada sin sesión, Comprar, productos, páginas informativas,
  `/registro` y `/bienvenida` (`pixelAllowedOn`). Con sesión, únicamente la bienvenida.
- **Registro completo:** `CompleteRegistration` en `/bienvenida`, que solo ve quien aún no termina
  la bienvenida (una cuenta recién creada), una vez por navegador.
- **Guardián de navegación** (`navigation-guard.ts`). La prueba en un Chrome real mostró que el
  script de TikTok detecta solo los cambios de URL de la app y mandaba `Pageview` de `/c/hogar` y
  del feed con sesión antes de que nuestro código le retirara el permiso. Con el pixel cargado,
  cualquier navegación hacia una página no permitida (clic en un enlace, `pushState` de una
  redirección, atrás/adelante) se vuelve una carga completa: el documento con TikTok se descarta y
  la página privada abre en uno nuevo. El guardián queda siempre por fuera de `pushState`, aunque
  TikTok lo envuelva después. Verificado de nuevo en Chrome: 0 eventos de páginas privadas.
- **Sin ID no hay nada.** `TIKTOK_PIXEL_ID` (opcional, solo Production; nunca en vistas previas de
  Vercel). Desarrollo y E2E corren sin pixel. El cargador es el código base de TikTok escrito en
  TypeScript, sin script en línea: lo autoriza `strict-dynamic`. La CSP suma
  `https://analytics.tiktok.com` (script de respaldo, `connect-src`, `img-src`) solo con el ID; es
  el único dominio al que el pixel se conectó en la prueba.
- **Textos.** Aviso de privacidad `2026-10-06`: finalidad secundaria, sección «Medición de
  anuncios» y transferencia a TikTok. La empresa de TikTok y su país van marcados como pendientes
  para el abogado. `/cookies` con el inventario real y el control.

**Consecuencias.** `src/modules/marketing/` (reglas puras, cargador, guardián y componentes);
`src/lib/csp.ts`; layouts social y de registro; `/bienvenida`. Quien tiene sesión ve el aviso de
documentos actualizados (nueva versión del aviso de privacidad). Con permiso, ir de una página
pública a una privada recarga la página, y nunca al revés. Pendiente del fundador: poner
`TIKTOK_PIXEL_ID` en Vercel Production y desplegar. En TikTok Events Manager, dejar apagado
«Automatic Advanced Matching»; los eventos automáticos de interacción solo pueden ocurrir en las
páginas permitidas.

## ADR-073 · SEO nacional: datos de envío en la ficha, IndexNow, llms.txt y páginas «Comprar en …» por estado

**Contexto.** El fundador quiere que encuentren speeaking en todo México. Tras la auditoría, los
huecos eran estos:

- La ficha no decía a los buscadores desde dónde se vende ni si hay envío nacional. Google lo pide
  para mostrar «Envío a todo México» y las devoluciones en los resultados.
- Los títulos no mencionaban el envío.
- La organización no declaraba a qué país sirve.
- Bing, que alimenta la búsqueda de ChatGPT y Copilot, solo se enteraba de un producto nuevo al
  volver a rastrear.
- Los asistentes de IA no tenían un resumen del sitio.
- Nada respondía búsquedas con lugar («comprar en Jalisco», «decoración en Monterrey»).

**Decisión.** El fundador aprobó las fases 1 y 2 de la propuesta:

- **Ficha del producto** (`modules/catalog/seo.ts`). Todo sale de los datos verificables del
  producto (P4); la IA no escribe nada aquí (P2).
  - `availableAtOrFrom`: ciudad y estado de venta.
  - `shippingDetails` solo con envío nacional: precio en centavos y días solo si el vendedor los
    declaró.
  - `hasMerchantReturnPolicy`.
  - El título suma «· Envío a todo México».
  - La descripción dice el precio y los días de envío y desde dónde se vende.
- **Organización:** `areaServed` México y `sameAs` con `siteConfig.socialProfiles`: los perfiles
  oficiales de Facebook y TikTok (@speeaking).
- **Comunidades:** título «Hogar: comunidad en México» y una descripción completa.
- **`/llms.txt`:** qué es speeaking y sus páginas públicas, más las categorías con productos y las
  comunidades reales. Dice que los pagos son simulados mientras lo sean.
- **IndexNow:** al crear, editar, pausar o reactivar un producto, después de responder, se avisa a
  Bing y a los buscadores que usan IndexNow.
  - La llave pública está en `/indexnow.txt`.
  - Solo funciona en producción y solo con URLs propias.
  - Si el aviso falla, la venta sigue.
- **Páginas por estado** (`modules/catalog/places.ts`): `/comprar/en/jalisco` y
  `/comprar/decoracion/en/jalisco`.
  - El vendedor escribe el estado como quiere («CDMX», «D.F.», «Edo. Méx.»). Se lee como uno de los
    32 estados canónicos. Lo ambiguo no se adivina, ni «México» ni una ciudad suelta.
  - Una página existe solo con **6 o más productos a la venta** (activos, con existencias,
    visibles y de una tienda activa). Con menos responde 404: los buscadores castigan las páginas
    vacías.
  - Al cruzar el umbral, la página entra sola al sitemap (`places-0.xml`).
  - Se enlaza desde Comprar («Compra por estado»), desde cada categoría («Moda por estado») y desde
    la ficha («Más productos de Ciudad de México»).
  - Cada página lleva `CollectionPage` + `ItemList` y la ruta de vuelta (`BreadcrumbList`).

**Consecuencias.**

- Las páginas por ciudad quedan para después: la ciudad es texto libre y hay demasiadas variantes
  para agruparlas sin errores.
- El encabezado de Comprar sigue siendo «Tienda» porque las pruebas E2E dependen de él. El título
  para buscadores ya es «Compra productos de vendedores en México».
- Pendiente del fundador:
  - Dar de alta `sitemap-index.xml` en Google Search Console.
  - Importar el sitio en Bing Webmaster Tools.
  - Cuando exista un perfil nuevo (Instagram, YouTube…), agregarlo a `siteConfig.socialProfiles`.
  - Sumar vendedores de varios estados: sin ellos no hay páginas por estado.
  - Merchant Center, solo cuando haya pagos reales.
