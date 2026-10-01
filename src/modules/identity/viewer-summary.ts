/** Comunidad tal como la pinta la navegación (avatar de emoji sobre su color). */
export type NavCommunity = { slug: string; name: string; emoji: string; hue: number };

/** Lo mínimo de la persona con sesión que necesita la navegación (seguro para el cliente). */
export type ViewerSummary = {
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  isSeller: boolean;
  onboarded: boolean;
  /** Presente (y `true`) solo para el equipo (rol ADMIN); para los demás la llave no existe. */
  isAdmin?: true;
  cartCount: number;
  /** Conversaciones con mensajes sin leer (ADR-047). */
  unreadMessages: number;
  /** Avisos sin leer de la campana (ADR-059). */
  unreadNotifications: number;
  /**
   * Sus comunidades, las más recientes primero (máximo 8). `unread`: publicaciones nuevas desde
   * su última visita («N nuevas», F7), topado en 100 («99+»); se omite cuando no hay.
   */
  communities: (NavCommunity & { unread?: number })[];
} | null;

/**
 * Comunidades para la columna izquierda. Con sesión: hasta 3 a las que todavía no se une («Para
 * descubrir»). Sin sesión: todas. `total` es el número real de comunidades («Ver las 12»).
 */
export type NavCommunities = {
  total: number;
  items: (NavCommunity & { id: string })[];
};
