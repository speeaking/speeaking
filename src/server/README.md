# server

Infraestructura solo de servidor (todo archivo importa `server-only`):

- `env.ts` — variables de entorno validadas con Zod (los errores nunca imprimen valores).
- `db.ts` — cliente de Prisma (fase 1.2).
- `auth.ts` — Better Auth (fase 1.3).
- `providers/<tipo>/` — interfaz + adaptadores (simulado y reales) de IA, pagos, almacenamiento y
  email; `index.ts` elige la implementación por variable de entorno (ADR-005).
