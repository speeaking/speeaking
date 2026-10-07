import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Adónde lleva terminar la bienvenida (ADR-022, P1 «compartir afuera, descubrir adentro»): quien se
 * registró desde un enlace (una publicación compartida, una comunidad) regresa a él; quien viene a
 * vender entra a «¿Qué quieres vender hoy?»; los demás empiezan en el feed con «¡Listo, …!».
 */
const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
  cookies: { set: vi.fn() },
  goals: [] as string[],
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/headers", () => ({ cookies: async () => mocks.cookies }));
vi.mock("@/modules/analytics/track", () => ({ track: vi.fn() }));
vi.mock("./session", () => ({ requireViewer: vi.fn(async () => ({ userId: "u-1" })) }));
vi.mock("./service", () => ({
  completeOnboarding: vi.fn(async () => ({ joinedCommunityIds: [] })),
  hasLegalConsents: vi.fn(async () => true),
  OnboardingError: class OnboardingError extends Error {},
}));
// El esquema tiene sus propias pruebas: aquí solo importa qué objetivos eligió la persona.
vi.mock("./onboarding-schema", () => ({
  onboardingSchema: {
    fromFormData: () => ({ success: true, data: { goals: mocks.goals } }),
  },
}));

const { completeOnboardingAction } = await import("./onboarding-actions");

function form(next?: string) {
  const data = new FormData();
  if (next !== undefined) data.set("next", next);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.goals = ["BUY"];
});

describe("completeOnboardingAction: adónde lleva al terminar", () => {
  it("sin enlace de origen, al feed con el momento «¡Listo!»", async () => {
    await expect(completeOnboardingAction({}, form())).rejects.toThrow(/^REDIRECT \/$/);
    expect(mocks.cookies.set).toHaveBeenCalledWith("speeaking_bienvenida", "1", expect.anything());
  });

  it("desde una publicación compartida, regresa a ella (sin el momento del feed)", async () => {
    await expect(
      completeOnboardingAction({}, form("/p/0199a000-0000-7000-8000-0000000000c1")),
    ).rejects.toThrow("REDIRECT /p/0199a000-0000-7000-8000-0000000000c1");
    expect(mocks.cookies.set).not.toHaveBeenCalled();
  });

  it("desde una comunidad, regresa a ella", async () => {
    await expect(completeOnboardingAction({}, form("/c/gaming"))).rejects.toThrow(
      "REDIRECT /c/gaming",
    );
  });

  it("un `next` hacia otro sitio se ignora (SEC-04) y lleva al feed", async () => {
    for (const next of ["https://evil.example/x", "//evil.example", "/.//evil.example/x"]) {
      mocks.redirect.mockClear();
      await expect(completeOnboardingAction({}, form(next))).rejects.toThrow(/^REDIRECT \/$/);
    }
  });

  it("quien eligió «Vender» entra directo a Sube y vende (P6), aunque haya enlace de origen", async () => {
    mocks.goals = ["SELL"];
    await expect(
      completeOnboardingAction({}, form("/p/0199a000-0000-7000-8000-0000000000c1")),
    ).rejects.toThrow("REDIRECT /studio/sube-y-vende");
  });
});
