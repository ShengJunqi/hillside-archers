import assert from 'node:assert/strict';
import {Game,ground} from '../dist/core.mjs';
import {BODY_BONES,bodyPose,standingPose,bodyCollision,impactBody,updateBody,syncGroundContact} from '../dist/body.mjs';
import {ARENAS} from '../dist/encounters.mjs';
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;},eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
const lengths=pose=>BODY_BONES.map(([a,b])=>Math.hypot(pose[a].x-pose[b].x,pose[a].y-pose[b].y));
const flat={x:800,y:700,dir:1,hp:100},flatLengths=lengths(standingPose(flat));
function assertContact(p,terrain,label){
 const before=JSON.stringify(p),pose=standingPose(p);
 for(const foot of ['footBack','footFront'])ok(Math.abs(pose[foot].y+5-terrain(pose[foot].x))<1e-8,label+' sole follows its own actual ground point');
 for(const key of ['head','chest','hip'])eq(pose[key].y,p.y+({head:-96,chest:-73,hip:-39}[key]),label+' retains '+key+' collision height');
 for(let i=6;i<BODY_BONES.length;i++)ok(Math.abs(lengths(pose)[i]-flatLengths[i])<1e-6,label+' adapts stance without stretching a leg bone');
 eq(JSON.stringify(p),before,label+' pose sampling is read-only');
}

// All authored platforms and retreat slopes, including the target-mode x220
// relocation. Contact is sampled at the real feet, not a capped center slope.
for(let choice=1;choice<=ARENAS.length;choice++){
 const g=new Game({save:{unlocked:true},rng:()=>.5});g.start('local',choice);const terrain=x=>ground(x,g.world);
 for(const x of [...g.arena.xs,55,220,1539,1545]){
  const p={x,y:terrain(x),dir:1,hp:100};const contact=syncGroundContact(p,terrain);
  ok(Object.values(contact).every(Number.isFinite),'contact stores serializable finite data only');assertContact(p,terrain,g.arena.layoutId+' x'+x);
 }
}
for(const slope of[-2.2,-1.3,-.65,-.35,0,.35,.65,1.3,2.2]){
 const terrain=x=>700+(x-800)*slope,p={...flat};syncGroundContact(p,terrain);assertContact(p,terrain,'slope '+slope);
 const pose=standingPose(p);ok(Math.abs(pose.footBack.x-p.x)<=13&&Math.abs(pose.footFront.x-p.x)<=13,'steep banks bring a foot closer instead of lengthening the leg');
}
{
 const terrain=x=>650+Math.sin(x/100)*50,p={x:1400,y:terrain(1400),dir:1,hp:100};syncGroundContact(p,terrain);p.x=220;p.y=terrain(220);updateBody(p,0,terrain);
 eq(p.groundContact.x,220,'inactive update refreshes contact after a shooting-range relocation');assertContact(p,terrain,'relocated target archer');
 const snapshot=JSON.stringify(p);standingPose(p,30,1,.3);eq(JSON.stringify(p),snapshot,'visual walking never changes collision contact data');
}

// Reproduce the previous ragdoll broadphase hole against actual moving nodes.
// Some visible nodes fall below root.y+36 during rotation and slope landings.
let sampled=0,belowOldRootBox=0;const misses=[];
for(let choice=1;choice<=ARENAS.length;choice++)for(const [part,damage,height]of[['head',42,96],['body',26,60],['feet',12,5]]){
 const g=new Game({save:{unlocked:true},rng:()=>.5});g.start('local',choice);const p=g.players[1],terrain=x=>ground(x,g.world);p.hp=1000;syncGroundContact(p,terrain);
 impactBody(p,{point:{x:p.x,y:p.y-height},vx:450,vy:20,damage,part,volleyId:1});
 for(let frame=0;frame<240&&p.body.active;frame++){
  updateBody(p,1/120,terrain,1600,{obstacles:g.obs});if(!p.body.active)break;
  const pose=bodyPose(p),before=JSON.stringify(p);
  for(const key of ['head','chest','footBack','footFront']){
   sampled++;if(pose[key].y>p.y+36)belowOldRootBox++;
   if(!bodyCollision(pose[key],p))misses.push({choice,part,frame,key,point:pose[key],root:{x:p.x,y:p.y}});
  }
  const nodes=Object.values(pose),far={x:Math.max(...nodes.map(n=>n.x))+100,y:Math.max(...nodes.map(n=>n.y))+100};
  if(bodyCollision(far,p))misses.push({choice,part,frame,key:'far'});
  assert.equal(JSON.stringify(p),before,'collision reads current nodes without mutating physics');
 }
 assertContact(p,terrain,'recovered '+g.arena.layoutId+' '+part);
}
ok(sampled>10000,'regression samples actual moving contacts throughout recovery');ok(belowOldRootBox>0,'regression exercises visible points below the old root-based rejection bound');eq(misses,[],'all visible head, torso and foot centers remain hittable during knockdown, while empty space stays empty');
{
 const p={...flat};impactBody(p,{point:{x:800,y:604},vx:450,vy:20,damage:42,part:'head'});
 for(const n of Object.values(p.body.nodes)){n.x+=330;n.px+=330;n.y+=240;n.py+=240;}
 const pose=bodyPose(p);eq(bodyCollision(pose.head,p)?.part,'head','dynamic broadphase uses actual nodes even outside the old root rectangle');eq(bodyCollision({x:800,y:604},p),null,'an empty old station is not a ragdoll hit');
 p.x+=43;p.y+=27;const translated=bodyPose(p);eq(bodyCollision(translated.head,p)?.part,'head','current anchor translation participates in the active broadphase');
}
{
 const p={...flat};syncGroundContact(p,()=>700);const pose=standingPose(p),limbs=new Set(['arms','legs','feet']);
 const leg={x:(pose.hip.x+pose.kneeBack.x)/2,y:(pose.hip.y+pose.kneeBack.y)/2};
 eq(bodyCollision(leg,p)?.part,'body','unfiltered legacy ordering keeps the generous hip-body capsule');eq(bodyCollision(leg,p,limbs)?.part,'legs','part filter skips body and continues to find the real leg');
 eq(bodyCollision(pose.head,p,limbs),null,'limb filter excludes head contacts');eq(bodyCollision(pose.chest,p,new Set()),null,'empty part filter never invents a hit');
 for(let choice=1;choice<=ARENAS.length;choice++){
  const g=new Game({save:{unlocked:true}});g.start('local',choice);const terrain=x=>ground(x,g.world),q={x:1539,y:terrain(1539),dir:1,hp:100};syncGroundContact(q,terrain);const r=standingPose(q);
  for(const [a,b,part]of BODY_BONES.filter(b=>b[2]==='legs')){
   const point={x:(r[a].x+r[b].x)/2,y:(r[a].y+r[b].y)/2};eq(bodyCollision(point,q,new Set(['legs']))?.part,'legs','slope leg midpoint is still found after filtering other parts');
  }
 }
}
console.log(checks+' actual ragdoll-contact, slope-foot, fixed-leg and filtered-capsule checks passed ('+sampled+' moving node samples).');
