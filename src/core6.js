/* ---------- life counter: 2–6 players, commander damage, poison, around-the-table layout ---------- */
const LIFE_COLORS=["#e8745e","#7fb2e5","#ffbf65","#9fcf9b","#c9a7e8","#f2a6c0"];
const LIFE_SEATS={ /* grid template and, per seat, [grid-area, rotation] for "around the table" */
  2:{cols:"1fr",rows:"1fr 1fr",seats:[["2/1/3/2",0],["1/1/2/2",180]]},
  3:{cols:"1fr 1fr",rows:"1fr 1fr",seats:[["1/1/3/2",90],["1/2/2/3",-90],["2/2/3/3",-90]]},
  4:{cols:"1fr 1fr",rows:"1fr 1fr",seats:[["2/1/3/2",90],["1/1/2/2",90],["1/2/2/3",-90],["2/2/3/3",-90]]},
  5:{cols:"1fr 1fr",rows:"repeat(6,1fr)",seats:[["4/1/7/2",90],["1/1/4/2",90],["1/2/3/3",-90],["3/2/5/3",-90],["5/2/7/3",-90]]},
  6:{cols:"1fr 1fr",rows:"1fr 1fr 1fr",seats:[["3/1/4/2",90],["2/1/3/2",90],["1/1/2/2",90],["1/2/2/3",-90],["2/2/3/3",-90],["3/2/4/3",-90]]}};
let LIFE=lsGet(NS+"-life");
function lifeNew(n,start,keep){const old=(keep&&LIFE&&LIFE.players)||[];
  const players=Array.from({length:n},(_,i)=>{const o=old[i]||{};return {name:o.name||"Player "+(i+1),color:o.color||LIFE_COLORS[i%LIFE_COLORS.length],art:o.art||"",cmdName:o.cmdName||"",life:start,poison:0,cmd:{}};});
  LIFE={n,start,orient:(LIFE&&LIFE.orient)||(matchMedia("(pointer:coarse)").matches?"table":"upright"),players,first:null,log:[]};saveLife();}
if(!LIFE||!LIFE.players||!LIFE_SEATS[LIFE.n])lifeNew(4,40);
function saveLife(){lsSet(NS+"-life",LIFE);}
const isDead=p=>p.life<=0||p.poison>=10||Object.values(p.cmd).some(v=>v>=21);
const L$=id=>document.getElementById(id);
let lifeWake=null,lifePrevHash="";
async function wakeOn(){try{if("wakeLock" in navigator&&!lifeWake){lifeWake=await navigator.wakeLock.request("screen");lifeWake.addEventListener("release",()=>{lifeWake=null;});}}catch(e){}}
document.addEventListener("visibilitychange",()=>{if(!L$("life").hidden&&document.visibilityState==="visible")wakeOn();});
function openLife(){const O=L$("life");O.hidden=false;document.documentElement.classList.add("lifeon");lifePrevHash=location.hash;history.replaceState(null,"","#play");renderLife();wakeOn();}
function closeLife(){L$("life").hidden=true;document.documentElement.classList.remove("lifeon");L$("lMenu").hidden=true;L$("lSheet").hidden=true;
  if(lifeWake){lifeWake.release().catch(()=>{});lifeWake=null;}history.replaceState(null,"",lifePrevHash&&lifePrevHash!=="#play"?lifePrevHash:"#home");}
function renderLife(){const G=L$("lGrid"),T=LIFE_SEATS[LIFE.n],table=LIFE.orient==="table";
  const uc=LIFE.n<=2?1:LIFE.n<=4?2:3;G.style.gridTemplateColumns=table?T.cols:"repeat("+uc+",1fr)";G.style.gridTemplateRows=table?T.rows:"repeat("+Math.ceil(LIFE.n/uc)+",1fr)";
  G.innerHTML="";
  LIFE.players.forEach((p,i)=>{const [area,rot]=T.seats[i];const el=document.createElement("section");el.className="lseat";el.dataset.i=i;
    if(table)el.style.gridArea=area;const r=table?rot:0;el.dataset.rot=r;
    el.style.setProperty("--pc",p.color);if(p.art){el.style.setProperty("--art","url('"+p.art.replace(/'/g,"%27")+"')");el.classList.add("hasart");}
    el.innerHTML='<div class="lin" style="--r:'+r+'deg"><button type="button" class="lzone minus" data-d="-1" aria-label="'+esc(p.name)+' loses 1 life"></button><button type="button" class="lzone plus" data-d="1" aria-label="'+esc(p.name)+' gains 1 life"></button>'+
      '<button type="button" class="lname" data-sheet="'+i+'">'+esc(p.name)+(LIFE.first===i?' <i class="lfirst">first</i>':'')+'</button>'+
      '<div class="llife" aria-live="polite"><b></b><span class="ldelta"></span></div>'+
      '<span class="lpm" aria-hidden="true"><i>−</i><i>+</i></span>'+
      '<div class="lchips"></div></div>';
    G.appendChild(el);paintSeat(i);});
  L$("life").classList.toggle("upright",!table);}
function paintSeat(i){const p=LIFE.players[i],el=L$("lGrid").querySelector('.lseat[data-i="'+i+'"]');if(!el)return;
  el.querySelector(".llife b").textContent=p.life;el.classList.toggle("dead",isDead(p));
  const cmdTot=Object.values(p.cmd).reduce((a,v)=>a+v,0),cmdMax=Math.max(0,...Object.values(p.cmd));
  el.querySelector(".lchips").innerHTML='<button type="button" data-sheet="'+i+'" class="'+(p.poison?"on":"")+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z"/></svg>'+p.poison+'</button>'+
    '<button type="button" data-sheet="'+i+'" class="'+(cmdTot?"on":"")+(cmdMax>=15?" warn":"")+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M15 5h4v4M9 15l-4 4M5 15l4 4"/></svg>'+cmdMax+'</button>';}
/* life changes: tap = 1, hold = 10 every half second; a bubble sums the recent change */
const lifeDelta={};
function changeLife(i,d){const p=LIFE.players[i];p.life+=d;saveLife();paintSeat(i);
  const el=L$("lGrid").querySelector('.lseat[data-i="'+i+'"] .ldelta');const D=lifeDelta[i]||(lifeDelta[i]={v:0,t:null});D.v+=d;
  el.textContent=(D.v>0?"+":"")+D.v;el.classList.add("show");clearTimeout(D.t);D.t=setTimeout(()=>{el.classList.remove("show");LIFE.log.push([i,D.v,Date.now()]);if(LIFE.log.length>200)LIFE.log.shift();saveLife();D.v=0;},1600);}
let holdT=null,holdI=null,held=false;
L$("lGrid").addEventListener("pointerdown",e=>{const z=e.target.closest(".lzone");if(!z)return;e.preventDefault();const i=+z.closest(".lseat").dataset.i,d=+z.dataset.d;held=false;
  clearTimeout(holdT);clearInterval(holdI);holdT=setTimeout(()=>{held=true;changeLife(i,d*10);holdI=setInterval(()=>changeLife(i,d*10),550);},450);
  const up=()=>{clearTimeout(holdT);clearInterval(holdI);if(!held)changeLife(i,d);window.removeEventListener("pointerup",up);window.removeEventListener("pointercancel",cancel);};
  const cancel=()=>{clearTimeout(holdT);clearInterval(holdI);window.removeEventListener("pointerup",up);window.removeEventListener("pointercancel",cancel);};
  window.addEventListener("pointerup",up);window.addEventListener("pointercancel",cancel);});
L$("lGrid").addEventListener("click",e=>{const b=e.target.closest("[data-sheet]");if(b)openSheet(+b.dataset.sheet);});
L$("lGrid").addEventListener("contextmenu",e=>e.preventDefault());
/* per-player sheet: commander damage from each opponent, poison, name, colour, commander art */
function openSheet(i){const p=LIFE.players[i],S=L$("lSheet");L$("lMenu").hidden=true;
  const opp=LIFE.players.map((o,j)=>j).filter(j=>j!==i);
  const decks=Object.keys(DECKS.list).filter(id=>(DECKS.list[id].cmd||[]).length);
  S.innerHTML='<div class="lsbox" style="--pc:'+esc(p.color)+'"><div class="lshead"><b>'+esc(p.name)+'</b><button type="button" class="ghostbtn" data-x="close">Done</button></div>'+
    '<p class="lslbl">Commander damage taken <small>21 from one commander is lethal. Changes life too.</small></p>'+
    opp.map(j=>{const o=LIFE.players[j],v=p.cmd[j]||0;return '<div class="lsrow'+(v>=21?" lethal":"")+'"><span class="dot" style="background:'+esc(o.color)+'"></span><span class="who">'+esc(o.name)+(o.cmdName?'<small>'+esc(o.cmdName)+'</small>':'')+'</span><span class="qctl"><button type="button" data-c="'+j+'" data-d="-1" aria-label="One less from '+esc(o.name)+'">−</button><b>'+v+'</b><button type="button" data-c="'+j+'" data-d="1" aria-label="One more from '+esc(o.name)+'">+</button></span></div>';}).join("")+
    '<div class="lsrow'+(p.poison>=10?" lethal":"")+'"><span class="dot pois"></span><span class="who">Poison counters<small>10 is lethal</small></span><span class="qctl"><button type="button" data-p="-1" aria-label="One less poison">−</button><b>'+p.poison+'</b><button type="button" data-p="1" aria-label="One more poison">+</button></span></div>'+
    '<p class="lslbl">Player</p><label class="lsfield">Name<input id="lsName" value="'+esc(p.name)+'" maxlength="24" autocomplete="off"></label>'+
    '<div class="lscolors" role="group" aria-label="Colour">'+LIFE_COLORS.map(c=>'<button type="button" data-col="'+c+'" style="background:'+c+'" aria-pressed="'+(c===p.color)+'" aria-label="Colour '+c+'"></button>').join("")+'</div>'+
    '<label class="lsfield">Commander<input id="lsCmd" value="'+esc(p.cmdName)+'" placeholder="Type a commander for the background" autocomplete="off"></label>'+
    (decks.length?'<div class="lsdecks">'+decks.map(id=>'<button type="button" data-deck="'+esc(id)+'">'+esc(DECKS.list[id].name)+'</button>').join("")+'</div>':'')+
    (p.art?'<button type="button" class="ghostbtn" data-x="noart">Remove background</button>':'')+'</div>';
  S.hidden=false;S.dataset.i=i;}
function setCmdArt(i,name){const p=LIFE.players[i];p.cmdName=name;p.art=name?"https://api.scryfall.com/cards/named?fuzzy="+encodeURIComponent(name)+"&format=image&version=art_crop":"";saveLife();renderLife();}
L$("lSheet").addEventListener("click",e=>{const S=L$("lSheet"),i=+S.dataset.i,p=LIFE.players[i];if(e.target===S){S.hidden=true;return;}
  const b=e.target.closest("button");if(!b)return;
  if(b.dataset.x==="close"){S.hidden=true;return;}
  if(b.dataset.x==="noart"){p.art="";p.cmdName="";saveLife();renderLife();openSheet(i);return;}
  if(b.dataset.c!=null){const j=+b.dataset.c,d=+b.dataset.d,v=p.cmd[j]||0;if(v+d<0)return;p.cmd[j]=v+d;changeLife(i,-d);openSheet(i);return;}
  if(b.dataset.p){p.poison=Math.max(0,p.poison+(+b.dataset.p));saveLife();paintSeat(i);openSheet(i);return;}
  if(b.dataset.col){p.color=b.dataset.col;saveLife();renderLife();openSheet(i);return;}
  if(b.dataset.deck){const d=DECKS.list[b.dataset.deck];const c=(d.cmd||[])[0];if(c){p.name=p.name.startsWith("Player ")?d.name:p.name;setCmdArt(i,front(c));openSheet(i);}}});
L$("lSheet").addEventListener("change",e=>{const i=+L$("lSheet").dataset.i,p=LIFE.players[i];
  if(e.target.id==="lsName"){p.name=e.target.value.trim()||("Player "+(i+1));saveLife();renderLife();}
  if(e.target.id==="lsCmd"){setCmdArt(i,e.target.value.trim());openSheet(i);}});
/* game menu */
let lifeRoll="";
function openMenu(){const M=L$("lMenu");L$("lSheet").hidden=true;
  M.innerHTML='<div class="lsbox"><div class="lshead"><b>Game</b><button type="button" class="ghostbtn" data-m="hide">Back</button></div>'+
    '<p class="lslbl">Players</p><div class="lseg">'+[2,3,4,5,6].map(n=>'<button type="button" data-n="'+n+'" aria-pressed="'+(LIFE.n===n)+'">'+n+'</button>').join("")+'</div>'+
    '<p class="lslbl">Starting life</p><div class="lseg">'+[20,25,30,40].map(n=>'<button type="button" data-s="'+n+'" aria-pressed="'+(LIFE.start===n)+'">'+n+'</button>').join("")+'</div>'+
    '<p class="lslbl">Layout</p><div class="lseg"><button type="button" data-o="table" aria-pressed="'+(LIFE.orient==="table")+'">Around the table</button><button type="button" data-o="upright" aria-pressed="'+(LIFE.orient==="upright")+'">All facing me</button></div>'+
    '<div class="lacts"><button type="button" data-m="first">Random first player</button><button type="button" data-m="d20">Roll d20</button><button type="button" data-m="d6">Roll d6</button><button type="button" data-m="coin">Flip a coin</button></div>'+
    (lifeRoll?'<p class="lroll" role="status">'+esc(lifeRoll)+'</p>':'')+
    '<div class="lacts"><button type="button" class="btn-acc" data-m="restart">Restart game</button><button type="button" data-m="exit">Exit</button></div></div>';
  M.hidden=false;}
L$("lHub").addEventListener("click",()=>{if(L$("lMenu").hidden)openMenu();else L$("lMenu").hidden=true;});
L$("lMenu").addEventListener("click",async e=>{const M=L$("lMenu");if(e.target===M){M.hidden=true;return;}const b=e.target.closest("button");if(!b)return;
  if(b.dataset.n){lifeNew(+b.dataset.n,LIFE.start,true);renderLife();openMenu();return;}
  if(b.dataset.s){const s=+b.dataset.s;const fresh=LIFE.players.every(p=>p.life===LIFE.start&&!p.poison&&!Object.keys(p.cmd).length);LIFE.start=s;if(fresh)LIFE.players.forEach(p=>p.life=s);saveLife();renderLife();openMenu();return;}
  if(b.dataset.o){LIFE.orient=b.dataset.o;saveLife();renderLife();openMenu();return;}
  const m=b.dataset.m;const rnd=k=>1+Math.floor((crypto.getRandomValues(new Uint32Array(1))[0]/4294967296)*k);
  if(m==="hide")M.hidden=true;
  if(m==="first"){LIFE.first=rnd(LIFE.n)-1;saveLife();renderLife();lifeRoll=LIFE.players[LIFE.first].name+" goes first.";M.hidden=true;
    const el=L$("lGrid").querySelector('.lseat[data-i="'+LIFE.first+'"]');if(el){el.classList.add("pick");setTimeout(()=>el.classList.remove("pick"),1600);}}
  if(m==="d20"){lifeRoll="d20: "+rnd(20);openMenu();}
  if(m==="d6"){lifeRoll="d6: "+rnd(6);openMenu();}
  if(m==="coin"){lifeRoll=rnd(2)===1?"Heads":"Tails";openMenu();}
  if(m==="restart"){if(!await ask("Start a new game? Life, poison and commander damage go back to the start. Names and colours stay.","Restart"))return;lifeNew(LIFE.n,LIFE.start,true);lifeRoll="";renderLife();M.hidden=true;}
  if(m==="exit")closeLife();});
document.getElementById("playOpen").addEventListener("click",openLife);
document.addEventListener("click",e=>{if(e.target.closest('[data-act="play"]'))openLife();});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!L$("life").hidden){if(!L$("lSheet").hidden)L$("lSheet").hidden=true;else if(!L$("lMenu").hidden)L$("lMenu").hidden=true;else closeLife();}});
if(location.hash==="#play")setTimeout(openLife,0);
