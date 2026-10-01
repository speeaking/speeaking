import { describe, expect, it } from "vitest";
import {
  daysUntilText,
  fathersDay,
  occasionDateText,
  occasionsOf,
  upcomingOccasions,
} from "./calendar";

describe("fechas de la redacción", () => {
  it("el Día del Padre es el tercer domingo de junio", () => {
    expect(fathersDay(2026)).toBe("2026-06-21");
    expect(fathersDay(2027)).toBe("2027-06-20");
    // Junio de 2025 empezó en domingo: el tercero es el 15.
    expect(fathersDay(2025)).toBe("2025-06-15");
  });

  it("las fechas de un año van en orden y con el año en su llave", () => {
    const occasions = occasionsOf(2026);
    const days = occasions.map((occasion) => occasion.day);
    expect(days).toEqual([...days].sort());
    expect(new Set(occasions.map((occasion) => occasion.key)).size).toBe(occasions.length);
    expect(occasions.every((occasion) => occasion.key.endsWith("-2026"))).toBe(true);
    expect(occasions.find((occasion) => occasion.key === "dia-de-muertos-2026")?.day).toBe(
      "2026-11-02",
    );
    // El Buen Fin sale del calendario de la operación (fecha confirmada de 2026).
    expect(occasions.find((occasion) => occasion.key === "buen-fin-2026")?.day).toBe("2026-11-13");
  });

  it("solo propone las fechas de los siguientes siete días, la más cercana primero", () => {
    expect(upcomingOccasions("2026-10-01")).toEqual([]);
    expect(upcomingOccasions("2026-10-26").map((occasion) => occasion.key)).toEqual([
      "halloween-2026",
      "dia-de-muertos-2026",
    ]);
    // El mismo día todavía cuenta; al día siguiente ya no.
    expect(upcomingOccasions("2026-11-02").map((occasion) => occasion.key)).toEqual([
      "dia-de-muertos-2026",
    ]);
    expect(upcomingOccasions("2026-11-03")).toEqual([]);
  });

  it("al final de diciembre ve las fechas del año siguiente", () => {
    expect(upcomingOccasions("2026-12-30").map((occasion) => occasion.key)).toEqual([
      "ano-nuevo-2027",
      "dia-de-reyes-2027",
    ]);
  });

  it("escribe la fecha y lo que falta como se le dicen al modelo", () => {
    expect(occasionDateText("2026-11-02")).toBe("lunes, 2 de noviembre");
    const muertos = { key: "dia-de-muertos-2026", name: "Día de Muertos", day: "2026-11-02" };
    expect(daysUntilText("2026-10-28", muertos)).toBe("faltan 5 días");
    expect(daysUntilText("2026-11-01", muertos)).toBe("es mañana");
    expect(daysUntilText("2026-11-02", muertos)).toBe("es hoy");
  });
});
