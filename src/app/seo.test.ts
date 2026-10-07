import { describe, expect, it } from "vitest";
import { siteConfig } from "@/config/site";
import { communitySeo, siteStructuredData } from "./seo";

describe("siteStructuredData (la organización y el sitio, para buscadores y asistentes)", () => {
  it("la organización sirve a todo México y el sitio está en español de México", () => {
    const [organization, website] = siteStructuredData();

    expect(organization).toMatchObject({
      "@type": "Organization",
      "@id": "https://www.speeaking.com/#organization",
      name: "speeaking",
      url: "https://www.speeaking.com",
      areaServed: { "@type": "Country", name: "México", identifier: "MX" },
    });
    expect(website).toMatchObject({
      "@type": "WebSite",
      inLanguage: "es-MX",
      publisher: { "@id": "https://www.speeaking.com/#organization" },
    });
  });

  it("liga los perfiles oficiales de la marca solo cuando existen (nada inventado)", () => {
    expect(siteStructuredData({ ...siteConfig, socialProfiles: [] })[0]).not.toHaveProperty(
      "sameAs",
    );
    expect(
      siteStructuredData({
        ...siteConfig,
        socialProfiles: [
          "https://www.instagram.com/speeaking",
          "https://www.tiktok.com/@speeaking",
        ],
      })[0],
    ).toMatchObject({
      sameAs: ["https://www.instagram.com/speeaking", "https://www.tiktok.com/@speeaking"],
    });
  });

  it("declara los perfiles oficiales de speeaking en Facebook y TikTok", () => {
    expect(siteStructuredData()[0]).toMatchObject({
      sameAs: [
        "https://www.facebook.com/profile.php?id=61594925560925",
        "https://www.tiktok.com/@speeaking",
      ],
    });
  });
});

describe("communitySeo (título y descripción de una comunidad para buscadores)", () => {
  it("dice que es una comunidad en México y completa la frase corta de la comunidad", () => {
    expect(communitySeo({ name: "Hogar", description: "Deco, plantas, orden y cocina." })).toEqual({
      title: "Hogar: comunidad en México",
      description:
        "Deco, plantas, orden y cocina. Publicaciones, preguntas y productos de la comunidad Hogar en speeaking, la red social de México.",
    });
  });

  it("sin descripción, no deja un punto suelto", () => {
    expect(communitySeo({ name: "Gaming", description: "  " }).description).toBe(
      "Publicaciones, preguntas y productos de la comunidad Gaming en speeaking, la red social de México.",
    );
  });
});
