import { z } from "zod";
import { MAX_POST_LENGTH } from "@/modules/social/schemas";

export const EDITORIAL_INTERVAL_MS = 2 * 60 * 60 * 1000;
export const EDITORIAL_POSTS_PER_INTERVAL = 2;
export const EDITORIAL_TOKEN_PREFIX = "speeaking_editorial_";

const imageFields = {
  imagePart: z.enum(["image0", "image1"]),
  altText: z.string().trim().min(20).max(400),
};
const newPost = z
  .object({
    communitySlug: z.string().regex(/^[a-z][a-z0-9-]{1,48}$/),
    body: z.string().trim().min(80).max(MAX_POST_LENGTH),
    ...imageFields,
  })
  .strict();
const replacement = z
  .object({
    postId: z.uuid(),
    expectedMediaId: z.uuid(),
    ...imageFields,
  })
  .strict();

export const editorialSubmission = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("publish"),
      slot: z.iso.datetime(),
      posts: z.array(newPost).min(1).max(EDITORIAL_POSTS_PER_INTERVAL),
    })
    .strict(),
  z.object({ mode: z.literal("replace"), posts: z.array(replacement).min(1).max(2) }).strict(),
]);
export type EditorialSubmission = z.infer<typeof editorialSubmission>;

export function editorialSlot(now: Date = new Date()) {
  return new Date(Math.floor(now.getTime() / EDITORIAL_INTERVAL_MS) * EDITORIAL_INTERVAL_MS);
}

export function scheduledEditorialKey(slot: string, communitySlug: string) {
  return `scheduled:${slot}:${communitySlug}`;
}
