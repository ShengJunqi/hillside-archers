import assert from 'node:assert/strict';
import {Game,ground,launch,position,MAX_ARROWS} from '../dist/core.mjs';
import {syncGroundContact} from '../dist/body.mjs';

let checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);checks++;};
const snapshot=value=>JSON.stringify(value,(_key,item)=>item instanceof Set?[...item]:typeof item==='function'?undefined:item);
function make(mode='rogue',rng=()=>.5,choice=1,skill='split'){
 const g=new Game({save:{unlocked:true},rng});g.start(mode,choice,skill);return g;
}
function tick(g,seconds){for(let i=0;i<Math.ceil(seconds*100);i++)g.update(.01);}

// Repeated turns with no collection must stay sparse, fresh, and finite. A
// second caller in the same turn must not produce extra balls or consume RNG.
{
 let draws=0;const g=make('rogue',()=>{draws++;return 0;}),created=new Set();
 eq(g.orbs.length,0,'a new endless arena still opens without pickups');
 for(let round=2;round<=30;round++){
  g.round=round;g.active=(round-1)%2;const previous=g.orbs.map(o=>({...o}));g.spawnOrbs();
  const fresh=g.orbs.filter(o=>o.bornRound===round);
  eq(fresh.length,1,'each new endless action creates one pickup: '+round);
  ok(!created.has(fresh[0].id),'turn '+round+' creates a unique actual orb identity');created.add(fresh[0].id);
  ok(g.orbs.length<=4,'turn '+round+' cannot accumulate more than four balls');
  for(const kind of ['plus','heart'])ok(g.orbs.filter(o=>o.type===kind).length<=2,'turn '+round+' caps '+kind+' at two');
  ok(g.orbs.every(o=>o.expiresRound===o.bornRound+4&&o.bornRound<=round&&o.expiresRound>round),'every live ball has the exact four-action lifetime');
  ok(previous.filter(o=>o.expiresRound<=round).every(old=>!g.orbs.some(o=>o.id===old.id)),'expired balls are actually removed before the next spawn');
  const before=snapshot(g.orbs),beforeDraws=draws;g.spawnOrbs();
  eq(snapshot(g.orbs),before,'duplicate spawn in one action changes no balls');eq(draws,beforeDraws,'duplicate spawn does not reroll supply randomness');
 }
 eq(created.size,29,'sparse supply does not silently skip eligible turns');
 eq(new Set(g.orbs.map(o=>o.type)).size,2,'a full run retains both pickup kinds rather than replacing all +1 with healing');
 const used=g.orbs[0];used.used=true;g.round++;g.spawnOrbs();
 ok(!g.orbs.some(o=>o.id===used.id),'consumed balls are removed from the live supply');
}

// Supplies follow the next active station, including retreat land; neither
// side receives a second spawn in the same action. Venue preference survives.
{
 const g=make();g.obs=[];
 g.players.forEach((p,i)=>{p.x=i?2300:-700;p.homeX=p.x;p.y=ground(p.x,g.world);syncGroundContact(p,x=>ground(x,g.world));});
 for(const side of [1,0,1,0]){
  g.round++;g.active=side;g.spawnOrbs();const orb=g.orbs.find(o=>o.bornRound===g.round),p=g.players[side];
  ok(orb,'each alternating action has a fresh ball');
  const travel=(orb.x-p.x)*p.dir;
  ok(travel>=220&&travel<=530,'the new orb lies along the upcoming archer\'s own shot route');
  ok(side===0?orb.x<0:orb.x>1600,'side supply can remain in the expanded retreat terrain');
 }
 for(const [supply,expected]of [['mixed','plus'],['hearts','heart']]){
  const sample=make('rogue',()=>.4);sample.encounter.supply=supply;sample.round=2;sample.active=1;sample.spawnOrbs();
  eq(sample.orbs.length,1,'venue preference is tested against an actual generated ball');
  eq(sample.orbs[0].type,expected,supply+' keeps its distinct supply preference');
 }
}

// A new encounter/run resets both live balls and same-turn deduplication.
{
 const g=make();g.round=2;g.spawnOrbs();eq(g.orbs.length,1,'fixture creates a real endless pickup');
 g.setup(false);eq(g.orbs.length,0,'next encounter starts empty');g.round=2;g.spawnOrbs();
 eq(g.orbs.length,1,'encounter reset permits the same round number to supply again');
 g.start('rogue');eq(g.orbs.length,0,'new run also begins empty');g.round=2;g.spawnOrbs();
 eq(g.orbs.length,1,'new run does not retain the old duplicate-spawn guard');
 g.players[0].hp=45;const b={...launch(g.players[0],25),t:0,pierce:0,ignored:new Set()};
 g.pickup({id:'normal-heart',type:'heart',used:false,x:0,y:0},b,{x:0,y:0});
 eq(g.players[0].hp,65,'lower supply density does not also nerf a heart\'s twenty healing');
}

// Other modes keep their established two-ball supply and timing rules.
for(const [mode,choice,count]of [['local',3,2],['duel',3,2],['campaign',3,2],['campaign',1,0],['campaign',2,0],['target',3,0]]){
 const g=make(mode,()=>.5,choice);eq(g.orbs.length,0,mode+' still starts empty');
 g.round=2;g.spawnOrbs();eq(g.orbs.length,count,mode+' '+choice+' supply is outside the endless-only change');
 eq(g.settleDuration,.85,mode+' keeps its previous settling delay');
 eq(g.scoutDuration,mode==='campaign'&&choice===1?1.5:2.6,mode+' keeps its observation duration');
}
{
 const g=make('local');for(let round=2;round<=12;round++){g.round=round;g.spawnOrbs();}
 eq(g.orbs.length,12,'local duels retain their original twelve-ball field cap');
}

// Test real phase timing rather than only comparing configuration getters.
{
 const g=make();eq(g.scoutDuration,1.8,'first endless view gives the new arena time to register');
 tick(g,1.75);eq(g.phase,'scout','first observation cannot finish too early');
 tick(g,.1);eq(g.phase,'aim','first observation hands control over near1.8seconds');
 g.round=3;g.active=0;g.setPhase('scout');eq(g.scoutDuration,1,'later observations are shorter');
 tick(g,.95);eq(g.phase,'scout','later observation retains a short opponent view');
 tick(g,.1);eq(g.phase,'aim','later observation hands over nearone second');
 eq(g.settleDuration,.5,'endless misses have the shorter settling delay');
 g.active=1;g.phase='thinking';g.shoot();g.arrows=[];g.setPhase('settle');const round=g.round;
 tick(g,.45);eq(g.round,round,'empty flight still receives its minimum settling beat');
 tick(g,.1);eq(g.round,round+1,'empty flight no longer waits the old0.85seconds');
 eq([g.active,g.phase],[0,'scout'],'shorter NPC miss hands the next turn to the human normally');
}
{
 const g=make();g.active=1;g.phase='thinking';g.shoot();const b={...g.arrows[0],t:0},p=g.players[0];g.arrows=[];
 g.hitTarget(b,{part:'head',damage:42},{x:p.x,y:p.y-96});g.hitStop=0;g.setPhase('settle');const round=g.round;
 tick(g,.55);ok(p.body?.active,'fixture is still physically recovering after the shorter delay');
 eq(g.round,round,'shortened settling cannot hand control to a fallen living player');
 let frames=0;while(g.round===round&&frames++<350)g.update(.01);
 ok(frames<350&&!p.body.active,'physical recovery remains finite');
 eq([g.round,g.active,g.phase],[round+1,0,'scout'],'recovered human receives exactly one playable next turn');
}

// Fast pacing is not permission to strengthen the NPC or weaken held aiming.
for(const floor of [1,12,30]){
 const g=make();g.floor=floor;g.encounterFloor=0;g.setup();const cap=g.opponent.volleyCap;
 eq(cap,floor===1?26:42,'endless floor '+floor+' retains the established NPC damage allowance');
 Object.assign(g.players[1].stats,{damage:30,multi:8,fire:8,poison:8,crit:1});g.active=1;g.phase='thinking';g.shoot();const b={...g.arrows[0],t:0};
 for(let n=0;n<MAX_ARROWS;n++)g.hitTarget(b,{part:'head',damage:42},{x:g.players[0].x,y:g.players[0].y-96});
 g.arrows=[];g.nextTurn();ok(g.players[0].hp>=100-cap&&g.players[0].hp>0,'direct multi-arrow plus immediate status still share the NPC budget');
}
{
 const g=make('rogue',()=>.5,1,'dive');g.skip();g.shoot();const b=g.arrows[0];
 Object.assign(b,{x:300,y:100,vx:200,vy:-80,t:.3});ok(g.beginSkillAim(),'star pre-aim remains available with sparse pickups');
 const before=b.t;tick(g,.09);ok(Math.abs(b.t-before-.03)<1e-7,'held star retains exactly one-third actual projectile time');
 ok(g.releaseSkillAim()&&b.diving,'release still creates the real meteor');eq(g.timeScale,1,'release restores normal time');
}

console.log(checks+' endless supply density, expiry, turn pacing, recovery and mode-isolation checks passed.');
