import assert from 'node:assert/strict';
import {Game,baseStats,launch,validSave} from '../dist/core.mjs';
import {AUTHOR_CODE,validCollection,recordCollection,purchaseCollection,equipCollection} from '../dist/collection.mjs';

let checks=0;
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
const snapshot=value=>JSON.stringify(value);
const make=(save={unlocked:true})=>{const events=[],g=new Game({save,rng:()=>.5,onEvent:e=>events.push(e)});return {g,events};};
const ready=g=>{while(['intro','scout'].includes(g.phase))g.skip();};
function contact(g,{side=0,part='head',damage=42}={}){
 g.active=side;g.phase='aim';g.shoot();const b=g.arrows[0],p=g.players[1-side];g.arrows=[];
 g.hitTarget(b,{part,damage},{x:p.x,y:p.y-(part==='head'?96:60)});return b;
}
function profileForTalent(id){
 let c=validCollection();for(let n=0;n<10;n++)c=recordCollection(c,'casts');for(let n=0;n<20;n++)c=recordCollection(c,'covers');
 c={...c,tokens:100};const bought=purchaseCollection(c,id);ok(bought.ok,'fixture purchases an achievement-gated talent');const equipped=equipCollection(bought.profile,id);ok(equipped.ok,'fixture equips the owned talent');return equipped.profile;
}

{
 const {g,events}=make();g.start('duel');ready(g);g.complete(true);
 eq(g.collection.stats.wins,1,'a real supported win increments permanent style progress');ok(g.collection.claimed.includes('first_win'),'first win claims its achievement');eq(g.collection.tokens,3,'first win grants exactly its style currency');
 const once=snapshot(g.permanentSave);ok(g.complete(true)===false,'the completed arena rejects a second result');eq(snapshot(g.permanentSave),once,'duplicate completion cannot mint tokens or record wins');
 g.goHome();const savedBeforePurchase=events.filter(e=>e.type==='save').length;ok(g.buyCollection('skin_sunset'),'first-win currency can purchase the first real skin');eq(g.collection.tokens,0,'purchase deducts the exact cost');ok(events.filter(e=>e.type==='save').length>savedBeforePurchase,'shop purchase immediately emits a normal save transaction');ok(g.collection.owned.includes('skin_sunset'),'owned skin is permanent');
 const purchase=snapshot(g.permanentSave);ok(!g.buyCollection('skin_sunset'),'duplicate purchase is rejected');eq(snapshot(g.permanentSave),purchase,'duplicate purchase neither charges nor grants again');
 ok(g.equipCollection('skin_sunset'),'owned skin can be equipped in camp');eq(g.players[0].skinId,'skin_sunset','equipping refreshes the visible camp archer');eq(g.collection.skin,'skin_sunset','skin selection is saved');
 g.start('campaign',1);eq(g.players[0].skinId,'skin_sunset','new battle receives the selected skin');eq(g.players[1].skinId,'base','purchasing a skin does not restyle the robot');
 const fight=snapshot(g.permanentSave);ok(!g.buyCollection('skin_night'),'buying is gated to camp');ok(!g.equipCollection('base'),'live battle cannot toggle equipment');eq(snapshot(g.permanentSave),fight,'failed live transactions preserve the collection');
 ok(events.some(e=>e.type==='save'&&e.save.collection?.owned.includes('skin_sunset')),'normal shop transaction is emitted through the standard save path');
}
{
 const {g}=make();g.start('rogue');ready(g);g.players[1].hp=g.players[1].stats.maxHp=10000;
 for(let n=0;n<10;n++)contact(g);
 eq(g.collection.stats.heads,10,'actual player head contacts increment head achievements');ok(g.collection.claimed.includes('ten_heads'),'ten real head hits unlock the night-skin gate');
 const before=g.collection.stats.heads;g.players[0].hp=g.players[0].stats.maxHp=10000;contact(g,{side:1});eq(g.collection.stats.heads,before,'robot head hits do not award player achievements');
 const used={id:991,x:800,y:700,w:30,h:80,type:'crate',hp:2,maxHp:2,state:'standing',rot:0,dir:1};g.active=0;
 g.hitObstacle(used,1);eq(g.collection.stats.covers,0,'cracking cover does not count as a break');g.hitObstacle(used,1);eq(g.collection.stats.covers,1,'actual final cover hit records once');g.hitObstacle(used,1);eq(g.collection.stats.covers,1,'broken cover cannot farm achievements');
 const npc={...used,id:992,hp:1,state:'standing'};g.active=1;g.hitObstacle(npc,-1);eq(g.collection.stats.covers,1,'robot cover destruction does not grant player progress');
}
{
 const {g}=make();g.start('rogue',1,'dive');ready(g);
 for(let n=0;n<10;n++){
  g.active=0;g.phase='aim';g.arrows=[];g.specialAmmo=2;g.selectArrowType('special');g.shoot();Object.assign(g.arrows[0],{x:300,y:0,vx:100,vy:0,t:.2});
  ok(g.beginSkillAim(),'special hold can begin');g.cancelSkillAim();eq(g.collection.stats.casts,n,'cancelled hold does not record a cast');
  g.beginSkillAim();ok(g.releaseSkillAim(),'actual release spends and casts');eq(g.collection.stats.casts,n+1,'one complete volley records exactly one cast');ok(!g.activateSkill(),'late repeated activation stays rejected');
 }
 ok(g.collection.claimed.includes('ten_casts'),'ten successful casts unlock the quiver talent');
}
{
 const {g}=make();g.start('rogue');g.floor=3;g.encounterFloor=0;g.setup();g.complete(true);
 eq(g.collection.stats.bosses,1,'actual rogue guardian win records one recurring token event');eq(g.collection.tokens,4,'first-win award and one boss token both arrive');
 const once=snapshot(g.collection);g.complete(true);eq(snapshot(g.collection),once,'one guardian cannot be claimed again');
}
{
 const {g}=make({unlocked:true,best:6,targetBest:500});
 ok(g.collection.claimed.includes('expedition6')&&g.collection.claimed.includes('target500'),'existing verified records unlock matching new achievements');eq(g.collection.tokens,9,'legacy record rewards are granted once as a whole collection');
 const before=snapshot(g.collection);g.refreshCollection();g.persist();g.refreshCollection();eq(snapshot(g.collection),before,'reloading reward evaluation does not mint the same record trophies again');
}
for(const mode of ['local','target']){
 const {g}=make();g.start(mode);g.complete(true);eq(g.collection.stats.wins,0,mode+' does not farm competitive win rewards');
}
{
 const quiver=profileForTalent('talent_quiver'),{g}=make({unlocked:true,collection:quiver});g.start('rogue');eq(g.specialAmmo,3,'equipped quiver adds one initial rogue charge');eq(g.specialAmmoMax,5,'talent does not raise ammunition cap');
 g.goHome();ok(g.equipCollection('none'),'talent can be removed in camp');g.start('rogue');eq(g.specialAmmo,2,'unequipped next run returns to ordinary starting charges');
 for(const mode of ['campaign','local','duel','target']){g.goHome();g.equipCollection('talent_quiver');g.start(mode);eq(g.specialAmmo,0,'quiver has no ammunition/stat bonus outside rogue: '+mode);eq(g.players[0].stats,baseStats(),'shop talents do not alter ordinary-mode combat stats');}
}
{
 const breach=profileForTalent('talent_breach'),{g}=make({unlocked:true,collection:breach});g.start('rogue');ready(g);g.selectArrowType('normal');g.shoot();ok(g.arrows.every(b=>b.pierce===1),'first real arena volley has the breach penetration');
 g.active=0;g.phase='aim';g.shoot();ok(g.arrows.every(b=>b.pierce===0),'later volley cannot regain the first-shot bonus');
 g.floor++;g.encounterFloor=0;g.setup(false);ready(g);g.shoot();ok(g.arrows.every(b=>b.pierce===1),'a genuinely new arena refreshes the first-volley talent');
}
{
 const initial={version:2,unlocked:false,checkpoint:2,best:0,embers:7,bow:1,life:2,targetBest:0,names:['正常弓手','对手']},{g,events}=make(initial),normal=snapshot(g.permanentSave);
 ok(!g.enterAuthorMode('wrong'),'bad author code does not enter practice');eq(snapshot(g.permanentSave),normal,'bad code does not change formal progress');
 ok(g.enterAuthorMode(AUTHOR_CODE),'documented public code enters author practice in camp');ok(g.authorMode&&g.assistedRun,'practice has an explicit assisted latch');eq(snapshot(g.permanentSave),normal,'practice retains a separate real save');eq(g.collection.owned.length,6,'practice copy can inspect every skin and talent');eq(g.collection.tokens,9999,'practice wallet is visibly distinct');
 events.length=0;ok(g.start('rogue'),'practice can try a mode still locked in the normal profile');ready(g);eq(g.specialAmmo,5,'author practice starts with a full debug quiver');ok(!g.exitAuthorMode(),'practice cannot be turned off halfway through a live run');
 g.players[1].hp=g.players[1].stats.maxHp=10000;contact(g);g.floor=3;g.complete(true);g.persist();eq(snapshot(g.permanentSave),normal,'assisted combat, score and reward mutations never reach the cloud-facing snapshot');ok(!events.some(e=>e.type==='save'),'practice never emits the normal save event');
 g.goHome();ok(g.exitAuthorMode(),'returning to camp can exit practice');ok(!g.authorMode&&!g.assistedRun,'practice latch resets only after the run has ended/been abandoned');eq(snapshot(g.save),normal,'exit restores all normal progress, currency, names and collection');
}
{
 const {g}=make({unlocked:true,embers:3});const normal=validSave(g.permanentSave);g.enterAuthorMode(AUTHOR_CODE);const debugCollection=snapshot(g.collection),incoming=validSave({...normal,embers:11,checkpoint:3});
 g.applyPermanentSave(incoming);eq(g.permanentSave,incoming,'background cloud update applies only to real backup');eq(snapshot(g.collection),debugCollection,'incoming cloud data does not overwrite the active practice costume');g.goHome();g.exitAuthorMode();eq(g.save,incoming,'exit restores the latest formal snapshot rather than stale entry data');
}
console.log(checks+' actual collection rewards, shop transactions, talent effects and author-practice isolation checks passed.');
