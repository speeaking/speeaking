import type { UserGoal } from "@/generated/prisma/enums";

/** "¿Qué te trae por aquí?" (paso 1 del onboarding). */
export const GOAL_OPTIONS: readonly { value: UserGoal; label: string; emoji: string }[] = [
  { value: "ENTERTAINMENT", label: "Entretenerme", emoji: "🍿" },
  { value: "DISCOVER", label: "Descubrir cosas nuevas", emoji: "🧭" },
  { value: "BUY_SOMETHING", label: "Comprar algo específico", emoji: "🛍️" },
  { value: "SELL", label: "Vender mis productos", emoji: "🏪" },
  { value: "CREATE_CONTENT", label: "Crear contenido y ganar dinero", emoji: "🎬" },
  { value: "LEARN", label: "Aprender", emoji: "📚" },
];

/** Marcas sugeridas según las comunidades elegidas (paso 3). Son etiquetas de interés. */
export const BRAND_SUGGESTIONS: Record<string, readonly string[]> = {
  tecnologia: ["Apple", "Samsung", "Xiaomi", "Lenovo", "HP"],
  gaming: ["PlayStation", "Xbox", "Nintendo", "Logitech", "Razer"],
  musica: ["JBL", "Sony", "Yamaha", "Fender", "Bose"],
  moda: ["Nike", "Adidas", "Zara", "Levi's", "Vans"],
  deportes: ["Nike", "Adidas", "Puma", "Under Armour", "Garmin"],
  belleza: ["L'Oréal", "Maybelline", "The Ordinary", "Nivea", "Cetaphil"],
  autos: ["Nissan", "Volkswagen", "Toyota", "Honda", "Mazda"],
  mascotas: ["Royal Canin", "Purina", "Pedigree", "Whiskas", "Hill's"],
  hogar: ["IKEA", "Tupperware", "Oster", "T-fal", "Mabe"],
  comida: ["Nespresso", "Starbucks", "La Costeña", "Herdez", "Jumex"],
};

export const MIN_COMMUNITIES = 3;
