import { describe, expect, it } from "vitest";
import type { FeedItemDTO } from "@/modules/feed/dto";
import {
  communitiesInCommonText,
  joinedText,
  peopleInCommonText,
  profileCover,
  profilePhotos,
} from "./profile-copy";

describe("peopleInCommonText", () => {
  it("nombra hasta tres personas y cuenta el resto", () => {
    expect(peopleInCommonText(["Ana"], 1)).toBe("Entre quienes sigues: Ana");
    expect(peopleInCommonText(["Ana", "Luis"], 2)).toBe("Entre quienes sigues: Ana y Luis");
    expect(peopleInCommonText(["Ana", "Luis", "Mar"], 3)).toBe(
      "Entre quienes sigues: Ana, Luis y Mar",
    );
    expect(peopleInCommonText(["Ana", "Luis", "Mar"], 4)).toBe(
      "Entre quienes sigues: Ana, Luis, Mar y 1 más",
    );
    expect(peopleInCommonText(["Ana", "Luis", "Mar", "Sol"], 9)).toBe(
      "Entre quienes sigues: Ana, Luis, Mar y 6 más",
    );
  });

  it("sin nadie en común no dice nada", () => {
    expect(peopleInCommonText([], 0)).toBeNull();
    expect(peopleInCommonText([], 3)).toBeNull();
  });
});

describe("communitiesInCommonText", () => {
  it("lista hasta tres comunidades con «y»", () => {
    expect(communitiesInCommonText(["Gaming"])).toBe("Comparten Gaming");
    expect(communitiesInCommonText(["Gaming", "Moda"])).toBe("Comparten Gaming y Moda");
    expect(communitiesInCommonText(["Gaming", "Moda", "Autos", "Humor"])).toBe(
      "Comparten Gaming, Moda y Autos",
    );
    expect(communitiesInCommonText([])).toBeNull();
  });
});

describe("joinedText", () => {
  it("dice el mes y el año en español", () => {
    expect(joinedText(new Date("2026-09-15T12:00:00Z"))).toBe("Desde septiembre de 2026");
  });
});

function post(id: string, urls: string[]): FeedItemDTO {
  return {
    id,
    media: urls.map((url) => ({
      url,
      width: 800,
      height: 1000,
      blurDataUrl: null,
      alt: null,
      credit: null,
    })),
  } as unknown as FeedItemDTO;
}

describe("profileCover y profilePhotos", () => {
  it("la portada es la primera foto de la publicación más reciente con fotos", () => {
    expect(profileCover([post("a", []), post("b", ["/b1", "/b2"]), post("c", ["/c1"])])?.url).toBe(
      "/b1",
    );
    expect(profileCover([post("a", [])])).toBeNull();
  });

  it("las fotos van en orden de publicación, con su publicación, y se cortan al tope", () => {
    const photos = profilePhotos([post("a", ["/a1", "/a2"]), post("b", ["/b1"])], 2);
    expect(photos.map((photo) => [photo.postId, photo.media.url])).toEqual([
      ["a", "/a1"],
      ["a", "/a2"],
    ]);
  });
});
