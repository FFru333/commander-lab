"""Builds desk/data/names-<lang>.json: printed (localised) card name -> English name, from Scryfall search."""
import json,sys,time,urllib.request,urllib.parse
UA={"User-Agent":"CommanderDesk/1.0 (github.com/FFru333/commander-lab)","Accept":"application/json"}
for lang in sys.argv[1:]:
    url="https://api.scryfall.com/cards/search?"+urllib.parse.urlencode({"q":"lang:"+lang+" game:paper","unique":"prints","include_multilingual":"true"})
    out={};pages=0
    while url:
        for k in range(5):
            try:j=json.load(urllib.request.urlopen(urllib.request.Request(url,headers=UA),timeout=60));break
            except Exception as e:time.sleep(2+k*3)
        else:break
        for c in j.get("data",[]):
            pn=c.get("printed_name") or ""
            if not pn and c.get("card_faces"):pn=" // ".join(f.get("printed_name") or f.get("name") for f in c["card_faces"])
            if pn and pn!=c["name"]:out[pn]=c["name"]
            for f in c.get("card_faces") or []:
                if f.get("printed_name") and f["printed_name"]!=f.get("name"):out[f["printed_name"]]=c["name"]
        url=j.get("next_page") if j.get("has_more") else None;pages+=1;time.sleep(0.12)
    json.dump(out,open(f"desk/data/names-{lang}.json","w"),ensure_ascii=False,separators=(",",":"))
    print(lang,len(out),"names",pages,"pages")
