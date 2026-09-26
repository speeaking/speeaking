import { describe, expect, it } from "vitest";
import { findPersonalData, redactPersonalData } from "./personal-data";

describe("findPersonalData", () => {
  it.each([
    ["Escríbeme a ana.lopez+ventas@gmail.com", ["email"]],
    ["Mándame WhatsApp al 55 1234 5678", ["phone"]],
    ["Llámame al +52 (55) 1234-5678", ["phone"]],
    ["Deposita a la CLABE 012180001234567890", ["account"]],
    ["Tarjeta 4152 3136 1234 5678", ["account"]],
    ["Pídelo en https://wa.me/5215512345678", ["url"]],
    ["Checa mi tienda en mitienda.com.mx/oferta", ["url"]],
    ["Sígueme en @ventas.ana", ["handle"]],
  ])("detecta «%s»", (text, kinds) => {
    expect(findPersonalData(text)).toEqual(kinds);
  });

  it("no se salta con dígitos de ancho completo ni caracteres invisibles", () => {
    expect(findPersonalData("WhatsApp ５５ １２３４ ５６７８")).toEqual(["phone"]);
    expect(findPersonalData("CLABE 0121800\u200B01234567890")).toEqual(["account"]);
    expect(findPersonalData("ana＠correo.mx")).toEqual(["email"]);
  });

  it("no confunde precios, cantidades ni modelos con teléfonos o cuentas", () => {
    expect(
      findPersonalData(
        "Tengo 50 AirPods Pro 2. Me costaron $2,400 y los vendo a $3,499.00; 2026 edición 15 cm.",
      ),
    ).toEqual([]);
  });
});

describe("redactPersonalData (SEC-29)", () => {
  it("reemplaza correos, teléfonos, cuentas, ligas y usuarios por una marca", () => {
    expect(
      redactPersonalData(
        "Soy Ana, 55 1234 5678, ana@correo.mx, CLABE 012180001234567890, wa.me/5215512345678, @ana.ventas. Vendo 50 tenis a $1,499.",
      ),
    ).toBe(
      "Soy Ana, [teléfono], [correo], CLABE [cuenta], [liga], [usuario]. Vendo 50 tenis a $1,499.",
    );
  });

  it("también con dígitos de ancho completo o partidos por caracteres invisibles", () => {
    expect(
      redactPersonalData("Llámame al ５５ １２３４ ５６７８ o al 55\u200B1234\u200B5678."),
    ).toBe("Llámame al [teléfono] o al [teléfono].");
  });
});
