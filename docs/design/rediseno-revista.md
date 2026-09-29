# Rediseño del inicio: «Revista de comunidades» + lo mejor de «Plaza»

Fecha: 2026-09-25 · Estado: aprobado por el fundador; F0–F4 hechas, F6b con datos y columna listos, F5–F7 en curso · Maquetas en [`rediseno-revista/`](rediseno-revista/)

## Por qué

Al comparar el inicio de escritorio con Facebook, el fundador pidió mejorar el diseño. Faltaba vida:

- pósters de degradado plano dominando la pantalla;
- columna derecha casi vacía;
- tarjeta «¿Qué quieres vender hoy?» recortada en ventanas de poca altura;
- avatares de iniciales («GE») y ninguna barra superior en escritorio.

Tres diseñadores prepararon una dirección cada uno: Plaza (social denso y familiar), Escaparate (media primero) y Revista (editorial con identidad). Tres jueces las calificaron desde tres enfoques: vida frente a Facebook, comercio integrado y factibilidad con accesibilidad. Revista ganó (21 pts), Plaza quedó segunda (19.5 pts) y Escaparate tercera (15 pts). El fundador eligió **Revista + lo mejor de Plaza**.

## Idea

Cada comunidad es una sección con **color y emoji propios** (salen de `Community.hue` y `Community.emoji`). El feed sigue siendo una lista plana con scroll infinito, pero cada pieza se pinta con una variante que da ritmo editorial:

- **portada**: media en una mitad, titular y conversación en la otra;
- **tipográfica**: texto grande sobre el tono de la comunidad;
- **estándar**: el resto de las piezas.

Las columnas laterales llenan la pantalla con **datos reales**: tus comunidades, debates abiertos, comunidades en movimiento y lo que buscas. El comercio sigue dosificado, y **nunca se inventan números** (principio 5).

## Decisiones de diseño

| Tema                    | Decisión                                                                                                                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Encabezado              | «Para ti» con la fecha pequeña. **Sin** «Tu edición de hoy»: el juez de vida advirtió que se leía como portal de noticias.                                                                                                                             |
| Comunidades             | Avatar de comunidad = emoji sobre su color. Por ahora emoji; un set de íconos propio queda para después.                                                                                                                                               |
| Autor editorial         | La cabecera empieza por la comunidad: avatar de comunidad, nombre de la comunidad e insignia «Editorial» en su color. Debajo, «Equipo Estreno · hace 11 h». Adiós a las iniciales «GE».                                                                |
| Contadores              | Los ceros se ocultan y se reemplazan por una invitación honesta («Sé la primera persona en comentar»). Nada inflado.                                                                                                                                   |
| Comercio                | 1 pieza comercial cada 4 (política existente). El producto de «Lo que buscas» en la columna derecha **cuenta dentro de ese presupuesto** y no se repite si ya está en la primera página del feed. Sin estante fijo de productos.                       |
| Intención               | El chip neutro «Porque buscas “tenis para correr”» reemplaza al chip lima con destello. El lima queda reservado para la IA. «En tu presupuesto» lo calcula el servidor (P2).                                                                           |
| Sube y vende            | Una sola entrada en escritorio: una fila en la columna izquierda, sección «Para vender». La columna derecha ya no la repite. Sin tarjeta oscura grande ni botón lima en el compositor.                                                                 |
| Búsqueda                | `/buscar` (barra superior en escritorio, lupa en móvil): comunidades, productos y publicaciones, por palabras y sin acentos. Comprar usa la misma búsqueda de productos.                                                                               |
| Visitantes              | Sin banner oscuro. El feed empieza arriba, con una tarjeta de bienvenida en la columna derecha e invitaciones en contexto («Unirme», «Responder»). En móvil, una tarjeta «Arma tu feed» después de la 2.ª publicación.                                 |
| Avisos (campana)        | **No** entra en esta iteración: no hay modelo de notificaciones, así que la campana no se muestra hasta que exista.                                                                                                                                    |
| Novedades por comunidad | «N nuevas» entra en la última fase, con `CommunityMembership.lastSeenAt`.                                                                                                                                                                              |
| Media                   | Proporción completa: nada de recortar pósters 4:5 a cuadrado. Los lados se rellenan con `blurDataUrl`. Las nuevas imágenes de la semilla serán **fotos de stock con licencia libre** (decisión del fundador), sin texto ni precio dentro de la imagen. |
| Móvil                   | Siguen las 5 pestañas. Fila de burbujas de comunidades (filtro) arriba del feed.                                                                                                                                                                       |

## Paleta

Aprobada el 2026-09-25: **rosa mexicano** ([ADR-027](../decisions.md#adr-027--paleta-rosa-mexicano)).
Los tokens están en `src/app/globals.css` y conservan los nombres de shadcn.

| Uso                   | Utilidad                                     | Claro                | Oscuro                  |
| --------------------- | -------------------------------------------- | -------------------- | ----------------------- |
| Lienzo                | `bg-background`                              | `#F6F7F9`            | `#000000`               |
| Tarjetas y menús      | `bg-card`, `bg-popover`                      | `#FFFFFF`            | `#101012`               |
| Texto                 | `text-foreground`                            | `#0F0F14`            | `#F5F5F7`               |
| Texto secundario      | `text-ink-2`, `text-muted-foreground`        | `#3C3D43`, `#5E6069` | `#D0D0D5`, `#9D9EA5`    |
| Chips y campos        | `bg-secondary`, `bg-muted`                   | `#EFF0F3`            | `#1E1E20`               |
| Hover de menús        | `bg-accent`                                  | `#E5E6EA`            | `#28282C`               |
| Bordes                | `border-border`, `border-line-strong`        | `#E4E4E7`, `#D3D4D8` | blanco al 10 %, al 17 % |
| Marca: crear, comprar | `bg-primary text-primary-foreground`         | `#E4007C` con blanco | igual                   |
| Rosa oscuro (hover)   | `bg-primary-strong`, `text-primary-strong`   | `#C00168`            | igual                   |
| Texto y enlaces rosa  | `text-primary-text`                          | `#C60C6D`            | `#FC84B4`               |
| Rosa suave («Unirme») | `bg-primary-soft`, `<Button variant="soft">` | `#FFEAF1`            | `#4F0D2B`               |
| Positivo              | `text-success`, `bg-success/10`              | `#137738`            | `#56D57B`               |
| Error                 | `text-destructive`, `bg-destructive/10`      | `#C51F17`            | `#FF655A`               |
| IA (y nada más)       | `bg-ai text-ai-foreground`                   | `#B7F652`            | igual                   |
| Barras con desenfoque | `bg-glass backdrop-blur`                     | blanco al 86 %       | negro al 78 %           |

**Reglas.**

- El rosa como texto siempre es `text-primary-text`: `text-primary` sobre el gris del lienzo no llega
  a AA.
- Nada de turquesa ni de degradados. Los estados positivos son verdes (`success`) y la lima es solo
  de la IA.
- Radios: `rounded-3xl` = `rounded-card` = 20 px para tarjetas; los botones usan `rounded-lg`.
- Titulares: `h1` lleva `tracking-display` (−0.028em) y `h2`/`h3` `tracking-heading` (−0.02em).
  Para títulos medianos de tarjeta, usa `tracking-title` (−0.012em).
- No hace falta un `--canvas` aparte: `--background` ya separa las tarjetas blancas del lienzo.
- Foco siempre sólido (`ring-ring`, nunca `ring-ring/50`): al 50 % no llega a 3:1.
- Bloque de tinta (IA, beneficio): `className="dark bg-card text-foreground"`, una isla oscura con
  sus propios tokens. Nunca `bg-foreground` para bloques grandes, porque en oscuro es un bloque
  blanco. `bg-foreground` sí sirve para chips seleccionados.
- Sobre un bloque rosa, el anillo va en blanco (`[--ring:oklch(1_0_0)]`) y el texto rosa sobre
  blanco fijo es `text-primary-strong` (`text-primary-text` se aclara en oscuro).

**Color por comunidad.** Pon el tono en un ancestro (`style={{ "--hue": community.hue }}`) y usa
las utilidades. Todas son AA donde llevan texto, en los 360 tonos y en ambos temas:

| Utilidad                                      | Pinta                                                        |
| --------------------------------------------- | ------------------------------------------------------------ |
| `community-tile`                              | Fondo saturado para el emoji (sin texto encima)              |
| `community-text`                              | Texto, kicker o enlace en el color de la comunidad           |
| `community-ink`                               | Titular en tinta casi negra con un toque del tono            |
| `community-soft`                              | Fondo suave y tinta profunda (selección)                     |
| `community-bar` / `community-border`          | Barra, regla o borde vivo (sin texto)                        |
| `community-block` (+ `community-block-muted`) | Bloque de color con texto: vivo en claro, profundo en oscuro |
| `community-poster` (+ `community-lite`)       | Cartel de tinta con texto blanco y kicker claro              |
| `avatar-tint`                                 | Avatar de persona sin foto (lo usa `UserAvatar`)             |

Funcionan con variantes (`has-checked:community-soft`). La receta está en
`src/styles/community-tint.ts`: si la cambias, ejecuta `pnpm tint` y la prueba confirma el contraste.

**Avatar de comunidad.** `<CommunityAvatar name emoji hue size="sm|md|lg" editorial decorative />`
(`src/components/brand/community-avatar.tsx`). Usa `decorative` cuando el nombre ya está visible al
lado; `editorial` agrega el sello de Estreno.

## Fases (cada una se entrega y verifica por separado)

Estados: ✅ hecha (según el código) · 🟡 en curso.

1. **F0 · Tokens y avatar de comunidad.** ✅ Paleta rosa mexicano, utilidades de tinte por comunidad (claro/oscuro, AA) y `CommunityAvatar`. Se usa en Descubrir y en la página de la comunidad (ver [Paleta](#paleta)).
2. **F1 · Estructura de escritorio.** ✅
   - Barra superior md+ con logo, búsqueda, «Crear», carrito y avatar (`src/components/layout/top-bar.tsx`).
   - Rejilla 232 / 680 / 320 alineada (`shellGrid`).
   - Columna izquierda con navegación, «Tus comunidades», «Para descubrir» y «Para vender»: sticky, con scroll propio y desvanecido. «Para vender» es la **única entrada a Sube y vende en escritorio**.
   - Datos nuevos: `ViewerSummary.communities` y comunidades sugeridas (`getNavCommunities`).
   - Unirse o salir de una comunidad (y seguir a alguien) revalida todo el layout social: ambas columnas se actualizan sin recargar.
   - «Unirme»/«Miembro» y «Seguir»/«Siguiendo» se nombran por lo que hacen y empiezan con el texto visible («Unirme a Gaming», «Miembro, salir de Gaming»; WCAG 2.5.3), sin `aria-pressed`. Mientras esperan al servidor conservan el foco de teclado.
3. **F2 · PostCard v2 y tarjeta de producto P4.** ✅
   - Cabecera de comunidad, contadores honestos, acciones con texto en escritorio y fila de respuesta.
   - Chip de intención con la búsqueda que coincidió.
   - Tarjeta de producto con precio sobre la imagen y datos P4.
   - `FeedItemDTO` se amplía **sin costo** (con prueba).
4. **F3 · Variantes al pintar.** ✅
   - `pickCardVariant()` es pura y probada: portada / tipográfica / estándar.
   - La primera oración sirve de titular si mide 90 caracteres o menos.
   - Separador «Hoy en {comunidad}» antes de la portada.
   - No cambian el ranking ni las posiciones de impresión.
5. **F4 · Columna derecha con datos reales.** ✅
   - Debates abiertos (una sola invitación si no hay respuestas), Comunidades en movimiento (7 días) y Lo que buscas (con descartar).
   - **Sin** fila de Sube y vende: se quitó para no repetir la entrada de la columna izquierda.
   - Nueva `dismissIntentAction` con autorización en servicio.
6. **F5 · Burbujas y compositor.** ✅
   - `CommunityBubbles`: Para ti, Siguiendo, tus comunidades, sugerencias y Explorar. Filtran con `community` o `following`.
   - Compositor «¿Qué quieres compartir, Sofía?».
7. **F6 · Visitantes.** ✅ Sin banner oscuro, con tarjeta de bienvenida en la columna derecha, invitaciones en contexto y `?unirse=` hasta el onboarding. «Unirme» ya manda al visitante a `/registro?next=<ruta>&unirse=<slug>`.
8. **F6b · «Gente de tus comunidades»** (pedido del fundador, 2026-09-25). Equivale a «Personas que quizá conozcas», pero con señales propias.
   - **Estado:** ✅ datos (`Profile.discoverable`, `SuggestionDismissal`, consentimiento `DISCOVERABILITY`), servicio, ajuste en `/ajustes`, bloque de la columna derecha y componente del carrusel (`variant="feed"`), insertado una vez en el feed después de la 6.ª pieza (solo con sesión).
   - **Formato:** carrusel horizontal dentro del feed (una vez por sesión, se puede cerrar con la ×; flechas con mouse) y bloque en la columna derecha. Cada tarjeta: avatar, nombre, razón, «Seguir» y «Quitar». Quien sigues desde ahí se queda con «Siguiendo» hasta cambiar de página.
   - **Candidatos y razón visible:**
     - seguidos por quienes tú sigues («La siguen 2 personas que sigues»);
     - miembros activos de tus comunidades («También está en Gaming y Deportes»), del más reciente al menos reciente: quienes publicaron hace poco en ellas y quienes se unieron hace poco (consultas acotadas, sin favorecer a las cuentas más antiguas);
     - quienes comentaron tus publicaciones («Comentó tu publicación»; los comentarios ya son públicos).
   - **Los «me gusta» no son señal:** la app no revela quién dio «me gusta» en ningún lugar, y una sugerencia lo delataría.
   - **Exclusiones:** cuentas editoriales, las que ya sigues, las que descartaste y quienes desactivaron «Aparecer en sugerencias» (nuevo ajuste de privacidad, activo por omisión).
   - **Sin datos externos:** nunca contactos del teléfono ni de otras redes (principio 6). El aviso de privacidad lo explica.
   - **Mínimo de candidatos:** si hay menos de 3 reales no se muestra (principio 5); en su lugar aparecen comunidades sugeridas.
   - **Datos nuevos:** `Profile.discoverable` y `SuggestionDismissal`.
9. **F7 · Novedades.** ✅ Migración `lastSeenAt` y contadores «N nuevas» en burbujas y columna izquierda.

## Fuera de alcance de esta iteración

Campana de avisos, pares a dos columnas en el feed, resúmenes por comunidad y titulares redactados por IA.

**La búsqueda global sí entró y está hecha:** `/buscar?q=` (barra superior en escritorio, lupa en móvil) busca comunidades, productos activos y publicaciones visibles, por palabras, sin acentos ni mayúsculas y con SQL parametrizado (`src/modules/search`). Comprar (`/comprar?q=`) usa la misma búsqueda de productos, así que «tecnologia» y «Tecnología» son lo mismo en ambas. Índices de trigramas o búsqueda semántica quedan para cuando el volumen lo pida.

## Verificación

En cada fase: `pnpm check`, `pnpm build` y `pnpm test:e2e`. Además se capturan pantallas del recorrido (`.data/capture/journey.spec.ts`) en 1352×643, 1352×760 y 412×915, en claro y oscuro, y se comparan con las maquetas.
