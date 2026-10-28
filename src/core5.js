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

/* ---------- scan real cards: read only the title line, match it against a local list of card names ---------- */
const SC={stream:null,worker:null,wload:null,busy:false,run:false,auto:false,timer:null,last:null,cur:null,list:[],prev:null,seen:0};
const NAMES_URLS=l=>(location.hostname.endsWith("github.io")?["data/names-"+l+".json"]:[]).concat(["https://ffru333.github.io/commander-lab/desk/data/names-"+l+".json","https://raw.githubusercontent.com/FFru333/commander-lab/gh-pages/desk/data/names-"+l+".json"]);
const NX={ready:null,keys:[],names:[],from:[],tri:new Map()};
const nkey=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9 ]+/g," ").replace(/\s+/g," ").trim();
function trigrams(k){const t=" "+k+" ";const out=new Set();for(let i=0;i<t.length-2;i++)out.add(t.slice(i,i+3));return out;}
function nxAdd(key,name,from){if(key.length<3)return;const id=NX.keys.length;NX.keys.push(key);NX.names.push(name);NX.from.push(from);
  trigrams(key).forEach(g=>{let a=NX.tri.get(g);if(!a)NX.tri.set(g,a=[]);a.push(id);});}
async function getJSON(urls){for(const u of urls){try{const r=await fetch(u);if(r.ok)return await r.json();}catch(e){}}return null;}
function loadNames(){if(NX.ready)return NX.ready;NX.ready=(async()=>{
  const en=await getJSON(["https://api.scryfall.com/catalog/card-names"]);if(!en||!en.data)throw new Error("The list of card names could not be downloaded.");
  en.data.forEach(n=>{nxAdd(nkey(n),n,"en");if(n.includes(" // "))n.split(" // ").forEach(f=>nxAdd(nkey(f),n,"en"));});
  const it=await getJSON(NAMES_URLS("it"));if(it)Object.keys(it).forEach(p=>{nxAdd(nkey(p),it[p],"it");if(p.includes(" // "))p.split(" // ").forEach(f=>nxAdd(nkey(f),it[p],"it"));});
  return true;})().catch(e=>{NX.ready=null;throw e;});return NX.ready;}
function lev(a,b){if(a===b)return 0;const m=a.length,n=b.length;if(!m)return n;if(!n)return m;let p=new Array(n+1),c=new Array(n+1);for(let j=0;j<=n;j++)p[j]=j;
  for(let i=1;i<=m;i++){c[0]=i;const ai=a.charCodeAt(i-1);for(let j=1;j<=n;j++)c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(ai===b.charCodeAt(j-1)?0:1));[p,c]=[c,p];}return p[n];}
const simOf=(a,b)=>1-lev(a,b)/Math.max(a.length,b.length);
/* best name for a line of OCR text; tolerant of junk around the title (frame edges, mana symbols) but
   every real word left out costs points, so "Terror of the Pe…" does not collapse to "Terror" */
function matchName(raw){const k=nkey(raw);if(k.length<3||!NX.keys.length)return null;
  const hits=new Map();trigrams(k).forEach(g=>{const a=NX.tri.get(g);if(a&&a.length<5000)a.forEach(id=>hits.set(id,(hits.get(id)||0)+1));});
  const cand=[...hits.entries()].sort((a,b)=>b[1]-a[1]).slice(0,80);let best=null,second=null;
  const words=k.split(" ");const real=w=>/[a-z]{2,}/.test(w);
  cand.forEach(([id])=>{const key=NX.keys[id];let s=simOf(k,key);
    for(let a=0;a<words.length;a++)for(let b=words.length;b>a;b--){if(a===0&&b===words.length)continue;const sub=words.slice(a,b).join(" ");if(Math.abs(sub.length-key.length)>4)continue;
      const dropped=words.slice(0,a).concat(words.slice(b)).filter(real).length;s=Math.max(s,simOf(sub,key)-0.06*dropped);}
    if(k.length<key.length&&k.length>=key.length*0.6)s=Math.max(s,simOf(k,key.slice(0,k.length))*Math.pow(k.length/key.length,0.35));
    const r={id,name:NX.names[id],from:NX.from[id],key,sim:s};
    if(!best||s>best.sim){if(best&&best.name!==r.name)second=best;best=r;}else if(r.name!==best.name&&(!second||s>second.sim))second=r;});
  if(!best)return null;best.margin=best.sim-(second?second.sim:0);best.raw=raw.trim();return best;}
const JUNK=/wizards of the|™|©|illus|\b(19|20)\d\d\b/i;
function bestOfLines(lines){let b=null;lines.forEach(t=>{if(JUNK.test(t))return;const m=matchName(t);if(m&&(!b||m.sim>b.sim))b=m;});return b;}
function scMsg(t){document.getElementById("scanMsg").textContent=t||"";}
function loadTess(){if(window.Tesseract)return Promise.resolve();return new Promise((res,rej)=>{const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";s.onload=res;s.onerror=()=>rej(new Error("The text reader could not be downloaded."));document.head.appendChild(s);});}
function scWorker(){if(SC.worker)return Promise.resolve(SC.worker);if(SC.wload)return SC.wload;
  SC.wload=loadTess().then(()=>Tesseract.createWorker("eng")).then(async w=>{await w.setParameters({tessedit_pageseg_mode:"6"});SC.worker=w;SC.wload=null;return w;}).catch(e=>{SC.wload=null;throw e;});return SC.wload;}
async function startScan(){const V=document.getElementById("scanVid");renderScanList();scMsg("Getting ready…");
  const prep=Promise.all([scWorker(),loadNames()]).catch(e=>{scMsg(e.message);throw e;});prep.catch(()=>{});
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){scMsg("This browser cannot open the camera here. Use Photo instead.");return;}
  try{SC.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1080}},audio:false});
    V.srcObject=SC.stream;await V.play();}
  catch(e){scMsg(e&&e.name==="NotAllowedError"?"Camera permission was refused. Allow it in the browser settings, or use Photo.":"The camera is not available. Use Photo instead.");return;}
  try{await prep;}catch(e){return;}
  SC.run=true;SC.readyAt=performance.now();setRunBtn();scMsg("Point at the card name.");loop();}
function stopScan(){SC.run=false;clearTimeout(SC.timer);if(SC.stream){SC.stream.getTracks().forEach(t=>t.stop());SC.stream=null;}const V=document.getElementById("scanVid");if(V)V.srcObject=null;setRunBtn();}
function setRunBtn(){const b=document.getElementById("scanShot");if(b){b.textContent=SC.run?"Pause":"Resume";b.setAttribute("aria-pressed",SC.run);}}
/* the reading band on screen, mapped to video pixels (the video uses object-fit: cover) */
function bandCanvas(){const V=document.getElementById("scanVid"),G=document.getElementById("scanGuide"),box=document.getElementById("scanView").getBoundingClientRect(),g=G.getBoundingClientRect();
  const vw=V.videoWidth,vh=V.videoHeight;if(!vw)return null;const s=Math.max(box.width/vw,box.height/vh);const ox=(box.width-vw*s)/2,oy=(box.height-vh*s)/2;
  const x=Math.max(0,(g.left-box.left-ox)/s),y=Math.max(0,(g.top-box.top-oy)/s),w=Math.min(vw-x,g.width/s),h=Math.min(vh-y,g.height/s);
  const k=Math.min(1.6,1000/w),c=document.createElement("canvas");c.width=Math.round(w*k);c.height=Math.round(h*k);const ctx=c.getContext("2d");ctx.filter="grayscale(1)";ctx.drawImage(V,x,y,w,h,0,0,c.width,c.height);
  window.__scanGeom={vw,vh,x:Math.round(x),y:Math.round(y),w:Math.round(w),h:Math.round(h)};return c;}
async function readBand(){const w=await scWorker();const c=bandCanvas();if(!c)return [];const d=(await w.recognize(c)).data;
  return (d.lines||[]).map(l=>l.text||"").filter(t=>t.trim().length>2);}
async function loop(){clearTimeout(SC.timer);if(!SC.run)return;
  if(!SC.busy){SC.busy=true;const t0=performance.now();let lines=[];try{lines=await readBand();}catch(e){}SC.busy=false;const raw=lines.join(" | ");
    const m=bestOfLines(lines);SC.cycles=(SC.cycles||0)+1;window.__scanDebug={raw,m,geom:window.__scanGeom,ms:Math.round(performance.now()-t0),cycles:SC.cycles,sinceReady:SC.readyAt?Math.round(performance.now()-SC.readyAt):null};
    const ok=m&&(m.sim>=0.9||(m.sim>=0.78&&m.margin>=0.06));
    if(ok){const stable=SC.prev&&SC.prev.name===m.name;SC.prev=m;
      if(m.sim>=0.93||stable)await recognised(m);else scMsg("Reading… "+m.name+"?");}
    else{SC.prev=null;if(Date.now()-SC.seen>1800)scMsg(raw.trim().length>2?"Hold the name inside the strip.":"Point at the card name.");}}
  if(SC.run)SC.timer=setTimeout(loop,120);}
async function recognised(m){SC.seen=Date.now();
  if(SC.cur&&!SC.cur.fail&&SC.cur.name===m.name)return;
  if(SC.last&&SC.last.name===m.name&&Date.now()-SC.last.at<4000)return;
  const c=(m.from!=="en"&&await sfJSON("cards/search?unique=prints&include_multilingual=true&q="+encodeURIComponent('!"'+m.name+'" lang:'+m.from)).then(j=>j&&j.data&&j.data[0]))||await sfJSON("cards/named?exact="+encodeURIComponent(m.name));
  if(!c){scMsg("Recognised "+m.name+", but Scryfall did not answer.");return;}
  showResult(c);if(SC.auto)setTimeout(()=>{if(SC.cur===c)addScanned();},600);}
async function sfJSON(u){try{const r=await fetch("https://api.scryfall.com/"+u);return r.ok?await r.json():null;}catch(e){return null;}}
function showResult(c){const R=document.getElementById("scanRes");SC.cur=c;
  if(!c){R.innerHTML="";return;}
  if(c.fail){R.innerHTML='<div class="scfail"><p>Could not recognise this card'+(c.title?' (read "'+esc(c.title)+'")':'')+'. Type the name instead.</p><div class="exrow"><input id="scName" placeholder="Card name" autocomplete="off"><button type="button" id="scFind">Find</button></div></div>';return;}
  const nm=c.name;
  R.innerHTML='<div class="scard"><img alt="" src="'+esc(imgOfCard(c))+'"><div><b>'+esc(nm)+'</b>'+(c.printed_name&&c.printed_name!==nm?'<small>'+esc(c.printed_name)+'</small>':'')+
    '<label class="scprint"><span class="vh">Printing</span><select id="scPrint"><option value="'+esc(c.set+"|"+c.collector_number+"|"+c.lang)+'">'+esc(c.set_name+" · #"+c.collector_number+" · "+c.lang.toUpperCase())+'</option></select></label>'+
    '<div class="exrow"><span class="qctl"><button type="button" data-sq="-1" aria-label="One less">−</button><b id="scQty">1</b><button type="button" data-sq="1" aria-label="One more">+</button></span><button type="button" class="btn-acc" id="scAdd">Add</button><button type="button" id="scSkip">Discard</button></div></div></div>';
  scMsg("Found: "+nm);if(navigator.vibrate)try{navigator.vibrate(40)}catch(e){}
  sfJSON("cards/search?unique=prints&order=released&q="+encodeURIComponent('!"'+nm+'"')).then(j=>{if(!j||!j.data||SC.cur!==c)return;const S=document.getElementById("scPrint");if(!S)return;
    j.data.forEach(p=>{const v=p.set+"|"+p.collector_number+"|"+p.lang;if(v===S.options[0].value)return;const o=document.createElement("option");o.value=v;o.textContent=p.set_name+" · #"+p.collector_number;S.appendChild(o);});});}
function addScanned(){const c=SC.cur;if(!c||c.fail)return;const q=+document.getElementById("scQty").textContent||1;const [set,cn]=document.getElementById("scPrint").value.split("|");
  const ex=SC.list.find(x=>x.name===c.name&&x.set===set&&x.cn===cn);if(ex)ex.qty+=q;else SC.list.unshift({name:c.name,set,cn,qty:q});
  const T=document.getElementById("imText");T.value=(T.value.trim()?T.value.trim()+"\n":"")+q+" "+c.name+" ("+set.toUpperCase()+") "+cn;imPreview();
  SC.last={name:c.name,at:Date.now()};showResult(null);renderScanList();scMsg("Added "+q+"× "+c.name+". Next card.");}
function renderScanList(){const L=document.getElementById("scanList");if(!L)return;const n=SC.list.reduce((a,x)=>a+x.qty,0);
  L.innerHTML=SC.list.length?'<p class="lbl">Scanned <b>'+n+'</b> · in the Text tab, ready to create</p>'+SC.list.slice(0,30).map(x=>'<span class="mchip"><span class="mv">'+x.qty+'× '+esc(x.name)+' <small>'+esc(x.set.toUpperCase())+'</small></span></span>').join(""):"";}
/* a photo: read every line and keep the one that best matches a card name */
async function scanPhoto(f){SC.busy=true;scMsg("Reading the photo…");
  try{await loadNames();const w=await scWorker();const im=new Image();im.src=URL.createObjectURL(f);await im.decode();
    const k=Math.min(1,1600/Math.max(im.naturalWidth,im.naturalHeight));const c=document.createElement("canvas");c.width=Math.round(im.naturalWidth*k);c.height=Math.round(im.naturalHeight*k);
    const ctx=c.getContext("2d");ctx.filter="grayscale(1) contrast(1.3)";ctx.drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(im.src);
    const top=(await w.recognize(c,{rectangle:{left:0,top:0,width:c.width,height:Math.round(c.height*0.3)}})).data;
    let best=bestOfLines((top.lines||[]).map(l=>l.text||""));
    if(!best||best.sim<0.85){await w.setParameters({tessedit_pageseg_mode:"3"});const d=(await w.recognize(c)).data;await w.setParameters({tessedit_pageseg_mode:"6"});
      const b2=bestOfLines((d.lines||[]).map(l=>l.text||""));if(b2&&(!best||b2.sim>best.sim))best=b2;}
    SC.busy=false;if(best&&best.sim>=0.78){SC.last=null;await recognised(best);}else showResult({fail:true,title:""});}
  catch(e){SC.busy=false;scMsg(e.message||"The photo could not be read.");}}
(function(){const P=document.querySelector('#importModal [data-ip="scan"]');if(!P)return;
  document.getElementById("scanShot").addEventListener("click",()=>{if(SC.run){SC.run=false;clearTimeout(SC.timer);setRunBtn();scMsg("Paused.");}else if(SC.stream){SC.run=true;setRunBtn();loop();}else startScan();});
  document.getElementById("scanAuto").addEventListener("change",e=>{SC.auto=e.target.checked;scMsg(SC.auto?"Auto-add on: each new card goes straight into the list.":"Auto-add off.");});
  document.getElementById("scanFile").addEventListener("change",e=>{const f=e.target.files&&e.target.files[0];e.target.value="";if(f)scanPhoto(f);});
  P.addEventListener("click",async e=>{const b=e.target.closest("button");if(!b)return;
    if(b.dataset.sq){const q=document.getElementById("scQty");q.textContent=Math.max(1,(+q.textContent||1)+(+b.dataset.sq));}
    else if(b.id==="scAdd")addScanned();
    else if(b.id==="scSkip"){SC.last={name:SC.cur&&SC.cur.name,at:Date.now()};showResult(null);scMsg("Discarded.");}
    else if(b.id==="scFind"){const n=document.getElementById("scName").value.trim();if(!n)return;const c=await sfJSON("cards/named?fuzzy="+encodeURIComponent(n));showResult(c||{fail:true,title:n});}});})();
let imWasOpen=false;new MutationObserver(()=>{const o=imM.classList.contains("open");if(!o)stopScan();if(o&&!imWasOpen){setImTab("text");setTimeout(imPreview,0);}imWasOpen=o;}).observe(imM,{attributes:true,attributeFilter:["class"]});
