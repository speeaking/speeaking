import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { hueFromText, RESERVED_AVATAR_HUES, UserAvatar } from "./user-avatar";

describe("UserAvatar", () => {
  it("usa las iniciales de las dos primeras palabras con letras", () => {
    const { container } = render(<UserAvatar name="Humor · Equipo speeaking" seed="x" />);

    expect(container.textContent).toBe("HE");
  });

  it("ignora conectores en minúscula como y, de o la", () => {
    const cases = [
      ["Casa y Estilo Demo", "CE"],
      ["Tacos de la Esquina", "TE"],
      ["Hogar e Ideas", "HI"],
      ["Club de los Libros", "CL"],
    ] as const;
    for (const [name, expected] of cases) {
      const { container, unmount } = render(<UserAvatar name={name} seed="x" />);
      expect(container.textContent).toBe(expected);
      unmount();
    }
  });

  it("un conector con mayúscula sí cuenta como palabra", () => {
    const { container } = render(<UserAvatar name="De la Cruz" seed="x" />);

    expect(container.textContent).toBe("DC");
  });

  it("si el nombre solo tiene conectores, los usa en lugar de dejarlo vacío", () => {
    const { container } = render(<UserAvatar name="y" seed="x" />);

    expect(container.textContent).toBe("Y");
  });

  it("con una sola palabra usa sus dos primeras letras", () => {
    const { container } = render(<UserAvatar name="ana" seed="x" />);

    expect(container.textContent).toBe("AN");
  });
});

describe("hueFromText", () => {
  it("es estable y está entre 0 y 359", () => {
    expect(hueFromText("ana.lopez")).toBe(hueFromText("ana.lopez"));
    expect(hueFromText("ana.lopez")).toBeGreaterThanOrEqual(0);
    expect(hueFromText("ana.lopez")).toBeLessThan(360);
  });

  it("nunca cae en la lima de la IA ni en el turquesa", () => {
    const hues = Array.from({ length: 5000 }, (_, i) => hueFromText(`persona-${i}`));
    const reserved = hues.filter((hue) =>
      RESERVED_AVATAR_HUES.some(([from, to]) => hue >= from && hue < to),
    );

    expect(reserved).toEqual([]);
    expect(Math.min(...hues)).toBe(0);
    expect(Math.max(...hues)).toBe(359);
  });
});
