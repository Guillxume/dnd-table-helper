import { expect, test } from "@playwright/test";
import { pngFile } from "./helpers";

test.describe("accès non authentifié", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("redirige vers la connexion et refuse les fichiers privés", async ({ page, request }) => {
    await page.goto("/library");
    await expect(page).toHaveURL(/\/login\?next=%2Flibrary/);
    await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();

    const file = await request.get("/api/files/00000000-0000-4000-8000-000000000000/original");
    expect(file.status()).toBe(401);
    const upload = await request.post("/api/assets", { multipart: { file: await pngFile("x.png") } });
    expect(upload.status()).toBe(401);
  });

  test("refuse des identifiants erronés", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Adresse e-mail").fill("e2e@atelier.test");
    await page.getByLabel("Mot de passe").fill("mauvais-mot-de-passe");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByText("Identifiants incorrects.")).toBeVisible();
  });
});

test.describe("bibliothèque", () => {
  test("import, galerie, fiche, tags, recherche et collection", async ({ page }) => {
    await page.goto("/library/import");
    await page.getByTestId("file-input").setInputFiles([
      await pngFile("paladin-aube.png"),
      await pngFile("crypte-oubliee.png", 1600, 900),
      { name: "notes.png", mimeType: "image/png", buffer: Buffer.from("ceci n'est pas une image") },
    ]);
    await expect(page.getByText("2 importées · 1 erreur")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Format non reconnu/)).toBeVisible();

    await page.goto("/library");
    const gallery = page.getByRole("region", { name: "Illustrations" });
    await expect(gallery.getByRole("link")).toHaveCount(2);
    // Les miniatures sont réellement servies par la route protégée.
    const thumbnail = gallery.locator("img").first();
    await expect(thumbnail).toHaveJSProperty("complete", true);
    expect(await thumbnail.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

    await gallery.getByRole("link", { name: "paladin aube" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "paladin aube" })).toBeVisible();
    await page.getByLabel("Ajouter des tags").fill("Lumière divine, clerc");
    await page.getByRole("button", { name: "Ajouter les tags" }).click();
    await expect(page.getByRole("list", { name: "Tags" }).getByText("Lumière divine")).toBeVisible();

    await page.getByLabel("Titre", { exact: true }).fill("Paladin à l'aube");
    await page.getByLabel("Artiste").fill("Artiste inconnu du forum");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Paladin à l'aube" })).toBeVisible();

    // Recherche sans accent sur un tag accentué.
    await page.goto("/library?q=lumiere");
    await expect(gallery.getByRole("link")).toHaveCount(1);

    // Sélection multiple et création d'une collection.
    await page.goto("/library");
    await page.getByRole("button", { name: "Sélectionner", exact: true }).click();
    await gallery.getByRole("link").first().click();
    await gallery.getByRole("link").nth(1).click();
    await expect(page.getByText("2 sélectionnées")).toBeVisible();
    await page.getByRole("toolbar").getByRole("button", { name: "Collection" }).click();
    await page.getByLabel("Nouvelle collection").fill("Références pour Rek'tal");
    await page.getByRole("button", { name: "Créer et ajouter" }).click();
    await expect(page.getByText("Collection « Références pour Rek'tal » créée.")).toBeVisible();

    await page.goto("/collections");
    await page.getByRole("link", { name: /Références pour Rek'tal/ }).click();
    await expect(page.getByRole("region", { name: "Illustrations" }).getByRole("link")).toHaveCount(2);
  });
});
