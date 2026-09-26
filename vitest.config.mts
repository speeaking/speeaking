import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

/** Pruebas contra la base de desarrollo (`pnpm db:start`); se omiten sin `DATABASE_URL`. */
const DB_TESTS = "src/**/*.db.test.ts";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      // `server-only` lanza un error fuera del bundle de servidor de Next;
      // en pruebas lo reemplazamos por un módulo vacío.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: [...configDefaults.exclude, DB_TESTS],
        },
      },
      {
        extends: true,
        test: {
          name: "components",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
      {
        // Comparten una sola base (candados, límites, cubetas, conteos globales): un archivo a la vez
        // en un solo proceso, para que no se estorben ni se agoten el tiempo compitiendo por ella.
        // Con `maxWorkers: 1` Vitest los corre en un grupo aparte DESPUÉS de `unit` y `components`
        // (no al mismo tiempo): `pnpm test --project db` los corre solos.
        extends: true,
        test: {
          name: "db",
          environment: "node",
          include: [DB_TESTS],
          fileParallelism: false,
          maxWorkers: 1,
          // Con la base ocupada (servidor de desarrollo, otras pruebas) preparar datos tarda más.
          testTimeout: 20_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
