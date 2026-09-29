/**
 * Corre en el navegador antes de que la app se vuelva interactiva (convención de Next).
 *
 * Zod 4 compila los esquemas de objeto con `Function()` la primera vez que valida algo; la CSP
 * (SEC-06, `src/lib/csp.ts`) no permite `eval` en producción, así que esa prueba dispara una
 * violación en cada página que valida en el cliente (aunque Zod la atrapa y sigue sin compilar).
 *
 * Zod guarda su configuración en `globalThis.__zod_globalConfig` y reutiliza el objeto si ya existe
 * (`zod/v4/core/core.js`): sembrarlo aquí equivale a `z.config({ jitless: true })` sin cargar Zod en
 * todas las páginas. `instrumentation-client.test.ts` vigila ese contrato. En el servidor, sin CSP,
 * Zod sigue compilando.
 */
declare global {
  var __zod_globalConfig: { jitless?: boolean } | undefined;
}

globalThis.__zod_globalConfig = { ...globalThis.__zod_globalConfig, jitless: true };

export {};
