import { beforeEach, describe, expect, it, vi } from "vitest";

// El servicio decide; las consultas (Prisma) se simulan.
vi.mock("./queries", () => ({
  findIntentOwner: vi.fn(),
  markIntentDismissed: vi.fn(),
  findActiveIntent: vi.fn(),
  listIntentProductPool: vi.fn(),
  getIntentProductCard: vi.fn(),
  userExists: vi.fn(),
  createSuggestionDismissal: vi.fn(),
  listMutualFollowIds: vi.fn(),
  listMembershipCommunityIds: vi.fn(),
  countCommentersOnPostsOf: vi.fn(),
  countFollowedByFollowing: vi.fn(),
  listActiveCommunityPeers: vi.fn(),
  listSharedCommunityNames: vi.fn(),
  listSuggestionProfiles: vi.fn(),
}));

const queries = await import("./queries");
const { dismissIntent, dismissSuggestion, getIntentHighlight, getPeopleSuggestions } =
  await import("./service");

const OWNER = "0199a000-0000-7000-8000-00000000000a";
const OTHER = "0199a000-0000-7000-8000-00000000000b";
const INTENT = "0199a000-0000-7000-8000-0000000000c1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("dismissIntent (autorización en el servicio)", () => {
  it("la dueña descarta su intención activa", async () => {
    vi.mocked(queries.findIntentOwner).mockResolvedValue({ userId: OWNER, status: "ACTIVE" });
    await expect(dismissIntent(OWNER, INTENT)).resolves.toBe("dismissed");
    expect(queries.markIntentDismissed).toHaveBeenCalledWith(INTENT);
  });

  it("otra persona no puede descartarla y no se revela que existe", async () => {
    vi.mocked(queries.findIntentOwner).mockResolvedValue({ userId: OWNER, status: "ACTIVE" });
    await expect(dismissIntent(OTHER, INTENT)).resolves.toBe("not-found");
    expect(queries.markIntentDismissed).not.toHaveBeenCalled();
  });

  it("si no existe responde igual", async () => {
    vi.mocked(queries.findIntentOwner).mockResolvedValue(null);
    await expect(dismissIntent(OWNER, INTENT)).resolves.toBe("not-found");
  });

  it("es idempotente: una ya descartada no se vuelve a escribir", async () => {
    vi.mocked(queries.findIntentOwner).mockResolvedValue({ userId: OWNER, status: "DISMISSED" });
    await expect(dismissIntent(OWNER, INTENT)).resolves.toBe("dismissed");
    expect(queries.markIntentDismissed).not.toHaveBeenCalled();
  });
});

describe("getIntentHighlight", () => {
  const intent = {
    id: INTENT,
    query: "tenis para correr",
    categoryId: null,
    budgetMaxCents: 200_000,
    source: "ONBOARDING" as const,
    createdAt: new Date("2026-09-20T12:00:00Z"),
  };

  it("sin intención activa no hay bloque", async () => {
    vi.mocked(queries.findActiveIntent).mockResolvedValue(null);
    await expect(getIntentHighlight(OWNER)).resolves.toBeNull();
  });

  it("elige por código el mejor producto en presupuesto y el DTO no lleva costo", async () => {
    vi.mocked(queries.findActiveIntent).mockResolvedValue(intent);
    vi.mocked(queries.listIntentProductPool).mockResolvedValue([
      {
        id: "p-maceta",
        title: "Maceta de barro",
        tags: [],
        categoryId: "c",
        priceCents: 28_900,
        publishedAt: new Date(),
      },
      {
        id: "p-tenis",
        title: "Tenis para correr ultraligeros",
        tags: ["running"],
        categoryId: "c",
        priceCents: 149_900,
        publishedAt: new Date(),
      },
    ]);
    // Aunque la consulta trajera de más, el DTO solo copia campos públicos.
    vi.mocked(queries.getIntentProductCard).mockResolvedValue({
      slug: "tenis",
      title: "Tenis para correr ultraligeros",
      priceCents: 149_900,
      currency: "MXN",
      city: "Guadalajara",
      image: null,
      unitCostCents: 90_000,
    } as Awaited<ReturnType<typeof queries.getIntentProductCard>>);

    const highlight = await getIntentHighlight(OWNER);
    // El presupuesto y la dueña (para no sugerirle sus propios productos) llegan a la consulta.
    expect(queries.listIntentProductPool).toHaveBeenCalledWith(OWNER, 200_000);
    expect(queries.getIntentProductCard).toHaveBeenCalledWith("p-tenis");
    expect(highlight?.product?.slug).toBe("tenis");
    expect(JSON.stringify(highlight)).not.toMatch(/cost/i);
  });

  it("si nada coincide, muestra la intención sin producto", async () => {
    vi.mocked(queries.findActiveIntent).mockResolvedValue(intent);
    vi.mocked(queries.listIntentProductPool).mockResolvedValue([]);
    const highlight = await getIntentHighlight(OWNER);
    expect(highlight?.product).toBeNull();
    expect(queries.getIntentProductCard).not.toHaveBeenCalled();
  });
});

describe("dismissSuggestion", () => {
  it("no se puede quitar a una misma ni a alguien que no existe", async () => {
    await expect(dismissSuggestion(OWNER, OWNER)).resolves.toBe("invalid");
    vi.mocked(queries.userExists).mockResolvedValue(false);
    await expect(dismissSuggestion(OWNER, OTHER)).resolves.toBe("invalid");
    expect(queries.createSuggestionDismissal).not.toHaveBeenCalled();
  });

  it("guarda el descarte", async () => {
    vi.mocked(queries.userExists).mockResolvedValue(true);
    await expect(dismissSuggestion(OWNER, OTHER)).resolves.toBe("dismissed");
    expect(queries.createSuggestionDismissal).toHaveBeenCalledWith(OWNER, OTHER);
  });
});

describe("getPeopleSuggestions", () => {
  function person(id: string, seller = false) {
    return {
      id,
      profile: { username: `u${id}`, displayName: `Persona ${id}`, avatarUrl: null },
      sellerProfile: seller ? { status: "ACTIVE" as const } : null,
    };
  }

  function mockSignals() {
    vi.mocked(queries.listMutualFollowIds).mockResolvedValue(["f1", "f2"]);
    vi.mocked(queries.listMembershipCommunityIds).mockResolvedValue(["gaming"]);
    vi.mocked(queries.countCommentersOnPostsOf).mockResolvedValue(new Map([["3", 1]]));
    vi.mocked(queries.countFollowedByFollowing).mockResolvedValue(new Map([["1", 2]]));
  }

  it("con menos de 3 candidatos reales no devuelve nada", async () => {
    mockSignals();
    vi.mocked(queries.listActiveCommunityPeers).mockResolvedValue([]);
    await expect(getPeopleSuggestions("viewer-a")).resolves.toEqual([]);
    expect(queries.listSuggestionProfiles).not.toHaveBeenCalled();
  });

  it("ordena, explica y marca las tiendas; ignora a quien ya no es elegible", async () => {
    mockSignals();
    vi.mocked(queries.listActiveCommunityPeers).mockResolvedValue(["2", "4"]);
    vi.mocked(queries.listSharedCommunityNames).mockResolvedValue(
      new Map([
        ["2", ["Gaming"]],
        ["4", ["Gaming"]],
      ]),
    );
    // "4" dejó de ser elegible (p. ej. desactivó «Aparecer en sugerencias»): no vuelve.
    vi.mocked(queries.listSuggestionProfiles).mockResolvedValue([
      person("1"),
      person("2", true),
      person("3"),
    ]);

    const people = await getPeopleSuggestions("viewer-b");
    expect(people).toEqual([
      expect.objectContaining({ userId: "1", reason: "La siguen personas que sigues" }),
      expect.objectContaining({ userId: "3", reason: "Comentó tu publicación" }),
      expect.objectContaining({ userId: "2", reason: "También está en Gaming", isStore: true }),
    ]);
  });

  it("entre miembros con lo mismo en común, va primero quien tuvo actividad más reciente", async () => {
    vi.mocked(queries.listMutualFollowIds).mockResolvedValue([]);
    vi.mocked(queries.listMembershipCommunityIds).mockResolvedValue(["gaming"]);
    vi.mocked(queries.countCommentersOnPostsOf).mockResolvedValue(new Map());
    vi.mocked(queries.countFollowedByFollowing).mockResolvedValue(new Map());
    // La consulta ya los trae del más activo al menos activo (no por antigüedad de la cuenta).
    vi.mocked(queries.listActiveCommunityPeers).mockResolvedValue(["9", "5", "7"]);
    vi.mocked(queries.listSharedCommunityNames).mockResolvedValue(
      new Map([
        ["5", ["Gaming"]],
        ["7", ["Gaming"]],
        ["9", ["Gaming"]],
      ]),
    );
    vi.mocked(queries.listSuggestionProfiles).mockResolvedValue([
      person("5"),
      person("7"),
      person("9"),
    ]);

    const people = await getPeopleSuggestions("viewer-c");
    expect(queries.listActiveCommunityPeers).toHaveBeenCalledWith("viewer-c", ["gaming"]);
    expect(people.map((entry) => entry.userId)).toEqual(["9", "5", "7"]);
    expect(people.every((entry) => entry.reason === "También está en Gaming")).toBe(true);
  });

  it("la señal de seguidos usa solo seguidos mutuos y nunca delata a uno solo (SEC-17)", async () => {
    vi.mocked(queries.listMutualFollowIds).mockResolvedValue(["mutuo-1", "mutuo-2"]);
    vi.mocked(queries.listMembershipCommunityIds).mockResolvedValue([]);
    vi.mocked(queries.countCommentersOnPostsOf).mockResolvedValue(new Map());
    // Aunque la consulta devolviera candidatos con un solo intermediario, no se sugieren.
    vi.mocked(queries.countFollowedByFollowing).mockResolvedValue(
      new Map([
        ["t1", 1],
        ["t2", 1],
        ["t3", 1],
      ]),
    );
    vi.mocked(queries.listActiveCommunityPeers).mockResolvedValue([]);
    vi.mocked(queries.listSharedCommunityNames).mockResolvedValue(new Map());
    vi.mocked(queries.listSuggestionProfiles).mockResolvedValue([
      person("t1"),
      person("t2"),
      person("t3"),
    ]);

    await expect(getPeopleSuggestions("viewer-e")).resolves.toEqual([]);
    expect(queries.countFollowedByFollowing).toHaveBeenCalledWith("viewer-e", [
      "mutuo-1",
      "mutuo-2",
    ]);
  });

  it("las únicas fuentes son personas en común, comunidades y comentarios (nunca «me gusta»)", async () => {
    mockSignals();
    vi.mocked(queries.listActiveCommunityPeers).mockResolvedValue(["2"]);
    vi.mocked(queries.listSharedCommunityNames).mockResolvedValue(new Map([["2", ["Gaming"]]]));
    vi.mocked(queries.listSuggestionProfiles).mockResolvedValue([
      person("1"),
      person("2"),
      person("3"),
    ]);

    const people = await getPeopleSuggestions("viewer-d");
    expect(people.map((entry) => entry.reason)).toEqual([
      "La siguen personas que sigues",
      "Comentó tu publicación",
      "También está en Gaming",
    ]);
    expect(JSON.stringify(people)).not.toMatch(/gust/i);
  });
});
