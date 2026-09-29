# Estreno

Red social de entretenimiento y descubrimiento donde el comercio aparece de forma natural. Lema:
«Descubre, pruébatelo, estrena». Para quien compra: «Dime qué necesitas y te ayudo a encontrarlo,
combinarlo y verlo puesto». Para quien vende: «Sube una foto, pon tu precio y te ayudamos a
presentarlo y a encontrar compradores».

- **Mercado inicial:** México (MXN), piloto en la Ciudad de México.
- **Estado:** MVP 0.1 — Sprint 1 completo, núcleo de compra del Sprint 2 y primera versión de la
  plataforma autónoma (IA CEO, moderación e IA por tarea). Ver [docs/roadmap.md](docs/roadmap.md).

## Qué puedes hacer hoy

- Registrarte y responder un onboarding de 3 pasos (objetivos, comunidades, marcas, qué buscas).
- Ver el feed "Para ti" con 12 comunidades y contenido editorial; dar like, comentar, guardar, seguir,
  publicar con fotos y buscar en `/buscar`.
- Vender: "¿Qué quieres vender hoy?" → propuesta de IA con tus números calculados por código →
  producto prellenado → publicado y compartible, con un kit de anuncios para WhatsApp, Facebook e
  Instagram.
- Comprar: carrito, checkout con una orden por vendedor y pago simulado; el vendedor ve el pedido y su
  beneficio en el Studio.
- Confianza: reportar productos; los productos de marca se revisan por riesgo de imitación (nunca se
  acusa ni se certifica) y quien vende puede enviar un comprobante.
- Equipo (`/admin`, solo rol ADMIN): Centro de decisiones del motor de automejora, experimentos,
  moderación y configuración de la IA.

La IA es **simulada** por omisión (textos de plantilla, sin costo). En producción el arranque falla
con la IA o el pago simulados salvo que se permitan de forma explícita para un piloto cerrado
(`ALLOW_SIMULATED_AI`, `ALLOW_SIMULATED_PAYMENTS`). Los pagos quedan fuera del alcance de esta etapa.

## Inicio rápido

```bash
pnpm install
pnpm db:setup && pnpm db:migrate && pnpm db:seed
pnpm dev
```

Verificación completa: `pnpm check`, `pnpm build` y `pnpm test:e2e`. Operación diaria:
`pnpm ops:daily` (en producción, `/api/cron/daily`). Detalles en
[docs/development.md](docs/development.md).

## Documentación

Empieza por [docs/README.md](docs/README.md): principios de producto, MVP 0.1, arquitectura (incluida
la operación), modelo de datos, decisiones y guía de desarrollo.
