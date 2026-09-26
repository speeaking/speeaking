# discovery

Columna derecha «Para ti» del escritorio (F4) y «Gente de tus comunidades» (F6b) del
[rediseño del inicio](../../../docs/design/rediseno-revista.md). Solo datos reales: los ceros se
ocultan y, si no hay nada honesto que mostrar, el bloque no aparece o deja una sola invitación.

| Bloque                    | Regla                                                                                                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lo que buscas             | Intención `ACTIVE` y vigente más reciente. El mejor producto `ACTIVE` con stock, dentro del presupuesto y de otra persona lo elige `pickIntentProduct` (P2). La × la marca `DISMISSED` (solo su dueña). |
| Debates abiertos          | Hasta 4 publicaciones de texto (sin fotos ni producto) que terminan en «?», de tus comunidades (o de todas), una por comunidad, nunca tuyas. Si ninguna tiene respuestas: una invitación.               |
| Comunidades en movimiento | Publicaciones de los últimos 7 días por comunidad (una consulta agrupada), top 5, «Tuya» o «Unirme».                                                                                                    |
| Gente de tus comunidades  | Ver abajo. Menos de 3 candidatos reales = no se pinta.                                                                                                                                                  |

La columna es secundaria: si una consulta falla, el bloque se omite (y se registra en el log) en
lugar de romper el feed y las demás páginas del layout.

## «Lo que buscas» y el presupuesto comercial

El producto de «Lo que buscas» cuenta como pieza comercial (1 de cada 4, política del feed). La regla
de esta versión es la más simple aceptable: **solo aparece si la persona declaró una intención activa
y vigente**; es la respuesta a lo que ella pidió, no un anuncio, y nunca hay un estante fijo de
productos. La columna vive en el layout y no conoce la primera página del feed, así que todavía no
puede omitir un producto que el feed también muestre. Para lograrlo, la página de inicio y la columna
tendrían que compartir la primera página en caché por request (`cache()` sobre `getFeed`) y pasar a
`getIntentHighlight` los productos que ya salieron.

## «Gente de tus comunidades»

- **Señales (solo de la plataforma, principio 6):** personas seguidas por tus seguidos mutuos, miembros
  de tus comunidades y quienes comentaron tus publicaciones (los «me gusta» no cuentan: la app no
  revela quién dio «me gusta»). Cada consulta trae a
  lo sumo 50 candidatos.
- **A quién sigue alguien no se delata (SEC-17):** los intermediarios de «La siguen personas que
  sigues» son solo seguidos **mutuos** que participan en las sugerencias (`discoverable`); una persona
  cuenta solo si la siguen al menos 2 intermediarios distintos (`MIN_FOLLOW_INTERMEDIARIES`) y la
  razón nunca dice cuántos. Riesgo residual (cuentas títere de alguien a quien sigues de vuelta) y la
  corrección completa (consentimiento propio del intermediario) en ADR-030.
- **Exclusiones:** tú, cuentas editoriales, perfiles sin terminar, quienes ya sigues, quienes quitaste
  (`SuggestionDismissal`) y quienes desactivaron «Aparecer en sugerencias» (`Profile.discoverable`).
- **Puntuación (`scoreSuggestion`):** 3 por persona en común (desde 2, hasta 5), 4 + comentarios (hasta 3)
  y 1 por comunidad compartida (hasta 4). La razón visible es la señal que
  más aportó; los empates se resuelven por id.
- **Privacidad:** el ajuste vive en `/ajustes` y cada cambio se guarda en `UserConsent`
  (`DISCOVERABILITY`).
