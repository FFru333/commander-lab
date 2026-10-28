/* ---------- import: tolerant list parser (quantities in any position, number words, basic-land plurals) ---------- */
const NUMW={a:1,an:1,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,
  un:1,uno:1,una:1,due:2,tre:3,quattro:4,cinque:5,sei:6,sette:7,otto:8,nove:9,dieci:10,undici:11,dodici:12,tredici:13,quattordici:14,quindici:15,sedici:16,diciassette:17,diciotto:18,diciannove:19,venti:20,trenta:30,quaranta:40};
const BASIC_ALIAS={plains:"Plains",plain:"Plains",planes:"Plains",plane:"Plains",pianura:"Plains",pianure:"Plains",
  island:"Island",islands:"Island",isola:"Island",isole:"Island",swamp:"Swamp",swamps:"Swamp",palude:"Swamp",paludi:"Swamp",
  mountain:"Mountain",mountains:"Mountain",montagna:"Mountain",montagne:"Mountain",forest:"Forest",forests:"Forest",foresta:"Forest",foreste:"Forest",wastes:"Wastes",waste:"Wastes",lande:"Wastes"};
function basicName(n){const t=n.toLowerCase().replace(/[^a-z\s-]/g,"").trim();const snow=/^snow[\s-]?covered\s+/.test(t);const b=BASIC_ALIAS[t.replace(/^snow[\s-]?covered\s+/,"")];return b?(snow?"Snow-Covered "+b:b):null;}
const NUMWRX=new RegExp("^("+Object.keys(NUMW).sort((a,b)=>b.length-a.length).join("|")+")\\s+(?=\\S)","i");
/* returns {qty,rest} when the line carries a quantity, or null */
function splitQty(l){let m;
  if((m=l.match(/^(\d+)\s*[x×]?\s+(.+)$/i)))return {qty:+m[1],rest:m[2]};
  if((m=l.match(/^[x×]\s*(\d+)\s+(.+)$/i)))return {qty:+m[1],rest:m[2]};
  if((m=l.match(/^(.+?)\s+[x×]\s*(\d+)$/i)))return {qty:+m[2],rest:m[1]};
  if((m=l.match(/^(.+?)\s*[x×](\d+)$/i)))return {qty:+m[2],rest:m[1]};
  if((m=l.match(NUMWRX))){const w=m[1].toLowerCase();const rest=l.slice(m[0].length);if((w==="a"||w==="an"||w==="un"||w==="una")&&!basicName(rest))return null;return {qty:NUMW[w],rest};}
  return null;}
function parseList(txt){
  const lines=txt.split(/\r?\n/).map(x=>x.replace(/^\s*[-•*·]\s+/,"").trim());
  const isQ=l=>!!splitQty(l.replace(/^SB:\s*/i,""));
  const numbered=lines.filter(l=>l&&isQ(l)).length;
  const plain=lines.filter(l=>l&&!isQ(l)&&!/^(\/\/|#)/.test(l)&&!/:$/.test(l)).length;
  const numMode=numbered>0&&numbered>=plain;
  let sec=null,skip=false;const out=[];
  lines.forEach(l=>{
    if(!l)return;l=l.replace(/^SB:\s*/i,"");
    const m=splitQty(l);
    const isHeader=!m&&!basicName(l)&&(numMode||/^(\/\/|#)/.test(l)||/:$/.test(l)||/\(\d+\)$/.test(l));
    if(isHeader){const hd=cleanHeader(l);if(!hd)return;skip=SKIP_SEC.test(hd);sec=hd;return;}
    if(skip)return;
    let qty=1,rest=l;if(m){qty=Math.max(1,Math.min(99,m.qty));rest=m.rest;}
    let cat=null,cmd=false,set=null,cn=null;
    const br=rest.match(/\s+\[([^\]]*)\]/);
    if(br){const c=br[1].split(",")[0].replace(/\{[^}]*\}/g,"").trim();if(c){if(CMD_SEC.test(c))cmd=true;else if(SKIP_SEC.test(c))return;else cat=c;}rest=rest.replace(br[0]," ");}
    if(/\*CMDR\*/i.test(rest)){cmd=true;}
    rest=rest.replace(/\s+\*[^*]+\*/g," ").replace(/\s+\^[^^]*\^/g," ").replace(/\s+#\S+/g," ").trim();
    const ps=rest.match(/\s+[\(\[]([A-Za-z0-9]{2,6})[\)\]]\s*([\w★\-]+)?\s*$/);
    if(ps){set=ps[1].toLowerCase();cn=ps[2]||null;rest=rest.slice(0,ps.index).trim();}
    let name=rest.replace(/\s+\/\s+/," // ").trim();if(!name)return;
    const b=basicName(name);if(b)name=b;
    if(sec&&CMD_SEC.test(sec))cmd=true;
    if(cat&&GEN_SEC.test(cat))cat=null;
    out.push({name,qty,cat:cat||(sec&&!CMD_SEC.test(sec)&&!GEN_SEC.test(sec)?sec:null),cmd,set,cn});
  });
  return out;
}
/* names Scryfall did not know: one fuzzy try each (fixes typos and dictation) */
async function scryLookup(entries){
  const nf=await scryLookupBase(entries);if(!nf.length)return nf;
  const miss=entries.filter(e=>!e.card).slice(0,25);
  for(const e of miss){imS.textContent="Checking spelling: "+e.name;
    try{const r=await fetch("https://api.scryfall.com/cards/named?fuzzy="+encodeURIComponent(e.name.split(" // ")[0]));if(r.ok){e.card=await r.json();e.fixed=e.name;}}catch(x){}
    await sleep(110);}
  const fixed=entries.filter(e=>e.fixed&&e.card).map(e=>e.fixed+" → "+e.card.name);
  if(fixed.length)try{sessionStorage.setItem(NS+"-msg",((sessionStorage.getItem(NS+"-msg")||"")+" Read as: "+fixed.join(", ")+".").trim())}catch(x){}
  return entries.filter(e=>!e.card).map(e=>e.name);
}
/* live preview of what the parser reads */
function imPreview(){const P=document.getElementById("imPrev");if(!P)return;const E=parseList(document.getElementById("imText").value);
  if(!E.length){P.innerHTML="";return;}
  const tot=E.reduce((a,e)=>a+e.qty,0),multi=E.filter(e=>e.qty>1);
  P.innerHTML='<b>'+tot+' card'+(tot===1?"":"s")+'</b> on '+E.length+' line'+(E.length===1?"":"s")+(multi.length?' · '+multi.slice(0,6).map(e=>esc(e.qty+"× "+e.name)).join(", ")+(multi.length>6?"…":""):"")+(E.some(e=>e.cmd)?' · commander: '+esc(E.filter(e=>e.cmd).map(e=>e.name).join(", ")):"");}
document.getElementById("imText").addEventListener("input",imPreview);

/* ---------- import from a link: Moxfield and Archidekt block requests from other sites, so guide the copy instead ---------- */
const LINK_HELP={
  moxfield:"Moxfield does not let other sites read its decks. On the deck page choose Export, copy the text list, then come back and tap Paste.",
  archidekt:"Archidekt does not let other sites read its decks. On the deck page choose Export, copy the text list, then come back and tap Paste.",
  other:"Paste a Moxfield or Archidekt deck link, or copy the deck as text and tap Paste."};
function linkSite(u){return /moxfield\.com/i.test(u)?"moxfield":/archidekt\.com/i.test(u)?"archidekt":"other";}
/* ---------- import tabs ---------- */
function setImTab(t){document.querySelectorAll("#imTabs [data-it]").forEach(b=>b.setAttribute("aria-selected",b.dataset.it===t));
  document.querySelectorAll("#importModal [data-ip]").forEach(p=>p.hidden=p.dataset.ip!==t);
  if(t!=="scan")stopScan();if(t==="scan")startScan();}
document.getElementById("imTabs").addEventListener("click",e=>{const b=e.target.closest("[data-it]");if(b)setImTab(b.dataset.it);});
document.getElementById("imLink").addEventListener("input",e=>{const v=e.target.value.trim();const st=document.getElementById("imLinkSt");st.textContent=v?LINK_HELP[linkSite(v)]:"";
  const o=document.getElementById("imLinkOpen");const site=linkSite(v);o.hidden=!(site!=="other"&&/^https?:\/\//i.test(v));if(!o.hidden)o.href=v;});
document.getElementById("imPaste").addEventListener("click",async()=>{const st=document.getElementById("imLinkSt");
  try{const t=await navigator.clipboard.readText();if(!t||!parseList(t).length){st.textContent="The clipboard does not hold a card list yet.";return;}
    document.getElementById("imText").value=t;setImTab("text");imPreview();}
  catch(e){st.textContent="This browser did not allow reading the clipboard. Long-press in the Text tab and choose Paste.";}});

/* ---------- scan real cards: camera → OCR (title + collector line) → Scryfall ---------- */
const SC={stream:null,worker:null,wload:null,busy:false,auto:false,timer:null,last:null,cur:null,list:[]};
const SC_LANG=new Set(["EN","IT","DE","FR","ES","PT","JA","JP","KO","RU","ZHS","ZHT","PH","CS","CT"]);
const SC_R={title:[0.03,0.02,0.82,0.10],bottom:[0.0,0.9,0.62,0.1]};
function scMsg(t){document.getElementById("scanMsg").textContent=t||"";}
function loadTess(){if(window.Tesseract)return Promise.resolve();return new Promise((res,rej)=>{const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";s.onload=res;s.onerror=()=>rej(new Error("The text reader could not be downloaded."));document.head.appendChild(s);});}
function scWorker(){if(SC.worker)return Promise.resolve(SC.worker);if(SC.wload)return SC.wload;
  SC.wload=loadTess().then(()=>Tesseract.createWorker("eng")).then(w=>{SC.worker=w;SC.wload=null;return w;}).catch(e=>{SC.wload=null;throw e;});return SC.wload;}
async function startScan(){const V=document.getElementById("scanVid");renderScanList();
  scMsg("Starting the camera…");scWorker().catch(()=>{});
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){scMsg("This browser cannot open the camera here. Use Photo instead.");return;}
  try{SC.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1080}},audio:false});
    V.srcObject=SC.stream;await V.play();scMsg("Fit the card in the frame, then tap Scan.");}
  catch(e){scMsg(e&&e.name==="NotAllowedError"?"Camera permission was refused. Allow it in the browser settings, or use Photo.":"The camera is not available. Use Photo instead.");}}
function stopScan(){clearTimeout(SC.timer);SC.auto=false;const a=document.getElementById("scanAuto");if(a)a.checked=false;
  if(SC.stream){SC.stream.getTracks().forEach(t=>t.stop());SC.stream=null;}const V=document.getElementById("scanVid");if(V)V.srcObject=null;}
/* the guide rectangle, mapped from screen pixels to video pixels (video uses object-fit: cover) */
function cardCanvasFromVideo(){const V=document.getElementById("scanVid"),G=document.getElementById("scanGuide"),box=document.getElementById("scanView").getBoundingClientRect(),g=G.getBoundingClientRect();
  const vw=V.videoWidth,vh=V.videoHeight;if(!vw)return null;const s=Math.max(box.width/vw,box.height/vh);const ox=(box.width-vw*s)/2,oy=(box.height-vh*s)/2;
  let x=(g.left-box.left-ox)/s,y=(g.top-box.top-oy)/s,w=g.width/s,h=g.height/s;const mx=w*.07,my=h*.07;x=Math.max(0,x-mx);y=Math.max(0,y-my);w=Math.min(vw-x,w+2*mx);h=Math.min(vh-y,h+2*my);return cropTo(V,x,y,w,h);}
function cropTo(src,x,y,w,h){const k=Math.max(1100/w,Math.min(1,1700/Math.max(w,h)));const W=Math.round(w*k),H=Math.round(h*k);const c=document.createElement("canvas");c.width=W;c.height=H;
  const ctx=c.getContext("2d");ctx.filter="grayscale(1) contrast(1.3)";ctx.drawImage(src,x,y,w,h,0,0,W,H);return c;}
function region(card,k){const r=SC_R[k],W=card.width,H=card.height;const c=document.createElement("canvas");const sw=Math.round(r[2]*W),sh=Math.round(r[3]*H);c.width=sw*2;c.height=sh*2;
  const ctx=c.getContext("2d");ctx.filter="grayscale(1) contrast(1.35)";ctx.drawImage(card,Math.round(r[0]*W),Math.round(r[1]*H),sw,sh,0,0,sw*2,sh*2);return c;}
function parseBottom(t){const U=t.toUpperCase();const lines=U.split(/\n|\|/).map(x=>x.replace(/[^A-Z0-9\/ ]/g," ").replace(/\s+/g," ").trim()).filter(Boolean);
  let cn=null;let m=U.match(/(?:^|[\s|])[CURMSLTPB]\s*((?:\d\s?){2,4})(?=\s|$|\|)/m);if(m)cn=m[1].replace(/\s/g,"").replace(/^0+(?=\d)/,"");
  if(!cn){m=U.match(/\b0*(\d{1,4})\s*\/\s*\d{3}\b/);if(m)cn=m[1];}
  if(!cn){m=U.match(/\b0(\d{2,3})\b/);if(m)cn=m[1].replace(/^0+(?=\d)/,"");}
  let set=null,lang=null;
  for(const l of lines){const tk=l.split(" ");const i=tk.findIndex((x,j)=>j>0&&SC_LANG.has(x));if(i>0&&/^[A-Z0-9]{3,5}$/.test(tk[i-1])&&/[A-Z]/.test(tk[i-1])){set=tk[i-1];lang=tk[i];break;}}
  if(!set){const l=lines[1]||lines[0]||"";const t2=l.split(" ").find(x=>/^[A-Z0-9]{3,5}$/.test(x)&&/[A-Z]/.test(x)&&/\d|[A-Z]{3}/.test(x)&&!SC_LANG.has(x));if(t2)set=t2;}
  return {set:set&&set.toLowerCase(),lang:lang&&({JP:"ja",CS:"zhs",CT:"zht"}[lang]||lang.toLowerCase()),cn};}
function cleanTitle(t){return t.replace(/[\r\n]+/g," ").replace(/^[^A-Za-zÀ-ÿ]+/,"").replace(/[^A-Za-zÀ-ÿ,'\- ]/g," ").split(/\s+/).filter((w,i,a)=>!(i===a.length-1&&w.length<3)).join(" ").replace(/\s+/g," ").trim();}
function sameName(a,b){const A=norm(a||"").split(/\s+/).filter(x=>x.length>2),B=new Set(norm(b||"").split(/\s+/));if(!A.length)return false;return A.filter(x=>B.has(x)).length/A.length>=0.5;}
async function sfJSON(u){try{const r=await fetch("https://api.scryfall.com/"+u);return r.ok?await r.json():null;}catch(e){return null;}}
async function identify(titles,bottomTxt){const pb=parseBottom(bottomTxt);titles=titles.filter(Boolean);let byNum=null,byName=null;
  if(pb.set&&pb.cn){const sets=[pb.set,pb.set.replace(/0/g,"o"),pb.set.replace(/o/g,"0")].filter((x,i,a)=>a.indexOf(x)===i);
    for(const s of sets){byNum=(pb.lang&&pb.lang!=="en"&&await sfJSON("cards/"+s+"/"+pb.cn+"/"+pb.lang))||await sfJSON("cards/"+s+"/"+pb.cn);if(byNum)break;}}
  if(byNum&&(!titles.length||titles.some(t=>sameName(t,byNum.printed_name||byNum.name)||sameName(t,byNum.name))))return byNum;
  for(const t of titles){const f=await sfJSON("cards/named?fuzzy="+encodeURIComponent(t));
    if(f){byName=f;break;}
    const m=await sfJSON("cards/search?include_multilingual=true&q="+encodeURIComponent(t));if(m&&m.data&&m.data.length&&m.total_cards<=6){byName=m.data[0];break;}}
  if(byName){if(byNum&&byNum.oracle_id===byName.oracle_id)return byNum;
    if(pb.set){const p=await sfJSON("cards/search?unique=prints&q="+encodeURIComponent('!"'+byName.name+'" set:'+pb.set));if(p&&p.data&&p.data[0])return p.data[0];}
    return byName;}
  return byNum;}
/* whole-image OCR, then pick the collector line (set code + number) and the title by position */
function pickLines(d,W,H){return (d.lines||[]).map(l=>({t:(l.text||"").replace(/\s+/g," ").trim(),y:l.bbox.y0/H,h:(l.bbox.y1-l.bbox.y0)/H,c:l.confidence||0})).filter(l=>l.t);}
function titleCands(L){return L.filter(l=>(l.t.match(/[A-Za-zÀ-ÿ]/g)||[]).length>=4&&l.c>35).sort((a,b)=>a.y-b.y).slice(0,3).map(l=>cleanTitle(l.t)).filter(t=>t.length>3);}
async function scanCanvas(card){if(SC.busy)return null;SC.busy=true;
  try{scMsg("Reading the card…");const w=await scWorker();
    await w.setParameters({tessedit_pageseg_mode:"3"});const d=(await w.recognize(card)).data;
    const L=pickLines(d,card.width,card.height);window.__scanDebug=L;
    const low=L.filter(l=>l.y>0.76).map(l=>l.t).join("\n");const tc=titleCands(L);
    const c=await identify(tc,low);
    SC.busy=false;return c||{fail:true,title:tc[0]||""};}
  catch(e){SC.busy=false;scMsg(e.message||"The card could not be read.");return null;}}
function showResult(c){const R=document.getElementById("scanRes");SC.cur=c;
  if(!c){R.innerHTML="";return;}
  if(c.fail){R.innerHTML='<div class="scfail"><p>Could not recognise this card'+(c.title?' (read "'+esc(c.title)+'")':'')+'. Try again with less glare, or type the name.</p><div class="exrow"><input id="scName" placeholder="Card name" autocomplete="off"><button type="button" id="scFind">Find</button></div></div>';
    scMsg("");return;}
  const img=imgOfCard(c),nm=c.name;
  R.innerHTML='<div class="scard"><img alt="" src="'+esc(img)+'"><div><b>'+esc(nm)+'</b>'+(c.printed_name&&c.printed_name!==nm?'<small>'+esc(c.printed_name)+'</small>':'')+
    '<label class="scprint"><span class="vh">Printing</span><select id="scPrint"><option value="'+esc(c.set+"|"+c.collector_number+"|"+c.lang)+'">'+esc(c.set_name+" · #"+c.collector_number+" · "+c.lang.toUpperCase())+'</option></select></label>'+
    '<div class="exrow"><span class="qctl"><button type="button" data-sq="-1" aria-label="One less">−</button><b id="scQty">1</b><button type="button" data-sq="1" aria-label="One more">+</button></span><button type="button" class="btn-acc" id="scAdd">Add</button><button type="button" id="scSkip">Discard</button></div></div></div>';
  scMsg("");if(navigator.vibrate)try{navigator.vibrate(40)}catch(e){}
  sfJSON("cards/search?unique=prints&order=released&q="+encodeURIComponent('!"'+nm+'"')).then(j=>{if(!j||!j.data||SC.cur!==c)return;const S=document.getElementById("scPrint");if(!S)return;
    j.data.forEach(p=>{const v=p.set+"|"+p.collector_number+"|"+p.lang;if(v===S.options[0].value)return;const o=document.createElement("option");o.value=v;o.textContent=p.set_name+" · #"+p.collector_number;S.appendChild(o);});});}
function addScanned(){const c=SC.cur;if(!c||c.fail)return;const q=+document.getElementById("scQty").textContent||1;const [set,cn]=document.getElementById("scPrint").value.split("|");
  const ex=SC.list.find(x=>x.name===c.name&&x.set===set&&x.cn===cn);if(ex)ex.qty+=q;else SC.list.unshift({name:c.name,set,cn,qty:q});
  const T=document.getElementById("imText");T.value=(T.value.trim()?T.value.trim()+"\n":"")+q+" "+c.name+" ("+set.toUpperCase()+") "+cn;imPreview();
  SC.last={name:c.name,at:Date.now()};showResult(null);renderScanList();scMsg("Added "+q+"× "+c.name+". Next card.");if(SC.auto)autoLoop();}
function renderScanList(){const L=document.getElementById("scanList");if(!L)return;const n=SC.list.reduce((a,x)=>a+x.qty,0);
  L.innerHTML=SC.list.length?'<p class="lbl">Scanned <b>'+n+'</b> · in the Text tab, ready to create</p>'+SC.list.slice(0,30).map(x=>'<span class="mchip"><span class="mv">'+x.qty+'× '+esc(x.name)+' <small>'+esc(x.set.toUpperCase())+'</small></span></span>').join(""):"";}
async function scanOnce(){const V=document.getElementById("scanVid");if(!SC.stream||!V.videoWidth){scMsg("The camera is not on. Use Photo instead.");return;}
  const c=await scanCanvas(cardCanvasFromVideo());if(!c)return;
  if(SC.auto&&(c.fail||(SC.last&&SC.last.name===c.name&&Date.now()-SC.last.at<5000))){scMsg(c.fail?"Looking for a card…":"Same card: show the next one.");autoLoop();return;}
  showResult(c);if(SC.auto&&!c.fail&&document.getElementById("scanAuto").checked)setTimeout(addScanned,700);}
function autoLoop(){clearTimeout(SC.timer);if(!SC.auto)return;SC.timer=setTimeout(scanOnce,900);}
(function(){const P=document.querySelector('#importModal [data-ip="scan"]');if(!P)return;
  document.getElementById("scanShot").addEventListener("click",scanOnce);
  document.getElementById("scanAuto").addEventListener("change",e=>{SC.auto=e.target.checked;if(SC.auto){scMsg("Auto: cards are added as they are recognised.");autoLoop();}else clearTimeout(SC.timer);});
  document.getElementById("scanFile").addEventListener("change",async e=>{const f=e.target.files&&e.target.files[0];if(!f)return;e.target.value="";
    const im=new Image();im.src=URL.createObjectURL(f);await im.decode().catch(()=>{});
    const card=cropTo(im,0,0,im.naturalWidth,im.naturalHeight);URL.revokeObjectURL(im.src);const c=await scanCanvas(card);if(c)showResult(c);});
  P.addEventListener("click",async e=>{const b=e.target.closest("button");if(!b)return;
    if(b.dataset.sq){const q=document.getElementById("scQty");q.textContent=Math.max(1,(+q.textContent||1)+(+b.dataset.sq));}
    else if(b.id==="scAdd")addScanned();
    else if(b.id==="scSkip"){showResult(null);scMsg("Discarded.");if(SC.auto)autoLoop();}
    else if(b.id==="scFind"){const n=document.getElementById("scName").value.trim();if(!n)return;const c=await sfJSON("cards/named?fuzzy="+encodeURIComponent(n));showResult(c||{fail:true,title:n});}});})();
/* stop the camera when the import window closes */
let imWasOpen=false;new MutationObserver(()=>{const o=imM.classList.contains("open");if(!o)stopScan();if(o&&!imWasOpen){setImTab("text");setTimeout(imPreview,0);}imWasOpen=o;}).observe(imM,{attributes:true,attributeFilter:["class"]});
