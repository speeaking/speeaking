# Notificaciones, tienda y videos

- En móvil, la navegación principal aparece bajo el logo: Inicio, Reels, Tienda,
  Notificaciones y Perfil. Crear y Mensajes siguen disponibles en el encabezado;
  el menú de perfil incluye comunidades, carrito, amigos, pedidos y ajustes.
- `/avisos` muestra actividad real, agrupada, con filtros de nuevas, comentarios,
  reacciones, etiquetas, amistad y pedidos. Abrir un aviso marca su grupo como leído;
  también se pueden marcar todos, eliminar avisos y aceptar o rechazar solicitudes.
  El contador de la campana se actualiza cada minuto mientras la app está visible.
- `@usuario` en publicaciones y comentarios enlaza al perfil. Se avisa como máximo
  a diez cuentas distintas por texto, con perfil terminado, sin bloqueos entre las
  personas y que puedan ver la publicación. Una mención no concede acceso a contenido
  personal. No hay autoavisos ni un segundo aviso al autor de la publicación cuando
  ya recibe el aviso del comentario.
  Las etiquetas de productos conservan su selector y sus avisos a las tiendas.
- `/videos` y `/api/videos` usan los mismos filtros de privacidad y moderación que
  el feed. Solo muestran videos listos, con paginación estable por fecha e ID,
  controles de reproducción y las acciones reales de la publicación. No se crean
  videos, reacciones ni usuarios de demostración para llenar esta sección.
- `/comprar` aparece como Tienda y conserva catálogo, categorías y búsqueda, con
  accesos al carrito y las compras de la cuenta.
- El carrusel superior del inicio alterna videos y productos, incluso con el catálogo
  vacío. La actualización en video más reciente de la cuenta oficial del administrador
  abre la fila. Los demás videos van del más reciente al más antiguo y conservan su
  audiencia; tocar una portada abre la publicación sobre el feed. La fila solo carga
  portadas, sin descargar todos los clips, y mantiene flechas y deslizamiento horizontal.
- La migración `20261004160000_person_mentions` agrega `MENTION` al enum de avisos.
  Es aditiva; el despliegue de producción la aplica mediante `prisma migrate deploy`.
- `/buscar` incluye personas por nombre o @usuario y filtros para Todo, Personas, Comunidades,
  Publicaciones, Videos y Productos. Las categorías conservan la búsqueda y tienen paginación.
  Las tarjetas de personas incluyen únicamente identidad pública y relaciones propias; no abren
  contenido personal ni muestran cuentas bloqueadas. Ver `src/modules/search/README.md`.
