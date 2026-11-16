import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;},eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
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
function appReady(){
 const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'),ids=new Map();
 for(const match of html.matchAll(/<([a-z]+)[^>]*\bid="([^"]+)"[^>]*>/g))ids.set(match[2],new Element(match[1]));
 const document=new Element('document'),window=new Element('window');document.body=new Element('body');document.documentElement=new Element('html');document.documentElement.dataset.offline='false';document.hidden=false;
 for(const name of ['namesPanel','viewMenu','transferPanel','sceneryPanel','shopPanel'])ids.get(name).hidden=true;
 ids.get('viewPicker').append(ids.get('viewMode'));ids.get('viewPicker').append(ids.get('viewMenu'));
 document.getElementById=id=>{assert.ok(ids.has(id),'app element exists: '+id);return ids.get(id);};document.createElement=tag=>new Element(tag);document.querySelector=()=>new Element();
 window.matchMedia=()=>({matches:true});window.visualViewport=new Element();window.innerWidth=390;window.innerHeight=740;
 const noop=()=>{},ctx=new Proxy({},{get:(o,n)=>n in o?o[n]:n==='createLinearGradient'?()=>({addColorStop:noop}):noop,set:(o,n,v)=>{o[n]=v;return true;}});const canvas=ids.get('game');canvas.getContext=()=>ctx;
 const memory=new Map();let nextFrame,now=0;
 const sandbox={window,document,navigator:{maxTouchPoints:5},console,btoa,atob,localStorage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)},ResizeObserver:class{observe(){}},performance:{now:()=>now},requestAnimationFrame:fn=>{nextFrame=fn;}};
 const context=vm.createContext(sandbox),modules=['names','combat','body','encounters','bounties','relics','collection','core','save-transfer','emotes','feedback','scenery','render','input','display','cloud-save','cloud-client','cloud-ui','app'];
 const code=modules.map(name=>fs.readFileSync(new URL('../dist/'+name+'.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/\bexport /g,'')).join('\n');
 vm.runInContext(code+'\nglobalThis.testApi={game,input,permanentProgress,get paused(){return paused;}};',context);
 const api=context.testApi,$=id=>ids.get(id),frame=()=>{now+=16.67;nextFrame(now);};frame();
 const down=(name,target=canvas,extra={})=>window.dispatch('keydown',{key:name,target,preventDefault(){},...extra}),up=(name,target=canvas)=>window.dispatch('keyup',{key:name,target,preventDefault(){}});
 const prime=()=>{if(api.paused)$('resume').click();document.hidden=false;api.game.save.unlocked=true;api.game.start('rogue',1,'dive');api.game.skip();api.game.obs=[];down(' ');for(let n=0;n<4;n++)api.game.update(.05);up(' ');frame();ok(api.game.canSkill,'app shot has reached second-action window');};
 return {api,canvas,window,document,$,frame,down,up,prime,html,memory};
}

// Tests run the shipped application against DOM events, not a browser layout.
{
 const {api,$,frame,html,down,up}=appReady(),g=api.game;g.save.unlocked=true;g.start('rogue',1,'dive');g.skip();frame();
 ok(html.indexOf('id="arrowDock"')<html.indexOf('id="chooseNormalArrow"')&&html.indexOf('id="chooseSpecialArrow"')<html.indexOf('id="skillButton"'),'selector and the old skill action share the left-side dock');
 const css=fs.readFileSync(new URL('../dist/mobile.css',import.meta.url),'utf8');
 ok(css.includes('.arrow-dock { position:absolute; left:3%; right:auto;'),'desktop dock is anchored on the left rather than the old right');
 ok(css.includes('body[data-layout="mobile"] .arrow-dock { left:12px; right:auto;'),'mobile dock retains a left anchor');
 ok(!$('arrowDock').hidden&&!$('arrowChoices').hidden,'own aiming turn offers arrow selection');
 eq(g.arrowType,'special','a new stocked run preserves the familiar special-ready default');
 $('chooseNormalArrow').click();frame();eq(g.arrowType,'normal','ordinary selection reaches the real game model');eq($('chooseNormalArrow').attributes['aria-pressed'],true,'ordinary selection exposes pressed state');
 const ammo=g.specialAmmo;$('touchFire').click();for(let n=0;n<4;n++)g.update(.05);frame();
 eq(g.volleyArrowType,'normal','firing locks the chosen ordinary arrow into this volley');ok(!g.canSkill&&$('skillButton').disabled,'ordinary flight never offers a hidden special activation');eq(g.specialAmmo,ammo,'ordinary shot has not spent scarce ammunition');
 ok($('arrowChoices').hidden&&$('chooseSpecialArrow').disabled,'flight cannot silently change its selected arrow type');ok($('skillHint').textContent.includes('普通箭'),'left action explains why a normal volley has no skill');
 g.start('rogue',1,'dive');g.skip();frame();$('chooseSpecialArrow').click();$('touchFire').click();for(let n=0;n<4;n++)g.update(.05);frame();
 ok(g.canSkill&&!$('skillButton').hidden&&!$('skillButton').disabled,'left action exposes the selected special volley');down(' ');frame();ok(g.skillAim,'the relocated action keeps held pre-aim');up(' ');frame();eq(g.specialAmmo,1,'release consumes one charge exactly once');
 g.specialAmmo=0;g.phase='aim';frame();eq(g.arrowType,'normal','empty inventory falls back to an ordinary selection');ok($('chooseSpecialArrow').disabled,'an empty magazine cannot be armed through the selector');
}
{
 const {api,$,frame,down,memory}=appReady(),g=api.game;g.goHome();
 g.save.collection={version:1,revision:1,tokens:3,stats:{wins:1,heads:0,casts:0,covers:0,bosses:0},claimed:['first_win'],owned:[],skin:'base',talent:'none'};
 $('shopHome').click();frame();ok(!$('shopPanel').hidden&&api.paused,'camp shop opens as a modal and pauses background handling');
 eq($('shopCards').children.length,6,'catalogue exposes four skins and two extra talents');eq($('achievementCards').children.length,6,'achievement book shows all actual objectives');
 ok($('shopTokens').textContent.includes('3'),'wallet reflects the real collection balance');
 const first=$('shopCards').children[0].children[1].children[3],locked=$('shopCards').children[1].children[1].children[3];
 ok(!first.disabled&&locked.disabled,'earned and locked purchase qualifications are distinct');const beforeStats=JSON.stringify(g.stats);first.click();frame();
 eq(g.collection.tokens,0,'skin purchase spends exactly its stated cost');ok(g.collection.owned.includes('skin_sunset'),'purchase creates a real owned cosmetic');first.onclick();eq(g.collection.tokens,0,'a stale double purchase cannot charge twice');
 $('shopCards').children[0].children[1].children[3].click();frame();eq(g.collection.skin,'skin_sunset','owned cosmetic equips through the real model');eq(JSON.stringify(g.stats),beforeStats,'cosmetic shopping does not grant combat statistics');
 ok(JSON.parse(memory.get('hillside-archers-save-v2')).collection.owned.includes('skin_sunset'),'normal shop mutation is actually persisted');
 $('shopAchievementsTab').click();frame();ok(!$('shopAchievements').hidden&&$('shopItems').hidden,'achievement tab changes the visible panel');
 eq($('shopAchievementsTab').attributes['aria-selected'],true,'selected tab is available to assistive technology');down('ArrowLeft',$('shopAchievementsTab'));ok(!$('shopItems').hidden,'tab keyboard navigation returns to goods');
 down('Escape',$('shopItemsTab'));ok($('shopPanel').hidden&&!api.paused,'Escape closes the shop and restores camp interaction');
}
{
 const {api,$,frame,down,memory}=appReady(),g=api.game;g.goHome();g.save.unlocked=true;g.persist();const normal=JSON.stringify(g.permanentSave),stored=memory.get('hillside-archers-save-v2');
 $('shopHome').click();$('authorCode').value='incorrect';$('authorApply').click();frame();ok(!g.authorMode,'an unrecognized code does not enable practice');
 $('authorCode').value='SHENG-ARCHER-2026';down('Enter',$('authorCode'));frame();ok(g.authorMode,'the code enters the real isolated practice mode');
 ok(!$('practiceBadge').hidden&&!$('authorExit').hidden,'practice is visibly labelled and has an exit');eq(JSON.stringify(g.permanentSave),normal,'official save remains untouched while practice inventory opens');
 eq(g.collection.owned.length,6,'practice can inspect all six purchasable items');ok(g.collection.tokens>=9999,'practice wallet permits creator inspection');
 $('shopCards').children[2].children[1].children[3].click();frame();eq(g.collection.skin,'skin_storm','creator can preview a different practice skin');eq(JSON.stringify(g.permanentSave),normal,'practice equipment cannot overwrite formal cosmetics');eq(memory.get('hillside-archers-save-v2'),stored,'practice actions never write cheated currency to local permanent storage');
 $('shopClose').click();g.save.best=9999;$('transferHome').click();frame();ok($('importProgressButton').disabled,'practice cannot import into a formal progress bundle');
 const exported=JSON.parse(atob($('exportProgress').value.slice(4)));eq(exported.best,JSON.parse(normal).best,'transfer export uses the original formal record, not the cheated run');
 $('transferClose').click();$('shopHome').click();$('authorExit').click();frame();ok(!g.authorMode,'creator exits practice without reloading');eq(JSON.stringify(g.permanentSave),normal,'exit restores the entire normal bundle');
 ok($('practiceBadge').hidden&&$('authorExit').hidden,'formal mode removes practice indicators');eq(memory.get('hillside-archers-save-v2'),stored,'practice exit does not replace stored formal progress');
}
console.log(checks+' left-arrow selection, shop, achievement, practice isolation and shipped-app UI checks passed (DOM adapter; not browser QA).');
