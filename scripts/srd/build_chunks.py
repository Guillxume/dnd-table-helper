"""Découpe le texte du SRD 5.2.1 FR en extraits pour la recherche (/preparer).
Usage : python3 scripts/srd/build_chunks.py <dossier des pages> <corpus.txt> src/srd/data/srd-chunks.json
Le dossier contient une page par fichier (001.txt…), texte remis dans l'ordre de lecture des colonnes. Chaque bloc de statistiques de créature forme
un extrait ; le reste est découpé par titres de la table des matières, puis en fenêtres de 1 800 caractères."""
import json, re, sys

col_dir, corpus_path, out_path = sys.argv[1:4]
FOOT = "Document de Référence du Système 5.2.1"

# Pages du PDF remises dans l'ordre de lecture (un fichier par page, colonnes gauche puis droite).
lines, pages = [], []
for page in range(1, 400):
    try:
        text = open(f"{col_dir}/{page:03d}.txt", encoding="utf-8").read()
    except FileNotFoundError:
        break
    for t in text.splitlines():
        s_ = t.strip()
        if s_.startswith("#####") or FOOT in s_ or re.fullmatch(r"\d{1,3}", s_):
            continue
        lines.append(re.sub(r"\s+", " ", s_))
        pages.append(page)

# Titres de la table des matières (« Titre......page »), lus dans le texte complet du PDF.
toc = set()
for t in open(corpus_path, encoding="utf-8").read().splitlines()[:700]:
    m = re.match(r"^(.+?)\s*\.{3,}\s*\d+$", t.strip())
    if m and len(m.group(1).strip()) > 2:
        toc.add(re.sub(r"\s+", " ", m.group(1).strip()))

TYPE = re.compile(r"^(Aberration|Bête|Céleste|Créature artificielle|Artificiel|Dragon|Élémentaire|Fée|Fiélon|Géant|Humanoïde|Monstruosité|Mort-vivant|Plante|Vase|Nuée)[^,]* de taille (TP|P|M|G|TG|Gig)\b")

BLOCK_PARTS = {"Actions", "Actions Bonus", "Réactions", "Actions légendaires", "Traits"}

def is_monster_start(k):
    if k + 2 >= len(lines):
        return False
    name, typ = lines[k].strip(), lines[k + 1].strip()
    if not name or len(name) > 60 or not TYPE.match(typ):
        return False
    return any(lines[j].startswith("CA ") for j in range(k + 2, min(k + 5, len(lines))))

def join(block):
    out = ""
    for p in block:
        p = p.strip()
        if not p:
            continue
        if out.endswith("-") and p[:1].islower():
            out = out[:-1] + p
        else:
            out = f"{out} {p}" if out else p
    return out

# On saute la table des matières (pages 1 à 5).
start = next(k for k, p in enumerate(pages) if p >= 6)
chunks = []
cur_title, cur_kind, cur_lines, cur_page = "Introduction", "règle", [], pages[start]

def flush():
    global cur_lines
    text = join(cur_lines)
    if len(text) < 40:
        cur_lines = []
        return
    if cur_kind == "créature" or len(text) <= 2200:
        chunks.append({"title": cur_title, "kind": cur_kind, "page": cur_page, "text": text})
    else:
        # Fenêtres sur des fins de phrase, avec un léger recouvrement.
        pos = 0
        while pos < len(text):
            end = min(len(text), pos + 1800)
            if end < len(text):
                cut = text.rfind(". ", pos + 1200, end)
                end = cut + 1 if cut > 0 else end
            chunks.append({"title": cur_title, "kind": cur_kind, "page": cur_page, "text": text[pos:end].strip()})
            if end >= len(text):
                break
            pos = max(end - 150, pos + 1)
    cur_lines = []

for k in range(start, len(lines)):
    t = lines[k].strip()
    if is_monster_start(k):
        flush()
        cur_title, cur_kind, cur_page = t, "créature", pages[k]
        cur_lines = [lines[k]]
        continue
    # Les intertitres d'un bloc de créature (Actions, Réactions…) ne coupent pas le bloc.
    if t in toc and t not in BLOCK_PARTS and (cur_kind != "créature" or t in toc):
        flush()
        cur_title, cur_kind, cur_page = t, "règle", pages[k]
        continue
    if not cur_lines:
        cur_page = pages[k]
    cur_lines.append(lines[k])
flush()
for n, c in enumerate(chunks):
    c["id"] = n
json.dump(chunks, open(out_path, "w", encoding="utf-8"), ensure_ascii=False)
kinds = {}
for c in chunks:
    kinds[c["kind"]] = kinds.get(c["kind"], 0) + 1
print(len(chunks), "extraits", kinds, sum(len(c["text"]) for c in chunks), "caractères")
