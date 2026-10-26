import { expect, type Page, test } from "@playwright/test";
import { E2E_GAME, E2E_PLAYER } from "./credentials";

/** Date dans dix jours, au format d'un champ <input type="date">. */
function inTenDays(): string {
  const date = new Date(Date.now() + 10 * 86_400_000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function signInAsPlayer(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  if (!(await page.getByLabel("Adresse e-mail").isVisible())) await page.getByText("Connexion du MJ (e-mail)").click();
  await page.getByLabel("Adresse e-mail").fill(E2E_PLAYER.email);
  await page.getByLabel("Mot de passe").fill(E2E_PLAYER.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/personnages$/);
}

test("le MJ fixe la séance et les règles ; la joueuse les voit et envoie sa note", async ({ page }) => {
  // Session du MJ (compte de l'atelier, administrateur du site).
  await page.goto("/campagnes");
  await page.getByRole("link", { name: new RegExp(E2E_GAME.campaignName.replace(/[()]/g, "\\$&")) }).click();
  await expect(page.getByText("Tu es MJ")).toBeVisible();

  await page.getByRole("link", { name: "Séances et rappels" }).click();
  await page.getByLabel("Date").fill(inTenDays());
  await page.getByLabel("Heure").fill("20:30");
  await page.getByLabel("Note pour les joueurs (facultatif)").fill("Chez Paul");
  await page.getByRole("button", { name: "Enregistrer la séance" }).click();
  await expect(page.getByText(/Séance fixée au .* à 20:30/)).toBeVisible();
  // L'annonce attend le bot (qui ne tourne pas pendant les tests).
  await expect(page.getByText("Annonce de séance")).toBeVisible();

  await page.getByRole("link", { name: "Règles et style" }).click();
  await page.getByLabel(/Valeurs standard/).uncheck();
  await page.getByRole("button", { name: "Enregistrer les règles" }).click();
  await expect(page.getByText("Règles de création enregistrées.")).toBeVisible();

  // Documents du MJ, générés par le serveur autonome (polices et pdfkit embarqués).
  for (const path of ["groupe", "export"]) {
    const response = await page.request.get(`/api/campagnes/${E2E_GAME.campaignId}/${path}`);
    expect(response.status(), path).toBe(200);
    expect(response.headers()["content-type"]).toBe("application/pdf");
    expect((await response.body()).subarray(0, 5).toString()).toBe("%PDF-");
  }

  await signInAsPlayer(page);
  expect((await page.request.get(`/api/campagnes/${E2E_GAME.campaignId}/groupe`)).status()).toBe(403);
  await page.getByRole("link", { name: "Mes campagnes" }).click();
  await page.getByRole("link", { name: new RegExp(E2E_GAME.campaignName.replace(/[()]/g, "\\$&")) }).click();
  await expect(page.getByText(/à 20:30/)).toBeVisible();
  await expect(page.getByText("Note du MJ : Chez Paul")).toBeVisible();
  await expect(page.getByText("Tu es MJ")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Séances et rappels" })).toHaveCount(0);
  await expect(page.getByText(/Valeurs standard/)).toHaveCount(0);

  await page.getByLabel("Ce dont tu te souviens de la dernière séance").fill("On a trouvé une lettre scellée.");
  await page.getByRole("button", { name: "Envoyer ma note" }).click();
  await expect(page.getByText("Ta note servira au prochain rappel")).toBeVisible();
});
