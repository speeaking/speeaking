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
  `redactExpiredAiInputs` para cumplir los 90 días que promete el aviso. **Resuelto (2026-09-26):**
  es un paso de la operación diaria (`pnpm ops:daily`, `/api/cron/daily`); hay que programarla en
  el hosting (ver `architecture.md` → Operación).

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
  al costo total se quita aunque ninguna palabra lo anuncie («di $24,000 por las 10»).
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
  «Comprobante revisado por VendeIA» o una nota neutral («Revisa: …»).
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
haría que los vendedores recibieran en «Vende con IA» y en el kit de anuncios textos de PLANTILLA
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
