import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
  // Code du bot Discord, à la racine du dépôt.
  "@bot": fileURLToPath(new URL("../src", import.meta.url)),
  // `server-only` lève une erreur hors du bundler Next ; en test, c'est un module vide.
  "server-only": fileURLToPath(new URL("./tests/support/empty-module.ts", import.meta.url)),
};

export default defineConfig({
  resolve: {
    alias,
    // Le code du bot (../src) importe ces paquets : ils sont pris dans web/node_modules,
    // pour que les tests du site ne dépendent pas des node_modules du bot.
    dedupe: ["better-sqlite3", "pdfkit", "pdf-lib", "@anthropic-ai/sdk"],
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/support/integration-global-setup.ts"],
          setupFiles: ["tests/support/integration-env.ts"],
          // Une seule base de test partagée : les fichiers s'exécutent l'un après l'autre.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
