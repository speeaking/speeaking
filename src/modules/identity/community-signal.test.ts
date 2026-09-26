import { describe, expect, it } from "vitest";
import { communitySignal, MIN_VISIBLE_MEMBERS } from "./community-signal";

describe("communitySignal", () => {
  it("muestra los miembros a partir del umbral", () => {
    expect(communitySignal({ memberCount: MIN_VISIBLE_MEMBERS, postCount: 0 })).toBe("10 miembros");
    expect(communitySignal({ memberCount: 1_250, postCount: 3 })).toBe("1,250 miembros");
  });

  it("con pocos miembros no muestra el número y habla del contenido", () => {
    expect(communitySignal({ memberCount: 3, postCount: 24 })).toBe(
      "Comunidad nueva · 24 publicaciones",
    );
    expect(communitySignal({ memberCount: 1, postCount: 1 })).toBe(
      "Comunidad nueva · 1 publicación",
    );
  });

  it("sin miembros ni publicaciones solo dice que es nueva", () => {
    expect(communitySignal({ memberCount: 0, postCount: 0 })).toBe("Comunidad nueva");
  });
});
