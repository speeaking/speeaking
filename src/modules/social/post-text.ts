/** El feed transporta una vista breve; el original se pide al abrir «Ver más» o la publicación. */
export const POST_PREVIEW_LENGTH = 800;

export function postTextPreview(text: string): string {
  let end = Math.min(text.length, POST_PREVIEW_LENGTH);
  // No separar las dos unidades UTF-16 de un emoji.
  const last = text.charCodeAt(end - 1);
  if (end < text.length && last >= 0xd800 && last <= 0xdbff) end--;
  return text.slice(0, end);
}
