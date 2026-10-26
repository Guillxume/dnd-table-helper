/** Feuille officielle d'exemple : tsx scripts/render-official.ts <classe> <espèce> <historique> [sortie] */
import { writeFileSync } from "node:fs";
import { computeSheet } from "../src/character/sheet.js";
import { renderOfficialSheetPdf } from "../src/character/official-sheet.js";
import { autoplay } from "../tests/helpers.js";

const [classId = "magicien", speciesId = "elfe", backgroundId = "sage", out = "/tmp/official.pdf"] = process.argv.slice(2);
const draft = autoplay(
  { classId, speciesId, backgroundId, name: "Aldric de la Vallée" },
  { story: [JSON.stringify({ origin: "Né dans une cité souterraine.", personality: "Curieux, prudent.", backstory: "A quitté sa famille pour étudier." })] },
);
draft.story = { origin: "Né dans une cité souterraine, au bord du lac noir.", personality: "Curieux, prudent, parle trop.", appearance: "Grand, cheveux gris.", backstory: "A quitté sa famille pour étudier les arcanes." };
const buf = await renderOfficialSheetPdf(computeSheet(draft), { playerName: "Joueur" });
writeFileSync(out, buf);
console.log(`${out} (${buf.length} octets)`);
