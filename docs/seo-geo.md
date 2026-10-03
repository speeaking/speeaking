# SEO y descubrimiento en asistentes de IA

## Publicación

El origen canónico del contenido público es `https://www.speeaking.com`. Se define en
`src/config/site.ts` y es independiente de `APP_URL`, que usa la autenticación. No cambiar
el origen del callback de Google para modificar el SEO.

`ALLOW_INDEXING` es `true` por omisión. Un valor explícito `false` suspende la indexación.
Localhost, hosts de preview de Vercel y `VERCEL_ENV=preview` llevan `noindex` siempre.
Las áreas privadas, búsquedas internas, listas de seguidores y documentos legales en
borrador quedan fuera del índice. La autorización del servidor sigue siendo obligatoria:
robots.txt no protege datos.

## Search Console y Bing

1. Verificar la propiedad de dominio `speeaking.com` en Google Search Console. El TXT
   de verificación entregado por el propietario ya estaba publicado el 3 de octubre de 2026.
   El sitio también incorpora la etiqueta HTML para una propiedad de prefijo de URL.
2. En **Sitemaps**, enviar `https://www.speeaking.com/sitemap-index.xml`.
   El índice reúne páginas, productos, comunidades, categorías y tiendas públicas,
   en lotes de hasta 10 000 URLs. Los productos retirados, ocultos o sin stock se excluyen.
3. Registrar el sitio en Bing Webmaster Tools o importar la propiedad verificada de Google.
   Enviar el mismo índice. Revisar las incidencias de rastreo que informen ambos paneles.
4. Inspeccionar Inicio, Comprar, Cómo funciona y un producto publicado en Search Console.
   Solicitar indexación de esas páginas tras el lanzamiento o cambios importantes.

El código no registra automáticamente cuentas ni acredita la propiedad en los paneles.
El botón Verificar y el envío del sitemap requieren acceso a la cuenta del propietario.

## Qué se entrega a los buscadores

- Canonical estable sin parámetros, metadatos por página y vistas previas Open Graph/X.
- Product/Offer con precio, moneda, disponibilidad y condición del producto real.
- BreadcrumbList con categorías enlazadas y páginas de categoría con ItemList.
- Organization/WebSite para identificar la marca y FAQPage con respuestas visibles.
- JSON-LD escapado y con el nonce de CSP; no se incluyen correos, pedidos o fotos de prueba.
- Fechas de modificación reales para fichas, comunidades y perfiles. No se simula frescura.
- Analítica del servidor excluye agentes de rastreo conocidos; las vistas del vendedor
  a su propio producto tampoco se cuentan como interés comercial.

No se inventan reseñas, puntuaciones, direcciones, certificaciones, perfiles sociales,
políticas de envío o promesas de compra. Si hay enlaces oficiales de redes, se pueden
añadir a Organization.sameAs tras confirmarlos.

## GEO: contenido útil para respuestas generadas

`/como-funciona` y `/preguntas-frecuentes` explican qué es speeaking, para quién sirve,
cómo se compra y vende, y los límites de la simulación de prendas. El contenido y las
fichas públicas se renderizan en HTML y se enlazan desde el sitio.

OAI-SearchBot puede rastrear las páginas públicas con las mismas restricciones que
los otros buscadores. Sus permisos de búsqueda son independientes de GPTBot, usado
para entrenamiento. El despliegue no crea una integración con ChatGPT ni garantiza citas.
Los firewalls/CDN también deben permitir a los rastreadores legítimos; robots.txt no
elimina un bloqueo de la infraestructura.

Google no exige archivos especiales ni un marcado exclusivo para AI Overviews o AI Mode.
Por eso se priorizan páginas útiles, indexables y datos fieles al contenido visible.

## Trabajo continuo

- Revisar semanalmente páginas indexadas, exclusiones, impresiones, clics y consultas.
- Completar fichas con fotos originales, títulos precisos, medidas y condiciones reales.
- Publicar guías originales que resuelvan preguntas de compradores; enlazar categorías
  y productos pertinentes, evitando páginas repetidas o contenido creado solo para keywords.
- Mantener perfiles oficiales y conseguir menciones/enlaces de comunidades y tiendas reales.
- Evaluar Core Web Vitals con datos de campo cuando haya tráfico suficiente.
- Valorar Merchant Center cuando el catálogo y la operación comercial cumplan sus requisitos.

La indexación, las posiciones y las citas en asistentes son decisiones de cada servicio.
Poner la base técnica en producción no equivale a estar indexado inmediatamente.

## Referencias oficiales

- https://developers.google.com/search/docs/appearance/ai-features
- https://developers.google.com/search/docs/appearance/structured-data/merchant-listing
- https://developers.openai.com/api/docs/bots
- https://www.bing.com/webmasters/help/bing-webmaster-guidelines-30fba23a
