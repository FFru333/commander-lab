// Card-scan pipeline check: loose regions (simulating imprecise framing), two resolutions.
const { createWorker } = require('tesseract.js');
process.on('uncaughtException',e=>console.log('UNCAUGHT',e.message));
const UA={headers:{'User-Agent':'CommanderDesk/1.0','Accept':'application/json'}};
const CARDS=['cards/named?exact=Sol%20Ring&set=cmm','cards/fdn/194/it','cards/named?exact=Terror%20of%20the%20Peaks&set=m21','cards/named?exact=The%20Ur-Dragon&set=cmm','cards/named?exact=Smothering%20Tithe','cards/named?exact=Dragonlord%20Dromoka','cards/named?exact=Arcane%20Signet','cards/named?exact=Cultivate'];
const SETS=[['title',[0.03,0.02,0.82,0.10]],['bottom',[0.0,0.9,0.62,0.1]]];
const LANG='EN|IT|DE|FR|ES|PT|JA|JP|KO|RU|ZHS|ZHT|PH';
function parseBottom(t){const u=t.toUpperCase().replace(/[«»+•·%>]/g,' ');
  const lm=u.match(new RegExp('\\b([A-Z0-9]{3,5})\\s+('+LANG+')\\b'));const cn=(u.match(/\b0*(\d{1,4})(?:\s*\/\s*\d{1,4})?\b/)||[])[1];
  return {set:lm?lm[1].toLowerCase():null,lang:lm?lm[2].toLowerCase():null,cn:cn||null};}
(async()=>{
  const w=await createWorker('eng');
  for(const path of CARDS){
    try{
      const c=await (await fetch('https://api.scryfall.com/'+path,UA)).json();
      for(const ver of ['normal','large']){
        const url=(c.image_uris||c.card_faces[0].image_uris)[ver];
        const buf=Buffer.from(await (await fetch(url,{headers:{'User-Agent':'CommanderDesk/1.0'}})).arrayBuffer());
        const W=ver==='large'?672:488,H=ver==='large'?936:680;const out={};
        for(const [k,r] of SETS){await w.setParameters({tessedit_pageseg_mode:k==='title'?'7':'6'});
          out[k]=(await w.recognize(buf,{rectangle:{left:Math.round(r[0]*W),top:Math.round(r[1]*H),width:Math.round(r[2]*W),height:Math.round(r[3]*H)}})).data.text.trim().replace(/\n/g,' | ');}
        const pb=parseBottom(out.bottom);let hit=null;
        if(pb.set&&pb.cn){const r=await fetch('https://api.scryfall.com/cards/'+pb.set+'/'+pb.cn+(pb.lang&&pb.lang!=='en'?'/'+pb.lang:''),UA);hit=r.ok?(await r.json()).name:'HTTP '+r.status;}
        console.log(JSON.stringify({card:c.name,set:c.set,cn:c.collector_number,ver,title:out.title,bottom:out.bottom,parsed:pb,hit}));
        await new Promise(r=>setTimeout(r,150));}
    }catch(e){console.log(path,'ERR',e.message);}
  }
  await w.terminate();
})();
