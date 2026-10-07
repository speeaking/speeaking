import { describe, expect, it } from "vitest";
import { addBusinessDays, isBusinessDay } from "./business-days";

// Fechas en hora de la Ciudad de México (UTC−6 todo el año desde 2022).
const mx = (isoLocal: string) => new Date(`${isoLocal}-06:00`);

describe("días hábiles", () => {
  it("sábado y domingo no cuentan, en hora de la Ciudad de México", () => {
    expect(isBusinessDay(mx("2026-10-09T12:00:00"))).toBe(true); // viernes
    expect(isBusinessDay(mx("2026-10-10T12:00:00"))).toBe(false); // sábado
    expect(isBusinessDay(mx("2026-10-11T12:00:00"))).toBe(false); // domingo
    // Viernes 23:30 en México ya es sábado en UTC: manda la hora de México.
    expect(isBusinessDay(mx("2026-10-09T23:30:00"))).toBe(true);
    // Domingo 20:00 en México ya es lunes en UTC: sigue sin contar.
    expect(isBusinessDay(mx("2026-10-11T20:00:00"))).toBe(false);
  });

  it("10 días hábiles desde un miércoles caen en el miércoles de dos semanas después", () => {
    expect(addBusinessDays(mx("2026-10-07T10:15:00"), 10)).toEqual(mx("2026-10-21T10:15:00"));
  });

  it("desde un viernes saltan dos fines de semana", () => {
    expect(addBusinessDays(mx("2026-10-09T18:00:00"), 10)).toEqual(mx("2026-10-23T18:00:00"));
    expect(addBusinessDays(mx("2026-10-09T18:00:00"), 1)).toEqual(mx("2026-10-12T18:00:00"));
  });

  it("recibido en fin de semana: cuenta desde el lunes", () => {
    expect(addBusinessDays(mx("2026-10-10T09:00:00"), 10)).toEqual(mx("2026-10-26T09:00:00"));
    expect(addBusinessDays(mx("2026-10-11T22:00:00"), 10)).toEqual(mx("2026-10-26T22:00:00"));
  });

  it("cero días no mueve una fecha hábil", () => {
    expect(addBusinessDays(mx("2026-10-07T10:15:00"), 0)).toEqual(mx("2026-10-07T10:15:00"));
  });
});
