import type { Route } from "next";
import { normalizeText } from "@/modules/ai/personal-data";
import { foldText } from "@/modules/search/normalize";

/**
 * Lo que no se puede vender ni anunciar en speeaking, revisado por código (P2: patrones
 * deterministas y probados, no la IA). Una sola lista para tres lugares:
 *
 * - IA (`ai/content-policy.ts`): lo que la IA no ayuda a vender, antes de gastar una llamada.
 * - Ficha de producto: alta y edición a mano (`catalog/actions.ts`).
 * - Publicación (`social/actions.ts`). Una publicación no siempre vende: ahí siempre cuentan las
 *   frases que por sí solas ya son una oferta («vendo facturas», «IPTV», «masajes con final feliz»)
 *   y las demás (un vape, un loro, cigarros) solo si el texto ofrece algo (precio, «vendo»,
 *   «envíos», «inbox»…) o etiqueta un producto. Así «dejé el vape» o «vi una guacamaya» se publican.
 *
 * Detiene la publicación con un mensaje claro; nunca sanciona la cuenta (eso lo decide una persona
 * del equipo). Mitiga, no modera: lo que se escape sigue llegando por reportes. Un falso positivo deja
 * a alguien sin publicar algo legítimo, así que cada palabra ambigua va con su contexto: «cargador»
 * solo junto a un arma (no el del celular), «crack» solo junto a un programa, «carey» solo como
 * material de tortuga (no el color de unos lentes), «cigarro» no en «pantalón corte cigarro».
 *
 * Las réplicas (`counterfeit`) solo se revisan aquí para la IA: en lo publicado a mano las evalúa el
 * motor de riesgo de falsificación (`rules.ts`), que entiende «no es réplica» y pide comprobante en
 * vez de bloquear.
 */
export type ProhibitedCategory =
  | "counterfeit"
  | "weapons"
  | "drugs"
  | "prescription"
  | "vapes"
  | "tobacco"
  | "piracy"
  | "fake_invoices"
  | "sexual_services"
  | "wildlife";

/**
 * Las que revisa la IA. Las nuevas (tabaco, piratería, facturas, servicios sexuales, fauna) se
 * suman cuando las evaluaciones (`ai/evals`) sepan etiquetarlas; mientras, lo que la IA proponga se
 * revisa igual al publicarse.
 */
export const AI_CATEGORIES = ["counterfeit", "weapons", "drugs", "prescription", "vapes"] as const;
export type AiCategory = (typeof AI_CATEGORIES)[number];

/** Las que detienen una publicación hecha a mano (todas menos las réplicas: ver arriba). */
export type ManualCategory = Exclude<ProhibitedCategory, "counterfeit">;
const MANUAL_CATEGORIES: readonly ManualCategory[] = [
  "weapons",
  "drugs",
  "prescription",
  "vapes",
  "tobacco",
  "piracy",
  "fake_invoices",
  "sexual_services",
  "wildlife",
];

/**
 * - `offer`: la frase ya es una oferta o un anuncio; cuenta en cualquier texto.
 * - `item`: nombra un artículo prohibido; cuenta en una ficha, en lo que la IA va a vender y en una
 *   publicación que ofrece algo.
 */
type Scope = "offer" | "item";
type Rule = { kind: ProhibitedCategory; scope: Scope; test: (text: string) => boolean };

/** Frases completas: nunca dentro de otra palabra («vapeador» sí, «cigarrera» no es «cigarro»). */
function phrases(alternatives: readonly string[]) {
  return new RegExp(
    String.raw`(?<![\p{L}\p{N}])(?:${alternatives.join("|")})(?![\p{L}\p{N}])`,
    "iu",
  );
}

function rule(kind: ProhibitedCategory, scope: Scope, alternatives: readonly string[]): Rule {
  const pattern = phrases(alternatives);
  return { kind, scope, test: (text) => pattern.test(text) };
}

/** Las dos señales en el mismo texto (p. ej. una oferta de trabajo y una señal de engaño). */
function both(kind: ProhibitedCategory, scope: Scope, first: string[], second: string[]): Rule {
  const a = phrases(first);
  const b = phrases(second);
  return { kind, scope, test: (text) => a.test(text) && b.test(text) };
}

// El texto llega sin acentos y en minúsculas (`normalize`): los patrones se escriben así.

/** Lo que sí es una «pistola»: herramientas, juguetes y aparatos («pistola de silicón», «Nerf»). */
const PISTOL_TOOLS = [
  "silicon",
  "silicona",
  "agua",
  "calor",
  "pintura",
  "pintar",
  "juguete",
  "aire",
  "clavos",
  "grapas",
  "masaje",
  "masajes",
  "hidrogel",
  "gel",
  "burbujas",
  "soldar",
  "lavado",
  "riego",
  "impacto",
  "calafateo",
  "nerf",
  "paintball",
  "gotcha",
  "pegamento",
  "cola",
  "espuma",
  "vapor",
  "arena",
  "temperatura",
  "termometro",
  "termica",
  "hidrolavadora",
  "tatuar",
  "tatuajes?",
  "cejas",
  "perforar",
  "aretes",
  "remaches",
  "engrase",
  "cinta",
  "etiquetas",
  "etiquetadora",
  "precios",
  "escaner",
  "lectora",
  "codigos?",
  "dardos",
  "confeti",
  "pompas",
];
const PISTOL = String.raw`pistolas?(?!\s+(?:de\s+|para\s+)?(?:${PISTOL_TOOLS.join("|")}))`;

/** Servicios de streaming y suscripciones que se revenden como «cuentas» o «pantallas». */
const STREAMING = String.raw`(?:netflix|spotify|disney\s*(?:\+|plus)?|hbo(?:\s*max)?|prime\s+video|amazon\s+prime|star\s*(?:\+|plus)|paramount\s*(?:\+|plus)?|crunchyroll|youtube\s+premium|vix\s*(?:\+|plus|premium)|apple\s+tv\s*\+?|apple\s+music|deezer|canva\s+pro|chatgpt\s+plus|office\s+365|game\s+pass|ps\s+plus|playstation\s+plus|claro\s+video|blim)`;

/** Programas con nombre propio (en «Office 2021 crackeado»: «crack» suelto también es un elogio). */
const SOFTWARE = String.raw`(?:windows|office|photoshop|adobe|autocad|antivirus|illustrator|premiere|corel(?:draw)?|sony\s+vegas|vegas\s+pro|fl\s+studio|ableton|revit|solidworks|sketchup|lightroom|after\s+effects|filmora|camtasia|minecraft)`;
/**
 * «Crack» de programa. «Es un crack de Photoshop» es alguien muy bueno, y «el crack del juego» o
 * «del programa» (de la tele) también: lo genérico solo cuenta en plural («crack para juegos»).
 */
const CRACK = String.raw`(?<!(?:un|una|unos|unas|eres|es|soy|somos|son|sea|seas|ser)\s)cracks?`;
const GENERIC_SOFTWARE = String.raw`(?:juegos|programas|software|apps|aplicaciones)`;

/** Un dibujo, un peluche o un estampado de un animal no es el animal. */
const NOT_A_DEPICTION = String.raw`(?<!(?:peluches?|figuras?|figuritas?|juguetes?|disfraz(?:es)?|estampados?|dibujos?|cuadros?|pinturas?|cojin(?:es)?|adornos?|aretes|llaveros?|pinatas?|alebrijes?|imagen(?:es)?|stickers?|calcomanias?|tazas?|playeras?|motivos?|diseno|print)\s+(?:de\s+)?(?:una?\s+|el\s+|la\s+)?)`;
const NOT_A_TOY = String.raw`(?!\s+de\s+(?:peluche|juguete|madera|ceramica|barro|resina|plastico|tela|papel))`;
const PARROTS = String.raw`(?:guacamayas?|loros?|cotorras?|tucan(?:es)?)`;

const RULES: readonly Rule[] = [
  rule("counterfeit", "item", [
    "replicas?",
    "clon(?:es)?",
    "imitacion(?:es)?",
    "piratas?",
    "fake",
    String.raw`(?:calidad|tipo|clase|copia)\s+(?:aaa|a1|original|espejo|premium\s+1\s*:\s*1)`,
    String.raw`copias?\s+(?:exactas?|fiel(?:es)?|identicas?|de\s+marca)`,
    String.raw`1\s*:\s*1`,
  ]),
  rule("weapons", "item", [
    String.raw`armas?\s+(?:de\s+fuego|blancas?\s+prohibidas?)`,
    PISTOL,
    // «Revólver» sin acento es también el verbo: «pala para revolver la mezcla» sí se vende.
    String.raw`(?<!(?:para|de|al|sin|a|y)\s)revolver(?:es)?(?!\s+(?:la|el|los|las|lo|bien|todo|mezclas?|masa|pintura|comida|alimentos?|ingredientes?|cemento|concreto|mortero|tierra|composta)(?![\p{L}\p{N}]))`,
    String.raw`(?:rifles?|escopetas?|fusil(?:es)?)(?!\s+(?:de\s+)?(?:juguete|hidrogel|gel|agua|nerf|paintball|gotcha|dardos|burbujas|aire\s+comprimido\s+de\s+juguete))`,
    // Las bolitas de hidrogel y los dardos de juguete también se anuncian como «municiones».
    String.raw`municion(?:es)?(?!\s+(?:de\s+|para\s+)?(?:(?:pistolas?|rifles?|lanzadores?)\s+(?:de\s+)?)?(?:hidrogel|gel|nerf|paintball|gotcha|dardos|juguete|agua|espuma)(?![\p{L}\p{N}]))`,
    // «Calibre» también mide cables, láminas y agujas («cable calibre 12»), y Calibre 50 es un grupo.
    String.raw`calibre\s+\.\d+`,
    String.raw`(?<!(?:cables?|alambres?|agujas?|laminas?|hilos?|thw|thhw|electricos?)(?:\s+\S+){0,2}\s)calibre\s+(?:22|25|32|38|40|44|45|357|380|223|308|9\s*mm|7[.,]62|5[.,]56)(?!\s*(?:awg|thw|thhw|g|gauge)(?![\p{L}\p{N}]))`,
    String.raw`cuerno\s+de\s+chivo`,
    "ar-?15",
    "ak-?47",
    "glock",
    String.raw`silenciador(?:es)?\s+para\s+(?:armas?|pistolas?|rifles?)`,
    // Partes, accesorios, planos y archivos 3D: su venta por internet está prohibida (LFAFE arts.
    // 52 y 83 Sexies). «Cargador» suelto es el del celular; solo cuenta junto a un arma o a tiros.
    String.raw`cargador(?:es)?\s+(?:de\s+|para\s+)?(?:rifles?|escopetas?|fusil(?:es)?|armas?|ar-?15|ak-?47|cuerno\s+de\s+chivo|subametralladoras?|9\s*mm)`,
    String.raw`cargador(?:es)?\s+(?:de\s+)?\d+\s+(?:tiros|balas|cartuchos|disparos|rondas)`,
    String.raw`cargador(?:es)?\s+(?:extendidos?|de\s+tambor|tipo\s+tambor)`,
    "portacargador(?:es)?",
    String.raw`miras?\s+(?:holograficas?|termicas?|telescopicas?|laser|reflex|nocturnas?|tacticas?|de\s+punto\s+rojo)`,
    // «Visión nocturna» sola es de cámaras de seguridad y de lentes para manejar: solo la del arma.
    String.raw`(?:visor(?:es)?|gogles?|goggles?|monocular(?:es)?|miras?)\s+(?:de\s+)?vision\s+nocturna`,
    String.raw`vision\s+nocturna\s+(?:para\s+)?(?:rifles?|armas?|cascos?|tacticas?|militar(?:es)?)`,
    String.raw`(?:archivos?|modelos?|planos?|disenos?)\s+(?:\S+\s+){0,2}?(?:stl|3d|cad)\s+(?:de\s+|para\s+)?(?:armas?|pistolas?|rifles?|glock|ar-?15|cargador(?:es)?|silenciador(?:es)?)`,
    String.raw`(?:armas?|pistolas?|rifles?)\s+(?:impresas?|para\s+imprimir)\s+en\s+3d`,
    String.raw`ghost\s+guns?`,
    String.raw`kits?\s+(?:de\s+)?conversion\s+(?:para\s+|a\s+)?(?:pistolas?|rifles?|armas?|automatic[oa]s?|rafaga)`,
    String.raw`(?:culatas?|cachas?|gatillos?|correderas?|canon(?:es)?|guardamanos|empunaduras?|fundas?|pistoleras?)\s+(?:para|de)\s+armas?`,
  ]),
  rule("drugs", "item", [
    "marihuana",
    "cannabis",
    "thc",
    "cocaina",
    "metanfetaminas?",
    "fentanilo",
    String.raw`hongos\s+(?:alucinogenos|magicos)`,
    "lsd",
  ]),
  rule("prescription", "item", [
    "clonazepam",
    "alprazolam",
    "diazepam",
    "tramadol",
    "rivotril",
    "xanax",
    "antibioticos?",
    // «Lentes sin receta» sí se venden: solo medicamentos.
    String.raw`medicamentos?\s+(?:controlados?|con\s+receta|de\s+patente\s+con\s+receta)`,
    "semaglutida",
    "ozempic",
  ]),
  rule("vapes", "item", [
    "vapes?",
    "vaper",
    "vapeador(?:es)?",
    String.raw`cigarr(?:os?|illos?)\s+electronicos?`,
    "e-?cig",
    // Líquidos, cápsulas, marcas y caladas: venta y publicidad prohibidas (LGS art. 282 Quater).
    String.raw`pods?\s+(?:desechables?|recargables?|de\s+sabor(?:es)?|para\s+vapeo|de\s+(?:sal\s+de\s+)?nicotina)`,
    String.raw`e-?liquid(?:o|os|s)?`,
    String.raw`liquidos?\s+(?:para\s+)?(?:vapeo|vapear|vaporizador(?:es)?)`,
    String.raw`sal(?:es)?\s+de\s+nicotina`,
    // Un vaporizador facial, de ropa o de aceites esenciales sí se vende.
    String.raw`vaporizador(?:es)?\s+(?:de\s+|para\s+)?(?:hierbas?|cera|wax|nicotina|tabaco|cannabis|marihuana|thc)`,
    String.raw`elf\s*bar`,
    String.raw`lost\s+mary`,
    "juul",
    // Cientos o miles de caladas: «2 puffs» también son dos taburetes para la sala.
    String.raw`(?:\d{3,}|\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?\s*(?:k|mil))\s*(?:puffs|caladas)`,
    String.raw`(?:hookah|shisha|narguil[ae])s?\s+(?:electronicas?|desechables?)`,
  ]),
  // Venta al consumidor por internet prohibida, también de artículos con marcas de cigarros (LGCT
  // art. 16 fr. IV y VI). «Tabaco» y «habano» solos también son colores y aromas.
  rule("tobacco", "item", [
    String.raw`(?<!(?:para|porta|corte|tipo|estilo|pantalon(?:es)?|jeans?)\s)cigarr(?:os?|illos?)(?!\s+(?:electronicos?|de\s+(?:chocolate|dulce|juguete)))`,
    String.raw`cajetillas?(?!\s+de\s+(?:cerillos|fosforos))`,
    String.raw`(?:puros?|cigarros?)\s+(?:cubanos?|habanos?|dominicanos?|nicaraguenses?|hondurenos?)`,
    String.raw`cajas?\s+de\s+(?:puros|habanos)`,
    "cohiba",
    String.raw`tabaco\s+(?:para\s+)?(?:pipa|hookah|narguil[ae]|shisha|liar|forjar|enrolar|mascar|rape)`,
    String.raw`tabaco\s+(?:en\s+)?(?:hoja|rama|picado|suelto|organico)`,
    "marlboro",
    String.raw`pall\s+mall`,
    String.raw`lucky\s+strike`,
    String.raw`benson\s*(?:&|y|and)\s*hedges`,
    "iqos",
    "heets",
    "snus",
  ]),
  // Copias sin licencia y formas de saltarse protecciones (LFDA arts. 231 y 232 Bis; CPF 424 bis y
  // 427 Bis).
  rule("piracy", "offer", [
    "iptv",
    String.raw`magis\s*tv`,
    String.raw`xuper\s*tv`,
    String.raw`(?:tv\s*box|android\s*box|fire\s*stick|firestick|fire\s*tv(?:\s*stick)?|roku|chromecast|kodi|decodificador(?:es)?|receptor(?:es)?)\s+(?:(?:4k|hd|android|tv|amazon|pro|max|ultra|smart)\s+){0,2}cargad[oa]s?`,
    // «Box» o «stick» solos solo con un apellido de aparato: un «box cargado de dulces» es un regalo.
    String.raw`(?:box|stick)\s+(?:(?:4k|hd|android|tv|amazon|pro|max|ultra|smart)\s+){1,2}cargad[oa]s?`,
    // Una tableta «cargada con aplicaciones educativas» no es piratería: solo canales y películas.
    String.raw`cargad[oa]s?\s+con\s+(?:canales|peliculas|series|kodi|futbol|deportes|magis|iptv|contenido\s+(?:premium|de\s+paga)|todo\s+el\s+(?:contenido|futbol))`,
    // «Canales gratis sin mensualidad» es la tele abierta de una antena: solo los de paga.
    String.raw`canales\s+(?:premium|de\s+paga)\s+(?:gratis|sin\s+(?:pagar|mensualidad|costo|rentas?)|de\s+por\s+vida|desbloqueados?|liberados?)`,
    String.raw`(?:cuentas?|perfil(?:es)?|pantallas?|accesos?)\s+(?:de\s+)?${STREAMING}\s+(?:compartid[oa]s?|completas?|privad[oa]s?|original(?:es)?|premium|disponibles?|baratas?|economic[oa]s?|de\s+por\s+vida|por\s+(?:\d+\s+)?(?:mes(?:es)?|anos?|dias?)|(?:de\s+)?\d+\s+(?:mes(?:es)?|anos?|dias?)|a\s+\$\s*\d[\d,.]*|\$\s*\d[\d,.]*|en\s+venta)`,
    String.raw`${STREAMING}\s+compartid[oa]s?`,
    String.raw`(?:vendo|vendemos|venta\s+de|se\s+venden?|rento|rentamos|renta\s+de|ofrezco)\s+(?:mi\s+|mis\s+)?(?:cuentas?|perfil(?:es)?|pantallas?)\s+(?:de\s+)?(?:streaming|${STREAMING})`,
    String.raw`cursos?\s+completos?\s+(?:\S+\s+){0,4}?(?:en\s+)?pdf`,
    // Por volumen: un paquete de 3 libros propios sí; «+500 libros en PDF», no.
    String.raw`(?:mega\s*packs?|megapacks?)\s+(?:de\s+)?(?:\S+\s+){0,2}?(?:libros|ebooks|e-books|cursos|novelas|comics|mangas|audiolibros)`,
    String.raw`(?:\+\s*)?(?:[5-9]\d|\d{3,}|\d{1,3}(?:[.,]\d{3})+|\d+\s*mil)\s+(?:libros|ebooks|e-books|cursos|audiolibros|novelas|comics|mangas)\s+(?:en\s+)?(?:pdf|digital(?:es)?|epub)`,
    String.raw`${CRACK}\s+(?:de\s+|para\s+|del\s+)?${SOFTWARE}`,
    String.raw`${CRACK}\s+(?:de\s+|para\s+)${GENERIC_SOFTWARE}`,
    String.raw`${SOFTWARE}\s+(?:\S+\s+){0,3}?crackead[oa]s?`,
    String.raw`${SOFTWARE}\s+(?:\S+\s+){0,3}?(?:con|\+|y|incluye|full)\s+crack`,
    String.raw`(?:juegos?|programas?|software|apps?|aplicaciones)\s+crackead[oa]s?`,
    "keygen",
    String.raw`kms\s*pico`,
    // «Activador de rizos» es para el cabello: solo el de programas.
    String.raw`activador(?:es)?\s+(?:de\s+|para\s+|del\s+)?(?:windows|office|kms|adobe|autocad|programas?|software|photoshop|corel(?:draw)?)`,
    String.raw`activacion\s+(?:de\s+|del\s+)?(?:windows|office)\s+(?:de\s+por\s+vida|permanente|gratis|ilimitada)`,
    String.raw`serial(?:es)?\s+(?:de\s+|para\s+|del\s+)?(?:windows|office|photoshop|adobe|autocad|antivirus)`,
  ]),
  rule("piracy", "item", [
    // En una publicación pueden ser preguntas («¿cómo quito la cuenta de Google?»); en una ficha,
    // no. «Celular liberado» (de compañía) y «desbloqueo facial» sí se venden.
    String.raw`(?:desbloqueos?|desbloquear|desbloqueamos|liberacion(?:es)?|liberar|liberamos|eliminacion|eliminar|eliminamos|quitar|quitamos|quito|bypass|remover|removemos)\s+(?:de\s+|del\s+)?(?:la\s+|el\s+|tu\s+)?(?:icloud|frp|apple\s*id|mdm|cuentas?\s+(?:de\s+)?(?:google|icloud|apple))`,
    String.raw`icloud\s+(?:bypass|desbloqueado|liberado|unlock)`,
    // «Switch» solo también es un apagador o un switch de red.
    String.raw`(?:desbloqueos?|chipeos?|chipear|flasheos?)\s+(?:de\s+|del\s+)?(?:consolas?|ps[1-5]|playstation|xbox|nintendo\s+switch|wii|psp|3ds)`,
    String.raw`(?:consolas?|ps[1-5]|playstation\s*[1-5]?|xbox(?:\s+(?:360|one|series\s+[sx]))?|nintendo\s+switch|switch\s+(?:oled|lite)|wii\s*u?|psp|3ds)\s+(?:\S+\s+)?(?:desbloquead[oa]s?|chipead[oa]s?|flasheado|hackead[oa]s?|con\s+chip)`,
    "jailbreak",
    // Vender la cuenta. «Inicia sesión con tu cuenta de Netflix» describe una tele y «escúchanos en
    // nuestro perfil de Spotify» promueve una banda: no venden la cuenta («vendo mi cuenta», arriba).
    String.raw`(?<!(?:tu|su|tus|sus|mi|mis|nuestr[oa]s?|propia|propias|misma)\s)(?:cuentas?|perfil(?:es)?|pantallas?)\s+(?:de\s+)?${STREAMING}`,
    String.raw`cursos?\s+(?:de\s+)?(?:platzi|domestika|udemy|crehana|coursera|masterclass|hotmart)`,
  ]),
  // Anunciar la compra o venta de facturas (CFDI) es delito, también para la plataforma (CFF art.
  // 113 Bis). Una tienda que factura lo que vende («emitimos facturas deducibles») sí puede decirlo.
  rule("fake_invoices", "offer", [
    // «Ofrecemos facturas» lo dice una tienda que factura; «ofrecemos facturas deducibles», «de
    // cualquier giro» o «al 3 %» se detienen abajo.
    String.raw`(?:vendo|vendemos|venta\s+de|se\s+venden?|compro|compramos|compra\s+de|renta\s+de)\s+(?:de\s+)?(?:facturas|cfdis?|comprobantes\s+fiscales|recibos\s+(?:de\s+honorarios|deducibles))`,
    String.raw`(?<!(?:emitimos|expedimos|entregamos|damos|doy|emito|expido|entrego|incluye|incluyen|incluimos|con|y|o|se\s+(?:emiten|expiden|entregan|dan|incluyen))\s)facturas\s+deducibles`,
    // La comisión por factura, no el IVA («factura con 16 % adicional»).
    String.raw`facturas?\s+(?:deducibles?\s+)?(?:al|a|por|desde|con)\s+(?:solo\s+)?(?:el\s+)?(?!16(?:[.,]0+)?\s*(?:%|por\s*ciento))\d+(?:[.,]\d+)?\s*(?:%|por\s*ciento)(?!\s*(?:de\s+)?iva)`,
    String.raw`facturas?\s+(?:deducibles?\s+)?(?:de|para|con)\s+(?:cualquier|todos\s+los|todas\s+las)\s+(?:giros?|conceptos?|actividad(?:es)?)`,
    String.raw`facturas?\s+(?:deducibles?\s+)?sin\s+(?:compra|comprar|operacion|gasto|mercancia|consumo)`,
    String.raw`facturacion\s+sin\s+(?:compra|operacion|consumo)`,
    "factureras?",
    String.raw`cfdis?\s+(?:en\s+venta|a\s+la\s+venta|deducibles)`,
  ]),
  // Anuncios de servicios sexuales y de reclutamiento que facilitan la trata (LGPSEDMTP arts. 32,
  // 33 y 106): el riesgo penal más alto para quien opera un medio electrónico.
  rule("sexual_services", "offer", [
    String.raw`servicios?\s+(?:sexual(?:es)?|eroticos?|de\s+(?:acompanante|escorts?|sexo))`,
    // «Ford Escort 1998» es un coche.
    String.raw`(?<!ford\s)escorts?(?!\s+(?:\d|(?:wagon|zx2|gt|lx|gl|sw)(?![\p{L}\p{N}])))`,
    String.raw`(?:chicas?|ninas?|senoritas?|modelos?|mujeres)\s+(?:de\s+)?compania`,
    // «Dama de compañía para adulto mayor» es un trabajo de cuidados.
    String.raw`damas?\s+de\s+compania(?!\s+para\s+(?:(?:un|una|el|la|mi)\s+)?(?:adult[oa]s?\s+mayor(?:es)?|senora|senor|persona|abuelit[oa]|paciente))`,
    String.raw`acompanantes?\s+(?:vip|independientes?|discret[oa]s?|sexys?|cachond[oa]s?|calientes?|intim[oa]s?|para\s+caballeros)`,
    String.raw`masajes?\s+(?:eroticos?|sensual(?:es)?|con\s+final\s+feliz|nuru|body\s*(?:to|2)\s*body|cuerpo\s+a\s+cuerpo|tantricos?|prostaticos?)`,
    // «Vendo pack de 6 cervezas» sí: el pack es «mi pack».
    String.raw`(?:vendo|venta\s+de|vendemos|ofrezco)\s+(?:mi|mis)\s+packs?`,
    String.raw`(?:vendo|venta\s+de|vendemos|ofrezco)\s+(?:mis\s+)?(?:nudes|fotos\s+(?:hot|desnud[oa]s?|intimas|eroticas|xxx|sin\s+ropa)|videos?\s+(?:hot|xxx|intimos|eroticos|sexuales)|contenido\s+(?:\+\s*18|xxx|para\s+adultos|erotico|sexual|hot|explicito))`,
    String.raw`packs?\s+(?:\+\s*18|xxx|eroticos?|de\s+nudes|nudes|intimos?)`,
    String.raw`(?:mi|link\s+(?:de|a)\s+mi|suscribete\s+a\s+mi|siguenme\s+en\s+mi)\s+(?:onlyfans|only\s*fans|fansly)`,
    String.raw`(?:modelos?|chicas?)\s+(?:para\s+)?webcam|(?:trabajo|empleo)\s+(?:de|como|en)\s+(?:modelo\s+)?webcam|webcam\s+models?`,
    // «Cine de ficheras» es un género del cine mexicano.
    String.raw`(?<!(?:cine|peliculas?|pelis?)\s+de\s+)ficheras?`,
    String.raw`(?:se\s+)?solicitan?\s+(?:senoritas?|chicas?|damas?|muchachas?|bailarinas?)\s+(?:para\s+)?(?:bar|bares|table(?:\s*dance)?|antro|cantina|centro\s+nocturno|club\s+nocturno|masajes?|spa\s+para\s+caballeros|fichar)`,
    // Meseras o edecanes para un bar es un trabajo común; para un table dance o para fichar, no.
    String.raw`(?:se\s+)?solicitan?\s+(?:meseras?|edecanes)\s+(?:para\s+)?(?:table(?:\s*dance)?|centro\s+nocturno|club\s+nocturno|spa\s+para\s+caballeros|fichar)`,
  ]),
  // Una oferta de trabajo para mujeres jóvenes con una señal típica del reclutamiento engañoso. Las
  // señales son las fuertes: «sueldo atractivo», «con hospedaje» o «no menores de edad» también los
  // dice un trabajo legítimo.
  both(
    "sexual_services",
    "offer",
    [
      String.raw`(?:se\s+)?(?:solicitan?|busco|buscamos|necesito|necesitamos|contrato|contratamos|reclutamos|vacantes?\s+para|empleo\s+para|trabajo\s+para)\s+(?:\d+\s+)?(?:senoritas?|chicas?|muchachas?|jovencitas?|mujeres|damas|edecanes|modelos|bailarinas|meseras|anfitrionas)`,
    ],
    [
      // La paga, solo si promete «hasta» o mucho (desde $10,000 a la semana o $1,000 al día):
      // «ganas $2,500 a la semana más propinas» también lo dice un trabajo legítimo.
      String.raw`gana(?:s|ras|r)?\s+(?:hasta|mas\s+de|arriba\s+de)\s+\$?\s*\d[\d,.]*\s*(?:mil\s+)?(?:pesos\s+)?(?:a\s+la\s+|por\s+|al\s+)?(?:semana|semanales|diarios|dia)`,
      String.raw`gana(?:s|ras|r)?\s+\$?\s*(?:\d{1,3}(?:[,.]\d{3}){2,}|\d{2,3}[,.]\d{3}|\d{5,}|\d{2,}\s*mil)\s*(?:pesos\s+)?(?:a\s+la\s+|por\s+|al\s+)?(?:semana|semanales)`,
      String.raw`gana(?:s|ras|r)?\s+\$?\s*(?:\d{1,3}(?:[,.]\d{3})+|\d{4,}|\d+\s*mil)\s*(?:pesos\s+)?(?:al\s+|por\s+)?(?:dia|diarios)`,
      String.raw`(?:viajes?|vuelos?|boletos?|pasajes?)\s+(?:de\s+avion\s+)?(?:pagad[oa]s?|todo\s+pagado)`,
      String.raw`(?:trabajo|trabajar|empleo)\s+en\s+(?:el\s+)?(?:extranjero|estados\s+unidos|usa|japon|europa|espana|canada|dubai)`,
      String.raw`fotos?\s+(?:de\s+)?(?:cuerpo\s+completo|en\s+(?:bikini|traje\s+de\s+bano|ropa\s+interior|lenceria))`,
      String.raw`(?:discrecion|confidencialidad)\s+(?:absoluta|total|garantizada)`,
      String.raw`(?:desde\s+(?:los\s+)?|de\s+)1[3-7]\s+(?:a\s+\d+\s+)?anos`,
    ],
  ),
  rule("sexual_services", "item", [
    String.raw`sexo\s*servicio`,
    "sexoservidor(?:a|es|as)?",
    String.raw`onlyfans|only\s*fans|fansly`,
  ]),
  // Fauna silvestre protegida y sus partes: tortugas marinas y psitácidos nativos (LGVS arts. 51,
  // 60 Bis 1 y 60 Bis 2; CPF art. 420 fr. IV).
  rule("wildlife", "offer", [
    String.raw`(?:vendo|venta\s+de|vendemos|se\s+venden?|se\s+vende|remato|regalo)\s+(?:mi\s+|mis\s+|un\s+|una\s+|unos\s+|unas\s+)?(?:${PARROTS}|tortugas?\s+(?:marinas?|carey|caguamas?|golfinas?)|monos?\s+(?:arana|aullador(?:es)?|capuchinos?)|tigrillos?|ocelotes?)${NOT_A_TOY}`,
  ]),
  rule("wildlife", "item", [
    // «Carey» solo también es el color de unos lentes o de un estampado.
    String.raw`(?:conchas?|caparazon(?:es)?|carapachos?|escamas?)\s+de\s+(?:tortuga\s+)?carey`,
    String.raw`carey\s+(?:autentico|natural|genuino|real|legitimo|verdadero|de\s+tortuga)`,
    String.raw`tortugas?\s+(?:de\s+)?carey\s+(?:vivas?|bebes?|crias?)`,
    String.raw`huev(?:it)?os?\s+de\s+tortuga`,
    String.raw`(?:buche|vejiga)\s+de\s+totoaba|totoabas?`,
    String.raw`${NOT_A_DEPICTION}${PARROTS}${NOT_A_TOY}\s+(?:bebes?|vivos?|vivas?|silvestres?|domesticad[oa]s?|mans[oa]s?|que\s+habla|hablador(?:es|as?)?|cabeza\s+amarilla|frente\s+(?:roja|naranja|blanca|amarilla)|nuca\s+amarilla|cachete\s+amarillo|real(?:es)?|mexican[oa]s?|en\s+venta|a\s+la\s+venta|para\s+adoptar|de\s+(?:\d+|un|dos|tres|cuatro)\s+(?:mes|meses|semanas))`,
    String.raw`pericos?\s+(?:frente\s+naranja|atolero|mexicano|cabeza\s+amarilla)`,
    String.raw`(?:pichon(?:es)?|polluelos?|crias?|pollitos?)\s+de\s+(?:guacamaya|loro|perico|cotorra|tucan)s?`,
    String.raw`(?:piel(?:es)?|colmillos?|garras?|craneos?|cueros?)\s+de\s+(?:jaguar|ocelote|tigrillo|lobo\s+mexicano|tortuga\s+marina)`,
    String.raw`colmillos?\s+de\s+elefante|marfil\s+(?:genuino|autentico|natural|real|de\s+elefante)`,
    String.raw`monos?\s+(?:arana|aullador(?:es)?)\s+(?:bebes?|vivos?|crias?|en\s+venta)`,
  ]),
];

/**
 * ¿El texto de una publicación ofrece algo? Precio, «vendo», «envíos», «inbox», «pedidos»… Solo
 * decide si las reglas de artículos (`item`) cuentan en una publicación; por sí solo no bloquea nada.
 */
const OFFER_CONTEXT = phrases([
  "vendo",
  "vendemos",
  String.raw`se\s+venden?`,
  "ventas?",
  "remato",
  "remate",
  "precios?",
  "cotiza",
  "cotizaciones",
  "informes",
  String.raw`info\s+(?:por|al|en|inbox)`,
  "pedidos",
  "envios?",
  String.raw`entregas?\s+(?:en|a\s+domicilio|personal(?:es)?|gratis)`,
  "entregamos",
  "mayoreo",
  "menudeo",
  "interesad[oa]s",
  "inbox",
  "dm",
  String.raw`mensaje\s+privado`,
  "whats(?:app)?",
  "apartados?",
  "ofertas?",
  "promocion(?:es)?",
  "compr(?:alo|ala|alos|alas|en)",
  "disponibles?",
  String.raw`a\s+la\s+venta`,
  String.raw`en\s+venta`,
  String.raw`\$\s*\d[\d,.]*`,
  String.raw`\d[\d,.]*\s*(?:pesos|mxn|varos)`,
]);

/**
 * Forma canónica: letras y dígitos de ancho completo a los normales y sin caracteres invisibles
 * (`normalizeText`), en minúsculas y sin acentos con la tabla de la búsqueda (`foldText`).
 */
function normalize(texts: readonly string[]) {
  return foldText(normalizeText(texts.join("\n")));
}

function firstMatch<C extends ProhibitedCategory>(
  categories: readonly C[],
  text: string,
  includeItems: boolean,
): C | null {
  for (const { kind, scope, test } of RULES) {
    if (!(categories as readonly ProhibitedCategory[]).includes(kind)) continue;
    if (scope === "item" && !includeItems) continue;
    if (test(text)) return kind as C;
  }
  return null;
}

/** Lo que la IA no ayuda a vender (con las categorías de siempre), o `null`. */
export function prohibitedForAi(...texts: string[]): AiCategory | null {
  return firstMatch(AI_CATEGORIES, normalize(texts), true);
}

/** Primera categoría prohibida en el título, la descripción o las etiquetas de un producto. */
export function prohibitedInListing(...texts: string[]): ManualCategory | null {
  return firstMatch(MANUAL_CATEGORIES, normalize(texts), true);
}

/**
 * Primera categoría prohibida en el texto de una publicación. `offer`: la publicación etiqueta un
 * producto (ya vende algo aunque el texto no lo diga).
 */
export function prohibitedInPost(
  text: string,
  { offer }: { offer: boolean },
): ManualCategory | null {
  const normalized = normalize([text]);
  return firstMatch(MANUAL_CATEGORIES, normalized, offer || OFFER_CONTEXT.test(normalized));
}

/**
 * Qué detectamos, en palabras de la persona. Dice QUÉ palabras vimos, no qué es la persona ni su
 * producto: los patrones también pueden atrapar algo legítimo y el mensaje no debe sonar a acusación.
 */
const DETECTED: Record<ManualCategory, string> = {
  weapons:
    "Tu texto menciona armas, municiones o sus partes y accesorios, y en México no se pueden vender por internet.",
  drugs: "Tu texto menciona drogas o THC, y no se pueden vender ni promocionar.",
  prescription: "Tu texto menciona medicamentos que requieren receta, y aquí no se pueden vender.",
  vapes:
    "Tu texto menciona vapeadores, cigarros electrónicos o sus líquidos, y en México su venta y su publicidad están prohibidas.",
  tobacco:
    "Tu texto menciona cigarros, puros, tabaco o marcas de cigarros, y en México no se pueden vender por internet.",
  piracy:
    "Tu texto menciona copias sin licencia o formas de saltarse protecciones (IPTV, cuentas compartidas, cursos en PDF, cracks, activadores o desbloqueos), y eso infringe derechos de autor.",
  fake_invoices:
    "Tu texto menciona la compra o venta de facturas, y anunciarla es un delito en México.",
  sexual_services:
    "Tu texto tiene frases que se usan para ofrecer servicios sexuales o contenido para adultos, o en ofertas de trabajo engañosas, y eso no se permite.",
  wildlife:
    "Tu texto menciona animales silvestres protegidos o sus partes (como carey, loros o guacamayas), y su venta está prohibida.",
};

/** Liga que explica un error de publicación; el formulario la muestra junto al mensaje. */
export type PolicyHelpLink = { href: Route; label: string };

/** La sección de los Términos con la lista completa (ancla de `/terminos`). */
export const PROHIBITED_HELP: PolicyHelpLink = {
  href: "/terminos#prohibidos" as Route,
  label: "Ver qué no se puede publicar",
};

/** Nombra la sección como se titula en `/terminos`, para encontrarla aunque no se vea la liga. */
export function prohibitedMessage(category: ManualCategory) {
  return `No se puede publicar. ${DETECTED[category]} Si se trata de otra cosa, cambia esas palabras. Consulta «Artículos prohibidos y restringidos» en los Términos.`;
}

/** Dónde se detuvo una publicación (para el registro). */
export type PolicyCheckpoint = "product.create" | "product.update" | "post.create";

/**
 * Lo que responde la acción cuando el texto no se puede publicar. Registra la categoría y el lugar,
 * nunca el texto ni quién lo escribió: alcanza para medir la regla sin guardar datos personales.
 * No toca la cuenta: es un aviso para corregir, no una sanción.
 */
export function blockedByPolicy(checkpoint: PolicyCheckpoint, category: ManualCategory) {
  console.warn(
    `[trust] publicación detenida por la política de contenido: ${category} (${checkpoint})`,
  );
  return { error: prohibitedMessage(category), helpLink: PROHIBITED_HELP };
}
