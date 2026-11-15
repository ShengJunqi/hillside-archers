import assert from 'node:assert/strict';
import {BODY_BONES,standingPose,bodyPose,bodyCollision,impactBody,updateBody,attachArrow,attachedArrowPose} from '../dist/body.mjs';
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;},eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
const make=(x=800,floor=()=>700)=>({x,homeX:x,y:floor(x),dir:-1,hp:100,stuck:[]});
const heights={head:96,body:60,arms:73,legs:25,feet:5};
const hit=(p,part='body',damage=26,direction=1,volleyId=null)=>impactBody(p,{point:{x:p.x,y:p.y-heights[part]},vx:direction*450,vy:30,damage,part,volleyId});
function settle(p,floor,options={}){let steps=0,peak=0,rotation=0,activeHeadSeen=false;while(p.body.active&&!p.body.sleeping&&steps++<700){updateBody(p,1/120,floor,1600,options);peak=Math.max(peak,floor(p.x)-p.y);const pose=bodyPose(p);rotation=Math.max(rotation,Math.abs(pose.head.x-pose.hip.x));activeHeadSeen ||= bodyCollision(pose.head,p)?.part==='head';}return{seconds:steps/120,peak,rotation,activeHeadSeen};}
const flat=()=>700;
const measured={};
for(const [part,damage]of [['body',26],['head',42],['arms',22],['legs',18],['feet',12]]){
 const p=make(),before=standingPose(p);hit(p,part,damage);const arrow=attachArrow(p,{x:p.x,y:p.y-heights[part]},.1,25);let separate=false;
 for(let i=0;i<24;i++){updateBody(p,1/120,flat);const pose=bodyPose(p);separate ||= Math.abs((pose.handFront.x-before.handFront.x)-(pose.footBack.x-before.footBack.x))>2;}
 const embedded=attachedArrowPose(arrow,bodyPose(p));ok(Number.isFinite(embedded.x)&&Math.abs(embedded.x-800)>5,part+' embedded arrow follows independently moving bone');
 const motion=settle(p,flat);measured[part]={distance:p.x-800,...motion};
 ok(separate,part+' drives distinct arm and leg motion');ok(motion.rotation>20,part+' has visible articulated lean or rotation');ok(motion.activeHeadSeen,part+' head capsule follows the visible ragdoll');
 ok(!p.body.active&&motion.seconds<2.1,part+' recovers without a stuck turn');eq(p.y,flat(p.x),part+' returns to the actual terrain');eq(p.homeX,p.x,part+' new station becomes the persistent recovery anchor');
 const station=JSON.stringify([p.x,p.y,p.homeX]);for(let i=0;i<240;i++)updateBody(p,1/120,flat);eq(JSON.stringify([p.x,p.y,p.homeX]),station,part+' never springs back to original spawn after recovery');
}
ok(measured.body.distance>=30&&measured.body.distance<=70,'ordinary body hit visibly shifts actual station 30–70px');ok(measured.head.distance>=65&&measured.head.distance<=120,'head hit has a materially larger 65–120px shove');ok(measured.head.peak>=25,'head contact visibly launches the body above the floor');ok(measured.head.distance>measured.body.distance*1.5,'part-specific feedback is not the same displacement for every hit');
for(const direction of [-1,1]){
 const p=make();hit(p,'head',42,direction);settle(p,flat);ok((p.x-800)*direction>65,'arrow direction determines knockback sign');
}
for(const slope of [-.65,-.35,.35,.65]){
 const floor=x=>700+(x-800)*slope,p=make(800,floor),health=p.hp;hit(p,'body',26);const motion=settle(p,floor);
 ok(p.x>810&&p.x<895,'inclined terrain keeps a visible bounded shove at slope '+slope);eq(p.y,floor(p.x),'slope '+slope+' recovery follows changed ground height');eq(p.hp,health,'slope sliding does not add unbudgeted damage');ok(motion.seconds<2,'slope '+slope+' recovery has bounded duration');
 const pose=standingPose(p);ok(Math.abs(pose.footFront.y-pose.footBack.y)>5,'standing feet adapt to different elevations at slope '+slope);
 if(slope>0)ok(p.y>700,'downhill shove really lowers station elevation');else ok(p.y<700,'uphill shove really raises station elevation');
}
{
 const down=make(),up=make();hit(down);hit(up);settle(down,x=>700+(x-800)*.35);settle(up,x=>700-(x-800)*.35);ok(down.x-up.x>10,'downhill sliding adds travel while uphill contact removes momentum');
}
{
 const p=make();hit(p,'head',42,1,'one-volley');settle(p,flat);const first=p.x;
 hit(p,'head',42,1,'one-volley');settle(p,flat);ok(p.x<=940.001&&p.x>first,'late extra arrow shares the same 140px volley envelope');
 const after=p.x;hit(p,'head',42,1,'next-volley');settle(p,flat);ok(p.x>after+60,'next volley can create a new meaningful station instead of a permanent spawn clamp');
}
{
 const p=make();hit(p,'head',42,1,'many');let samples=0;
 for(let i=0;i<800&&p.body.active;i++){if(i%18===0&&i<340)hit(p,'head',42,1,'many');updateBody(p,1/120,flat);ok(p.x>=660&&p.x<=940.001,'staggered multishot remains inside one displacement budget');samples++;}
 ok(samples<=400&&!p.body.active,'repeated arrows cannot keep a living body down indefinitely');eq(p.hp,100,'physical reactions do not change combat health');
}
for(const [x,direction]of [[60,-1],[1540,1]]){
 const p=make(x);for(let i=0;i<24;i++)hit(p,'head',100,direction,'edge');settle(p,flat);ok(p.x>=55&&p.x<=1545,'extreme repeated shove cannot push station off the world');for(const n of Object.values(p.body.nodes))ok(Number.isFinite(n.x)&&Number.isFinite(n.y)&&n.x>=10&&n.x<=1590,'edge joint stays finite and inside arena');
}
{
 const p=make();hit(p,'head',42);settle(p,flat,{minX:760,maxX:835});eq(p.x,835,'optional station bounds stop a player entering the opponent safety interval');
}
for(const state of ['standing','broken','fallen']){
 const p=make(),obstacle={x:875,y:700,w:42,h:120,state};hit(p,'head',42);settle(p,flat,{obstacles:[obstacle]});
 if(state==='standing')ok(p.x<=831.001,'standing cover blocks physical root displacement');else ok(p.x>865,'destroyed or fallen cover no longer blocks movement');
}
{
 const p={...make(60),hp:0};hit(p,'head',100,-1);settle(p,flat);ok(p.body.active&&p.body.sleeping,'defeated body keeps an articulated resting pose');
 const maxError=Math.max(...BODY_BONES.map(([a,b],i)=>Math.abs(Math.hypot(p.body.nodes[a].x-p.body.nodes[b].x,p.body.nodes[a].y-p.body.nodes[b].y)-p.body.lengths[i])));ok(maxError<5,'edge corpse retains connected limbs');const rest=JSON.stringify(p.body.nodes);updateBody(p,.1,flat);eq(JSON.stringify(p.body.nodes),rest,'sleeping corpse stops jittering');
}
// Force talents affect movement directly, independently of health damage.
{
 const react=scale=>{const p=make();const event={point:{x:800,y:640},vx:450,vy:30,damage:26,part:'body'};if(scale!==undefined)event.forceScale=scale;impactBody(p,event);const motion=settle(p,flat);return {p,motion,distance:p.x-800};};
 const original=react(),explicit=react(1),strong=react(1.2),stable=react(.7);
 eq(explicit.p,original.p,'explicit forceScale 1 exactly preserves default position and articulated state');
 ok(Math.abs(strong.distance/original.distance-1.2)<.001,'20% outgoing force really produces 20% more station displacement on level ground');
 ok(Math.abs(stable.distance/original.distance-.7)<.001,'30% stability reduces actual station displacement by 30%');
 eq([strong.p.hp,stable.p.hp],[100,100],'force scaling never substitutes health damage for the actual impulse');
 eq([strong.motion.seconds,stable.motion.seconds],[original.motion.seconds,original.motion.seconds],'force changes do not prolong recovery');
 eq(react(20).distance,react(1.75).distance,'extreme force is clamped at the supported upper multiplier');
 eq(react(-10).distance,react(.5).distance,'negative or tiny force is clamped at the supported lower multiplier');
 eq(react(NaN).p,original.p,'invalid force safely retains the normal reaction');
 const p=make();for(let i=0;i<24;i++)impactBody(p,{point:{x:p.x,y:p.y-96},vx:500,vy:30,damage:42,part:'head',forceScale:1.75,volleyId:'force-volley'});
 settle(p,flat);ok(p.x<=940.001,'strong multishot retains the same total volley displacement envelope');
 impactBody(p,{point:{x:p.x,y:p.y-96},vx:500,vy:30,damage:42,part:'head',forceScale:1.75,volleyId:'force-volley'});settle(p,flat);ok(p.x<=940.001,'late talent-enhanced arrow cannot reopen the same volley budget');
}
console.log(checks+' persistent-knockback, slope, rotation, cover and recovery checks passed.');
