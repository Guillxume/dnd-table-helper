import { expect, test } from "@playwright/test";
import { pngFile } from "./helpers";

test.describe.configure({ mode: "serial" });

test("fiche personnage, guide, brief, copie du prompt et archivage d'une génération", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  // Une référence dans la bibliothèque.
  await page.goto("/library/import");
  await page.getByTestId("file-input").setInputFiles([await pngFile("texture-peinte.png")]);
  await expect(page.getByText("1 importée")).toBeVisible({ timeout: 30_000 });

  // Fiche personnage.
  await page.goto("/characters/new");
  await page.getByLabel("Nom").fill("Rek'tal");
  await page.getByLabel("Espèce").fill("Drakéide");
  await page.getByLabel("Tenue et matières").fill("Armure de plates noircie");
  await page.getByRole("button", { name: "Créer la fiche" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Rek'tal" })).toBeVisible();
  await expect(page.getByText("Inconnu").first()).toBeVisible();

  await page.getByLabel("Statut").selectOption("CANON");
  await page.getByLabel("Contenu").fill("Écailles cuivrées");
  await page.getByLabel(/Intangible/).check();
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByText("Écailles cuivrées")).toBeVisible();

  await page.getByLabel("Statut").selectOption("PROPOSAL");
  await page.getByLabel("Contenu").fill("Cape rouge");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByText("Cape rouge")).toBeVisible();

  await page.getByRole("button", { name: "Choisir dans la bibliothèque" }).click();
  const picker = page.getByRole("dialog");
  await picker.getByRole("button", { name: "texture peinte" }).click();
  await picker.getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByRole("link", { name: "texture peinte" })).toBeVisible();
  const characterUrl = page.url();

  // Guide artistique et première version des règles.
  await page.goto("/style-guides");
  await page.getByRole("button", { name: "Nouveau guide" }).first().click();
  await page.getByRole("dialog").getByLabel("Nom").fill("Fantasy peinte");
  await page.getByRole("dialog").getByRole("button", { name: "Créer" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Fantasy peinte" })).toBeVisible();
  await page.getByRole("link", { name: "Modifier les règles" }).click();
  await page.getByLabel("Textures").fill("Coups de pinceau visibles");
  await page.getByLabel("Éléments à éviter").fill("Rendu 3D lisse");
  await page.getByRole("button", { name: "Enregistrer une nouvelle version" }).click();
  await expect(page.getByText("Version 2 enregistrée.")).toBeVisible();

  // Référence associée à un aspect du guide.
  await page.getByRole("button", { name: "Textures" }).first().click();
  await page.getByRole("button", { name: "Choisir dans la bibliothèque" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "texture peinte" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByRole("link", { name: "texture peinte" })).toBeVisible();

  // Brief depuis la fiche personnage.
  await page.goto(characterUrl);
  await page.getByRole("link", { name: "Préparer un brief" }).click();
  await page.getByLabel("Titre du brief").fill("Portrait de Rek'tal");
  await page.getByLabel("Objectif de l'image").fill("Portrait de référence en buste");
  await page.getByLabel("Type d'image").fill("Portrait en buste");
  await page.getByLabel("Guide artistique").selectOption({ label: "Fantasy peinte" });
  await page.getByRole("button", { name: "Choisir dans la bibliothèque" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "texture peinte" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Ajouter" }).click();
  await page.getByRole("button", { name: "Textures" }).click();
  await page.getByRole("button", { name: "Générer le brief" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Portrait de Rek'tal" })).toBeVisible();
  const prompt = page.getByLabel("Prompt", { exact: true });
  await expect(prompt).toContainText("Drakéide");
  await expect(prompt).toContainText("Écailles cuivrées");
  await expect(prompt).not.toContainText("Cape rouge");
  await expect(page.getByLabel("9. Éléments explicitement interdits")).toContainText("Rendu 3D lisse");

  // Modification, enregistrement et copie.
  await prompt.fill("Prompt retouché : portrait en buste de Rek'tal, drakéide aux écailles cuivrées.");
  await page.getByRole("button", { name: "Enregistrer le texte" }).click();
  await expect(page.getByText("Brief enregistré.")).toBeVisible();
  await page.getByRole("button", { name: "Copier le prompt" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("Prompt retouché");

  const exportResponse = await page.request.get(`${page.url().replace(/\?.*$/, "")}`.replace("/workshop/", "/api/briefs/") + "/export");
  expect(exportResponse.status()).toBe(200);
  const exported = await exportResponse.json();
  expect(exported.brief.prompt).toContain("Prompt retouché");
  expect(exported.references).toHaveLength(1);

  // Archivage d'une génération importée manuellement.
  await page.getByRole("link", { name: "Archiver une génération" }).click();
  await page.getByTestId("file-input").setInputFiles([await pngFile("rektal-v1.png")]);
  await expect(page.getByRole("button", { name: "Changer" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel("Prompt utilisé")).toHaveValue(/Prompt retouché/);
  await page.getByLabel("Notes de révision").fill("Écailles trop sombres.");
  await page.getByRole("button", { name: "Archiver la génération" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Portrait de Rek'tal" })).toBeVisible();
  await expect(page.getByText("Prompt retouché").first()).toBeVisible();
  await expect(page.getByText("Image 1 · texture peinte")).toBeVisible();
  await expect(page.getByRole("link", { name: "Fantasy peinte v2" })).toBeVisible();
  await page.getByRole("button", { name: "Validée", exact: true }).click();
  await expect(page.getByRole("button", { name: "Validée", exact: true })).toHaveAttribute("aria-pressed", "true");

  // Génération validée : elle rejoint les références validées du personnage en un clic.
  await page.getByRole("button", { name: /Ajouter aux références validées de Rek'tal/ }).click();
  await expect(page.getByText(/Référence validée de/)).toBeVisible();

  // Nouvelle version liée à la précédente.
  await page.getByRole("link", { name: "Nouvelle version" }).click();
  await expect(page.getByText("Nouvelle version de : Portrait de Rek'tal")).toBeVisible();
  await page.getByRole("button", { name: "Archiver la génération" }).click();
  await expect(page.getByText(/v1 · Portrait de Rek'tal/)).toBeVisible();
});
