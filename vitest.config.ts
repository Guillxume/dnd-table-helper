import { defineConfig } from "vitest/config";

// Tests du bot uniquement : le site (web/) a sa propre configuration et ses propres dépendances.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
