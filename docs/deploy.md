# Despliegue en producción: Vercel + Neon + Cloudflare R2

Guía paso a paso para poner Estreno en internet (decisión ADR-033 #10 y ADR-040). Está escrita para
hacerse desde el navegador y una terminal, sin conocimientos de servidores. Tiempo estimado: 2 a 3
horas la primera vez.

**Qué es cada pieza.**

| Pieza                | Qué hace                                                    | Crece solo                                                                                                                  |
| -------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Vercel** (Pro)     | Corre la app (páginas, API, fotos por `/media`, cron)       | Sí: abre más instancias con más visitas y las apaga sin tráfico (Fluid compute). Tope: presupuesto de gasto                 |
| **Neon** (Launch)    | Base de datos PostgreSQL                                    | Sí: sube y baja la CPU/RAM entre un mínimo y un máximo que tú fijas, y se apaga sin uso (scale to zero). Tope: el máximo CU |
| **Cloudflare R2**    | Guarda las fotos (bucket privado)                           | Sí: no hay servidor ni disco que llenar; pagas lo guardado. Sacar datos (egress) es gratis                                  |
| **OpenRouter** (IA)  | Modelo abierto pagado por uso (Qwen 3.5, ADR-033 #6)        | Sí: pagas por llamada. Tope: límite de crédito de la llave + presupuesto de IA de la app                                    |
| **Dominio** + GitHub | Tu dirección web; el código privado de donde Vercel publica | —                                                                                                                           |

**Antes de empezar.** Una tarjeta **tuya** (ADR-033 #7 y #8: nada se gasta en automático sin ella),
tu correo, y la terminal abierta en la carpeta del proyecto (`E:\vendeia`). Guarda cada secreto en un
gestor de contraseñas (Bitwarden, 1Password…); **nunca** en un archivo del proyecto, un chat o un
correo.

> Todas las variables van en **Production** únicamente. Las vistas previas (Preview) no reciben la
> base ni las llaves de producción: ver el paso 7.

## 1. Subir el código a GitHub (repositorio privado)

1. Crea una cuenta en <https://github.com/signup> y activa la verificación en dos pasos.
2. **New repository** → nombre `vendeia` → **Private** → sin README ni `.gitignore` → **Create**.
3. En la terminal, dentro de `E:\vendeia`:

   ```
   git ls-files | findstr /R "^\.env"
   ```

   Debe mostrar **solo** `.env.example`. Si aparece `.env` o `.env.local`, detente y avisa al equipo.

4. Conecta y sube (cambia `<tu-usuario>`):

   ```
   git remote add origin https://github.com/<tu-usuario>/vendeia.git
   git push -u origin main
   ```

## 2. Vercel Pro

1. <https://vercel.com/signup> → **Continue with GitHub**.
2. **Plan Pro**, no Hobby: Hobby es solo para uso personal no comercial
   ([Hobby](https://vercel.com/docs/plans/hobby), «fair use guidelines»). Pro cuesta US$20 al mes
   por asiento e incluye US$20 de crédito de uso y el CDN con 1 millón de peticiones y 1 TB de
   transferencia al mes ([Pro](https://vercel.com/docs/plans/pro-plan)).
3. **Tope de gasto** (Settings → Billing → Spend Management; [guía](https://vercel.com/docs/spend-management)):
   - **On-Demand Budget: US$50** (lo que se cobre ARRIBA del crédito incluido).
   - Avisos al 50 %, 75 % y 100 % por correo; activa SMS en Settings → My Notifications.
   - **Pause Production Deployments: activado.** Si algo se desboca (un ataque, un error), el sitio
     se pausa (error 503) en lugar de generar una factura sorpresa. Vercel revisa cada pocos
     minutos: el cobro real puede pasar un poco del tope. Para reanudar: sube el tope y reanuda el
     proyecto a mano.
   - Ojo: el tope de Vercel **no** cubre lo que cobre Neon por el Marketplace; ese tope se pone en
     Neon (paso 3).

## 3. Base de datos en Neon

Recomendado: crearla desde Vercel (una sola factura y las variables se crean solas).

1. En Vercel: **Storage** → **Create Database** → **Neon** (Marketplace).
2. Región: **US East (N. Virginia) / `aws-us-east-1`**, la misma zona que las funciones de Vercel
   (`iad1`, fijado en `vercel.json`). Otra región suma latencia a cada consulta.
3. Plan: **Launch** (pago por uso; el gratuito solo da 0.5 GB y 6 h de historial).
4. Al conectarla al proyecto elige **solo el entorno Production** y **no** actives «crear una rama
   por cada vista previa»: esas ramas copian la base de producción (con datos personales) a cada
   vista previa.
5. La integración crea `DATABASE_URL` (con pooler, host con `-pooler`) y `DATABASE_URL_UNPOOLED`
   (directa). La app usa la primera; las migraciones, la segunda
   ([variables](https://neon.com/docs/guides/vercel-managed-integration)). Prisma Migrate necesita la
   directa ([Neon + Prisma](https://neon.com/docs/guides/prisma)).
6. Abre la base en Neon (**Open in Neon**) y ajusta:
   - **Compute** (rama `main` → Edit compute): autoscaling **mínimo 0.25 CU, máximo 2 CU**; **scale
     to zero: 5 minutos** (activado). 1 CU ≈ 4 GB de RAM. El máximo es tu **tope de costo**: en el
     peor caso (2 CU las 24 h) serían ≈ US$155 al mes; en el piloto se espera mucho menos (ver
     Costos). Súbelo solo si `/admin` o Neon muestran la base al tope.
   - **History / Restore window: 7 días** (el máximo del plan Launch;
     [planes](https://neon.com/docs/introduction/plans)).
   - En el **SQL Editor** corre `SHOW TimeZone;` → debe decir `GMT` o `UTC` (ADR-028). Si no:
     `ALTER DATABASE neondb SET timezone TO 'UTC';`.

Si prefieres crearla directo en <https://neon.com> (factura aparte): mismo plan, región y ajustes;
copia la cadena **Pooled** a `DATABASE_URL` y la **Direct** a `DATABASE_URL_UNPOOLED` en Vercel. Ambas
deben terminar en `?sslmode=require` (la app rechaza una base remota sin TLS).

## 4. Fotos en Cloudflare R2

1. Cuenta en <https://dash.cloudflare.com/sign-up> → **R2 Object Storage** → activa R2 (pide un medio
   de pago aunque uses solo la capa gratuita).
2. **Create bucket**:
   - Nombre: `vendeia-media`.
   - Location: **Automatic** con sugerencia **Eastern North America (ENAM)** (cerca de Vercel y Neon).
     La ubicación **no se puede cambiar** después
     ([ubicación](https://developers.cloudflare.com/r2/reference/data-location/)).
   - Storage class: Standard.
3. **No lo hagas público.** En Settings del bucket deja **Public Development URL (r2.dev):
   Disabled** y **no** conectes un dominio propio. Las fotos solo salen por `/media`, que revisa quién
   puede ver cada una (fotos privadas, productos ocultos, comprobantes). No hace falta CORS.
4. **Token**: R2 object storage → **Account Details** → **API Tokens** → **Manage** → **Create Account
   API token** (el de cuenta sigue vivo aunque cambien los usuarios; el de usuario muere con él):
   - Permisos: **Object Read & Write**.
   - Buckets: **solo `vendeia-media`** (no «todos los buckets»).
   - Copia de inmediato **Access Key ID**, **Secret Access Key** (se muestra **una sola vez**) y el
     endpoint `https://<id-de-cuenta>.r2.cloudflarestorage.com`
     ([tokens](https://developers.cloudflare.com/r2/api/tokens/)).
5. R2 no tiene tope de gasto: crea una alerta en Cloudflare → **Notifications** (facturación por
   uso) si tu cuenta la ofrece. Al tamaño del piloto cabe en la capa gratuita.

## 5. Secretos

Genera dos valores distintos (uno por línea) y guárdalos en tu gestor de contraseñas:

```
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

- El primero es `BETTER_AUTH_SECRET` (firma las sesiones; cambiarlo cierra todas las sesiones).
- El segundo es `CRON_SECRET` (protege `/api/cron/daily`; Vercel Cron lo manda solo como
  `Authorization: Bearer …`, [guía](https://vercel.com/docs/cron-jobs/manage-cron-jobs)).

Nunca reutilices los de desarrollo (`.env`).

## 6. IA con OpenRouter

Dos opciones para el piloto cerrado (ADR-038):

- **IA real (recomendada):**
  1. Cuenta en <https://openrouter.ai> → **Credits** (<https://openrouter.ai/settings/credits>): carga
     saldo (p. ej. US$10; tope del plan: US$50 al mes, ADR-033 #6). OpenRouter cobra una comisión de
     plataforma del 5.5 % en pago por uso ([precios](https://openrouter.ai/pricing)).
  2. **Keys** (<https://openrouter.ai/settings/keys>) → **Create key** → nombre `vendeia-produccion` →
     **Credit limit: 50** con reinicio **mensual** si la pantalla lo ofrece → copia la llave
     (`sk-or-…`). Al llegar al límite, OpenRouter rechaza las llamadas sin cobrarlas
     ([límites](https://openrouter.ai/docs/api_reference/limits)).
  3. **Privacidad** (<https://openrouter.ai/settings/privacy>): desactiva los proveedores que
     «pueden entrenar con tus datos» (modelos de pago y gratuitos) y deja apagado el registro de
     entradas y salidas de OpenRouter. La app ya pide en cada llamada excluir a los proveedores que
     guardan datos o no borran lo enviado (`data_collection: "deny"` y `zdr: true`).
  4. Antes de encenderla, llena en el aviso de privacidad el proveedor de IA y su país (ver «Lo legal
     de la infraestructura»).
  5. Variables: `AI_PROVIDER=openai_compatible`, `AI_BASE_URL=https://openrouter.ai/api/v1`,
     `AI_API_KEY=<llave>`, `AI_DEFAULT_MODEL=qwen/qwen3.5-9b`.
- **IA simulada:** `AI_PROVIDER=mock` y `ALLOW_SIMULATED_AI=true`. Los vendedores reciben textos de
  plantilla, no de un modelo; sin costo.

## 6 bis. Entrar con Google (opcional, ADR-049)

1. En Google Cloud → APIs y servicios → Pantalla de consentimiento: nombre «Estreno», correo de
   contacto, dominio del sitio; alcance solo `email` y `profile`.
2. Credenciales → Crear → «ID de cliente de OAuth» → Aplicación web. Orígenes autorizados:
   `https://<tu dominio>` (y `http://localhost:3000` para probar). URI de redirección autorizada:
   `https://<tu dominio>/api/auth/callback/google` (y la de localhost).
3. Copia el ID y el secreto a `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`. Con las dos variables
   aparece «Continuar con Google» en Entrar y Registro; sin ellas, nada cambia.
4. Prueba a mano: una cuenta nueva con Google debe caer en la bienvenida y aceptar términos y aviso
   con la casilla antes de terminar el perfil.

## 7. Importar el proyecto en Vercel

1. Vercel → **Add New… → Project** → **Import Git Repository** → autoriza la app de GitHub **solo**
   para el repositorio `vendeia`.
2. Vercel detecta Next.js. **No cambies** Build Command ni Install Command: `vercel.json` ya dice
   `pnpm vercel-build` (compila y, solo en producción, aplica las migraciones).
3. Antes de **Deploy**, abre **Environment Variables** y carga la tabla del paso 8 (entorno
   **Production**). Si Vercel despliega antes y falla, no pasa nada: carga las variables y usa
   **Redeploy**.
4. Settings → **Build and Deployment** → **Ignored Build Step** → **Only build production**. Así las
   ramas que no son `main` no generan vistas previas (no tendrían base ni llaves; su build fallaría
   al validar las variables). Si algún día las quieres, necesitan su propia base sin datos personales
   y su propio bucket, asignados al entorno Preview.
5. Settings → **Deployment Protection**: deja **Standard Protection** (las URL de vista previa
   piden iniciar sesión en Vercel).
6. Settings → **Functions**: **Fluid compute** activado (lo está por omisión en proyectos nuevos).

## 8. Variables de entorno

En Vercel → Settings → Environment Variables, entorno **Production**. Las secretas, con
**Sensitive** activado (después nadie puede leerlas, [guía](https://vercel.com/docs/environment-variables/sensitive-environment-variables)).
Si falta o está mal alguna, el build falla y dice **cuál** (nunca su valor).

| Variable                       | Valor o ejemplo                                                    | Secreta | Obligatoria                                                    |
| ------------------------------ | ------------------------------------------------------------------ | ------- | -------------------------------------------------------------- |
| `APP_URL`                      | `https://<tu-dominio>` (al inicio `https://<proyecto>.vercel.app`) | No      | Sí                                                             |
| `DATABASE_URL`                 | La crea Neon: host con `-pooler`, `?sslmode=require`               | Sí      | Sí                                                             |
| `DATABASE_URL_UNPOOLED`        | La crea Neon: host sin `-pooler`, `?sslmode=require`               | Sí      | Sí (migraciones)                                               |
| `BETTER_AUTH_SECRET`           | Paso 5 (≥ 32 caracteres)                                           | Sí      | Sí                                                             |
| `CRON_SECRET`                  | Paso 5 (≥ 32 caracteres)                                           | Sí      | Sí                                                             |
| `TRUSTED_PROXY_HOPS`           | `1` (Vercel pone la IP real del cliente)                           | No      | Sí en Vercel                                                   |
| `STORAGE_DRIVER`               | `s3`                                                               | No      | Sí                                                             |
| `S3_ENDPOINT`                  | `https://<id-de-cuenta>.r2.cloudflarestorage.com` (sin ruta)       | No      | Sí                                                             |
| `S3_BUCKET`                    | `vendeia-media`                                                    | No      | Sí                                                             |
| `S3_REGION`                    | `auto`                                                             | No      | No (por omisión `auto`)                                        |
| `S3_ACCESS_KEY_ID`             | Paso 4                                                             | Sí      | Sí                                                             |
| `S3_SECRET_ACCESS_KEY`         | Paso 4                                                             | Sí      | Sí                                                             |
| `PAYMENT_PROVIDER`             | `mock` (pagos por terceros o en persona, ADR-033 #4)               | No      | No (por omisión `mock`)                                        |
| `ALLOW_SIMULATED_PAYMENTS`     | `true` solo en el piloto cerrado (nadie paga por la plataforma)    | No      | Sí con `mock`                                                  |
| `AI_PROVIDER`                  | `openai_compatible` (o `mock`)                                     | No      | No (por omisión `mock`)                                        |
| `AI_BASE_URL`                  | `https://openrouter.ai/api/v1`                                     | No      | Con `openai_compatible`                                        |
| `AI_API_KEY`                   | Paso 6 (`sk-or-…`)                                                 | Sí      | Con `openai_compatible`                                        |
| `AI_DEFAULT_MODEL`             | `qwen/qwen3.5-9b`                                                  | No      | Con `openai_compatible`                                        |
| `AI_IMAGE_MODEL`               | `google/gemini-3.1-flash-image-preview` (Pruébatelo, ADR-043)      | No      | No (sin él, imágenes simuladas: en producción «no disponible») |
| `ALLOW_SIMULATED_AI`           | `true` solo con `AI_PROVIDER=mock`                                 | No      | Sí con `mock`                                                  |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1` (Vercel usa exactamente pnpm 10.33.2 de `packageManager`)      | No      | Recomendada                                                    |

No pongas `NODE_ENV` (Vercel ya usa `production`), ni `STORAGE_LOCAL_ROOT`, ni `ALLOW_LOCAL_STORAGE`:
en Vercel el disco es efímero y la app rechaza guardar fotos en él aunque la bandera diga `true`.

## 9. Dominio y HTTPS

1. Compra el dominio (p. ej. `.mx` o `.com` en tu registrador). Pro incluye un dominio gratis el
   primer año solo en `.app`, `.dev`, `.online`, `.site`, `.space`, `.store`, `.tech` o `.website`
   (no durante la prueba gratis de Pro; [detalle](https://vercel.com/docs/plans/pro-plan)).
2. Vercel → Settings → **Domains** → **Add** → sigue las instrucciones de DNS (registros A o CNAME en
   tu registrador). El certificado HTTPS se emite y renueva solo.
3. Cambia `APP_URL` a `https://<tu-dominio>` y **Redeploy** (las cookies de sesión y los enlaces usan
   esa URL; la app exige https).

## 10. Primer despliegue y migraciones

1. **Deploy** (o **Redeploy**). En el registro del build debe verse, en orden:
   - `prisma generate` y `next build` terminados.
   - `Producción: aplicando migraciones pendientes (prisma migrate deploy)…` y después
     `All migrations have been successfully applied` (o `No pending migrations to apply` si no había
     nuevas).
2. Si el build falla, Vercel **no** publica nada: el sitio anterior sigue en línea.
   - «Variables de entorno inválidas» → corrige la variable que nombra.
   - «Falta DATABASE_URL_UNPOOLED», «apunta al pooler» o «debe llevar sslmode=require» → usa la
     cadena **directa** de Neon (host sin `-pooler`, termina en `?sslmode=require`; paso 3).
   - Una migración falló → **no la repitas a ciegas**; avisa al equipo con el mensaje del registro.
     Mientras no se resuelva (`prisma migrate resolve`, lo hace el equipo), cada despliegue nuevo
     fallará igual (error P3009) y el sitio anterior seguirá en línea.

**Cómo funcionan las migraciones.** Las aplica el build de producción (`scripts/vercel-build.mts`),
después de compilar y solo si compiló: nunca se olvidan y una migración rota no llega a producción.
Las vistas previas no migran. Regresar a un despliegue anterior en Vercel (**Instant Rollback**)
**no** deshace migraciones: por eso cada cambio de la base debe ser compatible con el código anterior
(primero se agrega; lo que se quita, en un despliegue posterior). Si alguna vez hay que migrar a mano
(p. ej. para diagnosticar): `pnpm db:deploy` con `DATABASE_URL` = la cadena **directa**.

## 11. Datos iniciales (una sola vez)

En producción, el seed crea **solo** categorías, comunidades y ajustes por omisión; se salta el
contenido editorial y los vendedores de demostración (`prisma/seed.ts`). Es idempotente: repetirlo no
duplica nada ni cambia los ajustes que ya editaste en `/admin`.

En PowerShell, dentro de `E:\vendeia` (usa la cadena **directa** de Neon; se borra al cerrar la
terminal):

```
$env:NODE_ENV = "production"
$env:DATABASE_URL = "<DATABASE_URL_UNPOOLED de Neon>"
echo $env:NODE_ENV
pnpm db:seed
Remove-Item Env:DATABASE_URL, Env:NODE_ENV
```

- `echo` debe mostrar `production` **antes** de correr el seed. Sin eso, el seed de desarrollo
  metería cuentas y productos de demostración en la base real (y sus fotos en tu disco, no en R2).
- La salida debe incluir `Producción: se omite el contenido editorial y de demostración`. Si no la
  ves, avisa al equipo.

**Contenido editorial** (ADR-033 #11: piezas curadas con fecha real, ≈ 20 por nicho, solo fotos con
licencia): se publica a mano desde la app con una cuenta editorial. **Nunca** se corre
`pnpm seed:photos` ni el seed de desarrollo contra producción, y nada de esto se automatiza.

**Desde tu PC, contra producción, solo** `pnpm db:seed` (este paso), `pnpm make-admin` (paso 12) y,
si el equipo lo pide, `pnpm db:deploy`. **Nunca** `pnpm ops:daily`, `pnpm db:clean-e2e`,
`scripts/cleanup-orphan-media.ts` ni `pnpm db:migrate`: los tres primeros usan el disco de tu PC en
lugar de R2 (borrarían filas y dejarían los archivos en el bucket) y `db:migrate` es para desarrollo
(puede pedir borrar la base). La operación diaria se dispara con el `curl.exe` del paso 13.

## 12. Tu cuenta de equipo (ADMIN)

1. Regístrate en `https://<tu-dominio>/registro` con tu correo y termina la bienvenida.
2. En PowerShell (misma cadena directa; ADR-035):

   ```
   $env:DATABASE_URL = "<DATABASE_URL_UNPOOLED de Neon>"
   pnpm make-admin <tu-correo> --allow-production
   Remove-Item Env:DATABASE_URL
   ```

## 13. Verificación (antes de invitar al primer vendedor)

- [ ] `https://<tu-dominio>/` carga. (Confirma la conexión a Neon por el pooler: PgBouncer acepta
      `timezone` al conectar, [errores de conexión](https://neon.com/docs/connect/connection-errors).)
- [ ] `/privacidad`, `/terminos`, `/entrar`, `/registro` y `/comprar` cargan.
- [ ] `/admin` responde **404** en una ventana privada y con una cuenta que no es ADMIN; con la tuya
      abre el Resumen.
- [ ] Cabeceras de seguridad: `curl.exe -sI https://<tu-dominio>/` muestra `content-security-policy`
      con `nonce-`, `strict-transport-security` y `x-frame-options: DENY`. (En PowerShell escribe
      `curl.exe`: `curl` a secas es otro comando con otras opciones.)
- [ ] Fotos privadas: sube una foto en el Studio **sin** publicarla, copia su URL `/media/…` y ábrela
      en una ventana privada → **404**. Con tu sesión se ve. `/_next/image?url=%2Fmedia%2F…` → 404 o
      400 (ADR-039).
- [ ] En Cloudflare, el bucket muestra el archivo bajo `images/…` y sigue **sin** acceso público.
- [ ] Retiro de fotos públicas: publica un producto con foto y abre la URL `/media/…` de la foto en
      una ventana privada (la guarda el CDN de Vercel; `curl.exe -sI <url>` muestra `x-vercel-cache`).
      Oculta o archiva el producto y vuelve a pedirla: puede seguir saliendo hasta 1 hora (ventana de
      retiro de ADR-039). Si después de 1 hora sigue saliendo, avisa al equipo.
- [ ] Cron: Vercel → Settings → **Cron Jobs** muestra `/api/cron/daily` a las `0 9 * * *` (09:00 UTC =
      03:00 en la Ciudad de México). Pruébalo:
      `curl.exe -X POST -H "Authorization: Bearer <CRON_SECRET>" https://<tu-dominio>/api/cron/daily`
      → JSON con cada paso; sin la cabecera → 404. Al día siguiente, `/admin/resumen` muestra la
      ejecución (`JobRun`) y Vercel → Logs la petición del cron. Vercel no reintenta un cron fallido:
      si falló, repite el `curl.exe`.
- [ ] Vercel → Logs sin el aviso de «sin IP confiable» (`TRUSTED_PROXY_HOPS=1`).
- [ ] Con IA real: genera una propuesta en «Sube y vende» y revisa el gasto en `/admin/ia` y en
      OpenRouter.

## 14. Respaldos

- **Neon** guarda el historial de 7 días (paso 3): se puede restaurar la base a cualquier momento de
  esa ventana (Neon → **Restore**, o crear una rama desde un instante para revisarla sin tocar
  producción).
- **Simulacro mensual** (10 minutos): en Neon crea una rama desde «hace 1 hora», revisa en el SQL
  Editor que tenga datos (`SELECT count(*) FROM users;`) y bórrala. Anota la fecha.
- **Fotos:** el respaldo de la base no restaura archivos. Las fotos que la app borra (huérfanas,
  cuentas borradas) no se recuperan. Pendiente: copia periódica del bucket si el negocio lo requiere.

## 15. Cómo crece solo (y dónde están los topes)

- **Vercel (Fluid compute):** cada petición la atiende una función en `iad1`; con más tráfico Vercel
  abre más instancias y cada una atiende varias peticiones a la vez; sin tráfico no cobra CPU. Se paga
  CPU activa (US$0.128 por hora en `iad1`), memoria provisionada (US$0.0106 por GB-hora) e
  invocaciones (US$0.60 por millón), contra el crédito de US$20
  ([precios](https://vercel.com/docs/functions/usage-and-pricing),
  [Fluid](https://vercel.com/docs/fluid-compute)). Plazo máximo por petición: 300 s por omisión (el
  cron declara 300 s). **Tope:** Spend Management (paso 2).
- **Neon:** sube de 0.25 a 2 CU según la carga y se apaga a los 5 minutos sin consultas (la primera
  consulta después tarda un poco más en despertar). El pooler acepta hasta 10,000 conexiones de
  clientes ([pooling](https://neon.com/docs/connect/connection-pooling)); el disco crece solo.
  **Tope:** el máximo de CU.
- **R2:** sin servidores; lo guardado crece sin configurar nada. Solo lee `/media` (con caché de
  variantes en el mismo bucket); las fotos públicas quedan además hasta 1 hora en el CDN de Vercel,
  así que muchas vistas no llegan ni a la función ni a R2. **Tope:** ninguno automático; alerta de
  facturación.
- **Lo que no crece solo:** el cron (una vez al día, 300 s), el procesamiento de fotos con sharp (CPU
  por foto nueva y por cada ancho la primera vez) y el máximo de CU de Neon.

## 16. Costos esperados en el piloto

| Servicio        | Precio publicado                                                                                       | Piloto (≤ 100 vendedores) [estimación]                     |
| --------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Vercel Pro      | US$20/mes por asiento, incluye US$20 de uso; CDN con 1 M de peticiones y 1 TB al mes                   | ≈ US$20/mes (el uso cabe en el crédito)                    |
| Neon Launch     | US$0.106 por CU-hora, US$0.35 por GB-mes, historial US$0.20 por GB-mes; sin mínimo                     | ≈ US$5–15/mes (≈ 0.5 CU unas 6 h al día, 1 GB)             |
| Cloudflare R2   | 10 GB-mes gratis, luego US$0.015 por GB-mes; 1 M escrituras y 10 M lecturas gratis al mes; egress US$0 | US$0 (≈ 3 GB: 100 vendedores × 50 fotos con variantes)     |
| OpenRouter (IA) | Qwen3.5-9B: US$0.08–0.17 entrada / US$0.13–0.25 salida por millón de tokens según proveedor; +5.5 %    | ≤ US$50/mes (tope de la llave; ≈ US$0.0003 por generación) |
| Dominio         | Según registrador                                                                                      | Anual                                                      |

Total esperado: **≈ US$30–40 al mes más la IA** (tope US$50). Fuentes:
[Vercel Pro](https://vercel.com/docs/plans/pro-plan), [Neon](https://neon.com/pricing),
[R2](https://developers.cloudflare.com/r2/pricing/),
[OpenRouter](https://openrouter.ai/qwen/qwen3.5-9b) (consultadas el 2026-09-26). Revisa los tableros
de uso de cada servicio la primera semana y ajusta.

**El primer cobro que crece solo es el CDN de Vercel.** Cada página, script y foto cuenta como una
petición: 1 M al mes son ≈ 33,000 al día (≈ 25,000 vistas de página al mes si cada una pide unos 40
archivos). Si en un mes se pasa, Vercel sube al escalón siguiente desde el ciclo siguiente: US$20 al
mes por 10 M, US$100 por 50 M ([Flat Rate CDN](https://vercel.com/docs/pricing/flat-rate-cdn)). Ese
cobro es una suscripción y **no** lo frena el tope de gasto del paso 2: revisa Usage → Edge Requests
cada semana del piloto.

## 17. Lo legal de la infraestructura

No es asesoría legal: revísalo con el abogado del paso de entidad legal (ADR-033 #5). El análisis
completo está en `docs/legal/00-marco-legal-2026.md` (§2.7, encargados y transferencias).

- Con esta infraestructura los datos personales se tratan **fuera de México**, en Estados Unidos:
  Vercel Inc. (funciones en `iad1` y registros), Neon/Databricks (base en `aws-us-east-1`),
  Cloudflare Inc. (fotos, bucket con sugerencia ENAM) y, con IA real, OpenRouter Inc. y el proveedor
  del modelo al que enruta. Estas regiones son las que fija esta guía: confírmalas en cada consola.
- Son **encargados** (tratan datos por cuenta de Estreno): mandarles datos no es una transferencia,
  pero la relación debe constar en un contrato de encargo. El aviso de privacidad de la app promete
  nombrarlos con su país: antes del primer vendedor real hay que completar «Encargados y
  transferencias» y el proveedor de IA en `src/app/(legal)/privacidad/page.tsx` y subir
  `LEGAL_VERSIONS.privacyNotice` (quien ya aceptó verá el aviso para volver a aceptar).
- Contratos de encargo (DPA): [Vercel](https://vercel.com/legal/dpa) (aplica a Pro sin firma aparte);
  Neon, cuyo contratante es Databricks, Inc. ([anexo de Neon](https://neon.com/dpa) y
  [DPA de Databricks](https://www.databricks.com/legal/databricks-data-processing-addendum));
  [Cloudflare](https://www.cloudflare.com/cloudflare-customer-dpa/) y
  [OpenRouter](https://openrouter.ai/data-processing-agreement) (forma parte de sus términos). Guarda
  una copia en PDF con la fecha en que aceptaste cada uno.

## 18. Si algo sale mal

| Síntoma                                  | Qué hacer                                                                                                        |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| El sitio muestra 503 `DEPLOYMENT_PAUSED` | Se alcanzó el tope de gasto. Revisa el uso, sube el tope si procede y reanuda el proyecto                        |
| Las fotos no cargan (error 500)          | Vercel → Logs: `NoSuchBucket` = nombre de bucket; `AccessDenied` = token sin permiso sobre ese bucket            |
| Algo se rompió tras un despliegue        | Vercel → Deployments → el anterior → **Instant Rollback** (no deshace migraciones: avisa al equipo)              |
| La operación diaria no aparece           | Vercel → Settings → Cron Jobs → View Logs; repite el `curl.exe` del paso 13                                      |
| Una llave se filtró                      | Revócala en su servicio (Cloudflare, OpenRouter, Neon: reset password), crea otra, cámbiala en Vercel y Redeploy |

Cuándo revisar esta arquitectura (residencia de datos, costo, egress): `docs/decisions.md`, ADR-040.
