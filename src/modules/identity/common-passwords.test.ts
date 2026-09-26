import { describe, expect, it } from "vitest";
import { isCommonPassword } from "./common-passwords";

describe("isCommonPassword (SEC-30)", () => {
  it.each([
    "1234567890",
    "0123456789",
    "9876543210",
    "5512345678",
    "01/01/1990!",
    "aaaaaaaaaa",
    "abcabcabcabc",
    "1212121212",
    "abcdefghij",
    "qwertyuiop",
    "QWERTYUIOP1",
    "asdfghjklñ",
    "1q2w3e4r5t",
    "1qaz2wsx3edc",
    "password123",
    "Password1234!",
    "p@ssw0rd123",
    "P4ssw0rd2026",
    "contraseña1",
    "Contraseña2026!",
    "contrasena123",
    "teamo123456",
    "123teamo456",
    "iloveyou12",
    "mexico12345",
    "Mexico2026!",
    "chivas12345",
    "vendeia2026",
    "bienvenido1",
    "123456789a",
  ])("rechaza %j", (password) => {
    expect(isCommonPassword(password)).toBe(true);
  });

  it.each([
    "clave-de-prueba-segura",
    "una-clave-segura",
    "mi perro come tacos",
    "Ximena-Guadalupe-83",
    "teamo-a-ti-ximena",
    "mexico2026abc",
    "пароль-длинный-2026",
    "tr3s-tristes-tigres",
  ])("permite %j", (password) => {
    expect(isCommonPassword(password)).toBe(false);
  });
});
