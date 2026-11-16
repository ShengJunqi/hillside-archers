import assert from 'node:assert/strict';
import {ARENAS,ARENA_LEFT,ARENA_RIGHT,encounterFor,encounterGround,encounterObstacles,varyEncounter} from '../dist/encounters.mjs';
import {launch,position,trace} from '../dist/core.mjs';
import {syncGroundContact,standingPose} from '../dist/body.mjs';

let checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);checks++;};
const near=(actual,expected,message)=>{ok(Math.abs(actual-expected)<1e-7,message);};
const originals=ARENAS.map(a=>[...a.xs]);
const arenas=Array.from({length:ARENAS.length},(_,i)=>encounterFor(0,i+1));
function fighters(e){
 return e.xs.map((x,i)=>{
  const p={x,y:encounterGround(x,e.terrain),dir:i?-1:1,hp:100,body:null};
  syncGroundContact(p,xx=>encounterGround(xx,e.terrain));return p;
 });
}
function usefulShot(e,side){
 const ps=fighters(e),source=ps[side],target=ps[1-side],obs=encounterObstacles(e,x=>encounterGround(x,e.terrain));
 const powers=[...new Set([e.geometry.recommendedPower,...Array.from({length:17},(_,i)=>100-i*5)])];
 for(const power of powers)for(let angle=5;angle<=75;angle++){
  const arrow=launch(source,angle,power),time=(target.x-arrow.x)/arrow.vx;
  if(time<=0||time>=12)continue;
  const y=position(arrow,time).y;if(y<target.y-125||y>target.y+20)continue;
  const hit=trace(source,target,angle,obs,e.terrain,power);
  if(hit.kind==='hit'&&hit.part!=='head')return {angle,power,part:hit.part};
 }
 return null;
}

for(const original of arenas){
 const snapshot=JSON.stringify(original),ranges=[],heights=[],stations=new Set();
 for(let seed=0;seed<64;seed++){
  const e=varyEncounter(original,seed),ps=fighters(e);
  eq(e,varyEncounter(original,seed),original.layoutId+': seed reproduces exact stations and preview');
  eq(e,varyEncounter(e,seed),original.layoutId+': repeated wrapping does not accumulate offsets');
  eq(e,varyEncounter(varyEncounter(original,seed+199),seed),original.layoutId+': new seed always starts from original stations');
  eq(e.terrain.profile,original.terrain.profile,original.layoutId+': stance randomization never deforms authored hills');
  eq(e.cover,original.cover,original.layoutId+': cover remains authored physical cover');
  eq(e.preview.xs,e.xs,original.layoutId+': route ticket shows the actual selected stations');
  eq(e.preview.profile,e.terrain.profile,original.layoutId+': route ticket uses actual ground');
  eq(e.geometry.distance,e.xs[1]-e.xs[0],original.layoutId+': displayed distance is actual distance');
  eq(e.geometry.heightDelta,Math.round(ps[0].y-ps[1].y),original.layoutId+': displayed elevation is actual elevation');
  eq([e.geometry.leftY,e.geometry.rightY],ps.map(p=>p.y),original.layoutId+': exact height samples stay in descriptor');
  ok(e.geometry.distance>=430&&e.geometry.distance<=1540,original.layoutId+': random gap stays in the intended archery band');
  ok(Number.isInteger(e.geometry.recommendedPower)&&e.geometry.recommendedPower>=20&&e.geometry.recommendedPower<=100,original.layoutId+': recalibrated default draw remains legal');
  for(const [side,p]of ps.entries()){
   ok(p.x>=ARENA_LEFT+70&&p.x<=ARENA_RIGHT-70,original.layoutId+': random station retains true world retreat margin');
   ok(p.x>=70&&p.x<=1530,original.layoutId+': initial route markers remain in the combat-area preview');
   ok(Math.abs(p.x-original.xs[side])<=180,original.layoutId+': variation does not jump across the entire arena');
   ok(Math.abs(p.y-encounterGround(original.xs[side],e.terrain))<=65,original.layoutId+': height change stays controlled');
   for(const [x,,w]of e.cover)ok(Math.abs(p.x-x)>=w/2+85,original.layoutId+': cover never traps the starting stance');
   for(const offset of [-18,-9,0,9,18])ok(Math.abs((encounterGround(p.x+offset+3,e.terrain)-encounterGround(p.x+offset-3,e.terrain))/6)<=.9+1e-10,original.layoutId+': both feet avoid an abrupt steep bank');
   const pose=standingPose(p);
   near(pose.footBack.y+5,encounterGround(pose.footBack.x,e.terrain),original.layoutId+': back foot actually contacts varied ground');
   near(pose.footFront.y+5,encounterGround(pose.footFront.x,e.terrain),original.layoutId+': front foot actually contacts varied ground');
  }
  ranges.push(e.geometry.distance);heights.push(e.geometry.heightDelta);stations.add(e.xs.join(','));
 }
 ok(Math.max(...ranges)-Math.min(...ranges)>=180,original.layoutId+': repeated runs visibly vary range by at least180');
 ok(stations.size>=24,original.layoutId+': variation is richer than a small two-position toggle');
 ok(new Set(heights).size>=2,original.layoutId+': varied ground supplies real elevation changes too');
 eq(JSON.stringify(original),snapshot,original.layoutId+': randomization and grounded previews leave the source untouched');
 // Real integer shots through standing cover, in both directions. The helper
 // uses the actual launch/collision implementation rather than its own aim math.
 for(const seed of [0,1,2,7,31,63,199,202611]){
  const e=varyEncounter(original,seed);
  for(const side of [0,1])ok(usefulShot(e,side),`${original.layoutId}: seed${seed}, side${side} has a genuine non-head shot`);
 }
}
eq(ARENAS.map(a=>a.xs),originals,'all twelve authored starting references remain intact for tutorials and fixtures');
{
 const source=arenas[0],before=JSON.stringify(source),e=varyEncounter(source,123);
 e.preview.profile[0][1]+=12;e.terrain.profile[1][1]+=12;e.cover[0][0]+=12;e.xs[0]+=12;e.variation.originalXs[0]+=12;e.enemy.tip='changed';
 eq(JSON.stringify(source),before,'mutable variant arrays, metadata and enemy copy never alias their source');
}
{
 const originalRandom=Math.random;Math.random=()=>{throw Error('unexpected global randomness');};
 try{ok(varyEncounter(arenas[0],45).xs.length===2,'seeded variation does not consume combat or global randomness');}finally{Math.random=originalRandom;}
}
console.log(checks+' deterministic random-distance, grounded station, preview and real trajectory checks passed.');
