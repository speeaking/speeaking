# Marco legal aplicable a speeaking (México, septiembre de 2026)

> **BORRADOR DE INVESTIGACIÓN. NO ES ASESORÍA LEGAL NI FISCAL.** Este documento reúne el marco
> legal que encontramos y leímos el 2026-09-26 para preparar el aviso de privacidad, los términos y
> condiciones y las preguntas para el despacho y el contador. **Todo debe revisarlo un abogado
> mexicano (y la parte fiscal, un contador) antes de publicar cualquier texto.** Lo marcado
> **[VERIFICAR CON ABOGADO]** o **[VERIFICAR CON CONTADOR]** es una interpretación nuestra o un
> punto donde la ley no es clara.
>
> - **Fecha de corte:** 2026-09-26. Las leyes cambian: revisar la fecha de «última reforma» de cada
>   fuente antes de usarla.
> - **Cómo citamos:** `[n]` remite a la sección 11 (Fuentes). «✓ texto oficial» = leímos el texto
>   vigente publicado por la Cámara de Diputados, el DOF, el SAT o la dependencia. «Secundaria» =
>   análisis de un despacho o de un medio; sirve de contexto, no de fundamento.
> - **Datos que faltan del responsable** (se quedan visibles hasta tenerlos): [NOMBRE O RAZÓN SOCIAL
>   DEL RESPONSABLE], [RFC], [DOMICILIO PARA OÍR Y RECIBIR NOTIFICACIONES], [CORREO DE PRIVACIDAD],
>   [CORREO DE SOPORTE], [FECHA DE ÚLTIMA ACTUALIZACIÓN].
> - **Revisión legal del 2026-09-26 ya aplicada.** Este texto incorpora las correcciones de la
>   revisión de los borradores 00–03 (problemas transversales T1–T8 y puntos por documento). La
>   lista está en «Correcciones aplicadas», al final de esta sección 0. El índice de todos los
>   documentos y las preguntas para el abogado y el contador están en `docs/legal/README.md`.

---

## 0. Resumen ejecutivo

1. **Datos personales (lo más urgente).** speeaking es «responsable» bajo la nueva LFPDPPP (DOF
   20-03-2025) [1]. La autoridad ya no es el INAI: es la **Secretaría Anticorrupción y Buen
   Gobierno** (SABG) [1, art. 2 fr. XV]. El reglamento nuevo **no se ha publicado**. El de 2011
   sigue publicado como vigente [3] y, según una fuente secundaria, aplica en lo que no contradiga
   la ley [7]. **Pero** el art. 4 de la ley nombra como supletorios **solo** el Código Nacional de
   Procedimientos Civiles y Familiares y la Ley Federal de Procedimiento Administrativo, y ningún
   transitorio conserva el Reglamento de 2011 [1, art. 4; Transitorio Décimo Segundo]. Por eso sus
   reglas se usan aquí como **estándar prudente**, no como obligación segura (2.1) **[VERIFICAR CON
   ABOGADO]**. Bloqueadores antes de abrir al público:
   - el aviso de privacidad con el responsable identificado [1, art. 15 fr. I];
   - un aviso **simplificado** en el registro [1, art. 16 fr. II];
   - un canal y un procedimiento ARCO que funcionen (20 + 15 días hábiles) [1, arts. 29 y 31]; hoy
     no existen (SEC-26);
   - contratos de encargado con cada proveedor (Vercel, Neon, Cloudflare R2, OpenRouter y el de
     correo), como estándar prudente [3, arts. 50–55];
   - **fijar en OpenRouter los anfitriones de los modelos de IA y publicar su país** antes de activar
     la IA real. Hoy nadie puede decir en qué país se procesa el texto (2.7, T4);
   - quitar la casilla de personalización **premarcada** [4, Décimo fr. IV; 12, 5.4.1];
   - dejar de pedir en el checkout un domicilio y un teléfono que nadie usa con pago directo
     [1, art. 12] (2.3, T3);
   - anonimizar de verdad la analítica de visitantes sin sesión (1, T2).
2. **Consumidor.** El capítulo de comercio electrónico de la LFPC (art. 76 BIS, reformado el
   12-12-2025) [11] y la NMX-COE-001-SCFI-2018 [12] piden que la plataforma, como «proveedor
   intermediario», publique:
   - su identidad, RFC, domicilio en México y medios de contacto;
   - qué responde ella y qué responde el vendedor;
   - un mecanismo de quejas;
   - consentimiento previo para perfilar;
   - los datos del vendedor (domicilio físico y teléfonos) **antes de celebrar la transacción**, no
     después [11, art. 76 BIS fr. III] (3.2, T7).

   Las cláusulas que sometan al consumidor a tribunales extranjeros o permitan cambiar el contrato
   de forma unilateral no son válidas [11, art. 90]. El **vendedor** también es consumidor del
   servicio de speeaking para presentar queja y conciliar ante la PROFECO [11, art. 2 fr. I] (3.1).

3. **Propiedad intelectual.** Vender falsificaciones es infracción administrativa y delito [16,
   arts. 386 y 402]. El IMPI puede ordenar a **terceros** (una plataforma) suspender, bloquear o
   remover contenidos digitales, incluso de oficio [16, art. 344 fr. VII, reformado el 03-04-2026].
   Para marcas no encontramos un «puerto seguro» legal. Para derechos de autor sí hay uno, con aviso
   y retiro [17, art. 114 Octies] **[VERIFICAR CON ABOGADO]**.
4. **Fiscal.** Las **retenciones** de ISR e IVA de plataformas solo aplican cuando la plataforma
   cobra por cuenta del vendedor o el ingreso pasa por ella [20, art. 18-J fr. II; 21, art. 113-A;
   22, art. 25 fr. VI y IX]. Con pago directo y comisión 0 % no hay nada que retener.
   - **Duda principal:** la obligación **informativa mensual** aplica «aun cuando no hayan efectuado
     el cobro» [20, art. 18-J fr. III], y el acceso del SAT en tiempo real (CFF 30-B, vigente desde
     el 01-04-2026) [23] también.
   - **Por qué podría no aplicar:** las dos dependen de que speeaking preste un «servicio digital de
     intermediación» del art. 18-B, que exige que **se cobre una contraprestación** [20, art. 18-B].
     Con 0 % y sin cuotas hay un argumento fuerte de que no aplican **[VERIFICAR CON CONTADOR]**.
   - **Lo que lo activa:** cobrar cualquier cosa (comisión, «Impulsar» de P12, suscripción) activaría
     el régimen completo.
5. **Contratos electrónicos.** El clic de aceptación es válido [27, arts. 80 y 89 bis; 28,
   arts. 1803 y 1811]. La casilla obligatoria actual y el registro de la versión aceptada, con su
   fecha, son la base de la prueba [27, art. 1298-A]. La NOM-151 aplica a la conservación de
   mensajes de datos por comerciantes. Hay que evaluarla cuando haya contratos de valor (comisiones o
   campañas) [29] **[VERIFICAR CON ABOGADO]**.
6. **Moderación.** No hay una ley general mexicana de responsabilidad de plataformas por contenido de
   usuarios. Sí hay órdenes de retiro que atender:
   - violencia digital [30, art. 20 Sexies];
   - IMPI [16, art. 344];
   - derechos de autor [17, art. 114 Octies].

   La nueva ley de telecomunicaciones eliminó el artículo que permitía bloquear plataformas sin
   orden judicial [31] (secundaria).

### Correcciones aplicadas (revisión legal del 2026-09-26)

La revisión releyó en el texto oficial la LFPDPPP, la LFPC, el Reglamento de 2011, los Lineamientos
de 2013, la NMX-COE-001, la LFDA, la LFPPI, la LGAMVLV y el DPA de OpenRouter (fuentes al final de
la sección 11). Cambios en este documento:

| Problema                                        | Qué cambió aquí                                                                                                                                            |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1 · Reglamento 2011 y Lineamientos 2013        | Se usan como estándar prudente, no como obligación segura (0, 2.1, 2.4, 2.7)                                                                               |
| T2 · Analítica de visitantes                    | La tabla de la sección 1 ya no dice que los eventos sin sesión sean anónimos                                                                               |
| T3 · Checkout con domicilio y teléfono sin uso  | Nueva fila en 1; minimización en 2.3; mapa de 2.7 y 9                                                                                                      |
| T4 · IA: transferencia a proveedores de modelos | Modelos, anfitrión dinámico, ley del DPA y la duda encargado/tercero en 1 y 2.7                                                                            |
| T5 · Efectos automáticos de autenticidad        | Tres efectos automáticos descritos en 1 y 2.9; «Pedir revisión» deja de ser opcional                                                                       |
| T6 · Casillas de aceptación                     | Aceptación de términos separada del aviso (8, 9)                                                                                                           |
| T7 · Datos del vendedor tarde                   | Antes de confirmar el pedido (0, 2.7, 3.2, 9)                                                                                                              |
| T8 · «Gente de tus comunidades» revela más      | Qué se revela y elección sin marcar en el registro (1, 2.5, 9)                                                                                             |
| Citas                                           | fr. VII antes que fr. IV (2.7); reincidencia «de 100 a 320,000 UMA» (2.12); «al menos con cinco días naturales» (3.2); art. 53 (2.4); arts. 64 y 65 (2.11) |
| Riesgos nuevos                                  | Art. 58 fr. XIII (2.3); art. 4 de la ley (2.1); vendedor como consumidor (3.1); ley civil local (8)                                                        |

---

## 1. Hechos de speeaking verificados en el código (2026-09-26)

Lo que dicen los documentos **y el código**. Donde no coinciden, lo señalamos.

| Tema                         | Lo que hay hoy                                                                                                                                                                                                                                                                                                                                                                                                                   | Dónde                                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Cuentas                      | Correo y contraseña (Better Auth). Sesión de 30 días que se renueva cada día. Verificación de correo apagada hasta tener proveedor de correo.                                                                                                                                                                                                                                                                                    | `src/server/auth.ts`                                                                              |
| Aceptación                   | Casilla obligatoria **sin marcar**: «Acepto los términos y el aviso de privacidad». Se registran `TERMS` y `PRIVACY_NOTICE` con versión y fecha. Si cambia una versión, aparece un aviso de re-aceptación.                                                                                                                                                                                                                       | `identity/components/sign-up-form.tsx`, `identity/actions.ts`, `consent-banner.tsx`               |
| **Mayoría de edad**          | **No hay control de edad** ni casilla de 18+ en el código, y los términos no piden edad. El plan lo tiene como pendiente («Ola 0»). **Discrepancia con «usuarios 18+».**                                                                                                                                                                                                                                                         | búsqueda en `src/`; `docs/plan-90-dias.md` §7.1                                                   |
| Onboarding                   | Objetivos, comunidades, marcas, qué busca y presupuesto máximo **opcional** (en centavos, hasta 10 millones de pesos).                                                                                                                                                                                                                                                                                                           | `identity/onboarding-schema.ts`                                                                   |
| **Personalización**          | La casilla «Personalizar mi feed con mi actividad aquí» viene **marcada por omisión** (`defaultChecked`; en la base, `personalizationEnabled @default(true)`). Se desactiva en Ajustes y la desactivación desliga también la actividad anterior (ADR-030).                                                                                                                                                                       | `onboarding-form.tsx` l. 360–373; `prisma/schema.prisma` l. 156                                   |
| Sugerencias                  | «Aparecer en sugerencias» está **activado por omisión** (`discoverable @default(true)`); se apaga en Ajustes.                                                                                                                                                                                                                                                                                                                    | `schema.prisma` l. 160; aviso actual                                                              |
| Analítica                    | Solo propia: impresiones servidas y **visibles** (≥ 50 % en pantalla durante ≥ 1 s), clics, búsquedas, me gusta, guardados, visitas a producto y carrito. Sin persona, los eventos son anónimos (hora truncada).                                                                                                                                                                                                                 | ADR-030, ADR-037, aviso actual                                                                    |
| **Terceros en el navegador** | **Ninguno.** La CSP solo permite scripts con nonce del propio origen y `connect-src 'self'`. Entre las dependencias no hay SDK de analítica ni de anuncios.                                                                                                                                                                                                                                                                      | `src/lib/csp.ts`, `package.json`                                                                  |
| **Cookies y almacenamiento** | **Cookies:** (a) las de sesión de Better Auth, con prefijo `speeaking` y `Secure` en https; (b) `speeaking_bienvenida` (10 min, `SameSite=Lax`), que solo muestra el mensaje de bienvenida. **No son cookies:** el **tema** lo guarda `next-themes` en `localStorage`; el «Ocultar» del aviso de consentimiento y el de las sugerencias van en `sessionStorage`. **Discrepancia:** la tarea decía «cookies» de tema y de banner. | `auth.ts`, `feed/welcome.ts`, `onboarding-actions.ts`, `theme-provider.tsx`, `consent-banner.tsx` |
| Fotos                        | Se vuelven a codificar a WebP; eso **quita EXIF, XMP e ICC, incluido el GPS**.                                                                                                                                                                                                                                                                                                                                                   | `media/image-processing.ts` l. 92                                                                 |
| Comprobantes                 | Fotos de comprobante privadas (solo las ven el vendedor y el equipo), nunca publicadas; se guarda el historial de envíos.                                                                                                                                                                                                                                                                                                        | `trust/README.md`, `trust/proof-media.ts`                                                         |
| Riesgo de falsificación      | Reglas deterministas: precio contra la mediana, palabras de imitación con marca, tienda nueva, reportes. El resultado es un nivel de riesgo y una **leyenda que ve quien compra** («Autenticidad sin verificar», «Revisa: …»). Hay una señal de IA opcional (apagada por omisión, peso máximo 0.15). **Ocultar o verificar lo hace siempre una persona.**                                                                        | `trust/README.md`, ADR-036                                                                        |
| IA                           | Vía API compatible con OpenAI (p. ej. OpenRouter). El adaptador ya manda `provider: { data_collection: "deny" }` (excluye proveedores que guardan o entrenan) **pero no `zdr: true`**. La entrada se guarda sin datos de contacto; **a los 90 días** se reemplaza por `{ redacted: true }` (tarea diaria).                                                                                                                       | `src/server/providers/ai/openai-compatible.ts` l. 72–78; `ai/retention.ts`; ADR-031               |
| CEO-IA                       | Métricas agregadas y experimentos A/B con asignación determinista por cuenta (`assignVariant(experimento, userId)`). Solo cuentan personas con sesión y personalización activa. Pagos, precios, comisiones y gasto quedan fuera de su alcance.                                                                                                                                                                                   | `ceo/experiments.ts`, `ceo/metrics.ts`, ADR-033, ADR-037                                          |
| Pagos                        | La plataforma **no procesa ni retiene dinero** (ADR-033 #4). El checkout usa un proveedor simulado que en producción falla cerrado (ADR-032). Comisión `platformFeeBps: 0` (configurable hasta 20 %; cambiarla es decisión humana de riesgo alto).                                                                                                                                                                               | `commerce/fees.ts`, ADR-032, ADR-033                                                              |
| ARCO                         | **No hay** exportación, borrado de cuenta ni canal ARCO (SEC-26, pendiente). El aviso promete «podrás descargar y eliminar».                                                                                                                                                                                                                                                                                                     | `docs/security/auditoria-2026-09-26.md`                                                           |
| Infraestructura prevista     | Vercel, Neon Postgres, Cloudflare R2, proveedor de IA por API y Resend o SES para correo (ADR-033 #10; `architecture.md`). **No verificamos regiones**: la de cada servicio se confirma en su configuración y en su contrato **[VERIFICAR]**.                                                                                                                                                                                    | ADR-033, `architecture.md`                                                                        |

---

## 2. Datos personales: LFPDPPP 2025

### 2.1 Estado del marco (septiembre de 2026)

- **Ley vigente:** LFPDPPP, **nueva ley publicada en el DOF el 20-03-2025**. Única reforma: DOF
  14-11-2025, de homologación procesal con el Código Nacional de Procedimientos Civiles y Familiares
  [1][2]. La ley de 2010 quedó abrogada [1, Transitorio Segundo fr. I].
- **Autoridad:** Secretaría Anticorrupción y Buen Gobierno [1, art. 2 fr. XV; arts. 38 y 39]. Las
  menciones al INAI en otras normas se entienden hechas a quien asumió sus funciones [1, Transitorio
  Cuarto]. Los avisos que todavía nombren al INAI deben actualizarse.
- **Reglamento:** el Ejecutivo tenía **90 días naturales** para adecuar los reglamentos [1,
  Transitorio Décimo Segundo]. A la fecha de corte:
  - la Cámara de Diputados sigue publicando como «texto vigente» el **Reglamento de 2011** (DOF
    21-12-2011) [3];
  - una fuente secundaria de julio de 2026 dice que el reglamento nuevo sigue sin publicarse y que el
    de 2011 aplica de forma supletoria en lo que no contradiga la ley [7] **[VERIFICAR CON
    ABOGADO]**;
  - los **Lineamientos del Aviso de Privacidad** (DOF 17-01-2013) [4] están en la misma situación.
- **Posible reforma adicional:** en enero y febrero de 2026 la SABG abrió un proceso de
  «actualización» del marco con foros. Temas mencionados: privacidad por diseño, evaluaciones de
  impacto y responsable de datos [8][9] (secundarias). No encontramos una iniciativa publicada ni
  una fecha. Vigilarlo.
- **IA:** a julio de 2026 no hay una ley general de IA publicada en el DOF, solo reformas
  sectoriales [32] (secundaria).

### 2.2 Quién es el responsable

- **Sujetos regulados:** personas físicas o morales privadas que tratan datos [1, art. 2 fr. XVI].
  Aplica también a una persona física con actividad empresarial. Solo se exceptúa el uso
  exclusivamente personal [1, art. 1].
- **Responsable:** mientras no exista la sociedad, el responsable es quien opere la plataforma:
  [NOMBRE O RAZÓN SOCIAL DEL RESPONSABLE], [RFC], [DOMICILIO PARA OÍR Y RECIBIR NOTIFICACIONES]. El
  aviso debe traer su **identidad y domicilio** [1, art. 15 fr. I]; omitirlo es infracción [1,
  art. 58 fr. V].
- **Persona o departamento de datos:** hay que designar uno que tramite las solicitudes ARCO [1,
  art. 29]. Contacto: [CORREO DE PRIVACIDAD].

### 2.3 Consentimiento y tipos de datos

| Regla                                                                                                                                                            | Fundamento              | Qué significa para speeaking                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El consentimiento es «libre, específico e informado». El tácito vale por regla general: se pone el aviso a disposición y la persona no se opone.                 | [1, arts. 2 fr. IV y 7] | Cuenta, perfil y uso de la plataforma: basta el tácito o la relación jurídica [1, art. 9 fr. IV].                                                                                                                                                                                                                                                                                                                                |
| **Los datos financieros o patrimoniales requieren consentimiento expreso**, salvo las excepciones de los arts. 9 y 36.                                           | [1, art. 7 párr. 5]     | Posibles casos: (a) el **presupuesto** del onboarding; (b) el **costo privado** del producto si el vendedor es persona física; (c) los **comprobantes** (tickets o facturas con nombre, RFC o dígitos de tarjeta); (d) a futuro, la CLABE del vendedor. (b) podría caber en la excepción del art. 9 fr. IV (necesario para el servicio). Para (a) y (c) recomendamos una casilla expresa sin marcar **[VERIFICAR CON ABOGADO]**. |
| El consentimiento se puede **revocar**; el aviso debe decir cómo.                                                                                                | [1, art. 7 párr. 6]     | Ajustes (personalización y sugerencias) + [CORREO DE PRIVACIDAD].                                                                                                                                                                                                                                                                                                                                                                |
| **Datos sensibles:** expreso y **por escrito** (firma autógrafa, electrónica o mecanismo de autenticación). No crear bases de datos sensibles sin justificación. | [1, arts. 2 fr. VI y 8] | Hoy no pedimos datos sensibles. **Riesgo:** una comunidad sobre religión, salud, política o preferencia sexual volvería sensible el dato «comunidades que te interesan». Regla de producto: no crear esas comunidades en el piloto, o tratarlas como sensibles.                                                                                                                                                                  |
| Una **nueva finalidad** requiere consentimiento nuevo.                                                                                                           | [1, art. 11]            | Usar textos reales en evaluaciones de IA, la cookie de origen, `?r=` y P12 son finalidades nuevas: se agregan al aviso **antes** de usarlas (plan §7.1).                                                                                                                                                                                                                                                                         |
| Proporcionalidad y minimización.                                                                                                                                 | [1, arts. 10 y 12]      | Congruente con ADR-030 (eventos anónimos, opt-out retroactivo).                                                                                                                                                                                                                                                                                                                                                                  |

### 2.4 Aviso de privacidad: contenido y formato

**Contenido mínimo del aviso integral** [1, art. 15]:

- I. identidad y domicilio del responsable;
- II. datos que se tratan, **identificando los sensibles**;
- III. finalidades, **distinguiendo las que requieren consentimiento**;
- IV. opciones y medios para limitar el uso o la divulgación;
- V. mecanismos, medios y procedimiento ARCO;
- VI. procedimiento y medio para comunicar cambios al aviso.

Además:

- la cláusula de **transferencias**: si la persona acepta o no [1, art. 35 párr. 2];
- los mecanismos para **revocar** el consentimiento [1, art. 7].

La ley nueva quitó del art. 15 la lista de transferencias, pero los análisis recomiendan seguir
incluyéndolas [5][6] (secundarias).

**Aviso simplificado.** Cuando los datos se recaban por medios electrónicos, el aviso se entrega en
**modalidad simplificada**. Debe traer al menos las fracciones I a IV del art. 15 y decir dónde
consultar el integral [1, art. 16 fr. II].

- **Hoy:** el registro solo enlaza a `/privacidad`.
- **Acción:** poner junto al formulario de registro un texto breve con el responsable, los datos,
  las finalidades (primarias y secundarias) y cómo limitar, con la liga al integral.

**Lineamientos de 2013** [4] (supletorios mientras no haya nuevos; **[VERIFICAR CON ABOGADO]**):

- **Décimo:**
  - lenguaje claro, en español;
  - **fr. IV:** no se deben marcar previamente las casillas de consentimiento;
  - **fr. V:** no remitir a textos que la persona no pueda consultar.
- **Vigésimo:** lista 12 elementos del integral. Entre ellos, el mecanismo para negarse a las
  finalidades secundarias, las transferencias y las tecnologías de rastreo.
- **Vigésimo Sexto:** las comunicaciones a encargados no se listan como transferencias.
- **Trigésimo Primero:** si hay mecanismos que recaban datos de forma automática al conectarse, hay
  que avisarlo en un lugar visible y decir cómo deshabilitarlos, salvo que sean técnicamente
  necesarios. Ver 2.6.
- **Trigésimo Cuarto y Trigésimo Octavo:** contenido del aviso simplificado y del aviso corto.

**Negarse a las finalidades secundarias.** El aviso debe traer un mecanismo para que la persona se
niegue a las finalidades que no dan origen a la relación jurídica [3, art. 14].

**Estado del borrador actual** (`src/app/(legal)/privacidad/page.tsx`):

- ya distingue finalidades primarias y secundarias, explica la IA, la moderación, la retención y los
  encargados;
- **le faltan:**
  - identidad y domicilio (fr. I);
  - el medio ARCO (fr. V);
  - los nombres y países de los encargados;
  - los plazos de retención pendientes;
  - la cláusula de transferencia al vendedor (2.7);
  - el aviso simplificado;
  - la mención de la SABG.
- **Promete lo que aún no existe:** «descargar y eliminar» (SEC-26). Hay que corregirlo o
  construirlo antes de abrir.

### 2.5 Finalidades secundarias, perfilamiento y ajustes por omisión

- **Ley:** el tácito vale por regla general [1, art. 7], pero hay que dar el mecanismo de negativa
  [3, art. 14] y no premarcar casillas de consentimiento [4, Décimo fr. IV].
- **NMX-COE-001-SCFI-2018, 5.4.1:** para crear perfiles, analizar el comportamiento en línea o usar
  datos con fines de mercadotecnia hay que:
  - informarlo en el aviso;
  - **tener el consentimiento con un mecanismo previo al uso, independiente del aviso**;
  - informar cómo revocarlo [12].
- **NMX 8.1 b):** es **buena práctica** que las opciones de privacidad vengan en la opción más
  protectora por omisión [12].
- **Impacto en speeaking:**
  - la casilla de personalización **marcada por omisión** choca con el Décimo fr. IV y con la NMX
    5.4.1. **Recomendación:** dejarla **sin marcar**, o convertirla en una elección explícita
    («Sí, personaliza» / «No, gracias») sin respuesta preseleccionada;
  - «Aparecer en sugerencias» **activado por omisión** es un opt-out. Es defendible si el aviso lo
    presenta como finalidad secundaria con negativa fácil (ya lo hace), pero no es privacidad por
    omisión. Decisión del fundador con el abogado **[VERIFICAR CON ABOGADO]**.

### 2.6 Cookies y tecnologías de rastreo

Inventario real (sección 1) y lo que conviene decir:

| Mecanismo                                               | Tipo                         | ¿Técnicamente necesario?                   | Qué decir                                                                                                                |
| ------------------------------------------------------- | ---------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Cookies de sesión de Better Auth (`speeaking…`)         | Cookie propia                | Sí                                         | Mantener la sesión y proteger la cuenta; duran hasta 30 días sin uso.                                                    |
| `speeaking_bienvenida`                                  | Cookie propia, 10 min        | No es esencial, pero no identifica a nadie | Muestra un mensaje de bienvenida una vez.                                                                                |
| `speeaking-nav`                                         | Cookie propia, 1 año         | Preferencia                                | Recuerda si la columna izquierda está plegada (ADR-047). Inventario público en `/cookies` (ADR-053).                     |
| Tema (`localStorage` de next-themes)                    | Almacenamiento local         | Preferencia                                | Guarda claro u oscuro en tu navegador; no se nos envía.                                                                  |
| «Ocultar» del aviso y de sugerencias (`sessionStorage`) | Almacenamiento de la pestaña | Preferencia                                | Se borra al cerrar la pestaña.                                                                                           |
| Registro de impresiones visibles (JS propio → servidor) | Recolección automática       | No (medición)                              | Ya descrito en «Publicaciones que ves en pantalla». Se limita con la personalización. Lineamiento Trigésimo Primero [4]. |

No hay cookies de terceros, píxeles ni SDK de publicidad. **Mantenerlo así**: agregar Sentry, una
analítica externa o un proveedor de pagos es un encargado nuevo, cambia el aviso y cambia la CSP.

### 2.7 Encargados, remisiones y transferencias (incluidas las internacionales)

- **Definiciones** [1, art. 2 fr. XII y XX]:
  - **encargado:** trata datos por cuenta del responsable;
  - **transferencia:** comunicación a persona distinta del titular, del responsable **o del
    encargado**, dentro o fuera de México. Es decir, **mandar datos a un encargado no es
    transferencia**, aunque esté en el extranjero.
- **Reglamento de 2011** [3] **[VERIFICAR CON ABOGADO]** sobre su vigencia supletoria:
  - las remisiones nacionales e **internacionales** a encargados **no requieren informarse ni
    consentirse** (art. 53);
  - la relación con el encargado debe constar en cláusulas contractuales (art. 51);
  - el encargado trata solo según instrucciones, guarda confidencialidad y suprime al terminar
    (art. 50);
  - toda **subcontratación** del encargado debe estar autorizada por el responsable; puede
    autorizarse en el contrato (arts. 54 y 55);
  - **cómputo en la nube** por adhesión a condiciones generales (art. 52): solo si el proveedor
    - tiene políticas afines a la ley;
    - transparenta sus subcontrataciones;
    - no se adueña de la información;
    - guarda confidencialidad;
    - avisa de cambios;
    - permite limitar el tratamiento;
    - tiene seguridad;
    - garantiza la supresión;
    - informa los accesos de autoridades.
- **Transferencias a terceros** (no encargados): se comunica el aviso al receptor, que asume las
  obligaciones del responsable [1, art. 35]. Hay excepciones al consentimiento [1, art. 36], p. ej.
  fr. IV (contrato en interés del titular) y fr. VII (relación jurídica entre el responsable y el
  titular).

**Mapa de speeaking**

| Receptor                                                                                 | Figura probable                                                               | Qué hacer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel (alojamiento), Neon (base de datos), Cloudflare R2 (fotos), Resend o SES (correo) | Encargados, probablemente fuera de México **[VERIFICAR región]**              | Contrato o DPA de cada uno que cumpla los arts. 50–55 del Reglamento, sobre todo el 52 (nube por adhesión). Nombrarlos por categoría (o por nombre) y país en el aviso: no es obligatorio para encargados [3, art. 53], pero da transparencia.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **OpenRouter, Inc.** (EE. UU.) → proveedores de modelos                                  | Encargado; los proveedores de modelos son **subencargados**                   | Datos verificados: sus términos incorporan un **DPA** para uso comercial [33]; el DPA avisa con 30 días los subencargados nuevos **excepto los proveedores de modelos**; hospeda en GCP en EE. UU.; notifica incidentes en 72 h; su política de retención cero (ZDR) borra la carga útil al terminar la solicitud [34]. Su política de privacidad (act. 31-08-2026) dice que no entrena con entradas ni salidas; cada proveedor de modelo tiene su propia política [35]. **Acción:** aceptar el DPA; documentar la autorización general de subencargados (Reglamento art. 55); mandar también `zdr: true` [36]; nombrarlo en el aviso con su país. Sus términos piden **18 años** para usar el servicio y se rigen por las leyes de Nueva York [33]. |
| **Vendedor** que recibe nombre, domicilio de entrega y teléfono del comprador            | **Transferencia** a un tercero (el vendedor no actúa por cuenta de speeaking) | Cláusula de transferencia en el aviso. Excepción probable: art. 36 fr. IV o VII **[VERIFICAR CON ABOGADO]**. Comunicar al vendedor el aviso y sus obligaciones [1, art. 35]; en los términos del vendedor, obligarlo a usar esos datos **solo** para entregar el pedido. El vendedor queda como responsable de lo que recibe.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Comprador que ve el domicilio y el teléfono del vendedor (LFPC 76 BIS fr. III)           | Transferencia de datos del vendedor                                           | Consentimiento o información en los términos del vendedor; mostrarlos en la confirmación del pedido, no en público (plan §7.1).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Autoridades (SAT, IMPI, Ministerio Público, jueces)                                      | Transferencia por ley o por mandato                                           | Excepciones del art. 9 fr. VII y del art. 36 fr. I y V [1].                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

### 2.8 Derechos ARCO (y lo que no existe: portabilidad)

- **Derechos:** acceso, rectificación, cancelación y oposición [1, arts. 21–26]. La cancelación abre
  un **periodo de bloqueo** igual a la prescripción de las acciones; después se suprimen y se avisa
  al titular [1, art. 24]. Casos en que no procede cancelar [1, art. 25].
- **La solicitud contiene** [1, art. 28]:
  - nombre y medio de notificación;
  - identificación;
  - descripción de los datos;
  - el derecho que se ejerce.
- **Plazos** (en **días hábiles** [1, art. 2 fr. VIII]):
  - **20 días** para responder;
  - **15 días** para hacer efectiva la respuesta procedente;
  - cada plazo se puede ampliar **una vez** por un periodo igual, si se justifica [1, art. 31].
- **Gratuito:** solo se cobran costos de reproducción o envío [1, art. 34].
- **Negativas:** causas y cómo informarlas [1, art. 33].
- **Si la respuesta no le satisface, o no llega,** el titular pide protección a la SABG dentro de
  **15 días**; la SABG resuelve en **50 días** [1, arts. 40 y 42].
- **Portabilidad:** la ley de **particulares** no la establece (no aparece en [1]). Aun así, la
  **exportación** de SEC-26 sirve para el derecho de acceso y es buena práctica.
- **Impacto:** SEC-26 es un **bloqueador legal** antes del lanzamiento público. Mínimo viable
  (aceptable si se cumplen los plazos **[VERIFICAR CON ABOGADO]**):
  - un correo ARCO ([CORREO DE PRIVACIDAD]);
  - un procedimiento interno con plazos;
  - un registro de solicitudes;
  - acceso y cancelación manuales mientras se construyen la exportación y el borrado.

### 2.9 Decisiones automatizadas

La persona puede **oponerse** cuando un tratamiento automatizado le produce efectos jurídicos no
deseados o afecta de manera significativa sus intereses, derechos o libertades, y evalúa **sin
intervención humana** aspectos personales como situación económica, **fiabilidad o
comportamiento** [1, art. 26 fr. II].

| Funcionalidad                                                                                                          | ¿Encaja?                                                                                                                                                                              | Medida                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Riesgo de falsificación**: pondera «tienda nueva», ventas completadas y reportes, y muestra una leyenda al comprador | **Posible.** Evalúa la fiabilidad del vendedor y puede afectar sus ventas. Mitigantes: no oculta ni sanciona de forma automática; ocultar y verificar lo decide una persona (ADR-036) | Explicarlo en el aviso (ya se hace); ofrecer un **canal de revisión humana y de oposición** («¿Crees que es un error? Pide revisión»); guardar la versión de las reglas (ya se hace) **[VERIFICAR CON ABOGADO]**.     |
| Feed personalizado y sugerencias                                                                                       | Poco probable (no produce efectos jurídicos), pero es perfilamiento                                                                                                                   | Opt-out real (existe) y consentimiento previo (2.5).                                                                                                                                                                  |
| Señal de IA de autenticidad                                                                                            | Solo suma riesgo (peso ≤ 0.15), nunca decide sola                                                                                                                                     | Mantener «nunca decide sola» en los términos y el aviso.                                                                                                                                                              |
| CEO-IA: experimentos A/B y cambios automáticos de bajo riesgo                                                          | Sobre métricas agregadas; asigna variantes por cuenta                                                                                                                                 | Decir en el aviso que se prueban cambios del producto con grupos y que no se toman decisiones individuales sobre cuentas; excluir de su alcance las sanciones a cuentas (hoy ya excluye pagos, precios y comisiones). |

### 2.10 Conservación y supresión

- **Supresión:** los datos que ya no son necesarios se suprimen, previo bloqueo, al terminar el
  plazo de conservación [1, art. 10 párr. 2].
- **Incumplimientos contractuales:** los datos sobre incumplimiento de obligaciones contractuales se
  eliminan a los **72 meses** [1, art. 10 párr. 3]. Posible aplicación: el historial de sanciones o
  suspensiones de vendedores **[VERIFICAR CON ABOGADO]**.
- **Plazos pendientes del aviso** (actividad detallada y moderación): hay que fijarlos y
  **aplicarlos en código** antes de publicarlos. Referencias:
  - contabilidad fiscal propia: **5 años** [23, art. 30];
  - comerciantes: mensajes de datos con contratos, **10 años** [27, art. 49]; aplica a la aceptación
    de términos si speeaking es comerciante **[VERIFICAR CON ABOGADO]**.
- **IA:** 90 días y después `{ redacted: true }` (`ai/retention.ts`), con la tarea diaria
  programada en el hosting. Confirmar que corre en producción.

### 2.11 Seguridad y vulneraciones

- **Medidas de seguridad** administrativas, técnicas y físicas, no menores a las que el responsable
  usa para su propia información [1, art. 18]. **Confidencialidad** de todos los que intervienen
  [1, art. 20].
- **Vulneraciones:**
  - las que afecten de forma significativa los derechos patrimoniales o morales se informan **de
    inmediato al titular** [1, art. 19];
  - el Reglamento detalla qué cuenta como vulneración y que el aviso trae la naturaleza del
    incidente, los datos comprometidos, recomendaciones, las acciones correctivas y dónde
    informarse [3, arts. 63–66];
  - **la ley no exige avisar a la SABG**; no encontramos esa obligación en [1] ni en [3]
    **[VERIFICAR CON ABOGADO]**.
- **Delitos:** vulnerar la seguridad de una base de datos bajo custodia con ánimo de lucro: 3 meses a
  3 años de prisión. Tratar datos mediante engaño para lucrar: 6 meses a 5 años. Se duplican con
  datos sensibles [1, arts. 62–64].
- **Acción:** el procedimiento de una página del plan (§4.1) con la plantilla de aviso al titular,
  alineado con el art. 65 del Reglamento.

### 2.12 Infracciones y sanciones

Infracciones [1, art. 58]. Sanciones [1, art. 59]:

| Sanción                          | Casos                                | En UMA        | En pesos (UMA 2026 = $117.31 [10]) |
| -------------------------------- | ------------------------------------ | ------------- | ---------------------------------- |
| Apercibimiento                   | Art. 58 fr. I                        | —             | —                                  |
| Multa                            | Fr. II–VII (p. ej. aviso incompleto) | 100 a 160,000 | ≈ $11,731 a $18,769,600            |
| Multa                            | Fr. VIII–XVIII                       | 200 a 320,000 | ≈ $23,462 a $37,539,200            |
| Multa adicional por reincidencia | Infracciones que persisten           | Hasta 320,000 | —                                  |

Con datos sensibles, los montos pueden duplicarse. La SABG considera la capacidad económica y la
intención [1, art. 60].

### 2.13 Menores de edad

- La mayoría de edad empieza a los 18 años; los menores tienen incapacidad legal [28, arts. 646 y
  450]. Por eso los términos y el registro deben exigir **18 años** (contratación, venta y
  consentimiento).
- La LFPC pide advertir cuando la información no es apta para población vulnerable, como niñas y
  niños [11, art. 76 BIS fr. VII]; la NMX pide lo mismo [12, 5.1.4].
- OpenRouter exige 18 años a sus usuarios [33].
- **Hoy no hay control de edad** (sección 1). Acción: casilla «Tengo 18 años o más» en el registro,
  cláusula en los términos y bloqueo de «Vender» sin ella (plan, Ola 0) **[VERIFICAR CON ABOGADO]**
  para el nivel de verificación.

---

## 3. Protección al consumidor y comercio electrónico

### 3.1 Ámbito

- **Proveedor:** quien **habitual o periódicamente** ofrece o vende bienes o servicios [11, art. 2
  fr. II]. Un vendedor ocasional podría no ser «proveedor»; la emprendedora que vende cada semana sí
  lo es **[VERIFICAR CON ABOGADO]**.
- **NMX-COE-001-SCFI-2018** [12]:
  - define al **Proveedor intermediario** (3.12): opera el sistema que pone en contacto a terceros
    proveedores con consumidores, «pudiendo facilitar» el pago o la entrega;
  - define al **Tercero proveedor** (3.16): el vendedor.

  speeaking encaja como proveedor intermediario aunque no cobre.

- **Es una Norma Mexicana, no una NOM.** La LFPC dice que quien vende por medios electrónicos «se
  guiará» por ella [11, art. 76 BIS 1]. Qué tan obligatoria es en la práctica **[VERIFICAR CON
  ABOGADO]**; la tratamos como el estándar que la PROFECO usará para evaluar. PROFECO emitió un Código de Ética de comercio electrónico de adhesión
  **voluntaria**; adherirse lo vuelve vinculante [13].

### 3.2 Obligaciones del art. 76 BIS (reformado DOF 12-12-2025) [11]

| Fr.              | Obligación                                                                                                                                                                    | speeaking                                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| I                | Usar la información del consumidor de forma confidencial; no pasarla a otros proveedores ajenos a la transacción sin autorización expresa                                     | El comprador solo se comparte con el vendedor de **su** pedido. «Gente de tus comunidades» no comparte datos con proveedores. |
| II               | Seguridad y confidencialidad, e informar sus características antes de la transacción                                                                                          | Sección de seguridad en los términos o el aviso.                                                                              |
| III              | **Antes** de la transacción: domicilio físico, teléfonos y medios de reclamación                                                                                              | De **speeaking** ([DOMICILIO…], [CORREO DE SOPORTE]) y del **vendedor** (en la confirmación del pedido; plan §7.1).           |
| IV               | Evitar prácticas engañosas; cumplir las reglas de información y publicidad                                                                                                    | Datos P4, guardián de la IA, «Creado con ayuda de IA».                                                                        |
| V                | Informar términos, condiciones, costos, cargos adicionales y formas de pago                                                                                                   | Métodos de pago como dato P4; «Paga solo con los datos de tu pedido» (plan §7.2).                                             |
| VI               | Respetar la cantidad y calidad pedidas y la decisión de **no recibir avisos comerciales**                                                                                     | Baja de correos de marketing en un clic.                                                                                      |
| VII              | No usar estrategias sin información clara, sobre todo dirigidas a población vulnerable (niñas, niños, personas mayores, enfermas); advertir cuando la información no sea apta | 18+ y reglas de contenido.                                                                                                    |
| VIII–IX (nuevas) | Cobros recurrentes: consentimiento expreso, aviso 5 días antes de renovar y cancelación inmediata                                                                             | No aplica hoy. **Aplicará** si P12 o una suscripción cobran de forma recurrente.                                              |

**Multa** por infringir el art. 76 BIS: **$1,093.02 a $4,274,960.73** (monto actualizado DOF
23-12-2025) [11, art. 128].

### 3.3 Lo que la NMX pide al proveedor intermediario [12]

- **4.1:** indicar en el sistema si cumple la NMX.
- **4.4 y 5.1.7:** los términos y condiciones deben **delimitar las obligaciones y
  responsabilidades** del intermediario y del tercero proveedor. No pueden ser menores a las de la
  ley.
- **5.2.1.1:** identificación del intermediario:
  - nombre comercial y marca;
  - razón social;
  - **domicilio físico en México**;
  - **RFC**;
  - teléfono u otros medios;
  - correo y portales.
- **5.2.1.4:** informar los derechos del consumidor, incluida la **revocación en 5 días hábiles**
  (ver 3.4).
- **5.3.3:** mecanismo para calificar y opinar. **5.3.6:** exigir al tercero proveedor que cumpla
  5.3.
- **5.4.1:** consentimiento previo para perfilar (2.5).
- **8.1:** privacidad por diseño y opciones protectoras por omisión (buena práctica).
- **10:** mecanismos gratuitos de dudas y reclamaciones, con domicilio y teléfono; posibles medios
  alternativos.
- **11:** condiciones de cancelación, devolución y cambio.

### 3.4 Otras reglas de la LFPC que tocan el producto [11]

- **Precio total** visible, con impuestos, comisiones y cargos [art. 7 BIS]. Si el precio incluye
  IVA, decirlo.
- **Publicidad:** veraz, comprobable y sin inducir a error [art. 32]. Aplica a los textos de «Vende
  con IA», al kit de anuncios y, en el futuro, a P12 y al vendedor IA.
- **Garantía:** si se ofrece, **no puede ser menor a 90 días** [art. 77]. Hoy el formulario acepta de
  1 a 3,650 días y propone 30 (plan §7.1). Corregir: «Sin garantía» o «≥ 90 días».
- **Ventas fuera del establecimiento:**
  - el contrato se perfecciona a los **5 días hábiles** y el consumidor puede **revocar** sin
    responsabilidad [arts. 51–56];
  - el capítulo **no aplica a perecederos recibidos y pagados de contado** [art. 51]. Relevante para
    el nicho de comida y repostería **[VERIFICAR CON ABOGADO]** si aplica a ventas por plataforma.
- **Mercadotecnia:** datos del proveedor y de la PROFECO en la publicidad enviada [art. 17];
  Registro Público para Evitar Publicidad [arts. 18 y 18 BIS]; derecho a saber qué información de
  mercadotecnia se tiene, con respuesta en 30 días [art. 16].

### 3.5 Contratos de adhesión (los términos y condiciones son uno)

- **Validez:** en español, legibles, sin prestaciones desproporcionadas ni cláusulas abusivas
  [11, art. 85].
- **Registro ante la PROFECO:** solo si una NOM lo exige [11, art. 86]. No encontramos una NOM que
  lo exija para plataformas de intermediación **[VERIFICAR CON ABOGADO]**.
- **Cláusulas que no valen** [11, art. 90]:
  - las que permiten al proveedor **modificar unilateralmente** el contrato;
  - las que lo liberan de su responsabilidad civil;
  - las que trasladan su responsabilidad a otro;
  - las que acortan la prescripción;
  - las que exigen formalidades para demandar;
  - las que obligan a **renunciar a la LFPC** o someten a **tribunales extranjeros**.
- **Irrenunciable:** la LFPC es de orden público y no admite pacto en contrario [11, art. 1].

### 3.6 PROFECO: quejas, conciliación y publicidad

- **Quejas:** la PROFECO recibe quejas por escrito, por teléfono o en línea [11, art. 99].
- **Concilianet:** módulo de conciliación en línea para proveedores con **convenio de
  colaboración**; pide acta constitutiva, poderes notariales y RFC [15]. No es obligatorio; se
  evalúa cuando exista la sociedad.
- **Guía de publicidad para influencers** (PROFECO, 2023): identificar el contenido pagado de forma
  visible (p. ej. «#Publicidad») durante todo el contenido [14]. Base para P12: la etiqueta
  «Patrocinado» debe ser visible siempre.

### 3.7 Pago directo (modo del piloto)

- **Cómo funciona:** con pago directo, speeaking no cobra ni custodia fondos (ADR-033). El contrato de
  compraventa es entre el comprador y el vendedor. La plataforma sigue con sus deberes de
  información, confidencialidad, seguridad y reclamación como intermediario [11, art. 76 BIS; 12].
- **En los términos:**
  - quién es la parte vendedora;
  - que speeaking no recibe el pago;
  - qué hace speeaking ante un problema («Tengo un problema», plazos);
  - que la responsabilidad no puede excluirse más allá de lo que permite el art. 90 **[VERIFICAR
    CON ABOGADO]**.

---

## 4. Propiedad industrial e intelectual

### 4.1 Falsificaciones y marcas (LFPPI, última reforma DOF 03-04-2026) [16]

- **Infracciones administrativas** (art. 386): usar una marca parecida en grado de confusión
  (fr. XVII); usar una marca registrada sin consentimiento en productos iguales o similares
  (fr. XXI); ofrecer en venta productos con la marca o el etiquetado alterados (fr. XXII y XXIII).
  «Usar» incluye **ofrecer en venta y vender** (art. 387).
- **Sanciones** (art. 388):
  - multa de hasta **250,000 UMA** por conducta (≈ $29.3 millones con la UMA 2026 [10]);
  - hasta **1,000 UMA por día** si persiste;
  - clausura temporal de hasta 90 días o definitiva.
- **Delitos** (art. 402, reformado 03-04-2026): falsificar una marca con fines de especulación
  comercial. «Falsificar» es usar una marca idéntica o indistinguible para **presentar falsamente
  un producto como original**. También es delito vender objetos con marcas falsificadas.
- **Medidas provisionales del IMPI** (art. 344):
  - ordenar al presunto infractor **«o a las terceras personas»** la suspensión, el bloqueo, la
    **remoción de contenidos** o el cese por **cualquier medio virtual, digital o electrónico**
    (fr. VII, reformada 03-04-2026);
  - las puede adoptar **de oficio**;
  - quien las solicita debe identificar los bienes, los establecimientos o las **plataformas
    digitales** donde ocurre la violación (art. 345 fr. III);
  - incumplirlas se sanciona con las fr. I o III del art. 388.
- **Consecuencia para speeaking:**
  - la plataforma puede recibir órdenes del IMPI y debe cumplirlas de inmediato;
  - la LFPPI **no trae un «puerto seguro»** para intermediarios equivalente al de derechos de autor
    **[VERIFICAR CON ABOGADO]**;
  - las defensas prácticas son las de P14, más un **procedimiento de aviso y retiro para titulares
    de marcas** con un canal formal ([CORREO DE SOPORTE] o un formulario):
    - reglas contra imitaciones;
    - revisión humana;
    - comprobantes;
    - ocultar y restaurar con bitácora;
    - reportes;
  - no certificar autenticidad (ya se hace).
- **Nombre y marca propia:** la búsqueda en el IMPI antes de salir de los 15 vendedores fundadores
  (ADR-033 #16) evita infringir el art. 386 fr. XVII o XVIII con el nombre speeaking.

### 4.2 Derechos de autor del contenido de usuarios (LFDA, última reforma DOF 14-05-2026) [17]

- **Puerto seguro** para «Proveedores de Servicios en Línea» (art. 114 Septies fr. II b: almacenan
  material a petición del usuario). No responden por daños **si** cumplen el art. 114 Octies:
  - retiran **de forma expedita** al recibir un aviso del titular o una resolución de autoridad, y
    toman medidas razonables para que no se vuelva a subir;
  - si retiran de buena fe por su cuenta, avisan a la persona afectada;
  - tienen una **política pública de terminación de cuentas de infractores reincidentes**;
  - no reciben un beneficio financiero atribuible a la infracción cuando pueden controlarla.
- **Aviso y contra-aviso:**
  - el aviso trae: nombre y contacto, contenido, derecho y ubicación;
  - el usuario puede mandar un **contra-aviso**; el contenido se restaura salvo que el titular inicie
    un procedimiento en **15 días hábiles**;
  - **no hay obligación de monitorear**.
- La SCJN validó el mecanismo de aviso y retiro en la AI 217/2020 y su acumulada (3 de junio de 2024;
  secundaria) [18].
- **Acción:** poner en los términos la política de derechos de autor (aviso, contra-aviso y
  reincidentes) y un canal para avisos.
- **Contenido generado con IA:**
  - la Segunda Sala de la SCJN resolvió (AD 6/2025, 14-07-2025) que lo generado **exclusivamente**
    por IA no se protege por derecho de autor, y que la intervención humana significativa sí puede
    protegerse [19] (secundaria);
  - consecuencia para los términos: speeaking no promete derechos exclusivos sobre los textos de IA; el
    vendedor los revisa y edita;
  - la reforma del 14-05-2026 exige consentimiento expreso para usar la imagen o la voz de artistas,
    **incluidos los resultados de IA** [17, art. 87]. Prohibir en las reglas de contenido los clones
    de voz o imagen sin permiso.
- **Licencia de contenido:** los términos necesitan una licencia **no exclusiva** del usuario a
  speeaking para alojar, mostrar y adaptar (formatos, recortes) su contenido mientras esté publicado.
  Redacción: **[VERIFICAR CON ABOGADO]**.

---

## 5. Fiscal: plataformas de intermediación y el modelo sin cobro

### 5.1 Normas

| Norma                                                                                          | Qué dice                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **LIVA art. 18-B** (última reforma de la ley: DOF 12-11-2021) [20]                             | Lista los «servicios digitales», entre ellos **fr. II: la intermediación entre oferentes y demandantes**, «**siempre que por los servicios mencionados se cobre una contraprestación**».                                                                                                                                                                                                                                                                                                                                 |
| **LIVA art. 1o.-A BIS** [20]                                                                   | Los **residentes en México** que presten el servicio del art. 18-B fr. II, como intermediarios en actividades de terceros afectas al IVA, cumplen las obligaciones del **art. 18-J**. Los vendedores cumplen los arts. 18-K a 18-M.                                                                                                                                                                                                                                                                                      |
| **LIVA art. 18-J** [20]                                                                        | **fr. I:** publicar el IVA por separado o la leyenda «IVA incluido». **fr. II:** **cuando cobren** el precio y el IVA por cuenta del vendedor, retener el 50 % del IVA a personas físicas (100 % sin RFC), enterar, emitir CFDI de retenciones e inscribirse como retenedores. **fr. III:** informar **cada mes, a más tardar el día 10**, los datos de los vendedores (nombre, **RFC, CURP**, domicilio fiscal, **institución financiera y CLABE**, monto de operaciones) «**aun cuando no hayan efectuado el cobro**». |
| **LISR arts. 113-A a 113-D** [21]                                                              | ISR de las personas físicas que venden por plataformas. La retención la hacen «las **personas morales** residentes en México o residentes en el extranjero…» que proporcionen el uso de las plataformas, sobre «los ingresos que **efectivamente perciban** las personas físicas **por conducto** de» la plataforma. La plataforma también entrega la información del art. 18-J fr. III (113-C fr. III). Sin RFC, retención del 20 %.                                                                                    |
| **LIF 2026 art. 25 fr. VI** (DOF 07-11-2025) [22]                                              | La tasa de retención de ISR por enajenación de bienes y servicios pasa a **2.5 %** y se extiende a **personas morales** (20 % sin RFC).                                                                                                                                                                                                                                                                                                                                                                                  |
| **LIF 2026 art. 25 fr. IX** [22]                                                               | «**Cuando cobren** el precio y el IVA…»: retener IVA a personas morales, y el 100 % a extranjeros sin establecimiento o a vendedores con cuentas en el extranjero; más la información del art. 18-J fr. III.                                                                                                                                                                                                                                                                                                             |
| **CFF art. 30-B** (adicionado DOF 07-11-2025; **vigente desde el 01-04-2026**) [23]            | Quienes presten servicios digitales «**de conformidad con los artículos 1o.-A BIS y 18-B**» de la LIVA deben dar al SAT **acceso en línea y en tiempo real** a la información fiscal de sus sistemas. Si no, **bloqueo temporal** del servicio.                                                                                                                                                                                                                                                                          |
| **RMF 2026** (DOF 28-12-2025, según Basham) [24][25] (secundaria)                              | **Regla 2.9.21:** acceso del art. 30-B. Información detallada al día siguiente, conservación de 5 años y **entrega de usuario, contraseña y manuales al SAT a más tardar el 30-04-2026**. **Regla 12.2.7:** información mensual de intermediación a más tardar el día 10, aun sin cobro.                                                                                                                                                                                                                                 |
| **Criterio normativo 40/IVA/N** (1.ª modificación al Anexo 7 de la RMF 2024) [26] (secundaria) | Define la intermediación digital. Conserva el requisito de que se **cobre una contraprestación**. Aclara que cuenta aunque la plataforma se presente como «tienda en línea» o «agregador».                                                                                                                                                                                                                                                                                                                               |

### 5.2 Aplicación al piloto (pago directo, comisión 0 %)

1. **Retenciones de ISR e IVA: no aplican mientras no se cobre por cuenta del vendedor.** Las normas
   se activan «cuando cobren» [20, art. 18-J fr. II; 22, fr. IX] o sobre ingresos «efectivamente
   percibidos por conducto» de la plataforma [21, art. 113-A]. Con pago directo no hay base.
   Confianza **alta**, pero **[VERIFICAR CON CONTADOR]**.
2. **Obligación informativa mensual (18-J fr. III) y acceso en tiempo real (CFF 30-B): dudosa.**
   - **En contra:** la informativa aplica aunque no se cobre.
   - **A favor:** ambas presuponen que speeaking presta el servicio del **art. 18-B fr. II**, y ese
     artículo y el criterio 40/IVA/N exigen que **se cobre una contraprestación**. Con 0 % y sin
     cuotas, el argumento para que **no aplique** es sólido.
   - **Riesgos del argumento:**
     - ¿cuenta como contraprestación algo no monetario (datos, publicidad)?
     - ¿el SAT podría ver la intermediación como gratuita solo en apariencia?

   **[VERIFICAR CON CONTADOR]**. Conviene una consulta o una opinión escrita antes del vendedor 11.

3. **Qué cambia al cobrar:** si speeaking cobra cualquier cosa por intermediar (comisión, «Impulsar»
   de P12, suscripción o destacados), casi seguro entra al régimen:
   - IVA y CFDI por su servicio;
   - IVA por separado o «IVA incluido» en los precios de los vendedores (18-J fr. I);
   - informativa mensual con RFC, CURP y CLABE de cada vendedor;
   - acceso en tiempo real (30-B, regla 2.9.21);
   - retenciones, si además cobra por cuenta del vendedor.

   Eso exige **recolectar RFC, CURP y CLABE** de los vendedores: son datos financieros. La excepción
   de consentimiento por disposición legal [1, art. 9 fr. I] cubre el uso fiscal, pero hay que
   actualizar el aviso.

4. **¿Quién retiene?** El art. 113-A nombra a las «personas morales». Si la plataforma la opera una
   persona física, el texto literal del ISR no la incluye; la LIVA (1o.-A BIS) habla de
   «contribuyentes residentes en México» **[VERIFICAR CON CONTADOR]**. Esto importa para decidir la
   entidad (ADR-033 #5).
5. **Vendedores:** su ISR e IVA son responsabilidad de cada uno. Los términos deben decirlo, sin
   asesorar. Los alimentos pueden tener tasa 0 % de IVA; ¿cuentan como «actividades afectas» para el
   1o.-A BIS? **[VERIFICAR CON CONTADOR]**.
6. **Contabilidad propia:** conservar 5 años [23, art. 30].

### 5.3 Preguntas para el contador

1. Con comisión 0 %, sin cuotas y con pago directo, ¿speeaking presta el servicio del art. 18-B fr. II?
   ¿Aplican el 1o.-A BIS, la informativa del 18-J fr. III, la regla 12.2.7 y el CFF 30-B?
2. ¿Conviene una consulta al SAT (CFF art. 34) o basta una opinión escrita?
3. Al activar P12 (cobro por resultados o saldo prepagado), ¿qué obligaciones nacen y desde cuándo?
   ¿El saldo prepagado y reembolsable tiene implicaciones de otra regulación?
4. Persona física con actividad empresarial o SAS: ¿quién es retenedor?
5. ¿El «costo» privado del producto o los comprobantes de compra tienen algún uso o riesgo fiscal si
   los ve el SAT (30-B)?

---

## 6. Contratos electrónicos y prueba

- **Formación del contrato:** los contratos mercantiles por medios electrónicos se perfeccionan al
  recibirse la aceptación [27, art. 80]. No se niegan efectos a la información por estar en un
  mensaje de datos [27, art. 89 bis]. Principios de neutralidad tecnológica y equivalencia funcional
  [27, art. 89].
- **Forma escrita:** se cumple si el mensaje se mantiene íntegro y accesible [27, art. 93]. El
  «original» exige garantía de integridad [27, art. 93 bis].
- **Materia civil:** el consentimiento expreso puede darse por medios electrónicos [28, art. 1803].
  La propuesta y la aceptación electrónicas no requieren pacto previo [28, art. 1811]. La forma
  escrita se cumple si la información es atribuible y accesible [28, art. 1834 bis].
- **Prueba:** los mensajes de datos son prueba; su fuerza depende de la **fiabilidad del método**
  con que se generaron y conservaron [27, arts. 1205 y 1298-A].
- **Conservación:** los comerciantes conservan **10 años** los mensajes de datos con contratos; la
  NOM-151 fija cómo [27, art. 49]. La **NOM-151-SCFI-2016** (DOF 30-03-2017) regula la
  **constancia de conservación**, que solo emite un prestador de servicios de certificación
  acreditado, con sellos de tiempo, y vale al menos 10 años [29].
- **speeaking hoy:** casilla obligatoria sin marcar, más un registro `Consent` con tipo, versión y
  fecha, más re-aceptación al cambiar la versión. **Refuerzos sugeridos:**
  - guardar el **texto exacto** (o su hash) de cada versión publicada;
  - no permitir que se edite una versión ya aceptada;
  - considerar guardar la IP de la aceptación: mejor prueba, pero más datos; decisión con el
    abogado.
- **NOM-151:** no parece necesaria para el clic de aceptación del piloto. Evaluarla para contratos
  con vendedores con dinero de por medio (P12) **[VERIFICAR CON ABOGADO]**.
- **Cambios a los términos:** no pueden imponerse de forma unilateral [11, art. 90 fr. I]. El
  mecanismo actual pide aceptar la nueva versión y la registra. Falta decir qué pasa si la persona
  **no** acepta (p. ej. puede cerrar su cuenta y exportar sus datos) **[VERIFICAR CON ABOGADO]**.

---

## 7. Moderación de contenido y responsabilidad

- **No hay una ley general** mexicana que regule la responsabilidad de las plataformas por el
  contenido de sus usuarios. El régimen específico que encontramos es el de derechos de autor
  [17, art. 114 Octies] **[VERIFICAR CON ABOGADO]**. La **Ley en Materia de Telecomunicaciones y
  Radiodifusión** (DOF 16-07-2025) eliminó en el Senado el art. 109, que permitía bloquear
  plataformas sin orden judicial [31] (secundaria).
- **Órdenes que la plataforma debe atender:**
  - **Violencia digital o mediática:** el Ministerio Público o un juez ordenan de inmediato a
    plataformas y redes interrumpir, bloquear o eliminar imágenes, audios o videos. La plataforma
    **avisa de inmediato al usuario** que el contenido se inhabilita por orden judicial; hay audiencia
    en 5 días [30, art. 20 Sexies].
  - **IMPI:** remoción o bloqueo digital (4.1) [16, art. 344 fr. VII].
  - **Derechos de autor:** aviso o resolución (4.2) [17, art. 114 Octies].
- **Daño moral:** la ley civil exige reparar el daño moral por hechos ilícitos, con excepciones para
  la opinión, la crítica y la información [28, arts. 1916 y 1916 Bis]. Para una plataforma con sede
  en la CDMX puede aplicar la legislación civil local **[VERIFICAR CON ABOGADO]**.
- **Buenas prácticas para los términos** (derivadas de lo anterior y de ADR-035 y ADR-036):
  - reglas claras de contenido y de artículos prohibidos (incluye alimentos y sorteos, plan §7.1);
  - quién decide: siempre una persona; la IA nunca sanciona;
  - aviso a la persona afectada con el motivo;
  - **apelación o revisión** con plazo;
  - reincidencia y suspensión;
  - canal para autoridades y titulares de derechos;
  - bitácora (ya existe);
  - no prometer monitoreo total.

---

## 8. Términos y condiciones: contenido mínimo, jurisdicción y disputas

Lo que deben traer los términos, con su fundamento:

1. **Identificación de speeaking:** [NOMBRE O RAZÓN SOCIAL DEL RESPONSABLE], [RFC], [DOMICILIO PARA
   OÍR Y RECIBIR NOTIFICACIONES], [CORREO DE SOPORTE] [12, 5.2.1.1; 11, art. 76 BIS fr. III].
2. **Edad mínima de 18 años** [28, arts. 450 y 646].
3. **Papel de speeaking como intermediario** y reparto de responsabilidades con el vendedor [12, 4.4
   y 5.1.7], sin excluir lo que la LFPC no permite [11, art. 90 fr. II y III].
4. **Pago directo:** speeaking no cobra ni recibe el pago; qué hace ante un problema; tope recomendado
   (ADR-033 #15).
5. **Derechos del consumidor:** garantía de 90 días si se ofrece [11, art. 77]; revocación de 5 días
   cuando aplique [11, art. 56]; devoluciones y cambios [12, 11].
6. **Reglas de contenido**, falsificaciones, comprobantes, moderación con revisión humana y
   apelación (secciones 4 y 7).
7. **Política de derechos de autor y marcas:** aviso, contra-aviso y reincidentes [17, art. 114
   Octies].
8. **IA:** textos marcados, revisión del vendedor, sin garantía de ventas, sin derechos exclusivos
   sobre lo generado [19].
9. **Cambios a los términos** con aceptación y alternativa de salida [11, art. 90 fr. I].
10. **Quejas:** canal propio gratuito [12, 10]; derecho a acudir a la PROFECO [11, art. 99].
11. **Jurisdicción y ley aplicable:** leyes federales mexicanas; **nunca tribunales extranjeros para
    consumidores** [11, art. 90 fr. VI]. La cláusula de competencia de la PROFECO es obligatoria en
    contratos **registrados** [11, art. 86], y los nuestros no lo están. Aun así, se puede
    reconocer la vía administrativa de la PROFECO. La competencia judicial (p. ej. tribunales de la
    Ciudad de México o los del domicilio del consumidor) **[VERIFICAR CON ABOGADO]**.
12. **Fiscal:** cada vendedor es responsable de sus impuestos (5.2).

---

## 9. Mapa: obligaciones por funcionalidad de speeaking

| Funcionalidad                                      | Obligación principal                                                                                                     | Estado (2026-09-26)                                 | Acción                                                                                   | Cuándo                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------ |
| Registro con correo y contraseña                   | Aviso simplificado al recabar [1, art. 16 fr. II]; aceptación de términos [27, art. 80]                                  | Casilla sin marcar con liga; sin aviso simplificado | Texto simplificado junto al formulario                                                   | Antes de abrir                             |
| Edad                                               | 18+ [28, arts. 450 y 646]; población vulnerable [11, art. 76 BIS fr. VII]                                                | **No implementado**                                 | Casilla de 18+, cláusula y «Vender» bloqueado sin ella                                   | Ola 0                                      |
| Onboarding (comunidades, marcas, qué busca)        | Finalidades y datos en el aviso [1, art. 15]; sensibles [1, art. 8]                                                      | Descrito en el aviso                                | No crear comunidades con temas sensibles                                                 | Siempre                                    |
| Presupuesto opcional                               | Posible dato patrimonial: consentimiento expreso [1, art. 7]                                                             | Campo opcional                                      | Explicar el uso junto al campo; decidir con el abogado si hace falta una casilla expresa | Antes de abrir                             |
| Personalización                                    | No premarcar [4, Décimo IV]; consentimiento previo para perfilar [12, 5.4.1]                                             | **Premarcada**                                      | Sin marcar o elección explícita                                                          | Antes de abrir                             |
| «Gente de tus comunidades»                         | Finalidad secundaria con negativa [3, art. 14]                                                                           | Opt-out; activado por omisión                       | Decisión del fundador con el abogado; mantener la negativa fácil                         | Antes de abrir                             |
| Impresiones visibles y analítica propia            | Tecnologías automáticas [4, Trigésimo Primero]; minimización [1, art. 12]                                                | Descrito; anónimo sin consentimiento                | Fijar la retención de la actividad detallada y aplicarla en código                       | Antes de abrir                             |
| Cookies y almacenamiento                           | Informar y decir cómo deshabilitar [4, Trigésimo Primero]                                                                | Solo propias; sin terceros                          | Sección de cookies con el inventario real (2.6)                                          | Antes de abrir                             |
| Productos (precio, stock, datos P4, costo privado) | Precio total [11, art. 7 BIS]; publicidad veraz [11, art. 32]; garantía ≥ 90 días [11, art. 77]                          | Costo nunca en DTO; la garantía acepta 1 día        | Corregir la garantía (Tr0); decidir con el abogado si el costo es un dato patrimonial    | Ola 0                                      |
| Fotos (sin EXIF)                                   | Minimización [1, art. 12]                                                                                                | Cumple                                              | Mencionarlo en el aviso                                                                  | —                                          |
| Comprobantes de autenticidad                       | Posibles datos financieros: consentimiento expreso [1, art. 7]; seguridad [1, art. 18]                                   | Privados                                            | Casilla expresa al subir, sugerencia de tapar datos de pago, plazo de retención          | Antes de pedir comprobantes a desconocidos |
| Riesgo de falsificación y leyendas                 | Oposición a decisiones automatizadas [1, art. 26 fr. II]; no acusar [11, art. 32]                                        | Reglas + persona; leyenda al comprador              | Canal «Pide revisión humana»; explicación en el aviso (ya existe)                        | Antes de abrir                             |
| Reportes y moderación                              | Órdenes de autoridad [30, art. 20 Sexies; 16, art. 344; 17, art. 114 Octies]; 72 meses [1, art. 10]                      | Bitácora; sin plazo de retención                    | Procedimiento de órdenes; política de reincidentes; plazo de retención                   | Antes de abrir                             |
| Titulares de marcas                                | Remoción por orden del IMPI [16, art. 344 fr. VII]                                                                       | Botón «Reportar»; falta el canal formal             | Correo o formulario formal y tiempos de respuesta                                        | Antes de abrir                             |
| «Sube y vende» y kit de anuncios                   | Encargado + subencargados [3, arts. 50–55]; publicidad veraz [11, art. 32]; nueva finalidad [1, art. 11]                 | Redacción + 90 días + `data_collection: deny`       | DPA de OpenRouter, `zdr: true`, nombre y país en el aviso                                | Antes de activar el proveedor real         |
| CEO-IA y experimentos A/B                          | Finalidad secundaria [1, art. 15 fr. III]; art. 26 fr. II si decide sobre personas                                       | Agregado; solo personalización activa               | Mención en el aviso (existe); no dejar que decida sanciones                              | Siempre                                    |
| Pedidos (domicilio y teléfono al vendedor)         | Transferencia [1, arts. 35 y 36]; confidencialidad [11, art. 76 BIS fr. I]                                               | Se comparte al aprobarse el pago (simulado)         | Cláusula de transferencia; obligaciones del vendedor en sus términos                     | Antes de pedidos reales                    |
| Datos del vendedor visibles para el comprador      | [11, art. 76 BIS fr. III]                                                                                                | Pendiente (plan §7.1)                               | Mostrarlos en la confirmación, con consentimiento del vendedor                           | Semana 2                                   |
| Pagos directos, comisión 0 %                       | Sin retenciones; informativa y 30-B dudosos [20; 21; 22; 23]                                                             | Sin cobro                                           | Opinión del contador                                                                     | Antes del vendedor 11                      |
| P12 «Impulsar» (futuro)                            | Contraprestación → régimen de plataformas [20; 23]; «Patrocinado» [14]; cobros recurrentes [11, art. 76 BIS fr. VIII–IX] | No activo                                           | Revisión legal y fiscal antes de activarlo                                               | Antes de activar                           |
| Correos (verificación, marketing)                  | Encargado; datos del proveedor y de la PROFECO en la publicidad [11, art. 17]; baja [11, art. 76 BIS fr. VI]             | Sin proveedor                                       | DPA con Resend o SES; casilla aparte de marketing                                        | Antes del primer correo                    |
| ARCO, exportación y borrado                        | [1, arts. 21–34]                                                                                                         | **No existe** (SEC-26)                              | Canal + procedimiento manual; luego el centro de privacidad                              | **Antes de abrir**                         |
| Vulneraciones                                      | Aviso inmediato al titular [1, art. 19; 3, arts. 64–66]                                                                  | Procedimiento pendiente (plan §4.1)                 | Plantilla y procedimiento                                                                | Antes del primer despliegue público        |
| Términos (adhesión)                                | [11, arts. 85 y 90]; [12, 5.2]                                                                                           | Borrador corto                                      | Reescribir con la sección 8                                                              | Antes de abrir                             |

---

## 10. Pendientes para el abogado y el contador

**Abogado (datos personales y consumo)**

1. ¿Aplica hoy de forma supletoria el Reglamento de 2011? ¿Y los Lineamientos del Aviso de 2013? ¿Hay
   algún criterio de la SABG?
2. ¿La casilla premarcada de personalización es válida? ¿«Aparecer en sugerencias» activado por
   omisión es aceptable?
3. El presupuesto, el costo privado y los comprobantes: ¿son datos financieros o patrimoniales que
   piden consentimiento expreso?
4. Los datos del comprador al vendedor: ¿excepción del art. 36 fr. IV o fr. VII? ¿Qué redacción lleva
   la cláusula de transferencia?
5. ¿La leyenda de riesgo de falsificación cae en el art. 26 fr. II? ¿Basta la revisión humana a
   petición?
6. ¿Hay que notificar vulneraciones a la SABG?
7. ¿La plataforma es «proveedor» ante el comprador bajo la LFPC? ¿Cómo se reparte la responsabilidad
   con el vendedor ocasional?
8. ¿Qué cláusula de jurisdicción y de PROFECO usar?
9. ¿Aplica la excepción de perecederos del art. 51 a la comida vendida por la plataforma?
10. ¿Puerto seguro para marcas? ¿Qué procedimiento de aviso y retiro conviene adoptar?
11. ¿Cuánto tiempo conservar las aceptaciones de términos (CCom art. 49)? ¿Conviene guardar la IP?
    ¿Hace falta NOM-151?
12. ¿Qué verificación de edad es suficiente?

**Contador:** las preguntas de la sección 5.3.

---

## 11. Fuentes

Todas consultadas el **2026-09-26**. «✓» = texto leído completo o en las partes citadas.

**Datos personales**

1. ✓ Texto oficial. Cámara de Diputados, _Ley Federal de Protección de Datos Personales en Posesión
   de los Particulares_. Nueva ley DOF 20-03-2025; última reforma DOF 14-11-2025. Arts. 1–64 y
   transitorios. https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf
2. ✓ Cámara de Diputados, _LFPDPPP: publicaciones y reformas_.
   https://www.diputados.gob.mx/LeyesBiblio/ref/lfpdppp.htm
3. ✓ Texto oficial. Cámara de Diputados, _Reglamento de la LFPDPPP_ (DOF 21-12-2011, publicado como
   «texto vigente»). Arts. 2, 14, 49–55 y 63–66.
   https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LFPDPPP.pdf
4. ✓ DOF, _Lineamientos del Aviso de Privacidad_, 17-01-2013. Décimo, Vigésimo, Vigésimo Cuarto,
   Vigésimo Sexto, Trigésimo Primero, Trigésimo Cuarto y Trigésimo Octavo.
   https://dof.gob.mx/nota_detalle.php?codigo=5284966&fecha=17%2F01%2F2013
5. ✓ Secundaria. BASHAM (Athié Cervantes y otros), «Nueva LFPDPPP publicada en el DOF», 21-03-2025.
   https://basham.com.mx/en/nueva-ley-federal-de-proteccion-de-datos-personales-en-posesion-de-los-particulares-publicada-en-el-diario-oficial-de-la-federacion/
6. ✓ Secundaria. Garrigues, «México: la nueva LFPDPPP…», 27-03-2025.
   https://www.garrigues.com/es_ES/noticia/mexico-nueva-ley-federal-proteccion-datos-personales-posesion-particulares-introduce
7. ✓ Secundaria (no es despacho). Sharkit, «Nueva LFPDPPP: reglamento pendiente», 09-07-2026.
   https://sharkit.mx/nueva-lfpdppp-reglamento-pendiente/
8. ✓ Secundaria. Infobae, «La Secretaría Anticorrupción arranca proceso para actualizar la ley de
   protección de datos personales», 29-01-2026.
   https://www.infobae.com/mexico/2026/01/29/la-secretaria-anticorrupcion-arranca-proceso-para-actualizar-la-ley-de-proteccion-de-datos-personales-en-mexico/
9. ✓ Secundaria. Mijares, Angoitia, Cortés y Fuentes, «La SABG inicia diálogo para la actualización
   del marco de protección de datos personales», 03-02-2026.
   https://www.mijares.mx/en/noticias/la-secretaria-anticorrupcion-y-buen-gobierno-inicia-dialogo-para-la-actualizacion-del-marco-de-proteccion-de-datos-personales
10. ✓ Oficial. INEGI, Comunicado de prensa 1/26, _UMA 2026_ (diario $117.31, vigente desde el
    01-02-2026), 08-01-2026. https://www.inegi.org.mx/contenidos/saladeprensa/boletines/2026/uma/uma2026.pdf

**Consumidor y comercio electrónico**

11. ✓ Texto oficial. Cámara de Diputados, _Ley Federal de Protección al Consumidor_, última reforma DOF
    12-12-2025. Arts. 1, 2, 7 BIS, 16–18 BIS, 32, 51–56, 76 BIS, 76 BIS 1, 77, 85, 86, 90, 99 y 128.
    https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPC.pdf
12. ✓ Texto oficial. Secretaría de Economía, _NMX-COE-001-SCFI-2018, Comercio electrónico_. La
    declaratoria de vigencia se publicó en el DOF el 30-04-2019 (dato citado en [13]).
    http://www.economia-nmx.gob.mx/normas/nmx/2010/NMX-COE-001-SCFI-2018.pdf
13. ✓ Oficial. PROFECO, _Acuerdo por el que se emite el Código de Ética en materia de Comercio
    Electrónico_, DOF 26-02-2021.
    https://www.gob.mx/cms/uploads/attachment/file/621262/Acuerdo_por_el_que_se_emite_el_Codigo_de_Etica_en_materia_de_Comercio_Electronico.pdf
14. ✓ Oficial. PROFECO, «Profeco emite Guía de Publicidad para Influencers», 2023.
    https://www.gob.mx/profeco/prensa/profeco-emite-guia-de-publicidad-para-influencers
15. ✓ Oficial. PROFECO, «Concilianet: el módulo virtual de Profeco…», 08-02-2026.
    https://www.gob.mx/profeco/prensa/conclilianet-el-modulo-virtual-de-profeco-para-resolver-controversias-entre-proveedores-y-personas-consumidoras

**Propiedad intelectual**

16. ✓ Texto oficial. Cámara de Diputados, _Ley Federal de Protección a la Propiedad Industrial_ (DOF
    01-07-2020), última reforma DOF 03-04-2026. Arts. 344, 345, 386–388 y 402.
    https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPPI.pdf
17. ✓ Texto oficial. Cámara de Diputados, _Ley Federal del Derecho de Autor_, última reforma DOF
    14-05-2026. Arts. 87, 114 Septies y 114 Octies.
    https://www.diputados.gob.mx/LeyesBiblio/pdf/LFDA.pdf
18. ✓ Secundaria. Nexos, _El juego de la Corte_ (L. Maldonado y P. Ruiz), «La Suprema Corte y los
    derechos de autor…», 06-06-2024 (AI 217/2020 y 249/2020, resuelta el 03-06-2024).
    https://eljuegodelacorte.nexos.com.mx/la-suprema-corte-y-los-derechos-de-autor-un-retroceso-en-la-proteccion-de-derechos-digitales/
19. ✓ Secundaria. Expansión, «Obras hechas con IA no tienen derecho de autor, determina la SCJN»,
    16-07-2025 (AD 6/2025, Segunda Sala, 14-07-2025).
    https://expansion.mx/tecnologia/2025/07/16/obras-hechas-con-ia-no-tienen-derecho-de-autor-scjn

**Fiscal**

20. ✓ Texto oficial. Cámara de Diputados, _Ley del IVA_, última reforma DOF 12-11-2021. Arts. 1o.-A
    BIS, 18-B y 18-J a 18-M. https://www.diputados.gob.mx/LeyesBiblio/pdf/LIVA.pdf
21. ✓ Texto oficial. Cámara de Diputados, _Ley del ISR_, última reforma DOF 01-04-2024. Arts. 113-A a
    113-D. https://www.diputados.gob.mx/LeyesBiblio/pdf/LISR.pdf
22. ✓ Texto oficial. Cámara de Diputados, _Ley de Ingresos de la Federación 2026_, DOF 07-11-2025.
    Art. 25 fr. VI y IX. https://www.diputados.gob.mx/LeyesBiblio/pdf/LIF_2026.pdf
23. ✓ Texto oficial. Cámara de Diputados, _Código Fiscal de la Federación_, última reforma DOF
    09-04-2026. Art. 30 y art. 30-B (adicionado DOF 07-11-2025; vigente desde el 01-04-2026 según el
    Transitorio Primero de ese decreto). https://www.diputados.gob.mx/LeyesBiblio/pdf/CFF.pdf
24. ✓ Secundaria. BASHAM, «Principales modificaciones a la RMF para 2026», 02-01-2026 (RMF DOF
    28-12-2025; reglas 2.9.21, 12.2.7 y 12.2.12).
    https://basham.com.mx/en/principales-modificaciones-a-la-rmf-para-2026/
25. ✓ Secundaria. BASHAM, «Plataformas digitales», 22-01-2026.
    https://basham.com.mx/en/plataformas-digitales/
26. ✓ Secundaria. ContadorMx, «Criterio Normativo Fiscal 40/IVA/N»; Sovos, «El SAT amplía la
    definición de servicio digital de intermediación», 15-10-2024.
    https://contadormx.com/criterio-normativo-fiscal-40-iva-n-servicios-digitales/ ·
    https://sovos.com/mx/cambios-regulatorios/iva/el-sat-amplia-la-definicion-de-servicio-digital-de-intermediacion/

**Contratos electrónicos**

27. ✓ Texto oficial. Cámara de Diputados, _Código de Comercio_, última reforma DOF 14-11-2025. Arts.
    49, 80, 89, 89 bis, 93, 93 bis, 1205 y 1298-A.
    https://www.diputados.gob.mx/LeyesBiblio/pdf/CCom.pdf
28. ✓ Texto oficial. Cámara de Diputados, _Código Civil Federal_, última reforma DOF 14-11-2025. Arts.
    450, 646, 647, 1803, 1811, 1834 bis, 1916 y 1916 Bis.
    https://www.diputados.gob.mx/LeyesBiblio/pdf/CCF.pdf
29. ✓ Oficial. DOF, _NOM-151-SCFI-2016, Requisitos que deben observarse para la conservación de
    mensajes de datos y digitalización de documentos_, 30-03-2017.
    https://dof.gob.mx/nota_detalle.php?codigo=5478024&fecha=30/03/2017

**Moderación**

30. ✓ Texto oficial. Cámara de Diputados, _Ley General de Acceso de las Mujeres a una Vida Libre de
    Violencias_, última reforma DOF 15-01-2026. Art. 20 Sexies.
    https://www.diputados.gob.mx/LeyesBiblio/pdf/LGAMVLV.pdf
31. ✓ Secundaria. IDC Online (J. Cruz), «Nueva Ley de Telecomunicaciones y Radiodifusión: claves»,
    24-07-2025. https://idconline.mx/corporativo/2025/07/24/nueva-ley-de-telecomunicaciones-y-radiodifusion-claves
32. ✓ Secundaria. Cadena Política, «Regulación de la inteligencia artificial en México 2026: leyes
    sectoriales», 23-07-2026.
    https://cadenapolitica.com/2026/07/23/regulacion-de-la-inteligencia-artificial-en-mexico-2026-leyes-sectoriales/

**Proveedor de IA (OpenRouter)**

33. ✓ OpenRouter, _Terms of Service_ (act. 31-08-2026): DPA para uso comercial, 18 años, ley de Nueva
    York. https://openrouter.ai/terms
34. ✓ OpenRouter, _Data Processing Agreement_ (act. 26-08-2026).
    https://openrouter.ai/data-processing-agreement · subencargados:
    https://openrouter.ai/authorized-sub-processors (no leída)
35. ✓ OpenRouter, _Privacy Policy_ (act. 31-08-2026). https://openrouter.ai/privacy
36. ✓ OpenRouter, _Provider selection_ (`data_collection`, `zdr`) y _Privacy and logging_.
    https://openrouter.ai/docs/guides/routing/provider-selection ·
    https://openrouter.ai/docs/features/privacy-and-logging

**Documentos internos usados:**

- `docs/decisions.md` (ADR-030 a ADR-038);
- `docs/plan-90-dias.md` §7.1–7.2;
- `docs/security/auditoria-2026-09-26.md` (SEC-26, SEC-29, SEC-34);
- `docs/product-principles.md` (P12, P14);
- `src/app/(legal)/privacidad/page.tsx` y `src/app/(legal)/terminos/page.tsx`;
- el código citado en la sección 1.

**Corrección a `plan-90-dias.md` §7.1:**

- la fuente [32] de ese plan decía que el CFF 30-B solo tenía fuentes secundarias. Ya lo leímos en el
  texto oficial [23]: adicionado DOF 07-11-2025 y **vigente desde el 01-04-2026**;
- la referencia al «LFPDPPP art. 3 fr. XX» del plan corresponde en la ley vigente al **art. 2
  fr. XX** [1].
