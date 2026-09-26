# media

Subida, validación por firma de bytes y re-codificación de imágenes (sin EXIF/GPS) mediante
`StorageProvider`. Video en Sprint 2 con `MediaProcessor` (ADR-010). Fases: 1.5–1.6.

**Endurecimiento (auditoría 2026-09-26).**

- `/api/uploads` cuenta cada intento con `rateLimit` antes de leer el cuerpo (60/h y 300/día por
  cuenta, 120/h por IP; SEC-12), exige perfil terminado, `multipart/form-data` y `Content-Length`, y
  lee el cuerpo contando bytes con tope y tiempo límite (`limited-body.ts`, SEC-03). Un formulario
  con más de 4 partes se rechaza antes de `formData()`, cuyo parser corre en el hilo principal.
- `concurrency.ts`: colas acotadas en el proceso. Subidas: 8 a la vez, 2 por persona (las demás
  esperan sin leer su cuerpo); decodificación: 2 a la vez (SEC-13).
- `image-processing.ts` rechaza por las dimensiones de la cabecera antes de decodificar (40 Mpx en
  JPEG/WebP, 100 MB decodificados en PNG/GIF/HEIF y 256 MB de pico de memoria estimado con factores
  medidos: AVIF/HEIF ~18 bytes por píxel, JPEG progresivo con todos sus coeficientes), con
  `limitInputPixels`, `sequentialRead` y `timeout` en sharp (SEC-13), y solo pasa a sharp firmas
  permitidas (SEC-36).
- La fila `media` se crea en PROCESSING antes de guardar el archivo. Hasta que se adjunta a una
  publicación publicada o a un producto, `/media` solo se la sirve a su dueño y sin caché (también si
  solo está en publicaciones ocultas o retiradas); lo adjunto es público con caché de una hora
  (ADR-039). `orphans.ts` + `scripts/cleanup-orphan-media.ts` (cron diario) borran lo no adjuntado
  en 24 h, con sus variantes (SEC-14).

**Entrega (ADR-039, 2026-09-26).**

- `next/image` usa un loader propio (`src/lib/image-loader.ts`, `images.loaderFile`): las fotos se
  piden a `/media/<clave>?w=<ancho>` con el ancho redondeado hacia arriba a `MEDIA_WIDTHS` (256, 384,
  640, 828, 1080, 1600). Nada de `/media` pasa por el optimizador de Next (`/_next/image` responde 404
  con un loader propio). Otras fuentes quedan tal cual (usa `unoptimized` para recursos estáticos).
- `/media/<clave>?w=N` (`delivery.ts`): N de la lista o 400; cualquier otro parámetro, 400 (SEC-35).
  Se revisa la query ya interpretada: Next normaliza `?w=640&` o `?%77=640` a `?w=640` antes de la
  ruta (200), así que una CDN delante debe normalizar la query en su clave de caché.
  Primero la autorización de siempre (abajo), en cada petición; después el archivo. Si N es menor
  que el ancho guardado, variante WebP (`resizeForDelivery` en `image-processing.ts`: mismos topes y
  misma cola que las subidas; las variantes usan a lo más la mitad de la cola de espera). Sin lugar en
  la cola o con un original ilegible, se entrega el original con `no-store`.
- Caché de variantes en el mismo almacenamiento: `variants/w<ancho>/<clave>-<ext>.webp`
  (`variant-keys.ts`); `/media/variants/…` no tiene fila y responde 404. Peticiones simultáneas
  comparten la generación; una variante incompleta se regenera. `deleteStoredMedia` borra el
  original y sus variantes (lo usa el recolector). Si cambia la codificación, borrar `variants/`.
- Cabeceras: pública `public, max-age=3600, stale-while-revalidate=86400` (nunca `immutable`);
  privada `private, no-store`; 400/404 `no-store`; ETag (SHA-256 de los bytes) con 304, también
  después de autorizar. Una copia ya guardada en un navegador dura a lo más 1 h, más una respuesta
  vieja mientras revalida (dentro de 24 h); la revalidación recibe 404 y la descarta. Una CDN
  compartida puede seguir sirviéndola dentro de esas 24 h (el 404 no se guarda y no hay garantía de
  que descarte la copia): con CDN, un retiro inmediato exige purgar la URL (ADR-039).

**Moderación (P14, 2026-09-26).**

- Público = adjunto a una publicación PUBLICADA sin producto o con su producto visible, o a un
  producto VISIBLE (`VISIBLE_PRODUCT`, `POST_WITH_VISIBLE_PRODUCT`). Las fotos de un producto oculto
  por el equipo solo se sirven a su dueño y a ADMIN, sin caché (ADMIN, solo las del producto; una foto
  que está únicamente en su publicación, solo su dueño); a los demás, 404, también si su variante ya
  estaba en la caché. Lo que ya estaba en un navegador o CDN dura lo que dice la sección Entrega.
  **Corregido (ADR-039):** el optimizador de `next/image` (`/_next/image?url=/media/…`) guardaba su
  propia copia y, cuando `/media` ya respondía 404, la seguía sirviendo y la volvía a guardar; hoy no
  se usa para `/media` y su caché de desarrollo (`.next/dev/cache/images`, `.next/cache/images`) se
  borró. Un despliegue nuevo arranca sin esa caché.
- `/media` pregunta «¿está adjunta a algo público?» con `findFirst` por `mediaId` (índices
  `post_media_mediaId_idx` y `product_media_mediaId_idx`), no con `_count` en `media.findUnique`:
  Prisma arma el conteo como un `GROUP BY` sobre toda la tabla de adjuntos en cada petición.
- Las fotos de un comprobante de autenticidad, vigente (`authenticity_checks."proofMediaIds"`,
  índice GIN) o reemplazado (`authenticity_proof_history`), nunca son públicas: `/media` solo se las
  sirve a su dueño, sin caché (`trust/proof-media.ts`, consultas con índice); el equipo las ve por
  `/admin/moderacion/prueba/[mediaId]`. Tampoco se pueden adjuntar: `createPostAction` y
  `updateProduct` las rechazan como foto inválida y el trigger `reject_proof_media_link` (en
  `post_media` y `product_media`) rechaza cualquier INSERT, también el de `createProductAction`.
- El recolector nunca borra un comprobante (vigente o reemplazado): `orphans.ts` las excluye y
  `submitProof` las bloquea (`FOR UPDATE`, `lockPrivateReadyMedia` en `trust/queries.ts`) mientras
  las guarda, así que su `FOR UPDATE SKIP LOCKED` las salta; si el recolector las borró primero, el
  comprobante se rechaza.
  Cada tanda bloquea primero (`lockOrphanBatch`) y borra en otra sentencia que vuelve a comprobar
  (`deleteLockedOrphans`): en una sola sentencia, un comprobante (o un adjunto) confirmado entre el
  inicio de la sentencia y el candado no se veía y la foto se borraba. Probado contra PostgreSQL en
  `orphans.db.test.ts` (las tres carreras) y `app/media/[...key]/route.db.test.ts`.
- Lo privado se sirve con `Cache-Control: private, no-store` (y `X-Content-Type-Options: nosniff`
  en todo). El navegador pide `/media?w=` desde el mismo origen con la sesión: su dueño y el equipo
  ven la foto de un producto oculto en el Studio y en su página (con el optimizador se veía rota). No
  uses `unoptimized` con `/media`: en Vercel agrega `?dpl=` y la ruta responde 400.
- El selector (`components/image-uploader.tsx`) no manda archivos de más de 10 MB y entiende los
  errores sin cuerpo JSON (un 413 que cierra la conexión, un 503 del proxy).
