// The factory uses the normal game's state and persistence, never the demo save.
import { state as game } from "../js/core/state.js";
import { loadGame, syncFromCloud, saveGame, navigateWithSave } from "../js/core/save.js";
import { startGameSession } from "../js/core/session.js";
import { unlockFactory, settleFactory, collectFactoryCoins } from "../js/core/factoryModel.js";
import { employees, rarities, boxes, potions } from "../js/data/factory.js";
import { startPlaytimeTracking } from "../js/core/stats.js";

if (await startGameSession(() => saveGame({ cloud: false }))) {
  loadGame();
  await syncFromCloud();
  unlockFactory(game);
  if (!game.factory.unlocked) {
    document.body.innerHTML = '<main style="max-width:620px;margin:12vh auto;padding:24px"><p class="eyebrow">NOCH GESCHLOSSEN</p><h1>Deine Fabrik wartet.</h1><p>Erreiche einen Coinbestand von 100.000 Coins im Cursor Clicker. Danach bleibt die Fabrik dauerhaft freigeschaltet.</p><a class="button primary" href="../">Zurück zum Cursor Clicker</a></main>';
  } else {
    startPlaytimeTracking();
    initFactory();
  }
}
function initFactory() {
document.querySelector(".preview-tag").textContent=location.port==="8916"?"Testspielstand":(["127.0.0.1","localhost"].includes(location.hostname)?"Lokale Vorschau":"Gemeinsamer Spielstand");
const $=s=>document.querySelector(s), employee=id=>employees.find(e=>e.id===id);
const fmt=n=>new Intl.NumberFormat("de-DE",{maximumFractionDigits:1}).format(n);
const whole=n=>new Intl.NumberFormat("de-DE",{maximumFractionDigits:0}).format(Math.floor(n));
// Accessors keep the existing factory UI on the single game wallet/settings.
const state=game.factory;
Object.defineProperties(state,{
  coins:{get:()=>game.coins,set:value=>{game.coins=value;},configurable:true},
  motion:{get:()=>game.settings.animations,set:value=>{game.settings.animations=value;},configurable:true},
});
let storageOK=true;
function save(){saveGame();}
function boost(i,now=Date.now()){const b=state.boosts[i];return b&&b.ends>now?potions.find(p=>p.id===b.id):null;}
function rate(i){return (employee(state.slots[i])?.clicks||0)*(boost(i)?.mult||1);}
function total(){return state.slots.reduce((n,_,i)=>n+rate(i),0);}
function settle(now=Date.now()){return settleFactory(state,now);}
const absence=Date.now()-state.lastSeen,offlineGain=settle();
let toastTimer,opening=false,context=null,lastFocus=null;
function notify(text){clearTimeout(toastTimer);$("#toast").textContent=text;$("#toast").classList.add("visible");toastTimer=setTimeout(()=>$("#toast").classList.remove("visible"),3500);}
function worker(e){return '<div class="worker" aria-hidden="true" style="--outfit:'+e.color+'"><span class="head"></span><span class="hat"></span><span class="torso"></span><span class="arm"></span></div>';}
function usage(id,except=-1){return state.slots.filter((v,i)=>v===id&&i!==except).length;}
function showTab(id){if(!["factory","employees","boxes","potions"].includes(id))return;document.querySelectorAll(".panel").forEach(p=>p.hidden=p.id!==id);document.querySelectorAll("[data-tab]").forEach(b=>{if(b.dataset.tab===id)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current");});}
function renderStations(){
 $("#stations").innerHTML=state.slots.map((id,i)=>{const e=employee(id);return '<article class="station '+(!e?'empty':'')+'" style="--outfit:'+(e?.color||'#81778e')+'"><span class="station-number">ARBEITSPLATZ 0'+(i+1)+'</span><span class="boost-chip" data-chip="'+i+'" hidden></span><div class="desk-scene">'+(e?worker(e)+'<span class="click-bubble" aria-hidden="true">Klick! +1</span>':'<div class="empty-seat" aria-hidden="true">+</div>')+'<div class="monitor" aria-hidden="true"><span class="cursor"></span></div></div><div class="desk" aria-hidden="true"></div><button type="button" class="station-button" data-slot="'+i+'"><strong>'+(e?e.name:'Helfer einsetzen')+'</strong><small data-rate="'+i+'">'+(e?fmt(rate(i))+' Klicks / Sek.':'Dieser Platz wartet auf dich')+'</small></button></article>';}).join("");
}
function renderEmployees(){
 const query=$("#search").value.trim().toLocaleLowerCase("de");
 const list=[...employees].sort((a,b)=>Number(!!state.owned[b.id])-Number(!!state.owned[a.id])||b.rarity-a.rarity).filter(e=>e.name.toLocaleLowerCase("de").includes(query));
 $("#employee-grid").innerHTML=list.map(e=>{const count=state.owned[e.id]||0;return '<article class="employee-card '+(!count?'unknown':'')+'" style="--rarity:'+e.color+'">'+worker(e)+'<span class="rarity-label">'+rarities[e.rarity]+'</span><h3>'+e.name+'</h3><p>'+e.desc+'</p><p><strong>'+e.clicks+' Klicks / Sek.</strong></p><small>'+(count?count+' gesammelt · '+(count-usage(e.id))+' verfügbar':'Noch nicht entdeckt')+'</small><button type="button" class="button" data-assign="'+e.id+'" '+(!count?'disabled':'')+'>'+(count?'Einsetzen':'In Boxen entdecken')+'</button></article>';}).join("")||'<p class="empty-message">Kein Mitarbeiter mit diesem Namen.</p>';
 $("#collection-count").textContent=employees.filter(e=>state.owned[e.id]>0).length+' / '+employees.length;
}
function renderBoxes(){
 $("#box-grid").innerHTML=boxes.map(b=>'<article class="shop-card"><div class="treasure '+b.tone+'" aria-hidden="true"><span>?</span></div><h3>'+b.name+'</h3><p>'+b.desc+'</p><div class="odds">'+b.odds.map((chance,i)=>'<div class="odds-row" style="--rarity:'+employees.find(e=>e.rarity===i).color+'"><span>'+rarities[i]+'</span><i><b style="width:'+chance+'%"></b></i><strong>'+chance+' %</strong></div>').join("")+'</div><button type="button" class="button primary" data-box="'+b.id+'">Öffnen · '+whole(b.price)+' Coins</button></article>').join("");
}
function renderPotions(){
 $("#potion-grid").innerHTML=potions.map(p=>'<article class="shop-card"><div class="bottle" aria-hidden="true" style="--liquid:'+p.color+'">×'+p.mult+'</div><h3>'+p.name+'</h3><p>'+p.desc+'<br><strong>'+p.seconds+' Sekunden · '+p.mult+'× Klickleistung</strong></p><span class="potion-stock">Im Vorrat: '+state.potions[p.id]+'</span><div class="potion-actions"><button type="button" class="button primary" data-potion="'+p.id+'" '+(!state.potions[p.id]?'disabled':'')+'>Benutzen · Mitarbeiter wählen</button><button type="button" class="button" data-buy="'+p.id+'">Nachkaufen · '+whole(p.price)+' Coins</button></div></article>').join("");
}
function metrics(){
 $("#coins").textContent=whole(state.coins);$("#pending").textContent=whole(state.pending);$("#rate").textContent=fmt(total());$("#click-rate").textContent=fmt(total())+' / Sek.';$("#team-count").textContent=state.slots.filter(Boolean).length+' / 3';$("#collect").disabled=state.pending<1;
 const active=[];
 state.slots.forEach((id,i)=>{const e=employee(id),p=boost(i),chip=$('[data-chip="'+i+'"]'),label=$('[data-rate="'+i+'"]');
 if(e&&label)label.textContent=fmt(rate(i))+' Klicks / Sek.';
 if(chip){chip.hidden=!p;if(p)chip.textContent=p.mult+'× · '+Math.ceil((state.boosts[i].ends-Date.now())/1000)+' s';}
 if(p)active.push(e.name+': '+p.mult+'× · '+Math.ceil((state.boosts[i].ends-Date.now())/1000)+' s');});
 $("#active-boosts").textContent=active.join(" / ");
}
function render(){renderStations();renderEmployees();renderPotions();metrics();}
function dialog(title,kicker,body,ctx){
 lastFocus=document.activeElement;context=ctx;$("#dialog-title").textContent=title;$("#dialog-kicker").textContent=kicker;$("#dialog-body").innerHTML=body;
 if(!$("#dialog").open)$("#dialog").showModal();$("#dialog-close").disabled=opening;
}
function close(){if(!opening)$("#dialog").close();}
$("#dialog").addEventListener("cancel",e=>{if(opening)e.preventDefault();});
$("#dialog").addEventListener("close",()=>{context=null;if(lastFocus?.isConnected)lastFocus.focus();});
$("#dialog-close").addEventListener("click",close);
function row(e,attrs,text,disabled=false){return '<button type="button" class="pick-row" '+attrs+(disabled?' disabled':'')+'>'+worker(e)+'<span><strong>'+e.name+'</strong><small>'+text+'</small></span><span class="pick-arrow" aria-hidden="true">→</span></button>';}
function chooseEmployee(slot){
 const rows=employees.filter(e=>state.owned[e.id]).map(e=>row(e,'data-pick="'+e.id+'"',e.clicks+' Klicks / Sek. · '+(state.owned[e.id]-usage(e.id,slot))+' verfügbar',state.owned[e.id]<=usage(e.id,slot))).join("");
 dialog("Wer klickt hier?","ARBEITSPLATZ 0"+(slot+1),'<div class="picker">'+(rows||'<p>Öffne zuerst eine Mitarbeiter-Box, um dein Team zu sammeln.</p><button class="button" data-first-box>Zu den Mitarbeiter-Boxen</button>')+(state.slots[slot]?'<button type="button" class="button" data-remove>Arbeitsplatz freigeben</button>':'')+'</div>',{kind:"slot",slot});
}
function chooseSlot(e){
 dialog("Wohin mit "+e.name+"?","MITARBEITER EINSETZEN",'<div class="picker">'+state.slots.map((id,i)=>'<button type="button" class="pick-row" data-destination="'+i+'" '+(state.owned[e.id]<=usage(e.id,i)?'disabled':'')+'><span><strong>Arbeitsplatz 0'+(i+1)+'</strong><small>'+(employee(id)?.name||'Freier Platz')+'</small></span><span class="pick-arrow">→</span></button>').join("")+'</div>',{kind:"destination",employee:e.id});
}
function assign(slot,id){
 if(id&&state.owned[id]<=usage(id,slot))return notify("Alle Kopien dieses Mitarbeiters sind bereits im Einsatz.");
 settle();if(state.slots[slot]!==id){state.slots[slot]=id;state.boosts[slot]=null;}save();render();close();notify(id?employee(id).name+" klickt jetzt für dich.":"Arbeitsplatz freigegeben.");
}
function choosePotion(p){
 if(!state.potions[p.id])return notify("Dieser Trank ist aufgebraucht.");
 dialog("Wem gibst du den Trank?",p.name.toUpperCase(),'<p>'+p.mult+'× Klickleistung für '+p.seconds+' Sekunden. Pro Mitarbeiter ist ein Trank möglich. Beim Wechseln des Mitarbeiters endet der Effekt.</p><div class="picker">'+state.slots.map((id,i)=>id?row(employee(id),'data-boost="'+i+'"','Arbeitsplatz 0'+(i+1)+(boost(i)?' · Trank bereits aktiv':''),!!boost(i)):'').join("")+'</div>'+(!state.slots.some(Boolean)?'<p>Setze zuerst einen Mitarbeiter ein.</p>':''),{kind:"potion",id:p.id});
}
function roll(box){
 const v=new Uint32Array(2);crypto.getRandomValues(v);let n=v[0]/4294967296*100,r=0;
 for(let i=0;i<box.odds.length;i++){n-=box.odds[i];if(n<0){r=i;break;}}
 const pool=employees.filter(e=>e.rarity===r);return pool[Math.floor(v[1]/4294967296*pool.length)];
}
async function openBox(box){
 if(opening)return;if(state.coins<box.price)return notify("Dafür fehlen dir noch Coins.");
 settle();opening=true;const e=roll(box),isNew=!state.owned[e.id];state.coins-=box.price;state.owned[e.id]=(state.owned[e.id]||0)+1;
 // Store the paid-for reward before starting animation, including on reload.
 save();render();dialog("Wer steckt wohl drin?",box.name.toUpperCase(),'<div class="opening"><div class="treasure '+box.tone+'"><span>?</span></div><p>Dein neuer Klick-Kumpel kommt …</p></div>',{kind:"drop"});
 await new Promise(resolve=>setTimeout(resolve,state.motion?1100:50));opening=false;$("#dialog-close").disabled=false;
 $("#dialog-title").textContent=isNew?"Ein neuer Mitarbeiter!":"Verstärkung fürs Team!";
 $("#dialog-body").innerHTML='<div class="drop" style="--rarity:'+e.color+'">'+worker(e)+'<span class="rarity-label">'+rarities[e.rarity]+'</span><h3>'+e.name+'</h3><p>'+e.desc+'</p><p><strong>'+e.clicks+' Klicks / Sekunde</strong></p><p>'+state.owned[e.id]+' Kopie(n) in deiner Sammlung</p><button type="button" class="button primary" data-finish>Zur Sammlung</button></div>';
 $('[data-finish]').focus();
}
document.addEventListener("click",event=>{
 const b=event.target.closest("button");if(!b||b.disabled)return;
 if(b.dataset.tab)showTab(b.dataset.tab);if(b.dataset.go)showTab(b.dataset.go);
 if(b.dataset.slot!==undefined)chooseEmployee(Number(b.dataset.slot));
 if(b.dataset.assign)chooseSlot(employee(b.dataset.assign));
 if(b.dataset.pick&&context?.kind==="slot")assign(context.slot,b.dataset.pick);
 if(b.hasAttribute("data-remove")&&context?.kind==="slot")assign(context.slot,null);
 if(b.dataset.destination!==undefined&&context?.kind==="destination")assign(Number(b.dataset.destination),context.employee);
 if(b.dataset.box)openBox(boxes.find(v=>v.id===b.dataset.box));
 if(b.dataset.potion)choosePotion(potions.find(v=>v.id===b.dataset.potion));
 if(b.dataset.boost!==undefined&&context?.kind==="potion"){
  const i=Number(b.dataset.boost),p=potions.find(v=>v.id===context.id);
  if(!state.slots[i]||boost(i)||!state.potions[p.id])return;
  settle();state.potions[p.id]--;state.boosts[i]={id:p.id,ends:Date.now()+p.seconds*1000};save();render();close();showTab("factory");notify(employee(state.slots[i]).name+" klickt jetzt "+p.mult+"× so schnell!");
 }
 if(b.dataset.buy){const p=potions.find(v=>v.id===b.dataset.buy);if(state.coins<p.price)return notify("Dafür fehlen dir noch Coins.");settle();state.coins-=p.price;state.potions[p.id]++;save();renderPotions();metrics();notify(p.name+" liegt jetzt in deinem Vorrat.");}
 if(b.hasAttribute("data-first-box")){close();showTab("boxes");}
 if(b.hasAttribute("data-finish")){close();showTab("employees");}
});
$("#collect").addEventListener("click",()=>{settle();const amount=collectFactoryCoins(game);if(!amount)return;save();metrics();notify(whole(amount)+" Coins eingesammelt!");});
$("#search").addEventListener("input",renderEmployees);
function motion(){document.body.classList.toggle("no-motion",!state.motion);$("#motion-toggle").setAttribute("aria-pressed",String(state.motion));$("#motion-toggle").textContent=state.motion?"Animationen an":"Animationen aus";}
$("#motion-toggle").addEventListener("click",()=>{state.motion=!state.motion;motion();save();});
renderBoxes();render();motion();save();let ticks=0;
setInterval(()=>{settle();metrics();if(++ticks%10===0)saveGame({cloud:false});if(ticks%120===0)save();},500);
document.addEventListener("visibilitychange",()=>{settle();save();metrics();});

if(absence>15000&&offlineGain>=1)notify("Willkommen zurück! Dein Team hat "+whole(offlineGain)+" Coins verdient.");
else if(!storageOK)notify("Dein Browser erlaubt gerade kein lokales Speichern.");
$("#back-to-game").addEventListener("click",e=>{e.preventDefault();settle();navigateWithSave("../");});
window.addEventListener("cursor-save-error",()=>notify("Speichern fehlgeschlagen. Bitte prüfe, ob dein Browser lokalen Speicher erlaubt."));
$("#factory-loading").remove();
}
