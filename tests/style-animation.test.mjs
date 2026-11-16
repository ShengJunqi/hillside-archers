import assert from 'node:assert/strict';
import {Game,launch,position,ground} from '../dist/core.mjs';
import {standingPose} from '../dist/body.mjs';
import {EMOTES,emotePose,emoteMotion} from '../dist/emotes.mjs';
import {Renderer,aimGuidePoints} from '../dist/render.mjs';

let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;},eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
const snapshot=g=>JSON.stringify(g,(_key,value)=>typeof value==='function'?undefined:value instanceof Set?[...value]:value);
function canvas(){
 const calls=[],c=new Proxy({
  createLinearGradient:()=>({addColorStop(){}}),
  stroke(){calls.push({kind:'stroke',alpha:this.globalAlpha,width:this.lineWidth});},
  setLineDash(values){calls.push({kind:'dash',values});},
  fillText(text,x,y){calls.push({kind:'text',text,x,y});},
 },{get:(target,key)=>key in target?target[key]:()=>{}});
 return {width:1600,height:900,calls,getContext:()=>c,getBoundingClientRect:()=>({width:1600,height:900})};
}
const flat={bounds:{left:-1000,right:2600},shape:'profile',profile:[[-1000,700],[2600,700]]};
const p={x:700,y:700,dir:1,hp:100,characterId:'qingsong',stuck:[]},base=standingPose(p),beforePose=snapshot(base);
eq(EMOTES.map(e=>e.id),['bowspin','shadowstep','skycut'],'tap cycle offers three deliberate weapon flourishes');
for(const effect of EMOTES){
 ok(effect.duration>=.7&&effect.duration<=1.05,effect.id+' lasts a short cosmetic beat');
 const sampled=[];
 for(const fraction of [0,.15,.35,.55,.75,1]){
  const emote={kind:effect.id,duration:effect.duration,time:fraction*effect.duration},pose=emotePose(base,p,emote),motion=emoteMotion(emote);
  ok(Object.values(pose).every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)),effect.id+' has finite articulated nodes');
  ok(Object.values(pose).every(n=>Math.abs(n.x-p.x)<100&&Math.abs(n.y-p.y)<170),effect.id+' keeps cosmetic movement near the real archer');
  sampled.push(snapshot(pose));
  if(fraction===0||fraction===1)for(const key of Object.keys(base))ok(Math.hypot(pose[key].x-base[key].x,pose[key].y-base[key].y)<1e-6,effect.id+' returns cleanly to its real stance');
  const reduced=emotePose(base,p,emote,true),fixed=emotePose(base,p,{...emote,time:.41},true);
  eq(reduced,fixed,effect.id+' reduced-motion pose is static rather than a fast spin or jump');
  eq(emoteMotion(emote,true).bowTurn,0,effect.id+' reduced-motion bow does not rotate');
  if(effect.id==='bowspin'&&fraction===.75)ok(motion.bowTurn>5,'bow spin visibly completes almost one full revolution before catching');
 }
 ok(new Set(sampled).size>=4,effect.id+' uses changing whole-body articulation, not a repeated static gesture');
}
eq(snapshot(base),beforePose,'flourishes preserve the real source joints');
for(const dir of [-1,1]){
 const player={...p,dir},pose=standingPose(player);
 for(const e of EMOTES){const result=emotePose(pose,player,{kind:e.id,duration:e.duration,time:e.duration*.45});ok((result.handFront.x-player.x)*dir>0,'flourish mirrors its weapon hand with facing direction');}
}
// Physical arc length, rather than a fixed amount of flight time, bounds the
// ordinary aiming guide even at the new stronger full draw.
for(const power of [20,45,65,85,100])for(const angle of [5,15,31,55,75]){
 const shots=snapshot(p),points=aimGuidePoints(p,angle,power,flat),arrow=launch(p,angle,power);
 ok(points.length<=6,'ordinary guide never exceeds six points');
 let previous={x:arrow.x,y:arrow.y},travel=0;
 for(const point of points){travel+=Math.hypot(point.x-previous.x,point.y-previous.y);previous=point;ok(point.y<ground(point.x,flat),'guide stops before showing points through ground');}
 ok(travel<=144.001,'full guide stays within144worldunits of actual arc at power '+power+' angle '+angle);
 eq(snapshot(p),shots,'sampling launch guide does not modify an archer');
 const short=aimGuidePoints(p,angle,power,flat,80);ok(short.length<=6&&short.every(q=>Math.hypot(q.x-arrow.x,q.y-arrow.y)<=80.001),'portrait can request an even closer tangent guide');
}
{
 const low=aimGuidePoints(p,31,45,flat),full=aimGuidePoints(p,31,100,flat);
 eq([low.length,full.length],[6,6],'light and full draw both retain a readable six-dot direction cue');
 ok(Math.hypot(full.at(-1).x-(p.x+32),full.at(-1).y-(p.y-66))<145,'full pull no longer projects hundreds of units farther than light draw');
}
for(const [width,height]of [[1600,900],[390,740],[844,390]]){
 let random=0;const g=new Game({save:{unlocked:true},rng:()=>{random++;return .5;}});g.start('local',1);g.skip();g.aim(31,100);
 const cv=canvas(),r=new Renderer(cv);r.surfaceFactory=canvas;r.resize(width,height);
 const start=snapshot(g),count=random,preview=[];const original=r.circle.bind(r);r.circle=(x,y,radius,color)=>{if(color==='#20323abf')preview.push({x,y});original(x,y,radius,color);};
 r.draw(g,0);eq(preview.length,6,'ordinary full-draw guide actually draws six nearby points');preview.length=0;
 for(const e of EMOTES){
  ok(r.playEmote(g),'tap starts '+e.id+' in a normal aiming turn');eq(r.emote.kind,e.id,'tap cycles to the intended flourish');
  r.draw(g,e.duration*.4);ok(r.emoteAccents(g.players[0],emotePose(standingPose(g.players[0]),g.players[0],r.emote),r.emote)>0,'flourish emits bounded local accents');
  r.draw(g,e.duration+.1);eq(r.emote,null,'flourish ends without waiting on combat');
 }
 ok(preview.length<=6*6,'ordinary rendered guide obeys the per-frame six-dot bound');
 eq(snapshot(g),start,'desktop/phone cosmetic flourishes never change gameplay, save or collisions');eq(random,count,'desktop/phone flourishes never consume combat randomness');
 r.playEmote(g);r.draw(g,.1,{drag:{screenScale:1,screenX:100,screenY:100,cancelRadius:40,inside:true}});eq(r.emote,null,'starting a real charge immediately replaces the pose flourish');
 r.reducedMotion=true;r.playEmote(g);eq(r.emote.duration,.55,'reduced-motion gesture is brief');
 const emote={...r.emote,time:.2},pose=emotePose(standingPose(g.players[0]),g.players[0],emote,true);cv.calls.length=0;eq(r.emoteAccents(g.players[0],pose,emote),2,'reduced-motion flourish draws only static foot ticks');
 const strokes=cv.calls.filter(call=>call.kind==='stroke');cv.calls.length=0;r.time+=1;eq(r.emoteAccents(g.players[0],pose,{...emote,time:.4}),2,'reduced-motion tick count stays fixed');eq(cv.calls.filter(call=>call.kind==='stroke'),strokes,'reduced-motion accent does not scroll or pulse');
}
{
 const g=new Game({save:{unlocked:true},rng:()=>.5});g.start('duel');g.skip();g.active=1;g.phase='thinking';g.shoot();
 const cv=canvas(),r=new Renderer(cv);r.surfaceFactory=canvas;Object.defineProperty(g,'timeScale',{value:1.7,configurable:true});const initial=r.time;r.draw(g,.02);
 ok(Math.abs(r.time-initial-.034)<1e-9,'NPC flight visual clock respects the faster simulation rate');
 const frozen=r.time;r.draw(g,.2,{paused:true});eq(r.time,frozen,'pause still freezes accelerated NPC decorations');
}
{
 const g=new Game({save:{unlocked:true},rng:()=>.5});g.start('rogue',1,'dive');g.skip();g.shoot();g.update(.05);g.update(.05);g.update(.05);Object.assign(g.arrows[0],{x:g.players[1].x,y:g.players[1].y-360,vx:0,vy:0,t:.2});g.beginSkillAim();
 const cv=canvas(),r=new Renderer(cv),prediction=r.skillPreview(g);ok(prediction.length>0&&prediction[0].points.length>6,'manual star-dive preview retains its full useful landing line');
}
console.log(checks+' stylish-emote, bounded-charge-preview, reduced-motion and NPC-clock checks passed.');
