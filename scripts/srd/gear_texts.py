"""Extrait les outils et le matériel d'aventurier (nom, prix, description) du texte du SRD 5.2.1 FR.
Usage : python3 scripts/srd/gear_texts.py <corpus.txt> src/srd/data/gear.json  (contrôlé par npm run srd:verify)"""
import json, re, sys
sys.path.insert(0, __import__("os").path.dirname(__file__))
from spell_texts_join import join, set_corpus  # noqa: E402

corpus_path, out_path = sys.argv[1:3]
lines = [l.rstrip() for l in open(corpus_path, encoding="utf-8").read().splitlines()]
a = next(i for i, l in enumerate(lines) if l.strip() == "Outils" and i > 5000)
b = next(i for i, l in enumerate(lines) if l.strip() == "Montures et véhicules" and i > a)
set_corpus("\n".join(lines))
lines = lines[a:b]
FOOT = re.compile(r"^(Document de Référence du Système 5\.2\.1|\d{1,3})$")
HEAD = re.compile(r"^(?P<name>[A-ZÀ-Ý][^()]{1,60}?) \((?P<price>[\d  ,.]+ (?:po|pa|pc)|variable)\)$")
items, cur, skipping = [], None, False
for l in lines:
    t = l.strip()
    if FOOT.match(t) or not t:
        continue
    m = HEAD.match(t)
    if m:
        skipping = False
        cur = {"name": m.group("name"), "price": m.group("price"), "lines": []}
        items.append(cur)
        continue
    if t in ("Matériel d’aventurier", "Outils d’artisan", "Autres outils") or t.startswith("Objet Poids Prix"):
        skipping = True
        continue
    if cur and not skipping:
        cur["lines"].append(t)
out = {}
for it in items:
    if it["name"] in out:
        continue
    out[it["name"]] = {"price": it["price"], "text": join(it["lines"])}
json.dump(out, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(out), "objets")
