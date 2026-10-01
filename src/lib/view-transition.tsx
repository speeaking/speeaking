import * as React from "react";

type Props = React.ViewTransitionProps;

function PassThrough({ children }: Props) {
  return <>{children}</>;
}

/**
 * `<ViewTransition>` de React. Next.js corre la versión canary de React, que lo trae; el React
 * estable de las pruebas unitarias no, y ahí los hijos pasan tal cual (sin animación). Importar
 * desde aquí evita que un componente reviente donde la función no existe.
 */
export const ViewTransition: React.ComponentType<Props> =
  (React as unknown as { ViewTransition?: React.ComponentType<Props> }).ViewTransition ??
  PassThrough;
