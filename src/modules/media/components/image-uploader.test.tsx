import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImageUploader } from "./image-uploader";

const toast = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

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
    vi.clearAllMocks();
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

  it("una imagen de más de 10 MB ni se manda: el servidor cortaría la conexión (SEC-03)", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:local");
    const { container } = render(<ImageUploader name="mediaIds" max={10} initial={[]} />);
    const heavy = new File(["x"], "pesada.jpg", { type: "image/jpeg" });
    Object.defineProperty(heavy, "size", { value: 10 * 1024 * 1024 + 1 });

    await userEvent.upload(screen.getByLabelText("Elegir imágenes"), heavy);

    expect(fetch).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("La imagen pesa más de 10 MB.");
    expect(container.querySelectorAll("img")).toHaveLength(0);
  });

  it("una respuesta de error sin JSON (413 del proxy, 503) muestra un mensaje útil", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 413 }))
      .mockResolvedValueOnce(new Response("<html>503</html>", { status: 503 }));
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:local");
    const { container } = render(<ImageUploader name="mediaIds" max={10} initial={[]} />);

    await userEvent.upload(screen.getByLabelText("Elegir imágenes"), [
      new File(["x"], "a.png", { type: "image/png" }),
      new File(["y"], "b.png", { type: "image/png" }),
    ]);

    await waitFor(() => expect(screen.getAllByText("Error")).toHaveLength(2));
    expect(toast.error).toHaveBeenCalledWith("La imagen pesa más de 10 MB.");
    expect(toast.error).toHaveBeenCalledWith(
      "Hay muchas subidas en este momento. Intenta en unos segundos.",
    );
    expect(submittedIds(container)).toEqual([]);
  });

  it("con una sola foto permitida no muestra portada ni flechas", () => {
    render(<ImageUploader name="mediaId" max={1} initial={initial.slice(0, 1)} />);

    expect(screen.queryByText("Portada")).toBeNull();
    expect(screen.queryByRole("button", { name: /Mover foto/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Agregar" })).toBeNull();
  });
});
