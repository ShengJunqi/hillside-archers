import {COLLECTION_ITEMS,ACHIEVEMENTS,validCollection,achievementProgress} from './collection.mjs';
import {ARENAS} from './encounters.mjs';
import {applyRewardUpgrade,rewardUpgradePreview} from './relics.mjs';
import {bountyFor,bountyProgressText} from './bounties.mjs';
import {SCENERY_STYLES,SCENERY_IMAGES,writeScenery} from './scenery.mjs';
import {FEEDBACK_MODES,FEEDBACK_KEY} from './feedback.mjs';
import {setupCloudAccount} from './cloud-ui.mjs';
import {DEFAULT_NAMES,MAX_NAME_LENGTH,normalizeNames,storyNames} from './names.mjs';
import {encodeProgress,decodeProgress,mergeProgress} from './save-transfer.mjs';
import {CHARACTERS,characterById} from './combat.mjs';
import {Game,W,H,MAPS,UPGRADES,BOWS,synergies,validSave,statusSummary,enemySummary} from './core.mjs';
import {Renderer,drawArenaPreview} from './render.mjs';
import {AimInput} from './input.mjs';
import {readView,writeView,resolveView} from './display.mjs';
const $=id=>document.getElementById(id),canvas=$('game'),renderer=new Renderer(canvas),SAVE_KEY='hillside-archers-save-v2';
let cloudAccount;
let pauseTab='overview';
let shopWasPaused=false,shopButtons=[],shopTab='items';
let sceneryWasPaused=false,sceneryButtons=[],selectedCharacterId='qingsong';
let saved,storageReady=true;try{saved=localStorage.getItem(SAVE_KEY);}catch{storageReady=false;}let paused=false,soundOn=false,audio=null,toastUntil=0,lastPhase='',lastBeat=-1,lastNow=0,renderDirty=true,stored=storageReady;
for(const face of ['oblique 400 32px "Smiley Sans"','700 32px "Barlow Condensed"'])document.fonts?.load(face).catch(()=>{});
const game=new Game({save:validSave(saved),onEvent:handleEvent});
const archerName=i=>normalizeNames(game.save.names)[i],namedText=text=>storyNames(text,game.save.names);
let viewStorage;try{viewStorage=globalThis.localStorage;}catch{}
let viewPreference=readView(viewStorage),touchMode=false,seenTouch=Boolean(globalThis.navigator?.maxTouchPoints),lastViewKey='';
const mapHost=$('mapChoice');mapHost.replaceChildren();for(const [i,a] of ARENAS.entries()){const option=document.createElement('option');option.value=String(i+1);option.textContent=a.name+' · '+a.kind;mapHost.append(option);}
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
 $('controlHelp').innerHTML=touchMode?'按住画面向弓手身后拉，松开射箭。<br>拉回圆圈，或点“取消拉弓”撤销。<br>用 − / ＋ 微调角度；“弓力”切换轻／半／强／满，再点射箭。<br>远征中，箭飞行时施展弓术；星坠按住预瞄，左右拖动调整，松手落箭。':desktopHelp;
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
function updateTouchControls(){updateArrowDock();const aim=touchMode&&game.canAim&&!paused;show('touchControls',aim);show('skipTurn',game.phase==='scout'&&!paused);document.body.classList.toggle('has-touch-controls',aim);$('cancelShot').disabled=!input.drag;$('touchFire').disabled=!!input.drag||!game.canAim||paused;$('angleDown').disabled=!!input.drag||game.angles[game.active]<=5||paused;$('angleUp').disabled=!!input.drag||game.angles[game.active]>=75||paused;$('powerMode').disabled=!!input.drag||!game.canAim||paused;const power=game.powers[game.active];$('powerMode').textContent='弓力：'+(power<=50?'轻':power<=75?'半':power<=90?'强':'满');}
function updateArrowDock(){
 const own=game.mode==='rogue'&&game.active===0&&['aim','flight'].includes(game.phase)&&!paused;
 show('arrowDock',own);show('arrowChoices',own&&game.canAim);
 const normal=game.arrowType==='normal',ammo=game.specialAmmo??0;
 $('chooseNormalArrow').setAttribute('aria-pressed',normal);$('chooseSpecialArrow').setAttribute('aria-pressed',!normal);
 $('chooseNormalArrow').disabled=!game.canAim||paused||!!input.drag;$('chooseSpecialArrow').disabled=!game.canAim||paused||!!input.drag||ammo<=0;
 $('specialArrowLabel').textContent=(BOWS.find(b=>b.id===game.skill)||BOWS[0]).skill+'特箭';$('specialArrowStock').textContent='剩余 '+ammo+'/'+(game.specialAmmoMax??5)+' · 整轮共用';
 document.body.classList.toggle('has-arrow-dock',own);
}
function chooseArrow(type){if(paused||!game.canAim)return;cancelDrag();if(game.selectArrowType?.(type)){updateTouchControls();renderDirty=true;}}
$('chooseNormalArrow').onclick=()=>chooseArrow('normal');$('chooseSpecialArrow').onclick=()=>chooseArrow('special');
const permanentProgress=()=>game.permanentSave??game.save;
function applyPermanentProgress(progress){if(typeof game.applyPermanentSave==='function')game.applyPermanentSave(progress);else game.save=validSave(progress);}
const STORIES=[[
 ['青松','我报名山路巡回赛，忘了带报名费。主办方说：先用箭术抵。'],
 ['赤岩','放心，都是练习箭。护具包退——人不包。先看清我站哪，再回你的坡上拉弓。'],
 ['青松','他的头盔写着“尽量别打脸”。我决定先从身体和腿试起。']
],[
 ['青松','主办方把赛场搬到两岸，说这样只要付一半场租。就是箭得飞远一点。'],
 ['赤岩','木箱两击碎，木桩一箭倒。先拆路也行，越过去也行，别照抄上场角度。'],
 ['青松','我量了量距离，发现最费钱的不是场租，是找射丢的箭。']
],[
 ['青松','最后一场，颁奖台歪了。我站高处，赤岩在下面，裁判坚称这是地形特色。'],
 ['赤岩','高处别只会满弓。射穿 +1 添一支箭，穿过爱心给自己回血；看准落点再出手。'],
 ['青松','观众开始喊加戏。行，那就把这一箭，打成今天的名场面。']
]];
function tone(freq,dur=.12,type='triangle',vol=.035){if(!soundOn)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const t=audio.currentTime,osc=audio.createOscillator(),gain=audio.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,t);osc.frequency.exponentialRampToValueAtTime(Math.max(45,freq*.55),t+dur);gain.gain.setValueAtTime(vol,t);gain.gain.exponentialRampToValueAtTime(.001,t+dur);osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(t+dur);}catch{}}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;toastUntil=performance.now()+3000;}
function handleEvent(e){renderDirty=true;if(e.type==='save'){try{localStorage.setItem(SAVE_KEY,JSON.stringify(e.save));stored=true;}catch{stored=false;}cloudAccount?.changed();}if(e.type==='phase')cancelDrag();if(e.type==='shoot')tone(500,.17);if(e.type==='finisher')tone(e.part==='head'?130:95,.21,'triangle',.075);if(e.type==='hit')tone(e.head?160:110,.14,'triangle',.07);if(e.type==='break')tone(90,.14,'square',.025);if(e.type==='pickup')tone(800,.24,'sine');if(e.type==='skill')tone(300,.3,'sawtooth',.025);if(e.type==='bounty'){tone(880,.24,'sine');toast(e.rerolls?'悬赏完成：获得一次遗物重选。':e.heal?'悬赏完成：观众请喝水，回复 '+e.heal+' 生命。':'悬赏完成！');}if(e.type==='achievement'){toast('成就达成 · '+(e.name||e.achievement?.name||'新成就'));if(!$('shopPanel').hidden)renderShop();}if(e.type==='target')tone(850,.2,'sine');if(e.type==='victory')tone(620,.7,'sine');if(e.type==='defeat')tone(180,.6,'sine');}
function specialAmmoText(){return '特箭 '+(game.specialAmmo??0)+'/'+(game.specialAmmoMax??5);}
function nextSupplyText(){const current=game.specialAmmo??0,max=game.specialAmmoMax??5,gain=Math.max(0,Math.min(max,current+1)-current);return gain?'下一关特箭 +'+gain+' · '+current+' → '+(current+gain)+'/'+max:'特箭已备满 '+current+'/'+max;}
function modeName(){return game.mode==='campaign'?'山路三试 / 第 '+game.stage+' 章':game.mode==='rogue'?'无尽远征 / 第 '+game.floor+' 层':game.mode==='local'?'同机双人':game.mode==='target'?'百步穿杨':'自由切磋';}
function show(id,visible){$(id).hidden=!visible;}
function renderHome(){const unlocked=game.save.unlocked||game.authorMode;show('campaignQuick',!unlocked);for(const id of ['rogueStart','duelStart','localStart','targetStart']){const b=$(id);b.disabled=!unlocked;b.querySelector('.mode-state').textContent=unlocked?'进入 ↗':'未解锁';}$('mapChoice').disabled=!unlocked;$('campaignStart').innerHTML=(game.save.checkpoint>1?'继续第 '+game.save.checkpoint+' 章':unlocked?'重打热身赛':'先来一箭')+' <span>↗</span>';$('saveNote').textContent=game.authorMode?'作者练习 · 独立副本，不计正式进度':unlocked?'全部模式已解锁 · 主线可随时重温':game.save.checkpoint===1?'新手首战 · 对手半血 · 可跳过教程解锁玩法':'三章故事 · 已走到第 '+game.save.checkpoint+' 章';$('modeNote').textContent=game.authorMode?'退出作者练习后，恢复原来的存档和商店装备。':unlocked?'遗物在本次远征叠加，余烬可用于永久修行。':'完成三章，或跳过新手教程，即可解锁全部玩法。';show('campMeta',unlocked);$('embers').textContent='余烬 '+game.save.embers;$('best').textContent='远征最高 '+game.save.best+' 层';for(const [id,key,label] of [['buyBow','bow','练弓'],['buyLife','life','强身']]){const level=game.save[key],cost=3+level*2;$(id).textContent=label+' '+level+'/5 · '+(level===5?'已满':cost+'余烬');$(id).disabled=level>=5||game.save.embers<cost;$(id).title=key==='bow'?'永久增加远征初始箭伤害，每级4%':'永久增加远征初始生命，每级5点';}}
function renderResult(){const win=game.phase==='victory';$('resultKicker').textContent=win?'风 止 · 箭 落':'此 路 未 尽';let title,text,next,reward='';if(game.mode==='target'){title='每一箭，都算数。';text='风中的靶标渐渐安静。记住这一局的落点，下一次，让你的箭更准一些。';next='返回旅营 ↗';reward='本次 '+game.targetScore+' 分 · 命中 '+game.targetHits+' 靶 · 最高 '+game.save.targetBest+' 分';}else if(game.mode==='campaign'){title=win?(game.stage===3?'冠军奖杯，竟然是个碗。':'这坡，算你赢了。'):'我在测试重力。';text=win?(game.stage===3?'星灯亮了，裁判递来一个空碗：“奖品要自己去无尽巡回赛里挣。”赤岩拍拍护具：“我还能打，只是先去捡只鞋。”':'赤岩从草坡爬起来，举起“下一场”的牌子，头盔里掉出三支练习箭：“不是输了，是这块地还没熟。”'):'青松顺坡滚了半圈，举手申诉：“刚才不算，我在测试重力。”裁判同意重来，但不负责找箭。';next=win?(game.stage<3?'走向下一章 ↗':'点亮旅营 ↗'):'再试一次 ↗';if(win&&game.stage===3)reward='已解锁：无尽远征 / 自由切磋 / 同机双人 / 百步穿杨';}
 else if(game.mode==='rogue'){title=win?'赢了。下一位倒霉蛋？':'这回，鞋先到终点。';text=win?(game.hasRelicReward?'两关连胜，轮到挑狠活了。先选条路，再选一件强化。':'对手还在找掉下来的鞋。补一发特箭，选条路接着走；下一关胜利后挑强化。'):'你留下的每一步都不会消失。回到旅营，用余烬修行，再带着新的选择出发。';next=win?(game.hasRelicReward?'选择强化与路线 ↗':'补给与选路 ↗'):'返回旅营 ↗';reward='本次抵达 '+game.floor+' 层 · 余烬 '+game.save.embers+' · 最高 '+game.save.best+' 层'+(win?' · '+nextSupplyText():'');}
 else{title=(game.winner===0?'青松':'赤岩')+'，胜。';text='弓弦安静下来。两位弓手收起长弓，向彼此致意。下一场切磋，随时开始。';next='返回旅营 ↗';}
 $('resultTitle').textContent=namedText(title);$('resultText').textContent=namedText(text);$('resultReward').textContent=reward;show('resultBounty',game.mode==='rogue'&&Boolean(game.bounty));$('resultBounty').textContent=game.bounty?(game.bounty.complete?'观众悬赏 ✓ 已完成：':'观众悬赏未完成 · 不影响通关：')+game.bounty.spec.objective:'';$('resultNext').textContent=next;$('resultNext').title='空格或 Enter 继续，也可点击按钮';}
function renderCharacters(){
 const host=$('characterCards');host.replaceChildren();
 for(const c of CHARACTERS.filter(c=>c.playable)){
  const button=document.createElement('button'),token=document.createElement('span'),portrait=document.createElement('canvas'),name=document.createElement('b'),description=document.createElement('small');
  button.className='character-card';button.setAttribute('aria-pressed',c.id===selectedCharacterId);token.className='character-token';portrait.width=192;portrait.height=224;portrait.setAttribute('aria-hidden','true');
  if(renderer.drawCharacterPortrait(portrait,c.id))token.append(portrait);else token.textContent=c.name[0];name.textContent=c.name;description.textContent=c.description;
  button.append(token);button.append(name);button.append(description);button.onclick=()=>{selectedCharacterId=c.id;renderCharacters();};host.append(button);
 }
}
function renderBows(){renderCharacters();const host=$('bowCards');host.replaceChildren();for(const bow of BOWS){const b=document.createElement('button');b.className='relic';b.innerHTML='<span class="symbol" style="color:'+bow.color+'">'+bow.icon+'</span><small>'+bow.skill+'</small><b>'+bow.name+'</b><p>'+bow.desc+'</p><span class="take">带上这张弓 ↗</span>';b.onclick=()=>{if(game.start('rogue',1,bow.id,selectedCharacterId)){setPaused(false);canvas.focus();toast(bow.tip);}};host.append(b);}}
function enemyIntentShort(id){return {steady:'偏低弧找身体',loft:'偏爱高抛',breaker:'喜欢先拆掩体',forager:'低血会抢爱心'}[id]||'观察落点';}
function geometryLabel(arena){const g=arena?.geometry;if(!g)return '';const distance=g.distance<=720?'近距':g.distance<=1080?'中距':'远距';return distance+' · '+(Math.abs(g.heightDelta)<50?'两岸齐平':g.heightDelta>0?'右岸高台':'左岸高台')+' · '+g.kind;}
function renderRoutes(){const host=$('routeCards');host.replaceChildren();show('routeHeading',Boolean(game.nextRoutes?.length));for(const r of game.nextRoutes||[]){const b=document.createElement('button'),spec=bountyFor(r,game.floor+1);b.className='route-ticket';b.setAttribute('aria-pressed',r.id===game.selectedRoute);b.innerHTML='<span class="route-stamp">'+(r.boss?'首领赛':'第 '+(game.floor+1)+' 场')+'</span><b>'+r.name+'</b><span class="route-detail">'+r.enemy.name+' · '+enemyIntentShort(r.enemy.id)+' · '+(r.supply==='hearts'?'爱心较多':'均衡补给')+'</span><span class="route-geometry"><span>'+geometryLabel(r)+'</span></span><small>'+r.tip+'</small><span class="route-bounty">可选悬赏：'+spec.objective+' · '+((game.floor+1)%2===0?'奖励重选一次':'回血8，满血改重选')+'</span>';const preview=document.createElement('canvas');preview.width=360;preview.height=100;preview.className='route-preview';preview.setAttribute('aria-label',r.name+'的真实坡形、双方站位与掩体');b.append(preview);drawArenaPreview(preview,r);b.title=r.enemy.tip;b.onclick=()=>{if(game.chooseRoute(r.id))renderRoutes();};host.append(b);}}

function renderChoices(){
 renderRoutes();const reward=Boolean(game.hasRelicReward),continueButton=$('continueRun');
 $('upgradeTitle').textContent=reward?'两关连胜，挑件狠活。':'补一发特箭，换条路继续。';
 $('upgradeNote').textContent=nextSupplyText()+'。'+(reward?'点选一件强化，即可进入下一关。':'这一站只整备；下一关胜利后可选择强化。');
 show('continueRun',!reward);continueButton.textContent='补给整备，前往第 '+(game.floor+1)+' 关 ↗';
 show('rerollUpgrades',reward&&game.rerolls>0);$('rerollUpgrades').textContent='观众请你重选 · 剩余 '+game.rerolls+' 次 ↻';
 const host=$('upgradeCards');host.replaceChildren();show('upgradeCards',reward);
 if(!reward)return;
 for(const u of game.choices){const b=document.createElement('button');b.className='relic';const before=synergies(game.stats),afterStats={...game.stats};applyRewardUpgrade(afterStats,u.id);const after=synergies(afterStats),newPairs=after.filter(s=>!before.some(b=>b.id===s.id));b.innerHTML='<span class="symbol">'+u.icon+'</span><small>'+u.tag+'</small><b>'+u.name+'</b><p>'+u.desc+'</p><span class="upgrade-preview">'+rewardUpgradePreview(game.stats,u.id)+'</span>'+(newPairs.length?'<span class="pair-badge">激活 '+newPairs.map(s=>s.name).join(' · ')+'</span>':'')+'<span class="take">带上强化 ↗</span>';b.onclick=()=>{if(game.chooseUpgrade(u.id)){tone(700,.2,'sine');renderDirty=true;}};host.append(b);}
}
function inventory(){const counts={};for(const id of game.upgrades)counts[id]=(counts[id]||0)+1;return Object.entries(counts).map(([id,n])=>({u:UPGRADES.find(u=>u.id===id),n}));}
function renderUI(){const phase=game.phase;if(lastPhase!==phase){lastPhase=phase;if(phase==='home')cloudAccount?.camp();renderDirty=true;lastBeat=-1;for(const [id,p] of [['home','home'],['story','intro'],['result','result'],['upgrade','upgrade'],['loadout','loadout']])show(id,p==='result'?['victory','defeat'].includes(phase):p===phase);if(phase==='home')renderHome();if(['victory','defeat'].includes(phase))renderResult();if(phase==='upgrade')renderChoices();if(phase==='loadout')renderBows();}
 if(['victory','defeat'].includes(phase))show('result',game.phaseTime>=.72);
 if(renderDirty){if(phase==='home')renderHome();if(!$('shopPanel').hidden)renderShop();const inv=inventory();$('build').replaceChildren();for(const {u,n} of inv){const el=document.createElement('span');el.textContent=u.name+(n>1?' ×'+n:'');$('build').append(el);}const pairs=synergies(game.stats);for(const pair of pairs){const el=document.createElement('span');el.className='pair-badge';el.textContent=pair.name;el.title=pair.desc;$('build').append(el);}$('inventory').textContent=characterById(game.players[0].characterId).description+'\n\n'+(game.mode==='rogue'?specialAmmoText()+' · 普箭不限量\n每关补1发，最多储存'+(game.specialAmmoMax??5)+'发；每两关选择一次强化。\n'+(BOWS.find(b=>b.id===game.skill)||BOWS[0]).tip+'\n\n':'')+(inv.length?inv.map(({u,n})=>u.name+' ×'+n+'：'+u.desc+(u.id==='fire'||u.id==='poison'?'\n下次升级：'+rewardUpgradePreview(game.stats,u.id):'')).join('\n'):'当前尚未携带遗物。')+(pairs.length?'\n\n'+pairs.map(p=>p.desc).join('\n'):'')+(game.mode==='rogue'?'\n\n赛场：'+game.encounter.name+'\n'+geometryLabel(game.arena)+'\n'+game.encounter.tip+'\n可选悬赏：'+bountyProgressText(game.bounty)+'\n已存重选：'+game.rerolls+'\n对手打法：'+game.encounter.enemy.name+' · '+game.encounter.enemy.tip+'\n对手能力：'+enemySummary(game.players[1]):'')+'\n\n当前状态\n'+game.players.map((p,i)=>archerName(i)+'：'+(statusSummary(p.status)||'无异常')).join('\n');renderDirty=false;}
 const gameplay=['scout','thinking','aim','flight','settle'].includes(phase);show('hud',gameplay);$('storageNote').textContent=stored?'本机自动存档':'当前浏览器无法保存进度';show('build',gameplay&&game.mode==='rogue'&&game.upgrades.length>0);show('sceneHint',gameplay&&!['scout','thinking'].includes(phase)&&!(game.mode==='rogue'&&game.active===0&&phase==='flight'));$('chapterSub').textContent=modeName();$('chapterName').textContent=game.arena?.name||MAPS[game.map].name;$('turn').textContent='第 '+game.round+' 回合';const enemyRole=game.mode==='rogue'&&game.encounter?(game.encounter.boss?'擂主 · ':'')+game.encounter.enemy.name:'';$('name1').textContent=archerName(1)+(game.mode==='local'?' · 玩家二':enemyRole?' · '+enemyRole:'');$('name0').textContent=archerName(0)+(game.mode==='local'?' · 玩家一':'');$('portrait0').textContent=Array.from(archerName(0))[0];$('portrait1').textContent=Array.from(archerName(1))[0];$('loadoutName').textContent=archerName(0);
 for(let i=0;i<2;i++){const p=game.players[i];$('hp'+i).textContent=Math.ceil(p.hp)+' / '+p.stats.maxHp;$('bar'+i).style.width=clamp(p.hp/p.stats.maxHp*100,0,100)+'%';const summary=statusSummary(p.status);$('status'+i).textContent=summary.replace(/ · 基础[0-9]+\/轮/g,'');$('status'+i).title=summary;}
 const threat=game.mode!=='local'&&game.mode!=='target'?enemySummary(game.players[1]):'';$('enemyTraits').textContent=(game.arena?.enemy.name||'对手能力')+' · '+enemyIntentShort(game.arena?.enemy.id)+'\n'+threat+(game.arena?.rule==='collapse'?' · 第5回合中央路障倒下':'');$('enemyTraits').title=(game.arena?.enemy.tip||'')+' · '+threat;show('enemyTraits',!!threat&&['scout','thinking'].includes(phase));show('bountyInfo',game.mode==='rogue'&&phase==='scout'&&Boolean(game.bounty));$('bountyInfo').textContent=game.bounty?'观众悬赏 · '+bountyProgressText(game.bounty):'';
 show('challengeInfo',gameplay&&game.mode==='target');$('challengeInfo').textContent='得分 '+game.targetScore+' · 落空 '+game.targetMisses+' / 3';document.querySelector('.health.right').hidden=game.mode==='target';show('skillButton',gameplay&&game.mode==='rogue'&&game.active===0&&phase==='flight');const bow=BOWS.find(b=>b.id===game.skill)||BOWS[0];$('skillName').textContent=bow.skill+' · '+specialAmmoText()+(game.skillAim?' · 预瞄':game.skillUsed?' · 已施展':'');$('skillButton').disabled=!game.canSkill;$('skillHint').textContent=game.specialAmmo===0?'特箭耗尽 · 普箭仍可用':game.phase==='flight'&&game.volleyArrowType==='normal'?'本轮普通箭 · 不消耗特箭':game.skillUsed?'本轮已施展 · 下一轮可再用':game.phase==='flight'?(game.skill==='dive'?(game.skillAim?(!input.skill.hold?'再次点击落箭 · Esc 取消':touchMode?'左右拖动调整 · 松手落箭':'←→ 调整落线 · 松开空格落箭'):(touchMode?'按住预瞄 · 松手星坠':'按住空格预瞄 · 松开星坠')):(touchMode?'点击施展':'空格 / 点击施展')):'射箭后施展 · 消耗1发特箭';$('skillButton').setAttribute('aria-pressed',Boolean(game.skillAim));$('skillButton').title=bow.tip;let banner='';if(phase==='scout'){const progress=game.phaseTime/game.scoutDuration;banner=game.mode==='target'?(progress<.3?'观察靶标的位置':'回到弓手'):game.round===1&&progress>=.18&&progress<.55?geometryLabel(game.arena):progress<(game.round===1?.18:.2)?'观察对手的位置':'镜头回到 '+archerName(game.active);}else if(phase==='thinking')banner=game.mode==='rogue'&&game.opponent.boss?'擂主 · '+game.players[1].stats.multi+'箭蓄力':$('name1').textContent+'正在寻找角度';show('turnBanner',!!banner);$('turnBanner').textContent=banner;$('sceneHint').textContent=phase==='scout'?(touchMode?'点击下方按钮可跳过观察':'空格跳过观察镜头'):phase==='aim'?archerName(game.active)+(touchMode?'的回合 · 看高低差，试试收力':'的回合 · ←→调角度 · ↑↓调弓力 · 拖拽或空格出箭'):phase==='flight'?(game.skillAim?(touchMode?'星坠预瞄 · 左右拖动 · 松手落箭':'星坠预瞄 · ←→调整 · 松开空格落箭'):game.volleyCount>1?'箭雨 ×'+game.volleyCount:'一箭已出'):'等待箭落';
 if(phase==='intro'){$('skipStory').textContent=game.save.unlocked?'跳过剧情，开始对决 ↗':'跳过新手教程，解锁玩法 ↗';$('skipStory').title=game.save.unlocked?'只跳过本段剧情':'永久解锁无尽、切磋、双人和射靶，不额外发放奖励';const beat=Math.min(2,Math.floor(game.phaseTime/game.storyBeatDuration));if(beat!==lastBeat){lastBeat=beat;const [speaker,line]=STORIES[game.stage-1][beat];$('storyChapter').textContent='第 '+game.stage+' 章 / '+MAPS[game.map].name;$('speaker').textContent=namedText(speaker);$('storyLine').dataset.full=namedText(line);$('storyDots').innerHTML=[0,1,2].map(i=>'<i class="'+(i===beat?'active':'')+'"></i>').join('');$('nextLine').textContent=beat===2?'开始试炼 ➜':'下一幕 ➜';}$('storyLine').textContent=($('storyLine').dataset.full||'');}
 $('pause').disabled=phase==='home';show('pause',phase!=='home');show('settingsButton',phase==='home');document.body.classList.toggle('in-match',phase!=='home');show('practiceBadge',Boolean(game.authorMode));document.body.classList.toggle('author-practice',Boolean(game.authorMode));updateTouchControls();}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function cancelDrag(){input.cancel();}
function adjustAngle(delta){if(!paused&&!input.drag&&game.canAim)game.aim(game.angles[game.active]+delta,game.powers[game.active]);}
function adjustPower(delta){if(!paused&&!input.drag&&game.canAim)game.aim(game.angles[game.active],game.powers[game.active]+delta);}
$('powerMode').onclick=()=>{if(paused||input.drag||!game.canAim)return;const powers=[45,65,85,100],current=game.powers[game.active];game.aim(game.angles[game.active],powers.find(p=>p>current+1)||45);updateTouchControls();};
$('rerollUpgrades').onclick=()=>{if(game.rerollUpgrades())renderChoices();};
$('continueRun').onclick=()=>{if(game.continueRun()){tone(600,.15,'sine');renderDirty=true;}};
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
const pausePages=[['overview','pauseOverviewTab','pauseOverview'],['settings','pauseSettingsTab','pauseSettings'],['help','pauseHelpTab','pauseHelp']];
function selectPauseTab(tab,focus=false){
 pauseTab=pausePages.some(([key])=>key===tab)?tab:'overview';
 for(const [key,id,panel] of pausePages){const selected=key===pauseTab;$(id).setAttribute('aria-selected',selected);$(id).tabIndex=selected?0:-1;show(panel,selected);}
 closeViewMenu();if(focus)$(pausePages.find(([key])=>key===pauseTab)[1]).focus();
}
for(const [key,id] of pausePages)$(id).onclick=()=>selectPauseTab(key);
function renderPauseMenu(){
 const camp=game.phase==='home',preparing=game.phase==='loadout';
 $('pauseEyebrow').textContent=camp?'旅营整备':preparing?'赛前整备':'中场休息 · 箭也暂停';$('pauseTitle').textContent=camp?'调顺手，再出发。':preparing?'准备好了，再开弓。':'歇一箭，再上场。';
 $('pauseContext').textContent=camp?'声音、镜头和操作布局，都在这里。':preparing?'选好弓手与弓术，再出发。':modeName()+' · 第 '+game.round+' 回合';
 $('resumeLabel').textContent=camp?'返回旅营':preparing?'继续选弓':'继续对决';show('restart',!camp&&!preparing);show('pauseHome',!camp);show('pauseOverviewTab',!camp&&!preparing);
 $('pauseSafeNote').textContent=camp?'顺手，比花哨更重要。':'山路还在，箭等你回来。';
 $('pauseMapName').textContent=game.arena?.name||MAPS[game.map].name;$('pauseMode').textContent=geometryLabel(game.arena);
 $('pauseHero').textContent=archerName(0)+' · '+Math.ceil(game.players[0].hp)+' / '+game.players[0].stats.maxHp;
 $('pauseRival').textContent=game.mode==='target'?'射靶 '+game.targetScore+' 分':archerName(1)+' · '+Math.ceil(game.players[1].hp)+' / '+game.players[1].stats.maxHp;
 $('pauseRelics').replaceChildren();const relics=inventory();
 for(const {u,n} of relics.slice(0,5)){const chip=document.createElement('span');chip.textContent=u.icon+' '+u.name+(n>1?' ×'+n:'');$('pauseRelics').append(chip);}
 if(relics.length>5){const more=document.createElement('span');more.textContent='另 '+(relics.length-5)+' 种';$('pauseRelics').append(more);}
 renderFeedbackSetting();
}
function setPaused(value,tab=null){
 const wasOpen=paused&&!$('pausePanel').hidden;
 if(!value){closeShop(false);closeScenery(false);closeTransfer(false);closeNames(false);cloudAccount?.close(false);}
 cancelDrag();closeViewMenu();paused=value;show('pausePanel',value);
 $('pauseLabel').textContent=value?'继续':'暂停';$('pause').setAttribute('aria-expanded',value);$('pause').setAttribute('aria-label',value?'继续游戏':'暂停游戏');$('settingsButton').setAttribute('aria-expanded',value&&game.phase==='home');
 if(value){renderPauseMenu();if(!wasOpen||tab)selectPauseTab(tab||(['home','loadout'].includes(game.phase)?'settings':'overview'));(tab?$(pausePages.find(([key])=>key===pauseTab)[1]):$('resume')).focus();}
 else if(wasOpen)(game.phase==='home'?$('settingsButton'):canvas).focus();
}
$('settingsButton').onclick=()=>setPaused(true,'settings');
function pauseKey(e){
 if(!paused||$('pausePanel').hidden||!$('namesPanel').hidden||!$('transferPanel').hidden)return false;
 if(e.key==='Escape'){e.preventDefault();if(!$('viewMenu').hidden)closeViewMenu(true);else setPaused(false);return true;}
 const tabs=pausePages.filter(([key])=>key!=='overview'||!['home','loadout'].includes(game.phase)),tabIndex=tabs.findIndex(([,id])=>$(id)===e.target);
 if(tabIndex>=0&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){
  e.preventDefault();const at=e.key==='Home'?0:e.key==='End'?tabs.length-1:(tabIndex+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;selectPauseTab(tabs[at][0],true);return true;
 }
 if(e.key==='Tab'){
  const actions=game.phase==='home'?['resume']:game.phase==='loadout'?['resume','pauseHome']:['resume','restart','pauseHome'];
  const pageControls=pauseTab==='overview'?['pauseDetailsToggle']:pauseTab==='settings'?['sound','feedbackMode','view','fullscreen','sceneryPause','viewMode',...(!$('viewMenu').hidden?['chooseAuto','chooseDesktop','chooseMobile']:[]),'editNamesPause','transferPause','accountPause']:[];
  const controls=[...actions,...tabs.filter(([key])=>key===pauseTab).map(([,id])=>id),...pageControls].map($).filter(el=>!el.disabled&&!el.hidden);
  const current=controls.indexOf(document.activeElement),step=e.shiftKey?-1:1,next=current<0?(e.shiftKey?controls.length-1:0):(current+step+controls.length)%controls.length;
  controls[next]?.focus();e.preventDefault();
 }
 return true;
}
function home(){closeNames(false);closeTransfer(false);setPaused(false);game.goHome();}
function skipTutorial(){setPaused(false);if(game.skipTutorial()){renderDirty=true;lastPhase='';toast(stored?'全部玩法已解锁，也可随时返回主线练习。':'玩法已解锁；浏览器无法保存，可导出迁移码备份。');}}
function closeNames(focus=true){show('namesPanel',false);if(focus)$(!$('pausePanel').hidden?'editNamesPause':game.phase==='home'?'editNamesHome':'editNamesPause').focus();}
function openNames(){closeShop(false);closeScenery(false);cloudAccount?.close(false);cancelDrag();closeViewMenu();closeTransfer(false);if(game.phase!=='home')setPaused(true);const names=normalizeNames(game.save.names);$('archerName0').value=names[0];$('archerName1').value=names[1];$('namesMessage').textContent='名字会用于对局、剧情和结算，也会随迁移码保存。';show('namesPanel',true);$('archerName0').focus();}
$('editNamesHome').onclick=openNames;$('editNamesPause').onclick=openNames;$('namesClose').onclick=()=>closeNames();
$('namesReset').onclick=()=>{DEFAULT_NAMES.forEach((name,i)=>{$('archerName'+i).value=name;});$('namesMessage').textContent='已填入默认名字，点击保存生效。';};
$('namesSave').onclick=()=>{const values=[$('archerName0').value,$('archerName1').value];if(values.some(value=>Array.from(value.trim()).length>MAX_NAME_LENGTH)){$('namesMessage').textContent='每个名字最多 '+MAX_NAME_LENGTH+' 个字符。';return;}game.save=validSave({...game.save,names:normalizeNames(values)});game.persist();lastPhase='';lastBeat=-1;renderDirty=true;closeNames();toast(stored?'弓手名字已保存。':'名字已应用；当前浏览器无法保存，可导出迁移码备份。');};
function closeTransfer(focus=true){show('transferPanel',false);if(focus)$(!$('pausePanel').hidden?'transferPause':game.phase==='home'?'transferHome':'transferPause').focus();}
function openTransfer(){closeShop(false);closeScenery(false);cloudAccount?.close(false);closeNames(false);cancelDrag();closeViewMenu();if(game.phase!=='home')setPaused(true);$('exportProgress').value=encodeProgress(permanentProgress());$('importProgress').value='';$('transferMessage').textContent=game.phase==='home'?'导入会合并永久进度，不会降低已有纪录。':'请先返回旅营，再导入进度。当前进度仍可复制。';$('importProgressButton').disabled=game.phase!=='home'||Boolean(game.authorMode);if(game.authorMode)$('transferMessage').textContent='当前导出正式档；请先退出作者练习，再导入正式进度。';show('transferPanel',true);$('transferClose').focus();}
$('transferHome').onclick=openTransfer;$('transferPause').onclick=openTransfer;$('transferClose').onclick=()=>closeTransfer();
$('copyProgress').onclick=async()=>{try{if(!globalThis.navigator?.clipboard?.writeText)throw new Error('manual');await navigator.clipboard.writeText($('exportProgress').value);$('transferMessage').textContent='已复制，去另一个游戏网址粘贴导入即可。';}catch{$('exportProgress').focus();$('exportProgress').select?.();$('transferMessage').textContent='请长按代码选择复制，或在电脑按 Ctrl/Cmd+C。';}};
$('importProgressButton').onclick=()=>{if(game.phase!=='home'||game.authorMode){$('transferMessage').textContent='请先退出作者练习并返回旅营，再导入进度。';return;}try{applyPermanentProgress(mergeProgress(permanentProgress(),decodeProgress($('importProgress').value)));game.persist();renderDirty=true;renderHome();$('exportProgress').value=encodeProgress(permanentProgress());$('transferMessage').textContent=stored?'进度已合并，可以继续旅程。':'进度已合并，但当前浏览器无法保存；关闭页面前请复制新的进度代码。';}catch(error){$('transferMessage').textContent=error.message||'进度代码无效，请重新复制。';}};

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
 closeShop(false);cloudAccount?.close(false);closeNames(false);closeTransfer(false);closeViewMenu();cancelDrag();sceneryWasPaused=paused;
 if(game.phase!=='home')setPaused(true);else paused=true;
 renderSceneryChoices();$('sceneryMessage').textContent='只换风景，不影响当前回合和进度。';$('sceneryClose').textContent=game.phase==='home'?'选好了，返回旅营 ↗':'选好了，返回游戏 ↗';
 show('sceneryPanel',true);$('sceneryBack').focus();
}
function closeScenery(focus=true,resume=false){
 const wasOpen=!$('sceneryPanel').hidden;show('sceneryPanel',false);if(!wasOpen)return;
 if(resume){setPaused(false);}else if(game.phase==='home')paused=sceneryWasPaused;
 if(focus)$(!resume&&!$('pausePanel').hidden?'sceneryPause':game.phase==='home'?'sceneryHome':'pause').focus();
}
$('sceneryHome').onclick=openScenery;$('sceneryPause').onclick=openScenery;$('sceneryBack').onclick=()=>closeScenery();$('sceneryClose').onclick=()=>closeScenery(true,true);
function sceneryKey(e){
 if($('sceneryPanel').hidden)return false;
 if(e.key==='Escape'){e.preventDefault();closeScenery();return true;}
 if(e.key==='Tab'){const controls=[$('sceneryBack'),...sceneryButtons,$('sceneryClose')],index=controls.indexOf(document.activeElement),step=e.shiftKey?-1:1;controls[(index+step+controls.length)%controls.length].focus();e.preventDefault();}
 return true;
}

function renderShop(){
 const profile=game.collection??validCollection(game.save.collection),records=game.authorMode?game.save:permanentProgress();shopButtons=[];
 $('shopTokens').textContent='风格券 '+profile.tokens;
 $('shopModeNote').textContent=game.authorMode?'作者练习 · 消费、成就和纪录不会写入正式档':'成就和守关赛赚券；皮肤不加数值，额外天赋只用于无尽。';
 $('shopItemsTab').setAttribute('aria-selected',shopTab==='items');$('shopAchievementsTab').setAttribute('aria-selected',shopTab==='achievements');show('shopItems',shopTab==='items');show('shopAchievements',shopTab==='achievements');
 $('equipBaseSkin').disabled=profile.skin==='base';$('equipNoTalent').disabled=profile.talent==='none';
 const host=$('shopCards');host.replaceChildren();
 for(const item of COLLECTION_ITEMS){
  const card=document.createElement('article'),preview=document.createElement(item.type==='skin'?'canvas':'span'),copy=document.createElement('div'),name=document.createElement('b'),description=document.createElement('p'),gate=document.createElement('small'),button=document.createElement('button');
  card.className='shop-card';copy.className='shop-card-copy';preview.className='shop-item-preview';
  if(item.type==='skin'){preview.width=144;preview.height=168;preview.setAttribute('aria-label',item.name+'装扮预览');renderer.drawCharacterPortrait(preview,selectedCharacterId,item.id);}else{preview.textContent=item.effect==='quiver'?'↟':'➶';preview.setAttribute('aria-hidden','true');}
  name.textContent=item.name;description.textContent=item.description;
  const owned=profile.owned.includes(item.id),equipped=(item.type==='skin'?profile.skin:profile.talent)===item.id,gateDef=ACHIEVEMENTS.find(a=>a.id===item.gate),unlocked=profile.claimed.includes(item.gate);
  gate.textContent=owned?(item.type==='skin'?'外观 · 不影响属性':'额外天赋 · 无尽生效，最多装备一个'):unlocked?'已解锁购买资格':'需要成就：'+(gateDef?.name||item.gate);
  button.dataset.item=item.id;button.className=owned?'quiet shop-item-action':'primary shop-item-action';button.textContent=equipped?'已装备':owned?'装备 ↗':!unlocked?'成就未解锁':profile.tokens<item.cost?'还差 '+(item.cost-profile.tokens)+' 券':item.cost+' 风格券 · 购买';
  button.disabled=equipped||!owned&&(!unlocked||profile.tokens<item.cost);button.setAttribute('aria-label',(owned?'装备':'购买')+item.name);button.title=item.description;
  button.onclick=()=>{const ok=owned?game.equipCollection?.(item.id):game.buyCollection?.(item.id);$('shopMessage').textContent=game.lastCollectionMessage||(ok?(owned?'已装备。':'购买成功，可以装备。'):'暂时无法完成，请检查成就和风格券。');if(ok){renderDirty=true;renderHome();renderShop();(shopButtons.find(b=>b.dataset.item===item.id)||$('shopClose')).focus();tone(owned?650:820,.15,'sine');}};
  copy.append(name);copy.append(gate);copy.append(description);copy.append(button);card.append(preview);card.append(copy);host.append(card);if(!button.disabled)shopButtons.push(button);
 }
 const achievements=$('achievementCards');achievements.replaceChildren();
 for(const achievement of ACHIEVEMENTS){
  const state=achievementProgress(profile,records,achievement),card=document.createElement('article'),name=document.createElement('b'),description=document.createElement('p'),progress=document.createElement('progress'),status=document.createElement('small');
  card.className='achievement-card'+(state.claimed?' complete':'');name.textContent=(state.claimed?'✓ ':'')+achievement.name;description.textContent=achievement.description;progress.max=state.target;progress.value=state.claimed?state.target:Math.min(state.value,state.target);progress.setAttribute('aria-label',achievement.name+'进度');
  status.textContent=(state.claimed?'已达成':Math.min(state.value,state.target)+' / '+state.target)+' · 奖励 '+achievement.tokens+' 风格券';card.append(name);card.append(description);card.append(progress);card.append(status);achievements.append(card);
 }
 show('authorExit',Boolean(game.authorMode));$('authorApply').disabled=Boolean(game.authorMode);$('authorCode').disabled=Boolean(game.authorMode);
}
function openShop(){
 if(game.phase!=='home'){toast('请先返回旅营，再查看成就与商店。');return;}
 closeScenery(false);cloudAccount?.close(false);closeNames(false);closeTransfer(false);closeViewMenu();cancelDrag();shopWasPaused=paused;paused=true;
 show('shopPanel',true);$('shopMessage').textContent='完成成就解锁购买资格，风格券只用于装扮与额外天赋。';renderShop();$('shopClose').focus();
}
function closeShop(focus=true){const open=!$('shopPanel').hidden;show('shopPanel',false);if(open&&game.phase==='home')paused=shopWasPaused;if(open&&focus)$('shopHome').focus();}
function shopKey(e){
 if($('shopPanel').hidden)return false;
 if(e.key==='Escape'){e.preventDefault();closeShop();return true;}
 if(e.target===$('authorCode')&&e.key==='Enter'&&!e.repeat){e.preventDefault();$('authorApply').click();return true;}
 if([$('shopItemsTab'),$('shopAchievementsTab')].includes(e.target)&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();shopTab=e.key==='Home'?'items':e.key==='End'?'achievements':shopTab==='items'?'achievements':'items';renderShop();$(shopTab==='items'?'shopItemsTab':'shopAchievementsTab').focus();return true;}
 if(e.key==='Tab'){
  const controls=[$('shopClose'),$('shopItemsTab'),$('shopAchievementsTab'),...(shopTab==='items'?[$('equipBaseSkin'),$('equipNoTalent'),...shopButtons]:[]),$('authorSummary'),...($('authorTools').open?[$('authorCode'),$('authorApply'),$('authorExit')]:[]),$('shopBack')].filter(el=>!el.hidden&&!el.disabled),index=controls.indexOf(document.activeElement),step=e.shiftKey?-1:1;
  controls[(index+step+controls.length)%controls.length]?.focus();e.preventDefault();
 }
 return true;
}
$('shopHome').onclick=openShop;$('shopClose').onclick=()=>closeShop();$('shopBack').onclick=()=>closeShop();
$('shopItemsTab').onclick=()=>{shopTab='items';renderShop();};$('shopAchievementsTab').onclick=()=>{shopTab='achievements';renderShop();};
for(const [id,item]of [['equipBaseSkin','base'],['equipNoTalent','none']])$(id).onclick=()=>{const ok=game.equipCollection?.(item);$('shopMessage').textContent=game.lastCollectionMessage||(ok?'已更新装备。':'暂时无法更新。');renderDirty=true;renderShop();};
$('authorApply').onclick=()=>{const ok=game.enterAuthorMode?.($('authorCode').value);$('shopMessage').textContent=game.lastCollectionMessage||(ok?'已进入作者练习，正式档不会改变。':'练习码未识别。');if(ok){$('authorCode').value='';renderDirty=true;lastPhase='';renderHome();renderShop();$('shopClose').focus();}};
$('authorExit').onclick=()=>{const ok=game.exitAuthorMode?.();$('shopMessage').textContent=game.lastCollectionMessage||(ok?'已恢复正式档。':'当前没有作者练习。');renderDirty=true;lastPhase='';renderHome();renderShop();$('shopClose').focus();};
show('shopPanel',false);

function renderFeedbackSetting(){const label={light:'轻',standard:'标准',off:'关'}[renderer.feedback.mode];$('feedbackMode').textContent='画面震动：'+label+(renderer.reducedMotion?'（跟随系统减少动态）':'');}
$('feedbackMode').onclick=()=>{const f=renderer.feedback;f.mode=FEEDBACK_MODES[(FEEDBACK_MODES.indexOf(f.mode)+1)%FEEDBACK_MODES.length];f.reset();try{localStorage.setItem(FEEDBACK_KEY,f.mode);}catch{}renderFeedbackSetting();};renderFeedbackSetting();
$('brand').onclick=e=>{e.preventDefault();if(game.phase==='home')return;setPaused(true);};$('campaignStart').onclick=()=>{setPaused(false);game.start('campaign',game.save.checkpoint);};$('campaignQuick').onclick=skipTutorial;$('rogueStart').onclick=()=>{if(game.save.unlocked||game.authorMode){setPaused(false);game.setPhase('loadout');}};$('loadoutHome').onclick=home;$('targetStart').onclick=()=>{if(game.start('target',Number($('mapChoice').value)))setPaused(false);};input.skill.bindButton($('skillButton'));$('duelStart').onclick=()=>{if(game.start('duel',Number($('mapChoice').value)))setPaused(false);};$('localStart').onclick=()=>{if(game.start('local',Number($('mapChoice').value)))setPaused(false);};$('buyBow').onclick=()=>{if(game.buy('bow'))toast('练弓完成：下次远征初始箭伤害提高。');};$('buyLife').onclick=()=>{if(game.buy('life'))toast('强身完成：下次远征初始生命提高。');};$('sound').onclick=()=>{soundOn=!soundOn;$('sound').textContent='声音：'+(soundOn?'开':'关');$('sound').setAttribute('aria-pressed',soundOn);tone(600,.1,'sine');};$('view').onclick=()=>{renderer.allView=!renderer.allView;$('view').setAttribute('aria-pressed',renderer.allView);$('view').textContent=renderer.allView?'跟随镜头':'全景';};$('pause').onclick=()=>setPaused(!paused);$('resume').onclick=()=>setPaused(false);$('pauseHome').onclick=home;$('restart').onclick=()=>{const mode=game.mode,stage=game.mode==='campaign'||game.mode==='rogue'?game.stage:game.arenaChoice;setPaused(false);game.start(mode,stage,game.skill,game.characterId);};$('resultHome').onclick=home;$('resultNext').onclick=()=>game.resultNext();$('skipStory').onclick=()=>game.save.unlocked?game.skip():skipTutorial();$('nextLine').onclick=()=>game.introNext();$('fullscreen').onclick=toggleFullscreen;
function onKey(e){
 if(shopKey(e))return;if(sceneryKey(e))return;if(cloudAccount?.key(e))return;if(e.repeat){if(game.skillAim&&[' ','ArrowLeft','ArrowRight'].includes(e.key))e.preventDefault();return;}
 if(pauseKey(e))return;
 const tag=e.target?.tagName;
 if(!paused&&!['BUTTON','A','INPUT','SELECT','TEXTAREA','SUMMARY'].includes(tag)&&['victory','defeat'].includes(game.phase)&&game.phaseTime>=.4&&[' ','Enter'].includes(e.key)){e.preventDefault();game.resultNext();return;}
 if(e.key==='Escape'&&!$('namesPanel').hidden){e.preventDefault();closeNames();return;}
 if(e.key==='Escape'&&!$('transferPanel').hidden){e.preventDefault();closeTransfer();return;}
 if(e.key==='Tab'&&game.skillAim)cancelDrag();
 if(['INPUT','SELECT','TEXTAREA','A','SUMMARY'].includes(tag))return;
 if(e.key==='Escape'){
  e.preventDefault();if(!$('viewMenu').hidden){closeViewMenu(true);return;}
  if(input.drag||game.skillAim)cancelDrag();else if(paused)setPaused(false);else if(game.phase!=='home')setPaused(true);return;
 }
 if(paused)return;
 if(game.skillAim&&(tag!=='BUTTON'||e.target===$('skillButton'))&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();game.aimSkill?.(game.skillAim.tilt+(e.key==='ArrowRight'?3:-3));return;}
 if(tag==='BUTTON')return;
 if((e.key==='ArrowUp'||e.key==='ArrowDown')&&!game.canAim)return;
 if([' ','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
  e.preventDefault();if(input.drag)return;
  if(e.key===' '){
   if(game.phase==='intro'&&!game.save.unlocked)skipTutorial();else if(['scout','intro'].includes(game.phase))game.skip();else if(game.canAim)game.shoot();else if(game.canSkill){if(!input.skill.keyDown(e))game.activateSkill();}
  }else if(e.key==='ArrowUp'||e.key==='ArrowDown')adjustPower(e.key==='ArrowUp'?5:-5);
  else if(game.canAim)game.aim(game.angles[game.active]+(e.key==='ArrowRight'?1:-1),game.powers[game.active]);
 }
}
window.addEventListener('keydown',onKey);window.addEventListener('keyup',e=>input.skill.keyUp(e));window.addEventListener('blur',()=>{cancelDrag();if(!['home','victory','defeat','upgrade','loadout'].includes(game.phase))setPaused(true);});document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelDrag();if(!['home','victory','defeat','upgrade','loadout'].includes(game.phase))setPaused(true);}});
cloudAccount=setupCloudAccount({storage:viewStorage,getSave:()=>permanentProgress(),applySave:progress=>{applyPermanentProgress(progress);game.persist();lastPhase='';lastBeat=-1;renderDirty=true;renderHome();},atCamp:()=>game.phase==='home'&&!game.authorMode,returnFocus:()=>$('pausePanel').hidden&&game.phase==='home'?'accountHome':'accountPause',beforeOpen:()=>{closeShop(false);closeScenery(false);cancelDrag();closeViewMenu();closeNames(false);closeTransfer(false);if(game.phase!=='home')setPaused(true);}});
function frame(now){const dt=Math.min((now-lastNow)/1000||0,.05);lastNow=now;if(!paused)game.update(dt);renderer.draw(game,dt,{drag:input.drag,paused});renderUI();if(toastUntil&&now>toastUntil){show('toast',false);toastUntil=0;}requestAnimationFrame(frame);}renderUI();requestAnimationFrame(frame);
