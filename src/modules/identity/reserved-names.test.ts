import { describe, expect, it } from "vitest";
import { isPlatformImpersonation, isReservedUsername } from "./reserved-names";

describe("isPlatformImpersonation (SEC-18)", () => {
  it.each([
    "Equipo VendeIA",
    "equipo vendeia",
    "VendeIA",
    "Vende IA",
    "V.e.n.d.e.I.A",
    "VENDE-IA Oficial",
    "Soporte VendeIA",
    "Tienda VendeIA",
    "Equipo Vende1A",
    "V3nde1a",
    "Véndéíá",
    // Ancho completo y letras cirílicas que se ven latinas.
    "ＶｅｎｄｅＩＡ",
    "Vеndеia",
    "Soporte",
    "SOPORTE",
    "Sóporte Técnico",
    "S0p0rte",
    "Equipo",
    "Equipo de soporte",
    "Soporte 24",
    "Soporte MX",
    "Admin",
    "Administración",
    "Moderador",
    "Staff",
    "Atención a clientes",
    "Cuenta oficial",
    "Official Support",
  ])("rechaza %j", (name) => {
    expect(isPlatformImpersonation(name)).toBe(true);
  });

  it.each([
    "Ana López",
    "Prueba Automática",
    "Tecno Juan",
    "Equipo Deportivo MX",
    "Distribuidor Oficial Samsung",
    "Tienda Oficial",
    "Ana de Soporte Técnico Pérez",
    "Vendedora Ana",
    "Venden Ideas",
    "24/7 Abarrotes",
    "José María",
    "Moda Ximena",
  ])("permite %j", (name) => {
    expect(isPlatformImpersonation(name)).toBe(false);
  });

  it("no se dispara con muchos dígitos (dos lecturas del 1, nunca combinaciones)", () => {
    const started = performance.now();
    expect(isPlatformImpersonation(Array(30).fill("a1").join(" "))).toBe(false);
    expect(performance.now() - started).toBeLessThan(50);
  });
});

describe("isReservedUsername (SEC-18)", () => {
  it.each([
    "admin",
    "studio",
    "api",
    "equipo",
    "equipo.gaming",
    "equipo.soporte",
    "equipo_moda",
    "equipogaming",
    "vendeia",
    "vendeia.oficial",
    "vendeia.mx",
    "tienda.vendeia",
    "vende.ia",
    "vende_ia.ayuda",
    "vende1a",
    "admin_mx",
    "administrador.ana",
    "adm1n",
    "soporte.tecnico",
    "s0porte",
    "soportemx",
    "oficial.ventas",
    "0ficial",
    "staff.juan",
    "moderador.gaming",
    "tienda.oficial",
    "ana.soporte",
    "juan_admin",
    "nike.official",
  ])("rechaza %s", (username) => {
    expect(isReservedUsername(username)).toBe(true);
  });

  it.each([
    "ana.lopez",
    "ana_22",
    "tienda.mx",
    "juan.equipos",
    "deportes.equipo1",
    "adrian",
    "vendedora.ana",
    "soya.mx",
  ])("permite %s", (username) => {
    expect(isReservedUsername(username)).toBe(false);
  });
});
