/**
 * Un caso por cada cuenta que subió lo señalado (ADR-076). Quien avisa puede pegar direcciones de
 * varias cuentas en un solo aviso, pero la ley va contenido por contenido: cada quien recibe el
 * aviso, puede mandar su contra-aviso y lo suyo se restaura (o no) según SU contra-aviso
 * (RLFDA art. 37 Nonies: «el contenido objeto del contra-aviso»). Con un caso por cuenta, restaurar
 * lo de quien respondió nunca vuelve a mostrar lo de quien no respondió, y cada falta es de quien
 * corresponde. Código puro: el servicio crea un `RightsNotice` por cada caso.
 */
type Target = { targetType: string; targetId: string; ownerId: string | null };

/** Un renglón del aviso tal como se escribió y lo de speeaking a lo que apunta (puede ser nada). */
export type ResolvedLine<T extends Target> = { raw: string; targets: readonly T[] };

export type OwnerCase<T extends Target> = { urls: string[]; targets: T[] };

/**
 * Agrupa por cuenta, en el orden en que aparecen. Cada caso lleva las direcciones que apuntan a lo
 * suyo; las que no apuntan a nada de speeaking acompañan al primero. Con una sola cuenta (o
 * ninguna) queda un solo caso con todas las direcciones, como se escribieron.
 */
export function splitByOwner<T extends Target>(lines: readonly ResolvedLine<T>[]): OwnerCase<T>[] {
  const owners: (string | null)[] = [];
  for (const line of lines) {
    for (const target of line.targets) {
      if (!owners.includes(target.ownerId)) owners.push(target.ownerId);
    }
  }
  if (owners.length <= 1) {
    return [
      { urls: lines.map((line) => line.raw), targets: unique(lines.flatMap((l) => l.targets)) },
    ];
  }
  return owners.map((owner, index) => {
    const own = lines.filter((line) =>
      index === 0
        ? line.targets.length === 0 || line.targets.some((t) => t.ownerId === owner)
        : line.targets.some((t) => t.ownerId === owner),
    );
    return {
      urls: own.map((line) => line.raw),
      targets: unique(own.flatMap((line) => line.targets.filter((t) => t.ownerId === owner))),
    };
  });
}

/** Una fila por contenido aunque varias direcciones lo señalen (la primera manda). */
function unique<T extends Target>(targets: readonly T[]): T[] {
  const seen = new Set<string>();
  return targets.filter((target) => {
    const key = `${target.targetType}:${target.targetId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
