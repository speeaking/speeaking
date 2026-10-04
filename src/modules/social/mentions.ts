export const MAX_MENTION_RECIPIENTS = 10;

export type Mention = { username: string; start: number; end: number };

/** Reconoce @usuario sin confundir correos ni partir nombres largos; conserva la puntuación. */
export function mentionsIn(text: string): Mention[] {
  const pattern = /(?<![\p{L}\p{N}_.@])@([a-z0-9][a-z0-9._]*)(?![\p{L}\p{N}_@])/giu;
  return [...text.matchAll(pattern)].flatMap((match) => {
    const username = match[1]!.replace(/[._]+$/, "").toLowerCase();
    if (username.length < 3 || username.length > 30) return [];
    return [{ username, start: match.index, end: match.index + username.length + 1 }];
  });
}

export function mentionedUsernames(text: string): string[] {
  return [...new Set(mentionsIn(text).map((mention) => mention.username))].slice(
    0,
    MAX_MENTION_RECIPIENTS,
  );
}
