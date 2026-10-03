export const CONTENT_KINDS = [
  "post",
  "comment",
  "product",
  "purchase",
  "message",
  "conversation",
  "notification",
  "notifications",
  "saved",
  "cart",
] as const;
export type OwnContentKind = (typeof CONTENT_KINDS)[number];
