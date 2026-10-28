#!/bin/bash
# one-shot checks the app depends on, written to desk/data/probe.txt
O=desk/data/probe.txt; : > $O
for u in "https://json.edhrec.com/pages/commanders/the-ur-dragon.json" "https://backend.commanderspellbook.com/find-my-combos" "https://api.scryfall.com/cards/named?exact=Sol%20Ring"; do
  echo "== CORS $u" >> $O; curl -s -o /dev/null -D - -H "Origin: https://ffru333.github.io" -A "CommanderDesk/1.0" "$u" | grep -i "^HTTP\|access-control" >> $O
  echo "== CORS null-origin $u" >> $O; curl -s -o /dev/null -D - -H "Origin: null" -A "CommanderDesk/1.0" "$u" | grep -i "^HTTP\|access-control" >> $O; done
curl -s -A "CommanderDesk/1.0" "https://json.edhrec.com/pages/commanders/the-ur-dragon.json" > /tmp/e.json
python3 - >> $O <<'P'
import json
d=json.load(open("/tmp/e.json"));print("== EDHREC top keys",list(d)[:30])
j=d.get("container",{}).get("json_dict",{});print("json_dict keys",list(j)[:30])
for cl in j.get("cardlists",[]):print("LIST",cl.get("header"),"|",cl.get("tag"),"|",len(cl.get("cardviews",[])),"|",json.dumps(cl.get("cardviews",[{}])[0])[:400])
for k in ("num_decks_avg","num_decks","panels","similar"):
  if k in d:print("KEY",k,json.dumps(d[k])[:300])
print("PANELS",json.dumps(d.get("panels",{}))[:1500])
P
for t in ramp mana-rock mana-dork card-advantage draw removal creature-removal board-wipe sweeper counterspell protection protects-creature tutor recursion graveyard-hate extra-turn mass-land-denial lifegain finisher wincon gives-haste cost-reducer cost-reduction burn; do
  n=$(curl -s -A "CommanderDesk/1.0" "https://api.scryfall.com/cards/search?q=otag%3A$t+legal%3Acommander" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('total_cards',d.get('details','?'))[:80] if isinstance(d.get('total_cards',d.get('details')),str) else d.get('total_cards'))")
  echo "otag:$t $n" >> $O; sleep 0.15; done
n=$(curl -s -A "CommanderDesk/1.0" "https://api.scryfall.com/cards/search?q=is%3Agamechanger" | python3 -c "import json,sys;print(json.load(sys.stdin).get('total_cards'))"); echo "is:gamechanger $n" >> $O
curl -s -A "CommanderDesk/1.0" "https://json.edhrec.com/pages/combos/the-ur-dragon.json" | head -c 1500 >> $O; echo >> $O
