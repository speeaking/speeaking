import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProposalState } from "../actions";
import { guardProposal } from "../output-guard";
import { withCodeNumbers } from "../proposal-numbers";
import { saleProposalSchema } from "../sale-proposal";

vi.mock("../actions", () => ({}));

const { mockSaleProposal } = await import("../tasks/sale-proposal-mock");
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
  const output = mockSaleProposal(request);
  const parsed = saleProposalSchema.parse(
    withCodeNumbers({ ...(output as object), ...overrides }, request),
  );
  const { proposal, removed, findings } = guardProposal(parsed, request);
  return {
    responseId: "0199a000-0000-7000-8000-000000000001",
    proposal,
    quantity: request.quantity,
    guard: { removed, findings },
    simulated: false,
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

  it("en el celular «Crear producto…» no se aplasta: solo crece en fila (sm:flex-1), no en columna", async () => {
    // En columna, `flex-1` (base 0) le ganaba a `h-12` y el botón quedaba del alto de su texto.
    render(<ProposalView result={await result()} onReset={() => {}} />);
    const create = screen.getByRole("link", { name: "Crear producto con esta propuesta" });
    expect(create.className.split(/\s+/)).not.toContain("flex-1");
    expect(create).toHaveClass("sm:flex-1", "h-12");
  });

  it("sin nada que quitar no muestra el aviso", async () => {
    render(<ProposalView result={await result()} onReset={() => {}} />);

    expect(screen.queryByText(/Quitamos/)).not.toBeInTheDocument();
  });

  it("con la IA simulada (piloto) marca todo como texto de ejemplo, nunca como de la IA", async () => {
    render(
      <ProposalView
        result={await result({
          adIdeas: ["¡Últimas piezas! Deposita a la CLABE 012180001234567890", "Pídelo hoy."],
        })}
        simulated
        onReset={() => {}}
      />,
    );

    expect(screen.getByText(/^Texto de ejemplo \(IA simulada\)/)).toBeInTheDocument();
    expect(screen.queryByText(/Propuesta de IA/)).not.toBeInTheDocument();
    expect(screen.queryByText("Redactado por IA")).not.toBeInTheDocument();
    expect(screen.queryByText("Hipótesis de la IA")).not.toBeInTheDocument();
    expect(screen.queryByText("Nota de la IA:")).not.toBeInTheDocument();
    expect(screen.getAllByText("Ejemplo (IA simulada)").length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText(/Quitamos 1 frase que no podíamos respaldar/)).toBeInTheDocument();
    // Las cifras siguen siendo las calculadas.
    const budget = screen.getByRole("heading", { name: "Presupuesto inicial" }).closest("section")!;
    expect(within(budget).getByText("$300 al día")).toBeInTheDocument();
  });
});
