import { describe, expect, it } from "vitest";
import { cleanDraftBody, comparableText, DRAFT_MAX_CHARS } from "./draft-text";

describe("cleanDraftBody", () => {
  it("deja pasar un texto normal con sus emojis", () => {
    const text =
      "En el equipo nos gusta saber qué te divierte. ¿Prefieres un meme o una buena anécdota? 😂";
    expect(cleanDraftBody(text)).toBe(text);
  });

  it("quita comillas envolventes, Markdown, viñetas y hashtags", () => {
    expect(
      cleanDraftBody(
        '"**Consejo del día:** guarda tus especias lejos de la estufa. ¿Tú dónde las guardas? #cocina #tips"',
      ),
    ).toBe("Consejo del día: guarda tus especias lejos de la estufa. ¿Tú dónde las guardas?");
    expect(
      cleanDraftBody("## Tres ideas\n- Ordena por colores.\n- Dona lo que no usas.\n* Etiqueta."),
    ).toBe("Tres ideas\n\nOrdena por colores.\n\nDona lo que no usas.\n\nEtiqueta.");
  });

  it("quita las oraciones con ligas, usuarios, teléfonos o correos", () => {
    expect(
      cleanDraftBody(
        "Nos encanta leer sus recomendaciones de lugares para comer. Escríbenos a hola@ejemplo.com o al 55 1234 5678. Visita www.ejemplo.mx para más. Sigue a @alguien. ¿Cuál es tu lugar favorito?",
      ),
    ).toBe(
      "Nos encanta leer sus recomendaciones de lugares para comer. ¿Cuál es tu lugar favorito?",
    );
  });

  it("quita las oraciones con montos o porcentajes: la IA no tiene datos que citar", () => {
    expect(
      cleanDraftBody(
        "Arma tu outfit con lo que ya tienes en casa. Ahorra hasta $500 en tu próxima compra. El 80 % de la gente lo hace mal. Te sale en 300 pesos. ¿Qué prenda rescatas siempre?",
      ),
    ).toBe("Arma tu outfit con lo que ya tienes en casa. ¿Qué prenda rescatas siempre?");
    // Un número suelto no es una cifra inventada.
    expect(
      cleanDraftBody("Comparte 3 trucos para ordenar tu clóset en 10 minutos, por favor."),
    ).toBe("Comparte 3 trucos para ordenar tu clóset en 10 minutos, por favor.");
  });

  it("corta por oraciones completas al pasar del largo máximo", () => {
    const sentence = "Esta oración mide lo suficiente para llenar el espacio poco a poco.";
    const cleaned = cleanDraftBody(Array.from({ length: 20 }, () => sentence).join(" "));
    expect(cleaned.length).toBeLessThanOrEqual(DRAFT_MAX_CHARS);
    expect(cleaned.endsWith("poco a poco.")).toBe(true);
    expect(cleaned.length).toBeGreaterThan(DRAFT_MAX_CHARS - sentence.length - 1);
  });

  it("no hay borrador si queda vacío o demasiado corto", () => {
    expect(cleanDraftBody("")).toBe("");
    expect(cleanDraftBody("¿Y tú?")).toBe("");
    expect(cleanDraftBody("Escríbenos al 55 1234 5678 para saber más de esto hoy.")).toBe("");
  });

  it("conserva los párrafos y normaliza espacios y saltos", () => {
    expect(
      cleanDraftBody(
        "Primera idea   para   la comunidad.\r\n\r\n\r\nSegunda idea, con pregunta: ¿qué opinas?",
      ),
    ).toBe("Primera idea para la comunidad.\n\nSegunda idea, con pregunta: ¿qué opinas?");
  });
});

describe("comparableText", () => {
  it("iguala textos que solo difieren en mayúsculas, acentos, signos o emojis", () => {
    expect(comparableText("¿Qué PREFIERES: tacos o tortas? 🌮")).toBe(
      comparableText("que prefieres tacos o tortas"),
    );
    expect(comparableText("tacos o tortas")).not.toBe(comparableText("tortas o tacos"));
  });
});
