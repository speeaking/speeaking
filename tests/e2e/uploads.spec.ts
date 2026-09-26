import { deflateSync } from "node:zlib";
import { expect, type Page, test } from "@playwright/test";
import sharp from "sharp";
import { completeOnboarding, register, TINY_PNG, uniqueUser } from "./helpers";

/**
 * Subidas y `/media` contra el servidor real (SEC-03, SEC-12, SEC-13, SEC-14). Cada prueba usa una
 * cuenta nueva: los límites son por cuenta y no se pisan entre proyectos (móvil y escritorio).
 */

const MB = 1024 * 1024;

/** Cuenta nueva con perfil terminado, con el prefijo de las cuentas de estas pruebas (`e2e.fix.*`). */
async function registerAndOnboard(page: Page) {
  const base = uniqueUser();
  const id = base.username.slice("e2e.".length);
  const user = { ...base, email: `e2e.fix.${id}@example.com`, username: `e2e.fix${id}` };
  await register(page, user);
  await completeOnboarding(page, user);
  await expect(page).toHaveURL("/");
  return user;
}

/** Cookie de sesión del navegador para peticiones hechas con `fetch` de Node (cuerpos en stream). */
async function sessionCookie(page: Page) {
  const cookies = await page.context().cookies();
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

function crc32(bytes: Buffer) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** PNG de ~70 bytes cuya cabecera declara 6320×6320 RGBA de 16 bits (el pixel-flood del PoC). */
function pixelFloodPng() {
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(6320, 0);
  header.writeUInt32BE(6320, 4);
  header[8] = 16;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.alloc(16))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const image = (buffer: Buffer, name = "foto.png") => ({
  multipart: { file: { name, mimeType: "image/png", buffer } },
});

test.describe("subidas (SEC-03, SEC-12, SEC-13, SEC-14)", () => {
  test("SEC-03: sin Content-Length (chunked) o con uno mayor al tope, se rechaza sin leer el cuerpo", async ({
    page,
    baseURL,
  }) => {
    await registerAndOnboard(page);
    const cookie = await sessionCookie(page);
    const headers = {
      Cookie: cookie,
      Origin: baseURL!,
      "Content-Type": "multipart/form-data; boundary=----vendeia",
    };

    // 200 MB en stream (Transfer-Encoding: chunked). Antes se leía completo (~800 MB de RAM) → 422.
    // A ~50 MB/s: la respuesta llega mientras el cliente sigue mandando (a toda velocidad, el cierre
    // de la conexión puede ganarle a la respuesta y `fetch` ve un ECONNRESET en su lugar).
    let sentMb = 0;
    const endless = new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (sentMb >= 200) return controller.close();
        sentMb += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        controller.enqueue(new Uint8Array(MB));
      },
    });
    const chunked = await fetch(`${baseURL}/api/uploads`, {
      method: "POST",
      headers,
      body: endless,
      duplex: "half",
    } as RequestInit);
    // 411 se decide con las cabeceras: si el servidor hubiera leído el cuerpo, respondería 422.
    expect(chunked.status).toBe(411);

    const tooBig = await fetch(`${baseURL}/api/uploads`, {
      method: "POST",
      headers,
      body: new Uint8Array(11 * MB),
    });
    expect(tooBig.status).toBe(413);

    const notAForm = await page.request.post("/api/uploads", {
      data: "hola",
      headers: { "Content-Type": "text/plain" },
    });
    expect(notAForm.status()).toBe(415);

    // ~6 MB de partes diminutas: el parser de formData las recorría en el hilo principal (~0.3 s).
    const boundary = "----vendeia";
    const parts = Array.from(
      { length: 100_000 },
      (_, index) =>
        `--${boundary}\r\nContent-Disposition: form-data; name="f${index}"\r\n\r\nv\r\n`,
    );
    const manyParts = await fetch(`${baseURL}/api/uploads`, {
      method: "POST",
      headers: { ...headers, "Content-Type": `multipart/form-data; boundary=${boundary}` },
      body: `${parts.join("")}--${boundary}--\r\n`,
    });
    expect(manyParts.status).toBe(400);
    expect(await manyParts.json()).toEqual({ error: "Envía una sola imagen por subida." });
  });

  test("SEC-13: un AVIF de ~1 KB que declara 25 Mpx (~440 MB al decodificarlo) se rechaza", async ({
    page,
  }) => {
    await registerAndOnboard(page);
    const bomb = await sharp({
      create: { width: 5000, height: 5000, channels: 3, background: "#e4007c" },
      limitInputPixels: false,
    })
      .avif({ effort: 0, quality: 30 })
      .toBuffer();

    const response = await page.request.post("/api/uploads", {
      multipart: { file: { name: "bomba.avif", mimeType: "image/avif", buffer: bomb } },
    });

    expect(response.status()).toBe(422);
    expect(await response.json()).toEqual({
      error: "La imagen tiene demasiados píxeles. Redúcela e intenta de nuevo.",
    });
  });

  test("SEC-13: un PNG de pocos bytes que declara 40 Mpx se rechaza por la cabecera", async ({
    page,
  }) => {
    await registerAndOnboard(page);

    const response = await page.request.post("/api/uploads", image(pixelFloodPng(), "flood.png"));

    // El archivo no trae píxeles reales: si se intentara decodificar fallaría como «No pudimos leer
    // la imagen». Este mensaje solo sale de revisar la cabecera antes de decodificar.
    expect(response.status()).toBe(422);
    expect(await response.json()).toEqual({
      error: "La imagen tiene demasiados píxeles. Redúcela e intenta de nuevo.",
    });
  });

  test("SEC-12: el límite por hora es atómico y cuenta también los intentos fallidos", async ({
    page,
  }) => {
    await registerAndOnboard(page);

    // 70 intentos inválidos en paralelo: exactamente 60 se procesan (415) y 10 se frenan (429).
    const statuses = await Promise.all(
      Array.from({ length: 70 }, () =>
        page.request
          .post("/api/uploads", { data: "x", headers: { "Content-Type": "text/plain" } })
          .then((response) => response.status()),
      ),
    );
    expect(statuses.filter((status) => status === 415)).toHaveLength(60);
    expect(statuses.filter((status) => status === 429)).toHaveLength(10);

    // Los fallidos gastaron el cupo: una imagen válida ya no pasa.
    const valid = await page.request.post("/api/uploads", image(TINY_PNG));
    expect(valid.status()).toBe(429);
    expect(Number(valid.headers()["retry-after"])).toBeGreaterThan(0);
    expect((await valid.json()).error).toMatch(/^Demasiados intentos\. Intenta de nuevo en/);
  });

  test("SEC-14: sin adjuntar solo la ve su dueño y sin caché; adjunta es pública con caché corta", async ({
    page,
    baseURL,
  }) => {
    // Registro, onboarding y una publicación completa: en móvil y con el servidor de desarrollo
    // compilando rutas, más de los 60 s por omisión.
    test.setTimeout(120_000);
    await registerAndOnboard(page);

    // Una subida que nunca se adjunta.
    const orphan = await page.request.post("/api/uploads", image(TINY_PNG));
    expect(orphan.status()).toBe(201);
    const { url: orphanUrl } = (await orphan.json()) as { url: string };

    const asOwner = await page.request.get(orphanUrl);
    expect(asOwner.status()).toBe(200);
    expect(asOwner.headers()["cache-control"]).toBe("private, no-store");
    // Anónimo (otro sitio, un enlace compartido): no existe.
    expect((await fetch(`${baseURL}${orphanUrl}`)).status).toBe(404);

    // Adjuntada a una publicación: pública, sin caché inmutable de un año.
    await page.goto("/crear/publicacion");
    await page.getByLabel("¿Qué quieres compartir?").fill("Foto para probar /media");
    const uploaded = page.waitForResponse(
      (response) => response.url().endsWith("/api/uploads") && response.status() === 201,
    );
    await page.getByLabel("Elegir imágenes").setInputFiles({
      name: "foto.png",
      mimeType: "image/png",
      buffer: TINY_PNG,
    });
    const { url: attachedUrl } = (await (await uploaded).json()) as { url: string };
    await expect(page.locator('input[name="mediaIds"]')).toHaveCount(1);
    expect((await fetch(`${baseURL}${attachedUrl}`)).status).toBe(404);
    await page.getByRole("button", { name: "Publicar" }).click();
    await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}$/, { timeout: 45_000 });

    const anonymous = await fetch(`${baseURL}${attachedUrl}`);
    expect(anonymous.status).toBe(200);
    // Sin `immutable`: ocultar una foto surte efecto en navegadores en máximo una hora (ADR-039).
    expect(anonymous.headers.get("cache-control")).toBe(
      "public, max-age=3600, stale-while-revalidate=86400",
    );
    expect(anonymous.headers.get("content-type")).toBe("image/webp");
    // La otra sigue privada.
    expect((await fetch(`${baseURL}${orphanUrl}`)).status).toBe(404);
  });
});
