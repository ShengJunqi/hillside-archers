import assert from 'node:assert/strict';
import {Game,ground,trace,launch,position,applyUpgrade} from '../dist/core.mjs';
import {ARENAS} from '../dist/encounters.mjs';
import {createSkillState} from '../dist/combat.mjs';
import {syncGroundContact} from '../dist/body.mjs';
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;},eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
const create=(mode='duel',choice=1,hero='qingsong')=>{const g=new Game({save:{unlocked:true},rng:()=>.5});g.start(mode,choice,'split',hero);if(g.arena?.enemy)g.arena.enemy.id='steady';return g;};
const waitForBody=(g,p)=>{let frames=0;while(p.body?.active&&frames++<270)g.update(1/60);ok(!p.body?.active,'living reaction recovers within a bounded real Game.update interval');return frames;};
const waitForTurn=(g)=>{const round=g.round;let frames=0;while(g.round===round&&['flight','settle'].includes(g.phase)&&frames++<1000)g.update(1/60);ok(frames<1000,'real volley and recovery do not soft-lock the turn');return frames;};
const contact=(g,part='body',damage=26)=>{const p=g.players[1-g.active],height=part==='head'?96:part==='legs'?25:60;g.hitTarget({...launch(g.players[g.active],25,g.powers[g.active]),t:0},{part,damage},{x:p.x,y:p.y-height});};
function clearContactTurn(g,side=0){g.active=side;g.phase=side===1?'thinking':'aim';ok(g.shoot(),'contact integration starts a real shot/volley id');g.arrows=[];g.phase='aim';}
function findBodyShot(g,side){
 const powers=[...new Set([g.arena.geometry.recommendedPower,100,90,80,70,60,50,40])];
 for(const power of powers){const hits=[];for(let angle=5;angle<=75;angle++){const h=trace(g.players[side],g.players[1-side],angle,g.obs,g.world,power);if(h.kind==='hit'&&h.part==='body')hits.push(angle);}if(hits.length)return {angle:hits[Math.floor(hits.length/2)],power};}
 return null;
}

// A player's free-map selection must change the real stations, not only a name
// or painting. Check the twelve public choices through Game.start itself.
{
 const distances=new Set(),elevations=new Set();
 eq(ARENAS.length,12,'twelve authored physical arenas are exposed');
 for(let choice=1;choice<=ARENAS.length;choice++){
  const local=create('local',choice),duel=create('duel',choice),a=ARENAS[choice-1];
  eq(local.arena.layoutId,a.id,'local choice '+choice+' selects its authored physical layout');eq(duel.arena.layoutId,a.id,'NPC choice '+choice+' selects the same physical layout');
  eq(local.players.map(p=>p.x),local.arena.xs,'map '+a.id+' uses the actual randomized stations');eq(local.players.map(p=>p.y),local.arena.xs.map(x=>ground(x,local.world)),'map '+a.id+' actually uses its slope heights');
  distances.add(local.players[1].x-local.players[0].x);elevations.add(Math.round(local.players[0].y-local.players[1].y));
  eq(local.orbs.length,0,'local map '+a.id+' starts without supply balls');
 }
 for(let choice=1;choice<=ARENAS.length;choice++)for(const seed of [.03,.97]){const sampled=new Game({save:{unlocked:true},rng:()=>seed});sampled.start('local',choice);distances.add(sampled.arena.geometry.distance);}
 ok(distances.size>=10&&Math.min(...distances)<=560&&Math.max(...distances)>=1300,'selectable arenas span genuinely near and long-distance fights');
 ok(Math.max(...elevations)>=180&&Math.min(...elevations)<=-180,'map selection includes substantial uphill and downhill fire');
}

// With deterministic zero aiming error, the NPC plans angle AND power at the
// actual two stations, then recomputes after its own station is knocked back.
for(let choice=1;choice<=ARENAS.length;choice++){
 const g=create('duel',choice),beforeAngle=g.chooseAI(),beforePower=g.powers[1];
 eq(trace(g.players[1],g.players[0],beforeAngle,g.obs,g.world,beforePower).kind,'hit',g.arena.name+': initial AI plan reaches a real collider');
 ok(Number.isInteger(beforeAngle)&&beforeAngle>=5&&beforeAngle<=75&&Number.isInteger(beforePower)&&beforePower>=20&&beforePower<=100,'AI uses legal integer angle and strength');
 const enemy=g.players[1],origin=enemy.x;clearContactTurn(g);contact(g);g.phase='settle';g.phaseTime=0;waitForBody(g,enemy);
 ok(enemy.x>=origin+25,'real Game.hitTarget/update moves the enemy station on '+g.arena.layoutId);eq(enemy.y,ground(enemy.x,g.world),'enemy stands on its new terrain location');eq(enemy.homeX,enemy.x,'recovered station is persistent, not original spawn');
 eq([g.active,g.phase],[1,'flight'],'NPC automatically shoots only after the struck body has recovered');
 const afterAngle=g.chooseAI(),afterPower=g.powers[1];eq(trace(enemy,g.players[0],afterAngle,g.obs,g.world,afterPower).kind,'hit','AI replans a reachable real shot after displacement on '+g.arena.layoutId);
 const station=enemy.x;waitForTurn(g);eq(g.active,0,'NPC full projectile flight returns control to the human');ok(g.players[0].hp<100&&g.players[0].hp>=100-g.opponent.volleyCap,'replanned NPC shot hits without breaking the damage budget');
 ok(!g.players[0].body?.active,'human control waits for actual articulated recovery');eq(enemy.x,station,'shooting the next turn does not snap displaced enemy back');
}

// Representative real flights in both directions of elevation. The simulation
// must hit, settle at the new height and let the computer counterattack.
for(const id of ['ridge','market','signs','balcony']){
 const choice=ARENAS.findIndex(a=>a.id===id)+1,g=create('duel',choice),target=g.players[1],shot=findBodyShot(g,0);ok(shot,'a real body shot exists on '+id);
 const origin={x:target.x,y:target.y,hp:target.hp};g.skip();g.aim(shot.angle,shot.power);ok(g.shoot(),'human launches a real uphill/downhill projectile on '+id);waitForTurn(g);
 ok(target.hp<origin.hp&&target.x>origin.x,'real arrow damages and displaces opponent on '+id);eq(target.y,ground(target.x,g.world),'real flight recovery follows new footing on '+id);ok(!target.body.active,'opponent is standing before immediate counterattack');
 const station=target.x;eq([g.active,g.phase],[1,'flight'],'counterattack starts after recovered hit on '+id);waitForTurn(g);eq(g.active,0,'high/low fight finishes both turns on '+id);eq(target.x,station,'high/low station remains displaced through next action');
}

// Two actual +1 contacts with an extreme elemental NPC still share one damage
// budget, including the status tick immediately before the human turn.
for(const [mode,choice]of [['duel',8],['campaign',3]]){
 const g=create(mode,choice);g.active=1;g.phase='thinking';g.angles[1]=g.chooseAI();Object.assign(g.players[1].stats,{multi:1,damage:20,fire:3,poison:4,crit:1});
 const planned=launch(g.players[1],g.angles[1],g.powers[1]);g.shoot();g.orbs=[.2,.6].map((t,i)=>({...position(planned,t),id:'budget-'+i,r:25,type:'plus',used:false}));
 waitForTurn(g);eq(g.volleyCount,3,'real NPC volley consumes exactly two +1 balls into three arrows: '+mode);eq(g.active,0,'all bonus arrows finish before human turn: '+mode);
 ok(g.players[0].hp>=100-g.opponent.volleyCap&&g.players[0].hp<100,'critical elemental multishot respects actual total budget: '+mode);ok(!g.players[0].body?.active,'bonus-arrow knockback cannot hand control to a fallen player');
}

// Multiple Game.hitTarget contacts separated by full recovery retain the real
// shoot serial; only a later shoot() gets a fresh displacement envelope.
{
 const g=create('local',1),target=g.players[1];target.hp=target.stats.maxHp=1000;clearContactTurn(g);const origin=target.x,serial=g.shotSerial;
 contact(g,'head',42);waitForBody(g,target);const first=target.x;contact(g,'head',42);waitForBody(g,target);
 eq(g.shotSerial,serial,'late contacts keep the original real volley id');ok(target.x>first&&target.x<=origin+140.001,'late extra arrow cannot reopen one volley displacement budget');
 const second=target.x;clearContactTurn(g);contact(g,'head',42);waitForBody(g,target);ok(target.x>second+30,'a new real shot can push farther from the persistent station');
}

// Character and relic effects have to alter real movement while retaining the
// same Game.damage result. The festival platform has room for this body shove.
{
 const react=({hero='qingsong',impact=0,balance=0,npc=false,npcHero=false}={})=>{
  const g=create(npc?'duel':'local',8,hero),side=npc?1:0,source=g.players[side],target=g.players[1-side];
  g.arena.terrain.profile=g.arena.terrain.profile.map(([x])=>[x,700]);g.obs=[];for(const p of g.players){p.y=700;syncGroundContact(p,x=>ground(x,g.world));}
  for(let i=0;i<impact;i++)applyUpgrade(source.stats,'impact');for(let i=0;i<balance;i++)applyUpgrade(target.stats,'balance');
  if(npcHero){source.characterId='panshi';source.skills=createSkillState('panshi');}
  clearContactTurn(g,side);const origin=target.x;contact(g);const damage=g.lastDamage;waitForBody(g,target);return {distance:Math.abs(target.x-origin),damage,hp:target.hp};
 };
 const base=react(),hero=react({hero:'panshi'}),impact=react({impact:1}),balance=react({balance:1});
 eq([hero.damage,impact.damage,balance.damage],[base.damage,base.damage,base.damage],'heavystring, impact and balance do not pretend to work by changing damage');
 ok(Math.abs(hero.distance/base.distance-1.2)<.002,'panshi heavystring raises true Game.hitTarget displacement by 20%');ok(Math.abs(impact.distance/base.distance-1.15)<.002,'impact relic raises actual displacement by 15%');ok(balance.distance<base.distance*.9,'balance relic genuinely resists displacement');
 const npc=react({npc:true}),disguisedNpc=react({npc:true,npcHero:true});eq(disguisedNpc,npc,'NPC cannot inherit the newly added player heavystring bonus');
}

{
 const events=[],save={version:2,unlocked:false,checkpoint:2,best:13,embers:17,bow:2,life:3,targetBest:340,names:['阿箭','小坡']};
 const g=new Game({save,rng:()=>.5,onEvent:e=>events.push(e)});g.start('campaign',1);eq(g.players[1].hp,50,'new terrain keeps tutorial opponent at half health');
 const before={...g.save};ok(g.skipTutorial(),'tutorial skip remains available');eq(g.phase,'home','skip returns to unlocked camp');ok(g.save.unlocked&&events.some(e=>e.type==='save'),'skip saves mode unlock');
 eq({...g.save,unlocked:before.unlocked},before,'skip preserves names, checkpoint, currency, records and permanent upgrades');ok(g.start('local',12),'skip unlocks all twelve physical local maps');
}
console.log(checks+' real tactical-map, AI-replanning, flight, knockback, budget and save integration checks passed.');
