/**
 * Número de caso de un aviso de derechos (ADR-076): lo que ve quien avisa y quien subió el contenido
 * («DA-000123»). Es `RightsNotice.number`; el id interno (UUID) nunca sale en la interfaz pública.
 */
const MAX_CASE_NUMBER = 2_147_483_647; // `SERIAL` de PostgreSQL

export function formatCaseNumber(number: number): string {
  return `DA-${String(number).padStart(6, "0")}`;
}

/** «DA-000123», «da-123» o «DA123» → 123. Cualquier otra cosa → `null`. */
export function parseCaseNumber(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^\s*DA-?(\d{1,10})\s*$/i.exec(value);
  if (!match) return null;
  const number = Number(match[1]);
  return Number.isSafeInteger(number) && number > 0 && number <= MAX_CASE_NUMBER ? number : null;
}

const caseList = new Intl.ListFormat("es-MX", { type: "conjunction" });

/** «DA-000011», «DA-000011 y DA-000012», «DA-000011, DA-000012 y DA-000013». */
export function formatCaseList(numbers: readonly number[]): string {
  return caseList.format(numbers.map(formatCaseNumber));
}

/**
 * Lo que lee quien avisa al enviarlo (en pantalla y en el acuse): su número de caso o, si lo
 * señalado es de varias cuentas, uno por cada una (`owner-cases.ts`).
 */
export function caseNumbersSentence(numbers: readonly number[]): string {
  return numbers.length === 1
    ? `Tu número de caso es ${formatCaseNumber(numbers[0]!)}: guárdalo.`
    : `Lo que señalaste lo subieron ${numbers.length} cuentas distintas, así que abrimos un caso para cada una: ${formatCaseList(numbers)}. Guárdalos: cada cuenta puede responder por su lado.`;
}
