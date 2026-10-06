import assert from "node:assert/strict";
import { createFactoryState, unlockFactory, settleFactory, collectFactoryCoins, normalizeFactory, OFFLINE_CAP_MS } from "../js/core/factoryModel.js";
const mem = new Map();
globalThis.location = { pathname: "/cursor-clicker/", hostname: "ddmeer321.github.io" };
globalThis.localStorage = { getItem: k => mem.get(k) ?? null, setItem: (k,v) => mem.set(k,v), removeItem: k => mem.delete(k) };
globalThis.window = new EventTarget();
Object.defineProperty(globalThis, "navigator", { value: { locks: { request: async (name, opts, run) => run({ name }) } }, configurable:true });
const { state, createDefaultState, replaceState } = await import("../js/core/state.js");
const { loadGame, saveGame, quickSaveGame, syncFromCloud, hardReset } = await import("../js/core/save.js");
const { startGameSession } = await import("../js/core/session.js");
await startGameSession(()=>saveGame({cloud:false}));
let passed=0;
function test(name,fn){fn();passed++;console.log("PASS",name);}
const key = "cursorClicker.save.v1.live";
test("Unlock at exactly 100,000; stays unlocked after spending",()=>{
 const g=createDefaultState();g.coins=99999;assert.equal(unlockFactory(g),false);
 g.coins++;assert.equal(unlockFactory(g,1000),true);g.coins=0;assert.equal(unlockFactory(g),false);assert.equal(g.factory.unlocked,true);
});
test("No earnings for locked or empty factory",()=>{
 const f=createFactoryState();assert.equal(settleFactory(f,1000),0);
 f.unlocked=true;f.lastSeen=0;assert.equal(settleFactory(f,1000),0);
});
test("Offline boost expiry and no duplicate interval",()=>{
 const f=createFactoryState();Object.assign(f,{unlocked:true,slots:["milo",null,null],lastSeen:1000,boosts:[{id:"quick",ends:3000},null,null]});
 assert.equal(settleFactory(f,6000),35);assert.equal(settleFactory(f,6000),0);
});
test("Offline interval capped to 8 hours",()=>{
 const f=createFactoryState();Object.assign(f,{unlocked:true,slots:["milo",null,null],lastSeen:1});
 assert.equal(settleFactory(f,OFFLINE_CAP_MS*2+1),5*8*3600);assert.equal(settleFactory(f,OFFLINE_CAP_MS*2+1),0);
});
test("Collect once, keep fractions, update lifetime earnings, not manual clicks",()=>{
 const g=createDefaultState();g.coins=100;g.factory.unlocked=true;g.factory.lastSeen=1000;g.factory.pending=12.5;
 assert.equal(collectFactoryCoins(g,1000),12);assert.equal(g.coins,112);assert.equal(g.totalCoinsEarned,12);
 assert.equal(g.totalClicks,0);assert.equal(g.factory.pending,.5);assert.equal(collectFactoryCoins(g,1000),0);
});
test("Invalid employee assignments and potion values sanitized",()=>{
 const f=normalizeFactory({unlocked:true,owned:{milo:1},slots:["milo","milo","unknown"],potions:{quick:-3},pending:Infinity});
 assert.deepEqual(f.slots,["milo",null,null]);assert.equal(f.pending,0);assert.equal(f.potions.quick,0);
});
const original={...createDefaultState(),version:3,coins:100000,ownedCursors:{"wooden":{count:3,favorite:true}},cursorLevels:{wooden:5},mutatedCursors:{wooden:[{instanceId:"keep-me"}]},settings:{music:false,sfx:true,animations:false},ownedAuras:{a:{count:2}}};
delete original.factory;
test("Migrate v3 save without changing existing inventory, levels, mutations or auras",()=>{
 mem.set(key,JSON.stringify(original));loadGame();
 assert.equal(state.version,4);assert.equal(state.factory.unlocked,true);assert.deepEqual(state.ownedCursors,original.ownedCursors);
 assert.deepEqual(state.cursorLevels,original.cursorLevels);assert.deepEqual(state.mutatedCursors,original.mutatedCursors);assert.deepEqual(state.ownedAuras,original.ownedAuras);
 assert.equal(state.factory.pending,0);assert.equal(Object.values(state.factory.owned).reduce((a,b)=>a+b,0),0);
});
test("Factory purchases, collection and return use same full save",()=>{
 state.coins-=1500;state.factory.owned.milo=1;state.factory.slots[0]="milo";state.factory.lastSeen=Date.now();
 state.factory.pending=250;collectFactoryCoins(state,state.factory.lastSeen);saveGame({cloud:false});
 const expected=state.coins;replaceState(createDefaultState());loadGame();
 assert.equal(state.coins,expected);assert.equal(state.coins,98750);assert.equal(state.factory.owned.milo,1);assert.equal(state.factory.unlocked,true);
 assert.deepEqual(state.mutatedCursors,original.mutatedCursors);
});
test("Quick-save and full-save cannot roll the wallet backwards",()=>{
 state.coins=110000;quickSaveGame();state.coins=109100;saveGame({cloud:false});loadGame();assert.equal(state.coins,109100);assert.equal(mem.has(key+".quick"),false);
 state.coins=109200;quickSaveGame();loadGame();assert.equal(state.coins,109200);assert.equal(state.factory.owned.milo,1);
});
test("Prototype wallet is never imported",()=>{
 mem.set("cursorClicker.factoryDesign.v2",JSON.stringify({coins:99999999}));loadGame();assert.equal(state.coins,109200);
});
let uploads=[];
window.CloudSave={ready:async()=>"owner-a",load:async()=>({...original,coins:20,lastSavedAt:1}),save:async(id,snapshot)=>{uploads.push(snapshot);return true;}};
state.cloudOwnerId="owner-a";await syncFromCloud();
test("Older cloud snapshot cannot erase newer local factory coins",()=>assert.equal(state.coins,109200));
window.CloudSave.load=async()=>({...original,coins:200000,lastSavedAt:state.lastSavedAt+100});
await syncFromCloud();
test("Newer cloud snapshot loads; factory unlock rechecked",()=>{assert.equal(state.coins,200000);assert.equal(state.factory.unlocked,true);});
let sequence=[];
window.CloudSave.save=async(id,snapshot)=>{await new Promise(r=>setTimeout(r,snapshot.coins===200001?25:0));sequence.push(snapshot.coins);return true;};
await saveGame();sequence=[];
state.coins=200001;const p1=saveGame();state.coins=200002;const p2=saveGame();await Promise.all([p1,p2]);
test("Cloud writes stay ordered",()=>assert.deepEqual(sequence,[200001,200002]));
test("Reset clears factory unlock, wallet and inventory together",()=>{hardReset();assert.equal(state.factory.unlocked,false);assert.equal(state.coins,0);assert.equal(state.cloudOwnerId,"owner-a");});
console.log(passed+" tests passed.");
