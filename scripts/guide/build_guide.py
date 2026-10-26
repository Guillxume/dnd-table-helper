"""Extrait les guides d'orientation fournis par le MJ (ref/*.pdf) vers src/guide/guide.json.
Usage : python3 scripts/guide/build_guide.py ref src/guide/guide.json
Source : documents fournis par l'utilisateur, résumés d'orientation, hors SRD."""
import json, re, sys
import pdfplumber

ref, out = sys.argv[1], sys.argv[2]
IDS = {"barbare":"Barbare","barde":"Barde","clerc":"Clerc","druide":"Druide","ensorceleur":"Ensorceleur","guerrier":"Guerrier",
       "magicien":"Magicien","moine":"Moine","occultiste":"Occultiste","paladin":"Paladin","rodeur":"Rôdeur","roublard":"Roublard"}
clean = lambda s: re.sub(r"\s+", " ", (s or "")).strip().replace("D&D;", "D&D")

def section(text, start, ends):
    m = re.search(start, text)
    if not m: return ""
    rest = text[m.end():]
    cut = min([x.start() for e in ends for x in [re.search(e, rest)] if x] or [len(rest)])
    return clean(rest[:cut])

data = {"source": "Guides d'orientation fournis par le MJ (résumés, non SRD, non vérifiés par l'assistant)", "overview": {}, "classes": {}}
with pdfplumber.open(f"{ref}/Guide_orientation_personnage_DnD5e_2024_FR.pdf") as pdf:
    for row in pdf.pages[2].extract_tables()[0][1:]:
        c = [clean(x) for x in row]
        data["overview"][c[0]] = {"style": c[1], "atouts": c[2], "aConsiderer": c[3], "evolution": c[4]}
    qs = pdf.pages[5].extract_text()
    data["questions"] = [clean(l[1:]) for l in re.split(r"\n(?=•)", qs.split("6. Questions pour trouver le bon concept")[1].split("7. Comment")[0]) if l.strip().startswith("•")]
for cid, name in IDS.items():
    with pdfplumber.open(f"{ref}/Trajectoire_{cid}_DnD5e_2024.pdf") as pdf:
        p = pdf.pages[0]
        t = p.extract_text()
        tabs = p.extract_tables()
        subs = [{"nom": clean(r[0]), "orientation": clean(r[1])} for r in tabs[0][1:]]
        jalons = [{"niveau": clean(r[0]), "change": clean(r[1]), "sens": clean(r[2])} for r in tabs[1][1:]]
        data["classes"][cid] = {
            "nom": name,
            "role": section(t, r"Rôle :", [r"\nAxes de construction"]),
            "axes": section(t, r"Axes de construction :", [r"\nSous-classes"]),
            "sousClasses": subs,
            "jalons": jalons,
            "reperes": section(t, r"Repères mécaniques publiés pour l'édition 2024", [r"\nComment planifier"]),
            "planifier": section(t, r"Comment planifier les choix", [r"\nRéférence officielle"]),
        }
json.dump(data, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print({k: (len(v["sousClasses"]), len(v["jalons"])) for k, v in data["classes"].items()}, len(data["overview"]), len(data["questions"]))
