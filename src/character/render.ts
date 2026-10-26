import type { Draft } from "./draft.js";
import { officialTemplateAvailable, renderOfficialSheetPdf, templatePath } from "./official-sheet.js";
import { renderSheetPdf } from "./pdf.js";
import { computeSheet } from "./sheet.js";

/**
 * PDF du personnage : feuille officielle remplie + annexe si le modèle est présent dans ref/,
 * sinon la fiche maison (et un avertissement dans les journaux).
 * `pendingScores` : fiche à cases vides, avant la saisie des dés lancés à la table.
 */
export async function characterPdf(draft: Draft, player?: string, opts: { pendingScores?: boolean } = {}): Promise<Buffer> {
  const sheet = computeSheet(draft, opts);
  if (officialTemplateAvailable()) return renderOfficialSheetPdf(sheet, player ? { playerName: player } : {});
  console.warn(`Modèle de feuille absent (${templatePath()}) : fiche maison utilisée.`);
  return renderSheetPdf(sheet);
}

