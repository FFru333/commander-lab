#!/bin/bash
for s in crux-of-fate sol-ring thundermaw-hellkite; do
 echo "== card $s"; curl -s -D /tmp/h -A "CommanderDesk/1.0" -H "Origin: https://ffru333.github.io" "https://json.edhrec.com/pages/cards/$s.json" -o /tmp/c.json; grep -i "^HTTP\|access-control" /tmp/h
 python3 -c "
import json;d=json.load(open('/tmp/c.json'))
def walk(o,p=''):
  if isinstance(o,dict):
    for k,v in o.items():
      if 'salt' in k.lower(): print('SALT',p+'/'+k,json.dumps(v)[:200])
      walk(v,p+'/'+k)
  elif isinstance(o,list):
    for i,v in enumerate(o[:3]): walk(v,p+'['+str(i)+']')
walk(d);print('top keys',list(d)[:25]);print('card',json.dumps(d.get('container',{}).get('json_dict',{}).get('card',{}))[:700])"
done
echo "== top salt"; curl -s -A "CommanderDesk/1.0" "https://json.edhrec.com/pages/top/salt.json" | python3 -c "
import json,sys;d=json.load(sys.stdin);j=d.get('container',{}).get('json_dict',{});cl=j.get('cardlists',[]);print([ (c.get('header'),len(c.get('cardviews',[]))) for c in cl]);print(json.dumps(cl[0]['cardviews'][0])[:600] if cl else d.keys())"
