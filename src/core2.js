/* ---------- card data from Scryfall ---------- */
const LANDS=new Set(CUR&&CUR.lands||[]);
const front=n=>n.split(" // ")[0];
let META=lsGet(NS+"-meta")||{};
let metaBusy=false,metaTimer=null;
function metaRec(c){
  const f0=(c.card_faces&&c.card_faces[0])||{};const tl=f0.type_line||c.type_line||"";
  return {eur:c.prices&&(c.prices.eur||c.prices.eur_foil)?+(c.prices.eur||c.prices.eur_foil):null,cmc:c.cmc,
    dragon:/\bDragon\b/.test(tl)&&/Creature/.test(tl),land:/\bLand\b/.test(tl)&&!/Creature/.test(tl),
    type:c.type_line||tl,ci:c.color_identity||[],rarity:c.rarity||null,set:c.set||null,setName:c.set_name||null};
}
function finalCards(){const out=[];DECK.forEach(([cat,cards])=>cards.forEach(n=>{
  const s=st(n);const alt=!!(s.alt&&s.altName&&s.altName.trim());const name=alt?s.altName.trim():n;
  out.push({orig:n,name,alt,qty:q(n),cmd:CMDS.has(n)});}));return out;}
function metaOf(c){
  const m=META[norm(front(c.name))];
  if(m) return {mv:m.cmc,dragon:m.dragon,land:m.land,est:false};
  if(!c.alt&&LANDS.has(c.name)) return {mv:0,dragon:false,land:true,est:false};
  const o=META[norm(front(c.orig))]; return {mv:o?o.cmc:0,dragon:o?o.dragon:false,land:LANDS.has(c.orig),est:true};
}
function allDeckNames(){const s=new Set();finalCards().forEach(c=>s.add(front(c.name)));
  allDecks().forEach(({d,s:stt})=>d.deck.forEach(([,cards])=>cards.forEach(n=>{const x=stt[n]||{};const alt=x.alt&&x.altName&&x.altName.trim();s.add(front(alt?x.altName.trim():n));})));
  return [...s];}
async function loadMeta(){
  if(metaBusy)return;
  const need=allDeckNames().filter(n=>{const m=META[norm(n)];return !m||!("rarity" in m);});
  if(!need.length)return;
  metaBusy=true;
  try{
    for(let i=0;i<need.length;i+=75){
      const r=await fetch("https://api.scryfall.com/cards/collection",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({identifiers:need.slice(i,i+75).map(n=>({name:n}))})});
      if(!r.ok)break;const j=await r.json();
      (j.data||[]).forEach(c=>{const rec=metaRec(c);META[norm(c.name)]=rec;META[norm(front(c.name))]=rec;});
      (j.not_found||[]).forEach(x=>{if(x.name&&!META[norm(x.name)])META[norm(x.name)]={eur:null,cmc:0,land:false,dragon:false,type:"",ci:[],rarity:null,set:null,setName:null,missing:true};});
      await new Promise(r=>setTimeout(r,120));
    }
    lsSet(NS+"-meta",META);
  }catch(e){}
  metaBusy=false;_upd();refreshViews();
}
function curveData(withEmi){
  const b=[0,0,0,0,0,0,0,0];let sum=0,n=0,red=0,est=0;
  finalCards().forEach(c=>{const m=metaOf(c);if(m.land)return;if(m.est)est++;if(!m.land&&LANDS.has(c.orig)&&!c.alt)return;
    let mv=m.mv||0;if(withEmi&&m.dragon&&!c.cmd&&mv>0){mv-=1;red++;}
    const k=c.qty||1;b[Math.min(7,Math.floor(mv))]+=k;sum+=mv*k;n+=k;});
  return {b,avg:n?sum/n:0,n,red,est};
}
const HAS_EMI=()=>[...CMDS].some(n=>norm(n)===norm("The Ur-Dragon"));

/* ---------- all decks, for the collection ---------- */
function allDecks(){return Object.keys(DECKS.list).map(id=>({id,d:DECKS.list[id],s:id===DECKS.current?state:loadState(id)}));}
const PRI={u:0,buy:1,proxy:2,have:3};
function cardMeta(name){return META[norm(front(name))]||null;}
function collRecords(){
  const map=new Map();
  allDecks().forEach(({id,d,s})=>{const Q=d.qty||{};d.deck.forEach(([cat,cards])=>cards.forEach(n=>{
    const x=s[n]||{};const alt=x.alt&&x.altName&&x.altName.trim();const name=alt?x.altName.trim():n;
    const status=clsOf(x);const print=alt?x.altPrint:x.print;const added=alt?x.at:x.t;const qn=Q[n]||1;
    const k=norm(name);let r=map.get(k);
    if(!r){r={name,decks:[],ownedQty:0,anyQty:0,status:"u",print:null,added:null};map.set(k,r);}
    r.decks.push({id,name:d.name,status,cat});r.anyQty=Math.max(r.anyQty,qn);
    if(status==="have"){r.ownedQty+=qn;if(print&&!(r.print&&r.printOwned)){r.print=print;r.printOwned=true;}if(added&&(!r.added||added<r.added))r.added=added;}
    else if(!r.print&&print)r.print=print;
    if(PRI[status]>PRI[r.status])r.status=status;
  }));});
  return [...map.values()].map(r=>{const m=cardMeta(r.name)||{};const p=r.print;
    return {name:r.name,status:r.status,qty:r.status==="have"?r.ownedQty:r.anyQty,price:priceOf(r.name,p),print:p,
      set:(p&&p.set)||m.set||"",setName:(p&&p.setName)||m.setName||"",rarity:(p&&p.rarity)||m.rarity||"",
      type:m.type||"",ci:m.ci||[],cmc:m.cmc,land:!!m.land,decks:r.decks,added:r.added||null,known:!!cardMeta(r.name)};});
}
function deckRecords(){
  return rows.map(r=>{const name=finalName(r.name),p=rowPrint(r),m=cardMeta(name)||{};
    const s=st(r.name);const alt=s.alt&&s.altName&&s.altName.trim();
    return {name,orig:r.name,status:cls(r.name),qty:q(r.name),price:priceOf(name,p),print:p,
      set:(p&&p.set)||m.set||"",setName:(p&&p.setName)||m.setName||"",rarity:(p&&p.rarity)||m.rarity||"",
      type:m.type||"",ci:m.ci||[],cmc:m.cmc,land:!!m.land||LANDS.has(r.name),cat:r.cat,alt:!!alt,decks:[{id:DECKS.current,name:CUR.name}],added:(alt?s.at:s.t)||null,known:!!cardMeta(name)};});
}

/* ---------- dimensions for charts and filters ---------- */
const TYPE_ORDER=["Creature","Planeswalker","Battle","Instant","Sorcery","Artifact","Enchantment","Land"];
function mainType(t){t=(t||"").split(" // ")[0];if(/\bLand\b/.test(t)&&!/Creature/.test(t))return "Land";for(const k of TYPE_ORDER)if(new RegExp("\\b"+k+"\\b").test(t))return k;return t?"Other":"Unknown";}
const COLN={W:"White",U:"Blue",B:"Black",R:"Red",G:"Green",C:"Colorless",M:"Multicolor"};
const colorKey=ci=>!ci||!ci.length?"C":ci.length>1?"M":ci[0];
const RAR={common:"Common",uncommon:"Uncommon",rare:"Rare",mythic:"Mythic",special:"Special",bonus:"Bonus"};
const RAR_ORD={mythic:0,rare:1,uncommon:2,common:3,special:4,bonus:5,"":6};
const monthKey=t=>{const d=new Date(t);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");};
const monthLab=k=>{const [y,m]=k.split("-");return new Date(+y,+m-1,1).toLocaleDateString("en-GB",{month:"short",year:"2-digit"});};
const DIMS={
  type:{name:"Card type",key:r=>[mainType(r.type)]},
  color:{name:"Color identity",key:r=>{const c=r.ci||[];return c.length?c:["C"];},lab:k=>COLN[k]||k},
  rarity:{name:"Rarity",key:r=>[r.rarity||"unknown"],lab:k=>RAR[k]||"Unknown",ord:(a,b)=>(RAR_ORD[a]??9)-(RAR_ORD[b]??9)},
  set:{name:"Set",key:r=>[r.setName||(r.set?r.set.toUpperCase():"Unknown")]},
  cat:{name:"Deck category",key:r=>[r.cat||"Other"],deckOnly:true},
  deck:{name:"Deck",key:r=>r.decks.map(d=>d.name),collOnly:true},
  status:{name:"Status",key:r=>[r.status],lab:k=>STATUS[k],ord:(a,b)=>PRI[b]-PRI[a]},
  mv:{name:"Mana value",key:r=>r.land?[]:[String(Math.min(7,Math.floor(r.cmc||0)))],lab:k=>k==="7"?"7+":k,ord:(a,b)=>a-b},
  added:{name:"Month added",key:r=>r.added?[monthKey(r.added)]:[],lab:monthLab,ord:(a,b)=>a<b?-1:1,collOnly:true}
};

/* ---------- metrics ---------- */
const sumQ=(R,f)=>R.reduce((a,r)=>a+(f(r)?r.qty:0),0);
const sumV=(R,f)=>R.reduce((a,r)=>a+(f(r)&&r.price!=null?r.price*r.qty:0),0);
const missP=(R,f)=>R.filter(r=>f(r)&&r.price==null).length;
const isS=s=>r=>r.status===s;
const METRICS={
  deck:{
    cards:{name:"Cards in deck",val:R=>sumQ(R,()=>true),sub:()=>DECK.length+" categories"},
    have:{name:"Owned",val:R=>sumQ(R,isS("have")),sub:R=>Math.round(sumQ(R,isS("have"))/TOTAL*100)+"% of the deck",filter:"have",col:"var(--have)"},
    proxy:{name:"To proxy",val:R=>sumQ(R,isS("proxy")),sub:R=>sumQ(R,isS("proxy"))?"go on the proxy sheet":"nothing to print",filter:"proxy",col:"var(--proxy)"},
    buy:{name:"To buy",val:R=>sumQ(R,isS("buy")),sub:R=>"order "+fmtE0(sumV(R,isS("buy"))),filter:"buy",col:"var(--buy)"},
    u:{name:"Undecided",val:R=>sumQ(R,isS("u")),sub:R=>sumQ(R,isS("u"))?"no status yet":"all decided",filter:"u",col:"var(--line2)"},
    order:{name:"Order cost",val:R=>fmtE0(sumV(R,isS("buy"))),sub:R=>{const m=missP(R,isS("buy")),o=R.filter(r=>r.status==="buy"&&r.price>25).length;return (m?m+" without price":"all priced")+(o?" · "+o+" over €25":"");},filter:"buy",col:"var(--buy)"},
    value:{name:"Deck value",val:R=>fmtE0(sumV(R,()=>true)),sub:R=>{const m=missP(R,()=>true);return m?m+" cards without price":"Cardmarket trend via Scryfall";}},
    owned:{name:"Owned value",val:R=>fmtE0(sumV(R,isS("have"))),sub:()=>"cards marked Owned",filter:"have",col:"var(--have)"},
    avgmv:{name:"Average mana value",val:()=>curveData(false).avg.toFixed(2),sub:()=>"non-land cards"},
    alts:{name:"Alternatives",val:()=>rows.filter(r=>st(r.name).alt).length,sub:()=>"cards replaced",filter:"alt",col:"var(--alt)"}
  },
  coll:{
    unique:{name:"Cards owned",val:R=>R.filter(isS("have")).length,sub:R=>{const n=sumQ(R,isS("have"));return n+(n===1?" copy":" copies");},filter:"have",col:"var(--have)"},
    copies:{name:"Copies owned",val:R=>sumQ(R,isS("have")),sub:R=>R.filter(isS("have")).length+" different",filter:"have",col:"var(--have)"},
    value:{name:"Collection value",val:R=>fmtE0(sumV(R,isS("have"))),sub:R=>{const m=missP(R,isS("have"));return m?m+" without price":"Cardmarket trend via Scryfall";},filter:"have"},
    avg:{name:"Average price",val:R=>{const n=sumQ(R,r=>r.status==="have"&&r.price!=null);return fmtE0(n?sumV(R,isS("have"))/n:0);},sub:()=>"per owned copy"},
    wish:{name:"Still to buy",val:R=>fmtE0(sumV(R,isS("buy"))),sub:R=>{const n=R.filter(isS("buy")).length;return n+(n===1?" card":" cards")+" across decks";},filter:"buy",col:"var(--buy)"},
    proxy:{name:"To proxy",val:R=>R.filter(isS("proxy")).length,sub:()=>"cards across decks",filter:"proxy",col:"var(--proxy)"},
    decks:{name:"Decks",val:()=>Object.keys(DECKS.list).length,sub:()=>Object.values(DECKS.list).map(d=>d.name).join(", ")},
    sets:{name:"Sets",val:R=>new Set(R.filter(r=>r.status==="have"&&r.set).map(r=>r.set)).size,sub:()=>"among owned cards"},
    complete:{name:"Decks completion",val:R=>{const t=R.reduce((a,r)=>a+r.decks.length,0),h=R.reduce((a,r)=>a+r.decks.filter(d=>d.status==="have").length,0);return t?Math.round(h/t*100)+"%":"–";},sub:()=>"deck slots owned"}
  }
};

/* ---------- widgets ---------- */
const WTYPES={
  stat:{name:"Number",desc:"One figure: a ready-made one, or your own with a measure and filters.",def:{w:3,h:2},cfg:(g,c)=>statCfg(g,c||{}),init:g=>({metric:g==="deck"?"have":"unique"})},
  progress:{name:"Status bar",desc:"Owned, to proxy, to buy and undecided as one bar.",def:{w:12,h:2}},
  curve:{name:"Mana curve",desc:"Cards per mana value, with the eminence discount when it applies.",def:{w:7,h:6},deckOnly:true},
  top:{name:"Top by price",desc:"The most expensive cards in a status.",def:{w:5,h:6},
    cfg:()=>({src:{label:"Cards",opts:{buy:"To buy",have:"Owned",proxy:"To proxy",all:"All"}},n:{label:"How many",opts:{5:"5",8:"8",10:"10",15:"15"}}}),init:g=>({src:g==="deck"?"buy":"have",n:"5"})},
  breakdown:{name:"Breakdown",desc:"Count or value by type, color, rarity, set, deck, month…",def:{w:6,h:6},
    cfg:g=>({dim:{label:"Group by",opts:Object.fromEntries(Object.entries(DIMS).filter(([,v])=>g==="deck"?!v.collOnly:!v.deckOnly).map(([k,v])=>[k,v.name]))},
      measure:{label:"Measure",opts:{count:"Number of cards",value:"Value (€)"}},src:{label:"Cards",opts:{all:"All",have:"Owned",buy:"To buy",proxy:"To proxy"}},
      style:{label:"Chart",opts:{bars:"Horizontal bars",cols:"Columns"}},n:{label:"Show at most",opts:{6:"6",10:"10",15:"15",30:"30"}}}),
    init:g=>({dim:"type",measure:"count",src:g==="deck"?"all":"have",style:"bars",n:"10"})},
  notes:{name:"Notes",desc:"Free text, saved with the deck or the collection.",def:{w:6,h:4}}
};
const DEF_LAYOUT={
  deck:[["stat",3,2,{metric:"have"}],["stat",3,2,{metric:"proxy"}],["stat",3,2,{metric:"buy"}],["stat",3,2,{metric:"order"}],
    ["progress",12,2,{}],["curve",7,6,{}],["top",5,6,{src:"buy",n:"5"}],
    ["breakdown",6,6,{dim:"type",measure:"count",src:"all",style:"bars",n:"10"}],["breakdown",6,6,{dim:"cat",measure:"value",src:"all",style:"bars",n:"10"}]],
  coll:[["stat",3,2,{metric:"unique"}],["stat",3,2,{metric:"value"}],["stat",3,2,{metric:"wish"}],["stat",3,2,{metric:"complete"}],
    ["breakdown",7,6,{dim:"added",measure:"value",src:"have",style:"cols",n:"15"}],["top",5,6,{src:"have",n:"5"}],
    ["breakdown",4,6,{dim:"color",measure:"count",src:"have",style:"bars",n:"10"}],["breakdown",4,6,{dim:"rarity",measure:"value",src:"have",style:"bars",n:"10"}],["breakdown",4,6,{dim:"deck",measure:"value",src:"have",style:"bars",n:"10"}]]
};
let wid=0;const newId=()=>"w"+Date.now().toString(36)+(wid++);
function defaultLayout(g){return DEF_LAYOUT[g].map(([type,w,h,cfg])=>({id:newId(),type,w,h,cfg:{...cfg}}));}
const GRIDS={};
function gridFor(g){
  if(GRIDS[g])return GRIDS[g];
  let items=lsGet(NS+"-layout-"+g);if(!Array.isArray(items)||!items.length)items=defaultLayout(g);
  items=items.filter(it=>WTYPES[it.type]&&!(g==="coll"&&WTYPES[it.type].deckOnly));
  const el=document.getElementById(g==="deck"?"gDeck":"gColl");
  const G=GRIDS[g]={g,el,items,editing:false,cols:12};
  new ResizeObserver(()=>applySpans(G)).observe(el);
  wireGrid(G);
  return G;
}
const saveLayout=G=>lsSet(NS+"-layout-"+G.g,G.items);
function colsFor(width){return width>=900?12:width>=540?6:2;}
function applySpans(G){
  const cols=colsFor(G.el.clientWidth||window.innerWidth);
  if(cols!==G.cols){G.cols=cols;}
  G.el.style.setProperty("--cols",cols);G.el.classList.toggle("narrow",cols===2);
  G.items.forEach(it=>{const n=G.el.querySelector('[data-id="'+it.id+'"]');if(!n)return;
    const eff=cols===2?(it.w<=3?1:2):Math.max(1,Math.min(cols,Math.round(it.w*cols/12)));
    n.style.gridColumn="span "+eff;n.style.gridRow=cols===2?"auto":"span "+it.h;});
}
function wTitle(G,it){
  const c=it.cfg||{};
  if(it.type==="stat"&&c.metric==="custom")return c.label||((MEASURE_N[c.measure||"copies"]||"Number")+(customDesc(G.g,c)!=="all cards"?" · "+customDesc(G.g,c):""));
  if(it.type==="stat")return (METRICS[G.g][c.metric]||{}).name||"Number";
  if(it.type==="top")return "Most expensive · "+({buy:"to buy",have:"owned",proxy:"to proxy",all:"all"}[c.src]||"");
  if(it.type==="breakdown")return ((DIMS[c.dim]||{}).name||"Breakdown")+(c.measure==="value"?" · value":" · cards");
  return WTYPES[it.type].name;
}
function buildGrid(G){
  G.el.innerHTML="";G.el.classList.toggle("editing",G.editing);
  G.items.forEach(it=>{
    const w=document.createElement("div");w.className="w";w.dataset.id=it.id;w.dataset.type=it.type;
    w.innerHTML='<div class="wh"><span class="grip" aria-hidden="true">⋮⋮</span><span class="wt"></span><span class="wctl">'+
      '<button type="button" class="wgear" aria-label="Widget settings">⚙</button>'+
      '<button type="button" class="wdel" aria-label="Remove widget">✕</button></span></div><div class="wb"></div><div class="wcfg"></div><div class="wrs" aria-hidden="true"></div>';
    G.el.appendChild(w);
  });
  applySpans(G);renderWidgets(G);
}
function cfgForm(G,it,box){
  box.innerHTML="";
  const typeSel=document.createElement("label");typeSel.innerHTML="Widget";const ts=document.createElement("select");
  Object.entries(WTYPES).forEach(([k,v])=>{if(G.g==="coll"&&v.deckOnly)return;const o=document.createElement("option");o.value=k;o.textContent=v.name;o.selected=k===it.type;ts.appendChild(o);});
  ts.addEventListener("change",()=>{it.type=ts.value;it.cfg=WTYPES[it.type].init?WTYPES[it.type].init(G.g):{};it.w=WTYPES[it.type].def.w;it.h=WTYPES[it.type].def.h;saveLayout(G);buildGrid(G);cfgForm(G,it,box);});
  typeSel.appendChild(ts);box.appendChild(typeSel);
  const spec=WTYPES[it.type].cfg?WTYPES[it.type].cfg(G.g,it.cfg||{}):{};
  Object.entries(spec).forEach(([k,f])=>{if(f.sep){const h=document.createElement("div");h.className="cfgsep";h.textContent=f.sep;box.appendChild(h);}
    const l=document.createElement("label");l.textContent=f.label;let s;
    if(f.input){s=document.createElement("input");s.type=f.input;if(f.ph)s.placeholder=f.ph;if(f.input==="number"){s.min="0";s.step="0.5";s.inputMode="decimal";}s.value=(it.cfg||{})[k]??"";
      s.addEventListener("input",()=>{it.cfg={...(it.cfg||{}),[k]:s.value};saveLayout(G);renderWidgets(G);});}
    else{s=document.createElement("select");
      Object.entries(f.opts).forEach(([v,t])=>{const o=document.createElement("option");o.value=v;o.textContent=t;o.selected=String((it.cfg||{})[k]??"")===v;s.appendChild(o);});
      s.addEventListener("change",()=>{it.cfg={...(it.cfg||{}),[k]:s.value};saveLayout(G);renderWidgets(G);if(f.rebuild)cfgForm(G,it,box);});}
    l.appendChild(s);box.appendChild(l);});
  const done=document.createElement("button");done.type="button";done.textContent="Done";done.className="btn-acc cfgdone";
  done.addEventListener("click",()=>cfgM.classList.remove("open"));box.appendChild(done);
}
const cfgM=document.getElementById("wcfgModal");
function openCfg(G,it){cfgForm(G,it,document.getElementById("wcfgBody"));cfgM.classList.add("open");const f=cfgM.querySelector("select,input");f&&f.focus();}
function recordsFor(g){return g==="deck"?(CUR?deckRecords():[]):collRecords();}
function renderWidgets(G){
  if(G.g==="deck"&&!CUR)return;
  const R=recordsFor(G.g);let si=0;
  G.items.forEach(it=>{const n=G.el.querySelector('[data-id="'+it.id+'"]');if(!n)return;
    if(it.type==="stat"){const t=(it.cfg||{}).tone||"auto";const tone=t==="auto"?String((si%4)+1):t;si++;if(tone==="plain")n.removeAttribute("data-tone");else n.dataset.tone=tone;}else n.removeAttribute("data-tone");});
  G.items.forEach(it=>{const n=G.el.querySelector('[data-id="'+it.id+'"]');if(!n)return;
    n.querySelector(".wt").textContent=wTitle(G,it);
    const b=n.querySelector(".wb");n.classList.remove("on");
    try{RENDER[it.type](G,it,b,R,n);}catch(e){b.innerHTML='<p class="w-empty">This widget could not be drawn.</p>';}
  });
}
function setVal(el,v){v=String(v);const m=v.match(/^(€)?(.*?)(%)?$/);el.textContent="";
  if(m[1]){const u=document.createElement("span");u.className="u";u.textContent="€";el.appendChild(u);}
  el.append(m[2]);if(m[3]){const u=document.createElement("span");u.className="u";u.textContent="%";el.appendChild(u);}}
function srcF(src){return src==="all"||!src?()=>true:isS(src);}
/* custom numbers: a measure over a filtered set of cards */
const ANY={"":"Any"};
function statCfg(g,c){
  const base={tone:{label:"Tile color",opts:{auto:"Automatic",1:"Accent",2:"Dark",3:"Second accent",4:"Soft accent",plain:"White"}},metric:{label:"Shows",rebuild:true,opts:{...Object.fromEntries(Object.entries(METRICS[g]).map(([k,v])=>[k,v.name])),custom:"Custom: build your own…"}}};
  if(c.metric!=="custom")return base;
  const st={all:"Any status",have:"Owned",proxy:"To proxy",buy:"To buy",u:"Undecided",missing:"Proxy or to buy"};if(g==="deck")st.alt="With alternative";
  const mv={"":"Any",...Object.fromEntries([0,1,2,3,4,5,6,7,8,9,10].map(n=>[n,String(n)]))};
  return {...base,
    label:{label:"Title",input:"text",ph:"Automatic"},
    measure:{label:"Measure",sep:"What to count",opts:{copies:"Number of cards",unique:"Different cards",value:"Total value (€)",avg:"Average price",max:"Most expensive card",min:"Cheapest card",mv:"Average mana value",pct:g==="deck"?"Share of the deck (%)":"Share of the collection (%)",noprice:"Cards without a price"}},
    status:{label:"Status",sep:"Which cards",opts:st},
    ...(g==="deck"?{cat:{label:"Category",opts:{...ANY,...Object.fromEntries(DECK.map(d=>[d[0],d[0]]))}}}:{deck:{label:"Deck",opts:{...ANY,...Object.fromEntries(Object.keys(DECKS.list).map(id=>[id,DECKS.list[id].name]))}}}),
    type:{label:"Card type",opts:{...ANY,...Object.fromEntries(TYPE_ORDER.map(t=>[t,t])),nonland:"Non-land"}},
    color:{label:"Color identity",opts:{...ANY,...COLN}},
    rarity:{label:"Rarity",opts:{...ANY,common:"Common",uncommon:"Uncommon",rare:"Rare",mythic:"Mythic"}},
    mvMin:{label:"Mana value from",opts:mv},mvMax:{label:"Mana value up to",opts:mv},
    pMin:{label:"Price from (€)",input:"number",ph:"0"},pMax:{label:"Price up to (€)",input:"number",ph:"No limit"}};
}
function customPred(g,c){return r=>{
  const S=c.status||"all";
  if(S==="missing"){if(r.status!=="proxy"&&r.status!=="buy")return false;}else if(S==="alt"){if(!r.alt)return false;}else if(S!=="all"&&r.status!==S)return false;
  if(c.cat&&r.cat!==c.cat)return false;
  if(c.deck&&!r.decks.some(d=>d.id===c.deck))return false;
  if(c.type){if(c.type==="nonland"){if(r.land)return false;}else if(mainType(r.type)!==c.type)return false;}
  if(c.color){const k=colorKey(r.ci);if(c.color==="M"?k!=="M":c.color==="C"?k!=="C":!(r.ci||[]).includes(c.color))return false;}
  if(c.rarity&&r.rarity!==c.rarity)return false;
  if(c.mvMin!==undefined&&c.mvMin!==""&&(r.land||(r.cmc||0)<+c.mvMin))return false;
  if(c.mvMax!==undefined&&c.mvMax!==""&&(r.land||(r.cmc||0)>+c.mvMax))return false;
  if(c.pMin!==undefined&&c.pMin!==""&&(r.price==null||r.price<+c.pMin))return false;
  if(c.pMax!==undefined&&c.pMax!==""&&(r.price==null||r.price>+c.pMax))return false;
  return true;};}
function customDesc(g,c){const b=[];const SN={have:"owned",proxy:"to proxy",buy:"to buy",u:"undecided",missing:"proxy or to buy",alt:"with alternative"};
  if(c.status&&c.status!=="all")b.push(SN[c.status]);if(c.cat)b.push(c.cat);if(c.deck&&DECKS.list[c.deck])b.push(DECKS.list[c.deck].name);
  if(c.type)b.push(c.type==="nonland"?"non-land":c.type.toLowerCase());if(c.color)b.push(COLN[c.color].toLowerCase());if(c.rarity)b.push(c.rarity);
  if((c.mvMin??"")!==""||(c.mvMax??"")!=="")b.push("MV "+((c.mvMin??"")!==""?c.mvMin:"0")+"–"+((c.mvMax??"")!==""?c.mvMax:"∞"));
  if((c.pMin??"")!==""||(c.pMax??"")!=="")b.push("€"+((c.pMin??"")!==""?c.pMin:"0")+"–"+((c.pMax??"")!==""?c.pMax:"∞"));
  return b.join(" · ")||"all cards";}
const MEASURE_N={copies:"Cards",unique:"Different cards",value:"Value",avg:"Average price",max:"Most expensive",min:"Cheapest",mv:"Average mana value",pct:"Share",noprice:"Without price"};
function customStat(g,c,R){const L=R.filter(customPred(g,c));const M=c.measure||"copies";const desc=customDesc(g,c);const copies=L.reduce((a,r)=>a+r.qty,0);
  const priced=L.filter(r=>r.price!=null);let val,sub;
  if(M==="copies"){val=copies;sub=desc;}
  else if(M==="unique"){val=L.length;sub=desc;}
  else if(M==="value"){val=fmtE0(priced.reduce((a,r)=>a+r.price*r.qty,0));sub=copies+" cards · "+desc;}
  else if(M==="avg"){const n=priced.reduce((a,r)=>a+r.qty,0);val=fmtE0(n?priced.reduce((a,r)=>a+r.price*r.qty,0)/n:0);sub=desc;}
  else if(M==="max"||M==="min"){const x=priced.sort((a,b)=>M==="max"?b.price-a.price:a.price-b.price)[0];val=x?fmtE(x.price):"–";sub=x?x.name:desc;}
  else if(M==="mv"){const nl=L.filter(r=>!r.land);const n=nl.reduce((a,r)=>a+r.qty,0);val=n?(nl.reduce((a,r)=>a+(r.cmc||0)*r.qty,0)/n).toFixed(2):"–";sub=n+" non-land · "+desc;}
  else if(M==="pct"){const t=R.reduce((a,r)=>a+r.qty,0);val=(t?Math.round(copies/t*100):0)+"%";sub=copies+" of "+t+" · "+desc;}
  else if(M==="noprice"){val=L.filter(r=>r.price==null).length;sub=desc;}
  return {val,sub,count:L.length,title:c.label||(MEASURE_N[M]+(desc!=="all cards"?" · "+desc:""))};}
const RENDER={
  stat(G,it,b,R,n){
    if((it.cfg||{}).metric==="custom"){const c=it.cfg,x=customStat(G.g,c,R);const ext=G.g==="deck"?extF:cExt;const active=!!(ext&&ext.id===it.id);if(active)n.classList.add("on");
      b.innerHTML='<button type="button" class="stat"><span class="sv"></span><span class="ss"></span></button>';const btn=b.firstChild;
      setVal(btn.querySelector(".sv"),x.val);btn.querySelector(".ss").textContent=x.sub;btn.querySelector(".ss").title=x.sub;btn.setAttribute("aria-pressed",active);
      btn.title="Show these "+x.count+" cards in the table";
      btn.addEventListener("click",()=>{if(G.editing)return;const label=wTitle(G,it);
        if(G.g==="deck"){extF=active?null:{id:it.id,label,pred:customPred("deck",c)};update();document.getElementById("fQ").scrollIntoView({block:"nearest",behavior:"smooth"});}
        else{cExt=active?null:{id:it.id,label,pred:customPred("coll",c)};renderColl();renderWidgets(G);document.getElementById("cQ").scrollIntoView({block:"nearest",behavior:"smooth"});}});
      return;}
    const m=METRICS[G.g][(it.cfg||{}).metric]||Object.values(METRICS[G.g])[0];
    const active=m.filter&&(G.g==="deck"?filter===m.filter:(cFilter.status===m.filter&&m.filter!=="have"));
    if(active)n.classList.add("on");
    b.innerHTML='<button type="button" class="stat"><span class="sv"></span><span class="ss"></span></button>';
    const btn=b.firstChild;btn.style.setProperty("--c",m.col||"var(--accent)");
    setVal(btn.querySelector(".sv"),m.val(R));const sub=m.sub?m.sub(R):"";btn.querySelector(".ss").textContent=sub;btn.querySelector(".ss").title=sub;
    btn.setAttribute("aria-pressed",!!active);if(!m.filter)btn.style.cursor="default";
    btn.addEventListener("click",()=>{if(G.editing||!m.filter)return;
      if(G.g==="deck"){setFilter(filter===m.filter?"all":m.filter);document.getElementById("fQ").scrollIntoView({block:"nearest"});}
      else{setCollFilter("status",cFilter.status===m.filter&&m.filter!=="have"?"have":m.filter);}});},
  progress(G,it,b,R){const t=Math.max(1,sumQ(R,()=>true));
    const parts=["have","proxy","buy","u"].map(s=>[s,sumQ(R,isS(s))]);
    b.innerHTML='<div class="pbar">'+parts.map(([s,v])=>'<span class="c-'+s+'" style="width:'+(v/t*100)+'%"></span>').join("")+'</div>'+
      '<div class="pleg">'+parts.map(([s,v])=>'<span><i class="c-'+s+'"></i>'+STATUS[s]+' <b>'+v+'</b> · '+Math.round(v/t*100)+'%</span>').join("")+'</div>';},
  curve(G,it,b){const emi=!!(it.cfg&&it.cfg.emi)&&HAS_EMI();const base=curveData(false),cur=curveData(emi);
    const max=Math.max(...base.b,...cur.b,1);
    const mx=Math.max(...cur.b);b.innerHTML='<div class="vc"><div class="cols">'+cur.b.map((v,i)=>'<div class="col'+(v===mx&&v>0?' max':'')+'"><span>'+v+'</span><i style="height:'+(v/max*100)+'%" aria-label="'+(i===7?"7+":i)+' mana: '+v+' cards"></i></div>').join("")+'</div>'+
      '<div class="labs">'+cur.b.map((v,i)=>'<span>'+(i===7?"7+":i)+'</span>').join("")+'</div>'+
      '<div class="foot"><span>Average <b>'+cur.avg.toFixed(2)+'</b></span>'+(emi?'<span>Without eminence <b>'+base.avg.toFixed(2)+'</b></span><span>Dragons discounted <b>'+cur.red+'</b></span>':'')+'<span>Non-land cards <b>'+cur.n+'</b></span>'+
      (HAS_EMI()?'<button type="button" class="emi" aria-pressed="'+emi+'">'+(emi?"Show without eminence":"Apply eminence")+'</button>':'')+'</div>'+
      '<p class="note">'+(emi?"Every Dragon creature costs 1 less, except the commander. ":"Printed costs, commander included. ")+(cur.est?cur.est+" cards still without Scryfall data.":"")+'</p></div>';
    const e=b.querySelector(".emi");if(e)e.addEventListener("click",()=>{it.cfg={...(it.cfg||{}),emi:!emi};saveLayout(G);renderWidgets(G);});},
  top(G,it,b,R){const c=it.cfg||{};const n=+c.n||5;
    const L=R.filter(r=>srcF(c.src)(r)&&r.price!=null).sort((a,x)=>x.price-a.price).slice(0,n);
    if(!L.length){b.innerHTML='<p class="w-empty">No priced cards here yet.</p>';return;}
    b.innerHTML='<ol class="tl"></ol>';const ol=b.firstChild;
    L.forEach((r,i)=>{const li=document.createElement("li");li.tabIndex=0;
      li.innerHTML='<span class="n">'+(i+1)+'</span><span class="t">'+esc(r.name)+'<small>'+esc([r.set?r.set.toUpperCase():"",G.g==="deck"?r.cat:r.decks.map(d=>d.name).join(", ")].filter(Boolean).join(" · "))+'</small></span><span class="e">'+fmtE(r.price)+'</span>';
      const go=()=>{if(G.editing)return;G.g==="deck"?goRow(r.orig):goColl(r.name);};
      li.addEventListener("click",go);li.addEventListener("keydown",e=>{if(e.key==="Enter")go();});bindPreview(li,()=>({name:r.name,print:r.print}));ol.appendChild(li);});},
  breakdown(G,it,b,R){const c={...WTYPES.breakdown.init(G.g),...(it.cfg||{})};const D=DIMS[c.dim]||DIMS.type;const f=srcF(c.src);
    const acc=new Map();R.forEach(r=>{if(!f(r))return;const v=c.measure==="value"?(r.price!=null?r.price*r.qty:0):r.qty;D.key(r).forEach(k=>acc.set(k,(acc.get(k)||0)+v));});
    let E=[...acc.entries()].filter(([,v])=>v>0);
    if(D.ord)E.sort((a,x)=>D.ord(a[0],x[0]));else E.sort((a,x)=>x[1]-a[1]);
    const n=+c.n||10;if(E.length>n){if(D.ord&&c.dim==="added")E=E.slice(-n);else E=E.slice(0,n);}
    if(!E.length){b.innerHTML='<p class="w-empty">'+(c.dim==="added"?"Dates are recorded from now on, each time you mark a card as Owned.":"Nothing to show yet.")+'</p>';return;}
    const fmt=v=>c.measure==="value"?fmtE0(v):String(v);const lab=k=>D.lab?D.lab(k):k;const max=Math.max(...E.map(e=>e[1]));
    if(c.style==="cols"){b.innerHTML='<div class="vc"><div class="cols">'+E.map(([k,v])=>'<div class="col'+(v===max?' max':'')+'"><span>'+esc(c.measure==="value"?"€"+Math.round(v):v)+'</span><i style="height:'+(v/max*100)+'%"></i></div>').join("")+'</div><div class="labs">'+E.map(([k])=>'<span title="'+esc(lab(k))+'">'+esc(lab(k))+'</span>').join("")+'</div><div class="foot"><span>Total <b>'+esc(fmt(E.reduce((a,e)=>a+e[1],0)))+'</b></span></div></div>';return;}
    b.innerHTML='<ul class="hb">'+E.map(([k,v])=>'<li><span class="k" title="'+esc(lab(k))+'">'+esc(lab(k))+'</span><span class="t"><span style="width:'+(v/max*100)+'%"></span></span><span class="v">'+esc(fmt(v))+'</span></li>').join("")+'</ul>';},
  notes(G,it,b){const key=G.g==="deck"?"deck:"+DECKS.current:"coll";const N=lsGet(NS+"-notes")||{};
    b.innerHTML='<textarea class="notes" placeholder="Write anything: upgrade ideas, trades, reminders…" aria-label="Notes"></textarea>';const t=b.firstChild;t.value=(N[key]||{})[it.id]||"";
    t.addEventListener("input",()=>{const M=lsGet(NS+"-notes")||{};M[key]=M[key]||{};M[key][it.id]=t.value;lsSet(NS+"-notes",M);});}
};
/* drag, resize, settings, remove */
function wireGrid(G){
  const el=G.el;let drag=null,rs=null;
  el.addEventListener("click",e=>{const w=e.target.closest(".w");if(!w)return;const it=G.items.find(x=>x.id===w.dataset.id);
    if(e.target.closest(".wdel")){G.items=G.items.filter(x=>x!==it);saveLayout(G);buildGrid(G);return;}
    if(e.target.closest(".wgear")){openCfg(G,it);}
  });
  el.addEventListener("pointerdown",e=>{if(!G.editing)return;const w=e.target.closest(".w");if(!w)return;
    const it=G.items.find(x=>x.id===w.dataset.id);
    if(e.target.closest(".wrs")){if(G.cols===2)return;e.preventDefault();const r=w.getBoundingClientRect(),gs=getComputedStyle(el);
      const gap=parseFloat(gs.columnGap)||12,colw=(el.clientWidth-gap*(G.cols-1))/G.cols,rowh=parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--rowh"))||44;
      rs={w,it,x0:e.clientX,y0:e.clientY,W0:r.width,H0:r.height,gap,colw,rowh,pid:e.pointerId};w.classList.add("resizing");try{w.setPointerCapture(e.pointerId)}catch(_){}return;}
    if(!e.target.closest(".wh")||e.target.closest("button,select,input,textarea"))return;
    e.preventDefault();const r=w.getBoundingClientRect();
    drag={w,it,offX:e.clientX-r.left,offY:e.clientY-r.top,tx:0,ty:0,pid:e.pointerId};w.classList.add("dragging");w.style.pointerEvents="none";
    try{el.setPointerCapture(e.pointerId)}catch(_){}
  });
  el.addEventListener("pointermove",e=>{
    if(rs&&e.pointerId===rs.pid){
      const ew=Math.max(1,Math.min(G.cols,Math.round((rs.W0+(e.clientX-rs.x0)+rs.gap)/(rs.colw+rs.gap))));
      const eh=Math.max(2,Math.min(16,Math.round((rs.H0+(e.clientY-rs.y0)+rs.gap)/(rs.rowh+rs.gap))));
      const w12=Math.max(1,Math.min(12,Math.round(ew*12/G.cols)));
      if(w12!==rs.it.w||eh!==rs.it.h){rs.it.w=w12;rs.it.h=eh;applySpans(G);}
      return;}
    if(!drag||e.pointerId!==drag.pid)return;
    const w=drag.w;
    const under=document.elementFromPoint(e.clientX,e.clientY);const t=under&&under.closest&&under.closest(".w");
    if(t&&t!==w&&t.parentElement===el){const tr=t.getBoundingClientRect();
      const before=(e.clientX-tr.left)/tr.width+(e.clientY-tr.top)/tr.height<1;
      if(drag.lastT!==t||drag.lastB!==before){drag.lastT=t;drag.lastB=before;
        G.items.splice(G.items.indexOf(drag.it),1);
        const ni=G.items.findIndex(x=>x.id===t.dataset.id);G.items.splice(before?ni:ni+1,0,drag.it);
        if(before)el.insertBefore(w,t);else el.insertBefore(w,t.nextSibling);}}
    w.style.transform="none";const r=w.getBoundingClientRect();
    w.style.transform="translate("+(e.clientX-drag.offX-r.left)+"px,"+(e.clientY-drag.offY-r.top)+"px)";
  });
  const end=e=>{if(rs&&e.pointerId===rs.pid){rs.w.classList.remove("resizing");rs=null;saveLayout(G);renderWidgets(G);}
    if(drag&&e.pointerId===drag.pid){drag.w.classList.remove("dragging");drag.w.style.transform="";drag.w.style.pointerEvents="";drag=null;saveLayout(G);}};
  el.addEventListener("pointerup",end);el.addEventListener("pointercancel",end);
}
function setEditing(g,on){const G=gridFor(g);G.editing=on;G.el.classList.toggle("editing",on);
  document.querySelector('.wbar[data-grid="'+g+'"]').hidden=!on;
  document.querySelectorAll('.editL[data-grid="'+g+'"]').forEach(b=>{b.setAttribute("aria-pressed",on);b.textContent=on?"Done editing":"Edit layout";});
  if(!on)G.el.querySelectorAll(".cfgopen").forEach(x=>x.classList.remove("cfgopen"));}
document.querySelectorAll(".editL").forEach(b=>b.addEventListener("click",()=>{const g=b.dataset.grid;setEditing(g,!gridFor(g).editing);}));
document.querySelectorAll(".wbar").forEach(bar=>{const g=bar.dataset.grid;
  bar.querySelector(".doneL").addEventListener("click",()=>setEditing(g,false));
  bar.querySelector(".resetL").addEventListener("click",async()=>{if(!await ask("Put this page's widgets back to the default layout?","Reset layout"))return;const G=gridFor(g);G.items=defaultLayout(g);saveLayout(G);buildGrid(G);});
  bar.querySelector(".addW").addEventListener("click",()=>openAddW(g));});
const awM=document.getElementById("addWModal");
function openAddW(g){const L=document.getElementById("awList");L.innerHTML="";
  Object.entries(WTYPES).forEach(([k,v])=>{if(g==="coll"&&v.deckOnly)return;const b=document.createElement("button");b.type="button";b.innerHTML="<b></b><span></span>";b.firstChild.textContent=v.name;b.lastChild.textContent=v.desc;
    b.addEventListener("click",()=>{const G=gridFor(g);G.items.push({id:newId(),type:k,w:v.def.w,h:v.def.h,cfg:v.init?v.init(g):{}});saveLayout(G);buildGrid(G);awM.classList.remove("open");
      const n=G.el.lastElementChild;n&&n.scrollIntoView({block:"nearest",behavior:"smooth"});});L.appendChild(b);});
  awM.classList.add("open");}
document.getElementById("awClose").addEventListener("click",()=>awM.classList.remove("open"));

/* ---------- collection table ---------- */
const cFilter={q:"",status:"have",deck:"",type:"",color:"",rarity:"",set:"",min:"",max:"",sort:"name"};
const CF_IDS={q:"cQ",status:"cStatus",deck:"cDeck",type:"cType",color:"cColor",rarity:"cRarity",set:"cSet",min:"cMin",max:"cMax",sort:"cSort"};
function setCollFilter(k,v){cFilter[k]=v;const el=document.getElementById(CF_IDS[k]);if(el)el.value=v;renderColl();}
Object.entries(CF_IDS).forEach(([k,id])=>{const el=document.getElementById(id);el.addEventListener(el.tagName==="SELECT"?"change":"input",()=>{cFilter[k]=el.value;renderColl();});});
document.getElementById("cReset").addEventListener("click",()=>{cExt=null;Object.assign(cFilter,{q:"",status:"have",deck:"",type:"",color:"",rarity:"",set:"",min:"",max:"",sort:"name"});Object.entries(CF_IDS).forEach(([k,id])=>document.getElementById(id).value=cFilter[k]);renderColl();});
function fillSel(id,pairs,keepFirst){const s=document.getElementById(id);const cur=s.value;const first=s.options[0];s.innerHTML="";s.appendChild(first);
  pairs.forEach(([v,t])=>{const o=document.createElement("option");o.value=v;o.textContent=t;s.appendChild(o);});s.value=pairs.some(p=>p[0]===cur)?cur:"";}
let cExt=null;
function collMatch(r){const F=cFilter;
  if(cExt&&!cExt.pred(r))return false;
  if(F.status!=="all"&&r.status!==F.status)return false;
  if(F.deck&&!r.decks.some(d=>d.id===F.deck))return false;
  if(F.type&&mainType(r.type)!==F.type)return false;
  if(F.color){const k=colorKey(r.ci);if(F.color==="M"?k!=="M":F.color==="C"?k!=="C":!(r.ci||[]).includes(F.color))return false;}
  if(F.rarity&&r.rarity!==F.rarity)return false;
  if(F.set&&r.set!==F.set)return false;
  if(F.min!==""&&(r.price==null||r.price<+F.min))return false;
  if(F.max!==""&&(r.price==null||r.price>+F.max))return false;
  if(F.q){const t=norm(F.q);if(![r.name,r.setName,r.set,r.type].some(x=>x&&norm(x).includes(t)))return false;}
  return true;}
let COLL=[];
function renderColl(){
  if(view!=="coll")return;
  COLL=collRecords();
  fillSel("cDeck",Object.keys(DECKS.list).map(id=>[id,DECKS.list[id].name]));
  fillSel("cType",TYPE_ORDER.filter(t=>COLL.some(r=>mainType(r.type)===t)).map(t=>[t,t]));
  const sets=new Map();COLL.forEach(r=>{if(r.set)sets.set(r.set,r.setName||r.set.toUpperCase());});
  fillSel("cSet",[...sets.entries()].sort((a,b)=>a[1].localeCompare(b[1])));
  const L=COLL.filter(collMatch);const S=cFilter.sort;
  renderChip("cChip",cExt,()=>{cExt=null;renderColl();renderWidgets(gridFor("coll"));});
  const by={name:(a,b)=>a.name.localeCompare(b.name),price:(a,b)=>(b.price??-1)-(a.price??-1),value:(a,b)=>((b.price??0)*b.qty)-((a.price??0)*a.qty),
    set:(a,b)=>(a.setName||"~").localeCompare(b.setName||"~")||a.name.localeCompare(b.name),added:(a,b)=>(b.added||0)-(a.added||0),
    decks:(a,b)=>b.decks.length-a.decks.length||a.name.localeCompare(b.name),rarity:(a,b)=>(RAR_ORD[a.rarity]??9)-(RAR_ORD[b.rarity]??9)||a.name.localeCompare(b.name)};
  L.sort(by[S]||by.name);
  const tb=document.querySelector("#ctbl tbody");
  const copies=L.reduce((a,r)=>a+r.qty,0),val=L.reduce((a,r)=>a+(r.price!=null?r.price*r.qty:0),0);
  document.getElementById("ccount").textContent=L.length+(L.length===1?" card":" different cards")+" · "+copies+(copies===1?" copy · ":" copies · ")+fmtE0(val);
  if(!L.length){tb.innerHTML='<tr class="none"><td colspan="9">'+(COLL.length?"No cards match these filters.":"No cards yet. Mark cards as Owned in a deck and they appear here.")+'</td></tr>';return;}
  const dkTitle=r=>r.decks.map(d=>d.name+" — "+STATUS[d.status].toLowerCase()).join("\n");
  tb.innerHTML=L.map((r,i)=>'<tr data-i="'+i+'">'+
    '<td class="c-n"><span class="cn" title="'+esc(r.name)+'">'+esc(r.name)+'</span><span class="sub" title="'+esc(r.type)+'">'+esc(r.type||(r.known?"":"Loading…"))+'</span></td>'+
    '<td class="c-set">'+(r.set?'<span class="setb"><span class="code">'+esc(r.set)+'</span><span class="sn" title="'+esc(r.setName)+'">'+esc(r.setName||"")+'</span></span>':'<span class="sub">–</span>')+'</td>'+
    '<td class="c-ra">'+(r.rarity?'<span class="rarb"><span class="rar '+esc(r.rarity)+'"></span>'+esc(RAR[r.rarity]||r.rarity)+'</span>':'<span class="sub">–</span>')+'</td>'+
    '<td class="c-st"><span class="pill '+r.status+'">'+STATUS[r.status]+'</span></td>'+
    '<td class="c-dk" title="'+esc(dkTitle(r))+'"><span class="dkb"><span class="dk">'+esc(r.decks[0]?r.decks[0].name:"")+'</span>'+(r.decks.length>1?'<span class="more">+'+(r.decks.length-1)+'</span>':'')+'</span></td>'+
    '<td class="r c-q">'+r.qty+'</td><td class="r c-p">'+fmtE(r.price)+'</td><td class="r c-v">'+(r.price!=null?fmtE0(r.price*r.qty):"–")+'</td>'+
    '<td class="r c-ad">'+(r.added?new Date(r.added).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"2-digit"}):"–")+'</td></tr>').join("");
  tb.querySelectorAll("tr[data-i]").forEach(tr=>{const r=L[+tr.dataset.i];bindPreview(tr.querySelector(".cn"),()=>({name:r.name,print:r.print}));});
}
function goColl(name){Object.assign(cFilter,{q:name,status:"all"});document.getElementById("cQ").value=name;document.getElementById("cStatus").value="all";renderColl();document.getElementById("ctbl").scrollIntoView({behavior:"smooth",block:"start"});}
document.getElementById("collCsv").addEventListener("click",async()=>{const L=collRecords().filter(collMatch);
  const cq=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
  const txt=["Name,Set code,Set,Type,Rarity,Status,Decks,Qty,Price EUR,Value EUR,Added"].concat(L.map(r=>[r.name,r.set,r.setName,r.type,r.rarity,STATUS[r.status],r.decks.map(d=>d.name).join("; "),r.qty,r.price??"",r.price!=null?(r.price*r.qty).toFixed(2):"",r.added?new Date(r.added).toISOString().slice(0,10):""].map(cq).join(","))).join("\n");
  try{await navigator.clipboard.writeText(txt);flashC("Copied "+L.length+" rows as CSV.");}catch(e){flashC("The browser blocked the clipboard.");}});
function flashC(m){const p=document.getElementById("ccount");const o=p.textContent;p.textContent=m;setTimeout(()=>{p.textContent=o;},2500);}

function renderChip(id,ext,clear){const el=document.getElementById(id);if(!el)return;el.hidden=!ext;if(!ext)return;
  el.innerHTML='<span>Filtered by <b></b></span><button type="button" aria-label="Remove this filter">✕</button>';el.querySelector("b").textContent=ext.label;el.querySelector("button").onclick=clear;}
/* ---------- per-deck figures (for home, decks and print house) ---------- */
function deckStats(id){const d=DECKS.list[id];const S=id===DECKS.current?state:loadState(id);const Q=d.qty||{};
  const o={id,name:d.name,cmd:(d.cmd||[])[0]||null,total:0,have:0,proxy:0,buy:0,u:0,buyCost:0,value:0,proxyItems:0};
  d.deck.forEach(([,cards])=>cards.forEach(n=>{const x=S[n]||{},k=clsOf(x),qn=Q[n]||1;o.total+=qn;o[k]+=qn;
    const alt=x.alt&&x.altName&&x.altName.trim();const nm=alt?x.altName.trim():n;const p=priceOf(nm,alt?x.altPrint:x.print);
    if(p!=null){o.value+=p*qn;if(k==="buy")o.buyCost+=p*qn;}}));
  o.pct=o.total?Math.round(o.have/o.total*100):0;o.ready=o.total?Math.round((o.have+o.proxy)/o.total*100):0;return o;}
const artURL=n=>"https://api.scryfall.com/cards/named?exact="+encodeURIComponent(front(n))+"&format=image&version=art_crop";
function openDeck(id,intent){if(id===DECKS.current){setView("deck");if(intent)runIntent(intent);return;}
  DECKS.current=id;saveDecks();lsSet(NS+"-view","deck");if(intent)try{sessionStorage.setItem(NS+"-intent",intent)}catch(e){}history.replaceState(null,"","#deck");location.reload();}
function runIntent(k){const b={proxy:"openProxy",tokens:"openTokens",export:"openExport"}[k];if(b)setTimeout(()=>document.getElementById(b).click(),60);}
function deckCard(st,big){const el=document.createElement("article");el.className="dcard";el.tabIndex=0;el.setAttribute("aria-label","Open "+st.name);
  const ring='<svg class="ring" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15.5" class="rb"/><circle cx="18" cy="18" r="15.5" class="rp" stroke-dasharray="'+(st.ready*0.974).toFixed(1)+' 100"/><circle cx="18" cy="18" r="15.5" class="rh" stroke-dasharray="'+(st.pct*0.974).toFixed(1)+' 100"/></svg>';
  el.innerHTML='<div class="dart"'+(st.cmd?' style="background-image:url(\''+esc(artURL(st.cmd))+'\'),linear-gradient(135deg,var(--a3),var(--a2) 60%,var(--accent))"':'')+'></div>'+
    '<div class="dbody"><div class="dtop"><div class="dname"><b></b><small></small></div><div class="dring">'+ring+'<span>'+st.pct+'<i>%</i></span></div></div>'+
    '<div class="dmeta"><span><b>'+st.have+'</b>/'+st.total+' owned</span><span><b>'+st.proxy+'</b> to proxy</span><span><b>'+st.buy+'</b> to buy'+(st.buyCost?' · '+esc(fmtE0(st.buyCost)):'')+'</span></div>'+
    (big?'<div class="dact"><button type="button" class="btn-acc" data-i="">Open</button><button type="button" data-i="proxy">Proxies</button><button type="button" data-i="tokens">Tokens</button></div>':'')+'</div>';
  el.querySelector(".dname b").textContent=st.name;el.querySelector(".dname small").textContent=st.cmd||"No commander set";
  el.addEventListener("click",e=>{const b=e.target.closest("button[data-i]");openDeck(st.id,b?b.dataset.i:"");});
  el.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target===el)openDeck(st.id,"");});
  if(st.id===DECKS.current)el.classList.add("cur");return el;}
function newDeckCard(){const el=document.createElement("button");el.type="button";el.className="dcard add";el.innerHTML='<span class="plus" aria-hidden="true">+</span><b>New deck</b><small>Paste a list from Moxfield or Archidekt</small>';el.addEventListener("click",()=>openImport(false));return el;}
function statTile(tone,label,val,sub,go){const el=document.createElement(go?"button":"div");if(go){el.type="button";el.addEventListener("click",go);}
  el.className="btile";el.dataset.tone=tone;el.innerHTML='<span class="bl"></span><span class="bv"></span><span class="bs"></span>';
  el.querySelector(".bl").textContent=label;setVal(el.querySelector(".bv"),val);el.querySelector(".bs").textContent=sub;return el;}
const TOOLS=[
  {k:"proxy",t:"Proxy sheet",d:"Every card marked Proxy in a deck, at 63 × 88 mm with cut marks. Change printings, add your own art, download a PDF.",ico:"▦",b:"Open sheet"},
  {k:"tokens",t:"Token finder",d:"Every token a deck creates, from Treasures to copies, with printable token cards.",ico:"◎",b:"Find tokens"},
  {k:"export",t:"Lists and exports",d:"Moxfield list, shopping list with prices, proxy list and a summary to share.",ico:"⇩",b:"Export"}];
function toolCard(T,mini){const el=document.createElement("article");el.className="tcard";el.dataset.k=T.k;
  const ids=Object.keys(DECKS.list).sort((a,b)=>DECKS.list[a].name.localeCompare(DECKS.list[b].name));
  el.innerHTML='<div class="tico" aria-hidden="true">'+T.ico+'</div><h3></h3><p></p>'+(mini?'':'<label class="tsel">Deck<select></select></label>')+'<button type="button" class="btn-acc">'+T.b+'</button>';
  el.querySelector("h3").textContent=T.t;el.querySelector("p").textContent=T.d;
  const sel=el.querySelector("select");if(sel){ids.forEach(id=>{const o=document.createElement("option");o.value=id;o.textContent=DECKS.list[id].name;o.selected=id===DECKS.current;sel.appendChild(o);});
    if(T.k==="tokens"){const o=document.createElement("option");o.value="__paste";o.textContent="Paste any list…";sel.appendChild(o);}}
  el.querySelector("button").addEventListener("click",()=>{if(mini){setView("print");return;}const id=sel.value;
    if(T.k==="tokens"){if(id==="__paste"){document.getElementById("openTokens").click();document.getElementById("tkInput").value="";document.getElementById("tkInput").focus();return;}
      const d=DECKS.list[id],S=id===DECKS.current?state:loadState(id);const lines=[];d.deck.forEach(([,cards])=>cards.forEach(n=>{const x=S[n]||{};const alt=x.alt&&x.altName&&x.altName.trim();lines.push(((d.qty||{})[n]||1)+" "+(alt?x.altName.trim():n));}));
      document.getElementById("openTokens").click();document.getElementById("tkInput").value=lines.join("\n");document.getElementById("tkScan").click();return;}
    openDeck(id,T.k);});
  return el;}
function greet(){const h=new Date().getHours();return h<5?"Good night":h<12?"Good morning":h<18?"Good afternoon":"Good evening";}
function renderHome(){const ids=Object.keys(DECKS.list);const R=collRecords();const stats=ids.map(deckStats).sort((a,b)=>(b.id===DECKS.current)-(a.id===DECKS.current)||a.name.localeCompare(b.name));
  document.getElementById("homeTitle").textContent=greet();
  const own=R.filter(r=>r.status==="have"),val=own.reduce((a,r)=>a+(r.price!=null?r.price*r.qty:0),0),buy=R.filter(r=>r.status==="buy").reduce((a,r)=>a+(r.price!=null?r.price*r.qty:0),0);
  const avg=stats.length?Math.round(stats.reduce((a,s)=>a+s.pct,0)/stats.length):0;
  document.getElementById("homeSub").textContent=ids.length?(ids.length+(ids.length===1?" deck":" decks")+" · "+own.length+(own.length===1?" card":" cards")+" in your collection · "+fmtE0(val)+" in value."):"Import your first deck to start. Your collection builds itself from the cards you mark as Owned.";
  const B=document.getElementById("homeStats");B.innerHTML="";
  B.append(statTile("2","Collection value",fmtE0(val),own.length+(own.length===1?" card owned":" cards owned"),()=>setView("coll")),
    statTile("1","Decks",String(ids.length),stats.filter(s=>s.pct===100).length+" complete",()=>setView("decks")),
    statTile("3","Average completion",avg+"%","owned cards across decks",()=>setView("decks")),
    statTile("4","Still to buy",fmtE0(buy),(n=>n+(n===1?" card":" cards"))(R.filter(r=>r.status==="buy").length),()=>{setView("coll");setCollFilter("status","buy");}));
  const H=document.getElementById("homeDecks");H.innerHTML="";stats.slice(0,6).forEach(st=>H.appendChild(deckCard(st,false)));H.appendChild(newDeckCard());
  const T=document.getElementById("homeTools");T.innerHTML="";TOOLS.forEach(t=>T.appendChild(toolCard(t,true)));}
function renderDecks(){const A=document.getElementById("allDecks");A.innerHTML="";const ids=Object.keys(DECKS.list).sort((a,b)=>DECKS.list[a].name.localeCompare(DECKS.list[b].name));
  ids.map(deckStats).forEach(st=>A.appendChild(deckCard(st,true)));A.appendChild(newDeckCard());
  document.getElementById("decksSub").textContent=ids.length?ids.length+(ids.length===1?" deck":" decks")+". Open one to mark cards, print proxies or find its tokens.":"No decks yet. Import one to begin.";}
function renderPrint(){const P=document.getElementById("printTools");P.innerHTML="";
  if(!Object.keys(DECKS.list).length){P.innerHTML='<p class="w-empty">Import a deck first: the tools work on its cards.</p>';return;}
  TOOLS.forEach(t=>P.appendChild(toolCard(t,false)));}

/* ---------- views and navigation ---------- */
const VIEWS={home:"vHome",decks:"vDecks",deck:"vDeck",coll:"vColl",print:"vPrint"};
let view=(location.hash||"").slice(1);if(view==="collection")view="coll";if(!VIEWS[view])view=lsGet(NS+"-view")||"home";if(!VIEWS[view])view="home";
function setView(v){if(!VIEWS[v])v="home";const has=!!CUR,any=Object.keys(DECKS.list).length>0;
  if(v==="deck"&&!has)v=any?"decks":"home";if(v==="coll"&&!any)v="home";
  view=v;lsSet(NS+"-view",v);
  Object.entries(VIEWS).forEach(([k,id])=>document.getElementById(id).hidden=k!==v);
  document.getElementById("emptyState").hidden=true;
  const navKey=v==="deck"?"decks":v;
  document.querySelectorAll(".tab[data-view]").forEach(t=>{if(t.dataset.view===navKey)t.setAttribute("aria-current","page");else t.removeAttribute("aria-current");});
  document.getElementById("deckSel").hidden=!(v==="deck"&&Object.keys(DECKS.list).length>1);
  const h="#"+(v==="coll"?"collection":v);if(location.hash!==h)history.replaceState(null,"",h);
  document.title=(v==="deck"&&CUR?CUR.name:{home:"Home",decks:"My decks",coll:"Collection",print:"Print House"}[v]||"")+" · Commander Desk";
  refreshViews();if(v!=="deck")window.scrollTo(0,0);}
document.querySelectorAll(".tab[data-view]").forEach(t=>t.addEventListener("click",()=>setView(t.dataset.view)));
document.addEventListener("click",e=>{const g=e.target.closest("[data-go]");if(g){e.preventDefault();setView(g.dataset.go);}const a=e.target.closest('[data-act="new"]');if(a)openImport(false);});
window.addEventListener("hashchange",()=>{let v=location.hash.slice(1);if(v==="collection")v="coll";if(VIEWS[v]&&v!==view)setView(v);});
function refreshViews(){if(typeof renderLabHead==="function"&&CUR){if(LAB.combos)LAB.match=matchCombos();renderLabHead();if(DTAB==="combo")renderCombos();}
  if(view==="home")renderHome();
  if(view==="decks")renderDecks();
  if(view==="print")renderPrint();
  if(view==="deck"&&CUR){const G=gridFor("deck");if(!G.built){buildGrid(G);G.built=true;}else renderWidgets(G);}
  if(view==="coll"&&Object.keys(DECKS.list).length){const G=gridFor("coll");if(!G.built){buildGrid(G);G.built=true;}else renderWidgets(G);renderColl();}
}
const _upd=update;update=function(){const y=window.scrollY;_upd();if(view==="deck")refreshViews();if(Math.abs(window.scrollY-y)>1)window.scrollTo(0,y);clearTimeout(metaTimer);metaTimer=setTimeout(loadMeta,900);};

/* ---------- theme editor ---------- */
const thM=document.getElementById("themeModal");let thRole="accent",thHSV=[0,0,1];
function curTheme(){if(THEME)return {...THEME};const cs=getComputedStyle(document.documentElement);const t={};
  TH_ROLES.forEach(([k])=>{const v=cs.getPropertyValue(k==="bg"?"--bg":"--"+k).trim();t[k]=/^#[0-9a-f]{6}$/i.test(v)?v.toLowerCase():TH_PRESETS.desk[k];});return t;}
function drawWheel(){const cv=document.getElementById("wheelCv"),c=cv.getContext("2d"),W=cv.width,R=W/2;const img=c.createImageData(W,W);const v=thHSV[2];
  for(let y=0;y<W;y++)for(let x=0;x<W;x++){const dx=x-R,dy=y-R,d=Math.sqrt(dx*dx+dy*dy);const i=(y*W+x)*4;if(d>R){img.data[i+3]=0;continue;}
    const h=(Math.atan2(dy,dx)*180/Math.PI+360)%360,s=d/R;const [r,g,b]=hex2rgb(hsv2hex(h,s,v));img.data[i]=r;img.data[i+1]=g;img.data[i+2]=b;img.data[i+3]=d>R-1.5?Math.round(255*(R-d)/1.5):255;}
  c.putImageData(img,0,0);}
function placeMk(){const mk=document.getElementById("wheelMk"),a=thHSV[0]*Math.PI/180,r=thHSV[1]*50;
  mk.style.left=(50+Math.cos(a)*r)+"%";mk.style.top=(50+Math.sin(a)*r)+"%";mk.style.background=hsv2hex(...thHSV);}
function syncEditor(redraw){const t=curTheme(),hx=t[thRole];
  document.getElementById("wheelHex").value=hx.toUpperCase();document.getElementById("wheelSw").style.background=hx;
  document.getElementById("wheelV").value=Math.round(thHSV[2]*100);
  document.getElementById("wheelV").style.setProperty("--vgrad","linear-gradient(90deg,#000,"+hsv2hex(thHSV[0],thHSV[1],1)+")");
  if(redraw)drawWheel();placeMk();
  document.querySelectorAll("#thRoles .role").forEach(b=>{b.setAttribute("aria-pressed",b.dataset.k===thRole);b.querySelector("i").style.background=t[b.dataset.k];b.querySelector("small").textContent=t[b.dataset.k];});
  const pairs=[["ink","card","Text on cards"],["ink","bg","Text on the page"],["top","card","Navigation against cards"]];
  const bad=pairs.filter(([a,b])=>contrast(t[a],t[b])<(a==="top"?3:4.5)).map(p=>p[2]);
  const el=document.getElementById("thContrast");el.classList.toggle("bad",!!bad.length);
  el.textContent=bad.length?"Low contrast: "+bad.join(", ").toLowerCase()+". It may be hard to read.":"Contrast reads well. Text on cards "+contrast(t.ink,t.card).toFixed(1)+":1.";}
function setRoleColor(hx){const t=curTheme();t[thRole]=hx.toLowerCase();THEME=t;lsSet(NS+"-theme",THEME);applyTheme();syncEditor(false);}
function pickRole(k){thRole=k;thHSV=hex2hsv(curTheme()[k]);syncEditor(true);}
(function(){const roles=document.getElementById("thRoles");
  TH_ROLES.forEach(([k,l])=>{const b=document.createElement("button");b.type="button";b.className="role";b.dataset.k=k;b.innerHTML='<i></i><span></span>';b.querySelector("span").append(l,document.createElement("small"));b.addEventListener("click",()=>pickRole(k));roles.appendChild(b);});
  const pr=document.getElementById("thPresets");
  Object.entries(TH_PRESETS).forEach(([k,p])=>{const b=document.createElement("button");b.type="button";b.className="preset";
    b.innerHTML="<b>"+["bg","accent","a2","a3","top"].map(x=>'<i style="background:'+p[x]+'"></i>').join("")+"</b>";b.append(p.name);
    b.addEventListener("click",()=>{const t={...p};delete t.name;THEME=t;lsSet(NS+"-theme",THEME);applyTheme();pickRole(thRole);});pr.appendChild(b);});
  const wh=document.getElementById("wheel");let on=false;
  const pick=e=>{const r=wh.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2;
    thHSV[0]=(Math.atan2(dy,dx)*180/Math.PI+360)%360;thHSV[1]=Math.min(1,Math.sqrt(dx*dx+dy*dy)/(r.width/2));setRoleColor(hsv2hex(...thHSV));};
  wh.addEventListener("pointerdown",e=>{on=true;try{wh.setPointerCapture(e.pointerId)}catch(_){}pick(e);});
  wh.addEventListener("pointermove",e=>{if(on)pick(e);});
  ["pointerup","pointercancel"].forEach(t=>wh.addEventListener(t,()=>{on=false;}));
  let vT=null;document.getElementById("wheelV").addEventListener("input",e=>{thHSV[2]=+e.target.value/100;setRoleColor(hsv2hex(...thHSV));clearTimeout(vT);vT=setTimeout(drawWheel,60);});
  document.getElementById("wheelHex").addEventListener("change",e=>{let v=e.target.value.trim();if(!v.startsWith("#"))v="#"+v;
    if(/^#[0-9a-f]{3}$/i.test(v))v="#"+v.slice(1).split("").map(c=>c+c).join("");
    if(/^#[0-9a-f]{6}$/i.test(v)){thHSV=hex2hsv(v);setRoleColor(v);drawWheel();}else syncEditor(false);});
  document.getElementById("themeOpen").addEventListener("click",()=>{thM.classList.add("open");pickRole(thRole);});
  document.getElementById("thDone").addEventListener("click",()=>thM.classList.remove("open"));
  document.getElementById("thSystem").addEventListener("click",()=>{THEME=null;try{localStorage.removeItem(NS+"-theme")}catch(e){}applyTheme();pickRole(thRole);});
})();

/* ---------- PDF export of the print sheet (no external libraries) ---------- */
const PX_W=744,PX_H=1039; /* 63 × 88 mm at 300 dpi */
const blobToData=b=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(b);});
const IMGDATA={};
async function toDataURL(url){if(!url||url.startsWith("data:"))return url;if(IMGDATA[url])return IMGDATA[url];
  const r=await fetch(url,{mode:"cors"});if(!r.ok)throw new Error("image "+r.status);return IMGDATA[url]=await blobToData(await r.blob());}
const loadImg=src=>new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error("image"));i.src=src;});
async function rasterCard(it){
  const c=document.createElement("canvas");c.width=PX_W;c.height=PX_H;const g=c.getContext("2d");g.fillStyle="#ffffff";g.fillRect(0,0,PX_W,PX_H);
  const a=artOf(it);
  if(!a||a.mode==="none"||!artImg(a)){
    const im=await loadImg(await toDataURL(pngFor(it.name,it.print)));
    const s=Math.max(PX_W/im.naturalWidth,PX_H/im.naturalHeight),w=im.naturalWidth*s,h=im.naturalHeight*s;g.drawImage(im,(PX_W-w)/2,(PX_H-h)/2,w,h);
  }else{
    if(a.mode==="full"&&a.text!==false)await cardData(it);
    let html=cardHTML(it,"print");
    const srcs=[...new Set([...html.matchAll(/src="([^"]+)"/g)].map(m=>m[1].replace(/&amp;/g,"&")))];
    for(const s of srcs){let d;try{d=await toDataURL(s);}catch(e){d="";}html=html.split('src="'+esc(s)+'"').join('src="'+d+'"');}
    const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+PX_W+'" height="'+PX_H+'"><foreignObject x="0" y="0" width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:'+PX_W+'px;height:'+PX_H+'px"><style>'+CARD_CSS+'.cardc{width:'+PX_W+'px;height:'+PX_H+'px}</style>'+html.replace(/<img([^>]*?)>/g,"<img$1/>")+'</div></foreignObject></svg>';
    const im=await loadImg("data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg));
    await new Promise(r=>setTimeout(r,60));g.drawImage(im,0,0,PX_W,PX_H);
  }
  return c.toDataURL("image/jpeg",.93);
}
function b64bytes(d){const s=atob(d.split(",")[1]);const u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u;}
function buildPDF(L,pages,images){
  /* pages: [{cards:[{x,y,img}],lines:[[x1,y1,x2,y2]]}] in mm; images: [{bytes,w,h}] */
  const enc=new TextEncoder(),parts=[],offs=[];let len=0;
  const push=x=>{const b=typeof x==="string"?enc.encode(x):x;parts.push(b);len+=b.length;};
  const pt=mm=>(mm*72/25.4).toFixed(3);const W=pt(L.W),H=pt(L.H);
  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const nImg=images.length,nPg=pages.length;const imgId=i=>3+i,pageId=i=>3+nImg+i*2,contId=i=>4+nImg+i*2;const total=2+nImg+nPg*2;
  const obj=(id,body)=>{offs[id]=len;push(id+" 0 obj\n");push(body);push("\nendobj\n");};
  obj(1,"<< /Type /Catalog /Pages 2 0 R >>");
  obj(2,"<< /Type /Pages /Count "+nPg+" /Kids ["+pages.map((p,i)=>pageId(i)+" 0 R").join(" ")+"] >>");
  images.forEach((im,i)=>{offs[imgId(i)]=len;push(imgId(i)+" 0 obj\n<< /Type /XObject /Subtype /Image /Width "+im.w+" /Height "+im.h+" /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length "+im.bytes.length+" >>\nstream\n");push(im.bytes);push("\nendstream\nendobj\n");});
  pages.forEach((p,i)=>{
    let cs="";p.cards.forEach(c=>{cs+="q "+pt(63)+" 0 0 "+pt(88)+" "+pt(c.x)+" "+pt(L.H-c.y-88)+" cm /Im"+c.img+" Do Q\n";});
    if(p.lines.length){cs+="0 0 0 RG "+pt(.2)+" w\n";p.lines.forEach(([x1,y1,x2,y2])=>{cs+=pt(x1)+" "+pt(L.H-y1)+" m "+pt(x2)+" "+pt(L.H-y2)+" l S\n";});}
    const used=[...new Set(p.cards.map(c=>c.img))];
    obj(pageId(i),"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 "+W+" "+H+"] /Resources << /XObject << "+used.map(k=>"/Im"+k+" "+imgId(k)+" 0 R").join(" ")+" >> >> /Contents "+contId(i)+" 0 R >>");
    const b=enc.encode(cs);obj(contId(i),"<< /Length "+b.length+" >>\nstream\n"+cs+"endstream");});
  const xref=len;let x="xref\n0 "+(total+1)+"\n0000000000 65535 f \n";for(let id=1;id<=total;id++)x+=String(offs[id]).padStart(10,"0")+" 00000 n \n";
  push(x+"trailer\n<< /Size "+(total+1)+" /Root 1 0 R >>\nstartxref\n"+xref+"\n%%EOF");
  return new Blob(parts,{type:"application/pdf"});
}
async function exportPDF(){
  const info=document.getElementById("pxInfo"),btn=document.getElementById("pxPdf");
  const items=sheetItems(),L=layout(),marks=document.getElementById("pxMarks").checked;
  if(!L.per||!items.length){info.textContent="Nothing to print, or the paper is too small for one card.";return;}
  btn.disabled=true;
  try{
    const uniq=[],key=it=>(it.kind||"")+"|"+it.key+"|"+it.name;const idx=new Map();
    items.forEach(it=>{if(!idx.has(key(it))){idx.set(key(it),uniq.length);uniq.push(it);}});
    const images=[];const failed=[];
    for(let i=0;i<uniq.length;i++){info.textContent="Preparing card "+(i+1)+" of "+uniq.length+"…";
      try{const d=await rasterCard(uniq[i]);images.push({bytes:b64bytes(d),w:PX_W,h:PX_H});}
      catch(e){failed.push(uniq[i].name);const c=document.createElement("canvas");c.width=PX_W;c.height=PX_H;const g=c.getContext("2d");g.fillStyle="#fff";g.fillRect(0,0,PX_W,PX_H);g.strokeStyle="#999";g.lineWidth=4;g.strokeRect(8,8,PX_W-16,PX_H-16);g.fillStyle="#16130f";g.font="bold 44px Georgia";g.fillText(uniq[i].name.slice(0,24),40,90);images.push({bytes:b64bytes(c.toDataURL("image/jpeg",.9)),w:PX_W,h:PX_H});}}
    const gw=L.cols*63+(L.cols-1)*L.gap,gh=L.rows*88+(L.rows-1)*L.gap,ox=(L.W-gw)/2,oy=(L.H-gh)/2;const pages=[];
    for(let pg=0;pg*L.per<items.length;pg++){const chunk=items.slice(pg*L.per,(pg+1)*L.per);const cards=[],lines=[];
      chunk.forEach((it,i)=>{const c=i%L.cols,r=Math.floor(i/L.cols);cards.push({x:ox+c*(63+L.gap),y:oy+r*(88+L.gap),img:idx.get(key(it))});});
      if(marks){const len=Math.max(2,Math.min(ox,oy)-1);const mx=Math.min(len,oy),my=Math.min(len,ox);
        for(let c=0;c<L.cols;c++)[ox+c*(63+L.gap),ox+c*(63+L.gap)+63].forEach(x=>{lines.push([x,0,x,mx],[x,L.H-mx,x,L.H]);});
        for(let r=0;r<L.rows;r++)[oy+r*(88+L.gap),oy+r*(88+L.gap)+88].forEach(y=>{lines.push([0,y,my,y],[L.W-my,y,L.W,y]);});}
      pages.push({cards,lines});}
    const blob=buildPDF(L,pages,images);
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=((CUR&&CUR.name)||"proxies").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")+(pxMode==="token"?"-tokens":"-proxies")+".pdf";
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
    info.textContent="PDF ready: "+pages.length+(pages.length===1?" page, ":" pages, ")+items.length+" cards at 300 dpi"+(failed.length?". Could not load: "+failed.join(", ")+" (placeholder used).":".")+" Print it at 100% / actual size.";
  }catch(e){info.textContent="The PDF could not be made: "+e.message;}
  btn.disabled=false;
}
document.getElementById("pxPdf").addEventListener("click",exportPDF);

/* ---------- commander suggestions while typing (Scryfall) ---------- */
(function(){const inp=document.getElementById("imCmd"),list=document.getElementById("cmdList");let timer=null,ctl=null,items=[],act=-1,lastQ="";
  const segInfo=()=>{const v=inp.value,cut=v.lastIndexOf(";");return {head:cut>=0?v.slice(0,cut+1)+" ":"",q:(cut>=0?v.slice(cut+1):v).trim()};};
  const close=()=>{list.hidden=true;inp.setAttribute("aria-expanded","false");act=-1;};
  const pick=i=>{const c=items[i];if(!c)return;const {head}=segInfo();inp.value=head+c.name;close();inp.dispatchEvent(new Event("change"));inp.focus();};
  const mark=()=>{[...list.children].forEach((li,i)=>{li.setAttribute("aria-selected",i===act);if(i===act)li.scrollIntoView({block:"nearest"});});};
  function render(note){list.innerHTML="";
    if(!items.length){if(note){const li=document.createElement("li");li.className="acnote";li.textContent=note;list.appendChild(li);list.hidden=false;inp.setAttribute("aria-expanded","true");}else close();return;}
    items.forEach((c,i)=>{const li=document.createElement("li");li.role="option";li.id="cmdOpt"+i;
      const iu=c.image_uris||(c.card_faces&&c.card_faces[0].image_uris)||{};
      li.innerHTML='<span class="acimg"></span><span class="actx"><b></b><small></small></span><span class="acci"></span>';
      if(iu.art_crop)li.querySelector(".acimg").style.backgroundImage="url('"+iu.art_crop+"')";
      li.querySelector("b").textContent=c.name;li.querySelector("small").textContent=c.type_line||"";
      li.querySelector(".acci").innerHTML=(c.color_identity&&c.color_identity.length?c.color_identity:["C"]).map(x=>'<img class="ms" alt="'+x+'" src="https://svgs.scryfall.io/card-symbols/'+x+'.svg">').join("");
      li.addEventListener("mousedown",e=>{e.preventDefault();pick(i);});li.addEventListener("mousemove",()=>{act=i;mark();});
      list.appendChild(li);});
    list.hidden=false;inp.setAttribute("aria-expanded","true");act=0;mark();}
  async function lookup(q){if(ctl)ctl.abort();ctl=new AbortController();
    try{const url="https://api.scryfall.com/cards/search?order=edhrec&q="+encodeURIComponent(q.split(/\s+/).map(w=>'name:"'+w.replace(/"/g,"")+'"').join(" ")+" is:commander game:paper");
      let r=await fetch(url,{signal:ctl.signal});let data=r.ok?(await r.json()).data||[]:[];
      if(!data.length){/* typos: fall back to fuzzy single match */const f=await fetch("https://api.scryfall.com/cards/named?fuzzy="+encodeURIComponent(q),{signal:ctl.signal});if(f.ok)data=[await f.json()];}
      if(q!==segInfo().q)return;items=data.slice(0,8);render("No commander found for “"+q+"”.");}
    catch(e){if(e.name!=="AbortError"){items=[];render("Suggestions need an internet connection.");}}}
  inp.addEventListener("input",()=>{const {q}=segInfo();clearTimeout(timer);if(q.length<2){items=[];close();return;}
    if(q===lastQ&&!list.hidden)return;lastQ=q;timer=setTimeout(()=>lookup(q),220);});
  inp.addEventListener("keydown",e=>{if(list.hidden)return;
    if(e.key==="ArrowDown"){e.preventDefault();act=Math.min(items.length-1,act+1);mark();}
    else if(e.key==="ArrowUp"){e.preventDefault();act=Math.max(0,act-1);mark();}
    else if(e.key==="Enter"&&items[act]){e.preventDefault();pick(act);}
    else if(e.key==="Escape"){e.stopPropagation();close();}});
  inp.addEventListener("blur",()=>setTimeout(close,120));
  document.getElementById("imClose").addEventListener("click",close);
})();
