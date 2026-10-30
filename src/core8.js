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
  edict:/(target (player|opponent)|each opponent|that player|each other player) sacrifices? (a|an|two|three|all|each|that)?[^.]*?(creature|nonland permanent|permanent|artifact|enchantment|planeswalker)/i,
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
  fw:["{p}% to upset anybody and a power level of {pl}: it's fair because it can't afford to be anything else.",
      "Harmless in every direction. {p}% per game, and it still loses. That's not politeness, it's incompetence with good manners.",
      "{p}%. You're not playing nice, you're just not playing well. Different problem, same table."],
  fo:["{p}% annoyance, a respectable power level of {pl}. It wins sometimes and apologises always.",
      "A fair deck that can still win. {p}% per game: your friends love you, and they know it's because you're no threat.",
      "{p}%. Nice, solid, forgettable. The deck equivalent of 'I'm fine with whatever'."],
  fg:["{p}% annoyance at power level {pl}: it wins and nobody even gets to complain. Insufferable in a completely legal way.",
      "Strong and clean, {p}% per game. You won't be hated, you'll be quietly resented, which is worse.",
      "{p}%. A deck that beats everyone and leaves no excuse. Your friends will have to go home and think about themselves."],
  mw:["{p}% per game of making somebody sigh, at power level {pl}. All the malice, none of the competence: you annoy people and still lose.",
      "You bother the table {p}% of games and the table still wins. Congratulations on being hated and irrelevant.",
      "{p}%: spicy intentions, soggy execution. People get annoyed at you and then beat you anyway."],
  mo:["{p}% per game. Enough edge to be noticed, enough power ({pl}) to matter. Exactly the friend who gets 'just one more game'.",
      "A proper mix: {p}% annoyance, power {pl}. Your friends call it 'fine' through gritted teeth and tell the group chat the truth afterwards.",
      "{p}%. You'll make somebody slam their cards down, you'll win your share, and you'll lie about both."],
  mg:["{p}% annoyance with power level {pl}: it's strong and it's rude, and somebody will notice both before turn 6.",
      "{p}% per game, power {pl}. You built a deck that wins and makes sure the losers know it.",
      "Strong, spicy, {p}% per game. At some point your friends will ask if you're okay. You'll say 'it's just a game'."],
  sw:["{p}%. You built a machine for ruining evenings and forgot to make it win. All the cruelty, none of the payoff. Power {pl}: pure spite.",
      "{p}% per game and a power level of {pl}: you won't win, you'll just make the game longer, sadder and worse for everyone.",
      "{p}%. The deck is a grudge with no plan. Your friends hate it, and your friends are winning."],
  so:["{p}% per game that somebody leaves angry, at power level {pl}. Funny how the analysis makes it so obvious why you hate your friends.",
      "{p}%. Statistically, somebody leaves this game angry, and that's not the deck's fault, it's yours.",
      "{p}% per game, power {pl}. It's competent and it's cruel, and you know exactly which of those you enjoy more."],
  sg:["{p}% per game with a power level of {pl}: fast, strong and rude, the full set. Pick a pod that has already stopped speaking to you.",
      "{p}%. A weapon. Anyone sitting across from you is braver than you deserve.",
      "{p}% per game, power {pl}. You don't hate your friends, you hate losing to them, and this deck is the cure."]};
/* how it plays: {ci} is the colour identity name, e.g. "Gruul" or "mono-red" */
const AN_POSTURE={
  lock:["{Ci} stax: nobody gets to play, and you get to feel clever about it.","A {ci} deck that doesn't want to win so much as to cancel everybody's evening."],
  combo:["A {ci} deck built to win out of nowhere, so your friends learn the plot at the same time as the ending.","A {ci} countdown to a sentence that starts with 'wait, actually'."],
  control:["{Ci} control: answers everything, wins eventually and makes the waiting miserable for everyone.","A {ci} deck that says no like it's a job, and charges for it."],
  aggro:["A {ci} deck that is impatient: the table doesn't get to sit down before it's already hurting.","A {ci} deck that treats the opening turns like a mugging."],
  bomb:["A {ci} time bomb: {fast} pieces of fast mana, free creatures, and a game that's over before anybody finishes their drink.","A {ci} deck that cheats the big thing in early and lets the table work out how far behind it is."],
  inter:["{Ci} midrange with a toolbox: it kills whatever you play and beats you with whatever is left.","A {ci} bully with answers: it removes your best thing, then reminds you what it was."],
  big:["A {ci} deck of big, slow, expensive things: patient, until the moment it isn't, and then everyone pays for the wait.","A {ci} battlecruiser: build up, wait, and sit on top of the table like a landlord."],
  mid:["A {ci} midrange pile: a bit of everything, a commitment to nothing.","A {ci} deck that is not control, not aggro, not combo, and answers 'what do you play?' with a shrug."]};
/* things that make the list look badly built, each with a severity (higher is picked first) */
const AN_SLOP={
  off:[9,["Cards outside the commander's colours: {n}. Did you build this in the dark, or do you just not read?","{n} off-colour cards in the list. Assembled blindfolded, or just optimistic?"]],
  dupes:[8,["Some non-basic cards appear more than once. This is singleton Commander, not a hobby.","You've got repeats in a format that bans them. Counting is not your strong suit."]],
  messy:[8,["Synergy is thin and the list reads like a bag of favourite cards. That's not a deck, that's a mood board.","The pieces don't talk to each other. Less a deck, more a group of strangers sharing an elevator."]],
  nowin:[7,["Win conditions {win}/100: it's not clear this deck knows what winning looks like.","With win conditions at {win}/100, this is a hobby, not a deck."]],
  thin:[6,["{col} is thin: {src} sources for {pips} pips. Pray to the shuffler, because nothing else will help.","You want {col} and you brought {src} sources for {pips} pips. Ambition is free; mana isn't."]],
  curve:[6,["Average mana value {mv} with only {ramp} ramp pieces: you built a feast for a table with no cutlery.","Average mana value {mv} and just {ramp} ramp pieces. Bold of you to assume you'll live that long."]],
  lands:[5,["{lands} lands for a deck this hungry. Either trust the maths or stop pretending.","{lands} lands in a deck that wants more. The mana base was an afterthought, and it shows."]],
  nodraw:[5,["{draw} sources of card draw. When the hand runs dry you'll be playing top-deck roulette.","Card draw: {draw}. Your hand will empty and so will your plan."]],
  tapped:[4,["{tapped} lands enter tapped. Slow on purpose, or by accident?","{tapped} tapped lands. The deck begins every game by apologising for its own speed."]],
  cons:[4,["Consistency {cons}/100: the deck draws what it draws and prays. More engines, fewer ideas.","Consistency {cons}/100. Every game is a different deck, and most of them are bad."]],
  slow:[3,["Efficiency {eff}/100: clunky. Half the hand is a paperweight until it's too late.","Efficiency {eff}/100: it works eventually, as long as nobody is in a hurry, and somebody always is."]],
  noint:[3,["There's almost nothing in it to stop what anyone else does. Your defence plan is hope.","Interaction {inter}/100: when somebody does something, you watch, like a nature documentary."]]};
const AN_GOOD=["Consistency {cons}/100, efficiency {eff}/100: it works, it works often, and that's the real insult.","The numbers say it's coherent: {cons} consistency, {eff} efficiency. Any loss is yours to own."];
const AN_MEH=["{cons} consistency and {eff} efficiency: not broken, not sharp. Respectable, in the way beige is.","{cons} consistency, {eff} efficiency. It works until you're tempted to be clever."];
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
const AN_CIN={"W":"mono-white","U":"mono-blue","B":"mono-black","R":"mono-red","G":"mono-green","WU":"Azorius","UB":"Dimir","BR":"Rakdos","RG":"Gruul","GW":"Selesnya","WB":"Orzhov","UR":"Izzet","BG":"Golgari","RW":"Boros","GU":"Simic",
  "WUB":"Esper","UBR":"Grixis","BRG":"Jund","RGW":"Naya","GWU":"Bant","WBR":"Mardu","URG":"Temur","BGW":"Abzan","RWU":"Jeskai","GUB":"Sultai"};
function anCiName(ci){const set=COLORS.filter(c=>ci.includes(c)).sort().join("");
  for(const k in AN_CIN)if(k.split("").sort().join("")===set)return AN_CIN[k];
  if(set.length===0)return "colourless";if(set.length===4)return "four-colour (no "+CNAME[COLORS.find(c=>!ci.includes(c))].toLowerCase()+")";return "five-colour";}
const AN_CHEAT=/(from (your|their) hand|from (your|their) library|top (\w+ )?cards? of (your|their) library)[^.]*onto the battlefield|onto the battlefield[^.]*from (your|their) hand|without paying (its|their|that|the) mana cost/i;
const anCheat=r=>AN_CHEAT.test(r.c.ot||"")&&/\b(creature|permanent)\b/i.test(r.c.ot||"");
function verdictOf(a,Pw,N){const p=Math.round(N.P*100),ti=AN_TIERS.findIndex(t=>p<t[0]),pl=Pw.pl;
  const key=((CUR&&CUR.name)||"deck")+"|"+a.cmds.join("+")+"|"+a.total,h=k=>anHash(key+k);
  const ci=deckCI(),ciName=anCiName(ci),cr=a.R||[],nonCmd=cr.filter(r=>!r.cmd&&!isType(r.c,"Land")),cmdRows=cr.filter(r=>r.cmd);
  const crShare=a.creatures/Math.max(1,a.nl),dom=N.classes[0];
  const cheatCmd=cmdRows.some(anCheat),cheatOthers=nonCmd.filter(anCheat).length,cheat=cheatOthers+(cheatCmd?1:0);
  const fast=(a.rocks||[]).filter(r=>r.c.cmc<=2).length+(a.dorks||[]).filter(r=>r.c.cmc<=2).length+(a.rituals||[]).length+(a.landRamp||[]).filter(r=>r.c.cmc<=2).length;
  const counterReal=nonCmd.filter(r=>ANN_RX.counter.test(r.c.ot||"")).reduce((t,r)=>t+r.qty,0),hasU=ci.includes("U");
  const nlands=(a.lands||[]).reduce((t,r)=>t+r.qty,0),ramp=Pw.ramp||0;
  const thinC=COLORS.filter(k=>ci.includes(k)&&a.dem[k]>=6&&a.src[k]<12).sort((x,y)=>a.dem[y]-a.dem[x])[0];
  const off=ci.length?nonCmd.filter(r=>(r.c.ci||[]).some(c=>!ci.includes(c))).length:0;
  const dupes=cr.filter(r=>r.qty>1&&!/\bBasic\b/.test(r.c.tl||"")).length;
  const vars={p,pl:pl.toFixed(1),inter:Math.round(Pw.inter),win:Math.round(Pw.win),cons:Math.round(Pw.cons),eff:Math.round(Pw.eff),fast,n:off,lands:nlands,mv:a.avg.toFixed(2),ramp,draw:a.draw,tapped:(a.tapped||[]).length,
    col:thinC?CNAME[thinC]:"",src:thinC?a.src[thinC]:0,pips:thinC?a.dem[thinC]:0,ci:ci.length?ciName:"",Ci:ci.length?ciName.charAt(0).toUpperCase()+ciName.slice(1):""};
  const fill=s=>{const t=s.replace(/\{(\w+)\}/g,(m,k)=>k in vars?vars[k]:m).replace(/\s{2,}/g," ").trim();return t.charAt(0).toUpperCase()+t.slice(1);};
  const spice=p<25?"f":p<55?"m":"s",perf=pl<4.5?"w":pl<6.8?"o":"g";
  const posture=(dom&&p>=40&&dom.share>=.4&&["mld","stax","tax"].includes(dom.k))?"lock"
    :((a.two>=1&&a.combos.length>=2)||a.combos.length>=4)&&Pw.win>=45?"combo":(cheat>=1&&fast>=5&&(a.fin>=4||a.avg>=3.6))?"bomb"
    :(hasU&&counterReal+a.wipe*2>=5&&Pw.inter>=45&&crShare<.5)?"control":crShare>=.55&&a.avg<=3.3?"aggro":Pw.inter>=55?"inter":a.avg>=3.6?"big":"mid";
  const issues=[];const add=k=>issues.push(k);
  if(off>0)add("off");if(dupes>0)add("dupes");if(pl<4&&Pw.cons<40&&Pw.win<35)add("messy");else if(Pw.win<25)add("nowin");
  if(thinC)add("thin");if(a.avg>=4&&ramp<8)add("curve");if(nlands>0&&nlands<33&&a.avg>3.2)add("lands");if(a.rolesReady&&a.draw<4)add("nodraw");
  if((a.tapped||[]).length>=8)add("tapped");if(Pw.cons<35&&!issues.includes("messy"))add("cons");if(Pw.eff<50)add("slow");if(a.rolesReady&&Pw.inter<20)add("noint");
  issues.sort((x,y)=>AN_SLOP[y][0]-AN_SLOP[x][0]);
  /* one paragraph: who it is, how rude/strong it is, what is wrong with the build (or how well it works), closing verdict */
  const L=[fill(anPick(AN_POSTURE[posture],h("b"))),fill(anPick(AN_MOOD[spice+perf],h("a")))];
  if(cheatCmd&&cheatOthers<=3)L.push("Everything hangs on the commander: neutralise it and what's left is a pile of expensive creatures"+(a.protect<=1?" with almost nothing to protect them.":"."));
  issues.slice(0,L.length>2?1:2).forEach((k,i)=>L.push(fill(anPick(AN_SLOP[k][1],h("s"+i)))));
  if(!issues.length)L.push(fill(anPick(Pw.cons>=70&&Pw.eff>=70?AN_GOOD:AN_MEH,h("g"))));
  L.push(anPick(AN_L3X[spice+perf]||AN_L3[ti],h("d")));
  return {p,ti,title:AN_TIERS[ti][1],lines:L,posture,issues,ci:ciName};}
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
function anVerdict(V){return '<section class="anverdict" data-tier="'+V.ti+'"><div class="anvtext"><p class="ankick">The verdict</p><h3>'+V.title+'</h3>'+'<p>'+V.lines.join(" ")+'</p>'+'</div>'+
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
  const nlands=a.lands.reduce((t,r)=>t+r.qty,0);
  return salt+'<h3 class="anh">Deck fingerprint</h3><div class="angrid">'+
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
  const Pw=pillars(a),N=annoyDeck(a),V=verdictOf(a,Pw,N),deep=AN.view==="deep";
  B.innerHTML=(AN.prog?'<p class="labprog" role="status">'+esc(AN.prog)+'</p>':'')+anVerdict(V)+
   '<div class="anvsw"><div class="seg2" role="group" aria-label="Analytics detail"><button type="button" data-anv="brief" aria-pressed="'+!deep+'">Brief</button><button type="button" data-anv="deep" aria-pressed="'+deep+'">In-depth</button></div><p>'+(deep?"Every number, with the reasoning.":"The main things, in a nutshell.")+'</p></div>'+
   (deep?anDeep(a,N):anBrief(a,Pw))+
   '<p class="note">Sources: card text from Scryfall, roles from Scryfall tags, combos from Commander Spellbook, salt votes from EDHREC. Power level, pillars and the annoyance chance are our own formulas; levels like "Dense" compare to a typical Commander deck. Build 8.</p>';
  B.querySelectorAll("[data-anv]").forEach(b=>b.addEventListener("click",()=>{AN.view=b.dataset.anv;lsSet(NS+"-anview",AN.view);renderAnalytics();}));
  const e=B.querySelector("[data-anemi]");if(e)e.addEventListener("click",()=>{AN.emi=!AN.emi;lsSet(NS+"-anemi",AN.emi);renderAnalytics();});}
async function openAnalytics(){renderAnalytics();const ok=await loadCards();renderAnalytics();if(!ok){const B=document.getElementById("anBody");if(B&&!Object.keys(AN.cards).length)B.innerHTML='<p class="w-empty">Scryfall could not be reached. Try again in a moment.</p>';}
  if(LAB.combos&&!LAB.match){LAB.match=matchCombos();}else if(!LAB.combos)loadCombos().then(()=>{if(LAB.combos){LAB.match=matchCombos();renderAnalytics();}});
  loadSalt();}
