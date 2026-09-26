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
  solo está en publicaciones ocultas o retiradas); lo adjunto es público con caché de un día.
  `orphans.ts` + `scripts/cleanup-orphan-media.ts` (cron diario) borran lo no adjuntado en 24 h
  (SEC-14).
- El selector (`components/image-uploader.tsx`) no manda archivos de más de 10 MB y entiende los
  errores sin cuerpo JSON (un 413 que cierra la conexión, un 503 del proxy).
