import assert from 'node:assert/strict';
import {Game,position} from '../dist/core.mjs';
import {Renderer} from '../dist/render.mjs';
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;},eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
const snapshot=g=>JSON.stringify(g,(_key,v)=>typeof v==='function'?undefined:v instanceof Set?[...v]:v);
function canvas(){
 const calls=[],c=new Proxy({
  createLinearGradient:()=>({addColorStop(){}}),
  fillText(text,x,y){calls.push({kind:'text',text,x,y});},
  stroke(){calls.push({kind:'stroke',color:this.strokeStyle,width:this.lineWidth,offset:this.lineDashOffset});},
  fill(){calls.push({kind:'fill',color:this.fillStyle});},
  arc(x,y,r){calls.push({kind:'arc',x,y,r});},
  setLineDash(dash){calls.push({kind:'dash',dash:dash.slice()});},
  translate(x,y){calls.push({kind:'translate',x,y});},
  rotate(angle){calls.push({kind:'rotate',angle});},
 },{get:(target,key)=>key in target?target[key]:()=>{}});
 return {width:1600,height:900,calls,getContext:()=>c};
}
function flying(skill='dive'){
 const g=new Game({save:{unlocked:true},rng:()=>.5});g.start('rogue',1,skill);g.skip();g.obs=[];g.shoot();const p=g.players[1];
 Object.assign(g.arrows[0],{x:p.x-50,y:p.y-330,vx:250,vy:-80,t:.2});return g;
}
{
 const g=flying(),cv=canvas(),r=new Renderer(cv);r.surfaceFactory=canvas;
 eq(r.skillPreview(g),[],'ordinary flight does not show a forced fall path');
 ok(g.beginSkillAim(),'actual game enters hold-to-aim');const before=snapshot(g),preview=r.skillPreview(g);
 eq(preview.length,1,'active hold obtains the actual predicted projectile');eq(preview[0].hit?.part,'head','fixture really predicts a head contact');
 eq(r.skillAimPreview(g,preview),1,'predicted fall is rendered once');ok(cv.calls.some(v=>v.kind==='text'&&v.text==='头部'),'landing marker identifies actual head collision');
 ok(cv.calls.some(v=>v.kind==='dash'&&v.dash.length===2),'fall prediction uses a distinct dashed guide');eq(snapshot(g),before,'preview camera and drawing never modify health, projectiles, physics or save');
 const b=g.arrows[0];ok(g.releaseSkillAim(),'actual release activates the dive');eq(r.skillPreview(g),[],'release removes the guide immediately');
 cv.calls.length=0;r.arrowEffects(g);ok(b.diving&&cv.calls.some(v=>v.kind==='stroke'&&v.color==='#9ce8ff'),'released diving arrow gets a bright blue trail');ok(cv.calls.some(v=>v.kind==='fill'&&v.color==='#e3faff'),'released arrow gets a local star accent');
}
for(const tilt of [-35,0,35])for(const [width,height]of [[390,740],[844,390],[1600,900]]){
 const g=flying();g.beginSkillAim();g.aimSkill(tilt);const cv=canvas(),r=new Renderer(cv);r.surfaceFactory=canvas;r.resize(width,height);
 const before=snapshot(g),preview=r.skillPreview(g);r.draw(g,1/60);
 const from=position(g.arrows[0],g.arrows[0].t),to=preview[0].end;
 for(const p of [from,to]){const x=cv.width/2+(p.x-r.cam.x)*r.cam.z,y=cv.height+(p.y-r.cam.y)*r.cam.z;ok(x>=12&&x<=cv.width-12,'hold camera frames arrow and landing horizontally '+width+' tilt'+tilt);ok(y>=cv.height*.13&&y<=cv.height*.86,'hold camera keeps both points away from HUD and bottom buttons '+width+' tilt'+tilt);}
 eq(snapshot(g),before,'actual hold draw preserves the game at '+width+' tilt'+tilt);
}
{
 const g=flying(),cv=canvas(),r=new Renderer(cv);r.surfaceFactory=canvas;r.draw(g,.016);const old={...r.cam};g.beginSkillAim();const plan=r.cameraPlan(g);r.draw(g,.016);
 ok(Math.abs(r.cam.y-old.y)<Math.abs(plan.y-old.y),'entering hold eases the camera instead of snapping to the landing');
 const before=r.time;r.draw(g,.06);ok(Math.abs(r.time-before-.02)<1e-10,'decorative animation follows the actual one-third aiming time scale');
 const frozen=r.time;r.draw(g,.06,{paused:true});eq(r.time,frozen,'pause freezes the aiming decoration clock');
 r.reducedMotion=true;cv.calls.length=0;r.skillAimPreview(g);const first=cv.calls.filter(v=>v.kind==='stroke');r.time+=1;cv.calls.length=0;r.skillAimPreview(g);eq(cv.calls.filter(v=>v.kind==='stroke'),first,'reduced-motion fall guide has no scrolling dash or pulsing marker');
}
{
 const g=flying('burst'),cv=canvas(),r=new Renderer(cv);const before=snapshot(g);r.arrowEffects(g);
 ok(g.arrows[0].bomb,'actual burst arrow initially carries a bomb');ok(cv.calls.some(v=>v.kind==='arc'&&v.x===-11&&v.y===7&&v.r===8),'bomb is attached to the moving arrow shaft');
 ok(cv.calls.some(v=>v.kind==='stroke'&&v.color==='#e2c27f'),'attached bomb has a visible short fuse');eq(snapshot(g),before,'tied bomb art is visual only');
 ok(g.activateSkill(),'actual burst skill detonates and boosts');const boosted=snapshot(g);cv.calls.length=0;r.arrowEffects(g);
 ok(g.arrows[0].boosted&&!g.arrows[0].bomb,'actual boosted arrow has consumed its bomb');ok(!cv.calls.some(v=>v.kind==='arc'&&v.x===-11&&v.r===8),'consumed bomb is not drawn again');
 ok(cv.calls.some(v=>v.kind==='fill'&&v.color==='#f28e46bb'),'boosted arrow shows a short engine jet');ok(cv.calls.some(v=>v.kind==='stroke'&&v.color==='#ffd185'),'boosted arrow has a distinct warm trail');eq(snapshot(g),boosted,'boost trail does not change the doubled projectile');
}
{
 const g=flying(),cv=canvas(),r=new Renderer(cv);r.surfaceFactory=canvas;for(let i=1;i<24;i++)g.addArrow({...g.arrows[0],id:undefined,x:g.arrows[0].x+i});g.beginSkillAim();
 const before=snapshot(g),preview=r.skillPreview(g);eq(preview.length,8,'24-arrow aiming draws at most eight representative paths');eq(r.skillAimPreview(g,preview),8,'rendered path count stays bounded');
 eq(cv.calls.filter(v=>v.kind==='text').length,1,'multi-arrow preview labels only its representative landing');eq(snapshot(g),before,'large aiming preview never consumes arrows or rewards');
 let calls=0;const original=g.previewSkill.bind(g);g.previewSkill=()=>{calls++;return original();};r.draw(g,.016);eq(calls,1,'one draw calculates exact preview only once for both camera and guide');
}
{
 const g=flying('burst'),cv=canvas(),r=new Renderer(cv);r.observeVisuals(g,0);const feedback=JSON.stringify(r.feedback);g.vfx=[{kind:'ricochet',x:900,y:650,color:'#ffcd84',life:.4,t:.3}];
 r.observeVisuals(g,0);eq(JSON.stringify(r.feedback),feedback,'ricochet sparks never add another screen-shake impulse');r.particles(g);ok(cv.calls.some(v=>v.kind==='stroke'&&v.color==='#ffcd84'),'ricochet event draws a local impact arc');
 r.reducedMotion=true;cv.calls.length=0;r.particles(g);ok(cv.calls.filter(v=>v.kind==='stroke').length<=4,'reduced ricochet feedback stays small and local');
}
{
 const g=flying('burst'),p=g.players[1],b=g.arrows[0],r=new Renderer(canvas());
 Object.assign(b,{x:p.x-20,y:p.y-65,vx:260,vy:0,t:.2});g.activateSkill();
 ok(g.vfx.some(f=>f.kind==='impact'&&f.blast),'actual proximity blast emits a marked impact');r.observeVisuals(g,0);eq(r.hitFocus,null,'blast-only damage leaves the camera following the boosted arrow');
 g.fx('impact',p.x,p.y-60,'#f4ecdd',{part:'body',blast:false});r.observeVisuals(g,0);ok(r.hitFocus?.side===1,'later physical arrow contact still focuses the actual target');
}
console.log(checks+' active-skill preview, camera, visual-state, bomb, dive and ricochet-render checks passed.');
