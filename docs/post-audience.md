# Audiencia por publicación

Cada publicación guarda PUBLIC, FRIENDS u ONLY_ME. Las nuevas son públicas por defecto y el
autor puede elegir antes de publicar o usar el menú de tres puntos → Cambiar audiencia.
Incluye noticias, fotos, videos y publicaciones con productos, sin depender de tener amigos.

La migración conserva el alcance anterior: productos, editorial y administrador oficial quedan
PUBLIC; otras publicaciones existentes quedan FRIENDS. No convierte publicaciones privadas en
públicas automáticamente. La biografía, ciudad y portada mantienen su autorización de amistad.

La misma regla se aplica en Prisma y SQL a feed, comunidad, búsqueda, perfil, fotografías, reels,
comentarios, reacciones, guardados, notificaciones, texto completo y contexto de IA. ONLY_ME no
concede acceso a los amigos. Solo el autor de una publicación PUBLISHED cambia su audiencia;
no se cambia el estado de moderación. Cambiarla requiere sesión, validación y límite de frecuencia.

Las respuestas de medios ligados a publicaciones no se guardan en navegador ni CDN. Retirar
acceso no puede borrar copias ya descargadas, y una URL de video previamente firmada conserva
su vigencia hasta caducar. Los medios de una ficha comercial pública mantienen esa exposición
independiente; limitar una publicación no oculta el producto de la tienda.
