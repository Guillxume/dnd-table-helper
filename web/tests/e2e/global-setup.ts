import { execFileSync } from "node:child_process";

/** Base de test migrée et vide, bucket vide, un compte prêt (voir tests/support/prepare-e2e.ts). */
export default function globalSetup(): void {
  execFileSync("pnpm", ["exec", "tsx", "tests/support/prepare-e2e.ts"], { stdio: "inherit" });
}
