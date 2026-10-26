import os,re,json,sys
base=os.path.expanduser("~/work/srd/col")
SCHOOLS="Abjuration|Divination|Enchantement|Évocation|Illusion|Invocation|Nécromancie|Transmutation"
CLASSES=[("barde",35,37),("clerc",40,42),("druide",46,48),("ensorceleur",53,55),("magicien",61,64),("occultiste",73,74),("paladin",78,79),("rodeur",82,83)]
def stream(a,b):
    return "\n".join(open(f"{base}/{p:03d}.txt",encoding="utf-8").read() for p in range(a,b+1))
res={}
for cls,a,b in CLASSES:
    s=stream(a,b)
    i=s.index("Liste des sorts d") if "Liste des sorts d" in s else s.index("Liste de sorts d")
    s=s[i:]
    # stop at 2nd level
    m=re.search(r"Sorts d[e’' ]*[A-Za-zÀ-ÿ’' ]*du 2e niveau|\(sorts d[^)]* du 2e niveau\)",s)
    s=s[:m.start()] if m else s
    level=None; out={0:[],1:[]}
    lines=[l.rstrip() for l in s.splitlines()]
    for l in lines:
        t=l.strip()
        if not t or t.startswith("#####") or "Document de Référence" in t: continue
        if t.startswith("Sorts mineurs"): level=0; continue
        if t=="niveau 0)": continue
        if re.search(r"du 1er niveau",t) and ("Sorts" in t or "sorts" in t): level=1; continue
        if level is None: continue
        m=re.match(rf"^(.+?)\s+({SCHOOLS})\s+(\S.*)$",t)
        if m:
            out[level].append({"name":m.group(1).strip(),"school":m.group(2),"special":m.group(3).strip()})
        elif re.match(r"^Sort\s+École",t): continue
        elif out[level] and re.match(r"^[a-zà-ÿ’' \-]+$",t) and len(t)<30:
            out[level][-1]["name"]+=" "+t
        else:
            print("??",cls,level,repr(t),file=sys.stderr)
    res[cls]=out
json.dump(res,open(os.path.expanduser("~/work/srd/spells_raw.json"),"w"),ensure_ascii=False,indent=1)
for c,o in res.items():
    print(c,"cantrips",len(o[0]),"lvl1",len(o[1]))
