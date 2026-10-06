import { describe, expect, it } from "vitest";
import { siteConfig } from "@/config/site";
import { siteStructuredData } from "./seo";

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
});
