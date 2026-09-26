import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImageUploader } from "./image-uploader";

const initial = ["a", "b", "c"].map((id) => ({
  id: `media-${id}`,
  url: `/media/${id}.webp`,
  width: 800,
  height: 800,
}));

/** Lo que recibe el servidor: los campos ocultos en el orden del formulario. */
function submittedIds(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLInputElement>('input[name="mediaIds"]')].map(
    (input) => input.value,
  );
}

describe("ImageUploader", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("marca la primera foto como portada y solo ofrece las flechas que aplican", () => {
    render(<ImageUploader name="mediaIds" max={10} initial={initial} />);

    expect(screen.getAllByText("Portada")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Mover foto 1 a la izquierda" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mover foto 3 a la derecha" })).toBeNull();
    expect(screen.getByRole("button", { name: "Mover foto 2 a la izquierda" })).toBeVisible();
  });

  it("reordena con las flechas, envía el nuevo orden y conserva el foco", async () => {
    const { container } = render(<ImageUploader name="mediaIds" max={10} initial={initial} />);

    await userEvent.click(screen.getByRole("button", { name: "Mover foto 3 a la izquierda" }));
    expect(submittedIds(container)).toEqual(["media-a", "media-c", "media-b"]);
    expect(screen.getByRole("button", { name: "Mover foto 2 a la izquierda" })).toHaveFocus();

    // Llega al inicio: ya no hay flecha a la izquierda y el foco pasa a la de la derecha.
    await userEvent.keyboard("{Enter}");
    expect(submittedIds(container)).toEqual(["media-c", "media-a", "media-b"]);
    expect(screen.getByRole("button", { name: "Mover foto 1 a la derecha" })).toHaveFocus();
    expect(screen.getByText("Foto movida al inicio: ahora es la portada.")).toBeInTheDocument();

    const cover = screen.getByText("Portada").parentElement!;
    expect(cover.querySelector("img")).toHaveAttribute("src", "/media/c.webp");
  });

  it("quitar una foto la saca de lo que se envía sin perder el foco", async () => {
    const { container } = render(<ImageUploader name="mediaIds" max={10} initial={initial} />);

    await userEvent.click(screen.getByRole("button", { name: "Quitar foto 2" }));
    expect(submittedIds(container)).toEqual(["media-a", "media-c"]);
    // El foco pasa a la foto que ocupó su lugar (la que era la 3).
    expect(screen.getByRole("button", { name: "Quitar foto 2" })).toHaveFocus();

    // La última: el foco pasa a la anterior; sin fotos, a "Agregar".
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Quitar foto 1" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(submittedIds(container)).toEqual([]);
    expect(screen.getByRole("button", { name: "Agregar" })).toHaveFocus();
  });

  it("una foto que aún se sube queda marcada y no se envía hasta que termine", async () => {
    let finish: (response: Response) => void = () => {};
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise((resolve) => (finish = resolve)));
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:local");
    const { container } = render(<ImageUploader name="mediaIds" max={10} initial={[]} />);

    await userEvent.upload(
      screen.getByLabelText("Elegir imágenes"),
      new File(["x"], "foto.png", { type: "image/png" }),
    );
    expect(container.querySelectorAll("[data-uploading]")).toHaveLength(1);
    expect(submittedIds(container)).toEqual([]);

    finish(Response.json(initial[0]));
    await waitFor(() => expect(submittedIds(container)).toEqual(["media-a"]));
    expect(container.querySelector("[data-uploading]")).toBeNull();
  });

  it("con una sola foto permitida no muestra portada ni flechas", () => {
    render(<ImageUploader name="mediaId" max={1} initial={initial.slice(0, 1)} />);

    expect(screen.queryByText("Portada")).toBeNull();
    expect(screen.queryByRole("button", { name: /Mover foto/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Agregar" })).toBeNull();
  });
});
