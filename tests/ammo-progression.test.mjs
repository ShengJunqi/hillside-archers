import assert from 'node:assert/strict';
import {Game,MAX_ARROWS,position,validSave} from '../dist/core.mjs';

let checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);checks++;};
const snapshot=value=>JSON.stringify(value,(_key,item)=>item instanceof Set?[...item]:typeof item==='function'?undefined:item);
function make(skill='split'){
 const events=[],g=new Game({save:{unlocked:true,embers:13,bow:2,life:1},rng:()=>.5,onEvent:e=>events.push(e)});
 ok(g.start('rogue',1,skill),'new '+skill+' expedition starts');return {g,events};
}
function flight(g,multi=1){
 g.active=0;g.setPhase('aim');g.stats.multi=multi;ok(g.shoot(),'ordinary launch remains available');
 for(const [i,b]of g.arrows.entries())Object.assign(b,{x:350+i*3,y:100,vx:180,vy:-30,t:.25});
 return g.arrows[0];
}
function win(g){g.complete(true);g.resultNext();eq(g.phase,'upgrade','victory opens the route/supply screen');}
function continueOdd(g){ok(!g.hasRelicReward,'odd completed floor has no relic');ok(g.continueRun(),'route-only stop advances');}
function take(g,id){g.choices=[{id}];ok(g.chooseUpgrade(id),'offered '+id+' reward advances');}

// The scarce item is one whole-volley activation, not one of its children.
for(const skill of ['split','dive','burst']){
 const {g,events}=make(skill),save=snapshot(g.save);
 eq(g.specialAmmo,2,'each new bow starts with two special charges');eq(g.specialAmmoMax,5,'unmodified magazine is bounded at five');
 ok(!g.activateSkill(),'cannot spend ammo before a real shot');eq(g.specialAmmo,2,'rejected action spends nothing');
 flight(g,8);const oldId=g.arrows[0].id;
 if(skill==='dive'){
  ok(g.beginSkillAim(),'held dive can reserve a preview');g.aimSkill(21);
  const before=g.specialAmmo;ok(g.cancelSkillAim(),'preview can be cancelled');eq(g.specialAmmo,before,'cancelled preview does not consume ammo');
  ok(!g.skillUsed&&g.timeScale===1,'cancel restores time and preserves volley skill');
  ok(g.beginSkillAim()&&g.releaseSkillAim(),'held release commits the real special volley');
 }else ok(g.activateSkill(),'instant bow commits its special volley');
 eq(g.specialAmmo,1,'eight original arrows cost exactly one special charge');
 eq(g.arrows[0].id,oldId,'activation retains the original projectile identity');
 ok(g.arrows.every(b=>b.special),'all transformed projectiles are marked special');
 eq(g.volleyCount,skill==='split'?24:8,'special transformation keeps the global arrow count rule');
 ok(!g.activateSkill(),'repeated activation in the same volley is rejected');eq(g.specialAmmo,1,'duplicate activation cannot double-charge');
 eq(events.filter(e=>e.type==='skill').length,1,'one physical activation emits one skill event');
 // A later +1 child keeps the transformation but is not a second purchase.
 if(g.volleyCount<MAX_ARROWS){
  const b=g.arrows[0],p=position(b,b.t),orb={...p,id:'after-special',type:'plus',r:25,used:false};
  g.pickup(orb,b,p);eq(g.specialAmmo,1,'a transformed pickup child is free');ok(g.arrows.at(-1).special,'pickup inherits special identity');
  const count=g.volleyCount;g.pickup(orb,b,p);eq(g.volleyCount,count,'same pickup still cannot create duplicate children');
 }
 flight(g);ok(g.activateSkill(),'a later volley may use the second charge');eq(g.specialAmmo,0,'second activation exhausts the reserve');
 for(let shot=0;shot<3;shot++){
  flight(g);ok(!g.canSkill&&!g.activateSkill(),'empty magazine disables only the special action');
  eq(g.specialAmmo,0,'ordinary arrows never spend nonexistent charges');
  if(skill==='burst')ok(g.arrows.every(b=>!b.bomb),'empty magazine does not show usable bombs on ordinary arrows');
 }
 if(skill==='dive')ok(!g.beginSkillAim(),'an empty magazine cannot freeze flight in an unusable preview');
 eq(snapshot(g.save),save,'shooting and spending special charges never changes permanent progress');
 g.setup(false);eq(g.specialAmmo,0,'generic encounter setup does not refill exhausted ammo');
 g.start('rogue',1,skill);eq(g.specialAmmo,2,'starting a new expedition resets temporary ammo');
}

// Every floor still gives route choice and supplies. Relics are earned only
// after completed even floors, and a reroll cannot bypass that cadence.
{
 const {g}=make('burst');g.specialAmmo=0;g.phase='aim';g.aim(75,20);ok(g.shoot(),'empty magazine still launches a real ordinary projectile');
 const round=g.round;let frames=0;while(g.round===round&&frames++<1200)g.update(1/60);
 ok(frames<1200&&g.round===round+1,'an ordinary empty-magazine flight settles and hands over the actual turn');
 eq(g.specialAmmo,0,'turn handoff does not magically refill special ammo');
 eq(g.active,1,'the computer still takes its immediate next action after an ordinary shot');
}
{
 const {g}=make('dive');g.specialAmmo=1;g.rerolls=2;g.players[0].hp=40;
 win(g);eq(g.floor,1,'opening a reward screen does not advance the floor');
 eq(g.choices,[],'first completed floor has no relic cards');eq(g.nextRoutes.length,2,'first supply stop still offers two real terrains');
 const route=g.nextRoutes[1];ok(g.chooseRoute(route.id),'odd-floor route choice is accepted');
 const before=snapshot([g.stats,g.save,g.rerolls,g.specialAmmo,g.choices]);
 ok(!g.rerollUpgrades(),'saved reroll cannot manufacture an odd-floor reward');
 ok(!g.chooseUpgrade('fire'),'an unearned relic cannot be selected at the supply stop');
 eq(snapshot([g.stats,g.save,g.rerolls,g.specialAmmo,g.choices]),before,'rejected reward actions are side-effect free');
 continueOdd(g);eq(g.floor,2,'supply action enters exactly one new floor');eq(g.encounter.id,route.id,'supply action uses the selected physical route');
 eq(g.specialAmmo,2,'new floor adds exactly one charge');eq(g.players[0].hp,52,'nonboss route stop keeps its twelve-point rest');
 eq(g.upgrades,[],'supply-only transition does not silently add a relic');eq(g.rerolls,2,'odd supply stop retains saved rerolls');
 eq(g.orbs.length,0,'new floor still starts with no pickup balls');
 const floor=g.floor,ammo=g.specialAmmo;ok(!g.continueRun(),'duplicate continue cannot skip combat');eq([g.floor,g.specialAmmo],[floor,ammo],'duplicate continue neither advances nor refills');
 g.setup(false);eq(g.specialAmmo,ammo,'repeated setup is not an ammo exploit');
 g.specialAmmo=0;win(g);ok(g.hasRelicReward,'second completed floor earns its special reward');eq(g.choices.length,3,'even reward has three real choices');
 const offers=g.choices.map(u=>u.id);ok(!g.continueRun(),'even reward cannot be bypassed through the supply-only API');
 ok(g.rerollUpgrades(),'stored reroll becomes available at the real reward');eq(g.rerolls,1,'one real reroll consumes one credit');
 ok(g.choices.every(u=>!offers.includes(u.id)),'reroll replaces the old offers');
 g.players[0].hp=20;take(g,'vital');eq(g.floor,3,'relic choice advances once');eq(g.specialAmmo,1,'even reward also supplies exactly one special charge');
 eq(g.stats.maxHp,145,'new vital reward adds forty maximum HP on top of the saved life bonus');
 eq(g.players[0].hp,72,'vital reward heals its forty points plus the common twelve-point rest');
 eq(g.upgrades,['vital'],'one earned choice records one relic');
}

for(const floor of [3,6]){
 const {g}=make();g.floor=floor;g.setup(false);g.players[0].hp=10;g.specialAmmo=0;
 win(g);
 if(floor%2)continueOdd(g);else take(g,'fire');
 eq(g.players[0].hp,47,'boss rest retains its extra twenty-five HP at completed floor '+floor);
 eq(g.specialAmmo,1,'boss transition still adds only the normal one charge at floor '+floor);
 eq(g.floor,floor+1,'boss supplies advance exactly once');
}

// A second result-button click must not exit a newly opened route/reward stop.
for(const floor of [1,2]){
 const {g}=make();g.floor=floor;g.setup(false);g.specialAmmo=1;g.complete(true);g.resultNext();
 const before=snapshot({phase:g.phase,choices:g.choices,routes:g.nextRoutes,selectedRoute:g.selectedRoute,ammo:g.specialAmmo,floor:g.floor,stats:g.stats,save:g.save});
 eq(g.resultNext(),false,'late duplicate result click is rejected at completed floor '+floor);
 eq(snapshot({phase:g.phase,choices:g.choices,routes:g.nextRoutes,selectedRoute:g.selectedRoute,ammo:g.specialAmmo,floor:g.floor,stats:g.stats,save:g.save}),before,'duplicate result click preserves the entire odd/even preparation stop');
}

{
 const {g}=make();g.specialAmmo=g.specialAmmoMax;win(g);continueOdd(g);eq(g.specialAmmo,5,'unused reserve carries but never exceeds magazine capacity');
 // A short series verifies the cadence through real result APIs, rather than
 // accepting three choices merely because the phase happened to be upgrade.
 let rewards=0;
 for(let completed=2;completed<=8;completed++){
  eq(g.floor,completed,'run reaches the intended next floor');win(g);
  if(completed%2===0){eq(g.choices.length,3,'even floor '+completed+' offers three buffs');rewards++;take(g,'fire');}
  else {eq(g.choices.length,0,'odd floor '+completed+' has supplies only');continueOdd(g);}
 }
 eq(rewards,4,'eight completed floors earn exactly four relic selections');eq(g.upgrades.length,4,'buff cadence is not bypassed by floor transitions');
 eq(g.stats.fire,8,'each selected fire reward grants two meaningful ranks');
}

// Ordinary modes remain unrestricted by the new resource, and NPC damage
// protection is unchanged while the player's special magazine is empty.
for(const mode of ['campaign','local','duel','target']){
 const g=new Game({save:{unlocked:true},rng:()=>.5});g.start(mode,mode==='campaign'?3:1,'burst');g.specialAmmo=0;g.active=0;g.phase='aim';
 ok(g.shoot(),'normal '+mode+' arrows do not require rogue ammunition');
 g.arrows[0].t=.3;ok(!g.canSkill&&!g.activateSkill(),mode+' does not acquire rogue special skills');
 ok(g.arrows.every(b=>!b.bomb),'ordinary '+mode+' arrows do not gain player rogue bombs');
}
{
 const {g}=make('burst');g.specialAmmo=0;g.active=1;g.phase='thinking';
 Object.assign(g.players[1].stats,{damage:20,crit:1,fire:4,poison:5,multi:8});ok(g.shoot(),'NPC can still shoot immediately');
 for(const b of g.arrows)b.t=.3;ok(!g.canSkill&&!g.activateSkill(),'NPC cannot access the player special magazine');
 const arrow=g.arrows[0],p=g.players[0],before=p.hp;
 for(let n=0;n<24;n++)g.hitTarget(arrow,{part:'head',damage:42},{x:p.x,y:p.y-96});
 g.arrows=[];g.nextTurn();ok(p.hp>=before-g.opponent.volleyCap&&p.hp>0,'multishot plus following status damage stays within the NPC budget');
 const save=validSave(g.save);ok(!Object.keys(save).some(k=>/ammo|relic|echo|fuse/i.test(k)),'temporary magazine and relic triggers do not enter v2 save');
}

console.log(checks+' special-ammo cost, refill, every-two-floor reward, route, rest and isolation checks passed.');
