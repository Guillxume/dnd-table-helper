import { expect, test } from "@playwright/test";
import { pngFile } from "./helpers";

test("une image devient une carte quadrillée à imprimer sur A4", async ({ page }) => {
  await page.goto("/library/import");
  await page.getByTestId("file-input").setInputFiles([await pngFile("crypte-vue-du-dessus.png", 1536, 1024)]);
  await expect(page.getByText("1 importée")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("link", { name: "Compléter" }).click();

  await page.getByRole("link", { name: "Créer une carte de bataille" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Nouvelle carte de bataille" })).toBeVisible();
  // 20 colonnes par défaut, rangées déduites des proportions 3:2 de l'image.
  await expect(page.getByLabel("Rangées", { exact: true })).toHaveValue("13");
  await expect(page.getByText(/sur 4 feuilles A4/)).toBeVisible();

  await page.getByLabel("Colonnes", { exact: true }).fill("11");
  await expect(page.getByLabel("Rangées", { exact: true })).toHaveValue("7");
  await expect(page.getByText(/sur 1 feuille A4/)).toBeVisible();

  await page.getByLabel("Titre", { exact: true }).fill("Crypte du temple");
  await page.getByRole("button", { name: "Créer la carte" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Crypte du temple" })).toBeVisible();

  const pdf = await page.request.get(`/api/battle-maps/${page.url().split("/").pop()}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");

  await page.goto("/cartes");
  await expect(page.getByRole("link", { name: "Crypte du temple", exact: true })).toBeVisible();
});
