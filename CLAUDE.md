@AGENTS.md

# speeaking — guía para agentes

- Lee `docs/product-principles.md` y `docs/architecture.md` antes de cambiar código.
- Reglas obligatorias: la IA redacta y el código calcula (P2); datos verificables estructurados (P4);
  DTOs explícitos (el costo del producto nunca llega al navegador); autorización en servicios;
  dinero en centavos + moneda.
- Dependencias con versión exacta; Prisma y `@prisma/client` siempre en la misma 7.x; TypeScript 5.9.
  pnpm bloquea versiones con menos de 24 h (`minimumReleaseAge`).
- Base de datos de desarrollo: `pnpm db:start` (clúster propio en `.data/postgres`, puerto 5434).
- Antes de dar algo por terminado: `pnpm check`, `pnpm build` y `pnpm test:e2e`.
- Textos de interfaz en español de México; URLs en español; código en inglés.
