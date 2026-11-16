import assert from 'node:assert/strict';
import {Game,ground,launch,position,trace} from '../dist/core.mjs';
import {ARENAS,arenaBounds} from '../dist/encounters.mjs';

let checks=0;
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
const near=(a,b,m,tolerance=1e-8)=>{assert.ok(Math.abs(a-b)<=tolerance,m+`: ${a} vs ${b}`);checks++;};
const rng=seed=>()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const make=(mode='duel',choice=1,random=()=>.5,skill='split')=>{const events=[],g=new Game({save:{unlocked:true},rng:random,onEvent:e=>events.push(e)});g.start(mode,choice,skill);return {g,events};};
const ready=g=>{while(['intro','scout'].includes(g.phase))g.skip();};
const nonHeadShot=(g,side)=>{for(const power of [100,95,90,85,80,75,70,65,60,55,50,45,40,35,30,25,20])for(let angle=5;angle<=75;angle++){const h=trace(g.players[side],g.players[1-side],angle,g.obs,g.world,power);if(h.kind==='hit'&&h.part!=='head')return {angle,power};}return null;};

// Repeated games choose actual new stations; repeated setup of the same game
// must retain its preview instead of silently rerolling a live fight.
for(let choice=1;choice<=ARENAS.length;choice++){
 const {g}=make('duel',choice,rng(910+choice)),distances=new Set(),elevations=new Set();
 for(let run=0;run<10;run++){
  if(run)g.start('duel',choice);
  eq(g.arena.layoutId,ARENAS[choice-1].id,'a new roll retains the selected authored map');
  eq(g.players.map(p=>p.x),g.arena.xs,'runtime archers stand exactly at the randomized preview stations');
  eq(g.arena.preview.xs,g.arena.xs,'route dots describe the actual initial distance');
  eq(g.players.map(p=>p.y),g.arena.xs.map(x=>ground(x,g.world)),'randomized elevation is actual collision ground');
  eq(g.arena.geometry.distance,g.players[1].x-g.players[0].x,'advertised distance comes from the real archers');
  distances.add(g.arena.geometry.distance);elevations.add(g.arena.geometry.heightDelta);
  const bounds=arenaBounds(g.world);
  for(const p of g.players){ok(p.x>bounds.left+55&&p.x<bounds.right-55,'new stations retain retreat ground on both sides');for(const o of g.obs)ok(Math.abs(p.x-o.x)>o.w/2+80,'randomization cannot place an archer into cover');}
  const before=JSON.stringify([g.arena.id,g.arena.xs,g.arena.geometry]);g.setup();eq(JSON.stringify([g.arena.id,g.arena.xs,g.arena.geometry]),before,'setup does not reroll current stance');
  for(const side of [0,1])ok(nonHeadShot(g,side),'a newly rolled stance has a real non-head counterattack');
 }
 ok(distances.size>=3,'map '+g.arena.layoutId+' changes initial range across actual new games');
 ok(Math.max(...distances)-Math.min(...distances)>=80,'map '+g.arena.layoutId+' range variation is physically visible');
}
for(const seed of [1,77,2001]){const {g}=make('campaign',1,rng(seed));eq(g.players.map(p=>p.x),[520,1080],'tutorial keeps its stable learning distance');eq(g.players[1].hp,50,'stable tutorial retains half-health opponent');}
for(const seed of [17,62,299]){
 const {g}=make('rogue',1,rng(seed));g.complete(true);g.resultNext();
 const [a,b]=g.nextRoutes;ok(a&&b,'victory still offers two actual next maps');
 ok(Math.abs(a.geometry.distance-b.geometry.distance)>=180||Math.abs(a.geometry.heightDelta-b.geometry.heightDelta)>=90,'random route tickets retain a material range or elevation contrast');
 const expected=JSON.stringify(b);ok(g.chooseRoute(b.id),'alternate randomized ticket can be selected');ok(g.continueRun(),'odd-floor route-only continuation succeeds');eq(JSON.stringify(g.arena),expected,'new level uses exactly its chosen randomized preview');
}

// The robot travels the same parabola in less wall time. Its projectile launch
// velocity, gravity, aiming decisions and protection budget are unchanged.
{
 const slow=make('duel',3),fast=make('duel',3);for(const {g}of[slow,fast]){g.obs=[];g.arena.enemy.id='steady';ready(g);g.nextTurn();}
 Object.defineProperty(slow.g,'timeScale',{get:()=>1,configurable:true});
 eq(fast.g.timeScale,1.7,'robot flight exposes the accelerated presentation rate');
 eq([fast.g.arrows[0].vx,fast.g.arrows[0].vy],[slow.g.arrows[0].vx,slow.g.arrows[0].vy],'faster presentation does not secretly change arrow ballistics');
 eq(fast.g.opponent,slow.g.opponent,'robot damage/error budget is not strengthened');
 const a=fast.g.arrows[0],b=slow.g.arrows[0],at=a.t,bt=b.t;fast.g.update(.03);slow.g.update(.03);
 near((a.t-at)/(b.t-bt),1.7,'actual projectile time advances1.7times per wall second');
 eq(position(a,a.t),position(launch(fast.g.players[1],fast.g.angles[1],fast.g.powers[1]),a.t),'accelerated arrow remains on its original physical curve');
 let fastFrames=1,slowFrames=1;
 while(!fast.events.some(e=>e.type==='hit'&&e.shooterSide===1)&&fastFrames++<1000)fast.g.update(1/120);
 while(!slow.events.some(e=>e.type==='hit'&&e.shooterSide===1)&&slowFrames++<1000)slow.g.update(1/120);
 ok(fastFrames<slowFrames*.75,'the real first impact arrives sooner, not only a faster animation');
 const fh=fast.events.find(e=>e.type==='hit'&&e.shooterSide===1),sh=slow.events.find(e=>e.type==='hit'&&e.shooterSide===1);
 ok(fh&&sh,'both reference and accelerated physical flights hit');eq(fh.part,sh.part,'first-hit body part stays the same');
}
for(const mode of ['local','target']){const {g}=make(mode);ready(g);if(mode==='local')g.active=1;g.phase='aim';g.shoot();eq(g.timeScale,1,'human mode '+mode+' remains at normal time');}
{
 const {g}=make('rogue',1,()=>.5,'dive');ready(g);eq(g.arrowType,'special','an available special is selected by default');
 ok(g.selectArrowType('normal'),'left-dock ordinary choice accepted before shot');const ammo=g.specialAmmo;ok(g.shoot(),'ordinary arrow still fires');g.update(.05);g.update(.05);g.update(.05);ok(!g.canSkill,'ordinary volley cannot be secretly converted after launch');eq(g.specialAmmo,ammo,'ordinary selection and shot cost no ammunition');ok(!g.selectArrowType('special'),'flight locks selection to its actual volley');
 g.phase='aim';g.arrows=[];ok(g.selectArrowType('special'),'special choice accepted on next aim');g.shoot();g.update(.05);g.update(.05);g.update(.05);ok(g.beginSkillAim(),'selected star can hold its manual aim');eq(g.timeScale,1/3,'player star retains one-third time');ok(g.cancelSkillAim(),'hold cancellation works at the new left control');eq(g.specialAmmo,ammo,'holding/cancelling still costs no ammunition');
 g.specialAmmo=0;g.phase='aim';eq(g.arrowType,'normal','empty ammunition safely presents ordinary fallback');ok(g.shoot(),'empty magazine never blocks the ordinary bow');
}
{
 const {g,events}=make('rogue',1,()=>.5,'burst');ready(g);g.players[0].stats.pierce=1;
 ok(g.selectArrowType('normal'),'explosive bow can conserve ammunition with an ordinary shot');
 const ammo=g.specialAmmo;ok(g.shoot(),'ordinary explosive-bow volley actually launches');
 const arrow=g.arrows[0],point=position(arrow,.18),cover={id:'ordinary-refund-cover',type:'post',x:point.x,y:ground(point.x,g.world),w:28,h:0,hp:1,state:'standing',rot:0};cover.h=cover.y-point.y+20;g.obs=[cover];
 eq(arrow.bomb,false,'ordinary explosive-bow arrow launches without a bomb');
 let frames=0;while(cover.state==='standing'&&frames++<120)g.update(1/120);
 ok(events.some(e=>e.type==='break'&&e.obstacleId===cover.id&&e.broken),'actual ordinary arrow physically breaks its cover');
 eq(g.specialAmmo,ammo+1,'piercing cover break refunds one real special arrow');
 eq(g.volleyArrowType,'normal','refund preserves the launched ordinary-arrow selection');
 eq(arrow.bomb,false,'cover refund cannot attach a bomb to an ordinary arrow in flight');
 ok(!g.canSkill&&!g.activateSkill(),'refunded ammunition cannot late-cast an ordinary volley');
 eq(g.specialAmmo,ammo+1,'rejected late cast does not spend the cover refund');
}
{
 const {g}=make('campaign',3);ready(g);g.obs=[];g.arena.enemy.id='steady';g.active=1;g.phase='thinking';g.angles[1]=g.chooseAI();Object.assign(g.players[1].stats,{damage:20,fire:4,poison:4,crit:1,multi:1});const b=launch(g.players[1],g.angles[1],g.powers[1]);g.shoot();g.orbs=[.2,.6].map((t,i)=>({...position(b,t),id:'fast-budget-'+i,r:25,type:'plus',used:false}));
 let frames=0;while(g.round===1&&frames++<2000)g.update(1/120);
 ok(frames<2000,'accelerated extreme multiarrow still settles');eq(g.volleyCount,3,'two physical +1 contacts add exactly two arrows');ok(g.players[0].hp>0&&g.players[0].hp<100&&g.players[0].hp>=100-g.opponent.volleyCap,'fast critical elemental robot obeys one complete volley budget');ok(!g.players[0].body?.active,'control still waits for the struck archer to recover');
}
console.log(checks+' randomized gameplay, faster robot flight, arrow selection and real-budget checks passed.');
