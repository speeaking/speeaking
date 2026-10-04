import { z } from "zod";

const cursorSchema = z.object({
  asOf: z.string().datetime(),
  at: z.string().datetime(),
  id: z.uuid(),
});
export type VideoCursor = z.infer<typeof cursorSchema>;

export function decodeVideoCursor(raw: string): VideoCursor | null {
  if (raw.length > 256 || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
  try {
    const parsed = cursorSchema.safeParse(
      JSON.parse(Buffer.from(raw, "base64url").toString("utf8")),
    );
    if (!parsed.success || parsed.data.at > parsed.data.asOf) return null;
    if (Date.parse(parsed.data.asOf) > Date.now() + 60000) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function encodeVideoCursor(cursor: VideoCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}
