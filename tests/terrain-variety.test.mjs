import assert from 'node:assert/strict';
import {ARENAS,arenaBounds,encounterFor,encounterRoutes,encounterGround,encounterObstacles} from '../dist/encounters.mjs';
import {launch,position,collision} from '../dist/core.mjs';

let checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(value,expected,message)=>{assert.deepEqual(value,expected,message);checks++;};
// Deliberately use the real launch and collision functions, including power,
// rather than relying on the AI planner or the descriptor's own preview data.
function shot(p,target,angle,power,obs,terrain){
 const arrow=launch(p,angle,power);
 for(let t=1/240;t<12;t+=1/240){const hit=collision(position(arrow,t),target,obs,terrain);if(hit)return hit;}
 return {kind:'miss'};
}
function playersFor(e,delta=0,mode='both'){
 return e.xs.map((x,side)=>{
  const moved=mode==='both'||mode===(side===0?'left':'right');
  if(moved)x+=side===0?-delta:delta;
  const bounds=arenaBounds(e.terrain);x=Math.max(bounds.left+55,Math.min(bounds.right-55,x));
  return {x,y:encounterGround(x,e.terrain),dir:side===0?1:-1};
 });
}
function bodyWindow(e,side,{delta=0,mode='both',powers=Array.from({length:17},(_,i)=>100-i*5)}={}){
 const ps=playersFor(e,delta,mode),obs=encounterObstacles(e,x=>encounterGround(x,e.terrain));
 for(const power of powers)for(let angle=5;angle<=75;angle++){
  const hit=shot(ps[side],ps[1-side],angle,power,obs,e.terrain);
  if(hit.kind==='hit'&&hit.part!=='head')return {angle,power,part:hit.part};
 }
 return null;
}

ok(ARENAS.length>=12,'second pass offers at least twelve physical layouts');
for(const id of ['yard','bowl','dock','ridge','market','bridge','signs','festival'])ok(ARENAS.some(a=>a.id===id),'existing route identity retained: '+id);
const arenas=Array.from({length:ARENAS.length},(_,i)=>encounterFor(0,i+1));
eq(new Set(arenas.map(e=>e.layoutId)).size,ARENAS.length,'one cycle visits every authored terrain');
const distances=arenas.map(e=>e.geometry.distance),elevations=arenas.map(e=>e.geometry.heightDelta);
ok(Math.min(...distances)<=560&&Math.max(...distances)>=1320,'near and far arenas differ substantially in range');
ok(Math.max(...distances)-Math.min(...distances)>=800,'distance variation spans at least eight hundred world units');
ok(new Set(distances).size>=10,'range variation is more than a two-distance rotation');
ok(Math.max(...elevations)>=200&&Math.min(...elevations)<=-200,'both attacking uphill and attacking downhill exist');
ok(new Set(elevations.map(Math.abs)).size>=5,'elevation is not the same mild slope in every arena');

for(const e of arenas){
 const profile=e.terrain.profile,ps=playersFor(e),obs=encounterObstacles(e,x=>encounterGround(x,e.terrain));
 eq(e.geometry.distance,ps[1].x-ps[0].x,e.layoutId+': advertised range is physical station separation');
 eq(e.geometry.heightDelta,Math.round(ps[0].y-ps[1].y),e.layoutId+': advertised elevation is the actual ground difference');
 eq([e.geometry.leftY,e.geometry.rightY],ps.map(p=>p.y),e.layoutId+': preview heights match the collision surface');
 eq(e.preview.profile,profile,e.layoutId+': preview samples the real physical profile');
 ok(e.geometry.relief>=45,e.layoutId+': shape has visible vertical relief');
 let lo=Infinity,hi=-Infinity,maxStep=0;
 for(let x=0;x<=1600;x++){
  const y=encounterGround(x,e.terrain);lo=Math.min(lo,y);hi=Math.max(hi,y);
  if(x)maxStep=Math.max(maxStep,Math.abs(y-encounterGround(x-1,e.terrain)));
 }
 ok(lo>=430&&hi<=780,e.layoutId+': terrain stays in the visible world height envelope');
 ok(maxStep<2.2,e.layoutId+': no vertical discontinuity or instant cliff wall');
 eq(encounterGround(arenaBounds(e.terrain).left-120,e.terrain),profile[0][1],e.layoutId+': left edge is stable outside the world');
 eq(encounterGround(arenaBounds(e.terrain).right+120,e.terrain),profile.at(-1)[1],e.layoutId+': right edge is stable outside the world');
 for(const [side,p]of ps.entries()){
  ok(p.x>=110&&p.x<=1490,e.layoutId+': initial station has a world-edge recovery margin');
  ok(Math.abs(encounterGround(p.x-30,e.terrain)-p.y)<.001&&Math.abs(encounterGround(p.x+30,e.terrain)-p.y)<.001,e.layoutId+': initial stance is on a stable shelf');
  ok(bodyWindow(e,side),e.layoutId+': both players retain a legal integer angle/power body/limb shot through real cover');
  ok(bodyWindow(e,side,{powers:[e.geometry.recommendedPower]}),e.layoutId+': suggested power has a real non-head window');
  for(const o of obs)ok(Math.abs(o.x-p.x)>80+o.w/2,e.layoutId+': solid cover does not trap the starting character');
 }
 // A persistent retreat cannot leave a shorter-range bow unable to reach the
 // other platform; test one or both fighters displaced, with real terrain.
 for(const delta of [80,120,200])for(const mode of ['left','right','both'])for(let side=0;side<2;side++){
  ok(bodyWindow(e,side,{delta,mode,powers:Array.from({length:17},(_,i)=>100-i*5)}),`${e.layoutId}: ${mode} knockback ${delta}, side ${side}, still has a body/limb shot`);
 }
}
const byId=Object.fromEntries(arenas.map(e=>[e.layoutId,e]));
ok(bodyWindow(byId.ridge,0,{powers:[65]}).angle-bodyWindow(byId.ridge,1,{powers:[65]}).angle>=15,'uphill and downhill combat demand materially different angles');
ok(bodyWindow(byId.dock,0,{powers:[65]}).angle-bodyWindow(byId.yard,0,{powers:[65]}).angle>=10,'close and distant arenas cannot reuse the same low-arc aim');
{
 const e=encounterFor(42,1),original=e.terrain.profile[0][1];e.preview.profile[0][1]+=10;
 eq(e.terrain.profile[0][1],original,'UI preview cannot mutate terrain through a shared profile array');
 e.terrain.profile[0][1]+=10;eq(encounterFor(42,1).terrain.profile[0][1],original,'encounter instance cannot change the authored arena or future run');
}
for(const seed of [0,7,42,202611]){
 let previous='';const bosses=new Set();
 for(let floor=1;floor<=36;floor++){
  const routes=encounterRoutes(seed,floor,previous),[a,b]=routes;
  eq(routes,encounterRoutes(seed,floor,previous),'seeded route previews are repeatable');
  ok(a.layoutId!==b.layoutId&&routes.every(e=>e.layoutId!==previous),'tickets are different and do not repeat the previous arena');
  ok(Math.abs(a.geometry.distance-b.geometry.distance)>=180||Math.abs(a.geometry.heightDelta-b.geometry.heightDelta)>=90,'alternate route changes range or elevation enough to change the shot');
  if(floor%3===0)bosses.add(a.map);previous=a.layoutId;
 }
 eq(bosses.size,3,'bosses continue to visit all three biomes');
}
console.log(checks+' terrain range, elevation, power, post-knockback reachability and route-diversity checks passed.');
