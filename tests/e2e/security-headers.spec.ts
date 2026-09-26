import { expect, type Page, test } from "@playwright/test";

/**
 * SEC-06 (ADR-029): la CSP con nonce se aplica en modo estricto y ninguna página la viola. Cada
 * página se abre con un colector de violaciones (evento `securitypolicyviolation`, consola y errores
 * sin atrapar) y debe hidratarse: si el nonce no llegara a los scripts de Next, React no arrancaría.
 */

type Collected = { violations: string[]; consoleErrors: string[]; pageErrors: string[] };

/** Registro, onboarding y «Comprar ahora» tardan más con el servidor de desarrollo ocupado. */
const ACTION_TIMEOUT = 45_000;

const CSP_CONSOLE = /content security policy|refused to (load|execute|apply|connect|frame)/i;

async function collect(page: Page): Promise<Collected> {
  const collected: Collected = { violations: [], consoleErrors: [], pageErrors: [] };
  // Los scripts de inicio de Playwright no pasan por la CSP de la página.
  await page.addInitScript(() => {
    const store: string[] = [];
    (window as unknown as { __csp?: string[] }).__csp = store;
    document.addEventListener("securitypolicyviolation", (event) => {
      store.push(`${event.effectiveDirective} ← ${event.blockedURI || "inline"}`);
    });
  });
  page.on("console", (message) => {
    if (message.type() === "error" && CSP_CONSOLE.test(message.text())) {
      collected.consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => collected.pageErrors.push(error.message));
  return collected;
}

/** La página cargó, se hidrató y el script del tema (con nonce) corrió; sin violaciones de CSP. */
async function expectCleanPage(page: Page, collected: Collected, label: string) {
  await page.waitForLoadState("load");
  // `window.next` lo define el runtime del App Router al arrancar: prueba que sus scripts corrieron.
  await expect
    .poll(() => page.evaluate(() => "next" in window), { message: `${label}: hidratada` })
    .toBe(true);
  // next-themes pone `light` o `dark` en <html> desde su script en línea (necesita el nonce).
  await expect(page.locator("html")).toHaveClass(/\b(light|dark)\b/);
  const violations = await page.evaluate(
    () => (window as unknown as { __csp?: string[] }).__csp ?? [],
  );
  expect(violations, `${label}: violaciones de CSP`).toEqual([]);
  expect(collected.consoleErrors, `${label}: errores de CSP en la consola`).toEqual([]);
  expect(collected.pageErrors, `${label}: errores sin atrapar`).toEqual([]);
}

async function visit(page: Page, collected: Collected, path: string) {
  const response = await page.goto(path);
  expect(response?.status(), `${path}: estado`).toBeLessThan(400);
  await expectCleanPage(page, collected, path);
}

function fixUser() {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return {
    name: "Prueba Seguridad",
    email: `e2e.fix.${id}@example.com`,
    password: "clave-de-prueba-segura",
    username: `e2e.fix.${id}`,
  };
}

test.describe("cabeceras de seguridad (SEC-06)", () => {
  test("las páginas HTML llevan CSP con nonce único, COOP y CORP", async ({ request }) => {
    const [first, second] = await Promise.all([request.get("/"), request.get("/entrar")]);
    const policies = [first, second].map((response) => {
      const headers = response.headers();
      expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
      expect(headers["cross-origin-resource-policy"]).toBe("same-origin");
      expect(headers["content-security-policy-report-only"]).toBeUndefined();
      return headers["content-security-policy"] ?? "";
    });

    for (const policy of policies) {
      const directives = new Map(
        policy.split(";").map((part) => {
          const [name = "", ...values] = part.trim().split(/\s+/);
          return [name, values] as const;
        }),
      );
      const scriptSrc = directives.get("script-src") ?? [];
      expect(scriptSrc).toContain("'strict-dynamic'");
      expect(scriptSrc.some((value) => /^'nonce-[A-Za-z0-9+/]{22}=='$/.test(value))).toBe(true);
      expect(scriptSrc).not.toContain("'unsafe-inline'");
      expect(directives.get("object-src")).toEqual(["'none'"]);
      expect(directives.get("base-uri")).toEqual(["'none'"]);
      expect(directives.get("frame-ancestors")).toEqual(["'none'"]);
      expect(directives.get("form-action")).toEqual(["'self'"]);
      expect(directives.get("connect-src")).toEqual(["'self'"]);
      expect(directives.get("img-src")).toEqual(["'self'", "data:", "blob:"]);
    }
    const nonce = (policy: string) => /'nonce-([^']+)'/.exec(policy)?.[1];
    expect(nonce(policies[0]!)).not.toBe(nonce(policies[1]!));
  });

  test("un nonce que mande el cliente se ignora", async ({ request }) => {
    const response = await request.get("/entrar", { headers: { "x-nonce": "atacante" } });
    const html = await response.text();

    expect(response.headers()["content-security-policy"]).not.toContain("atacante");
    expect(html).not.toContain('nonce="atacante"');
  });

  test("las fotos no pasan por el optimizador de Next: /media las sirve con permisos (SEC-35, ADR-039)", async ({
    request,
  }) => {
    const html = await (await request.get("/comprar")).text();
    expect(html).not.toContain("/_next/image?url=%2Fmedia");
    const [, path = "", width = ""] = /(\/media\/[^"?]+\.webp)\?w=(\d+)/.exec(html) ?? [];
    expect(path, "hay al menos una foto semilla en /comprar").not.toBe("");

    // Solo anchos permitidos y ningún otro parámetro.
    expect((await request.get(`${path}?w=${width}`)).status()).toBe(200);
    expect((await request.get(`${path}?w=123`)).status()).toBe(400);
    expect((await request.get(`${path}?v=1`)).status()).toBe(400);
    // El optimizador de Next ya no procesa nada.
    const optimizer = await request.get(`/_next/image?url=${encodeURIComponent(path)}&w=256&q=75`);
    expect(optimizer.status()).toBeGreaterThanOrEqual(400);
  });

  test("la CSP se aplica en modo estricto: un manejador en línea inyectado no corre", async ({
    page,
  }) => {
    // La primera visita puede compilar la página en desarrollo.
    test.setTimeout(120_000);
    const collected = await collect(page);
    await visit(page, collected, "/entrar");

    // Simula una inyección de HTML con un atributo `onerror` (el XSS clásico).
    const ran = await page.evaluate(async () => {
      const blocked = new Promise<string>((resolve) =>
        document.addEventListener("securitypolicyviolation", (event) =>
          resolve(event.effectiveDirective),
        ),
      );
      const holder = document.createElement("div");
      holder.innerHTML = '<img src="data:," onerror="window.__inyectado = true">';
      document.body.append(holder);
      const directive = await blocked;
      await new Promise((resolve) => setTimeout(resolve, 100));
      return {
        directive,
        executed: Boolean((window as unknown as { __inyectado?: boolean }).__inyectado),
      };
    });

    expect(ran.executed).toBe(false);
    expect(ran.directive).toMatch(/^script-src/);
  });

  test("ninguna página viola la CSP: visitante, registro, onboarding, Studio y checkout", async ({
    page,
  }) => {
    test.setTimeout(360_000);
    const collected = await collect(page);

    // Visitante.
    await visit(page, collected, "/");
    await visit(page, collected, "/entrar");
    await visit(page, collected, "/registro");
    await visit(page, collected, "/c/gaming");
    await page.goto("/comprar");
    const productHref = await page
      .locator('main a[href^="/producto/"]')
      .first()
      .getAttribute("href");
    expect(productHref, "hay al menos un producto semilla en /comprar").toBeTruthy();
    const productPath = productHref!.split("?")[0]!;
    await visit(page, collected, productPath);

    // Registro → /bienvenida (onboarding).
    const user = fixUser();
    await page.goto("/registro");
    await page.getByLabel("Nombre", { exact: true }).fill(user.name);
    await page.getByLabel("Correo").fill(user.email);
    await page.getByLabel("Contraseña").fill(user.password);
    await page.getByLabel(/Acepto los/).check();
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page).toHaveURL(/\/bienvenida/, { timeout: ACTION_TIMEOUT });
    await expectCleanPage(page, collected, "/bienvenida");

    await page.getByLabel("Nombre de usuario").fill(user.username);
    await page.getByText("Entretenerme").click();
    await page.getByRole("button", { name: "Siguiente" }).click();
    for (const community of ["Gaming", "Tecnología", "Comida"]) {
      await page.getByText(community, { exact: true }).click();
    }
    await page.getByRole("button", { name: "Siguiente" }).click();
    await page.getByRole("button", { name: "Empezar" }).click();
    await expect(page).toHaveURL("/", { timeout: ACTION_TIMEOUT });
    await expectCleanPage(page, collected, "/ (con sesión)");

    // Studio.
    await visit(page, collected, "/studio");
    await visit(page, collected, "/studio/vende-con-ia");

    // Checkout con un producto semilla en el carrito.
    await visit(page, collected, productPath);
    await page.getByRole("button", { name: "Comprar ahora" }).click();
    await expect(page).toHaveURL("/checkout", { timeout: ACTION_TIMEOUT });
    await expectCleanPage(page, collected, "/checkout");

    // Cambiar el tema inyecta un <style> temporal de next-themes (con nonce): no debe violar nada.
    await visit(page, collected, "/studio");
    const before = await page.locator("html").getAttribute("class");
    await page.getByRole("button", { name: "Cambiar entre tema claro y oscuro" }).first().click();
    await expect(page.locator("html")).not.toHaveAttribute("class", before ?? "");
    await expectCleanPage(page, collected, "/studio (cambio de tema)");
  });
});
