/**
 * Comunidades oficiales y su contenido editorial inicial (ADR-018).
 * Todo el contenido es original, lo publica una cuenta editorial identificada y se marca como
 * asistido por IA. `image` genera un cartel ilustrativo; sin `image` es una publicación de texto.
 */
export type SeedPost = { image?: string; body: string };

export type CommunitySeed = {
  slug: string;
  name: string;
  emoji: string;
  hue: number;
  description: string;
  categorySlugs: string[];
  posts: SeedPost[];
};

export const communities: CommunitySeed[] = [
  {
    slug: "humor",
    name: "Humor",
    emoji: "😂",
    hue: 95,
    description: "Memes, historias y todo lo que nos hace reír.",
    categorySlugs: [],
    posts: [
      {
        image: "Lunes, otra vez",
        body: "Cuando suena la alarma del lunes y tu cuerpo decide que hoy no es buen día para existir. ¿A quién más le pasa? 😅",
      },
      {
        body: "Mi mamá: «hay comida en la casa». La comida en la casa: arroz de ayer y medio limón. 🍋",
      },
      {
        image: "El grupo familiar de WhatsApp",
        body: "Nivel de caos del grupo familiar del 1 al 10: «buenos días» con brillitos a las 6:00 a. m. y cadenas de «reenvíalo a 10 personas». ¿El tuyo en cuánto está?",
      },
      {
        body: "Pedí «algo ligero» para cenar y terminé con tres tacos de suadero, una gringa y un agua de horchata. La intención es lo que cuenta.",
      },
    ],
  },
  {
    slug: "gaming",
    name: "Gaming",
    emoji: "🎮",
    hue: 280,
    description: "Consolas, PC, móvil, retro y esports.",
    categorySlugs: ["videojuegos", "consolas", "accesorios-gaming", "computacion"],
    posts: [
      {
        image: "Top 5 juegos cooperativos",
        body: "¿Algo para jugar con amigos este fin? Nuestro top: 1) It Takes Two 2) Overcooked 2 3) Minecraft 4) Stardew Valley 5) Among Us. ¿Cuál agregarías?",
      },
      {
        body: "Debate del día: ¿control o teclado y mouse para shooters? Argumenta tu respuesta. 🎯",
      },
      {
        image: "Setup gamer con poco presupuesto",
        body: "No necesitas gastar una fortuna: prioriza un monitor de 144 Hz, audífonos cómodos y una silla que cuide tu espalda. Lo demás se mejora con el tiempo.",
      },
      {
        body: "¿Cuál fue el primer videojuego que te hizo desvelarte? El nuestro: Pokémon Rojo en un Game Boy con pilas prestadas.",
      },
    ],
  },
  {
    slug: "tecnologia",
    name: "Tecnología",
    emoji: "💻",
    hue: 230,
    description: "Gadgets, apps, trucos y reseñas honestas.",
    categorySlugs: ["electronica", "audio", "celulares", "computacion"],
    posts: [
      {
        image: "5 trucos para tu batería",
        body: "Brillo automático, ubicación solo en las apps que la necesitan, modo oscuro en pantallas OLED, menos actualización en segundo plano y evita cargar al 100 % todas las noches.",
      },
      {
        body: "Audífonos con cancelación de ruido: ¿lujo o necesidad? En el metro en hora pico, necesidad. 🚇",
      },
      {
        image: "¿Qué laptop comprar para estudiar?",
        body: "Para escuela y oficina, 16 GB de RAM, SSD de 512 GB y buena batería valen más que un procesador de gama alta. Deja tu presupuesto y la comunidad te ayuda a elegir.",
      },
      {
        body: "Recordatorio de seguridad: activa la verificación en dos pasos en tu correo y en tu banco. Son 3 minutos que te ahorran un buen susto.",
      },
    ],
  },
  {
    slug: "comida",
    name: "Comida",
    emoji: "🌮",
    hue: 45,
    description: "Recetas, antojos y lugares que valen la pena.",
    categorySlugs: ["comida", "cocina"],
    posts: [
      {
        image: "Tacos al pastor en casa",
        body: "Marinada rápida: chile guajillo, achiote, piña, vinagre, ajo y orégano. Deja reposar la carne toda la noche y dórala en sartén bien caliente. Piña asada al final, ¡no la olvides!",
      },
      { body: "Pregunta seria: ¿los chilaquiles van con frijoles al lado o no? 🍳" },
      {
        image: "Agua de jamaica perfecta",
        body: "Hierve la flor 5 minutos, deja reposar, cuela y endulza al gusto. Truco: un toque de canela o jengibre y mucho hielo. (Sí, de aquí viene el color de la app 😉)",
      },
      {
        body: "Comparte el puesto de tacos que defenderías con tu vida. Empezamos: el de la esquina que abre a las 7 p. m.",
      },
    ],
  },
  {
    slug: "musica",
    name: "Música",
    emoji: "🎧",
    hue: 330,
    description: "Artistas, playlists, instrumentos y conciertos.",
    categorySlugs: ["musica-instrumentos", "audio"],
    posts: [
      {
        image: "Playlist para concentrarte",
        body: "Lo-fi, jazz suave y un poco de piano: la mezcla ideal para trabajar o estudiar sin distracciones. ¿Qué escuchas tú para concentrarte?",
      },
      { body: "Canción que te sabes completa aunque digas que no te gusta. Sin juzgar. 🎤" },
      {
        image: "Guitarra desde cero",
        body: "Aprende primero cuatro acordes: Sol, Re, Mi menor y Do. Con ellos tocas cientos de canciones. 15 minutos diarios y en un mes notas el avance.",
      },
      { body: "¿El mejor concierto al que has ido? Cuéntanos quién y dónde." },
    ],
  },
  {
    slug: "deportes",
    name: "Deportes",
    emoji: "⚽",
    hue: 145,
    description: "Fútbol, running, gym y todo lo que te mueva.",
    categorySlugs: ["deportes", "tenis"],
    posts: [
      {
        image: "Tu primera carrera de 5 km",
        body: "Plan de 6 semanas: 3 días por semana alternando caminar y trotar. Aumenta 10 % por semana y no olvides estirar. Lo importante es cruzar la meta.",
      },
      { body: "¿Quién gana el clásico este fin? Se aceptan predicciones y marcadores. ⚽" },
      {
        image: "Rutina de 20 minutos sin equipo",
        body: "Sentadillas, lagartijas, plancha, zancadas y burpees: 40 segundos de trabajo, 20 de descanso, 4 rondas. Sin gimnasio y sin excusas.",
      },
      {
        body: "Hidratarte no es solo tomar agua: después de entrenar fuerte, repón electrolitos. Tu cuerpo te lo agradece.",
      },
    ],
  },
  {
    slug: "mascotas",
    name: "Mascotas",
    emoji: "🐶",
    hue: 70,
    description: "Perritos, gatitos y todo sobre su cuidado.",
    categorySlugs: ["mascotas"],
    posts: [
      {
        image: "¿Tu perro jala la correa?",
        body: "Detente cada vez que jale y avanza solo cuando la correa esté floja. Premia la calma. Con paciencia, en dos semanas notarás la diferencia.",
      },
      { body: "Cariño gatuno: te ignora todo el día, pero duerme en tu almohada. 🐱" },
      {
        image: "Adoptar es amor",
        body: "Antes de adoptar piensa en tiempo, espacio y gastos de veterinario. Es un compromiso de 10 a 15 años, y vale cada segundo.",
      },
      { body: "Cuéntanos el nombre más creativo que le has puesto a una mascota." },
    ],
  },
  {
    slug: "moda",
    name: "Moda",
    emoji: "👟",
    hue: 20,
    description: "Estilo, tenis, tendencias y outfits.",
    categorySlugs: ["moda", "ropa", "tenis", "accesorios-moda"],
    posts: [
      {
        image: "5 básicos que combinan con todo",
        body: "Playera blanca, jeans rectos, tenis blancos, chamarra de mezclilla y un suéter neutro. Con eso armas más de 20 outfits.",
      },
      { body: "Tenis blancos: ¿siempre impecables o con historia? 👟" },
      {
        image: "Cómo cuidar tus tenis",
        body: "Cepillo suave, agua tibia y jabón neutro. Nada de lavadora con agua caliente. Y guarda las cajas: ayudan a conservar la forma.",
      },
      { body: "Outfit favorito para un domingo: comodidad total. ¿El tuyo?" },
    ],
  },
  {
    slug: "hogar",
    name: "Hogar",
    emoji: "🏡",
    hue: 170,
    description: "Deco, plantas, orden y cocina.",
    categorySlugs: ["hogar", "cocina", "decoracion", "hecho-a-mano"],
    posts: [
      {
        image: "Plantas que casi no se mueren",
        body: "Pothos, sansevieria, zamioculca y cactus: poca luz, poco riego y mucha resistencia. Ideales si estás empezando.",
      },
      {
        body: "Reto de orden: si no lo has usado en un año, probablemente no lo necesitas. ¿Te animas?",
      },
      {
        image: "Café de olla fácil",
        body: "Hierve agua con piloncillo y canela, apaga, agrega café molido medio, tapa 5 minutos y cuela. Huele a domingo en casa de la abuela.",
      },
      { body: "¿Qué cosa de tu casa te hace feliz cada vez que la ves?" },
    ],
  },
  {
    slug: "autos",
    name: "Autos",
    emoji: "🚗",
    hue: 255,
    description: "Mantenimiento, modelos y viajes por carretera.",
    categorySlugs: ["autos"],
    posts: [
      {
        image: "Antes de salir a carretera",
        body: "Revisa la presión de las llantas (también la de refacción), aceite y anticongelante, luces y frenos. Diez minutos que valen mucho.",
      },
      { body: "¿Manual o automático? Que empiece el debate. 🚗" },
      {
        image: "Cuida tu batería",
        body: "Si tu auto pasa días sin moverse, enciéndelo al menos 15 minutos a la semana. Y revisa que las terminales no tengan sulfato.",
      },
      { body: "Tu mejor road trip en México. Nosotros votamos por la ruta del Pacífico." },
    ],
  },
  {
    slug: "belleza",
    name: "Belleza",
    emoji: "💄",
    hue: 350,
    description: "Skincare, maquillaje y cuidado personal.",
    categorySlugs: ["belleza"],
    posts: [
      {
        image: "Rutina básica de skincare",
        body: "Mañana: limpiador suave, hidratante y bloqueador solar. Noche: limpiador e hidratante. Simple, constante y sin gastar de más.",
      },
      { body: "El bloqueador solar se usa todos los días, aunque esté nublado. Sí, todos. ☀️" },
      {
        image: "Cuida tus brochas",
        body: "Lávalas una vez por semana con jabón neutro y déjalas secar boca abajo. Tu piel lo nota.",
      },
      { body: "¿Qué producto usas desde hace años y no cambias por nada?" },
    ],
  },
  {
    slug: "emprendedores",
    name: "Emprendedores",
    emoji: "🚀",
    hue: 305,
    description: "Vende más, aprende de otros y haz crecer tu negocio.",
    categorySlugs: ["servicios", "hecho-a-mano", "libros"],
    posts: [
      {
        image: "Cómo calcular tu margen",
        body: "Margen = precio − costo. Si vendes en $3,499 algo que te costó $2,400, ganas $1,099 por pieza (31.4 %). Ojo: todavía faltan comisiones, envío y publicidad.",
      },
      {
        body: "Tu primer cliente casi siempre llega por recomendación. Pide reseñas y cuida a quien ya te compró. 🙌",
      },
      {
        image: "Fotos de producto con tu celular",
        body: "Luz natural de ventana, fondo liso, el producto al centro y varias tomas: frente, detalle y en uso. No necesitas estudio para vender mejor.",
      },
      { body: "¿Qué vendes y desde cuándo? Preséntate con la comunidad." },
    ],
  },
];
