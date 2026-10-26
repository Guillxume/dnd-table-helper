#!/usr/bin/env python3
"""Génère src/srd/data/class-traits.json à partir des extractions du SRD (features_raw.json et pages colonnes).

Usage : build_traits.py <dossier_srd_travail> <sortie.json>
Les textes sont des citations du SRD 5.2.1 ; `npm run srd:verify` contrôle chaque phrase contre le PDF.
"""
import json, re, sys, os

work = os.path.expanduser(sys.argv[1])
out = sys.argv[2]
feats = json.load(open(f"{work}/features_raw.json", encoding="utf-8"))


# « ¶ » marque une coupure de l'extraction (tableau ou encadré intercalé) : les deux morceaux sont contigus dans le SRD.
def clean(t: str) -> str:
    return re.sub(r"\s+", " ", t).strip()


def get(cls, name):
    for x in feats[cls]:
        if x["name"] == name:
            return x["text"]
    raise KeyError((cls, name))


def pieces(t):
    return [p for p in t.split("\n")]


def cut(t, marker):
    i = t.index(marker)
    return t[:i]


traits = {
    "barbare": [
        ("Rage", clean(get("barbare", "Rage"))),
        ("Défense sans armure", clean(get("barbare", "Défense sans armure"))),
        ("Bottes d’arme", clean(cut(get("barbare", "Bottes d’arme"), "Lorsque vous atteignez certains niveaux"))),
    ],
    "barde": [
        ("Inspiration bardique", clean(cut(get("barde", "Inspiration bardique"), "À plus haut niveau"))),
    ],
    "clerc": [("Ordre divin", clean(get("clerc", "Ordre divin")))],
    "druide": [
        ("Druidique", clean(get("druide", "Druidique"))),
        ("Ordre primitif", clean(get("druide", "Ordre primitif"))),
    ],
    "ensorceleur": [("Sorcellerie innée", clean(get("ensorceleur", "Sorcellerie innée")))],
    "guerrier": [
        ("Style de combat", clean(get("guerrier", "Style de combat"))),
        ("Second souffle", clean(cut(get("guerrier", "Second souffle"), "Lorsque vous atteignez certains niveaux"))),
        ("Bottes d’arme", clean(cut(get("guerrier", "Bottes d’arme"), "Lorsque vous atteignez certains niveaux"))),
    ],
    "magicien": [
        ("Savoir rituel", clean(get("magicien", "Savoir rituel"))),
        (
            "Restauration magique",
            clean(
                pieces(get("magicien", "Restauration magique"))[0]
                + " ¶ "
                + pieces(get("magicien", "Restauration magique"))[-1]
            ),
        ),
    ],
    "moine": [],
    "occultiste": [
        ("Manifestations occultes", clean(pieces(get("occultiste", "Manifestations occultes"))[0])),
    ],
    "paladin": [
        ("Imposition des mains", clean(get("paladin", "Imposition des mains"))),
        ("Bottes d’arme", clean(get("paladin", "Bottes d’arme"))),
    ],
    "rodeur": [
        ("Ennemi juré", clean(get("rodeur", "Ennemi juré"))),
        ("Bottes d’arme", clean(get("rodeur", "Bottes d’arme"))),
    ],
    "roublard": [
        ("Expertise", clean(pieces(get("roublard", "Expertise"))[0])),
        ("Attaque sournoise", clean(get("roublard", "Attaque sournoise"))),
        ("Argot des voleurs", clean(get("roublard", "Argot des voleurs"))),
        ("Bottes d’arme", clean(get("roublard", "Bottes d’arme"))),
    ],
}

# Moine : retirer la ligne de table intercalée dans « Arts martiaux ».
am = [p for p in pieces(get("moine", "Arts martiaux")) if not p.startswith(" Arts Points de")]
traits["moine"] = [
    ("Arts martiaux", clean(" ¶ ".join(am))),
    ("Défense sans armure", clean(get("moine", "Défense sans armure"))),
]

# Options de Manifestation occulte sans prérequis (page 70 à 72).
col = ""
for p in (70, 71, 72):
    col += open(f"{work}/col/{p:03d}.txt", encoding="utf-8").read() + "\n"
col = re.sub(r"##### PAGE \d+ (LEFT|RIGHT)", "", col)
col = re.sub(r"^\s*\d+\s+Document de Référence du Système 5\.2\.1\s*$", "", col, flags=re.M)
col = re.sub(r"-\n\s*", "", col)
col = clean(col)
anchors = {
    "Armure d’ombres": ("Vous pouvez lancer armure du mage sur vous-même", "dépenser d’emplacement de sort."),
    "Esprit occulte": ("Vous avez l’Avantage aux jets de sauvegarde de Constitution visant à maintenir la Concentration.", "maintenir la Concentration."),
    "Pacte de la chaîne": ("Vous apprenez le sort appel de familier", "en jouant sa Réaction."),
    "Pacte de la lame": ("Par une action Bonus, vous pouvez invoquer une arme de pacte", "Une arme invoquée disparaît lorsque le lien prend fin."),
    "Pacte du grimoire": ("En cousant ensemble des filaments d’ombre", "Vous pouvez vous servir du grimoire comme focaliseur d’incantation."),
}
inv = {}
for h, (a0, a1) in anchors.items():
    i = col.index(a0)
    j = col.index(a1, i) + len(a1)
    inv[h] = clean(col[i:j])

json.dump({"traits": traits, "invocations": inv}, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for h, t in inv.items():
    print("##", h, "\n", t, "\n")
