/**
 * PENDIENTE (fundador, antes del lanzamiento; ADR-076): quién opera speeaking y sus canales. La ley
 * los pide (LFPC art. 76 BIS fr. III; LFPDPPP art. 15 fr. I; RLFDA art. 37 Sexies) y no se inventan:
 * se llenan con la razón social, el RFC, el domicilio y los buzones reales, y se suben
 * LEGAL_VERSIONS.terms y LEGAL_VERSIONS.privacyNotice. Mientras tanto, el formulario de
 * /derechos-de-autor es el canal de avisos que siempre funciona.
 */
export const OPERATOR = {
  legalName: "[Nombre completo o razón social de quien opera speeaking — pendiente]",
  rfc: "[RFC — pendiente]",
  domicile: "[Domicilio completo en México para oír y recibir notificaciones — pendiente]",
  phone: "[Teléfono de atención — pendiente]",
  hours: "[Días y horario de atención — pendiente]",
  supportEmail: "[Correo de soporte — pendiente]",
  privacyEmail: "[Correo de privacidad — pendiente]",
  dataProtectionContact: "[Persona o área responsable de los datos personales — pendiente]",
  rightsEmail: "[Correo para avisos de derechos — pendiente]",
  rightsAltEmail: "[Correo alterno para avisos de derechos — pendiente]",
  legalEmail: "[Correo para autoridades y asuntos legales — pendiente]",
} as const;
