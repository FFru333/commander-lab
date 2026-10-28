// Compares OCR strategies on the reading band of the e2e feeds (band = what the app crops).
const { createWorker, PSM } = require('tesseract.js');
const fs=require('fs');process.on('uncaughtException',e=>console.log('UNCAUGHT',e.message));
const B={left:595,top:259,width:729,height:281};
(async()=>{const w=await createWorker('eng');
  for(let i=0;i<4;i++){const img=fs.readFileSync(`../e2e/feeds/f${i}.png`);const res={feed:i};
    for(const psm of ['3','6','11']){await w.setParameters({tessedit_pageseg_mode:psm});const t0=Date.now();const d=(await w.recognize(img,{rectangle:B})).data;
      res['psm'+psm]={ms:Date.now()-t0,lines:(d.lines||[]).map(l=>l.text.trim()).filter(Boolean).slice(0,5)};}
    await w.setParameters({tessedit_pageseg_mode:'7'});const sl=[];const t0=Date.now();
    for(let y=B.top;y+80<=B.top+B.height;y+=40){const d=(await w.recognize(img,{rectangle:{left:B.left,top:y,width:B.width,height:80}})).data;sl.push([y,d.text.trim(),Math.round(d.confidence)]);}
    res.slide={ms:Date.now()-t0,out:sl};console.log(JSON.stringify(res));}
  await w.terminate();})();
