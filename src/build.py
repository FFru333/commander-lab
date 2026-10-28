import re,sys,os
D=os.path.dirname(os.path.abspath(__file__))
src=open(os.path.join(D,"src.html")).read()
rd=lambda f:open(os.path.join(D,f)).read()
h=src
def rep(a,b,count=1):
    global h
    assert a in h,"MISSING: "+a[:120]
    h=h.replace(a,b) if count==0 else h.replace(a,b,count)

rep('<html lang="it">','<html lang="en">')
rep("<title>Commander checklist</title>","<title>Commander Desk</title>")
rep("</style>",rd("extra.css")+rd("design.css")+rd("design2.css")+rd("design3.css")+"\n</style>")
rep('<link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&display=swap" rel="stylesheet">','<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300..800&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">')
# body markup
i=h.index("<body>");j=h.index("<script>")
h=h[:i]+rd("body.html")+h[j:]
# core 1: from <script> to /* preview */
i=h.index("<script>");j=h.index("/* preview */")
h=h[:i]+rd("core1.js")+"\n\n"+h[j:]
# core 2: curve/meta/widgets/collection
i=h.index("/* mana curve */");j=h.index("const _upd=update;");j=h.index("\n",j)+1
h=h[:i]+rd("core2.js")+"\n"+h[j:]
# core 3: boot
i=h.index('(function(){const sel=document.getElementById("deckSel");');j=h.index("update();\n</script>")+len("update();\n")
h=h[:i]+rd("core4.js")+"\n"+rd("core5.js")+"\n"+rd("core3.js")+h[j:]

rep('function parseList(txt){','function parseListBase(txt){')
rep('async function scryLookup(entries){','async function scryLookupBase(entries){')
# duplicates / API changes
rep('const esc=s=>String(s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;");\n','')
rep('setName:c.set_name,cm:(c.purchase_uris&&c.purchase_uris.cardmarket)||null};pm.classList.remove("open");','setName:c.set_name,rarity:c.rarity,cm:(c.purchase_uris&&c.purchase_uris.cardmarket)||null};pm.classList.remove("open");')
rep('setName:c.set_name,cm:(c.purchase_uris&&c.purchase_uris.cardmarket)||null};}','setName:c.set_name,rarity:c.rarity,cm:(c.purchase_uris&&c.purchase_uris.cardmarket)||null};}')
rep('[em,pm,sheet,pxm,tkm,artM,imM].forEach','[em,pm,sheet,pxm,tkm,artM,imM,awM,thM,cfgM].forEach')
rep('if(!L.per||!items.length){alert("Nessuna carta da stampare o formato troppo piccolo.");return;}','if(!L.per||!items.length){document.getElementById("pxInfo").textContent="Nothing to print, or the paper is too small for one card.";return;}')
rep('if(!w){alert("Il browser ha bloccato la nuova finestra: consenti i popup per questo file.");return;}','if(!w){document.getElementById("pxInfo").textContent="The browser blocked the new window: allow pop-ups for this page and try again.";return;}')

# import: English categories, storage keys, metadata
rep('''const TYPES=[["Creature","Creature"],["Planeswalker","Planeswalker"],["Battle","Battaglie"],["Instant","Istantanei"],["Sorcery","Stregonerie"],["Artifact","Artefatti"],["Enchantment","Incantesimi"],["Land","Terre"]];''','''const TYPES=[["Creature","Creatures"],["Planeswalker","Planeswalkers"],["Battle","Battles"],["Instant","Instants"],["Sorcery","Sorceries"],["Artifact","Artifacts"],["Enchantment","Enchantments"],["Land","Lands"]];''')
rep('''return "Terre";for(const [k,v] of TYPES)if(new RegExp("\\\\b"+k+"\\\\b").test(tl))return v;return "Altro";}''','''return "Lands";for(const [k,v] of TYPES)if(new RegExp("\\\\b"+k+"\\\\b").test(tl))return v;return "Other";}''')
rep('''    const tl=(c.card_faces&&c.card_faces[0].type_line)||c.type_line||"";e.type=c.type_line||tl;
    const rec={eur:c.prices&&(c.prices.eur||c.prices.eur_foil)?+(c.prices.eur||c.prices.eur_foil):null,cmc:c.cmc,dragon:/\\bDragon\\b/.test(tl)&&/Creature/.test(tl),land:/\\bLand\\b/.test(tl)&&!/Creature/.test(tl)};''','''    const tl=(c.card_faces&&c.card_faces[0].type_line)||c.type_line||"";e.type=c.type_line||tl;
    const rec=metaRec(c);''')
rep('add("Comandante",e.name)','add("Commander",e.name)')
rep('''(e.cat||"Da controllare")):(e.cat||(e.type?typeCat(e.type):"Altro"))''','''(e.cat||"To check")):(e.cat||(e.type?typeCat(e.type):"Other"))''')
rep('''typeCat(e.type)==="Terre")||(!e.type&&/^(terre|lands?)$/i''','''typeCat(e.type)==="Lands")||(!e.type&&/^(terre|lands?)$/i''')
rep('''const ord=["Comandante","Creature","Planeswalker","Istantanei","Stregonerie","Artefatti","Incantesimi","Battaglie","Altro","Terre","Da controllare"]''','''const ord=["Commander","Creatures","Planeswalkers","Instants","Sorceries","Artifacts","Enchantments","Battles","Other","Lands","To check"]''')
rep('''(b[0]==="Comandante")-(a[0]==="Comandante")''','''(b[0]==="Commander")-(a[0]==="Commander")''')
rep('''"Mazzo senza nome"''','''"Untitled deck"''')
rep('''created:old?old.created:Date.now()};''','''created:old?old.created:Date.now(),newTags:old&&old.newTags||[]};''')
rep('''let s;try{s=JSON.parse(localStorage.getItem(NS+"-state-"+id))||{}}catch(e){s={}}''','''let s=lsGet(stateKey(id))||seedFor(id);''')
rep('''try{localStorage.setItem(NS+"-state-"+id,JSON.stringify(s))}catch(e){}}''','''lsSet(stateKey(id),s);}''')
rep('''const msg=(offline?"Scryfall non raggiungibile: ho usato i nomi così come sono scritti. ":"")+(nf.length?"Non trovate su Scryfall: "+nf.join(", ")+". ":"");''','''const msg=(offline?"Scryfall could not be reached: names were kept as written. ":"")+(nf.length?"Not found on Scryfall: "+nf.join(", ")+". ":"");''')
rep('''  location.reload();
}
function openImport''','''  lsSet(NS+"-view","deck");history.replaceState(null,"","#deck");location.reload();
}
function deckToText(d){return d.deck.map(([cat,cards])=>"// "+cat+"\\n"+cards.map(n=>((d.qty||{})[n]||1)+" "+n+((d.prints||{})[n]&&d.prints[n].set?" ("+d.prints[n].set.toUpperCase()+") "+d.prints[n].cn:"")).join("\\n")).join("\\n\\n");}
function openImport''')
rep('''document.getElementById("imText").value=imTarget?(CUR.src||""):"";''','''document.getElementById("imText").value=imTarget?(CUR.src||deckToText(CUR)):"";
  if(imTarget&&!CUR.src&&CUR.cmd&&CUR.cmd.length)document.getElementById("imCmd").value=CUR.cmd.join("; ");''')
rep('''document.getElementById("deckDel").addEventListener("click",()=>{if(!CUR)return;if(!confirm("Eliminare il mazzo \\""+CUR.name+"\\" e tutti i suoi segni? Non si può annullare."))return;''','''document.getElementById("deckDel").addEventListener("click",async()=>{if(!CUR)return;if(!await ask("Delete the deck \\""+CUR.name+"\\" and all its marks? This cannot be undone.","Delete deck"))return;''')
rep('''delete DECKS.list[DECKS.current];DECKS.current=Object.keys(DECKS.list)[0]||null;saveDecks();location.reload();});''','''delete DECKS.list[DECKS.current];DECKS.current=Object.keys(DECKS.list)[0]||null;saveDecks();location.reload();});
document.getElementById("cfNo").addEventListener("keydown",e=>{if(e.key==="Escape")document.getElementById("confirmModal").classList.remove("open");});''')

rep('el.addEventListener("click",()=>{if(hoverOK||!el.classList.contains("name"))return;','el.addEventListener("click",()=>{if(hoverOK||el.dataset.sheet!=="1")return;')
rep('[em,pm,sheet,pxm,tkm,artM,imM,awM,thM,cfgM].forEach(m=>m.classList.remove("open"));','[em,pm,sheet,pxm,tkm,artM,imM,awM,thM,cfgM].forEach(m=>m.classList.remove("open"));if(!cmenu.hidden)return;')
rep(".pg i{position:absolute;display:block}@media screen{",".pg i{position:absolute;display:block}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}@media screen{")
# ---------- translations of the remaining interface ----------
T=[
('"Stampa di "','"Printings of "'),
('" stampe. Tocca quella che usi."','" printings. Tap the one you use."'),
('"Carico le stampe da Scryfall…"','"Loading printings from Scryfall…"'),
('"Non riesco a caricare le stampe: serve internet e il nome esatto della carta."','"Printings could not be loaded: this needs an internet connection and the exact card name."'),
('"Foglio di stampa token":"Foglio di stampa proxy"','"Token print sheet":"Proxy print sheet"'),
('" carte, "+L.cols+" × "+L.rows+" = "+L.per+" per foglio, "+pages+(pages===1?" foglio":" fogli")','" cards, "+L.cols+" × "+L.rows+" = "+L.per+" per page, "+pages+(pages===1?" page":" pages")'),
('"Con questi valori non entra nemmeno una carta: riduci margine o spazio."','"Not even one card fits with these values: reduce the margin or the gap."'),
('"stampa predefinita"','"default printing"'),
('" · alternativa"','" · alternative"'),
('" · aggiunta"','" · added"'),
('ch.textContent="Stampa";','ch.textContent="Printing";'),
('rm.textContent="Togli";','rm.textContent="Remove";'),
('gr.textContent="Grafica";','gr.textContent="Art";'),
('"full art":"arte custom"','"full art":"custom art"'),
('r.append("Tolti dal foglio: ")','r.append("Removed from the sheet: ")'),
('r.append("Tolte dal foglio: ")','r.append("Removed from the sheet: ")'),
('"Preparo i testi delle carte…"','"Preparing card text…"'),
('Stampa al 100% (scala reale), senza "adatta alla pagina". La finestra di stampa si apre quando tutte le immagini sono caricate.','Print at 100% (actual size), without &quot;fit to page&quot;. The print dialog opens once every image has loaded.'),
('"Carica un\'immagine per vedere il risultato."','"Upload an image to see the result."'),
('"La tua immagine sta sotto la carta: si vede solo nella finestra dell\'illustrazione, nome, tipo e testo restano sopra. L\'area è approssimata per i frame standard; con stampe borderless o showcase regolala a mano."','"Your image sits under the card: it shows only through the art window, while name, type and text stay on top. The area is approximate for standard frames; adjust it by hand for borderless or showcase printings."'),
('"L\'immagine copre tutta la carta, senza testi: per grafiche già complete."','"The image covers the whole card with no text: for art that is already complete."'),
('"L\'immagine copre tutta la carta e sopra c\'è un layout generato con nome, costo, tipo, testo e forza/costituzione presi da Scryfall."','"The image covers the whole card, with a generated layout on top: name, cost, type, rules text and power/toughness from Scryfall."'),
('" Attenzione: questo browser non salva le immagini, andranno ricaricate alla prossima apertura."','" Note: this browser does not keep images, so they need uploading again next time."'),
('["tt","ns","Alto del box testo"],["bm","ns","Fondo del box testo"],["sx","ew","Margini laterali"],["nt","mv","Posizione del nome"]','["tt","ns","Top of the text box"],["bm","ns","Bottom of the text box"],["sx","ew","Side margins"],["nt","mv","Name position"]'),
('"Grafica: "+it.name','"Art: "+it.name'),
('"Il file non è un\'immagine."','"This file is not an image."'),
('"Immagine a bassa risoluzione (circa "+dpi+" dpi a grandezza reale): in stampa potrebbe sgranare."','"Low-resolution image (about "+dpi+" dpi at actual size): it may look grainy in print."'),
('"Non riesco a leggere questa immagine."','"This image could not be read."'),
('"Nessuna carta riconosciuta nella lista."','"No cards recognised in the list."'),
('"crea copie token: servono proxy della carta copiata"','"makes token copies: you need proxies of the copied card"'),
('" carte lette, "+order.length+" token trovati."','" cards read, "+order.length+" tokens found."'),
('"Errore: non riesco a raggiungere Scryfall ("+e.message+"). Serve una connessione."','"Error: Scryfall could not be reached ("+e.message+"). This needs an internet connection."'),
('"Token trovati ("+T.order.length+" tipi, "+tot+" da stampare)"','"Tokens found ("+T.order.length+" kinds, "+tot+" to print)"'),
('"Token trovati ("+T.order.length+" tipi, "+n+" da stampare)"','"Tokens found ("+T.order.length+" kinds, "+n+" to print)"'),
('" · stampa "+t.print.set.toUpperCase()','" · printing "+t.print.set.toUpperCase()'),
('"Da: "+t.from.join(", ")','"From: "+t.from.join(", ")'),
('ql.textContent="Copie"','ql.textContent="Copies"'),
('"Copie di "+t.name','"Copies of "+t.name'),
('cl.append(cb," Stampa")','cl.append(cb," Print")'),
('pb.textContent="Cambia stampa"','pb.textContent="Change printing"'),
('"Da controllare a mano ("+T.manual.length+")"','"Check by hand ("+T.manual.length+")"'),
('"Carte che sembrano creare token o copie, ma per cui Scryfall non indica un token preciso."','"Cards that seem to make tokens or copies, but with no specific token listed on Scryfall."'),
('"Non trovate su Scryfall ("+T.missing.length+")"','"Not found on Scryfall ("+T.missing.length+")"'),
('". Controlla come sono scritte."','". Check the spelling."'),
('"Leggo la lista…"','"Reading the list…"'),
('"Nessun token selezionato da stampare."','"No tokens selected for printing."'),
('"Lista token copiata."','"Token list copied."'),
('prompt("Copia la lista:",txt)','tkS.textContent="The browser blocked the clipboard."'),
('n+" (sostituita)\\n\\t-> "','n+" (replaced)\\n\\t-> "'),
('"DA COMPRARE CON PREZZI (Cardmarket, da Scryfall)\\nTotale: "','"TO BUY WITH PRICES (Cardmarket, via Scryfall)\\nTotal: "'),
('"   <- sopra 25 €"','"   <- over €25"'),
('"\\n\\nRIEPILOGO\\n"','"\\n\\nSUMMARY\\n"'),
('o+="Ho già: "+b.have.length+"\\nMancano in totale: "+(b.proxy.length+b.buy.length)+"\\n  di cui solo da proxare: "+b.proxy.length+"\\n  di cui da comprare: "+b.buy.length+"\\nDa decidere: "+b.u.length+"\\nAlternative usate: "+alts.length+"\\n";','o+="Owned: "+b.have.length+"\\nMissing in total: "+(b.proxy.length+b.buy.length)+"\\n  to proxy only: "+b.proxy.length+"\\n  to buy: "+b.buy.length+"\\nUndecided: "+b.u.length+"\\nAlternatives used: "+alts.length+"\\n";'),
('sec("HO GIÀ",b.have);sec("SOLO DA PROXARE",b.proxy);sec("DA COMPRARE",b.buy);sec("DA DECIDERE",b.u);','sec("OWNED",b.have);sec("TO PROXY ONLY",b.proxy);sec("TO BUY",b.buy);sec("UNDECIDED",b.u);'),
('"(nessuna)"','"(none)"'),
('exs.textContent="Copiato."','exs.textContent="Copied."'),
('exs.textContent="Seleziona e copia a mano."','exs.textContent="Select the text and copy it by hand."'),
('exs.textContent="Scaricato."','exs.textContent="Downloaded."'),
('(CUR&&CUR.name)||"mazzo"','(CUR&&CUR.name)||"deck"'),
('"Cerco le carte su Scryfall… "','"Looking up cards on Scryfall… "'),
('"Non trovo carte nella lista."','"No cards found in the list."'),
('"Modifica la lista":"Importa un mazzo"','"Edit the list":"Import a deck"'),
('"Aggiorna checklist":"Crea checklist"','"Update":"Create"'),
('"Gli stati delle carte che restano nella lista vengono mantenuti."','"Marks are kept for every card that stays in the list."'),
('"Scrivi prima il nome della carta."','"Type the card name first."'),
('"Anteprima non disponibile: controlla il nome o la connessione."','"Preview not available: check the name or the connection."'),
]
for a,b in T: rep(a,b,0)
# leftovers check: Italian words that should not remain in visible strings
left=[m for m in re.findall(r'"[^"\n]{3,}"',h) if re.search(r"\b(carta|carte|stampa|mazzo|foglio|Chiudi|Annulla|Tutte|Nessun|Errore|Copia|Aggiungi|Togli|immagine|grafica|lista|prezzo|comprare|proxare|decidere)\b",m)]
if left: print("LEFTOVER IT:",left[:40])

out=sys.argv[1] if len(sys.argv)>1 else os.path.join(D,"blank.html")
seed_js=sys.argv[2] if len(sys.argv)>2 else None
if seed_js:
    cfg=open(seed_js).read().strip()
    rep('/*CONFIG*/const NS="cmdr-tool";const SEED=null;/*/CONFIG*/','/*CONFIG*/'+cfg+'/*/CONFIG*/')
open(out,"w").write(h);print("built",out,len(h))
