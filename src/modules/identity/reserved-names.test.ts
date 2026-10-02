import { describe, expect, it } from "vitest";
import { isPlatformImpersonation, isReservedUsername } from "./reserved-names";

describe("isPlatformImpersonation (SEC-18)", () => {
  it.each([
    "Equipo speeaking",
    "speeaking",
    "Speeaking Oficial",
    "Soporte Speeaking",
    "S.p.e.e.a.k.i.n.g",
    "Spe3aking",
    "Speeáking",
    // La marca con una sola «e» junto a un rol (ADR-070).
    "Equipo Speaking",
    "Soporte Speaking",
    "Speaking Oficial",
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

  // Revisión de SEC-18: variantes que se veían igual a la marca o a un rol y pasaban.
  it.each([
    // «l» minúscula por «I» mayúscula: mismo trazo en la tipografía de la app.
    "Equipo VendelA",
    "VendelA",
    "Vende lA",
    "Vendel A",
    "VENDElA",
    // Símbolos que imitan la I.
    "Vende|A",
    "Vende!A",
    // Una I de otro alfabeto que no está en la tabla (palochka, i pequeña, i sin punto, I longa).
    "VendeӀA",
    "Vendeɪa",
    "Vendeıa",
    "VendeꟾA",
    "ᏙendeꟾA",
    // Un rol con contexto de la plataforma.
    "Soporte de pagos",
    "Moderación de la comunidad",
    "Centro de ayuda",
    "Mesa de ayuda",
    "Soporte a vendedores",
    "Equipo de pagos",
    "Seguridad de cuentas",
    "Trust & Safety",
    // Letras separadas y la «l» dentro de una palabra de rol.
    "S o p o r t e",
    "Soporte Oflcial",
  ])("rechaza la variante %j", (name) => {
    expect(isPlatformImpersonation(name)).toBe(true);
  });

  it.each([
    "Juan vende la mejor ropa",
    "Véndela Ya",
    "Compra y véndelas",
    "Lupita vende lámparas",
    "Pagos Hernández",
    "Centro Joyero",
    "Ayuda Mutua Lupita",
    "Lalo Villalobos",
    "¿Qué vende? Ana",
    "佐藤 花子",
    "Иван Петров",
    // «Speaking» solo, y «estreno» como palabra común (ADR-070).
    "Public Speaking MX",
    "Speaking Club",
    "Ropa de estreno",
  ])("sigue permitiendo %j", (name) => {
    expect(isPlatformImpersonation(name)).toBe(false);
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
    "speeaking",
    "speeaking.oficial",
    "speeaking.mx",
    "tienda.speeaking",
    "spe3aking",
    "speaking",
    "estreno",
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
    // La «l» por la «i» (revisión de SEC-18).
    "equlpo.gaming",
    "admln",
    "oflcial.mx",
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
    "lalo.lopez",
    "leila_99",
    "public.speaking",
    "ropa.de.estreno",
  ])("permite %s", (username) => {
    expect(isReservedUsername(username)).toBe(false);
  });
});
