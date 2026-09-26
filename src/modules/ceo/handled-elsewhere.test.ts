import { describe, expect, it } from "vitest";
import { duplicateProposalIds, handledElsewhere, proposalKey } from "./handled-elsewhere";

const routing = (tasks: Record<string, { provider: string; model: string }>) => ({
  version: 1,
  tasks,
});
const qwen = { provider: "openai_compatible", model: "qwen/qwen3.5-9b" };
const haiku = { provider: "openai_compatible", model: "anthropic/claude-haiku-4.5" };

function proposal(id: string, previous: unknown, next: unknown, title = "Proponer modelo") {
  return { id, settingKey: "ai.routing", title, previousValue: previous, newValue: next };
}

describe("decisiones que se deciden en otra pantalla", () => {
  it("`ai.routing` se aplica en /admin/ia; lo del catálogo del motor, aquí", () => {
    expect(handledElsewhere("ai.routing")).toEqual({
      label: "Se aplica en /admin/ia",
      href: "/admin/ia",
    });
    expect(handledElsewhere("feed.policy.authorWindow")).toBeNull();
    expect(handledElsewhere(null)).toBeNull();
    // Solo llaves propias: `toString` no es un ajuste.
    expect(handledElsewhere("toString")).toBeNull();
  });

  it("la misma ruta propuesta dos veces es la misma propuesta aunque cambien otras rutas", () => {
    const first = proposal("a", routing({}), routing({ ad_copy: qwen }));
    // Mientras tanto alguien cambió otra tarea: el valor completo es distinto, la propuesta no.
    const second = proposal(
      "b",
      routing({ sale_proposal: haiku }),
      routing({ sale_proposal: haiku, ad_copy: qwen }),
    );
    expect(proposalKey(first)).toBe(proposalKey(second));
    expect(proposalKey(proposal("c", routing({}), routing({ ad_copy: haiku })))).not.toBe(
      proposalKey(first),
    );
  });

  it("de las pendientes repetidas se conserva la más reciente (vienen de la más nueva a la más vieja)", () => {
    const rows = [
      proposal("newest", routing({}), routing({ ad_copy: qwen })),
      proposal("other", routing({}), routing({ ad_copy: haiku })),
      proposal("older", routing({}), routing({ ad_copy: qwen })),
      proposal("oldest", routing({}), routing({ ad_copy: qwen })),
    ];
    expect(duplicateProposalIds(rows)).toEqual(["older", "oldest"]);
  });

  it("con valores de otra forma compara por título", () => {
    const rows = [
      proposal("x", null, "raro", "Proponer modelo para «Kit de anuncios»: Qwen"),
      proposal("y", null, "raro", "Proponer modelo para «Kit de anuncios»: Qwen"),
    ];
    expect(duplicateProposalIds(rows)).toEqual(["y"]);
  });
});
