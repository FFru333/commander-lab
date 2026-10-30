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
  return {R,known,total:rows.length,lands,basics,tapped,fetches,comp,perm,nl,curve,avg,peak,cheap,fin,rocks,dorks,rituals,treas,landRamp,reducers,
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
/* ---------- annoyance: how likely the deck is to make a table groan ----------
   Not a sum of community scores. Each card gets an annoyance value from what it DOES (text patterns),
   lifted by the EDHREC salt vote when that vote is high. Mana, lands and plain staples count as power, not salt.
   Per game: chance = 1 - product(1 - chance the card shows up by turn 7 x its annoyance). */
AN.view=lsGet(NS+"-anview")==="deep"?"deep":"brief";AN.emi=!!lsGet(NS+"-anemi");
const ANN_TURNS=8,ANN_PLAYED=.8;   // 80%: an annoying card you see is not always cast, and does not always land on someone
const ANN_CLASSES={
  mld:{label:"Land destruction",w:.9},stax:{label:"Stax and locks",w:.85},neutral:{label:"Commander neutralizers",w:.7},combo:{label:"Combos",w:.7},
  altwin:{label:"Out-of-nowhere wins",w:.6},steal:{label:"Theft",w:.6},xturn:{label:"Extra turns",w:.6},hand:{label:"Hand attack",w:.55},
  tax:{label:"Taxes and tolls",w:.55},reset:{label:"Wipes and resets",w:.5},edict:{label:"Edicts",w:.45},poison:{label:"Poison",w:.45},
  counter:{label:"Counterspells",w:.35},tutor:{label:"Tutors",w:.25},salty:{label:"Hated by the community",w:0}};
const ANN_NUM="(a|an|one|two|three|four|five|x|half|all)";
const ANN_RX={
  mld:new RegExp("destroy (target|each|all|up to [a-z]+ target)( nonbasic)? lands?\\b|destroy all lands|(each player|target player|target opponent|each opponent) sacrifices "+ANN_NUM+"( nonbasic)? lands?\\b|\\blands?\\b[^.]*(don't|doesn't) untap|exile (target|all|each) (nonbasic )?lands?\\b","i"),
  stax:/(players?|opponents?|your opponents|each opponent) can't (cast|activate|play|search|draw|gain|untap|attack|block)|can't (cast|activate)[^.]*(spells?|abilities)[^.]*(during|unless|if)|(each )?(players?|opponents?) can cast only|can't untap more than|(don't|doesn't) untap during|skips? (their|your|his or her|each) (untap|draw)|skip your (untap|draw)|you can't lose the game|opponents can't win the game|cast spells only during/i,
  tax:/(spells?|abilities|permanents)[^.]*costs? (\{[^}]+\})+ more|spells? (your opponents|opponents|each opponent|players) cast cost|unless (that player|its controller|they|target (player|opponent)|an opponent|that spell's controller) pays?|opponent[^.]*may pay \{[^}]+\}[^.]*\. If (they|that player|the player) (doesn't|don't)|can't attack you unless/i,
  counter:/counter (target|that|the|all) (spell|activated|triggered|noncreature|creature|instant|sorcery|artifact|enchantment|ability|legendary|[a-z]+ spell)/i,
  xturn:/extra turns?/i,
  steal:/gain control of (target|up to|each|all|that|another)[^.]*?(creature|permanent|artifact|enchantment|planeswalker|spell|land)/i,
  hand:/(target (player|opponent)|each opponent|each other player|that player)[^.]*discards? (their hand|his or her hand|[a-z]+ cards?|a card)|discard (their|his or her) hand|target opponent reveals their hand[^.]*(discard|exile)/i,
  edict:/(target (players?|opponents?)|each opponent|each of those players|those players|that player|each other player|defending player|an opponent|each player) sacrifices? (a|an|two|three|all|each|that)?[^.]*?(creature|nonland permanent|permanent|artifact|enchantment|planeswalker)/i,
  neutral:/loses all (other )?(abilities|card types)|enchanted permanent is an? [^.]*(land|forest|island|swamp|mountain|plains)|becomes? an? [^.]*\b(land|forest|island|swamp|mountain|plains)\b[^.]*loses/i,
  altwin:/you win the game|(target (player|opponent)|each opponent|that player|an opponent) loses the game/i,
  reset:/destroy all (creatures|artifacts|enchantments|nonland permanents|permanents|planeswalkers)|exile all (creatures|nonland permanents|permanents)|return (all|each) (nonland )?permanents?[^.]*hands?|return each nonland permanent[^.]*you don't control|each player sacrifices all/i};
const ANN_MANA=/\{T\}[^.]*: Add|Add \{|Add one mana|Add (two|three|X) mana/i;
const ANN_LANDFETCH=/search your library for (up to )?(a|an|one|two|three|x|that many)?\s?(basic |snow |nonbasic )?([a-z]+ )?(land|forest|plains|island|swamp|mountain)/i;
function annoyOf(r,e,poison){const c=r.c,ot=c.ot||"",roles=r.roles||[],cls=[];
  Object.keys(ANN_RX).forEach(k=>{if(ANN_RX[k].test(ot))cls.push(k);});
  const add=k=>{if(!cls.includes(k))cls.push(k);};
  if(roles.includes("mld"))add("mld");if(roles.includes("xturn"))add("xturn");if(roles.includes("wipe"))add("reset");
  if((c.kw||[]).includes("Overload")&&/\breturn\b/i.test(ot))add("reset");
  if(/search your library for/i.test(ot)&&!ANN_LANDFETCH.test(ot))add("tutor");
  if(poison.has(r.name))add("poison");
  if(cls.includes("counter")&&cls.includes("tax"))cls.splice(cls.indexOf("tax"),1);
  const pow=!cls.length&&((isType(c,"Land")&&!isType(c,"Creature"))||(ANN_MANA.test(ot)&&(c.cmc||0)<=4));
  let w=0,main=null;cls.forEach(k=>{const kw=(k==="steal"&&/until end of turn/i.test(ot))?.4:ANN_CLASSES[k].w;if(kw>w){w=kw;main=k;}});
  let u=0;
  if(cls.length)u=Math.max(w,(e||0)/4);
  else if(!pow&&e!=null&&e>=1.4){u=e/4*.8;cls.push("salty");main="salty";}
  return {cls,main,u:Math.min(1,u),pow};}
const anP=list=>1-list.reduce((t,x)=>t*(1-x.p),1);
function annoyDeck(a){const F=finalCards(),poison=new Set(a.poison.map(r=>r.name));
  const lib0=F.filter(f=>!f.cmd).reduce((t,f)=>t+(f.qty||1),0),N=lib0>=60?lib0:99,sc=Math.min(1,(7+ANN_TURNS)/N),sCmd=.8;
  const cmdK=new Set(a.cmds.map(nk));const items=[],pow=[];let raw=0,rated=0;
  a.R.forEach(r=>{const x=AN.salt[nk(front(r.name))],e=x&&x.s!=null?x.s:null;if(e!=null){raw+=e*r.qty;rated++;}
    const m=annoyOf(r,e,poison);if(m.pow){if(e!=null&&e>=.9)pow.push({name:r.name,e});return;}if(!m.u)return;
    const seen=(r.cmd?sCmd:sc)*ANN_PLAYED;items.push({name:r.name,cls:m.cls,main:m.main,u:m.u,e,seen,p:seen*m.u});});
  const combos=a.combos.map(v=>{const seen=v.cards.reduce((t,n)=>t*(cmdK.has(nk(n))?sCmd:sc),ANN_PLAYED),u=v.cards.length===2?.55:.4;
    return {name:v.cards.join(" + "),cls:["combo"],main:"combo",u,e:null,seen,p:seen*u,combo:true};}).sort((x,y)=>y.p-x.p).slice(0,6);
  const all=items.concat(combos),P=anP(all),tot=all.reduce((t,x)=>t+x.p,0)||1,by={};
  all.forEach(x=>{const b=by[x.main]||(by[x.main]={k:x.main,n:0,sum:0,names:[]});b.n++;b.sum+=x.p;b.names.push(x.name);});
  const classes=Object.values(by).map(b=>({...b,label:ANN_CLASSES[b.k].label,share:b.sum/tot})).sort((x,y)=>y.sum-x.sum);
  const byP=all.slice().sort((x,y)=>y.p-x.p);
  return {P,all,top:all.slice().sort((x,y)=>y.u-x.u||y.p-x.p),classes,cut:anP(byP.slice(2)),cutNames:byP.slice(0,2).map(x=>x.name),
    pow:pow.sort((x,y)=>y.e-x.e).slice(0,4),raw,rated,gcNames:a.R.filter(r=>(r.roles||[]).includes("gc")).map(r=>r.name),combos:a.combos.length,two:a.two,N};}
function anCallouts(a,N){const out=[],by=Object.fromEntries(N.classes.map(c=>[c.k,c]));
  Object.keys(ANN_CLASSES).forEach(k=>{const c=by[k];if(!c||k==="combo"||k==="salty"||ANN_CLASSES[k].w<.55)return;out.push([ANN_CLASSES[k].label,c.names.slice(0,3).join(", ")]);});
  if(N.combos)out.push(["Combos in the deck",N.combos+" found"+(N.two?", "+N.two+" with just two cards":"")]);
  if(N.gcNames.length)out.push(["Game Changers",N.gcNames.slice(0,4).join(", ")]);
  if(by.tutor&&by.tutor.n>=3)out.push(["Tutors",by.tutor.n+" of them"]);
  return out;}
/* ---------- the written verdict: deliberately rude, picked per deck so it does not flicker ---------- */
const anHash=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;};
const anPick=(arr,seed)=>arr[seed%arr.length];
const AN_TIERS=[[10,"Hall monitor"],[25,"Polite"],[45,"Spicy"],[65,"Salty"],[85,"Table wrecker"],[101,"Friendship ender"]];
/* spice (how rude) x performance (how well it works): nine moods, three lines each */
const AN_MOOD={
  fw:["Nobody gets upset and nothing gets won. It's fair because it can't afford to be anything else.","Harmless in every direction, and it still loses. That's not politeness, it's incompetence with good manners.","You're not playing nice, you're just not playing well. Different problem, same table."],
  fo:["It annoys nobody and still wins sometimes. It wins quietly and apologises always.","A fair deck that can still win. Your friends love you, and they know it's because you're no threat.","Nice, solid, forgettable. The deck equivalent of 'I'm fine with whatever'."],
  fg:["It wins and nobody even gets to complain. Insufferable in a completely legal way.","Strong and clean. You won't be hated, you'll be quietly resented, which is worse.","A deck that beats everyone and leaves no excuse. Your friends will have to go home and think about themselves."],
  mw:["Plenty of malice, no competence: you annoy people and still lose.","You bother the table and the table still wins. Congratulations on being hated and irrelevant.","Spicy intentions, soggy execution. People get annoyed at you and then beat you anyway."],
  mo:["Enough edge to be noticed, enough power to matter. Exactly the friend who gets 'just one more game'.","A proper mix of rude and effective. Your friends call it 'fine' through gritted teeth and tell the group chat the truth afterwards.","You'll make somebody slam their cards down, you'll win your share, and you'll lie about both."],
  mg:["Strong and rude, and somebody will notice both before the game is half over.","You built a deck that wins and makes sure the losers know it.","Strong, spicy and a little too pleased with itself. At some point your friends will ask if you're okay. You'll say 'it's just a game'."],
  sw:["You built a machine for ruining evenings and forgot to make it win. All the cruelty, none of the payoff.","You won't win, you'll just make the game longer, sadder and worse for everyone.","The deck is a grudge with no plan. Your friends hate it, and your friends are winning."],
  so:["Somebody leaves angry, and that's not the deck's fault, it's yours. Funny how the analysis makes it so obvious why you hate your friends.","Competent and cruel, and you know exactly which of those you enjoy more.","It's strong, it's brutal, and it leaves a trail of ruined game nights."],
  sg:["Fast, strong and rude: the full set. Pick a pod that has already stopped speaking to you.","A weapon. Anyone sitting across from you is braver than you deserve.","You don't hate your friends, you hate losing to them, and this deck is the cure."]};
/* how it plays: {ci} is the colour identity name, e.g. "Gruul" or "mono-red" */
const AN_POSTURE={
  lock:["{Ci} stax: nobody gets to play, and you get to feel clever about it.","A {ci} deck that doesn't want to win so much as to cancel everybody's evening."],
  combo:["A {ci} deck built to win out of nowhere, so your friends learn the plot at the same time as the ending.","A {ci} countdown to a sentence that starts with 'wait, actually'."],
  control:["{Ci} control: answers everything, wins eventually and makes the waiting miserable for everyone.","A {ci} deck that says no like it's a job, and charges for it."],
  aggro:["A {ci} deck that is impatient: the table doesn't get to sit down before it's already hurting.","A {ci} deck that treats the opening turns like a mugging."],
  bomb:["A {ci} time bomb: a pile of fast mana, free creatures, and a game that's over before anybody finishes their drink.","A {ci} deck that cheats the big thing in early and lets the table work out how far behind it is."],
  inter:["{Ci} midrange with a toolbox: it kills whatever you play and beats you with whatever is left.","A {ci} bully with answers: it removes your best thing, then reminds you what it was."],
  big:["A {ci} deck of big, slow, expensive things: patient, until the moment it isn't, and then everyone pays for the wait.","A {ci} battlecruiser: build up, wait, and sit on top of the table like a landlord."],
  mid:["A {ci} midrange pile: a bit of everything, a commitment to nothing.","A {ci} deck that is not control, not aggro, not combo, and answers 'what do you play?' with a shrug."]};
/* things that make the list look badly built, each with a severity (higher is picked first) */
const AN_SLOP={
  off:[9,["Some cards sit outside the commander's colours. Did you build this in the dark, or do you just not read?","Off-colour cards in the list. Assembled blindfolded, or just optimistic?"]],
  dupes:[8,["Some non-basic cards appear more than once. This is singleton Commander, not a hobby.","You've got repeats in a format that bans them. Counting is not your strong suit."]],
  messy:[8,["Synergy is thin and the list reads like a bag of favourite cards. That's not a deck, that's a mood board.","The pieces don't talk to each other. Less a deck, more a group of strangers sharing an elevator."]],
  nowin:[7,["It's not clear this deck knows what winning looks like.","There's no real way to finish a game here. This is a hobby, not a deck."]],
  thin:[6,["{col} is the problem: you want it badly and brought almost nothing to make it. Pray to the shuffler.","You want {col} and you brought barely any way to cast it. Ambition is free; mana isn't."]],
  curve:[6,["Top-heavy and short on ramp: you built a feast for a table with no cutlery.","Everything costs a fortune and there's no ramp. Bold of you to assume you'll live that long."]],
  lands:[5,["Not enough lands for a deck this hungry. Either trust the maths or stop pretending.","The mana base was an afterthought, and it shows."]],
  nodraw:[5,["Barely any card draw. When the hand runs dry you'll be playing top-deck roulette.","No way to refill the hand. Your hand will empty and so will your plan."]],
  tapped:[4,["A lot of lands enter tapped. Slow on purpose, or by accident?","So many tapped lands. The deck begins every game by apologising for its own speed."]],
  cons:[4,["The deck draws what it draws and prays. More engines, fewer ideas.","Every game is a different deck, and most of them are bad."]],
  slow:[3,["Clunky. Half the hand is a paperweight until it's too late.","It works eventually, as long as nobody is in a hurry, and somebody always is."]],
  noint:[3,["There's almost nothing in it to stop what anyone else does. Your defence plan is hope.","When somebody does something, you watch, like a nature documentary."]]};
const AN_DEP_HI=["Everything leans on the commander: neutralise it and the plan goes with it{prot}.","This deck is a hostage situation, and the commander is the hostage{prot}.","Take the commander away and the rest is a list of cards looking at each other{prot}."];
const AN_DEP_LO=["The commander is decoration: take it away and the deck hardly notices.","Remove the commander and nothing changes. It could have been any legend with the right colours."];
const AN_OWN=[
  [.9,["Almost all of it is really yours. The rest is wishful thinking.","Nearly there: the last few cards are the difference between a deck and a plan."]],
  [.7,["Most of it is yours, the rest is printer ink and a shopping list.","Part of this deck is real. The rest is cosplay."]],
  [.4,["A lot of it is printer ink and a shopping list. A deck in costume.","You're building this one on credit and good intentions."]],
  [0,["Most of it isn't yours. This isn't a deck, it's a wishlist with a commander.","Most of these cards exist mostly in your head."]]];
const AN_GOOD=["It works, it works often, and that's the real insult.","Everything fits and the list is clean. Any loss is yours to own."];
const AN_MEH=["Not broken, not sharp. Respectable, in the way beige is.","It works until you're tempted to be clever."];
const AN_L3=[
  ["Pick a side: play to win, or keep pleasing your friends. Right now you're doing neither.","Bring a stronger plan or a better excuse.","Next time, try wanting something."],
  ["Add some teeth, or admit you're here for the snacks.","Nobody is afraid of you. Fix that.","Be a little meaner. They'll thank you, eventually."],
  ["Keep it. This is the sweet spot between 'fun' and 'who invited them'.","The good place to be: liked, slightly feared, never banned.","Dinner after the game will be quiet. That's how you know it worked."],
  ["Wear it like a badge. Just sit near the exit.","Don't explain yourself at the table. It only makes it worse.","Your friends will forgive you by Christmas. Probably."],
  ["No regrets. Bring snacks as a peace offering; it won't work.","Any apology you make will only make it worse.","You have never once said 'good game' and meant it."],
  ["Commit. At this point apologising would be the only insulting thing left.","Frame the percentage and hang it above the table.","At this point the deck isn't the problem, the seating plan is."]];
const AN_L3X={
  fg:["Keep winning politely. It's the cruellest thing you can do.","Nobody can accuse you of anything, and that's exactly what bothers them.","At least be rude about it. You've earned it."],
  mw:["Be annoying or be good. Doing the first without the second gets you nowhere.","You're the table's most irritating loss. Work on that.","Pick a lane: win properly or stop annoying people for nothing."],
  sw:["Fix the list first, then the attitude. Right now it's all attitude.","All that spite and nothing to show for it. Even your enemies are disappointed.","Cut the cruelty, add a plan. Or keep the cruelty and accept the losses."]};
/* ---------- archetypes (EDHREC theme names) read from card text, and commander dependence ---------- */
const anTxt=r=>r.c.ot||"";
const AN_ARCH=[
  ["Tokens",r=>/create [^.]*\btokens?\b|\btokens? you control/i.test(anTxt(r)),9],
  ["+1/+1 Counters",r=>/\+1\/\+1 counters?|proliferate/i.test(anTxt(r)),9],
  ["Aristocrats",r=>/whenever [^.]*(dies|is put into a graveyard from the battlefield)|sacrifice (a|an|another|two) [^.]*(creature|permanent)[^.:]*:/i.test(anTxt(r)),8],
  ["Spellslinger",r=>(isType(r.c,"Instant")||isType(r.c,"Sorcery"))?1:/whenever you cast (an? )?(instant|sorcery|noncreature)|magecraft|copy target (instant|sorcery)/i.test(anTxt(r))?3:0,26,true],
  ["Artifacts",r=>(isType(r.c,"Artifact")?1:0)+(/artifacts? you control|artifact spell/i.test(anTxt(r))?3:0),18,true],
  ["Enchantress",r=>(isType(r.c,"Enchantment")?1:0)+(/whenever an enchantment|enchantment spell|enchantments? you control/i.test(anTxt(r))?3:0),14,true],
  ["Equipment",r=>/\bEquipment\b/.test(r.c.tl)?1:0,6,true],
  ["Auras",r=>/\bAura\b/.test(r.c.tl)?1:0,8,true],
  ["Voltron",r=>/\b(Equipment|Aura)\b/.test(r.c.tl)?1:0,9,true],
  ["Reanimator",r=>/return [^.]*creature card[^.]*from (a|your|any|their) graveyard to the battlefield|reanimate/i.test(anTxt(r)),4],
  ["Graveyard",r=>/from your graveyard|put the top [^.]*cards of your library into your graveyard|\bmills?\b|\bescape\b|flashback|delve/i.test(anTxt(r)),9],
  ["Mill",r=>/(target (player|opponent)|each opponent) mills?|mills? (that many|\w+) cards?/i.test(anTxt(r)),5],
  ["Lifegain",r=>/you gain \d+ life|you gain life|\blifelink\b|whenever you gain life/i.test(anTxt(r)),8],
  ["Landfall",r=>/landfall|whenever a land enters the battlefield under your control|play an additional land|additional land/i.test(anTxt(r)),6],
  ["Blink",r=>/exile (target|another|up to one target) [^.]*(creature|permanent)[^.]*(then )?return it|\bblink\b|flicker/i.test(anTxt(r)),4],
  ["Treasure",r=>/\bTreasure\b/.test(anTxt(r)),6],
  ["Storm",r=>/\bstorm\b|copy target (instant|sorcery)|copy (that|target) spell/i.test(anTxt(r)),3],
  ["Extra Turns",r=>/extra turns?/i.test(anTxt(r)),2],
  ["Wheels",r=>/each player discards (their|his or her) hand[^.]*draws?|discards? (their|your) hand, then draws?/i.test(anTxt(r)),2],
  ["Theft",r=>/gain control of (target|up to|each|all|that|another)|cast [^.]*(from|owned by) (an opponent|target opponent)|exile the top card of (target )?(an )?opponent's library/i.test(anTxt(r)),3],
  ["Group Hug",r=>/each player (draws|may draw|gains|creates|puts)|target player draws|each opponent draws/i.test(anTxt(r)),4],
  ["Group Slug",r=>/deals? \d+ damage to each (opponent|player)|whenever an opponent [^.]*(draws|casts|attacks)/i.test(anTxt(r)),5],
  ["Lifedrain",r=>/each opponent loses \d+ life|target (player|opponent) loses \d+ life|drains?/i.test(anTxt(r)),6],
  ["Pillow Fort",r=>/can't attack you|creatures can't attack|prevent all combat damage/i.test(anTxt(r)),3],
  ["Burn",r=>/deals? \d+ damage to (any target|target (player|opponent)|each opponent)/i.test(anTxt(r)),8],
  ["Clones",r=>/enter[s]? the battlefield as a copy|create a token that's a copy|copy of target (creature|permanent)|becomes a copy/i.test(anTxt(r)),4],
  ["Infect",r=>(r.c.kw||[]).some(k=>/Infect|Toxic|Poisonous/i.test(k))||/poison counter/i.test(anTxt(r)),4],
  ["Vehicles",r=>/\bVehicle\b/.test(r.c.tl)||/\bcrew \d/i.test(anTxt(r)),4],
  ["Planeswalkers",r=>isType(r.c,"Planeswalker")?1:0,7]];
function anArchetypes(a,Pw,N){const rows=(a.R||[]).filter(r=>!isType(r.c,"Land")||/Land/.test(r.c.tl)&&false);const out=[];
  AN_ARCH.forEach(([name,fn,thr])=>{let n=0;rows.forEach(r=>{const v=fn(r);if(v)n+=(r.qty||1)*(v===true?1:v)*(r.cmd?3:1);});if(n>=thr)out.push({name,n,score:n/thr,thr});});
  const by=Object.fromEntries(N.classes.map(c=>[c.k,c]));const stx=["stax","mld","tax"].reduce((t,k)=>t+(by[k]?by[k].n:0),0);
  if(stx>=5)out.push({name:"Stax",n:stx,score:stx/5});
  const ser=(a.combos||[]).filter(v=>(CSB_BR[v.br]||0)>=3).length;if(ser>=3)out.push({name:"Combo",n:ser,score:ser/3});
  if(Pw.ramp>=13&&a.fin>=5)out.push({name:"Big Mana",n:Pw.ramp,score:Pw.ramp/13});
  if(a.tribe&&a.tribeN>=20)out.push({name:a.tribe+"s",n:a.tribeN,score:a.tribeN/20});
  const eq=out.find(x=>x.name==="Voltron");if(eq){out.forEach(x=>{if(x.name==="Equipment"||x.name==="Auras")x.score*=.7;});}
  return out.sort((x,y)=>y.score-x.score).slice(0,3);}
function anDepend(a){const cmd=(a.R||[]).filter(r=>r.cmd);if(!cmd.length)return null;
  const ot=cmd.map(r=>r.c.ot||"").join(" ");
  const engine=/whenever|at the beginning of|spells you cast|you control (get|have)|each (creature|spell)|\{T\}[^.]*:|enters the battlefield|put [^.]*onto the battlefield/i.test(ot)?1:0;
  const E=LAB.edh;let share=null;
  if(E&&E.by&&Object.keys(E.by).length){const rows=(a.R||[]).filter(r=>!r.cmd&&!isType(r.c,"Land"));
    const hi=rows.filter(r=>{const x=E.by[norm(r.name)];return x&&x.syn>=.2;}).reduce((t,r)=>t+r.qty,0);share=rows.length?hi/rows.reduce((t,r)=>t+r.qty,0):0;}
  const dep=share==null?null:Math.round(clamp((engine?30:10)+Math.min(1,share/.7)*65));
  return {dep,engine:!!engine,share,protect:a.protect};}
function anOwnership(){try{const o=deckStats(DECKS.current);const marked=o.have+o.proxy+o.buy;if(marked<o.total*.6)return null;const miss=o.proxy+o.buy;if(!miss)return null;return {have:o.have,total:marked,proxy:o.proxy,buy:o.buy,cost:o.buyCost||0,share:o.have/Math.max(1,marked)};}catch(e){return null;}}
const AN_CIN={"W":"mono-white","U":"mono-blue","B":"mono-black","R":"mono-red","G":"mono-green","WU":"Azorius","UB":"Dimir","BR":"Rakdos","RG":"Gruul","GW":"Selesnya","WB":"Orzhov","UR":"Izzet","BG":"Golgari","RW":"Boros","GU":"Simic",
  "WUB":"Esper","UBR":"Grixis","BRG":"Jund","RGW":"Naya","GWU":"Bant","WBR":"Mardu","URG":"Temur","BGW":"Abzan","RWU":"Jeskai","GUB":"Sultai"};
function anCiName(ci){const set=COLORS.filter(c=>ci.includes(c)).sort().join("");
  for(const k in AN_CIN)if(k.split("").sort().join("")===set)return AN_CIN[k];
  if(set.length===0)return "colourless";if(set.length===4)return "four-colour (no "+CNAME[COLORS.find(c=>!ci.includes(c))].toLowerCase()+")";return "five-colour";}
const AN_CHEAT=/(from (your|their) hand|from (your|their) library|(the )?top (\w+ )?(cards? )?of (your|their) library)[\s\S]{0,140}?onto the battlefield|onto the battlefield[^.]*from (your|their) hand|without paying (its|their|that|the) mana cost/i;
const anCheat=r=>AN_CHEAT.test(r.c.ot||"")&&/\b(creature|permanent)\b/i.test(r.c.ot||"");
/* identity: what the deck IS (noun from its archetype) and what it DOES (up to three traits), so two decks never read alike */
const AN_NOUN={"Aristocrats":"aristocrats deck","Tokens":"tokens deck","+1/+1 Counters":"counters deck","Spellslinger":"spellslinger deck","Artifacts":"artifacts deck","Enchantress":"enchantress deck",
  "Equipment":"equipment deck","Auras":"auras deck","Voltron":"voltron deck","Reanimator":"reanimator deck","Graveyard":"graveyard deck","Mill":"mill deck","Lifegain":"lifegain deck","Landfall":"landfall deck",
  "Blink":"blink deck","Treasure":"treasure deck","Storm":"storm deck","Extra Turns":"extra-turns deck","Wheels":"wheels deck","Theft":"theft deck","Group Hug":"group-hug deck","Group Slug":"group-slug deck",
  "Lifedrain":"drain deck","Pillow Fort":"pillow-fort deck","Burn":"burn deck","Clones":"clone deck","Infect":"infect deck","Vehicles":"vehicles deck","Planeswalkers":"superfriends deck",
  "Stax":"stax deck","Combo":"combo deck","Big Mana":"big-mana deck"};
const AN_NOUN_W={"Aristocrats":1.2,"Big Mana":.9,"Combo":.9,"Graveyard":.7,"Artifacts":.8,"Spellslinger":.9,"Lifegain":.9,"Treasure":.8,"Lifedrain":.6};
const AN_TRAIT={
  edict:[10,["looks down on the table and makes everyone sacrifice their own creatures","hands everybody else's board a one-way ticket to the graveyard","forces the others to sacrifice their stuff and watches"]],
  sacrifice:[9,["turns every creature into a payment and every death into a trigger","sacrifices its own board for profit and calls it value","feeds on its own sacrifices"]],
  hand:[9,["empties your hand before you can play it","takes your cards away before they have a chance to be good"],"makes your hand a place where cards go to die"],
  steal:[8,["takes whatever you were proud of","borrows your best things and keeps them"],"treats your board as a shopping catalogue"],
  stax:[9,["makes sure nobody gets to play","keeps the whole table from doing anything"],"is the reason game night ends early"],
  combo:[8,["wins out of nowhere","has a way to end the game that nobody sees coming"],"waits for the one turn where it stops pretending"],
  cheat:[8,["puts big things into play for free","cheats its best creatures in without paying for them"],"skips the part where you pay for things"],
  control:[7,["grinds you down with control","plays control and doesn't care that you're bored"]],
  controlNoBlue:[7,["grinds you down with control and not a drop of blue","plays control without a single counterspell, just attrition"]],
  counters:[7,["says no to your spells","counters the thing you were counting on"],"answers your best play with a flat no"],
  poison:[7,["wins through poison, the 'technically that counts' way","finishes with poison while you check your life total for nothing"]],
  fastmana:[6,["runs on fast mana","is in a hurry and spends mana like it's free"],"starts the game three turns ahead and acts surprised"],
  wipe:[6,["resets the board whenever it's losing","has a button that deletes everyone's work"],"can erase everyone's work whenever the mood strikes"],
  aggro:[6,["attacks before you've sat down","is impatient and fast, and gets in early"],"doesn't wait for permission to start hitting"],
  nofast:[5,["does it without a pile of fast mana","gets there on its own legs, no fast mana needed"]],
  big:[4,["ends games with huge things","finishes with creatures that need their own zip code"],"closes with things too big to be polite about"]};
/* every trait must be earned: a count against a threshold, measured on the whole deck. The commander alone only counts when it is clearly that kind of card. */
const AN_TRAIT_LABEL={sacrifice:"Sacrifice and death payoffs",edict:"Makes others sacrifice",hand:"Hand attack",steal:"Theft",stax:"Stax and lock pieces",combo:"Serious combos",cheat:"Cheats things into play",control:"Control tools",counters:"Counterspells",poison:"Poison",fastmana:"Fast mana",wipe:"Board wipes",aggro:"Creature share (aggro)",nofast:"Little fast mana",big:"Big finishers",tribal:"Tribal creatures",ramp:"Ramp pieces"};
AN_TRAIT.tribal=[5,["goes all in on one creature type","has a favourite creature type and zero shame about it"]];
AN_TRAIT.ramp=[4,["ramps like it's on a deadline","builds its mana like it's saving up for something expensive"]];
function anIdentity(a,Pw,N,ctx,h){const by=Object.fromEntries(N.classes.map(c=>[c.k,c.n])),n=k=>by[k]||0;
  const nl=Math.max(1,a.nl),ctrlTools=ctx.counterReal+n("reset")*2+n("edict")+n("hand")+(a.removal||0)*.5;
  const ev=[],T={};
  const test=(k,count,thr,extra)=>{const on=count>=thr&&(extra===undefined||extra);ev.push({k,label:AN_TRAIT_LABEL[k],count:Math.round(count*10)/10,thr,on:!!on});if(on)T[k]=AN_TRAIT[k][0];};
  test("edict",n("edict")+(ctx.cmdEdict?2:0),3);const aris=ctx.arch.find(x=>x.name==="Aristocrats");test("sacrifice",aris?aris.n:0,aris?aris.thr||8:8);test("hand",n("hand"),3);test("steal",n("steal"),3);test("stax",n("stax")+n("mld")+n("tax"),4);
  test("combo",ctx.seriousCombos,2);test("cheat",ctx.cheatScore,6);
  const attrition=n("edict")+(ctx.cmdEdict?2:0)>=3&&(n("reset")>=1||(a.removal||0)>=5)&&!ctx.hasU;
  test("control",attrition?Math.max(22,Math.round(ctrlTools/nl*100)):Math.round(ctrlTools/nl*100),22,attrition||ctx.crShare<.45);
  test("counters",ctx.counterReal,4,ctx.hasU);test("poison",a.poison.length,3);test("fastmana",ctx.fastStrict,6);test("wipe",n("reset"),2);
  test("aggro",Math.round(ctx.crShare*100),55,a.avg<=3.3);test("big",a.fin,6);test("ramp",Pw.ramp,12,!T.fastmana);
  const tribalOn=!!(a.tribe&&a.tribeN>=20);test("tribal",tribalOn?a.tribeN:0,20);
  if(T.control&&!ctx.hasU){delete T.control;T.controlNoBlue=AN_TRAIT.controlNoBlue[0];}
  if(T.control||T.controlNoBlue)delete T.wipe;
  if(ctx.fastStrict<=2&&(T.cheat||T.edict)){T.nofast=AN_TRAIT.nofast[0];}
  const traits=Object.keys(T).sort((x,y)=>T[y]-T[x]).slice(0,4);
  const arch=ctx.arch.slice().sort((x,y)=>y.score*(AN_NOUN_W[y.name]||1)-x.score*(AN_NOUN_W[x.name]||1));
  const top=(tribalOn&&arch.find(x=>x.name===a.tribe+"s"))||arch.find(x=>AN_NOUN[x.name])||arch.find(x=>a.tribe&&x.name===a.tribe+"s");
  const noun=top?(AN_NOUN[top.name]||(top.name.replace(/s$/,"")+" tribal deck")):null;
  if(!traits.length&&!noun)return {text:null,ev};
  const phr=traits.map((k,i)=>anPick(AN_TRAIT[k][1],h("tr"+i)));
  const list=phr.length>1?phr.slice(0,-1).join(", ")+" and "+phr[phr.length-1]:phr[0]||"";
  const ci=ctx.ciName,Ci=ci?ci.charAt(0).toUpperCase()+ci.slice(1):"";
  const nn=noun||(ctx.posture==="aggro"?"aggro deck":ctx.posture==="big"?"battlecruiser":"midrange deck");
  const art=ci?(/^[aeiou]/i.test(ci)?"An":"A"):(/^[aeiou]/i.test(nn)?"An":"A");
  const who=(ci?art+" "+ci+" "+nn:art+" "+nn);
  return {text:list?(anHash(ctx.key+"id")%2?who+" that "+list+".":Ci?Ci+" "+nn+": "+list+".":who+" that "+list+"."):who+".",ev};}
function verdictOf(a,Pw,N){const p=Math.round(N.P*100),ti=AN_TIERS.findIndex(t=>p<t[0]),pl=Pw.pl;
  const key=((CUR&&CUR.name)||"deck")+"|"+a.cmds.join("+")+"|"+a.total+"|"+(AN.seed||0),h=k=>anHash(key+k);
  const arch=anArchetypes(a,Pw,N),ci=deckCI(),ciName=anCiName(ci),cr=a.R||[],nonCmd=cr.filter(r=>!r.cmd&&!isType(r.c,"Land")),cmdRows=cr.filter(r=>r.cmd);
  const crShare=a.creatures/Math.max(1,a.nl),dom=N.classes[0];
  const cheatCmdStrong=cmdRows.some(r=>anCheat(r)&&/(library[\s\S]{0,140}?onto the battlefield|without paying)/i.test(r.c.ot||"")),cheatCmd=cmdRows.some(anCheat),cheatOthers=nonCmd.filter(anCheat).length,cheat=cheatOthers+(cheatCmd?1:0);
  const fast=(a.rocks||[]).filter(r=>r.c.cmc<=2).length+(a.dorks||[]).filter(r=>r.c.cmc<=2).length+(a.rituals||[]).length+(a.landRamp||[]).filter(r=>r.c.cmc<=2).length;
  const counterReal=nonCmd.filter(r=>ANN_RX.counter.test(r.c.ot||"")).reduce((t,r)=>t+r.qty,0),hasU=ci.includes("U");
  const nlands=(a.lands||[]).reduce((t,r)=>t+r.qty,0),ramp=Pw.ramp||0;
  const thinC=COLORS.filter(k=>ci.includes(k)&&a.dem[k]>=6&&a.src[k]<12).sort((x,y)=>a.dem[y]-a.dem[x])[0];
  const off=ci.length?nonCmd.filter(r=>(r.c.ci||[]).some(c=>!ci.includes(c))).length:0;
  const dupes=cr.filter(r=>r.qty>1&&!/\bBasic\b/.test(r.c.tl||"")).length;
  const dep=anDepend(a),own=anOwnership();
  const vars={t:arch.slice(0,2).map(x=>x.name).join(" with a side of "),p,pl:pl.toFixed(1),inter:Math.round(Pw.inter),win:Math.round(Pw.win),cons:Math.round(Pw.cons),eff:Math.round(Pw.eff),fast,n:off,lands:nlands,mv:a.avg.toFixed(2),ramp,draw:a.draw,tapped:(a.tapped||[]).length,
    col:thinC?CNAME[thinC]:"",src:thinC?a.src[thinC]:0,pips:thinC?a.dem[thinC]:0,ci:ci.length?ciName:"",Ci:ci.length?ciName.charAt(0).toUpperCase()+ciName.slice(1):""};
  const fill=s=>{const t=s.replace(/\{(\w+)\}/g,(m,k)=>k in vars?vars[k]:m).replace(/\s{2,}/g," ").trim();return t.charAt(0).toUpperCase()+t.slice(1);};
  const spice=p<25?"f":p<55?"m":"s",perf=pl<4.5?"w":pl<6.8?"o":"g";
  const posture=(dom&&p>=40&&dom.share>=.4&&["mld","stax","tax"].includes(dom.k))?"lock"
    :((a.combos||[]).filter(v=>(CSB_BR[v.br]||0)>=3).length>=2)&&Pw.win>=45?"combo":(cheat>=3&&fast>=5&&(a.fin>=4||a.avg>=3.6))?"bomb"
    :(hasU&&counterReal+a.wipe*2>=5&&Pw.inter>=45&&crShare<.5)?"control":crShare>=.55&&a.avg<=3.3?"aggro":Pw.inter>=55?"inter":a.avg>=3.6?"big":"mid";
  const issues=[];const add=k=>issues.push(k);
  if(off>0)add("off");if(dupes>0)add("dupes");if(pl<4&&Pw.cons<40&&Pw.win<35)add("messy");else if(Pw.win<25)add("nowin");
  if(thinC)add("thin");if(a.avg>=4&&ramp<8)add("curve");if(nlands>0&&nlands<33&&a.avg>3.2)add("lands");if(a.rolesReady&&a.draw<4)add("nodraw");
  if((a.tapped||[]).length>=8)add("tapped");if(Pw.cons<35&&!issues.includes("messy"))add("cons");if(Pw.eff<50)add("slow");if(a.rolesReady&&Pw.inter<20)add("noint");
  issues.sort((x,y)=>AN_SLOP[y][0]-AN_SLOP[x][0]);
  /* one paragraph: who it is, how rude/strong it is, what is wrong with the build (or how well it works), closing verdict */
  const fastStrict=(a.rocks||[]).filter(r=>r.c.cmc<=2).length+(a.dorks||[]).filter(r=>r.c.cmc<=2).length+(a.rituals||[]).length;
  const cmdEdict=cmdRows.some(r=>ANN_RX.edict.test(r.c.ot||"")),seriousCombos=(a.combos||[]).filter(v=>(CSB_BR[v.br]||0)>=3).length,cheatScore=cheatOthers+(cheatCmdStrong?6:cheatCmd?1:0);
  const idr=anIdentity(a,Pw,N,{arch,cheat,cheatCmd,counterReal,hasU,crShare,fastStrict,seriousCombos,cheatScore,cmdEdict,ciName:ci.length?ciName:"",posture,key},h),idLine=idr.text;
  const L=[idLine?idLine:fill(anPick(AN_POSTURE[posture],h("b"))),fill(anPick(AN_MOOD[spice+perf],h("a")))];
  /* at most two extra sentences, most telling first: a severe build problem, an incomplete collection, how much hangs on the commander, a lesser problem */
  const prot=a.protect<=1?", and there's almost nothing to protect it":"";const cand=[];
  if(issues[0]&&AN_SLOP[issues[0]][0]>=6)cand.push(fill(anPick(AN_SLOP[issues[0]][1],h("s0"))));
  if(own){const tier=AN_OWN.find(x=>own.share>=x[0]);
    cand.push(anPick(tier[1],h("o")));}
  if(dep&&dep.dep!=null&&dep.dep>=65)cand.push(fill(anPick(AN_DEP_HI,h("dh")).replace("{prot}",prot)));
  else if(dep&&dep.dep!=null&&dep.dep<=30)cand.push(anPick(AN_DEP_LO,h("dl")));
  else if(dep&&dep.dep==null&&cheatCmdStrong&&cheatOthers<=3)cand.push("Everything hangs on the commander: neutralise it and what's left is a pile of expensive creatures"+(a.protect<=1?" with almost nothing to protect them.":"."));
  issues.forEach((k,i)=>{if(i>0||AN_SLOP[k][0]<6)cand.push(fill(anPick(AN_SLOP[k][1],h("s"+i))));});
  if(!issues.length)cand.push(fill(anPick(Pw.cons>=70&&Pw.eff>=70?AN_GOOD:AN_MEH,h("g"))));
  cand.slice(0,2).forEach(x=>L.push(x));
  L.push(anPick(AN_L3X[spice+perf]||AN_L3[ti],h("d")));
  return {p,ti,title:AN_TIERS[ti][1],lines:L,posture,issues,ci:ciName,arch,dep,own,ev:idr.ev};}
/* ---------- brief: what to look at first ---------- */
function insightsOf(a,Pw,cv){const w=[],g=[];const nl=a.lands.reduce((t,r)=>t+r.qty,0),r=Pw.ramp;
  if(cv.avg>=3.5)w.push("Top-heavy: the average mana value is "+cv.avg.toFixed(2)+". Expect clunky turns before turn 5.");
  else if(cv.avg<=2.8)g.push("Low curve ("+cv.avg.toFixed(2)+" average): the deck can start early.");
  if(nl<34&&r<8)w.push("Light on mana: "+nl+" lands and only "+r+" ramp pieces.");
  else if(nl>=38&&r>=12)w.push("A lot of mana: "+nl+" lands plus "+r+" ramp pieces. Flooding is the risk.");
  else g.push("The mana looks balanced: "+nl+" lands and "+r+" ramp pieces.");
  COLORS.filter(k=>deckCI().includes(k)&&a.dem[k]).forEach(k=>{if(a.src[k]<12)w.push(CNAME[k]+" is thin: "+a.src[k]+" sources for "+a.dem[k]+" pips.");});
  if(a.draw<5)w.push("Little card draw ("+a.draw+"). The deck may run out of gas.");else if(a.draw>=10)g.push("Plenty of card draw ("+a.draw+").");
  const it=a.removal+a.counter+a.wipe;
  if(it<5)w.push("Little interaction ("+it+" removal, counters and wipes).");else if(it>=10)g.push("Plenty of interaction ("+it+" removal, counters and wipes).");
  if(a.tapped.length>=7)w.push(a.tapped.length+" lands enter tapped. That costs tempo.");
  if(a.fin>=10)w.push(a.fin+" cards cost 6 or more. Many of them will rot in hand.");
  const out=w.concat(g).slice(0,5).map((t,i)=>[i<w.length?"w":"g",t]);
  return out.length?out:[["g","Nothing alarming: the numbers sit in a normal range."]];}
/* ---------- view ---------- */
const bar=(v,max,cls)=>'<span class="anbar'+(cls?" "+cls:"")+'"><i style="width:'+clamp(v/max*100).toFixed(0)+'%"></i></span>';
const tile=(t,body,sub)=>'<section class="antile"><h4>'+t+'</h4>'+(sub?'<p class="ansub">'+sub+'</p>':'')+body+'</section>';
const kv=(k,v,extra)=>'<div class="ankv"><span>'+k+'</span><b>'+v+'</b>'+(extra||"")+'</div>';
const anCurve=(b,mx,cls)=>'<div class="ancurve'+(cls?" "+cls:"")+'">'+b.map((v,i)=>'<span title="'+v+' cards"><em>'+v+'</em><i style="height:'+(v/mx*100)+'%"></i><b>'+(i===7?"7+":i)+'</b></span>').join("")+'</div>';
function anColours(a){const ci=deckCI(),maxDem=Math.max(1,...COLORS.map(k=>a.dem[k]));
  return '<h3 class="anh">Colour demand and sources</h3><div class="ancolors">'+COLORS.filter(k=>ci.includes(k)||a.dem[k]).map(k=>
    '<div class="ancol"><span class="pip p'+k+'">'+k+'</span><div><div class="anrow"><span>Pips</span>'+bar(a.dem[k],maxDem)+'<b>'+a.dem[k]+'</b></div><div class="anrow"><span>Sources</span>'+bar(a.src[k],Math.max(1,...COLORS.map(x=>a.src[x])),"src")+'<b>'+a.src[k]+'</b></div></div><em class="'+(a.src[k]<12?"low":"")+'">'+(a.src[k]<12?"Thin":"OK")+'</em></div>').join("")+
    '</div><p class="note">Sources are lands, rocks and mana creatures that can make the colour. Around 12 or more per main colour is a common rule of thumb, not a hard limit.</p>';}
function anVerdict(V){return '<section class="anverdict" data-tier="'+V.ti+'"><div class="anvtext"><div class="anvhead"><p class="ankick">The verdict</p><button type="button" class="ghostbtn anre" data-anre="1" aria-label="Write another version of the verdict">&#8635; Another take</button></div><h3>'+V.title+'</h3>'+(V.arch.length?'<p class="anchips">'+V.arch.map(x=>'<span class="chipk">'+esc(x.name)+'</span>').join("")+'</p>':'')+'<p>'+V.lines.join(" ")+'</p>'+'</div>'+
  '<div class="anvgauge"><b>'+V.p+'%</b><small>chance per game that somebody at the table groans, by turn '+ANN_TURNS+'</small><div class="anscale"><i style="left:'+V.p+'%"></i></div><div class="anticks"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div></div></section>';}
function anBrief(a,Pw){const emi=AN.emi&&HAS_EMI(),cv=curveData(emi),base=curveData(false),mx=Math.max(1,...cv.b,...base.b);
  const g=[["Consistency",Pw.cons],["Efficiency",Pw.eff],["Interaction",Pw.inter],["Win conditions",Pw.win]];
  const nlands=a.lands.reduce((t,r)=>t+r.qty,0),nb=a.basics.reduce((t,r)=>t+r.qty,0);
  const stat=(k,v,s)=>'<div class="anstat"><small>'+k+'</small><b>'+v+'</b><span>'+s+'</span></div>';
  return '<div class="anhero"><div><p class="ankick">Power level · estimate</p><h3>'+plName(Pw.pl)+'</h3><p class="ansub">'+(a.rolesReady?'':'Roles still loading: numbers will settle in a moment. ')+'Our own scale from the four pillars below, not the number another site gives.</p>'+
      '<div class="anscale"><i style="left:'+(Pw.pl*10)+'%"></i></div><div class="anticks"><span>0</span><span>3</span><span>5</span><span>7</span><span>10</span></div></div>'+
      '<div class="anpl"><small>Power level</small><b>'+Pw.pl.toFixed(1)+'</b><small>/ 10</small></div></div>'+
    '<div class="anpillars">'+g.map(([k,v])=>'<div class="anp"><span>'+k+'</span>'+bar(v,100,"hot")+'<b>'+Math.round(v)+'</b></div>').join("")+'</div>'+
    '<h3 class="anh">At a glance</h3><div class="anstats">'+stat("Average mana value",cv.avg.toFixed(2),emi?"with eminence":"printed costs")+stat("Lands",nlands,a.tapped.length+" enter tapped")+stat("Ramp",Pw.ramp,"rocks, dorks, land ramp, reducers")+
      stat("Card draw",a.draw,level(a.draw,4,8,12).toLowerCase())+stat("Interaction",a.removal+a.counter+a.wipe,"removal, counters, wipes")+'</div>'+
    '<h3 class="anh">What to look at</h3><ul class="anins">'+insightsOf(a,Pw,cv).map(([t,x])=>'<li class="'+t+'"><i></i><span>'+esc(x)+'</span></li>').join("")+'</ul><p class="note">Rules of thumb for a 100-card Commander deck, not hard limits.</p>'+
    '<div class="angrid two">'+tile("Mana curve",anCurve(cv.b,mx,"tall")+kv("Average mana value",cv.avg.toFixed(2),emi?'<em>was '+base.avg.toFixed(2)+'</em>':'')+(emi?kv("Dragons discounted",cv.red):'')+kv("Non-land cards",cv.n)+
        (HAS_EMI()?'<button type="button" class="emi" aria-pressed="'+emi+'" data-anemi="1">'+(emi?"Show without eminence":"Apply eminence")+'</button>':''),emi?"Every Dragon costs 1 less, except the commander.":"Printed costs, commander included."+(cv.est?" "+cv.est+" cards still without Scryfall data.":""))+
      tile("Manabase",kv("Lands",nlands)+'<div class="anbasics"><i style="width:'+(nlands?nb/nlands*100:0)+'%"></i><span>'+nb+' basic · '+(nlands-nb)+' nonbasic</span></div>'+kv("Enter tapped",a.tapped.length)+kv("Fetch lands",a.fetches.length),(deckCI().join("")||"Colorless"))+'</div>'+anColours(a);}
function anDeep(a,N){const call=anCallouts(a,N),maxC=Math.max(.0001,...N.classes.map(c=>c.share));
  const reason=x=>x.cls.slice(0,2).map(k=>ANN_CLASSES[k].label).join(" · ");
  const salt='<h3 class="anh">Where the annoyance comes from</h3>'+
    (N.all.length?'<div class="angrid two"><section class="antile"><h4>By kind</h4>'+N.classes.map(c=>'<div class="anrow"><span title="'+esc(c.names.join(", "))+'">'+c.label+'</span>'+bar(c.share,maxC,"salt")+'<b>'+c.n+'</b></div>').join("")+
        '<p class="ansub">Bar = share of the total annoyance, number = cards.</p></section>'+
      '<section class="antile"><h4>Most annoying cards</h4>'+N.top.slice(0,10).map(x=>'<div class="ancard"><span class="nm">'+esc(x.name)+'<small>'+esc(reason(x))+(x.e!=null?' · EDHREC '+x.e.toFixed(1):'')+'</small></span>'+bar(x.u,1,"salt")+'<b>'+Math.round(x.u*100)+'</b></div>').join("")+
        '<p class="ansub">Number = how annoying the card is when it lands (0–100), not how likely you are to draw it.</p></section></div>'+
      '<div class="angrid two"><section class="antile"><h4>Tell the table first</h4>'+(call.length?call.map(([k,v])=>'<div class="ancall"><b>'+k+'</b>'+(v?'<small>'+esc(v)+'</small>':'')+'</div>').join(""):'<p class="ansub">Nothing that usually needs a rule-zero talk.</p>')+'</section>'+
      ''+'</div>'
     :'<p class="w-empty">No card here annoys anybody. Nothing to report.</p>')+
    '<details class="anhow"><summary>How this is calculated</summary><p>Each card gets an annoyance from 0 to 100 from what it does: land destruction, stax, commander neutralizers, theft, extra turns, hand attack, taxes, wipes, edicts, poison, counterspells, tutors, combos and out-of-nowhere wins. A high EDHREC salt vote lifts it. Mana, lands and plain staples count as power, not salt.</p>'+
    '<p>The chance per game is 1 minus the product of (1 − chance the card is among the first '+(7+ANN_TURNS)+' you see × '+Math.round(ANN_PLAYED*100)+'% that it actually gets played and lands × its annoyance). The commander counts as 80% to show up. It is our own formula: a way to compare decks, not a measurement.</p>'+
    '<p>For reference, the raw EDHREC salt sum is <b>'+N.raw.toFixed(1)+'</b> over '+N.rated+' rated cards. It counts every staple, so it is not used for the verdict.'+(AN.saltBusy?' Still reading votes…':'')+'</p></details>';
  const Pw=pillars(a),arch=anArchetypes(a,Pw,N),dep=anDepend(a),maxA=Math.max(.0001,...arch.map(x=>x.score));
  const read='<h3 class="anh">What it is</h3><div class="angrid two"><section class="antile"><h4>Archetypes</h4>'+(arch.length?arch.map(x=>'<div class="anrow"><span>'+esc(x.name)+'</span>'+bar(x.score,maxA)+'<b>'+Math.round(x.n)+'</b></div>').join("")+'<p class="ansub">EDHREC theme names, read from card text. Number = cards or points that match.</p>':'<p class="ansub">No clear archetype: a pile of good stuff.</p>')+'</section>'+
    '<section class="antile"><h4>Commander dependence</h4>'+(dep&&dep.dep!=null?'<div class="anrow"><span>Reliance</span>'+bar(dep.dep,100,"hot")+'<b>'+dep.dep+'</b></div>'+kv("Commander has an engine",dep.engine?"yes":"no")+kv("Cards EDHREC links to it",Math.round(dep.share*100)+"%")+kv("Protection pieces",a.protect)+'<p class="ansub">'+(dep.dep>=65?"Neutralise it and the plan stalls.":dep.dep<=30?"The deck would barely notice losing it.":"It matters, but the deck can keep going without it.")+'</p>':'<p class="ansub">Needs the EDHREC page for this commander. It loads in a moment, or does not exist yet.</p>')+'</section></div>';
  const V=verdictOf(a,Pw,N),why='<h3 class="anh">Why the text says what it says</h3><div class="antile">'+V.arch.map(x=>'<div class="ankv"><span>Archetype: '+esc(x.name)+'</span><b>'+Math.round(x.n)+' / '+x.thr+'</b><em>yes</em></div>').join("")+V.ev.map(e=>'<div class="ankv"><span>'+e.label+'</span><b>'+e.count+' / '+e.thr+'</b><em>'+(e.on?'yes':'no')+'</em></div>').join("")+'<p class="ansub">A trait only appears in the written verdict when its count reaches the threshold. Nothing is claimed from a single card.</p></div>';
  const nlands=a.lands.reduce((t,r)=>t+r.qty,0);
  return salt+read+why+'<h3 class="anh">Deck fingerprint</h3><div class="angrid">'+
   tile("Composition",Object.keys(a.comp).filter(k=>a.comp[k]).map(k=>'<div class="anrow"><span>'+k+'</span>'+bar(a.comp[k],Math.max(...Object.values(a.comp)))+'<b>'+a.comp[k]+'</b></div>').join(""),a.nl+" nonland · "+Math.round(a.perm/Math.max(1,a.nl)*100)+"% permanents")+
   tile("Curve and speed",anCurve(a.curve,Math.max(1,...a.curve))+kv("Average mana value",a.avg.toFixed(2))+kv("Cheap (2 or less)",a.cheap)+kv("Finishers (6+)",a.fin),"Printed costs")+
   tile("Ramp",kv("Mana rocks",a.rocks.length)+kv("Mana creatures",a.dorks.length)+kv("Land ramp",a.landRamp.length)+kv("Treasure makers",a.treas.length)+kv("Rituals",a.rituals.length)+kv("Cost reducers",a.reducers.length),pillars(a).ramp+" pieces in total")+
   tile("Card advantage",kv("Card draw",a.draw,'<em>'+level(a.draw,4,8,12)+'</em>')+kv("Recursion",a.recur,'<em>'+level(a.recur,2,4,6)+'</em>')+kv("Tutors",a.tutor))+
   tile("Interaction",kv("Counterspells",a.counter,'<em>'+level(a.counter,2,4,6)+'</em>')+kv("Removal",a.removal,'<em>'+level(a.removal,4,8,12)+'</em>')+kv("Board wipes",a.wipe,'<em>'+level(a.wipe,2,3,5)+'</em>')+kv("Protection",a.protect,'<em>'+level(a.protect,2,4,6)+'</em>')+kv("Graveyard hate",a.gyhate,'<em>'+level(a.gyhate,1,2,4)+'</em>'))+
   tile("Timing",kv("Instant speed",a.instant.length)+kv("Sorcery speed",a.nl-a.instant.length),Math.round(a.instant.length/Math.max(1,a.nl)*100)+"% of nonland cards at instant speed")+
   tile("Win conditions",kv("Combos in the deck",a.combos.length)+kv("Two-card combos",a.two)+kv("Big threats (6+)",a.fin)+kv("Poison",a.poison.length),a.combos.length?"Combo, with combat backup":"Combat")+
   tile("Engine",kv("Enters triggers",a.etb.length)+kv("Dies triggers",a.dies.length)+kv("Attack triggers",a.atk.length)+kv("Reanimation",a.reanim.length))+
   tile("Typal",a.tribe?kv(a.tribe+"s",a.tribeN)+kv("Share of creatures",Math.round(a.tribeN/Math.max(1,a.creatures)*100)+"%")+kv("Payoffs that name them",a.payoffs.length):'<p class="ansub">No dominant creature type.</p>')+'</div>';}
function renderAnalytics(){const B=document.getElementById("anBody");if(!B||!CUR||DTAB!=="stats")return;
  const a=analyzeDeck();
  if(a.known<a.total*0.8){B.innerHTML='<p class="w-empty">'+esc(AN.prog||"Loading card data…")+'</p>';return;}
  const Pw=pillars(a),N=annoyDeck(a),deep=AN.view==="deep";let V=verdictOf(a,Pw,N);
  if(AN.regen){for(let i=0;i<14&&V.lines.join(" ")===AN.prevText;i++){AN.seed=(AN.seed||0)+1;V=verdictOf(a,Pw,N);}AN.regen=false;}AN.prevText=V.lines.join(" ");
  B.innerHTML=(AN.prog?'<p class="labprog" role="status">'+esc(AN.prog)+'</p>':'')+anVerdict(V)+
   '<div class="anvsw"><div class="seg2" role="group" aria-label="Analytics detail"><button type="button" data-anv="brief" aria-pressed="'+!deep+'">Brief</button><button type="button" data-anv="deep" aria-pressed="'+deep+'">In-depth</button></div><p>'+(deep?"Every number, with the reasoning.":"The main things, in a nutshell.")+'</p></div>'+
   (deep?anDeep(a,N):anBrief(a,Pw))+
   '<p class="note">Sources: card text from Scryfall, roles from Scryfall tags, combos from Commander Spellbook, salt votes from EDHREC. Power level, pillars and the annoyance chance are our own formulas; levels like "Dense" compare to a typical Commander deck. Build '+APP_BUILD+'.</p>';
  B.querySelectorAll("[data-anv]").forEach(b=>b.addEventListener("click",()=>{AN.view=b.dataset.anv;lsSet(NS+"-anview",AN.view);renderAnalytics();}));
  const re=B.querySelector("[data-anre]");if(re)re.addEventListener("click",()=>{AN.regen=true;AN.seed=(AN.seed||0)+1;renderAnalytics();});
  const e=B.querySelector("[data-anemi]");if(e)e.addEventListener("click",()=>{AN.emi=!AN.emi;lsSet(NS+"-anemi",AN.emi);renderAnalytics();});}
async function openAnalytics(){renderAnalytics();const ok=await loadCards();renderAnalytics();if(!ok){const B=document.getElementById("anBody");if(B&&!Object.keys(AN.cards).length)B.innerHTML='<p class="w-empty">Scryfall could not be reached. Try again in a moment.</p>';}
  if(LAB.combos&&!LAB.match){LAB.match=matchCombos();}else if(!LAB.combos)loadCombos().then(()=>{if(LAB.combos){LAB.match=matchCombos();renderAnalytics();}});
  loadSalt();if(typeof loadEDH==='function')loadEDH().then(renderAnalytics).catch(()=>{});}
/* the installed app can keep an old copy alive in the background: on open and on return, compare with the published build and reload if it is newer */
const APP_BUILD=19;
function checkUpdate(){if(location.protocol!=="https:")return;fetch(location.href.split("#")[0],{cache:"no-store"}).then(r=>r.ok?r.text():"").then(t=>{const m=t.match(/const APP_BUILD=(\d+);/);
  if(m&&+m[1]>APP_BUILD){let last=0;try{last=+sessionStorage.getItem("cd-rl")||0;}catch(e){}if(Date.now()-last>30000){try{sessionStorage.setItem("cd-rl",String(Date.now()));}catch(e){}hardRefresh();}}}).catch(()=>{});}
setTimeout(checkUpdate,2500);document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")checkUpdate();});
/* pull down from the top of any screen to get the latest version. It drops the stored copy of the app (service worker and file cache) and reloads; decks and marks live in local storage and are never touched. */
async function hardRefresh(){try{const regs=await navigator.serviceWorker.getRegistrations();await Promise.all(regs.map(r=>r.unregister()));}catch(e){}
  try{const ks=await caches.keys();await Promise.all(ks.map(k=>caches.delete(k)));}catch(e){}
  try{await fetch(location.href.split("#")[0],{cache:"reload"});}catch(e){}
  location.reload();}
(function(){const el=document.createElement("div");el.className="ptr";el.setAttribute("aria-hidden","true");el.innerHTML='<i></i>';document.body.appendChild(el);
  let y0=null,x0=0,pull=0,busy=false;const TH=84;
  const top=()=>(document.scrollingElement||document.documentElement).scrollTop<=0;
  const scrolledInside=t=>{for(let n=t;n&&n!==document.body;n=n.parentElement){if(n.scrollTop>0)return true;if(/^(INPUT|TEXTAREA|SELECT)$/.test(n.tagName))return true;}return false;};
  const paint=()=>{el.style.transform="translate(-50%,"+Math.min(pull,TH*1.4)*.7+"px)";el.style.opacity=Math.min(1,pull/TH);el.classList.toggle("ready",pull>=TH);el.firstChild.style.transform="rotate("+Math.min(360,pull/TH*270)+"deg)";};
  document.addEventListener("touchstart",e=>{if(busy||e.touches.length!==1||!top()||scrolledInside(e.target)){y0=null;return;}y0=e.touches[0].clientY;x0=e.touches[0].clientX;pull=0;},{passive:true});
  document.addEventListener("touchmove",e=>{if(y0==null||busy)return;const dy=e.touches[0].clientY-y0,dx=Math.abs(e.touches[0].clientX-x0);
    if(dy<=0||dx>dy){pull=0;paint();return;}if(!top()){y0=null;pull=0;paint();return;}pull=dy;paint();},{passive:true});
  const end=()=>{if(y0==null)return;const go=pull>=TH;y0=null;
    if(go){busy=true;el.classList.add("spin");el.style.opacity=1;el.style.transform="translate(-50%,"+TH*.7+"px)";hardRefresh();}
    else{pull=0;paint();}};
  document.addEventListener("touchend",end,{passive:true});document.addEventListener("touchcancel",end,{passive:true});})();
