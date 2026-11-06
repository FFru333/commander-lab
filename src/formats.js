
/* ---------- formats: every deck carries one; rules, legality, targets and tone follow it ----------
   size = minimum deck size (exact for commander-style formats), copies = max copies per name (0 = no limit),
   side = max sideboard (-1 = no limit), life = starting life, leg = Scryfall legality key,
   cmd = the deck has a commander slot, voice = table (multiplayer), duel (1v1) or draft. */
const FORMATS={
  commander:{n:"Commander",size:100,exact:1,copies:1,side:0,life:40,leg:"commander",cmd:1,voice:"table",edh:1},
  brawl:{n:"Brawl",size:100,exact:1,copies:1,side:0,life:25,leg:"brawl",cmd:1,voice:"duel"},
  standardbrawl:{n:"Standard Brawl",size:60,exact:1,copies:1,side:0,life:25,leg:"standardbrawl",cmd:1,voice:"duel"},
  oathbreaker:{n:"Oathbreaker",size:60,exact:1,copies:1,side:0,life:20,leg:"oathbreaker",cmd:1,voice:"table",cmdLabel:"Oathbreaker and signature spell"},
  paupercommander:{n:"Pauper Commander",size:100,exact:1,copies:1,side:0,life:30,leg:"paupercommander",cmd:1,voice:"table"},
  duel:{n:"Duel Commander",size:100,exact:1,copies:1,side:0,life:20,leg:"duel",cmd:1,voice:"duel"},
  predh:{n:"PreDH",size:100,exact:1,copies:1,side:0,life:40,leg:"predh",cmd:1,voice:"table"},
  gladiator:{n:"Gladiator",size:100,exact:0,copies:1,side:0,life:20,leg:"gladiator",cmd:0,voice:"duel"},
  standard:{n:"Standard",size:60,copies:4,side:15,life:20,leg:"standard",voice:"duel"},
  pioneer:{n:"Pioneer",size:60,copies:4,side:15,life:20,leg:"pioneer",voice:"duel"},
  modern:{n:"Modern",size:60,copies:4,side:15,life:20,leg:"modern",voice:"duel"},
  premodern:{n:"Premodern",size:60,copies:4,side:15,life:20,leg:"premodern",voice:"duel"},
  legacy:{n:"Legacy",size:60,copies:4,side:15,life:20,leg:"legacy",voice:"duel"},
  vintage:{n:"Vintage",size:60,copies:4,side:15,life:20,leg:"vintage",voice:"duel"},
  pauper:{n:"Pauper",size:60,copies:4,side:15,life:20,leg:"pauper",voice:"duel"},
  oldschool:{n:"Old School 93/94",size:60,copies:4,side:15,life:20,leg:"oldschool",voice:"duel"},
  penny:{n:"Penny Dreadful",size:60,copies:4,side:15,life:20,leg:"penny",voice:"duel"},
  historic:{n:"Historic",size:60,copies:4,side:15,life:20,leg:"historic",voice:"duel"},
  timeless:{n:"Timeless",size:60,copies:4,side:15,life:20,leg:"timeless",voice:"duel"},
  explorer:{n:"Explorer",size:60,copies:4,side:15,life:20,leg:"explorer",voice:"duel"},
  alchemy:{n:"Alchemy",size:60,copies:4,side:15,life:20,leg:"alchemy",voice:"duel"},
  limited:{n:"Draft / Sealed",size:40,copies:0,side:-1,life:20,leg:null,voice:"draft"}};
const FMT_GROUPS=[["Commander and singleton",["commander","brawl","standardbrawl","oathbreaker","paupercommander","duel","predh","gladiator"]],
  ["Constructed",["standard","pioneer","modern","premodern","legacy","vintage","pauper","oldschool","penny"]],
  ["MTG Arena",["historic","timeless","explorer","alchemy"]],["Limited",["limited"]]];
const LEGKEYS=Object.values(FORMATS).map(f=>f.leg).filter(Boolean);
const LEGCH={legal:"l",restricted:"r",banned:"b",not_legal:"n"};
const legPack=L=>L?LEGKEYS.map(k=>LEGCH[L[k]]||"n").join(""):"";
const legOf=(c,key)=>{if(!c||!c.lg||!key)return null;const i=LEGKEYS.indexOf(key);return i<0?null:c.lg[i]||null;};
const fmtKeyOf=d=>d&&FORMATS[d.format]?d.format:"commander";
const fmtOf=d=>FORMATS[fmtKeyOf(d)];
const FMTK=fmtKeyOf(CUR),FMT=FORMATS[FMTK];
const SIDE_CAT="Sideboard";
const isSideCat=c=>c===SIDE_CAT;
/* rules of thumb per format: role targets, land target, colour sources that count as enough, power labels */
function fmtProfile(F){F=F||FMT;const big=F.size>=100,sixty=F.size>=60&&F.size<100;
  if(F.voice==="draft")return {roles:{removal:3},srcOK:8,landT:(avg)=>avg<2.6?16:avg>3.4?18:17,pl:["Trainwreck","Rough","Solid","Strong","Trophy"],what:"40-card Limited deck",s:.4};
  if(F.cmd&&big&&F.voice==="table")return {roles:{ramp:10,draw:10,removal:8,wipe:2,protect:3,recur:2,gyhate:1},srcOK:12,landT:(avg,R)=>38-Math.floor(Math.max(0,R-8)/3),pl:["Casual","Focused casual","Upgraded","Optimized","High power","cEDH"],what:"100-card "+F.n+" deck",s:1};
  if(big)return {roles:{ramp:8,draw:8,removal:10,wipe:2,protect:2,recur:1,gyhate:1},srcOK:12,landT:(avg,R)=>38-Math.floor(Math.max(0,R-8)/3),pl:["Kitchen table","Casual","Tuned","Competitive","Tier 1"],what:"100-card "+F.n+" deck",s:1};
  if(F.cmd)return {roles:{ramp:5,draw:6,removal:6,wipe:1,protect:2,recur:1},srcOK:11,landT:(avg,R)=>Math.max(22,27-Math.floor(R/3)),pl:["Kitchen table","Casual","Tuned","Competitive","Tier 1"],what:"60-card "+F.n+" deck",s:.6};
  return {roles:{},srcOK:13,landT:(avg)=>avg<2.2?21:avg<2.8?23:avg<3.4?24:26,pl:["Kitchen table","Casual","FNM-ready","Competitive","Tier 1"],what:"60-card "+F.n+" deck",s:.6};}
const FP=fmtProfile(FMT);
const roleMin=k=>FP.roles[k]||0;
function plNameF(p){const L=FP.pl;if(L.length===6)return p<3?L[0]:p<5?L[1]:p<7?L[2]:p<8.5?L[3]:p<9.5?L[4]:L[5];return p<3?L[0]:p<5?L[1]:p<7?L[2]:p<8.5?L[3]:L[4];}
/* sideboard counts live beside the list: d.sbq = {name: copies in the sideboard}; cards only in the sideboard also sit in the Sideboard category so they get a status */
const SBQ=CUR&&CUR.sbq||{};
const sideTotal=()=>Object.values(SBQ).reduce((t,n)=>t+(+n||0),0);
/* copies allowed for one card in this format */
function copyLimit(c,F){F=F||FMT;if(!F.copies)return Infinity;const tl=(c&&c.tl)||"",ot=(c&&c.ot)||"";
  if(/\bBasic\b/.test(tl)&&/\bLand\b/.test(tl))return Infinity;if(c&&/^(Snow-Covered )?(Plains|Island|Swamp|Mountain|Forest|Wastes)$/.test(c.n||""))return Infinity;
  if(/A deck can have any number of cards named/i.test(ot))return Infinity;
  const m=ot.match(/A deck can have up to (\w+) cards named/i);if(m){const w={two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10}[m[1].toLowerCase()]||+m[1];if(w)return Math.max(w,F.copies);}
  return F.copies;}
/* the format check: deck size, sideboard, copies, banned / not legal / restricted cards. Needs card data with legalities (AN.cards). */
function fmtReport(F){F=F||FMT;const A=window.__AN;const card=n=>A&&A.cards?A.cards[norm(front(n))]||null:null;
  const main={};let mainN=0;DECK.forEach(([cat,cards])=>{if(isSideCat(cat))return;cards.forEach(n=>{const s=st(n),nm=s.alt&&s.altName&&s.altName.trim()?s.altName.trim():n;main[nm]=(main[nm]||0)+q(n);mainN+=q(n);});});
  const side={};Object.keys(SBQ).forEach(n=>{side[n]=(side[n]||0)+(+SBQ[n]||0);});const sideN=Object.values(side).reduce((t,x)=>t+x,0);
  const names=[...new Set(Object.keys(main).concat(Object.keys(side)))];const issues=[];let unknown=0,checked=0;
  const add=(k,label,n)=>{let it=issues.find(x=>x.k===k);if(!it)issues.push(it={k,label,names:[]});if(n)it.names.push(n);};
  if(F.exact&&mainN!==F.size)add("size",mainN<F.size?"The deck has "+mainN+" cards: "+F.n+" needs exactly "+F.size+".":"The deck has "+mainN+" cards: "+F.n+" allows exactly "+F.size+".");
  else if(!F.exact&&mainN<F.size)add("size","The main deck has "+mainN+" cards: "+F.n+" needs at least "+F.size+".");
  if(F.side>=0&&sideN>F.side)add("side",F.side?"The sideboard has "+sideN+" cards: the limit is "+F.side+".":F.n+" has no sideboard: "+sideN+" cards are listed there.");
  names.forEach(n=>{const c=card(n);if(!c){unknown++;return;}checked++;const tot=(main[n]||0)+(side[n]||0);
    const L=F.leg?legOf(c,F.leg):null;
    if(L==="b")add("banned","Banned in "+F.n,n);else if(L==="n")add("illegal","Not legal in "+F.n,n);
    else if(L==="r"&&tot>1)add("restricted","Restricted to one copy",n+" ("+tot+")");
    const lim=copyLimit(c,F);if(tot>lim)add("copies",F.copies===1?"More than one copy in a singleton format":"More than "+F.copies+" copies",n+" ("+tot+")");});
  if(F.cmd&&!(CUR&&(CUR.cmd||[]).length))add("cmd",F.n+" needs a commander: set one in Edit list.");
  return {issues,mainN,sideN,unknown,checked,ok:!issues.length,ready:!!F.leg?checked>=names.length*.9:true};}
