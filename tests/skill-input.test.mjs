import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {Game} from '../dist/core.mjs';
import {AimInput} from '../dist/input.mjs';

let checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);checks++;};
class Element {
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.style={};this.dataset={};this.children=[];this.listeners=new Map();this.attributes={};this.hidden=false;this.disabled=false;this.value='1';this.captures=new Set();this.rect={left:0,top:0,width:390,height:650};const classes=new Set();this.classList={add:v=>classes.add(v),contains:v=>classes.has(v),toggle(v,forced){const next=forced??!classes.has(v);if(next)classes.add(v);else classes.delete(v);return next;}};}
 addEventListener(name,fn){const list=this.listeners.get(name)||[];list.push(fn);this.listeners.set(name,list);}
 dispatch(name,event={}){event.preventDefault??=()=>{event.prevented=true;};event.target??=this;for(const fn of this.listeners.get(name)||[])fn(event);return event;}
 getBoundingClientRect(){return this.rect;}
 setPointerCapture(id){this.captures.add(id);}
 hasPointerCapture(id){return this.captures.has(id);}
 releasePointerCapture(id){this.captures.delete(id);this.dispatch('lostpointercapture',{pointerId:id});}
 focus(){}
 setAttribute(name,value){this.attributes[name]=value;}
 append(child){this.children.push(child);}
 contains(child){return child===this||this.children.some(node=>node.contains(child));}
 replaceChildren(...children){this.children=children;}
 querySelector(selector){if(selector==='.mode-state')return this.modeState??=new Element();throw Error(selector);}
 click(event={}){if(!this.disabled)return this.onclick?.({target:this,preventDefault(){},...event});}
}
const pointer=(x=180,extra={})=>({pointerId:1,pointerType:'touch',isPrimary:true,clientX:x,clientY:300,button:0,buttons:1,preventDefault(){},...extra});
const key=(name,target,extra={})=>({key:name,target,preventDefault(){this.prevented=true;},...extra});
function gameReady(skill='dive'){
 const game=new Game({save:{unlocked:true},rng:()=>.5});game.start('rogue',1,skill);game.skip();game.obs=[];game.shoot();
 for(let n=0;n<4;n++)game.update(.05);
 ok(game.canSkill,'real flight is eligible for its second action');return game;
}
function inputReady(skill='dive'){
 const canvas=new Element('canvas');canvas.width=540;canvas.height=900;const game=gameReady(skill);let paused=false;
 const input=new AimInput(canvas,game,{isPaused:()=>paused});return {canvas,game,input,setPaused:v=>{paused=v;}};
}

{
 const {canvas,game,input}=inputReady();
 canvas.dispatch('pointerdown',pointer());ok(game.skillAim&&!game.skillUsed,'touch down previews instead of spending dive');eq(input.drag,null,'flight preview never creates a bow drag');
 const before=game.arrows[0].t;game.update(.03);ok(game.arrows[0].t-before<.015,'held touch actually invokes one-third-speed flight');
 canvas.dispatch('pointermove',pointer(240));ok(Number.isInteger(game.skillAim.tilt)&&game.skillAim.tilt>0,'horizontal finger movement steers a legal integer dive');
 canvas.dispatch('pointerup',pointer(240,{buttons:0}));ok(game.skillUsed&&!game.skillAim,'touch release commits the real dive once');eq(input.skill.hold,null,'release clears pointer ownership');eq(canvas.captures.size,0,'release clears native pointer capture');
 const count=game.arrows.length;canvas.dispatch('pointerup',pointer(240,{buttons:0}));eq(game.arrows.length,count,'duplicate touch release cannot multiply a skill');
}
for(const cancel of ['pointercancel','lostpointercapture','contextmenu','right-button','pause','layout']){
 const {canvas,game,input,setPaused}=inputReady();canvas.dispatch('pointerdown',pointer());
 if(cancel==='right-button')canvas.dispatch('pointerdown',pointer(180,{button:2,buttons:2}));
 else if(cancel==='pause'){setPaused(true);canvas.dispatch('pointerup',pointer(180,{buttons:0}));}
 else if(cancel==='layout')input.cancel();
 else canvas.dispatch(cancel,pointer());
 ok(!game.skillAim&&!game.skillUsed,cancel+' restores normal flight without consuming the skill');eq(input.skill.hold,null,cancel+' releases gesture ownership');
 canvas.dispatch('pointerup',pointer(180,{buttons:0}));ok(!game.skillUsed,cancel+' delayed release cannot execute');
}
{
 const {canvas,game,input}=inputReady();canvas.dispatch('pointerdown',pointer());
 canvas.dispatch('pointerdown',pointer(250,{pointerId:2,isPrimary:false}));canvas.dispatch('pointerup',pointer(250,{pointerId:2,isPrimary:false,buttons:0}));
 ok(game.skillAim&&!game.skillUsed,'secondary finger cannot release the first finger skill');eq(input.skill.hold.id,1,'secondary finger cannot take pointer ownership');
 canvas.dispatch('pointerup',pointer(180,{buttons:0}));ok(game.skillUsed,'original finger still commits its skill');
}
for(const skill of ['split','burst']){
 const {canvas,game}=inputReady(skill);canvas.dispatch('pointerdown',pointer());ok(game.skillUsed&&!game.skillAim,skill+' keeps its immediate click action');
}
for(const source of ['canvas-key','button-key','button-pointer','accessible-click']){
 const {canvas,game,input}=inputReady(),button=new Element('button');input.skill.bindButton(button);
 if(source==='canvas-key')input.skill.keyDown(key(' ',canvas));
 if(source==='button-key')button.dispatch('keydown',key('Enter',button));
 if(source==='button-pointer')button.dispatch('pointerdown',pointer());
 if(source==='accessible-click')button.click({detail:0});
 ok(game.skillAim&&!game.skillUsed,source+' enters preview');
 if(source==='canvas-key')input.skill.keyUp(key(' ',canvas));
 if(source==='button-key')button.dispatch('keyup',key('Enter',button));
 if(source==='button-pointer'){button.dispatch('pointerup',pointer(180,{buttons:0}));button.click({detail:1,pointerType:'touch'});}
 if(source==='accessible-click')button.click({detail:0});
 ok(game.skillUsed&&!game.skillAim,source+' commits on release or accessible confirmation');eq(input.skill.hold,null,source+' clears control ownership');
}
{
 const {game,input}=inputReady(),button=new Element('button');input.skill.bindButton(button);button.dispatch('pointerdown',pointer());button.dispatch('pointercancel',pointer());
 button.click({detail:1,pointerType:'touch'});ok(!game.skillAim&&!game.skillUsed,'native click after cancelled button press cannot spend or restart dive');
 button.dispatch('keydown',key(' ',button));input.cancel();const release=button.dispatch('keyup',key(' ',button));ok(release.prevented,'cancelled native Space keyup is prevented to suppress a browser click');
 ok(!game.skillAim&&!game.skillUsed,'cancelled keyboard button has no late activation');
}
{
 const {canvas,game,input}=inputReady();input.skill.keyDown(key(' ',canvas));input.cancel();
 // The user releases outside the browser. A later fresh press must supersede
 // the cancelled key instead of swallowing its own keyup and leaving slowmo.
 input.skill.keyDown(key(' ',canvas));input.skill.keyUp(key(' ',canvas));ok(game.skillUsed&&!game.skillAim,'refocus after a missed outside keyup can commit a fresh Space hold');
}

// Exercise the actual application event wiring, not only controller methods.
function appReady(){
 const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'),ids=new Map();
 for(const match of html.matchAll(/<([a-z]+)[^>]*\bid="([^"]+)"[^>]*>/g))ids.set(match[2],new Element(match[1]));
 const document=new Element('document'),window=new Element('window');document.body=new Element('body');document.documentElement=new Element('html');document.documentElement.dataset.offline='false';document.hidden=false;
 for(const name of ['namesPanel','viewMenu','transferPanel','sceneryPanel'])ids.get(name).hidden=true;
 ids.get('viewPicker').append(ids.get('viewMode'));ids.get('viewPicker').append(ids.get('viewMenu'));
 document.getElementById=id=>{assert.ok(ids.has(id),'app element exists: '+id);return ids.get(id);};document.createElement=tag=>new Element(tag);document.querySelector=()=>new Element();
 window.matchMedia=()=>({matches:true});window.visualViewport=new Element();window.innerWidth=390;window.innerHeight=740;
 const noop=()=>{},ctx=new Proxy({},{get:(o,n)=>n in o?o[n]:n==='createLinearGradient'?()=>({addColorStop:noop}):noop,set:(o,n,v)=>{o[n]=v;return true;}});const canvas=ids.get('game');canvas.getContext=()=>ctx;
 const memory=new Map();let nextFrame,now=0;
 const sandbox={window,document,navigator:{maxTouchPoints:5},console,btoa,atob,localStorage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)},ResizeObserver:class{observe(){}},performance:{now:()=>now},requestAnimationFrame:fn=>{nextFrame=fn;}};
 const context=vm.createContext(sandbox),modules=['names','combat','body','encounters','bounties','relics','collection','core','save-transfer','emotes','feedback','scenery','render','input','display','cloud-save','cloud-client','cloud-ui','app'];
 const code=modules.map(name=>fs.readFileSync(new URL('../dist/'+name+'.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/\bexport /g,'')).join('\n');
 vm.runInContext(code+'\nglobalThis.testApi={game,input,get paused(){return paused;}};',context);
 const api=context.testApi,$=id=>ids.get(id),frame=()=>{now+=16.67;nextFrame(now);};frame();
 const down=(name,target=canvas,extra={})=>window.dispatch('keydown',key(name,target,extra)),up=(name,target=canvas)=>window.dispatch('keyup',key(name,target));
 const prime=()=>{if(api.paused)$('resume').click();document.hidden=false;api.game.save.unlocked=true;api.game.start('rogue',1,'dive');api.game.skip();api.game.obs=[];down(' ');for(let n=0;n<4;n++)api.game.update(.05);up(' ');frame();ok(api.game.canSkill,'app shot has reached second-action window');};
 return {api,canvas,window,document,$,frame,down,up,prime};
}
{
 const {api,canvas,$,frame,down,up,prime}=appReady();prime();
 ok(!api.game.skillAim&&!api.game.skillUsed,'release of the original shooting Space does not auto-dive');
 down(' ');ok(api.game.skillAim&&!api.game.skillUsed,'a fresh Space press starts held preview');down('ArrowRight');eq(api.game.skillAim.tilt,3,'app arrow key steers dive by integer degrees');
 down(' ',canvas,{repeat:true});ok(!api.game.skillUsed,'autorepeat cannot commit held dive');frame();ok($('skillHint').textContent.includes('松手')||$('skillHint').textContent.includes('松开'),'HUD explains the release action');
 up(' ');ok(api.game.skillUsed&&!api.game.skillAim,'global keyup commits dive');
 prime();down(' ');down('Escape');ok(!api.game.skillAim&&!api.game.skillUsed&&!api.paused,'Escape cancels preview before opening pause');up(' ');ok(!api.game.skillUsed,'Escape-cancelled keyup does not fire');
 for(const tag of ['archerName0','mapChoice','resultHome']){prime();down(' ',$(tag));up(' ',$(tag));ok(!api.game.skillAim&&!api.game.skillUsed,'global shortcut does not steal native focus '+tag);}
 const button=$('skillButton');prime();button.dispatch('keydown',key(' ',button));down('ArrowLeft',button);eq(api.game.skillAim.tilt,-3,'focused skill button supports keyboard steering');button.dispatch('keyup',key(' ',button));ok(api.game.skillUsed,'focused skill button releases its dive');
}
for(const cause of ['pause','blur','hidden','layout','restart','home','phase','tab']){
 const {api,window,document,$,down,up,prime}=appReady();prime();down(' ');
 if(cause==='pause')$('pause').click();if(cause==='blur')window.dispatch('blur');if(cause==='hidden'){document.hidden=true;document.dispatch('visibilitychange');}
 if(cause==='layout')$('chooseDesktop').click();if(cause==='restart')$('restart').click();if(cause==='home')$('resultHome').click();if(cause==='phase')api.game.setPhase('settle');if(cause==='tab')down('Tab');
 ok(!api.game.skillAim&&!api.game.skillUsed,cause+' application path clears preview without activating dive');up(' ');ok(!api.game.skillUsed,cause+' late global keyup remains harmless');
}
console.log(checks+' held-skill pointer, keyboard, cancellation, accessibility and real-app event checks passed.');
