# VendeIA (nombre provisional)

Red social de entretenimiento y descubrimiento donde el comercio aparece de forma natural y la IA
ayuda a vender: "Tú tienes el producto. La IA encuentra cómo venderlo."

- **Mercado inicial:** México (MXN).
- **Estado:** MVP 0.1 — Sprint 1 completo y núcleo de compra del Sprint 2. Ver
  [docs/roadmap.md](docs/roadmap.md).

## Qué puedes hacer hoy

- Registrarte y responder un onboarding de 3 pasos (objetivos, comunidades, marcas, qué buscas).
- Ver el feed "Para ti" con 12 comunidades y contenido editorial; dar like, comentar, guardar, seguir,
  publicar con fotos.
- Vender: "¿Qué quieres vender hoy?" → propuesta de IA (simulada) con tus números calculados → producto
  prellenado → publicado y compartible.
- Comprar: carrito, checkout con una orden por vendedor y pago simulado; el vendedor ve el pedido y su
  beneficio en el Studio.

## Inicio rápido

```bash
pnpm install
pnpm db:setup && pnpm db:migrate && pnpm db:seed
pnpm dev
```

Verificación completa: `pnpm check`, `pnpm build` y `pnpm test:e2e`. Detalles en
[docs/development.md](docs/development.md).

## Documentación

Empieza por [docs/README.md](docs/README.md): principios de producto, MVP 0.1, arquitectura, modelo de
datos, decisiones y guía de desarrollo.
