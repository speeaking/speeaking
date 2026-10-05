# Spyke: primera versión

Cada publicación tiene un botón **Spyke** en su barra de acciones. Abre una ventana sobre el feed o el visor; selecciona exactamente esa publicación.

## Recorrido

1. Tocar **Leer publicación** o el micrófono y decir «Hey Spyke, léeme esta publicación».
2. Decir «envíasela a Ana» o usar **Compartir**. La interpretación en lenguaje natural usa el proveedor real de IA configurado; los controles básicos no necesitan el modelo.
3. Si hay varias coincidencias, elegir por nombre y @usuario, por botón o diciendo «elige a [usuario]». Solo se consultan amigos aceptados, sin bloqueos y con cuenta disponible.
4. Revisar destinatario, mensaje corto y enlace. El mensaje dictado se copia si está en la orden; el modelo no inventa un texto nuevo.
5. Tocar **Confirmar envío** o volver a activar el micrófono y decir exactamente «confirmar envío». Interpretar o preparar nunca envía. Una confirmación no duplica el mensaje si se reintenta la misma petición.
6. Abrir **Ver conversación** para encontrarlo en mensajes.

La publicación debe seguir publicada y visible para quien comparte y para el amigo. Las comprobaciones se repiten al enviar, dentro de una transacción; compartir no abre contenido privado. Se envía un enlace, sin copiar el cuerpo o los archivos.

## Voz y límites

- Reconocimiento del navegador (`SpeechRecognition` o `webkitSpeechRecognition`), español de México, una orden por activación y apagado a los 20 segundos. Si no está disponible, se puede escribir la orden y usar botones.
- Lectura mediante `speechSynthesis`, en piezas pequeñas y con preferencia por una voz local en español. No resume ni describe automáticamente las fotos o el contenido del video.
- Solo se activa con un toque y permiso del micrófono. Cerrar la ventana, ocultar la página o navegar detiene el audio; no vuelve a escuchar solo. «Hey Spyke» es un prefijo opcional de la orden, no una escucha permanente.
- La PWA no ofrece activación desde el sistema, con la app cerrada o la pantalla bloqueada. Eso requiere un diseño nativo y revisar restricciones de Android/iOS; no se promete que toda app nativa pueda mantener un despertador de voz permanente.
- El navegador puede usar servicios externos para reconocimiento y lectura. El aviso se muestra antes del micrófono; speeaking no guarda grabaciones.
- No se anuncia como prevención de accidentes ni uso seguro al conducir. La voz también puede distraer. Usar con el vehículo detenido o como pasajero.

## Servidor y operación

- `voice_command` tiene su propia ruta en `/admin/ia`, bandera `voiceAssistant` y función contable `VOICE_COMMAND`.
- Rechaza el proveedor `mock` en todos los entornos. Si el modelo o presupuesto no están disponibles, se mantienen la lectura y el recorrido manual.
- La IA solo interpreta la orden. No recibe el texto de la publicación, fotos ni lista de amigos; se redactan datos de contacto y cuentas. No se guarda el dictado ni el mensaje privado en `AIRequest`/`AIResponse`.
- Quotas existentes por persona y presupuesto global, además de 60 interpretaciones/hora, 120/día y tope subsidiado de US$0.50/día para la función. Los controles básicos no hacen llamadas al proveedor.
- El envío usa los mismos límites que mensajes escritos (30/10 minutos; 20 conversaciones nuevas/día), sesión y autorización en el servidor. El identificador de petición evita duplicados.
- La migración aditiva `20261005222000_voice_command` añade un valor a `AIFeature`; no cambia publicaciones, usuarios ni permisos.
- `Permissions-Policy` permite `microphone=(self)`; los sitios externos no reciben permiso. El navegador sigue pidiendo el consentimiento del usuario.

## Fuentes y comprobación pendiente

- [MDN: SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition): compatibilidad limitada; Chrome puede usar un servicio remoto.
- [MDN: SpeechSynthesisUtterance](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance): voz del navegador y eventos de fin/error.
- [MDN: uso de Web Speech](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API).
- [NHTSA: distracciones al conducir](https://www.nhtsa.gov/book/countermeasures-that-work/distracted-driving): también pueden ser cognitivas.

Se comprueba compilación de la aplicación. No se agregan ni ejecutan pruebas automatizadas sin solicitud del usuario. Queda por comprobar en el Android del usuario la voz disponible, permiso, lectura larga y compartir con un amigo aceptado; la compilación no confirma el micrófono de ese dispositivo.
