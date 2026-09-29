# Términos y condiciones, Reglas de la comunidad y Política para vendedores (borrador)

> **BORRADOR PARA REVISIÓN LEGAL. NO ES ASESORÍA LEGAL NI FISCAL Y NO SE DEBE PUBLICAR ASÍ.** Un
> abogado mexicano debe revisarlo (y la parte fiscal, un contador) antes de publicarlo. Lo escribimos
> el 2026-09-26 con el marco de `00-marco-legal-2026.md` y con fuentes nuevas que leímos ese mismo
> día.
>
> - **Cómo leerlo.** El texto normal es lo que vería la persona usuaria. Los recuadros **«Fundamento
>   y notas»** son para el abogado y el equipo, y se quitan al publicar.
> - **Citas.** `[n]` remite a la sección F. Los números [1]–[36] son los mismos de
>   `00-marco-legal-2026.md` §11; [37]–[48] son fuentes nuevas de este documento.
> - **Marcas de revisión.** **[VERIFICAR CON ABOGADO]** = interpretación nuestra o punto donde la ley
>   no es clara. **[VERIFICAR CON CONTADOR]** = tema fiscal. **[DECISIÓN DEL FUNDADOR]** = regla de
>   política que la ley no impone; la proponemos y se puede cambiar.
> - **Datos que faltan** (se quedan visibles hasta tenerlos): [NOMBRE O RAZÓN SOCIAL DEL
>   RESPONSABLE], [RFC], [DOMICILIO PARA OÍR Y RECIBIR NOTIFICACIONES], [CORREO DE PRIVACIDAD],
>   [CORREO DE SOPORTE], [FECHA DE ÚLTIMA ACTUALIZACIÓN]. Agregamos tres que pide la ley o la NMX y
>   no estaban en la lista: [TELÉFONO DE ATENCIÓN] (LFPC art. 76 BIS fr. III pide «números
>   telefónicos» [11]), [HORARIO DE ATENCIÓN] (NMX 5.2.1.7 [12]) y [URL DEL FORMULARIO DE AVISOS].
> - **Nombre.** «VendeIA» es provisional (ADR-014) y la búsqueda en el IMPI está pendiente (ADR-033
>   #16).

---

## 0. Antes de publicar: lo que el texto promete y el producto aún no hace

Revisamos el código el 2026-09-26. Estos textos describen cómo **debe** funcionar la plataforma al
abrir al público. Donde el código todavía no lo hace, hay que construirlo o cambiar el texto.
Publicar una promesa que el producto no cumple sería publicidad engañosa [11, art. 32].

| #   | El texto dice                                                                                           | Hoy en el código                                                                                                                                  | Qué hacer                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Solo personas de 18 años o más (A4)                                                                     | No hay casilla ni control de edad (`identity/components/sign-up-form.tsx`)                                                                        | Casilla obligatoria **sin marcar** «Tengo 18 años o más», guardada como consentimiento con versión; «Vender» bloqueado sin ella                                 |
| 2   | Los términos se aceptan **aparte** del aviso de privacidad (A3)                                         | Una sola casilla: «Acepto los términos y el aviso de privacidad»                                                                                  | La NMX pide que la aceptación de los términos sea distinta de la del tratamiento de datos [12, 5.2.2]. Dos casillas, o casilla de términos + aviso simplificado |
| 3   | La Política para vendedores se acepta al activar «Vender» (C1)                                          | `activateSellerAction` no registra ninguna aceptación                                                                                             | Nuevo `ConsentType` (p. ej. `SELLER_POLICY`) con versión en `LEGAL_VERSIONS`                                                                                    |
| 4   | Compra con **pago directo** a quien vende (A6)                                                          | El checkout usa una pasarela simulada que en producción falla cerrada (ADR-032); no existe el estado «Esperando pago al vendedor» (plan §7.2, B1) | Construir B1 antes de abrir, o apagar el checkout y cambiar A6                                                                                                  |
| 5   | Garantía: «Sin garantía» o **90 días o más** (C6)                                                       | El formulario acepta de 1 a 3,650 días (`catalog/schemas.ts`)                                                                                     | Tr0 del plan: solo «Sin garantía» o ≥ 90 días, con prueba                                                                                                       |
| 6   | Revocación de 5 días hábiles en compras a distancia, con excepciones (A8, C6)                           | `returnWindowDays` acepta 0                                                                                                                       | Decidir con el abogado (ver V-6 y V-7). Si aplica: mínimo 5 días hábiles salvo las excepciones, y mostrar la excepción en la ficha                              |
| 7   | Canal de quejas gratuito con plazos (A9)                                                                | No existe «Tengo un problema»; solo el botón «Reportar»                                                                                           | Correo + formulario ligado al pedido; registro de quejas con fecha y plazo                                                                                      |
| 8   | Se avisa a quien publicó el motivo de una acción de moderación, y puede pedir revisión (A14)            | El vendedor ve «Oculto por moderación» sin motivo ni botón de revisión; no hay notificaciones                                                     | Motivo visible en Studio + «Pedir revisión». La LFDA exige avisar al retirar de buena fe [17, art. 114 Octies fr. II b)]                                        |
| 9   | Revisión humana de la leyenda de riesgo de autenticidad (A16)                                           | No hay botón                                                                                                                                      | «¿Crees que es un error? Pedir revisión» (00 §2.9)                                                                                                              |
| 10  | Canal formal para titulares de marcas y derechos de autor, con aviso y contra-aviso (A15, anexos 1 y 2) | Solo el botón «Reportar»                                                                                                                          | Formulario o correo, registro de avisos y contra-avisos con fechas (para contar los 15 días hábiles)                                                            |
| 11  | Cerrar la cuenta (A21)                                                                                  | No existe borrar cuenta ni exportar datos (SEC-26)                                                                                                | Procedimiento manual por correo mientras se construye                                                                                                           |
| 12  | El comprador ve los datos de contacto del vendedor en su pedido (A6, C9)                                | Pendiente (plan §7.1)                                                                                                                             | Mostrarlos en la confirmación del pedido, con consentimiento del vendedor                                                                                       |
| 13  | Transferencia solo con vendedores con teléfono verificado (C7)                                          | Pendiente (plan §7.2)                                                                                                                             | Verificación de teléfono                                                                                                                                        |
| 14  | Artículos prohibidos (C4)                                                                               | `ai/content-policy.ts` solo frena a la IA (réplicas, armas, drogas, receta, vapeadores); lo publicado a mano no se filtra                         | Filtro al publicar que mande a **revisión** (no que sancione) al menos: vapeadores, tabaco, armas, medicamentos, animales vivos, alcohol                        |
| 15  | Política de reincidentes (A15, C14)                                                                     | No se cuentan infracciones por cuenta                                                                                                             | Registrar infracciones confirmadas con fecha y tipo                                                                                                             |
| 16  | Sanciones a cualquier cuenta (A14)                                                                      | Solo existe `SellerProfile.status` (ADR-035, pendiente)                                                                                           | Estado de cuenta (activa, limitada, suspendida)                                                                                                                 |
| 17  | Calificaciones y opiniones de compradores                                                               | No existen                                                                                                                                        | La NMX las pide [12, 5.3.3]. Decidir si entran antes de abrir **[VERIFICAR CON ABOGADO]**                                                                       |
| 18  | Personalización opcional, **sin marcar** por omisión (A12)                                              | Casilla premarcada (`defaultChecked`; `personalizationEnabled @default(true)`)                                                                    | Desmarcar (00 §2.5)                                                                                                                                             |
| 19  | Consentimiento expreso al subir comprobantes (C11)                                                      | No hay casilla                                                                                                                                    | Casilla sin marcar al subir (00 §2.3) **[VERIFICAR CON ABOGADO]**                                                                                               |
| 20  | Retiramos CLABE e instrucciones de depósito de comentarios y publicaciones (C7)                         | Solo hay filtros de CLABE para la IA; nada en `social/` ni `catalog/`                                                                             | Filtro al publicar y comentar (el plan §7.2 lo da por existente)                                                                                                |

---

## Parte A. Términos y condiciones de uso

**Versión:** [FECHA DE ÚLTIMA ACTUALIZACIÓN] · Borrador para revisión legal

### A1. Quiénes somos y cómo contactarnos

VendeIA (nombre provisional) es una plataforma que opera [NOMBRE O RAZÓN SOCIAL DEL RESPONSABLE]
(«VendeIA» o «nosotros»), con RFC [RFC] y domicilio en [DOMICILIO PARA OÍR Y RECIBIR
NOTIFICACIONES], México.

- **Soporte, quejas y aclaraciones:** [CORREO DE SOPORTE] · [TELÉFONO DE ATENCIÓN] ·
  [HORARIO DE ATENCIÓN].
- **Privacidad y derechos de acceso, rectificación, cancelación y oposición:** [CORREO DE
  PRIVACIDAD].
- **Avisos de titulares de marcas y derechos de autor:** [URL DEL FORMULARIO DE AVISOS] o
  [CORREO DE SOPORTE] con el asunto «Aviso de derechos».

Todos estos canales son gratuitos.

> **Fundamento y notas.** Identificación del proveedor intermediario: nombre comercial, razón
> social, domicilio físico en México, RFC, teléfono u otros medios y correo [12, 5.2.1.1]. Domicilio
> y teléfonos antes de la transacción [11, art. 76 BIS fr. III]. Mecanismos de reclamación sin costo
> y con domicilio y teléfono [12, 10.1 y 10.2].

### A2. Qué es VendeIA y qué no es

- VendeIA es una red social de comunidades donde pequeños vendedores también tienen su tienda. El
  piloto se hace en la Ciudad de México.
- VendeIA pone en contacto a quien compra con quien vende. **No vende** los productos de las
  tiendas: no es su dueña, no los fabrica, no los guarda ni los envía, y no revisa cada producto
  antes de que se publique.
- **Durante el piloto, VendeIA no cobra ni recibe pagos.** Pagas directamente a quien vende (ver
  A6). Tampoco cobramos comisiones ni cuotas: ni a quien compra ni a quien vende (comisión 0 %). Si
  algún día cobramos algo, te avisaremos antes y te pediremos aceptarlo (ver A20).
- Las cuentas editoriales de VendeIA y el contenido que publicamos para arrancar las comunidades se
  identifican como tales.

> **Fundamento y notas.** La NMX llama «proveedor intermediario» a quien opera el sistema que pone
> en contacto a terceros proveedores con consumidores, «pudiendo facilitar» el pago o la entrega
> [12, 3.12 y 3.16]. VendeIA encaja aunque no cobre (00 §3.1). Pago directo y comisión 0 %: ADR-033
> #4. Contenido honesto y cuentas editoriales identificadas: principio 5 de
> `product-principles.md`.

### A3. Aceptación y documentos que forman este contrato

- Estos términos, las **Reglas de la comunidad** (Parte B) y, si vendes, la **Política para
  vendedores** (Parte C) forman un solo contrato entre tú y VendeIA.
- El **aviso de privacidad** es un documento aparte: explica qué datos tratamos y para qué.
- Aceptas estos términos al marcar la casilla correspondiente cuando creas tu cuenta. Guardamos qué
  versión aceptaste y cuándo. Si no estás de acuerdo, no uses VendeIA.
- Puedes consultar en todo momento la versión vigente y las anteriores en `/terminos`.

> **Fundamento y notas.** El contrato electrónico se perfecciona al recibirse la aceptación [27,
> arts. 80 y 89 bis; 28, arts. 1803 y 1811]. La aceptación de los términos debe ser **distinta** de
> la que se pida para tratar datos personales [12, 5.2.2] (ver §0 #2). Mecanismos de aceptación y de
> prueba de la transacción [11, art. 76 BIS 1 fr. III y IV]. Para la prueba conviene guardar el
> **texto exacto** (o su hash) de cada versión y no editar una versión ya aceptada (00 §6). Hoy no
> existe la página de versiones anteriores **[DECISIÓN DEL FUNDADOR]**.

### A4. Edad mínima: 18 años

- Para crear una cuenta, comprar o vender debes tener **18 años cumplidos**. Al registrarte lo
  declaras.
- Si sabemos que una cuenta es de una persona menor de edad, la cerramos. Madres, padres o tutores
  pueden avisarnos a [CORREO DE SOPORTE].
- VendeIA no permite contenido sexual ni productos para adultos (ver Parte B y C4).

> **Fundamento y notas.** La mayoría de edad empieza a los 18 años y los menores tienen incapacidad
> legal [28, arts. 646 y 450 fr. I]. Advertir cuando la información no sea apta para población
> vulnerable [11, art. 76 BIS fr. VII]. La NMX pide informar las restricciones de edad y, en giros
> para mayores de edad, mecanismos para impedir o advertir el acceso de menores [12, 5.2.1.9].
> OpenRouter exige 18 años [33]. **[VERIFICAR CON ABOGADO]:** si basta la declaración o hace falta
> otra verificación (00 §10, pregunta 12). Hoy no hay casilla (§0 #1).

### A5. Tu cuenta y la seguridad

- Usa datos verdaderos. Una cuenta es de una sola persona y no se presta ni se vende.
- No te hagas pasar por otra persona, por una marca ni por VendeIA. Una tienda no puede llamarse
  «VendeIA», «Soporte», «Oficial» ni nada que confunda con nuestro equipo.
- Cuida tu contraseña y no la compartas. Si crees que alguien entró a tu cuenta, cámbiala, usa
  «Cerrar sesión en todos los dispositivos» en Ajustes y escríbenos.
- **Cómo protegemos tu información:** conexión cifrada (HTTPS), contraseñas guardadas con un cifrado
  de un solo sentido (nunca en texto legible), límites de intentos para frenar ataques, y fotos a las
  que les quitamos los metadatos, incluida la ubicación GPS. No guardamos datos de tarjetas porque no
  procesamos pagos.

> **Fundamento y notas.** Informar las características generales de la seguridad antes de la
> transacción [11, art. 76 BIS fr. II; 12, 5.2.1.11]. Hechos del código: sesión de 30 días
> (`server/auth.ts`), HSTS (`next.config.ts`), cierre de sesiones (SEC-10), nombres reservados
> (SEC-18), fotos sin EXIF (`media/image-processing.ts`). La verificación de correo está apagada hasta
> tener proveedor de correo (00 §1).

### A6. Cómo se compra en el piloto: pagas directamente a quien vende

**Así funciona:**

1. En cada producto ves su precio total, existencias, formas de entrega con su costo y tiempo,
   garantía, devoluciones y los métodos de pago que acepta quien vende.
2. Haces tu pedido en VendeIA. Quien vende ve tu nombre visible y lo que pediste. El lugar, la hora
   y, si hace falta, el domicilio de entrega los acuerdas directamente con quien vende: compártelos
   solo con esa persona y solo para ese pedido. Tú ves en tu pedido los datos de contacto de quien
   vende.
3. **Pagas directamente a quien vende** con el método que acordaron: efectivo al recoger o contra
   entrega, o transferencia a la cuenta que aparece **dentro de tu pedido**, entre otros. VendeIA no
   recibe, no guarda y no puede devolver ese dinero.
4. Quien vende entrega el producto y los dos confirman el pedido en VendeIA.

**Lo que significa pagar directo.** El contrato de compraventa es entre tú y quien vende. VendeIA no
ofrece protección de pago ni reembolsos, porque el dinero nunca pasa por nosotros. Si algo sale mal,
sí podemos ayudarte (ver A9): pedirle explicaciones a quien vende, ocultar sus productos, suspender
su tienda y entregar información a las autoridades cuando la ley lo pida.

**Consejos para comprar seguro:**

- Paga **solo** con los datos que aparecen dentro de tu pedido en VendeIA. Nunca con datos que te
  lleguen por comentarios, por otra app o por teléfono.
- En tus primeras compras con una tienda, prefiere pagar contra entrega o al recoger, después de
  revisar el producto.
- Si recoges en persona: en un lugar público y concurrido, de día y, si puedes, acompañado.
- Evita anticipos grandes. Con tiendas nuevas te recomendamos no pasar de **$3,000 MXN** por pedido.
- Desconfía de precios muy por debajo de lo normal, de la prisa («solo hoy», «último») y de palabras
  como «réplica», «AAA» o «1:1».
- Nadie de VendeIA te pedirá tu contraseña, códigos de verificación ni el NIP de tu tarjeta.
- Guarda tu comprobante de pago y la información del pedido.
- Si algo te parece raro, usa «Reportar».

> **Fundamento y notas.** Pago directo por terceros o en persona: decisión del fundador (ADR-033
> #4). Tope recomendado de $3,000: ADR-033 #15 **[DECISIÓN DEL FUNDADOR]**. Regla «Paga solo con los
> datos de tu pedido»: plan §7.2. Confidencialidad: los datos del consumidor no se pasan a
> proveedores ajenos a la transacción [11, art. 76 BIS fr. I]. Datos del proveedor antes de la
> transacción [11, art. 76 BIS fr. III]. Compartir los datos del comprador con el vendedor es una
> **transferencia** [1, arts. 35 y 36]: va con su cláusula en el aviso de privacidad **[VERIFICAR
> CON ABOGADO]** qué excepción aplica (00 §2.7). **Hoy no existe el flujo B1** (§0 #4). En el
> código, el vendedor ve el nombre visible del comprador y lo pedido; el domicilio solo sale del
> servidor con un pago **real** a través de VendeIA, mientras el pedido está pagado, enviado o
> entregado, y **el teléfono nunca se comparte** (`commerce/seller-order-dto.ts`). Con pago directo
> el domicilio no se comparte por la plataforma. El texto coincide con `01-aviso-de-privacidad.md`
> §8.2. El brief y 00 §2.7 mencionan domicilio y teléfono: si B1 los muestra dentro del pedido,
> cambiar este paso, C8 y el aviso de privacidad **antes** **[DECISIÓN DEL FUNDADOR]**.

### A7. Qué responde cada quien

| Tema                                                            | Quién responde                                                                                                |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Que el producto sea como se anuncia (datos, fotos, condición)   | **Quien vende.** VendeIA muestra los datos como los capturó quien vende y retira lo que incumpla estas reglas |
| Precio, existencias, entrega y calidad                          | Quien vende                                                                                                   |
| Garantía, devoluciones, cambios y reclamaciones por el producto | Quien vende, en los términos de la ley (ver A8 y C6)                                                          |
| Cobro y pago                                                    | Quien compra y quien vende. VendeIA no interviene en el dinero                                                |
| Comprobantes fiscales e impuestos de la venta                   | Quien vende (ver C10)                                                                                         |
| Uso de los datos del comprador que recibe quien vende           | Quien vende, y solo para entregar ese pedido. VendeIA comparte solo lo necesario                              |
| Funcionamiento, seguridad y confidencialidad de la plataforma   | VendeIA                                                                                                       |
| Canal de quejas gratuito, moderación y sanciones                | VendeIA                                                                                                       |
| Atender órdenes de autoridad                                    | VendeIA                                                                                                       |
| Identificarse                                                   | VendeIA en A1; quien vende, con sus datos de contacto dentro del pedido                                       |
| Pagar lo acordado, dar datos correctos y recibir el pedido      | Quien compra                                                                                                  |

Nada de lo anterior limita los derechos que te da la Ley Federal de Protección al Consumidor ni la
responsabilidad que la ley no permite excluir (ver A19).

> **Fundamento y notas.** Los términos deben incluir y delimitar las obligaciones y
> responsabilidades del intermediario y del tercero proveedor [12, 4.4 y 5.1.7], y pedir al tercero
> proveedor que cumpla las reglas de información del producto [12, 5.3.6]. No valen las cláusulas
> que liberan al proveedor de su responsabilidad civil o la trasladan a un tercero [11, art. 90
> fr. II y III]. **[VERIFICAR CON ABOGADO]:** cómo se reparte la responsabilidad frente al vendedor
> ocasional y si la PROFECO podría considerar responsable a VendeIA (00 §10, pregunta 7).

### A8. Tus derechos como consumidor

Cuando compras a una tienda que vende de forma habitual, tienes estos derechos frente a ella:

- **Precio total visible**, con impuestos, comisiones y cualquier cargo adicional [11, art. 7 BIS].
- **Información completa** de términos, condiciones, costos y formas de pago [11, art. 76 BIS
  fr. V].
- **Garantía:** si la tienda ofrece garantía, no puede ser menor a **90 días** desde la entrega
  [11, art. 77], y debe darte una póliza por escrito con su alcance, duración, condiciones y
  domicilio para reclamar [11, art. 78].
- **Revocar la compra en 5 días hábiles:** en compras fuera del establecimiento de la tienda (como
  las que se hacen a distancia), la compra se perfecciona a los 5 días hábiles desde que recibes el
  producto. En ese plazo puedes revocarla sin responsabilidad; la tienda te devuelve el precio y tú
  pagas el flete y el seguro de la devolución [11, art. 56]. **No aplica** a productos perecederos
  que recibiste y pagaste de contado [11, art. 51]. Según la NMX, tampoco a lo que ya usaste o
  consumiste, a lo que no conserva su estado original (con accesorios y empaque) ni a lo hecho a la
  medida, siempre que la tienda te lo haya informado antes [12, 5.2.1.4]. En servicios, no aplica si
  el servicio está programado a 10 días hábiles o menos de tu pedido [11, art. 56].
- **Si el producto no es lo que se ofreció** (calidad, marca o especificaciones) o no cumple una
  norma oficial: puedes elegir que te lo repongan o que te devuelvan lo que pagaste, y además tienes
  derecho a una bonificación de **al menos el 20 %** del precio [11, arts. 92 fr. II y 92 TER].
  Reclama dentro de los **2 meses** siguientes a recibirlo; la tienda debe resolver en un plazo de
  hasta **15 días** [11, art. 93].
- **Defectos o vicios ocultos** que hagan el producto impropio para su uso: puedes pedir la
  restitución, la rescisión o una reducción del precio, más la bonificación [11, art. 82].
- **No recibir publicidad** si así lo decides [11, art. 76 BIS fr. VI].
- **Acudir a la PROFECO** en cualquier momento (ver A23).

Si la persona que te vendió no vende de forma habitual (por ejemplo, vendió algo suyo una sola vez),
quizá no se le aplique la ley del consumidor, pero sigue respondiendo por los defectos ocultos del
producto conforme a la ley civil.

> **Fundamento y notas.** «Proveedor» es quien ofrece o vende bienes de forma habitual o periódica
> [11, art. 2 fr. II]; el vendedor ocasional podría no serlo **[VERIFICAR CON ABOGADO]**. Para el
> ocasional: saneamiento por defectos ocultos [28, art. 2142], con acciones que se extinguen a los 6
> meses de la entrega [28, art. 2149]; en la CDMX podría aplicar el Código Civil local **[VERIFICAR
> CON ABOGADO]**. **[VERIFICAR CON ABOGADO]:** si la venta por plataforma es «venta fuera del
> establecimiento» (arts. 51–56) y cómo aplica a la entrega o recolección en persona; la NMX pide
> informar la revocación de 5 días hábiles en todo caso [12, 5.2.1.4]. La NMX también pide informar
> la reposición, devolución y bonificación [12, 5.2.1.14].

### A9. Problemas con un pedido, quejas y aclaraciones

1. **Habla primero con quien vende**, con los datos de contacto de tu pedido.
2. **Si no se resuelve, escríbenos** a [CORREO DE SOPORTE] (o desde «Tengo un problema» en tu
   pedido, cuando exista) con el número de pedido, qué pasó y las pruebas que tengas (fotos,
   comprobante de pago, mensajes). Es gratis.
3. **Te respondemos** que recibimos tu queja en un máximo de 1 día hábil y te damos una respuesta en
   un máximo de 10 días hábiles. Horario de atención: [HORARIO DE ATENCIÓN].
4. **Qué podemos hacer:** pedirle a quien vende que responda, proponer una solución, ocultar sus
   productos, suspender su tienda y entregar información a una autoridad cuando la ley lo pida.
   **Qué no podemos hacer:** devolverte dinero que nunca recibimos ni obligar a quien vende a
   reembolsarte.
5. En cualquier momento puedes presentar una queja ante la **PROFECO** (ver A23), sin tener que
   esperar nuestra respuesta.

> **Fundamento y notas.** Mecanismos gratuitos de dudas, reclamaciones y aclaraciones, resueltos
> según los términos, con posibles medios alternativos [12, 10.1–10.4]. La NMX pide informar días y
> horarios de atención y el plazo de resolución [12, 5.2.1.7]. Los plazos de 1 y 10 días hábiles son
> propuesta **[DECISIÓN DEL FUNDADOR]**; ADR-033 #14 prevé revisión del fundador en 24 h hábiles.
> Quejas ante la PROFECO por escrito, teléfono o en línea [11, art. 99]. Concilianet exige convenio
> y acta constitutiva; se evalúa cuando exista la sociedad [15].

### A10. Tu contenido y el permiso que nos das para mostrarlo

- **Lo que publicas es tuyo:** fotos, textos, comentarios, productos y tu perfil.
- **Permiso (licencia) para VendeIA:** al publicar, nos das un permiso **no exclusivo y gratuito**
  para guardar, mostrar y distribuir tu contenido **dentro de VendeIA**, y para adaptarlo en lo
  técnico (recortar, comprimir o cambiar el formato de las fotos). Como VendeIA se puede ver desde
  cualquier lugar con internet, el permiso no tiene límite territorial. Dura mientras tu contenido
  esté publicado, más el tiempo necesario para borrarlo de nuestros respaldos y para conservar lo
  que la ley o una investigación nos obliguen a guardar.
- **Fuera de VendeIA** (por ejemplo, en nuestras redes sociales) solo usaremos tu contenido con tu
  permiso.
- **No vendemos tu contenido** ni lo usamos para entrenar modelos de inteligencia artificial. Si
  algún día quisiéramos usar textos reales para evaluar modelos, te pediremos permiso y quitaremos
  los datos personales.
- **Solo publica lo que tienes derecho a publicar.** Toma tus propias fotos. No uses fotos del
  catálogo de una marca ni de otra tienda sin permiso, ni la imagen de otra persona sin su
  autorización.
- Tu perfil, tus publicaciones, tus comentarios y tus productos son públicos: cualquiera puede
  verlos, también sin cuenta, y los buscadores de internet pueden indexarlos.

> **Fundamento y notas.** Licencia no exclusiva del usuario para alojar, mostrar y adaptar: 00 §4.2
> **[VERIFICAR CON ABOGADO]** (redacción, duración y si hace falta un permiso separado para usos
> promocionales). Uso de la imagen o la voz de artistas, incluidos resultados de IA, con
> consentimiento expreso [17, art. 87]. No entrenar y pedir permiso para evaluaciones: aviso de
> privacidad vigente (`privacidad/page.tsx`) y plan §7.1. Lo público coincide con «Lo que es
> público» del aviso vigente; ADR-033 #17 no prevé indexación en los primeros 90 días, pero el texto
> cubre el caso en que se active.

### A11. Inteligencia artificial: la IA sugiere, tú decides

VendeIA tiene herramientas que usan inteligencia artificial (IA):

- **«Vende con IA»:** a partir de lo que escribes, propone cómo publicar y vender un producto.
- **«Kit de anuncios»:** redacta textos para compartir tu producto, con sus datos públicos.
- **Revisión de autenticidad:** si la activamos, una señal de IA lee el texto público de un producto
  para sumar, con poco peso, al riesgo de imitación. Nunca decide sola (ver A16).

Reglas:

1. **La IA sugiere; tú decides.** Nada que escriba la IA se publica sin que lo revises. Lo que
   publicas es tu responsabilidad, aunque lo haya redactado la IA, así que revisa que sea verdad.
2. **Las cifras las calcula el código, no la IA.** El rango de precio de prueba y el presupuesto
   diario sugerido los calcula un programa con los datos que tú das (precio y costo). Son
   **estimaciones**, se muestran con sus supuestos y **no garantizan ventas** ni resultados.
3. **La IA no puede afirmar lo que no está en tus datos.** Garantía, envío, existencias, métodos de
   pago y autenticidad salen de los datos que capturaste. Si la IA escribe algo distinto, corrígelo
   antes de publicar.
4. **Todo lo que escribe la IA se marca** como «Creado con ayuda de IA» (o «Texto de ejemplo (IA
   simulada)» cuando no la escribió un modelo real).
5. **Derechos:** un texto hecho solo por la IA puede no estar protegido por derechos de autor, y otra
   persona podría recibir un texto parecido. No te garantizamos exclusividad sobre él.
6. **No escribas datos personales** (tuyos o de otras personas) en lo que le pides a la IA. Para
   generar los textos usamos un proveedor externo que puede procesarlos fuera de México; el aviso de
   privacidad dice cuál es y qué datos recibe.
7. **Límites:** las herramientas de IA tienen un número de usos por día y por mes, pueden no estar
   disponibles y no ayudan con artículos prohibidos.
8. **La IA nunca sanciona** a nadie: no oculta, no suspende y no decide sobre cuentas.

> **Fundamento y notas.** P2 («la IA redacta, el código calcula») y P4 (datos verificables),
> `product-principles.md`; `ai/proposal-numbers.ts` (el código reemplaza las cifras que devuelva el
> proveedor); guardián de la IA (ADR-031); etiquetas (ADR-038); cuotas de 30 al mes y 10 al día por
> vendedor (ADR-033 #6). Publicidad veraz [11, art. 32]. Lo generado exclusivamente por IA no se
> protege por derecho de autor (SCJN, AD 6/2025) [19] (secundaria). Proveedor de IA como encargado
> fuera de México: 00 §2.7.

### A12. Personalización, sugerencias y mejoras del producto

- Si **aceptas la personalización** (es opcional), ordenamos tu feed con lo que haces dentro de
  VendeIA. La puedes apagar en Ajustes cuando quieras.
- «**Aparecer en sugerencias**» decide si te sugerimos en «Gente de tus comunidades». También se
  apaga en Ajustes.
- Para mejorar VendeIA probamos cambios del producto con grupos de personas (pruebas A/B) y medimos
  con números agregados. Estas pruebas **nunca** deciden sanciones, precios, pagos ni comisiones
  sobre tu cuenta.
- Los detalles están en el aviso de privacidad.

> **Fundamento y notas.** ADR-030, ADR-033 (automejora fuera de pagos, precios, comisiones y gasto)
> y ADR-037. Consentimiento previo para perfilar [12, 5.4.1] y no premarcar casillas [4, Décimo
> fr. IV]: hoy está premarcada (§0 #18). Oposición a decisiones automatizadas [1, art. 26 fr. II].

### A13. Lo que no puedes hacer

No puedes usar VendeIA para:

- publicar o vender algo prohibido por la ley o por la **Política para vendedores** (C4);
- engañar, estafar o pedir pagos fuera de los datos del pedido;
- acosar, amenazar o discriminar, o publicar contenido que rompa las **Reglas de la comunidad**
  (Parte B);
- infringir marcas, derechos de autor o la imagen de otras personas;
- crear cuentas falsas, inflar interacciones o manipular reportes, reseñas o métricas;
- sacar datos de la plataforma con programas automáticos, atacar su seguridad o sobrecargarla;
- hacerte pasar por otra persona, por una marca o por VendeIA.

### A14. Moderación, sanciones y cómo pedir revisión

- **Cómo moderamos.** Combinamos reportes de la comunidad, reglas automáticas que miden riesgo y
  revisión de nuestro equipo. No revisamos todo antes de que se publique y no estamos obligados a
  vigilar todo lo que se sube, pero actuamos cuando sabemos de algo que incumple estas reglas o la
  ley.
- **Quién decide.** Toda acción sobre tu contenido o tu cuenta la toma **una persona del equipo**.
  Las reglas automáticas y la IA solo ordenan la cola de revisión y muestran leyendas de riesgo.
- **Qué podemos hacer**, según la gravedad: quitar una leyenda o un sello, cambiar un producto a
  «genérico», ocultar una publicación o un producto, limitar funciones, suspender tus ventas, y
  suspender o cerrar tu cuenta. Restauramos lo que hayamos ocultado por error.
- **Te avisamos** qué hicimos y por qué, salvo que una autoridad o la ley lo impidan o que avisar
  ponga en riesgo a alguien.
- **Pedir revisión.** Tienes **30 días naturales** para pedir que revisemos una decisión, en
  [CORREO DE SOPORTE] o con «Pedir revisión». Cuando sea posible, la revisa una persona distinta de
  quien decidió. Te respondemos en un máximo de **5 días hábiles**.
- **Casos graves** (armas, drogas, contenido sexual con menores, contenido íntimo sin
  consentimiento, amenazas, fraude): actuamos de inmediato y, cuando corresponda, avisamos a las
  autoridades.
- **Órdenes de autoridad.** Cumplimos las órdenes de autoridades competentes, por ejemplo:
  - del Ministerio Público o de un juez para interrumpir, bloquear o eliminar contenido de violencia
    digital; en ese caso te avisamos de inmediato que el contenido se inhabilitó por orden judicial;
  - del IMPI para suspender, bloquear o retirar contenido que infrinja derechos de propiedad
    industrial;
  - de retiro de contenido que infrinja derechos de autor.

  Cuando la ley lo exija, entregamos a la autoridad la información que tengamos para identificar a
  la persona que presuntamente cometió la infracción.

- **Registro.** Guardamos quién tomó cada acción, cuándo y qué cambió.
- **Reporta de buena fe.** Reportar en falso o en masa, por ejemplo contra un competidor, es una
  infracción a estas reglas.

> **Fundamento y notas.** Sin obligación de monitorear [17, art. 114 Octies fr. IV]. Aviso a quien
> se le retira contenido [17, art. 114 Octies fr. II b)]. Violencia digital: orden del MP o del juez
> y aviso inmediato al usuario [30, art. 20 Sexies]. IMPI a terceros, incluso de oficio [16, art. 344
> fr. VII]. Entregar información que identifique al presunto infractor en derechos de autor [17,
> art. 232 Quinquies fr. III]. Decisiones humanas y bitácora: ADR-035 y ADR-036. Plazos de 30 y 5
> días **[DECISIÓN DEL FUNDADOR]**. Hoy no hay aviso con motivo ni botón de revisión (§0 #8).
> **[VERIFICAR CON ABOGADO]:** cuánto conservar el historial de sanciones (72 meses para datos de
> incumplimientos contractuales [1, art. 10 párr. 3]).

### A15. Falsificaciones, marcas y derechos de autor

- **Está prohibido vender falsificaciones:** réplicas, imitaciones o artículos que usen una marca sin
  permiso de su titular, aunque se anuncien como «réplica», «AAA», «1:1», «tipo original» o
  «calidad espejo». Tampoco se permiten copias no autorizadas de libros, cursos, películas, música,
  software o videojuegos.
- **Si no es de la marca,** publícalo como «genérico» sin usar la marca como si fuera suya.
- **Aviso de titulares.** Si eres titular de una marca o de derechos de autor (o su representante)
  y crees que algo en VendeIA los infringe, mándanos un aviso con los datos del **anexo 1** por
  [URL DEL FORMULARIO DE AVISOS] o [CORREO DE SOPORTE].
- **Qué hacemos:** revisamos el aviso; si procede, retiramos o inhabilitamos el contenido **sin
  demora**, tomamos medidas razonables para que no se vuelva a subir y avisamos a quien lo publicó,
  con el motivo y la forma de responder. Confirmamos que recibimos el aviso en un máximo de 2 días
  hábiles.
- **Contra-aviso.** Si retiramos algo tuyo y crees que es un error, puedes mandar un contra-aviso con
  los datos del **anexo 2**. Se lo pasamos a quien mandó el aviso. En derechos de autor, volvemos a
  habilitar el contenido salvo que esa persona inicie un procedimiento judicial o administrativo,
  una denuncia penal o un mecanismo alterno de solución dentro de **15 días hábiles** desde que le
  informamos del contra-aviso. En marcas seguimos el mismo procedimiento.
- **Declarar en falso tiene consecuencias.** En derechos de autor, una declaración falsa en un aviso
  o contra-aviso se puede multar con 1,000 a 20,000 UMA, además de la responsabilidad por daños.
- **Reincidentes.** Cerramos las cuentas que infringen de forma reiterada (ver C14).
- **No certificamos autenticidad.** Ver A16.

> **Fundamento y notas.** Infracciones de marca: usar una marca sin consentimiento y ofrecer en
> venta productos con marcas alteradas [16, arts. 386 y 387]; multas [16, art. 388]; delito de
> falsificación [16, art. 402]. Piratería de obras: delito [41, art. 424 bis]. Puerto seguro de
> derechos de autor: retiro expedito, medidas contra la resubida, aviso al afectado, **política
> pública de terminación de cuentas de reincidentes**, contenido mínimo del aviso, contra-aviso y 15
> días hábiles [17, art. 114 Octies fr. II y III]. Multa por falsa declaración [17, art. 232
> Quinquies fr. I]. **[VERIFICAR CON ABOGADO]:** la LFPPI no trae puerto seguro para marcas (00 §4.1);
> aplicar el mismo procedimiento a marcas es una decisión nuestra, y hay que confirmar la
> redacción. El plazo de 2 días hábiles es **[DECISIÓN DEL FUNDADOR]**.

### A16. Revisión de autenticidad: medimos riesgo, no acusamos

- Revisamos el riesgo de imitación de los productos con reglas automáticas (precio frente a
  productos parecidos, palabras de imitación junto a una marca, tiendas nuevas con artículos de marca
  caros y reportes de personas distintas) y, si la activamos, con una señal de IA que solo lee el
  texto público del producto y nunca decide sola.
- Según el resultado, quien compra puede ver «**Autenticidad sin verificar**», «**Comprobante
  revisado por VendeIA**» o una nota neutral («Revisa: …»).
- Si declaraste que un producto es original, podemos pedirte un comprobante (ver C11).
- «Comprobante revisado por VendeIA» solo significa que nuestro equipo revisó un comprobante de
  compra que envió quien vende para ese artículo. **No es una certificación ni una garantía de
  autenticidad.** Se quita si cambia el artículo o si sube su riesgo.
- Esta revisión **mide riesgo: no acusa a nadie ni certifica nada.** Ocultar o verificar un producto
  siempre lo decide una persona del equipo.
- **Si crees que una leyenda es un error**, pide que una persona la revise, en [CORREO DE SOPORTE] o
  con «Pedir revisión».

> **Fundamento y notas.** ADR-036 y `trust/README.md`. La leyenda evalúa la fiabilidad del vendedor
> sin intervención humana y puede afectar sus ventas: posible decisión automatizada [1, art. 26
> fr. II]; por eso el canal de revisión humana (00 §2.9) **[VERIFICAR CON ABOGADO]**. No acusar:
> publicidad y leyendas sin inducir a error [11, art. 32].

### A17. Privacidad

- El aviso de privacidad (`/privacidad`) explica qué datos tratamos, para qué, con quién los
  compartimos y cómo ejercer tus derechos. Lo aceptas por separado.
- Cuando compras, compartimos tus datos del pedido **solo** con quien te vende, y quien vende solo
  puede usarlos para entregarte ese pedido (ver C8).
- No compartimos tus datos con otras tiendas ni con anunciantes.

> **Fundamento y notas.** [11, art. 76 BIS fr. I]; [1, arts. 35 y 36]; aceptación separada [12,
> 5.2.2].

### A18. Disponibilidad del servicio

- VendeIA está en etapa de **piloto**: puede tener fallas, funciones en prueba y cambios. Cuando
  podamos, avisaremos antes de un mantenimiento programado.
- No respondemos por interrupciones que no dependen de nosotros (caso fortuito, fuerza mayor o
  fallas generales de internet o de energía). Si una falla nuestra te causa un daño, respondemos en
  los términos de la ley.
- Podemos agregar, cambiar o quitar funciones. Si quitamos algo que usas para vender o comprar, te
  avisamos con anticipación.

> **Fundamento y notas.** La NMX pide informar las responsabilidades por falta de disponibilidad o
> interrupción del sistema [12, 5.2.1.2]. **[VERIFICAR CON ABOGADO]:** redacción de la exclusión por
> causas ajenas frente al art. 90 fr. II de la LFPC [11].

### A19. Responsabilidad

- **VendeIA responde** por lo que le toca: la información que publica sobre sí misma, la seguridad y
  confidencialidad de tus datos, el canal de quejas, la moderación conforme a estas reglas y el
  cumplimiento de órdenes de autoridad.
- **VendeIA no es parte de la compraventa** entre quien compra y quien vende. Por eso no responde
  por lo que incumpla quien vende (calidad, entrega, garantía, devoluciones), salvo que el daño se
  deba a un incumplimiento de VendeIA o que la ley disponga otra cosa.
- **Lo que estos términos no limitan:** los derechos que te da la Ley Federal de Protección al
  Consumidor, que no se pueden renunciar; la responsabilidad por dolo; ni la responsabilidad civil de
  VendeIA que la ley no permite excluir.

> **Fundamento y notas.** La LFPC es de orden público [11, art. 1] y no valen las cláusulas que
> liberan de responsabilidad civil o la trasladan a otro [11, art. 90 fr. II y III]. La
> responsabilidad por dolo es exigible siempre y su renuncia es nula [28, art. 2106]; fuera de eso,
> la responsabilidad civil se puede regular por convenio salvo que la ley disponga otra cosa [28,
> art. 2117]. **[VERIFICAR CON ABOGADO]:** (a) si conviene un tope de responsabilidad solo frente a
> vendedores que actúan como negocio (no consumidores); (b) si la frase «no responde por lo que
> incumpla quien vende» resiste el art. 90 cuando VendeIA es proveedor intermediario. No proponemos
> topes frente a consumidores.

### A20. Cambios a estos términos

- Si cambiamos estos términos, te avisaremos dentro de VendeIA (un mensaje en la parte de arriba con
  la liga y un resumen de los cambios) y por correo si lo tenemos, **al menos 15 días naturales
  antes** de que apliquen.
- La nueva versión solo te aplica si la aceptas. Si no la aceptas, puedes dejar de usar VendeIA y
  pedir el cierre de tu cuenta sin costo. Los pedidos que ya estén en curso siguen con la versión
  con la que se hicieron.
- Si un cambio lo exige la ley o es urgente por seguridad, puede aplicar antes, y te explicaremos
  por qué.
- **Si algún día cobramos algo** (comisión, destacados o suscripción), te lo diremos antes, con el
  monto, y te pediremos aceptarlo de forma expresa. Si fuera un cobro recurrente, te avisaremos al
  menos 5 días naturales antes de cada renovación y podrás cancelarlo de inmediato.

> **Fundamento y notas.** No vale la cláusula que permite modificar unilateralmente el contrato [11,
> art. 90 fr. I]. El mecanismo actual pide volver a aceptar y registra la versión
> (`identity/consent-refresh.ts`). Cobros recurrentes: consentimiento expreso, aviso de 5 días
> naturales y cancelación inmediata [11, art. 76 BIS fr. VIII y IX]. Cobrar cualquier cosa activaría
> además el régimen fiscal de plataformas (00 §5.2) **[VERIFICAR CON CONTADOR]**. El plazo de 15 días
> es **[DECISIÓN DEL FUNDADOR]** **[VERIFICAR CON ABOGADO]**.

### A21. Cierre de cuenta

- **Tú puedes cerrar tu cuenta** cuando quieras. Mientras construimos el botón para hacerlo desde
  Ajustes, escríbenos a [CORREO DE PRIVACIDAD] desde el correo de tu cuenta. Primero se terminan los
  pedidos pendientes. Te confirmamos el cierre en un máximo de 10 días hábiles.
- **Nosotros podemos suspender o cerrar tu cuenta** por incumplimientos graves o repetidos de estas
  reglas o de la ley (ver A14 y C14). Te decimos por qué y puedes pedir revisión.
- Después del cierre conservamos solo lo que el aviso de privacidad indica y lo que la ley nos obliga
  a guardar.

> **Fundamento y notas.** SEC-26: hoy no existen exportar ni borrar (§0 #11). La cancelación abre un
> periodo de bloqueo y luego la supresión [1, art. 24]; plazos ARCO de 20 + 15 días hábiles [1,
> art. 31]. El plazo de 10 días hábiles es **[DECISIÓN DEL FUNDADOR]** y debe caber dentro de los
> plazos ARCO.

### A22. Impuestos

- Cada vendedor es responsable de sus propios impuestos y de emitir los comprobantes fiscales que le
  correspondan. VendeIA no da asesoría fiscal.
- Durante el piloto VendeIA **no retiene impuestos** porque no cobra ni recibe el dinero de las
  ventas.
- Si una ley nos obliga a pedir tus datos fiscales o a informar al SAT sobre tus ventas, te avisaremos
  antes, actualizaremos el aviso de privacidad y podría ser un requisito para seguir vendiendo.

> **Fundamento y notas.** Las retenciones aplican cuando la plataforma cobra por cuenta del vendedor
> [20, art. 18-J fr. II; 21, art. 113-A; 22, art. 25 fr. VI y IX]. La informativa mensual y el
> acceso del SAT en tiempo real dependen de que se cobre una contraprestación [20, art. 18-B; 23,
> art. 30-B] **[VERIFICAR CON CONTADOR]** (00 §5.2).

### A23. Ley aplicable, PROFECO y tribunales

- Estos términos se rigen por las leyes federales de México, en especial la Ley Federal de
  Protección al Consumidor.
- **PROFECO.** Si eres consumidor, puedes presentar una queja ante la Procuraduría Federal del
  Consumidor por escrito, por teléfono o en línea. Teléfono del Consumidor: 55 5568 8722 y
  800 468 8722.
- **Tribunales.** Para cualquier controversia, tú y VendeIA se someten a los tribunales competentes
  de la Ciudad de México, sin perjuicio de que, si eres consumidor, acudas a la PROFECO o a los
  tribunales que la ley te permita. Nunca te pediremos acudir a tribunales extranjeros.
- Si una parte de estos términos no fuera válida, el resto sigue vigente.
- Estos términos están en español, que es la versión que vale.

> **Fundamento y notas.** Quejas ante la PROFECO [11, art. 99]. Teléfonos según PROFECO en gob.mx
> [45] (artículo del 18-02-2021) **[VERIFICAR]** que sigan vigentes al publicar. No vale someter al
> consumidor a tribunales extranjeros ni obligarlo a renunciar a la LFPC [11, art. 90 fr. VI].
> Contrato de adhesión en español [11, art. 85]. La NMX pide informar la normativa aplicable y las
> atribuciones de la PROFECO [12, 5.2.1.8]. **[VERIFICAR CON ABOGADO]:** la cláusula de competencia
> (tribunales de la CDMX frente al domicilio del consumidor, reglas del Código Nacional de
> Procedimientos Civiles y Familiares) y si conviene someterse expresamente a la PROFECO (obligatorio
> solo en contratos registrados [11, art. 86]).

### A24. Avisos entre tú y VendeIA

- Te avisamos dentro de VendeIA y al correo de tu cuenta.
- Tú nos avisas en los contactos de A1. Para asuntos legales, también en [DOMICILIO PARA OÍR Y
  RECIBIR NOTIFICACIONES].

---

## Parte B. Reglas de la comunidad

VendeIA es para descubrir, aprender, conversar y comprar a pequeños vendedores. Estas reglas aplican
a todo: perfiles, publicaciones, comentarios, productos, fotos y nombres de tienda. Forman parte de
los términos.

### B1. Lo básico

- **Respeta.** Opina y critica, pero sin atacar a las personas.
- **Sé honesto.** Lo que publicas debe ser verdad, sobre todo si vendes.
- **Cuida a los demás.** No pongas en riesgo la seguridad, la salud ni los datos de nadie.

### B2. Lo que no se permite

| Regla                                   | Ejemplos                                                                                                                                                         | Fundamento                                                                                                                                               |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Violencia y amenazas                    | Amenazar, incitar a la violencia, celebrar ataques, mostrar violencia gráfica o autolesiones                                                                     | Política de VendeIA                                                                                                                                      |
| Discriminación y discurso de odio       | Atacar a alguien por su origen étnico o nacional, género, edad, discapacidad, condición social, salud, religión, opiniones, preferencias sexuales o estado civil | La Constitución prohíbe toda discriminación por esos motivos [38, art. 1o. último párr.]; como regla de contenido, política de VendeIA                   |
| Acoso                                   | Mensajes insistentes no deseados, humillar, exhibir a alguien, organizar ataques                                                                                 | Política de VendeIA                                                                                                                                      |
| Contenido sexual                        | Desnudos, pornografía, servicios sexuales, contenido sexual explícito                                                                                            | Política de VendeIA; ofrecer pornografía a menores es delito [41, art. 200]                                                                              |
| **Contenido sexual con menores**        | Cualquiera, real o simulado, incluido el hecho con IA. Lo reportamos a las autoridades                                                                           | Delito [41, art. 202]                                                                                                                                    |
| **Contenido íntimo sin consentimiento** | Compartir fotos, videos o audios íntimos de alguien sin su autorización                                                                                          | Delito [41, art. 199 Octies]; retiro por orden del MP o del juez [30, art. 20 Sexies]                                                                    |
| Datos personales de otros               | Publicar el domicilio, teléfono, identificación oficial o fotos de alguien sin permiso                                                                           | Política de VendeIA                                                                                                                                      |
| Estafas y engaños                       | Pedir pagos o depósitos fuera de los datos del pedido, poner una CLABE en comentarios, ligas falsas, «regalos» a cambio de datos, cobrar y no entregar           | Fraude [41, art. 386]; regla del pedido (plan §7.2)                                                                                                      |
| Actividad falsa                         | Cuentas falsas, comprar seguidores o «me gusta», reseñas falsas, comentarios repetidos, reportes falsos o en masa                                                | Contenido honesto (principio 5); publicidad veraz [11, art. 32]                                                                                          |
| Suplantación                            | Hacerte pasar por otra persona, por una marca o por el equipo de VendeIA                                                                                         | Política de VendeIA; nombres reservados (SEC-18)                                                                                                         |
| Contenido ajeno sin permiso             | Subir fotos, videos, música o textos de otros sin autorización                                                                                                   | [17, art. 114 Octies]; A15                                                                                                                               |
| IA engañosa                             | Clonar la voz o la imagen de una persona real sin su permiso; presentar una imagen hecha con IA como foto real del artículo que vendes                           | Imagen y voz de artistas, también en resultados de IA [17, art. 87]; publicidad veraz [11, art. 32]                                                      |
| Salud engañosa                          | Anunciar suplementos, remedios o cosméticos como cura o tratamiento de una enfermedad                                                                            | La autoridad sanitaria puede asegurar esos productos [37, art. 414 Bis a)]                                                                               |
| Promover productos prohibidos           | Publicaciones que promuevan drogas, vapeadores o tabaco, aunque no tengan precio                                                                                 | Publicidad de narcóticos: delito [41, art. 194 fr. IV]; vapeadores [37, art. 282 Quater]; tabaco [39, art. 23]                                           |
| Rifas, sorteos y apuestas               | Rifas, boletos, apuestas o sorteos con premio; también «tandas» (por política)                                                                                   | Los sorteos requieren permiso de la Secretaría de Gobernación [43, arts. 2o.–4o.]; nada de sorteos en el piloto (plan §7.1); tandas: política de VendeIA |
| Publicidad escondida                    | Promocionar algo que te pagaron o te regalaron sin decirlo                                                                                                       | Identifica el contenido pagado con «#Publicidad» durante todo el contenido [14]                                                                          |

> **Fundamento y notas.** Las reglas marcadas «Política de VendeIA» son decisiones de producto, no
> obligaciones legales que hayamos verificado. **[VERIFICAR CON ABOGADO]:** que las reglas de
> contenido no restrinjan de más la libertad de expresión en una red social privada y que la
> redacción de «discurso de odio» sea suficientemente precisa. Comunidades: no crear comunidades
> sobre salud, religión, política o preferencia sexual en el piloto, porque volverían sensible el dato
> «comunidades que te interesan» [1, arts. 2 fr. VI y 8] (00 §2.3).

### B3. Si recibes algo por promocionar un producto

Si una marca o una tienda te pagó, te regaló el producto o te da una comisión por promocionarlo,
dilo de forma visible en la publicación, por ejemplo con «#Publicidad», durante todo el contenido.

> **Fundamento y notas.** Guía de publicidad para influencers de la PROFECO [14]. Base para la
> etiqueta «Patrocinado» de P12 cuando exista.

### B4. Cómo reportar

- Usa «**Reportar**» en la publicación, el comentario o el producto, y elige el motivo:
  falsificación, estafa, artículo prohibido, spam, ofensivo u otro.
- **Quien vende no sabe quién lo reportó.**
- Cada persona puede reportar una vez cada publicación o producto. Reporta de buena fe: los reportes
  que no proceden se descartan y no cuentan.
- Si hay un peligro inmediato para alguien, llama primero al **911**.

> **Fundamento y notas.** Motivos: `ReportReason` en `prisma/schema.prisma`. Anonimato y un reporte
> por persona: términos vigentes (`terminos/page.tsx`) y ADR-036. Límites de reportes:
> `trust/limits.ts`. El 911 es el número de emergencias en México **[VERIFICAR]** (no lo tomamos de
> una fuente oficial en esta investigación).

### B5. Qué pasa si incumples estas reglas

Depende de la gravedad y de si se repite (ver A14 y C14): desde quitar el contenido y avisarte,
hasta suspender o cerrar la cuenta. En casos graves actuamos de inmediato. Siempre te decimos por qué,
salvo las excepciones de A14, y puedes pedir revisión.

---

## Parte C. Política para vendedores

Si activas «Vender», además de los términos y las Reglas de la comunidad aceptas esta política.

### C1. Para vender

- Tener 18 años cumplidos y aceptar esta política.
- Un nombre de tienda que no confunda (no puede parecer de VendeIA ni de una marca que no es tuya).
- Tu ciudad y estado, y al menos un método de pago que aceptas.
- Para recibir **transferencias**, un teléfono verificado.
- Datos de contacto para tus clientes (se muestran dentro de cada pedido, no en público).

> **Fundamento y notas.** `identity/seller-actions.ts` pide nombre, ciudad, estado y métodos de pago;
> nombres reservados (SEC-18). Faltan: aceptación de esta política (§0 #3), teléfono verificado (§0
> #13) y datos de contacto del vendedor (§0 #12). Datos del proveedor antes de la transacción [11,
> art. 76 BIS fr. III].

### C2. Tu responsabilidad como vendedor

- **Tú eres quien vende.** El contrato de compraventa es entre tú y quien te compra. VendeIA no es
  parte de él.
- Si vendes de forma habitual, eres **proveedor** para la Ley Federal de Protección al Consumidor y
  tienes sus obligaciones (C6).
- Cumples las leyes que apliquen a lo que vendes: sanitarias, de etiquetado, fiscales y de propiedad
  intelectual.
- Los datos de tus clientes que recibes por un pedido son tu responsabilidad (C8).

> **Fundamento y notas.** Proveedor habitual o periódico [11, art. 2 fr. II] **[VERIFICAR CON
> ABOGADO]** (vendedor ocasional). La NMX pide que el intermediario exija al tercero proveedor cumplir
> la información del producto [12, 5.3.6]. Quien recibe datos por transferencia asume las
> obligaciones del responsable [1, art. 35].

### C3. Publica con la verdad: datos verificables (P4)

Cada producto tiene **datos estructurados** que se muestran tal como los capturas. La IA de VendeIA
no puede afirmar nada que no esté en ellos. Tienen que ser verdad y estar al día:

| Dato                      | Regla                                                                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Precio**                | En pesos mexicanos y **total**: con impuestos y cualquier cargo. Si incluye IVA, dilo. El costo de envío aparece aparte, antes de pedir |
| **Costo del producto**    | Es **privado**: nunca se muestra a nadie. Solo sirve para tus cálculos (margen, precio sugerido)                                        |
| **Existencias**           | Las piezas que de verdad tienes. Actualízalas; no vendas lo que no puedes entregar                                                      |
| **Condición**             | Nuevo, como nuevo, usado en buen estado, usado aceptable o reacondicionado. Describe defectos y desgaste                                |
| **Categoría y etiquetas** | Las que corresponden al producto                                                                                                        |
| **Ciudad y estado**       | Donde está el producto                                                                                                                  |
| **Entrega**               | Recoger, entrega local (con zonas) o envío nacional (con costo y días de entrega). Cumple lo que ofreces                                |
| **Garantía**              | Sin garantía, tuya o del fabricante. Si la ofreces, **90 días o más** desde la entrega (C6)                                             |
| **Devoluciones**          | Tu plazo de devoluciones, que respete los mínimos de C6                                                                                 |
| **Autenticidad**          | «No aplica», «original» o «genérico». Declara «original» solo si lo puedes demostrar (C11)                                              |
| **Métodos de pago**       | Los que de verdad aceptas                                                                                                               |
| **Fotos**                 | De 1 a 10, del artículo real que vendes. Nada de fotos de catálogo ajenas ni de imágenes hechas con IA presentadas como el artículo     |

Además:

- Sin descuentos inventados ni «antes/ahora» que no puedas probar; sin prisa falsa («solo hoy»,
  «últimas piezas» si no es cierto).
- Si el producto es importado, di su lugar de origen y da instrucciones y garantía en español.
- No pongas datos bancarios, teléfonos ni ligas para pagar en la descripción, en publicaciones ni en
  comentarios: los datos de pago solo van dentro del pedido.

> **Fundamento y notas.** P4 (`product-principles.md`, principio 8). Campos: `catalog/schemas.ts`
> (precio y costo en centavos, `stock`, `ProductCondition`, entrega, `WarrantyType`,
> `returnWindowDays`, `Authenticity`, 1 a 10 fotos) y `acceptedPaymentMethods`. El costo nunca llega
> al navegador (regla de `CLAUDE.md`). Monto total con impuestos y cargos [11, art. 7 BIS]; publicidad
> veraz y comprobable [11, art. 32]; evitar prácticas engañosas [11, art. 76 BIS fr. IV];
> información mínima del producto (descripción, nuevo o usado, existencias, monto total en moneda
> nacional, garantía no menor a la ley, entrega con costos y plazos, fotos) [12, 5.3.2.1]; productos
> importados [12, 5.2.1.13]. Sin descuentos inventados: plan §7.3 (B7).

### C4. Artículos prohibidos

No puedes vender, ofrecer ni promover:

| Categoría                               | Qué incluye                                                                                                                                                                        | Por qué                                                                                                                                                                                                                                                                                 |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Armas de fuego, municiones y explosivos | Armas de fuego y sus partes, municiones, cargadores, armas de gas o aire comprimido de más de 140 joules, pólvora, explosivos, detonadores y **pirotecnia** (cohetes, «cuetes»)    | El comercio de armas requiere autorización presidencial y permisos de la Secretaría de la Defensa; la ley incluye estas armas, municiones, pólvoras, explosivos y pirotécnicos [40, arts. 37, 40 y 41]. Venta de pistolas y revólveres: licencia especial [41, art. 161]                |
| Armas para agredir                      | Navajas automáticas, manoplas, macanas, cuchillos o herramientas anunciados como arma; aerosoles de defensa y paralizadores eléctricos                                             | Vender instrumentos para el ataque sin fin lícito o con intención de agredir es delito [41, art. 160]. Aerosoles y paralizadores: **[DECISIÓN DEL FUNDADOR]**                                                                                                                           |
| Drogas                                  | Marihuana, THC, cocaína, metanfetaminas, fentanilo, hongos alucinógenos y cualquier narcótico o psicotrópico; parafernalia anunciada para consumir; productos con CBD              | Estupefacientes sujetos a control de la Ley General de Salud [37, arts. 234 y 235]; comerciarlos o hacerles publicidad es delito [41, art. 194 fr. I y IV]. CBD: **[DECISIÓN DEL FUNDADOR]** **[VERIFICAR CON ABOGADO]**                                                                |
| **Vapeadores**                          | Cigarrillos electrónicos, vapeadores, desechables, líquidos, cápsulas y accesorios                                                                                                 | La Constitución manda sancionar toda actividad con vapeadores [38, art. 4o.]. Prohibida su venta, comercio y publicidad en todo el país [37, art. 282 Quater, DOF 15-01-2026]; aseguramiento de soluciones y aditivos [37, art. 414 Bis c)]                                             |
| Tabaco                                  | Cigarros, puros, tabaco picado y artículos que usen marcas o diseños de productos de tabaco                                                                                        | Prohibido vender tabaco al consumidor final por internet, y vender objetos con elementos de marcas de tabaco [39, art. 16 fr. IV y VI]; publicidad prohibida [39, art. 23]                                                                                                              |
| Medicamentos y dispositivos médicos     | Medicamentos con o sin receta (incluidos antibióticos, controlados, «Ozempic»), muestras médicas, dispositivos médicos que requieren registro sanitario, medicamentos veterinarios | La ley clasifica los medicamentos por cómo se venden (con receta, solo en farmacia) y prohíbe venderlos en puestos semifijos, módulos móviles o ambulantes [37, art. 226]; requieren registro sanitario [37, art. 376]. Veterinarios: **[DECISIÓN DEL FUNDADOR]**                       |
| Bebidas alcohólicas                     | Cerveza, vino, licores y cualquier bebida de 2 % a 55 % de alcohol                                                                                                                 | Prohibido venderlas a menores [37, arts. 217 y 220]; en el piloto no podemos comprobar la edad de quien recibe. **[DECISIÓN DEL FUNDADOR]**; permisos locales **[VERIFICAR CON ABOGADO]**                                                                                               |
| Animales vivos y especies protegidas    | Perros, gatos y cualquier animal vivo, incluso «en adopción» con cuota; fauna silvestre; marfil, pieles, caparazones y otras partes de especies protegidas                         | Legal procedencia y traslado de fauna silvestre [42, arts. 51, 52 y 55]; tráfico de especies protegidas: delito [41, art. 420 fr. IV]; en la CDMX, restricciones a la venta de animales [46][47][48] **[VERIFICAR CON ABOGADO]**. Todos los animales vivos: **[DECISIÓN DEL FUNDADOR]** |
| Falsificaciones y piratería             | Réplicas, imitaciones, productos con marca sin permiso; copias no autorizadas de libros, cursos, películas, música, software, videojuegos; cuentas o licencias revendidas          | [16, arts. 386, 387 y 402]; [41, art. 424 bis]; A15                                                                                                                                                                                                                                     |
| Artículos robados o de origen dudoso    | Lo que no puedas demostrar que es tuyo: autopartes, celulares con reporte de robo, mercancía «caída del camión»                                                                    | Poseer, vender o comerciar a sabiendas con objetos robados es delito cuando su valor pasa el umbral de la ley [41, arts. 368 Bis y 368 Ter]; lo demás, política de VendeIA                                                                                                              |
| Contenido y productos sexuales          | Pornografía, servicios sexuales y, en el piloto, juguetes y artículos para adultos                                                                                                 | [41, arts. 200 y 202]; artículos para adultos: **[DECISIÓN DEL FUNDADOR]**                                                                                                                                                                                                              |
| Partes del cuerpo humano                | Órganos, tejidos, sangre y sus derivados                                                                                                                                           | Prohibido su comercio [37, art. 327]                                                                                                                                                                                                                                                    |
| Rifas, sorteos y apuestas               | Boletos, rifas y apuestas                                                                                                                                                          | [43, arts. 2o.–4o.]; plan §7.1                                                                                                                                                                                                                                                          |
| Sustancias peligrosas                   | Plaguicidas, sustancias tóxicas o peligrosas, químicos sin etiqueta                                                                                                                | Requieren registro sanitario [37, art. 376]; política de VendeIA                                                                                                                                                                                                                        |
| Documentos, cuentas y datos             | Identificaciones oficiales, placas, uniformes o insignias oficiales, bases de datos, cuentas de redes, seguidores y reseñas                                                        | Política de VendeIA                                                                                                                                                                                                                                                                     |
| Servicios financieros y dinero          | Préstamos, «tandas», inversiones, criptoactivos, cambio de divisas, tarjetas de regalo y saldo                                                                                     | Política de VendeIA                                                                                                                                                                                                                                                                     |
| Productos retirados o inseguros         | Productos retirados del mercado por la autoridad o con alertas sanitarias o de seguridad                                                                                           | Política de VendeIA                                                                                                                                                                                                                                                                     |

> **Fundamento y notas.** La lista no es exhaustiva: también está prohibido todo lo que prohíba la
> ley aunque no aparezca aquí. Las filas con «Política de VendeIA» o **[DECISIÓN DEL FUNDADOR]** no
> las exige una ley que hayamos verificado; el piloto las prohíbe para reducir riesgo y porque no
> podemos verificar la edad ni permisos. **Animales en la CDMX:** según fuentes secundarias, la ley
> local prohíbe vender animales en mercados públicos, vía pública, vehículos y tiendas (art. 28 Bis)
> [48], y el Congreso local aprobó en mayo de 2026 que solo quienes tengan registros y autorizaciones
> puedan ofrecer perros y gatos por medios electrónicos y plataformas digitales [46][47]; no
> confirmamos su publicación en la Gaceta Oficial ni si impone obligaciones a las plataformas
> **[VERIFICAR CON ABOGADO]**. Vapeadores: el filtro de la IA ya los frena (`ai/content-policy.ts`);
> lo publicado a mano todavía no (§0 #14).

### C5. Artículos restringidos: se permiten con condiciones

| Categoría                                | Condiciones                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Comida casera y repostería**           | Prepara con prácticas de higiene; pon en la descripción los ingredientes, **alérgenos** (por ejemplo nueces, gluten, lácteos, huevo), fecha de elaboración, cuánto dura y cómo conservarla. Lo perecedero, solo para recoger o entrega local. Pedidos por encargo: dilo, porque cambian las devoluciones (C6) |
| **Suplementos, cosméticos y belleza**    | Nuevos, sellados, dentro de su fecha de caducidad y con etiqueta en español. Sin prometer que curan o tratan enfermedades. Nada de cosméticos usados ni de productos que requieran registro sanitario si no lo tienen                                                                                         |
| **Electrónica y celulares usados**       | Condición real y defectos descritos; sin reporte de robo; borra tus datos antes de entregar                                                                                                                                                                                                                   |
| **Autos, motos y autopartes**            | Solo si eres el dueño y tienes la factura o los documentos que lo prueban; autopartes con origen comprobable                                                                                                                                                                                                  |
| **Mascotas**                             | Alimento, accesorios y juguetes sí; animales vivos y medicamentos veterinarios no (C4)                                                                                                                                                                                                                        |
| **Cuchillos y herramientas**             | Para cocina, oficio o actividades al aire libre, descritos por su uso; nunca anunciados como armas                                                                                                                                                                                                            |
| **Juguetes que parecen armas**           | Que se vea claramente que son juguetes (color, descripción); nada de réplicas realistas                                                                                                                                                                                                                       |
| **Libros, cursos y contenido digital**   | Solo originales o de tu autoría; nada de copias ni de acceso compartido a cursos o plataformas                                                                                                                                                                                                                |
| **Hecho a mano con personajes o marcas** | Solo con licencia del titular del personaje o de la marca                                                                                                                                                                                                                                                     |
| **Ropa, tenis y accesorios de marca**    | Si declaras «original», ten el comprobante (C11); si no es de la marca, publícalo como «genérico» sin usar la marca                                                                                                                                                                                           |
| **Servicios**                            | Describe qué incluye, fecha, lugar, duración y quién lo presta (si subcontratas, di a quién), restricciones y precio total. Nada de servicios de salud, financieros o sexuales                                                                                                                                |

> **Fundamento y notas.** **Comida:** la NOM-251-SSA1-2009 aplica a las «personas físicas o morales
> que se dedican al proceso de alimentos, bebidas o suplementos alimenticios» destinados a
> consumidores en México [44, numeral 1.2]. La ley prevé un aviso de funcionamiento para los
> establecimientos que determine la Secretaría de Salud [37, art. 200 Bis]. **[VERIFICAR CON
> ABOGADO]:** qué permisos, avisos o reglas de etiquetado aplican a quien cocina en casa y vende por
> internet en la CDMX. Excepción de perecederos pagados de contado [11, art. 51]. Alérgenos: política
> de VendeIA. **Suplementos y cosméticos:** [37, arts. 376 y 414 Bis a)]. **Servicios:** información
> mínima de servicios [12, 5.3.2.2]; qué servicios requieren cédula profesional **[VERIFICAR CON
> ABOGADO]**. **Juguetes y fan art:** política de VendeIA; licencia de personajes **[VERIFICAR CON
> ABOGADO]**. **Robo:** [41, art. 368 Bis].

### C6. Garantías, devoluciones y cambios

- **Garantía.** Puedes vender **sin garantía**. Si ofreces garantía, debe ser de **90 días o más**
  desde la entrega, y debes darle a quien compra una póliza por escrito (puede ser digital) con su
  alcance, duración, condiciones, cómo hacerla válida y dónde reclamar. El tiempo que tarde una
  reparación no cuenta dentro de la garantía.
- **Revocación de 5 días hábiles.** En ventas a distancia, quien compra puede revocar la compra
  dentro de los 5 días hábiles desde que recibe el producto; le devuelves lo que pagó y él paga el
  flete y el seguro de la devolución. Excepciones: lo perecedero recibido y pagado de contado; lo
  usado o consumido; lo que no conserve su estado original con accesorios y empaque; lo hecho a la
  medida o por encargo, siempre que lo hayas informado en la ficha antes de la compra.
- **Tu plazo de devoluciones** (el dato «Devoluciones» del producto) no puede ser menor a lo que
  exige la ley.
- **Si lo que entregaste no es lo que ofreciste** (calidad, marca o especificaciones): quien compra
  elige que se lo repongas o que le devuelvas lo que pagó, y además le corresponde una bonificación
  de al menos el 20 % del precio. Puede reclamar dentro de 2 meses desde que lo recibió, y tienes
  hasta 15 días para resolver.
- **Defectos ocultos:** quien compra puede pedir la restitución, la rescisión o la reducción del
  precio, más la bonificación.
- **Devoluciones de ventas a distancia:** acepta reclamaciones y devoluciones por un medio parecido
  al de la venta y, salvo que acuerden otra cosa, cubre el transporte de las devoluciones o
  reparaciones que ampara la garantía.
- **Devuelve el dinero** por el mismo medio con que te pagaron, salvo que quien compra acepte otro al
  momento de la devolución.

> **Fundamento y notas.** Garantía mínima de 90 días [11, art. 77]; póliza [11, art. 78]; no reducir
> derechos [11, art. 79]; tiempo de reparación [11, art. 83]. Revocación [11, arts. 51 y 56];
> exclusiones de la NMX [12, 5.2.1.4]. Reposición o devolución y bonificación [11, arts. 92 y 92
> TER]; 2 meses y 15 días [11, art. 93]; vicios ocultos [11, art. 82]. Ventas a distancia: medios
> similares y costos de transporte de devoluciones o reparaciones por garantía «salvo pacto en
> contrario» [11, art. 53 fr. II y III]. Devolución por la misma forma de pago [11, art. 92]. Aplica a
> quien sea «proveedor» [11, art. 2 fr. II]; el vendedor ocasional responde por vicios ocultos
> conforme a la ley civil [28, arts. 2142 y 2149] **[VERIFICAR CON ABOGADO]**. Hoy el formulario
> acepta garantías de 1 día y devoluciones de 0 días (§0 #5 y #6).

### C7. Cobros directos y seguridad

- **Tú cobras.** VendeIA no recibe, no retiene y no reparte el dinero de tus ventas.
- **Tus datos de pago solo van dentro del pedido**, nunca en público. No pongas tu CLABE ni frases
  como «deposítame» en comentarios o publicaciones: los retiramos.
- **Confirma el pago en la app de tu banco**, no con una captura de pantalla: hay comprobantes
  falsos.
- En las primeras ventas con alguien, te recomendamos contra entrega o que recojan en persona.
- Solo marca un pedido como pagado o entregado cuando de verdad lo esté: esa información la usamos
  para medir y para atender quejas.
- **Comprobantes para tus clientes:** si te piden comprobante o factura y estás obligado a darla,
  emítela (C10).

> **Fundamento y notas.** Plan §7.2 (modo B1): método de pago como dato P4, datos bancarios solo
> dentro del pedido, filtro de CLABE, «Confirma en la app de tu banco», transferencia solo con
> teléfono verificado. El plan da por hecho un filtro de CLABE en comentarios y publicaciones, pero
> en el código solo encontramos filtros de CLABE en la entrada y la salida de la IA
> (`ai/personal-data.ts`, `ai/output-guard.ts`, `ai/ad-kit/guard.ts`), no en `social/` ni en
> `catalog/` (§0 #20). Por eso el texto dice «los retiramos» y no «el sistema los bloquea».

### C8. Los datos de tus clientes

- Por VendeIA ves el nombre visible de quien te compra y lo que pidió. Lo que te comparta para
  acordar la entrega (domicilio, teléfono) es **solo para entregar ese pedido**.
- No los uses para otra cosa: ni publicidad, ni listas de contactos, ni pasarlos a otras personas.
  Si quieres mandar promociones, pide antes su permiso fuera del pedido y respeta si dice que no.
- Guárdalos con cuidado y bórralos cuando ya no los necesites (por ejemplo, al terminar la garantía).
- Al recibir esos datos te vuelves responsable de ellos ante la ley de datos personales.

> **Fundamento y notas.** Transferencia al vendedor, que asume las obligaciones del responsable [1,
> art. 35]; excepción de consentimiento [1, art. 36] **[VERIFICAR CON ABOGADO]**. Confidencialidad
> [11, art. 76 BIS fr. I]; respetar la decisión de no recibir avisos comerciales [11, art. 76 BIS
> fr. VI]. Plazo de borrado sugerido: **[DECISIÓN DEL FUNDADOR]**.

### C9. Tus datos visibles para quien te compra

Tu nombre de tienda, tu ciudad y estado son públicos. Tu domicilio y teléfono de contacto **solo** se
muestran a quien te hizo un pedido, dentro de ese pedido, para que pueda reclamar o pedir
aclaraciones. Al activar «Vender» aceptas que se muestren así.

> **Fundamento y notas.** Domicilio físico, teléfonos y medios de reclamación antes de la transacción
> [11, art. 76 BIS fr. III]; mostrarlos en la confirmación y no en público (plan §7.1). **[VERIFICAR
> CON ABOGADO]:** si al vendedor persona física le basta dar un domicilio para recibir reclamaciones
> distinto de su casa. Pendiente en el código (§0 #12).

### C10. Tus impuestos

- **Tus impuestos son tu responsabilidad**, igual que emitir las facturas o comprobantes que te
  correspondan. VendeIA no te asesora en esto: consulta a un contador.
- En el piloto VendeIA **no retiene** impuestos de tus ventas, porque no cobra ni recibe el dinero.
- Si la ley llegara a obligarnos a pedirte tu RFC u otros datos fiscales o bancarios, o a informar al
  SAT sobre tus ventas, te avisaremos antes y podría ser un requisito para seguir vendiendo.

> **Fundamento y notas.** 00 §5.2. Retenciones solo cuando la plataforma cobra [20, art. 18-J fr. II;
> 21, art. 113-A; 22, art. 25 fr. VI y IX]. La informativa mensual pediría RFC, CURP, domicilio
> fiscal, institución financiera y CLABE de cada vendedor [20, art. 18-J fr. III] si VendeIA
> quedara dentro del art. 18-B, que exige cobrar una contraprestación [20, art. 18-B] **[VERIFICAR
> CON CONTADOR]**.

### C11. Autenticidad y comprobantes

1. **Declara «original»** solo si lo puedes demostrar. Si no es de la marca, publícalo como
   «genérico».
2. **Medimos el riesgo** de cada producto con reglas (precio frente a productos parecidos, palabras de
   imitación junto a una marca, tiendas nuevas con artículos de marca caros, reportes) y, si la
   activamos, con una señal de IA que nunca decide sola (A16).
3. **Si el riesgo es alto y declaraste «original»,** te pediremos un comprobante: ticket, factura,
   foto de la etiqueta o del número de serie, o el empaque. Lo subes en Studio, en el producto,
   sección «Autenticidad».
4. **Tapa los datos que no hacen falta** antes de subir la foto: tu domicilio, tu RFC y los números de
   tu tarjeta. Deja visibles la tienda, la fecha y el producto.
5. **Tus comprobantes son privados:** solo los ven tú y nuestro equipo, nunca se publican y no se
   pueden adjuntar a publicaciones ni productos. Guardamos el historial de lo que enviaste para poder
   revisar qué vio el equipo al decidir.
6. **Una persona del equipo decide:** si el comprobante corresponde, el producto muestra «Comprobante
   revisado por VendeIA»; si no, te pediremos corregir a «genérico» o lo ocultaremos.
7. **El sello se pierde** si cambias qué vendes (título, etiquetas, categoría o condición) o si sube el
   riesgo del producto (por ejemplo, un precio mucho más bajo).
8. El sello **no es una certificación** ni una garantía de autenticidad.

> **Fundamento y notas.** ADR-036 y `trust/README.md` (reglas `v2`, comprobante ligado al artículo,
> historial `AuthenticityProofHistory`, trigger `reject_proof_media_link`). Los comprobantes pueden
> traer datos financieros o patrimoniales: consentimiento expreso [1, art. 7] **[VERIFICAR CON
> ABOGADO]** (§0 #19). **Plazo de conservación de los comprobantes: pendiente** (ADR-036, nota final)
> **[VERIFICAR CON ABOGADO]**.

### C12. Marcas y derechos de terceros

- No uses marcas, logotipos, personajes ni fotos de otros sin permiso.
- Si tu producto es compatible con otra marca (por ejemplo, un cargador), dilo de forma descriptiva
  («compatible con …») sin usar el logotipo ni presentarlo como producto de esa marca.
- Si recibimos un aviso sobre tu producto, lo retiramos si procede y te avisamos. Puedes responder
  con un contra-aviso (A15 y anexo 2).

> **Fundamento y notas.** [16, arts. 386 y 387]. **[VERIFICAR CON ABOGADO]:** si la LFPPI permite el
> uso descriptivo de una marca ajena para indicar compatibilidad y en qué términos.

### C13. Vender con ayuda de la IA

- «Vende con IA» y el «Kit de anuncios» te proponen textos y cifras; tú revisas y decides qué
  publicar. Lo que publicas es tu responsabilidad (A11).
- Tienes un número de usos: hoy, 30 al mes y 10 al día. Puede cambiar.
- La IA no te ayuda con artículos prohibidos, réplicas ni medicamentos.
- No escribas datos personales de tus clientes en lo que le pides a la IA.

> **Fundamento y notas.** ADR-033 #6; `ai/content-policy.ts`; A11.

### C14. Sanciones a vendedores y reincidencia

| Nivel       | Ejemplos                                                                                                       | Medida                                                                            |
| ----------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1 · Leve    | Un dato P4 equivocado, una foto que no es del artículo, categoría incorrecta                                   | Aviso para corregir; ocultamos el producto si no se corrige                       |
| 2 · Medio   | Repetir lo leve, descuentos o prisa falsos, no responder quejas                                                | Ocultamos el producto y limitamos publicar hasta 7 días                           |
| 3 · Serio   | Falsificación confirmada, artículo prohibido no grave, no entregar lo cobrado                                  | Suspendemos tus ventas hasta 30 días                                              |
| Reincidente | **3 infracciones confirmadas de marcas o derechos de autor en 12 meses**, o 3 de nivel 3 de cualquier tipo     | Cerramos tu tienda de forma definitiva                                            |
| Grave       | Armas, drogas, vapeadores, contenido sexual con menores, contenido íntimo sin consentimiento, fraude, amenazas | Cerramos la cuenta de inmediato y, cuando corresponda, avisamos a las autoridades |

Siempre te decimos qué hicimos y por qué, y puedes pedir revisión (A14).

> **Fundamento y notas.** Política pública de terminación de cuentas de reincidentes [17, art. 114
> Octies fr. II c)]. Niveles, plazos y el umbral de 3 en 12 meses: **[DECISIÓN DEL FUNDADOR]**. Hoy
> solo existe `SellerStatus` ACTIVE/SUSPENDED y no se cuentan infracciones (§0 #15 y #16).

### C15. Dejar de vender

Puedes pausar tus productos o dejar de vender cuando quieras. Antes, termina los pedidos pendientes y
respeta las garantías y devoluciones de lo que ya vendiste.

---

## Anexo 1. Aviso para titulares de marcas y derechos de autor

Mándalo por [URL DEL FORMULARIO DE AVISOS] o a [CORREO DE SOPORTE] con el asunto «Aviso de
derechos». Debe incluir:

1. **Quién avisa:** nombre del titular o de su representante legal, y un medio de contacto para
   recibir notificaciones.
2. **Qué derecho:** en marcas, el número de registro en el IMPI y el producto o servicio que protege;
   en derechos de autor, la obra y tu interés o derecho sobre ella.
3. **Qué contenido:** la liga de cada producto o publicación que reclamas.
4. **Por qué infringe:** una explicación breve.
5. **Representación:** si actúas por otra persona, el documento que lo acredita.
6. **Declaración:** que la información es verdadera y que actúas de buena fe.

Confirmamos que lo recibimos en un máximo de 2 días hábiles. Quien publicó el contenido recibe la
información necesaria para responder, que puede incluir tu nombre y tu medio de contacto.

> **Fundamento y notas.** Contenido mínimo del aviso de derechos de autor: nombre y contacto,
> contenido, interés o derecho y ubicación electrónica [17, art. 114 Octies fr. III]. El número de
> registro del IMPI es requisito nuestro para marcas **[DECISIÓN DEL FUNDADOR]**. Compartir los datos
> de quien avisa con quien publicó: mencionarlo en el aviso de privacidad **[VERIFICAR CON
> ABOGADO]**.

## Anexo 2. Contra-aviso

Si retiramos tu contenido y crees que es un error, mándanos:

1. Tu nombre y un medio de contacto.
2. El contenido retirado (la liga o el nombre del producto).
3. **La prueba** de que eres titular o tienes autorización para ese uso (por ejemplo, licencia,
   factura de compra del producto original), o por qué tu uso está permitido por la ley.
4. La declaración de que la información es verdadera.
5. Tu aceptación de que enviemos el contra-aviso a quien mandó el aviso.

Le enviamos tu contra-aviso a quien mandó el aviso. En derechos de autor, volvemos a habilitar el
contenido salvo que esa persona inicie un procedimiento judicial o administrativo, una denuncia penal
o un mecanismo alterno de solución dentro de 15 días hábiles.

> **Fundamento y notas.** [17, art. 114 Octies fr. III, párrafos segundo y tercero]; multa por falsa
> declaración [17, art. 232 Quinquies fr. I].

---

## V. Puntos para el abogado ([VERIFICAR CON ABOGADO])

1. **Edad:** ¿basta la declaración de 18 años o hace falta otra verificación? (A4)
2. **Aceptación separada:** ¿dos casillas (términos y aviso de privacidad) cumplen la NMX 5.2.2? (A3)
3. **Transferencia al vendedor:** ¿qué excepción del art. 36 de la LFPDPPP aplica a los datos del
   comprador y qué redacción lleva la cláusula? (A6, C8)
4. **Reparto de responsabilidad:** ¿cómo se reparte frente al vendedor ocasional? ¿La PROFECO podría
   considerar responsable a VendeIA como intermediario? (A7)
5. **Vendedor ocasional:** ¿cuándo deja de ser «proveedor» (LFPC art. 2 fr. II)? ¿Aplica el Código
   Civil Federal o el de la CDMX a sus vicios ocultos? (A8, C6)
6. **Ventas por plataforma y revocación:** ¿son «ventas fuera del establecimiento» (LFPC arts.
   51–56)? ¿Cómo aplica a recoger en persona? (A8, C6)
7. **Perecederos:** ¿aplica la excepción del art. 51 a la comida vendida por la plataforma? (A8, C6)
8. **Licencia de contenido:** redacción, duración y si el uso promocional fuera de VendeIA necesita
   permiso aparte. (A10)
9. **Revisión humana de la leyenda de riesgo:** ¿cae en el art. 26 fr. II de la LFPDPPP? ¿Basta la
   revisión a petición? (A16)
10. **Historial de sanciones:** plazo de conservación (¿72 meses, art. 10 párr. 3 LFPDPPP?). (A14)
11. **Marcas:** ¿hay puerto seguro para marcas? ¿Conviene aplicar el procedimiento de aviso y
    contra-aviso de la LFDA? (A15)
12. **Uso descriptivo de marcas ajenas** («compatible con»). (C12)
13. **Exclusión por causas ajenas** a la disponibilidad del servicio frente al art. 90 fr. II de la
    LFPC. (A18)
14. **Responsabilidad:** ¿resiste el art. 90 la frase «no responde por lo que incumpla quien vende»?
    ¿Tope solo frente a vendedores que actúan como negocio? (A19)
15. **Cambios a los términos:** ¿15 días naturales de aviso y «aceptar o cerrar la cuenta» bastan
    frente al art. 90 fr. I? (A20)
16. **Jurisdicción:** tribunales de la CDMX frente al domicilio del consumidor; reglas del Código
    Nacional de Procedimientos Civiles y Familiares; ¿someterse expresamente a la PROFECO? (A23)
17. **Registro del contrato de adhesión** ante la PROFECO: ¿hace falta? (A23)
18. **Reglas de contenido:** alcance frente a la libertad de expresión y precisión de «discurso de
    odio». (B2)
19. **Animales:** ¿se publicó en la Gaceta Oficial la reforma de mayo de 2026 de la CDMX? ¿Impone
    obligaciones a las plataformas? (C4)
20. **CBD y alcohol:** reglas y permisos si el fundador decide permitirlos más adelante. (C4)
21. **Comida casera:** permisos, aviso de funcionamiento (LGS art. 200 Bis), NOM-251 y etiquetado para
    quien cocina en casa y vende por internet en la CDMX. (C5)
22. **Servicios:** qué servicios requieren cédula profesional o permisos. (C5)
23. **Personajes y fan art:** licencias en artículos hechos a mano. (C5)
24. **Domicilio del vendedor persona física:** ¿puede dar uno distinto de su casa para reclamaciones
    (LFPC 76 BIS fr. III)? (C9)
25. **Comprobantes de autenticidad:** ¿consentimiento expreso por datos financieros? ¿Plazo máximo de
    conservación? (C11)
26. **Datos de quien manda un aviso de derechos:** compartirlos con quien publicó. (Anexo 1)
27. **Calificaciones y opiniones** (NMX 5.3.3): ¿son exigibles antes de abrir? (§0 #17)
28. **Teléfonos de la PROFECO y 911:** confirmar que siguen vigentes al publicar. (A23, B4)

**Contador ([VERIFICAR CON CONTADOR]):** con comisión 0 % y pago directo, ¿aplican la informativa
del art. 18-J fr. III de la LIVA y el art. 30-B del CFF? ¿Qué cambia al cobrar cualquier cosa? (A20,
A22, C10; preguntas de 00 §5.3)

---

## F. Fuentes

Todas consultadas el **2026-09-26**. Los números [1]–[36] son los de `00-marco-legal-2026.md` §11
(con su URL y fecha); aquí solo listamos las que usamos y los artículos que **volvimos a leer** para
este documento.

**Reusadas de `00-marco-legal-2026.md`:** [1] LFPDPPP (arts. 2, 7, 8, 10, 24, 26, 31, 35, 36);
[4] Lineamientos del Aviso de Privacidad (Décimo); [11] LFPC; [12] NMX-COE-001-SCFI-2018; [14]
PROFECO, guía para influencers; [15] PROFECO, Concilianet; [16] LFPPI; [17] LFDA; [19] Expansión,
AD 6/2025 (secundaria); [20] LIVA; [21] LISR; [22] LIF 2026; [23] CFF; [27] Código de Comercio;
[28] Código Civil Federal; [30] LGAMVLV; [33] OpenRouter, términos.

**Artículos que volvimos a leer en el texto oficial:**

- [11] LFPC, última reforma DOF 12-12-2025: arts. 1, 2, 7 BIS, 32, 51–56, 76 BIS, 76 BIS 1, 77, 78,
  79, 82, 83, 85, 86, 90, 92, 92 TER, 93 y 99. https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPC.pdf
- [12] NMX-COE-001-SCFI-2018 (el pie de página del PDF dice «NMX-COE-001-SCFI-2019»; confirmar la
  clave con el abogado): 3.12, 3.16, 4.4, 5.1.7, 5.2.1.1–5.2.1.14, 5.2.2, 5.3.2.1, 5.3.2.2, 5.3.3,
  5.3.6, 10 y 11. http://www.economia-nmx.gob.mx/normas/nmx/2010/NMX-COE-001-SCFI-2018.pdf
- [17] LFDA, última reforma DOF 14-05-2026: arts. 114 Octies y 232 Quinquies.
  https://www.diputados.gob.mx/LeyesBiblio/pdf/LFDA.pdf
- [28] Código Civil Federal, última reforma DOF 14-11-2025: arts. 450, 646, 2106, 2117, 2142 y 2149. https://www.diputados.gob.mx/LeyesBiblio/pdf/CCF.pdf

**Fuentes nuevas**

37. ✓ Texto oficial. Cámara de Diputados, _Ley General de Salud_, últimas reformas DOF 15-01-2026.
    Arts. 200 Bis, 217, 220, 226, 234, 235, 282 Ter a 282 Quinquies (capítulo adicionado DOF
    15-01-2026), 327, 376 y 414 Bis. https://www.diputados.gob.mx/LeyesBiblio/pdf/LGS.pdf
38. ✓ Texto oficial. Cámara de Diputados, _Constitución Política de los Estados Unidos Mexicanos_,
    últimas reformas DOF 02-06-2026. Art. 1o. (último párrafo) y art. 4o. (párrafo sobre
    cigarrillos electrónicos y vapeadores, adicionado DOF 17-01-2025).
    https://www.diputados.gob.mx/LeyesBiblio/pdf/CPEUM.pdf
39. ✓ Texto oficial. Cámara de Diputados, _Ley General para el Control del Tabaco_, última reforma
    DOF 17-02-2022. Arts. 16, 17 y 23. https://www.diputados.gob.mx/LeyesBiblio/pdf/LGCT.pdf
40. ✓ Texto oficial. Cámara de Diputados, _Ley Federal de Armas de Fuego y Explosivos_, última
    reforma DOF 29-05-2025. Arts. 37, 40, 41 y 41 Bis.
    https://www.diputados.gob.mx/LeyesBiblio/pdf/LFAFE.pdf
41. ✓ Texto oficial. Cámara de Diputados, _Código Penal Federal_, última reforma DOF 13-03-2026.
    Arts. 160, 161, 194, 199 Octies, 200, 202, 368 Bis, 368 Ter, 386, 420 y 424 bis.
    https://www.diputados.gob.mx/LeyesBiblio/pdf/CPF.pdf
42. ✓ Texto oficial. Cámara de Diputados, _Ley General de Vida Silvestre_, última reforma DOF
    16-07-2025. Arts. 51, 52 y 55. https://www.diputados.gob.mx/LeyesBiblio/pdf/LGVS.pdf
43. ✓ Texto oficial. Cámara de Diputados, _Ley Federal de Juegos y Sorteos_, DOF 31-12-1947 (el
    texto vigente no registra reformas). Arts. 2o. a 4o.
    https://www.diputados.gob.mx/LeyesBiblio/pdf/109.pdf
44. ✓ Oficial. DOF, _NOM-251-SSA1-2009, Prácticas de higiene para el proceso de alimentos, bebidas
    o suplementos alimenticios_. Numeral 1.2 (campo de aplicación). La página del DOF que leímos no
    deja clara la fecha de publicación **[VERIFICAR]**.
    https://dof.gob.mx/normasOficiales/3980/salud/salud.htm
45. ✓ Oficial. PROFECO, «Teléfono del Consumidor», gob.mx, 18-02-2021 (55 5568 8722 y
    800 468 8722). https://www.gob.mx/profeco/articulos/telefono-del-consumidor?idiom=es
46. ✓ Secundaria. El Universal, «Congreso de CDMX regula venta de perros y gatos por internet; solo
    podrán hacerlo quienes cuenten con registros para comercializar», 26 o 27-05-2026.
    https://www.eluniversal.com.mx/metropoli/congreso-de-cdmx-regula-venta-de-perros-y-gatos-por-internet-solo-podran-hacerlo-quienes-cuenten-con-registros-para-comercializar/
47. ✓ Secundaria. Excélsior, «CDMX prohíbe venta informal de perros y gatos en redes sociales»,
    27-05-2026. https://www.excelsior.com.mx/ciudad-de-mexico/cdmx-prohibe-venta-informal-perros-y-gatos-redes-sociales
48. ✓ Secundaria. Expansión Política, «CDMX prohíbe la venta de mascotas en lugares públicos, pero
    abre un nuevo mercado: las redes sociales», 17-01-2026 (cita el art. 28 Bis de la ley local).
    https://politica.expansion.mx/cdmx/2026/01/17/cdmx-prohibe-la-venta-mascotas-lugares-publicos-nuevo-mercado

**Documentos internos usados:** `docs/decisions.md` (ADR-014, ADR-030 a ADR-038),
`docs/plan-90-dias.md` §7.1–7.3, `docs/product-principles.md` (principios 5, 7 y 8; P12; P14),
`docs/security/auditoria-2026-09-26.md` (SEC-10, SEC-18, SEC-26, SEC-34),
`src/app/(legal)/terminos/page.tsx`, `src/app/(legal)/privacidad/page.tsx`,
`src/modules/trust/README.md`, `src/modules/ai/content-policy.ts`,
`src/modules/ai/proposal-numbers.ts`, `src/modules/catalog/schemas.ts`,
`src/modules/identity/seller-actions.ts`, `src/modules/identity/constants.ts` y
`prisma/schema.prisma`.
