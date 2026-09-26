import { describe, expect, it } from "vitest";
import {
  type DebateCandidate,
  debateExcerpt,
  isOpenQuestion,
  selectDebates,
  selectDebatesPreferring,
} from "./debates";

const NOW = new Date("2026-09-25T12:00:00Z").getTime();
const HOUR = 3_600_000;

function question(
  overrides: Partial<DebateCandidate> & { id: string; hoursAgo?: number },
): DebateCandidate {
  const { hoursAgo = 1, ...rest } = overrides;
  return {
    body: "¿Cuál es tu favorito?",
    communityId: `community-${overrides.id}`,
    commentCount: 0,
    publishedAt: new Date(NOW - hoursAgo * HOUR),
    ...rest,
  };
}

describe("isOpenQuestion", () => {
  it.each([
    "¿Manual o automático?",
    "Pregunta seria: ¿los chilaquiles van con frijoles al lado o no? 🍳",
    "¿El mejor concierto al que has ido?  ",
    "¿Neta?!",
    "¿Quién gana el clásico? 👍🏽",
    "¿Y tú qué opinas?»",
  ])("«%s» es una pregunta abierta", (body) => {
    expect(isOpenQuestion(body)).toBe(true);
  });

  it.each([
    "Debate del día: ¿control o teclado? Argumenta tu respuesta. 🎯",
    "Hoy estrenamos receta.",
    "¿Qué tal? Les cuento que ya abrí mi tienda",
    "",
  ])("«%s» no termina en pregunta", (body) => {
    expect(isOpenQuestion(body)).toBe(false);
  });
});

describe("selectDebates", () => {
  it("toma hasta 4, la más reciente primero, una por comunidad", () => {
    const { items } = selectDebates([
      question({ id: "a", hoursAgo: 5 }),
      question({ id: "b", hoursAgo: 1 }),
      question({ id: "c", hoursAgo: 2, communityId: "community-b" }),
      question({ id: "d", hoursAgo: 3 }),
      question({ id: "e", hoursAgo: 4 }),
      question({ id: "f", hoursAgo: 6 }),
    ]);
    expect(items.map((item) => item.id)).toEqual(["b", "d", "e", "a"]);
  });

  it("descarta lo que no es pregunta y lo que no pertenece a una comunidad", () => {
    const { items } = selectDebates([
      question({ id: "a", body: "Solo un aviso." }),
      question({ id: "b", communityId: null }),
      question({ id: "c" }),
    ]);
    expect(items.map((item) => item.id)).toEqual(["c"]);
  });

  it("avisa si ninguna tiene respuestas (una sola invitación en la interfaz)", () => {
    expect(selectDebates([question({ id: "a" }), question({ id: "b" })]).anyAnswered).toBe(false);
    expect(
      selectDebates([question({ id: "a" }), question({ id: "b", commentCount: 2 })]).anyAnswered,
    ).toBe(true);
  });

  it("sin candidatos devuelve una lista vacía", () => {
    expect(selectDebates([])).toEqual({ items: [], anyAnswered: false });
  });
});

describe("selectDebatesPreferring", () => {
  it("prefiere tus comunidades y completa con otras sin repetir comunidad", () => {
    const yours = [question({ id: "a", hoursAgo: 9, communityId: "comida" })];
    const others = [
      question({ id: "a", hoursAgo: 9, communityId: "comida" }),
      question({ id: "b", hoursAgo: 1, communityId: "comida" }),
      question({ id: "c", hoursAgo: 2, communityId: "moda" }),
      question({ id: "d", hoursAgo: 3, communityId: "hogar", commentCount: 1 }),
    ];
    const selection = selectDebatesPreferring(yours, others, 3);
    expect(selection.items.map((item) => item.id)).toEqual(["a", "c", "d"]);
    expect(selection.fromOthers).toBe(2);
    expect(selection.anyAnswered).toBe(true);
  });

  it("si tus comunidades bastan, no usa otras", () => {
    const yours = ["a", "b", "c", "d"].map((id) => question({ id }));
    const selection = selectDebatesPreferring(yours, [question({ id: "z" })]);
    expect(selection.fromOthers).toBe(0);
    expect(selection.items).toHaveLength(4);
  });
});

describe("debateExcerpt", () => {
  it("deja intactos los textos cortos y recorta los largos sin partir palabras", () => {
    expect(debateExcerpt("  ¿Manual   o automático?  ")).toBe("¿Manual o automático?");
    const long = `${"palabra ".repeat(40)}¿final?`;
    const excerpt = debateExcerpt(long, 50);
    expect(excerpt.length).toBeLessThanOrEqual(51);
    expect(excerpt.endsWith("palabra…")).toBe(true);
  });
});
