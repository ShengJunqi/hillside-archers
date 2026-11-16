import assert from 'node:assert/strict';
import {BODY_BONES,bodyPose,bodyCollision,impactBody,updateBody} from '../dist/body.mjs';

let checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);checks++;};
const flat=()=>720;
const bounds={worldMinX:-1000,worldMaxX:2600};
const make=x=>({x,homeX:x,y:flat(x),dir:x<800?1:-1,hp:100,stuck:[]});
const hit=(p,direction,id)=>impactBody(p,{point:{x:p.x,y:p.y-96},vx:direction*800,vy:30,part:'head',damage:42,volleyId:id});
function settle(p,options=bounds){
 let frames=0;
 while(p.body.active&&!p.body.sleeping&&frames++<600)updateBody(p,1/120,flat,1600,options);
 ok(frames<=500,'reaction settles without retaining the turn at an edge');
 return frames;
}

// The old view edge is now ordinary playable ground. Each later volley gets
// a new station, while the per-volley displacement cap remains in force.
for(const [start,direction]of [[70,-1],[1530,1]]){
 const p=make(start);
 for(let volley=0;volley<10;volley++){
  const before=p.x;hit(p,direction,'retreat-'+volley);settle(p);
  ok((p.x-before)*direction>65,'new volley continues moving beyond the former map edge');
  ok(Math.abs(p.x-before)<=140.001,'larger map does not enlarge one volley displacement allowance');
  eq(p.y,flat(p.x),'recovery follows the new ground station');
  eq(p.homeX,p.x,'recovery keeps the new station');
  eq(p.hp,100,'larger retreat space never adds health damage');
  const pose=bodyPose(p);
  eq(bodyCollision(pose.head,p)?.part,'head','standing head remains hittable beyond the old view');
 }
 ok(direction<0?p.x<0:p.x>1600,'actual station has crossed the former world coordinates');
 for(const n of Object.values(p.body.nodes))ok(direction<0?n.x<0:n.x>1600,'joint coordinates cross with the body rather than clamping at the old edge');
}

// The final safety wall still stops bodies falling out of the world, but it
// must not prevent recovery or a later impulse away from that wall.
for(const [start,direction,edge]of [[-940,-1,-945],[2540,1,2545]]){
 const p=make(start);hit(p,direction,'outer-edge');settle(p);eq(p.x,edge,'station stops at the new safety boundary');
 ok(!p.body.active,'living character gets up at the new boundary');
 const before=p.x;hit(p,-direction,'return-inward');settle(p);
 ok((p.x-before)*-direction>65,'fresh inward hit can move away from the world boundary');
 ok(p.x>-945&&p.x<2545,'recovered body is no longer pinned to the boundary');
 for(const n of Object.values(p.body.nodes))ok(Number.isFinite(n.x)&&Number.isFinite(n.y)&&n.x>=-990&&n.x<=2590,'all joints use the enlarged physical extent');
}

for(const [start,direction]of [[-940,-1],[2540,1]]){
 const p={...make(start),hp:0};hit(p,direction,'corpse');settle(p);
 ok(p.body.sleeping,'defeated body reaches a stable rest at either new edge');
 const error=Math.max(...BODY_BONES.map(([a,b],i)=>Math.abs(Math.hypot(p.body.nodes[a].x-p.body.nodes[b].x,p.body.nodes[a].y-p.body.nodes[b].y)-p.body.lengths[i])));
 ok(error<5,'new-edge corpse retains connected limbs');
 const resting=JSON.stringify(p.body.nodes);updateBody(p,.05,flat,1600,bounds);eq(JSON.stringify(p.body.nodes),resting,'new-edge corpse does not jitter after sleeping');
}

{
 const p=make(-800);hit(p,1,'opponent');settle(p,{...bounds,minX:-850,maxX:-780});
 eq(p.x,-780,'opponent separation bounds still apply in negative world coordinates');
}
{
 const legacy=make(800),explicit=make(800);hit(legacy,1,'legacy');hit(explicit,1,'legacy');
 settle(legacy,{});settle(explicit,{worldMinX:0,worldMaxX:1600});
 eq(explicit,legacy,'explicit original extent exactly preserves the legacy reaction');
}
console.log(checks+' expanded-map body boundary, recovery and inward-motion checks passed.');
