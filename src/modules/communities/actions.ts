"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getViewer, requireOnboardedViewer } from "@/modules/identity/session";
import { checkSocialLimit } from "@/modules/social/limits";
import { db } from "@/server/db";
import {
  communityDetailsSchema,
  type CommunityCommand,
  type CommunityFormState,
  type CommunityResult,
} from "./schemas";
import {
  CommunityError,
  createCommunity,
  lockCommunity,
  manageCommunity,
  respondToInvitation,
} from "./service";

function detailsFrom(form: FormData) {
  return communityDetailsSchema.safeParse({
    name: form.get("name"),
    description: form.get("description"),
    emoji: form.get("emoji"),
    hue: form.get("hue"),
  });
}
function publicError(error: unknown) {
  return error instanceof CommunityError
    ? error.message
    : "No pudimos guardar el cambio. Intenta de nuevo.";
}
function refreshCommunities() {
  revalidatePath("/(social)", "layout");
}

export async function createCommunityAction(
  _previous: CommunityFormState,
  form: FormData,
): Promise<CommunityFormState> {
  const viewer = await requireOnboardedViewer("/crear/comunidad");
  const details = detailsFrom(form);
  if (!details.success) return { fieldErrors: z.flattenError(details.error).fieldErrors };
  const limited = await checkSocialLimit("createCommunity", viewer.userId);
  if (!limited.ok) return { error: limited.error };
  let slug: string;
  try {
    ({ slug } = await createCommunity(viewer.userId, details.data));
  } catch (error) {
    return { error: publicError(error) };
  }
  refreshCommunities();
  redirect(`/c/${slug}` as Route);
}

export async function editCommunityAction(
  _previous: CommunityFormState,
  form: FormData,
): Promise<CommunityFormState> {
  const viewer = await getViewer();
  if (!viewer?.profile?.onboarded) return { error: "Inicia sesión para continuar." };
  const id = z.uuid().safeParse(form.get("communityId"));
  const details = detailsFrom(form);
  if (!id.success) return { error: "Comunidad inválida." };
  if (!details.success) return { fieldErrors: z.flattenError(details.error).fieldErrors };
  const limited = await checkSocialLimit("manageCommunity", viewer.userId);
  if (!limited.ok) return { error: limited.error };
  try {
    await db.$transaction(async (tx) => {
      const community = await lockCommunity(tx, id.data.toLowerCase());
      if (community.ownerId !== viewer.userId)
        throw new CommunityError("Solo el propietario puede editar la comunidad.");
      await tx.community.update({ where: { id: community.id }, data: details.data });
    });
    refreshCommunities();
    return { success: "Cambios guardados." };
  } catch (error) {
    return { error: publicError(error) };
  }
}

export async function deleteCommunityAction(
  _previous: CommunityFormState,
  form: FormData,
): Promise<CommunityFormState> {
  const viewer = await getViewer();
  if (!viewer?.profile?.onboarded) return { error: "Inicia sesión para continuar." };
  const parsed = z
    .object({ communityId: z.uuid(), confirmation: z.string().trim().max(80) })
    .safeParse({ communityId: form.get("communityId"), confirmation: form.get("confirmation") });
  if (!parsed.success) return { error: "Escribe el nombre completo de la comunidad." };
  const limited = await checkSocialLimit("manageCommunity", viewer.userId);
  if (!limited.ok) return { error: limited.error };
  try {
    await db.$transaction(async (tx) => {
      const community = await lockCommunity(tx, parsed.data.communityId.toLowerCase());
      if (community.isOfficial || community.ownerId !== viewer.userId)
        throw new CommunityError("Solo el propietario puede eliminar su comunidad.");
      const current = await tx.community.findUniqueOrThrow({
        where: { id: community.id },
        select: { name: true },
      });
      if (current.name !== parsed.data.confirmation)
        throw new CommunityError(
          "El nombre no coincide. Escríbelo tal como aparece en la comunidad.",
        );
      await tx.community.delete({ where: { id: community.id } });
    });
  } catch (error) {
    return { error: publicError(error) };
  }
  refreshCommunities();
  redirect("/descubrir");
}

const commandSchema = z
  .object({
    communityId: z.uuid().transform((id) => id.toLowerCase()),
    command: z.enum([
      "invite",
      "cancelInvite",
      "remove",
      "restore",
      "promote",
      "demote",
      "transfer",
    ]),
    targetId: z
      .uuid()
      .transform((id) => id.toLowerCase())
      .optional(),
    username: z
      .string()
      .trim()
      .transform((name) => name.replace(/^@/, "").toLowerCase())
      .pipe(
        z
          .string()
          .min(3)
          .max(30)
          .regex(/^[a-z0-9](?:[a-z0-9._]*[a-z0-9])?$/),
      )
      .optional(),
  })
  .refine((input) =>
    input.command === "invite" ? Boolean(input.username) : Boolean(input.targetId),
  );

export async function manageCommunityAction(input: {
  communityId: string;
  command: CommunityCommand;
  targetId?: string;
  username?: string;
}): Promise<CommunityResult> {
  const parsed = commandSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisa la comunidad y el @usuario elegido." };
  const viewer = await getViewer();
  if (!viewer?.profile?.onboarded)
    return { ok: false, error: "Inicia sesión para administrar comunidades." };
  const limited = await checkSocialLimit("manageCommunity", viewer.userId);
  if (!limited.ok) return { ok: false, error: limited.error };
  try {
    const message = await manageCommunity(viewer.userId, parsed.data);
    refreshCommunities();
    return { ok: true, message };
  } catch (error) {
    return { ok: false, error: publicError(error) };
  }
}

export async function respondCommunityInvitationAction(
  communityId: string,
  accept: boolean,
): Promise<CommunityResult> {
  const parsed = z
    .object({ communityId: z.uuid().transform((id) => id.toLowerCase()), accept: z.boolean() })
    .safeParse({ communityId, accept });
  if (!parsed.success) return { ok: false, error: "Invitación inválida." };
  const viewer = await getViewer();
  if (!viewer?.profile?.onboarded)
    return { ok: false, error: "Inicia sesión para responder a la invitación." };
  const limited = await checkSocialLimit("join", viewer.userId);
  if (!limited.ok) return { ok: false, error: limited.error };
  try {
    const message = await respondToInvitation(
      viewer.userId,
      parsed.data.communityId,
      parsed.data.accept,
    );
    refreshCommunities();
    return { ok: true, message };
  } catch (error) {
    return { ok: false, error: publicError(error) };
  }
}
