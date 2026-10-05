/** Compartido por los formularios y el servidor; ninguna elección depende del cliente. */
export const POST_AUDIENCES = ["PUBLIC", "FRIENDS", "ONLY_ME"] as const;
export type PostAudienceValue = (typeof POST_AUDIENCES)[number];
export type PostAudienceDTO = "public" | "friends" | "only_me";
export const DEFAULT_POST_AUDIENCE: PostAudienceValue = "PUBLIC";
export const AUDIENCE_OPTIONS: Record<PostAudienceValue, { label: string; description: string }> = {
  PUBLIC: { label: "Público", description: "Cualquier persona, dentro y fuera de speeaking." },
  FRIENDS: { label: "Amigos", description: "Solo tú y tus amigos aceptados." },
  ONLY_ME: { label: "Solo yo", description: "Solo tú puedes ver esta publicación." },
};
export function audienceFromDTO(value: PostAudienceDTO): PostAudienceValue {
  return value === "public" ? "PUBLIC" : value === "only_me" ? "ONLY_ME" : "FRIENDS";
}
export function audienceToDTO(value: PostAudienceValue): PostAudienceDTO {
  return value === "PUBLIC" ? "public" : value === "ONLY_ME" ? "only_me" : "friends";
}
