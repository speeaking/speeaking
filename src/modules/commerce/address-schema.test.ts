import { describe, expect, it } from "vitest";
import { addressSchema } from "./address-schema";

const valid = {
  recipientName: "Ana López",
  phone: "+52 (55) 1234-5678",
  street: "Av. Insurgentes Sur",
  exteriorNumber: "1234",
  neighborhood: "Del Valle",
  city: "Benito Juárez",
  state: "CDMX",
  postalCode: "03100",
};

describe("addressSchema", () => {
  it("normaliza el teléfono mexicano a 10 dígitos", () => {
    expect(addressSchema.parse(valid).phone).toBe("5512345678");
  });

  it("exige código postal de 5 dígitos", () => {
    expect(addressSchema.safeParse({ ...valid, postalCode: "3100" }).success).toBe(false);
    expect(addressSchema.safeParse({ ...valid, postalCode: "0310A" }).success).toBe(false);
  });

  it("los campos opcionales vacíos quedan indefinidos", () => {
    const parsed = addressSchema.parse({ ...valid, interiorNumber: "", references: " " });

    expect(parsed.interiorNumber).toBeUndefined();
    expect(parsed.references).toBeUndefined();
  });
});
