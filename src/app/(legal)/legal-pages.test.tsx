import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LEGAL_VERSIONS } from "@/modules/identity/constants";
import { PROHIBITED_HELP } from "@/modules/trust/content-policy";
import CookiesPage, { COOKIES_NOTICE_UPDATED } from "./cookies/page";
import PrivacyNoticePage from "./privacidad/page";
import TermsPage from "./terminos/page";

// Los textos legales son borradores: lo que falta llenar debe verse marcado como pendiente, y cada
// página muestra la versión con la que se registra el consentimiento.
describe("Aviso de privacidad", () => {
  it("muestra su versión y lo que cambió, con ligas a cada sección", () => {
    render(<PrivacyNoticePage />);

    expect(
      screen.getByText(`Borrador para revisión legal · versión ${LEGAL_VERSIONS.privacyNotice}`),
    ).toBeInTheDocument();
    for (const [name, id] of [
      ["«Entrar con Google»", "entrar-con-google"],
      ["«Buscar con una foto»", "buscar-con-una-foto"],
      ["«Contexto»", "contexto"],
      ["«Colaboraciones con tiendas»", "colaboraciones"],
      ["«Videos»", "videos"],
      ["«Medición de anuncios»", "medicion-de-anuncios"],
    ] as const) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", `#${id}`);
      expect(document.getElementById(id)).toHaveRole("heading");
    }
  });

  it("nombra a Google LLC (EE. UU.) en «Entrar con Google» y solo lo que pide la app", () => {
    render(<PrivacyNoticePage />);

    const page = document.body;
    // docs/deploy.md 6 bis.0: el aviso nombra a Google mientras el botón exista. Better Auth pide
    // solo `openid`, `email` y `profile` (server/auth.ts no agrega alcances).
    expect(page).toHaveTextContent(
      "Si eliges «Continuar con Google» para crear tu cuenta o entrar, Google LLC, en Estados Unidos,",
    );
    expect(page).toHaveTextContent("«openid», «email» y «profile»");
    // `sanitizeUserWrite` deja `image` vacía: la liga a la foto llega, pero no es tu foto de perfil.
    expect(page).toHaveTextContent("no usamos la foto de Google como tu foto de perfil");
    // También en «Encargados y transferencias», con su país, pero como responsable por su cuenta: no
    // trata datos por encargo de speeaking (ADR-076).
    expect(page).toHaveTextContent(
      "Google LLC, en Estados Unidos, no es nuestro encargado: si eliges «Continuar con Google»",
    );
  });

  it("promete solo lo que hacen la búsqueda por foto, los videos y las colaboraciones", () => {
    render(<PrivacyNoticePage />);

    const page = document.body;
    // La foto no se guarda (`search/photo-search-service.ts`: ni almacenamiento ni `AIRequest`).
    expect(page).toHaveTextContent("La foto no se guarda en ningún lado");
    // El navegador quita la ubicación y el servidor rechaza lo que la traiga (`video-metadata.ts`).
    expect(page).toHaveTextContent(
      "tu navegador los quita antes de subirlo y nuestro servidor no publica un video que todavía los traiga",
    );
    // Conteos por publicación sin quién (`creators/metrics.ts`).
    expect(page).toHaveTextContent("Nunca ven quién visitó, se probó o compró.");
  });

  it("explica las impresiones visibles, su anonimización y el plazo del código de deduplicación", () => {
    render(<PrivacyNoticePage />);

    const page = document.body;
    expect(page).toHaveTextContent(
      "al menos a la mitad dentro de tu pantalla (o, si es más alta que la pantalla, ocupa al menos la mitad de ella) durante 1 segundo seguido",
    );
    expect(page).toHaveTextContent(
      "sin tu cuenta, sin el grupo de prueba y con la hora redondeada",
    );
    // Sin cuenta la hora NO se redondea (`recordVisibleImpressions` guarda como `track`): el aviso
    // no promete lo que el código no hace.
    expect(page).toHaveTextContent(
      "Si navegas sin cuenta, se guarda sin cuenta a la cual ligarla, sin tu IP y sin grupo de prueba; en ese caso la hora no se redondea",
    );
    expect(page).not.toHaveTextContent("o navegas sin cuenta, se guarda sin ligarla a nadie");
    expect(page).toHaveTextContent("vence a más tardar a las 25 horas y después se borra");
  });

  it("nombra al proveedor de IA y deja marcados como pendientes los plazos que el código no aplica", () => {
    render(<PrivacyNoticePage />);

    // docs/deploy.md §6: la IA real va por OpenRouter (ADR-076 llenó el dato pendiente).
    expect(screen.queryByText("[Proveedor de IA: nombre y país — pendiente]")).toBeNull();
    expect(document.body).toHaveTextContent(
      "Proveedor de inteligencia artificial (encargado): OpenRouter, Inc. (Estados Unidos)",
    );
    expect(
      screen.getByText(/^\[Plazo máximo — pendiente; propuesta: 180 días/),
    ).toBeInTheDocument();
    expect(screen.getByText("[Plazo máximo — pendiente]")).toBeInTheDocument();
  });
});

describe("Términos y condiciones", () => {
  it("muestra su versión, la señal opcional de IA y cómo se avisa de los cambios", () => {
    render(<TermsPage />);

    expect(
      screen.getByText(`Borrador para revisión legal · versión ${LEGAL_VERSIONS.terms}`),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Qué cambió en esta versión" })).toBeInTheDocument();
    expect(screen.getByText(/nunca decide sola\. Si declaraste/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cambios" })).toBeInTheDocument();
  });

  it("«Pruébatelo» lo paga la tienda o la plataforma, nunca quien compra (ADR-046)", () => {
    render(<TermsPage />);

    const page = document.body;
    // Mismo orden que `tryon/funding.ts`: saldo de la tienda con tope del día → cortesía → nada.
    expect(page).toHaveTextContent("Quien compra nunca paga por «Pruébatelo»");
    expect(page).toHaveTextContent(
      "Cada simulación la paga la tienda que vende el producto principal, desde su saldo,",
    );
    expect(page).toHaveTextContent("con las pruebas de cortesía que le da a cada tienda");
    expect(page).toHaveTextContent("la simulación no se genera");
    expect(page).toHaveTextContent("Solo las tiendas tienen saldo");
    // El modelo anterior (ADR-044) ya no existe: ni simulaciones gratis al mes ni saldo personal.
    expect(page).not.toHaveTextContent("Tienes un número de simulaciones gratis al mes");
    expect(page).not.toHaveTextContent("las demás se pagan con saldo");
  });

  it("explica las colaboraciones y las cuentas editoriales como funcionan", () => {
    render(<TermsPage />);

    expect(screen.getByRole("link", { name: "«Colaboraciones con tiendas»" })).toHaveAttribute(
      "href",
      "#colaboraciones",
    );
    expect(document.getElementById("colaboraciones")).toHaveRole("heading");
    const page = document.body;
    // Apagado por omisión y solo productos a la venta (`creators/rules.ts`).
    expect(page).toHaveTextContent(
      "activaron «Aceptar colaboraciones» en su Studio (viene apagado)",
    );
    // Quitar la etiqueta quita también la marca (`removeProductTag`): no se promete otra cosa.
    expect(page).toHaveTextContent("la publicación sigue, ya sin el producto ni la etiqueta");
    expect(page).toHaveTextContent("no cobramos ni pagamos comisiones por ellos");
    // Redacción diaria (ADR-066): nada se publica sin aprobación.
    expect(page).toHaveTextContent("una persona del equipo revisa y aprueba antes de publicar");
  });

  it("solo promete bitácora para las acciones que el equipo tiene y registra", () => {
    render(<TermsPage />);

    // Ocultar, restaurar y cambiar a genérico quedan en la bitácora (`trust/service.ts`); suspender
    // la venta aún no tiene pantalla ni bitácora, así que no entra en esa promesa.
    expect(document.body).toHaveTextContent(
      "cambiar un producto a «genérico» y restaurar lo que hayamos ocultado por error. Estas acciones las toma una persona del equipo, nunca la inteligencia artificial, y quedan registradas",
    );
    expect(document.body).not.toHaveTextContent(
      "suspender la venta de una cuenta que incumpla estas reglas, y restaurar",
    );
  });
});

describe("Cookies", () => {
  it("lista cada cookie real con su duración y enlaza al aviso", () => {
    render(<CookiesPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Cookies" })).toBeInTheDocument();
    expect(document.body).toHaveTextContent(`actualizado el ${COOKIES_NOTICE_UPDATED}`);
    for (const name of [
      "speeaking… (sesión)",
      "speeaking-nav",
      "speeaking_bienvenida",
      "speeaking_anuncios",
      "_ttp, ttcsid… (TikTok)",
    ]) {
      expect(screen.getByRole("cell", { name })).toBeInTheDocument();
    }
    expect(
      screen
        .getAllByRole("link", { name: "aviso de privacidad" })
        .map((link) => link.getAttribute("href")),
    ).toEqual([
      "/privacidad#medicion-de-anuncios",
      "/privacidad#publicaciones-en-pantalla",
      "/privacidad",
    ]);
  });

  it("dice la verdad sobre el pixel de TikTok (ADR-072): solo si aceptas y solo en lo público", () => {
    render(<CookiesPage />);

    expect(document.getElementById("anuncios")).toHaveRole("heading");
    const page = document.body;
    expect(page).toHaveTextContent("Solo se carga si aceptas");
    expect(page).toHaveTextContent("nunca en tus mensajes, pedidos, perfiles ni en tu feed");
    // Ya no promete lo que dejó de ser cierto.
    expect(page).not.toHaveTextContent("No hay cookies de terceros, ni de publicidad");
    expect(page).not.toHaveTextContent("no hay nada opcional que aceptar");
    // Desde aquí se cambia la decisión.
    expect(
      screen.getByRole("group", { name: "Tu decisión sobre la medición de anuncios" }),
    ).toBeInTheDocument();
  });
});

describe("Aviso de privacidad: medición de anuncios (ADR-072)", () => {
  it("nombra a TikTok, qué recibe, que es opcional y que no vale para lo privado", () => {
    render(<PrivacyNoticePage />);

    const page = document.body;
    expect(page).not.toHaveTextContent("No usamos cookies de publicidad ni de rastreo: solo");
    expect(page).toHaveTextContent(
      "Medir si nuestros anuncios en TikTok traen personas a speeaking, solo si lo aceptas",
    );
    expect(page).toHaveTextContent("nunca en tus mensajes, pedidos, perfiles ni en tu feed");
    expect(page).toHaveTextContent("TikTok recibe");
  });
});

// ADR-076: contenido de usuarios y derechos. Las páginas solo prometen lo que hace el código de este
// cambio (formularios de /derechos-de-autor, archivos bloqueados, reportes prioritarios, casilla de
// 18 años) y dejan marcado como pendiente lo que falta del fundador (razón social, domicilio, correos).
function linkHrefs() {
  return screen.getAllByRole("link").map((link) => link.getAttribute("href"));
}

function follows(first: HTMLElement, second: HTMLElement) {
  return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
}

/**
 * Lo que va de un `h2` al siguiente. En las páginas legales todos los encabezados comparten el mismo
 * `<article>`: el «padre» de una sección sería la página entera y la prueba no probaría nada.
 */
function sectionUnder(heading: HTMLElement) {
  const section = document.createElement("section");
  for (
    let node = heading.nextElementSibling;
    node && node.tagName !== "H2";
    node = node.nextElementSibling
  ) {
    section.append(node.cloneNode(true));
  }
  return section;
}

describe("Términos: quién opera, edad y permiso sobre el contenido (ADR-076)", () => {
  it("lo nuevo encabeza «Qué cambió», con ligas a cada sección", () => {
    render(<TermsPage />);

    const changes = screen.getByRole("heading", {
      name: "Qué cambió en esta versión",
    }).parentElement!;
    expect(changes.querySelector("li")).toHaveTextContent("18 años o más");
    for (const [name, id] of [
      ["«Quiénes somos y cómo contactarnos»", "quienes-somos"],
      ["«Reglas de la comunidad»", "reglas-de-la-comunidad"],
      ["«Artículos prohibidos y restringidos»", "articulos-prohibidos"],
      ["«Derechos de autor y marcas»", "derechos-de-autor"],
      ["«Tu contenido y el permiso que nos das»", "tu-contenido"],
      ["«Si vendes: permiso sobre tus productos y fotos»", "si-vendes"],
      ["«Moderación, sanciones y cómo pedir revisión»", "moderacion"],
      ["«Inteligencia artificial»", "inteligencia-artificial"],
    ] as const) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", `#${id}`);
      expect(document.getElementById(id)).toHaveRole("heading");
    }
  });

  it("dice quién opera speeaking con los datos del fundador marcados como pendientes", () => {
    render(<TermsPage />);

    const section = sectionUnder(document.getElementById("quienes-somos")!);
    expect(section).toHaveTextContent("speeaking es el nombre comercial de la plataforma");
    // Nada inventado: cada dato que falta se ve como pendiente (LFPC art. 76 BIS fr. III).
    for (const pending of [
      "[Nombre completo o razón social de quien opera speeaking — pendiente]",
      "[RFC — pendiente]",
      "[Domicilio completo en México para oír y recibir notificaciones — pendiente]",
      "[Teléfono de atención — pendiente]",
      "[Días y horario de atención — pendiente]",
      "[Correo de soporte — pendiente]",
      "[Correo para autoridades y asuntos legales — pendiente]",
    ]) {
      expect(screen.getAllByText(pending).length).toBeGreaterThan(0);
    }
    const page = document.body;
    expect(page).toHaveTextContent("Todos estos canales son gratuitos.");
    // Quejas: acuse en 1 día hábil, respuesta en 10 y la PROFECO en cualquier momento.
    expect(page).toHaveTextContent("en un máximo de 1 día hábil");
    expect(page).toHaveTextContent("en un máximo de 10 días hábiles");
    // El formulario de avisos siempre está disponible, aunque falten los correos.
    expect(linkHrefs()).toContain("/derechos-de-autor#aviso");
  });

  it("solo personas de 18 años o más, y qué pasa con la cuenta de una persona menor", () => {
    render(<TermsPage />);

    expect(screen.getByRole("heading", { name: "Edad mínima: 18 años" })).toBeInTheDocument();
    const page = document.body;
    expect(page).toHaveTextContent(
      "Para crear una cuenta, comprar, vender o usar «Pruébatelo» debes tener 18 años cumplidos.",
    );
    expect(page).toHaveTextContent("la cerramos y borramos sus datos");
  });

  it("la licencia sobre tu contenido: no exclusiva, solo dentro de speeaking y sin entrenar modelos", () => {
    render(<TermsPage />);

    const page = document.body;
    expect(page).toHaveTextContent("Lo que publicas es tuyo.");
    expect(page).toHaveTextContent("permiso no exclusivo y gratuito");
    expect(page).toHaveTextContent("solo usamos tu contenido si nos das permiso aparte");
    // Los derechos morales no se renuncian (LFDA art. 19): solo adaptaciones técnicas, con crédito.
    expect(page).toHaveTextContent("no cambian el sentido de tu obra");
    expect(page).toHaveTextContent("ni lo usamos para entrenar modelos de inteligencia artificial");
    expect(page).toHaveTextContent("no quitaste marcas de agua ni créditos");
  });

  it("quien vende nos da permiso sobre sus fotos para la tienda, los looks, «Patrocinado» y «Pruébatelo»", () => {
    render(<TermsPage />);

    const page = document.body;
    expect(page).toHaveTextContent("en los looks del estilista, en los lugares «Patrocinado»");
    expect(page).toHaveTextContent(
      "generar las simulaciones de «Pruébatelo», que combinan la foto del producto con la foto de quien se lo prueba",
    );
    expect(page).toHaveTextContent("No nos cedes ningún derecho.");
    expect(page).toHaveTextContent("necesitas el permiso de la marca");
  });

  it("la publicidad pagada va en la parte de quien vende, antes del saldo", () => {
    render(<TermsPage />);

    const seller = screen.getByRole("heading", {
      name: "Si vendes: permiso sobre tus productos y fotos",
    });
    const paid = screen.getByRole("heading", { name: "Publicidad pagada e infracciones" });
    const balance = screen.getByRole("heading", { name: "Estilista, «Pruébatelo» y saldo" });
    expect(follows(seller, paid)).toBe(true);
    expect(follows(paid, balance)).toBe(true);
    // `billing/service.ts` rechaza destacar lo que no está visible (PRODUCT_NOT_SELLABLE).
    expect(sectionUnder(paid)).toHaveTextContent("no se puede destacar");
  });
});

describe("Términos: lo que no se puede subir ni vender (ADR-076)", () => {
  it("las reglas de la comunidad cubren lo íntimo, los menores, la imagen ajena y la piratería", () => {
    render(<TermsPage />);

    expect(
      screen.getByRole("heading", { name: "Reglas de la comunidad: lo que no se puede subir" }),
    ).toBeInTheDocument();
    const page = document.body;
    for (const rule of [
      "reales o simulados, editados o hechos con IA",
      "pedirle a cualquier herramienta de IA que cree imágenes desnudas o sexuales de una persona real",
      "real, simulado, dibujado o hecho con IA",
      "sin permiso de su madre, padre o tutor",
      "su consentimiento expreso",
      "Opinar y criticar sí se vale.",
      "acompañantes",
      "Las imágenes o videos realistas hechos o editados con IA deben decir que lo son.",
      "cuentas de streaming compartidas",
      "solo música propia, con licencia o sin música",
      "Copiar fotos o textos de otras tiendas, marcas o plataformas.",
    ]) {
      expect(page).toHaveTextContent(rule);
    }
    // Lo permitido (LFDA art. 148) y lo que no tiene excepción clara.
    expect(page).toHaveTextContent("citar fragmentos breves de una obra dando el crédito");
    expect(page).toHaveTextContent("Los memes y las parodias hechos con obras ajenas");
    expect(page).toHaveTextContent("art. 114 Octies, fracción IV");
  });

  it("la lista de artículos prohibidos suma lo que la ley prohíbe vender por internet y no es exhaustiva", () => {
    render(<TermsPage />);

    const section = sectionUnder(
      screen.getByRole("heading", {
        name: "Artículos prohibidos y restringidos",
      }),
    );
    for (const item of [
      "accesorios, partes y componentes",
      "archivos o planos para imprimir armas en 3D",
      "Vapeadores",
      "IPTV pirata",
      "firestick",
      "inhibidores de señal",
      "Facturas o comprobantes fiscales (CFDI) a la venta",
      "carey",
      "retirados del mercado por la PROFECO, la COFEPRIS",
      "comunidades indígenas o afromexicanas",
      "Esta lista no es exhaustiva",
    ]) {
      expect(section).toHaveTextContent(item);
    }
    // Las prohibiciones de piloto que el fundador aún no confirma no se publican como reglas.
    expect(section).not.toHaveTextContent("Bebidas alcohólicas");
  });
});

describe("Términos: derechos de autor, moderación, cambios y tribunales (ADR-076)", () => {
  it("publica el canal formal, el contra-aviso y la política de reincidentes", () => {
    render(<TermsPage />);

    const section = sectionUnder(
      screen.getByRole("heading", {
        name: "Derechos de autor y marcas: avisos, contra-avisos y reincidentes",
      }),
    );
    expect(linkHrefs()).toEqual(
      expect.arrayContaining([
        "/derechos-de-autor#aviso",
        "/derechos-de-autor#contra-aviso",
        "/derechos-de-autor#reincidencia",
      ]),
    );
    for (const text of [
      "No lo revisamos antes de que se publique",
      "es responsabilidad de speeaking",
      "nunca condicionamos el retiro a certificados de registro",
      "Te mostramos un número de caso por cada cuenta que publicó el contenido que señalas.",
      "Los avisos formales no son anónimos.",
      "recibe tu nombre, tu correo y la descripción de tu aviso",
      // El contra-aviso se manda desde el aviso de la campana (/derechos-de-autor#contra-aviso).
      "desde el aviso que te llega en la campana",
      "con su nombre, su contacto y su domicilio",
      "entre 10 y 15 días hábiles",
      "Con 3 faltas en 12 meses cerramos la cuenta y su tienda",
      "las cuentas dedicadas a la piratería se cierran a la primera",
      "1,000 a 20,000 UMA",
      "número de registro de la marca en el IMPI",
    ]) {
      expect(section).toHaveTextContent(text);
    }
    // Lo que dejó de ser cierto: ya hay canal y los avisos formales no son anónimos.
    expect(document.body).not.toHaveTextContent("se publicará antes del lanzamiento");
    expect(document.body).not.toHaveTextContent("Quien reporta es anónimo para quien vende");
    // Los reportes de la comunidad sí siguen siendo anónimos.
    expect(section).toHaveTextContent(
      "Los reportes de la comunidad con «Reportar» sí son anónimos.",
    );
  });

  it("«Pruébatelo» ya no niega la devolución y la IA tiene reglas", () => {
    render(<TermsPage />);

    const page = document.body;
    // LFPC arts. 1 y 90: no se renuncia a la devolución con una cláusula.
    expect(page).not.toHaveTextContent("no da derecho a devolución");
    expect(page).toHaveTextContent(
      "La simulación es una imagen generada con IA, orientativa, y no forma parte de la descripción del producto. Tus derechos de cancelación, garantía y devolución frente a quien vende no cambian por ella.",
    );
    expect(page).toHaveTextContent("Usa solo tu propia foto, y solo si tienes 18 años o más.");
    expect(page).toHaveTextContent(
      "No intentes obtener imágenes desnudas, en ropa interior o sexuales.",
    );
    expect(page).toHaveTextContent("no reclama la propiedad de lo que generan sus funciones de IA");
  });

  it("moderación con motivos, revisión y órdenes de autoridad en lugar de «Cuenta»", () => {
    render(<TermsPage />);

    expect(screen.queryByRole("heading", { name: "Cuenta" })).toBeNull();
    const section = sectionUnder(
      screen.getByRole("heading", {
        name: "Moderación, sanciones y cómo pedir revisión",
      }),
    );
    for (const text of [
      "Cuida tu contraseña.",
      "nunca la inteligencia artificial",
      "Tienes 30 días naturales para pedir que revisemos una decisión",
      "en un máximo de 5 días hábiles",
      "una persona distinta de quien decidió",
      "Ministerio Público o de un juez",
      "IMPI",
      "Crear otra cuenta para evadir una suspensión o un cierre está prohibido",
    ]) {
      expect(section).toHaveTextContent(text);
    }
  });

  it("cambios con 15 días de aviso, ley mexicana, PROFECO y sin tribunales extranjeros", () => {
    render(<TermsPage />);

    const changes = sectionUnder(screen.getByRole("heading", { name: "Cambios" }));
    expect(changes).toHaveTextContent("al menos 15 días naturales antes de que apliquen");
    expect(changes).toHaveTextContent("puedes dejar de usar speeaking y eliminar tu cuenta");
    const law = sectionUnder(
      screen.getByRole("heading", {
        name: "Ley aplicable, PROFECO y tribunales",
      }),
    );
    expect(law).toHaveTextContent("en cualquier momento, sin esperar nuestra respuesta");
    expect(law).toHaveTextContent("los tribunales de tu domicilio o los de la Ciudad de México");
    expect(law).toHaveTextContent(
      "Nunca te pediremos acudir a tribunales extranjeros ni a un arbitraje obligatorio.",
    );
    expect(law).toHaveTextContent("español, que es la única versión que vale");
  });
});

describe("Aviso de privacidad: responsable, derechos y avisos de derechos (ADR-076)", () => {
  it("cita la LFPDPPP de 2025 y la SABG, con el responsable marcado como pendiente", () => {
    render(<PrivacyNoticePage />);

    const page = document.body;
    expect(page).toHaveTextContent(
      "Ley Federal de Protección de Datos Personales en Posesión de los Particulares publicada en el Diario Oficial de la Federación el 20 de marzo de 2025",
    );
    expect(page).toHaveTextContent("Secretaría Anticorrupción y Buen Gobierno");
    expect(page).toHaveTextContent(
      `Fecha de última actualización: ${LEGAL_VERSIONS.privacyNotice}`,
    );
    expect(page).not.toHaveTextContent("se completarán antes del lanzamiento");
    expect(page).not.toHaveTextContent("INAI");
    expect(
      screen.getByRole("heading", { name: "Responsable y contacto de datos" }),
    ).toBeInTheDocument();
    for (const pending of [
      "[Nombre completo o razón social de quien opera speeaking — pendiente]",
      "[Domicilio completo en México para oír y recibir notificaciones — pendiente]",
      "[Persona o área responsable de los datos personales — pendiente]",
      "[Correo de privacidad — pendiente]",
    ]) {
      expect(screen.getAllByText(pending).length).toBeGreaterThan(0);
    }
  });

  it("ARCO con plazos, gratis y sin prometer una descarga que no existe; cómo revocar cada permiso", () => {
    render(<PrivacyNoticePage />);

    const arco = sectionUnder(screen.getByRole("heading", { name: "Tus derechos (ARCO)" }));
    expect(arco).toHaveTextContent("en un máximo de 20 días hábiles");
    expect(arco).toHaveTextContent("en los 15 días hábiles siguientes");
    expect(arco).toHaveTextContent("Es gratis");
    expect(arco).toHaveTextContent("Secretaría Anticorrupción y Buen Gobierno");
    // No existe exportar datos (ajustes/page.tsx: «Descargar tus datos llegará después»).
    expect(document.body).not.toHaveTextContent("podrás descargar");
    const revoke = sectionUnder(
      screen.getByRole("heading", {
        name: "Cómo revocar tu consentimiento",
      }),
    );
    expect(revoke).toHaveTextContent("Mis fotos de prueba");
    expect(revoke).toHaveTextContent("Ajustes");
    expect(screen.getByRole("link", { name: "Cookies, «Medición de anuncios»" })).toHaveAttribute(
      "href",
      "/cookies#anuncios",
    );
  });

  it("nombra a los encargados reales y su país (docs/deploy.md §17)", () => {
    render(<PrivacyNoticePage />);

    const section = sectionUnder(
      screen.getByRole("heading", {
        name: "Encargados y transferencias",
      }),
    );
    for (const processor of [
      "Vercel Inc. (Estados Unidos",
      "Neon (Databricks, Inc., Estados Unidos",
      "Cloudflare, Inc. (Estados Unidos)",
      "Turnstile",
      "Resend (Estados Unidos)",
      "OpenRouter, Inc. (Estados Unidos)",
      "cero retención",
    ]) {
      expect(section).toHaveTextContent(processor);
    }
    // El anunciante sigue marcado: la empresa sale del contrato de la cuenta de TikTok.
    expect(
      screen.getByText("[Empresa de TikTok de la cuenta de anunciante y país — pendiente]"),
    ).toBeInTheDocument();
  });

  it("avisos de derechos: qué datos van a quién, y los reportes de la comunidad siguen anónimos", () => {
    render(<PrivacyNoticePage />);

    const section = sectionUnder(
      screen.getByRole("heading", {
        name: "Avisos de derechos, reportes y solicitudes de autoridades",
      }),
    );
    for (const text of [
      "recibe tu nombre, tu correo, la descripción de tu aviso",
      "una copia completa de tu contra-aviso, con tu nombre, tu contacto y tu domicilio",
      "IMPI",
      "INDAUTOR",
      "Fiscalía General de la República",
      "delitos contra niñas, niños y adolescentes",
    ]) {
      expect(section).toHaveTextContent(text);
    }
    expect(screen.getAllByText("[Plazo máximo de los expedientes — pendiente]")).toHaveLength(2);
    // El anonimato es solo de los reportes con «Reportar», no de los avisos formales.
    expect(document.body).toHaveTextContent(
      "Si es un reporte de la comunidad (botón «Reportar»), quien publica o vende nunca sabe quién lo reportó",
    );
  });

  it("«Pruébatelo»: sin reconocimiento ni plantilla biométrica, sin entrenar, con medidas reforzadas", () => {
    render(<PrivacyNoticePage />);

    const section = sectionUnder(document.getElementById("pruebatelo")!);
    expect(section).toHaveTextContent(
      "No la usamos para reconocerte ni identificarte, no creamos una plantilla biométrica y no se usa para entrenar modelos.",
    );
    expect(section).toHaveTextContent("como si fuera un dato sensible");
    expect(section).toHaveTextContent("OpenRouter, Inc. (Estados Unidos)");
    expect(section).toHaveTextContent("de menores, de artistas ni de figuras públicas");
  });

  it("menores, seguridad, decisiones automatizadas y la huella de los archivos retirados", () => {
    render(<PrivacyNoticePage />);

    for (const heading of [
      "Menores de edad",
      "Seguridad y vulneraciones",
      "Decisiones automatizadas y tu derecho a oponerte",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
    const page = document.body;
    expect(page).toHaveTextContent("solo para personas de 18 años o más");
    expect(page).toHaveTextContent("te avisaremos de inmediato");
    expect(page).toHaveTextContent("siempre lo decide una persona del equipo");
    expect(page).toHaveTextContent("huella digital");
  });

  it("lo nuevo encabeza «Qué cambió», con ligas a cada sección", () => {
    render(<PrivacyNoticePage />);

    const changes = screen.getByRole("heading", {
      name: "Qué cambió en esta versión",
    }).parentElement!;
    expect(changes.querySelector("li")).toHaveTextContent("Responsable y contacto de datos");
    for (const [name, id] of [
      ["«Responsable y contacto de datos»", "responsable"],
      ["«Tus derechos (ARCO)»", "derechos-arco"],
      ["«Encargados y transferencias»", "encargados"],
      ["«Avisos de derechos, reportes y solicitudes de autoridades»", "avisos-de-derechos"],
      ["«Pruébatelo: tu foto»", "pruebatelo"],
      ["«Menores de edad»", "menores"],
    ] as const) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", `#${id}`);
      expect(document.getElementById(id)).toHaveRole("heading");
    }
  });
});

describe("Cookies: verificación de seguridad (ADR-076)", () => {
  it("lista Cloudflare Turnstile como tecnología necesaria del registro y la recuperación", () => {
    render(<CookiesPage />);

    expect(COOKIES_NOTICE_UPDATED).toBe("2026-10-08");
    expect(screen.getByRole("cell", { name: "Cloudflare Turnstile" })).toBeInTheDocument();
    const section = sectionUnder(
      screen.getByRole("heading", {
        name: "Verificación de seguridad (Cloudflare Turnstile)",
      }),
    );
    expect(section).toHaveTextContent("en el registro, al pedir recuperar tu contraseña");
    expect(section).toHaveTextContent("vence a los 5 minutos y sirve una sola vez");
    expect(section).toHaveTextContent("No guardamos el pase ni tu IP de esta verificación.");
  });
});

// Revisión de ADR-076: cada promesa contra lo que hace el código del cambio.
describe("Textos legales: solo lo que el código hace (revisión ADR-076)", () => {
  it("las ligas de otras pantallas a los Términos llegan a su sección", () => {
    render(<TermsPage />);

    // El aviso de un texto detenido (`trust/content-policy.ts`) y el pie del compositor de
    // publicaciones (`social/components/create-post-form.tsx`, «/terminos#reglas»).
    const prohibited = PROHIBITED_HELP.href.split("#")[1]!;
    expect(document.getElementById(prohibited)?.closest("h2")).toHaveTextContent(
      "Artículos prohibidos y restringidos",
    );
    expect(document.getElementById("reglas")?.closest("h2")).toHaveTextContent(
      "Reglas de la comunidad: lo que no se puede subir",
    );
  });

  it("una falta es un aviso, no cada cosa que señala (`rights/strikes.ts`)", () => {
    render(<TermsPage />);

    const section = sectionUnder(document.getElementById("derechos-de-autor")!);
    expect(section).toHaveTextContent(
      "Cada aviso de derechos por el que retiramos algo tuyo y que no se revierte cuenta como una falta, aunque señale varias cosas",
    );
    expect(section).not.toHaveTextContent("Cada contenido retirado");
  });

  it("un retiro por nuestra cuenta no promete un aviso con el motivo que la app no manda", () => {
    render(<TermsPage />);

    const page = document.body;
    // `applyModerationAction` no notifica: lo oculto se ve marcado en el Studio o en «Mi contenido».
    expect(page).not.toHaveTextContent("avisarte el motivo");
    const moderation = sectionUnder(document.getElementById("moderacion")!);
    expect(moderation).toHaveTextContent("«Oculto por moderación»");
    expect(moderation).toHaveTextContent("«Mi contenido»");
    expect(moderation).toHaveTextContent("escríbenos al correo de soporte");
    // Un reporte por persona y objetivo, y ya se reportan comentarios y cuentas (`trust/schemas.ts`).
    expect(moderation).toHaveTextContent(
      "Cada persona puede reportar una vez cada publicación, comentario, producto o cuenta",
    );
  });

  it("sin ambigüedad: el cierre por contenido sexual con menores es sin pedir revisión", () => {
    render(<TermsPage />);

    const page = document.body;
    expect(page).toHaveTextContent("cerramos la cuenta, sin posibilidad de pedir revisión");
    expect(page).not.toHaveTextContent("cerramos la cuenta, sin revisión");
  });

  it("lenguaje neutral en lo nuevo", () => {
    render(<TermsPage />);

    const page = document.body;
    expect(page).not.toHaveTextContent("Si eres consumidor");
    expect(page).not.toHaveTextContent("o tutores");
    expect(page).toHaveTextContent("Como persona consumidora");
  });

  it("Turnstile también protege el formulario de avisos de derechos (`rights/actions.ts`)", () => {
    render(<CookiesPage />);

    expect(screen.getByRole("cell", { name: /manda un aviso de derechos/ })).toBeInTheDocument();
    const section = sectionUnder(
      screen.getByRole("heading", { name: "Verificación de seguridad (Cloudflare Turnstile)" }),
    );
    expect(section).toHaveTextContent("en el formulario de avisos de derechos");
    expect(section).not.toHaveTextContent("solo en esas dos páginas");
  });

  it("privacidad: la huella bloquea lo retirado por un aviso, y cada dato del aviso a quién va", () => {
    render(<PrivacyNoticePage />);

    const page = document.body;
    // Solo `rights/service.ts` llama a `blockMediaHashes`: la moderación aún no bloquea archivos.
    expect(page).toHaveTextContent(
      "Cuando retiramos un archivo por un aviso de derechos, guardamos su huella",
    );
    expect(page).not.toHaveTextContent("por ser contenido íntimo sin consentimiento o por poner");
    expect(page).toHaveTextContent(
      "Fotos, videos y verificación de seguridad: Cloudflare, Inc. (Estados Unidos). Guarda tus fotos y videos en un almacenamiento privado (R2) y, con Turnstile, comprueba que quien se registra, pide recuperar su contraseña o manda un aviso de derechos es una persona",
    );
    const notices = sectionUnder(document.getElementById("avisos-de-derechos")!);
    // El contra-aviso siempre se manda con sesión (`submitCounterNoticeAction`).
    expect(notices).toHaveTextContent("y la cuenta con la que lo mandaste");
    // Quien subió el contenido ve también a quién representa quien avisa (contra-aviso/page.tsx).
    expect(notices).toHaveTextContent("el nombre de quien representas");
    // Los comentarios y las cuentas ya se reportan y los comentarios se ocultan.
    const reports = sectionUnder(document.getElementById("reportes-y-moderacion")!);
    expect(reports).toHaveTextContent(
      "Si reportas una publicación, un comentario, un producto o una cuenta",
    );
    expect(reports).toHaveTextContent("ocultar una publicación, un comentario o un producto");
  });
});
