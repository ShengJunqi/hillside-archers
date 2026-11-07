import {Game,W,H,MAPS,UPGRADES,BOWS,synergies,applyUpgrade,validSave} from './core.mjs';
import {Renderer} from './render.mjs';
import {AimInput} from './input.mjs';
import {readView,writeView,resolveView} from './display.mjs';
const $=id=>document.getElementById(id),canvas=$('game'),renderer=new Renderer(canvas),SAVE_KEY='hillside-archers-save-v2';
let saved,storageReady=true;try{saved=localStorage.getItem(SAVE_KEY);}catch{storageReady=false;}let paused=false,soundOn=false,audio=null,toastUntil=0,lastPhase='',lastBeat=-1,lastNow=0,renderDirty=true,stored=storageReady;
const game=new Game({save:validSave(saved),onEvent:handleEvent});
let viewStorage;try{viewStorage=globalThis.localStorage;}catch{}
let viewPreference=readView(viewStorage),touchMode=false,seenTouch=Boolean(globalThis.navigator?.maxTouchPoints),lastViewKey='';
const desktopHelp=$('controlHelp').innerHTML,desktopFooter=$('footerHint').textContent;
const input=new AimInput(canvas,game,{isPaused:()=>paused,onChange:()=>updateTouchControls(),onTouch:()=>{seenTouch=true;if(viewPreference==='auto')applyDisplayMode();}});
function viewportInfo(){return {width:window.innerWidth||1280,height:window.innerHeight||720,coarse:Boolean(window.matchMedia?.('(pointer: coarse)').matches||seenTouch)};}
function applyDisplayMode(){
 const env=viewportInfo(),view=resolveView(viewPreference,env),key=[view.layout,view.orientation,view.handset].join(':');
 if(key!==lastViewKey){input.cancel();lastViewKey=key;}
 touchMode=view.layout==='mobile';
 for(const root of [document.documentElement,document.body]){
  root.dataset.layout=view.layout;root.dataset.orientation=view.orientation;root.dataset.handset=String(view.handset);
 }
 document.body.classList.toggle('touch-ui',touchMode);
 $('footerHint').textContent=touchMode?'横屏视野更开阔 · 支持双人轮流操作':desktopFooter;
 $('controlHelp').innerHTML=touchMode?'按住画面向弓手身后拉，松开射箭。<br>拉回圆圈，或点“取消拉弓”撤销。<br>用 − / ＋ 微调角度，也可直接点“射箭”。<br>远征中，箭飞行时再次点击画面或弓术按钮。':desktopHelp;
 $('viewMode').textContent=(viewPreference==='auto'?'自动':touchMode?'手机':'电脑')+' ▾';
 $('autoViewHint').textContent='当前设备：'+(resolveView('auto',env).layout==='mobile'?'手机版':'电脑版');
 for(const [id,value] of [['chooseAuto','auto'],['chooseDesktop','desktop'],['chooseMobile','mobile']])$(id).setAttribute('aria-pressed',viewPreference===value);
 updateTouchControls();resizeGame();
}
function closeViewMenu(focus=false){show('viewMenu',false);$('viewMode').setAttribute('aria-expanded',false);if(focus)$('viewMode').focus();}
function selectView(value){input.cancel();viewPreference=value;writeView(viewStorage,value);closeViewMenu(true);applyDisplayMode();}
$('viewMode').onclick=()=>{input.cancel();const open=$('viewMenu').hidden;show('viewMenu',open);$('viewMode').setAttribute('aria-expanded',open);};
$('chooseAuto').onclick=()=>selectView('auto');$('chooseDesktop').onclick=()=>selectView('desktop');$('chooseMobile').onclick=()=>selectView('mobile');
document.addEventListener('pointerdown',event=>{if(!$('viewPicker').contains(event.target))closeViewMenu();});
function updateTouchControls(){const aim=touchMode&&game.canAim&&!paused;show('touchControls',aim);show('skipTurn',touchMode&&game.phase==='scout'&&!paused);document.body.classList.toggle('has-touch-controls',aim);$('cancelShot').disabled=!input.drag;$('touchFire').disabled=!!input.drag||!game.canAim||paused;$('angleDown').disabled=!!input.drag||game.angles[game.active]<=5||paused;$('angleUp').disabled=!!input.drag||game.angles[game.active]>=75||paused;}
const STORIES=[[
 ['青松','山顶的星灯，已经熄灭了七个夜晚。我背起旧弓，沿着唯一的山路出发。'],
 ['赤岩','一支红羽箭落在脚前。守路人从松影里走出：想去点灯，先让我看看你的本事。'],
 ['青松','我把那支箭捡起，搭上弓弦。山风停了片刻——这一次，换我回答。']
],[
 ['青松','越过青岚，旧关隘横在长谷中央。倒塌的木墙挡住去路，赤岩的红衣在远处招展。'],
 ['赤岩','我的第一支箭，也折在这里。记住：木箱能击碎，木桩能击倒。路，是自己打开的。'],
 ['青松','弓弦响起，木桩应声倾倒。隔着长谷，我终于看见了通往星灯的最后一级石阶。']
],[
 ['青松','星灯就在眼前，灯芯却冰冷如石。赤岩站到另一侧：还差最后一场交锋。'],
 ['赤岩','交锋会唤醒散落的星火。穿过 +1，箭便添一支；穿过爱心，它会为你疗伤。'],
 ['青松','原来，他一直守着最后一点火种。我抬起弓——让这一箭，把山河照亮。']
]];
function tone(freq,dur=.12,type='triangle',vol=.035){if(!soundOn)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const t=audio.currentTime,osc=audio.createOscillator(),gain=audio.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,t);osc.frequency.exponentialRampToValueAtTime(Math.max(45,freq*.55),t+dur);gain.gain.setValueAtTime(vol,t);gain.gain.exponentialRampToValueAtTime(.001,t+dur);osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(t+dur);}catch{}}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;toastUntil=performance.now()+3000;}
function handleEvent(e){renderDirty=true;if(e.type==='save'){try{localStorage.setItem(SAVE_KEY,JSON.stringify(e.save));stored=true;}catch{stored=false;}}if(e.type==='phase')cancelDrag();if(e.type==='shoot')tone(500,.17);if(e.type==='hit')tone(e.head?160:110,.14,'triangle',.07);if(e.type==='break')tone(90,.14,'square',.025);if(e.type==='pickup')tone(800,.24,'sine');if(e.type==='skill')tone(300,.3,'sawtooth',.025);if(e.type==='target')tone(850,.2,'sine');if(e.type==='victory')tone(620,.7,'sine');if(e.type==='defeat')tone(180,.6,'sine');}
function modeName(){return game.mode==='campaign'?'山路三试 / 第 '+game.stage+' 章':game.mode==='rogue'?'无尽远征 / 第 '+game.floor+' 层':game.mode==='local'?'同机双人':game.mode==='target'?'百步穿杨':'自由切磋';}
function show(id,visible){$(id).hidden=!visible;}
function renderHome(){const unlocked=game.save.unlocked;for(const id of ['rogueStart','duelStart','localStart','targetStart']){const b=$(id);b.disabled=!unlocked;b.querySelector('.mode-state').textContent=unlocked?'进入 ↗':'未解锁';}$('mapChoice').disabled=!unlocked;$('campaignStart').innerHTML=(game.save.checkpoint>1?'继续第 '+game.save.checkpoint+' 章':unlocked?'重温山路':'踏上山路')+' <span>↗</span>';$('saveNote').textContent=unlocked?'山路三试已完成 · 全部模式已解锁':'三章故事 · 已走到第 '+game.save.checkpoint+' 章';$('modeNote').textContent=unlocked?'遗物在本次远征叠加，余烬可用于永久修行。':'完成第三章，让旅营的灯火亮起来。';show('campMeta',unlocked);$('embers').textContent='余烬 '+game.save.embers;$('best').textContent='远征最高 '+game.save.best+' 层';for(const [id,key,label] of [['buyBow','bow','练弓'],['buyLife','life','强身']]){const level=game.save[key],cost=3+level*2;$(id).textContent=label+' '+level+'/5 · '+(level===5?'已满':cost+'余烬');$(id).disabled=level>=5||game.save.embers<cost;$(id).title=key==='bow'?'永久增加远征初始箭伤害，每级4%':'永久增加远征初始生命，每级5点';}}
function renderResult(){const win=game.phase==='victory';$('resultKicker').textContent=win?'风 止 · 箭 落':'此 路 未 尽';let title,text,next,reward='';if(game.mode==='target'){title='每一箭，都算数。';text='风中的靶标渐渐安静。记住这一局的落点，下一次，让你的箭更准一些。';next='返回旅营 ↗';reward='本次 '+game.targetScore+' 分 · 命中 '+game.targetHits+' 靶 · 最高 '+game.save.targetBest+' 分';}else if(game.mode==='campaign'){title=win?(game.stage===3?'山河，终有回响。':'前路，已为你打开。'):'下一箭，会更稳。';text=win?(game.stage===3?'星灯重新燃起，光越过长谷，落回山下的每一扇窗。赤岩收起弓，走到你身旁：“前面的路，一起走。”':'赤岩拾起地上的箭，点了点头。青松收好箭袋，沿着山风指向的方向，继续前行。'):'青松倒在石阶旁，手里仍握着那张旧弓。山路没有催促，只是静静等着他再次站起来。';next=win?(game.stage<3?'走向下一章 ↗':'点亮旅营 ↗'):'再试一次 ↗';if(win&&game.stage===3)reward='已解锁：无尽远征 / 自由切磋 / 同机双人 / 百步穿杨';}
 else if(game.mode==='rogue'){title=win?'把胜利，铸成力量。':'旅程停下，余烬未熄。';text=win?'穿过这一道关隘，三件遗物在营火边等待。带上新的力量，走向更深的山路。':'你留下的每一步都不会消失。回到旅营，用余烬修行，再带着新的选择出发。';next=win?'选择遗物 ↗':'返回旅营 ↗';reward='本次抵达 '+game.floor+' 层 · 余烬 '+game.save.embers+' · 最高 '+game.save.best+' 层';}
 else{title=(game.winner===0?'青松':'赤岩')+'，胜。';text='弓弦安静下来。两位弓手收起长弓，向彼此致意。下一场切磋，随时开始。';next='返回旅营 ↗';}
 $('resultTitle').textContent=title;$('resultText').textContent=text;$('resultReward').textContent=reward;$('resultNext').textContent=next;}
function renderBows(){const host=$('bowCards');host.replaceChildren();for(const bow of BOWS){const b=document.createElement('button');b.className='relic';b.innerHTML='<span class="symbol" style="color:'+bow.color+'">'+bow.icon+'</span><small>'+bow.skill+'</small><b>'+bow.name+'</b><p>'+bow.desc+'</p><span class="take">带上这张弓 ↗</span>';b.onclick=()=>{if(game.start('rogue',1,bow.id)){setPaused(false);canvas.focus();toast(bow.tip);}};host.append(b);}}
function renderChoices(){const host=$('upgradeCards');host.replaceChildren();for(const u of game.choices){const b=document.createElement('button');b.className='relic';const before=synergies(game.stats),after=synergies(applyUpgrade({...game.stats},u.id)),newPairs=after.filter(s=>!before.some(b=>b.id===s.id));b.innerHTML='<span class="symbol">'+u.icon+'</span><small>'+u.tag+'</small><b>'+u.name+'</b><p>'+u.desc+'</p>'+(newPairs.length?'<span class="pair-badge">激活 '+newPairs.map(s=>s.name).join(' · ')+'</span>':'')+'<span class="take">带上遗物 ↗</span>';b.onclick=()=>{if(game.chooseUpgrade(u.id)){tone(700,.2,'sine');renderDirty=true;}};host.append(b);}}
function inventory(){const counts={};for(const id of game.upgrades)counts[id]=(counts[id]||0)+1;return Object.entries(counts).map(([id,n])=>({u:UPGRADES.find(u=>u.id===id),n}));}
function renderUI(){const phase=game.phase;if(lastPhase!==phase){lastPhase=phase;renderDirty=true;lastBeat=-1;for(const [id,p] of [['home','home'],['story','intro'],['result','result'],['upgrade','upgrade'],['loadout','loadout']])show(id,p==='result'?['victory','defeat'].includes(phase):p===phase);if(phase==='home')renderHome();if(['victory','defeat'].includes(phase))renderResult();if(phase==='upgrade')renderChoices();if(phase==='loadout')renderBows();}
 if(renderDirty){if(phase==='home')renderHome();const inv=inventory();$('build').replaceChildren();for(const {u,n} of inv){const el=document.createElement('span');el.textContent=u.name+(n>1?' ×'+n:'');$('build').append(el);}const pairs=synergies(game.stats);for(const pair of pairs){const el=document.createElement('span');el.className='pair-badge';el.textContent=pair.name;el.title=pair.desc;$('build').append(el);}$('inventory').textContent=(game.mode==='rogue'?(BOWS.find(b=>b.id===game.skill)||BOWS[0]).tip+'\n\n':'')+(inv.length?inv.map(({u,n})=>u.name+' ×'+n+'：'+u.desc).join('\n'):'当前尚未携带遗物。')+(pairs.length?'\n\n'+pairs.map(p=>p.desc).join('\n'):'');renderDirty=false;}
 const gameplay=['scout','thinking','aim','flight','settle'].includes(phase);show('hud',gameplay);$('storageNote').textContent=stored?'本机自动存档':'当前浏览器无法保存进度';show('build',gameplay&&game.mode==='rogue'&&game.upgrades.length>0);show('sceneHint',gameplay);$('chapterSub').textContent=modeName();$('chapterName').textContent=MAPS[game.map].name;$('turn').textContent='第 '+game.round+' 回合';$('name1').textContent=game.mode==='local'?'赤岩 · 玩家二':game.mode==='rogue'?(game.floor%3===0?'星墟守将':game.floor>=4?(game.floor%3===1?'青毒猎手':'焰羽游侠'):'赤岩'):'赤岩';$('name0').textContent=game.mode==='local'?'青松 · 玩家一':'青松';
 for(let i=0;i<2;i++){const p=game.players[i];$('hp'+i).textContent=Math.ceil(p.hp)+' / '+p.stats.maxHp;$('bar'+i).style.width=clamp(p.hp/p.stats.maxHp*100,0,100)+'%';const s=p.status;$('status'+i).textContent=[s.burnTurns?'灼烧 '+s.burnTurns:'',s.poisonTurns?'中毒 '+s.poisonTurns:'',s.ice?'冰霜':''].filter(Boolean).join(' · ');}
 show('challengeInfo',gameplay&&game.mode==='target');$('challengeInfo').textContent='得分 '+game.targetScore+' · 落空 '+game.targetMisses+' / 3';document.querySelector('.health.right').hidden=game.mode==='target';show('skillButton',gameplay&&game.mode==='rogue'&&game.active===0&&(!touchMode||phase==='flight'));const bow=BOWS.find(b=>b.id===game.skill)||BOWS[0];$('skillName').textContent=bow.skill+ (game.skillUsed?' · 已施展':'');$('skillButton').disabled=!game.canSkill;$('skillHint').textContent=game.phase==='flight'?(touchMode?'点击施展':'空格 / 点击施展'):'射箭后，在飞行中施展';$('skillButton').title=bow.tip;let banner='';if(phase==='scout')banner=game.phaseTime<.95?(game.mode==='target'?'观察靶标的位置':'观察对手的位置'):'镜头回到 '+(game.active===0?'青松':'赤岩');else if(phase==='thinking')banner=$('name1').textContent+'正在寻找角度';show('turnBanner',!!banner);$('turnBanner').textContent=banner;$('sceneHint').textContent=phase==='scout'?(touchMode?'点击下方按钮可跳过观察':'空格跳过观察镜头'):phase==='aim'?(game.active===0?'青松':'赤岩')+(touchMode?'的回合 · 按住画面向后拉弓':'的回合 · 拖拽拉弓，松手射箭'):phase==='flight'?(game.volleyCount>1?'箭雨 ×'+game.volleyCount:'一箭已出'):'等待箭落';
 if(phase==='intro'){const beat=Math.min(2,Math.floor(game.phaseTime/4.5));if(beat!==lastBeat){lastBeat=beat;const [speaker,line]=STORIES[game.stage-1][beat];$('storyChapter').textContent='第 '+game.stage+' 章 / '+MAPS[game.map].name;$('speaker').textContent=speaker;$('storyLine').dataset.full=line;$('storyDots').innerHTML=[0,1,2].map(i=>'<i class="'+(i===beat?'active':'')+'"></i>').join('');$('nextLine').textContent=beat===2?'开始试炼 ➜':'下一幕 ➜';}$('storyLine').textContent=($('storyLine').dataset.full||'').slice(0,Math.floor((game.phaseTime%4.5)*25)+1);}
 $('pause').disabled=phase==='home';updateTouchControls();}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function cancelDrag(){input.cancel();}
function adjustAngle(delta){if(!paused&&!input.drag&&game.canAim)game.aim(game.angles[game.active]+delta,game.powers[game.active]);}
$('angleDown').onclick=()=>adjustAngle(-1);$('angleUp').onclick=()=>adjustAngle(1);
$('touchFire').onclick=()=>{if(!paused&&!input.drag&&game.canAim)game.shoot();};
$('cancelShot').addEventListener('pointerdown',event=>{event.preventDefault();cancelDrag();});
$('cancelShot').onclick=()=>cancelDrag();
$('skipTurn').onclick=()=>{if(!paused&&game.phase==='scout')game.skip();};
let lastCanvasWidth=0,lastCanvasHeight=0;
function resizeGame(){const rect=canvas.getBoundingClientRect();if(rect.width>0&&rect.height>0&&(Math.abs(rect.width-lastCanvasWidth)>.5||Math.abs(rect.height-lastCanvasHeight)>.5)){cancelDrag();lastCanvasWidth=rect.width;lastCanvasHeight=rect.height;renderer.resize(rect.width,rect.height);}}
window.addEventListener('resize',applyDisplayMode);
if(typeof ResizeObserver!=='undefined')new ResizeObserver(resizeGame).observe($('arena'));
window.addEventListener('orientationchange',()=>{cancelDrag();applyDisplayMode();});
window.visualViewport?.addEventListener('resize',resizeGame);
applyDisplayMode();
function fullScreenChanged(){const active=Boolean(document.fullscreenElement||document.webkitFullscreenElement||document.body.classList.contains('immersive'));$('fullscreen').textContent=active?'退出 ↙':'全屏 ↗';$('fullscreen').setAttribute('aria-pressed',active);resizeGame();}
function fallbackFullscreen(){document.body.classList.toggle('immersive');fullScreenChanged();}
async function toggleFullscreen(){cancelDrag();const exit=document.exitFullscreen||document.webkitExitFullscreen,request=$('gameShell').requestFullscreen||$('gameShell').webkitRequestFullscreen;$('fullscreen').disabled=true;try{if(document.fullscreenElement||document.webkitFullscreenElement){await exit.call(document);}else if(document.body.classList.contains('immersive')){fallbackFullscreen();}else if(request){try{await request.call($('gameShell'));}catch{fallbackFullscreen();}}else fallbackFullscreen();}catch{toast('未能切换全屏，请重试。');}finally{$('fullscreen').disabled=false;fullScreenChanged();}}
document.addEventListener('fullscreenchange',fullScreenChanged);document.addEventListener('webkitfullscreenchange',fullScreenChanged);
function setPaused(value){cancelDrag();paused=value;show('pausePanel',value);$('pause').textContent=value?'继续':'暂停';if(value)$('resume').focus();}
function home(){setPaused(false);game.goHome();}
$('brand').onclick=e=>{e.preventDefault();if(game.phase==='home')return;setPaused(true);};$('campaignStart').onclick=()=>{setPaused(false);game.start('campaign',game.save.checkpoint);};$('rogueStart').onclick=()=>{if(game.save.unlocked){setPaused(false);game.setPhase('loadout');}};$('loadoutHome').onclick=home;$('targetStart').onclick=()=>{if(game.start('target',Number($('mapChoice').value)))setPaused(false);};$('skillButton').onclick=()=>{if(!paused)game.activateSkill();};$('duelStart').onclick=()=>{if(game.start('duel',Number($('mapChoice').value)))setPaused(false);};$('localStart').onclick=()=>{if(game.start('local',Number($('mapChoice').value)))setPaused(false);};$('buyBow').onclick=()=>{if(game.buy('bow'))toast('练弓完成：下次远征初始箭伤害提高。');};$('buyLife').onclick=()=>{if(game.buy('life'))toast('强身完成：下次远征初始生命提高。');};$('sound').onclick=()=>{soundOn=!soundOn;$('sound').textContent='声音：'+(soundOn?'开':'关');$('sound').setAttribute('aria-pressed',soundOn);tone(600,.1,'sine');};$('view').onclick=()=>{renderer.allView=!renderer.allView;$('view').setAttribute('aria-pressed',renderer.allView);$('view').textContent=renderer.allView?'跟随镜头':'全景';};$('pause').onclick=()=>setPaused(!paused);$('resume').onclick=()=>setPaused(false);$('pauseHome').onclick=home;$('restart').onclick=()=>{const mode=game.mode,stage=game.stage;setPaused(false);game.start(mode,stage,game.skill);};$('resultHome').onclick=home;$('resultNext').onclick=()=>game.resultNext();$('skipStory').onclick=()=>game.skip();$('nextLine').onclick=()=>game.introNext();$('fullscreen').onclick=toggleFullscreen;
function onKey(e){if(e.repeat)return;if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;if(e.key==='Escape'){e.preventDefault();if(!$('viewMenu').hidden){closeViewMenu(true);return;}if(input.drag)cancelDrag();else if(paused)setPaused(false);else if(game.phase!=='home')setPaused(true);return;}if(paused||e.target.tagName==='BUTTON')return;if([' ','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();if(input.drag)return;if(e.key===' '){if(['scout','intro'].includes(game.phase))game.skip();else if(game.canAim)game.shoot();else if(game.canSkill)game.activateSkill();}else if(game.canAim)game.aim(game.angles[game.active]+(e.key==='ArrowRight'?1:-1),game.powers[game.active]);}}
window.addEventListener('keydown',onKey);window.addEventListener('blur',()=>{cancelDrag();if(!['home','victory','defeat','upgrade','loadout'].includes(game.phase))setPaused(true);});document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelDrag();if(!['home','victory','defeat','upgrade','loadout'].includes(game.phase))setPaused(true);}});
function frame(now){const dt=Math.min((now-lastNow)/1000||0,.05);lastNow=now;if(!paused)game.update(dt);renderer.draw(game,dt,{drag:input.drag,paused});renderUI();if(toastUntil&&now>toastUntil){show('toast',false);toastUntil=0;}requestAnimationFrame(frame);}renderUI();requestAnimationFrame(frame);
