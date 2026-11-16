import {bountyFor,createBountyState,recordBounty,rewardBounty} from './bounties.mjs';
import {ARENAS,arenaBounds,encounterFor,encounterRoutes,encounterGround,encounterObstacles} from './encounters.mjs';
import {DEFAULT_NAMES,normalizeNames} from './names.mjs';
import {opponentProfile,rogueEnemyStats,characterById,createSkillState,turnSkillHealing,hitKnockbackScale,pickupSkillHealing} from './combat.mjs';
import {bodyCollision,impactBody,updateBody,attachArrow,syncGroundContact} from './body.mjs';
export const W=1600,H=900,G=155,SPEED=800,MAX_ARROWS=24;
export const DIVE_SCALE=1.45,DIVE_PICKUP_PADDING=40;
export const FINISHER_DURATION=1.35;
export const MAX_ELEMENT_LEVEL=999,MAX_STATUS_STACKS=9999;
export const MAPS=[{name:'青岚古道',sub:'松风起处，第一支箭',sky:['#294c50','#8fb2a1'],far:'#517c76',near:'#345c55',soil:'#324839',grass:'#91a979',accent:'#e9c17b'},{name:'赤砂关隘',sub:'长谷与断墙之间',sky:['#694e59','#ddb386'],far:'#b78373',near:'#805d5b',soil:'#644b40',grass:'#c59c69',accent:'#f5bf75'},{name:'星坠遗迹',sub:'借一束星光，穿过长夜',sky:['#101d3d','#46627d'],far:'#334d6a',near:'#263d58',soil:'#293e4b',grass:'#7a9d9a',accent:'#a4dfd4'}];
export const BOWS=[
{id:'split',name:'逐风弓',skill:'散羽',icon:'↟',color:'#9ed5b0',desc:'箭飞到合适位置时，分成三支散射箭。每支造成 60% 伤害，可继承元素。',tip:'接近对手时分裂，或提前分裂收集更多小球。'},
{id:'dive',name:'落星弓',skill:'星坠',icon:'↓',color:'#afc4ed',desc:'按住进入三分之一速度并预瞄，松开让飞箭俯冲。伤害 +45%，穿障 +1；星引扩大拾球范围，追加箭继承星坠。',tip:'飞行中按住空格／画面／弓术键预瞄，←→或横拖调方向，松开俯冲。下坠箭会吸取沿途附近的小球。'},
{id:'burst',name:'焰灯弓',skill:'引爆',icon:'✺',color:'#edb27b',desc:'每支箭绑一枚炸弹；引爆清障后箭继续以双倍速度、双倍直接伤害飞行，额外穿障并可跳弹一次。',tip:'接近对手或掩体时引爆；爆风开路，助推箭继续命中。打地面还能跳弹，追加箭继承剩余助推状态。'}];
export const SYNERGIES=[
{id:'melt',name:'融爆',needs:['fire','ice'],desc:'火 + 冰：直接命中追加融爆，消耗冰霜效果。'},
{id:'venomfire',name:'毒焰',needs:['fire','poison'],desc:'火 + 毒：灼烧期间，中毒每层每回合从 3 提高到 5 点。'},
{id:'parasite',name:'腐生',needs:['poison','leech'],desc:'毒 + 吸血：中毒回合的持续伤害也为你回复生命。'},
{id:'shatter',name:'霜裂',needs:['ice','pierce'],desc:'冰 + 穿透：每次直接命中额外造成 6 × 两者较低层数的伤害。'},
{id:'fortify',name:'坚守',needs:['armor','regen'],desc:'护甲 + 回春：回合开始额外回复 2 × 护甲层数的生命。'}];
export function synergies(stats){return SYNERGIES.filter(s=>s.needs.every(k=>stats[k]>0));}
export const UPGRADES=[
{id:'damage',name:'鹰眼',tag:'锐击',desc:'箭的直接伤害提高 20 个百分点，可与多箭叠加。',icon:'◎'},
{id:'multi',name:'分弦',tag:'箭雨',desc:'每次射击多一支箭，道具 +1 还能继续叠加。',icon:'↟'},
{id:'fire',name:'焰羽',tag:'火焰',desc:'每阶让每次命中多加一层灼烧，每层每轮 5 点，持续两轮；可重复叠加。',icon:'焰'},
{id:'ice',name:'霜弦',tag:'冰霜',desc:'降低对手下次射击伤害；与火焰组合融爆。',icon:'霜'},
{id:'poison',name:'青毒',tag:'毒素',desc:'每阶让每次命中多加一层毒，每层每轮 3 点，持续三轮；连续命中继续叠层。',icon:'毒'},
{id:'pierce',name:'破阵',tag:'穿透',desc:'每支箭可穿过一个障碍，同时损伤它。',icon:'➶'},
{id:'leech',name:'饮露',tag:'续航',desc:'回复实际伤害的 12%，多箭也能吸血。',icon:'♥'},
{id:'armor',name:'铁衣',tag:'防御',desc:'每次受击减少 4 点伤害。',icon:'◇'},
{id:'regen',name:'回春',tag:'续航',desc:'自己的回合开始回复 5 点生命。',icon:'✦'},
{id:'crit',name:'猎隼',tag:'暴击',desc:'暴击率 +15%，暴击造成 1.6 倍伤害。',icon:'✧'},
{id:'vital',name:'长青',tag:'生命',desc:'最大生命 +25，并立即回复 25 点。',icon:'＋'},
{id:'impact',name:'震弦',tag:'位移',desc:'遗物击退系数每阶+15个百分点，最多三阶，可与重弦相乘；连续箭共享位移上限。',icon:'➜'},
{id:'balance',name:'扎根',tag:'站位',desc:'提高受击时的稳定性，减少实际击退，最多三阶。',icon:'▱'},
{id:'heal',name:'星泉',tag:'道具',desc:'爱心回血 +15；立即回复 20 点生命。',icon:'❋'}];
export function ground(x,map=0){if(map&&typeof map==='object')return encounterGround(x,map);const n=x/W;return map===0?700-65*n+10*Math.sin(x/170):map===1?658+42*Math.sin(n*Math.PI)+12*Math.sin(x/140):700-105*Math.exp(-(((x-800)/250)**2))+9*Math.sin(x/110);}
export function baseStats(meta={}){return {damage:1+.04*(meta.bow||0),multi:1,fire:0,ice:0,poison:0,pierce:0,leech:0,armor:0,regen:0,crit:0,maxHp:100+5*(meta.life||0),heal:0,impact:0,balance:0};}
export function applyUpgrade(stats,id){if(id==='damage')stats.damage+=.2;else if(id==='multi')stats.multi=Math.min(8,stats.multi+1);else if(id==='vital')stats.maxHp+=25;else if(id==='crit')stats.crit=Math.min(.75,stats.crit+.15);else if(id==='leech')stats.leech=Math.min(.6,stats.leech+.12);else if(id==='ice')stats.ice=stats.ice>=3?stats.ice:Math.min(3,(stats.ice||0)+1);else if(id==='impact'||id==='balance')stats[id]=Math.min(3,(stats[id]||0)+1);else if(id==='fire'||id==='poison')stats[id]=Math.min(MAX_ELEMENT_LEVEL,(stats[id]||0)+1);else stats[id]=(stats[id]||0)+1;return stats;}
export function upgradePreview(stats,id){
 const after=applyUpgrade({...stats},id),value=stats[id]||0,next=after[id]||0;
 if(id==='fire'||id==='poison'){
  if(value>=MAX_ELEMENT_LEVEL)return '已达 '+MAX_ELEMENT_LEVEL+' 阶上限';
  const fire=id==='fire',perStack=fire?5:stats.fire>0?5:3;
  return value+' → '+next+' 阶 · 每次命中 +'+value+' → +'+next+' 层'+(fire?'灼烧':'毒')+'\n单次叠层基础伤害 '+value*perStack+' → '+next*perStack+' /轮，持续 '+(fire?2:3)+' 轮';
 }
 if(id==='impact')return value>=3?'已达 3 阶上限':'遗物击退 '+Math.round((1+value*.15)*100)+'% → '+Math.round((1+next*.15)*100)+'%';
 if(id==='balance')return value>=3?'已达 3 阶上限':'承受击退 '+Math.round(100/(1+value*.18))+'% → '+Math.round(100/(1+next*.18))+'%';
 if(id==='damage')return '直接伤害 '+Math.round(stats.damage*100)+'% → '+Math.round(after.damage*100)+'%';
 if(id==='vital')return '最大生命 '+stats.maxHp+' → '+after.maxHp+' · 立即回复25';
 if(id==='multi')return '起手箭数 '+stats.multi+' → '+after.multi;
 if(id==='crit'||id==='leech')return (id==='crit'?'暴击率 ':'吸血率 ')+Math.round(value*100)+'% → '+Math.round(next*100)+'%';
 if(id==='armor')return '每次减伤 '+value*4+' → '+next*4;
 if(id==='regen')return '每轮回春 '+value*5+' → '+next*5+'，可与护甲组合';
 if(id==='pierce')return '每箭穿过障碍 '+value+' → '+next+' 个';
 if(id==='heal')return '爱心回血 '+(20+value*15)+' → '+(20+next*15)+' · 立即回复20';
 if(id==='ice')return value>=3?'已达 3 阶上限 · 仍可与火焰、穿透组合':'冰霜 '+value+' → '+next+' 阶 · 下一箭减伤 '+Math.round(Math.min(.45,value*.15)*100)+'% → '+Math.round(Math.min(.45,next*.15)*100)+'%';
 return '';
}
export function statusSummary(status){
 const lines=[],burning=status.burnTurns>0&&status.burn>0;
 if(burning)lines.push('灼烧 '+status.burn+'层 · 基础'+status.burn*5+'/轮 · 余'+status.burnTurns+'轮');
 if(status.poisonTurns>0&&status.poison>0)lines.push((burning?'毒焰 ':'中毒 ')+status.poison+'层 · 基础'+status.poison*(burning?5:3)+'/轮 · 余'+status.poisonTurns+'轮');
 if(status.ice>0)lines.push('冰霜 '+status.ice+'层 · 下箭减伤'+Math.round(Math.min(.45,status.ice*.15)*100)+'%');
 return lines.join('\n');
}
export function enemySummary(player){
 const s=player.stats,traits=[];
 if(s.multi>1)traits.push('齐射 '+s.multi+'箭');
 for(const [key,label] of [['fire','火'],['poison','毒'],['ice','冰'],['pierce','穿透'],['armor','护甲'],['regen','回春']])if(s[key]>0)traits.push(label+' '+s[key]+'阶');
 if(s.leech)traits.push('吸血 '+Math.round(s.leech*100)+'%');
 if(s.cleanse)traits.push('净化 '+Math.round(s.cleanse*100)+'%（伤害结算后）');
 const pairs=synergies(s);if(pairs.length)traits.push('组合：'+pairs.map(pair=>pair.name).join(' / '));
 return traits.length?traits.join(' · '):'基础弓术';
}
export function validSave(raw){let a;try{a=typeof raw==='string'?JSON.parse(raw):raw;}catch{}a=a&&typeof a==='object'?a:{};const num=(v,min,max)=>Number.isFinite(v)?Math.max(min,Math.min(max,Math.floor(v))):min;const result={version:2,targetBest:num(a.targetBest,0,999999),unlocked:a.unlocked===true,checkpoint:num(a.checkpoint,1,3),best:num(a.best,0,9999),embers:num(a.embers,0,99999),bow:num(a.bow,0,5),life:num(a.life,0,5)};const names=normalizeNames(a.names);if(names.some((name,i)=>name!==DEFAULT_NAMES[i]))result.names=names;return result;}
export function zones(p){return [{part:'head',x:p.x-12,y:p.y-108,w:24,h:25,damage:42},{part:'body',x:p.x-17,y:p.y-83,w:34,h:43,damage:26},{part:'legs',x:p.x-15,y:p.y-40,w:30,h:30,damage:18},{part:'feet',x:p.x-20,y:p.y-10,w:40,h:11,damage:12}];}
export function launch(p,angle,power=100){const a=angle*Math.PI/180;return {x:p.x+p.dir*32,y:p.y-66,vx:p.dir*SPEED*power/100*Math.cos(a),vy:-SPEED*power/100*Math.sin(a)};}
export function position(b,t){return {x:b.x+b.vx*t,y:b.y+b.vy*t+G*t*t/2};}
// Preview and release share exactly this trajectory, including the current
// instantaneous velocity and all existing per-arrow modifiers.
export function diveTrajectory(b,tilt=0,dir=1){
 const p=position(b,b.t),aim=Math.max(-35,Math.min(35,Math.round(Number(tilt)||0))),vy=Math.max(640,Math.min(1000,b.vy+G*b.t));
 return {...b,x:p.x,y:p.y,vx:Math.tan(aim*Math.PI/180)*vy*dir,vy,t:0,scale:(b.scale??1)*DIVE_SCALE,pierce:(b.pierce||0)+1,ignored:new Set(b.ignored||[]),diving:true,diveTilt:aim};
}
export function obstaclesFor(map,level,rogue=false){let arr=level===1&&!rogue?[[800,'crate',70,65]]:map===1?[[355,'post',30,145],[525,'crate',68,90],[790,'crate',90,115],[1075,'crate',68,90],[1245,'post',30,145]]:map===2?[[440,'crate',76,85],[800,'post',36,145],[1160,'crate',76,85]]:[[445,'crate',72,90],[810,'post',32,165],[1180,'crate',72,90]];return arr.map(([x,type,w,h],i)=>({id:i,x,y:ground(x,map),w,h,type,hp:type==='crate'?2:1,maxHp:type==='crate'?2:1,state:'standing',rot:0,dir:1}));}
const STATIC_LIMB_PARTS=new Set(['arms','legs','feet']);
export function collision(p,target,obs,map,ignored=new Set()){
 for(const o of obs)if(o.state==='standing'&&!ignored.has(o.id)&&p.x>=o.x-o.w/2&&p.x<=o.x+o.w/2&&p.y>=o.y-o.h&&p.y<=o.y)return {kind:'obstacle',o};
 const active=target.body?.active,near=active||Math.abs(p.x-target.x)<=90&&p.y>=target.y-150&&p.y<=target.y+20;
 if(near){
  if(active){const hit=bodyCollision(p,target);if(hit)return hit;}
  else{
   for(const z of zones(target))if((!target.groundContact||z.part==='head'||z.part==='body')&&p.x>=z.x&&p.x<=z.x+z.w&&p.y>=z.y&&p.y<=z.y+z.h)return {kind:'hit',...z};
   const limb=bodyCollision(p,target,target.groundContact?STATIC_LIMB_PARTS:null);
   if(limb&&(target.groundContact||limb.part==='arms'))return limb;
  }
 }
 const bounds=arenaBounds(map);
 if(p.x<bounds.left-50||p.x>bounds.right+50||p.y>H+30)return {kind:'miss'};
 if(p.y>=ground(p.x,map))return {kind:'ground'};return null;
}
export function trace(p,target,angle,obs,map,power=100){const b=launch(p,angle,power);for(let t=1/240;t<12;t+=1/240){const r=collision(position(b,t),target,obs,map);if(r)return r;}return {kind:'miss'};}
// The same physical descriptors power campaign, local duels and expeditions.
export function arenaForMode(mode,stage=1,choice=1){
 const campaignIds=['yard','dock','signs'];
 const index=mode==='campaign'?ARENAS.findIndex(a=>a.id===campaignIds[Math.max(0,Math.min(2,stage-1))]):Math.max(0,Math.min(ARENAS.length-1,Math.floor(choice)-1));
 const arena=encounterFor(0,index+1);arena.map=mode==='campaign'?stage-1:index%3;arena.terrain.map=arena.map;arena.boss=false;if(mode==='campaign'){arena.name=['歪旗热身场','赤砂长谷','星灯高低台'][stage-1];arena.landmark=['stands','gorge','ruin'][stage-1];}return arena;
}
export class Game{
 constructor({save={},rng=Math.random,onEvent=()=>{}}={}){this.save=validSave(save);this.rng=rng;this.onEvent=onEvent;this.mode='campaign';this.stage=1;this.floor=1;this.upgrades=[];this.characterId='qingsong';this.stats=baseStats();this.effects=[];this.arrows=[];this.orbs=[];this.phase='home';this.phaseTime=0;this.totalTime=0;this.setup(true);this.phase='home';}
 emit(type,data={}){
  const event={type,shooterSide:this.active,volleyId:this.shotSerial,skillUsed:this.skillUsed,...data};
  if(this.bounty&&recordBounty(this.bounty,event)){
   const reward=rewardBounty(this.bounty);
   if(reward.granted){const healed=reward.heal?this.heal(this.players[0],reward.heal):0,rerolls=reward.rerolls||(reward.heal&&!healed?1:0);this.rerolls=(this.rerolls||0)+rerolls;this.bountyPrize={heal:healed,rerolls};this.pop(this.players[0].x,this.players[0].y-190,rerolls?'观众加奖 · 遗物重选+1':healed?'观众请喝水 +'+healed:'悬赏完成 · 生命已满','#ffe09a');this.onEvent({type:'bounty',...this.bountyPrize});}
  }
  this.onEvent(event);
 }
 persist(){this.emit('save',{save:this.save});}
 get world(){return this.arena?.terrain??this.encounter?.terrain??this.map;}
 setup(fresh=true){
  if(this.mode==='rogue'){
   if(this.encounterFloor!==this.floor){this.encounter=this.pendingEncounter||encounterFor(this.runSeed||0,this.floor,0,this.encounter?.layoutId);this.encounterFloor=this.floor;this.pendingEncounter=null;}
   this.arena=this.encounter;
  }else{this.encounter=null;this.encounterFloor=0;this.arena=arenaForMode(this.mode,this.stage,this.arenaChoice||this.stage);}
  this.map=this.arena.map;const close=this.mode==='campaign'&&this.stage===1,xs=this.arena.xs;
  let enemyStats=baseStats();this.opponent=opponentProfile(this.mode,this.stage,this.floor,this.stats.maxHp);if(this.mode!=='local')enemyStats.damage=this.opponent.damage;if(this.mode==='rogue')enemyStats=rogueEnemyStats(this.floor,enemyStats);
 const hp=fresh?this.stats.maxHp:Math.min(this.stats.maxHp,this.players?.[0]?.hp??this.stats.maxHp);this.players=xs.map((x,i)=>({x,homeX:x,y:ground(x,this.world),groundSlope:(ground(x+3,this.world)-ground(x-3,this.world))/6,characterId:i===0?this.characterId:'chiyan',skills:{...createSkillState(i===0?this.characterId:'chiyan'),weapon:i===0&&this.mode==='rogue'?this.skill:null,extra:i===0?[...this.upgrades]:[]},body:null,dir:i===0?1:-1,hp:i===0?hp:this.mode==='campaign'&&this.stage===1?50:enemyStats.maxHp,stats:i===0?this.stats:enemyStats,status:{burn:0,burnTurns:0,poison:0,poisonTurns:0,ice:0},stuck:[],recoil:0,deadTime:0}));this.players.forEach(p=>syncGroundContact(p,x=>ground(x,this.world)));this.obs=encounterObstacles(this.arena,x=>ground(x,this.world));this.bounty=this.mode==='rogue'?createBountyState(bountyFor(this.encounter,this.floor)):null;if(this.bounty&&this.floor%2===0)this.bounty.spec.reward={kind:'reroll'};this.bountyPrize=null;this.ruleTriggered=false;this.nextRoutes=[];this.selectedRoute=null;this.orbs=[];this.arrows=[];this.effects=[];this.trails=[];this.active=0;this.round=1;this.angles=close?[19,14]:[31,31];this.powers=[this.arena.geometry.recommendedPower,this.arena.geometry.recommendedPower];this.volleyCount=0;this.phaseTime=0;this.notice='';this.impact=null;this.finisher=null;this.shake=0;this.choices=[];this.lastDamage=0;this.lastHeal=0;this.npcVolleyDamage=0;this.npcHeadHits=0;this.icePenalty=0;this.vfx=[];this.skillUsed=false;this.skillAim=null;this.hitStop=0;this.targets=[];this.targetHits=0;this.targetScore=0;this.targetMisses=0;this.volleyTargetHits=0;if(this.mode==='target'){this.obs=[];this.players[0].x=220;this.players[0].y=ground(220,this.world);this.players[0].homeX=220;syncGroundContact(this.players[0],x=>ground(x,this.world));this.newTargets();}}
 start(mode,stage=1,skill='split',characterId='qingsong'){if(mode!=='campaign'&&!this.save.unlocked)return false;this.mode=mode;this.characterId=characterById(characterId).id;this.skill=BOWS.some(b=>b.id===skill)?skill:'split';this.arenaChoice=Math.max(1,Math.min(ARENAS.length,Math.floor(Number(stage))||1));this.stage=mode==='rogue'?1:mode==='campaign'?Math.max(1,Math.min(3,stage)):(this.arenaChoice-1)%3+1;this.floor=1;this.rerolls=0;this.shotSerial=0;this.encounterFloor=0;this.encounter=null;this.pendingEncounter=null;this.runSeed=mode==='rogue'?Math.floor(this.rng()*0x100000000)>>>0:0;this.upgrades=[];this.stats=baseStats(mode==='rogue'?this.save:{});this.setup();this.setPhase(mode==='campaign'?'intro':'scout');this.emit('start');return true;}
 setPhase(p){if(p!=='flight')this.cancelSkillAim();this.phase=p;this.phaseTime=0;this.emit('phase',{phase:p});}
 goHome(){this.arrows=[];this.finisher=null;this.hitStop=0;this.setPhase('home');}
 skipTutorial(){if(!['home','intro'].includes(this.phase))return false;const changed=!this.save.unlocked;this.save.unlocked=true;if(changed)this.persist();this.goHome();return true;}
 get storyBeatDuration(){return this.mode==='campaign'&&this.stage===1?2.5:4.5;}
 get scoutDuration(){return this.mode==='campaign'&&this.stage===1?1.5:2.6;}
 introNext(){if(this.phase==='intro'){this.phaseTime=(Math.floor(this.phaseTime/this.storyBeatDuration)+1)*this.storyBeatDuration;if(this.phaseTime>=this.storyBeatDuration*3)this.setPhase('scout');}}
 skip(){if(this.phase==='intro')this.setPhase('scout');else if(this.phase==='scout'){this.readyTurn();}}
 readyTurn(){const p=this.players[this.active],heal=turnSkillHealing(p);if(heal){this.heal(p,heal);this.pop(p.x,p.y-165,'沉着 · 回息','#b4d8a2');}if(this.active===1&&this.mode!=='local'){this.setPhase('thinking');this.angles[1]=this.chooseAI();this.shoot();}else this.setPhase('aim');}
 get canAim(){return this.phase==='aim';}
 aim(angle,power){if(!this.canAim)return;this.angles[this.active]=Math.max(5,Math.min(75,Math.round(angle)));this.powers[this.active]=Math.max(20,Math.min(100,Math.round(power)));}
 shoot(){if(!this.canAim&&this.phase!=='thinking')return false;const p=this.players[this.active];if(this.active===1){this.npcVolleyDamage=0;this.npcHeadHits=0;}this.shotSerial=(this.shotSerial||0)+1;this.volleyCount=0;this.volleyImpactPeak=0;this.trails=[];this.arrows=[];this.impact=null;this.skillUsed=false;this.skillAim=null;this.volleyTargetHits=0;this.icePenalty=Math.min(.45,p.status.ice*.15);p.status.ice=0;const n=p.stats.multi;for(let i=0;i<n;i++){const b=launch(p,this.angles[this.active]+(i-(n-1)/2)*.65,this.powers[this.active]);this.addArrow(b);}this.emit('shoot');this.setPhase('flight');return true;}
 addArrow(b){if(this.volleyCount>=MAX_ARROWS)return false;this.arrows.push({scale:1,t:0,pierce:this.players[this.active].stats.pierce,ignored:new Set(),bomb:this.mode==='rogue'&&this.active===0&&this.skill==='burst',...b,dead:false,id:++this.volleyCount});return true;}
 get canSkill(){return this.mode==='rogue'&&this.active===0&&this.phase==='flight'&&!this.skillUsed&&this.arrows.some(b=>!b.dead&&(this.skillAim||b.t>.12));}
 get timeScale(){return this.skillAim&&this.phase==='flight'?1/3:1;}
 beginSkillAim(){if(!this.canSkill||this.skill!=='dive'||this.skillAim)return false;this.skillAim={tilt:0};return true;}
 aimSkill(tilt){if(!this.skillAim||!Number.isFinite(tilt))return false;this.skillAim.tilt=Math.max(-35,Math.min(35,Math.round(tilt)));return true;}
 cancelSkillAim(){const aiming=Boolean(this.skillAim);this.skillAim=null;return aiming;}
 releaseSkillAim(){if(!this.skillAim)return false;const released=this.activateSkill(this.skillAim.tilt);if(!released)this.cancelSkillAim();return released;}
 previewSkill(){
  if(!this.skillAim||!this.canSkill||this.skill!=='dive')return [];
  return this.arrows.filter(b=>!b.dead).slice(0,8).map(b=>{
   const flight=diveTrajectory(b,this.skillAim.tilt,this.players[this.active].dir),points=[{x:flight.x,y:flight.y}],ignored=new Set(flight.ignored);let pierce=flight.pierce,hit=null,end=points[0];
   for(let step=1;step<=720;step++){
    end=position(flight,step/120);hit=collision(end,this.players[1-this.active],this.obs,this.world,ignored);
    if(step%4===0||hit)points.push(end);
    if(hit?.kind==='obstacle'&&pierce>0){pierce--;ignored.add(hit.o.id);hit=null;}
    if(hit)break;
   }
   return {arrowId:b.id,points,end,hit};
  });
 }
 activateSkill(tilt=0){
  if(!this.canSkill)return false;
  this.skillAim=null;this.skillUsed=true;
  for(const b of [...this.arrows]){
   const p=position(b,b.t),vy=b.vy+G*b.t,scale=b.scale??1;
   if(this.skill==='split'){
    b.scale=scale*.6;
    for(const spread of [-32,32])this.addArrow({x:p.x,y:p.y,vx:b.vx,vy:vy+spread,scale:scale*.6,pierce:b.pierce,ignored:new Set(b.ignored)});
    this.fx('split',p.x,p.y,'#c5e4b0');
   }else if(this.skill==='dive'){
    Object.assign(b,diveTrajectory(b,tilt,this.players[this.active].dir));this.fx('dive',p.x,p.y,'#adcdee');
   }else{
    // The blast uses the original arrow scale; the subsequent physical hit
    // gets the boost. Only the temporary blast carries noStick.
    const target=this.players[1],d=Math.hypot(p.x-target.x,p.y-(target.y-55));
    if(d<130)this.hitTarget({...b,noStick:true,vx:(target.x-p.x)*4,vy:(target.y-60-p.y)*4-G*b.t},{damage:26*(1-d/180),part:'body'},{x:target.x,y:target.y-60});
    for(const o of this.obs)if(o.state==='standing'&&Math.hypot(p.x-o.x,p.y-(o.y-o.h/2))<120)this.hitObstacle(o,1);
    Object.assign(b,{x:p.x,y:p.y,vx:b.vx*2,vy:vy*2,t:0,scale:scale*2,pierce:b.pierce+1,bomb:false,boosted:true,bounces:1});
    this.fx('burst',p.x,p.y,'#efb26e');
   }
  }
  this.emit('skill',{skill:this.skill});return true;
 }
 ricochet(b,p){
  if(!b.boosted||!(b.bounces>0))return false;
  const slope=(ground(p.x+3,this.world)-ground(p.x-3,this.world))/6,norm=Math.hypot(slope,1),nx=-slope/norm,ny=1/norm,vy=b.vy+G*b.t,dot=b.vx*nx+vy*ny;
  const vx=(b.vx-2*dot*nx)*.8,reflected=(vy-2*dot*ny)*.8;
  Object.assign(b,{x:p.x,y:ground(p.x,this.world)-7,vx,vy:Math.min(-140,reflected),t:0,bounces:b.bounces-1});
  this.fx('ricochet',b.x,b.y,'#ffd08a');return true;
 }
 beginFinisher(target,{part='body',element='plain',x=target.x,y=target.y-60,dir=1,cause='arrow',arrows=this.volleyCount||1}={}){
  if(target.hp>0||this.finisher)return false;
  const side=this.players.indexOf(target);if(side<0)return false;
  this.finisher={side,part,element,age:0,duration:FINISHER_DURATION,x,y,dir,cause,arrows};
  this.hitStop=Math.max(this.hitStop||0,.075);this.emit('finisher',{...this.finisher});return true;
 }
 fx(kind,x,y,color,detail={}){this.vfx.push({kind,x,y,color,t:.7,life:.7,...detail});if(this.vfx.length>80)this.vfx.shift();}
 newTargets(){this.targets=[];const x=760+this.rng()*560;for(let i=0;i<3;i++){const xx=Math.min(W-95,x+(i-1)*90),yy=ground(xx,this.world)-100-i*76;this.targets.push({x:xx,baseY:yy,y:yy,r:27,used:false,gold:i===2,seed:this.rng()*6});}}
 hitTargetBoard(target){if(target.used)return;target.used=true;this.volleyTargetHits++;this.targetHits++;const points=(target.gold?150:100)*(1+Math.min(4,Math.floor(this.targetHits/3)));this.targetScore+=points;this.fx('shards',target.x,target.y,'#e3c278');this.pop(target.x,target.y-35,'+'+points,'#f3d293');this.emit('target',{points});}
 hitObstacle(o,dir){if(o.state!=='standing')return;o.hp--;o.dir=dir;if(o.hp<=0)o.state=o.type==='post'?'falling':'broken';this.fx('shards',o.x,o.y-o.h/2,'#be935f');this.emit('break',{x:o.x,y:o.y-o.h/2,kind:o.type,broken:o.hp<=0,obstacleId:o.id});this.pop(o.x,o.y-o.h-15,o.hp>0?'裂开':'击破','#e8b86c');}
 pop(x,y,text,color='#edd6ad'){this.effects.push({x,y,text,color,t:1.6,life:1.6});}
 heal(p,n,x=p.x,y=p.y-135){const delta=Math.max(0,Math.min(n,p.stats.maxHp-p.hp));p.hp+=delta;if(delta>0)this.pop(x,y,'♥ +'+Math.round(delta),'#a5e0ad');return delta;}
 damage(target,raw,source=null,{leech=true}={}){
  let amount=Math.max(1,Math.round(raw-target.stats.armor*4));
  const npc=this.mode!=='local'&&source===this.players[1]&&target===this.players[0];
  if(npc)amount=Math.min(amount,Math.max(0,this.opponent.volleyCap-this.npcVolleyDamage));
  const dealt=Math.min(target.hp,amount);target.hp=Math.max(0,target.hp-amount);
  if(npc)this.npcVolleyDamage+=dealt;
  if(source&&leech&&source.stats.leech&&dealt>0)this.heal(source,Math.round(dealt*source.stats.leech));
  return dealt;
 }
 hitTarget(b,r,p){
  const shooter=this.players[this.active],target=this.players[1-this.active],st=shooter.stats;
  if(target.hp<=0)return;
  const npc=this.active===1&&this.mode!=='local',repeatHead=npc&&r.part==='head'&&this.npcHeadHits++>0;
  const crit=this.rng()<st.crit;
  let raw=r.damage*(b.scale??1)*st.damage*(1-this.icePenalty)*(crit?1.6:1)*(repeatHead?.45:1);
  if(st.ice&&st.pierce)raw+=6*Math.min(st.ice,st.pierce)*(b.scale??1);
  const melt=st.fire>0&&(st.ice>0||target.status.ice>0);
  if(melt){raw+=12*st.fire*(b.scale??1);target.status.ice=0;}
  const dealt=this.damage(target,raw,shooter);this.lastDamage=dealt;
  if(!dealt){this.fx('glance',p.x,p.y,'#b6c9bb');return;}
  const impactAngle=Math.atan2(b.vy+G*b.t,b.vx);
  if(!b.noStick){target.stuck.push(attachArrow(target,p,impactAngle,this.angles[1-this.active]));if(target.stuck.length>12)target.stuck.shift();}
  impactBody(target,{point:p,vx:b.vx,vy:b.vy+G*b.t,damage:target.hp<=0?Math.max(dealt,Math.min(60,raw)):dealt,part:r.part,angle:this.angles[1-this.active],volleyId:this.shotSerial,forceScale:(1+(st.impact||0)*.15)*(this.active===0?hitKnockbackScale(shooter):1)/(1+(target.stats.balance||0)*.18)});
  if(st.fire){target.status.burn=Math.min(MAX_STATUS_STACKS,target.status.burn+Math.min(MAX_ELEMENT_LEVEL,st.fire));target.status.burnTurns=2;}
  if(st.poison){target.status.poison=Math.min(MAX_STATUS_STACKS,target.status.poison+Math.min(MAX_ELEMENT_LEVEL,st.poison));target.status.poisonTurns=3;}
  if(st.ice&&!melt)target.status.ice=Math.min(3,target.status.ice+st.ice);
  this.pop(p.x,p.y-30,(repeatHead?'擦伤 ':melt?'融爆 ':crit?'暴击 ':r.part==='head'?'爆头 ':'')+'−'+dealt,melt?'#f6b97e':'#f3d093');
  const impactStrength=r.part==='head'&&!repeatHead?2:1;if(impactStrength>(this.volleyImpactPeak||0)){this.shake=impactStrength===2?.22:.12;this.hitStop=impactStrength===2?.055:.022;this.volleyImpactPeak=impactStrength;}
  if(target.hp<=0)this.beginFinisher(target,{part:r.part,element:melt?'melt':st.fire&&st.poison?'venomfire':st.fire?'fire':st.ice?'ice':st.poison?'poison':'plain',x:p.x,y:p.y,dir:shooter.dir});
  this.fx('impact',p.x,p.y,melt?'#ffd260':'#f4ecdd',{head:r.part==='head'&&!repeatHead,part:r.part,dir:shooter.dir,damage:dealt,blast:Boolean(b.noStick)});this.emit('hit',{x:p.x,y:p.y,head:r.part==='head'&&!repeatHead,part:r.part,damage:dealt,arrowId:b.id});
 }
 pickup(orb,b,p){if(orb.used)return;orb.used=true;const shooter=this.players[this.active];if(orb.type==='heart'){this.lastHeal=this.heal(shooter,20+shooter.stats.heal*15,orb.x,orb.y-25);}else{const currentVy=b.vy+G*b.t;const extra={x:p.x,y:p.y,vx:b.vx,vy:currentVy+(this.volleyCount%2?1:-1)*(this.active===1&&this.mode!=='local'?Math.min(48,22+this.volleyCount*6):8),scale:b.scale??1,pierce:b.pierce,ignored:new Set(b.ignored),diving:Boolean(b.diving),diveTilt:b.diveTilt||0,bomb:Boolean(b.bomb),boosted:Boolean(b.boosted),bounces:b.bounces||0};if(this.addArrow(extra))this.pop(orb.x,orb.y-35,'+1  共 '+this.volleyCount+' 箭','#f6dc85');else this.pop(orb.x,orb.y-35,'箭雨已满','#f6dc85');}this.fx('pickup',orb.x,orb.y,orb.type==='heart'?'#eaa1a0':'#f2d080');const bonus=pickupSkillHealing(shooter);if(bonus){this.heal(shooter,bonus);this.pop(shooter.x,shooter.y-165,'拾光 · 回血'+bonus,'#b6e7c0');}this.emit('pickup',{kind:orb.type,x:orb.x,y:orb.y,orbId:orb.id});}
 tickArrows(dt){let left=dt;while(left>0&&this.arrows.length){const h=Math.min(left,1/300);for(const b of [...this.arrows]){b.t+=h;const p=position(b,b.t);if(Math.floor(b.t*40)!==b.lastTrail){this.trails.push({x:p.x,y:p.y,t:1});b.lastTrail=Math.floor(b.t*40);}for(const orb of this.orbs)if(!orb.used&&Math.hypot(p.x-orb.x,p.y-orb.y)<=orb.r+(b.diving?DIVE_PICKUP_PADDING:0))this.pickup(orb,b,p);if(this.mode==='target')for(const target of this.targets)if(!target.used&&Math.hypot(p.x-target.x,p.y-target.y)<=target.r){this.hitTargetBoard(target);b.dead=true;break;}if(b.dead)continue;const r=collision(p,this.mode==='target'?{x:-500,y:0}:this.players[1-this.active],this.obs,this.world,b.ignored);if(r){this.impact=p;if(r.kind==='obstacle'){this.hitObstacle(r.o,this.players[this.active].dir);if(b.pierce>0){b.pierce--;b.ignored.add(r.o.id);}else b.dead=true;}else if(r.kind==='ground'&&this.ricochet(b,p)){}else{if(r.kind==='hit')this.hitTarget(b,r,p);b.dead=true;}}if(b.t>14)b.dead=true;}this.arrows=this.arrows.filter(b=>!b.dead);left-=h;}if(!this.arrows.length)this.setPhase('settle');}
 spawnOrbs(){if(this.mode==='target'||this.mode==='campaign'&&this.stage<3)return;this.orbs=this.orbs.filter(o=>!o.used);const bounds=arenaBounds(this.world);for(let i=0;i<2&&this.orbs.length<12;i++){const shooter=this.players[i];const offset=220+this.rng()*270;const a=24+this.rng()*13;const b=launch(shooter,a,this.arena?.geometry.recommendedPower||100);const p=position(b,offset/Math.abs(b.vx));const orb={id:'orb-'+this.round+'-'+i,x:Math.max(bounds.left+80,Math.min(bounds.right-80,p.x)),y:Math.min(p.y,ground(p.x,this.world)-65),r:25,type:this.rng()<(this.arena?.supply==='hearts'?.3:.65)?'plus':'heart',used:false};for(const o of this.obs)if(o.state==='standing'&&Math.abs(orb.x-o.x)<o.w/2+orb.r&&orb.y+orb.r>o.y-o.h)orb.y=o.y-o.h-orb.r-12;for(let n=0;n<12&&this.orbs.some(o=>Math.hypot(o.x-orb.x,o.y-orb.y)<58);n++)orb.y-=60;orb.y=Math.max(55,orb.y);this.orbs.push(orb);}}
 nextTurn(){if(this.mode==='target'){if(!this.volleyTargetHits)this.targetMisses++;if(this.targetMisses>=3){this.save.targetBest=Math.max(this.save.targetBest,this.targetScore);this.persist();this.win=false;this.winner=0;this.setPhase('defeat');return;}this.round++;this.active=0;if(this.targets.every(t=>t.used))this.newTargets();this.setPhase('scout');return;}if(this.players[1-this.active].hp<=0){this.complete(this.active===0||this.mode==='local');return;}this.active=1-this.active;this.round++;this.applyArenaRule();this.spawnOrbs();const p=this.players[this.active],source=this.players[1-this.active],poisonActive=p.status.poisonTurns>0,burning=p.status.burnTurns>0;let tick=0;if(p.status.burnTurns>0){tick+=p.status.burn*5;p.status.burnTurns--;if(!p.status.burnTurns)p.status.burn=0;}if(p.status.poisonTurns>0){tick+=p.status.poison*(burning?5:3);p.status.poisonTurns--;if(!p.status.poisonTurns)p.status.poison=0;}if(tick){const dealt=this.damage(p,tick,source,{leech:poisonActive});if(dealt)this.pop(p.x,p.y-145,'持续伤害 −'+dealt,'#c2d784');}if(p.hp<=0){this.beginFinisher(p,{part:'body',element:poisonActive&&burning?'venomfire':poisonActive?'poison':'fire',dir:source.dir,cause:'status',arrows:0});impactBody(p,{point:{x:p.x,y:p.y-60},vx:source.dir*50,vy:20,damage:tick,part:'body',angle:this.angles[this.active]});this.complete(this.active!==0||this.mode==='local');return;}if(p.stats.cleanse){const before=p.status.burn+p.status.poison;for(const key of ['burn','poison'])p.status[key]=Math.ceil(p.status[key]*(1-p.stats.cleanse));if(p.status.burn+p.status.poison<before)this.pop(p.x,p.y-170,'净化 · 保留 '+Math.round((1-p.stats.cleanse)*100)+'% 层数','#b1d2d9');}if(p.stats.regen)this.heal(p,p.stats.regen*5+p.stats.armor*2);if(this.active===1&&this.mode!=='local')this.readyTurn();else this.setPhase('scout');}
 complete(win){this.win=win;this.winner=this.mode==='local'?(this.players[0].hp>0?0:1):win?0:1;if(win&&this.mode==='campaign'){if(this.stage===3){this.save.unlocked=true;this.save.checkpoint=1;}else this.save.checkpoint=Math.max(this.save.checkpoint,this.stage+1);this.persist();}if(this.mode==='rogue'){if(win){this.save.best=Math.max(this.save.best,this.floor);this.save.embers+=this.floor%3===0?3:1;this.persist();}this.emit('run',{floor:this.floor,win});}this.emit(win?'victory':'defeat');this.setPhase(win?'victory':'defeat');}
 resultNext(){if(this.phase==='victory'&&this.mode==='rogue'){this.choices=this.rollUpgrades();this.nextRoutes=encounterRoutes(this.runSeed,this.floor+1,this.encounter?.layoutId);this.selectedRoute=this.nextRoutes[0].id;this.setPhase('upgrade');return;}if(this.phase==='victory'&&this.mode==='campaign'&&this.stage<3){this.stage++;this.stats=baseStats();this.setup();this.setPhase('intro');return;}if(this.phase==='defeat'&&this.mode==='campaign'){this.setup();this.setPhase('scout');return;}this.goHome();}
 rollUpgrades(exclude=[]){const ids=UPGRADES.filter(u=>!exclude.includes(u.id)&&!(['impact','balance'].includes(u.id)&&this.stats[u.id]>=3)&&!(u.id==='multi'&&this.stats.multi>=8)&&!(u.id==='ice'&&this.stats.ice>=3)&&!(u.id==='crit'&&this.stats.crit>=.75)&&!(u.id==='leech'&&this.stats.leech>=.6)&&!(['fire','poison'].includes(u.id)&&this.stats[u.id]>=MAX_ELEMENT_LEVEL));const result=[];const partner=SYNERGIES.flatMap(s=>s.needs.some(k=>this.stats[k]>0)&&!s.needs.every(k=>this.stats[k]>0)?s.needs.filter(k=>!this.stats[k]):[]);if(partner.length){const id=partner[Math.min(partner.length-1,Math.floor(this.rng()*partner.length))],i=ids.findIndex(u=>u.id===id);if(i>=0)result.push(ids.splice(i,1)[0]);}while(result.length<3&&ids.length){const i=Math.min(ids.length-1,Math.floor(this.rng()*ids.length));result.push(ids.splice(i,1)[0]);}return result;}
 rerollUpgrades(){if(this.phase!=='upgrade'||!(this.rerolls>0))return false;this.choices=this.rollUpgrades(this.choices.map(c=>c.id));this.rerolls--;this.emit('reroll');return true;}
 chooseRoute(id){if(this.phase!=='upgrade'||!this.nextRoutes.some(r=>r.id===id))return false;this.selectedRoute=id;this.emit('route',{id});return true;}
 applyArenaRule(){if(this.arena?.rule!=='collapse'||this.ruleTriggered||this.round<5)return;this.ruleTriggered=true;const o=this.obs.find(o=>o.type==='post'&&o.state==='standing');if(o){o.hp=0;o.state='falling';o.dir=1;this.fx('shards',o.x,o.y-o.h/2,'#ffd260');this.pop(o.x,o.y-o.h-25,'收费站下班了！','#ffd260');this.emit('arena-rule',{rule:'collapse'});}}
 chooseUpgrade(id){if(this.phase!=='upgrade'||!this.choices.some(c=>c.id===id))return false;applyUpgrade(this.stats,id);this.upgrades.push(id);const p=this.players[0];p.stats=this.stats;this.heal(p,(id==='vital'?25:id==='heal'?20:12)+(this.floor%3===0?25:0));this.pendingEncounter=this.nextRoutes.find(r=>r.id===this.selectedRoute)||this.nextRoutes[0];this.floor++;this.stage=3;this.setup(false);this.setPhase('scout');return true;}
 buy(id){if(!this.save.unlocked||!['bow','life'].includes(id)||this.save[id]>=5)return false;const cost=3+this.save[id]*2;if(this.save.embers<cost)return false;this.save.embers-=cost;this.save[id]++;this.persist();return true;}
 chooseAI(){
  const p=this.players[1],target=this.players[0],style=(this.encounter||this.arena)?.enemy.id||'steady',powers=Array.from({length:17},(_,i)=>100-i*5);let hits=[],blocked=[];
  for(const power of powers)for(let angle=5;angle<=75;angle++){
   // First reject trajectories that never cross the target's standing height.
   const arrow=launch(p,angle,power),t=(target.x-arrow.x)/arrow.vx;if(t<=0||t>=12)continue;
   const y=position(arrow,t).y;if(y<target.y-125||y>target.y+20)continue;
   const hit=trace(p,target,angle,this.obs,this.world,power);
   if(hit.kind==='hit')hits.push({angle,power,part:hit.part});
   else if(hit.kind==='obstacle'&&trace(p,target,angle,[],this.world,power).kind==='hit')blocked.push({angle,power,part:'cover'});
  }
  let candidates=[];
  if(style==='forager'&&p.hp<p.stats.maxHp*.72){
   const hearts=this.orbs.filter(o=>!o.used&&o.type==='heart');
   if(hearts.length)for(const power of [100,85,70,55,40])for(let angle=5;angle<=75;angle++){
    const b=launch(p,angle,power);let reachable=false;
    for(const orb of hearts){const time=(orb.x-b.x)/b.vx;if(time<=0||time>6||Math.abs(position(b,time).y-orb.y)>orb.r-3)continue;let clear=true;for(let t=1/120;t<time;t+=1/120)if(collision(position(b,t),target,this.obs,this.world)){clear=false;break;}if(clear){reachable=true;break;}}
    if(reachable)candidates.push({angle,power,part:'heart'});
   }
  }
  if(!candidates.length&&style==='breaker'&&blocked.length&&(!hits.length||this.rng()<.55))candidates=blocked;
  if(!candidates.length&&style==='loft')candidates=hits.filter(h=>h.angle>=45&&h.part!=='head');
  if(!candidates.length){
   if(!hits.length)hits=blocked;
   if(!hits.length){this.powers[1]=100;return 35;}
   const body=hits.filter(h=>h.part!=='head');candidates=body.length&&this.rng()<.75?body:hits;
   const preferred=this.arena?.geometry.recommendedPower||100;
   const closest=Math.min(...candidates.map(h=>Math.abs(h.power-preferred)));candidates=candidates.filter(h=>Math.abs(h.power-preferred)<=closest+10);
   const low=candidates.filter(h=>h.angle<40);if(low.length)candidates=low;
  }
  const chosen=candidates[Math.min(candidates.length-1,Math.floor(this.rng()*candidates.length))],error=chosen.angle>=45?Math.min(2,this.opponent.error):this.opponent.error;
  this.powers[1]=chosen.power;return Math.max(5,Math.min(75,Math.round(chosen.angle+(this.rng()*2-1)*error)));
 }
 update(dt){dt=Math.min(dt,.05)*this.timeScale;if(this.hitStop>0){this.hitStop=Math.max(0,this.hitStop-dt);dt*=.2;}this.totalTime+=dt;this.phaseTime+=dt;if(this.finisher)this.finisher.age=Math.min(this.finisher.duration+.1,this.finisher.age+dt);for(const f of this.vfx)f.t-=dt;this.vfx=this.vfx.filter(f=>f.t>0);if(this.mode==='target')for(const t of this.targets)t.y=t.baseY+Math.sin(this.totalTime*1.1+t.seed)*24;this.shake=Math.max(0,this.shake-dt);const bounds=arenaBounds(this.world);for(const [i,p] of this.players.entries()){p.poseAngle=this.angles[i];updateBody(p,dt,x=>ground(x,this.world),W,{worldMinX:bounds.left,worldMaxX:bounds.right,minX:i===0?bounds.left+55:Math.max(bounds.left+55,this.players[0].x+100),maxX:i===0?Math.min(bounds.right-55,this.players[1].x-100):bounds.right-55,obstacles:this.obs});p.recoil=Math.max(0,p.recoil-dt);if(p.hp<=0)p.deadTime+=dt;}for(const o of this.obs)if(o.state==='falling'){o.rot=Math.min(Math.PI/2,o.rot+dt*3);if(o.rot>=Math.PI/2)o.state='fallen';}for(const e of this.effects){e.t-=dt;e.y-=dt*20;}this.effects=this.effects.filter(e=>e.t>0);for(const t of this.trails)t.t-=dt*.32;this.trails=this.trails.filter(t=>t.t>0).slice(-1500);
 if(this.phase==='intro'&&this.phaseTime>=this.storyBeatDuration*3)this.setPhase('scout');else if(this.phase==='scout'&&this.phaseTime>=this.scoutDuration)this.readyTurn();else if(this.phase==='thinking'){this.angles[1]=this.chooseAI();this.shoot();}else if(this.phase==='flight')this.tickArrows(dt);else if(this.phase==='settle'&&this.phaseTime>=.85&&!this.players.some(p=>p.hp>0&&p.body?.active))this.nextTurn();}
}
