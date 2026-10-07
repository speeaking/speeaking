import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createProductAction } from "../actions";
import { RIGHTS_ATTESTATION_MESSAGE } from "../schemas";

// Las acciones viven en el servidor; el selector de fotos sube archivos de verdad.
vi.mock("../actions", () => ({
  createProductAction: vi.fn(async () => ({})),
  updateProductAction: vi.fn(async () => ({})),
}));
vi.mock("@/modules/media/components/image-uploader", () => ({
  ImageUploader: () => <div>Fotos</div>,
}));

const { ProductForm } = await import("./product-form");

const categories = [{ id: "0199a000-0000-7000-8000-000000000001", name: "Ropa", parentId: null }];

function warrantySelect() {
  return screen.getByRole("combobox", { name: "Garantía" });
}

describe("ProductForm", () => {
  it("pide confirmar los derechos sobre fotos, videos y textos con una casilla sin marcar", () => {
    render(<ProductForm categories={categories} communities={[]} />);

    const attestation = screen.getByRole("checkbox", {
      name: "Las fotos, videos y textos son míos o tengo permiso para usarlos (y de las personas que aparecen)",
    });
    expect(attestation).not.toBeChecked();
    expect(attestation).toBeRequired();
    expect(attestation).toHaveAttribute("name", "rightsAttestation");
  });

  it("al editar también la pide, sin marcar", () => {
    render(
      <ProductForm
        mode="edit"
        productId="0199a000-0000-7000-8000-0000000000aa"
        categories={categories}
        defaults={{ warrantyType: "SELLER", warrantyDays: "180" }}
      />,
    );

    expect(screen.getByRole("checkbox", { name: /tengo permiso para usarlos/ })).not.toBeChecked();
  });

  it("un producto nuevo empieza «Sin garantía» y, si la da, propone 90 días", () => {
    render(<ProductForm categories={categories} communities={[]} />);

    expect(warrantySelect()).toHaveValue("NONE");
    expect(screen.getByLabelText("Días de garantía")).toHaveValue("90");
    expect(screen.getByText("Mínimo 90 días, como pide la ley.")).toBeInTheDocument();
  });

  it("al editar conserva lo guardado, aunque sea menos de 90 días (el servidor pide corregirlo)", () => {
    render(
      <ProductForm
        mode="edit"
        productId="0199a000-0000-7000-8000-0000000000aa"
        categories={categories}
        defaults={{ warrantyType: "SELLER", warrantyDays: "30" }}
      />,
    );

    expect(warrantySelect()).toHaveValue("SELLER");
    expect(screen.getByLabelText("Días de garantía")).toHaveValue("30");
  });

  it("al editar un producto «Sin garantía», si la agrega propone 90 días", () => {
    render(
      <ProductForm
        mode="edit"
        productId="0199a000-0000-7000-8000-0000000000aa"
        categories={categories}
        defaults={{ warrantyType: "NONE", warrantyDays: "30" }}
      />,
    );

    expect(screen.getByLabelText("Días de garantía")).toHaveValue("90");
  });

  it("sin la casilla, el servidor lo rechaza y el error se ve junto a ella", async () => {
    vi.mocked(createProductAction).mockResolvedValueOnce({
      error: "Revisa los campos marcados.",
      fieldErrors: { rightsAttestation: [RIGHTS_ATTESTATION_MESSAGE] },
    });
    render(<ProductForm categories={categories} communities={[]} />);

    await userEvent.click(screen.getByRole("button", { name: "Publicar producto" }));

    expect(await screen.findByText(RIGHTS_ATTESTATION_MESSAGE)).toBeVisible();
    const data = vi.mocked(createProductAction).mock.calls[0]![1];
    expect(data.get("rightsAttestation")).toBeNull();
  });
});
