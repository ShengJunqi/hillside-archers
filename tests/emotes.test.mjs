import assert from 'node:assert/strict';
import {Game} from '../dist/core.mjs';
import {AimInput} from '../dist/input.mjs';
import {standingPose} from '../dist/body.mjs';
import {emotePose} from '../dist/emotes.mjs';
import {Renderer} from '../dist/render.mjs';
let checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);checks++;};
class Canvas {
  constructor(){this.listeners=new Map();this.width=1600;this.height=900;}
  addEventListener(name,fn){this.listeners.set(name,fn);}
  dispatch(name,event){this.listeners.get(name)?.(event);}
  getBoundingClientRect(){return {left:0,top:0,width:960,height:540};}
  setPointerCapture(){} hasPointerCapture(){return false;} releasePointerCapture(){} focus(){}
  getContext(){return new Proxy({}, {get:(_,name)=>name==='createLinearGradient'?()=>({addColorStop(){}}):()=>{}});}
}
const pointer=(x,y,timeStamp,pointerType='touch',extra={})=>({pointerId:1,isPrimary:true,pointerType,button:0,buttons:1,clientX:x,clientY:y,timeStamp,preventDefault(){},...extra});
const setup=()=>{let randomCalls=0;const game=new Game({save:{unlocked:true},rng:()=>{randomCalls++;return .5;}});game.start('local');game.skip();const canvas=new Canvas(),renderer=new Renderer(canvas);let taps=0;const input=new AimInput(canvas,game,{onTap:()=>{taps++;renderer.playEmote(game);}});return {canvas,renderer,input,game,get taps(){return taps;},get randomCalls(){return randomCalls;}};};
for(const type of ['mouse','touch','pen']){
  const state=setup(),{canvas,game,renderer}=state,before=JSON.stringify(game);
  canvas.dispatch('pointerdown',pointer(400,250,0,type));canvas.dispatch('pointerup',pointer(402,251,100,type));
  eq(state.taps,1,type+' short tap triggers one emote');eq(renderer.emote.kind,'jump','first tap jumps');
  eq(JSON.stringify(game),before,'emote does not change aim, health, turn, save or projectiles');eq(state.randomCalls,0,'cosmetic interaction does not change gameplay randomness');
  canvas.dispatch('pointerdown',pointer(400,250,200,type));canvas.dispatch('pointerup',pointer(400,250,260,type));
  eq(renderer.emote.kind,'flex','next tap flexes');
  canvas.dispatch('pointerdown',pointer(400,250,300,type));canvas.dispatch('pointermove',pointer(280,290,350,type));canvas.dispatch('pointermove',pointer(400,250,380,type));canvas.dispatch('pointerup',pointer(400,250,400,type));
  eq(state.taps,2,'returning a pull to cancellation circle is not a tap');eq(game.phase,'aim','cancelled pull does not fire');
  canvas.dispatch('pointerdown',pointer(400,250,500,type));canvas.dispatch('pointerup',pointer(400,250,1000,type));eq(state.taps,2,'long hold inside circle does not trigger emote');
  canvas.dispatch('pointerdown',pointer(400,250,1100,type));canvas.dispatch('pointercancel',pointer(400,250,1150,type));canvas.dispatch('pointerup',pointer(400,250,1200,type));eq(state.taps,2,'system cancellation cannot emote');
  canvas.dispatch('pointerdown',pointer(400,250,1300,type,{pointerId:2,isPrimary:false}));canvas.dispatch('pointerup',pointer(400,250,1350,type,{pointerId:2,isPrimary:false}));eq(state.taps,2,'secondary finger cannot emote');
}
{
 const {game,renderer}=setup();renderer.playEmote(game);renderer.draw(game,.2);const time=renderer.emote.time;
 renderer.draw(game,.2,{paused:true});eq(renderer.emote.time,time,'pause freezes emote');
 renderer.draw(game,.1,{drag:{screenScale:1,screenX:100,screenY:100,cancelRadius:40,inside:true}});eq(renderer.emote,null,'starting a pull restores aiming pose');
 renderer.playEmote(game);game.shoot();renderer.draw(game,.01);eq(renderer.emote,null,'shooting interrupts emote immediately');
 ok(!renderer.playEmote(game),'flight cannot start a cosmetic emote');
 game.active=1;game.phase='aim';renderer.playEmote(game);eq(renderer.emote.side,1,'local player two can emote');
 for(let i=0;i<90;i++)renderer.draw(game,1/60);eq(renderer.emote,null,'emote naturally finishes');
}
{
 const p={x:380,y:680,dir:1},pose=standingPose(p),original=JSON.stringify(pose);
 const jump=emotePose(pose,p,{kind:'jump',time:.395}),flex=emotePose(pose,p,{kind:'flex',time:.5});
 ok(jump.head.y<pose.head.y-30,'jump visibly lifts character');ok(flex.handBack.y<pose.handBack.y-25,'flex lifts the free arm');
 eq(JSON.stringify(pose),original,'visual pose cannot alter physical hit boxes');
}
// Computer turns start a real shot immediately; only human turns tour the map.
for(const mode of ['campaign','duel','rogue']){
 const events=[],g=new Game({save:{unlocked:true},rng:()=>.5,onEvent:e=>events.push(e)});g.start(mode);g.skip();events.length=0;
 g.nextTurn();eq(g.active,1,'computer becomes active in '+mode);eq(g.phase,'flight','computer fires without scouting/thinking delay in '+mode);
 ok(g.arrows.length>0&&g.arrows.every(b=>b.t===0),'one new computer volley starts at handover');
 ok(!events.some(e=>e.type==='phase'&&e.phase==='scout'),'computer never enters a camera tour');
 g.nextTurn();eq(g.phase,'scout','returning to human retains opponent-first camera');
}
{
 const g=new Game({save:{unlocked:true}});g.start('local');g.skip();g.nextTurn();eq(g.phase,'scout','local player two retains the camera tour');eq(g.arrows.length,0,'local handover never auto-fires');
 g.skip();eq(g.phase,'aim','local player two aims manually');
 const npc=new Game({save:{unlocked:true}});npc.start('duel');npc.skip();npc.players[1].hp=1;npc.players[1].status.poison=2;npc.players[1].status.poisonTurns=1;npc.nextTurn();eq(npc.phase,'victory','fatal poison resolves before robot fires');eq(npc.arrows.length,0,'dead robot cannot fire');
}
console.log(checks+' tap-emote and instant-computer-turn checks passed.');
