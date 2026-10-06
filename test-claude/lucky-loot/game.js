(function(root){
'use strict';
const tiers=[{name:'Gewöhnlich',color:'#929ca0',value:10},{name:'Ungewöhnlich',color:'#4a9870',value:35},{name:'Selten',color:'#508bc0',value:120},{name:'Episch',color:'#9562b9',value:450},{name:'Legendär',color:'#d69b35',value:1800},{name:'Mythisch',color:'#dd6f81',value:7500},{name:'Ultraselten',color:'#b99542',value:1000000}];
const counts=[80,60,45,32,20,10,3],catalog=[];let n=0;
const names=['Scout','Vector','Ranger','Falcon','Pioneer','Echo','Nomad','Atlas','Comet','Pulse'];
counts.forEach((count,tier)=>{for(let j=0;j<count;j++){let kind=n%10<2?'Handschuhe':n%10<4?'Messer':'Waffe';catalog.push({id:n,name:tier===6?['Singularity','Solar Crown','Abyssal Relic'][j]:`${names[j%10]} ${String(n+1).padStart(3,'0')}`,kind,tier,value:Math.round(tiers[tier].value*(1+(j%10)*.13))});n++}});
const crateNames=['Starter','Street','Industrial','Forest','Neon','Arctic','Inferno','Royal','Ocean','Relic','Void','Ascendant'];
const prices=[0,35,90,180,350,650,1100,1800,3000,5000,8500,14000];
const crates=crateNames.map((name,i)=>({id:i,name,price:prices[i],color:['#f4bca0','#c7c0e9','#b8d3c0','#bad19d','#e2b7d6','#abd4e2'][i%6]}));
function probabilities(i){const q=i/11;return [.76-.38*q,.19+.16*q,.043+.14*q,.006+.059*q,.0008+.016*q,.00019+.005*q,.00001]}
function initial(){return {version:1,coins:0,inventory:[],bank:[],slots:2,found:[],opened:0,lastFree:0,lastTick:Date.now()}}
function valid(s){return s&&s.version===1&&Number.isFinite(s.coins)&&s.coins>=0&&Array.isArray(s.inventory)&&Array.isArray(s.bank)&&Array.isArray(s.found)&&Number.isInteger(s.slots)&&s.slots>=2&&s.bank.length<=s.slots&&Number.isFinite(s.lastTick)&&Number.isFinite(s.lastFree)&&Number.isFinite(s.opened)&&[...s.inventory,...s.bank].every(x=>x&&catalog[x.id]&&typeof x.uid==='string')}
function rate(s){return s.bank.reduce((v,x)=>v+catalog[x.id].value*.001,0)}
function accrue(s,now=Date.now()){const earned=rate(s)*Math.min(14400,Math.max(0,(now-s.lastTick)/1000));s.bankPending=(s.bankPending||0)+earned;s.lastTick=now;return earned}
function collect(s){const amount=s.bankPending||0;s.coins+=amount;s.bankPending=0;return amount}
const multipliers=[1.1,1.5,2,3,5,10];
function upgradeOptions(id,multiplier){if(!multipliers.includes(multiplier)||!catalog[id])return [];const desired=catalog[id].value*multiplier;const eligible=catalog.filter(x=>x.value>=desired);if(!eligible.length)return [];const nearest=Math.min(...eligible.map(x=>x.value));return eligible.filter(x=>x.value===nearest)}
function upgradeByFactor(s,uid,multiplier,random=Math.random){const entry=s.inventory.find(x=>x.uid===uid);if(!entry)throw Error('Wähle zuerst einen Gegenstand.');const choices=upgradeOptions(entry.id,multiplier);if(!choices.length)throw Error('Für diesen Faktor gibt es noch keinen passenden Gegenstand.');const dest=choices[Math.min(choices.length-1,Math.floor(random()*choices.length))];const p=chance(catalog[entry.id],dest),roll=random();const index=s.inventory.findIndex(x=>x.uid===uid);s.inventory.splice(index,1);return {dest,p,roll,result:roll<p?record(s,dest.id):null}}
function slotCost(s){return Math.round(150*2.3**(s.slots-2))}
function record(s,id){if(!s.found.includes(id))s.found.push(id);const x={id,uid:root.crypto.randomUUID()};s.inventory.push(x);return x}
function open(s,index,random=Math.random,now=Date.now()){const c=crates[index];if(!c)throw Error('Kiste nicht gefunden.');if(index===0&&now-s.lastFree<8000)throw Error('Deine Gratis-Kiste lädt noch auf.');if(s.coins<c.price)throw Error('Dafür fehlen dir noch Münzen.');s.coins-=c.price;if(index===0)s.lastFree=now;const p=probabilities(index);let r=random(),tier=6;for(let i=0;i<p.length;i++){r-=p[i];if(r<0){tier=i;break}}const pool=catalog.filter(x=>x.tier===tier),item=pool[Math.min(pool.length-1,Math.floor(random()*pool.length))];s.opened++;return record(s,item.id)}
function sell(s,uid){const i=s.inventory.findIndex(x=>x.uid===uid);if(i<0)throw Error('Gegenstand nicht gefunden.');const [x]=s.inventory.splice(i,1);s.coins+=catalog[x.id].value}
function deposit(s,uid){if(s.bank.length>=s.slots)throw Error('Alle Bankplätze sind belegt.');const i=s.inventory.findIndex(x=>x.uid===uid);if(i<0)throw Error('Gegenstand nicht gefunden.');s.bank.push(s.inventory.splice(i,1)[0])}
function withdraw(s,uid){const i=s.bank.findIndex(x=>x.uid===uid);if(i<0)throw Error('Gegenstand nicht gefunden.');s.inventory.push(s.bank.splice(i,1)[0])}
function buySlot(s){const cost=slotCost(s);if(s.coins<cost)throw Error('Dafür fehlen dir noch Münzen.');s.coins-=cost;s.slots++}
function targets(id){return catalog.filter(x=>x.value>=catalog[id].value*.94/.64).sort((a,b)=>a.value-b.value)}
function chance(source,target){return Math.min(.64,.94*source.value/target.value)}
function upgrade(s,uid,targetId,random=Math.random){const i=s.inventory.findIndex(x=>x.uid===uid);if(i<0)throw Error('Wähle zuerst einen Gegenstand.');const source=catalog[s.inventory[i].id],target=catalog[targetId];if(!target||!targets(source.id).some(x=>x.id===targetId))throw Error('Kein gültiges Aufwertungsziel.');const p=chance(source,target);s.inventory.splice(i,1);return random()<p?record(s,target.id):null}
const api={tiers,catalog,crates,probabilities,initial,valid,rate,accrue,collect,multipliers,upgradeOptions,upgradeByFactor,slotCost,open,sell,deposit,withdraw,buySlot,targets,chance,upgrade};root.Game=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
