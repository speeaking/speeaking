import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdKitView } from "../ad-kit/service";

const actions = vi.hoisted(() => ({
  generateAdKitAction: vi.fn(async () => ({})),
  recordAdKitCopyAction: vi.fn(async () => {}),
}));
vi.mock("../ad-kit/actions", () => actions);
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { AdKitPanel } = await import("./ad-kit-panel");

/** El panel con un modelo de verdad (el caso de siempre). */
function AdKit({ initial }: { initial: AdKitView }) {
  return <AdKitPanel initial={initial} availability="real" />;
}

const PRODUCT_ID = "0199a000-0000-7000-8000-000000000001";
const url = (channel: string) =>
  `https://speeaking.com/producto/audifonos-abc123?ref=compartir&canal=${channel}`;

const withKit: AdKitView = {
  product: {
    id: PRODUCT_ID,
    title: "Audífonos inalámbricos",
    priceLabel: "$899",
    unavailable: null,
  },
  kit: {
    simulated: false,
    createdAtLabel: "26 sep 2026, 10:00 a.m.",
    stale: false,
    guard: { removed: 2, findings: ["claim"] },
    variants: [
      {
        channel: "whatsapp",
        title: "Mensaje de WhatsApp",
        text: `¡Hola! Tengo Audífonos inalámbricos a $899.\n\nNuevo\n\n${url("whatsapp")}`,
        hashtags: [],
        shareUrl: url("whatsapp"),
      },
      {
        channel: "facebook",
        title: "Publicación de Facebook",
        text: `Audífonos inalámbricos a $899.\n\n${url("facebook")}`,
        hashtags: [],
        shareUrl: url("facebook"),
      },
      {
        channel: "instagram",
        title: "Pie de foto de Instagram",
        text: "Silencio para tu trayecto.\n\n#audifonos #cdmx",
        hashtags: ["#audifonos", "#cdmx"],
        shareUrl: url("instagram"),
      },
      {
        channel: "headline",
        title: "Titular corto",
        text: "Audífonos a $899",
        hashtags: [],
        shareUrl: url("headline"),
      },
    ],
  },
  usage: { used: 3, limit: 30 },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AdKit", () => {
  it("muestra las 4 variantes, cada una etiquetada como creada con ayuda de IA", () => {
    render(<AdKit initial={withKit} />);

    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(4);
    for (const card of cards) {
      expect(within(card).getByText("Creado con ayuda de IA")).toBeInTheDocument();
      expect(within(card).getByRole("button", { name: /^Copiar:/ })).toBeInTheDocument();
    }
    expect(screen.getByRole("heading", { name: "Mensaje de WhatsApp" })).toBeInTheDocument();
    expect(screen.getByText(/Quitamos 2 frases/)).toBeInTheDocument();
    expect(screen.getByText(/Llevas 3 de 30 generaciones con IA este mes/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear otro kit" })).toBeInTheDocument();
  });

  it("WhatsApp abre con el texto completo; Instagram copia la liga aparte", () => {
    render(<AdKit initial={withKit} />);

    const whatsapp = screen.getByRole("link", { name: "Abrir WhatsApp" });
    expect(whatsapp).toHaveAttribute(
      "href",
      `https://wa.me/?text=${encodeURIComponent(withKit.kit!.variants[0]!.text)}`,
    );
    expect(whatsapp).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("button", { name: "Copiar liga" })).toBeInTheDocument();
  });

  it("copiar pone el texto en el portapapeles y registra el canal", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    render(<AdKit initial={withKit} />);

    await user.click(screen.getByRole("button", { name: "Copiar: Publicación de Facebook" }));

    expect(writeText).toHaveBeenCalledWith(withKit.kit!.variants[1]!.text);
    expect(actions.recordAdKitCopyAction).toHaveBeenCalledWith(PRODUCT_ID, "facebook");
  });

  it("sin kit invita a crearlo; con el producto cambiado avisa que conviene uno nuevo", () => {
    const { unmount } = render(<AdKit initial={{ ...withKit, kit: null }} />);
    expect(screen.getByRole("button", { name: "Crear mi kit con IA" })).toBeInTheDocument();
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    unmount();

    render(<AdKit initial={{ ...withKit, kit: { ...withKit.kit!, stale: true } }} />);
    expect(screen.getByText(/Tu producto cambió después de crear este kit/)).toBeInTheDocument();
  });

  it("un producto que no puede llevar kit lo explica y no ofrece generar", () => {
    render(
      <AdKit
        initial={{ ...withKit, kit: null, product: { ...withKit.product, unavailable: "Pausado" } }}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("(pausado)");
    expect(screen.queryByRole("button", { name: /kit/ })).not.toBeInTheDocument();
  });

  describe("IA simulada en producción (ADR-038)", () => {
    const simulatedKit: AdKitView = { ...withKit, kit: { ...withKit.kit!, simulated: true } };

    it("piloto con ALLOW_SIMULATED_AI: cada texto es «Texto de ejemplo (IA simulada)»", () => {
      render(<AdKitPanel initial={simulatedKit} availability="simulated" />);

      const cards = screen.getAllByRole("article");
      expect(cards).toHaveLength(4);
      for (const card of cards) {
        expect(within(card).getByText("Texto de ejemplo (IA simulada)")).toBeInTheDocument();
        expect(within(card).queryByText("Creado con ayuda de IA")).not.toBeInTheDocument();
      }
      expect(screen.getByText(/Piloto: la IA está simulada/)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Crear otros textos de ejemplo" }),
      ).toBeInTheDocument();
      expect(screen.queryByText(/generaciones con IA/)).not.toBeInTheDocument();
      expect(screen.getByText(/Quitamos 2 frases que no podíamos respaldar/)).toBeInTheDocument();
    });

    it("sin IA disponible: «Por ahora escribe tu anuncio a mano», sin generar ni mostrar plantillas", () => {
      render(<AdKitPanel initial={simulatedKit} availability="unavailable" />);

      expect(screen.getByRole("status")).toHaveTextContent("Por ahora escribe tu anuncio a mano");
      expect(screen.queryAllByRole("article")).toHaveLength(0);
      expect(screen.queryByRole("button", { name: /kit|ejemplo/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/Creado con ayuda de IA|Texto de ejemplo/)).not.toBeInTheDocument();
    });
  });

  describe("la etiqueta es de cada kit, no de la ruta de hoy", () => {
    it("un kit del simulador sigue siendo de ejemplo aunque hoy la IA sea de verdad", () => {
      render(
        <AdKitPanel
          initial={{ ...withKit, kit: { ...withKit.kit!, simulated: true } }}
          availability="real"
        />,
      );

      for (const card of screen.getAllByRole("article")) {
        expect(within(card).getByText("Texto de ejemplo (IA simulada)")).toBeInTheDocument();
      }
      expect(screen.queryByText("Creado con ayuda de IA")).not.toBeInTheDocument();
      // El botón es de la ruta de hoy: el próximo kit sí lo escribe la IA.
      expect(screen.getByRole("button", { name: "Crear otro kit" })).toBeInTheDocument();
    });

    it("un kit que escribió un modelo sigue siendo «Creado con ayuda de IA» con la IA simulada de hoy", () => {
      render(<AdKitPanel initial={withKit} availability="simulated" />);

      for (const card of screen.getAllByRole("article")) {
        expect(within(card).getByText("Creado con ayuda de IA")).toBeInTheDocument();
      }
      expect(
        screen.getByText(/Quitamos 2 frases que la IA no podía respaldar/),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Crear otros textos de ejemplo" }),
      ).toBeInTheDocument();
    });

    it("sin IA disponible, un kit que escribió un modelo se sigue mostrando (no es plantilla)", () => {
      const { container } = render(<AdKitPanel initial={withKit} availability="unavailable" />);

      expect(screen.getByRole("status")).toHaveTextContent("Por ahora escribe tu anuncio a mano");
      expect(screen.getAllByRole("article")).toHaveLength(4);
      expect(screen.getAllByText("Creado con ayuda de IA")).toHaveLength(4);
      expect(screen.queryByRole("button", { name: /kit|ejemplo/i })).not.toBeInTheDocument();
      expect(container.firstElementChild).toHaveAttribute("data-ai-availability", "unavailable");
    });
  });
});
