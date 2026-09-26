import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DecisionDTO } from "../queries";
import { DecisionCard } from "./decision-card";

vi.mock("../actions", () => ({
  approveDecisionAction: vi.fn(),
  rejectDecisionAction: vi.fn(),
  revertDecisionAction: vi.fn(),
}));

function decision(overrides: Partial<DecisionDTO> = {}): DecisionDTO {
  return {
    id: "0199a000-0000-7000-8000-0000000000d1",
    kind: "analyst.engagement_drop",
    title: "Dar más peso a lo reciente",
    hypothesis: "La interacción bajó.",
    status: "PROPOSED",
    statusLabel: "Propuesta",
    risk: "LOW",
    riskLabel: "Riesgo bajo",
    actorLabel: "Analista (IA CEO)",
    autoApplied: false,
    reason: null,
    expectedImpact: null,
    setting: null,
    narrative: null,
    guardrails: null,
    impact: null,
    experiment: null,
    approvedBy: null,
    trail: [],
    createdAt: "26 sept 2026, 10:30",
    proposalOnly: false,
    handledIn: null,
    approveLabel: "Aprobar y aplicar",
    actions: ["approve", "reject"],
    ...overrides,
  };
}

describe("DecisionCard", () => {
  it("una propuesta del motor se aprueba o rechaza aquí", () => {
    render(<DecisionCard decision={decision()} />);
    expect(screen.getByRole("button", { name: "Aprobar y aplicar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rechazar" })).toBeInTheDocument();
  });

  it("`ai.routing`: «Se aplica en /admin/ia» con liga, nunca como cambio aprobable", () => {
    render(
      <DecisionCard
        decision={decision({
          kind: "ai.routing",
          title: "Proponer modelo para «Kit de anuncios»: Qwen3.5 9B",
          risk: "MEDIUM",
          riskLabel: "Riesgo medio",
          handledIn: { label: "Se aplica en /admin/ia", href: "/admin/ia" },
          approveLabel: null,
          actions: [],
        })}
      />,
    );
    expect(screen.getByText("Se aplica en /admin/ia")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "/admin/ia" })).toHaveAttribute("href", "/admin/ia");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText("Solo propuesta")).not.toBeInTheDocument();
  });

  it("una vigilancia cerrada sin datos dice «sin evidencia de daño», no «seguro»", () => {
    render(
      <DecisionCard
        decision={decision({
          status: "APPLIED",
          statusLabel: "Aplicada",
          actions: [],
          approveLabel: null,
          guardrails: {
            status: "pending",
            conclusion: "no_evidence",
            checks: [
              {
                summary: "Reportes por mil impresiones: sin datos suficientes.",
                verdict: "no_data",
              },
            ],
          },
        })}
      />,
    );
    expect(
      screen.getByText(/vigilancia cerrada, sin evidencia de daño con esta muestra/),
    ).toBeInTheDocument();
  });
});
