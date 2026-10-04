# Publicación editorial cada dos horas

El administrador autorizó publicar dos entradas por intervalo de dos horas, rotando las
comunidades oficiales, y renovar las doce imágenes iniciales. Esta autorización corresponde
al contenido del equipo; los borradores habituales de `/admin/redaccion` conservan su revisión.

## Ejecución

La tarea programada de este chat trabaja en `E:\speeaking`. Necesita esta computadora encendida,
Codex abierto y acceso a Internet. No es un proceso autónomo de Vercel. Si una ejecución se pierde,
la siguiente prepara el intervalo actual, sin acumular publicaciones atrasadas.

El servidor elige dos comunidades y entrega sus seis entradas editoriales recientes. El límite
es de dos publicaciones por intervalo UTC de dos horas para todo el sitio. Una clave única por
intervalo y comunidad y un bloqueo transaccional evitan duplicados, incluso tras una interrupción.
No se vuelve a crear una entrada que el administrador haya retirado.

Desde la raíz del proyecto, con Node compatible y `tsx`:

```powershell
pnpm exec tsx scripts/editorial-agent.ts plan --target production
pnpm exec tsx scripts/editorial-agent.ts submit --manifest .data/editorial-automation/runs/edicion/publications.json --target production
pnpm exec tsx scripts/editorial-agent.ts submit --manifest .data/editorial-automation/runs/edicion/publications.json --target production --publish
```

El segundo comando prepara y valida; el tercero publica. El plan contiene `slot`, `remaining`,
`targets`, publicaciones recientes e ilustraciones editoriales. Exige `durableStorage: true`.
Si no hay pendientes, termina sin generar imágenes ni publicar. Si cambia el intervalo durante
la preparación, consulta el plan de nuevo y conserva el material para una comunidad compatible;
no cambies solo la fecha del manifiesto para forzar una publicación.

## Contenido y revisión

- Una imagen nueva y un texto original por entrada. Alterna guías breves, recetas, humor propio,
  ideas prácticas y preguntas concretas que inviten a responder. Evita titulares y temas recientes.
- Investiga afirmaciones verificables en fuentes primarias actuales. No inventes noticias,
  precios, eventos, reseñas, clientes, historias personales, compras, recomendaciones de productos
  disponibles ni actividad de la comunidad. Presenta las ideas como propuestas del equipo.
- Evita recomendaciones médicas, financieras o legales individualizadas. Los consejos generales
  que lo necesiten deben llevar una fuente autorizada; no sacrifiques exactitud por llamar la atención.
- Usa `imagegen` integrado para crear escenas ilustrativas. Composición vertical 4:5, sujeto claro,
  luz cuidada, texturas y profundidad, color variado y apariencia creíble. Evita imágenes genéricas,
  texto incrustado, marcas, manos deformadas y poses repetidas. Las personas deben ser adultas
  ficticias. No uses fotos privadas de usuarios como referencias.
- Revisa visualmente cada imagen antes de publicarla. Guarda el prompt y copia el resultado al
  proyecto. Recorta y optimiza con Sharp, conservando el sujeto; usa WebP hasta 1 MB y texto
  alternativo específico. No conviertas una foto ilustrativa en inventario real.
- Texto entre 80 y 1,850 caracteres, español natural, útil por sí mismo y una pregunta final cuando
  encaje. Incluye `Imagen ilustrativa creada con IA.`. Para fuentes, termina con
  `Fuente: Título — https://pagina-oficial` después de una línea en blanco. Comprueba el enlace.
- Las cuentas llevan distintivo Editorial y las imágenes indicación de IA. Los contadores,
  fechas, reacciones y conversaciones reflejan actividad real. La automatización no crea interacciones.

Guarda las tandas en `.data/editorial-automation/runs/<intervalo>/`: imágenes, prompts, fuentes,
manifiesto y recibo. Esta carpeta está ignorada por Git; no necesita un despliegue por tanda.

Ejemplo de manifiesto (rutas de imágenes relativas al manifiesto):

```json
{
  "mode": "publish",
  "slot": "INTERVALO_EXACTO_DEL_PLAN",
  "posts": [
    {
      "communitySlug": "COMUNIDAD_DEL_PLAN",
      "body": "Texto revisado, original y con la indicación de imagen ilustrativa...",
      "imageFile": "images/tema.webp",
      "altText": "Descripción concreta de los objetos y la escena."
    }
  ]
}
```

El cliente asigna `imagePart`. Para renovar una imagen editorial, usa `mode: "replace"` y en cada
entrada `postId`, `expectedMediaId`, `imageFile` y `altText` obtenidos del plan. El servidor comprueba
que sigue siendo la imagen esperada. Conserva texto, fecha, comentarios y reacciones; nunca cambia
fotos de cuentas personales o productos.

## Credencial y almacenamiento

`/api/editorial/publish` acepta una credencial dedicada, con 256 bits aleatorios, cuyo hash SHA-256
se guarda en `editorial_automation_tokens`. Solo autoriza consultar material editorial público,
crear estas publicaciones y sustituir sus ilustraciones. Exige que el titular siga siendo ADMIN.
No permite iniciar sesión ni consultar, modificar o borrar datos personales. Tiene límites por
IP y usuario, cuerpo y cantidad de archivos; las imágenes se validan por sus bytes y se recodifican.

Producción guarda las nuevas imágenes en el proveedor S3/R2 del sitio y las sirve por `/media`
con la autorización existente. El endpoint rechaza disco efímero en producción. Las imágenes
iniciales del despliegue siguen disponibles como respaldo de sus adjuntos antiguos.

Preparar o revocar la credencial requiere la conexión correcta y el administrador del proyecto:

```powershell
pnpm exec tsx scripts/editorial-token.ts --target production --create
pnpm exec tsx scripts/editorial-token.ts --target production --revoke
```

El secreto está únicamente en `.data/editorial-automation/access-production.json`, con permisos
restringidos en Windows; no aparece en consola, URLs, Git, prompts ni recibos. No leas ni imprimas
ese archivo en una tarea: el cliente lo usa internamente. No vuelques variables de entorno.
La eliminación de la cuenta administradora elimina/revoca también esta autorización.

Para detener publicaciones, pausa la tarea desde Codex o revoca la credencial. Si se solicita
reanudar después de revocarla, genera otra con `--create` y reactiva la tarea. Los fallos no deben
provocar reintentos ilimitados ni contenido sin revisar: conserva el material y comunica la causa.
