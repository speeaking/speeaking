# Aviso de privacidad de Estreno: integral, simplificado y cookies (borrador)

> **BORRADOR PARA REVISIÓN LEGAL. NO PUBLICAR TAL CUAL.** Este texto lo preparó el equipo técnico
> el 2026-09-26 a partir del código de Estreno y de las fuentes de la Parte F. **No es asesoría
> legal.** Un abogado mexicano debe revisarlo antes de publicarlo en `/privacidad`.
>
> - **Base:** `docs/legal/00-marco-legal-2026.md` (marco legal) y el código en `main` a esta fecha.
>   Todo lo que el aviso dice del sistema lo verificamos en el código. La Parte D dice dónde.
> - **Datos que faltan:** siguen visibles hasta tenerlos. Son [NOMBRE O RAZÓN SOCIAL DEL
>   RESPONSABLE], [RFC], [DOMICILIO PARA OÍR Y RECIBIR NOTIFICACIONES], [CORREO DE PRIVACIDAD],
>   [CORREO DE SOPORTE], [FECHA DE ÚLTIMA ACTUALIZACIÓN] y otros marcados «pendiente».
> - **Convenciones:**
>   - el texto normal de las Partes A y B es el texto propuesto para publicar;
>   - los bloques «> **Nota interna**» no se publican;
>   - **[VERIFICAR CON ABOGADO]** marca una interpretación nuestra o un punto donde la ley no es
>     clara;
>   - **[REQUIERE CAMBIO EN CÓDIGO: …]** marca una frase que solo es cierta después de ese cambio.
>     **No se publica antes** (la Parte E.3 lista los cambios);
>   - `[n, art. x]` remite a las fuentes de la Parte F. Dentro del texto publicado pueden quedarse
>     como «artículo x de la LFPDPPP» o quitarse.

## Contenido

- **Parte A.** Aviso de privacidad integral (para `/privacidad`). Incluye la sección de cookies
  (§13).
- **Parte B.** Aviso simplificado para el registro, avisos en el momento de pedir cada dato y aviso
  visible de recolección automática.
- **Parte C.** Inventario de datos (tabla para el abogado y el equipo).
- **Parte D.** Dónde está cada hecho en el código.
- **Parte E.** Lista de cumplimiento, discrepancias, cambios de código previos y puntos para el
  abogado.
- **Parte F.** Fuentes.

### Hallazgos principales (para quien no lea todo)

1. **El aviso no se puede publicar hoy sin cambios de código.** Faltan:
   - la casilla de 18 años;
   - la personalización **sin marcar**;
   - el canal ARCO;
   - la casilla expresa de comprobantes;
   - llevar a producción `zdr: true` en el adaptador de IA (ya está en el árbol de trabajo, sin
     commit);
   - los plazos de conservación aplicados en código.

   La Parte E.3 los ordena.

2. **El borrador actual (`privacidad/page.tsx`) dice cosas que el código no hace:**
   - dice que la tienda recibe el **teléfono** del comprador. El código **nunca** se lo muestra; y
     el domicilio solo cuando el pago lo confirma la plataforma (`seller-order-dto.ts`);
   - promete «descargar y eliminar» desde Ajustes. **No existe** (SEC-26);
   - dice que el texto de IA se borra «por completo» a los 90 días. Se borra **la entrada**; el
     registro de uso y el resultado se quedan (`ai/retention.ts`).
3. **Hallazgos nuevos de esta revisión:**
   - el Reglamento de 2011 **obliga a informar** las decisiones sin intervención humana y a permitir
     pedir su **reconsideración** [2, art. 112]. Aplica a la leyenda de riesgo de falsificación;
   - las pruebas A/B **asignan grupo aunque la personalización esté apagada**. En ese caso no se
     mide a la persona, pero sí ve la variante (`platform/experiments.ts`);
   - las **marcas** que se piden en el registro **no se usan** en ningún lado
     (`identity/service.ts`). Por minimización [1, art. 12], conviene no pedirlas o darles un uso;
   - el checkout **guarda siempre** el domicilio nuevo en la libreta, sin preguntar. La NMX pide
     dejar decidir si se guarda [4, 8.1 c)].

---

## Parte A. Aviso de privacidad integral

**Aviso de privacidad integral de Estreno**

Última actualización: [FECHA DE ÚLTIMA ACTUALIZACIÓN] · Versión: [VERSIÓN, igual a
`LEGAL_VERSIONS.privacyNotice`]

Este aviso explica qué datos personales tratamos, para qué, con quién los compartimos, cuánto tiempo
los guardamos y cómo puedes ejercer tus derechos. Lo emitimos conforme a la Ley Federal de
Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) [1]. Si algo no queda
claro, escríbenos a [CORREO DE PRIVACIDAD].

**En resumen**

- No vendemos tus datos ni los usamos para publicidad de otras empresas.
- No usamos cookies de publicidad ni rastreadores de terceros.
- Tu perfil, tus publicaciones, tus comentarios y tus productos son públicos. Tu correo, tus
  domicilios, tu teléfono, tus búsquedas y tus compras no lo son.
- Tú decides en Ajustes si personalizamos tu feed y si apareces en sugerencias.
- Usamos un proveedor de inteligencia artificial en Estados Unidos solo para los textos de venta
  que tú pides y para una revisión opcional de autenticidad. La IA nunca decide sola ni sanciona.
- Estreno no cobra ni recibe el dinero de tus compras: pagas directo a la tienda.

### 1. Quién es responsable de tus datos

| Dato                             | Valor                                                                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Responsable                      | [NOMBRE O RAZÓN SOCIAL DEL RESPONSABLE]                                                                                       |
| Nombre comercial                 | Estreno (nombre provisional)                                                                                                  |
| RFC                              | [RFC]                                                                                                                         |
| Domicilio                        | [DOMICILIO PARA OÍR Y RECIBIR NOTIFICACIONES] (calle, número, colonia, alcaldía o municipio, código postal, ciudad y entidad) |
| Departamento de datos personales | [NOMBRE DE LA PERSONA O ÁREA DE DATOS PERSONALES], [CORREO DE PRIVACIDAD]                                                     |
| Soporte                          | [CORREO DE SOPORTE]                                                                                                           |

> **Nota interna.** El aviso debe traer la identidad y el domicilio del responsable [1, art. 15
> fr. I]. Si es persona física, va su **nombre completo**; si es moral, su razón social. El domicilio
> lleva al menos calle, número, colonia, ciudad, municipio o alcaldía, código postal y entidad, y es
> el de notificaciones [3, Vigésimo Primero]. Hay que designar a una persona o departamento que
> tramite las solicitudes [1, art. 29] y publicar sus datos de contacto [3, Vigésimo Octavo fr. II].
> El RFC no lo pide la LFPDPPP, pero sí la NMX para identificar al intermediario (ver `00`, §3.3).

### 2. Solo para mayores de 18 años

Estreno es para personas de 18 años o más. Al crear tu cuenta confirmas que tienes 18 años o más.
**[REQUIERE CAMBIO EN CÓDIGO: casilla obligatoria «Tengo 18 años o más» en el registro]**

No recabamos a sabiendas datos de menores de edad. Si sabemos que una cuenta es de una persona
menor, la desactivamos y borramos sus datos, salvo lo que la ley nos obligue a conservar. Si crees
que una persona menor usa Estreno, avísanos a [CORREO DE SOPORTE].

> **Nota interna.** La mayoría de edad y la capacidad para contratar están en el Código Civil
> Federal (ver `00`, §2.13). Qué nivel de verificación basta: **[VERIFICAR CON ABOGADO]**.

### 3. Qué datos personales tratamos

Los obtenemos de cuatro fuentes:

- de ti, cuando los escribes o los subes;
- de tu navegador, cuando usas Estreno;
- de otras personas usuarias, por ejemplo cuando alguien reporta tu publicación o te hace un
  pedido;
- de nosotros mismos, por ejemplo el nivel de riesgo que calculamos para un producto.

No compramos datos. No los obtenemos de otras redes sociales, de los contactos de tu teléfono ni de
otras empresas.

#### 3.1 Si tienes cuenta

1. **Cuenta:** nombre, correo y contraseña. La contraseña la guardamos solo transformada con una
   función de un solo sentido: nadie del equipo la puede ver.
2. **Perfil:** nombre de usuario, nombre visible y, si los agregas, biografía, foto, ciudad y estado.
3. **Lo que nos dices al registrarte:**
   - qué quieres hacer en Estreno (por ejemplo, comprar o vender);
   - al menos 3 comunidades;
   - las marcas que te gustan;
   - qué buscas ahora y, si quieres, hasta cuánto quieres gastar (presupuesto).
4. **Tus decisiones:** qué versión de los términos y de este aviso aceptaste y cuándo; si activaste
   la personalización y «Aparecer en sugerencias», con la fecha de cada cambio; y a qué personas
   quitaste de tus sugerencias.
5. **Datos técnicos de tu conexión:**
   - la dirección IP y el tipo de navegador o dispositivo de cada sesión;
   - la IP (o la red, en IPv6), para limitar intentos repetidos de inicio de sesión, registro,
     publicación y otras acciones.
6. **Tu actividad dentro de Estreno** (ver §6):
   - qué publicaciones te mostramos y cuáles aparecieron en tu pantalla;
   - clics, búsquedas, me gusta, guardados, comentarios, a quién sigues y «No me interesa»;
   - cuándo compartes y por qué canal;
   - a qué comunidades te unes y cuándo las visitaste por última vez;
   - productos que ves, tu carrito, pedidos iniciados y completados, y uso de «Sube y vende».
7. **Tu contenido:** publicaciones, comentarios y fotos. De cada foto quitamos la ubicación GPS y los
   demás metadatos.
8. **Tus reportes:** qué reportaste, el motivo y el texto que agregues.
9. **Lo que nos escribes:** solicitudes de derechos (ARCO), quejas y mensajes a soporte.

#### 3.2 Si compras

- **Domicilio de entrega:** nombre de quien recibe, calle, número exterior e interior, colonia,
  alcaldía o municipio, estado, código postal y referencias.
- **Teléfono de contacto** (10 dígitos).
- **Carrito y pedidos:** productos, cantidades, precios, forma de entrega, método de pago que
  elegiste, total, estado y fechas.

**No recabamos números de tarjeta, cuentas bancarias ni CLABE.** Estreno no cobra ni recibe el
dinero de tus compras: pagas directo a la tienda.

Si registras un domicilio o un teléfono de otra persona (por ejemplo, de quien recibe), asegúrate de
que esté de acuerdo.

#### 3.3 Si vendes

- **Tu tienda:** nombre, ciudad, estado y los métodos de pago que aceptas.
- **Tus productos:** todo lo que pones en la ficha y sus fotos. Eso incluye título, descripción,
  precio, existencias, categoría, condición, ciudad, estado, entrega, garantía, devoluciones y si
  declaras que es original.
- **Costo de tus productos:** es privado. Solo tú lo ves; nunca se muestra a quien compra ni se le
  envía al proveedor de inteligencia artificial.
- **Lo que escribes en «Sube y vende»** y los textos de tu kit de anuncios.
- **Fotos de comprobante de compra** (ticket, factura, empaque o número de serie), si declaras que
  un producto es original y te las pedimos. Son privadas.
- **Revisión de autenticidad de tus productos:** nivel de riesgo, señales, estado y notas del equipo
  (ver §6.2).
- **Cifras de tu tienda:** visitas, carrito, ventas y de dónde llegaron. Siempre agregadas: nunca te
  decimos quién visitó un producto.
- **Pedidos que recibes.**

#### 3.4 Datos sensibles

No te pedimos datos personales sensibles. Son los que pueden revelar, por ejemplo, origen étnico,
estado de salud, creencias religiosas, opiniones políticas o preferencia sexual [1, art. 2 fr. VI].
Las comunidades de Estreno no tratan esos temas.

Te pedimos no escribir datos sensibles, tuyos ni de nadie, en publicaciones, comentarios, reportes o
«Sube y vende».

> **Nota interna.** Riesgo residual: el historial de búsquedas o de compras de ciertos productos
> (p. ej., de salud) podría revelar un dato sensible. Hoy no hay categorías de salud; si se agregan,
> revisar. **[VERIFICAR CON ABOGADO]**. Una base con datos sensibles pide consentimiento expreso y
> por escrito [1, art. 8].

#### 3.5 Datos financieros o patrimoniales

Estos datos que tratamos pueden considerarse financieros o patrimoniales:

- **(a)** el presupuesto opcional que nos das al registrarte;
- **(b)** el costo de tus productos, si vendes;
- **(c)** las fotos de comprobante de compra, que pueden mostrar montos, forma de pago o dígitos de
  una tarjeta;
- **(d)** los montos y el método de pago de tus pedidos.

Para (a) y (c) te pedimos tu consentimiento expreso antes de guardarlos. **[REQUIERE CAMBIO EN
CÓDIGO: casilla sin marcar al subir comprobantes; texto junto al campo de presupuesto (Parte B.2)]**
Para (b) y (d) no lo pedimos: son necesarios para el servicio que tú solicitas [1, art. 9 fr. IV].

En tus comprobantes, tapa los datos de pago que no hagan falta, como los números de tarjeta.

> **Nota interna.** Los datos financieros o patrimoniales piden consentimiento **expreso**, salvo
> las excepciones de los arts. 9 y 36 [1, art. 7 párr. 5; 2, art. 15 fr. II]. El consentimiento
> expreso puede darse por medios electrónicos o por «signos inequívocos» [1, art. 7 párr. 2].
> Escribir un presupuesto opcional junto a una explicación clara podría bastar. Qué datos entran en
> la categoría y cómo pedir el consentimiento: **[VERIFICAR CON ABOGADO]**.

### 4. Para qué usamos tus datos

#### 4.1 Finalidades necesarias

Son las que dan origen a tu relación con Estreno. Sin ellas no podemos darte el servicio:

1. **Cuenta y seguridad:** crear, mantener y proteger tu cuenta; iniciar y cerrar sesiones; mostrarte
   dónde está abierta tu cuenta.
2. **Red social:** mostrar tu perfil y tu contenido, y permitirte publicar, comentar, seguir, dar me
   gusta, guardar, unirte a comunidades, buscar y compartir.
3. **Orden básico del feed:** ordenar el feed y las comunidades con lo que tú eliges (tus
   comunidades, a quién sigues, lo que nos dijiste que buscas) y con la actividad general de cada
   publicación (ver §6.1).
4. **Compras y ventas:** carrito, pedidos, entrega y comunicación del pedido a la tienda (ver §8.2).
5. **Herramientas de venta que tú pides:** «Sube y vende» y el kit de anuncios (ver §7).
6. **Prevención de fraudes, falsificaciones y abusos:**
   - limitar intentos repetidos;
   - revisar el riesgo de imitación de los productos (§6.2);
   - atender reportes y moderar;
   - llevar la bitácora de las acciones del equipo.
7. **Atención y cumplimiento:** atender tus solicitudes de derechos, quejas y mensajes; avisarte de
   cambios en tu cuenta y en los documentos legales; cumplir la ley y las órdenes de autoridad.
8. **Prueba de aceptación:** registrar qué versión de los términos y de este aviso aceptaste, y
   cuándo.

> **Nota interna.** Base: la relación jurídica con el titular [1, art. 9 fr. IV] y el consentimiento
> tácito cuando se pone a disposición el aviso [1, art. 7 párr. 3 y 4]. Las finalidades necesarias
> deben distinguirse de las que no lo son [1, art. 15 fr. III; 2, art. 41; 3, Vigésimo Cuarto
> fr. IV].

#### 4.2 Finalidades secundarias (puedes negarte)

No son necesarias para el servicio. Puedes negarte o cambiar de opinión cuando quieras, y seguir
usando Estreno [2, arts. 14 y 42]:

| #   | Finalidad                                                                                                                                         | Cómo decides                                                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | **Personalizar tu feed y tus recomendaciones con tu actividad** (productos que viste, abriste, guardaste o agregaste al carrito, y tus búsquedas) | En el registro eliges «Sí» o «No», sin respuesta marcada de antemano **[REQUIERE CAMBIO EN CÓDIGO]**. Después, en Ajustes → «Personalizar mi feed». Si la desactivas, también desligamos de tu cuenta la actividad anterior. |
| S2  | **Sugerirte personas para seguir y sugerir tu perfil a otras personas** («Gente de tus comunidades»)                                              | Ajustes → «Aparecer en sugerencias». Si no te interesa una persona, toca «Quitar».                                                                                                                                           |
| S3  | **Medir y mejorar Estreno con tu actividad ligada a tu cuenta**, incluidas las pruebas de cambios al feed (§6.3)                                  | Va junto con S1: si desactivas la personalización, tu actividad deja de ligarse a tu cuenta y no se usa para medir pruebas.                                                                                                  |

También puedes negarte a cualquiera de estas finalidades escribiendo a [CORREO DE PRIVACIDAD].

> **Nota interna.**
>
> - El mecanismo para negarse debe estar disponible **antes** de tratar los datos [3, Vigésimo
>   Quinto]. Hoy se cumple para S1: antes de terminar el registro, la actividad se guarda anónima
>   (`analytics/personalization.ts`).
> - Pero la casilla de S1 viene **marcada** (`onboarding-form.tsx`, `defaultChecked`). Las casillas
>   de consentimiento no se deben marcar previamente [3, Décimo fr. IV]. Además, la NMX pide
>   consentimiento **con un mecanismo previo** para perfilar [4, 5.4.1]. Hay que quitar la marca.
> - S2 está **activado por omisión** (`discoverable @default(true)`). Es un mecanismo de negativa,
>   no de consentimiento. La NMX considera buena práctica que la opción más protectora venga por
>   omisión [4, 8.1 b)]. Decisión del fundador con el abogado **[VERIFICAR CON ABOGADO]**.

#### 4.3 Lo que no hacemos

- No vendemos ni rentamos tus datos.
- No mostramos publicidad de otras empresas ni compartimos tus datos con anunciantes.
- Hoy no te enviamos publicidad por correo ni por teléfono. Si algún día lo hacemos, te pediremos
  permiso por separado y podrás darte de baja en cualquier momento.
- No entrenamos modelos de inteligencia artificial con tus datos, y le pedimos al proveedor que
  tampoco lo haga (§7).
- La inteligencia artificial nunca modera ni sanciona.
- No usamos datos de otras aplicaciones ni de otras redes sociales.

> **Nota interna.** Las finalidades de mercadotecnia deben listarse si existen [2, art. 30; 3,
> Vigésimo Cuarto fr. III]; hoy no existen. Una **finalidad nueva** pide consentimiento nuevo y
> actualizar el aviso **antes** de usarla [1, art. 11]. Casos previstos en el plan (`00`, §2.3):
>
> - evaluar la IA con textos reales;
> - una cookie de origen;
> - el parámetro `?r=`;
> - «Impulsar» (P12).

### 5. Qué es público y qué no

**Público** (cualquiera lo ve, también sin cuenta, y los buscadores pueden indexarlo):

- tu perfil: nombre visible, nombre de usuario, foto, biografía y ciudad si la pones;
- el **número** de personas que te siguen y que sigues (no la lista);
- tus publicaciones, comentarios y productos;
- si vendes: el nombre de tu tienda y la ciudad y el estado de tus productos (nunca tu domicilio).

**Nunca es público:**

- tu correo, tu teléfono y tus domicilios;
- tus búsquedas, tu carrito y tus compras;
- a quién le diste me gusta y lo que guardaste;
- el costo de tus productos;
- tus fotos de comprobante;
- los reportes que haces: quien publica o vende nunca sabe quién lo reportó ni cuántas personas lo
  hicieron.

### 6. Personalización, pruebas y decisiones automatizadas

Algunas cosas de Estreno las decide un programa sin que una persona las revise antes. Aquí te
decimos cuáles, con qué datos y qué puedes hacer [2, art. 112].

Ninguna de ellas cierra tu cuenta, te sanciona ni decide sobre tus pagos. Eso lo decide siempre una
persona del equipo.

#### 6.1 Orden del feed

- **Qué hace:** ordena publicaciones y productos con una fórmula que se puede explicar. Combina qué
  tan reciente es cada publicación, su actividad general (me gusta, comentarios y guardados) y su
  afinidad contigo. Después mezcla contenido y productos.
- **Datos que usa siempre:**
  - las comunidades en las que estás;
  - las personas que sigues;
  - lo que nos dijiste que buscas y tu presupuesto. Con el presupuesto marcamos «En tu
    presupuesto»; lo calcula el sistema, no una persona.
- **Datos que usa solo con la personalización activada:** las categorías de los productos que viste,
  abriste, guardaste o agregaste al carrito, y tus búsquedas de los **últimos 14 días**.
- **Efecto:** decide qué ves primero. No decide precios ni qué puedes comprar.
- **Qué puedes hacer:**
  - leer la razón de una tarjeta: «Porque buscas…» o «Porque buscaste…»;
  - usar «No me interesa»;
  - ver solo «Siguiendo»;
  - desactivar la personalización;
  - borrar tu historial de búsqueda o los gustos que nos declaraste.
- **Si vendes:** tus productos se ordenan con las mismas reglas para todas las tiendas.

#### 6.2 Riesgo de falsificación de productos

- **Qué hace:** reglas automáticas calculan un nivel de riesgo de imitación (bajo, medio o alto)
  para cada producto. Mide riesgo: no acusa a nadie ni certifica nada.
- **Datos que usa:**
  - el precio, comparado con productos parecidos de al menos 5 tiendas o con un precio de
    referencia;
  - palabras como «réplica» junto a una marca;
  - si la tienda declara que el producto es original;
  - la antigüedad de la tienda y cuántas ventas ha completado;
  - los reportes de personas distintas (los descartados no cuentan);
  - la señal opcional de inteligencia artificial (§6.4).

  Guardamos el resultado, las señales que se activaron y la versión de las reglas.

- **Efectos automáticos:**
  - con riesgo medio, quien compra ve una nota neutral en la ficha («Revisa: …»);
  - a lo declarado como original se le puede pedir un comprobante;
  - con riesgo alto sin declararse original, se pide corregir la publicación;
  - los productos con riesgo entran a la cola del equipo.
- **Lo que siempre decide una persona:** ocultar un producto, dar por revisado un comprobante y
  rechazar la declaración de original.
- **Tus derechos si vendes:**
  - saber qué señales se activaron y con qué datos;
  - corregir un dato inexacto;
  - pedir que una persona revise el resultado y oponerte a él.

  Escribe a [CORREO DE PRIVACIDAD] o usa «Pedir revisión» en el producto **[REQUIERE CAMBIO EN
  CÓDIGO]**. Respondemos en los plazos de §10.5.

> **Nota interna.**
>
> - El Reglamento obliga a **informar** que hay decisiones sin intervención humana. También permite
>   acceder a los datos usados, rectificarlos y pedir la **reconsideración** [2, art. 112]. Los
>   Lineamientos piden avisarlo antes del proceso [3, Anexo, Sexto].
> - Además, la ley da derecho de oposición al tratamiento automatizado que evalúa, sin intervención
>   humana, la «fiabilidad o comportamiento» y afecta de forma significativa [1, art. 26 fr. II].
> - Si la leyenda cae en el art. 26 fr. II, y si basta la revisión humana a petición: **[VERIFICAR
>   CON ABOGADO]**.

#### 6.3 Pruebas de cambios al feed y mejora automática

- **Qué hace:** cada día calculamos cifras **agregadas** de la plataforma. Por ejemplo:
  - publicaciones que se vieron en pantalla;
  - interacciones;
  - reportes;
  - visitas a productos por tienda activa.

  Con esas cifras, un programa propone ajustes a los parámetros del feed (por ejemplo, cuántos
  productos se mezclan). Después:
  - prueba los ajustes con dos grupos (prueba A/B);
  - aplica solo los de riesgo bajo, dentro de límites fijos;
  - los revierte solo si algo empeora.

  Adoptar un cambio después de una prueba lo aprueba una persona. Los pagos, precios, comisiones y
  gastos quedan fuera de su alcance.

- **Nunca decide sobre una persona o una cuenta en particular.**
- **Cómo se asigna el grupo:**
  - si tienes sesión, un cálculo con el identificador de tu cuenta y el de la prueba te asigna, de
    forma estable, al grupo de control o al de cambio. No usa ningún otro dato tuyo;
  - te puede tocar un grupo **aunque tengas la personalización desactivada**. Verás la variante,
    pero tu actividad no se liga a tu cuenta ni se usa para medir la prueba;
  - sin sesión, siempre ves la versión normal.
- **Qué guardamos:** con la personalización activada, junto con cada publicación que aparece en tu
  pantalla guardamos el grupo que te tocó.
- **La inteligencia artificial solo redacta:** puede recibir las cifras agregadas, que no identifican
  a nadie, para escribir la explicación de una propuesta. No recibe datos de ninguna persona.

> **Nota interna.** ¿Hace falta una forma de salir de las pruebas para quien desactivó la
> personalización? Son cambios de parámetros del producto, dentro de límites, sin efectos
> individuales. **[VERIFICAR CON ABOGADO]**.

#### 6.4 Señal opcional de inteligencia artificial en la revisión de autenticidad

Por omisión está **apagada**. Si la activamos, funciona así:

- solo se usa cuando las reglas ya encontraron alguna señal de riesgo en un producto;
- le enviamos al proveedor de inteligencia artificial el título, la descripción y las etiquetas del
  producto, que ya son públicos. Antes les quitamos correos, teléfonos, ligas y cuentas;
- no le enviamos fotos, el costo, tu nombre ni tus datos de contacto;
- guardamos su respuesta (si el texto sugiere una imitación, qué tan segura está y una razón
  breve), el modelo y la fecha;
- solo puede sumar un poco al riesgo que ya encontraron las reglas. Nunca decide sola, y un producto
  de riesgo bajo no pasa a riesgo alto por ella.

### 7. Inteligencia artificial

#### 7.1 Para qué la usamos

- **«Sube y vende»:** te propone cómo vender un producto a partir de lo que escribes. Las cifras (el
  rango de precio, por ejemplo) las calcula el sistema; la IA solo redacta.
- **«Kit de anuncios»:** escribe textos para promocionar tu producto con los datos públicos de la
  ficha: nombre, descripción, etiquetas, precio, categoría, condición, ciudad y estado, entrega,
  garantía y devoluciones.
- **Revisión de autenticidad**, solo si se activa (§6.4).
- **Explicaciones internas** del motor de mejora, solo con cifras agregadas (§6.3).

Todo lo que escribe la IA se marca «Creado con ayuda de IA», y tú lo revisas antes de publicarlo.

#### 7.2 Qué le enviamos y qué no

- **Sí le enviamos:** tu texto, sin correos, teléfonos, ligas, usuarios de redes ni números de
  cuenta o tarjeta, y los datos del producto que confirmas o que ya son públicos.
- **Nunca le enviamos:** el costo de tu producto (lo quitamos también de tu texto), tu nombre, tu
  correo, tus domicilios ni datos de tus clientes.

No escribas datos personales de nadie en esos textos.

#### 7.3 Quién la procesa y dónde

- **Enrutador:** **OpenRouter, Inc.**, en Estados Unidos, que opera en Google Cloud en regiones de
  ese país [6][7]. Es un encargado: trata los datos solo para darnos el servicio.
- **Modelo:** OpenRouter pasa la solicitud al proveedor del modelo que elegimos. Ese proveedor puede
  estar en Estados Unidos o en otro país: [LISTA DE PROVEEDORES DE MODELO PERMITIDOS Y SUS PAÍSES —
  pendiente].
- **Nuestras protecciones en cada solicitud:**
  - pedimos solo proveedores que no guardan los datos ni entrenan con ellos;
  - pedimos retención cero: la solicitud no se guarda después de responderse **[REQUIERE CAMBIO EN
    CÓDIGO: `zdr: true` está en el árbol de trabajo sin commit al 2026-09-26; confirmar que llegue a
    producción]**.
- **Lo que dice OpenRouter:** no entrena con lo que le enviamos ni con lo que responde [6]; con
  retención cero no guarda la solicitud después de responderla [7]; nos avisa de un incidente de
  seguridad en un máximo de 72 horas [7].

> **Nota interna.**
>
> - El DPA de OpenRouter se incorpora al aceptar sus términos [7]. Avisa con 30 días de los
>   subencargados nuevos, **excepto los proveedores de modelos** [7].
> - El Reglamento pide que el responsable **autorice** toda subcontratación; la autorización puede
>   ir en el contrato [2, arts. 54 y 55].
> - Para la nube por adhesión, el proveedor debe transparentar sus subcontrataciones [2, art. 52
>   fr. I b)].
> - Si basta la autorización general del DPA, con proveedores de modelos que cambian sin aviso:
>   **[VERIFICAR CON ABOGADO]**.
> - Recomendación técnica: fijar en la configuración una lista cerrada de proveedores de modelo y
>   publicarla aquí con sus países.
> - Sin nombre y país del proveedor **no se activa** `AI_PROVIDER=openai_compatible` (ADR-038).

#### 7.4 Qué guardamos

- Guardamos tu texto ya sin datos de contacto ni cuentas. **A los 90 días lo borramos** y dejamos
  solo una marca de que existió.
- Conservamos el registro de uso (fecha, función, modelo, tokens, costo y resultado de la
  solicitud), para controlar el gasto y los límites de uso.
- El texto que generó la IA (la propuesta o el kit) se queda en tu cuenta para que lo uses. Si
  eliminas tu cuenta, lo borramos **[REQUIERE CAMBIO EN CÓDIGO: SEC-26]**.
- Para elegir modelos los probamos con casos ficticios. Si algún día usamos textos reales, será con
  tu permiso y sin datos personales.

### 8. Con quién compartimos tus datos

#### 8.1 Proveedores que tratan datos por nuestra cuenta (encargados)

Estos proveedores tratan tus datos **solo para darnos su servicio** y con las instrucciones que les
damos. Están obligados por contrato a guardar confidencialidad, proteger los datos y borrarlos al
terminar [2, arts. 50 y 51].

Todos están **fuera de México**. Tus datos viajan a otros países, principalmente a Estados Unidos.
Estas comunicaciones con encargados no requieren tu consentimiento, pero te las informamos por
transparencia [2, art. 53; 3, Vigésimo Sexto].

| Proveedor                                        | Para qué                                                            | Qué datos                                                                                                       | Dónde                                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Vercel Inc.**                                  | Alojar y ejecutar la plataforma; tareas programadas diarias         | Todo lo que pasa por la plataforma al usarla y los registros técnicos (IP, navegador, páginas pedidas, errores) | Estados Unidos: región `iad1`, Washington, D.C. [10][11]                                          |
| **Neon** (Neon, LLC, parte de Databricks)        | Base de datos                                                       | Todos los datos de §3, salvo los archivos de las fotos                                                          | Estados Unidos: AWS `us-east-1`, Virginia del Norte [12] **[VERIFICAR región real del proyecto]** |
| **Cloudflare, Inc.** (R2)                        | Guardar las fotos, públicas y privadas (incluidos los comprobantes) | Archivos de imagen, ya sin ubicación ni metadatos                                                               | [PAÍS — pendiente; recomendado: jurisdicción «US»] [14]                                           |
| **OpenRouter, Inc.** y el proveedor del modelo   | Inteligencia artificial (§7)                                        | Textos sin datos de contacto; datos públicos de productos; cifras agregadas                                     | Estados Unidos (OpenRouter) [6][7]; proveedor del modelo: [PAÍS — pendiente]                      |
| [PROVEEDOR DE CORREO: NOMBRE Y PAÍS — pendiente] | Enviar correos de tu cuenta (verificación, avisos, respuestas)      | Tu correo y el mensaje                                                                                          | [PAÍS — pendiente]. **Hoy no enviamos correos**; lo nombraremos aquí antes de hacerlo.            |

No usamos procesador de pagos, analítica externa, publicidad ni servicios de reporte de errores de
terceros. Si agregamos uno, lo nombraremos aquí antes de activarlo.

> **Nota interna.**
>
> - **Vercel:** su DPA aplica automáticamente a los planes **Pro y Enterprise** [11]. Usar Pro
>   (**[VERIFICAR CON ABOGADO]** si el plan gratuito permite uso comercial y qué contrato lo cubre).
> - **Cloudflare:** su DPA forma parte del contrato también en planes de autoservicio [15].
> - **Neon:** sus términos de producto se aceptan al usar el servicio [13]. Revisar que incluyan
>   las obligaciones del Reglamento, art. 52 **[VERIFICAR CON ABOGADO]**.
> - **R2:** con ubicación «automática», un bucket queda cerca de quien lo crea y **no garantiza
>   país**. La jurisdicción «US» sí garantiza que los objetos se guarden ahí [14]. Crear el bucket
>   con esa jurisdicción y ponerla en la tabla.
> - La regla «nombrarlos por nombre y país» no la exige la ley para encargados [2, art. 53; 3,
>   Vigésimo Sexto]. La mantenemos por transparencia y porque la NMX pide informar el tratamiento
>   para perfilar [4, 5.4.1].

#### 8.2 Transferencias a otras personas o empresas

| Quién recibe                                                                                                        | Qué datos                                                                                                                                                                                                                         | Para qué                                      | ¿Necesita tu consentimiento?                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **La tienda a la que le compras** (en México)                                                                       | Tu nombre visible, qué pediste, cantidades, total y forma de entrega. Si el pago se confirma a través de Estreno, también el domicilio de entrega, **sin tu teléfono**, solo mientras el pedido está pagado, enviado o entregado. | Preparar y entregar tu pedido                 | No: es necesaria para el contrato que celebras con la tienda y para darte el servicio [1, art. 36 fr. IV y VII] **[VERIFICAR CON ABOGADO cuál aplica]** |
| **Autoridades competentes** (por ejemplo, fiscalías, jueces, SAT, IMPI, PROFECO o la autoridad de datos personales) | Los datos que ordene la ley o el mandamiento                                                                                                                                                                                      | Cumplir la ley o una orden fundada y motivada | No [1, art. 36 fr. I, V y VI; art. 9 fr. VII]                                                                                                           |

**Mientras Estreno no procese pagos** (hoy pagas directo a la tienda), la tienda solo ve tu nombre
visible y lo que pediste. La entrega la acuerdas directamente con ella.

La tienda que recibe tus datos asume las mismas obligaciones que nosotros y solo puede usarlos para
tu pedido [1, art. 35]. Tampoco pasamos tu información a otras tiendas ajenas a tu compra sin tu
autorización expresa [5, art. 76 BIS fr. I].

**Cláusula de transferencias.** Las transferencias de esta tabla no requieren tu consentimiento
[1, art. 36]. No hacemos otras. Si alguna vez necesitamos hacer una que sí lo requiera, te la
explicaremos y te pediremos permiso por separado, con una casilla sin marcar, antes de hacerla
[1, art. 35 párr. 2; 3, Vigésimo Séptimo].

> **Nota interna.**
>
> - Hoy el domicilio solo sale del servidor con un pago real (`seller-order-dto.ts`). El teléfono
>   nunca sale. Al cancelarse el pedido, se borra la copia del domicilio (`commerce/checkout.ts`).
>   **El borrador actual dice que la tienda recibe el teléfono: corregirlo.**
> - Si el flujo del piloto cambia (p. ej., mostrarle a la tienda el domicilio o el teléfono con pago
>   directo), actualizar esta tabla **antes**.
> - Los datos del **vendedor** que verá el comprador para reclamaciones (domicilio y teléfono,
>   LFPC 76 BIS fr. III) todavía no se muestran (plan §7.1). Cuando se muestren, entran aquí con el
>   consentimiento del vendedor.

### 9. Cómo limitar el uso de tus datos

Además de tus derechos (§10), puedes limitar el uso y la divulgación de tus datos así:

- **En Ajustes, con efecto inmediato:**
  - desactivar «Personalizar mi feed»;
  - desactivar «Aparecer en sugerencias»;
  - borrar tu historial de búsqueda;
  - borrar los gustos y el presupuesto que nos declaraste;
  - cerrar tu sesión en todos tus dispositivos.
- **En el feed:** «Quitar» una sugerencia y «No me interesa».
- **En tu navegador:** borrar las cookies y el almacenamiento del sitio (§13). Si borras la cookie de
  sesión, se cierra tu sesión.
- **Con lo que publicas:** no publiques datos que no quieras que sean públicos (§5).
- **Por correo:** pedir a [CORREO DE PRIVACIDAD] que no usemos tus datos para una finalidad
  secundaria.

### 10. Tus derechos: acceso, rectificación, cancelación y oposición (ARCO), y revocación

#### 10.1 Qué puedes pedir

- **Acceso:** saber qué datos tuyos tenemos y cómo los tratamos.
- **Rectificación:** corregir datos inexactos o incompletos.
- **Cancelación:** que borremos tus datos.
- **Oposición:** que dejemos de tratarlos por una causa legítima, o que no los usemos en un
  tratamiento automatizado que te afecte de forma significativa (§6).
- **Revocación:** retirar el consentimiento que nos diste.

Ejercer un derecho no te impide ejercer otro [1, arts. 21–26].

#### 10.2 Lo que ya puedes hacer tú en Ajustes

- Personalización y sugerencias: activar o desactivar.
- Historial de búsqueda y gustos declarados: ver y borrar.
- Sesiones: ver dónde está abierta tu cuenta y cerrarla en todos lados.
- Productos: editar sus datos cuando quieras.

Descargar tus datos y eliminar tu cuenta desde Ajustes **todavía no está disponible**. Mientras
tanto, pídelo por correo y lo hacemos nosotros dentro de los plazos de §10.5. **[REQUIERE CAMBIO EN
CÓDIGO: exportación y borrado de cuenta, SEC-26; mientras no exista, el procedimiento manual de
E.3]**

#### 10.3 Cómo presentar una solicitud

Escribe a [CORREO DE PRIVACIDAD] **desde el correo de tu cuenta**. Es gratis. Tu solicitud debe
incluir [1, art. 28]:

1. tu nombre y el correo u otro medio donde quieres recibir la respuesta;
2. lo que acredite tu identidad (§10.4) o, si eres representante, la tuya y la de la persona
   titular;
3. qué datos son, descritos con claridad (no hace falta si pides acceso);
4. qué derecho ejerces o qué pides;
5. cualquier cosa que nos ayude a encontrar tus datos, como tu nombre de usuario.

Si pides una **rectificación**, di qué dato hay que corregir y cómo, y envía el documento que lo
respalde, si hace falta [1, art. 30].

#### 10.4 Cómo comprobamos que eres tú

- **Con tu cuenta:** si escribes desde el correo de tu cuenta, te pediremos confirmar la solicitud
  desde tu sesión en Estreno o con un código que te enviemos. Con eso damos por acreditada tu
  identidad **[VERIFICAR CON ABOGADO]**. No te pedimos una identificación oficial si no hace falta.
- **Si no puedes entrar a tu cuenta, o si actúa un representante:** te pediremos una copia de una
  identificación oficial vigente. Puedes tapar los datos que no sirven para identificarte (por
  ejemplo, la CURP o el domicilio).
- **Representantes:** además, deben acreditar su representación con instrumento público, carta
  poder firmada ante dos testigos o declaración en comparecencia de la persona titular [2, art. 89].
- **Qué hacemos con la copia:** la usamos solo para tu solicitud y la borramos al cerrarla,
  [PLAZO — pendiente] **[VERIFICAR CON ABOGADO]**.

> **Nota interna.** El Reglamento admite como acreditación la copia de identificación con cotejo del
> original, los instrumentos electrónicos que identifiquen «fehacientemente» y los mecanismos de
> autenticación «previamente establecidos por el responsable» [2, art. 89 fr. I]. Estreno no conoce
> la identidad civil de nadie (el nombre es libre), así que controlar la cuenta es la prueba más
> fuerte que tenemos. Pedir identificaciones a todos crearía una base de datos más riesgosa.

#### 10.5 Plazos

Todos los plazos son en **días hábiles** [1, art. 2 fr. VIII]:

| Paso                                                       | Plazo                                                                                          | Fuente                   |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------ |
| Acuse de recibo con la fecha en que recibimos tu solicitud | Al recibirla                                                                                   | [2, art. 95]             |
| Si falta información, te la pedimos una sola vez           | Dentro de 5 días; tienes 10 días para responder                                                | [2, art. 96]             |
| Te decimos si procede                                      | Máximo 20 días desde que la recibimos (o desde que completaste la información)                 | [1, art. 31; 2, art. 96] |
| Si procede, lo hacemos efectivo                            | Máximo 15 días desde que te respondimos                                                        | [1, art. 31]             |
| Ampliación                                                 | Una sola vez por un periodo igual, con justificación que te avisamos dentro del plazo original | [1, art. 31; 2, art. 97] |

Te respondemos por el mismo medio por el que nos escribiste [1, art. 33].

#### 10.6 Cómo te entregamos tus datos (acceso)

Te los enviamos en un archivo electrónico legible (por ejemplo, PDF, CSV o JSON) por correo o en una
descarga segura. Te explicamos cualquier código o clave que aparezca [1, art. 32; 2, arts. 98 y 102].

Es gratis. Solo cobraríamos el costo de reproducción o envío si pides un medio físico [1, art. 34].

#### 10.7 Cancelación

Si procede, primero **bloqueamos** tus datos: los guardamos sin usarlos, solo para responder por
posibles responsabilidades, durante el plazo de prescripción que aplique. Después los **suprimimos**
y te avisamos [1, art. 24; 2, art. 107]. El plazo de bloqueo es [PLAZO — pendiente]; **[VERIFICAR
CON ABOGADO]** qué plazo de prescripción aplica.

Qué pasa con cada cosa si cancelas tu cuenta:

- se borran tu perfil, tus publicaciones, tus comentarios, tus fotos, tus domicilios y tus productos;
- los reportes que hiciste se conservan **sin ligarse a ti**;
- las cifras agregadas y la actividad ya anónima se quedan, porque ya no te identifican.

Podemos negar una cancelación en los casos de la ley [1, art. 25]. Por ejemplo:

- datos de un pedido que siguen siendo necesarios para cumplirlo;
- datos que la ley nos obliga a conservar;
- datos necesarios para actuaciones judiciales o administrativas.

#### 10.8 Oposición

Puedes oponerte al tratamiento por causa legítima, o a un tratamiento automatizado que te afecte de
forma significativa (§6.2) [1, art. 26]. No procede cuando el tratamiento es necesario para cumplir
una obligación legal.

#### 10.9 Revocación del consentimiento

- **Personalización y sugerencias:** revócalas en Ajustes; el cambio es inmediato.
- **Otros consentimientos:** escribe a [CORREO DE PRIVACIDAD], con los mismos requisitos, medios de
  identificación y plazos de §10.3 a §10.5.
- **Efectos:** la revocación no tiene efectos hacia atrás [1, art. 7 párr. 6]. Excepción: al
  desactivar la personalización, **también** desligamos de tu cuenta la actividad anterior.
- **Finalidades necesarias:** si revocas el consentimiento para una finalidad necesaria (§4.1), no
  podremos seguir dándote el servicio y cancelaremos tu cuenta.

#### 10.10 Si te negamos una solicitud o no te respondemos

Si negamos tu solicitud, te explicamos el motivo con las pruebas que correspondan [1, art. 33].

Si no estás de acuerdo con la respuesta, o no te respondemos, puedes pedir protección de tus
derechos a la **Secretaría Anticorrupción y Buen Gobierno**, que es la autoridad en la materia
[1, art. 2 fr. XV]:

- el plazo es de **15 días hábiles** desde que te comunicamos la respuesta; si no te respondimos,
  puedes pedirla desde que venció nuestro plazo [1, art. 40];
- la Secretaría resuelve en un máximo de **50 días hábiles** [1, art. 42].

> **Nota interna.** El medio o portal de la SABG para presentar la solicitud de protección no lo
> encontramos en las fuentes leídas **[VERIFICAR CON ABOGADO]**. Informar este derecho es
> buena práctica [3, Anexo, Séptimo] y obligatorio al negar [2, art. 100].

### 11. Cuánto tiempo guardamos tus datos

| Dato                                                                 | Cuánto tiempo                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cuenta, perfil y contenido                                           | Mientras tengas tu cuenta. Si la cancelas, se aplica §10.7.                                                                                                                                                                                             |
| Sesiones (con su IP y su navegador)                                  | Hasta que cierres sesión o hasta 30 días sin usarla.                                                                                                                                                                                                    |
| IP y contadores para limitar intentos                                | Lo que dura su ventana: de minutos a 7 días.                                                                                                                                                                                                            |
| Código para no contar dos veces una publicación vista                | 25 horas como máximo.                                                                                                                                                                                                                                   |
| Actividad ligada a tu cuenta (incluidas las publicaciones que viste) | Mientras tengas la cuenta y la personalización activada. Plazo máximo: [PLAZO — pendiente; propuesta: 180 días y después solo cifras agregadas] **[REQUIERE CAMBIO EN CÓDIGO]**. Al desactivar la personalización se desliga toda, también la anterior. |
| Actividad anónima (sin cuenta o sin personalización)                 | [PLAZO — pendiente] **[REQUIERE CAMBIO EN CÓDIGO]**. No se liga a nadie: se guarda sin cuenta, sin texto de búsqueda y con la hora redondeada.                                                                                                          |
| Historial de búsqueda                                                | Hasta que lo borres, desactives la personalización o canceles tu cuenta, y nunca más del plazo máximo de la actividad.                                                                                                                                  |
| Gustos declarados y presupuesto                                      | Hasta que los borres en Ajustes o canceles tu cuenta.                                                                                                                                                                                                   |
| Texto que escribes para la IA                                        | 90 días; después lo borramos y queda solo el registro de uso.                                                                                                                                                                                           |
| Resultado de la IA (propuesta o kit) y registro de uso               | Mientras tengas la cuenta **[REQUIERE CAMBIO EN CÓDIGO: borrarlo al cancelar, SEC-26]**.                                                                                                                                                                |
| Revisión de autenticidad de un producto                              | Mientras exista el producto.                                                                                                                                                                                                                            |
| Fotos de comprobante, reportes y bitácora de moderación              | [PLAZO — pendiente] **[REQUIERE CAMBIO EN CÓDIGO]**. Si cancelas tu cuenta, tus reportes se conservan sin ligarse a ti.                                                                                                                                 |
| Domicilios guardados                                                 | Hasta que los borres **[REQUIERE CAMBIO EN CÓDIGO: poder borrarlos]** o canceles tu cuenta.                                                                                                                                                             |
| Pedidos                                                              | [PLAZO — pendiente] **[VERIFICAR CON ABOGADO]**. Si un pedido se cancela, borramos su copia del domicilio.                                                                                                                                              |
| Aceptación de términos y de este aviso (versión y fecha)             | Mientras tengas tu cuenta y después [PLAZO — pendiente] **[VERIFICAR CON ABOGADO]**.                                                                                                                                                                    |
| Solicitudes ARCO y su respuesta                                      | [PLAZO — pendiente] **[VERIFICAR CON ABOGADO]**.                                                                                                                                                                                                        |
| Registros técnicos del alojamiento                                   | [PLAZO del plan contratado — pendiente].                                                                                                                                                                                                                |
| Cifras agregadas de la plataforma                                    | Sin plazo: no identifican a nadie.                                                                                                                                                                                                                      |

> **Nota interna.**
>
> - Los datos que ya no se necesitan se suprimen, previo bloqueo, al terminar el plazo de
>   conservación [1, art. 10 párr. 2]. Los datos sobre **incumplimiento de obligaciones
>   contractuales** se eliminan a los 72 meses [1, art. 10 párr. 3]. Podría aplicar al historial de
>   moderación de vendedores **[VERIFICAR CON ABOGADO]**.
> - Referencias para fijar plazos (ver `00`, §2.10):
>   - contabilidad propia: 5 años (CFF art. 30);
>   - contratos en mensajes de datos: 10 años, para comerciantes (CCom art. 49).
> - **No publicar un plazo que el código no cumple.** Por eso quedan como pendientes hasta tener las
>   tareas de borrado.
> - Los plazos de la tabla que el código ya cumple:
>   - sesiones de 30 días (`auth.ts`);
>   - código de deduplicación de 25 h (`visible-impressions.ts`);
>   - IA a 90 días (`ai/retention.ts`, en la operación diaria `/api/cron/daily`);
>   - borrado del domicilio al cancelar (`commerce/checkout.ts`).
> - **[VERIFICAR]** que se borren las sesiones vencidas y las cubetas del limitador en producción.

### 12. Seguridad y vulneraciones

Protegemos tus datos con medidas administrativas, técnicas y físicas [1, art. 18]. Entre ellas:

- todo viaja cifrado (https), y las cookies de sesión solo viajan por conexiones seguras;
- las contraseñas se guardan solo transformadas con una función de un solo sentido;
- las fotos se guardan en un almacenamiento privado, y cada vez que alguien pide una revisamos si
  puede verla;
- las fotos de comprobante solo las ven su dueño y el equipo;
- a las fotos les quitamos la ubicación GPS y los demás metadatos;
- a los textos que van a la IA les quitamos los datos de contacto y el costo;
- solo el personal con rol de equipo puede moderar, y cada acción queda registrada;
- limitamos los intentos repetidos para frenar abusos;
- quienes tratan datos por nuestra cuenta tienen deber de confidencialidad [1, art. 20].

**Si hay una vulneración de seguridad** que afecte de forma significativa tus derechos patrimoniales
o morales, te avisaremos de inmediato [1, art. 19], por correo y dentro de Estreno. Te diremos:

- qué pasó;
- qué datos se vieron comprometidos;
- qué te recomendamos hacer;
- qué acciones tomamos;
- dónde obtener más información.

> **Nota interna.** El contenido del aviso de vulneración viene de los arts. 64–66 del Reglamento
> (ver `00`, §2.11). Si hay que notificar también a la SABG: **[VERIFICAR CON ABOGADO]**. Mientras
> no haya proveedor de correo, el aviso dentro de la plataforma es el único canal directo.

### 13. Cookies y almacenamiento en tu navegador

Estreno **no usa cookies de publicidad ni de rastreo**, ni píxeles, ni herramientas de analítica o
publicidad de otras empresas. Las fuentes tipográficas se sirven desde nuestro propio sitio.

Esto es todo lo que guardamos en tu navegador:

| Nombre                                                                            | Tipo                                            | Para qué                                                                                                   | Duración                                          | ¿Necesaria?                            |
| --------------------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------- |
| `vendeia.session_token` (en conexiones seguras: `__Secure-vendeia.session_token`) | Cookie propia                                   | Mantener tu sesión abierta y proteger tu cuenta                                                            | Hasta 30 días sin uso; se renueva al usar Estreno | Sí. Sin ella no puedes iniciar sesión. |
| `vendeia_bienvenida`                                                              | Cookie propia                                   | Mostrar una sola vez el mensaje de bienvenida al terminar tu registro. No te identifica.                   | 10 minutos, o hasta que cierres el mensaje        | No es esencial; no guarda datos tuyos. |
| `theme`                                                                           | Almacenamiento local (`localStorage`)           | Recordar si prefieres el tema claro u oscuro. No se nos envía.                                             | Hasta que lo borres                               | Preferencia                            |
| `vendeia.consent-refresh:…` y `vendeia:gente-de-tus-comunidades:cerrado`          | Almacenamiento de la pestaña (`sessionStorage`) | Recordar que ocultaste el aviso de documentos actualizados o las sugerencias de personas. No se nos envía. | Se borra al cerrar la pestaña                     | Preferencia                            |

**Medición de lo que aparece en tu pantalla.** No es una cookie, pero es una tecnología que recaba
datos de forma automática:

- **Qué se envía:** cuando una publicación del feed o de una comunidad está al menos a la mitad en
  tu pantalla durante 1 segundo, con la pestaña a la vista, tu navegador nos avisa. Solo manda qué
  publicación era, si estaba en el feed o en una comunidad y en qué lugar de la lista iba.
- **Qué no se envía:** cuánto tiempo la miraste, cómo te desplazaste ni lo que escribes.
- **Cómo se guarda:**
  - con la personalización activada, se liga a tu cuenta;
  - sin personalización, se guarda sin ligarla a tu cuenta y con la hora redondeada;
  - sin cuenta, se guarda sin cuenta y sin tu IP.
- **Cómo evitar que se envíe:** [REQUIERE CAMBIO EN CÓDIGO: opción para no enviar esta medición]
  **[VERIFICAR CON ABOGADO]**.

Puedes borrar las cookies y el almacenamiento del sitio en la configuración de tu navegador. Si
borras la cookie de sesión, se cierra tu sesión.

> **Nota interna.**
>
> - Hay que informar las tecnologías que recaban datos de forma automática y cómo deshabilitarlas,
>   salvo que sean necesarias por motivos técnicos. El aviso va en un lugar visible, al momento
>   [2, art. 14 último párr.; 3, Trigésimo Primero]. La medición de impresiones visibles **no** es
>   técnicamente necesaria, y hoy no hay forma de apagarla (salvo desligarla con la
>   personalización). Por eso proponemos el aviso visible de la Parte B.3 y una opción para no
>   medir.
> - Nombres verificados en el código:
>   - la cookie de sesión la crea Better Auth con el prefijo `vendeia` (`auth.ts`); `useSecureCookies`
>     agrega `__Secure-` en https;
>   - el tema usa la llave por omisión de `next-themes`.
> - **[VERIFICAR]** en el navegador de producción que no haya otras cookies (p. ej., de Vercel).

### 14. Cambios a este aviso

- **Dónde:** publicamos cada cambio en esta página, con su fecha, su versión y un recuadro «Qué
  cambió en esta versión».
- **Si tienes cuenta:**
  - verás un mensaje en la parte de arriba de Estreno: «Actualizamos el aviso de privacidad. Revisa
    los cambios», con la liga;
  - al tocar «Aceptar», registramos la versión que viste y la fecha;
  - si tocas «Ocultar», el mensaje se esconde solo en esa pestaña y vuelve a aparecer hasta que lo
    aceptes;
  - el mensaje no te impide usar Estreno.
- **Cambios que necesitan tu consentimiento:** te daremos un aviso nuevo y te pediremos permiso
  expreso, con una casilla sin marcar, **antes** de aplicarlos. Son estos:
  - una finalidad nueva que lo requiera;
  - datos financieros, patrimoniales o sensibles nuevos;
  - una transferencia que lo requiera;
  - un cambio de responsable.

  Si no aceptas, no trataremos tus datos para eso [3, Trigésimo Tercero].

- **Por correo:** cuando tengamos proveedor de correo, también te avisaremos así de los cambios
  importantes.
- **Versiones anteriores:** si quieres ver una, pídela a [CORREO DE PRIVACIDAD].

> **Nota interna.**
>
> - Mecanismo existente:
>   - subir `LEGAL_VERSIONS.privacyNotice` (`identity/constants.ts`) muestra `ConsentBanner` a
>     quien aceptó una versión anterior;
>   - «Aceptar» registra en `UserConsent` **solo la versión que el aviso mostró**
>     (`consent-refresh.ts`);
>   - «Ocultar» usa `sessionStorage`.
> - Hay que indicar el medio y el procedimiento para comunicar cambios [1, art. 15 fr. VI; 3,
>   Trigésimo Segundo].
> - Falta decidir qué pasa si la persona **nunca** acepta, sobre todo en los términos (`00`, §6)
>   **[VERIFICAR CON ABOGADO]**.

### 15. Autoridad

La autoridad de protección de datos personales en posesión de particulares es la **Secretaría
Anticorrupción y Buen Gobierno** [1, art. 2 fr. XV y arts. 38–39]. Si crees que no respetamos tus
derechos, puedes acudir a ella (§10.10).

---

## Parte B. Aviso simplificado y avisos en el momento de pedir cada dato

### B.1 Aviso de privacidad simplificado (formulario de registro)

**Dónde va:** en `/registro`, junto al formulario y **antes** del botón «Crear cuenta», visible sin
abrir otra página. Los datos se recaban por medios electrónicos, así que el aviso va en modalidad
simplificada: con las fracciones I a IV del art. 15 y el sitio del integral [1, art. 16 fr. II]. Se
entrega antes de obtener los datos [3, Decimosegundo fr. I].

> **Aviso de privacidad simplificado.** [NOMBRE O RAZÓN SOCIAL DEL RESPONSABLE] («Estreno»), con
> domicilio en [DOMICILIO PARA OÍR Y RECIBIR NOTIFICACIONES], es responsable de tus datos
> personales.
>
> **Qué datos tratamos:** tu nombre, correo y contraseña; los datos técnicos de tu conexión (IP y
> navegador); lo que nos digas en el registro (comunidades, marcas, qué buscas y, si quieres, tu
> presupuesto); tu actividad y tu contenido en Estreno; y, si compras o vendes, tu domicilio de
> entrega, tu teléfono y los datos de tus productos y pedidos. No te pedimos datos sensibles.
>
> **Para qué (necesarias):** crear y proteger tu cuenta; operar la red y las compras y ventas;
> prevenir fraudes, falsificaciones y abusos; y atender tus solicitudes.
>
> **Para qué (secundarias, puedes negarte):**
>
> - personalizar tu feed con tu actividad y medir mejoras. Lo eliges en el siguiente paso;
> - mostrar tu perfil como sugerencia a otras personas. Lo cambias en Ajustes.
>
> También puedes negarte escribiendo a [CORREO DE PRIVACIDAD].
>
> **Cómo limitar el uso de tus datos:** desde Ajustes o escribiendo a [CORREO DE PRIVACIDAD]. Usamos
> proveedores en Estados Unidos para alojar la plataforma y para la inteligencia artificial. No
> vendemos tus datos.
>
> **Aviso completo:** [liga a `/privacidad`].

**Casillas del registro** (ninguna marcada de antemano) **[REQUIERE CAMBIO EN CÓDIGO]**:

- ☐ Tengo 18 años o más. _(obligatoria)_
- ☐ Acepto los [Términos y condiciones] y leí el [Aviso de privacidad]. _(obligatoria; hoy dice
  «Acepto los términos y el aviso de privacidad»)_

**Elección en el paso 3 del registro** (finalidad secundaria S1), sin respuesta marcada:

> **¿Personalizamos tu feed con lo que haces aquí?** Usaríamos los productos que ves, guardas o
> agregas al carrito y lo que buscas, solo dentro de Estreno, nunca datos de otras apps. Si eliges
> «No», tu actividad se guarda sin ligarla a tu cuenta. Lo cambias cuando quieras en Ajustes.
> ( ) Sí, personaliza ( ) No, gracias

> **Nota interna.**
>
> - «Leí el aviso» en lugar de «acepto el aviso»: el aviso se pone a disposición, y el
>   consentimiento tácito vale por regla general [1, art. 7 párr. 3 y 4]. Redacción final:
>   **[VERIFICAR CON ABOGADO]**.
> - «Aparecer en sugerencias» también podría pedirse aquí con «Sí» o «No». Decisión pendiente (§4.2,
>   nota).

### B.2 Avisos en el momento de pedir cada dato

Son textos breves junto al campo. Informan en el momento y, donde hace falta, piden el
consentimiento expreso:

| Dónde                                              | Texto propuesto                                                                                                                                                                                        | Tipo                                                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Presupuesto (registro, paso 3)                     | «Opcional. Solo lo usamos para marcarte los productos que caben en tu presupuesto. Nadie más lo ve y lo puedes borrar en Ajustes.»                                                                     | Consentimiento expreso por signo inequívoco, o casilla aparte **[VERIFICAR CON ABOGADO]**      |
| Subir comprobante de compra                        | ☐ «Autorizo a Estreno a guardar estas fotos en privado para revisar la autenticidad de este producto. Solo las vemos el equipo y yo. Taparé los datos de pago que no hagan falta.»                     | Consentimiento expreso, casilla sin marcar **[REQUIERE CAMBIO EN CÓDIGO]**                     |
| Checkout, domicilio                                | «La tienda verá tu nombre visible y lo que pediste. Si el pago se confirma en Estreno, también el domicilio de entrega, sin tu teléfono.» ☐ «Guardar este domicilio para mis próximas compras.»        | Informativo + elección de guardar [4, 8.1 c)] **[REQUIERE CAMBIO EN CÓDIGO]**                  |
| «Sube y vende» y kit de anuncios                   | «Lo que escribas lo procesa un proveedor de inteligencia artificial en Estados Unidos, sin tus datos de contacto ni el costo. No escribas datos personales de nadie. Borramos tu texto a los 90 días.» | Informativo (encargado, §7)                                                                    |
| Reportar                                           | «Quien publica no sabrá quién lo reportó. No escribas datos personales de nadie.»                                                                                                                      | Informativo                                                                                    |
| Activar tienda                                     | «El nombre de tu tienda y la ciudad y el estado de tus productos serán públicos. Tu domicilio nunca se publica.»                                                                                       | Informativo                                                                                    |
| Leyenda de riesgo en la ficha (vista del vendedor) | «Este nivel lo calculan reglas automáticas. ¿Crees que es un error? Pide que lo revise una persona.»                                                                                                   | Aviso de decisión automatizada y reconsideración [2, art. 112] **[REQUIERE CAMBIO EN CÓDIGO]** |

### B.3 Aviso visible de recolección automática

**Dónde va:** en el pie de página y una vez en la primera visita, sin bloquear la navegación. No es
un aviso de consentimiento de cookies: no usamos cookies que no sean necesarias.

> Estreno solo usa la cookie necesaria para tu sesión. Para saber qué se ve de verdad, tu navegador
> nos avisa qué publicaciones aparecen en tu pantalla; si no tienes cuenta o no activaste la
> personalización, lo guardamos sin ligarlo a ti. No hay rastreadores ni publicidad de otras
> empresas. [No medir] · [Aviso de privacidad]

> **Nota interna.** Cumple el Trigésimo Primero [3] y el art. 14 último párrafo del Reglamento [2].
> El botón «No medir» es la forma de deshabilitar la medición **[REQUIERE CAMBIO EN CÓDIGO]**. Si el
> abogado considera la medición anónima como necesaria, el botón se puede quitar **[VERIFICAR CON
> ABOGADO]**.

---

## Parte C. Inventario de datos

**Abreviaturas de encargados:**

- **V:** Vercel (alojamiento y registros técnicos; todo lo que pasa por la aplicación);
- **N:** Neon (base de datos);
- **R2:** Cloudflare R2 (fotos);
- **OR:** OpenRouter y el proveedor del modelo (IA);
- **C:** proveedor de correo (pendiente).

Todos están fuera de México (§8.1).

**Finalidades:** P1–P8 = necesarias (§4.1); S1–S3 = secundarias (§4.2).

**Base:**

- **R. jur.** = relación jurídica [1, art. 9 fr. IV] con consentimiento tácito [1, art. 7];
- **Expreso** = consentimiento expreso [1, art. 7 párr. 5];
- **Negativa** = finalidad secundaria con mecanismo de negativa [2, art. 14].

| #   | Datos (dónde se guardan)                                                                                                                                                                                                                                              | De quién                    | Fuente                        | Finalidad                                     | Base                                                       | Conservación                                                                      | Encargados / transferencias                      | Quién lo ve                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ----------------------------- | --------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------ |
| 1   | Nombre, correo, correo verificado (`User`); contraseña transformada (`Account.password`)                                                                                                                                                                              | Toda cuenta                 | Tú                            | P1, P7                                        | R. jur.                                                    | Mientras exista la cuenta + bloqueo                                               | V, N; C (futuro)                                 | Tú y el equipo; el nombre no es público                                  |
| 2   | Nombre de usuario, nombre visible, biografía, foto, ciudad, estado (`Profile`)                                                                                                                                                                                        | Toda cuenta                 | Tú                            | P2                                            | R. jur.                                                    | Mientras exista la cuenta                                                         | V, N, R2                                         | **Público**                                                              |
| 3   | Rol, cuenta editorial, onboarding terminado (`Profile.role`, `isEditorial`, `onboardedAt`)                                                                                                                                                                            | Toda cuenta                 | Nosotros                      | P1, P6                                        | R. jur.                                                    | Mientras exista la cuenta                                                         | V, N                                             | Equipo                                                                   |
| 4   | Objetivos del registro (`Profile.goals`)                                                                                                                                                                                                                              | Toda cuenta                 | Tú                            | P2 (primera pantalla)                         | R. jur.                                                    | Mientras exista la cuenta                                                         | V, N                                             | Tú y el equipo                                                           |
| 5   | Comunidades y última visita (`CommunityMembership`)                                                                                                                                                                                                                   | Toda cuenta                 | Tú                            | P2, P3, S2                                    | R. jur.; negativa (S2)                                     | Hasta que salgas o canceles                                                       | V, N                                             | Tú; conteos públicos                                                     |
| 6   | Marcas que te gustan (`UserInterest`)                                                                                                                                                                                                                                 | Toda cuenta                 | Tú                            | **Hoy ninguna** (solo se muestran en Ajustes) | —                                                          | Hasta que las borres                                                              | V, N                                             | Tú                                                                       |
| 7   | Qué buscas y presupuesto (`ShoppingIntent.query`, `budgetMaxCents`)                                                                                                                                                                                                   | Toda cuenta                 | Tú                            | P3                                            | R. jur.; presupuesto: **expreso** [VERIFICAR]              | Hasta que los borres                                                              | V, N                                             | Tú                                                                       |
| 8   | Aceptaciones y ajustes de privacidad, con versión y fecha (`UserConsent`: TERMS, PRIVACY_NOTICE, PERSONALIZATION, DISCOVERABILITY)                                                                                                                                    | Toda cuenta                 | Tú                            | P8, S1, S2                                    | R. jur.                                                    | [PENDIENTE] [VERIFICAR]                                                           | V, N                                             | Equipo                                                                   |
| 9   | Sesiones: token, IP, navegador, vencimiento (`Session`)                                                                                                                                                                                                               | Toda cuenta                 | Tu navegador                  | P1, P6                                        | R. jur.                                                    | Hasta cerrar sesión o 30 días sin uso                                             | V, N                                             | Tú (en Ajustes) y el equipo                                              |
| 10  | Contadores del limitador: red IP, id de cuenta, correo transformado (`rate_limit_buckets`, `rate_limits`)                                                                                                                                                             | Cuentas y visitantes        | Tu navegador                  | P6                                            | R. jur. / interés de seguridad [VERIFICAR]                 | Minutos a 7 días                                                                  | V, N                                             | Nadie (automático)                                                       |
| 11  | Publicaciones, comentarios y su estado (`Post`, `Comment`)                                                                                                                                                                                                            | Toda cuenta                 | Tú                            | P2, P6                                        | R. jur.                                                    | Mientras exista la cuenta, o hasta que se retiren                                 | V, N                                             | **Público** (salvo lo oculto)                                            |
| 12  | Fotos y sus datos técnicos, sin EXIF ni GPS (`Media`)                                                                                                                                                                                                                 | Toda cuenta                 | Tú                            | P2, P4                                        | R. jur.                                                    | Las no adjuntadas se borran a las 24 h; las demás, como su publicación o producto | V, N, R2                                         | Público si están adjuntas a algo publicado; si no, solo su dueño         |
| 13  | Me gusta, guardados, a quién sigues, sugerencias quitadas (`Like`, `SavedItem`, `Follow`, `SuggestionDismissal`)                                                                                                                                                      | Toda cuenta                 | Tú                            | P2, S2                                        | R. jur.; negativa (S2)                                     | Mientras exista la cuenta                                                         | V, N                                             | Solo conteos públicos; nunca quién dio me gusta                          |
| 14  | «Aparecer en sugerencias» (`Profile.discoverable`)                                                                                                                                                                                                                    | Toda cuenta                 | Tú (hoy activado por omisión) | S2                                            | Negativa [VERIFICAR]                                       | Mientras exista la cuenta                                                         | V, N                                             | En sugerencias: nombre, foto, si tiene tienda y la razón                 |
| 15  | Actividad ligada: impresiones servidas y visibles, clics, búsquedas (≤ 120 caracteres), me gusta, guardados, comentarios, seguir, compartir, «No me interesa», comunidades, vistas de producto, carrito, pedidos, IA, grupo de prueba (`AnalyticsEvent` con `userId`) | Cuentas con personalización | Tú y tu navegador             | P3, S1, S3                                    | Negativa (S1)                                              | [PENDIENTE; propuesta 180 días]; se desliga al apagar S1                          | V, N                                             | Solo el sistema; tiendas y equipo ven cifras agregadas                   |
| 16  | Actividad anónima: sin persona, sin texto de búsqueda, hora redondeada, id aleatorio (`AnalyticsEvent` sin `userId`)                                                                                                                                                  | Visitantes y cuentas sin S1 | Tu navegador                  | P3, P6 y métricas                             | Disociado [1, art. 9 fr. III] [VERIFICAR con poco volumen] | [PENDIENTE]                                                                       | V, N                                             | Cifras agregadas                                                         |
| 17  | Código de deduplicación: HMAC de cuenta o IP + publicación                                                                                                                                                                                                            | Cuentas y visitantes        | Nosotros                      | P6 (métricas fiables)                         | R. jur. / seguridad                                        | ≤ 25 h                                                                            | V, N                                             | Nadie                                                                    |
| 18  | Carrito (`Cart`, `CartItem` con la publicación de origen)                                                                                                                                                                                                             | Compradores                 | Tú                            | P4                                            | R. jur.                                                    | Hasta comprar o quitar                                                            | V, N                                             | Tú                                                                       |
| 19  | Domicilios: quien recibe, teléfono, calle, números, colonia, alcaldía, estado, CP, referencias (`Address`)                                                                                                                                                            | Compradores y quien recibe  | Tú                            | P4                                            | R. jur.                                                    | Hasta que los borres [REQUIERE CÓDIGO] o canceles                                 | V, N                                             | Tú                                                                       |
| 20  | Pedidos: totales, entrega, método de pago elegido, copia del domicilio, estado, fechas (`Checkout`, `Order`, `OrderItem`, `Payment`)                                                                                                                                  | Compradores y tiendas       | Tú y la tienda                | P4, P7                                        | R. jur.                                                    | [PENDIENTE] [VERIFICAR]; la copia del domicilio se borra al cancelar              | V, N; **transferencia a la tienda** (§8.2)       | Comprador; tienda: nombre visible y pedido; domicilio solo con pago real |
| 21  | Tienda: nombre, ciudad, estado, métodos de pago, estado de la tienda (`SellerProfile`)                                                                                                                                                                                | Vendedores                  | Tú                            | P4                                            | R. jur.                                                    | Mientras exista la cuenta                                                         | V, N                                             | **Público** (salvo el estado de la tienda)                               |
| 22  | Productos: ficha completa, datos P4, fotos (`Product`, `ProductMedia`)                                                                                                                                                                                                | Vendedores                  | Tú                            | P4, P5, P6                                    | R. jur.                                                    | Mientras exista el producto                                                       | V, N, R2; OR (datos públicos: kit y señal de IA) | **Público** (salvo lo oculto por moderación)                             |
| 23  | Costo del producto (`ProductCost`, `OrderItem.unitCostCents`)                                                                                                                                                                                                         | Vendedores                  | Tú                            | P4, P5                                        | R. jur. [VERIFICAR: patrimonial]                           | Mientras exista el producto o el pedido                                           | V, N; **nunca a OR**                             | Solo tú                                                                  |
| 24  | Fotos de comprobante e historial de envíos (`Media` privada, `AuthenticityCheck.proofMediaIds`, `AuthenticityProofHistory`)                                                                                                                                           | Vendedores                  | Tú                            | P6                                            | **Expreso** [REQUIERE CÓDIGO]                              | [PENDIENTE]; el recolector de fotos huérfanas no las borra                        | V, N, R2                                         | Tú y el equipo                                                           |
| 25  | Revisión de autenticidad: riesgo, puntaje, señales, versión de reglas, señal de IA, estado, revisor, nota (`AuthenticityCheck`)                                                                                                                                       | Vendedores                  | Nosotros                      | P6                                            | R. jur.; decisión automatizada [2, art. 112]               | Mientras exista el producto                                                       | V, N; OR (solo si la señal de IA está activa)    | Equipo y tienda; quien compra ve la leyenda                              |
| 26  | Reportes: quien reporta, a qué, motivo, texto, estado, quien resolvió (`Report`)                                                                                                                                                                                      | Quien reporta y reportado   | Tú y otras personas           | P6                                            | R. jur.                                                    | [PENDIENTE]; al cancelar, sin ligarse a quien reportó                             | V, N                                             | Equipo; el reportado nunca sabe quién ni cuántos                         |
| 27  | Bitácora de moderación y de decisiones: quién del equipo, qué cambió, nota (`PlatformDecision`)                                                                                                                                                                       | Vendedores, autores, equipo | Nosotros                      | P6, P7                                        | R. jur.                                                    | [PENDIENTE]; ¿72 meses? [VERIFICAR]                                               | V, N                                             | Equipo; la nota de autenticidad la ve la tienda                          |
| 28  | IA: solicitud (función, modelo, texto sin contacto → `{redacted: true}` a los 90 días), estado, latencia; respuesta (resultado, tokens, costo) (`AIRequest`, `AIResponse`)                                                                                            | Vendedores                  | Tú                            | P5                                            | R. jur.                                                    | Texto: 90 días; resto: mientras exista la cuenta                                  | V, N; **OR** (texto sin contacto ni costo)       | Tú y el equipo (cifras de uso)                                           |
| 29  | Experimentos y métricas diarias (`Experiment`, `DailyMetric`, `PlatformDecision`); grupo calculado al vuelo                                                                                                                                                           | Agregado                    | Nosotros                      | S3                                            | Agregado, no identifica                                    | Sin plazo                                                                         | V, N; OR (solo cifras agregadas para redactar)   | Equipo                                                                   |
| 30  | Registros técnicos del servidor: IP, URL, navegador, errores                                                                                                                                                                                                          | Todas las personas          | Tu navegador                  | P1, P6                                        | R. jur. / seguridad                                        | Lo que fije el plan de Vercel [PENDIENTE]                                         | V                                                | Equipo técnico                                                           |
| 31  | Cookies y almacenamiento del navegador (§13)                                                                                                                                                                                                                          | Todas las personas          | Nosotros, en tu navegador     | P1; preferencias                              | Necesarias técnicamente [2, art. 14]                       | §13                                                                               | —                                                | Tu navegador                                                             |
| 32  | Solicitudes ARCO, quejas y soporte (correo; registro de solicitudes [2, art. 95])                                                                                                                                                                                     | Quien escribe               | Tú                            | P7                                            | R. jur. / obligación legal                                 | [PENDIENTE] [VERIFICAR]                                                           | C (futuro); proveedor del buzón [PENDIENTE]      | Departamento de datos personales                                         |

> **Nota interna sobre la tabla.**
>
> - **Fila 6:** las marcas se piden en el registro pero **ningún módulo las usa**. Un dato sin
>   finalidad choca con la proporcionalidad [1, art. 12]. Opciones: usarlas en el feed (y
>   declararlo en S1) o dejar de pedirlas.
> - **Fila 10:** la IP se guarda en claro (o su red /64 en IPv6) mientras dura la ventana.
> - **Fila 16:** con poco volumen, «anónimo» no es «agregado»: ADR-030 lo acepta como riesgo
>   residual. Si esos datos cuentan como disociados en el sentido de la ley: **[VERIFICAR CON
>   ABOGADO]**.
> - **Buzón del correo de privacidad:** el proveedor que lo aloje también es encargado.

---

## Parte D. Dónde está cada hecho en el código (2026-09-26)

| Hecho del aviso                                                                                | Código                                                                                                                         |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Sesión de 30 días que se renueva cada día; cookies con prefijo `vendeia` y `Secure` en https   | `src/server/auth.ts` (`expiresIn`, `updateAge`, `cookiePrefix`, `useSecureCookies`)                                            |
| Verificación de correo apagada; router HTTP de Better Auth cerrado                             | `src/server/auth.ts` (`requireEmailVerification: false`, `disabledPaths`)                                                      |
| Cookie `vendeia_bienvenida` de 10 min                                                          | `src/modules/feed/welcome.ts`, `src/modules/identity/onboarding-actions.ts`                                                    |
| Tema en `localStorage` (next-themes)                                                           | `src/components/theme/theme-provider.tsx`                                                                                      |
| «Ocultar» en `sessionStorage`                                                                  | `identity/components/consent-banner.tsx` (`dismissKey`), `discovery/components/people-suggestions-view.tsx` (`CLOSED_KEY`)     |
| Sin terceros en el navegador; fuentes propias                                                  | `src/lib/csp.ts` (`connect-src 'self'`, `font-src 'self'`), `package.json`                                                     |
| Registro sin casilla de 18 años; casilla de términos sin marcar                                | `identity/components/sign-up-form.tsx`                                                                                         |
| Personalización **marcada** por omisión                                                        | `identity/components/onboarding-form.tsx` (`defaultChecked`); `prisma/schema.prisma` (`personalizationEnabled @default(true)`) |
| Antes de terminar el registro, la actividad es anónima                                         | `analytics/personalization.ts` (`isPersonalizationEnabled`)                                                                    |
| Anonimización y desligue retroactivo                                                           | `analytics/event.ts` (`prepareEvent`), `analytics/privacy.ts` (`anonymizeUserActivity`, `setPersonalization`)                  |
| Historial de búsqueda y gustos, visibles y borrables                                           | `analytics/privacy.ts`, `identity/privacy-actions.ts`, `app/(social)/ajustes/page.tsx`                                         |
| Marcas guardadas pero no usadas                                                                | `identity/service.ts` (única escritura de `kind: "BRAND"`; sin lecturas)                                                       |
| Señales del feed (14 días solo con personalización)                                            | `feed/queries.ts` (`loadViewerContext`, `SIGNAL_WINDOW_DAYS = 14`), `feed/ranking.ts`                                          |
| Asignación a pruebas por cuenta, también sin personalización                                   | `platform/experiments.ts` (`assignVariant`, `resolveFeedPolicy`)                                                               |
| Impresiones visibles y deduplicación de 25 h                                                   | `analytics/visible-impressions.ts`, `feed/components/visible-impressions.ts`, `app/api/impressions/route.ts`                   |
| Deduplicación con HMAC (cuenta o IP + entidad)                                                 | `analytics/integrity.ts`                                                                                                       |
| Limitador: IP en claro (red), correo con SHA-256                                               | `src/server/rate-limit.ts` (`rateLimitKey`)                                                                                    |
| Fotos: WebP sin EXIF/GPS; huérfanas borradas a las 24 h; privadas por `/media`                 | `media/image-processing.ts`, `media/orphans.ts`, `media/README.md`                                                             |
| Riesgo de falsificación, leyenda y comprobantes                                                | `trust/rules.ts`, `trust/status.ts`, `trust/buyer-copy.ts`, `trust/proof-media.ts`, `trust/README.md`                          |
| Señal de IA opcional (apagada, peso ≤ 0.15)                                                    | `trust/ai-signal.ts`, `trust/ai-runner.ts`                                                                                     |
| IA: sin contacto ni costo; retención de 90 días en la operación diaria                         | `ai/personal-data.ts`, `ai/sale-proposal.ts` (`withoutCostMentions`), `ai/retention.ts`, `ceo/scheduled.ts`                    |
| OpenRouter con `data_collection: "deny"`; `zdr: true` solo en el árbol de trabajo (sin commit) | `src/server/providers/ai/openai-compatible.ts` (`providerExtras`)                                                              |
| Narrativa de IA solo con cifras agregadas                                                      | `ceo/narrative.ts`                                                                                                             |
| Tienda: nombre visible del comprador; domicilio solo con pago real; teléfono nunca             | `commerce/seller-order-dto.ts`                                                                                                 |
| Domicilio nuevo guardado siempre en la libreta; copia borrada al cancelar                      | `commerce/checkout.ts`                                                                                                         |
| Alojamiento en `iad1` y tarea diaria                                                           | `vercel.json`                                                                                                                  |
| R2 privado; Neon con pooler                                                                    | `.env.example`, `src/server/providers/storage/*`                                                                               |
| Re-aceptación de versiones                                                                     | `identity/constants.ts` (`LEGAL_VERSIONS`), `identity/consent-refresh.ts`, `identity/privacy-actions.ts`                       |
| Sin exportar ni borrar cuenta                                                                  | `app/(social)/ajustes/page.tsx` («Muy pronto…»); SEC-26                                                                        |

---

## Parte E. Cumplimiento, discrepancias, cambios de código y puntos para el abogado

### E.1 Elementos obligatorios y dónde están

| Elemento                                                                       | Fuente                                               | Sección       | Estado                                       |
| ------------------------------------------------------------------------------ | ---------------------------------------------------- | ------------- | -------------------------------------------- |
| Identidad y domicilio del responsable                                          | [1, art. 15 fr. I; 3, Vigésimo Primero]              | A §1          | Faltan los datos                             |
| Datos tratados, señalando los sensibles                                        | [1, art. 15 fr. II; 3, Vigésimo Segundo y Tercero]   | A §3, Parte C | Cubierto                                     |
| Finalidades, distinguiendo las que requieren consentimiento                    | [1, art. 15 fr. III; 2, art. 41; 3, Vigésimo Cuarto] | A §4          | Cubierto                                     |
| Mecanismo de negativa para las secundarias, antes del tratamiento              | [2, art. 14; 3, Vigésimo Quinto]                     | A §4.2, B.1   | Requiere quitar la casilla premarcada        |
| Opciones para limitar el uso o la divulgación                                  | [1, art. 15 fr. IV; 3, Trigésimo]                    | A §9          | Cubierto                                     |
| Medios y procedimiento ARCO, con identidad, plazos, respuesta y reproducción   | [1, arts. 15 fr. V y 28–34; 3, Vigésimo Octavo]      | A §10         | Falta el correo y el procedimiento interno   |
| Revocación del consentimiento                                                  | [1, art. 7 párr. 6; 3, Vigésimo Noveno]              | A §10.9       | Cubierto                                     |
| Cambios al aviso                                                               | [1, art. 15 fr. VI; 3, Trigésimo Segundo y Tercero]  | A §14         | Cubierto (mecanismo existente)               |
| Transferencias y cláusula de aceptación                                        | [1, art. 35 párr. 2; 3, Vigésimo Sexto y Séptimo]    | A §8.2        | Cubierto; fracción del art. 36 por confirmar |
| Tecnologías de recolección automática y cómo deshabilitarlas                   | [2, art. 14; 3, Vigésimo fr. XI y Trigésimo Primero] | A §13, B.3    | Falta la opción «No medir»                   |
| Decisiones sin intervención humana                                             | [2, art. 112; 3, Anexo, Sexto]                       | A §6, B.2     | Falta «Pedir revisión»                       |
| Consentimiento expreso de datos financieros o patrimoniales                    | [1, art. 7 párr. 5; 2, arts. 15 y 16]                | A §3.5, B.2   | Faltan las casillas                          |
| Aviso simplificado al recabar por medios electrónicos                          | [1, art. 16 fr. II; 3, Trigésimo Cuarto a Séptimo]   | B.1           | Falta ponerlo en el registro                 |
| Consentimiento previo para perfilar (estándar de la PROFECO)                   | [4, 5.4.1]                                           | A §4.2, B.1   | Requiere la casilla sin marcar               |
| Lenguaje claro, sin casillas premarcadas ni remisiones a textos no disponibles | [3, Décimo]                                          | Todo          | Revisar al publicar                          |

### E.2 Discrepancias entre el código, el borrador actual y la tarea

| #   | Tema                       | Borrador actual (`privacidad/page.tsx`) o tarea                                        | Código                                                                                              | Este aviso                                         |
| --- | -------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 1   | Datos que recibe la tienda | «el nombre de quien recibe, el domicilio de entrega y el teléfono del pedido»          | Nombre **visible** del comprador; domicilio solo con pago real y pedido vigente; **teléfono nunca** | Sigue al código (§8.2)                             |
| 2   | Exportar y borrar          | «Desde Ajustes podrás descargar y eliminar tus datos»                                  | No existe (SEC-26); Ajustes dice «Muy pronto»                                                       | Por correo mientras tanto (§10.2)                  |
| 3   | Texto de IA                | «a los 90 días lo borramos por completo»                                               | Se redacta la **entrada**; quedan el registro de uso y el resultado                                 | Lo dice así (§7.4)                                 |
| 4   | Cookies                    | «solo la cookie de sesión y las necesarias»; la tarea decía cookies de tema y de aviso | Sesión + `vendeia_bienvenida`; el tema y los «Ocultar» son `localStorage` y `sessionStorage`        | Tabla real (§13)                                   |
| 5   | Pruebas A/B                | El grupo solo se menciona con la personalización activada                              | Se asigna grupo a toda cuenta con sesión; solo se **mide** con la personalización                   | Lo dice (§6.3)                                     |
| 6   | Marcas                     | «Gustos que tú declaras: comunidades, marcas…» como insumo de personalización          | Las marcas no se usan                                                                               | Nota de minimización (Parte C, fila 6)             |
| 7   | Personalización            | «Puedes desactivar…» (opt-out)                                                         | Casilla **marcada** por omisión                                                                     | Elección sin preselección [REQUIERE CÓDIGO]        |
| 8   | Edad                       | La tarea dice «usuarios 18+»                                                           | No hay control de edad                                                                              | Casilla de 18+ [REQUIERE CÓDIGO]                   |
| 9   | Plazos de conservación     | Pendientes                                                                             | Sin tareas de borrado para actividad, reportes, comprobantes ni bitácora                            | Pendientes, marcados                               |
| 10  | Domicilio en la libreta    | No lo menciona                                                                         | El domicilio nuevo del checkout se guarda siempre                                                   | Casilla «Guardar este domicilio» [REQUIERE CÓDIGO] |

### E.3 Cambios de código antes de publicar este aviso

Primero lo que bloquea la publicación. No son parte de esta fase (no se tocó código):

1. **Datos del responsable**:
   - llenar los datos de §1;
   - subir `LEGAL_VERSIONS.privacyNotice`;
   - pasar el texto de la Parte A a `src/app/(legal)/privacidad/page.tsx`.
2. **Registro** (`sign-up-form.tsx`, `identity/schemas.ts`, `identity/actions.ts`):
   - casilla obligatoria de 18 años, registrada como consentimiento con versión;
   - texto de B.1 junto al formulario;
   - «leí el aviso».
3. **Personalización sin preselección** (`onboarding-form.tsx`): quitar `defaultChecked`, o cambiar a
   «Sí» / «No» sin marcar. Decidir «Aparecer en sugerencias» (`discoverable`).
4. **Canal ARCO**:
   - publicar [CORREO DE PRIVACIDAD] en §1, en Ajustes → «Tus datos» y en el pie de página;
   - procedimiento interno: acuse con fecha, registro de solicitudes, plazos de §10.5 y respuesta
     por el mismo medio;
   - mientras no exista SEC-26, exportación y borrado **manuales** con un guion probado.
5. **IA:** hacer commit y desplegar `zdr: true` en `providerExtras` (`openai-compatible.ts`; ya
   está en el árbol de trabajo, junto con `reasoning: { enabled: false }`). Fijar la lista de
   proveedores de modelo permitidos. Aceptar el DPA de OpenRouter y llenar §7.3 y §8.1.
6. **Comprobantes:** casilla expresa sin marcar al subirlos (B.2) y plazo de conservación.
7. **Conservación en código:** tareas de borrado para:
   - actividad ligada y anónima;
   - reportes, bitácora y comprobantes;
   - sesiones vencidas.

   Después, publicar los plazos de §11.

8. **Checkout:**
   - casilla «Guardar este domicilio»;
   - poder borrar domicilios guardados;
   - texto de B.2.
9. **Decisiones automatizadas:** «Pedir revisión» junto al nivel de riesgo, en la vista del
   vendedor (B.2).
10. **Medición visible:** aviso de B.3 y opción «No medir», o decisión del abogado de que no hace
    falta.
11. **Infraestructura:**
    - bucket de R2 con jurisdicción «US»;
    - confirmar la región del proyecto Neon;
    - plan Pro de Vercel para el DPA.
12. **Marcas del registro:** usarlas y declararlo, o dejar de pedirlas.

### E.4 Puntos para el abogado ([VERIFICAR CON ABOGADO])

1. ¿Aplican de forma supletoria el Reglamento de 2011 y los Lineamientos de 2013 mientras no haya
   reglamento nuevo? Este aviso se apoya en ellos: negativa, cookies, simplificado, art. 112 y
   encargados.
2. ¿Cómo debe identificarse el responsable si es persona física (nombre completo) y qué domicilio
   usar?
3. Datos financieros o patrimoniales: el presupuesto, el costo privado, los comprobantes y los
   montos de pedidos. ¿Cuáles piden consentimiento expreso? ¿Basta escribir el presupuesto con la
   explicación al lado (signo inequívoco)?
4. Personalización: ¿basta una elección sin preselección? ¿Cumple la NMX 5.4.1 (consentimiento
   previo para perfilar)?
5. «Aparecer en sugerencias» activado por omisión: ¿es aceptable como negativa?
6. Datos del comprador que ve la tienda: ¿art. 36 fr. IV o fr. VII? Redacción de la cláusula de
   transferencia.
7. Leyenda de riesgo de falsificación: ¿cae en el art. 26 fr. II? ¿Basta la revisión humana a
   petición con el art. 112 del Reglamento?
8. Pruebas A/B a cuentas sin personalización: ¿hace falta una forma de salir?
9. ARCO: ¿vale el control de la cuenta (correo registrado más confirmación en sesión) como
   acreditación de identidad (Reglamento art. 89)? ¿Cuánto tiempo conservar las copias de
   identificación y el expediente?
10. Plazo de bloqueo tras una cancelación (prescripción aplicable) y plazos de conservación de:
    - pedidos;
    - aceptaciones de términos (¿10 años, CCom art. 49?);
    - reportes y bitácora (¿72 meses, art. 10?);
    - solicitudes ARCO.
11. Encargados en el extranjero:
    - ¿bastan los DPA por adhesión de Vercel, Neon, Cloudflare y OpenRouter frente al art. 52 del
      Reglamento?
    - ¿basta la autorización general de subencargados cuando OpenRouter cambia de proveedores de
      modelo sin aviso (arts. 54 y 55)?
    - ¿el plan gratuito de Vercel es válido para uso comercial?
12. Medición de impresiones visibles: ¿es técnicamente necesaria o hace falta la opción «No medir»
    (Trigésimo Primero)?
13. Actividad «anónima» con poco volumen: ¿cuenta como disociada (art. 9 fr. III) o sigue siendo
    dato personal?
14. Vulneraciones: ¿hay que avisar también a la SABG? ¿Cuál es su medio o portal para la solicitud de
    protección de derechos?
15. Verificación de edad: ¿qué nivel basta (casilla o algo más)?
16. Casilla del registro: ¿«acepto» o «leí» el aviso de privacidad? ¿Qué pasa si una persona nunca
    acepta una versión nueva?
17. Riesgo de datos sensibles inferidos del historial de búsquedas o compras (p. ej., productos de
    salud).
18. ¿Mencionar el Registro Público para Evitar Publicidad (REPEP) aunque hoy no hacemos
    mercadotecnia?

---

## Parte F. Fuentes

Todas consultadas el **2026-09-26**. «Leída» = leímos el texto en esa fecha para este documento.
«De `00`» = la leyó la investigación de `00-marco-legal-2026.md` en la misma fecha; aquí no la
volvimos a abrir.

1. Leída. Cámara de Diputados, _Ley Federal de Protección de Datos Personales en Posesión de los
   Particulares_. Nueva ley DOF 20-03-2025; última reforma DOF 14-11-2025. Arts. 1–50.
   https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf
2. Leída. Cámara de Diputados, _Reglamento de la LFPDPPP_, DOF 21-12-2011 (publicado como «texto
   vigente»). Arts. 14–17, 26–30, 40–43, 50–55, 89–113. Sus referencias son a la numeración de la ley
   de 2010. https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LFPDPPP.pdf
3. Leída. DOF, _Lineamientos del Aviso de Privacidad_, 17-01-2013. Décimo a Decimosegundo,
   Vigésimo a Cuadragésimo primero y Anexo (Primero a Séptimo).
   https://dof.gob.mx/nota_detalle.php?codigo=5284966&fecha=17/01/2013
4. Leída. Secretaría de Economía, _NMX-COE-001-SCFI-2018, Comercio electrónico_. Numerales 5.3.6,
   5.4.1 y 8.1. http://www.economia-nmx.gob.mx/normas/nmx/2010/NMX-COE-001-SCFI-2018.pdf
5. Leída. Cámara de Diputados, _Ley Federal de Protección al Consumidor_, última reforma DOF
   12-12-2025. Art. 76 BIS fr. I–III. https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPC.pdf
6. Leída. OpenRouter, Inc., _Privacy Policy_ (actualizada el 31-08-2026). Entidad, entrenamiento,
   proveedores de modelos, servidores en EE. UU. y 18 años. https://openrouter.ai/privacy
7. Leída. OpenRouter, _Data Processing Agreement_ (actualizado el 26-08-2026). Incorporación,
   subencargados, alojamiento en Google Cloud en regiones de EE. UU., aviso de incidentes en 72 h,
   retención cero y borrado. https://openrouter.ai/data-processing-agreement
8. De `00` [33]. OpenRouter, _Terms of Service_ (actualizados el 31-08-2026).
   https://openrouter.ai/terms
9. De `00` [36]. OpenRouter, _Provider selection_ (`data_collection`, `zdr`).
   https://openrouter.ai/docs/guides/routing/provider-selection
10. Leída. Vercel, _Global network and regions_ (actualizada el 11-08-2026): `iad1` = `us-east-1`,
    Washington, D.C. https://vercel.com/docs/regions
11. Leída. Vercel, _Data Processing Addendum_ (actualizado el 17-03-2026; vigente desde el
    31-03-2026). Aplica a los planes Pro y Enterprise; procesamiento principal en EE. UU.
    https://vercel.com/legal/dpa
12. Leída. Neon, _Regions_: `aws-us-east-1` = US East (N. Virginia); sin región en México.
    https://neon.com/docs/introduction/regions
13. Leída. Neon, _Product Specific Schedule_ (05-08-2026). Neon, LLC es parte de Databricks.
    https://neon.com/dpa
14. Leída. Cloudflare, _R2 Data location_: ubicación automática, sugerencias de ubicación y
    jurisdicciones (EU, FedRAMP, US). https://developers.cloudflare.com/r2/reference/data-location/
15. Leída. Cloudflare, _Customer Data Processing Addendum_, versión 6.4 (vigente desde el
    03-04-2026). https://www.cloudflare.com/cloudflare-customer-dpa/
16. Interna. `docs/legal/00-marco-legal-2026.md`: Código de Comercio art. 49, CFF art. 30,
    Reglamento arts. 63–66, Código Civil Federal (mayoría de edad) y el resto del marco.

**Documentos internos usados:**

- `docs/decisions.md` (ADR-030 a ADR-038);
- `docs/security/auditoria-2026-09-26.md` (SEC-26, SEC-34);
- `src/app/(legal)/privacidad/page.tsx`;
- el código citado en la Parte D.
