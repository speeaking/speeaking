import { APIError } from "better-auth/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Las acciones deciden el orden: validar → límite de intentos → Better Auth. Aquí se prueba que un
// intento bloqueado nunca llega a Better Auth (SEC-02), que Better Auth recibe la IP resuelta y no la
// del cliente (SEC-07), que un correo ya registrado no se distingue (SEC-11) y el destino (SEC-04).
const mocks = vi.hoisted(() => {
  const hash = vi.fn(async () => "hash");
  return {
    request: { headers: new Headers() },
    env: { NODE_ENV: "test", TRUSTED_PROXY_HOPS: 0 },
    auth: {
      api: {
        signUpEmail: vi.fn(),
        signInEmail: vi.fn(),
        signOut: vi.fn(),
        revokeSessions: vi.fn(),
      },
      $context: Promise.resolve({ password: { hash } }),
    },
    hash,
    limits: { limitSignIn: vi.fn(), limitSignUp: vi.fn(), forgiveSignIn: vi.fn() },
    db: { userConsent: { createMany: vi.fn() } },
    track: vi.fn(),
    requireViewer: vi.fn(),
    redirect: vi.fn((to: string) => {
      throw new Error(`redirect:${to}`);
    }),
  };
});
vi.mock("next/headers", () => ({ headers: async () => mocks.request.headers }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/server/auth", () => ({ auth: mocks.auth }));
vi.mock("@/server/env", () => ({ env: mocks.env }));
vi.mock("@/server/db", () => ({ db: mocks.db }));
vi.mock("@/modules/analytics/track", () => ({ track: mocks.track }));
vi.mock("./auth-limits", () => mocks.limits);
vi.mock("./session", () => ({ requireViewer: mocks.requireViewer }));

const { signInAction, signOutEverywhereAction, signUpAction } = await import("./actions");

const USER_ID = "0199a000-0000-7000-8000-000000000001";
const BLOCKED = "Demasiados intentos. Intenta de nuevo en 15 minutos.";
const SIGN_UP_FAILED =
  "No pudimos crear la cuenta con ese correo. Si ya tienes cuenta, inicia sesión.";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.append(key, value);
  return data;
}

const signUpForm = (overrides: Record<string, string> = {}) =>
  form({
    name: "Ana López",
    email: "Ana@Example.com",
    password: "una-clave-segura",
    acceptTerms: "on",
    ...overrides,
  });

const signInForm = (overrides: Record<string, string> = {}) =>
  form({ email: "ana@example.com", password: "una-clave-segura", ...overrides });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.request.headers = new Headers();
  mocks.env.TRUSTED_PROXY_HOPS = 0;
  mocks.limits.limitSignIn.mockResolvedValue({ error: null, keys: ["signin:email:x"] });
  mocks.limits.limitSignUp.mockResolvedValue({ error: null, keys: ["signup:email:x"] });
  mocks.auth.api.signUpEmail.mockResolvedValue({ user: { id: USER_ID } });
  mocks.auth.api.signInEmail.mockResolvedValue({});
});

describe("signInAction", () => {
  it("con el límite agotado no llega a Better Auth (SEC-02)", async () => {
    mocks.limits.limitSignIn.mockResolvedValue({ error: BLOCKED, keys: [] });

    const state = await signInAction({}, signInForm());

    expect(state).toEqual({ error: BLOCKED, values: { name: "", email: "ana@example.com" } });
    expect(mocks.auth.api.signInEmail).not.toHaveBeenCalled();
  });

  it("cuenta el intento con el correo normalizado", async () => {
    await expect(signInAction({}, signInForm({ email: " Ana@Example.COM " }))).rejects.toThrow(
      "redirect:/",
    );

    expect(mocks.limits.limitSignIn).toHaveBeenCalledWith(mocks.request.headers, "ana@example.com");
  });

  it("un intento fallido no se descuenta y no revela si la cuenta existe", async () => {
    mocks.auth.api.signInEmail.mockRejectedValue(
      APIError.from("UNAUTHORIZED", {
        code: "INVALID_EMAIL_OR_PASSWORD",
        message: "Invalid email or password",
      }),
    );

    const state = await signInAction({}, signInForm());

    expect(state.error).toBe("Correo o contraseña incorrectos.");
    expect(mocks.limits.forgiveSignIn).not.toHaveBeenCalled();
  });

  it("un inicio correcto se descuenta y regresa a una ruta interna", async () => {
    await expect(signInAction({}, signInForm({ next: "/pedidos" }))).rejects.toThrow(
      "redirect:/pedidos",
    );

    expect(mocks.limits.forgiveSignIn).toHaveBeenCalledWith(["signin:email:x"]);
  });

  // SEC-04
  it.each(["/.//evil.example/phish", "/%2e//evil.example", "/a/..//evil.example"])(
    "nunca redirige fuera del sitio: %s",
    async (next) => {
      await expect(signInAction({}, signInForm({ next }))).rejects.toThrow(/^redirect:\/$/);
    },
  );

  // SEC-07: la cabecera interna solo la escribe el servidor; la que mande el cliente se descarta.
  it("pasa a Better Auth la IP resuelta, nunca la que manda el cliente", async () => {
    mocks.request.headers = new Headers({
      "x-forwarded-for": "198.51.100.7",
      "x-vendeia-client-ip": "198.51.100.8",
    });
    await expect(signInAction({}, signInForm())).rejects.toThrow("redirect:/");

    const sent = mocks.auth.api.signInEmail.mock.calls[0]?.[0].headers as Headers;
    expect(sent.get("x-vendeia-client-ip")).toBeNull();

    mocks.env.TRUSTED_PROXY_HOPS = 1;
    mocks.request.headers = new Headers({
      "x-forwarded-for": "1.2.3.4, 203.0.113.9",
      "x-vendeia-client-ip": "198.51.100.8",
    });
    await expect(signInAction({}, signInForm())).rejects.toThrow("redirect:/");

    const behindProxy = mocks.auth.api.signInEmail.mock.calls[1]?.[0].headers as Headers;
    expect(behindProxy.get("x-vendeia-client-ip")).toBe("203.0.113.9");
  });
});

describe("signUpAction", () => {
  it("con el límite agotado no crea la cuenta (SEC-02)", async () => {
    mocks.limits.limitSignUp.mockResolvedValue({ error: BLOCKED, keys: [] });

    const state = await signUpAction({}, signUpForm());

    expect(state.error).toBe(BLOCKED);
    expect(mocks.auth.api.signUpEmail).not.toHaveBeenCalled();
  });

  it("valida antes de contar: un formulario inválido no gasta intentos", async () => {
    const state = await signUpAction({}, signUpForm({ name: "Equipo VendeIA" }));

    expect(state.fieldErrors?.name).toEqual(["Ese nombre está reservado. Elige otro."]);
    expect(mocks.limits.limitSignUp).not.toHaveBeenCalled();
    expect(mocks.auth.api.signUpEmail).not.toHaveBeenCalled();
  });

  it("rechaza contraseñas comunes sin llegar a Better Auth (SEC-30)", async () => {
    const state = await signUpAction({}, signUpForm({ password: "Contraseña2026!" }));

    expect(state.fieldErrors?.password?.[0]).toMatch(/muy común/);
    expect(mocks.auth.api.signUpEmail).not.toHaveBeenCalled();
  });

  it("crea la cuenta con consentimiento versionado y sigue al onboarding", async () => {
    await expect(signUpAction({}, signUpForm({ next: "/p/1" }))).rejects.toThrow(
      "redirect:/bienvenida?next=%2Fp%2F1",
    );

    expect(mocks.auth.api.signUpEmail.mock.calls[0]?.[0].body).toEqual({
      name: "Ana López",
      email: "ana@example.com",
      password: "una-clave-segura",
    });
    expect(mocks.db.userConsent.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ userId: USER_ID, type: "TERMS", granted: true }),
        expect.objectContaining({ userId: USER_ID, type: "PRIVACY_NOTICE", granted: true }),
      ],
    });
    expect(mocks.hash).not.toHaveBeenCalled();
  });

  // SEC-11
  it("un correo ya registrado: mismo mensaje que otro fallo y calcula el hash igual", async () => {
    mocks.auth.api.signUpEmail.mockRejectedValueOnce(
      APIError.from("UNPROCESSABLE_ENTITY", {
        code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
        message: "User already exists. Use another email.",
      }),
    );
    const existing = await signUpAction({}, signUpForm());

    mocks.auth.api.signUpEmail.mockRejectedValueOnce(
      APIError.from("UNPROCESSABLE_ENTITY", {
        code: "FAILED_TO_CREATE_USER",
        message: "Failed to create user",
      }),
    );
    const failed = await signUpAction({}, signUpForm());

    expect(existing.error).toBe(SIGN_UP_FAILED);
    expect(failed.error).toBe(existing.error);
    expect(mocks.hash).toHaveBeenCalledTimes(1);
    expect(mocks.hash).toHaveBeenCalledWith("una-clave-segura");
    expect(mocks.db.userConsent.createMany).not.toHaveBeenCalled();
  });
});

describe("signOutEverywhereAction (SEC-10)", () => {
  it("revoca todas las sesiones, borra la cookie y manda a entrar", async () => {
    mocks.requireViewer.mockResolvedValue({ userId: USER_ID });

    await expect(signOutEverywhereAction()).rejects.toThrow("redirect:/entrar");

    expect(mocks.requireViewer).toHaveBeenCalledWith("/ajustes");
    expect(mocks.auth.api.revokeSessions).toHaveBeenCalledWith({
      headers: mocks.request.headers,
    });
    expect(mocks.auth.api.signOut).toHaveBeenCalled();
  });

  it("sin sesión no revoca nada", async () => {
    mocks.requireViewer.mockRejectedValue(new Error("redirect:/entrar?next=%2Fajustes"));

    await expect(signOutEverywhereAction()).rejects.toThrow(/redirect:\/entrar/);
    expect(mocks.auth.api.revokeSessions).not.toHaveBeenCalled();
  });
});
