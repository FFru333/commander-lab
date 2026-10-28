#!/bin/bash
for u in "https://api2.moxfield.com/v3/decks/all/oEWXWHM5eEGMmopExLWRCA" "https://api2.moxfield.com/v2/decks/all/oEWXWHM5eEGMmopExLWRCA" "https://archidekt.com/api/decks/1/" "https://api.scryfall.com/cards/search?q=Anello&include_multilingual=true"; do
 echo "== $u"; curl -s -o /tmp/b -D - -H "Origin: https://ffru333.github.io" -A "Mozilla/5.0" "$u" | grep -i "^HTTP\|access-control\|cf-mitigated\|server:"; head -c 300 /tmp/b; echo; done
echo "== preflight moxfield"; curl -s -o /dev/null -D - -X OPTIONS -H "Origin: https://ffru333.github.io" -H "Access-Control-Request-Method: GET" "https://api2.moxfield.com/v3/decks/all/x" | grep -i "^HTTP\|access-control"
