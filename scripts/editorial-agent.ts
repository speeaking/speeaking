/** Cliente local: prepara imágenes y publica con una credencial acotada, sin claves de R2. */
import { readFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { processImage } from "../src/modules/media/image-processing";
import {
  editorialSubmission,
  EDITORIAL_TOKEN_PREFIX,
} from "../src/modules/editorial/automation-schema";

const args = process.argv.slice(2);
const action = args[0];
const target = args.includes("--target") ? args[args.indexOf("--target") + 1] : "production";
const manifestPath = args.includes("--manifest") ? args[args.indexOf("--manifest") + 1] : undefined;
if (!["plan", "submit"].includes(action ?? "") || !["local", "production"].includes(target ?? ""))
  throw new Error("Usa plan o submit --manifest <archivo>, con --target local|production.");

function workspaceFile(path: string, relativeTo: string = process.cwd()) {
  const root = resolve(process.cwd());
  const file = resolve(relativeTo, path);
  if (!file.startsWith(root + sep))
    throw new Error("El archivo debe estar dentro de este proyecto.");
  return file;
}

async function main() {
  const base = target === "production" ? "https://www.speeaking.com" : "http://127.0.0.1:3000";
  const saved = JSON.parse(
    await readFile(join(".data", "editorial-automation", `access-${target}.json`), "utf8"),
  ) as { token: string };
  if (!new RegExp(`^${EDITORIAL_TOKEN_PREFIX}[A-Za-z0-9_-]{43}$`).test(saved.token))
    throw new Error("Credencial editorial inválida.");
  const headers = { Authorization: `Bearer ${saved.token}` };
  if (action === "plan") {
    const response = await fetch(`${base}/api/editorial/publish`, {
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) throw new Error(`No se pudo consultar el plan (HTTP ${response.status}).`);
    process.stdout.write(JSON.stringify(await response.json(), null, 2) + "\n");
    return;
  }
  if (!manifestPath) throw new Error("Falta --manifest.");
  const path = workspaceFile(manifestPath);
  const bytes = await readFile(path);
  if (bytes.length > 20_000) throw new Error("El manifiesto es demasiado grande.");
  const input = JSON.parse(bytes.toString("utf8")) as { posts?: { imageFile?: string }[] };
  if (!Array.isArray(input.posts) || input.posts.length < 1 || input.posts.length > 2)
    throw new Error("Envía una o dos publicaciones.");
  const images = input.posts.map((entry) => entry.imageFile);
  const manifest = {
    ...input,
    posts: input.posts.map(({ imageFile: _file, ...entry }, i) => {
      void _file;
      return { ...entry, imagePart: `image${i}` };
    }),
  };
  const checked = editorialSubmission.safeParse(manifest);
  if (!checked.success) throw new Error("El manifiesto editorial no tiene el formato esperado.");
  const form = new FormData();
  form.set("manifest", JSON.stringify(checked.data));
  for (const [i, file] of images.entries()) {
    if (typeof file !== "string") throw new Error("Falta una imagen.");
    const image = await processImage(await readFile(workspaceFile(file, dirname(path))));
    if (image.sizeBytes > 1024 * 1024) throw new Error("La imagen optimizada supera 1 MB.");
    form.set(
      `image${i}`,
      new Blob([new Uint8Array(image.buffer)], { type: "image/webp" }),
      `image${i}.webp`,
    );
  }
  if (!args.includes("--publish")) {
    process.stdout.write(
      JSON.stringify({
        valid: true,
        mode: checked.data.mode,
        posts: checked.data.posts.length,
        target,
        published: false,
      }) + "\n",
    );
    return;
  }
  const response = await fetch(`${base}/api/editorial/publish`, {
    method: "POST",
    headers,
    body: form,
    redirect: "error",
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    let code = "EDITORIAL_UNAVAILABLE";
    try {
      const result = (await response.json()) as { error?: unknown };
      if (typeof result.error === "string" && /^[A-Z_]{3,60}$/.test(result.error))
        code = result.error;
    } catch {
      /* No volcar HTML ni datos de la petición. */
    }
    throw new Error(`Publicación rechazada: ${code} (HTTP ${response.status}).`);
  }
  process.stdout.write(JSON.stringify(await response.json()) + "\n");
}
main().catch((error: unknown) => {
  console.error(
    error instanceof Error &&
      error.name === "Error" &&
      !/token|Bearer|postgres/i.test(error.message)
      ? error.message
      : "No se pudo completar la operación editorial.",
  );
  process.exitCode = 1;
});
