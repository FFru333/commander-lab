#!/bin/bash
# builds fake camera feeds (portrait 1080x1440) with a real card filling ~84% of the height, slightly off-centre and tilted
set -e; cd tools/e2e; mkdir -p feeds
i=0
for path in "cards/fdn/194/it" "cards/named?exact=Lathliss%2C%20Dragon%20Queen" "cards/named?exact=Terror%20of%20the%20Peaks&set=m21" "cards/named?exact=Sol%20Ring&set=cmm"; do
  url=$(curl -s -A "CommanderDesk/1.0" "https://api.scryfall.com/$path" | python3 -c "import json,sys;c=json.load(sys.stdin);print((c.get('image_uris') or c['card_faces'][0]['image_uris'])['png'])")
  curl -s -A "CommanderDesk/1.0" -o feeds/c$i.png "$url"; sleep 0.2
  ffmpeg -loglevel error -y -f lavfi -i color=c=0x3a3530:s=1080x1440 -i feeds/c$i.png -filter_complex "[1]scale=-1:1200,rotate=0.03:c=none:ow=rotw(0.03):oh=roth(0.03)[c];[0][c]overlay=(W-w)/2+12:(H-h)/2-8,format=yuv420p" -frames:v 1 feeds/p$i.png
  ffmpeg -loglevel error -y -loop 1 -i feeds/p$i.png -t 3 -r 10 -pix_fmt yuv420p feeds/v$i.y4m
  i=$((i+1)); done
ls -la feeds
