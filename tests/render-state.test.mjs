import assert from 'node:assert/strict';
import {Game,launch,ground} from '../dist/core.mjs';
import {encounterFor} from '../dist/encounters.mjs';
import {Renderer} from '../dist/render.mjs';

let checks=0,randomCalls=0,borders=0;
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const makeCanvas=()=>{
  const context=new Proxy({createLinearGradient:()=>({addColorStop(){}}),strokeRect(){borders++;}},
    {get:(target,key)=>key in target?target[key]:()=>{}});
  return {width:1600,height:900,getContext:()=>context};
};
const snapshot=g=>JSON.stringify(g,(_key,value)=>typeof value==='function'?undefined:value instanceof Set?[...value]:value);
for(let map=1;map<=3;map++){
  const game=new Game({save:{unlocked:true},rng:()=>{randomCalls++;return .5;}});
  game.start('local',map);game.skip();
  const p=game.players[1];game.players[0].stats.fire=2;game.players[0].stats.poison=2;game.players[0].stats.ice=1;
  game.hitTarget({...launch(game.players[0],20),vx:450,vy:20,t:0},{damage:26,part:'body'},{x:p.x,y:p.y-60});
  const renderer=new Renderer(makeCanvas());renderer.surfaceFactory=makeCanvas;
  const before=snapshot(game),calls=randomCalls;
  for(let i=0;i<12;i++)renderer.draw(game,1/60);
  equal(snapshot(game),before,'map '+map+': rendering never changes physics, health, statuses, turns or save data');
  equal(randomCalls,calls,'map '+map+': rendering does not consume the combat random sequence');
  const cache=renderer.terrainLayer;renderer.draw(game,1/60);
  equal(renderer.terrainLayer,cache,'map '+map+': static terrain is reused across frames');
  renderer.resize(390,740);renderer.draw(game,1/60);
  equal(snapshot(game),before,'map '+map+': portrait camera preserves combat state');
  renderer.reducedMotion=true;const previous=borders;renderer.draw(game,1/60);
  equal(borders,previous,'map '+map+': reduced motion disables the impact border flash');
}
const game=new Game({save:{unlocked:true}});game.start('local');game.skip();
const renderer=new Renderer(makeCanvas());renderer.surfaceFactory=makeCanvas;
for(let i=0;i<25;i++){game.impact={x:200+i,y:ground(200+i,game.map)};renderer.draw(game,0);}
assert.ok(renderer.dust.length<=8,'ground impact effects have a bounded queue');checks++;
const before=renderer.time;renderer.draw(game,.1,{paused:true});equal(renderer.time,before,'pause freezes decorative animation time');
{
 const g=new Game({save:{unlocked:true},rng:()=>.5});g.start('rogue');const r=new Renderer(makeCanvas());r.surfaceFactory=makeCanvas;r.draw(g,.016);const terrain=r.terrainLayer;
 g.floor=2;g.encounterFloor=0;g.pendingEncounter=encounterFor(7,2);g.pendingEncounter.map=g.map;g.setup();r.draw(g,.016);
 assert.notEqual(r.terrainLayer,terrain,'same biome with new slope rebuilds cached collision surface');checks++;
 const p=g.players[1];g.setPhase('flight');g.hitTarget({...launch(g.players[0],20),t:0},{part:'head',damage:42},{x:p.x,y:p.y-96});r.draw(g,.016);
 assert.ok(r.comicLabel?.head,'actual impact rendering includes comic headshot emphasis');checks++;
 const label=r.comicLabel;g.hitTarget({...launch(g.players[0],20),t:0},{part:'body',damage:26},{x:p.x,y:p.y-60});r.draw(g,.016);equal(r.comicLabel,label,'extra arrows do not restart comic emphasis');
 let stroked=0;const old=r.c.strokeText;r.c.strokeText=()=>{stroked++;};g.effects=[];r.particles(g);r.c.strokeText=old;
 assert.ok(stroked>0,'active particle implementation actually draws the comic label, not the obsolete override');checks++;
}
console.log(checks+' renderer purity, random-sequence, caching and reduced-motion checks passed.');
