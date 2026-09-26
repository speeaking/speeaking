# Guía de desarrollo

## Requisitos

- Node.js 22.12 o superior (`.nvmrc`), pnpm 10.33.2 (`packageManager` en `package.json`).
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

## Build de producción en local

Con el pago simulado, `next build` y `next start` fallan a propósito en producción (SEC-01, ADR-032).
Para probar el build en esta máquina, el `.env` local define `ALLOW_SIMULATED_PAYMENTS=true`. En un
servidor real **no** se define: se configura un proveedor de pago real. Antes de desplegar, fija
`TRUSTED_PROXY_HOPS` según los proxies que haya delante (ver `docs/architecture.md` → Seguridad).
Detén `pnpm dev` antes de `pnpm build`: correrlos a la vez puede tumbar la caché de Turbopack.

## Cuentas de prueba

El seed crea cuentas editoriales (`equipo.<comunidad>`) y dos vendedores de demostración
(`demo.electro`, `demo.casa`) sin contraseña: no sirven para iniciar sesión. Para probar, crea tu
cuenta en `/registro` (en desarrollo el límite de registros por minuto es holgado).

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
