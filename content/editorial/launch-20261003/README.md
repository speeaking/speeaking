# Primera colección editorial de comunidades

36 publicaciones originales, tres por cada una de las doce comunidades oficiales. Incluye doce
imágenes ilustrativas creadas con la herramienta integrada imagegen, una por comunidad. La petición
del administrador autoriza esta publicación inicial; los borradores automáticos de la redacción
conservan su flujo de revisión habitual.

## Criterio editorial

- Una pieza visual con una idea útil, una propuesta para probar y una conversación por comunidad.
- Voz del equipo, sin inventar testimonios, clientes, compras, asistentes a eventos o resultados.
- Consejos comprobables con fuentes primarias: Apple, Nintendo, NHS, ASPCA, AAD y NHTSA. Las fuentes
  aparecen en el texto publicado y como enlaces al expandir la tarjeta.
- Recetas, humor y propuestas de estilo propios, identificados como ideas del equipo.
- Cada imagen lleva texto alternativo descriptivo y una indicación explícita de su origen por IA.
  No representa productos disponibles, animales en adopción ni rutas o transformaciones reales.
- Las cuentas son `equipo.<comunidad>`, con el distintivo Editorial y sin métodos de acceso. Todas
  las publicaciones llevan `isAiGenerated`. Los contadores y las fechas corresponden a la actividad
  real: no se crean seguidores, comentarios, reacciones, reseñas, compras o publicaciones antedatadas.

## Archivos y publicación

`posts.ts` contiene todos los textos y referencias. `assets.json` describe dimensiones, tamaño,
miniatura, variantes y SHA-256 de cada original. `prompts.md` guarda los prompts de las imágenes.
Los originales y sus variantes WebP están en `images/` (1536 × 1024; variantes para móvil).

Desde la raíz del proyecto:

```powershell
pnpm exec tsx scripts/publish-editorial-launch.ts --target local
pnpm exec tsx scripts/publish-editorial-launch.ts --target local --publish
pnpm exec tsx scripts/publish-editorial-launch.ts --target production
pnpm exec tsx scripts/publish-editorial-launch.ts --target production --publish
```

Sin `--publish`, el comando solo valida archivos y consulta la base. Lee `.env` o
`.env.production.local`, comprueba el destino de speeaking y el rol ADMIN de `speeaking@gmail.com`.
No imprime conexiones ni claves. La producción debe desplegar primero este paquete, para que las
imágenes existan antes de crear los adjuntos. No se necesita configurar otro proveedor de IA o
compartir claves de almacenamiento para estas imágenes editoriales.

Cada publicación tiene una clave de edición única en `EditorialDraft.autoKey` y se crea junto
con su adjunto y registro de revisión en una transacción protegida por un bloqueo de PostgreSQL.
Repetir el comando omite lo ya procesado, incluso si el equipo retiró esa publicación después.
Una ejecución interrumpida puede continuarse sin duplicar contenido. No modifica publicaciones
existentes, ajustes, productos, cuentas personales ni el contenido de otras ediciones.

Los assets no están en `public/`: el proveedor editorial solo resuelve una lista de archivos del
despliegue y `/media` autoriza el acceso usando los adjuntos vigentes. Retirar contenido bloquea las
peticiones al origen; aplica la misma política de caché del resto de las imágenes (ADR-039).
Las imágenes de usuarios y tiendas siguen en su almacenamiento configurado.

## Mantenerlo interesante

Antes de ampliar el volumen, revisar qué preguntas reciben respuestas reales y qué guías guardan
las personas. Usar esos temas para la siguiente colección, alternando las comunidades y evitando
repetir imágenes o titulares. Las experiencias de usuarios y vendedores deben venir de ellos;
pedir permiso para destacarlas. La redacción existente en `/admin/redaccion` permite preparar y
revisar nuevas piezas, sin publicar automáticamente este paquete de nuevo.

El administrador autorizó después dos publicaciones nuevas cada dos horas y mejorar estas
doce ilustraciones. El proceso, sus límites y la revisión del material están documentados en
[Publicación editorial cada dos horas](../../../docs/editorial-automation.md). Esta edición
inicial sigue siendo idempotente y no se vuelve a publicar para actualizar fotografías.
