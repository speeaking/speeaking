# Administración de usuarios

Entra con una cuenta ADMIN y abre **Administración → Usuarios** (`/admin/usuarios`).
La lista incluye cuentas con el perfil pendiente y cuentas editoriales identificadas.

- Búsqueda por nombre, usuario o correo, filtros por estado y tipo, y páginas de 20 cuentas.
- Nombre, correo, alta, rol y conteos de publicaciones, compras, productos y ventas. No muestra
  contraseñas, tokens, conversaciones, direcciones ni datos de pago.
- **Bloquear:** requiere motivo y confirmación. Cierra las sesiones y rechaza sesiones nuevas de
  correo o Google. El bloqueo es de acceso; el contenido que necesita ocultarse se atiende desde
  Moderación. Una persona bloqueada puede seguir leyendo el contenido público sin sesión.
- **Desbloquear:** requiere motivo y confirmación; permite entrar de nuevo, sin recuperar sesiones.
- **Eliminar:** exige motivo, casilla y escribir exactamente el correo de la cuenta. Reutiliza
  `identity/account-deletion.ts`: borra la cuenta o la anonimiza si sus pedidos necesitan conservarse.
  No cancela ni reembolsa pedidos. Las comunidades propias buscan un sucesor con las reglas del
  borrado de cuenta. Las cuentas anonimizadas se muestran como eliminadas y ya no admiten acciones.
- Tu propia cuenta, las cuentas con rol ADMIN y `speeaking@gmail.com` están protegidas de las
  acciones de esta interfaz. Cambiar roles de plataforma sigue siendo tarea de `make-admin.ts`.
- Las acciones aparecen en el historial y se registran como `moderation.account.*` en
  `PlatformDecision`, con el motivo, administrador y UUID de la cuenta; no duplica su correo o foto.

## Permisos y almacenamiento

Página y metadatos comprueban ADMIN; las acciones repiten la autorización, validación Zod y límite
de frecuencia (30 intentos por administrador y hora). El servicio vuelve a comprobar el rol y,
dentro de la transacción, bloquea las filas de las cuentas y perfiles en orden, comprueba la cuenta
protegida y guarda la bitácora junto al cambio. Si el borrado falla, tampoco confirma la bitácora.

`AccountRestriction` vive fuera de `User`, separado del esquema de escritura de Better Auth.
El hook de creación de sesión rechaza cuentas bloqueadas. `getSession` consulta la restricción de
la base en cada petición y descarta sesiones cacheadas o creadas en carrera con el bloqueo.

La migración `20261005040000_admin_account_restrictions` solo agrega la tabla, sus índices y
relaciones. Vercel la aplica después de compilar el despliegue de producción, con el recorrido
habitual de `scripts/vercel-build.mts`. No modifica datos de usuarios existentes.
