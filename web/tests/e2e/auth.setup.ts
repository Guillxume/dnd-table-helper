import { expect, test as setup } from "@playwright/test";
import { E2E_USER } from "./credentials";

// Connexion unique, réutilisée par tous les tests (le débit de connexion est limité).
setup("connexion", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Adresse e-mail").fill(E2E_USER.email);
  await page.getByLabel("Mot de passe").fill(E2E_USER.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL("/");
  await page.context().storageState({ path: "tests/e2e/.auth/user.json" });
});
