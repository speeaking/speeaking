import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommentForm } from "./comment-form";

vi.mock("../actions", () => ({ createCommentAction: vi.fn() }));

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

const POST_ID = "0199a000-0000-7000-8000-000000000001";

describe("CommentForm", () => {
  it("llegar con #comentar deja el cursor en el campo", () => {
    window.history.replaceState(null, "", "/p/x#comentar");
    render(<CommentForm postId={POST_ID} id="comentar" />);

    expect(screen.getByLabelText("Escribe un comentario")).toHaveFocus();
  });

  it("tocar «Comentar» en la misma página (hashchange) también enfoca el campo", async () => {
    render(<CommentForm postId={POST_ID} id="comentar" />);
    const field = screen.getByLabelText("Escribe un comentario");
    expect(field).not.toHaveFocus();

    window.location.hash = "#comentar";

    await waitFor(() => expect(field).toHaveFocus());
  });

  it("sin el ancla no roba el foco", () => {
    render(<CommentForm postId={POST_ID} id="comentar" />);

    expect(screen.getByLabelText("Escribe un comentario")).not.toHaveFocus();
  });
});
