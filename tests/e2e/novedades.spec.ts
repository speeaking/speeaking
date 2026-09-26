import { type Browser, expect, type Page, test } from "@playwright/test";
import { register, type TestUser, uniqueUser } from "./helpers";

/**
 * F7 · «N nuevas» por comunidad. Cada proyecto usa una comunidad que ninguna otra prueba toca, para
 * que las corridas en paralelo (móvil y escritorio) no se sumen publicaciones entre sí.
 */
const COMMUNITY = {
  desktop: { slug: "autos", name: "Autos" },
  mobile: { slug: "hogar", name: "Hogar" },
} as const;

type Community = (typeof COMMUNITY)[keyof typeof COMMUNITY];

/** Onboarding con la comunidad de la prueba (y dos más: el mínimo es 3). */
async function onboardInto(page: Page, user: TestUser, community: Community) {
  await page.getByLabel("Nombre de usuario").fill(user.username);
  await page.getByText("Entretenerme").click();
  await page.getByRole("button", { name: "Siguiente" }).click();
  for (const name of [community.name, "Humor", "Música"]) {
    await page.getByText(name, { exact: true }).click();
  }
  await page.getByRole("button", { name: "Siguiente" }).click();
  await page.getByRole("button", { name: "Empezar" }).click();
  await expect(page).toHaveURL("/");
}

/** Otra cuenta (su propio navegador) que se une a la comunidad y publica ahí. */
async function newAuthor(browser: Browser, community: Community) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const user = uniqueUser();
  await register(page, user);
  await onboardInto(page, user, community);
  return { context, page };
}

async function publishIn(page: Page, community: Community, body: string) {
  await page.goto("/crear/publicacion");
  await page.getByLabel("¿Qué quieres compartir?").fill(body);
  await page.getByLabel("Comunidad", { exact: true }).selectOption(community.slug);
  await page.getByRole("button", { name: "Publicar" }).click();
  // Con el servidor de desarrollo ocupado (otras pruebas en paralelo), publicar puede tardar.
  await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}$/, { timeout: 45_000 });
}

/** Burbuja de filtro de la comunidad (móvil y escritorio): el conteo va en su nombre. */
const bubble = (page: Page, community: Community) =>
  page
    .getByRole("group", { name: "Filtra tu feed" })
    .getByRole("button", { name: new RegExp(`^${community.name}\\b`) });

/** Fila de «Tus comunidades» en la columna izquierda (solo escritorio). */
const railRow = (page: Page, community: Community) =>
  page
    .getByRole("region", { name: "Tus comunidades" })
    .getByRole("link", { name: new RegExp(`^${community.name}\\b`) });

/**
 * Lo que la persona ve y oye con una publicación nueva (o ninguna, con `null`): «1 nueva» en la
 * burbuja y, en escritorio, también en la columna, cuyo nombre accesible lo dice sin abreviar.
 */
async function expectNews(
  page: Page,
  community: Community,
  desktop: boolean,
  label: "1 nueva" | null,
) {
  // La burbuja lleva el conteo en texto solo para lectores, con la misma frase que la columna.
  await expect(bubble(page, community)).toHaveAccessibleName(
    label ? `${community.name}, 1 publicación nueva` : community.name,
  );
  if (desktop) {
    await expect(railRow(page, community)).toHaveAccessibleName(
      label ? `${community.name}, 1 publicación nueva` : community.name,
    );
    if (label) await expect(railRow(page, community)).toContainText(label);
  }
}

test.describe("novedades por comunidad", () => {
  test("una publicación de otra persona se anuncia como «1 nueva» y se va al abrir la comunidad", async ({
    page,
    browser,
  }, testInfo) => {
    test.setTimeout(180_000);
    const desktop = testInfo.project.name === "desktop";
    const community = COMMUNITY[desktop ? "desktop" : "mobile"];

    // Quien lee: miembro de la comunidad desde el onboarding; todavía no hay nada nuevo.
    const reader = uniqueUser();
    await register(page, reader);
    await onboardInto(page, reader, community);
    await expectNews(page, community, desktop, null);

    // Otra cuenta publica ahí. Lo propio nunca es «nuevo» para quien lo publicó.
    const author = await newAuthor(browser, community);
    await publishIn(
      author.page,
      community,
      "Novedad de prueba (F7): ¿quién más viene al encuentro del sábado?",
    );
    await author.page.goto("/");
    await expectNews(author.page, community, desktop, null);

    await page.reload();
    await expectNews(page, community, desktop, "1 nueva");

    // Abrir la comunidad la marca como vista.
    if (desktop) {
      await railRow(page, community).click();
    } else {
      await page.goto(`/c/${community.slug}`);
    }
    await expect(page).toHaveURL(`/c/${community.slug}`);
    await expect(page.getByRole("heading", { level: 1, name: community.name })).toBeVisible();
    if (desktop) {
      // Ya no cuenta dentro de la comunidad, ni al volver sin recargar (la columna no se repinta).
      await expect(railRow(page, community)).toHaveAccessibleName(community.name);
      await page
        .getByRole("navigation", { name: "Navegación principal" })
        .getByRole("link", { name: "Inicio" })
        .click();
      await expect(page).toHaveURL("/");
      await expect(railRow(page, community)).toHaveAccessibleName(community.name);
    }

    // Y el servidor lo recuerda: con la página recién cargada ya no aparece.
    await expect(async () => {
      await page.goto("/");
      await expectNews(page, community, desktop, null);
    }).toPass({ timeout: 20_000 });

    // Lo que llega después de la visita vuelve a ser nuevo.
    await publishIn(
      author.page,
      community,
      "Otra novedad de prueba (F7): ya hay fecha para el siguiente.",
    );
    await page.reload();
    await expectNews(page, community, desktop, "1 nueva");

    await author.context.close();
  });
});
