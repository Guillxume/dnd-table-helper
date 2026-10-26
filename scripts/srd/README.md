# Outils d'extraction du SRD 5.2.1 (FR)

Ces scripts ont servi à produire les fichiers de `src/srd/data/` à partir du PDF officiel
(`ref/FR_SRD_CC_v5.2.1.pdf`, licence CC-BY-4.0). Ils sont conservés pour la traçabilité.

Limites connues :
- Les scripts Python lisent des pages pré-extraites dans `~/work/srd/col` (texte par colonnes) et `~/work/srd/lay`
  (texte en mode layout), obtenues avec `pdftotext`. Le script qui a découpé les pages en colonnes n'a pas été conservé :
  ces scripts ne sont donc pas rejouables tels quels.
- La référence de contrôle est `npm run srd:verify` (TypeScript), qui compare les données au PDF et ne dépend pas de ces scripts.

## Vérification

    SRD_PDF=ref/FR_SRD_CC_v5.2.1.pdf npm run srd:verify

Nécessite `pdftotext` (poppler). Le script liste aussi ce qui n'est pas vérifié automatiquement.
