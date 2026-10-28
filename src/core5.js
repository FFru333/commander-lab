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
  const G=document.getElementById("imGo");if(G){const base=imTarget?"Update":"Create deck";const n0=E.reduce((a,e)=>a+e.qty,0);G.textContent=n0?base+" · "+n0+" card"+(n0===1?"":"s"):base;}
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
  if(t!=="scan")stopScan();if(t==="scan"){if(SC.mode!=="scan"){const gen=new Set(SC.list.map(scLine));SC.base=document.getElementById("imText").value.split("\n").filter(l=>!gen.has(l.trim())).join("\n");}startScan();}scanCls(t==="scan");}
function scanCls(on){if(imM.classList.contains("scanmode")!==!!on)imM.classList.toggle("scanmode",!!on);}
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
/* the two reading zones inside the card frame, mapped to video pixels (the video uses object-fit: cover) */
function zoneCanvas(id,target){const V=document.getElementById("scanVid"),Z=document.getElementById(id),box=document.getElementById("scanView").getBoundingClientRect(),g=Z.getBoundingClientRect();
  const vw=V.videoWidth,vh=V.videoHeight;if(!vw)return null;const s=Math.max(box.width/vw,box.height/vh);const ox=(box.width-vw*s)/2,oy=(box.height-vh*s)/2;
  const x=Math.max(0,(g.left-box.left-ox)/s),y=Math.max(0,(g.top-box.top-oy)/s),w=Math.min(vw-x,g.width/s),h=Math.min(vh-y,g.height/s);if(w<8||h<8)return null;
  const k=Math.min(target.maxScale||3,(target.w||1e9)/w,(target.h||1e9)/h),c=document.createElement("canvas");c.width=Math.round(w*k);c.height=Math.round(h*k);
  const ctx=c.getContext("2d");ctx.filter="grayscale(1) contrast(1.2)";ctx.drawImage(V,x,y,w,h,0,0,c.width,c.height);return c;}
async function ocr(c){if(!c)return "";const w=await scWorker();return (await w.recognize(c)).data;}
const LANG_CODES=new Set(["EN","IT","DE","FR","ES","PT","JA","JP","KO","RU","ZHS","ZHT","PH","CS","CT"]);
function parseBottom(t){const U=String(t||"").toUpperCase();const lines=U.split(/\n|\|/).map(x=>x.replace(/[^A-Z0-9\/ ]/g," ").replace(/\s+/g," ").trim()).filter(Boolean);
  let cn=null;let m=U.match(/(?:^|[\s|])[CURMSLTPB]\s*((?:\d\s?){2,4})(?=\s|$|\|)/m);if(m)cn=m[1].replace(/\s/g,"").replace(/^0+(?=\d)/,"");
  if(!cn){m=U.match(/\b0*(\d{1,4})\s*\/\s*\d{3}\b/);if(m)cn=m[1];}
  if(!cn){m=U.match(/\b0(\d{2,3})\b/);if(m)cn=m[1].replace(/^0+(?=\d)/,"");}
  let set=null,lang=null;
  for(const l of lines){const tk=l.split(" ");const i=tk.findIndex((x,j)=>j>0&&LANG_CODES.has(x));if(i>0&&/^[A-Z0-9]{3,5}$/.test(tk[i-1])&&/[A-Z]/.test(tk[i-1])){set=tk[i-1];lang=tk[i];break;}}
  return {set:set&&set.toLowerCase(),lang:lang&&({JP:"ja",CS:"zhs",CT:"zht"}[lang]||lang.toLowerCase()),cn};}
async function loop(){clearTimeout(SC.timer);if(!SC.run)return;
  if(!SC.busy){SC.busy=true;const t0=performance.now();let lines=[],bottom="",m=null;
    try{const d=await ocr(zoneCanvas("zTitle",{w:1000,maxScale:2.5}));lines=(d.lines||[]).map(l=>l.text||"").filter(t=>t.trim().length>2);}catch(e){}
    m=bestOfLines(lines);const ok=m&&(m.sim>=0.9||(m.sim>=0.78&&m.margin>=0.06));
    if(ok){SC.seen=Date.now();const stable=SC.prev&&SC.prev.name===m.name;SC.prev=m;if(m.sim>=0.93||stable)onName(m);else scMsg("Reading… "+m.name+"?");}
    else SC.prev=null;
    const needSet=SC.cur&&!SC.cur.fail&&!SC.cur.setKnown&&SC.cur.tries<14;
    if(needSet||!ok){try{const d=await ocr(zoneCanvas("zSet",{h:180,maxScale:3}));bottom=d.text||"";}catch(e){}
      if(needSet)SC.cur.tries++;const pb=parseBottom(bottom);if(pb.set&&pb.cn)onCollector(pb,!ok);}
    if(!ok&&!SC.cur&&Date.now()-SC.seen>1800)scMsg("Fit the card in the frame: name at the top, set code at the bottom left.");
    SC.busy=false;SC.cycles=(SC.cycles||0)+1;
    window.__scanDebug={raw:lines.join(" | "),bottom,m,ms:Math.round(performance.now()-t0),cycles:SC.cycles,sinceReady:SC.readyAt?Math.round(performance.now()-SC.readyAt):null,cur:SC.cur&&{name:SC.cur.name,set:SC.cur.card&&SC.cur.card.set,known:SC.cur.setKnown}};}
  if(SC.run)SC.timer=setTimeout(loop,100);}
/* a new name: show it, add one copy (auto mode), never add it again while it is the current card */
function onName(m,card){if(SC.cur&&!SC.cur.fail&&SC.cur.name===m.name){if(card&&!SC.cur.setKnown)applyCard(card,true);return;}
  SC.cur={name:m.name,from:m.from,card:null,setKnown:false,tries:0,entry:null,tried:new Set()};
  if(card)applyCard(card,true);else{renderCurrent();setTimeout(()=>{const c=SC.cur;if(c&&c.name===m.name&&!c.card)defaultPrinting(c);},2600);}
  if(SC.auto)addCopy();if(navigator.vibrate)try{navigator.vibrate(40)}catch(e){}}
/* set code + collector number read at the bottom: check it belongs to the current card (or, with no name read, identify by it) */
const pendingCol={key:null,n:0};
async function onCollector(pb,noName){const key=pb.set+"|"+pb.cn+"|"+(pb.lang||"");
  if(noName){if(pendingCol.key!==key){pendingCol.key=key;pendingCol.n=1;return;}if(++pendingCol.n<2)return;}
  const cur=SC.cur;if(cur&&cur.tried.has(key))return;if(cur)cur.tried.add(key);
  const c=(pb.lang&&pb.lang!=="en"&&await sfJSON("cards/"+pb.set+"/"+pb.cn+"/"+pb.lang))||await sfJSON("cards/"+pb.set+"/"+pb.cn);if(!c)return;
  if(SC.cur&&!SC.cur.fail){if(nk(c.name)===nk(SC.cur.name)||norm(c.name)===norm(SC.cur.name))applyCard(c,true);}
  else if(noName)onName({name:c.name,from:c.lang},c);}
async function defaultPrinting(cur){const c=(cur.from&&cur.from!=="en"&&await sfJSON("cards/search?unique=prints&include_multilingual=true&q="+encodeURIComponent('!"'+cur.name+'" lang:'+cur.from)).then(j=>j&&j.data&&j.data[0]))||await sfJSON("cards/named?exact="+encodeURIComponent(cur.name));
  if(c&&SC.cur===cur&&!cur.setKnown&&nk(c.name)===nk(cur.name))applyCard(c,false);}
function applyCard(c,exact){const cur=SC.cur;if(!cur)return;cur.card=c;if(exact)cur.setKnown=true;
  const e=cur.entry;if(e&&(exact||!e.set)){e.set=c.set;e.cn=c.collector_number;e.lang=c.lang;mergeEntry(e);syncScanText();renderScanList();}
  renderCurrent();if(exact)scMsg("Found: "+c.name+" · "+c.set.toUpperCase()+" #"+c.collector_number+(c.lang&&c.lang!=="en"?" · "+c.lang.toUpperCase():""));}
function mergeEntry(e){const o=SC.list.find(x=>x!==e&&x.name===e.name&&x.set===e.set&&x.cn===e.cn);if(o){o.qty+=e.qty;SC.list.splice(SC.list.indexOf(e),1);if(SC.cur&&SC.cur.entry===e)SC.cur.entry=o;}}
function addCopy(){const cur=SC.cur;if(!cur||cur.fail)return;
  if(cur.entry&&SC.list.includes(cur.entry))cur.entry.qty++;
  else{const c=cur.card;cur.entry={name:cur.name,set:c?c.set:"",cn:c?c.collector_number:"",lang:c?c.lang:"",qty:1};SC.list.unshift(cur.entry);mergeEntry(cur.entry);}
  syncScanText();renderScanList();renderCurrent();scMsg("In the list: "+cur.entry.qty+"× "+cur.name+". Tap the card for another copy.");}
/* Scryfall asks for at most ~10 requests a second: one queue, spaced calls, retries on 429 and network errors */
let sfQ=Promise.resolve(),sfLast=0;
function sfJSON(u){const run=async()=>{for(let k=0;k<3;k++){const wait=Math.max(0,sfLast+120-Date.now());if(wait)await sleep(wait);sfLast=Date.now();
    try{const r=await fetch("https://api.scryfall.com/"+u);if(r.ok)return await r.json();if(r.status===404)return null;if(r.status===429)await sleep(1000*(k+1));else await sleep(400*(k+1));}
    catch(e){await sleep(600*(k+1));}}return null;};
  const p=sfQ.then(run,run);sfQ=p.catch(()=>{});return p;}
function renderCurrent(){const R=document.getElementById("scanRes");const cur=SC.cur;
  if(!cur){R.innerHTML="";return;}
  if(cur.fail){R.innerHTML='<div class="scfail"><p>Could not recognise this card. Type the name instead.</p><div class="exrow"><input id="scName" placeholder="Card name" autocomplete="off"><button type="button" id="scFind">Find</button></div></div>';return;}
  const c=cur.card,n=cur.entry&&SC.list.includes(cur.entry)?cur.entry.qty:0;
  const img=c?imgOfCard(c):"https://api.scryfall.com/cards/named?exact="+encodeURIComponent(front(cur.name))+"&format=image&version=normal";
  R.innerHTML='<div class="scard"><button type="button" class="scimg" id="scTap" aria-label="Add another copy of '+esc(cur.name)+'"><img alt="" src="'+esc(img)+'">'+(n?'<em>'+n+'×</em>':'')+'</button><div><b>'+esc(cur.name)+'</b>'+(c&&c.printed_name&&c.printed_name!==cur.name?'<small>'+esc(c.printed_name)+'</small>':'')+
    '<small class="scset'+(cur.setKnown?" ok":"")+'">'+(c?esc(c.set_name+" · #"+c.collector_number+" · "+(c.lang||"en").toUpperCase())+(cur.setKnown?" · read from the card":" · most recent printing, reading the set…"):"Reading the set…")+'</small>'+
    '<label class="scprint"><span class="vh">Change printing</span><select id="scPrint"><option value="">Change printing…</option></select></label>'+
    '<div class="exrow"><button type="button" class="btn-acc" id="scAdd">'+(n?"+1 copy":"Add")+'</button>'+(n?'<button type="button" id="scUndo">Remove one</button>':'')+'</div></div></div>';
  if(c&&!cur.printsLoading){cur.printsLoading=true;sfJSON("cards/search?unique=prints&order=released&include_multilingual=true&q="+encodeURIComponent('!"'+cur.name+'"')).then(j=>{cur.prints=j&&j.data||[];fillPrints();});}else fillPrints();}
function fillPrints(){const S=document.getElementById("scPrint"),cur=SC.cur;if(!S||!cur||!cur.prints)return;
  cur.prints.forEach((p,i)=>{const o=document.createElement("option");o.value=String(i);o.textContent=p.set_name+" · #"+p.collector_number+" · "+(p.lang||"en").toUpperCase();if(cur.card&&p.id===cur.card.id)o.selected=true;S.appendChild(o);});}
const scLine=x=>x.qty+" "+x.name+(x.set?" ("+x.set.toUpperCase()+") "+x.cn:"");
function syncScanText(){const T=document.getElementById("imText");T.value=[SC.base||""].concat(SC.list.slice().reverse().map(scLine)).map(x=>x.trim()).filter(Boolean).join("\n");imPreview();lsSet(NS+"-scanbuf",SC.list);}
function addScanned(){addCopy();}
function renderScanList(){const L=document.getElementById("scanList");if(!L)return;const n=SC.list.reduce((a,x)=>a+x.qty,0);
  L.innerHTML=SC.list.length?'<p class="lbl">Scanned <b>'+n+'</b> card'+(n===1?"":"s")+'</p>'+SC.list.map((x,i)=>'<div class="srow"><span class="sq">'+x.qty+'×</span><span class="sn">'+esc(x.name)+' <small>'+esc((x.set||"…").toUpperCase())+'</small></span><span class="qctl"><button type="button" data-li="'+i+'" data-d="-1" aria-label="One less '+esc(x.name)+'">−</button><button type="button" data-li="'+i+'" data-d="1" aria-label="One more '+esc(x.name)+'">+</button></span></div>').join("")+'<button type="button" class="ghostbtn" id="scClear">Clear the scanned list</button>':'<p class="note">Scanned cards collect here, one after another.</p>';}
/* restore an unfinished scan session; forget it once a deck has been created from it */
(function(){const b=lsGet(NS+"-scanbuf");let done=null;try{done=sessionStorage.getItem(NS+"-scandone");sessionStorage.removeItem(NS+"-scandone")}catch(e){}
  if(done&&CUR&&Date.now()-(CUR.created||0)<120000){lsSet(NS+"-scanbuf",[]);return;}
  if(Array.isArray(b))SC.list=b;})();
function openScanSession(){SC.openScan=true;SC.mode="scan";SC.auto=true;const a=document.getElementById("scanAuto");if(a)a.checked=true;
  SC.base="";openImport(false);document.getElementById("imTitle").textContent="Scan cards";scanCls(true);syncScanText();renderScanList();}
document.getElementById("navScan").addEventListener("click",openScanSession);
document.getElementById("imGo").addEventListener("click",()=>{if(SC.list.length)try{sessionStorage.setItem(NS+"-scandone","1")}catch(e){}},true);
/* a photo: read every line and keep the one that best matches a card name */
async function scanPhoto(f){SC.busy=true;scMsg("Reading the photo…");
  try{await loadNames();const w=await scWorker();const im=new Image();im.src=URL.createObjectURL(f);await im.decode();
    const k=Math.min(1,1600/Math.max(im.naturalWidth,im.naturalHeight));const c=document.createElement("canvas");c.width=Math.round(im.naturalWidth*k);c.height=Math.round(im.naturalHeight*k);
    const ctx=c.getContext("2d");ctx.filter="grayscale(1) contrast(1.3)";ctx.drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(im.src);
    const top=(await w.recognize(c,{rectangle:{left:0,top:0,width:c.width,height:Math.round(c.height*0.3)}})).data;
    let best=bestOfLines((top.lines||[]).map(l=>l.text||""));
    if(!best||best.sim<0.85){await w.setParameters({tessedit_pageseg_mode:"3"});const d=(await w.recognize(c)).data;await w.setParameters({tessedit_pageseg_mode:"6"});
      const b2=bestOfLines((d.lines||[]).map(l=>l.text||""));if(b2&&(!best||b2.sim>best.sim))best=b2;}
    SC.busy=false;if(best&&best.sim>=0.78){SC.cur=null;onName(best);}else{SC.cur={fail:true};renderCurrent();}}
  catch(e){SC.busy=false;scMsg(e.message||"The photo could not be read.");}}
(function(){const P=document.querySelector('#importModal [data-ip="scan"]');if(!P)return;
  document.getElementById("scanShot").addEventListener("click",()=>{if(SC.run){SC.run=false;clearTimeout(SC.timer);setRunBtn();scMsg("Paused.");}else if(SC.stream){SC.run=true;setRunBtn();loop();}else startScan();});
  document.getElementById("scanAuto").addEventListener("change",e=>{SC.auto=e.target.checked;scMsg(SC.auto?"Auto-add on: each new card goes straight into the list.":"Auto-add off.");});
  document.getElementById("scanFile").addEventListener("change",e=>{const f=e.target.files&&e.target.files[0];e.target.value="";if(f)scanPhoto(f);});
  P.addEventListener("click",async e=>{const b=e.target.closest("button");if(!b)return;
    if(b.id==="scAdd"||b.id==="scTap")addCopy();
    else if(b.id==="scUndo"){const e2=SC.cur&&SC.cur.entry;if(e2){e2.qty--;if(e2.qty<1)SC.list.splice(SC.list.indexOf(e2),1);syncScanText();renderScanList();renderCurrent();}}
    else if(b.dataset.li){const x=SC.list[+b.dataset.li];if(x){x.qty+=(+b.dataset.d);if(x.qty<1)SC.list.splice(+b.dataset.li,1);syncScanText();renderScanList();renderCurrent();}}
    else if(b.id==="scClear"){if(!await ask("Remove every scanned card from the list?","Clear"))return;SC.list=[];syncScanText();renderScanList();}
    else if(b.id==="scFind"){const n=document.getElementById("scName").value.trim();if(!n)return;const c=await sfJSON("cards/named?fuzzy="+encodeURIComponent(n));if(c){SC.cur=null;onName({name:c.name,from:"en"},c);}}});
  P.addEventListener("change",e=>{if(e.target.id!=="scPrint"||!SC.cur||!SC.cur.prints)return;const p=SC.cur.prints[+e.target.value];if(p)applyCard(p,true);});})();
let imWasOpen=false;new MutationObserver(()=>{const o=imM.classList.contains("open");if(!o){stopScan();SC.mode=null;scanCls(false);}if(o&&!imWasOpen){setImTab(SC.openScan?"scan":"text");SC.openScan=false;setTimeout(imPreview,0);}scanCls(o&&SC.mode==="scan");imWasOpen=o;}).observe(imM,{attributes:true,attributeFilter:["class"]});
