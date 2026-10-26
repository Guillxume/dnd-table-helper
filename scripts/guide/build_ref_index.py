"""Index de recherche des documents du MJ (ref/*.pdf) pour /chercher : src/guide/ref-index.json.
Usage : python3 scripts/guide/build_ref_index.py ref src/guide/ref-index.json   (pdfplumber requis)
Sources : référentiel d'origines, guide d'orientation et trajectoires des 12 classes, fournis par le MJ
(générés avec ChatGPT puis vérifiés par lui sur le site officiel). Les fiches de trajectoire individuelles
reprennent le fichier des 12 classes : elles ne sont pas indexées deux fois.
Chaque ligne de tableau devient une entrée (titre = première colonne), chaque section ou fiche un passage."""
import json, re, sys
import pdfplumber

ref, out = sys.argv[1], sys.argv[2]
DOCS = [
    ("Referentiel_origines_especes_alignements_DnD5e_2024_FR.pdf", "Référentiel d’origines du MJ"),
    ("Guide_orientation_personnage_DnD5e_2024_FR.pdf", "Guide d’orientation du MJ"),
    ("Trajectoires_des_12_classes_DnD5e_2024.pdf", "Trajectoires des classes du MJ"),
]
clean = lambda s: re.sub(r"\s+", " ", (s or "")).strip().replace("D&D;", "D&D")
# Pied de page répété sur chaque page des documents.
FOOTER = re.compile(r"(Jdr Helper|Guide d’orientation D&D 5e 2024)[^\n]*Page \d+\n?")
HEADING = re.compile(r"^(\d+)\. (.+)$")

entries = []
def add(title, text, source, page, kind):
    title, text = clean(title), clean(text)
    if title and text and len(text) > 20:
        entries.append({"id": len(entries), "title": title, "text": text, "source": source, "page": page, "kind": kind})

for name, source in DOCS:
    with pdfplumber.open(f"{ref}/{name}") as pdf:
        for n, page in enumerate(pdf.pages, start=1):
            text = FOOTER.sub("", page.extract_text() or "").replace("D&D;", "D&D")
            cls = text.split("\n", 1)[0].strip().capitalize() if name.startswith("Trajectoires") else ""
            # Lignes de tableaux : une entrée par ligne, avec les en-têtes de colonnes.
            for table in page.extract_tables():
                header = [clean(h) for h in table[0]]
                if len(header) < 2:
                    continue
                for row in table[1:]:
                    cells = [clean(c) for c in row]
                    if not cells or not cells[0]:
                        continue
                    body = " · ".join(f"{h} : {c}" for h, c in zip(header[1:], cells[1:]) if c)
                    title = cells[0]
                    if header[0].lower() == "classe" and len(cells) > 1 and header[1].lower().startswith("sous-classe"):
                        title = f"{cells[1]} ({cells[0]})"  # guide : une ligne par sous-classe
                    elif cls and header[0].lower() == "sous-classe":
                        title = f"{cells[0]} ({cls})"
                    elif cls and header[0].lower().startswith("niveau"):
                        title = f"{cls} : niveau {cells[0]}"
                    add(title, body, source, n, header[0].lower())
            # Fiche de trajectoire : une page par classe, titrée par le nom de la classe.
            if name.startswith("Trajectoires"):
                first = text.split("\n", 1)[0]
                add(f"Trajectoire : {first.capitalize()}", text, source, n, "trajectoire")
                continue
            # Sections numérotées (« 3. Comparer les 12 classes ») : un passage par section.
            current, lines = None, []
            for line in text.split("\n"):
                m = HEADING.match(line.strip())
                if m:
                    if current:
                        add(current, "\n".join(lines), source, n, "section")
                    current, lines = m.group(2), []
                else:
                    lines.append(line)
            add(current or source, "\n".join(lines), source, n, "section")

with open(out, "w", encoding="utf-8") as f:
    json.dump(entries, f, ensure_ascii=False, indent=1)
print(f"{len(entries)} entrées écrites dans {out}")
