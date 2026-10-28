// Checks the card-scan pipeline (title + collector line OCR, then Scryfall lookup) on real card images.
const { createWorker } = require('tesseract.js');
const UA={headers:{'User-Agent':'CommanderDesk/1.0','Accept':'application/json'}};
const CARDS=[['cards/named?exact=Sol%20Ring&set=cmm'],['cards/named?exact=Lathliss%2C%20Dragon%20Queen'],['cards/fdn/194'],['cards/fdn/194/it'],['cards/named?exact=Atsushi%2C%20the%20Blazing%20Sky'],['cards/named?exact=Lightning%20Bolt&set=lea'],['cards/named?exact=Draconic%20Visitor'],['cards/named?exact=Terror%20of%20the%20Peaks&set=m21'],['cards/named?exact=Swords%20to%20Plowshares&set=cmm'],['cards/named?exact=The%20Ur-Dragon&set=cmm']];
const R={title:[0.05,0.035,0.78,0.075],bottom:[0.035,0.925,0.5,0.06]};
(async()=>{
  const w=await createWorker('eng');
  for(const [path] of CARDS){
    try{
      const c=await (await fetch('https://api.scryfall.com/'+path,UA)).json();
      const url=(c.image_uris||c.card_faces[0].image_uris).large;
      const buf=Buffer.from(await (await fetch(url)).arrayBuffer());
      const W=672,H=936;const rect=k=>({left:Math.round(R[k][0]*W),top:Math.round(R[k][1]*H),width:Math.round(R[k][2]*W),height:Math.round(R[k][3]*H)});
      await w.setParameters({tessedit_pageseg_mode:'7'});
      const t=(await w.recognize(buf,{rectangle:rect('title')})).data.text.trim();
      await w.setParameters({tessedit_pageseg_mode:'6'});
      const b=(await w.recognize(buf,{rectangle:rect('bottom')})).data.text.trim().replace(/\n/g,' | ');
      const fz=await (await fetch('https://api.scryfall.com/cards/named?fuzzy='+encodeURIComponent(t.replace(/[^A-Za-zÀ-ÿ',\- ]/g,'').trim()),UA)).json();
      const ml=await (await fetch('https://api.scryfall.com/cards/search?include_multilingual=true&q='+encodeURIComponent(t.replace(/[^A-Za-zÀ-ÿ',\- ]/g,'').trim()),UA)).json();
      console.log(JSON.stringify({card:c.name,lang:c.lang,set:c.set,cn:c.collector_number,printed:c.printed_name||null,ocrTitle:t,ocrBottom:b,fuzzy:fz.name||fz.details,multi:(ml.data||[]).slice(0,2).map(x=>x.name+' '+x.set+' '+x.lang).join('; ')||ml.details}));
      await new Promise(r=>setTimeout(r,200));
    }catch(e){console.log(path,'ERR',e.message);}
  }
  await w.terminate();
})();
