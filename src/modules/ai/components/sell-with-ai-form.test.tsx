import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProposalState } from "../actions";
import { guardProposal } from "../output-guard";
import { withCodeNumbers } from "../proposal-numbers";
import { saleProposalSchema } from "../sale-proposal";

const generateProposalAction = vi.hoisted(() => vi.fn());
vi.mock("../actions", () => ({ generateProposalAction }));
vi.mock("@/modules/media/components/image-uploader", () => ({ ImageUploader: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { mockSaleProposal } = await import("../tasks/sale-proposal-mock");
const { SellWithAiForm } = await import("./sell-with-ai-form");

const request = {
  text: "Tengo 50 AirPods Pro 2. Me costaron $2,400 y quiero venderlos a $3,499.",
  productName: "AirPods Pro 2",
  quantity: 50,
  priceCents: 349_900,
  costCents: 240_000,
  city: null,
  hasPhoto: false,
};

function result(simulated: boolean): NonNullable<ProposalState["result"]> {
  const parsed = saleProposalSchema.parse(
    withCodeNumbers(mockSaleProposal(request) as object, request),
  );
  const { proposal, removed, findings } = guardProposal(parsed, request);
  return {
    responseId: "0199a000-0000-7000-8000-000000000001",
    proposal,
    quantity: request.quantity,
    guard: { removed, findings },
    simulated,
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

beforeEach(() => {
  vi.clearAllMocks();
  window.scrollTo = vi.fn() as never;
});

async function submit() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Crear mi propuesta" }));
}

describe("SellWithAiForm: la etiqueta sigue a la propuesta que llegó (ADR-038)", () => {
  it("abierto con la IA de verdad, una propuesta del simulador se marca como ejemplo", async () => {
    generateProposalAction.mockResolvedValue({ result: result(true) });
    render(<SellWithAiForm simulated={false} />);

    await submit();

    expect(await screen.findByText(/^Texto de ejemplo \(IA simulada\)/)).toBeInTheDocument();
    expect(screen.queryByText(/Propuesta de IA/)).not.toBeInTheDocument();
  });

  it("abierto en el piloto, una propuesta que escribió un modelo se marca como de la IA", async () => {
    generateProposalAction.mockResolvedValue({ result: result(false) });
    render(<SellWithAiForm simulated />);

    await submit();

    expect(await screen.findByText(/Propuesta de IA/)).toBeInTheDocument();
    expect(screen.queryByText(/Texto de ejemplo/)).not.toBeInTheDocument();
  });

  it("un error de IA no disponible se muestra con la salida a mano", async () => {
    generateProposalAction.mockResolvedValue({
      error: "Por ahora publica tu producto a mano: la ayuda para redactar no está disponible.",
    });
    render(<SellWithAiForm />);

    await submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Por ahora publica tu producto a mano",
    );
  });

  it("el distintivo es neutro (sin lima) y en el piloto dice que la IA está simulada", () => {
    const { unmount } = render(<SellWithAiForm simulated />);
    const pilot = screen.getByText("Sube y vende · piloto");
    expect(pilot).not.toHaveClass("bg-ai");
    expect(screen.getByText(/Piloto: la IA está simulada/)).toBeInTheDocument();
    unmount();

    render(<SellWithAiForm />);
    expect(screen.getByText("Sube y vende")).not.toHaveClass("bg-ai");
    expect(screen.queryByText(/Piloto/)).not.toBeInTheDocument();
  });
});
