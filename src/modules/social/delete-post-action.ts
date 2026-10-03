"use server";

import { removeOwnContentAction } from "@/modules/identity/content-removal-actions";

export async function deletePostAction(
  postId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return removeOwnContentAction("post", postId);
}
