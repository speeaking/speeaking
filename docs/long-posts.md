# Publicaciones largas

- Los usuarios y el administrador pueden publicar hasta **60,000 caracteres**. El servidor conserva
  el texto completo. No depende de que esté disponible la IA.
- El editor permite pegar texto sin truncarlo, conserva el borrador si la acción devuelve un error
  y muestra el contador solo al llegar al 90 % del máximo. Si se excede, avisa y permite ajustarlo.
- El cuadro de escritura tiene altura máxima y scroll propio en móvil y escritorio.
- El feed, perfiles, videos, búsqueda y guardados transportan vistas previas de hasta 800 caracteres.
  «Ver más» pide el original con autorización y límites de frecuencia; «Ver menos» vuelve a la vista
  breve. La página de la publicación carga el original directamente.
- «Contexto» procesa todo el texto por partes de hasta 8,000 caracteres. Los resúmenes parciales se
  combinan hasta obtener un contexto de hasta 320 caracteres. No se resume únicamente el inicio.
- Se reserva y registra cada llamada, incluidos los pasos intermedios, sin modificar los topes
  globales de tokens ni de presupuesto. Como máximo tres llamadas simultáneas y tres minutos para
  el recorrido completo. Si una parte falla, no se ofrece un resumen parcial como si fuera completo.
- La IA recibe texto con los datos de contacto redactados. El contexto se guarda por hash del
  original; antes de guardarlo se comprueba que la publicación siga visible y sin cambios.
- La automatización editorial conserva su máximo de 2,000 caracteres y las instrucciones de cada
  tanda. El tamaño de las publicaciones personales no cambia sus pautas de contenido breve.

No se requiere migración: `Post.body` ya se guarda como texto en PostgreSQL.
