import assert from 'node:assert/strict';
import {Game,G,MAX_ARROWS,ground,position} from '../dist/core.mjs';

let checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);checks++;};
const near=(actual,expected,message,tolerance=1e-7)=>{assert.ok(Math.abs(actual-expected)<=tolerance,`${message}: ${actual} versus ${expected}`);checks++;};
const snapshot=value=>JSON.stringify(value,(_key,item)=>item instanceof Set?[...item]:typeof item==='function'?undefined:item);
function make(skill='dive',multi=1){
 const events=[],g=new Game({save:{unlocked:true},rng:()=>.5,onEvent:event=>events.push(event)});
 g.start('rogue',1,skill);g.skip();g.obs=[];g.stats.multi=multi;
 g.players[1].hp=g.players[1].stats.maxHp=10000;
 ok(g.shoot(),skill+' begins a real volley');
 return {g,events};
}
function clearFlight(g){
 for(const [index,b]of g.arrows.entries())Object.assign(b,{x:300+index*5,y:100,vx:200,vy:-80,t:.3});
}
function pickup(g,b,id='test-plus'){
 const point=position(b,b.t),orb={...point,id,type:'plus',r:25,used:false};
 g.pickup(orb,b,point);return orb;
}
function finish(g,limit=2400){
 const round=g.round;let frames=0;
 while(['flight','settle'].includes(g.phase)&&g.round===round&&frames++<limit)g.update(1/60);
 ok(frames<limit,`${g.skill} volley has bounded flight and recovery`);
 ok(g.round>round||!['flight','settle'].includes(g.phase),`${g.skill} gives up the finished turn`);
 ok(g.arrows.every(b=>Number.isFinite(b.x)&&Number.isFinite(b.y)&&Number.isFinite(b.vx)&&Number.isFinite(b.vy)),`${g.skill} retains finite projectile state`);
 return frames;
}

// A held dive changes actual simulation time, not merely the animation rate.
{
 const normal=make().g,slow=make().g;clearFlight(normal);clearFlight(slow);
 eq(slow.timeScale,1,'flight starts at normal simulation speed');
 ok(slow.beginSkillAim(),'a separate flight input can start dive pre-aim');
 eq(slow.timeScale,1/3,'held dive exposes exactly one-third simulation speed');
 ok(!slow.skillUsed,'holding alone does not consume the once-per-volley skill');
 ok(!slow.beginSkillAim(),'repeated begin cannot restart the active hold');
 const a=normal.arrows[0].t,b=slow.arrows[0].t,t0=slow.totalTime;
 for(let n=0;n<3;n++){normal.update(.03);slow.update(.03);}
 near((normal.arrows[0].t-a)/(slow.arrows[0].t-b),3,'real projectile integration slows threefold');
 near(slow.totalTime-t0,.03,'world effects and phase clock use the same slowed time');
 ok(slow.aimSkill(18.6),'held dive direction can be changed');eq(slow.skillAim.tilt,19,'dive direction remains an integer');
 slow.aimSkill(999);eq(slow.skillAim.tilt,35,'rightward steering is bounded');
 slow.aimSkill(-999);eq(slow.skillAim.tilt,-35,'leftward steering is bounded');
 ok(!slow.aimSkill(NaN),'invalid steering does not poison trajectory');eq(slow.skillAim.tilt,-35,'invalid steering retains the prior direction');
 const state=snapshot(slow);ok(slow.cancelSkillAim(),'cancel exits held targeting');
 eq(slow.timeScale,1,'cancel immediately restores normal time');ok(!slow.skillUsed,'cancel leaves the skill available');
 ok(!slow.releaseSkillAim(),'release after cancel cannot fire a stale dive');
 ok(!slow.cancelSkillAim(),'repeated cancellation is harmless');
 ok(slow.beginSkillAim(),'cancelled skill may be aimed again');slow.aimSkill(0);
 ok(slow.releaseSkillAim(),'release commits the aimed dive');
 ok(slow.skillUsed&&!slow.skillAim,'commit consumes the skill and clears slow aiming');
 eq(slow.timeScale,1,'committed dive restores normal speed');
 ok(!slow.releaseSkillAim()&&!slow.activateSkill(),'duplicate release or activation cannot multiply the dive twice');
 ok(state.includes('"tilt":-35'),'pre-cancel snapshot really represented an active hold');
}

// Once a hold has started, losing its mature arrow must not disable the
// action while a fresh +1 child is still flying inside its initial guard.
{
 const {g}=make();clearFlight(g);ok(g.beginSkillAim(),'mature arrow begins a real targeting hold');
 const parent=g.arrows[0],point=position(parent,parent.t),orb={...point,id:'young-child',type:'plus',r:25,used:false};g.pickup(orb,parent,point);
 const child=g.arrows.at(-1);eq(child.t,0,'real +1 creates a fresh child inside the release guard');
 parent.dead=true;g.arrows=g.arrows.filter(b=>!b.dead);
 ok(g.canSkill,'established targeting remains available when only the fresh child survives');
 eq(g.previewSkill().length,1,'surviving fresh child retains its pre-aim line');
 ok(g.releaseSkillAim(),'release still commits the already-established hold on the fresh child');
 ok(child.diving&&g.skillUsed&&!g.skillAim,'fresh child becomes a real meteor without leaving slow time active');eq(g.timeScale,1,'fresh-child commit returns to normal time');
}
{
 const {g}=make();clearFlight(g);g.beginSkillAim();g.arrows=[];
 ok(!g.canSkill,'no surviving arrow makes targeting unavailable');eq(g.previewSkill(),[],'empty flight cannot produce stale aim lines');
 ok(!g.releaseSkillAim(),'release with no surviving arrows safely rejects the action');
 ok(!g.skillAim&&!g.skillUsed&&g.timeScale===1,'failed empty release clears the hold and restores normal speed without spending the skill');
}

// Prediction uses the real current projectile/terrain/target without consuming
// RNG, moving a ball, cracking cover, or producing a hit/event before release.
for(const tilt of [-35,0,35]){
 const {g,events}=make('dive',3);clearFlight(g);g.beginSkillAim();g.aimSkill(tilt);
 g.orbs=[{id:'preview-ball',x:300,y:200,r:25,type:'plus',used:false}];let randomCalls=0;g.rng=()=>{randomCalls++;return .5;};
 const before=snapshot(g),eventCount=events.length,preview=g.previewSkill();
 eq(preview.length,3,'each existing meteor receives its own predicted line');
 ok(preview.every(line=>line.points.length>1&&line.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))),'pre-aim emits finite path samples');
 ok(preview.every(line=>line.hit&&['ground','obstacle','hit','miss'].includes(line.hit.kind)),'each predicted line has a real collision endpoint');
 eq(g.previewSkill(),preview,'unchanged world produces the same prediction');
 eq(snapshot(g),before,'prediction does not mutate real gameplay or collect a ball');eq(events.length,eventCount,'prediction emits no gameplay events');eq(randomCalls,0,'prediction does not advance combat randomness');
 const first=preview[0],dx=first.points[1].x-first.points[0].x;
 if(tilt<0)ok(dx<0,'negative tilt visibly predicts a leftward dive');
 if(tilt>0)ok(dx>0,'positive tilt visibly predicts a rightward dive');
}
{
 const {g,events}=make(),target=g.players[1],b=g.arrows[0];
 Object.assign(b,{x:target.x,y:target.y-260,vx:0,vy:0,t:.2});
 ok(g.beginSkillAim(),'dive can be pre-aimed above the actual target');
 const expected=g.previewSkill()[0];
 eq(expected.hit.kind,'hit','pre-aim predicts a target contact rather than the floor');
 eq(expected.hit.part,'head','vertical approach predicts the first visible head collider');
 const initialHp=target.hp;g.releaseSkillAim();
 for(let n=0;n<180&&!events.some(event=>event.type==='hit');n++)g.update(1/120);
 const hit=events.find(event=>event.type==='hit');ok(hit,'released trajectory produces the predicted real hit');
 eq(hit.part,expected.hit.part,'actual contact agrees with the predicted part');
 ok(Math.hypot(hit.x-expected.end.x,hit.y-expected.end.y)<12,'predicted endpoint matches the real contact within sampling distance');
 eq(initialHp-target.hp,Math.round(42*1.45),'real falling headshot uses the modest1.45 damage multiplier');
 eq(hit.arrowId,b.id,'prediction and committed contact refer to the same projectile');
}
{
 const {g,events}=make(),target=g.players[1],b=g.arrows[0];
 Object.assign(b,{x:target.x-65,y:target.y-300-G*.2*.2/2,vx:0,vy:0,t:.2});
 const x=target.x-35,cover={x,y:ground(x,g.world),w:25,h:255,id:991,hp:2,maxHp:2,type:'crate',state:'standing',rot:0,dir:1};g.obs=[cover];
 g.beginSkillAim();g.aimSkill(20);const expected=g.previewSkill()[0];
 eq(expected.hit.kind,'hit','predicted penetration continues through real standing cover to the target');
 eq(cover.hp,2,'prediction never cracks the intervening cover');eq(b.pierce,0,'prediction never consumes real arrow penetration');ok(!b.ignored.has(cover.id),'prediction never changes the real passed-cover set');
 g.releaseSkillAim();for(let n=0;n<180&&!events.some(event=>event.type==='hit');n++)g.update(1/120);
 const hit=events.find(event=>event.type==='hit');ok(hit,'released steered meteor actually passes the cover and hits');eq(hit.part,expected.hit.part,'penetrating release agrees with the predicted contact');
 eq(cover.hp,1,'actual cover contact applies exactly one damage event');eq(b.pierce,0,'actual trajectory consumes its one new penetration');ok(b.ignored.has(cover.id),'actual trajectory records passed cover');
}
{
 const {g}=make('dive',8);clearFlight(g);
 while(g.volleyCount<MAX_ARROWS)pickup(g,g.arrows[0],'preview-'+g.volleyCount);
 g.beginSkillAim();eq(g.previewSkill().length,8,'dense volleys bound visible preview work to eight lines');
 g.releaseSkillAim();ok(g.arrows.every(b=>b.diving&&b.pierce===1),'bounded preview still transforms every real arrow');
 eq(g.volleyCount,MAX_ARROWS,'dive does not create unbudgeted arrows itself');finish(g);
}

// Real multi-arrow and +1 chains keep their transformed identity. A pickup
// cannot grant a second activation or refill a used ricochet.
for(const skill of ['dive','burst'])for(const multi of [1,4,8]){
 const {g}=make(skill,multi);clearFlight(g);
 for(const b of g.arrows){b.pierce=2;b.ignored.add(991);}
 const first=g.arrows[0],orb=pickup(g,first,'before-'+multi);const before=g.volleyCount;
 g.pickup(orb,first,position(first,first.t));eq(g.volleyCount,before,'one pre-skill ball is consumed once');
 const pre=g.arrows.at(-1);eq(pre.scale,1,'pre-skill +1 begins with its parent damage');
 if(skill==='burst')ok(g.arrows.every(b=>b.bomb),'every original and pre-skill extra arrow carries one visible bomb');
 ok(g.activateSkill(20),'skill transforms the existing original and extra arrows');
 const count=g.volleyCount;eq(count,multi+1,'transform itself does not triple meteor or bomb arrow count');
 ok(g.arrows.every(b=>b.ignored.has(991)&&b.pierce===3),'transform preserves passed cover and adds one penetration');
 const parent=g.arrows[0];if(skill==='burst')parent.bounces=0;
 const postOrb=pickup(g,parent,'after-'+multi),child=g.arrows.at(-1);
 eq(g.volleyCount,count+1,'post-skill +1 adds exactly one new arrow');
 eq(child.scale,parent.scale,'post-skill +1 inherits the real transformed damage');
 eq(child.vx,parent.vx,'post-skill +1 inherits transformed horizontal velocity');
 eq(child.pierce,parent.pierce,'post-skill +1 inherits remaining penetration');
 ok(child.ignored.has(991)&&child.ignored!==parent.ignored,'passed cover is copied without sharing a mutable set');
 if(skill==='dive'){
  ok(child.diving&&child.diveTilt===20,'post-skill extra remains a steered meteor');near(child.scale,1.45,'meteor extra does not multiply damage again');
 }else{
  ok(child.boosted&&!child.bomb,'post-blast extra remains boosted without gaining a fresh bomb');
  eq(child.bounces,0,'post-blast extra does not refill an already-spent ricochet');near(child.scale,2,'bomb extra does not multiply damage again');
 }
 g.pickup(postOrb,parent,position(parent,parent.t));eq(g.volleyCount,count+1,'post-skill ball cannot be consumed twice');
 ok(!g.activateSkill(),'inherited extras cannot trigger another volley activation');
 while(g.volleyCount<MAX_ARROWS)pickup(g,parent,'fill-'+g.volleyCount);
 pickup(g,parent,'over-cap');eq(g.volleyCount,MAX_ARROWS,'transformed pickup chains retain the global24-arrow cap');
 finish(g);
}

// Star attraction is a concrete collection advantage: a ball just outside an
// ordinary arrow's pickup circle is captured by the falling arrow, once.
{
 const {g}=make();clearFlight(g);g.activateSkill();
 const b=g.arrows[0],p=position(b,b.t);g.orbs=[{id:'star-catch',x:p.x+50,y:p.y+8,r:25,type:'plus',used:false}];
 g.update(.005);ok(g.orbs[0].used,'star attraction captures a ball outside the ordinary25px contact');
 eq(g.volleyCount,2,'attracted +1 creates one additional meteor');ok(g.arrows.at(-1).diving,'attracted child keeps the star behavior');
 g.update(.005);eq(g.volleyCount,2,'multiple meteors cannot re-consume an attracted ball');
}

// Blasts keep the original projectile and impart the requested boost from its
// instantaneous trajectory; splash damage must not receive that boost early.
{
 const {g}=make('burst'),b=g.arrows[0];Object.assign(b,{x:350,y:150,vx:310,vy:-90,t:.4,scale:.75});
 const old={point:position(b,b.t),vx:b.vx,vy:b.vy+G*b.t,id:b.id,scale:b.scale};
 ok(g.activateSkill(),'remote blast activates away from a target');
 eq(g.arrows.length,1,'blast retains the real projectile');eq(g.arrows[0],b,'blast retains the same projectile object');eq(b.id,old.id,'blast does not create a different arrow ID');
 near(b.x,old.point.x,'boost starts at current arrow x');near(b.y,old.point.y,'boost starts at current arrow y');
 near(b.vx,old.vx*2,'boost doubles instantaneous horizontal velocity');near(b.vy,old.vy*2,'boost doubles instantaneous vertical velocity');
 eq(b.t,0,'boost rebases flight time without a position jump');near(b.scale,old.scale*2,'boost doubles subsequent direct damage');
 ok(b.boosted&&!b.bomb&&b.bounces===1&&!b.noStick,'blast spends its bomb and retains one physical ricochet with ordinary sticking');
 const after=snapshot(b);ok(!g.activateSkill(),'repeated remote detonation is rejected');eq(snapshot(b),after,'rejected detonation does not multiply boost or replenish ricochet');
}
{
 const {g,events}=make('burst'),b=g.arrows[0],target=g.players[1];
 Object.assign(b,{x:target.x-310,y:target.y-60+G*.2*.2/2,vx:300,vy:-G*.2,t:.2});
 const hp=target.hp;g.activateSkill();eq(target.hp,hp,'remote blast outside proximity range adds no hidden target damage');
 for(let n=0;n<240&&!events.some(event=>event.type==='hit');n++)g.update(1/120);
 const hit=events.find(event=>event.type==='hit');ok(hit,'boosted arrow continues into a real collision');
 eq(hit.part,'body','boosted level trajectory reaches the intended body collider');eq(hp-target.hp,52,'real boosted body contact has exactly double direct damage');
 eq(hit.arrowId,b.id,'post-blast collision keeps the original arrow ID');eq(target.stuck.length,1,'surviving boosted arrow can visibly stick on direct contact');
}
{
 const {g}=make('burst'),b=g.arrows[0],target=g.players[1];
 Object.assign(b,{x:target.x,y:target.y-60-G*.2*.2/2,vx:0,vy:0,t:.2});
 const hp=target.hp;g.activateSkill();
 eq(hp-target.hp,Math.round(26*(1-5/180)),'splash uses the original pre-boost damage scale');
 eq(target.stuck.length,0,'splash alone does not leave a floating stuck arrow');
 ok(g.arrows.length===1&&g.phase==='flight','splash does not prematurely settle the surviving boost');finish(g);
}
{
 const {g}=make('burst'),b=g.arrows[0];
 g.arena.terrain={shape:'profile',profile:[[-1000,700],[2600,700]],bounds:{left:-1000,right:2600}};
 Object.assign(b,{x:400,y:600,vx:300,vy:100,t:.2});g.activateSkill();
 let frames=0;while(g.arrows.includes(b)&&b.bounces===1&&frames++<240)g.update(1/120);
 ok(frames<240&&g.arrows.includes(b),'boosted arrow survives its first actual ground contact');
 eq(b.bounces,0,'first ground impact spends its only ricochet');ok(b.vy<0,'ground contact physically reflects the arrow upward');near(b.scale,2,'ricochet does not create another damage multiplier');
 const count=g.volleyCount;finish(g);eq(g.volleyCount,count,'a ricochet never creates more projectiles');
}

// A hold cannot leak into another phase/mode or grant an NPC the new skills.
for(const action of ['cancel','home','restart','phase','landing']){
 const {g}=make();clearFlight(g);g.beginSkillAim();
 if(action==='cancel')g.cancelSkillAim();
 if(action==='home')g.goHome();
 if(action==='restart')g.start('rogue',1,'dive');
 if(action==='phase')g.setPhase('settle');
 if(action==='landing'){
  for(const b of g.arrows)Object.assign(b,{y:ground(b.x,g.world)-1,vy:640,t:.2});
  for(let n=0;n<20&&g.phase==='flight';n++)g.update(.03);
 }
 ok(!g.skillAim&&g.timeScale===1,action+' clears active slow targeting');ok(!g.releaseSkillAim(),action+' rejects a delayed release');
}
for(const mode of ['campaign','duel','local','target']){
 const g=new Game({save:{unlocked:true},rng:()=>.5});g.start(mode);g.phase='aim';g.skill='dive';g.shoot();g.arrows.forEach(b=>b.t=.2);
 ok(!g.beginSkillAim()&&!g.activateSkill(),'new active bows remain scoped to player roguelike: '+mode);
 eq(g.timeScale,1,'other modes never enter slow time: '+mode);
}
{
 const {g}=make('burst');g.active=1;g.phase='thinking';g.shoot();g.arrows.forEach(b=>b.t=.2);
 ok(!g.canSkill&&!g.activateSkill()&&!g.beginSkillAim(),'NPC cannot invoke player bomb or targeting APIs');
 ok(g.arrows.every(b=>!b.bomb),'NPC arrows never silently gain bound bombs');
 const hp=g.players[0].hp;Object.assign(g.players[1].stats,{damage:20,fire:4,poison:4,crit:1});
 for(let n=0;n<24;n++)g.hitTarget(g.arrows[0],{part:'head',damage:42},{x:g.players[0].x,y:g.players[0].y-96});
 g.arrows=[];g.nextTurn();ok(hp-g.players[0].hp<=g.opponent.volleyCap,'existing NPC multiarrow and status budget remains effective');
}
console.log(checks+' held-dive, trajectory-preview, bound-bomb, pickup-inheritance, ricochet and active-skill lifecycle checks passed.');
