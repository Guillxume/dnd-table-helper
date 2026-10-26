import { expect, type Page, test } from "@playwright/test";
import { E2E_PLAYER } from "./credentials";

test.use({ storageState: { cookies: [], origins: [] } });

async function signInAsPlayer(page: Page) {
  await page.goto("/login");
  // Le formulaire e-mail est replié quand la connexion Discord est proposée.
  if (!(await page.getByLabel("Adresse e-mail").isVisible())) await page.getByText("Connexion du MJ (e-mail)").click();
  await page.getByLabel("Adresse e-mail").fill(E2E_PLAYER.email);
  await page.getByLabel("Mot de passe").fill(E2E_PLAYER.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/personnages$/);
}

/** Avance d'une étape avec les premiers choix possibles. Renvoie false une fois au récapitulatif. */
async function answerCurrentStep(page: Page): Promise<boolean> {
  const card = page.locator("section[aria-live]");
  if (await page.getByRole("button", { name: "Enregistrer mon personnage" }).isVisible()) return false;
  const title = await card.locator("h2").first().textContent();

  if (await page.getByRole("button", { name: "Lancer les dés" }).isVisible()) {
    await page.getByRole("button", { name: "Lancer les dés" }).click();
    // Les dés roulent, puis le tirage est révélé avec ses six totaux.
    await expect(page.getByRole("heading", { name: "Ton tirage" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("status").filter({ hasText: /^Résultats : (\d+, ){5}\d+\./ })).toBeVisible();
  } else if (await page.getByRole("button", { name: "Passer cette étape" }).isVisible()) {
    await page.getByLabel("Apparence").fill("Écailles cuivrées, regard calme.");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  } else if (await page.getByLabel("Lancer 1").isVisible()) {
    for (const [index, value] of ["15", "14", "13", "12", "10", "8"].entries()) {
      await page.getByLabel(`Lancer ${index + 1}`).fill(value);
    }
    await page.getByRole("button", { name: "Enregistrer mes résultats" }).click();
  } else if ((await card.getByRole("radio").count()) > 0) {
    // Méthode des caractéristiques : le tirage aux dés, pour passer par l'animation.
    const random = card.getByRole("radio", { name: /Tirage aléatoire/ });
    await ((await random.count()) > 0 ? random : card.getByRole("radio").first()).click();
    await page.getByRole("button", { name: "Continuer" }).click();
  } else if ((await card.getByRole("checkbox").count()) > 0) {
    const counter = (await card.getByText(/choisis? sur/).textContent()) ?? "";
    const minimum = Number(/sur (\d+)/.exec(counter)?.[1] ?? 1);
    for (let index = 0; index < minimum; index++) await card.getByRole("checkbox").nth(index).click();
    await page.getByRole("button", { name: "Continuer" }).click();
  } else {
    // Étape de confirmation : un seul bouton d'action dans la carte.
    await card.getByRole("button").last().click();
  }
  await expect(card.locator("h2").first()).not.toHaveText(title ?? "", { timeout: 15_000 });
  return true;
}

test("une joueuse crée son personnage sur le site et télécharge sa fiche", async ({ page }) => {
  await signInAsPlayer(page);

  // L'atelier du MJ lui est fermé.
  await page.goto("/library");
  await expect(page).toHaveURL(/\/personnages$/);

  await page.getByLabel("Nom de ton personnage").fill("Rek'tal");
  await page.getByRole("button", { name: "Commencer" }).click();
  await expect(page).toHaveURL(/\/personnages\/creation$/);
  await expect(page.getByRole("heading", { level: 1, name: "Rek'tal" })).toBeVisible();

  // Retour arrière disponible dès la première réponse.
  const card = page.locator("section[aria-live]");
  const firstTitle = (await card.locator("h2").first().textContent()) ?? "";
  await answerCurrentStep(page);
  await page.getByRole("button", { name: "Étape précédente" }).click();
  await expect(card.locator("h2").first()).toHaveText(firstTitle);
  await expect(page.getByRole("button", { name: "Étape précédente" })).toBeDisabled();

  // Interruption puis reprise : rien n'est perdu.
  await answerCurrentStep(page);
  await page.goto("/personnages");
  await page.getByRole("link", { name: "Reprendre là où j'en étais" }).click();
  await expect(page.getByRole("button", { name: "Étape précédente" })).toBeEnabled();

  for (let guard = 0; guard < 80 && (await answerCurrentStep(page)); guard++);
  await expect(page.getByRole("heading", { name: "Récapitulatif" })).toBeVisible();
  await page.getByRole("button", { name: "Enregistrer mon personnage" }).click();

  await expect(page.getByText("Ton personnage est enregistré.")).toBeVisible({ timeout: 20_000 });
  const pdf = await page.request.get(page.url().replace(/\/personnages\/(\d+).*/, "/api/personnages/$1/pdf"));
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");

  // Publication sur Discord : le site enregistre la demande, le bot la traitera.
  await page.getByRole("button", { name: "Publier dans le salon des fiches (Discord)" }).click();
  await expect(page.getByText("Publication en cours")).toBeVisible();

  await page.goto("/personnages");
  await expect(page.getByRole("link", { name: /Rek'tal/ })).toBeVisible();
});
