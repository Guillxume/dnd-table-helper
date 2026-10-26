"""Extrait la description des sorts de niveau 0 et 1 utilisés par le bot depuis le texte du SRD 5.2.1 FR.
Usage : python3 scripts/srd/spell_texts.py <corpus.txt> src/srd/data/spells.json src/srd/data/spell-texts.json
Le corpus est le texte du PDF remis dans l'ordre de lecture (colonnes). Le résultat est contrôlé par npm run srd:verify."""
import json, re, sys

corpus_path, spells_path, out_path = sys.argv[1:4]
lines = [l.rstrip() for l in open(corpus_path, encoding="utf-8").read().splitlines()]
start = next(i for i, l in enumerate(lines) if l.strip() == "Description des sorts" and i > 1000)
lines = lines[start:]
FOOT = re.compile(r"^(Document de Référence du Système 5\.2\.1|\d{1,3})$")
lines = [l for l in lines if not FOOT.match(l.strip())]
SCHOOL = re.compile(r"^(Abjuration|Divination|Enchantement|Évocation|Illusion|Invocation|Nécromancie|Transmutation)( mineure? \(| du \d)")
names = sorted({s["name"] for s in json.load(open(spells_path, encoding="utf-8"))})

sys.path.insert(0, __import__("os").path.dirname(__file__))
from spell_texts_join import join, set_corpus  # noqa: E402

set_corpus("\n".join(lines))

starts = [i for i in range(len(lines) - 1) if lines[i].strip() and SCHOOL.match(lines[i + 1].strip())]
res = {}
for name in names:
    idx = [i for i in starts if lines[i].strip() == name]
    if len(idx) != 1:
        print("introuvable ou ambigu :", name, idx)
        continue
    i = idx[0]
    nxt = next((j for j in starts if j > i), len(lines))
    block = lines[i + 1 : nxt]
    k = next(n for n, l in enumerate(block) if l.startswith("Temps d’incantation"))
    head = {"Temps d’incantation": [], "Portée": [], "Composantes": [], "Durée": []}
    cur = None
    n = k
    while n < len(block):
        l = block[n]
        m = re.match(r"^(Temps d’incantation|Portée|Composantes|Durée) : (.*)$", l)
        if m:
            cur = m.group(1)
            head[cur].append(m.group(2))
            n += 1
            if cur == "Durée":
                break
            continue
        head[cur].append(l)
        n += 1
    body = join(block[n:])
    for sub in ["Emplacement de niveau supérieur.", "Amélioration de sort mineur."]:
        body = body.replace(" " + sub, "\n" + sub)
    res[name] = {
        "casting": join(head["Temps d’incantation"]),
        "range": join(head["Portée"]),
        "components": join(head["Composantes"]),
        "duration": join(head["Durée"]),
        "text": body,
    }
json.dump(res, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(res), "sorts sur", len(names))
