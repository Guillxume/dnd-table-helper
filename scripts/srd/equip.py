import os,re,json
lay=os.path.expanduser("~/work/srd/lay")
def lines(p): return [l.rstrip() for l in open(f"{lay}/{p:03d}.txt",encoding="utf-8").read().splitlines()]
# ---- armes
cat=None; weapons=[]
CATS={"Armes courantes de corps à corps":("courante","corps à corps"),"Armes courantes à distance":("courante","distance"),
      "Armes de guerre de corps à corps":("guerre","corps à corps"),"Armes de guerre à distance":("guerre","distance")}
MAST=r"Coup double|Écorchure|Enchaînement|Ouverture|Poussée|Ralentissement|Renversement|Sape"
row=re.compile(rf"^\s+(\S.*?)\s{{2,}}(\d+d\d+|\d+) (contondants?|perforants?|tranchants?)\s{{2,}}(.+?)\s{{2,}}({MAST})\s+(\S.*?)\s+(\d[\d ]* ?(?:po|pa|pc))\s*$")
row2=re.compile(rf"^\s+(\S.*?)\s+(\d+d\d+|\d+) (contondants?|perforants?|tranchants?)\s+(.+?)\s+({MAST})\s+(\S.*?)\s+(\d[\d ]* ?(?:po|pa|pc))\s*$")
prev=None
for l in lines(97):
    s=l.strip()
    if s in CATS: cat=CATS[s]; continue
    if cat is None: continue
    m=row.match(l) or row2.match(l)
    if m:
        name,d,t,props,mast,w,price=m.groups()
        weapons.append({"name":name.strip(),"damage":f"{d} {t}","properties":props.strip(),"mastery":mast,"weight":w.strip(),"price":price.strip(),"category":cat[0],"kind":cat[1]})
        prev=weapons[-1]
    elif prev and l.startswith(" "*30) and s and not re.search(r"\d+ (po|pa|pc)\s*$",s):
        prev["properties"]+=" "+s
    else:
        if s and s not in ("Armes","Nom Dégâts Propriétés Botte d’arme Poids Prix") and not s.startswith(("Nom","97 ")): print("W??",repr(s))
print(len(weapons),"armes")
# ---- armures
armors=[];acat=None
ACATS={"Armures légères":"légère","Armures intermédiaires":"intermédiaire","Armures lourdes":"lourde","Bouclier":"bouclier"}
for l in lines(98):
    s=l.strip()
    for k,v in ACATS.items():
        if s.startswith(k+" (") or s.startswith(k+" ("): acat=v
    m=re.match(r"^\s+(Armure matelassée|Armure de cuir clouté|Armure de cuir|Armure de peaux|Chemise de mailles|Armure d’écailles|Cuirasse|Demi-plate|Broigne|Cotte de mailles|Clibanion|Harnois|Bouclier)\s{2,}(\+2|\d+(?: \+ modificateur de Dex(?: \(max 2\))?)?)\s{2,}(—|For \d+)\s+(—|Désavantage)\s+(\S.*?)\s+(\d[\d ]* po)\s*$",l)
    if m:
        n,ca,f,disc,w,price=m.groups()
        armors.append({"name":n,"ac":ca,"strength":None if f=="—" else f,"stealthDisadvantage":disc!="—","weight":w,"price":price,"category":acat})
print(len(armors),"armures")
json.dump({"weapons":weapons,"armors":armors},open(os.path.expanduser("~/work/srd/equip_raw.json"),"w"),ensure_ascii=False,indent=1)
for w in weapons: print(w["category"][:3],w["kind"][:4],"|",w["name"],"|",w["damage"],"|",w["properties"],"|",w["mastery"],"|",w["weight"],"|",w["price"])
for a in armors: print(a)
