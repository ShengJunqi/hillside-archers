import assert from 'node:assert/strict';
import {Game,trace,ground,launch,position,collision,validSave} from '../dist/core.mjs';
import {ARENAS,encounterFor,encounterRoutes} from '../dist/encounters.mjs';
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;},eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
const make=()=>{const g=new Game({save:{unlocked:true},rng:()=>.5});g.start('rogue');return g;};
// Enumerate actual full-power integer shots, including cover and terrain.
// Every authored venue must offer a non-head route in both directions.
for(const seed of [0,42,9173]){
 const seen=new Set(),bossBiomes=new Set();let previous='';
 for(let floor=1;floor<=24;floor++){
  const routes=encounterRoutes(seed,floor,previous);
  ok(routes[0].layoutId!==routes[1].layoutId,'two tickets describe different physical layouts');
  ok(routes.every(r=>r.layoutId!==previous),'neither ticket immediately repeats the previous arena');
  eq(routes,encounterRoutes(seed,floor,previous),'route preview is deterministic');
  for(const encounter of routes){
   const g=make();g.floor=floor;g.encounterFloor=0;g.pendingEncounter=encounter;g.setup();
   eq(g.encounter,encounter,'setup uses exactly the previewed descriptor');
   eq(g.orbs.length,0,'every new venue starts without balls');
   for(let side=0;side<2;side++){
    const p=g.players[side];ok(p.x>=100&&p.x<=1500,'station has knockback margin at world edges');eq(p.y,ground(p.x,g.world),'physics station sits on generated terrain');
    const bodyAngles=[];for(let a=5;a<=75;a++){const r=trace(p,g.players[1-side],a,g.obs,g.world);if(r.kind==='hit'&&r.part!=='head')bodyAngles.push(a);}
    ok(bodyAngles.length>0,`floor ${floor} ${encounter.layoutId} side ${side}: body or limb shot clears real cover`);
    for(const o of g.obs)ok(Math.abs(o.x-p.x)>80+o.w/2,'cover does not trap a player or overlap recovery space');
   }
   for(let x=0;x<=1600;x+=20)ok(Number.isFinite(ground(x,g.world))&&ground(x,g.world)>600&&ground(x,g.world)<740,'terrain stays inside visible playable bounds');
  }
  seen.add(routes[0].layoutId);if(floor%3===0)bossBiomes.add(routes[0].map);previous=routes[0].layoutId;
 }
 eq(seen.size,ARENAS.length,'24 floors visit all eight authored venues');eq(bossBiomes.size,3,'boss rounds rotate across all three biomes');
}
{
 const g=make();g.players[0].hp=51;const save=JSON.stringify(validSave(g.save));g.complete(true);g.resultNext();
 eq(g.nextRoutes.length,2,'victory prepares two tickets inside existing upgrade screen');const alternative=g.nextRoutes[1];
 const before=g.selectedRoute;ok(!g.chooseRoute('made-up'),'unknown route id rejected');eq(g.selectedRoute,before,'invalid selection leaves default intact');
 ok(g.chooseRoute(alternative.id),'offered alternate route accepted');const relic=g.choices[0].id;ok(g.chooseUpgrade(relic),'choosing relic continues immediately');
 eq(g.encounter.id,alternative.id,'selected route determines next physical encounter');ok(g.players[0].hp>=51,'health carried into route');eq(g.orbs.length,0,'chosen route still starts empty');
 ok(!g.chooseRoute(alternative.id),'route cannot change during a match');
 const keys=Object.keys(validSave(g.save));ok(!keys.includes('encounter')&&!keys.includes('runSeed'),'route state never changes v2 save schema');
 g.start('campaign');eq(g.encounter,null,'campaign clears temporary expedition terrain');eq(g.world,g.map,'campaign uses original terrain');
}
{
 const g=make();g.complete(true);g.resultNext();const defaultId=g.nextRoutes[0].id;g.chooseUpgrade(g.choices[0].id);eq(g.encounter.id,defaultId,'existing one-click relic flow uses sensible default route');
}
{
 const g=make();g.encounter.rule='collapse';g.obs=[{id:0,type:'post',x:800,y:ground(800,g.world),w:30,h:100,hp:1,maxHp:1,state:'standing',rot:0,dir:1}];
 const hp=g.players.map(p=>p.hp);g.round=4;g.applyArenaRule();eq(g.obs[0].state,'standing','telegraphed barrier lasts until round five');g.round=5;g.applyArenaRule();eq(g.obs[0].state,'falling','round-five rule really removes cover');eq(g.players.map(p=>p.hp),hp,'arena rule never bypasses NPC damage budget');g.applyArenaRule();eq(g.vfx.length,1,'rule triggers only once');
}
{
 const g=make();g.encounter.enemy.id='breaker';g.obs=[{id:0,type:'post',x:800,y:ground(800,g.world),w:40,h:200,hp:1,maxHp:1,state:'standing'}];
 const angle=g.chooseAI();eq(trace(g.players[1],g.players[0],angle,g.obs,g.world).kind,'obstacle','breaker intentionally targets real blocking cover');
}
{
 const g=make();g.obs=[];g.encounter.enemy.id='loft';const angle=g.chooseAI(),r=trace(g.players[1],g.players[0],angle,g.obs,g.world);ok(angle>=45&&r.kind==='hit'&&r.part!=='head','high-arc archetype uses a real non-head window');
 g.encounter.enemy.id='forager';g.players[1].hp=20;const b=launch(g.players[1],40),orb={...position(b,.6),type:'heart',r:25,used:false};g.orbs=[orb];
 const heartAngle=g.chooseAI(),hb=launch(g.players[1],heartAngle);let collected=false;
 for(let t=1/300;t<12;t+=1/300){const p=position(hb,t);if(collision(p,g.players[0],[],g.world))break;if(Math.hypot(p.x-orb.x,p.y-orb.y)<orb.r){collected=true;break;}}
 ok(collected,'injured heart-seeker takes a reachable heart instead of guaranteed player damage');
}
{
 const g=make();g.encounter.supply='hearts';g.round=2;g.spawnOrbs();ok(g.orbs.every(o=>o.type==='heart'),'heart venue actually changes supply distribution');
}
console.log(checks+' procedural-encounter, trajectory-fairness, route and AI checks passed.');
