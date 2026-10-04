import { z } from "zod";

export const COMMUNITY_EMOJIS = [
  "💬",
  "✨",
  "🎮",
  "🎵",
  "🌮",
  "🐾",
  "👗",
  "🏡",
  "⚽",
  "🚀",
  "📚",
  "🌿",
] as const;
export const COMMUNITY_HUES = [285, 210, 165, 35, 350] as const;

export const communityDetailsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Escribe al menos 3 caracteres.")
    .max(80, "Usa hasta 80 caracteres."),
  description: z
    .string()
    .trim()
    .min(10, "Cuéntanos de qué trata en al menos 10 caracteres.")
    .max(500, "Usa hasta 500 caracteres."),
  emoji: z.enum(COMMUNITY_EMOJIS),
  hue: z.coerce
    .number()
    .refine((value) => COMMUNITY_HUES.some((hue) => hue === value), "Elige un color."),
});

export type CommunityDetails = z.infer<typeof communityDetailsSchema>;
export type CommunityFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Partial<Record<string, string[]>>;
};
export type CommunityCommand =
  "invite" | "cancelInvite" | "remove" | "restore" | "promote" | "demote" | "transfer";
export type CommunityResult = { ok: true; message: string } | { ok: false; error: string };
