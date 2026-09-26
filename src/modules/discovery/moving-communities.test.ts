import { describe, expect, it } from "vitest";
import { rankMovingCommunities } from "./moving-communities";

const communities = [
  { id: "gaming", sortOrder: 2 },
  { id: "comida", sortOrder: 1 },
  { id: "humor", sortOrder: 0 },
  { id: "hogar", sortOrder: 3 },
];

describe("rankMovingCommunities", () => {
  it("ordena por publicaciones y calcula la barra respecto a la más activa", () => {
    const ranked = rankMovingCommunities(
      [
        { communityId: "comida", posts: 3 },
        { communityId: "gaming", posts: 6 },
        { communityId: "humor", posts: 6 },
      ],
      communities,
    );
    expect(ranked.map((entry) => [entry.community.id, entry.posts, entry.share])).toEqual([
      ["humor", 6, 1],
      ["gaming", 6, 1],
      ["comida", 3, 0.5],
    ]);
  });

  it("omite ceros y comunidades desconocidas, y respeta el límite", () => {
    const ranked = rankMovingCommunities(
      [
        { communityId: "hogar", posts: 0 },
        { communityId: "borrada", posts: 9 },
        { communityId: "gaming", posts: 1 },
        { communityId: "comida", posts: 2 },
      ],
      communities,
      1,
    );
    expect(ranked.map((entry) => entry.community.id)).toEqual(["comida"]);
  });

  it("sin actividad devuelve una lista vacía", () => {
    expect(rankMovingCommunities([], communities)).toEqual([]);
  });
});
