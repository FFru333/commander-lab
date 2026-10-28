window.addEventListener("hashchange",()=>{if(/^#add=/i.test(location.hash))location.reload();});
/* add a shared deck from a link: #add=<slug> loads decks/<slug>.json (deck + marks) next to the page */
(function(){const m=/^#add=([a-z0-9-]+)$/i.exec(location.hash||"");if(!m)return;const slug=m[1].toLowerCase();window.__adding=true;
  history.replaceState(null,"","#home");
  const have=Object.keys(DECKS.list).find(id=>DECKS.list[id].from===slug);
  if(have){flash("\""+DECKS.list[have].name+"\" is already in your decks.");return;}
  fetch("decks/"+slug+".json",{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error(r.status);return r.json();}).then(j=>{
    if(!j||!j.deck||!Array.isArray(j.deck.deck))throw new Error("bad file");
    const fresh=lsGet(NS+"-decks");if(fresh&&fresh.list)DECKS=fresh;
    const id="d"+Date.now().toString(36);DECKS.list[id]=Object.assign({},j.deck,{from:slug,created:Date.now()});
    lsSet(stateKey(id),j.state||{});saveDecks();
    try{sessionStorage.setItem(NS+"-msg","Added \""+j.deck.name+"\" with all its marks.")}catch(e){}
    openDeck(id);
  }).catch(()=>flash("That deck link could not be loaded. Check your connection and open the link again."));
})();
/* ---------- boot ---------- */
(function(){const sel=document.getElementById("deckSel");
  const ids=Object.keys(DECKS.list).sort((a,b)=>DECKS.list[a].name.localeCompare(DECKS.list[b].name));
  ids.forEach(id=>{const o=document.createElement("option");o.value=id;o.textContent=DECKS.list[id].name;o.selected=id===DECKS.current;sel.appendChild(o);});
  sel.hidden=!ids.length;
  sel.addEventListener("change",()=>{DECKS.current=sel.value;saveDecks();lsSet(NS+"-view","deck");history.replaceState(null,"","#deck");location.reload();});
  const has=!!CUR;
  document.getElementById("restore").hidden=!(has&&SEED&&DECKS.current===SEED.id);
  if(has){document.getElementById("deckTitle").textContent=CUR.name;}
  let msg=null;try{msg=sessionStorage.getItem(NS+"-msg");sessionStorage.removeItem(NS+"-msg")}catch(e){}
  if(msg)flash(msg);
  if(!ids.length){setView("home");if(!window.__adding)setTimeout(()=>openImport(false),0);}
  else setView(view);
  let intent=null;try{intent=sessionStorage.getItem(NS+"-intent");sessionStorage.removeItem(NS+"-intent")}catch(e){}
  if(intent&&has){setView("deck");runIntent(intent);}
  if(has)startLab();
})();
update();
(function(){let f=null;try{f=JSON.parse(sessionStorage.getItem(NS+"-focus"));sessionStorage.removeItem(NS+"-focus")}catch(e){}
  if(!f)return;if(f.y)window.scrollTo(0,f.y);if(f.name)setTimeout(()=>goRow(f.name),50);})();
