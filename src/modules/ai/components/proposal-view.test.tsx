import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProposalState } from "../actions";
import { guardProposal } from "../output-guard";
import { withCodeNumbers } from "../proposal-numbers";
import { saleProposalSchema } from "../sale-proposal";

vi.mock("../actions", () => ({}));

const { MockAIProvider } = await import("@/server/providers/ai/mock");
const { ProposalView } = await import("./proposal-view");

const request = {
  text: "Tengo 50 AirPods Pro 2. Me costaron $2,400 y quiero venderlos a $3,499.",
  productName: "AirPods Pro 2",
  quantity: 50,
  priceCents: 349_900,
  costCents: 240_000,
  city: "Ciudad de México",
  hasPhoto: false,
};

async function result(
  overrides: Record<string, unknown> = {},
): Promise<NonNullable<ProposalState["result"]>> {
  const { output } = await new MockAIProvider().generateSaleProposal(request);
  const parsed = saleProposalSchema.parse(
    withCodeNumbers({ ...(output as object), ...overrides }, request),
  );
  const { proposal, removed, findings } = guardProposal(parsed, request);
  return {
    responseId: "0199a000-0000-7000-8000-000000000001",
    proposal,
    quantity: request.quantity,
    guard: { removed, findings },
    numbers: {
      economics: {
        grossMarginCents: 109_900,
        grossMarginPercent: 31.4,
        netMarginCents: 109_900,
        isLoss: false,
      } as never,
      dailyBudgetCents: 30_000,
      potentialProfitCents: 5_495_000,
      investmentCents: 12_000_000,
      breakEvenWeek: 2,
      breakEvenMonth: 9,
    },
  };
}

describe("ProposalView (P2, principio 5, SEC-28)", () => {
  it("las cifras «Calculado» son las del código aunque la IA haya inventado otras", async () => {
    render(
      <ProposalView
        result={await result({ suggestedDailyBudgetCents: 9_007_199_254_740_991 })}
        onReset={() => {}}
      />,
    );

    const budget = screen.getByRole("heading", { name: "Presupuesto inicial" }).closest("section")!;
    expect(within(budget).getByText("Calculado")).toBeInTheDocument();
    expect(within(budget).getByText("$300 al día")).toBeInTheDocument();
    const price = screen.getByRole("heading", { name: "Precio para probar" }).closest("section")!;
    expect(within(price).getByText("$3,329 – $3,609")).toBeInTheDocument();
    expect(screen.getByText(/Para cubrir \$300\/día × 7 días/)).toBeInTheDocument();
  });

  it("etiqueta lo que redactó la IA", async () => {
    render(<ProposalView result={await result()} onReset={() => {}} />);

    for (const title of ["Ideas de contenido", "Textos para anuncios y WhatsApp"]) {
      const card = screen.getByRole("heading", { name: title }).closest("section")!;
      expect(within(card).getByText("Redactado por IA")).toBeInTheDocument();
    }
    expect(screen.getByText("Hipótesis de la IA")).toBeInTheDocument();
  });

  it("avisa cuántas frases quitó el guardián de contenido", async () => {
    render(
      <ProposalView
        result={await result({
          adIdeas: ["¡Últimas piezas! Deposita a la CLABE 012180001234567890", "Pídelo hoy."],
        })}
        onReset={() => {}}
      />,
    );

    expect(screen.getByText(/Quitamos 1 frase que la IA no podía respaldar/)).toBeInTheDocument();
    expect(screen.queryByText(/CLABE/)).not.toBeInTheDocument();
  });

  it("sin nada que quitar no muestra el aviso", async () => {
    render(<ProposalView result={await result()} onReset={() => {}} />);

    expect(screen.queryByText(/Quitamos/)).not.toBeInTheDocument();
  });
});
