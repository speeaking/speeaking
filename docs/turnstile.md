# Protección de formularios con Cloudflare Turnstile

Turnstile protege el registro por correo y la solicitud del enlace de recuperación de contraseña.
La web sigue alojada en Vercel y el tráfico llega directamente allí. No requiere cambiar DNS,
activar el proxy de Cloudflare ni configurar pre-clearance.

## Configurar producción

1. Cloudflare → Turnstile → Add widget. Nombre: **speeaking — cuentas**.
2. Hostnames permitidos: `www.speeaking.com` y `speeaking.com`. Modo **Managed** y pre-clearance
   desactivado. No autorizar dominios ajenos ni todos los previews de Vercel.
3. Guardar las dos claves en Environment Variables del proyecto **speeaking** de Vercel, destino
   **Production**:
   - `TURNSTILE_SITE_KEY`: clave pública del widget.
   - `TURNSTILE_SECRET_KEY`: clave secreta, marcar como Sensitive.
4. Desplegar la versión con esta integración. No poner claves en Git ni en mensajes o capturas.

El esquema exige ambas claves o ninguna y rechaza las claves de prueba en producción. Ambas
ausentes desactivan el widget para permitir preparar entornos antes de su activación. La activación
de producción queda pendiente hasta que se configuren y se desplieguen las claves reales.

## Implementación

- `modules/identity/turnstile.ts`: Siteverify exclusivamente desde el servidor, timeout de 8 segundos,
  tokens de hasta 2048 caracteres, rechazo si el token no es válido o no coincide la acción
  (`signup` / `password-recovery`) y el hostname de `APP_URL`.
- Se exige la verificación antes de crear una cuenta o solicitar el correo. Un error de red,
  un token caducado o reutilizado y una respuesta inválida bloquean ese envío.
- La IP enviada a Siteverify sale de la política existente de proxies de confianza; no se acepta
  una cabecera `CF-Connecting-IP` enviada por el cliente.
- Los límites de intentos siguen aplicándose antes de llamar a Siteverify. El router HTTP de auth
  conserva cerrados los endpoints alternativos de registro y recuperación.
- El widget tiene render explícito, tema claro/oscuro, ancho flexible, español y reintento manual.
  Cada respuesta del formulario renueva el widget, porque los tokens son de un solo uso.
- La clave pública se pasa como prop desde el servidor. La secreta nunca se incluye en el cliente.
- CSP autoriza solo `https://challenges.cloudflare.com`, usa el nonce existente y mantiene
  `strict-dynamic`; no se agrega `unsafe-inline` a los scripts.
- No se registra el contenido de los tokens, claves, correos ni IP en el verificador.

## Desarrollo y operación

Las variables se pueden dejar ausentes en local. Para desarrollar el widget, usar exclusivamente
las claves de prueba oficiales en un entorno de desarrollo y configurar `APP_URL` con su hostname
real. Nunca desplegar esas claves a producción.

Cloudflare: comprobar analytics del widget para ver las validaciones de `signup` y
`password-recovery`. Vercel: conservar el tráfico directo para mantener la IP y la visibilidad del
firewall; cualquier ajuste de reglas debe responder al tráfico observado.

Referencias:

- https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- https://developers.cloudflare.com/turnstile/reference/content-security-policy/
- https://developers.cloudflare.com/turnstile/troubleshooting/testing/
