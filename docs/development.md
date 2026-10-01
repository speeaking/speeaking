# Guía de desarrollo

## Requisitos

- Node.js 22.23.2 o superior dentro de la 22, o 24+ (`engines` en `package.json`, `.nvmrc`), pnpm
  10.33.2 (`packageManager`).
- PostgreSQL 17 instalado (se usan sus binarios para el clúster del proyecto, fase 1.2).
- Google Chrome instalado para las pruebas E2E (o `PLAYWRIGHT_CHANNEL`, ver abajo).

## Primeros pasos

```bash
pnpm install          # también genera el cliente de Prisma (postinstall)
pnpm db:setup         # clúster PostgreSQL 17 propio + base "vendeia" + secretos en .env
pnpm db:migrate       # aplica las migraciones
pnpm db:seed          # categorías, comunidades y contenido/demos de desarrollo
pnpm dev
```

`pnpm db:setup` usa los binarios de PostgreSQL 17 instalados (`PG_BIN` para otra ruta), crea el
clúster en `.data/postgres` (puerto 5434) y escribe `DATABASE_URL` y `BETTER_AUTH_SECRET` en `.env`
con valores aleatorios. Nunca imprime secretos. Después de reiniciar la computadora: `pnpm db:start`.

## Scripts

| Script              | Qué hace                                               |
| ------------------- | ------------------------------------------------------ |
| `pnpm dev`          | Servidor de desarrollo (Turbopack)                     |
| `pnpm build`        | Build de producción                                    |
| `pnpm typecheck`    | Genera tipos de rutas y ejecuta `tsc --noEmit`         |
| `pnpm lint`         | ESLint (incluye reglas con información de tipos)       |
| `pnpm format`       | Formatea con Prettier (`format:check` solo verifica)   |
| `pnpm test`         | Vitest: proyectos `unit` (Node) y `components` (jsdom) |
| `pnpm test:e2e`     | Playwright: perfiles `mobile` y `desktop`              |
| `pnpm check`        | typecheck + lint + formato + pruebas unitarias         |
| `pnpm db:setup`     | Crea/inicia la base de desarrollo y los secretos       |
| `pnpm db:start`     | Inicia el clúster (`db:stop`, `db:status`)             |
| `pnpm db:migrate`   | `prisma migrate dev`                                   |
| `pnpm db:seed`      | Datos iniciales (idempotente)                          |
| `pnpm db:studio`    | Explorador visual de la base (Prisma Studio)           |
| `pnpm db:clean-e2e` | Borra las cuentas y datos que crean las pruebas E2E    |
| `pnpm icons`        | Regenera los íconos de la PWA desde la marca           |
| `pnpm tint`         | Regenera el CSS del tinte por comunidad (ADR-027)      |
| `pnpm seed:photos`  | Descarga las fotos con licencia de la semilla          |

### Operación y equipo

| Script                                                                     | Qué hace                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm ops:daily [--engine-only]`                                           | Operación diaria: métricas → experimentos → salvaguardas → analista → checkouts vencidos → imágenes huérfanas → retención de IA. Idempotente; cada paso en `JobRun`. `--engine-only` corre solo el motor.                                                                                                                                                                                                                                                                        |
| `pnpm ai:eval --task <tarea> [--provider mock]`                            | Evalúa un modelo con los casos de `evals/*.jsonl` (`sale_proposal`, `ad_copy`). `--provider mock` no usa red ni cuesta; un modelo de pago exige `--confirm-spend` y dice antes el costo máximo. `--limit N` nunca aprueba.                                                                                                                                                                                                                                                       |
| `pnpm trust:reevaluate [--dry-run] [--batch-size=N] [--include-unchecked]` | Reevalúa las revisiones de autenticidad hechas con otra `RULES_VERSION` (súbela al cambiar reglas, pesos, marcas o palabras). Idempotente. `--dry-run` calcula lo mismo sin guardar y dice qué cambiaría (estados y riesgo; p. ej. cuántos «Comprobante revisado» volverían a la cola); córrelo primero. `--include-unchecked` evalúa por primera vez los productos que nunca tuvieron revisión (sin la opción solo se cuentan). Las decisiones del equipo no se deshacen solas. |
| `pnpm make-admin <correo> [--revoke] [--allow-production]`                 | Da o quita el rol ADMIN (único camino, ADR-035). Se niega con una base que parezca de producción (`NODE_ENV=production` o un servidor que no es esta máquina) salvo `--allow-production`; la cuenta debe haber terminado la bienvenida. Aplica en la siguiente carga de página, sin cerrar sesiones.                                                                                                                                                                             |
| `pnpm exec tsx scripts/cleanup-orphan-media.ts [--dry-run]`                | Borra imágenes sin adjuntar de más de 24 h (también lo hace la operación diaria).                                                                                                                                                                                                                                                                                                                                                                                                |

En producción, la operación diaria la dispara el hosting con `/api/cron/daily` y `CRON_SECRET`: ver
`docs/architecture.md` → Operación.

**Deshacer decisiones del equipo en `/admin`.**

- **Motor de automejora** (`/admin/decisiones`): una decisión APLICADA (a mano o sola) se puede
  revertir con una nota. Restaura el valor anterior solo si nadie cambió el ajuste después, detiene
  el experimento que comparaba contra el valor revertido y queda en la bitácora de la decisión
  (actor HUMAN y quién). Una propuesta pendiente se aprueba o se rechaza; una revertida o rechazada
  no se vuelve a aplicar sola (el analista puede volver a proponerla más adelante).
- **Moderación** (`/admin/moderacion`): «Restaurar» deshace un «Ocultar» de una publicación o un
  producto. Un rechazo de autenticidad (el producto pasa a «genérico») no se deshace solo: el
  vendedor puede volver a declararlo original y mandar su comprobante. Cada acción queda en la
  bitácora (`moderation.*`, `authenticity.*`).
- **Rutas de IA** (`/admin/ia`): se cambian con una decisión nueva en esa misma pantalla.

## Build de producción en local

Con el pago simulado o la IA simulada, `next build` y `next start` fallan a propósito en producción
(SEC-01, ADR-032, ADR-038). Para probar el build en tu máquina, agrega a tu `.env` local (no se
versiona y `pnpm db:setup` no las escribe) `ALLOW_SIMULATED_PAYMENTS=true` y
`ALLOW_SIMULATED_AI=true`. En un servidor real **no** se definen: se
configura un proveedor de pago real y `AI_PROVIDER=openai_compatible` (o, solo en un piloto cerrado
y como decisión explícita, la bandera correspondiente; con la IA simulada los vendedores reciben
textos de plantilla). Antes de desplegar, fija
`TRUSTED_PROXY_HOPS` según los proxies que haya delante (ver `docs/architecture.md` → Seguridad).
Detén `pnpm dev` antes de `pnpm build`: correrlos a la vez puede tumbar la caché de Turbopack.

**Imágenes (Pruébatelo).** Sin `AI_IMAGE_MODEL`, el proveedor de imágenes es el simulador: compone la
foto con las prendas al lado y una franja «Simulación de ejemplo», sin red ni costo (también en las
pruebas E2E). Con `AI_PROVIDER=openai_compatible` y `AI_IMAGE_MODEL` (p. ej.
`google/gemini-3.1-flash-image` en OpenRouter) se generan imágenes reales y cada una cuesta lo
que dice la tabla `IMAGE_PRICES_USD_PER_IMAGE` de `src/modules/ai/cost.ts`; un modelo sin precio no se
llama. Las recargas de saldo usan el pago simulado (`ALLOW_SIMULATED_PAYMENTS`). La suite E2E arranca
el servidor con `AI_PROVIDER=mock`, `ALLOW_SIMULATED_AI=true` y con `AI_IMAGE_MODEL`,
`AI_VISION_MODEL`, `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` vacías (`playwright.config.ts`):
aunque tu `.env` tenga OpenRouter, la imagen real y Google, las pruebas son deterministas, no gastan
saldo ni dependen de la velocidad o el crédito de un proveedor externo.

**Buscar con una foto (ADR-061).** Con `AI_PROVIDER=mock`, `/buscar/foto` usa el simulador: sin ver
la foto, siempre «ve» una camisa blanca y unos jeans azules y busca eso en el catálogo semilla. Con
`AI_PROVIDER=openai_compatible` necesita `AI_VISION_MODEL` (p. ej. `google/gemini-2.5-flash-lite`,
≈ US$0.0002 por foto, con cero retención en OpenRouter): el modelo de texto por omisión no ve
imágenes, y sin esa variable la página dice que no está disponible. La foto nunca se guarda.

## Cuentas de prueba

El seed crea cuentas editoriales (`equipo.<comunidad>`) y vendedores de demostración
(`demo.electro`, `demo.casa`, `demo.moda`) sin contraseña: no sirven para iniciar sesión.

Para entrar sin registrarte, el seed crea además una **cuenta de prueba local** con la bienvenida
terminada, cuatro comunidades y una tienda activa. Su correo y su contraseña están en
`prisma/seed/test-account.ts` (valores de prueba: no los uses en otro servicio). Solo existe en una
base de esta máquina: el seed la omite en producción y contra cualquier servidor remoto, y si ya
existe no la toca. Para que también vea `/admin`, dale el rol con
`pnpm make-admin prueba@estreno.test`.

También puedes crear tu cuenta en `/registro` (en desarrollo el límite de registros por minuto es
holgado). Para entrar a `/admin`, termina la bienvenida y date el rol con
`pnpm make-admin <tu-correo>` (arriba); sin él, `/admin` responde 404. Una contraseña olvidada no
se puede leer (se guarda cifrada) y la recuperación por correo llega con el proveedor de correo.

## Convenciones

- URLs en español (`/descubrir`, `/producto/[slug]`); código, tipos y nombres de archivo en inglés.
- Textos de interfaz en español de México.
- Pruebas junto al código: `*.test.ts` (lógica) y `*.test.tsx` (componentes); E2E en `tests/e2e`.
- Commits en formato convencional (`feat:`, `fix:`, `docs:`, `chore:`, `test:`).
- Nuevas dependencias: siempre versión exacta; revisar procedencia y peso antes de agregarlas.

## Pruebas E2E

Por defecto Playwright usa el Chrome instalado (`channel: "chrome"`) para no descargar navegadores.
En CI o en una máquina sin Chrome:

```bash
pnpm exec playwright install --with-deps chromium
PLAYWRIGHT_CHANNEL=chromium pnpm test:e2e
```

Con `CI=1` Playwright arranca `pnpm start` (build de producción) en lugar de `pnpm dev`: hace falta
`pnpm build` antes y, mientras el pago y la IA sean simulados, `ALLOW_SIMULATED_PAYMENTS=true` y
`ALLOW_SIMULATED_AI=true` en el entorno del CI.

En local, con `pnpm dev`, cada ruta se compila la primera vez que se pide. Por eso el proyecto
`warmup` (`tests/e2e/warmup.setup.ts`) pide una vez las rutas principales antes de `mobile` y
`desktop`: sin ese calentamiento, la primera visita durante una prueba puede pasar de los 15 s de
espera y, con el servidor saturado, vencer transacciones a medias. Los pasos que esperan al modelo
real (la propuesta de «Sube y vende», el kit de anuncios) esperan hasta 60 s: el proveedor tiene un
plazo de 45 s y después entra el texto de respaldo, así que la prueba pasa por cualquiera de los dos
caminos. Después de correr la suite, `pnpm db:clean-e2e` borra lo que dejó.

## shadcn/ui

Los componentes se agregan con el CLI sin instalarlo como dependencia:

```bash
pnpm dlx shadcn@4.21.0 add <componente>
```

El CSS base de shadcn está copiado en `src/styles/shadcn-tailwind.css`. Al actualizar la versión del
CLI, copia de nuevo `dist/tailwind.css` del paquete `shadcn` a ese archivo.

## Notas para Windows

- Saltos de línea LF forzados por `.gitattributes` y `.editorconfig`.
- `forceConsistentCasingInFileNames` evita errores de mayúsculas que solo aparecen en Linux.
