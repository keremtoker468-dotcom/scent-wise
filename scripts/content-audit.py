#!/usr/bin/env python3
"""Content audit for scent-wise.com.

Walks every URL in public/sitemap.xml, resolves it to a local file under
public/ (or fetches it live with --live), and reports per page:

  * visible word count (nav/footer/script/style stripped)
  * stated "N min read" vs the value computed at 200 wpm
  * byline text
  * whether the page carries affiliate links (Amazon tag in the HTML, or a
    fragrance-card list that /blog/frag-images.js decorates with Amazon
    buttons at runtime) and whether an affiliate disclosure is visible
  * pairwise 8-gram Jaccard overlap between pages (flags >= 0.5)

Usage:
  python3 scripts/content-audit.py                 # markdown report to stdout
  python3 scripts/content-audit.py --json out.json  # also dump raw data
  python3 scripts/content-audit.py --live           # fetch from scent-wise.com
  python3 scripts/content-audit.py --min-words 400  # threshold for "thin"

Exit code is 1 when any duplicate pair, missing disclosure, or read-time
mismatch is found, so it can gate a CI step.
"""
import argparse
import html as htmllib
import json
import os
import re
import sys
import urllib.request
from itertools import combinations
from xml.etree import ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, "public")
SITEMAP = os.path.join(PUBLIC, "sitemap.xml")
WPM = 200
SKIP_EXT = (".txt", ".xml")

DISCLOSURE_RE = re.compile(
    r"(affiliate (link|commission|disclosure)|earn(s)? (a )?(small )?commission|"
    r"as an amazon associate|satın alırsan|komisyon)", re.I)
AMAZON_RE = re.compile(r"amazon\.(com|de|fr|es|it|co\.uk|com\.be)|tag=scentwise|amzn\.to", re.I)
READ_RE = re.compile(r"(\d+)\s*min(?:ute)?s?\s+read", re.I)
BYLINE_RE = re.compile(r'class="meta"[^>]*>.*?<span[^>]*>\s*By\s+(?:<a[^>]*>)?([^<]{2,60}?)\s*(?:</a>)?\s*</span>', re.S | re.I)
DROP_TAGS = ("script", "style", "nav", "footer", "header", "noscript", "svg", "template", "aside")


def load_sitemap(path):
    tree = ET.parse(path)
    ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    return [loc.text.strip() for loc in tree.getroot().findall("s:url/s:loc", ns)]


def local_path(url):
    p = url.split("://", 1)[1].split("/", 1)[1] if "/" in url.split("://", 1)[1] else ""
    p = p.split("?")[0].split("#")[0]
    if p == "" or p.endswith("/"):
        candidates = [os.path.join(PUBLIC, p, "index.html")]
        # /brands/<slug>/ is rewritten to /brands/index.html by vercel.json
        if p.startswith("brands/"):
            candidates.append(os.path.join(PUBLIC, "brands", "index.html"))
    else:
        candidates = [os.path.join(PUBLIC, p)]
    for c in candidates:
        if os.path.isfile(c):
            return c
    return None


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 content-audit"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


def visible_text(doc, keep_boilerplate=False):
    d = doc
    for t in DROP_TAGS:
        d = re.sub(r"<%s\b[^>]*>.*?</%s>" % (t, t), " ", d, flags=re.S | re.I)
    # boilerplate that is not content: byline block and the affiliate disclosure box
    if not keep_boilerplate:
        d = re.sub(r'<div class="meta">.*?</div>', " ", d, flags=re.S)
        d = re.sub(r'<div class="affiliate-note".*?</div>', " ", d, flags=re.S)
    d = re.sub(r"<!--.*?-->", " ", d, flags=re.S)
    d = re.sub(r"<[^>]+>", " ", d)
    d = htmllib.unescape(d)
    return re.sub(r"\s+", " ", d).strip()


def words(text):
    return re.findall(r"[A-Za-z0-9'’À-ɏ]+", text)


def shingles(ws, n=8):
    ws = [w.lower() for w in ws]
    return {" ".join(ws[i:i + n]) for i in range(max(0, len(ws) - n + 1))}


def jaccard(a, b):
    if not a and not b:
        return 1.0
    return len(a & b) / len(a | b) if (a | b) else 0.0


def audit_page(url, doc):
    text = visible_text(doc)
    ws = words(text)
    wc = len(ws)
    stated = READ_RE.search(visible_text(doc, keep_boilerplate=True))
    stated = int(stated.group(1)) if stated else None
    computed = max(1, round(wc / WPM)) if wc else 0
    byline = BYLINE_RE.search(doc)
    has_frag_cards = "frag-images.js" in doc and 'class="frag-card"' in doc
    affiliate = (bool(AMAZON_RE.search(doc)) or has_frag_cards) and not url.rstrip("/").endswith(("privacy.html", "terms.html"))
    disclosure = bool(DISCLOSURE_RE.search(visible_text(doc, keep_boilerplate=True)))
    noindex = bool(re.search(r'name="robots"[^>]*noindex', doc, re.I))
    title = re.search(r"<title[^>]*>(.*?)</title>", doc, re.S | re.I)
    h1 = re.search(r"<h1[^>]*>(.*?)</h1>", doc, re.S | re.I)
    return {
        "url": url,
        "title": htmllib.unescape(re.sub(r"<[^>]+>", "", title.group(1))).strip() if title else "",
        "h1": htmllib.unescape(re.sub(r"<[^>]+>", "", h1.group(1))).strip() if h1 else "",
        "words": wc,
        "read_stated": stated,
        "read_computed": computed,
        "byline": byline.group(1).strip() if byline else "",
        "affiliate": affiliate,
        "disclosure": disclosure,
        "noindex": noindex,
        "_shingles": shingles(ws),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--live", action="store_true", help="fetch pages from the live site")
    ap.add_argument("--json", help="write raw results to this file")
    ap.add_argument("--min-words", type=int, default=400)
    ap.add_argument("--dup-threshold", type=float, default=0.5)
    ap.add_argument("--sitemap", default=None)
    ap.add_argument("--public", default=None, help="audit a different public/ directory (e.g. an old checkout)")
    args = ap.parse_args()
    global PUBLIC
    if args.public:
        PUBLIC = os.path.abspath(args.public)
    if not args.sitemap:
        args.sitemap = os.path.join(PUBLIC, "sitemap.xml")

    urls = load_sitemap(args.sitemap)
    pages, missing = [], []
    for url in urls:
        if url.endswith(SKIP_EXT):
            continue
        try:
            if args.live:
                doc = fetch(url)
            else:
                p = local_path(url)
                if not p:
                    missing.append(url)
                    continue
                doc = open(p, encoding="utf-8", errors="replace").read()
        except Exception as e:  # noqa: BLE001
            missing.append("%s (%s)" % (url, e))
            continue
        pages.append(audit_page(url, doc))

    dups = []
    for a, b in combinations(pages, 2):
        j = jaccard(a["_shingles"], b["_shingles"])
        if j >= args.dup_threshold:
            dups.append((a["url"], b["url"], j))

    thin = [p for p in pages if p["words"] < args.min_words]
    no_disc = [p for p in pages if p["affiliate"] and not p["disclosure"]]
    bad_rt = [p for p in pages if p["read_stated"] is not None
              and abs(p["read_stated"] - p["read_computed"]) > 1]
    wcs = sorted(p["words"] for p in pages)
    median = wcs[len(wcs) // 2] if wcs else 0

    def bucket(w):
        return "<400" if w < 400 else "400-799" if w < 800 else "800-1499" if w < 1500 else "1500+"
    dist = {}
    for w in wcs:
        dist[bucket(w)] = dist.get(bucket(w), 0) + 1

    out = []
    out.append("# Content audit — %s\n" % ("live site" if args.live else "local public/"))
    out.append("Pages audited: %d (sitemap URLs: %d, skipped txt/xml: %d, unresolved: %d)" %
               (len(pages), len(urls), sum(u.endswith(SKIP_EXT) for u in urls), len(missing)))
    out.append("Median words: %d · Pages under %d words: %d · Duplicate pairs (≥%.0f%%): %d · "
               "Affiliate pages without disclosure: %d · Read-time mismatches: %d\n" %
               (median, args.min_words, len(thin), args.dup_threshold * 100, len(dups),
                len(no_disc), len(bad_rt)))
    out.append("## Word-count distribution\n")
    out.append("| Bucket | Pages |\n|---|---|")
    for k in ("<400", "400-799", "800-1499", "1500+"):
        out.append("| %s | %d |" % (k, dist.get(k, 0)))
    out.append("\n## Per page\n")
    out.append("| URL | Words | Read (stated/calc) | Byline | Affiliate | Disclosure | Flags |")
    out.append("|---|---|---|---|---|---|---|")
    for p in sorted(pages, key=lambda x: x["words"]):
        flags = []
        if p["words"] < args.min_words:
            flags.append("THIN")
        if p["affiliate"] and not p["disclosure"]:
            flags.append("NO-DISCLOSURE")
        if p["read_stated"] is not None and abs(p["read_stated"] - p["read_computed"]) > 1:
            flags.append("READ-TIME")
        if p["noindex"]:
            flags.append("noindex")
        rt = "%s/%s" % (p["read_stated"] if p["read_stated"] is not None else "–", p["read_computed"])
        out.append("| %s | %d | %s | %s | %s | %s | %s |" % (
            p["url"].replace("https://scent-wise.com", ""), p["words"], rt, p["byline"] or "–",
            "yes" if p["affiliate"] else "no", "yes" if p["disclosure"] else "no", " ".join(flags)))
    out.append("\n## Duplicate pairs (8-gram Jaccard ≥ %.0f%%)\n" % (args.dup_threshold * 100))
    if dups:
        out.append("| A | B | Overlap |\n|---|---|---|")
        for a, b, j in sorted(dups, key=lambda x: -x[2]):
            out.append("| %s | %s | %.0f%% |" % (a.replace("https://scent-wise.com", ""),
                                                b.replace("https://scent-wise.com", ""), j * 100))
    else:
        out.append("None.")
    if missing:
        out.append("\n## Unresolved sitemap URLs\n")
        out.extend("- %s" % m for m in missing)
    print("\n".join(out))

    if args.json:
        with open(args.json, "w") as f:
            json.dump({"pages": [{k: v for k, v in p.items() if not k.startswith("_")} for p in pages],
                       "duplicates": dups, "missing": missing, "median": median, "dist": dist}, f, indent=2)
    return 1 if (dups or no_disc or bad_rt or missing) else 0


if __name__ == "__main__":
    sys.exit(main())
