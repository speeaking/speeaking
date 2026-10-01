"use server";

import { z } from "zod";
import { getViewer } from "@/modules/identity/session";
import {
  type FinishVideoResult,
  finishVideoUpload,
  type StartVideoResult,
  startVideoUpload,
} from "./video-upload";

const startSchema = z.object({
  sizeBytes: z.number().int().positive(),
  contentType: z.string().max(60),
  posterId: z.uuid().nullable(),
});

const NEEDS_PROFILE = "Termina tu perfil para subir videos.";

/** Paso 1 de la subida de un video (ADR-062): a dónde mandar el archivo. */
export async function startVideoUploadAction(input: unknown): Promise<StartVideoResult> {
  const viewer = await getViewer();
  if (!viewer?.profile?.onboarded) return { ok: false, error: NEEDS_PROFILE };
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Elige un video." };
  return startVideoUpload(viewer.userId, parsed.data);
}

/** Paso 2: el servidor revisa el archivo ya guardado y lo deja listo para publicarse. */
export async function finishVideoUploadAction(mediaId: unknown): Promise<FinishVideoResult> {
  const viewer = await getViewer();
  if (!viewer?.profile?.onboarded) return { ok: false, error: NEEDS_PROFILE };
  const parsed = z.uuid().safeParse(mediaId);
  if (!parsed.success) return { ok: false, error: "No encontramos ese video." };
  return finishVideoUpload(viewer.userId, parsed.data);
}
