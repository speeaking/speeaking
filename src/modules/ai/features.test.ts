import { describe, expect, it } from "vitest";
import {
  AI_FEATURE_KEYS,
  AI_FEATURES,
  aiFeatureChanges,
  aiFeaturesSchema,
  DEFAULT_AI_FEATURES,
  isAiFeatureEnabled,
  parseAiFeatures,
  withAiFeature,
} from "./features";

describe("banderas de funciones de IA (ADR-043)", () => {
  it("el catálogo cubre todas las llaves, sin repetir", () => {
    expect(AI_FEATURES.map((feature) => feature.key).sort()).toEqual([...AI_FEATURE_KEYS].sort());
    expect(new Set(AI_FEATURES.map((feature) => feature.key)).size).toBe(AI_FEATURE_KEYS.length);
  });

  it("por omisión: las construidas de la fase 1 y 2 encendidas, las planeadas apagadas", () => {
    expect(isAiFeatureEnabled(DEFAULT_AI_FEATURES, "virtualTryOn")).toBe(true);
    expect(isAiFeatureEnabled(DEFAULT_AI_FEATURES, "createLook")).toBe(true);
    expect(isAiFeatureEnabled(DEFAULT_AI_FEATURES, "sellerListing")).toBe(true);
    expect(isAiFeatureEnabled(DEFAULT_AI_FEATURES, "videoGenerator")).toBe(false);
    expect(isAiFeatureEnabled(DEFAULT_AI_FEATURES, "negotiation")).toBe(false);
  });

  it("una función planeada no se enciende ni aunque el ajuste lo diga", () => {
    const setting = { version: 1 as const, enabled: { videoGenerator: true } };
    expect(isAiFeatureEnabled(setting, "videoGenerator")).toBe(false);
  });

  it("apagar y volver a encender deja el ajuste limpio", () => {
    const off = withAiFeature(DEFAULT_AI_FEATURES, "virtualTryOn", false);
    expect(off.enabled).toEqual({ virtualTryOn: false });
    expect(isAiFeatureEnabled(off, "virtualTryOn")).toBe(false);
    const on = withAiFeature(off, "virtualTryOn", true);
    expect(on.enabled).toEqual({});
    expect(aiFeatureChanges(DEFAULT_AI_FEATURES, off)).toEqual([
      { key: "virtualTryOn", enabled: false },
    ]);
  });

  it("un valor guardado inválido cae al predeterminado y el esquema es estricto", () => {
    expect(parseAiFeatures({ version: 2 })).toEqual(DEFAULT_AI_FEATURES);
    expect(parseAiFeatures(null)).toEqual(DEFAULT_AI_FEATURES);
    expect(aiFeaturesSchema.safeParse({ version: 1, enabled: { nope: true } }).success).toBe(false);
    expect(aiFeaturesSchema.safeParse({ version: 1, enabled: {}, extra: 1 }).success).toBe(false);
  });
});
