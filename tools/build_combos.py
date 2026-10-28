"""Builds desk/data/combos.json: a compact, commander-legal index of Commander Spellbook combos.
Source: https://json.commanderspellbook.com/variants.json.gz (bulk export, see their docs/api.md)."""
import gzip, json, sys, urllib.request, time
URL="https://json.commanderspellbook.com/variants.json.gz"
req=urllib.request.Request(URL,headers={"User-Agent":"CommanderDesk/1.0 (github.com/FFru333/commander-lab)"})
raw=urllib.request.urlopen(req,timeout=300).read()
data=json.loads(gzip.decompress(raw))
cards=[];ci={};feats=[];fi={};out=[]
def cid(n):
    if n not in ci: ci[n]=len(cards); cards.append(n)
    return ci[n]
def fid(n):
    if n not in fi: fi[n]=len(feats); feats.append(n)
    return fi[n]
for v in data["variants"]:
    if v.get("status") not in ("OK","E"): continue
    if not (v.get("legalities") or {}).get("commander"): continue
    uses=[u["card"]["name"] for u in v.get("uses",[])]
    if not uses or len(uses)>5: continue
    cmdr=[u["card"]["name"] for u in v.get("uses",[]) if u.get("mustBeCommander")]
    prod=[p["feature"]["name"] for p in v.get("produces",[])][:4]
    req=[t["template"]["name"] for t in v.get("requires",[])]
    out.append([v["id"],[cid(n) for n in uses],[fid(n) for n in prod],v.get("popularity") or 0,v.get("identity") or "C",
                v.get("bracketTag") or "",v.get("manaValueNeeded"),req,[cid(n) for n in cmdr]])
out.sort(key=lambda r:-r[3])
doc={"src":"Commander Spellbook","built":data.get("timestamp"),"cards":cards,"feats":feats,"v":out}
json.dump(doc,open(sys.argv[1],"w"),separators=(",",":"))
print("variants",len(out),"cards",len(cards))
