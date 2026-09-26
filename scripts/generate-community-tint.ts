/**
 * Genera src/styles/community-tint.css (utilidades de color por comunidad) desde la receta en
 * src/styles/community-tint.ts. Uso: pnpm tint (vuelve a ejecutarlo si cambia la receta).
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderCommunityTintCss } from "../src/styles/community-tint";

writeFileSync(join(__dirname, "../src/styles/community-tint.css"), renderCommunityTintCss());
console.warn("✓ src/styles/community-tint.css");
