<script>
/*CONFIG*/const NS="cmdr-tool";const SEED=null;/*/CONFIG*/
/* ---------- storage helpers ---------- */
const lsGet=k=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):null}catch(e){return null}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}};
/* ---------- theme: custom colors with a color wheel ---------- */
const TH_ROLES=[["bg","Page background"],["card","Cards"],["ink","Text"],["accent","Accent"],["a2","Second accent"],["a3","Soft accent"],["top","Navigation"],["have","Owned"],["proxy","To proxy"],["buy","To buy"]];
const TH_PRESETS={
  sunset:{name:"Sunset",bg:"#f0eeeb",card:"#ffffff",ink:"#13181b",accent:"#e8745e",a2:"#ffbf65",a3:"#ccd5da",top:"#13181b",have:"#003a6c",proxy:"#d9952b",buy:"#e0603f"},
  spring:{name:"Spring",bg:"#f6f7ed",card:"#ffffff",ink:"#001f3f",accent:"#00804c",a2:"#dbe64c",a3:"#74c365",top:"#001f3f",have:"#00804c",proxy:"#8c9a14",buy:"#1e488f"},
  desk:{name:"Desk",bg:"#efe8dc",card:"#fffdf9",ink:"#16130f",accent:"#e2611b",a2:"#f2b35a",a3:"#c9d6df",top:"#16130f",have:"#2f6f45",proxy:"#b7791f",buy:"#d0461a"},
  midnight:{name:"Midnight",bg:"#0d1117",card:"#161c25",ink:"#eef1ed",accent:"#dbe64c",a2:"#1e488f",a3:"#74c365",top:"#000000",have:"#74c365",proxy:"#ffbf65",buy:"#fd8973"},
  night:{name:"Night",bg:"#11100e",card:"#1d1b18",ink:"#f1e9dc",accent:"#f07a33",a2:"#ffbf65",a3:"#5b6b7a",top:"#000000",have:"#6fb487",proxy:"#e0a64a",buy:"#f0724a"},
  dragon:{name:"Dragon",bg:"#1a1412",card:"#241c19",ink:"#f3e6cf",accent:"#d9a441",a2:"#e0603c",a3:"#6b4a3a",top:"#0f0b0a",have:"#7fae6b",proxy:"#d9a441",buy:"#e0603c"},
  ocean:{name:"Ocean",bg:"#e6edf1",card:"#ffffff",ink:"#0f1d26",accent:"#0f7c9c",a2:"#8fd3c8",a3:"#c9dbe6",top:"#0f1d26",have:"#2f7a5a",proxy:"#b8862b",buy:"#c4533a"}
};
const hex2rgb=h=>{h=h.replace("#","");if(h.length===3)h=h.split("").map(c=>c+c).join("");const n=parseInt(h,16);return [n>>16&255,n>>8&255,n&255];};
const rgb2hex=(r,g,b)=>"#"+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,"0")).join("");
const mixC=(a,b,t)=>{const A=hex2rgb(a),B=hex2rgb(b);return rgb2hex(A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,A[2]+(B[2]-A[2])*t);};
const lum=h=>{const c=hex2rgb(h).map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);});return .2126*c[0]+.7152*c[1]+.0722*c[2];};
const contrast=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
const inkOn=h=>contrast(h,"#ffffff")>=contrast(h,"#16130f")?"#ffffff":"#16130f";
function hsv2hex(h,s,v){const f=n=>{const k=(n+h/60)%6;return v-v*s*Math.max(0,Math.min(k,4-k,1));};return rgb2hex(f(5)*255,f(3)*255,f(1)*255);}
function hex2hsv(hx){const [r,g,b]=hex2rgb(hx).map(x=>x/255);const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;let h=0;
  if(d){if(mx===r)h=((g-b)/d)%6;else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;if(h<0)h+=360;}return [h,mx?d/mx:0,mx];}
function themeVars(t){
  const dark=lum(t.bg)<.18;const a2=t.a2||mixC(t.accent,"#ffd27a",.55),a3=t.a3||mixC(t.card,t.ink,.18);
  return {"--bg":t.bg,"--card":t.card,"--ink":t.ink,"--accent":t.accent,"--top":t.top,"--top-ink":inkOn(t.top),
    "--paper":mixC(t.card,t.bg,.45),"--head":mixC(t.card,t.bg,.6),"--line":mixC(t.card,t.ink,.12),"--line2":mixC(t.card,t.ink,.22),
    "--muted":mixC(t.ink,t.card,.42),"--accent-soft":mixC(t.card,t.accent,dark?.22:.14),"--accent-ink":inkOn(t.accent),
    "--alt":t.accent,"--focus":t.accent,"--have":t.have,"--proxy":t.proxy,"--buy":t.buy,"--warn":t.buy,
    "--a2":a2,"--a3":a3,"--tile-1":t.accent,"--tile-1-ink":inkOn(t.accent),"--tile-2":t.top,"--tile-2-ink":inkOn(t.top),"--tile-3":a2,"--tile-3-ink":inkOn(a2),"--tile-4":a3,"--tile-4-ink":inkOn(a3),
    "--nav":t.top,"--nav-ink":inkOn(t.top),"--have-ink":inkOn(t.have),"--proxy-ink":inkOn(t.proxy),"--buy-ink":inkOn(t.buy),"--alt-ink":inkOn(t.accent),"color-scheme":dark?"dark":"light"};
}
let THEME=lsGet(NS+"-theme");
function applyTheme(){const R=document.documentElement;
  Object.keys(themeVars(TH_PRESETS.desk)).forEach(k=>R.style.removeProperty(k));
  if(!THEME)return;const v=themeVars(THEME);for(const k in v)R.style.setProperty(k,v[k]);}
applyTheme();
let DECKS=lsGet(NS+"-decks");
if(!DECKS||!DECKS.list)DECKS={current:null,list:{}};
const saveDecks=()=>{if(!lsSet(NS+"-decks",DECKS))flash("Browser storage is full: the deck could not be saved.");};
if(SEED&&!DECKS.seeded){DECKS.list[SEED.id]=JSON.parse(JSON.stringify(SEED.deck));DECKS.seeded=true;if(!DECKS.current)DECKS.current=SEED.id;saveDecks();}
if(DECKS.current&&!DECKS.list[DECKS.current])DECKS.current=Object.keys(DECKS.list)[0]||null;
function stateKey(id){return (SEED&&id===SEED.id&&SEED.legacyKey)?SEED.legacyKey:NS+"-state-"+id;}
function seedFor(id){
  if(SEED&&id===SEED.id)return JSON.parse(JSON.stringify(SEED.state));
  const d=DECKS.list[id],s={};const P=d&&d.prints||{};for(const k in P)s[k]={print:P[k]};return s;
}
function loadState(id){return lsGet(stateKey(id))||seedFor(id);}
const CUR=DECKS.current?DECKS.list[DECKS.current]:null;
const DECK=CUR?CUR.deck:[];
const QTY=CUR&&CUR.qty||{};
const q=n=>QTY[n]||1;
const CMDS=new Set(CUR&&CUR.cmd||[]);
const NEW=new Set(CUR&&CUR.newTags||[]);
function seed(){return CUR?seedFor(DECKS.current):{};}
const KEY=stateKey(DECKS.current||"none");
let state=CUR?loadState(DECKS.current):{};
const save=()=>{lsSet(KEY,state);};
window.addEventListener("storage",e=>{if(e.key===KEY||e.key===NS+"-decks")location.reload();});
const BASICS=new Set(["plains","island","swamp","mountain","forest","wastes"]);
const norm=s=>s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g,"").replace(/[’`]/g,"'").replace(/\s+/g," ").trim();
/* make an alternative the real card: the original name leaves the deck */
function promoteIn(d,S,name){const v=S[name];if(!v||!v.alt||!v.altName||!v.altName.trim())return false;
  const alt=v.altName.trim();let exists=null;d.deck.forEach(([,c])=>c.forEach(n=>{if(norm(n)===norm(alt))exists=n;}));
  const qn=(d.qty||{})[name]||1;
  if(exists&&exists!==name){d.qty=d.qty||{};d.qty[exists]=((d.qty[exists])||1)+qn;d.deck.forEach(x=>{const i=x[1].indexOf(name);if(i>=0)x[1].splice(i,1);});}
  else d.deck.forEach(x=>{const i=x[1].indexOf(name);if(i>=0){x[1][i]=alt;x[1].sort((a,b)=>a.localeCompare(b));}});
  if(d.qty&&d.qty[name]!=null){if(!exists)d.qty[alt]=d.qty[name];delete d.qty[name];}
  ["cmd","newTags","lands"].forEach(f=>{if(Array.isArray(d[f]))d[f]=d[f].map(n=>n===name?alt:n).filter((n,i,a)=>a.indexOf(n)===i);});
  if(d.prevCat&&d.prevCat[name]){d.prevCat[alt]=d.prevCat[name];delete d.prevCat[name];}
  if(!exists||exists===name){const nv={};if(v.altS==="p")nv.p=true;else if(v.altS==="m")nv.m=true;else{nv.f=true;nv.t=v.at||Date.now();}
    if(v.altPrint)nv.print=v.altPrint;S[alt]=nv;}
  delete S[name];d.src=null;return true;}
/* one-time updates shipped with the file (e.g. cards that arrived): applied once per deck, then never again */
function applyDeckPatch(id,P,isSeed){const d=DECKS.list[id];if(!d)return 0;let changed=0;
  const isCur=DECKS.current===id,S=isCur?state:loadState(id),now=Date.now();
  const names=new Set();d.deck.forEach(([,cards])=>cards.forEach(n=>names.add(n)));
  if(P.swap){P.swap.forEach(([o,n,cat])=>{let hit=false;const has=names.has(n);
    d.deck.forEach(x=>{const i=x[1].indexOf(o);if(i<0)return;hit=true;if(has||cat)x[1].splice(i,1);else x[1][i]=n;});
    if(!hit)return;
    if(cat&&!has){let c=d.deck.find(x=>x[0]===cat);if(!c){c=[cat,[]];d.deck.push(c);}c[1].push(n);c[1].sort((a,b)=>a.localeCompare(b));}
    for(let k=d.deck.length-1;k>=0;k--)if(!d.deck[k][1].length)d.deck.splice(k,1);
    ["cmd","newTags"].forEach(f=>{if(Array.isArray(d[f]))d[f]=d[f].map(v=>v===o?n:v).filter((v,i,a)=>a.indexOf(v)===i);});
    if(Array.isArray(d.lands))d.lands=cat?d.lands.filter(v=>v!==o):d.lands.map(v=>v===o?n:v).filter((v,i,a)=>a.indexOf(v)===i);
    if(d.qty&&d.qty[o]){if(!has)d.qty[n]=d.qty[o];delete d.qty[o];}if(d.prints)delete d.prints[o];delete S[o];names.delete(o);names.add(n);changed++;});}
  if(P.promoteAlts){Object.keys(S).forEach(n=>{if(names.has(n)&&promoteIn(d,S,n))changed++;});}
  (P.owned||[]).forEach(x=>{
    const viaAlt=[...names].find(n=>{const v=S[n];return v&&v.alt&&v.altName&&norm(v.altName)===norm(x);});
    if(viaAlt){const v=S[viaAlt];if(v.altS!=="f"){v.altS="f";v.at=now;changed++;}return;}
    if(names.has(x)){const v=S[x]||(S[x]={});if(!(v.f&&!v.alt)){v.f=true;v.p=false;v.m=false;v.alt=false;v.t=now;changed++;}}
  });
  lsSet(stateKey(id),S);if(isCur)Object.assign(state,S);
  if(P.note&&changed)try{sessionStorage.setItem(NS+"-msg",((sessionStorage.getItem(NS+"-msg")||"")+" "+P.note.replace("{n}",changed)).trim())}catch(e){}
  return changed;}
(function(){if(!SEED||!SEED.patches||!DECKS.list[SEED.id])return;DECKS.patches=DECKS.patches||[];
  SEED.patches.forEach(P=>{if(DECKS.patches.includes(P.id))return;applyDeckPatch(SEED.id,P,true);DECKS.patches.push(P.id);});
  saveDecks();})();
/* updates for Luca's Ur-Dragon list, wherever it lives: the seeded deck in his file, or the copy added online from the deck link */
const DECK_PATCHES=[
  {id:"2026-10-30-swaps",match:"ur-dragon",swap:[["Crumbling Necropolis","Tireless Provisioner","Ramp"],["Dragon's Hoard","Sarkhan, Dragon Ascendant","Ramp"]],owned:["Tireless Provisioner","Sarkhan, Dragon Ascendant"],
   note:"Deck updated: Tireless Provisioner in for Crumbling Necropolis, Sarkhan, Dragon Ascendant in for Dragon's Hoard, both marked Owned."}];
(function(){let any=false;
  Object.keys(DECKS.list).forEach(id=>{const d=DECKS.list[id];
    const isUr=(SEED&&id===SEED.id&&SEED.id==="ur")||d.from==="ur-dragon";if(!isUr)return;
    d.patchesDone=d.patchesDone||[];
    DECK_PATCHES.forEach(P=>{if(d.patchesDone.includes(P.id))return;applyDeckPatch(id,P,false);d.patchesDone.push(P.id);any=true;});});
  if(any)saveDecks();})();
const deckIndex=new Map();
DECK.forEach(([cat,cards])=>cards.forEach(n=>{deckIndex.set(norm(n),{name:n,cat});if(n.includes(" // "))n.split(" // ").forEach(x=>deckIndex.set(norm(x),{name:n,cat}));}));
const TOTAL=Math.max(1,DECK.reduce((a,[,c])=>a+c.reduce((x,n)=>x+q(n),0),0));
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let flashT=null;
function flash(msg){const p=document.getElementById("imMsg");if(!p)return;p.textContent=msg;clearTimeout(flashT);flashT=setTimeout(()=>{p.textContent="";},7000);}
/* in-page confirmation */
function ask(text,yes){const m=document.getElementById("confirmModal");document.getElementById("cfText").textContent=text;
  document.getElementById("cfYes").textContent=yes||"Confirm";m.classList.add("open");
  return new Promise(res=>{const done=v=>{m.classList.remove("open");y.removeEventListener("click",ok);n.removeEventListener("click",no);res(v);};
    const y=document.getElementById("cfYes"),n=document.getElementById("cfNo"),ok=()=>done(true),no=()=>done(false);
    y.addEventListener("click",ok);n.addEventListener("click",no);y.focus();});}

/* classification: have | proxy | buy | u */
function clsOf(s){
  s=s||{};
  if(s.alt&&s.altName&&s.altName.trim()){return s.altS==="p"?"proxy":s.altS==="m"?"buy":"have";}
  if(s.f) return "have";
  if(s.p) return "proxy";
  if(s.m) return "buy";
  return "u";
}
function st(n){return state[n]||{}}
function cls(n){return clsOf(st(n));}
function name2(r){return finalName(r.name);}
function finalName(n){const s=st(n);return (s.alt&&s.altName&&s.altName.trim())?s.altName.trim():n;}
const STATUS={have:"Owned",proxy:"To proxy",buy:"To buy",u:"Undecided"};
const SCOL={have:"var(--have)",proxy:"var(--proxy)",buy:"var(--buy)",u:"var(--line2)"};

/* images */
const imgFor=(name,print)=>print&&print.img?print.img:"https://api.scryfall.com/cards/named?exact="+encodeURIComponent(name)+"&format=image&version=normal";

const ctURL=n=>"https://www.cardtrader.com/en/search?q="+encodeURIComponent(n.split(" // ")[0]);
const cmSearch=n=>"https://www.cardmarket.com/en/Magic/Products/Search?searchString="+encodeURIComponent(n.split(" // ")[0]);
function shopRow(){const d=document.createElement("div");d.className="shops";
  const ct=document.createElement("a");ct.target="_blank";ct.rel="noopener";ct.textContent="CardTrader";
  const cm=document.createElement("a");cm.target="_blank";cm.rel="noopener";cm.textContent="Cardmarket";
  const info=document.createElement("span");const pr=document.createElement("span");pr.className="price";d.append(pr,ct,cm,info);return {d,ct,cm,info,pr};}
function priceOf(name,print){if(print&&print.eur!=null)return print.eur;const m=(typeof META!=="undefined")&&META[norm(name.split(" // ")[0])];return m&&m.eur!=null?m.eur:null;}
const fmtE=v=>v==null?"no price":"€"+v.toFixed(2);
const fmtE0=v=>"€"+(v||0).toLocaleString("en-GB",{minimumFractionDigits:2,maximumFractionDigits:2});
function setShop(sh,name,print){
  if(!name){sh.d.hidden=true;return;} sh.d.hidden=false;
  sh.ct.href=ctURL(name);
  sh.cm.href=(print&&print.cm)?print.cm:cmSearch(name);
  sh.cm.textContent="Cardmarket";sh.cm.classList.toggle("exact",!!(print&&print.cm));sh.cm.title=(print&&print.cm)?"Link to the chosen printing":"Search by name";
  {const v=priceOf(name,print);sh.pr.textContent=fmtE(v);sh.pr.classList.toggle("hi",v!=null&&v>25);}
  sh.info.textContent=print?((print.setName||print.set.toUpperCase())+" #"+print.cn):"";
}
let filter="all",search="",fCat="",fType="",sortBy=(["name","price","state","cat"].includes(lsGet(NS+"-sort"))?lsGet(NS+"-sort"):"name"),extF=null,extNames=null;
const tbl=document.getElementById("tbl"); const rows=[]; const groups=[];
const cell=c=>{const d=document.createElement("div");d.className=c;return d;};
DECK.forEach(([cat,cards])=>{
  const sec=document.createElement("div");sec.className="grp";
  const h=document.createElement("span");h.textContent=cat;const sm=document.createElement("small");sec.append(h,sm);
  sec._sm=sm;sec._n=cards.reduce((x,n)=>x+q(n),0);sec._cat=cat;groups.push(sec);
  cards.forEach(name=>{
    const li=document.createElement("div");li.className="tr";
    const nb=document.createElement("button");nb.type="button";nb.className="name";nb.textContent=name;
    if(q(name)>1){const t=document.createElement("span");t.className="qty";t.textContent=q(name)+"× ";nb.prepend(t);}
    if(NEW.has(name)){const t=document.createElement("span");t.className="tag";t.textContent="new";nb.appendChild(t);}
    bindPreview(nb,()=>({name,print:st(name).print}));
    nb.setAttribute("aria-haspopup","menu");nb.addEventListener("click",e=>{e.stopPropagation();openCardMenu(name,nb);});
    if(CMDS.has(name)){const t=document.createElement("span");t.className="tag cmdtag";t.textContent="commander";nb.appendChild(t);}
    const cCat=cell("c-cat");cCat.textContent=cat;
    const cState=cell("c-state");const chip=document.createElement("button");chip.type="button";chip.className="stchip";
    chip.addEventListener("click",e=>{e.stopPropagation();openCardMenu(name,chip);});cState.appendChild(chip);
    const opts=document.createElement("div");opts.className="opts";
    const mk=(k,lbl)=>{const b=document.createElement("button");b.type="button";b.className="opt "+k;
      b.innerHTML='<span class="dot"></span><span></span>';b.lastChild.textContent=lbl;b.setAttribute("aria-label",name+": "+lbl.toLowerCase());
      b.addEventListener("click",()=>toggle(name,k));return b;};
    const btn={f:mk("f","Owned"),p:mk("p","Proxy"),m:mk("m","Missing"),a:mk("a","Alternative")};
    Object.values(btn).forEach(b=>opts.appendChild(b));cState.appendChild(opts);
    const cPrint=cell("c-print");
    const pr=document.createElement("button");pr.type="button";pr.className="print";pr.textContent="Printing";
    pr.addEventListener("click",()=>openPrints(name,false));
    const sh=shopRow();sh.info.className="info";cPrint.append(pr,sh.info);
    const cPrice=cell("c-price");cPrice.appendChild(sh.pr);
    const cShop=cell("c-shop");cShop.append(sh.ct,sh.cm);
    const box=document.createElement("div");box.className="altbox";
    const lab=document.createElement("label");lab.textContent="Replace with:";
    const inp=document.createElement("input");inp.type="text";inp.placeholder="Alternative card name";inp.setAttribute("aria-label","Alternative to "+name);
    lab.htmlFor=inp.id="alt"+rows.length;
    inp.value=st(name).altName||"";
    inp.addEventListener("input",()=>{const s=state[name]||(state[name]={});s.altName=inp.value;s.alt=true;save();update();});
    const aopts=document.createElement("div");aopts.className="opts";
    const amk=(k,lbl)=>{const b=document.createElement("button");b.type="button";b.className="opt "+k;
      b.innerHTML='<span class="dot"></span><span></span>';b.lastChild.textContent=lbl;
      b.addEventListener("click",()=>{const s=state[name]||(state[name]={});s.altS=k;if(k==="f")s.at=Date.now();else delete s.at;save();update();});return b;};
    const abtn={f:amk("f","Have it"),p:amk("p","To proxy"),m:amk("m","To buy")};
    Object.values(abtn).forEach(b=>aopts.appendChild(b));
    const apr=document.createElement("button");apr.type="button";apr.className="print";apr.textContent="View / printing";
    apr.addEventListener("click",()=>{if(inp.value.trim())openPrints(name,true);});
    bindPreview(apr,()=>({name:inp.value.trim(),print:st(name).altPrint}));
    aopts.appendChild(apr);
    const keep=document.createElement("button");keep.type="button";keep.className="print keepalt";keep.textContent="Keep it, drop "+name;
    keep.addEventListener("click",async()=>{const s2=st(name);if(!s2.altName||!s2.altName.trim())return;
      if(!await ask("Replace "+name+" with "+s2.altName.trim()+" for good? The alternative becomes the card in the list, with its status and printing.","Replace"))return;
      promoteIn(CUR,state,name);save();deckChanged(s2.altName.trim());});
    aopts.appendChild(keep);
    const warn=document.createElement("p");warn.className="warn";warn.setAttribute("role","status");
    box.append(lab,inp,aopts,warn);
    const ash=shopRow(); box.appendChild(ash.d);
    const cName=cell("c-name");const cb=document.createElement("input");cb.type="checkbox";cb.className="selbox";cb.setAttribute("aria-label","Select "+name);
    cb.addEventListener("change",()=>{if(cb.checked)SEL.add(name);else SEL.delete(name);syncSel();});cName.append(cb,nb);
    li.append(cName,cCat,cState,cPrint,cPrice,cShop,box);
    rows.push({name,cat,li,btn,abtn,inp,warn,sec,pr,apr,sh,ash,cb,chip});
  });
});
{const sel=document.getElementById("fCat");DECK.forEach(([cat])=>{const o=document.createElement("option");o.value=cat;o.textContent=cat;sel.appendChild(o);});}
const ORD={u:0,buy:1,proxy:2,have:3};
function rowPrint(r){const s=st(r.name);const alt=s.alt&&s.altName&&s.altName.trim();return alt?s.altPrint:s.print;}
function rowPrice(r){return priceOf(finalName(r.name),rowPrint(r));}
/* blocks by card type */
const TYPE_BLOCKS=[["Commander","Commander"],["Creature","Creatures"],["Planeswalker","Planeswalkers"],["Instant","Instants"],["Sorcery","Sorceries"],["Artifact","Artifacts"],["Enchantment","Enchantments"],["Battle","Battles"],["Land","Lands"],["Other","Other"],["Unknown","Loading card data…"]];
const typeHeads={};
function typeHead(k){if(typeHeads[k])return typeHeads[k];const d=document.createElement("div");d.className="grp tgrp";
  const lab=(TYPE_BLOCKS.find(t=>t[0]===k)||[k,k])[1];const cb=document.createElement("input");cb.type="checkbox";cb.className="selbox";cb.setAttribute("aria-label","Select all "+lab);
  cb.addEventListener("change",()=>{rows.forEach(r=>{if(!r.li.hidden&&rowType(r)===k){if(cb.checked)SEL.add(r.name);else SEL.delete(r.name);}});syncSel();});
  const fb=document.createElement("button");fb.type="button";fb.className="fold";fb.innerHTML='<span class="chev" aria-hidden="true"></span>';fb.append(lab);fb.setAttribute("aria-label","Show or hide "+lab);
  fb.addEventListener("click",()=>{if(FOLD.has(k))FOLD.delete(k);else FOLD.add(k);lsSet(NS+"-fold",[...FOLD]);arrange();});
  const h=document.createElement("span");h.className="gtitle";h.append(cb,fb);const sm=document.createElement("small");d.append(h,sm);d._sm=sm;d._cb=cb;d._k=k;d._fb=fb;return typeHeads[k]=d;}
const FOLD=new Set(lsGet(NS+"-fold")||[]);
/* ---------- list views: detailed / compact, folding ---------- */
function setListView(t,v){const el=document.getElementById(t==="deck"?"tbl":"ctbl");el.classList.toggle("compact",v==="compact");lsSet(NS+"-view-"+t,v);
  document.querySelectorAll('.seg2[data-for="'+t+'"] button').forEach(b=>b.setAttribute("aria-pressed",b.dataset.v===v));}
document.querySelectorAll(".seg2").forEach(g=>g.addEventListener("click",e=>{const b=e.target.closest("button[data-v]");if(b)setListView(g.dataset.for,b.dataset.v);}));
["deck","coll"].forEach(t=>setListView(t,lsGet(NS+"-view-"+t)||(window.innerWidth<640?"compact":"full")));
document.getElementById("foldAll").addEventListener("click",()=>{const ks=[...new Set(rows.map(rowType))];const all=ks.every(k=>FOLD.has(k));
  ks.forEach(k=>all?FOLD.delete(k):FOLD.add(k));lsSet(NS+"-fold",[...FOLD]);arrange();});
/* ---------- multi-select and bulk marking ---------- */
const SEL=new Set();
function syncSel(){
  rows.forEach(r=>{if(r.li.hidden)SEL.delete(r.name);r.cb.checked=SEL.has(r.name);r.li.classList.toggle("sel",SEL.has(r.name));});
  const vis=rows.filter(r=>!r.li.hidden),all=document.getElementById("selAll");
  all.checked=vis.length>0&&vis.every(r=>SEL.has(r.name));all.indeterminate=!all.checked&&vis.some(r=>SEL.has(r.name));
  Object.values(typeHeads).forEach(h=>{const L=vis.filter(r=>rowType(r)===h._k);h._cb.checked=L.length>0&&L.every(r=>SEL.has(r.name));h._cb.indeterminate=!h._cb.checked&&L.some(r=>SEL.has(r.name));});
  const bar=document.getElementById("bulkBar");bar.hidden=!SEL.size;document.getElementById("bulkCount").textContent=SEL.size+(SEL.size===1?" card selected":" cards selected");
}
function setStatusOne(n,k,now){const s=state[n]||(state[n]={});const alt=s.alt&&s.altName&&s.altName.trim();
  if(alt){if(k==="u"){s.alt=false;}else{s.altS=k;if(k==="f")s.at=now;else delete s.at;}return;}
  s.f=k==="f";s.p=k==="p";s.m=k==="m";s.alt=false;if(k==="f")s.t=now;else delete s.t;}
function bulkMark(k){const now=Date.now();SEL.forEach(n=>setStatusOne(n,k,now));save();update();}
document.getElementById("selAll").addEventListener("change",e=>{rows.forEach(r=>{if(!r.li.hidden){if(e.target.checked)SEL.add(r.name);else SEL.delete(r.name);}});syncSel();});
document.getElementById("bulkBar").addEventListener("click",e=>{const b=e.target.closest("[data-b]");if(!b)return;
  if(b.dataset.b==="x"){SEL.clear();syncSel();return;}const n=SEL.size;bulkMark(b.dataset.b);
  const lab={f:"Owned",p:"Proxy",m:"Missing",u:"Undecided"}[b.dataset.b];SEL.clear();syncSel();flash(n+(n===1?" card":" cards")+" marked as "+lab+".");});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&SEL.size&&!document.querySelector(".modal.open")){SEL.clear();syncSel();}});
function rowType(r){if(CMDS.has(r.name))return "Commander";const m=META[norm(front(finalName(r.name)))];
  if(m&&m.type)return mainType(m.type);if(LANDS.has(r.name)&&!st(r.name).alt)return "Land";return "Unknown";}
function placeAll(seq){const cur=[...tbl.children].filter(e=>e.classList.contains("tr")||e.classList.contains("grp"));
  if(cur.length===seq.length&&cur.every((e,i)=>e===seq[i]))return;
  const y=window.scrollY;const frag=document.createDocumentFragment();seq.forEach(e=>frag.appendChild(e));tbl.appendChild(frag);
  if(Math.abs(window.scrollY-y)>1)window.scrollTo(0,y);}
function arrange(){
  const SEQ=[];const add=e=>SEQ.push(e);
  arrange0(add);
  /* headers that are not part of this view stay in the DOM but hidden */
  groups.concat(Object.values(typeHeads)).forEach(g=>{if(!SEQ.includes(g))SEQ.push(g);});
  placeAll(SEQ);
}
function arrange0(append){
  /* always in blocks by card type; the sort applies inside each block */
  tbl.classList.remove("bycat");
  groups.forEach(g=>g.classList.add("hidden"));Object.values(typeHeads).forEach(h=>h.classList.add("hidden"));
  const nameS=(a,b)=>finalName(a.name).localeCompare(finalName(b.name));
  const cmp={name:nameS,
    price:(a,b)=>{const x=rowPrice(a),y=rowPrice(b);return ((y==null?-1:y)-(x==null?-1:x))||nameS(a,b);},
    state:(a,b)=>ORD[cls(a.name)]-ORD[cls(b.name)]||nameS(a,b),
    cat:(a,b)=>{const ia=DECK.findIndex(d=>d[0]===a.cat),ib=DECK.findIndex(d=>d[0]===b.cat);return ia-ib||nameS(a,b);}}[sortBy]||nameS;
  const by={};rows.forEach(r=>{const k=rowType(r);(by[k]=by[k]||[]).push(r);});
  TYPE_BLOCKS.forEach(([k])=>{const L=by[k];if(!L)return;const h=typeHead(k);
    const tot=L.reduce((a,r)=>a+q(r.name),0),own=L.reduce((a,r)=>a+(cls(r.name)==="have"?q(r.name):0),0),vis=L.filter(r=>!r.li.hidden).length;
    h._sm.textContent=own+" / "+tot+" owned";h.classList.toggle("hidden",!vis);const f=FOLD.has(k);h.classList.toggle("folded",f);h._fb.setAttribute("aria-expanded",!f);append(h);
    L.sort(cmp).forEach(r=>{r.li.classList.toggle("folded",f);append(r.li);});});
  const fa=document.getElementById("foldAll");if(fa){const ks=Object.keys(by);fa.textContent=ks.length&&ks.every(k=>FOLD.has(k))?"Expand all":"Collapse all";}
}
function matches(r,k,s){
  if(extNames&&!extNames.has(r.name))return false;
  if(!(filter==="all"||(filter==="alt"?!!s.alt:filter===k)))return false;
  if(fCat&&r.cat!==fCat)return false;
  if(fType&&rowType(r)!==fType)return false;
  if(search){const t=norm(search);if(!norm(r.name).includes(t)&&!(s.altName&&norm(s.altName).includes(t)))return false;}
  return true;
}
function setFilter(f){filter=f;document.getElementById("fState").value=f;update();}
document.getElementById("fQ").addEventListener("input",e=>{search=e.target.value.trim();update();});
document.getElementById("fCat").addEventListener("change",e=>{fCat=e.target.value;update();});
document.getElementById("fState").addEventListener("change",e=>setFilter(e.target.value));
document.getElementById("fSort").value=sortBy;
document.getElementById("fSort").addEventListener("change",e=>{sortBy=e.target.value;lsSet(NS+"-sort",sortBy);update();});
document.getElementById("fType").addEventListener("change",e=>{fType=e.target.value;update();});
document.getElementById("fReset").addEventListener("click",()=>{extF=null;search="";fCat="";fType="";sortBy="name";lsSet(NS+"-sort",sortBy);document.getElementById("fQ").value="";document.getElementById("fCat").value="";document.getElementById("fType").value="";document.getElementById("fSort").value="name";setFilter("all");});
function goRow(name){const r=rows.find(x=>x.name===name);if(!r)return;if(r.li.hidden){search="";fCat="";document.getElementById("fQ").value="";document.getElementById("fCat").value="";setFilter("all");}
  r.li.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"center"});r.li.classList.remove("flash");void r.li.offsetWidth;r.li.classList.add("flash");}
function toggle(name,k){
  const s=state[name]||(state[name]={});
  if(k==="a"){s.alt=!s.alt;if(s.alt&&!s.altS)s.altS="f";if(s.alt){s.f=s.p=s.m=false;delete s.t;if(s.altS==="f"&&!s.at)s.at=Date.now();}}
  else if(k==="f"){s.f=!s.f;if(s.f){s.p=s.m=false;s.alt=false;s.t=Date.now();}else delete s.t;}
  else{ s[k]=!s[k]; if(s[k]){s.f=false;s.alt=false;delete s.t;} }
  save();update();
  if(k==="a"&&s.alt){const r=rows.find(r=>r.name===name);r&&r.inp.focus();}
}
/* ---------- card menu: commander, category, quantity, removal ---------- */
const cmenu=document.getElementById("cmenu");let cmName=null,cmAnchor=null;
function catOf(name){const c=DECK.find(([,cards])=>cards.includes(name));return c?c[0]:null;}
function deckChanged(focus){CUR.src=null;saveDecks();
  try{sessionStorage.setItem(NS+"-focus",JSON.stringify({name:focus||null,y:window.scrollY}))}catch(e){}
  lsSet(NS+"-view","deck");history.replaceState(null,"","#deck");location.reload();}
function removeFromCats(name){DECK.forEach(d=>{const i=d[1].indexOf(name);if(i>=0)d[1].splice(i,1);});
  for(let i=DECK.length-1;i>=0;i--)if(!DECK[i][1].length)DECK.splice(i,1);}
function addToCat(name,cat,top){let c=DECK.find(d=>d[0]===cat);
  if(!c){c=[cat,[]];if(top)DECK.unshift(c);else{const li=DECK.findIndex(d=>/^(lands|terre)$/i.test(d[0]));if(li>=0)DECK.splice(li,0,c);else DECK.push(c);}}
  c[1].push(name);c[1].sort((a,b)=>a.localeCompare(b));}
function guessCat(name){const m=META[norm(front(name))];if(m&&m.type&&typeof typeCat==="function")return typeCat(m.type);return "Other";}
const CMD_CAT=()=>{const c=DECK.find(d=>/^(commander|comandante)s?$/i.test(d[0]));return c?c[0]:"Commander";};
function setCommander(name,on){CUR.cmd=CUR.cmd||[];CUR.prevCat=CUR.prevCat||{};
  if(on){const from=catOf(name);if(from&&from!==CMD_CAT())CUR.prevCat[name]=from;removeFromCats(name);addToCat(name,CMD_CAT(),true);if(!CUR.cmd.includes(name))CUR.cmd.push(name);}
  else{CUR.cmd=CUR.cmd.filter(n=>n!==name);const back=CUR.prevCat[name]||guessCat(name);delete CUR.prevCat[name];removeFromCats(name);addToCat(name,back);}
  deckChanged(name);}
function closeCardMenu(){cmenu.hidden=true;cmName=null;if(cmAnchor){cmAnchor.setAttribute("aria-expanded","false");cmAnchor=null;}}
function openCardMenu(name,anchor){
  if(cmName===name&&!cmenu.hidden){closeCardMenu();return;}
  pv.style.display="none";cmName=name;cmAnchor=anchor;anchor.setAttribute("aria-expanded","true");
  const isCmd=CMDS.has(name),cat=catOf(name),n=q(name),s=st(name);
  const cats=DECK.map(d=>d[0]).filter(c=>c!==cat);
  cmenu.innerHTML='<div class="cmh"><b></b><small></small></div>'+
    '<div class="cmst" role="group" aria-label="Status">'+[["f","Owned","have"],["p","Proxy","proxy"],["m","Missing","buy"],["u","Undecided","u"]].map(([k2,l,c])=>'<button type="button" data-a="st" data-k="'+k2+'" class="'+c+'" aria-pressed="'+(cls(name)===c)+'">'+l+'</button>').join("")+'</div>'+
    '<button type="button" role="menuitem" data-a="view">View card</button>'+
    '<button type="button" role="menuitem" data-a="cmd">'+(isCmd?"Remove as commander":"Set as commander")+'</button>'+
    '<button type="button" role="menuitem" data-a="print">Change printing…</button>'+
    (s.alt&&s.altName&&s.altName.trim()?'<button type="button" role="menuitem" data-a="promote">Replace for good with '+esc(s.altName.trim())+'</button>':'')+
    '<div class="cmrow"><span>Quantity</span><span class="qctl"><button type="button" data-a="qm" aria-label="One less">−</button><b>'+n+'</b><button type="button" data-a="qp" aria-label="One more">+</button></span></div>'+
    '<label class="cmrow cmmove"><span>Move to</span><select data-a="move"><option value="">Choose a category</option>'+cats.map(c=>'<option>'+esc(c)+'</option>').join("")+'<option value="__new">New category…</option></select></label>'+
    '<div class="cmnew" hidden><input type="text" placeholder="Category name" aria-label="New category name"><button type="button" data-a="newcat" class="btn-acc">Move</button></div>'+
    '<div class="cmlinks"><a target="_blank" rel="noopener" data-l="sf">Scryfall</a><a target="_blank" rel="noopener" data-l="cm">Cardmarket</a><a target="_blank" rel="noopener" data-l="ct">CardTrader</a></div>'+
    '<button type="button" role="menuitem" data-a="del" class="danger">Remove from deck</button>';
  cmenu.querySelector(".cmh b").textContent=name;cmenu.querySelector(".cmh small").textContent=(cat||"")+(s.alt&&s.altName?" · replaced by "+s.altName:"");
  const fn=finalName(name);
  cmenu.querySelector('[data-l="sf"]').href="https://scryfall.com/search?q="+encodeURIComponent('!"'+front(fn)+'"');
  cmenu.querySelector('[data-l="cm"]').href=(s.print&&s.print.cm)||cmSearch(fn);
  cmenu.querySelector('[data-l="ct"]').href=ctURL(fn);
  cmenu.hidden=false;
  const r=anchor.getBoundingClientRect(),mw=cmenu.offsetWidth,mh=cmenu.offsetHeight;
  let x=Math.min(r.left,innerWidth-mw-8),y=r.bottom+6;if(y+mh>innerHeight-8)y=Math.max(8,r.top-mh-6);
  cmenu.style.left=Math.max(8,x)+"px";cmenu.style.top=y+"px";
  cmenu.querySelector('[role="menuitem"]').focus();
}
cmenu.addEventListener("click",async e=>{const b=e.target.closest("[data-a]");if(!b||b.tagName==="SELECT")return;const name=cmName,a=b.dataset.a;
  if(a==="st"){const k2=b.dataset.k;closeCardMenu();setStatusOne(name,k2,Date.now());save();update();return;}
  if(a==="view"){closeCardMenu();fill(sheet,{name,print:st(name).print});sheet.classList.add("open");}
  if(a==="cmd"){closeCardMenu();setCommander(name,!CMDS.has(name));}
  if(a==="print"){closeCardMenu();openPrints(name,false);}
  if(a==="promote"){closeCardMenu();const alt=st(name).altName.trim();promoteIn(CUR,state,name);save();deckChanged(alt);}
  if(a==="qm"||a==="qp"){const v=Math.max(1,Math.min(99,q(name)+(a==="qp"?1:-1)));CUR.qty=CUR.qty||{};if(v===1)delete CUR.qty[name];else CUR.qty[name]=v;b.parentElement.querySelector("b").textContent=v;cmenu.dataset.dirty="1";}
  if(a==="newcat"){const v=cmenu.querySelector(".cmnew input").value.trim();if(!v)return;closeCardMenu();removeFromCats(name);addToCat(name,v);deckChanged(name);}
  if(a==="del"){closeCardMenu();if(!await ask("Remove "+name+" from "+CUR.name+"? Its marks are kept if you add it back later.","Remove"))return;
    removeFromCats(name);if(CUR.qty)delete CUR.qty[name];if(CUR.cmd)CUR.cmd=CUR.cmd.filter(n=>n!==name);deckChanged(null);}
});
cmenu.addEventListener("change",e=>{if(e.target.dataset.a!=="move")return;const v=e.target.value;
  if(v==="__new"){const box=cmenu.querySelector(".cmnew");box.hidden=false;box.querySelector("input").focus();return;}
  if(!v)return;const name=cmName;closeCardMenu();removeFromCats(name);addToCat(name,v);deckChanged(name);});
cmenu.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.closest(".cmnew")){cmenu.querySelector('[data-a="newcat"]').click();}});
document.addEventListener("click",e=>{if(!cmenu.hidden&&!cmenu.contains(e.target)){const dirty=cmenu.dataset.dirty;const name=cmName;delete cmenu.dataset.dirty;closeCardMenu();if(dirty)deckChanged(name);}});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!cmenu.hidden){const dirty=cmenu.dataset.dirty,name=cmName;delete cmenu.dataset.dirty;closeCardMenu();if(dirty)deckChanged(name);else{const r=rows.find(x=>x.name===name);r&&r.li.querySelector(".name").focus();}}});
window.addEventListener("resize",()=>{if(!cmenu.hidden)closeCardMenu();});
function dupCheck(){
  const owners=new Map();
  rows.forEach(r=>{const s=st(r.name);if(s.alt&&s.altName&&s.altName.trim()){const k=norm(s.altName);if(!owners.has(k))owners.set(k,[]);owners.get(k).push(r.name);}});
  rows.forEach(r=>{const s=st(r.name);let msg="";
    if(s.alt&&s.altName&&s.altName.trim()){const k=norm(s.altName);
      if(!BASICS.has(k)){
        if(deckIndex.has(k)){const hit=deckIndex.get(k);msg=hit.name===r.name?"This is the same card as the list.":hit.name+" is already in the deck, under "+hit.cat+".";}
        else{const o=owners.get(k).filter(n=>n!==r.name);if(o.length)msg="Already used as the alternative to "+o.join(", ")+".";}
      }}
    r.warn.textContent=msg;});
}
function update(){
  extNames=extF?new Set(deckRecords().filter(extF.pred).map(x=>x.orig)):null;
  renderChip("fChip",extF,()=>{extF=null;update();});
  let shown=0;const per=new Map();
  rows.forEach(r=>{
    const s=st(r.name);const k=cls(r.name);
    r.btn.f.setAttribute("aria-pressed",!!s.f);r.btn.p.setAttribute("aria-pressed",!!s.p);r.btn.m.setAttribute("aria-pressed",!!s.m);r.btn.a.setAttribute("aria-pressed",!!s.alt);
    for(const x in r.abtn) r.abtn[x].setAttribute("aria-pressed",s.altS===x);
    r.li.classList.toggle("has-alt",!!s.alt);r.chip.className="stchip "+k;r.chip.textContent=STATUS[k];r.chip.setAttribute("aria-label",name2(r)+": "+STATUS[k]+". Change status");
    r.pr.textContent=s.print?("Printing: "+s.print.set.toUpperCase()):"Printing";
    setShop(r.sh,r.name,s.print);
    setShop(r.ash,(s.alt&&s.altName&&s.altName.trim())?s.altName.trim():"",s.altPrint);
    const show=matches(r,k,s);if(show)shown++;
    r.li.hidden=!show;
    const pc=per.get(r.sec)||{h:0,v:0};if(k==="have")pc.h+=q(r.name);if(show)pc.v++;per.set(r.sec,pc);
  });
  groups.forEach(sec=>{const pc=per.get(sec)||{h:0,v:0};sec._sm.textContent=pc.h+" / "+sec._n+" owned";sec.classList.toggle("hidden",pc.v===0);});
  arrange();
  document.getElementById("tcount").textContent=shown+(shown===1?" card shown":" cards shown")+(shown<rows.length?" of "+rows.length:"");
  dupCheck();syncSel();
  const fin=new Set(rows.map(r=>norm(finalName(r.name))));
  document.getElementById("combo").textContent=(fin.has(norm("Ganax, Astral Hunter"))&&fin.has(norm("Draconic Visitor")))?"Combo in the list: Ganax + Draconic Visitor. Cast the second piece only when Terror of the Peaks, Scourge of Valkas or Dragon Tempest is already out: with one of them it is infinite damage, without them the mandatory loop ends in a draw.":"";
}
document.getElementById("reset").addEventListener("click",async()=>{if(!await ask("Clear every mark and alternative in this deck? Printings go back to the ones in the imported list.","Clear marks"))return;state=seed();save();rows.forEach(r=>r.inp.value=st(r.name).altName||"");update();});
document.getElementById("restore").addEventListener("click",async()=>{if(!SEED||DECKS.current!==SEED.id)return;if(!await ask("Restore the marks you filled in earlier? Changes made since then are lost.","Restore"))return;state=seed();save();rows.forEach(r=>r.inp.value=st(r.name).altName||"");update();});
