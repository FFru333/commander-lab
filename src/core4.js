/* ---------- Deck lab: roles, bracket, health gauges, suggestions, combos ---------- */
const LAB={roles:lsGet(NS+"-roles")||{},img:lsGet(NS+"-img")||{},gc:lsGet(NS+"-gc")||null,edh:null,edhErr:null,combos:null,comboErr:null,match:null,busy:false,prog:""};
if(LAB.roles._v!==1)LAB.roles={_v:1};
const ROLE_TAGS=[
  {k:"ramp",label:"Ramp",q:"otag:ramp",min:10,cat:/ramp|mana/i},
  {k:"draw",label:"Card draw",q:"otag:draw",min:10,cat:/draw|card/i},
  {k:"removal",label:"Removal",q:"otag:removal",min:8,cat:/remov/i},
  {k:"wipe",label:"Board wipes",q:"otag:board-wipe",min:2,cat:/wipe|sweep/i},
  {k:"counter",label:"Counterspells",q:"otag:counterspell",min:0,cat:/counter/i},
  {k:"protect",label:"Protection",q:"otag:protection",min:3,cat:/protect/i},
  {k:"recur",label:"Recursion",q:"otag:recursion",min:2,cat:/recur/i},
  {k:"tutor",label:"Tutors",q:"otag:tutor",min:0,cat:/tutor/i},
  {k:"gyhate",label:"Graveyard hate",q:"otag:graveyard-hate",min:1,cat:/graveyard/i},
  {k:"haste",label:"Haste",q:"otag:gives-haste",min:0,cat:/haste/i}];
const FLAG_TAGS=[{k:"gc",q:"is:gamechanger"},{k:"xturn",q:"otag:extra-turn"},{k:"mld",q:"otag:mass-land-denial"}];
const BRACKETS={1:"Exhibition",2:"Core",3:"Upgraded",4:"Optimized",5:"cEDH"};
const CSB_BR={R:4,S:3,P:3,O:2,C:2,E:1};

const nk=n=>norm(front(n));
const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));

/* card faces: Scryfall CDN url from an id, or from a fetched card */
const cdnImg=(id,v)=>id?"https://cards.scryfall.io/normal/front/"+id[0]+"/"+id[1]+"/"+id+".jpg"+(v?"?"+v:""):"";
function imgOfCard(c){const u=c.image_uris||(c.card_faces&&c.card_faces[0]&&c.card_faces[0].image_uris);return u?(u.normal||u.large||u.small):"";}
function rememberImg(name,url){if(!url)return;LAB.img[nk(name)]=url;}
let imgSaveT=null;function saveImgs(){clearTimeout(imgSaveT);imgSaveT=setTimeout(()=>{const k=Object.keys(LAB.img);if(k.length>2500)k.slice(0,k.length-2500).forEach(x=>delete LAB.img[x]);lsSet(NS+"-img",LAB.img);},800);}
async function resolveImgs(names){
  const need=[...new Set(names)].filter(n=>!LAB.img[nk(n)]);
  for(let i=0;i<need.length;i+=75){
    try{const r=await fetch("https://api.scryfall.com/cards/collection",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({identifiers:need.slice(i,i+75).map(n=>({name:front(n)}))})});
      if(!r.ok)break;const j=await r.json();(j.data||[]).forEach(c=>rememberImg(c.name,imgOfCard(c)));}catch(e){break;}
    await sleep(110);}
  saveImgs();
}
const labImg=n=>LAB.img[nk(n)]||"data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

/* ---------- roles from Scryfall tags (Tagger project) ---------- */
async function sfSearch(q,maxPages){const out=[];let url="https://api.scryfall.com/cards/search?q="+encodeURIComponent(q);let p=0;
  while(url&&p<(maxPages||4)){const r=await fetch(url);if(r.status===404)break;if(!r.ok)throw new Error("scryfall "+r.status);
    const j=await r.json();(j.data||[]).forEach(c=>out.push(c));url=j.has_more?j.next_page:null;p++;await sleep(110);}
  return out;}
function nameChunks(names){const out=[];let cur=[],len=0;names.forEach(n=>{const t='!"'+front(n).replace(/"/g,"")+'"';if(len+t.length>700&&cur.length){out.push(cur);cur=[];len=0;}cur.push(t);len+=t.length+4;});if(cur.length)out.push(cur);return out;}
function deckFinalNames(){return finalCards().map(c=>c.name);}
async function tagDeck(force){
  if(LAB.busy||!CUR)return;
  const now=Date.now(),MONTH=30*864e5;
  const names=[...new Set(deckFinalNames().map(front))].filter(n=>force||!LAB.roles[nk(n)]||now-LAB.roles[nk(n)].t>MONTH);
  if(!names.length)return;
  LAB.busy=true;const chunks=nameChunks(names),tags=ROLE_TAGS.concat(FLAG_TAGS);const hits={};names.forEach(n=>hits[nk(n)]=[]);
  let done=0;const total=chunks.length*tags.length;let failed=false;
  try{
    for(const t of tags){for(const ch of chunks){
      LAB.prog="Reading card roles from Scryfall… "+Math.round(done/total*100)+"%";renderLabHead();
      const cards=await sfSearch("("+t.q+") ("+ch.join(" or ")+")",2);
      cards.forEach(c=>{const k=nk(c.name);if(hits[k])hits[k].push(t.k);});done++;}}
  }catch(e){failed=true;}
  if(!failed){names.forEach(n=>LAB.roles[nk(n)]={r:hits[nk(n)],t:now});lsSet(NS+"-roles",LAB.roles);}
  LAB.prog=failed?"Scryfall could not be reached, so roles are not counted yet. They load the next time the deck opens.":"";
  LAB.busy=false;renderLab();
}
const rolesOf=n=>{const x=LAB.roles[nk(n)];return x?x.r:null;};
const hasRole=(n,k)=>{const r=rolesOf(n);return !!(r&&r.includes(k));};

/* ---------- analysis ---------- */
function deckCI(){const set=new Set();const cm=[...CMDS].map(n=>cardMeta(finalName(n))).filter(Boolean);
  (cm.length?cm:finalCards().map(c=>cardMeta(c.name)).filter(Boolean)).forEach(m=>(m.ci||[]).forEach(c=>set.add(c)));
  return "WUBRG".split("").filter(c=>set.has(c));}
function analyze(){
  const C=finalCards();const cnt={};ROLE_TAGS.concat(FLAG_TAGS).forEach(t=>cnt[t.k]=0);const who={};
  let tagged=0,lands=0,cards=0;
  C.forEach(c=>{const k=c.qty||1;cards+=k;const r=rolesOf(c.name);if(r){tagged++;r.forEach(x=>{cnt[x]+=k;(who[x]=who[x]||[]).push(c.name);});}
    const m=cardMeta(c.name);const land=m?m.land:LANDS.has(c.orig);if(land&&!c.cmd)lands+=k;});
  const cv=curveData(HAS_EMI());const avg=cv.avg;
  const R=cnt.ramp,tL=38-Math.floor(Math.max(0,R-8)/3);
  const landS=clamp(100-12*Math.max(0,Math.abs(lands-tL)-1)),rampS=clamp(R/10*100),curveS=clamp(100-Math.max(0,avg-3)*35);
  const mana=Math.round(.4*landS+.35*rampS+.25*curveS);
  const parts=[["draw",10,.3],["removal",8,.3],["wipe",2,.15],["protect",3,.15],["recur",2,.1]];
  const health=Math.round(parts.reduce((a,[k,t,w])=>a+w*Math.min(1,cnt[k]/t)*100,0));
  const M=LAB.match;const two=M?M.inDeck.filter(v=>v.cards.length===2).length:0;
  const power=Math.round(clamp(35+Math.min(cnt.gc,4)*6+Math.min(cnt.tutor,5)*3+(two?12:0)+Math.min(R,15)*1.5+Math.max(0,3.6-avg)*10));
  const overall=Math.round(.35*mana+.4*health+.25*power);
  return {cnt,who,tagged,total:C.length,lands,targetLands:tL,avg,cards,landS,rampS,curveS,mana,health,power,overall,parts,two};
}
function bracketOf(a){const why=[];let b=2;
  if(a.cnt.gc){b=Math.max(b,a.cnt.gc>3?4:3);why.push(a.cnt.gc+" Game Changer"+(a.cnt.gc>1?"s":"")+": "+(a.who.gc||[]).join(", ")+(a.cnt.gc>3?" (more than 3 means bracket 4)":" (up to 3 fits bracket 3)"));}
  else why.push("No Game Changers.");
  if(a.cnt.mld){b=4;why.push("Mass land denial: "+(a.who.mld||[]).join(", ")+" (bracket 4).");}
  if(a.cnt.xturn){if(a.cnt.xturn>=3)b=Math.max(b,4);why.push(a.cnt.xturn+" extra-turn card"+(a.cnt.xturn>1?"s":"")+": "+(a.who.xturn||[]).join(", ")+".");}
  if(a.cnt.tutor>3){b=Math.max(b,3);why.push(a.cnt.tutor+" tutors: "+(a.who.tutor||[]).join(", ")+".");}
  const M=LAB.match;
  if(M){const top=M.inDeck.reduce((x,v)=>Math.max(x,CSB_BR[v.br]||0),0);
    if(M.inDeck.length){if(top>=3)b=Math.max(b,top);const v=M.inDeck.slice().sort((x,y)=>(CSB_BR[y.br]||0)-(CSB_BR[x.br]||0))[0];
      why.push(M.inDeck.length+" combo"+(M.inDeck.length>1?"s":"")+" already in the deck. Highest per Commander Spellbook: bracket "+(CSB_BR[v.br]||"?")+" ("+v.cards.join(" + ")+").");}
    else why.push("No combos from Commander Spellbook in the deck.");}
  else why.push("Combos not checked yet: open the Combos tab.");
  return {b,why};
}

/* ---------- header: art, bracket, colors, gauges, role chips ---------- */
const PIPC={W:"#f4eecd",U:"#a9d3ef",B:"#b9b2ad",R:"#f0a284",G:"#9fcf9b"};
function gaugeSVG(v,big){const r=big?40:30,c=Math.PI*r,len=(v/100)*c;const w=big?100:76,h=big?58:44,cx=w/2,cy=h-4;
  return '<svg viewBox="0 0 '+w+' '+h+'" width="'+w+'" height="'+h+'" aria-hidden="true"><path d="M '+(cx-r)+' '+cy+' A '+r+' '+r+' 0 0 1 '+(cx+r)+' '+cy+'" class="gtrack"/><path d="M '+(cx-r)+' '+cy+' A '+r+' '+r+' 0 0 1 '+(cx+r)+' '+cy+'" class="gval" stroke-dasharray="'+len.toFixed(1)+' '+c.toFixed(1)+'"/></svg>';}
let labDetail=null;
function renderLabHead(){
  const H=document.getElementById("labHead");if(!H||!CUR)return;
  const a=analyze(),br=bracketOf(a),ci=deckCI(),cmd=[...CMDS][0];
  const ready=a.tagged>=a.total*0.9;
  const G=[["overall","Overall",a.overall,true],["power","Power",a.power],["mana","Mana health",a.mana],["health","Deck health",a.health]];
  H.innerHTML=
    '<div class="labart"'+(cmd?' style="background-image:linear-gradient(90deg,rgba(13,17,23,.15),rgba(13,17,23,.65)),url(\''+esc(artURL(finalName(cmd)))+'\')"':'')+'>'+
      '<button type="button" class="bkt" data-d="bracket" aria-label="Estimated bracket '+br.b+', '+BRACKETS[br.b]+'. Show why"><b>['+br.b+']</b><small>'+BRACKETS[br.b]+'</small></button>'+
      '<div class="labcap"><small>Estimated bracket</small><span class="pips">'+(ci.length?ci:["C"]).map(c=>'<i style="background:'+(PIPC[c]||"#ccc")+'">'+c+'</i>').join("")+'</span></div></div>'+
    '<div class="labgauges">'+G.map(([k,l,v,big])=>'<button type="button" class="gauge'+(big?" big":"")+(ready?"":" wait")+'" data-d="'+k+'" aria-label="'+l+' '+(ready?v:"not ready")+'. Show how it is calculated">'+gaugeSVG(ready?v:0,big)+'<b>'+(ready?v:"…")+'</b><small>'+l+'</small></button>').join("")+'</div>'+
    '<div class="labroles"><span class="lbl">Roles</span>'+ROLE_TAGS.filter(t=>t.min||a.cnt[t.k]).map(t=>'<button type="button" class="rchip'+(ready&&t.min&&a.cnt[t.k]<t.min?" low":"")+(extF&&extF.id==="role-"+t.k?" on":"")+'" data-role="'+t.k+'"'+(ready?'':' disabled')+'>'+(ready&&t.min&&a.cnt[t.k]<t.min?'<i aria-hidden="true"></i>':'')+t.label+' <b>'+(ready?a.cnt[t.k]:"–")+'</b>'+(t.min?'<span class="tgt">/'+t.min+'</span>':'')+'</button>').join("")+'</div>'+
    (LAB.prog?'<p class="labprog" role="status">'+esc(LAB.prog)+'</p>':'')+
    '<div class="labdetail" id="labDetail"'+(labDetail?'':' hidden')+'></div>';
  if(labDetail)renderDetail(a,br);
}
function renderDetail(a,br){const D=document.getElementById("labDetail");if(!D)return;const row=(l,v,n)=>'<li><span>'+l+'</span><b>'+v+'</b>'+(n?'<small>'+n+'</small>':'')+'</li>';let h="";
  if(labDetail==="bracket")h='<h4>Why bracket '+br.b+'</h4><ul class="why">'+br.why.map(w=>'<li>'+esc(w)+'</li>').join("")+'</ul><p class="note">An estimate from the published bracket rules: Game Changers, mass land denial, extra turns, tutors, and the bracket Commander Spellbook gives each combo. It cannot judge how early your combos land.</p>';
  if(labDetail==="mana")h='<h4>Mana health '+a.mana+'</h4><ul class="calc">'+row("Lands",a.lands,"target "+a.targetLands+" with "+a.cnt.ramp+" ramp · score "+Math.round(a.landS))+row("Ramp",a.cnt.ramp,"10 or more is full marks · score "+Math.round(a.rampS))+row("Average mana value",a.avg.toFixed(2),(HAS_EMI()?"after the Ur-Dragon discount · ":"")+"3.0 or lower is full marks · score "+Math.round(a.curveS))+'</ul><p class="note">Weights: lands 40%, ramp 35%, curve 25%.</p>';
  if(labDetail==="health")h='<h4>Deck health '+a.health+'</h4><ul class="calc">'+a.parts.map(([k,t,w])=>{const T=ROLE_TAGS.find(x=>x.k===k);return row(T.label,a.cnt[k],"target "+t+" · weight "+Math.round(w*100)+"%");}).join("")+'</ul><p class="note">Each role scores its share of the target, capped at 100%.</p>';
  if(labDetail==="power")h='<h4>Power '+a.power+'</h4><ul class="calc">'+row("Game Changers",a.cnt.gc,"+6 each, up to 4")+row("Tutors",a.cnt.tutor,"+3 each, up to 5")+row("Two-card combos",LAB.match?a.two:"not checked","+12 if any")+row("Ramp",a.cnt.ramp,"+1.5 each, up to 15")+row("Average mana value",a.avg.toFixed(2),"+10 per point under 3.6")+'</ul><p class="note">A rough guide made for this app, starting from 35. It is not the score other sites show.</p>';
  if(labDetail==="overall")h='<h4>Overall '+a.overall+'</h4><ul class="calc">'+row("Deck health",a.health,"40%")+row("Mana health",a.mana,"35%")+row("Power",a.power,"25%")+'</ul><p class="note">Roles come from Scryfall\'s card tags, so a card can count for more than one role. '+a.tagged+' of '+a.total+' cards are tagged.</p>';
  D.innerHTML=h+'<button type="button" class="ghostbtn" data-d="close">Close</button>';}
document.addEventListener("click",e=>{const H=e.target.closest("#labHead");if(!H)return;
  const d=e.target.closest("[data-d]");if(d){labDetail=(d.dataset.d==="close"||labDetail===d.dataset.d)?null:d.dataset.d;renderLabHead();return;}
  const rc=e.target.closest("[data-role]");if(rc){const k=rc.dataset.role,T=ROLE_TAGS.find(t=>t.k===k);
    extF=(extF&&extF.id==="role-"+k)?null:{id:"role-"+k,label:"Role: "+T.label,pred:x=>hasRole(x.name,k)};setDTab("cards");update();renderLabHead();
    document.getElementById("tbl").scrollIntoView({block:"start",behavior:"smooth"});}});

/* ---------- deck sub-tabs ---------- */
let DTAB=lsGet(NS+"-dtab")||"cards";if(!["cards","sug","combo","stats"].includes(DTAB))DTAB="cards";
function setDTab(t){DTAB=t;lsSet(NS+"-dtab",t);document.getElementById("vDeck").dataset.tab=t;
  document.querySelectorAll("#vDeck [data-dtab]").forEach(el=>el.hidden=el.dataset.dtab!==t);
  document.querySelectorAll("#dtabs [data-t]").forEach(b=>b.setAttribute("aria-selected",b.dataset.t===t));
  if(t==="sug")openSug();if(t==="combo")openCombos();if(t==="stats")openAnalytics();}
document.getElementById("dtabs").addEventListener("click",e=>{const b=e.target.closest("[data-t]");if(b)setDTab(b.dataset.t);});

/* ---------- maybeboard ---------- */
const maybe=()=>{CUR.maybe=CUR.maybe||[];return CUR.maybe;};
function toMaybe(n){if(!maybe().includes(n)){maybe().push(n);saveDecks();}renderMaybe();flash(n+" is on the maybeboard.");}
function addToDeck(n,roleK){const T=ROLE_TAGS.find(t=>t.k===roleK);let cat=T&&DECK.map(d=>d[0]).find(c=>T.cat.test(c));
  if(!cat){const m=cardMeta(n);cat=(m&&m.type&&typeof typeCat==="function")?typeCat(m.type):"Added";}
  if(deckIndex.has(norm(n))){flash(n+" is already in the deck.");return;}
  addToCat(n,cat);CUR.maybe=maybe().filter(x=>x!==n);CUR.src=null;saveDecks();
  try{sessionStorage.setItem(NS+"-msg",n+" added to "+cat+". Mark its status in the Cards tab.");sessionStorage.setItem(NS+"-focus",JSON.stringify({y:window.scrollY}))}catch(e){}
  lsSet(NS+"-view","deck");history.replaceState(null,"","#deck");location.reload();}
function renderMaybe(){const M=document.getElementById("maybeBox");if(!M)return;const L=maybe();M.hidden=!L.length;
  M.innerHTML='<span class="lbl">Maybeboard <b>'+L.length+'</b></span>'+L.map(n=>'<span class="mchip"><button type="button" class="mv" data-view="'+esc(n)+'">'+esc(n)+'</button><button type="button" data-madd="'+esc(n)+'" aria-label="Add '+esc(n)+' to the deck">Add</button><button type="button" data-mdel="'+esc(n)+'" aria-label="Remove '+esc(n)+' from the maybeboard">×</button></span>').join("");}

/* ---------- suggestions (EDHREC + Scryfall tags) ---------- */
const SUG={list:"",role:"",q:"",sort:"syn",own:false,noGC:false,roleCards:{},loading:false};
const edhSlug=n=>front(n).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9\s-]/g,"").trim().replace(/[\s-]+/g,"-");
async function loadEDH(){
  const cmd=[...CMDS].map(finalName);if(!cmd.length){LAB.edhErr="Set a commander to get suggestions.";return;}
  const slug=cmd.length>1?cmd.map(edhSlug).sort().join("-"):edhSlug(cmd[0]);
  if(LAB.edh&&LAB.edh.slug===slug)return;
  try{const r=await fetch("https://json.edhrec.com/pages/commanders/"+slug+".json");if(!r.ok)throw new Error(r.status);const j=await r.json();
    const lists=((j.container&&j.container.json_dict&&j.container.json_dict.cardlists)||[]).map(l=>({h:l.header,tag:l.tag,cards:(l.cardviews||[]).map(c=>({name:c.name,id:c.id,v:c.image_version,syn:c.synergy||0,inc:c.potential_decks?c.num_decks/c.potential_decks:0,decks:c.num_decks||0,isNew:l.tag==="newcards"}))})).filter(l=>l.cards.length);
    const by={};lists.forEach(l=>l.cards.forEach(c=>{if(!by[norm(c.name)])by[norm(c.name)]=c;}));
    LAB.edh={slug,lists,by,decks:(j.container&&j.container.json_dict&&j.container.json_dict.card&&j.container.json_dict.card.num_decks)||null,name:cmd.join(" + ")};LAB.edhErr=null;
  }catch(e){LAB.edhErr="EDHREC has no page for "+cmd.join(" + ")+", or it could not be reached. Role suggestions below still work.";LAB.edh={slug,lists:[],by:{}};}
}
async function loadGC(){if(LAB.gc&&Date.now()-LAB.gc.t<14*864e5)return;
  try{const c=await sfSearch("is:gamechanger",2);LAB.gc={t:Date.now(),n:c.map(x=>nk(x.name))};lsSet(NS+"-gc",LAB.gc);}catch(e){}}
const isGC=n=>!!(LAB.gc&&LAB.gc.n.includes(nk(n)));
function ownedSet(){const s=new Set();collRecords().forEach(r=>{if(r.ownedQty>0||r.status==="have")s.add(nk(r.name));});return s;}
async function openSug(){renderMaybe();const B=document.getElementById("sugGrid");
  if(!LAB.edh){B.innerHTML='<p class="w-empty">Loading suggestions from EDHREC…</p>';await Promise.all([loadEDH(),loadGC()]);}
  if(!SUG.list&&LAB.edh.lists.length)SUG.list=(LAB.edh.lists.find(l=>l.tag==="highsynergycards")||LAB.edh.lists[0]).tag;
  renderSug();}
async function loadRole(k){if(SUG.roleCards[k])return;const T=ROLE_TAGS.find(t=>t.k===k);const ci=deckCI().join("").toLowerCase()||"c";
  SUG.loading=true;renderSug();
  try{const cs=await sfSearch(T.q+" id<="+ci+" legal:commander -t:basic order:edhrec",1);
    SUG.roleCards[k]=cs.map(c=>{rememberImg(c.name,imgOfCard(c));const e=LAB.edh&&LAB.edh.by[norm(c.name)];
      return {name:c.name,img:imgOfCard(c),syn:e?e.syn:null,inc:e?e.inc:null,decks:e?e.decks:null,rank:c.edhrec_rank||null,eur:c.prices&&c.prices.eur?+c.prices.eur:null};});saveImgs();}
  catch(e){SUG.roleCards[k]=[];flash("Scryfall could not be reached. Try again in a moment.");}
  SUG.loading=false;renderSug();}
function renderSug(){
  const T=document.getElementById("sugTabs"),RC=document.getElementById("sugRoles"),B=document.getElementById("sugGrid"),I=document.getElementById("sugInfo");if(!T)return;
  const E=LAB.edh||{lists:[]};const a=analyze();
  T.innerHTML=E.lists.map(l=>'<button type="button" role="tab" data-list="'+esc(l.tag)+'" aria-selected="'+(!SUG.role&&SUG.list===l.tag)+'">'+esc(l.h.replace(/ Cards$/,""))+'</button>').join("");
  RC.innerHTML='<span class="lbl">Roles</span>'+ROLE_TAGS.map(t=>{const low=t.min&&a.cnt[t.k]<t.min&&a.tagged;return '<button type="button" class="rchip'+(low?" low":"")+(SUG.role===t.k?" on":"")+'" data-srole="'+t.k+'">'+(low?'<i aria-hidden="true"></i>':'')+t.label+(a.tagged?' <b>'+a.cnt[t.k]+'</b>':'')+'</button>';}).join("");
  const inDeck=new Set(finalCards().map(c=>norm(c.name)).concat(finalCards().map(c=>nk(c.name))));
  let items;
  if(SUG.role){items=SUG.roleCards[SUG.role]||[];}
  else{const L=E.lists.find(l=>l.tag===SUG.list);items=L?L.cards.map(c=>Object.assign({img:cdnImg(c.id,c.v)},c)):[];}
  const own=SUG.own?ownedSet():null;
  items=items.filter(c=>!inDeck.has(norm(c.name))&&!inDeck.has(nk(c.name)));
  if(SUG.q){const t=norm(SUG.q);items=items.filter(c=>norm(c.name).includes(t));}
  if(own)items=items.filter(c=>own.has(nk(c.name)));
  if(SUG.noGC)items=items.filter(c=>!isGC(c.name));
  const key={syn:c=>-(c.syn==null?-9:c.syn),inc:c=>-(c.inc||0),name:c=>0}[SUG.sort];
  if(SUG.sort==="name")items.sort((x,y)=>x.name.localeCompare(y.name));else if(!SUG.role||SUG.sort!=="syn"||items.some(c=>c.syn!=null))items.sort((x,y)=>key(x)-key(y));
  const src=SUG.role?"Scryfall cards tagged "+ROLE_TAGS.find(t=>t.k===SUG.role).label.toLowerCase()+" in your colors, most played first":(E.name?"EDHREC, "+(E.decks?E.decks.toLocaleString("en")+" "+E.name+" decks":E.name):"");
  I.textContent=(LAB.edhErr&&!SUG.role?LAB.edhErr+" ":"")+(src?"Source: "+src+". ":"")+items.length+" card"+(items.length===1?"":"s")+" not in the deck.";
  if(SUG.loading){B.innerHTML='<p class="w-empty">Loading…</p>';return;}
  if(!items.length){B.innerHTML='<p class="w-empty">'+(own?"None of these are in your collection.":"Nothing to suggest here.")+'</p>';return;}
  const pct=v=>(v>0?"+":"")+Math.round(v*100)+"%";
  B.innerHTML=items.slice(0,60).map(c=>{const gc=isGC(c.name),ow=own||ownedSet();
    return '<article class="stile"><button type="button" class="simg" data-view="'+esc(c.name)+'" aria-label="View '+esc(c.name)+'"><img loading="lazy" alt="" src="'+esc(c.img||labImg(c.name))+'">'+
      '<span class="sbad">'+(c.isNew?'<em class="new">New</em>':'')+(gc?'<em class="gcb">Game Changer</em>':'')+(ow.has(nk(c.name))?'<em class="own">Owned</em>':'')+'</span></button>'+
      '<b class="sname">'+esc(c.name)+'</b><small class="sstat">'+(c.syn!=null?'<span class="syn'+(c.syn>=0.2?" hi":"")+'">'+pct(c.syn)+' synergy</span>':'')+(c.inc?'<span>'+Math.round(c.inc*100)+'% of decks</span>':'')+(c.syn==null&&!c.inc&&c.rank?'<span>EDHREC rank '+c.rank.toLocaleString("en")+'</span>':'')+'</small>'+
      '<span class="sact"><button type="button" class="btn-acc" data-add="'+esc(c.name)+'">Add</button><button type="button" data-maybe="'+esc(c.name)+'"'+(maybe().includes(c.name)?' disabled':'')+'>'+(maybe().includes(c.name)?"On maybeboard":"Maybe")+'</button></span></article>';}).join("")+
    (items.length>60?'<p class="w-empty">Showing the first 60. Search or pick a role to narrow down.</p>':'');
}
(function(){const S=document.getElementById("dtSug");if(!S)return;
  S.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;
    if(b.dataset.list){SUG.list=b.dataset.list;SUG.role="";renderSug();}
    else if(b.dataset.srole){const k=b.dataset.srole;SUG.role=SUG.role===k?"":k;if(SUG.role)loadRole(k);else renderSug();}
    else if(b.dataset.add){addToDeck(b.dataset.add,SUG.role);}
    else if(b.dataset.madd){addToDeck(b.dataset.madd,"");}
    else if(b.dataset.mdel){CUR.maybe=maybe().filter(x=>x!==b.dataset.mdel);saveDecks();renderMaybe();renderSug();}
    else if(b.dataset.maybe){toMaybe(b.dataset.maybe);renderSug();}
    else if(b.dataset.view){fill(sheet,{name:b.dataset.view});sheet.classList.add("open");}});
  document.getElementById("sugQ").addEventListener("input",e=>{SUG.q=e.target.value.trim();renderSug();});
  document.getElementById("sugSort").addEventListener("change",e=>{SUG.sort=e.target.value;renderSug();});
  document.getElementById("sugOwn").addEventListener("change",e=>{SUG.own=e.target.checked;renderSug();});
  document.getElementById("sugGC").addEventListener("change",e=>{SUG.noGC=e.target.checked;renderSug();});})();

/* ---------- combos (Commander Spellbook data, rebuilt by the repo's data job) ---------- */
const COMBO_URLS=(location.hostname.endsWith("github.io")?["data/combos.json"]:[]).concat(["https://ffru333.github.io/commander-lab/desk/data/combos.json","https://raw.githubusercontent.com/FFru333/commander-lab/gh-pages/desk/data/combos.json"]);
async function loadCombos(){if(LAB.combos||LAB.comboLoading)return LAB.comboLoading;
  LAB.comboLoading=(async()=>{for(const u of COMBO_URLS){try{const r=await fetch(u);if(!r.ok)continue;LAB.combos=await r.json();LAB.comboErr=null;break;}catch(e){}}
    if(!LAB.combos)LAB.comboErr="The combo data could not be downloaded. Check your connection and open this tab again.";
    LAB.comboLoading=null;})();return LAB.comboLoading;}
function matchCombos(){const D=LAB.combos;if(!D||!CUR)return null;
  const have=new Set();finalCards().forEach(c=>{have.add(norm(c.name));have.add(nk(c.name));});
  const cmdS=new Set([...CMDS].map(n=>nk(finalName(n))));
  const ciS=new Set(deckCI());const inD=D.cards.map(n=>have.has(norm(n))||have.has(nk(n)));
  const out={inDeck:[],oneAway:[]};
  D.v.forEach(([id,cs,fs,pop,ident,br,mv,req,cm])=>{
    if(ident!=="C"&&![...ident].every(c=>ciS.has(c)))return;
    let miss=-1,nm=0;for(const i of cs){if(!inD[i]){nm++;miss=i;if(nm>1)return;}}
    if(cm&&cm.some(i=>!cmdS.has(nk(D.cards[i]))))return;
    const v={id,cards:cs.map(i=>D.cards[i]),feats:fs.map(i=>D.feats[i]),pop,br,mv,req,miss:nm?D.cards[miss]:null};
    (nm?out.oneAway:out.inDeck).push(v);});
  return out;}
const CB={show:"in",limit:30};
async function openCombos(){const B=document.getElementById("comboList");
  if(!LAB.combos){B.innerHTML='<p class="w-empty">Loading combo data (about 2 MB the first time)…</p>';await loadCombos();}
  if(LAB.combos&&!LAB.match){LAB.match=matchCombos();renderLabHead();}
  renderCombos();}
function renderCombos(){const B=document.getElementById("comboList"),T=document.getElementById("comboTabs"),I=document.getElementById("comboInfo");if(!B)return;
  if(LAB.comboErr){B.innerHTML='<p class="w-empty">'+esc(LAB.comboErr)+'</p>';T.innerHTML="";I.textContent="";return;}
  const M=LAB.match;if(!M)return;
  T.innerHTML='<button type="button" role="tab" data-cshow="in" aria-selected="'+(CB.show==="in")+'">In your deck <b>'+M.inDeck.length+'</b></button><button type="button" role="tab" data-cshow="one" aria-selected="'+(CB.show==="one")+'">One card away <b>'+M.oneAway.length+'</b></button>';
  const L=(CB.show==="in"?M.inDeck:M.oneAway).slice().sort((a,b)=>b.pop-a.pop);
  I.textContent="Source: Commander Spellbook, data from "+(LAB.combos.built?new Date(LAB.combos.built).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}):"their latest export")+". Most played first. Tap a combo for the steps.";
  if(!L.length){B.innerHTML='<p class="w-empty">'+(CB.show==="in"?"No known combo is fully in the deck.":"No combo is one card away.")+'</p>';return;}
  const shown=L.slice(0,CB.limit);resolveImgs(shown.flatMap(v=>v.cards)).then(()=>{document.querySelectorAll("#comboList img[data-n]").forEach(im=>{const u=LAB.img[nk(im.dataset.n)];if(u&&im.src!==u)im.src=u;});});
  B.innerHTML=shown.map(v=>'<article class="cbx'+(v.miss?" away":"")+'">'+
    '<div class="cimgs">'+v.cards.map(n=>'<button type="button" class="cimg'+(n===v.miss?" miss":"")+'" data-view="'+esc(n)+'" aria-label="View '+esc(n)+'"><img loading="lazy" alt="" data-n="'+esc(n)+'" src="'+esc(labImg(n))+'">'+(n===v.miss?'<em>Missing</em>':'')+'</button>').join("")+'</div>'+
    '<div class="cbody"><b>'+esc(v.feats.slice(0,3).join(" · ")||"Combo")+'</b>'+
      '<small class="cnames">'+v.cards.map(n=>'<span class="'+(n===v.miss?"m":"")+'">'+esc(n)+'</span>').join(" + ")+'</small>'+
      (v.req&&v.req.length?'<small class="creq">Also needs: '+esc(v.req.join(", "))+'</small>':'')+
      '<small class="cmeta">'+(v.pop?v.pop.toLocaleString("en")+" decks":"")+(CSB_BR[v.br]?" · fits bracket "+CSB_BR[v.br]+(CSB_BR[v.br]<4?" and up":""):"")+(v.mv!=null?" · "+v.mv+" mana to start":"")+'</small>'+
      '<span class="sact"><a class="btnlink" target="_blank" rel="noopener" href="https://commanderspellbook.com/combo/'+encodeURIComponent(v.id)+'/">Steps on Commander Spellbook</a>'+(v.miss?'<button type="button" data-maybe="'+esc(v.miss)+'"'+(maybe().includes(v.miss)?' disabled':'')+'>'+(maybe().includes(v.miss)?"On maybeboard":"Maybe "+esc(front(v.miss)))+'</button>':'')+'</span></div></article>').join("")+
    (L.length>CB.limit?'<button type="button" class="ghostbtn more" data-cmore="1">Show more ('+(L.length-CB.limit)+' left)</button>':'');
}
(function(){const S=document.getElementById("dtCombo");if(!S)return;
  S.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;
    if(b.dataset.cshow){CB.show=b.dataset.cshow;CB.limit=30;renderCombos();}
    else if(b.dataset.cmore){CB.limit+=30;renderCombos();}
    else if(b.dataset.maybe){toMaybe(b.dataset.maybe);renderCombos();}
    else if(b.dataset.view){fill(sheet,{name:b.dataset.view});sheet.classList.add("open");}});})();

/* ---------- start ---------- */
function renderLab(){renderLabHead();if(DTAB==="sug"&&LAB.edh)renderSug();if(DTAB==="stats")renderAnalytics();}
function startLab(){if(!CUR)return;renderLabHead();setDTab(DTAB);
  setTimeout(()=>{tagDeck(false);if(!LAB.combos)loadCombos().then(()=>{if(LAB.combos){LAB.match=matchCombos();renderLabHead();if(DTAB==="combo")renderCombos();}});},400);}
