import { describe, expect, it } from "vitest";
import {
  FOLLOWING,
  FOR_YOU,
  filterAnnouncement,
  filterKey,
  filterParams,
  isSameFilter,
} from "./feed-filter";

const gaming = { kind: "community", slug: "gaming", name: "Gaming" } as const;

describe("filtros del inicio", () => {
  it("cada filtro tiene una llave estable", () => {
    expect(filterKey(FOR_YOU)).toBe("for-you");
    expect(filterKey(FOLLOWING)).toBe("following");
    expect(filterKey(gaming)).toBe("community:gaming");
    expect(isSameFilter(gaming, { ...gaming })).toBe(true);
    expect(isSameFilter(gaming, FOR_YOU)).toBe(false);
  });

  it("pide a /api/feed la comunidad o «Siguiendo»; «Para ti» va sin parámetros", () => {
    expect(filterParams(FOR_YOU).toString()).toBe("");
    expect(filterParams(FOLLOWING).toString()).toBe("following=1");
    expect(filterParams(gaming).toString()).toBe("community=gaming");
  });

  it("anuncia el cambio con palabras", () => {
    expect(filterAnnouncement(gaming)).toBe("Mostrando publicaciones de Gaming");
    expect(filterAnnouncement(FOLLOWING)).toBe(
      "Mostrando publicaciones de las personas que sigues",
    );
  });
});
