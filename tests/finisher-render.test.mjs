import assert from 'node:assert/strict';
import {Game,launch} from '../dist/core.mjs';
import {Renderer} from '../dist/render.mjs';
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;},eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
const snapshot=g=>JSON.stringify(g,(_key,value)=>typeof value==='function'?undefined:value instanceof Set?[...value]:value);
function canvas(width=1600,height=900){
 const calls=[],context=new Proxy({
  createLinearGradient:()=>({addColorStop(){}}),
  fillText(text,x,y){calls.push({kind:'text',text,x,y,color:this.fillStyle});},
  fillRect(x,y,w,h){calls.push({kind:'rect',x,y,w,h,color:this.fillStyle});},
  stroke(){calls.push({kind:'stroke',color:this.strokeStyle});},
  fill(){calls.push({kind:'fill',color:this.fillStyle});},
  translate(x,y){calls.push({kind:'translate',x,y});},rotate(angle){calls.push({kind:'rotate',angle});},scale(x,y){calls.push({kind:'scale',x,y});}
 },{get:(target,key)=>key in target?target[key]:()=>{}});
 return {width,height,calls,context,getContext:()=>context,getBoundingClientRect:()=>({width,height})};
}
function defeated({part='head',element='plain',side=1,age=.22}={}){
 const g=new Game({save:{unlocked:true},rng:()=>.5});g.start('local',4);g.phase='settle';g.phaseTime=.2;g.players[side].hp=0;
 g.finisher={side,part,element,age,duration:1.35,x:g.players[side].x,y:g.players[side].y-60,dir:side?1:-1,arrows:1,cause:'arrow'};return g;
}
{
 const cv=canvas(),r=new Renderer(cv),g=new Game({save:{unlocked:true}});g.start('local');g.skip();
 eq(r.finisherWorld(g),false,'ordinary aiming does not produce world KO');eq(r.finisherScreen(g),false,'ordinary aiming does not produce a KO badge');
 g.finisher={side:1,part:'head',element:'fire',age:0,duration:1.35};eq(r.finisherFrame(g),null,'metadata on a living opponent cannot fake a finisher');
}
for(const element of ['plain','fire','ice','poison','melt','venomfire'])for(const part of ['head','body','arms','legs','feet']){
 const g=defeated({element,part}),cv=canvas(),r=new Renderer(cv),before=snapshot(g);
 ok(r.finisherWorld(g),'actual defeated target receives local '+element+' '+part+' accent');ok(r.finisherScreen(g),'actual defeated target receives one badge');
 eq(cv.calls.filter(c=>c.kind==='text'&&c.text==='K.O.').length,1,'one KO label per render despite multi-effect styling');
 const expected=element==='plain'?(part==='head'?'爆头收尾':['legs','feet'].includes(part)?'扫腿收尾':'翻倒收尾'):{fire:'焰羽收尾',ice:'冰霜收尾',poison:'青毒收尾',melt:'融爆收尾',venomfire:'毒焰收尾'}[element];
 ok(cv.calls.some(c=>c.kind==='text'&&c.text===expected),'caption reflects actual element and contact');
 ok(cv.calls.filter(c=>c.kind==='fill').length<=30,'finisher keeps a bounded local geometry count');eq(snapshot(g),before,'finisher rendering never modifies health, ragdoll, game or save data');
}
{
 const g=defeated(),cv=canvas(),r=new Renderer(cv);g.finisher.arrows=24;r.finisherScreen(g);eq(cv.calls.filter(c=>c.kind==='text'&&c.text==='K.O.').length,1,'24-arrow volley still has only one finisher badge');
 ok(cv.calls.some(c=>c.kind==='text'&&c.text.includes('箭雨')),'multishot is an annotation rather than repeated KO effects');
 cv.calls.length=0;g.finisher.cause='status';g.finisher.arrows=0;r.finisherScreen(g);ok(cv.calls.some(c=>c.kind==='text'&&c.text.includes('元素收尾')),'status death is not falsely described as another arrow');
}
{
 const g=defeated(),cv=canvas(),r=new Renderer(cv);r.reducedMotion=true;r.finisherScreen(g);const first=cv.calls.slice();
 cv.calls.length=0;g.finisher.age=.65;r.finisherScreen(g);eq(cv.calls,first,'reduced-motion badge keeps a static pose and size');
 eq(cv.calls.filter(c=>c.kind==='rotate').length,0,'reduced-motion badge never rotates');
 g.finisher.age=.2;cv.calls.length=0;r.finisherWorld(g);eq(cv.calls.filter(c=>c.kind==='stroke').length,3,'reduced motion adds only three static local ticks');
}
for(const [width,height]of[[320,480],[390,740],[844,300],[1600,900],[1920,1080]])for(const side of[0,1]){
 const cv=canvas(width,height),r=new Renderer(cv),g=defeated({side});r.resize(width,height);r.cam={x:side?200:1400,y:900,z:1.5};const layout=r.finisherScreen(g),unit=layout.unit;
 ok(layout.x-layout.width/2>=10*unit&&layout.x+layout.width/2<=r.canvas.width-10*unit,'badge stays horizontally inside '+width+'px view');
 ok(layout.y-layout.height/2>=95*unit,'badge stays below HUD zone at '+width+'px');
 ok(layout.y+layout.height/2<=r.canvas.height-70*unit,'badge leaves the bottom controls clear at '+width+'px');
}
{
 const g=defeated(),cv=canvas(),r=new Renderer(cv);for(const phase of ['home','intro','scout','aim','upgrade','loadout']){g.phase=phase;eq(r.finisherScreen(g),false,'old finisher does not leak into '+phase);}
 g.phase='victory';g.phaseTime=.8;eq(r.finisherScreen(g),false,'result buttons are not covered after result card reveal');
 g.phase='settle';g.finisher.age=1.35;eq(r.finisherScreen(g),false,'expired finisher stops drawing');
 g.finisher.age=-.1;eq(r.finisherWorld(g),false,'negative timing cannot draw invalid local geometry');
 g.finisher.age=.2;g.finisher.side=99;eq(r.finisherScreen(g),false,'invalid target is ignored safely');
}
{
 let rngCalls=0;const g=new Game({save:{unlocked:true},rng:()=>{rngCalls++;return .5;}});g.start('local',3);g.phase='flight';g.players[1].hp=1;const p=g.players[1];g.hitTarget({...launch(g.players[0],30),t:.2},{part:'head',damage:42},{x:p.x,y:p.y-96});
 g.finisher={side:1,part:'head',element:'plain',age:.2,duration:1.35,x:p.x,y:p.y-96,dir:1,arrows:1,cause:'arrow'};
 const cv=canvas(),r=new Renderer(cv);r.surfaceFactory=canvas;const before=snapshot(g),calls=rngCalls;r.draw(g,.016);
 ok(cv.calls.some(c=>c.kind==='text'&&c.text==='K.O.'),'full game draw actually invokes the finisher badge');ok(!cv.calls.some(c=>c.kind==='text'&&c.text==='好头！'),'finisher replaces the ordinary comic shout rather than piling labels');ok(!cv.calls.some(c=>c.kind==='text'&&/−[0-9]/.test(c.text)),'fatal damage number does not crowd the finisher badge');eq(snapshot(g),before,'integrated finisher draw preserves the complete game');eq(rngCalls,calls,'integrated finisher draw never consumes combat RNG');
 const age=g.finisher.age,time=r.time;cv.calls.length=0;r.draw(g,.5,{paused:true});const frozen=cv.calls.slice();cv.calls.length=0;r.draw(g,.5,{paused:true});eq(JSON.stringify(cv.calls),JSON.stringify(frozen),'pause leaves the finisher screen frozen');eq(g.finisher.age,age,'render never advances the game-owned finisher clock');eq(r.time,time,'pause also freezes decorative renderer time');
}
{
 const g=defeated({side:0}),cv=canvas(),r=new Renderer(cv);g.phase='home';const before=snapshot(g),portraits=[];r.character=(p,side)=>portraits.push({hp:p.hp,body:p.body,side});r.cinematic(g);
 ok(portraits.some(p=>p.side===0&&p.hp>0&&p.body===null),'home preview uses a healthy scene copy instead of X eyes');eq(snapshot(g),before,'healthy home preview does not revive the actual player');
}
{
 const capture=(contact,scale=1)=>{
  const cv=canvas(),r=new Renderer(cv),p={x:400,y:650,dir:1,hp:100,characterId:'qingsong',body:null,stuck:[],groundContact:contact},before=JSON.stringify(p);let shadow;
  const circle=r.circle.bind(r);r.circle=(x,y,radius,color)=>{if(!shadow){const position=cv.calls.filter(c=>c.kind==='translate').at(-1);shadow={position,opacity:r.c.globalAlpha,radius};}return circle(x,y,radius,color);};r.character(p,0,{time:0,scale});eq(JSON.stringify(p),before,'drawing a ground shadow never changes character or contact data');return {shadow,calls:cv.calls};
 };
 const grounded=capture({x:400,y:650}).shadow,airborne=capture({x:400,y:700},2);
 eq(airborne.shadow.position,{kind:'translate',x:400,y:699},'airborne shadow stays on sampled terrain rather than flying with root');
 ok(airborne.shadow.opacity<grounded.opacity&&airborne.shadow.radius<grounded.radius,'shadow fades and narrows as root rises above the floor');
 ok(airborne.calls.some(c=>c.kind==='scale'&&c.x===2&&c.y===2),'character portrait scaling is preserved around the ground shadow');
 for(const contact of[undefined,{x:420,y:700},{x:400,y:NaN}])eq(capture(contact).shadow.position,{kind:'translate',x:400,y:649},'missing or stale scene contact falls back safely to copied root');
}
console.log(checks+' finisher rendering, element captions, HUD safety, reduced-motion and state-isolation checks passed.');
