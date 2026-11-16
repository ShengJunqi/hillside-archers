import assert from 'node:assert/strict';
import {Game} from '../dist/core.mjs';
import {Renderer} from '../dist/render.mjs';
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;},eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
const snapshot=g=>JSON.stringify(g,(_key,v)=>typeof v==='function'?undefined:v instanceof Set?[...v]:v);
function canvas(){
 const calls=[],c=new Proxy({
  createLinearGradient:()=>({addColorStop(){}}),
  fillText(text,x,y){calls.push({kind:'text',text,x,y});},
  stroke(){calls.push({kind:'stroke',color:this.strokeStyle,width:this.lineWidth});},
  fill(){calls.push({kind:'fill',color:this.fillStyle});},
  fillRect(x,y,w,h){calls.push({kind:'rect',x,y,w,h});},
  arc(x,y,r,start,end){calls.push({kind:'arc',x,y,r,start,end});},
  setLineDash(dash){calls.push({kind:'dash',dash:dash.slice()});},
  translate(x,y){calls.push({kind:'translate',x,y});},
  moveTo(x,y){calls.push({kind:'move',x,y});},lineTo(x,y){calls.push({kind:'line',x,y});},
 },{get:(target,key)=>key in target?target[key]:()=>{}});
 return {width:1600,height:900,calls,getContext:()=>c};
}
let randomCalls=0;
function triggered(){
 const g=new Game({save:{unlocked:true},rng:()=>{randomCalls++;return .5;}});g.start('rogue',1,'dive');g.skip();g.obs=[];
 Object.assign(g.stats,{echo:3,fuse:1,fire:1,poison:1,reclaim:1});g.players[1].hp=1000;g.players[1].stats.maxHp=1000;
 g.shoot();const b=g.arrows[0],p=g.players[1];Object.assign(b,{x:p.x,y:p.y-330,vx:0,vy:0,t:.2});g.activateSkill();
 Object.assign(p.status,{burn:2,burnTurns:2,poison:3,poisonTurns:3});g.hitTarget(b,{part:'head',damage:42},{x:p.x,y:p.y-96});
 for(const arrow of g.arrows.filter(b=>b.echo))arrow.t=.1;
 return g;
}
{
 const g=triggered(),cv=canvas(),r=new Renderer(cv),before=snapshot(g),calls=randomCalls;
 eq(g.arrows.filter(b=>b.echo).length,3,'fixture summons actual three phantom arrows');r.arrowEffects(g);
 ok(cv.calls.some(v=>v.kind==='stroke'&&v.color==='#d3b6ff'),'actual echo arrows receive violet trails');ok(cv.calls.some(v=>v.kind==='dash'&&v.dash[0]===8),'echo wake is broken into a distinct feather-like guide');
 ok(cv.calls.some(v=>v.kind==='stroke'&&v.color==='#f2e8ff'),'phantom shaft has a bright hollow feather outline');eq(snapshot(g),before,'drawing phantom arrows never triggers another echo, changes damage or spends ammunition');eq(randomCalls,calls,'phantom art consumes no combat randomness');
 for(const kind of ['echo','fuse','ammo'])ok(g.vfx.some(f=>f.kind===kind),'actual combat emits '+kind+' feedback');
 r.observeVisuals(g,0);const feedback=JSON.stringify(r.feedback);cv.calls.length=0;r.particles(g);eq(JSON.stringify(r.feedback),feedback,'relic particles never add camera-shake impulses');
 ok(cv.calls.some(v=>v.kind==='stroke'&&v.color==='#d0b9ff'),'echo event draws local violet feather cues');
 ok(cv.calls.some(v=>v.kind==='stroke'&&v.color==='#f2a15f')&&cv.calls.some(v=>v.kind==='stroke'&&v.color==='#b6d77b'),'fuse links distinct fire and poison colored rings');
 ok(cv.calls.some(v=>v.kind==='text'&&v.text==='+1'),'real headshot refund draws one local ammunition badge');eq(snapshot(g),before,'fuse and refund feedback preserve all combat and run state');
}
for(const kind of ['echo','fuse','ammo']){
 const cv=canvas(),r=new Renderer(cv),f={kind,x:600,y:500,amount:1};r.reducedMotion=true;
 r.relicEffect(f,.1);const first=cv.calls.slice();cv.calls.length=0;r.relicEffect(f,.7);eq(cv.calls,first,'reduced '+kind+' keeps static geometry without rising, rotating or growing');
 ok(first.filter(v=>v.kind==='stroke').length<=9,'reduced '+kind+' uses a small bounded icon');
 ok(!first.some(v=>v.kind==='rect'&&(v.w>70||v.h>70)),'reduced '+kind+' never draws a large flash');
}
{
 const g=triggered(),cv=canvas(),r=new Renderer(cv);r.observeVisuals(g,0);r.comicLabel=null;r.release=null;
 g.vfx=Array.from({length:80},(_,i)=>({kind:['echo','fuse','ammo'][i%3],x:i*5,y:500,t:.5,life:.7,amount:1}));
 let painted=0;const original=r.relicEffect.bind(r);r.relicEffect=(...args)=>{const result=original(...args);if(result)painted++;return result;};
 r.particles(g);eq(painted,18,'normal mode retains the existing18-effect display bound');ok(cv.calls.filter(v=>v.kind==='stroke').length<200,'80 queued effects cannot create an unbounded relic geometry burst');
 r.reducedMotion=true;painted=0;cv.calls.length=0;r.particles(g);eq(painted,6,'reduced motion retains the six-effect display bound');
 ok(cv.calls.filter(v=>v.kind==='arc').every(v=>v.r<50),'all relic rings stay local in reduced mode');
}
{
 const g=triggered(),r=new Renderer(canvas());r.observeVisuals(g,0);g.vfx=g.vfx.filter(f=>['echo','fuse','ammo'].includes(f.kind));r.feedback.reset();
 const baseline=JSON.stringify(r.feedback);r.observeVisuals(g,0);eq(JSON.stringify(r.feedback),baseline,'new relic-only events do not restart or strengthen camera feedback');
 const before=g.vfx.filter(f=>f.kind==='ammo').length;g.gainSpecialAmmo(1,'stage');eq(g.vfx.filter(f=>f.kind==='ammo').length,before,'new-floor ammunition fill has no combat refund icon');
}
for(const [width,height]of [[390,740],[844,390],[1600,900]]){
 const g=triggered(),cv=canvas(),r=new Renderer(cv);r.resize(width,height);r.surfaceFactory=canvas;const before=snapshot(g),calls=randomCalls;r.draw(g,1/60);
 eq(snapshot(g),before,'full relic draw preserves run state at '+width+'×'+height);eq(randomCalls,calls,'full relic draw consumes no RNG at '+width+'×'+height);
 ok(cv.calls.filter(v=>v.kind==='arc').every(v=>[v.x,v.y,v.r].every(Number.isFinite)),'relic geometry stays finite after phone/desktop resize');
}
console.log(checks+' relic-arrow, fuse, refund, effect-bound, reduced-motion and rendering-purity checks passed.');
