import re,sys,glob
# usage: region.py START_PAGE END_PAGE  -> prints column-ordered text with page markers
a,b=int(sys.argv[1]),int(sys.argv[2])
import os
base=os.path.expanduser("~/work/srd/col")
for p in range(a,b+1):
    t=open(f"{base}/{p:03d}.txt",encoding="utf-8").read()
    print(t)
