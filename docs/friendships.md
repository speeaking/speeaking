# Amigos y privacidad personal

- `/personas` pide sesión y perfil terminado. Incluye Amigos, Solicitudes, Enviadas, Seguidores,
  Siguiendo y Compradores, con paginación y búsqueda por nombre o usuario.
- Una sola relación por par ordenado de UUID. Solo el destinatario acepta una solicitud pendiente.
  Una solicitud cruzada no acepta la anterior. Cancelar, rechazar y quitar son acciones distintas;
  los cambios y sus avisos se guardan en una transacción con bloqueo por par.
- La biografía, ciudad, portada y publicaciones sin producto de cuentas personales requieren ser
  el dueño o un amigo aceptado. Las publicaciones con producto y las editoriales son públicas.
  El formulario explica la audiencia antes de publicar y las tarjetas personales llevan candado.
- Nombre, usuario y foto de perfil son públicos para identificar a la persona. Seguir o comprar no
  concede acceso al contenido personal. Los compradores solo los consulta el vendedor autenticado
  a partir de pedidos pagados, enviados o entregados; no se exponen correos, direcciones ni pagos.
- La autorización se aplica al perfil, feed, búsquedas SQL, comentarios, contexto IA, avisos,
  contadores de novedades y entrega de fotos, portadas y videos. Los metadatos compartidos nunca
  incluyen el cuerpo ni imágenes de publicaciones personales. `/personas` lleva `noindex`.
- Bloquear mensajes también elimina la amistad y las solicitudes. Desbloquear no restaura la
  amistad. Quitar una amistad cierra el acceso en peticiones nuevas. No se pueden retirar copias
  que alguien ya haya descargado: las fotos personales usan `private, no-store` y las URLs firmadas
  para videos personales caducan a los dos minutos. Fotos del probador y comprobantes conservan
  su autorización independiente; una amistad no permite abrirlos.
- La migración `20261004020000_friendships` agrega la tabla, sus restricciones e índices y dos tipos
  de aviso. No borra contenido, pedidos ni seguidores, ni convierte seguidores existentes en amigos.

Comprobaciones realizadas y despliegue: ver el resumen de la tarea correspondiente. No se han
creado cuentas de demostración en producción.
