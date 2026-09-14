#!/usr/bin/env python3
"""Verify every internal link in public/**/*.html, sitemap.xml, feed.xml and llms*.txt
resolves to a file, a vercel.json rewrite, or a vercel.json redirect."""
import glob, json, os, re, sys
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PUB=os.path.join(ROOT,"public")
v=json.load(open(os.path.join(ROOT,"vercel.json")))
def to_re(src): return re.compile("^"+re.sub(r":([a-zA-Z]+)\*?",r"[^/]+",re.escape(src).replace(r"\:",":"))+"/?$")
rewrites=[to_re(r["source"]) for r in v.get("rewrites",[])]
redirects=[to_re(r["source"]) for r in v.get("redirects",[])]
def resolves(path):
    path=path.split("#")[0].split("?")[0]
    if not path.startswith("/"): return True
    if any(p.match(path) for p in rewrites+redirects): return True
    f=os.path.join(PUB,path.lstrip("/"))
    if path.endswith("/") or path=="": return os.path.isfile(os.path.join(f,"index.html"))
    return os.path.isfile(f) or os.path.isfile(f+".html") or os.path.isfile(os.path.join(f,"index.html"))
bad=[]
files=glob.glob(os.path.join(PUB,"**","*.html"),recursive=True)+[os.path.join(PUB,x) for x in ("sitemap.xml","blog/feed.xml","llms.txt","llms-full.txt","blog/frag-images.js")]
for f in files:
    s=open(f,encoding="utf-8",errors="replace").read()
    s=re.sub(r"<!--.*?-->","",s,flags=re.S)
    links=set(re.findall(r'(?:href|src|url)\s*[:=]\s*["\']((?:https?://scent-wise\.com)?/[^"\'#?\s]*)',s))
    links|=set(re.findall(r'<loc>https://scent-wise\.com(/[^<]*)</loc>',s))
    links|=set(re.findall(r'<link>https://scent-wise\.com(/[^<]*)</link>',s))
    links|=set(re.findall(r"https://scent-wise\.com(/blog/[^\s)\]\"'<]+)",s))
    for l in links:
        l=l.replace("https://scent-wise.com","")
        if l.startswith("/api/") or l.startswith("/_vercel/") : continue
        if not resolves(l): bad.append((os.path.relpath(f,ROOT),l))
for f,l in sorted(set(bad)): print("BROKEN  %-55s -> %s"%(f,l))
print("checked %d files, %d broken"%(len(files),len(set(bad))))
sys.exit(1 if bad else 0)
