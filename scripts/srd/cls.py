import os,re,sys
base=os.path.expanduser("~/work/srd/col")
def stream(a,b):
    return "\n".join(open(f"{base}/{p:03d}.txt",encoding="utf-8").read() for p in range(a,b+1))
a,b,name=int(sys.argv[1]),int(sys.argv[2]),sys.argv[3]
s=stream(a,b)
i=s.index("Traits de base d"+name) if ("Traits de base d"+name) in s else s.index("Traits de base")
m=re.search(r"Niveau 2 :",s[i:])
j=i+(m.start() if m else 20000)
print(s[i:j])
