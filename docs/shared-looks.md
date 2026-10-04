# Compartir una prueba de ropa

Desde una simulación lista, «Compartir mi look» permite escribir hasta 240 caracteres e indicar
una talla solicitada por prenda. Compartir requiere una aceptación explícita. La foto original
del probador permanece privada.

## Recorrido

- **Chat:** se elige un nombre de usuario. Solo el dueño y esa persona pueden abrir la tarjeta.
  Se respetan los bloqueos y los límites existentes de mensajes.
- **WhatsApp:** se crea un enlace secreto. El botón abre WhatsApp con mensaje, productos,
  tallas solicitadas, precios del momento y enlace; la persona decide a quién enviarlo.
- **Comprártelo:** añade una pieza por producto al carrito de quien paga. El pedido muestra el
  nombre del destinatario y la talla solicitada. El comprador revisa los precios vigentes,
  elige entrega, introduce una dirección que tenga autorización para usar y confirma el pago.
  No se comparte automáticamente ningún domicilio guardado del dueño de la foto.
- **Sí, amor:** registra la respuesta y envía un mensaje al chat con quien compartió el look.
  No cobra ni reserva mercancía. El dueño puede comprar desde el mismo look.

La talla es una solicitud guardada en el pedido, **no una variante de inventario**: debe
confirmarse con el vendedor. No se añade un proveedor de animación en esta versión.

## Acceso y retirada

Los enlaces caducan en un máximo de siete días y nunca duran más que la foto o su resultado.
Se pueden desactivar desde la simulación, en «Compartir mi look». Borrar una foto o resultado
elimina sus permisos compartidos por cascada. Desactivar no puede borrar copias que alguien
ya haya guardado.

El enlace contiene 256 bits aleatorios; la base guarda solo su SHA-256. La ruta de imagen
autoriza cada petición, sirve únicamente el resultado elegido y usa `private, no-store`.
Las páginas e imágenes excluyen la indexación; no se coloca la foto privada en metadatos
de redes sociales ni en el sitemap.

Migración: `20261004010000_shared_looks`. Es aditiva y no crea usuarios ni contenido de prueba.
