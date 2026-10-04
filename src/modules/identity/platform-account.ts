/** Cuenta oficial que publica avisos para toda la comunidad; el rol se comprueba en el servidor. */
export const PLATFORM_ADMIN_EMAIL = "speeaking@gmail.com";

export function isPlatformAdministrator(email: string, role: string | undefined): boolean {
  return role === "ADMIN" && email.toLowerCase() === PLATFORM_ADMIN_EMAIL;
}
