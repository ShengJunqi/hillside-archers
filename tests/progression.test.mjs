import assert from 'node:assert/strict';
import {Game, baseStats, applyUpgrade, launch, position, trace, MAX_ELEMENT_LEVEL, MAX_STATUS_STACKS, upgradePreview, statusSummary, enemySummary} from '../dist/core.mjs';
import {opponentProfile} from '../dist/combat.mjs';
let checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);checks++;};
const game=(mode='rogue',stage=1)=>{const g=new Game({rng:()=>.5,save:{unlocked:true}});g.start(mode,stage);return g;};
const hit=g=>{const p=g.players[1-g.active];g.hitTarget({...launch(g.players[g.active],25),t:0,scale:.001},{part:'body',damage:26},{x:p.x,y:p.y-60});};
const makeDurable=g=>{g.players[1].hp=g.players[1].stats.maxHp=100000;};

// Duplicate relics change the real state applied by arrows, not just badge count.
for(const id of ['fire','poison']){
 const g=game();makeDurable(g);for(let rank=1;rank<=8;rank++){
  applyUpgrade(g.stats,id);const before=g.players[1].status[id==='fire'?'burn':'poison'];hit(g);
  eq(g.players[1].status[id==='fire'?'burn':'poison']-before,rank,id+' rank '+rank+' adds its full rank on each hit');
 }
 ok(g.players[1].status[id==='fire'?'burn':'poison']>5,id+' is no longer capped at old four/five stacks');
}
{
 const g=game();makeDurable(g);Object.assign(g.stats,{fire:3,poison:4});hit(g);hit(g);hit(g);
 eq(g.players[1].status.burn,9,'three arrows accumulate nine fire layers');
 eq(g.players[1].status.poison,12,'three arrows accumulate twelve poison layers');
 const hp=g.players[1].hp;g.nextTurn();eq(hp-g.players[1].hp,9*5+12*5,'all layers cause real poison-flame tick damage');
 eq(g.players[1].status.poison,12,'poison layers persist after a tick');
 eq(g.players[1].status.poisonTurns,2,'poison duration advances on affected turn');
 g.nextTurn();hit(g);eq(g.players[1].status.poison,16,'another volley adds to remaining poison');
 eq(g.players[1].status.poisonTurns,3,'new poison refreshes duration');
 ok(statusSummary(g.players[1].status).includes('16层')&&statusSummary(g.players[1].status).includes('80/轮'),'HUD summary exposes actual stack total and synergy rate');
}
{
 const g=game();makeDurable(g);g.stats.poison=2;hit(g);const p=g.players[1],before=p.hp;
 for(let turn=0;turn<3;turn++){g.active=0;g.nextTurn();}
 eq(before-p.hp,18,'plain poison ticks three times at three damage per layer');
 eq(p.status.poison,0,'poison expires after its third affected turn');
 eq(p.status.poisonTurns,0,'poison duration clears');
 eq(statusSummary(p.status),'','expired status is not shown');
}
{
 const g=game();makeDurable(g);g.stats.fire=g.stats.poison=MAX_ELEMENT_LEVEL;
 for(let i=0;i<24;i++)hit(g);
 eq(g.players[1].status.burn,MAX_STATUS_STACKS,'extreme fire is bounded at a high safe ceiling');
 eq(g.players[1].status.poison,MAX_STATUS_STACKS,'extreme poison is bounded without arrays of layer objects');
 const st=baseStats();st.fire=MAX_ELEMENT_LEVEL;st.poison=MAX_ELEMENT_LEVEL;st.ice=3;
 applyUpgrade(st,'fire');applyUpgrade(st,'poison');applyUpgrade(st,'ice');
 eq([st.fire,st.poison,st.ice],[MAX_ELEMENT_LEVEL,MAX_ELEMENT_LEVEL,3],'fully upgraded relics do not falsely increment');
 g.stats=st;for(let i=0;i<12;i++)ok(g.rollUpgrades().every(u=>!['fire','poison','ice'].includes(u.id)),'maxed elemental relics are excluded from choices');
 ok(upgradePreview(st,'fire').includes('上限')&&upgradePreview(st,'ice').includes('上限'),'maxed preview explicitly states cap');
 const legacy={...st,ice:7};applyUpgrade(legacy,'ice');eq(legacy.ice,7,'existing higher frost ranks are not silently reduced');
 const preview=upgradePreview({...baseStats(),poison:5},'poison');
 ok(preview.includes('5 → 6')&&preview.includes('15 → 18'),'duplicate preview states the actual new poison benefit');
}

// Main story and the first six expedition floors keep their easier behavior.
{
 const g=game('campaign',1);eq(g.players[1].hp,50,'tutorial starts enemy at half health');eq(g.players[1].stats.maxHp,100,'HUD can show 50 / 100 explicitly');
 eq(g.players[0].hp,100,'tutorial does not reduce player health');
 eq(g.storyBeatDuration,2.5,'first chapter story beats are shorter');eq(g.scoutDuration,1.5,'first chapter scouting is shorter');
 g.introNext();g.introNext();g.introNext();eq(g.phase,'scout','three short beats still reach scouting');
 g.skip();eq(g.phase,'aim','short tutorial still waits until own aiming phase');
 for(const mode of ['duel','local','rogue'])eq(game(mode).players[1].hp,100,'half-health rule does not affect '+mode);
 const second=game('campaign',2);eq(second.players[1].hp,100,'later chapter enemy remains full health');eq(second.storyBeatDuration,4.5,'later story timing preserved');
 for(const floor of [1,2,3,4,5,6]){
  const r=game();r.floor=floor;r.setup();eq(r.players[1].stats.maxHp,100+(floor-1)*16+(floor%3===0?30:0),'early floor '+floor+' health preserved');
 }
}
for(const floor of [7,8,9,12,18,24]){
 const g=game();g.floor=floor;g.setup();const p=g.players[1],s=p.stats;
 const abilityCount=['fire','poison','ice','armor','regen','leech','pierce','cleanse'].filter(k=>s[k]>0).length;
 ok(abilityCount>=3,'deep opponent '+floor+' has multiple working attributes');
 ok(enemySummary(p)!=='基础弓术','deep opponent summary describes its real loadout');
 ok(g.opponent.volleyCap<=42,'100 HP player retains burst protection on floor '+floor);
}
{
 const g=game();g.floor=12;g.setup();const p=g.players[1];p.hp=p.stats.maxHp=1000;p.stats.armor=p.stats.regen=0;
 p.status={burn:20,burnTurns:2,poison:20,poisonTurns:3,ice:0};g.nextTurn();
 eq(p.hp,800,'guardian takes full current poison-flame tick before cleansing');
 eq([p.status.burn,p.status.poison],[15,15],'guardian removes only one quarter of remaining layers');
 ok(enemySummary(p).includes('25%')&&enemySummary(p).includes('伤害结算后'),'cleansing counterplay is explained');
 g.nextTurn();g.stats.poison=4;hit(g);eq(p.status.poison,19,'player can build poison again after partial cleanse');
}
{
 const g=game();g.floor=24;g.stats.maxHp=300;g.setup();g.active=1;g.phase='thinking';g.shoot();
 Object.assign(g.players[1].stats,{damage:100,crit:1,fire:100,poison:100});
 for(let i=0;i<24;i++){const p=g.players[0];g.hitTarget({...launch(g.players[1],25),t:0},{part:'head',damage:42},{x:p.x,y:p.y-96});}
 g.nextTurn();ok(g.players[0].hp>=300-g.opponent.volleyCap,'deep buffs and huge status stacks still share NPC volley budget');
 ok(g.opponent.volleyCap>42&&g.opponent.volleyCap<=300*.42,'deep budget scales moderately with upgraded player health');
 eq(opponentProfile('campaign',3,99,300).volleyCap,30,'deep health scaling never leaks into campaign');
}

// Real flights from representative legal builds. Close, perfectly aimed split
// shots may still win early; deeper guardians usually get to counterattack.
const builds={12:{multi:3,damage:2,fire:2,poison:2,ice:1,armor:1},18:{multi:5,damage:3,fire:3,poison:3,ice:1,armor:1,vital:1},24:{multi:7,damage:5,fire:4,poison:4,ice:1,armor:1,vital:1}};
for(const floor of [12,18,24]){
 let survivors=0;
 for(const splitDistance of [70,150,300]){
  const g=game();for(const [id,n]of Object.entries(builds[floor]))for(let i=0;i<n;i++)applyUpgrade(g.stats,id);
  eq(Object.values(builds[floor]).reduce((sum,n)=>sum+n,0),floor-1,'benchmark build uses exactly earned relics');
  g.floor=floor;g.setup();g.obs=[];g.skip();
  const hits=[];for(let angle=5;angle<=75;angle++){const hit=trace(g.players[0],g.players[1],angle,[],g.world);if(hit.kind==='hit')hits.push({angle,part:hit.part});}
  const angle=hits.find(hit=>hit.part==='head')?.angle||hits[0].angle;g.aim(angle,100);const startHp=g.players[1].hp;g.shoot();
  for(let i=0;i<1500&&['flight','settle'].includes(g.phase);i++){
   if(g.arrows.length&&!g.skillUsed&&g.players[1].x-position(g.arrows[0],g.arrows[0].t).x<splitDistance)g.activateSkill();
   g.update(1/60);
  }
  ok(!['flight','settle'].includes(g.phase),'deep split volley completes without a stalled turn');
  ok(g.players[1].hp<startHp,'stacking build still deals substantial real damage');
  if(g.players[1].hp>0)survivors++;
 }
 ok(survivors>=(floor===12?1:2),'floor '+floor+' guardian usually survives representative first volleys');
}
console.log(checks+' elemental-stack, deep-encounter and tutorial checks passed.');
