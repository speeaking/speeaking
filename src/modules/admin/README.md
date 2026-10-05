# admin

Área del equipo en `/admin` y rol ADMIN (ADR-035). Diseño completo en `docs/architecture.md` →
Administración y operación. Las secciones (Resumen, Decisiones, Experimentos, Moderación, IA) las
construye cada módulo (`ceo`, `trust`, `ai`); aquí vive lo común.

- `guard.ts`: `requireAdmin()` para páginas y layouts (a quien no es ADMIN, con o sin sesión, la
  página 404 de una ruta inexistente; sin redirigir a iniciar sesión) y `getAdminViewer()` para Server
  Actions y route handlers (`null` → error genérico). Cada página llama `requireAdmin()` aunque el
  layout ya lo haga: los layouts no se renderizan de nuevo al navegar entre páginas hermanas.
- `service.ts`: `assertAdmin(actorUserId)`, que vuelve a leer el rol de la base. Toda función de
  servicio del área recibe a quien actúa y lo llama primero. `getAdminOverview`: conteos de las
  colas para `/admin`.
- `grant.ts` + `scripts/make-admin.ts`: el único camino que cambia `Profile.role`. Se niega con una
  base que parezca de producción (`NODE_ENV=production` o un servidor remoto) salvo
  `--allow-production` y exige que la cuenta haya terminado la bienvenida.
- `nav.ts`, `components/`: navegación y estructura del área (solo se pintan dentro de
  `requireAdmin`).
- `user-service.ts`, `user-queries.ts`, `user-actions.ts`: directorio y administración de cuentas en
  `/admin/usuarios` (búsqueda, bloqueo de acceso, desbloqueo, eliminación y bitácora). Reglas y
  alcance en `docs/admin-users.md`; las cuentas ADMIN y la cuenta del operador están protegidas.

```
pnpm exec tsx scripts/make-admin.ts <correo>            # dar ADMIN
pnpm exec tsx scripts/make-admin.ts <correo> --revoke   # quitarlo
```

Reglas para una sección nueva: `requireAdmin()` en la página, `getAdminViewer()` + Zod +
`rateLimit` con `rateLimitKey("admin.<acción>", "user", admin.userId)` (llave
`admin.<acción>:user:<uuid>`; el scope no admite `:`) en cada acción, `assertAdmin` en el servicio,
`noindex` y la huella de quién actuó en la fila (`approvedById`, `resolvedById`, `reviewedById`).
`/admin` no va en `PROTECTED_PREFIXES` ni en `proxy.ts`: la redirección optimista delataría el área.
Un route handler que responda su propio 404 (como `/admin/moderacion/prueba/<id>`, en texto plano)
no es idéntico a la página 404: ocultar el área reduce el ruido, la barrera es el rol.

Pendiente: 2FA y reautenticación reciente para aprobar riesgo alto; bitácora de cambios de rol.
