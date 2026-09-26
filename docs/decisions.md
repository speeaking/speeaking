# Registro de decisiones (ADR)

Formato breve: decisión, motivo y estado. Una decisión nueva que contradiga otra la marca como
"Reemplazada".

| #       | Decisión                                                             | Estado   |
| ------- | -------------------------------------------------------------------- | -------- |
| ADR-001 | Monolito modular en Next.js                                          | Aceptada |
| ADR-002 | Versiones exactas fijadas y trampas conocidas                        | Aceptada |
| ADR-003 | Mercado inicial México: MXN, es-MX, America/Mexico_City              | Aceptada |
| ADR-004 | Better Auth para autenticación                                       | Aceptada |
| ADR-005 | Proveedores por interfaz con implementación simulada                 | Aceptada |
| ADR-006 | La IA redacta, el código calcula (P2)                                | Aceptada |
| ADR-007 | Datos verificables estructurados (P4)                                | Aceptada |
| ADR-008 | Proporción comercial del feed como parámetro con límites             | Aceptada |
| ADR-009 | Eventos y atribución desde el día 1 (P5)                             | Aceptada |
| ADR-010 | Sprint 1 solo texto e imagen; video en Sprint 2                      | Aceptada |
| ADR-011 | Pagos simulados; una orden por vendedor; nunca retener fondos        | Aceptada |
| ADR-012 | Una cuenta con capacidades progresivas (P6)                          | Aceptada |
| ADR-013 | Campañas con canal; promoción interna como primer canal real (P7)    | Aceptada |
| ADR-014 | "VendeIA" es nombre provisional interno; marca en una sola constante | Aceptada |
| ADR-015 | Herramientas de calidad y pruebas                                    | Aceptada |
| ADR-016 | shadcn/ui con Base UI y CSS base copiado al repo                     | Aceptada |
| ADR-017 | Base de datos de desarrollo: clúster propio con PostgreSQL 17 local  | Aceptada |
| ADR-018 | Comunidades por nicho con contenido semilla honesto                  | Aceptada |
| ADR-019 | Motor de automejora con autonomía por nivel de riesgo                | Aceptada |
| ADR-020 | IA autofinanciada: presupuesto ligado a ingresos y costo medido      | Aceptada |

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

## ADR-014 · Nombre provisional

"VendeIA" es interno; "Vende con IA" es la función del vendedor. Cambiar `siteConfig.name` debe bastar
para renombrar la plataforma.

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

## ADR-021 · Subidas por ruta dedicada

Las Server Actions tienen un límite de 1 MB por defecto y no dan progreso por imagen. `POST
/api/uploads` exige sesión, límite de 60 subidas por hora, valida el contenido real con `sharp`,
re-codifica a WebP (sin EXIF/GPS) y devuelve un `mediaId`. Al publicar se verifica que cada imagen sea
de quien publica (evita adjuntar imágenes ajenas).

## ADR-022 · Cuestionario de onboarding

Pedido por producto: conocer a la persona desde el inicio. Tres pasos que se pueden saltar
(objetivos; comunidades, mínimo 3; marcas e "¿Buscas algo ahora?" con presupuesto). La intención
declarada vence en 30 días y es la señal más fuerte del Commerce Engine. Elegir "Vender" lleva directo
a Vende con IA. Todo se puede borrar desde Ajustes.

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
  Vende con IA, checkout y cambio de tema, y exige cero violaciones (evento
  `securitypolicyviolation` y consola), hidratación completa y que un `onerror` inyectado no corra.

**Riesgo aceptado.** `style-src 'unsafe-inline'`: la interfaz usa atributos `style` (tono de cada
comunidad, proporción y desenfoque de fotos) y sonner inyecta un `<style>` sin nonce; un nonce en
`style-src` desactivaría `'unsafe-inline'` y rompería todo eso. El CSS inyectado no ejecuta código.

**Consecuencias.** Todas las páginas se renderizan por petición (el layout lee las cabeceras): no hay
páginas estáticas ni ISR. Agregar un tercero (SDK de pagos, analítica, CDN de imágenes) es cambiar
`contentSecurityPolicy` y su prueba. Las rutas que el proxy no toca (`/api/*`, prefetch de
`next/link`) no llevan CSP; el 404 HTML de `/api/*` es estático y sin datos de la persona. La E2E se
corrió contra `pnpm dev` (que permite `'unsafe-eval'`); hay que correrla también contra
`pnpm build && pnpm start`, donde cualquier `eval` de una dependencia sí se bloquea. Pendiente: un
endpoint `report-to` para recibir violaciones en producción.

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
  se reemplaza por `{ redacted: true }`. Hoy la limpieza es oportunista (al usar «Vende con IA», a lo
  más cada hora por proceso): sin uso, nada la dispara. Falta una tarea programada que llame
  `redactExpiredAiInputs` para cumplir los 90 días que promete el aviso.

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
