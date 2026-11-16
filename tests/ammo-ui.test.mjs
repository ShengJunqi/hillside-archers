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
 const down=(name,target=canvas,extra={})=>window.dispatch('keydown',{key:name,target,preventDefault(){},...extra}),up=(name,target=canvas)=>window.dispatch('keyup',{key:name,target,preventDefault(){}});
 const prime=()=>{if(api.paused)$('resume').click();document.hidden=false;api.game.save.unlocked=true;api.game.start('rogue',1,'dive');api.game.skip();api.game.obs=[];down(' ');for(let n=0;n<4;n++)api.game.update(.05);up(' ');frame();ok(api.game.canSkill,'app shot has reached second-action window');};
 return {api,canvas,window,document,$,frame,down,up,prime,html};
}

// Run the shipped app against a DOM/event adapter; this is not browser QA.
{
 const {api,$,frame,html}=appReady();api.game.save.unlocked=true;api.game.goHome();frame();
 $('rogueStart').click();frame();
 ok(html.includes('普箭不限量')&&html.includes('每关补1发'),'loadout explains ordinary arrows and the per-level refill');
 ok(html.includes('每两关选择一次强化'),'loadout explains the less frequent, stronger reward cadence');
 $('bowCards').children[1].click();frame();
 eq(api.game.specialAmmo,2,'loadout begins with the actual initial special ammo');
 eq(api.game.phase,'scout','choosing a bow keeps the established opening flow');
 api.game.skip();frame();$('touchFire').click();for(let i=0;i<4;i++)api.game.update(.05);frame();
 ok(!$('skillButton').hidden&&!$('skillButton').disabled,'eligible flight still exposes its skill action');
 ok($('skillName').textContent.includes('特箭 2/5'),'flight HUD shows actual remaining finite ammunition');
 api.game.beginSkillAim();frame();
 ok($('skillName').textContent.includes('预瞄')&&$('skillName').textContent.includes('2/5'),'preview does not visually spend a charge');
 api.game.cancelSkillAim();frame();ok($('skillName').textContent.includes('2/5'),'cancellation retains the displayed ammo');
 api.game.beginSkillAim();api.game.releaseSkillAim();frame();
 ok($('skillName').textContent.includes('特箭 1/5'),'release immediately shows the one spent charge');
 ok($('skillHint').textContent.includes('本轮已施展'),'used volley state is explained separately from remaining ammo');
 $('pause').click();frame();
 ok($('inventory').textContent.includes('特箭 1/5')&&$('inventory').textContent.includes('普箭不限量'),'pause inventory shows the same finite resource and unlimited fallback');
 $('resume').click();api.game.specialAmmo=0;api.game.phase='aim';api.game.shoot();for(let i=0;i<4;i++)api.game.update(.05);frame();
 ok(api.game.phase==='flight'&&$('skillButton').disabled,'empty ammo still permits a real ordinary flight');
 ok($('skillHint').textContent.includes('特箭耗尽')&&$('skillHint').textContent.includes('普箭'),'empty HUD explains that ordinary shooting continues');
 $('restart').click();frame();eq(api.game.specialAmmo,2,'restart resets the run inventory instead of keeping exhausted ammunition');
}
{
 const {api,$,frame}=appReady(),g=api.game;g.save.unlocked=true;g.start('rogue');g.specialAmmo=1;g.rerolls=2;g.complete(true);frame();
 ok($('resultNext').textContent.includes('补给')&&!$('resultNext').textContent.includes('遗物'),'odd-floor result points to supplies rather than a nonexistent reward');
 ok($('resultReward').textContent.includes('1 → 2/5'),'result forecasts the actual capped next-floor refill');
 $('resultNext').click();frame();
 eq(g.phase,'upgrade','odd floor retains the route-selection screen');
 eq($('routeCards').children.length,2,'odd supply stop still offers both real next routes');
 ok(!$('continueRun').hidden&&$('upgradeCards').hidden,'supply-only stop offers its direct next-stage action');
 eq($('upgradeCards').children.length,0,'odd stop has no misleading relic cards');
 ok($('rerollUpgrades').hidden,'odd stop retains but does not offer to spend rerolls');
 ok($('upgradeNote').textContent.includes('下一关胜利后'),'supply copy explains when the next actual reward arrives');
 const route=g.nextRoutes[1].id;$('routeCards').children[1].click();
 eq(g.selectedRoute,route,'supply stop can select the alternate terrain');
 $('continueRun').click();frame();
 eq(g.floor,2,'supply action advances exactly one floor');eq(g.specialAmmo,2,'supply action grants exactly one carried charge');
 eq(g.encounter.id,route,'supply action enters the chosen real terrain');eq(g.upgrades.length,0,'odd supply action does not silently grant a relic');eq(g.rerolls,2,'odd stop leaves saved rerolls intact');
 $('continueRun').onclick();eq(g.floor,2,'late hidden supply click cannot skip another floor');
 g.complete(true);frame();ok($('resultNext').textContent.includes('强化'),'even-floor result advertises the real special reward');
 $('resultNext').click();frame();
 ok($('continueRun').hidden&&!$('upgradeCards').hidden,'reward stop uses its familiar direct-choice flow');
 eq($('upgradeCards').children.length,3,'even stop offers three actual choices');
 ok(!$('rerollUpgrades').hidden,'saved rerolls become available at the real reward stop');
 $('rerollUpgrades').click();frame();eq(g.rerolls,1,'reward reroll action spends one earned credit');eq($('upgradeCards').children.length,3,'reroll re-renders all three actual offers');
 const chosen=g.choices[0].id;$('upgradeCards').children[0].click();frame();
 eq(g.floor,3,'choosing a buff goes straight to the next floor');eq(g.specialAmmo,3,'reward transition also refills one special charge');
 ok(g.upgrades.includes(chosen),'clicked reward is the actual gained buff');
 g.specialAmmo=g.specialAmmoMax;g.complete(true);frame();$('resultNext').click();frame();
 ok($('upgradeNote').textContent.includes('已备满'),'full reserves are shown without promising another extra charge');
 $('continueRun').click();frame();eq(g.specialAmmo,g.specialAmmoMax,'full reserves stay within capacity after the UI action');
 g.goHome();g.start('campaign');g.skip();frame();
 ok($('skillButton').hidden,'finite-ammo HUD does not appear in campaign');
}
{
 const {api,$,frame}=appReady(),g=api.game;g.save.unlocked=true;g.start('rogue');g.floor=2;g.stats.fire=2;g.stats.poison=3;
 g.choices=[{id:'fire',name:'焰羽',tag:'火焰',icon:'焰',desc:'强化火焰'},{id:'poison',name:'青毒',tag:'毒素',icon:'毒',desc:'强化毒素'},{id:'ice',name:'霜弦',tag:'冰霜',icon:'霜',desc:'强化冰霜'}];
 const stats=JSON.stringify(g.stats);g.setPhase('upgrade');frame();
 ok($('upgradeCards').children[0].innerHTML.includes('2 → 4'),'reward cards show the stronger two-tier fire improvement');
 ok($('upgradeCards').children[1].innerHTML.includes('3 → 5'),'reward cards show the stronger two-tier poison improvement');
 ok($('upgradeCards').children[2].innerHTML.includes('激活 融爆'),'reward preview still announces a real new elemental combination');
 eq(JSON.stringify(g.stats),stats,'rendering stronger choices does not mutate the actual held build');
}
console.log(checks+' finite-ammo HUD, supply-only route, two-floor reward and real-app transition checks passed (DOM adapter; not browser QA).');
