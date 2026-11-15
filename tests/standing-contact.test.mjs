import assert from 'node:assert/strict';
import {Game,ground,collision} from '../dist/core.mjs';
import {bodyPose,syncGroundContact} from '../dist/body.mjs';
import {ARENAS} from '../dist/encounters.mjs';
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;};
for(let choice=1;choice<=ARENAS.length;choice++)for(const mode of ['local','target']){
 const g=new Game({save:{unlocked:true}});g.start(mode,choice);const p=mode==='target'?g.players[0]:g.players[1];
 ok(p.groundContact&&Math.abs(p.groundContact.x-p.x)<1e-5,'setup synchronizes actual station, including target relocation');
 const original=p.x;for(const x of [original,Math.max(55,original-110),Math.min(1545,original+110)]){
  p.x=x;p.y=ground(x,g.world);syncGroundContact(p,xx=>ground(xx,g.world));const pose=bodyPose(p,25);
  for(const foot of ['footBack','footFront']){const n=pose[foot],r=collision(n,p,[],g.world);ok(Math.abs(n.y+5-ground(n.x,g.world))<1e-4,'rendered sole matches actual ground');ok(r?.kind==='hit','actual standing foot contact counts through Game collision');}
  for(const [a,b]of [['hip','kneeBack'],['kneeBack','footBack'],['hip','kneeFront'],['kneeFront','footFront']]){const point={x:(pose[a].x+pose[b].x)/2,y:(pose[a].y+pose[b].y)/2},r=collision(point,p,[],g.world);ok(r?.kind==='hit','standing leg segment has no collision hole');}
 }
}
{
 const g=new Game({save:{unlocked:true}});g.start('local',8);g.players[1].hp=1;g.phase='aim';g.shoot();g.hitTarget({...g.arrows[0],t:0},{part:'head',damage:42},{x:g.players[1].x,y:g.players[1].y-96});ok(g.finisher,'real death creates transient finisher');g.goHome();ok(g.finisher===null&&g.phase==='home','returning home clears KO even before animation completes');
}
console.log(checks+' initial/relocated standing-contact, leg-collision and early-exit KO checks passed.');
