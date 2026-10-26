"""Jonction des lignes du texte du SRD (coupures de mots, exposants)."""
import re

_compounds = set()

def set_corpus(text):
    _compounds.clear()
    _compounds.update(w.lower() for w in re.findall(r"\b[\wÀ-ÿ’]+-[\wÀ-ÿ’-]+\b", text))


def join(parts):
    out = ""
    for p in parts:
        p = p.strip()
        if not p:
            continue
        if not out:
            out = p
        elif out.endswith("-"):
            prev = re.search(r"([\wÀ-ÿ’]+)-$", out)
            nxt = re.match(r"^([\wÀ-ÿ’]+)", p)
            if prev and nxt and f"{prev.group(1)}-{nxt.group(1)}".lower() in _compounds:
                out += p
            else:
                out = out[:-1] + p
        elif re.match(r"^[.,;:)]", p):
            out += p
        else:
            out += " " + p
    return out

