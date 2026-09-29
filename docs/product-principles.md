# Principios de producto

> **Estreno** es la marca de la plataforma (ADR-041; dominio e IMPI pendientes). «Sube y vende» es la
> función para vendedores y «Pruébatelo», «Crea mi look» y «Completa mi look» las de compra asistida.
> Mercado inicial: México (MXN, es-MX).

## Definición de trabajo

"Una red social donde descubres contenido, descubres productos y la IA hace que comprar y vender sea
prácticamente automático." Para el vendedor: "Tú tienes el producto. La IA encuentra cómo venderlo."

## Principios no negociables

1. **Red social primero.** La gente entra a entretenerse, descubrir, aprender y conversar; no
   necesariamente a comprar. Nunca construimos "un marketplace con un feed".
2. **El feed es la prioridad estratégica.** "Para ti" es la pantalla principal. El comercio aparece de
   forma contextual y progresiva dentro del contenido, no como catálogo.
3. **Proporción comercial configurable.** Arranca en ~1 pieza comercial cada 3–4 piezas de contenido.
   Es un parámetro con límites, no una constante: se ajusta con datos (ver `architecture.md` → Feed).
4. **Sin clientes no hay ventas: la demanda se construye desde el día 1.** Comunidades por nicho con
   contenido precargado para que quien llegue se enganche desde el primer minuto (ver `mvp-0.1.md`).
5. **Contenido honesto.** Nada de usuarios falsos, interacciones infladas ni contenido copiado sin
   permiso. Las cuentas editoriales se identifican como tales y el contenido generado con IA se etiqueta.
6. **Señales propias.** La personalización usa solo comportamiento dentro de la plataforma: vistas,
   clics, búsquedas, likes, guardados, visitas a productos, carrito y compras. Nunca datos de terceros.
7. **La IA redacta, el código calcula (P2, obligatorio).** La IA recomienda y explica; margen, punto de
   equilibrio, presupuestos, comisiones y cualquier cifra financiera crítica los calcula código
   determinista y probado. Toda estimación se muestra como estimación, con sus supuestos.
8. **Datos verificables (P4, obligatorio).** Stock, zonas y tiempos de entrega, garantía, devoluciones,
   métodos de pago y autenticidad declarada son datos estructurados. Ningún agente de IA puede afirmar
   algo que no esté en esos datos.
9. **Eventos y atribución desde el día 1 (P5).** Impresiones, vistas, clics, búsquedas, likes, guardados,
   visitas a productos, carrito y compras se registran con su origen para medir, atribuir y aprender.
10. **Automejora con límites.** La plataforma se optimiza sola de forma continua dentro de límites
    explícitos; las decisiones de alto impacto requieren aprobación humana y todo queda registrado y es
    reversible (ver `architecture.md` → Motor de automejora).
11. **Optimizamos lo sano.** Métrica principal: beneficio generado por vendedor. Métricas de salud:
    compradores que regresan, satisfacción y confianza. Nunca optimizamos tiempo en pantalla a costa del
    usuario (sin patrones oscuros).
12. **Simplicidad.** "¿Qué quieres vender hoy?" / "¿Qué quieres descubrir?". La complejidad va detrás.
13. **Seguridad y privacidad desde el inicio.** Ver `architecture.md` → Seguridad y Privacidad.
14. **Una cuenta, capacidades progresivas (P6).** Todos son usuarios; vender o crear se activa cuando se
    necesita, sin elegir "tipo de cuenta" al registrarse.
15. **La IA se autofinancia.** Cada llamada a la IA registra su costo; la IA opera con un presupuesto
    que crece con los ingresos que genera la plataforma. Camino: subsidiada (piloto) → cubre sus
    costos → genera utilidades que financian más crecimiento. Siempre en este orden de prioridad:
    vendedores y creadores ganan, usuarios reciben productos y servicios de calidad, y la plataforma
    cobra una fracción del valor que crea.

## Propuestas aprobadas

| #   | Propuesta                                                              | Estado                                       |
| --- | ---------------------------------------------------------------------- | -------------------------------------------- |
| P1  | Compartir afuera, descubrir adentro                                    | Aprobada — Sprint 1                          |
| P2  | La IA redacta, el código calcula                                       | Aprobada — regla obligatoria                 |
| P3  | De la propuesta de IA al producto en un toque                          | Aprobada — Sprint 1                          |
| P4  | Datos estructurados para que el agente no invente                      | Aprobada — campos en Sprint 1                |
| P5  | Eventos y atribución desde el día 1                                    | Aprobada — Sprint 1                          |
| P6  | Una cuenta con capacidades progresivas                                 | Aprobada — Sprint 1                          |
| P7  | Promoción dentro del feed como canal de campañas                       | Aprobada — modelo en fase 13                 |
| P8  | Nombre de marca definitivo                                             | Pendiente — no bloquea                       |
| P9  | Comunidades por nicho con contenido precargado                         | Pedida por producto — Sprint 1               |
| P10 | Motor de automejora ("IA CEO") con límites                             | Pedida por producto — base en Sprint 1       |
| P11 | IA autofinanciada (presupuesto ligado a ingresos)                      | Pedida por producto — base en Sprint 1       |
| P12 | Impulso pagado por resultados + vendedor IA                            | Pedida por producto — se activa con tráfico  |
| P13 | Reels: video vertical corto que vende                                  | Pedida por producto — después del rediseño   |
| P14 | Riesgo de falsificación, reportes y moderación                         | Pedida por el fundador — construida (base)   |
| P15 | Estilista: ¿Qué necesitas?, Crea mi look, Completa mi look, Pruébatelo | Pedida por el fundador — construida (fase 2) |
| P16 | Autofinanciamiento: saldo, precio comunitario y patrocinio             | Pedida por el fundador — construida (base)   |

### P12 · Impulso pagado por resultados + vendedor IA experto (2026-09-25)

1. **Problema.** Hay vendedores que quieren vender más y más rápido, y la plataforma necesita ingresos
   para que la IA se pague sola (principio 15). Además, el fundador espera que «venda sí o sí».
2. **Solución: «Impulsar».** El vendedor paga para que su producto aparezca más en el feed y en Comprar.
   - **Dónde aparece:** siempre **dentro de los espacios comerciales que ya existen** (1 cada 4). No
     aumenta la cantidad de anuncios; mejora cuáles se muestran.
   - **Qué incluye:**
     - la IA mejora la publicación (texto, variantes y orden de fotos, pruebas A/B);
     - un **vendedor IA** experto y persuasivo responde dudas y cierra ventas 24/7 (el AI Sales
       Agent).
   - **Cómo se cobra:** por resultados. Por visita al producto o, mejor, **comisión solo si vende**.
     «Sí o sí» no se puede prometer; lo honesto es **«si no vendes, no pagas»**, y eso además
     alinea a la plataforma con el vendedor.
   - **Presupuesto:** prepagado, con tope diario. Lo no gastado se devuelve.
3. **Reglas.**
   - **Etiqueta y relevancia:** la etiqueta «Patrocinado» siempre es visible (Ley Federal de
     Protección al Consumidor). La relevancia manda: calidad × puja, así que un producto malo no se
     muestra aunque pague.
   - **Límites de exposición y datos:** frecuencia máxima por persona. Solo señales propias, nunca
     datos de terceros.
   - **Vendedor IA:** es persuasivo pero honesto. Solo afirma datos P4. Nada de urgencia falsa,
     escasez inventada ni presión. Dice que es IA y pasa a una persona cuando hace falta.
4. **Beneficio.** El vendedor acelera sus ventas pagando solo por resultados. La plataforma gana
   ingresos que financian la IA. El comprador ve anuncios relevantes, no ruido.
5. **Complejidad.** Alta. Requiere:
   - campañas con presupuesto, puja y tope;
   - subasta simple por espacio comercial;
   - saldo prepagado vía `PaymentProvider`;
   - reportes en Studio → Campañas;
   - el vendedor IA con chat.
6. **Impacto en el MVP y cuándo.** Ninguno ahora; la base ya existe:
   - espacios comerciales con presupuesto configurable;
   - atribución `sourcePostId`;
   - impresiones con posición;
   - `PlatformLedgerEntry`;
   - `AIProvider`;
   - datos P4.

   **Se activa cuando haya flujo**, con un umbral medible que fije el fundador. Propuesta:
   ≥ 5,000 personas activas por semana y ≥ 100 ventas orgánicas por semana. El motor de automejora
   avisa cuando se cumpla y el fundador aprueba la activación (decisión de alto impacto).

### P13 · Reels: video vertical corto que vende (2026-09-25)

1. **Problema.** El video corto vertical es lo que más engancha: Reels, TikTok y Shorts. Sin video nos
   vemos como una red de hace 10 años. Los vendedores venden mejor mostrando el producto en uso.
2. **Solución.**
   - **Dónde aparece:**
     - Una fila «Reels» dentro del feed (cada ~8 piezas).
     - Un visor a pantalla completa con deslizamiento vertical, que se abre desde la fila y desde
       Descubrir.
     - Los reels de producto llevan una **etiqueta de precio tocable** (abre el producto sin salir
       del video).
   - **Formato:** 9:16, de 5 a 90 s.
   - **Qué tipos hay:**
     - reels de comunidad (tips, humor, recetas);
     - reels de producto (el vendedor lo muestra en uso);
     - «Convierte tus fotos en un reel»: con las fotos del producto armamos un video con
       movimiento, textos y precio. Es barato: se procesa en el servidor, sin IA de video.
   - **Qué no entra por ahora:**
     - Las **historias de 24 h** quedan para después: son otra función, con otra moderación.
     - Las **noticias** solo como contenido editorial de comunidad con fuente citada. Nada copiado
       de medios.
3. **Beneficio.** Más tiempo de entretenimiento sano (principio 1), descubrimiento de productos dentro
   del contenido y un formato que los vendedores ya conocen.
4. **Complejidad.** Alta.
   - **Proveedor de video gestionado** para transcodificar a HLS, generar portadas y servir por CDN.
     Candidatos: Cloudflare Stream, Mux o Bunny Stream. Su costo por minuto entra en la economía de
     la plataforma (principio 15).
   - **Límites de subida** (tamaño y duración).
   - **Moderación de video.**
   - **Autoplay silenciado solo en pantalla.** Con **ahorro de datos** (Save-Data, datos móviles
     prepago) se muestra solo la portada.
   - **Subtítulos.**
   - **Métricas:** vista a 3 s, retención y toques a la etiqueta.
5. **Impacto en el MVP.** Ninguno ahora. La base ya existe: `MediaKind.VIDEO`, `PostType.VIDEO`,
   `MediaStatus` para el procesamiento y la interfaz `MediaProcessor` planeada.
6. **Cuándo.** Justo después del rediseño del inicio. El contenido semilla usará videos de stock con
   licencia libre (Pexels Videos o Mixkit), con la misma aprobación previa que las fotos.

### P14 · Riesgo de falsificación, reportes y moderación (2026-09-26)

Pregunta del fundador: «¿la IA podría detectar si un producto es falso?». Respuesta honesta: **no
con certeza**. Ni una persona experta lo sabe por fotos y texto; hace falta tener el artículo, su
número de serie o la factura. Lo que sí podemos hacer es **detectar riesgo** y pedir pruebas. Nunca
decimos «falso» ni «certificado».

1. **Problema.** Las imitaciones de marca (AirPods, tenis, controles, bolsas) son comunes en la venta
   informal en línea. Si alguien compra una «original» que no lo es, pierde la confianza en toda la
   plataforma. Además, vender falsificaciones está prohibido (Ley Federal de Protección a la
   Propiedad Industrial) y los dueños de las marcas pueden pedir que se retiren.
2. **Solución: riesgo, no certificación.**
   - **Reglas (código determinista, P2)** con explicación en español para el vendedor y el equipo:
     - precio muy por debajo de la mediana de productos parecidos activos (misma categoría y
       marca) de **≥ 5 tiendas distintas** (un precio por tienda, la mediana de los suyos: una sola
       cuenta con muchas publicaciones no mueve la mediana) o de una **referencia aproximada**
       curada a mano
       (`trust/reference-prices.ts`, editable después con el ajuste `trust.referencePrices`);
     - palabras de imitación («réplica», «AAA», «1:1», «clon», «calidad espejo», «calidad
       original», «tipo original», «inspirado en» + marca). Las ambiguas («AAA» de pilas, «1:1» de
       una maqueta) solo cuentan junto a una marca, y «funda para iPhone» no cuenta como la marca.
       Las negadas no cuentan: «100 % originales, no réplica» o «cero clones» es lo que escribe un
       vendedor honesto;
     - se declara «original» y además saltó el precio o las palabras;
     - tienda de menos de 14 días sin ventas entregadas con un artículo de marca de $2,000 o más;
     - reportes de compradores por posible falsificación. Solos se quedan en riesgo bajo: no
       cambian lo que ve quien compra (podrían venir de cuentas creadas contra un competidor); van
       a la cola del equipo y solo refuerzan otras señales.
   - **Niveles.** Bajo: nada. Medio: una nota neutral para quien compra («Revisa: el precio es muy
     inferior al de productos similares»). Alto: se oculta la declaración «original», quien compra
     ve «Autenticidad sin verificar» y el vendedor recibe en el Studio la petición de subir un
     comprobante privado (ticket, factura, empaque) o de marcarlo como «genérico o compatible». Si
     NO se declara original (usa la marca con «réplica», «AAA»…), no se pide comprobante: se le pide
     corregir la publicación y el equipo decide si la oculta.
   - **«Comprobante revisado» vale para el artículo revisado:** se conserva mientras siga declarado
     original, el riesgo no suba y no cambien el título, las etiquetas, la categoría ni la
     condición. Si cambian, se quita y se reevalúa (nadie hereda el sello para otro artículo). El
     equipo solo puede darlo con las mismas fotos que tiene en pantalla y si la publicación no usa
     palabras de imitación («Comprobante revisado» junto a «réplica» se contradice).
   - **IA opcional** (`trust.aiSignal.enabled`, apagada): lee solo el texto y suma a lo más 0.15;
     nunca decide sola ni lleva por sí misma a riesgo alto. Pasa por el guardián de presupuesto.
     En producción sin servidor de IA no hay señal (el simulado nunca suma riesgo real).
   - **Reportar** en productos y publicaciones (posible falsificación, estafa, prohibido, spam,
     ofensivo, otro): con límite de frecuencia, uno por persona y objetivo, anónimo para el vendedor.
   - **Cola del equipo** en `/admin/moderacion`: revisar el comprobante («Comprobante revisado por
     Estreno», que dice explícitamente que no es certificación ni garantía), rechazar la
     declaración (queda genérico), ocultar, restaurar y descartar reportes. Todo queda en la
     bitácora con quién lo hizo. Oculto = fuera del feed, la búsqueda, Comprar, «similares»,
     Guardados, los perfiles y su página (salvo su dueño y el equipo).
3. **Beneficio.** Quien compra ve señales honestas antes de pagar; el vendedor honesto tiene un
   camino claro (y un sello de comprobante revisado); la plataforma cumple la ley y los términos sin
   acusar a nadie. La operación le pide al fundador revisar solo lo de riesgo alto (24 h hábiles).
4. **Complejidad.** Media: reglas puras con pruebas, una fila de revisión por producto
   (`AuthenticityCheck`), reportes (`Report`), estado de moderación del producto y cola del equipo.
   Riesgos: falsos positivos (se mitigan con pesos bajos para señales ambiguas y un umbral de
   comparables por tienda), reportes usados contra un competidor (solos no cambian nada público) y
   fotos de comprobante privadas (no se adjuntan al producto; solo su dueño y ADMIN las ven; el
   recolector de huérfanas debe excluirlas y, con almacenamiento externo, no pueden ir a un bucket
   público).
5. **Impacto en el MVP.** Ninguno en el flujo de venta: el producto se publica igual y el checkout no
   cambia (el código de pagos no se toca, ADR-033). Los productos creados antes de P14 no tienen
   revisión hasta que se editan: se muestran como antes.
6. **Cuándo.** Ya: base construida el 2026-09-26. Después: lista de artículos prohibidos revisada
   por el abogado, apelación del vendedor, aviso al vendedor por correo, ocultamiento automático
   solo para lo grave (plan-90-dias §7.3) y señal por foto cuando el costo de imágenes quepa en el
   guardián de presupuesto.

### P15 · Estilista y «Pruébatelo» (2026-09-29)

Plan del fundador: «pasar de buscar → encontrar → comprar a necesidad → la IA recomienda → crea look →
Pruébatelo → comprar», con 20 funciones de IA en 5 fases y una regla: no construirlas todas de golpe.

1. **Problema.** Buscar por palabras no ayuda a quien no sabe qué comprar («tengo una boda el
   viernes»), y comprar ropa en línea sin verla puesta genera dudas y devoluciones.
2. **Solución.**
   - **«¿Qué necesitas?»** interpreta la necesidad (ocasión, estilo, presupuesto, colores, momento)
     con un modelo de texto barato o con reglas si el modelo falla; el presupuesto siempre lo pone
     el código (P2).
   - **«Crea mi look»** arma hasta 3 looks completos con productos reales de distintos vendedores
     (código determinista: huecos, relevancia, presupuesto), con nombre honesto; cada pieza lleva
     su `productId`, precio y vendedor (P4). «Otra opción» y «Más barato» cambian piezas.
   - **«Completa mi look»** parte de un producto y busca lo que combina.
   - **«Pruébatelo»** genera una simulación con la foto de la persona y hasta 4 prendas, por un
     proveedor de imágenes intercambiable; siempre se presenta como simulación (ADR-045).
   - **Coincidencias:** la necesidad se guarda como intención («Lo que buscas») para seguir
     recomendando cuando aparezcan productos.
3. **Beneficio.** Quien no sabe qué comprar decide en minutos; quien vende recibe compradores con
   intención clara y productos que se prueban antes de comprarse.
4. **Complejidad.** Alta pero modular: banderas por función (`ai.features`), proveedor de imágenes
   por interfaz con simulador, caché de resultados, cuotas por función, retención y privacidad de
   fotos. Las 15 funciones restantes existen solo como banderas apagadas.
5. **Impacto en el MVP.** Ninguno en lo existente: rutas nuevas (`/estilista`, `/probar`), una
   tarjeta arriba de Comprar y dos enlaces en la ficha de las prendas. Nunca arriba del feed: el
   inicio empieza por lo que la gente comparte (principios 1 y 2; corrección del 2026-09-29).
6. **Cuándo.** Construido el 2026-09-29 (fase 2 del plan). Fases 3–5 se encienden una por una,
   midiendo antes de invertir en la siguiente.

### P16 · Autofinanciamiento: saldo, precio comunitario y patrocinio (2026-09-29)

1. **Problema.** Las imágenes y el video cuestan dinero real por uso; sin un cobro claro, unas
   cuantas cuentas pueden vaciar el presupuesto. El fundador pide cobrar donde sea necesario, que
   nada sea caro y que el precio baje al crecer la comunidad.
2. **Solución.** `docs/modelo-de-ingresos.md`: saldo en pesos por cuenta; 3 pruebas gratis al mes
   con tope diario del subsidio; después, precio comunitario por prueba ($3.50 → $2.00 según el
   volumen mensual de toda la plataforma, con piso de 1.5 × el costo); el vendedor puede
   patrocinar pruebas sobre sus productos con tope diario; lo barato sigue gratis con cuotas.
3. **Beneficio.** La IA se paga sola desde el piloto; cada peso de margen alimenta más pruebas
   gratis y las siguientes funciones; el precio transparente baja con la comunidad.
4. **Complejidad.** Media: cartera con candado y libro de movimientos, cobro atómico junto a la
   reserva de IA, devolución si falla, recargas simuladas hoy y por webhook después.
5. **Impacto en el MVP.** Ninguno en pagos entre comprador y vendedor (siguen fuera de la
   plataforma). Las recargas reales necesitan Mercado Pago/Stripe y los textos legales del saldo.
6. **Cuándo.** Base construida el 2026-09-29; recargas reales cuando el fundador conecte el
   procesador y el abogado revise los términos del saldo.

## Fuera de alcance en V0.1

Algoritmo avanzado de IA, recomendaciones complejas, pagos reales, integración real con Meta/Google
Ads, sistema completo de afiliados, chat de IA avanzado, logística y moderación avanzada. La
arquitectura queda preparada para AI Sales Agent, Autopiloto, creadores/afiliados y publicidad interna.
