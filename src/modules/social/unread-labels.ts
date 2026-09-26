/** «1 nueva», «4 nuevas», «99+ nuevas» (el servidor topa el conteo en 100). */
export function unreadLabel(count: number) {
  if (count === 1) return "1 nueva";
  return `${count > 99 ? "99+" : count} nuevas`;
}

/**
 * Lo mismo para lectores de pantalla, sin abreviar: «1 nueva» a secas no dice qué es nuevo, y
 * «99+» se lee «noventa y nueve más».
 */
export function unreadSpokenLabel(count: number) {
  if (count === 1) return "1 publicación nueva";
  return `${count > 99 ? "más de 99" : count} publicaciones nuevas`;
}
