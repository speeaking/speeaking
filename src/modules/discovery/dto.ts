/**
 * DTOs explícitos de la columna «Para ti» y de «Gente de tus comunidades». Solo datos públicos:
 * nunca costos, correos ni campos internos (se serializan dentro del HTML).
 */

export type CommunityTagDTO = { slug: string; name: string; emoji: string; hue: number };

/** «Lo que buscas»: la intención activa y, si hay, el mejor producto dentro del presupuesto. */
export type IntentHighlightDTO = {
  id: string;
  query: string;
  budgetMaxCents: number | null;
  currency: string;
  source: "ONBOARDING" | "SEARCH" | "AI_COMPANION";
  createdAt: string;
  product: {
    slug: string;
    title: string;
    priceCents: number;
    currency: string;
    city: string;
    image: { url: string; width: number; height: number; blurDataUrl: string | null } | null;
  } | null;
};

export type DebateDTO = {
  id: string;
  text: string;
  /** Comentarios publicados reales (0 = aún sin respuestas; la interfaz oculta el cero). */
  comments: number;
  community: CommunityTagDTO;
};

export type OpenDebatesDTO = {
  /** De dónde salen: solo de tus comunidades, o también de otras (sin sesión, de todas). */
  scope: "yours" | "all";
  items: DebateDTO[];
  anyAnswered: boolean;
};

export type MovingCommunityDTO = CommunityTagDTO & {
  id: string;
  /** Publicaciones de los últimos 7 días (siempre > 0). */
  posts: number;
  /** Proporción respecto a la más activa, para la barra (0–1]. */
  share: number;
  joined: boolean;
};

export type SocialRailDTO = {
  intent: IntentHighlightDTO | null;
  debates: OpenDebatesDTO;
  moving: MovingCommunityDTO[];
};

export type PersonSuggestionDTO = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  /** Tiene tienda activa: se muestra la insignia «Tienda». */
  isStore: boolean;
  /** Razón visible: «La siguen 2 personas que sigues», «Comentó tu publicación»… */
  reason: string;
};
