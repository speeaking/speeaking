import { test } from "@playwright/test";

/**
 * Calentamiento (solo local, con `next dev`): pide una vez las rutas principales para que Turbopack
 * las compile antes de las pruebas. Sin esto, la primera visita a cada ruta durante una prueba puede
 * tardar más que los 15 s de espera y hasta vencer transacciones en el servidor. En CI (`next start`)
 * no hace falta, pero tampoco estorba.
 */
const ROUTES = [
  "/",
  "/descubrir",
  "/comprar",
  "/comprar?q=audifonos",
  "/buscar?q=tecnologia",
  "/c/gaming",
  "/producto/airpods-pro-2-demo",
  "/producto/camisa-blanca-vestir-demo",
  "/estilista?necesidad=algo%20para%20una%20boda",
  "/estilista/completa/camisa-blanca-vestir-demo",
  "/precios",
  "/registro",
  "/entrar",
  "/privacidad",
  "/terminos",
  "/api/feed",
  // Con sesión redirigen a /entrar, pero el servidor compila la ruta de todos modos.
  "/bienvenida",
  "/crear",
  "/carrito",
  "/checkout",
  "/pedidos",
  "/guardados",
  "/perfil",
  "/ajustes",
  "/probar",
  "/saldo",
  "/studio",
  "/studio/productos",
  "/studio/productos/nuevo",
  "/studio/sube-y-vende",
  "/studio/contenido",
  "/studio/campanas",
  "/studio/saldo",
  "/studio/pedidos",
  "/studio/analitica",
  "/admin",
  "/admin/ia",
  "/admin/moderacion",
  "/admin/resumen",
];

test("calienta las rutas principales", async ({ request }) => {
  test.setTimeout(600_000);
  for (const route of ROUTES) {
    // Cada ruta se compila al pedirla; el estado no importa (404 y redirecciones también compilan).
    await request
      .get(route, { maxRedirects: 0, timeout: 120_000 })
      .then((response) => response.body())
      .catch(() => undefined);
  }
});
