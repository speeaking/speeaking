# Principios de producto

> "VendeIA" es un nombre provisional interno. "Vende con IA" es el nombre de la función para vendedores.
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

| #   | Propuesta                                         | Estado                                      |
| --- | ------------------------------------------------- | ------------------------------------------- |
| P1  | Compartir afuera, descubrir adentro               | Aprobada — Sprint 1                         |
| P2  | La IA redacta, el código calcula                  | Aprobada — regla obligatoria                |
| P3  | De la propuesta de IA al producto en un toque     | Aprobada — Sprint 1                         |
| P4  | Datos estructurados para que el agente no invente | Aprobada — campos en Sprint 1               |
| P5  | Eventos y atribución desde el día 1               | Aprobada — Sprint 1                         |
| P6  | Una cuenta con capacidades progresivas            | Aprobada — Sprint 1                         |
| P7  | Promoción dentro del feed como canal de campañas  | Aprobada — modelo en fase 13                |
| P8  | Nombre de marca definitivo                        | Pendiente — no bloquea                      |
| P9  | Comunidades por nicho con contenido precargado    | Pedida por producto — Sprint 1              |
| P10 | Motor de automejora ("IA CEO") con límites        | Pedida por producto — base en Sprint 1      |
| P11 | IA autofinanciada (presupuesto ligado a ingresos) | Pedida por producto — base en Sprint 1      |
| P12 | Impulso pagado por resultados + vendedor IA       | Pedida por producto — se activa con tráfico |
| P13 | Reels: video vertical corto que vende             | Pedida por producto — después del rediseño  |

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

## Fuera de alcance en V0.1

Algoritmo avanzado de IA, recomendaciones complejas, pagos reales, integración real con Meta/Google
Ads, sistema completo de afiliados, chat de IA avanzado, logística y moderación avanzada. La
arquitectura queda preparada para AI Sales Agent, Autopiloto, creadores/afiliados y publicidad interna.
