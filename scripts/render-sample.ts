/** Génère une fiche d'exemple dans /tmp pour contrôle visuel : tsx scripts/render-sample.ts <classe> <espèce> <historique> */
import { writeFileSync } from "node:fs";
import { renderSheetPdf } from "../src/character/pdf.js";
import { computeSheet } from "../src/character/sheet.js";
import { autoplay } from "../tests/helpers.js";

const [classId = "magicien", speciesId = "elfe", backgroundId = "sage", out = "/tmp/sample.pdf"] = process.argv.slice(2);
const draft = autoplay({ classId, speciesId, backgroundId, name: "Aldric de la Vallée" });
const buf = await renderSheetPdf(computeSheet(draft));
writeFileSync(out, buf);
console.log(`${out} (${buf.length} octets)`);
