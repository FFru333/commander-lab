/* ---------- deck analytics: power estimate, fingerprint, manabase, salt ---------- */
const AN={cards:lsGet(NS+"-cards")||{},salt:lsGet(NS+"-salt")||{},busy:false,saltBusy:false,prog:""};
const COLORS=["W","U","B","R","G"],CNAME={W:"White",U:"Blue",B:"Black",R:"Red",G:"Green",C:"Colorless"};
/* full card text from Scryfall /cards/collection (75 per call), cached for 60 days */
function slimCard(c){const f=c.card_faces||[];const ot=c.oracle_text!=null?c.oracle_text:f.map(x=>x.oracle_text||"").join("\n//\n");
  const mc=c.mana_cost!=null&&c.mana_cost!==""?c.mana_cost:(f[0]&&f[0].mana_cost)||"";
  return {n:c.name,tl:c.type_line||(f[0]&&f[0].type_line)||"",ot,mc,cmc:c.cmc||0,pm:c.produced_mana||[],kw:c.keywords||[],pw:c.power||(f[0]&&f[0].power)||null,ci:c.color_identity||[],t:Date.now()};}
async function loadCards(){const names=[...new Set(finalCards().map(c=>front(c.name)))];const old=Date.now()-60*864e5;
  const need=names.filter(n=>{const x=AN.cards[nk(n)];return !x||x.t<old;});if(!need.length)return true;
  for(let i=0;i<need.length;i+=75){AN.prog="Reading card text from Scryfall…";renderAnalytics();
    try{const r=await fetch("https://api.scryfall.com/cards/collection",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({identifiers:need.slice(i,i+75).map(n=>({name:n}))})});
      if(!r.ok)return false;const j=await r.json();(j.data||[]).forEach(c=>{const s=slimCard(c);AN.cards[nk(c.name)]=s;AN.cards[nk(front(c.name))]=s;});}catch(e){return false;}}
  try{lsSet(NS+"-cards",AN.cards);}catch(e){}return true;}
/* community salt (0–4) from EDHREC card pages, cached for 60 days */
async function loadSalt(){if(AN.saltBusy)return;const names=[...new Set(finalCards().map(c=>front(c.name)))].filter(n=>!/^(Plains|Island|Swamp|Mountain|Forest|Wastes)$/.test(n));
  const old=Date.now()-60*864e5;const need=names.filter(n=>{const x=AN.salt[nk(n)];return !x||x.t<old;});if(!need.length)return;
  AN.saltBusy=true;let done=0;
  for(const n of need){AN.prog="Reading salt scores from EDHREC… "+done+" / "+need.length;if(done%6===0)renderAnalytics();
    try{const r=await fetch("https://json.edhrec.com/pages/cards/"+edhSlug(n)+".json");if(r.ok){const j=await r.json();const c=j.container&&j.container.json_dict&&j.container.json_dict.card;
      AN.salt[nk(n)]={s:c&&typeof c.salt==="number"?c.salt:null,t:Date.now()};}else AN.salt[nk(n)]={s:null,t:Date.now()};}catch(e){}
    done++;await sleep(220);}
  try{lsSet(NS+"-salt",AN.salt);}catch(e){}AN.saltBusy=false;AN.prog="";renderAnalytics();}
const cardOf=n=>AN.cards[nk(n)]||null;
const isType=(c,t)=>new RegExp("\\b"+t+"\\b").test(c.tl.split(" // ")[0]);
const pipsOf=mc=>{const o={W:0,U:0,B:0,R:0,G:0};(mc.match(/\{[^}]+\}/g)||[]).forEach(s=>{COLORS.forEach(k=>{if(s.includes(k))o[k]++;});});return o;};
const level=(n,a,b,c)=>n===0?"None":n<a?"Light":n<b?"Moderate":n<c?"Solid":"Dense";
function analyzeDeck(){const F=finalCards(),cmds=[...CMDS].map(finalName);let known=0;
  const rows=F.map(f=>{const c=cardOf(f.name);if(c)known++;return {name:f.name,qty:f.qty||1,cmd:f.cmd,c,roles:rolesOf(f.name)||[]};});
  const R=rows.filter(r=>r.c);const q=r=>r.qty;const sum=(arr,fn)=>arr.reduce((a,r)=>a+(fn?fn(r):q(r)),0);
  const lands=R.filter(r=>isType(r.c,"Land")&&!isType(r.c,"Creature"));const nonland=R.filter(r=>!lands.includes(r)&&!r.cmd);
  const basics=lands.filter(r=>/\bBasic\b/.test(r.c.tl));const tapped=lands.filter(r=>/enters (the battlefield )?tapped/i.test(r.c.ot)&&!/unless|you may pay/i.test(r.c.ot));
  const fetches=lands.filter(r=>/search your library for an? .*land/i.test(r.c.ot)&&/sacrifice/i.test(r.c.ot));
  const types={Creatures:"Creature",Artifacts:"Artifact",Enchantments:"Enchantment",Instants:"Instant",Sorceries:"Sorcery",Planeswalkers:"Planeswalker",Battles:"Battle"};
  const comp={};Object.keys(types).forEach(k=>comp[k]=sum(nonland.filter(r=>isType(r.c,types[k]))));
  const perm=sum(nonland.filter(r=>/Creature|Artifact|Enchantment|Planeswalker|Battle/.test(r.c.tl.split(" // ")[0])));
  const nl=sum(nonland);const curve=[0,0,0,0,0,0,0,0];let mvs=0;nonland.forEach(r=>{const m=Math.floor(r.c.cmc||0);curve[Math.min(7,m)]+=q(r);mvs+=(r.c.cmc||0)*q(r);});
  const avg=nl?mvs/nl:0,peak=curve.indexOf(Math.max(...curve)),cheap=sum(nonland.filter(r=>(r.c.cmc||0)<=2)),fin=sum(nonland.filter(r=>(r.c.cmc||0)>=6));
  const hasMana=r=>/\{T\}[^.]*: Add|Add \{|Add one mana|Add (two|three) mana/i.test(r.c.ot)||(r.c.pm&&r.c.pm.length);
  const rocks=nonland.filter(r=>isType(r.c,"Artifact")&&!isType(r.c,"Creature")&&hasMana(r));
  const dorks=nonland.filter(r=>isType(r.c,"Creature")&&/\{T\}[^.]*: Add/i.test(r.c.ot));
  const rituals=nonland.filter(r=>(isType(r.c,"Instant")||isType(r.c,"Sorcery"))&&/Add \{|Add (two|three|X) mana|Add one mana/i.test(r.c.ot));
  const treas=nonland.filter(r=>/Treasure token/i.test(r.c.ot));
  const landRamp=nonland.filter(r=>/search your library for (up to )?(a|an|two|one|three|X)? ?(basic )?(land|Forest|Plains|Island|Swamp|Mountain)/i.test(r.c.ot)&&/onto the battlefield|put (it|them|one) onto|into your hand/i.test(r.c.ot)||/put (a|up to one|any number of) land cards? from your hand onto the battlefield/i.test(r.c.ot));
  const reducers=nonland.filter(r=>/(cost|costs) \{\d+\} less|cost \{1\} less/i.test(r.c.ot));
  const has=k=>sum(R.filter(r=>r.roles.includes(k)));
  const instant=nonland.filter(r=>isType(r.c,"Instant")||r.c.kw.includes("Flash"));
  const etb=nonland.filter(r=>/\bwhen(ever)? [^.]*\benters\b/i.test(r.c.ot)),dies=nonland.filter(r=>/\bdies\b/i.test(r.c.ot)),atk=nonland.filter(r=>/\bwhenever [^.]*attacks\b/i.test(r.c.ot));
  const reanim=nonland.filter(r=>/from (your|a) graveyard (on)?to the battlefield|return target [^.]*creature card[^.]* to the battlefield/i.test(r.c.ot));
  const poison=nonland.filter(r=>r.c.kw.some(k=>/Infect|Toxic|Poisonous/i.test(k))||/poison counter/i.test(r.c.ot));
  /* typal: most common creature subtype */
  const st={};R.filter(r=>isType(r.c,"Creature")).forEach(r=>{const sub=(r.c.tl.split(" // ")[0].split("—")[1]||"").trim().split(/\s+/).filter(Boolean);sub.forEach(s=>st[s]=(st[s]||0)+q(r));});
  const tribe=Object.keys(st).sort((a,b)=>st[b]-st[a])[0]||null;const creatures=sum(R.filter(r=>isType(r.c,"Creature")&&!r.cmd));
  const tribeN=tribe?sum(R.filter(r=>!r.cmd&&isType(r.c,"Creature")&&new RegExp("\\b"+tribe+"\\b").test(r.c.tl))):0;
  const payoffs=tribe?nonland.filter(r=>new RegExp("\\b"+tribe+"s?\\b","i").test(r.c.ot)&&/you control|spells?|cast/i.test(r.c.ot)):[];
  /* colours: sources vs demand */
  const src={W:0,U:0,B:0,R:0,G:0},dem={W:0,U:0,B:0,R:0,G:0};
  lands.concat(rocks,dorks).forEach(r=>{const pm=r.c.pm||[];COLORS.forEach(k=>{if(pm.includes(k))src[k]+=q(r);});});
  nonland.forEach(r=>{const p=pipsOf(r.c.mc);COLORS.forEach(k=>dem[k]+=p[k]*q(r));});
  const M=LAB.match;const combos=M?M.inDeck:[];const two=combos.filter(v=>v.cards.length===2).length;
  return {known,total:rows.length,lands,basics,tapped,fetches,comp,perm,nl,curve,avg,peak,cheap,fin,rocks,dorks,rituals,treas,landRamp,reducers,
    draw:has("draw"),recur:has("recur"),removal:has("removal"),wipe:has("wipe"),counter:has("counter"),protect:has("protect"),gyhate:has("gyhate"),tutor:has("tutor"),gc:has("gc"),mld:has("mld"),xturn:has("xturn"),
    instant,etb,dies,atk,reanim,poison,tribe,tribeN,creatures,payoffs,src,dem,combos,two,cmds,rolesReady:rows.filter(r=>rolesOf(r.name)).length>=rows.length*0.9};}
/* power estimate: four pillars, each 0–100, made for this app */
function pillars(a){const ramp=a.rocks.length+a.dorks.length+a.rituals.length+a.landRamp.length+a.reducers.length;
  const cons=clamp(ramp/12*40+Math.min(a.draw,12)/10*40+Math.min(a.tutor,4)/4*20);
  const eff=clamp(100-Math.max(0,a.avg-2.6)*32+Math.min(a.cheap,20)*1.2-a.tapped.length*2);
  const inter=clamp((a.removal*5+a.counter*5+a.wipe*6+a.protect*3)/1.1);
  const win=clamp(a.combos.length*12+a.two*10+Math.min(a.fin,12)*3+a.poison.length*6+(a.tribeN>=20?15:0));
  const pl=Math.round(((cons*.3+eff*.25+inter*.2+win*.25)/10+Math.min(a.gc,4)*0.4)*10)/10;
  return {cons,eff,inter,win,pl:Math.min(10,pl),ramp};}
const plName=p=>p<3?"Casual":p<5?"Focused casual":p<7?"Upgraded":p<8.5?"Optimized":p<9.5?"High power":"cEDH";
/* salt: EDHREC card scores plus what usually makes a table groan */
function saltOf(a){const F=finalCards();const per=F.map(f=>{const x=AN.salt[nk(front(f.name))];return {name:f.name,s:x&&x.s!=null?x.s:null};}).filter(x=>x.s!=null).sort((x,y)=>y.s-x.s);
  const total=per.reduce((t,x)=>t+x.s,0);
  const src=[["Board wipes",a.wipe,"wipe"],["Infinite combos",a.combos.length,"combo"],["Poison and infect",a.poison.length,"poison"],["Mass land denial",a.mld,"mld"],["Extra turns",a.xturn,"xturn"],["Game Changers",a.gc,"gc"],["Tutors",a.tutor,"tutor"]].filter(x=>x[1]>0);
  const callouts=[];if(a.combos.length)callouts.push(["Runs infinite combos",a.combos.slice(0,2).map(v=>v.cards.join(" + ")).join("; ")]);
  if(a.poison.length)callouts.push(["Wins through poison",a.poison.map(r=>r.name).join(", ")]);
  if(a.mld)callouts.push(["Mass land denial",""]);if(a.xturn)callouts.push(["Extra turns",""]);
  return {per,total,src,callouts,known:per.length};}
/* ---------- view ---------- */
const bar=(v,max,cls)=>'<span class="anbar'+(cls?" "+cls:"")+'"><i style="width:'+clamp(v/max*100).toFixed(0)+'%"></i></span>';
const tile=(t,body,sub)=>'<section class="antile"><h4>'+t+'</h4>'+(sub?'<p class="ansub">'+sub+'</p>':'')+body+'</section>';
const kv=(k,v,extra)=>'<div class="ankv"><span>'+k+'</span><b>'+v+'</b>'+(extra||"")+'</div>';
function renderAnalytics(){const B=document.getElementById("anBody");if(!B||!CUR||DTAB!=="stats")return;
  const a=analyzeDeck();
  if(a.known<a.total*0.8){B.innerHTML='<p class="w-empty">'+esc(AN.prog||"Loading card data…")+'</p>';return;}
  const P=pillars(a),S=saltOf(a);const g=[["Consistency",P.cons],["Efficiency",P.eff],["Interaction",P.inter],["Win conditions",P.win]];
  const nlands=a.lands.reduce((t,r)=>t+r.qty,0),nb=a.basics.reduce((t,r)=>t+r.qty,0);
  const ci=deckCI();const maxDem=Math.max(1,...COLORS.map(k=>a.dem[k]));
  B.innerHTML=(AN.prog?'<p class="labprog" role="status">'+esc(AN.prog)+'</p>':'')+
  '<div class="anhero"><div><p class="ankick">Power level · estimate</p><h3>'+plName(P.pl)+'</h3><p class="ansub">'+(a.rolesReady?'':'Roles still loading: numbers will settle in a moment. ')+'Our own scale from the four pillars below, not the number another site gives.</p>'+
    '<div class="anscale"><i style="left:'+(P.pl*10)+'%"></i></div><div class="anticks"><span>0</span><span>3</span><span>5</span><span>7</span><span>10</span></div></div>'+
    '<div class="anpl"><small>Power level</small><b>'+P.pl.toFixed(1)+'</b><small>/ 10</small></div></div>'+
  '<div class="anpillars">'+g.map(([k,v])=>'<div class="anp"><span>'+k+'</span>'+bar(v,100,"hot")+'<b>'+Math.round(v)+'</b></div>').join("")+'</div>'+
  '<h3 class="anh">Deck fingerprint</h3><div class="angrid">'+
   tile("Manabase",kv("Lands",nlands)+'<div class="anbasics"><i style="width:'+(nlands?nb/nlands*100:0)+'%"></i><span>'+nb+' basic · '+(nlands-nb)+' nonbasic</span></div>'+kv("Enter tapped",a.tapped.length)+kv("Fetch lands",a.fetches.length),ci.join("")||"Colorless")+
   tile("Composition",Object.keys(a.comp).filter(k=>a.comp[k]).map(k=>'<div class="anrow"><span>'+k+'</span>'+bar(a.comp[k],Math.max(...Object.values(a.comp)))+'<b>'+a.comp[k]+'</b></div>').join(""),a.nl+" nonland · "+Math.round(a.perm/Math.max(1,a.nl)*100)+"% permanents")+
   tile("Curve and speed",'<div class="ancurve">'+a.curve.map((v,i)=>'<span title="'+v+' cards"><i style="height:'+(v/Math.max(...a.curve)*100)+'%"></i><b>'+(i===7?"7+":i)+'</b></span>').join("")+'</div>'+kv("Average mana value",a.avg.toFixed(2))+kv("Cheap (2 or less)",a.cheap)+kv("Finishers (6+)",a.fin),HAS_EMI()?"Before the Ur-Dragon discount":"")+
   tile("Ramp",kv("Mana rocks",a.rocks.length)+kv("Mana creatures",a.dorks.length)+kv("Land ramp",a.landRamp.length)+kv("Treasure makers",a.treas.length)+kv("Rituals",a.rituals.length)+kv("Cost reducers",a.reducers.length),P.ramp+" pieces in total")+
   tile("Card advantage",kv("Card draw",a.draw,'<em>'+level(a.draw,4,8,12)+'</em>')+kv("Recursion",a.recur,'<em>'+level(a.recur,2,4,6)+'</em>')+kv("Tutors",a.tutor))+
   tile("Interaction",kv("Counterspells",a.counter,'<em>'+level(a.counter,2,4,6)+'</em>')+kv("Removal",a.removal,'<em>'+level(a.removal,4,8,12)+'</em>')+kv("Board wipes",a.wipe,'<em>'+level(a.wipe,2,3,5)+'</em>')+kv("Protection",a.protect,'<em>'+level(a.protect,2,4,6)+'</em>')+kv("Graveyard hate",a.gyhate,'<em>'+level(a.gyhate,1,2,4)+'</em>'))+
   tile("Timing",kv("Instant speed",a.instant.length)+kv("Sorcery speed",a.nl-a.instant.length),Math.round(a.instant.length/Math.max(1,a.nl)*100)+"% of nonland cards at instant speed")+
   tile("Win conditions",kv("Combos in the deck",a.combos.length)+kv("Two-card combos",a.two)+kv("Big threats (6+)",a.fin)+kv("Poison",a.poison.length),a.combos.length?"Combo, with combat backup":"Combat")+
   tile("Engine",kv("Enters triggers",a.etb.length)+kv("Dies triggers",a.dies.length)+kv("Attack triggers",a.atk.length)+kv("Reanimation",a.reanim.length))+
   tile("Typal",a.tribe?kv(a.tribe+"s",a.tribeN)+kv("Share of creatures",Math.round(a.tribeN/Math.max(1,a.creatures)*100)+"%")+kv("Payoffs that name them",a.payoffs.length):'<p class="ansub">No dominant creature type.</p>')+
  '</div>'+
  '<h3 class="anh">Colour demand and sources</h3><div class="ancolors">'+COLORS.filter(k=>ci.includes(k)||a.dem[k]).map(k=>{const ratio=a.dem[k]?a.src[k]/a.dem[k]:0;
    return '<div class="ancol"><span class="pip p'+k+'">'+k+'</span><div><div class="anrow"><span>Pips</span>'+bar(a.dem[k],maxDem)+'<b>'+a.dem[k]+'</b></div><div class="anrow"><span>Sources</span>'+bar(a.src[k],Math.max(1,...COLORS.map(x=>a.src[x])),"src")+'<b>'+a.src[k]+'</b></div></div><em class="'+(a.src[k]<12?"low":"")+'">'+(a.src[k]<12?"Thin":"OK")+'</em></div>';}).join("")+
   '</div><p class="note">Sources are lands, rocks and mana creatures that can make the colour. Around 12 or more per main colour is a common rule of thumb, not a hard limit.</p>'+
  '<h3 class="anh">Salt</h3>'+(S.known?'<div class="ansalt"><div class="ansaltbig"><b>'+S.total.toFixed(1)+'</b><small>deck salt, sum of EDHREC card scores (0–4 each), '+S.known+' cards rated</small></div>'+
    '<div class="ansrc">'+(S.src.length?S.src.map(([k,n])=>'<span class="chipk">'+k+' <b>'+n+'</b></span>').join(""):'<span class="ansub">No classic salt sources.</span>')+'</div></div>'+
    '<div class="angrid two"><section class="antile"><h4>Saltiest cards</h4>'+S.per.slice(0,8).map(x=>'<div class="anrow"><span>'+esc(x.name)+'</span>'+bar(x.s,4,"salt")+'<b>'+x.s.toFixed(2)+'</b></div>').join("")+
    '<p class="ansub">Dropping the top 3 cuts the total by '+(S.total?Math.round(S.per.slice(0,3).reduce((t,x)=>t+x.s,0)/S.total*100):0)+'%.</p></section>'+
    '<section class="antile"><h4>Tell the table first</h4>'+(S.callouts.length?S.callouts.map(([k,v])=>'<div class="ancall"><b>'+k+'</b>'+(v?'<small>'+esc(v)+'</small>':'')+'</div>').join(""):'<p class="ansub">Nothing that usually needs a rule-zero talk.</p>')+'</section></div>'
    :'<p class="w-empty">'+(AN.saltBusy?esc(AN.prog):"Salt scores load from EDHREC when you open this tab.")+'</p>')+
  '<p class="note">Sources: card text from Scryfall, roles from Scryfall tags, combos from Commander Spellbook, salt from EDHREC. Power level and pillars are our own formulas; levels like "Dense" compare to a typical Commander deck.</p>';}
async function openAnalytics(){renderAnalytics();const ok=await loadCards();renderAnalytics();if(!ok){const B=document.getElementById("anBody");if(B&&!Object.keys(AN.cards).length)B.innerHTML='<p class="w-empty">Scryfall could not be reached. Try again in a moment.</p>';}
  if(LAB.combos&&!LAB.match){LAB.match=matchCombos();}else if(!LAB.combos)loadCombos().then(()=>{if(LAB.combos){LAB.match=matchCombos();renderAnalytics();}});
  loadSalt();}
