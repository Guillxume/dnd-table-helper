import os,re,json
base=os.path.expanduser("~/work/srd/col")
FOOT=re.compile(r"^\s*\d+\s+Document de Référence du Système 5\.2\.1\s*$")
SPECIES=["Drakéide","Elfe","Gnome","Goliath","Halfelin","Humain","Nain","Orc","Tieffelin"]
def col_paragraphs(p,side):
    t=open(f"{base}/{p:03d}.txt",encoding="utf-8").read()
    m=re.search(rf"##### PAGE {p} {side}\n(.*?)(?=##### PAGE|\Z)",t,re.S)
    lines=[l.rstrip() for l in m.group(1).splitlines() if not FOOT.match(l)]
    ind=[len(l)-len(l.lstrip()) for l in lines if l.strip()]
    margin=min(ind) if ind else 0
    paras=[];cur=None
    for l in lines:
        if not l.strip(): cur=None; continue
        i=len(l)-len(l.lstrip())
        if cur is None or i>=margin+2:
            cur=[l.strip()]; paras.append(cur)
        else: cur.append(l.strip())
    return paras
stream=[]
for p in range(88,92):
    for side in ("LEFT","RIGHT"):
        stream+=col_paragraphs(p,side)
text=["\n".join(x) for x in stream]
out={};cur=None;trait=None
for t in text:
    first=t.split("\n")[0]
    if first in SPECIES:
        cur=first; out[cur]={"head":[], "traits":[]}; trait=None; continue
    if cur is None: continue
    m=re.match(r"^([A-ZÉÀ][^.\n]{2,40})\. (.*)",t.replace("\n"," ",1) if False else t,re.S)
    if m and not first.startswith(("Type de","Catégorie","Vitesse","En tant que")):
        trait={"name":m.group(1).strip(),"text":m.group(2)}
        out[cur]["traits"].append(trait)
    elif first.startswith(("Type de","Catégorie","Vitesse")):
        out[cur]["head"].append(t)
    elif trait is not None and not first.startswith("En tant que"):
        trait["text"]+="\n"+t
def clean(s):
    s=re.sub(r"-\n(?=[a-zà-ÿ])","",s)
    s=re.sub(r"\n"," ",s)
    return re.sub(r"\s+"," ",s).strip()
for s,v in out.items():
    v["head"]=[clean(h) for h in v["head"]]
    for tr in v["traits"]: tr["text"]=clean(tr["text"])
json.dump(out,open(os.path.expanduser("~/work/srd/species_raw.json"),"w"),ensure_ascii=False,indent=1)
for s,v in out.items():
    print("==",s,v["head"])
    for tr in v["traits"]: print("   -",tr["name"],"|",tr["text"][:90])
