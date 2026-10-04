/** Contenido original solicitado por el administrador. Sin testimonios ni actividad simulada. */
export const EDITION = "launch-20261003";

type Source = { title: string; url: string };
type Entry = {
  key: string;
  body: string;
  image?: string;
  source?: Source;
};
type Collection = { slug: string; posts: Entry[] };

export const collections: Collection[] = [
  {
    slug: "humor",
    posts: [
      {
        key: "modo-sofa",
        image: "humor",
        body: `Sábado, 9:00: «Hoy ordeno la casa, hago ejercicio y resuelvo mi vida».
Sábado, 9:07: activando el modo sofá. 🛋️😂

Este gato representa una escena inventada, pero la negociación con la flojera sí se siente familiar.

Completa el meme: «Yo tenía planes, pero apareció ______». Vale café, una serie o la mascota que se acostó encima de ti.

Imagen ilustrativa creada con IA.`,
      },
      {
        key: "grupo-familiar",
        body: `Manual no oficial para sobrevivir al grupo familiar 📱

1. No preguntar quién mandó la cadena: ya viene otra.
2. Si alguien escribe «tenemos que hablar», no sacar conclusiones antes del siguiente mensaje.
3. Aceptar que un sticker de piolín también cuenta como saludo.
4. Recordar que salir del grupo puede provocar otro grupo para investigar por qué saliste.

Humor original del equipo. ¿Qué regla añadirías al manual?`,
      },
      {
        key: "habilidades-adulto",
        body: `Hay habilidades adultas que deberían venir en el currículum:

• Encontrar la tapa que sí le queda al recipiente.
• Calcular cuántas vueltas aguanta la ropa antes de doblarla.
• Saber si «ya casi llego» significa diez minutos o apenas salir.

¿Cuál es tu talento más inútil pero impresionante? Cuéntalo en una frase; aquí tiene su lugar. 😂`,
      },
    ],
  },
  {
    slug: "gaming",
    posts: [
      {
        key: "noche-coop",
        image: "gaming",
        body: `El verdadero modo difícil: elegir a qué jugar con tus amigos. 🎮

Antes de organizar una noche de juego, acuerden tres cosas:
• ¿Cooperar o competir?
• ¿En el mismo sofá o cada quien desde su casa?
• ¿Una partida corta o una sesión larga?

Después revisen en la ficha oficial del juego cuántas personas admite, las plataformas compatibles y si el modo elegido pide una suscripción. «Multijugador» no siempre significa cooperativo local.

Deja tu plataforma y cuántos son: armemos recomendaciones entre todos.

Imagen ilustrativa creada con IA.`,
      },
      {
        key: "jugar-en-familia",
        body: `Si en casa juega alguien menor, vale la pena configurar la consola juntos.

En Nintendo Switch, la app oficial de control parental permite consultar el tiempo de juego y establecer un límite diario. La suspensión del juego es una opción que debes activar; el aviso por sí solo no siempre detiene la partida.

Acuerden horarios y expliquen para qué sirve cada límite. ¿Qué regla les ha funcionado mejor en familia?`,
        source: {
          title: "Nintendo: supervisar el juego",
          url: "https://www.nintendo.com/en-gb/Support/Parental-Controls/Supervise-your-child-s-gameplay-1197305.html",
        },
      },
      {
        key: "momento-memorable",
        body: `No hace falta presumir horas jugadas para entrar a esta conversación.

Cuéntanos el momento en que un juego te ganó de verdad: un jefe que por fin venciste, una construcción que tomó semanas o una partida con alguien que ya no ves tanto.

Formato fácil: juego + momento + por qué lo recuerdas. Evita spoilers importantes o avisa antes. 🎮`,
      },
    ],
  },
  {
    slug: "tecnologia",
    posts: [
      {
        key: "bateria-sin-mitos",
        image: "tecnologia",
        body: `La batería no necesita más mitos; necesita menos calor. 🔋

Para iPhone, Apple explica que el equipo detiene la carga cuando está lleno y que la carga optimizada reduce el tiempo que pasa al máximo. También aconseja evitar usarlo o cargarlo con una temperatura ambiente superior a 35 °C.

Idea práctica: elige un lugar ventilado, lejos del sol y fuera del coche caliente. Si usas otro teléfono, revisa las indicaciones de su fabricante.

¿Qué duda sobre baterías llevas años escuchando?

Imagen ilustrativa creada con IA.`,
        source: {
          title: "Apple: carga y cuidado de la batería",
          url: "https://support.apple.com/en-us/105105",
        },
      },
      {
        key: "orden-digital",
        body: `Un pendiente digital que sí puedes terminar hoy: limpiar el ruido del teléfono. 📱

Elige una app y revisa sus notificaciones. Conserva lo que necesitas atender y desactiva los avisos promocionales que siempre descartas. Luego mueve a una carpeta las apps que abres por costumbre y no por necesidad.

Es una propuesta para probar, no una fórmula para todos. ¿Qué notificación quitarías primero y cuál sí necesitas recibir al instante?`,
      },
      {
        key: "gadget-util",
        body: `El gadget que sí usas gana al que solo se ve bonito en la caja.

Cuenta qué aparato te resolvió un problema concreto: «Lo uso para ____ y me ayuda cuando ____». Puede ser algo tan pequeño como un adaptador, un soporte o un teclado cómodo.

Si haces una recomendación, menciona una limitación también. Queremos experiencias reales, no fichas de publicidad. 💻`,
      },
    ],
  },
  {
    slug: "comida",
    posts: [
      {
        key: "quesadillas-hongos",
        image: "comida",
        body: `Una cena que merece que dejes el celular: quesadillas de hongos. 🌮

Para cuatro quesadillas: cuatro tortillas, unos 200 g de champiñones limpios, un poco de cebolla, queso que se derrita, aceite y sal al gusto.

1. Rebana los hongos y la cebolla.
2. Sofríe la cebolla y agrega los hongos. Cocina hasta que se evapore su agua.
3. Rellena las tortillas con hongos y queso; dóralas en comal a fuego medio.
4. Termina con salsa y, si te gusta, epazote.

Propuesta de receta del equipo; ajusta las porciones a tu apetito. ¿Qué relleno compite con este en tu casa?

Imagen ilustrativa creada con IA.`,
      },
      {
        key: "salsa-a-tu-gusto",
        body: `Tu salsa, tus reglas. 🌶️

Para experimentar sin echar a perder toda la comida, separa una porción pequeña de tu salsa favorita y prueba un cambio: más limón, cilantro picado o un poco de chile asado. Compara antes de mezclarlo con el resto.

Reto de la comunidad: comparte ingredientes y cómo la preparas. Si es muy picante, avisa. Queremos ideas que otra persona pueda intentar, no secretos imposibles de reproducir.`,
      },
      {
        key: "mapa-de-antojos",
        body: `Hagamos un mapa de antojos con recomendaciones de verdad. 🗺️🌮

Si hay un lugar que te encanta, deja:
• Ciudad y zona.
• Nombre del lugar y qué pedirías.
• Cuándo fuiste y algo que conviene saber: fila, horario o si acepta tarjeta.

No publiques domicilios particulares. Si el lugar es tu negocio o tienes una colaboración, dilo. ¿Qué comida de tu ciudad debería conocer alguien que va por primera vez?`,
      },
    ],
  },
  {
    slug: "musica",
    posts: [
      {
        key: "playlist-con-historia",
        image: "musica",
        body: `Una playlist puede contar una historia sin decir una palabra. 🎧

Arma cinco canciones para este recorrido: salir de casa, encontrar el ritmo, subir el ánimo, bajar revoluciones y cerrar la noche.

No hace falta que sean del mismo género. Es una propuesta creativa del equipo: elige por lo que te hacen sentir y explica una transición que te guste.

Deja títulos y artistas, sin copiar letras. ¿Con cuál abrirías tu película de hoy?

Imagen ilustrativa creada con IA.`,
      },
      {
        key: "escucha-con-detalle",
        body: `Vuelve a una canción que ya conoces y escucha una sola cosa: el bajo, la batería, una segunda voz o un instrumento al fondo.

Después cuéntanos qué detalle habías pasado por alto. No es un ejercicio para demostrar cuánto sabes: es una excusa para escuchar con calma.

Formato: canción + artista + detalle. Avisa si tu enlace lleva a una versión distinta, en vivo o un remix. 🎶`,
      },
      {
        key: "concierto-recuerdo",
        body: `Hay conciertos que se recuerdan por el escenario y otros por la persona que estaba al lado.

¿Cuál se quedó contigo? Comparte artista, ciudad y año, y cuenta un momento que sí viviste. Si todavía no has ido a uno, ¿a quién te gustaría escuchar en directo?

Las fotos propias y las anécdotas reales hacen esta conversación. Evitemos subir grabaciones completas o contenido de otra persona sin permiso. 🎤`,
      },
    ],
  },
  {
    slug: "deportes",
    posts: [
      {
        key: "caminar-para-empezar",
        image: "deportes",
        body: `Empezar también puede verse así: una caminata de diez minutos. 👟

El NHS señala que caminar a paso ligero durante diez minutos al día aporta beneficios y cuenta como actividad física. Su referencia para ese ritmo: puedes hablar, pero te cuesta cantar.

Escoge una ruta conocida y adapta el ritmo a tu condición. Si llevas tiempo sin moverte, empieza con lo que puedas sostener; no necesitas competir con nadie.

¿En qué momento del día te resultaría más fácil salir?

Imagen ilustrativa creada con IA.`,
        source: {
          title: "NHS: caminar para la salud",
          url: "https://www.nhs.uk/live-well/exercise/walking-for-health/",
        },
      },
      {
        key: "equipo-constancia",
        body: `Reto de esta comunidad: elegir una meta que quepa en tu semana real.

Puede ser preparar la mochila antes, ir a una clase, practicar un movimiento o reservar un rato para caminar. Escribe qué harás y cuándo; vuelve después a contar cómo te fue, aunque hayas tenido que ajustar el plan.

Aquí también caben quienes están regresando después de una pausa. ¿Cuál sería tu primer paso? ⚽`,
      },
      {
        key: "deporte-de-barrio",
        body: `El deporte de tu barrio también merece conversación.

¿Qué te gustaría encontrar cerca: un grupo para caminar, una cancha, clases para principiantes o alguien con quien practicar?

Deja ciudad, zona general y deporte. Si organizas una actividad, comparte lugar público, horario y condiciones claras. No publiques teléfonos ni direcciones privadas; usa el chat para acordar detalles.`,
      },
    ],
  },
  {
    slug: "mascotas",
    posts: [
      {
        key: "bienvenida-gato",
        image: "mascotas",
        body: `La caja es bonita; lo importante es preparar su llegada. 🐱

Para recibir a un gato, la ASPCA recomienda un lugar limpio y seco para descansar, agua fresca, un arenero en una zona tranquila y accesible, y una superficie estable para rascar. El veterinario puede orientar la alimentación según su edad y salud.

Prepara lo básico antes de adoptarlo y pregunta al refugio por sus necesidades. El gato de la imagen es ilustrativo, no un anuncio de adopción.

¿Qué te hubiera gustado saber antes de recibir al tuyo?

Imagen ilustrativa creada con IA.`,
        source: {
          title: "ASPCA: cuidados básicos del gato",
          url: "https://www.aspca.org/pet-care/cat-care/general-cat-care",
        },
      },
      {
        key: "presenta-mascota",
        body: `Queremos conocer a quien se adueña de tu sillón. 🐾

Presenta a tu mascota con su nombre, una costumbre que la hace única y una foto propia si te apetece. Evita que se vean tu dirección, teléfono o datos de su placa.

No hace falta una foto perfecta: un bostezo, una siesta o esa mirada cuando abres una bolsa suelen contar más. ¿Quién aparece primero en la galería de tu teléfono?`,
      },
      {
        key: "compra-que-si-usa",
        body: `El juguete caro contra la caja vacía: una rivalidad histórica. 📦

¿Qué accesorio usa realmente tu mascota y cuál terminó guardado? Cuéntanos qué animal tienes, su tamaño y cómo lo usa, para que tu experiencia sirva a alguien más.

Si una conducta te preocupa o cambia de repente, consulta al veterinario; las experiencias de la comunidad sirven para conversar, no para diagnosticar.`,
      },
    ],
  },
  {
    slug: "moda",
    posts: [
      {
        key: "look-boda-noche",
        image: "moda",
        body: `Boda de noche: un vestido, tres decisiones. ✨

Idea de estilo del equipo: un vestido ciruela como punto de partida, accesorios metálicos discretos y zapatos con los que puedas caminar a gusto.

Antes de elegir, revisa el código de vestimenta de la invitación, el clima y si la celebración será en jardín o salón. Prueba sentarte y caminar con el conjunto; una foto no cuenta toda la experiencia.

Este look es inspiración, no un producto a la venta. ¿Lo llevarías con accesorios dorados, plateados o algo de otro color?

Imagen ilustrativa creada con IA.`,
      },
      {
        key: "repite-prenda",
        body: `Reto: darle otra vida a una prenda que ya tienes. 👗

Elige una pieza y arma dos combinaciones: una para un día tranquilo y otra para salir. Cambia calzado, una capa o un accesorio antes de pensar en comprar algo más.

Puedes explicar los looks en texto o compartir fotos propias. Si publicas tu look personal, su visibilidad sigue la privacidad de tu cuenta. ¿Qué prenda quieres repetir esta semana?`,
      },
      {
        key: "segunda-mano-detalles",
        body: `En ropa de segunda mano, los detalles ayudan a decidir.

Si vendes, acompaña la foto principal con etiqueta de composición, medidas reales y primeros planos de cualquier marca de uso. Si compras, pregunta cómo se tomaron las medidas y compáralas con una prenda que ya te quede bien.

Una talla escrita no explica el ajuste por sí sola. ¿Qué dato siempre preguntas antes de comprar ropa en línea? 👟`,
      },
    ],
  },
  {
    slug: "hogar",
    posts: [
      {
        key: "rincon-que-invita",
        image: "hogar",
        body: `Un rincón que invite a quedarse, aunque tu sala sea pequeña. 🏡

Propuesta de decoración del equipo:
• Elige una función: leer, tomar café o descansar.
• Deja libre el paso y mide antes de mover muebles.
• Prueba con lo que ya tienes: una lámpara, un cojín o una mesa auxiliar.
• Repite dos o tres colores para dar continuidad.

La imagen es una idea ilustrativa, no una transformación real. ¿Qué rincón de tu casa te gustaría mejorar primero?

Imagen ilustrativa creada con IA.`,
      },
      {
        key: "orden-pequeno",
        body: `Si ordenar toda la casa suena imposible, elige solo una superficie.

Una mesa, un cajón o la entrada. Separa lo que sí usas ahí, devuelve lo demás a su lugar y observa qué vuelve a acumularse durante la semana. Eso te puede dar una pista sobre lo que necesita un espacio más cómodo.

Es una idea para probar, sin promesas de una casa perfecta. ¿Qué zona se vuelve a llenar aunque acabes de ordenarla?`,
      },
      {
        key: "hogar-con-historia",
        body: `Tu objeto favorito de casa quizá no sea el más caro.

Puede ser una taza heredada, una mesa restaurada o algo que hiciste tú. Comparte su historia y, si quieres, una foto sin documentos ni datos personales al fondo.

Si lo restauraste, cuenta qué material era y qué pasos seguiste. Las historias con detalles ayudan a que alguien más se anime a intentar su propio proyecto. 🪑`,
      },
    ],
  },
  {
    slug: "autos",
    posts: [
      {
        key: "llantas-carretera",
        image: "autos",
        body: `Antes de la playlist del viaje, revisa las llantas. 🚗

La NHTSA recomienda comprobar la presión en frío y usar la indicada por el fabricante en la etiqueta del vehículo o el manual. La cifra en el costado de la llanta no sustituye esa referencia. Revisa también la refacción, si tu auto la incluye.

Si ves cortes, bultos o desgaste irregular, pide una revisión profesional antes de salir. ¿Qué chequeo nunca falta en tu rutina de carretera?

Escena ilustrativa creada con IA; no representa una ruta concreta.`,
        source: {
          title: "NHTSA: seguridad y cuidado de llantas",
          url: "https://www.nhtsa.gov/vehicle-safety/tires",
        },
      },
      {
        key: "bitacora-auto",
        body: `El mejor recordatorio del mantenimiento no siempre es tu memoria.

Idea para organizarte: anota fecha, kilometraje, trabajo realizado y taller, y guarda los comprobantes. Para saber qué toca después, consulta el manual de tu modelo; el uso y las condiciones pueden cambiar los intervalos.

Si compartes una foto de la bitácora, tapa placas, VIN, teléfonos y datos del domicilio. ¿La llevas en papel, una app o la guantera?`,
      },
      {
        key: "viaje-real",
        body: `Una buena recomendación de carretera necesita más que «está increíble».

Cuéntanos un viaje que sí hayas hecho: origen, destino, cuándo fuiste y una parada que repetirías. Si mencionas costos u horarios, aclara la fecha: pueden cambiar.

Evita compartir tu ubicación en tiempo real. Queremos recuerdos y consejos útiles para planear, no seguir tu recorrido. ¿Qué trayecto te dejó ganas de volver? 🗺️`,
      },
    ],
  },
  {
    slug: "belleza",
    posts: [
      {
        key: "brochas-limpias",
        image: "belleza",
        body: `Tu siguiente mejora de maquillaje puede empezar en las brochas. 🖌️

La Academia Americana de Dermatología recomienda limpiarlas cada 7 a 10 días: enjuagar las puntas con agua tibia, lavar con champú suave, aclarar bien y retirar el exceso de agua con una toalla limpia.

Déjalas secar acostadas, con las puntas fuera del borde, para que el agua no baje hacia el pegamento del mango. Evita sumergir toda la brocha.

¿Cómo organizas las tuyas para acordarte de limpiarlas?

Imagen ilustrativa creada con IA.`,
        source: {
          title: "AAD: cómo limpiar brochas de maquillaje",
          url: "https://www.aad.org/public/everyday-care/skin-care-secrets/routine/clean-your-makeup-brushes",
        },
      },
      {
        key: "protector-etiqueta",
        body: `Tres cosas que buscar en la etiqueta del protector solar. ☀️

La Academia Americana de Dermatología aconseja FPS 30 o superior, protección de amplio espectro y resistencia al agua. Revisa también la caducidad y sigue las instrucciones de aplicación del producto.

Elige una textura que te resulte cómoda, pero revisa primero esas características. ¿Qué parte de la etiqueta te cuesta más entender?`,
        source: {
          title: "AAD: elegir protector solar",
          url: "https://www.aad.org/public/everyday-care/sun-protection/shade-clothing-sunscreen/choosing-right-sunscreen",
        },
      },
      {
        key: "neceser-real",
        body: `Abre tu neceser y elige el producto que sí usas hasta terminarlo.

Cuéntanos qué te gusta, qué no y para qué lo usas. Si mencionas tu tipo de piel o tus preferencias, tu experiencia será más fácil de entender. Si recibiste el producto o tienes una colaboración, indícalo.

Los gustos y resultados pueden variar. ¿Cuál volverías a usar y cuál no era para ti? 💄`,
      },
    ],
  },
  {
    slug: "emprendedores",
    posts: [
      {
        key: "foto-que-explica",
        image: "emprendedores",
        body: `Una buena foto de producto también responde preguntas. 📸

Prueba una secuencia sencilla:
1. Vista completa, sin esconder partes.
2. Detalle del material o acabado.
3. Referencia del tamaño, con medidas claras.
4. Lo que realmente incluye la compra.

Usa luz de ventana y un fondo que no compita con el objeto. Evita filtros que cambien el color y muestra las marcas de uso si las hay.

La escena de la imagen es ilustrativa, no inventario de una tienda. ¿Qué detalle te preguntan más tus clientes?

Imagen ilustrativa creada con IA.`,
      },
      {
        key: "presenta-negocio",
        body: `Preséntate sin discurso de ventas. 🚀

Completa estas tres frases:
• Mi negocio ofrece ____.
• Ayuda a personas que necesitan ____.
• Lo que hago personalmente es ____.

Si ya tienes tienda en speeaking, comparte su enlace y cuenta cómo empezó. No hace falta exagerar resultados ni inventar clientes: una explicación concreta hace más fácil que alguien entienda lo que vendes.`,
      },
      {
        key: "descripcion-clara",
        body: `Antes de publicar, léela como si fueras quien compra.

¿Tu descripción dice qué es, tamaño o medidas, materiales, estado, qué incluye y cómo se entrega? ¿Las fotos corresponden a esa misma pieza? Si algo se hace bajo pedido, indica el plazo real.

Ejercicio: comparte una descripción breve y pide opinión sobre qué información falta. La comunidad puede ayudarte a hacerla más clara sin promesas que no puedas cumplir.`,
      },
    ],
  },
];

/** Las fuentes acompañan el texto publicado, no quedan escondidas solo en este archivo. */
export function publicationBody(entry: Entry) {
  return entry.source
    ? `${entry.body}\n\nFuente: ${entry.source.title} — ${entry.source.url}`
    : entry.body;
}
