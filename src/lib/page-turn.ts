/**
 * Abrir un perfil «pasa la página» (ADR-055): la pantalla actual se despega desde la esquina
 * inferior derecha y debajo ya está el perfil. Solo los enlaces de perfil llevan este tipo de
 * transición; las demás navegaciones no animan. La animación vive en `globals.css`: con el tipo
 * activo (`:active-view-transition-type(perfil)`) la instantánea vieja de la raíz se enmascara en
 * diagonal; el esqueleto del perfil (`page-sheet`) y la ficha (`page-ink`) entran debajo.
 */
export const PAGE_TURN_TYPE = "perfil";

/** Para `<Link transitionTypes={…}>` y `router.push(href, { transitionTypes })`. */
export const PROFILE_TRANSITION: string[] = [PAGE_TURN_TYPE];

/**
 * `enter` del esqueleto del perfil: con el tipo «perfil» hay un límite de transición que entra, y
 * eso es lo que hace que React inicie la transición (sin un límite afectado no la inicia); el
 * esqueleto en sí no se anima, solo espera debajo de la página que se despega.
 */
export const PAGE_SHEET_ENTER = { [PAGE_TURN_TYPE]: "page-sheet", default: "none" };
