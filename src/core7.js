/* ---------- install as an app, back up and restore all data ---------- */
if("serviceWorker" in navigator&&location.protocol==="https:")window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
const STANDALONE=matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
const IOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
(function(){const T=document.getElementById("installTip");if(!T||STANDALONE||location.protocol!=="https:")return;let off=null;try{off=localStorage.getItem(NS+"-installtip")}catch(e){}if(off)return;
  T.innerHTML='<div><b>Keep Commander Desk on your home screen</b><p>'+(IOS?'In Safari tap <span class="kbd">Share</span>, then <span class="kbd">Add to Home Screen</span>. It opens full screen, like an app, and always loads the latest version.':'In your browser menu choose <span class="kbd">Install app</span> or <span class="kbd">Add to Home screen</span>. It opens in its own window and always loads the latest version.')+
    ' The installed app keeps its own copy of your data: before installing, use <button type="button" class="linkbtn" data-act="backup">Back up data</button>, then Restore it inside the app.</p></div><button type="button" class="ghostbtn" id="installX" aria-label="Hide this tip">Hide</button>';
  T.hidden=false;document.getElementById("installX").addEventListener("click",()=>{T.hidden=true;try{localStorage.setItem(NS+"-installtip","1")}catch(e){}});})();
/* what a backup holds: every key of this app, minus caches that are rebuilt from Scryfall */
const SKIP_KEYS=["-meta","-img","-roles","-gc","-cardtext"];
function backupKeys(){const out=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);
  if((k.startsWith(NS+"-")||(SEED&&SEED.legacyKey&&k===SEED.legacyKey))&&!SKIP_KEYS.some(x=>k===NS+x))out.push(k);}return out;}
function makeBackup(){const data={};backupKeys().forEach(k=>{data[k]=localStorage.getItem(k);});
  return JSON.stringify({app:"commander-desk",ns:NS,legacy:(SEED&&SEED.legacyKey)||null,seedId:(SEED&&SEED.id)||null,at:new Date().toISOString(),decks:Object.keys(DECKS.list).length,data});}
function dataModal(html){const M=document.getElementById("dataModal");document.getElementById("dataBody").innerHTML=html;M.classList.add("open");}
function closeData(){document.getElementById("dataModal").classList.remove("open");}
function openBackup(){const txt=makeBackup(),n=Object.keys(DECKS.list).length;const d=new Date().toISOString().slice(0,10);
  dataModal('<p class="note">'+n+' deck'+(n===1?"":"s")+' with all marks, notes, layouts, theme and the life counter. Save it as a file, or copy it and paste it in Restore on the other device.</p>'+
    '<div class="exrow"><button type="button" class="btn-acc" id="bkShare">Save backup file</button><button type="button" id="bkCopy">Copy as text</button><button type="button" id="bkClose">Close</button></div><p class="note" id="bkSt" role="status"></p>');
  const st=document.getElementById("bkSt");
  document.getElementById("bkShare").addEventListener("click",async()=>{const name="commander-desk-backup-"+d+".json";const file=new File([txt],name,{type:"application/json"});
    try{if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:"Commander Desk backup"});st.textContent="Backup shared.";return;}}catch(e){if(e&&e.name==="AbortError")return;}
    const a=document.createElement("a");a.href=URL.createObjectURL(file);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000);st.textContent="Backup saved as "+name+".";});
  document.getElementById("bkCopy").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(txt);st.textContent="Copied. Open the other device, choose Restore, and paste.";}catch(e){st.textContent="This browser did not allow copying. Use Save backup file instead.";}});
  document.getElementById("bkClose").addEventListener("click",closeData);}
function readBackup(txt){let j;try{j=JSON.parse(txt);}catch(e){return null;}if(!j||j.app!=="commander-desk"||!j.data)return null;return j;}
async function applyBackup(j){const n=j.decks||0;
  if(!await ask("Replace the data on this device with the backup from "+new Date(j.at).toLocaleString("en-GB")+" ("+n+" deck"+(n===1?"":"s")+")? What is here now is overwritten.","Restore"))return;
  backupKeys().forEach(k=>localStorage.removeItem(k));
  Object.keys(j.data).forEach(k=>{let key=k;if(j.legacy&&k===j.legacy)key=stateKey(j.seedId);else if(j.ns&&j.ns!==NS&&k.startsWith(j.ns+"-"))key=NS+k.slice(j.ns.length);try{localStorage.setItem(key,j.data[k]);}catch(e){}});
  try{sessionStorage.setItem(NS+"-msg","Backup restored: "+n+" deck"+(n===1?"":"s")+".")}catch(e){}
  history.replaceState(null,"","#home");location.reload();}
function openRestore(){if(typeof imM!=="undefined")imM.classList.remove("open");
  dataModal('<p class="note">Choose a backup file, or paste the text you copied.</p><div class="exrow"><label class="btnlink filebtn">Choose file<input type="file" id="rsFile" accept="application/json,.json,text/plain" hidden></label><button type="button" id="rsPaste">Paste</button><button type="button" id="rsClose">Close</button></div>'+
    '<textarea id="rsText" class="tkin" style="height:120px" placeholder="Or paste the backup text here" aria-label="Backup text"></textarea><div class="exrow"><button type="button" class="btn-acc" id="rsGo">Restore</button><span class="note" id="rsSt" role="status"></span></div>');
  const st=document.getElementById("rsSt");const go=txt=>{const j=readBackup(txt);if(!j){st.textContent="That is not a Commander Desk backup.";return;}applyBackup(j);};
  document.getElementById("rsFile").addEventListener("change",async e=>{const f=e.target.files&&e.target.files[0];if(f)go(await f.text());});
  document.getElementById("rsPaste").addEventListener("click",async()=>{try{const t=await navigator.clipboard.readText();document.getElementById("rsText").value=t;go(t);}catch(e){st.textContent="Long-press the box below and choose Paste.";}});
  document.getElementById("rsGo").addEventListener("click",()=>go(document.getElementById("rsText").value));
  document.getElementById("rsClose").addEventListener("click",closeData);}
document.addEventListener("click",e=>{const b=e.target.closest('[data-act="backup"],[data-act="restore"]');if(!b)return;e.preventDefault();if(b.dataset.act==="backup")openBackup();else openRestore();});
document.getElementById("dataModal").addEventListener("click",e=>{if(e.target.id==="dataModal")closeData();});
/* an empty device (e.g. the freshly installed app) offers the restore right in the first screen */
(function(){const R=document.getElementById("imRestore");if(R)R.hidden=Object.keys(DECKS.list).length>0;})();
