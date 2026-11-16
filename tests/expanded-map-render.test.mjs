import assert from 'node:assert/strict';
import {Game,ground,W} from '../dist/core.mjs';
import {ARENAS,ARENA_LEFT,ARENA_RIGHT,arenaBounds} from '../dist/encounters.mjs';
import {Renderer,drawArenaPreview} from '../dist/render.mjs';

let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;},eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
function canvas(width=1600,height=900){
 const calls=[],clips=[];let path=[];
 const c=new Proxy({
  createLinearGradient:()=>({addColorStop(){}}),
  drawImage(...args){calls.push({kind:'image',args});},
  translate(x,y){calls.push({kind:'translate',x,y});},
  fillRect(x,y,w,h){calls.push({kind:'rect',x,y,w,h});},
  beginPath(){path=[];},moveTo(x,y){path.push([x,y]);},lineTo(x,y){path.push([x,y]);},
  clip(){clips.push(path.slice());},
 },{get:(target,key)=>key in target?target[key]:()=>{}});
 return {width,height,calls,clips,getContext:()=>c,getBoundingClientRect:()=>({width,height})};
}
const snapshot=g=>JSON.stringify(g,(_key,v)=>typeof v==='function'?undefined:v instanceof Set?[...v]:v);
function visible(renderer,p,pad=0){
 const x=renderer.canvas.width/2+(p.x-renderer.cam.x)*renderer.cam.z;
 const y=renderer.canvas.height+(p.y-renderer.cam.y)*renderer.cam.z;
 return x>=pad&&x<=renderer.canvas.width-pad&&y>=0&&y<=renderer.canvas.height;
}
for(const [width,height] of [[1600,900],[390,740],[844,390]])for(const side of [0,1]){
 const g=new Game({save:{unlocked:true},rng:()=>.5});g.start('local',3);g.skip();g.phase='aim';g.active=side;
 const p=g.players[side];p.x=side?ARENA_RIGHT-65:ARENA_LEFT+65;p.y=ground(p.x,g.world);p.homeX=p.x;p.body=null;
 const cv=canvas(width,height),r=new Renderer(cv);r.resize(width,height);r.surfaceFactory=canvas;
 const before=snapshot(g);r.draw(g,1/60);
 ok(visible(r,p,12),'active archer remains visible at extended '+(side?'right':'left')+' edge in '+width+'×'+height);
 ok(side?r.cam.x>W:r.cam.x<0,'camera actually travels beyond the old map boundary');
 eq(snapshot(g),before,'extended-edge camera and terrain rendering never modify gameplay');
 eq(r.terrainLayer.width,ARENA_RIGHT-ARENA_LEFT,'terrain cache covers physical width rather than only old canvas width');
 ok(r.terrainLayer.calls.some(v=>v.kind==='translate'&&v.x===-ARENA_LEFT&&v.y===0),'cache origin translates negative world coordinates into the surface');
 ok(cv.calls.some(v=>v.kind==='image'&&v.args[0]===r.terrainLayer&&v.args[1]===ARENA_LEFT&&v.args[2]===0),'cached terrain is drawn back at the physical left coordinate');
 const clip=r.terrainLayer.clips[0];
 for(const x of [ARENA_LEFT,-500,0,800,1600,2100,ARENA_RIGHT])ok(clip.some(([px,py])=>px===x&&py===ground(x,g.world)),'terrain surface includes true ground at world x='+x);
 const cache=r.terrainLayer;r.draw(g,1/60);eq(r.terrainLayer,cache,'expanded terrain is cached across ordinary frames');
}
{
 const g=new Game({save:{unlocked:true},rng:()=>.5});g.start('local');g.skip();g.phase='aim';
 for(const [i,p]of g.players.entries()){p.x=i?ARENA_RIGHT-55:ARENA_LEFT+55;p.y=ground(p.x,g.world);}
 for(const [width,height]of [[390,740],[320,480],[844,390],[1600,900]]){
  const r=new Renderer(canvas());r.resize(width,height);r.surfaceFactory=canvas;r.allView=true;r.draw(g,1/60);
  ok(g.players.every(p=>visible(r,p)),'all-view includes both actual outer stations in '+width+'×'+height);
 }
 eq(arenaBounds(g.map),{left:0,right:W,width:W},'legacy numeric terrain retains its original render bounds');
}
{
 const g=new Game({save:{unlocked:true}});g.start('local',3);const cv=canvas(300,110),before=snapshot(g);
 ok(drawArenaPreview(cv,g.arena),'route preview still paints the authored combat area');eq(snapshot(g),before,'route preview keeps expanded world and combat unchanged');
 // Preview markers retain their original spawn ratio instead of becoming tiny
 // at the centre of a mostly empty runout diagram.
 const original=ARENAS.find(a=>a.id===g.arena.layoutId);eq(g.arena.xs,original.xs,'route preview continues to describe unchanged spawn stations');
}
{
 const g=new Game({save:{unlocked:true}});g.start('local');g.skip();const cv=canvas(),r=new Renderer(cv);r.surfaceFactory=canvas;
 const image={width:1672,height:941};r.scenery={revision:1,get:()=>image};r.cam={x:ARENA_LEFT+300,y:900,z:1.6};
 ok(r.hdBackdrop(g.map,g.arena),'decoded HD art draws at an extended side station');
 const draw=cv.calls.findLast(v=>v.kind==='image'&&v.args[0]===r.backdropLayer),viewLeft=r.cam.x-cv.width/(2*r.cam.z),viewRight=r.cam.x+cv.width/(2*r.cam.z);
 ok(draw.args[1]<=viewLeft&&draw.args[1]+draw.args[3]>=viewRight,'HD backdrop follows the side camera instead of leaving the runout as plain sky');
}
// Real Canvas QA caught the portrait overview's former minimum zoom and
// the uncovered deep area below a terrain cache; keep both in regression.
{
 const g=new Game({save:{unlocked:true}});g.start('local');g.phase='aim';
 g.players.forEach((p,i)=>{p.x=i?ARENA_RIGHT-55:ARENA_LEFT+55;p.y=ground(p.x,g.world);});
 const cv=canvas(),r=new Renderer(cv);r.resize(390,740);r.surfaceFactory=canvas;r.allView=true;
 const image={width:1672,height:941};r.scenery={revision:1,get:()=>image};r.draw(g,1/60);
 ok(g.players.every(p=>visible(r,p)),'portrait all-view keeps both extreme stations on screen');
 ok(r.cam.z<.18,'wide physical arena can zoom below the old portrait minimum');
 ok(r.cam.y>1600,'portrait far-overview actually exercises the deep-cache boundary');
 ok(cv.calls.some(v=>v.kind==='rect'&&v.y===1600&&v.y+v.h>=r.cam.y&&v.x<=ARENA_LEFT&&v.x+v.w>=ARENA_RIGHT),'deep soil covers the viewport below the cached terrain without a black strip');
 const art=cv.calls.find(v=>v.kind==='image'&&v.args[0]===r.backdropLayer),left=r.cam.x-cv.width/(2*r.cam.z),right=r.cam.x+cv.width/(2*r.cam.z);
 ok(art.args[1]<=left&&art.args[1]+art.args[3]>=right,'zoomed-out HD art covers both physical sides instead of exposing a narrow rectangular image');
}
console.log(checks+' expanded-map camera, terrain-cache, legacy-bound and art-follow checks passed.');
