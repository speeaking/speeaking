import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// La acción vive en el servidor; los selectores de fotos y video suben archivos de verdad.
vi.mock("../actions", () => ({ createPostAction: vi.fn(async () => ({})) }));
vi.mock("@/modules/media/components/image-uploader", () => ({
  ImageUploader: () => <div>Fotos</div>,
}));
vi.mock("@/modules/media/components/video-picker", () => ({
  VideoPicker: () => <div>Video</div>,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const { CreatePostForm } = await import("./create-post-form");

describe("CreatePostForm", () => {
  it("bajo «Publicar» recuerda que se necesita permiso para compartir y de quienes aparecen", () => {
    render(<CreatePostForm communities={[]} products={[]} />);

    expect(
      screen.getByText(
        /Al publicar confirmas que tienes derecho a compartirlo y que quienes aparecen están de acuerdo\./,
      ),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Reglas de la comunidad" })).toHaveAttribute(
      "href",
      "/terminos#reglas",
    );
    // Va después del botón (no se lee como parte del formulario a llenar).
    const button = screen.getByRole("button", { name: "Publicar" });
    const notice = screen.getByRole("link", { name: "Reglas de la comunidad" });
    expect(button.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
