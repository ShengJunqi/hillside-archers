import {SCENERY_STYLES,SCENERY_IMAGES,writeScenery} from './scenery.mjs';
import {FEEDBACK_MODES,FEEDBACK_KEY} from './feedback.mjs';
import {setupCloudAccount} from './cloud-ui.mjs';
import {DEFAULT_NAMES,MAX_NAME_LENGTH,normalizeNames,storyNames} from './names.mjs';
import {encodeProgress,decodeProgress,mergeProgress} from './save-transfer.mjs';
import {characterById} from './combat.mjs';
import {Game,W,H,MAPS,UPGRADES,BOWS,synergies,applyUpgrade,validSave,upgradePreview,statusSummary,enemySummary} from './core.mjs';
import {Renderer} from './render.mjs';
import {AimInput} from './input.mjs';
import {readView,writeView,resolveView} from './display.mjs';
const $=id=>document.getElementById(id),canvas=$('game'),renderer=new Renderer(canvas),SAVE_KEY='hillside-archers-save-v2';
let cloudAccount;
let sceneryWasPaused=false,sceneryButtons=[];
let saved,storageReady=true;try{saved=localStorage.getItem(SAVE_KEY);}catch{storageReady=false;}let paused=false,soundOn=false,audio=null,toastUntil=0,lastPhase='',lastBeat=-1,lastNow=0,renderDirty=true,stored=storageReady;
for(const face of ['oblique 400 32px "Smiley Sans"','700 32px "Barlow Condensed"'])document.fonts?.load(face).catch(()=>{});
const game=new Game({save:validSave(saved),onEvent:handleEvent});
const archerName=i=>normalizeNames(game.save.names)[i],namedText=text=>storyNames(text,game.save.names);
let viewStorage;try{viewStorage=globalThis.localStorage;}catch{}
let viewPreference=readView(viewStorage),touchMode=false,seenTouch=Boolean(globalThis.navigator?.maxTouchPoints),lastViewKey='';
const desktopHelp=$('controlHelp').innerHTML,desktopFooter=$('footerHint').textContent;
const input=new AimInput(canvas,game,{isPaused:()=>paused,onChange:()=>updateTouchControls(),onTap:()=>renderer.playEmote(game),onTouch:()=>{seenTouch=true;if(viewPreference==='auto')applyDisplayMode();}});
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
function updateTouchControls(){const aim=touchMode&&game.canAim&&!paused;show('touchControls',aim);show('skipTurn',game.phase==='scout'&&!paused);document.body.classList.toggle('has-touch-controls',aim);$('cancelShot').disabled=!input.drag;$('touchFire').disabled=!!input.drag||!game.canAim||paused;$('angleDown').disabled=!!input.drag||game.angles[game.active]<=5||paused;$('angleUp').disabled=!!input.drag||game.angles[game.active]>=75||paused;}
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
function handleEvent(e){renderDirty=true;if(e.type==='save'){try{localStorage.setItem(SAVE_KEY,JSON.stringify(e.save));stored=true;}catch{stored=false;}cloudAccount?.changed();}if(e.type==='phase')cancelDrag();if(e.type==='shoot')tone(500,.17);if(e.type==='hit')tone(e.head?160:110,.14,'triangle',.07);if(e.type==='break')tone(90,.14,'square',.025);if(e.type==='pickup')tone(800,.24,'sine');if(e.type==='skill')tone(300,.3,'sawtooth',.025);if(e.type==='target')tone(850,.2,'sine');if(e.type==='victory')tone(620,.7,'sine');if(e.type==='defeat')tone(180,.6,'sine');}
function modeName(){return game.mode==='campaign'?'山路三试 / 第 '+game.stage+' 章':game.mode==='rogue'?'无尽远征 / 第 '+game.floor+' 层':game.mode==='local'?'同机双人':game.mode==='target'?'百步穿杨':'自由切磋';}
function show(id,visible){$(id).hidden=!visible;}
function renderHome(){const unlocked=game.save.unlocked;show('campaignQuick',!unlocked);for(const id of ['rogueStart','duelStart','localStart','targetStart']){const b=$(id);b.disabled=!unlocked;b.querySelector('.mode-state').textContent=unlocked?'进入 ↗':'未解锁';}$('mapChoice').disabled=!unlocked;$('campaignStart').innerHTML=(game.save.checkpoint>1?'继续第 '+game.save.checkpoint+' 章':unlocked?'重打热身赛':'先来一箭')+' <span>↗</span>';$('saveNote').textContent=unlocked?'全部模式已解锁 · 主线可随时重温':game.save.checkpoint===1?'新手首战 · 对手半血 · 可跳过教程解锁玩法':'三章故事 · 已走到第 '+game.save.checkpoint+' 章';$('modeNote').textContent=unlocked?'遗物在本次远征叠加，余烬可用于永久修行。':'完成三章，或跳过新手教程，即可解锁全部玩法。';show('campMeta',unlocked);$('embers').textContent='余烬 '+game.save.embers;$('best').textContent='远征最高 '+game.save.best+' 层';for(const [id,key,label] of [['buyBow','bow','练弓'],['buyLife','life','强身']]){const level=game.save[key],cost=3+level*2;$(id).textContent=label+' '+level+'/5 · '+(level===5?'已满':cost+'余烬');$(id).disabled=level>=5||game.save.embers<cost;$(id).title=key==='bow'?'永久增加远征初始箭伤害，每级4%':'永久增加远征初始生命，每级5点';}}
function renderResult(){const win=game.phase==='victory';$('resultKicker').textContent=win?'风 止 · 箭 落':'此 路 未 尽';let title,text,next,reward='';if(game.mode==='target'){title='每一箭，都算数。';text='风中的靶标渐渐安静。记住这一局的落点，下一次，让你的箭更准一些。';next='返回旅营 ↗';reward='本次 '+game.targetScore+' 分 · 命中 '+game.targetHits+' 靶 · 最高 '+game.save.targetBest+' 分';}else if(game.mode==='campaign'){title=win?(game.stage===3?'山河，终有回响。':'前路，已为你打开。'):'下一箭，会更稳。';text=win?(game.stage===3?'星灯重新燃起，光越过长谷，落回山下的每一扇窗。赤岩收起弓，走到你身旁：“前面的路，一起走。”':'赤岩拾起地上的箭，点了点头。青松收好箭袋，沿着山风指向的方向，继续前行。'):'青松倒在石阶旁，手里仍握着那张旧弓。山路没有催促，只是静静等着他再次站起来。';next=win?(game.stage<3?'走向下一章 ↗':'点亮旅营 ↗'):'再试一次 ↗';if(win&&game.stage===3)reward='已解锁：无尽远征 / 自由切磋 / 同机双人 / 百步穿杨';}
 else if(game.mode==='rogue'){title=win?'赢了。下一位倒霉蛋？':'这回，鞋先到终点。';text=win?'对手还在找掉下来的鞋。趁现在选条路，再挑一件遗物——下一场换个地方闹。':'你留下的每一步都不会消失。回到旅营，用余烬修行，再带着新的选择出发。';next=win?'选择遗物 ↗':'返回旅营 ↗';reward='本次抵达 '+game.floor+' 层 · 余烬 '+game.save.embers+' · 最高 '+game.save.best+' 层';}
 else{title=(game.winner===0?'青松':'赤岩')+'，胜。';text='弓弦安静下来。两位弓手收起长弓，向彼此致意。下一场切磋，随时开始。';next='返回旅营 ↗';}
 $('resultTitle').textContent=namedText(title);$('resultText').textContent=namedText(text);$('resultReward').textContent=reward;$('resultNext').textContent=next;}
function renderBows(){const host=$('bowCards');host.replaceChildren();for(const bow of BOWS){const b=document.createElement('button');b.className='relic';b.innerHTML='<span class="symbol" style="color:'+bow.color+'">'+bow.icon+'</span><small>'+bow.skill+'</small><b>'+bow.name+'</b><p>'+bow.desc+'</p><span class="take">带上这张弓 ↗</span>';b.onclick=()=>{if(game.start('rogue',1,bow.id)){setPaused(false);canvas.focus();toast(bow.tip);}};host.append(b);}}
function renderRoutes(){const host=$('routeCards');host.replaceChildren();show('routeHeading',Boolean(game.nextRoutes?.length));for(const r of game.nextRoutes||[]){const b=document.createElement('button');b.className='route-ticket';b.setAttribute('aria-pressed',r.id===game.selectedRoute);b.innerHTML='<span class="route-stamp">'+(r.boss?'首领赛':'第 '+(game.floor+1)+' 场')+'</span><b>'+r.name+'</b><span class="route-detail">'+r.enemy.name+' · '+(r.supply==='hearts'?'爱心较多':'均衡补给')+'</span><small>'+r.tip+'</small>';b.title=r.enemy.tip;b.onclick=()=>{if(game.chooseRoute(r.id))renderRoutes();};host.append(b);}}
function renderChoices(){renderRoutes();const host=$('upgradeCards');host.replaceChildren();for(const u of game.choices){const b=document.createElement('button');b.className='relic';const before=synergies(game.stats),after=synergies(applyUpgrade({...game.stats},u.id)),newPairs=after.filter(s=>!before.some(b=>b.id===s.id));b.innerHTML='<span class="symbol">'+u.icon+'</span><small>'+u.tag+'</small><b>'+u.name+'</b><p>'+u.desc+'</p><span class="upgrade-preview">'+upgradePreview(game.stats,u.id)+'</span>'+(newPairs.length?'<span class="pair-badge">激活 '+newPairs.map(s=>s.name).join(' · ')+'</span>':'')+'<span class="take">带上遗物 ↗</span>';b.onclick=()=>{if(game.chooseUpgrade(u.id)){tone(700,.2,'sine');renderDirty=true;}};host.append(b);}}
function inventory(){const counts={};for(const id of game.upgrades)counts[id]=(counts[id]||0)+1;return Object.entries(counts).map(([id,n])=>({u:UPGRADES.find(u=>u.id===id),n}));}
function renderUI(){const phase=game.phase;if(lastPhase!==phase){lastPhase=phase;if(phase==='home')cloudAccount?.camp();renderDirty=true;lastBeat=-1;for(const [id,p] of [['home','home'],['story','intro'],['result','result'],['upgrade','upgrade'],['loadout','loadout']])show(id,p==='result'?['victory','defeat'].includes(phase):p===phase);if(phase==='home')renderHome();if(['victory','defeat'].includes(phase))renderResult();if(phase==='upgrade')renderChoices();if(phase==='loadout')renderBows();}
 if(renderDirty){if(phase==='home')renderHome();const inv=inventory();$('build').replaceChildren();for(const {u,n} of inv){const el=document.createElement('span');el.textContent=u.name+(n>1?' ×'+n:'');$('build').append(el);}const pairs=synergies(game.stats);for(const pair of pairs){const el=document.createElement('span');el.className='pair-badge';el.textContent=pair.name;el.title=pair.desc;$('build').append(el);}$('inventory').textContent=characterById(game.players[0].characterId).description+'\n\n'+(game.mode==='rogue'?(BOWS.find(b=>b.id===game.skill)||BOWS[0]).tip+'\n\n':'')+(inv.length?inv.map(({u,n})=>u.name+' ×'+n+'：'+u.desc+(u.id==='fire'||u.id==='poison'?'\n下次升级：'+upgradePreview(game.stats,u.id):'')).join('\n'):'当前尚未携带遗物。')+(pairs.length?'\n\n'+pairs.map(p=>p.desc).join('\n'):'')+(game.mode==='rogue'?'\n\n赛场：'+game.encounter.name+'\n'+game.encounter.tip+'\n对手打法：'+game.encounter.enemy.name+' · '+game.encounter.enemy.tip+'\n对手能力：'+enemySummary(game.players[1]):'')+'\n\n当前状态\n'+game.players.map((p,i)=>archerName(i)+'：'+(statusSummary(p.status)||'无异常')).join('\n');renderDirty=false;}
 const gameplay=['scout','thinking','aim','flight','settle'].includes(phase);show('hud',gameplay);$('storageNote').textContent=stored?'本机自动存档':'当前浏览器无法保存进度';show('build',gameplay&&game.mode==='rogue'&&game.upgrades.length>0);show('sceneHint',gameplay&&!['scout','thinking'].includes(phase));$('chapterSub').textContent=modeName();$('chapterName').textContent=game.encounter?.name||MAPS[game.map].name;$('turn').textContent='第 '+game.round+' 回合';const enemyRole=game.encounter?(game.encounter.boss?'擂主 · ':'')+game.encounter.enemy.name:'';$('name1').textContent=archerName(1)+(game.mode==='local'?' · 玩家二':enemyRole?' · '+enemyRole:'');$('name0').textContent=archerName(0)+(game.mode==='local'?' · 玩家一':'');$('portrait0').textContent=Array.from(archerName(0))[0];$('portrait1').textContent=Array.from(archerName(1))[0];$('loadoutName').textContent=archerName(0);
 for(let i=0;i<2;i++){const p=game.players[i];$('hp'+i).textContent=Math.ceil(p.hp)+' / '+p.stats.maxHp;$('bar'+i).style.width=clamp(p.hp/p.stats.maxHp*100,0,100)+'%';const summary=statusSummary(p.status);$('status'+i).textContent=summary.replace(/ · 基础[0-9]+\/轮/g,'');$('status'+i).title=summary;}
 const threat=game.mode==='rogue'?enemySummary(game.players[1]):'';$('enemyTraits').textContent=(game.encounter?.enemy.name||'对手能力')+' · '+threat+(game.encounter?.rule==='collapse'?' · 第5回合中央路障倒下':'');$('enemyTraits').title=(game.encounter?.enemy.tip||'')+' · '+threat;show('enemyTraits',!!threat&&['scout','thinking'].includes(phase));
 show('challengeInfo',gameplay&&game.mode==='target');$('challengeInfo').textContent='得分 '+game.targetScore+' · 落空 '+game.targetMisses+' / 3';document.querySelector('.health.right').hidden=game.mode==='target';show('skillButton',gameplay&&game.mode==='rogue'&&game.active===0&&(!touchMode||phase==='flight'));const bow=BOWS.find(b=>b.id===game.skill)||BOWS[0];$('skillName').textContent=bow.skill+ (game.skillUsed?' · 已施展':'');$('skillButton').disabled=!game.canSkill;$('skillHint').textContent=game.phase==='flight'?(touchMode?'点击施展':'空格 / 点击施展'):'射箭后，在飞行中施展';$('skillButton').title=bow.tip;let banner='';if(phase==='scout')banner=game.phaseTime<game.scoutDuration*.365?(game.mode==='target'?'观察靶标的位置':'观察对手的位置'):'镜头回到 '+archerName(game.active);else if(phase==='thinking')banner=game.mode==='rogue'&&game.opponent.boss?'擂主 · '+game.players[1].stats.multi+'箭蓄力':$('name1').textContent+'正在寻找角度';show('turnBanner',!!banner);$('turnBanner').textContent=banner;$('sceneHint').textContent=phase==='scout'?(touchMode?'点击下方按钮可跳过观察':'空格跳过观察镜头'):phase==='aim'?archerName(game.active)+(touchMode?'的回合 · 拖拽拉弓，轻点互动':'的回合 · 拖拽拉弓，松手射箭 · 轻点做个小动作'):phase==='flight'?(game.volleyCount>1?'箭雨 ×'+game.volleyCount:'一箭已出'):'等待箭落';
 if(phase==='intro'){$('skipStory').textContent=game.save.unlocked?'跳过剧情，开始对决 ↗':'跳过新手教程，解锁玩法 ↗';$('skipStory').title=game.save.unlocked?'只跳过本段剧情':'永久解锁无尽、切磋、双人和射靶，不额外发放奖励';const beat=Math.min(2,Math.floor(game.phaseTime/game.storyBeatDuration));if(beat!==lastBeat){lastBeat=beat;const [speaker,line]=STORIES[game.stage-1][beat];$('storyChapter').textContent='第 '+game.stage+' 章 / '+MAPS[game.map].name;$('speaker').textContent=namedText(speaker);$('storyLine').dataset.full=namedText(line);$('storyDots').innerHTML=[0,1,2].map(i=>'<i class="'+(i===beat?'active':'')+'"></i>').join('');$('nextLine').textContent=beat===2?'开始试炼 ➜':'下一幕 ➜';}$('storyLine').textContent=($('storyLine').dataset.full||'');}
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
function setPaused(value){if(!value){closeScenery(false);closeTransfer(false);closeNames(false);cloudAccount?.close(false);}cancelDrag();paused=value;show('pausePanel',value);$('pause').textContent=value?'继续':'暂停';if(value){renderFeedbackSetting();$('resume').focus();}}
function home(){closeNames(false);closeTransfer(false);setPaused(false);game.goHome();}
function skipTutorial(){setPaused(false);if(game.skipTutorial()){renderDirty=true;lastPhase='';toast(stored?'全部玩法已解锁，也可随时返回主线练习。':'玩法已解锁；浏览器无法保存，可导出迁移码备份。');}}
function closeNames(focus=true){show('namesPanel',false);if(focus)$(game.phase==='home'?'editNamesHome':'editNamesPause').focus();}
function openNames(){closeScenery(false);cloudAccount?.close(false);cancelDrag();closeViewMenu();closeTransfer(false);if(game.phase!=='home')setPaused(true);const names=normalizeNames(game.save.names);$('archerName0').value=names[0];$('archerName1').value=names[1];$('namesMessage').textContent='名字会用于对局、剧情和结算，也会随迁移码保存。';show('namesPanel',true);$('archerName0').focus();}
$('editNamesHome').onclick=openNames;$('editNamesPause').onclick=openNames;$('namesClose').onclick=()=>closeNames();
$('namesReset').onclick=()=>{DEFAULT_NAMES.forEach((name,i)=>{$('archerName'+i).value=name;});$('namesMessage').textContent='已填入默认名字，点击保存生效。';};
$('namesSave').onclick=()=>{const values=[$('archerName0').value,$('archerName1').value];if(values.some(value=>Array.from(value.trim()).length>MAX_NAME_LENGTH)){$('namesMessage').textContent='每个名字最多 '+MAX_NAME_LENGTH+' 个字符。';return;}game.save=validSave({...game.save,names:normalizeNames(values)});game.persist();lastPhase='';lastBeat=-1;renderDirty=true;closeNames();toast(stored?'弓手名字已保存。':'名字已应用；当前浏览器无法保存，可导出迁移码备份。');};
function closeTransfer(focus=true){show('transferPanel',false);if(focus)$(game.phase==='home'?'transferHome':'transferPause').focus();}
function openTransfer(){closeScenery(false);cloudAccount?.close(false);closeNames(false);cancelDrag();closeViewMenu();if(game.phase!=='home')setPaused(true);$('exportProgress').value=encodeProgress(game.save);$('importProgress').value='';$('transferMessage').textContent=game.phase==='home'?'导入会合并永久进度，不会降低已有纪录。':'请先返回旅营，再导入进度。当前进度仍可复制。';$('importProgressButton').disabled=game.phase!=='home';show('transferPanel',true);$('transferClose').focus();}
$('transferHome').onclick=openTransfer;$('transferPause').onclick=openTransfer;$('transferClose').onclick=()=>closeTransfer();
$('copyProgress').onclick=async()=>{try{if(!globalThis.navigator?.clipboard?.writeText)throw new Error('manual');await navigator.clipboard.writeText($('exportProgress').value);$('transferMessage').textContent='已复制，去另一个游戏网址粘贴导入即可。';}catch{$('exportProgress').focus();$('exportProgress').select?.();$('transferMessage').textContent='请长按代码选择复制，或在电脑按 Ctrl/Cmd+C。';}};
$('importProgressButton').onclick=()=>{if(game.phase!=='home'){$('transferMessage').textContent='请先返回旅营，再导入进度。';return;}try{game.save=mergeProgress(game.save,decodeProgress($('importProgress').value));game.persist();renderDirty=true;renderHome();$('exportProgress').value=encodeProgress(game.save);$('transferMessage').textContent=stored?'进度已合并，可以继续旅程。':'进度已合并，但当前浏览器无法保存；关闭页面前请复制新的进度代码。';}catch(error){$('transferMessage').textContent=error.message||'进度代码无效，请重新复制。';}};

function renderSceneryChoices(){
 const host=$('sceneryCards');host.replaceChildren();sceneryButtons=[];
 for(const style of SCENERY_STYLES){
  const button=document.createElement('button'),preview=document.createElement('span'),img=document.createElement('img'),copy=document.createElement('span'),name=document.createElement('b'),description=document.createElement('small'),state=document.createElement('span');
  button.className='scenery-option';button.dataset.style=style.id;button.setAttribute('aria-pressed',renderer.sceneryStyle===style.id);button.setAttribute('type','button');
  preview.className='scenery-preview';img.src=SCENERY_IMAGES[style.asset];img.alt='';img.loading='lazy';img.decoding='async';img.onerror=()=>{img.hidden=true;};preview.append(img);
  copy.className='scenery-option-copy';name.textContent=style.name;description.textContent=style.description;state.className='scenery-state';state.textContent=renderer.sceneryStyle===style.id?'✓ 当前风格':'点选应用';
  copy.append(name);copy.append(description);copy.append(state);button.append(preview);button.append(copy);
  button.onclick=()=>{renderer.setSceneryStyle(style.id);const remembered=writeScenery(viewStorage,style.id);renderSceneryChoices();$('sceneryMessage').textContent='已使用「'+style.name+'」'+(remembered?'，下次打开会记住。':'；浏览器未允许记住偏好。');sceneryButtons.find(b=>b.dataset.style===style.id)?.focus();};
  host.append(button);sceneryButtons.push(button);
 }
}
function openScenery(){
 cloudAccount?.close(false);closeNames(false);closeTransfer(false);closeViewMenu();cancelDrag();sceneryWasPaused=paused;
 if(game.phase!=='home')setPaused(true);else paused=true;
 renderSceneryChoices();$('sceneryMessage').textContent='只换风景，不影响当前回合和进度。';$('sceneryClose').textContent=game.phase==='home'?'选好了，返回旅营 ↗':'选好了，返回游戏 ↗';
 show('sceneryPanel',true);$('sceneryBack').focus();
}
function closeScenery(focus=true,resume=false){
 const wasOpen=!$('sceneryPanel').hidden;show('sceneryPanel',false);if(!wasOpen)return;
 if(resume){if(game.phase==='home')paused=false;else setPaused(false);}else if(game.phase==='home')paused=sceneryWasPaused;
 if(focus)$(game.phase==='home'?'sceneryHome':resume?'pause':'sceneryPause').focus();
}
$('sceneryHome').onclick=openScenery;$('sceneryPause').onclick=openScenery;$('sceneryBack').onclick=()=>closeScenery();$('sceneryClose').onclick=()=>closeScenery(true,true);
function sceneryKey(e){
 if($('sceneryPanel').hidden)return false;
 if(e.key==='Escape'){e.preventDefault();closeScenery();return true;}
 if(e.key==='Tab'){const controls=[$('sceneryBack'),...sceneryButtons,$('sceneryClose')],index=controls.indexOf(document.activeElement),step=e.shiftKey?-1:1;controls[(index+step+controls.length)%controls.length].focus();e.preventDefault();}
 return true;
}

function renderFeedbackSetting(){const label={light:'轻',standard:'标准',off:'关'}[renderer.feedback.mode];$('feedbackMode').textContent='画面震动：'+label+(renderer.reducedMotion?'（跟随系统减少动态）':'');}
$('feedbackMode').onclick=()=>{const f=renderer.feedback;f.mode=FEEDBACK_MODES[(FEEDBACK_MODES.indexOf(f.mode)+1)%FEEDBACK_MODES.length];f.reset();try{localStorage.setItem(FEEDBACK_KEY,f.mode);}catch{}renderFeedbackSetting();};renderFeedbackSetting();
$('brand').onclick=e=>{e.preventDefault();if(game.phase==='home')return;setPaused(true);};$('campaignStart').onclick=()=>{setPaused(false);game.start('campaign',game.save.checkpoint);};$('campaignQuick').onclick=skipTutorial;$('rogueStart').onclick=()=>{if(game.save.unlocked){setPaused(false);game.setPhase('loadout');}};$('loadoutHome').onclick=home;$('targetStart').onclick=()=>{if(game.start('target',Number($('mapChoice').value)))setPaused(false);};$('skillButton').onclick=()=>{if(!paused)game.activateSkill();};$('duelStart').onclick=()=>{if(game.start('duel',Number($('mapChoice').value)))setPaused(false);};$('localStart').onclick=()=>{if(game.start('local',Number($('mapChoice').value)))setPaused(false);};$('buyBow').onclick=()=>{if(game.buy('bow'))toast('练弓完成：下次远征初始箭伤害提高。');};$('buyLife').onclick=()=>{if(game.buy('life'))toast('强身完成：下次远征初始生命提高。');};$('sound').onclick=()=>{soundOn=!soundOn;$('sound').textContent='声音：'+(soundOn?'开':'关');$('sound').setAttribute('aria-pressed',soundOn);tone(600,.1,'sine');};$('view').onclick=()=>{renderer.allView=!renderer.allView;$('view').setAttribute('aria-pressed',renderer.allView);$('view').textContent=renderer.allView?'跟随镜头':'全景';};$('pause').onclick=()=>setPaused(!paused);$('resume').onclick=()=>setPaused(false);$('pauseHome').onclick=home;$('restart').onclick=()=>{const mode=game.mode,stage=game.stage;setPaused(false);game.start(mode,stage,game.skill,game.characterId);};$('resultHome').onclick=home;$('resultNext').onclick=()=>game.resultNext();$('skipStory').onclick=()=>game.save.unlocked?game.skip():skipTutorial();$('nextLine').onclick=()=>game.introNext();$('fullscreen').onclick=toggleFullscreen;
function onKey(e){if(sceneryKey(e))return;if(cloudAccount?.key(e))return;if(e.repeat)return;if(e.key==='Escape'&&!$('namesPanel').hidden){e.preventDefault();closeNames();return;}if(e.key==='Escape'&&!$('transferPanel').hidden){e.preventDefault();closeTransfer();return;}if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;if(e.key==='Escape'){e.preventDefault();if(!$('viewMenu').hidden){closeViewMenu(true);return;}if(input.drag)cancelDrag();else if(paused)setPaused(false);else if(game.phase!=='home')setPaused(true);return;}if(paused||e.target.tagName==='BUTTON')return;if([' ','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();if(input.drag)return;if(e.key===' '){if(game.phase==='intro'&&!game.save.unlocked)skipTutorial();else if(['scout','intro'].includes(game.phase))game.skip();else if(game.canAim)game.shoot();else if(game.canSkill)game.activateSkill();}else if(game.canAim)game.aim(game.angles[game.active]+(e.key==='ArrowRight'?1:-1),game.powers[game.active]);}}
window.addEventListener('keydown',onKey);window.addEventListener('blur',()=>{cancelDrag();if(!['home','victory','defeat','upgrade','loadout'].includes(game.phase))setPaused(true);});document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelDrag();if(!['home','victory','defeat','upgrade','loadout'].includes(game.phase))setPaused(true);}});
cloudAccount=setupCloudAccount({storage:viewStorage,getSave:()=>game.save,applySave:progress=>{game.save=progress;game.persist();lastPhase='';lastBeat=-1;renderDirty=true;renderHome();},atCamp:()=>game.phase==='home',beforeOpen:()=>{closeScenery(false);cancelDrag();closeViewMenu();closeNames(false);closeTransfer(false);if(game.phase!=='home')setPaused(true);}});
function frame(now){const dt=Math.min((now-lastNow)/1000||0,.05);lastNow=now;if(!paused)game.update(dt);renderer.draw(game,dt,{drag:input.drag,paused});renderUI();if(toastUntil&&now>toastUntil){show('toast',false);toastUntil=0;}requestAnimationFrame(frame);}renderUI();requestAnimationFrame(frame);
