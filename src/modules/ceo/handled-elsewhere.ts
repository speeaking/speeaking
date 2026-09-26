import { AI_ROUTING_KEY } from "@/modules/ai/routing";

/**
 * Decisiones que registran otros módulos en `PlatformDecision` y que se deciden en OTRA pantalla.
 * En la cola del motor se muestran solo como aviso con liga: nunca se aprueban, rechazan ni
 * revierten desde aquí (la acción de otra pantalla valida cosas que esta no conoce, p. ej. la
 * evaluación aprobada del modelo en `ai.routing`).
 */
export type HandledElsewhere = { label: string; href: "/admin/ia" };

const HANDLED_ELSEWHERE: Readonly<Record<string, HandledElsewhere>> = {
  [AI_ROUTING_KEY]: { label: "Se aplica en /admin/ia", href: "/admin/ia" },
};

export function handledElsewhere(settingKey: string | null | undefined): HandledElsewhere | null {
  return settingKey && Object.hasOwn(HANDLED_ELSEWHERE, settingKey)
    ? HANDLED_ELSEWHERE[settingKey]!
    : null;
}

/** Ajustes que se deciden en otra pantalla (para excluir duplicados en la cola). */
export const HANDLED_ELSEWHERE_KEYS: readonly string[] = Object.keys(HANDLED_ELSEWHERE);

/**
 * Llave de lo que PROPONE una decisión de `ai.routing`: las tareas que cambian y su nueva ruta
 * (proveedor|modelo). Dos propuestas con la misma llave son la misma propuesta aunque el resto de
 * las rutas haya cambiado entre una y otra. Si los valores no tienen la forma esperada, el título.
 */
export function proposalKey(row: {
  settingKey: string | null;
  title: string;
  previousValue: unknown;
  newValue: unknown;
}): string {
  const before = routesOf(row.previousValue);
  const after = routesOf(row.newValue);
  if (!after) return `${row.settingKey}|${row.title}`;
  const tasks = new Set([...Object.keys(before ?? {}), ...Object.keys(after)]);
  const changed = [...tasks]
    .filter((task) => (before?.[task] ?? "default") !== (after[task] ?? "default"))
    .sort()
    .map((task) => `${task}=${after[task] ?? "default"}`);
  return `${row.settingKey}|${changed.join(",") || row.title}`;
}

function routesOf(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const tasks = (value as { tasks?: unknown }).tasks;
  if (!tasks || typeof tasks !== "object" || Array.isArray(tasks)) return null;
  const routes: Record<string, string> = {};
  for (const [task, route] of Object.entries(tasks as Record<string, unknown>)) {
    if (!route || typeof route !== "object") continue;
    const { provider, model } = route as { provider?: unknown; model?: unknown };
    if (typeof provider === "string" && typeof model === "string") {
      routes[task] = `${provider}|${model}`;
    }
  }
  return routes;
}

/**
 * De varias propuestas pendientes iguales (misma `proposalKey`), las que sobran: se conserva la más
 * reciente. `rows` deben venir de la más reciente a la más vieja.
 */
export function duplicateProposalIds(
  rows: readonly {
    id: string;
    settingKey: string | null;
    title: string;
    previousValue: unknown;
    newValue: unknown;
  }[],
): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const row of rows) {
    const key = proposalKey(row);
    if (seen.has(key)) duplicates.push(row.id);
    else seen.add(key);
  }
  return duplicates;
}
