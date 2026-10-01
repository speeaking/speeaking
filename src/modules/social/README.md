# social

Publicaciones, comentarios, likes, guardados, seguidores y comunidades por nicho (ADR-018).
Fase: 1.5. Ver docs/architecture.md → Feed, comunidades y Commerce Engine.

**Límites de frecuencia (SEC-15).** `limits.ts` (`checkSocialLimit`) aplica `rateLimit` por cuenta y
por IP a publicar, comentar, like, guardar, seguir, unirse, compartir y a las páginas de `/api/feed`.
Comentar el mismo texto dos veces seguidas en la misma publicación se rechaza. Seguir y unirse solo
revalidan el layout social cuando la relación cambió de verdad.

**Reacciones (ADR-054).** `reactions.ts` (las seis, su orden, `topReactions`, `applyReaction`
optimista), `reaction-summary.ts` (`reactionTops`: un `groupBy` por lote de publicaciones) y
`components/reaction-button.tsx` (la tira: presión larga, cursor, flecha arriba o «Elegir reacción»).
`reactAction(postId, kind | null)` sustituye a `toggleLikeAction`; `Like.kind` guarda el tipo y
`Post.likeCount` cuenta todas.

**Perfil (ADR-055).** `components/profile/` (portada con su última foto desenfocada, cabecera con
distintivos y la línea «en común», pestañas Publicaciones · Fotos · Tienda) y `profile-copy.ts`
(textos y recortes puros). `getPublicProfile` trae lo «en común» solo con sesión y en perfiles
ajenos. Abrir un perfil «pasa la página»: enlaces con `transitionTypes` de `lib/page-turn.ts`, CSS en
`globals.css`, esqueleto propio en `u/[username]/loading.tsx`.

**Comentarios en panel (ADR-057).** `@modal/(.)p/[id]/comentarios` pinta `RouteDrawer`
(`components/layout/route-drawer.tsx`) con `CommentList` y `CommentComposer` (los mismos de la página
de la publicación). `/p/[id]/comentarios` sin interceptar redirige a `/p/[id]#comentar`.

**Abrir en capa (ADR-052).** `components/post-detail.tsx` es el cuerpo de una publicación; lo pintan
`/p/[id]` (página completa) y `@modal/(.)p/[id]` (capa sobre el feed, `RouteModal`). «Me gusta» vive en
`PostCard` y lo disparan la barra y el doble toque sobre la foto (`MediaCarousel.onDoubleTap`); al
activar vibra 10 ms (`lib/haptics.ts`) y el corazón salta; guardar avisa con la liga a Guardados.
