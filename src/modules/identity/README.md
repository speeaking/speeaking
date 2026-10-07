# identity

Registro, sesión, perfiles, activación de vendedor (P6) y consentimientos versionados.
Fases: 1.3 (auth) y 1.4 (perfiles). Ver docs/architecture.md → Estructura.

## Seguridad (auditoría 2026-09-26)

- Turnstile en registro y solicitud de recuperación (`turnstile.ts`, `docs/turnstile.md`): widget
  explícito con renovación tras cada respuesta y Siteverify en la Server Action. Requiere las dos
  claves reales en producción, valida hostname y acción, y bloquea el envío si falla la verificación.

- Registro, inicio y cierre de sesión van SOLO por Server Actions (`actions.ts`) que llaman
  `auth.api.*`. El router HTTP `/api/auth/*` responde 404 a todo (SEC-09).
- Límite de intentos antes de Better Auth (`auth-limits.ts`, SEC-02): inicio de sesión 10 fallidos por
  IP y 5 por correo cada 15 min; registro 3 por IP por minuto y 5 por correo por hora. La IP sale de
  `server/client-ip.ts` (`TRUSTED_PROXY_HOPS`, SEC-07); sin IP confiable solo aplican las de correo.
- Nombres y usuarios que suplantan a la plataforma (`reserved-names.ts`, SEC-18) y contraseñas comunes
  (`common-passwords.ts`, SEC-30) se rechazan en los esquemas del servidor. `user-write.ts` aplica el
  mismo nombre y vacía `image` en toda escritura de Better Auth.
- Los formularios se validan ANTES de contar intentos, así que un formulario inválido no tiene límite:
  cada `.max()` que precede a una revisión cara (suplantación, contraseña común) lleva `abort: true`.
- Registro con un correo ya usado: mismo mensaje que cualquier alta fallida y el mismo hash (SEC-11).
  Sigue siendo distinguible (una cuenta nueva entra directo y la respuesta tarda distinto) hasta tener
  verificación de correo.
- «Tus sesiones» (`components/sessions-section.tsx`) lista dispositivos y cierra todas (SEC-10).
- Tope absoluto de sesión: `getSession` (`session.ts`) ignora y borra una sesión con más de 90 días
  de iniciada, aunque Better Auth la haya renovado (SEC-10).

## Mayoría de edad y finalidades secundarias (ADR-076)

- Solo personas de 18 años o más: el registro pide la casilla «Tengo 18 años o más» (sin marcar,
  `confirmAge` en `signUpSchema`) y guarda `AGE_18` en `UserConsent` con la versión de los términos
  y la fecha. Una cuenta de Google la marca en la bienvenida junto con términos y aviso
  (`hasLegalConsents` exige la edad además de términos o aviso; `completeOnboarding` registra las
  tres). Pendiente fuera de este módulo: pedirla antes de «Vender» y de «Pruébatelo» a las cuentas
  creadas antes de la casilla.
- «Personalizar mi feed» en la bienvenida es una finalidad secundaria: la casilla nunca viene
  marcada (LFPDPPP; Lineamientos Décimo).

## Volver a aceptar los documentos legales (`consent-refresh.ts`)

- Al registrarse se guardan `TERMS` y `PRIVACY_NOTICE` en `UserConsent` con la versión vigente
  (`LEGAL_VERSIONS` en `constants.ts`). Al subir una de esas versiones, quien aceptó una ANTERIOR (o
  cuya última fila es un retiro) ve un aviso que no bloquea (`components/consent-banner.tsx`) con
  solo los documentos que cambiaron. Las versiones con forma de fecha se comparan en orden: una
  versión posterior a la vigente (p. ej. tras regresar el código) no vuelve a preguntar.
- El aviso sale en la red social (`components/layout/app-shell.tsx`), en el Studio
  (`studio-shell.tsx`) y en `/admin` (`app/admin/layout.tsx`); solo con sesión, y si la consulta
  falla la página se muestra sin él.
- «Aceptar» (`acceptUpdatedLegalAction` en `privacy-actions.ts`, con límite por cuenta) manda las
  versiones que el aviso MOSTRÓ; `acceptPendingLegalDocuments` agrega filas nuevas (el historial solo
  crece) solo para lo pendiente con esa misma versión, con un candado por persona para que dos
  pestañas no repitan filas. Si una versión cambió mientras tanto, no la registra y el aviso se
  vuelve a pintar con la vigente.
- «Ocultar» lo esconde solo en esa pestaña (sessionStorage, con las versiones en la llave): vuelve a
  aparecer en otra pestaña o con una versión nueva, hasta que la persona acepte.
- Pruebas: `consent-refresh.test.ts`, `consent-refresh.db.test.ts`,
  `components/consent-banner.test.tsx` y `tests/e2e/consent.spec.ts`.

Pendiente: verificación de correo y restablecer contraseña (necesitan proveedor de correo); cambio de
contraseña con cierre de otras sesiones (no lo necesita, falta la acción y su lugar en Ajustes).

**Editar perfil (ADR-058).** `profile-edit-schema.ts` (puro: nombre, ciudad, presentación y qué hacer
con la foto y la portada: `keep`, `remove` o el id recién subido), `profile-actions.ts`
(`updateProfileAction`: solo imágenes propias, listas y no privadas; límite `profile`) y
`components/profile-edit-form.tsx` con `profile-image-picker.tsx`. Página: `/perfil/editar`.
