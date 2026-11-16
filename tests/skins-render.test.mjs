import assert from 'node:assert/strict';
import {Game,launch} from '../dist/core.mjs';
import {Renderer} from '../dist/render.mjs';
import {skinById,COLLECTION_ITEMS} from '../dist/collection.mjs';
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;},eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
const snapshot=g=>JSON.stringify(g,(_key,v)=>typeof v==='function'?undefined:v instanceof Set?[...v]:v);
function canvas(width=1600,height=900){
 const calls=[];let path=[];const c=new Proxy({
  createLinearGradient:()=>({addColorStop(){}}),
  beginPath(){path=[];},moveTo(x,y){path.push([x,y]);},lineTo(x,y){path.push([x,y]);},
  fill(){calls.push({kind:'fill',color:this.fillStyle,path:path.slice()});},stroke(){calls.push({kind:'stroke',color:this.strokeStyle,width:this.lineWidth,path:path.slice()});},
  fillRect(x,y,w,h){calls.push({kind:'rect',color:this.fillStyle,x,y,w,h});},
  fillText(text,x,y){calls.push({kind:'text',text,x,y});},ellipse(...args){calls.push({kind:'ellipse',args});},
 },{get:(target,key)=>key in target?target[key]:()=>{}});
 return {width,height,calls,getContext:()=>c,getBoundingClientRect:()=>({width,height})};
}
const skins=COLLECTION_ITEMS.filter(item=>item.type==='skin');eq(skins.length,4,'four shop skins have actual rendered variants');
const p={x:700,y:700,dir:1,hp:100,characterId:'qingsong',stuck:[]},base={...p,skinId:'base'};
for(const skin of skins){
 const cv=canvas(),r=new Renderer(cv);r.surfaceFactory=canvas;const actor={...p,skinId:skin.id},before=snapshot(actor);
 r.character(actor,0);const paints=cv.calls.filter(call=>call.kind==='fill'||call.kind==='rect');
 ok(paints.some(call=>call.color===skin.palette.cloak),skin.id+' cloak is actually painted from catalogue');
 ok(paints.some(call=>call.color===skin.palette.cloth),skin.id+' cloth is actually painted from catalogue');
 ok(paints.some(call=>call.color===skin.palette.metal),skin.id+' distinct armour or ornament uses catalogue metal');
 eq(snapshot(actor),before,skin.id+' rendering never mutates actor or collision state');
 cv.calls.length=0;const torsoMarks=r.skinTorso(skin,skin.palette,40),torsoShape=cv.calls.filter(call=>call.kind==='fill').map(call=>call.path);
 ok(torsoMarks>0&&torsoMarks<=12,skin.id+' has a bounded structural torso motif beyond recolouring');
 ok(torsoShape.length>0,skin.id+' torso motif actually paints polygon shapes');
 cv.calls.length=0;const headMarks=r.skinHead(skin,skin.palette);ok(headMarks>=2&&headMarks<=5,skin.id+' headwear actually paints a distinctive mask or crest');
 cv.calls.length=0;eq(r.skinArrow(skin,{x:300,y:250},.2),1,skin.id+' adds one bounded local arrow treatment');
 ok(cv.calls.some(call=>call.color===skin.trailColor),skin.id+' flight treatment actually uses its trail colour');
 r.reducedMotion=true;cv.calls.length=0;r.skinArrow(skin,{x:300,y:250},.2);const first=JSON.stringify(cv.calls);cv.calls.length=0;r.time+=1;r.skinArrow(skin,{x:300,y:250},.2);eq(JSON.stringify(cv.calls),first,skin.id+' reduced-motion arrow ornament has no time flicker');
 const portrait=canvas(192,224),original=r.c;ok(r.drawCharacterPortrait(portrait,'panshi',skin.id),skin.id+' shop preview supports the optional third argument');eq(r.c,original,'portrait always restores the main rendering context');
 ok(portrait.calls.some(call=>call.color===skin.palette.cloak),skin.id+' shop portrait renders the requested skin rather than basehero colours');
}
{
 const cv=canvas(),r=new Renderer(cv);r.surfaceFactory=canvas;const fingerprints=[];
 for(const skin of skins){cv.calls.length=0;r.skinTorso(skin,skin.palette,40);fingerprints.push(JSON.stringify(cv.calls.filter(call=>call.kind==='fill').map(call=>call.path)));}
 eq(new Set(fingerprints).size,4,'four skins have four genuinely different ornament silhouettes');
 cv.calls.length=0;r.character(base,0);const original=JSON.stringify(cv.calls);cv.calls.length=0;r.character({...p,skinId:'not-a-skin'},0);eq(JSON.stringify(cv.calls),original,'unknown skin falls back to the unchanged hero outfit');
 eq(r.skinTorso(skinById('base'),{},40),0,'base does not add cosmetic armour');eq(r.skinHead(skinById('base'),{}),0,'base does not add a cosmetic mask');eq(r.skinArrow(skinById('base'),{x:0,y:0},0),0,'base retains its original arrow');
 const npc={...p,dir:-1,characterId:'chiyan'};cv.calls.length=0;r.character(npc,1);const first=JSON.stringify(cv.calls);r.character({...p,skinId:'skin_meteor'},0);cv.calls.length=0;r.character(npc,1);eq(JSON.stringify(cv.calls),first,'drawing a skinned hero does not leak colours or motifs into the NPC');
}
for(const [width,height]of [[1600,900],[390,740],[844,390]])for(const skin of skins){
 let random=0;const g=new Game({save:{unlocked:true},rng:()=>{random++;return .5;}});g.start('local',3);g.skip();g.players[0].skinId=skin.id;
 const cv=canvas(),r=new Renderer(cv);r.surfaceFactory=canvas;r.resize(width,height);const before=snapshot(g),calls=random;r.draw(g,.016);eq(snapshot(g),before,skin.id+' whole-screen rendering preserves actual gameplay');eq(random,calls,skin.id+' whole-screen rendering consumes no random state');
 g.phase='aim';g.shoot();g.arrows[0].skinId=skin.id;g.arrows[0].t=.2;
 cv.calls.length=0;const flight=snapshot(g);r.arrowEffects(g);eq(snapshot(g),flight,skin.id+' arrow visual does not modify trajectory/damage');ok(cv.calls.some(call=>call.color===skin.trailColor),skin.id+' real flight paints its snapshot skin trail');
}
{
 const g=new Game({save:{unlocked:true},rng:()=>.5});g.start('rogue',1,'dive');g.skip();g.shoot();const b=g.arrows[0];Object.assign(b,{skinId:'skin_night',diving:true,t:.2});
 const cv=canvas(),r=new Renderer(cv);r.arrowEffects(g);ok(cv.calls.some(call=>call.color==='#9ce8ff'),'skin does not hide blue star-dive identity');ok(cv.calls.some(call=>call.color===skinById('skin_night').trailColor),'star-dive can retain its cosmetic skin accent');
 b.diving=false;b.echo=true;cv.calls.length=0;r.arrowEffects(g);ok(cv.calls.some(call=>call.color==='#d3b6ff'),'skin does not hide passive-echo identity');
 b.echo=false;b.boosted=true;cv.calls.length=0;r.arrowEffects(g);ok(cv.calls.some(call=>call.color==='#ffd185'),'skin does not hide explosive-boost identity');
}
console.log(checks+' catalogue-skin palette, structural motif, portrait, snapshot-trail and render-isolation checks passed.');
