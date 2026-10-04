# Comunidades creadas por usuarios

- `Crear → Comunidad o grupo` y `Descubrir → Crear` llevan a `/crear/comunidad`.
- Crear exige una cuenta con bienvenida terminada. El servidor asigna propietario, primera membresía
  `ADMIN`, contador 1 y `isOfficial=false`; ninguno de estos campos viene del formulario.
- Los grupos aparecen en Descubrir y en la búsqueda de comunidades. La bienvenida y las tandas
  editoriales continúan usando comunidades oficiales. Al publicar se ofrecen oficiales y grupos
  a los que pertenece la persona. El acceso desde el grupo preselecciona esa comunidad, también
  cuando el formulario se abre en una ventana.
- Miembros actuales pueden consultar `/c/[slug]/miembros`, con búsqueda y páginas de 20 personas.
  Solo se entrega nombre público, @usuario, avatar y rol del grupo; no correos, compras, biografía,
  sesiones ni datos de acceso.

## Permisos

| Acción                                | Propietario actual      | Administrador del grupo      | Miembro |
| ------------------------------------- | ----------------------- | ---------------------------- | ------- |
| Ver miembros                          | Sí                      | Sí                           | Sí      |
| Invitar, cancelar invitaciones        | Sí                      | Sí                           | No      |
| Retirar miembros y permitir volver    | Sí                      | Sí, solo miembros ordinarios | No      |
| Nombrar/quitar administradores        | Sí                      | No                           | No      |
| Retirar otro administrador            | Sí                      | No                           | No      |
| Transferir propiedad                  | Sí, a un miembro actual | No                           | No      |
| Editar nombre/descripción/icono/color | Sí                      | No                           | No      |
| Eliminar comunidad con confirmación   | Sí                      | No                           | No      |

`Community.ownerId` es la autoridad para cambios de rol. Tras transferir, el nuevo propietario
recibe el control y el anterior conserva su rol de administrador. Nadie puede retirar al propietario;
para salir primero debe transferir. El rol `CommunityMembership.role` no escribe `Profile.role` y no
concede acceso a la administración de la plataforma.

## Invitaciones, retiro y concurrencia

La invitación llega a Notificaciones y a Descubrir; la persona puede aceptarla o rechazarla también
en la página del grupo. Nunca se crea una membresía al enviar la invitación. Solo el destinatario
puede responder. Se comprueban bloqueos en ambas direcciones al invitar y aceptar.

Retirar borra la membresía y baja el contador en la misma transacción. `CommunityRemoval` impide
reingresar o publicar hasta que un administrador permita volver o la persona acepte una nueva
invitación. No se borra el contenido propio del miembro retirado.

Todos los cambios de miembros, roles, invitaciones y publicaciones del grupo bloquean la fila de
la comunidad con `FOR UPDATE`. La autorización se vuelve a comprobar dentro de esa transacción:
no basta con que la interfaz haya mostrado un botón. Incorporación durante bienvenida y borrado
de cuenta usan el mismo bloqueo y un orden estable para grupos múltiples. El contador cambia
solo cuando cambia una membresía.

Al borrar una cuenta propietaria se transmite el grupo al administrador más antiguo disponible,
o al miembro más antiguo si no hay administradores. Si no queda ninguna cuenta elegible se retira
el grupo; el contenido de otros autores mantiene su propiedad y privacidad (FK `SetNull`). La
anonimización por conservar registros de compras también elimina las invitaciones y membresías.

El propietario también puede eliminar directamente el grupo escribiendo su nombre actual. La
autorización y el nombre se comprueban dentro del bloqueo; se borran membresías e invitaciones y
las publicaciones quedan sin comunidad, conservando autoría y privacidad.

Frecuencia: tres creaciones por cuenta/día, 20 por IP/día y 100 cambios de administración por
cuenta/hora. Crear y transferir comprueban el límite de diez grupos en propiedad. La creación de
una cuenta se serializa con su fila de usuario. Los errores públicos son mensajes controlados;
no se devuelven detalles de la base de datos.

## Privacidad

Unirse no concede amistad ni visibilidad de biografías, fotos o publicaciones personales ajenas.
Siguen vigentes `postVisibleTo` y las protecciones de medios y perfiles. Para publicar en un grupo
creado por usuarios se requiere membresía activa; las comunidades oficiales conservan su recorrido
anterior y también respetan los retiros. Las invitaciones no conceden acceso a publicaciones.

Migración aditiva: `20261004180000_community_management`. No cambia los propietarios de las
comunidades oficiales ni eleva los permisos de las cuentas existentes.
