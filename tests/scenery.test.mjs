import assert from 'node:assert/strict';
import {Game} from '../dist/core.mjs';
import {SCENERY_KEY,SCENERY_IMAGES,SCENERY_STYLES,validScenery,readScenery,writeScenery,sceneryAssetFor,SceneryAssets} from '../dist/scenery.mjs';

let checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const equal=(value,expected,message)=>{assert.deepEqual(value,expected,message);checks++;};
function fakeImages(){
 const images=[];
 const imageFactory=()=>{
  const image={naturalWidth:0,naturalHeight:0,width:0,height:0,src:'',onload:null,onerror:null,
   succeed(width=2048,height=1152){this.naturalWidth=width;this.naturalHeight=height;this.onload?.();},
   fail(){this.onerror?.(new Error('Image unavailable'));}
  };
  images.push(image);return image;
 };
 return {images,imageFactory};
}

// Preferences are local presentation state; malformed or unavailable storage
// must never block the game or create an unrecognized asset request.
for(const style of SCENERY_STYLES)equal(validScenery(style.id),style.id,'known art direction remains selectable');
for(const value of [null,undefined,'',0,{},'UNKNOWN','__proto__','constructor','toString'])equal(validScenery(value),'auto','untrusted preference falls back to automatic art');
equal(readScenery(), 'auto','missing storage uses automatic scenery');
equal(readScenery({getItem(){throw new Error('Storage disabled');}}),'auto','blocked storage does not block the game');
for(const value of ['paper','unknown',null])equal(readScenery({getItem(key){equal(key,SCENERY_KEY,'reading uses the separate visual preference key');return value;}}),value==='paper'?'paper':'auto','stored preference is validated');
const memory=new Map(),storage={getItem:key=>memory.get(key),setItem:(key,value)=>memory.set(key,value)};
ok(writeScenery(storage,'moonlit'),'visual preference can be saved');equal(memory.get(SCENERY_KEY),'moonlit','writing only stores the chosen art direction');
ok(writeScenery(storage,'malformed'),'invalid visual preference is safely normalized');equal(memory.get(SCENERY_KEY),'auto','invalid write never persists an unusable style');
ok(!writeScenery(undefined,'paper'),'missing storage reports that preference was not persisted');
ok(!writeScenery({setItem(){throw new Error('Storage denied');}},'paper'),'storage rejection does not escape to UI');

// Explicit style wins over every physical arena. Automatic selection only reads
// biome and landmark; it does not turn scenery into a terrain rule.
for(const style of SCENERY_STYLES.filter(s=>s.id!=='auto'))for(const map of [0,1,2])for(const landmark of ['crane','signs','stands'])equal(sceneryAssetFor(style.id,map,{landmark}),style.asset,'explicit style overrides biome and venue');
equal([0,1,2].map(map=>sceneryAssetFor('auto',map)),['storybook','impasto','moonlit'],'campaign biome mapping preserves three distinct moods');
for(const landmark of ['crane','market','podium','bowl'])equal(sceneryAssetFor('auto',2,{landmark}),'harbor','waterfront and town venues select the harbor scene');
equal(sceneryAssetFor('auto',0,{landmark:'signs'}),'paper','contradictory-sign venue gets paper scenery');
equal(sceneryAssetFor('auto',999),'storybook','unknown biome still has a safe visible scene');
equal(sceneryAssetFor('invalid',1),'impasto','invalid preference follows automatic mapping');

{
 const {images,imageFactory}=fakeImages(),assets=new SceneryAssets({imageFactory});
 equal(assets.get('storybook'),null,'first image request returns fallback immediately');equal(images.length,1,'first request creates one image');
 equal(images[0].src,SCENERY_IMAGES.storybook,'image loads the local packaged asset');equal(images[0].decoding,'async','image decode does not block the render loop');
 equal(assets.get('storybook'),null,'pending request continues using fallback');equal(images.length,1,'frames do not duplicate a pending request');
 equal(assets.revision,0,'pending image does not invalidate cached terrain each frame');
 images[0].succeed();equal(assets.get('storybook'),images[0],'completed image is used on the next render');equal(assets.revision,1,'successful late arrival invalidates art caches once');
 equal(assets.get('storybook'),images[0],'ready image is reused');equal(images.length,1,'ready image is not decoded again');equal(assets.revision,1,'cache hit does not keep invalidating the terrain');
}
{
 const {images,imageFactory}=fakeImages(),assets=new SceneryAssets({imageFactory});
 assets.get('moonlit');images[0].fail();equal(assets.get('moonlit'),null,'failed load keeps functional fallback');
 for(let i=0;i<5;i++)assets.get('moonlit');equal(images.length,1,'failed resource is not requested again every frame');
 assets.get('paper');images[1].succeed(0,0);equal(assets.get('paper'),null,'zero-sized decode is never handed to drawImage');
}
{
 const {images,imageFactory}=fakeImages(),assets=new SceneryAssets({imageFactory});
 assets.get('storybook');images[0].succeed();assets.get('impasto');images[1].succeed();
 assets.get('storybook');assets.get('moonlit');
 equal([...assets.records.keys()],['storybook','moonlit'],'recently used image survives and the older ready image is evicted');
 equal(images[1].onload,null,'eviction detaches the old load handler');equal(images[1].onerror,null,'eviction detaches the old error handler');
 images[2].succeed();equal(assets.get('storybook'),images[0],'retained image remains ready');
 assets.get('impasto');equal(images.length,4,'evicted image is loaded again only when revisited');
 equal(assets.records.size,2,'revisiting a third direction still retains at most two records');
}
{
 const {images,imageFactory}=fakeImages(),assets=new SceneryAssets({imageFactory});
 assets.get('storybook');const staleLoad=images[0].onload,staleError=images[0].onerror;
 assets.get('impasto');assets.get('moonlit');
 const revision=assets.revision;images[0].naturalWidth=2048;images[0].naturalHeight=1152;staleLoad();staleError();
 equal(assets.revision,revision,'late completion of an evicted request cannot invalidate the active scenery');
 ok(!assets.records.has('storybook'),'stale request cannot resurrect a discarded record');
 for(const id of Object.keys(SCENERY_IMAGES)){assets.get(id);const current=assets.records.get(id);current.image.succeed();ok(assets.records.size<=2,'cycling all art directions keeps the two-image memory bound');}
}
{
 let calls=0;const assets=new SceneryAssets({imageFactory:()=>{calls++;return null;}});
 for(const id of [undefined,null,'unknown','toString','constructor','__proto__'])equal(assets.get(id),null,'unknown asset identifiers never create images');
 equal(calls,0,'invalid identifiers cannot request inherited object properties');
 equal(assets.get('paper'),null,'missing Image API preserves fallback');equal(assets.records.size,0,'missing Image API leaves no unusable cached entry');
}
{
 const factoryFailure=new SceneryAssets({imageFactory(){throw new Error('Image allocation unavailable');}});
 equal(factoryFailure.get('storybook'),null,'image allocation failure returns fallback instead of throwing in draw');
 const sourceFailure=new SceneryAssets({imageFactory:()=>({set src(_value){throw new Error('Asset source rejected');}})});
 equal(sourceFailure.get('paper'),null,'synchronous source failure returns fallback instead of throwing');
}
{
 let randomCalls=0;const game=new Game({save:{unlocked:true},rng:()=>{randomCalls++;return .37;}});game.start('rogue');
 const before=JSON.stringify(game),calls=randomCalls,{images,imageFactory}=fakeImages(),assets=new SceneryAssets({imageFactory});
 for(const style of SCENERY_STYLES){const id=sceneryAssetFor(style.id,game.map,game.encounter);assets.get(id);images.at(-1)?.succeed();}
 equal(randomCalls,calls,'scenery selection and decode never consume the combat random sequence');equal(JSON.stringify(game),before,'artwork loading never mutates game, encounter, health or save state');
}
console.log(checks+' scenery preference, loading, fallback, LRU and game-isolation checks passed.');
