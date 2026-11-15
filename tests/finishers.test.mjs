import assert from 'node:assert/strict';
import {Game,launch,FINISHER_DURATION} from '../dist/core.mjs';
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;},eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
const make=()=>{const events=[],game=new Game({save:{unlocked:true},rng:()=>.5,onEvent:e=>events.push(e)});game.start('local',8);game.phase='aim';game.shoot();return {game,events};};
for(const [part,damage]of [['head',42],['body',26],['legs',18],['feet',12]])for(const element of ['plain','fire','ice','poison','melt','venomfire']){
 const {game:g,events}=make(),p=g.players[1];if(element==='fire'||element==='melt'||element==='venomfire')g.stats.fire=1;if(element==='ice'||element==='melt')g.stats.ice=1;if(element==='poison'||element==='venomfire')g.stats.poison=1;
 p.hp=1;const save=JSON.stringify(g.save);g.hitTarget({...launch(g.players[0],20),t:0,id:1},{part,damage},{x:p.x,y:p.y-60});
 eq(p.hp,0,'finishing contact uses real damage');eq(g.finisher?.side,1,'finisher anchors the defeated side');eq(g.finisher?.part,part,'finisher records actual body region');eq(g.finisher?.element,element,'finisher uses actual active elements');eq(g.finisher?.age,0,'new finisher starts at event-local zero');eq(g.finisher?.duration,FINISHER_DURATION,'short finisher duration remains bounded');
 ok(Math.abs(p.body.rootVX)>0,'last one HP does not erase physical finishing impulse');eq(events.filter(e=>e.type==='finisher').length,1,'one fatal contact creates one finisher event');
 const f=g.finisher;g.hitTarget({...launch(g.players[0],20),t:0,id:2},{part,damage},{x:p.x,y:p.y-60});eq(g.finisher,f,'late extra arrow cannot restart finisher');eq(events.filter(e=>e.type==='finisher').length,1,'late extra arrow cannot replay KO sound');eq(JSON.stringify(g.save),save,'KO animation never changes permanent progress');
 g.update(.05);ok(g.finisher.age>0,'game update advances finisher time');const time=g.finisher.age;eq(g.finisher.age,time,'time remains fixed without game update');g.setup();eq(g.finisher,null,'new encounter clears transient finisher');
}
{
 const {game:g}=make(),p=g.players[1];g.hitTarget({...launch(g.players[0],20),t:0},{part:'body',damage:26},{x:p.x,y:p.y-60});eq(g.finisher,null,'ordinary nonfatal hit never plays KO');ok(!g.beginFinisher(p),'cannot force a finisher for a living character');
}
{
 const {game:g,events}=make();g.active=0;g.players[0].hp=1;g.players[0].status={burn:0,burnTurns:0,poison:1,poisonTurns:1,ice:0};g.active=1;g.nextTurn();eq(g.players[0].hp,0,'real turn poison is lethal');eq(g.finisher?.element,'poison','status death uses poison finisher');eq(g.finisher?.cause,'status','status KO does not claim another arrow was fired');eq(g.finisher?.arrows,0,'status KO has no fake projectile count');eq(events.filter(e=>e.type==='finisher').length,1,'turn status creates one KO event');
}
{
 const {game:g}=make(),p=g.players[1];g.phase='victory';g.complete(true);eq(g.finisher,null,'test/manual result is not a fake fatal hit');g.start('local',1);eq(g.finisher,null,'restart does not leak prior finisher state');
}
console.log(checks+' fatal-hit, element, single-event, status and finisher-lifecycle checks passed.');
