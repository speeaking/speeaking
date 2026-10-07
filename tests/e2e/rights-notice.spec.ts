import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import {
  completeOnboarding,
  register,
  registerAndOnboard,
  uniqueUser,
  waitForHydration,
} from "./helpers";

// Aviso y retirada (ADR-076, LFDA art. 114 Octies): el aviso funciona sin cuenta y da un número de
// caso; una persona del equipo retira el contenido; deja de verse y quien lo publicó recibe el aviso
// con el caso y cómo responder.

/** Corre el script real contra la base de desarrollo (la misma que usa la suite). */
function makeAdmin(email: string) {
  return execSync(["pnpm exec tsx scripts/make-admin.ts", email].join(" "), {
    encoding: "utf8",
    timeout: 90_000,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

test("aviso de derechos sin cuenta: número de caso, el equipo retira y quien publicó se entera", async ({
  page,
  browser,
}) => {
  test.slow();
  const author = await registerAndOnboard(page);
  await page.goto("/crear/publicacion");
  const text = page.getByLabel("¿Qué quieres compartir?");
  await waitForHydration(text);
  await text.fill(`Mi foto del atardecer en Bacalar, ${author.username}`);
  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}$/);
  const postPath = new URL(page.url()).pathname;

  // Quien reclama no tiene cuenta.
  const visitor = await browser.newContext();
  const claimant = await visitor.newPage();
  await claimant.goto("/derechos-de-autor#aviso");
  const kind = claimant.getByLabel(/^Derechos de autor \(foto/);
  await waitForHydration(kind);
  await kind.check();
  await claimant.getByLabel("Soy titular del derecho").check();
  await claimant.getByLabel("Tu nombre completo o razón social").fill("Fotógrafa de Prueba");
  await claimant.getByLabel("Correo", { exact: true }).fill(`e2e.avisa.${Date.now()}@example.com`);
  await claimant
    .getByLabel("Direcciones del contenido en speeaking")
    .fill(`https://www.speeaking.com${postPath}`);
  await claimant
    .getByLabel("¿Qué obra, marca o interpretación es?")
    .fill("Fotografía «Atardecer en Bacalar», publicada en mi portafolio en 2024.");
  await claimant
    .getByLabel("¿Qué derecho tienes sobre ella?")
    .fill("Soy la autora y titular de los derechos patrimoniales.");
  // Las dos declaraciones nunca vienen marcadas.
  const sworn = claimant.getByLabel(/Declaro bajo protesta de decir verdad/);
  const penalty = claimant.getByLabel(/Sé que un aviso falso/);
  await expect(sworn).not.toBeChecked();
  await expect(penalty).not.toBeChecked();
  await sworn.check();
  await penalty.check();
  await claimant.getByRole("button", { name: "Enviar aviso" }).click();

  const receipt = claimant.getByRole("status").filter({ hasText: "Recibimos tu aviso" });
  await expect(receipt).toBeVisible();
  const caseNumber = (await receipt.textContent())?.match(/DA-\d{6}/)?.[0];
  expect(caseNumber).toBeTruthy();

  // Una persona del equipo lo revisa y retira el contenido.
  const team = await browser.newContext();
  const adminPage = await team.newPage();
  const admin = uniqueUser();
  await register(adminPage, admin);
  await completeOnboarding(adminPage, admin);
  makeAdmin(admin.email);
  await adminPage.goto(`/admin/avisos/${caseNumber}`);
  await expect(adminPage.getByText(postPath)).toBeVisible();
  await adminPage.getByRole("button", { name: "Retirar contenido" }).click();
  await expect(
    adminPage
      .getByText("Caso cerrado: no hay acciones pendientes.")
      .or(adminPage.getByRole("button", { name: "Restaurar" })),
  ).toBeVisible();

  // Ya no se ve para nadie más.
  await claimant.goto(postPath);
  await expect(claimant.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();

  // Quien lo publicó recibe el aviso con el número de caso.
  await page.goto("/avisos");
  await expect(page.getByText(new RegExp(`Retiramos tu publicación.*${caseNumber}`))).toBeVisible();

  await visitor.close();
  await team.close();
});
