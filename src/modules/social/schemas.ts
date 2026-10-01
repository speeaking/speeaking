import { z } from "zod";

export const MAX_POST_IMAGES = 10;
export const MAX_POST_LENGTH = 2000;

export const createPostSchema = z
  .object({
    body: z.string().trim().max(MAX_POST_LENGTH, `Máximo ${MAX_POST_LENGTH} caracteres.`),
    communitySlug: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    mediaIds: z.array(z.uuid()).max(MAX_POST_IMAGES, `Máximo ${MAX_POST_IMAGES} imágenes.`),
    /** Un video corto (ADR-062): va solo, sin fotos. */
    videoId: z.uuid().optional(),
    productId: z.uuid().optional(),
  })
  .refine((post) => post.body.length > 0 || post.mediaIds.length > 0 || post.videoId, {
    message: "Escribe algo o agrega una imagen o un video.",
    path: ["body"],
  })
  .refine((post) => !(post.videoId && post.mediaIds.length > 0), {
    message: "Publica fotos o un video, no los dos juntos.",
    path: ["body"],
  });
