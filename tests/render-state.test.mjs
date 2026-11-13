import assert from 'node:assert/strict';
import {Game,launch,ground,trace,G} from '../dist/core.mjs';
import {encounterFor} from '../dist/encounters.mjs';
import {Renderer} from '../dist/render.mjs';
import {SceneryAssets,SCENERY_IMAGES} from '../dist/scenery.mjs';

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
// Record real draw operations rather than source strings. This adapter checks
// asynchronous art integration; it is not a browser or image-quality test.
function artCanvas(){
 const calls=[],clips=[];let path=[],clipDepth=0;const clipStack=[];
 const context=new Proxy({
  createLinearGradient:()=>({addColorStop(){}}),
  fillRect(...args){calls.push({kind:'fill',args});},
  drawImage(...args){calls.push({kind:'image',args,smoothing:this.imageSmoothingEnabled,clipped:clipDepth>0});},
  save(){clipStack.push(clipDepth);},restore(){clipDepth=clipStack.pop()??0;},
  beginPath(){path=[];},moveTo(x,y){path.push([x,y]);},lineTo(x,y){path.push([x,y]);},clip(){clips.push([...path]);clipDepth++;}
 },{get:(target,key)=>key in target?target[key]:()=>{}});
 return {width:1600,height:900,calls,clips,context,getContext:()=>context};
}
function artImages(){
 const images=[];
 return {images,imageFor:id=>images.findLast(image=>image.src===SCENERY_IMAGES[id]),imageFactory(){const image={naturalWidth:0,naturalHeight:0,width:0,height:0,onload:null,onerror:null,
  ready(){this.naturalWidth=2048;this.naturalHeight=1152;this.onload?.();},fail(){this.onerror?.();}};images.push(image);return image;}};
}
{
 let rngCalls=0;const g=new Game({save:{unlocked:true},rng:()=>{rngCalls++;return .3;}});g.start('rogue');g.skip();
 const canvas=artCanvas(),r=new Renderer(canvas),fake=artImages();r.surfaceFactory=artCanvas;r.scenery=new SceneryAssets({imageFactory:fake.imageFactory});r.setSceneryStyle('storybook');
 let skyline=0,venue=0;const oldSkyline=r.skyline.bind(r),oldVenue=r.venueBackdrop.bind(r);
 r.skyline=(...args)=>{skyline++;return oldSkyline(...args);};r.venueBackdrop=(...args)=>{venue++;return oldVenue(...args);};
 const before=snapshot(g),calls=rngCalls,trajectory=()=>[15,30,45,60,75].map(angle=>{const hit=trace(g.players[0],g.players[1],angle,g.obs,g.world);return [hit.kind,hit.part||null];}),beforeShots=trajectory();
 r.draw(g,.016);const fallbackTerrain=r.terrainLayer,fallbackKey=r.terrainArtKey;
 equal([skyline,venue],[1,1],'pending backdrop preserves the complete procedural fallback');equal(fake.images.length,2,'initial render requests one backdrop and the shared earth texture');equal(r.scenery.records.size,2,'backdrop and earth requests respect the two-image memory bound');equal(r.terrainTexture,null,'pending earth texture preserves the procedural terrain');
 fake.imageFor('storybook').ready();canvas.calls.length=0;r.draw(g,.016);
 equal([skyline,venue],[1,1],'ready HD backdrop replaces the old skyline and venue geometry');
 assert.notEqual(r.terrainLayer,fallbackTerrain,'late image readiness rebuilds the cached terrain');checks++;
 assert.notEqual(r.terrainArtKey,fallbackKey,'late asset revision participates in the terrain cache key');checks++;
 equal(r.sceneryAssetId,'storybook','renderer tracks the art direction actually in use');
 assert.ok(canvas.calls.some(c=>c.kind==='image'&&c.args[0]===r.backdropLayer&&c.smoothing===true),'ready backdrop is drawn as a smoothed image');checks++;
 const readyTerrain=r.terrainLayer,readyBackdrop=r.backdropLayer;r.draw(g,.016);equal(r.terrainLayer,readyTerrain,'ready art reuses the static terrain cache');equal(r.backdropLayer,readyBackdrop,'ready image reuses the composed backdrop cache');
 const clipBefore=readyTerrain.clips[0];
 const beforeTextureKey=r.terrainArtKey;fake.imageFor('earth').ready();r.draw(g,.016);
 assert.notEqual(r.terrainLayer,readyTerrain,'late earth texture readiness rebuilds the cached terrain');checks++;
 assert.notEqual(r.terrainArtKey,beforeTextureKey,'earth readiness is included in the terrain cache revision');checks++;
 equal(r.terrainTexture,fake.imageFor('earth'),'ready earth image is used as the shared terrain texture');
 assert.ok(r.terrainLayer.calls.some(c=>c.kind==='image'&&c.args[0]===r.terrainTexture&&c.clipped&&c.smoothing===true),'earth image is smoothed and drawn inside the active ground clip');checks++;
 equal(r.terrainLayer.clips[0],clipBefore,'earth texture arrival preserves the physical ground silhouette');
 const texturedTerrain=r.terrainLayer;r.draw(g,.016);equal(r.terrainLayer,texturedTerrain,'ready earth texture does not rebuild its terrain every frame');
 for(const x of [0,400,800,1200,1600])assert.ok(clipBefore.some(([px,py])=>px===x&&py===ground(x,g.world)),'terrain texture is clipped at the real collision surface x='+x);checks++;
 r.setSceneryStyle('paper');r.draw(g,.016);equal(r.sceneryAssetId,'paper','same-match style switch requests the selected art');
 const pendingPaper=r.terrainLayer;fake.imageFor('paper').ready();r.draw(g,.016);
 assert.notEqual(r.terrainLayer,pendingPaper,'new style late arrival refreshes its terrain appearance');checks++;
 equal(r.terrainLayer.clips[0],clipBefore,'style change preserves the exact ground clipping path');equal(fake.images.filter(image=>image.src===SCENERY_IMAGES.earth).length,1,'style changes reuse the shared earth decode');equal(r.scenery.records.size,2,'selected background and shared earth keep the two-image bound');
 equal(trajectory(),beforeShots,'switching art preserves sampled shot collisions');equal(snapshot(g),before,'pending, decoded and switched scenery preserve all game and save state');equal(rngCalls,calls,'image loading and style switching consume no combat randomness');
 r.setSceneryStyle('moonlit');r.draw(g,.016);const fallbackCalls=[skyline,venue];fake.imageFor('moonlit').fail();r.draw(g,.016);
 equal([skyline,venue],fallbackCalls.map(n=>n+1),'failed image keeps painting the functional fallback');
 equal(r.hdBackdrop(g.map,g.encounter),false,'failed image is never handed to the HD draw path');equal(snapshot(g),before,'failed HD art still leaves the game intact');
}
{
 const g=new Game({save:{unlocked:true},rng:()=>.5});g.start('local',3);g.skip();g.aim(75,100);g.shoot();g.arrows[0].t=-g.arrows[0].vy/G;
 const canvas=artCanvas(),r=new Renderer(canvas),fake=artImages();r.surfaceFactory=artCanvas;r.scenery=new SceneryAssets({imageFactory:fake.imageFactory});r.setSceneryStyle('moonlit');r.scenery.get('moonlit');fake.imageFor('moonlit').ready();
 const before=snapshot(g);r.draw(g,.5);
 const left=r.cam.x-canvas.width/(2*r.cam.z),right=r.cam.x+canvas.width/(2*r.cam.z),top=r.cam.y-canvas.height/r.cam.z,bottom=r.cam.y;
 assert.ok(top<0,'high-arc test actually reaches above the normal scene image');checks++;
 assert.ok(canvas.calls.some(c=>c.kind==='fill'&&c.args.every(Number.isFinite)&&c.args[0]<=left&&c.args[1]<=top&&c.args[0]+c.args[2]>=right&&c.args[1]+c.args[3]>=bottom),'HD sky fill covers the entire high-arc viewport beyond image edges');checks++;
 assert.ok(canvas.calls.some(c=>c.kind==='image'&&c.args[0]===r.backdropLayer),'high-arc camera still paints the decoded scenery');checks++;
 equal(snapshot(g),before,'high-arc background extension never changes the flying arrow or collision state');
}
console.log(checks+' renderer purity, caching, HD loading, collision-surface and reduced-motion checks passed.');
