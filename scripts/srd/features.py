import os,re,json,sys
base=os.path.expanduser("~/work/srd/col")
CLASSES={"barbare":(30,32),"barde":(33,35),"clerc":(38,40),"druide":(43,45),"ensorceleur":(49,52),
 "guerrier":(56,58),"magicien":(58,61),"moine":(65,67),"occultiste":(68,70),"paladin":(75,77),"rodeur":(80,82),"roublard":(84,86)}
FOOT=re.compile(r"^\s*\d+\s+Document de Référence du Système 5\.2\.1\s*$")
def column_lines(a,b):
    out=[]
    for p in range(a,b+1):
        for l in open(f"{base}/{p:03d}.txt",encoding="utf-8").read().splitlines():
            if l.startswith("#####") or FOOT.match(l): continue
            out.append(l.rstrip())
    return out
def paragraphs(lines):
    paras=[];cur=[]
    for l in lines:
        if l.strip()=="":
            if cur: paras.append(cur);cur=[]
        else: cur.append(l)
    if cur: paras.append(cur)
    return paras
def tablelike(par):
    # paragraphs made of column-aligned rows (>=2 gaps of 2+ spaces) with digits/dashes
    n=len(par)
    gap=sum(1 for l in par if re.search(r"\S\s{2,}\S",l))
    digit=sum(1 for l in par if re.search(r"(\s|^)(\d+|—|\+\d)(\s|$)",l))
    return n>=3 and gap>=0.6*n and digit>=0.6*n
HEAD=re.compile(r"^\s*Niveau (\d+) : (.+?)\s*$")
def extract(cls):
    a,b=CLASSES[cls]
    lines=column_lines(a,b)
    paras=[p for p in paragraphs(lines) if not tablelike(p)]
    flat=[]
    for p in paras:
        flat.extend(p); flat.append("")
    feats=[];cur=None
    for l in flat:
        m=HEAD.match(l)
        if m:
            if cur: feats.append(cur)
            cur={"level":int(m.group(1)),"name":m.group(2),"lines":[]}
            continue
        if cur is not None: cur["lines"].append(l)
    if cur: feats.append(cur)
    res=[]
    for f in feats:
        if f["level"]!=1: continue
        txt="\n".join(l.strip() for l in f["lines"])
        txt=re.sub(r"-\n(?=[a-zà-ÿ])","",txt)   # coupure de mot en fin de ligne
        txt=re.sub(r"\n(?!\n)"," ",txt)
        txt=re.sub(r"[ ]+"," ",txt)
        res.append({"name":f["name"],"text":txt.strip()})
    return res
if __name__=="__main__":
    out={c:extract(c) for c in CLASSES}
    json.dump(out,open(os.path.expanduser("~/work/srd/features_raw.json"),"w"),ensure_ascii=False,indent=1)
    for c,fs in out.items():
        print("==",c)
        for f in fs: print("  -",f["name"],len(f["text"]),"chars")
