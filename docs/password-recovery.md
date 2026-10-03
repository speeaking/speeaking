# Recuperación de contraseña y acceso con Google

## Activar los correos con Resend

1. Crea una cuenta en [Resend](https://resend.com/) y agrega tu dominio en **Domains**.
2. Copia los registros DNS que Resend indique al panel de tu dominio y espera a que aparezca
   **Verified**. Puedes usar un subdominio dedicado al correo.
3. Crea una API key con permiso de envío, restringida a ese dominio. Guárdala directamente en
   Vercel → proyecto → Settings → Environment Variables, en **Production**:

   | Variable         | Valor                                                         |
   | ---------------- | ------------------------------------------------------------- |
   | `RESEND_API_KEY` | La clave de Resend (secreta; nunca en Git ni en el navegador) |
   | `EMAIL_FROM`     | `cuentas@tu-dominio.com`, perteneciente al dominio verificado |
   | `APP_URL`        | El origen HTTPS real y canónico del sitio, sin rutas          |

4. Actualiza el aviso de privacidad para identificar al proveedor de correo antes de activar su uso.
5. Haz **Redeploy** para aplicar las variables. Para desarrollo, pon las dos primeras en `.env.local`;
   deja `APP_URL=http://localhost:3000` y reinicia el servidor.

No hace falta contratar un buzón para el remitente: sí tener control del dominio y verificarlo.
El dominio de pruebas `resend.dev` solo permite enviar al propietario de la cuenta y no sirve
para recuperar contraseñas de todos los usuarios.

Guías oficiales: [Next.js](https://resend.com/docs/send-with-nextjs),
[verificar un dominio](https://resend.com/docs/dashboard/domains/introduction).

## Funcionamiento

- `/entrar` tiene «¿Olvidaste tu contraseña?», que abre `/recuperar-contrasena`.
- El correo contiene un enlace directo a `/restablecer-contrasena`. El token caduca en una hora,
  se consume de forma atómica y solo funciona una vez. Las rutas HTTP de contraseña de Better Auth
  permanecen cerradas: se usan acciones del servidor con validación y límites por IP, correo y token.
- El formulario de solicitud responde igual para correos registrados y no registrados.
- El envío usa `after` de Next.js: continúa después de la respuesta, con la función de Vercel activa
  hasta terminar. El tiempo del proveedor de correo no revela si la cuenta existe. Los fallos se
  registran sin destinatarios ni tokens.
- Al cambiar la contraseña se invalidan todas las sesiones y el correo queda verificado por haber
  abierto el enlace enviado a su buzón. La persona vuelve a entrar con la nueva contraseña.
- Sin `RESEND_API_KEY` y `EMAIL_FROM` el envío se informa como no disponible; no se simulan correos.

## Google

En Google Auth Platform → Clients, el cliente web necesita estas URI de redirección exactas:

- Desarrollo: `http://localhost:3000/api/auth/callback/google`.
- Producción: `<APP_URL>/api/auth/callback/google`, con el dominio canónico del sitio.

La aplicación necesita `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en el entorno correspondiente.
La CSP autoriza la redirección del formulario únicamente a `https://accounts.google.com` cuando
el proveedor está configurado.

Si el correo ya tiene una cuenta con contraseña y aún no está verificado, Better Auth rechaza
el enlace automático de Google. La pantalla explica cómo recuperar la contraseña para acreditar
el correo y volver a usar Google; la comprobación de propiedad no se desactiva.

## Eliminar publicaciones

Cada tarjeta propia, incluida una colaboración que etiqueta un producto de otra tienda, ofrece
`⋯` → **Eliminar publicación**, con confirmación. La acción exige que la sesión sea del autor en
el filtro de la misma escritura. La publicación queda en estado `REMOVED` y sale de todas las
consultas públicas. El producto original permanece en la tienda.
