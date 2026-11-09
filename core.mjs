import {DEFAULT_NAMES,normalizeNames} from './names.mjs';
import {opponentProfile,rogueEnemyStats,characterById,createSkillState,turnSkillHealing} from './combat.mjs';
import {bodyCollision,impactBody,updateBody,attachArrow} from './body.mjs';
export const W=1600,H=900,G=155,SPEED=500,MAX_ARROWS=24;
export const MAX_ELEMENT_LEVEL=999,MAX_STATUS_STACKS=9999;
export const MAPS=[{name:'青岚古道',sub:'松风起处，第一支箭',sky:['#294c50','#8fb2a1'],far:'#517c76',near:'#345c55',soil:'#324839',grass:'#91a979',accent:'#e9c17b'},{name:'赤砂关隘',sub:'长谷与断墙之间',sky:['#694e59','#ddb386'],far:'#b78373',near:'#805d5b',soil:'#644b40',grass:'#c59c69',accent:'#f5bf75'},{name:'星坠遗迹',sub:'借一束星光，穿过长夜',sky:['#101d3d','#46627d'],far:'#334d6a',near:'#263d58',soil:'#293e4b',grass:'#7a9d9a',accent:'#a4dfd4'}];
export const BOWS=[
{id:'split',name:'逐风弓',skill:'散羽',icon:'↟',color:'#9ed5b0',desc:'箭飞到合适位置时，分成三支散射箭。每支造成 60% 伤害，可继承元素。',tip:'接近对手时分裂，或提前分裂收集更多小球。'},
{id:'dive',name:'落星弓',skill:'星坠',icon:'↓',color:'#afc4ed',desc:'让所有飞箭向下俯冲，伤害提高 25%，额外穿过一个障碍。',tip:'高抛到对手头顶，再按空格俯冲。'},
{id:'burst',name:'焰灯弓',skill:'引爆',icon:'✺',color:'#edb27b',desc:'引爆飞箭，对附近目标和障碍造成范围伤害，可附加元素效果。',tip:'飞到对手附近再引爆；空中炸开也能破坏掩体。'}];
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
{id:'heal',name:'星泉',tag:'道具',desc:'爱心回血 +15；立即回复 20 点生命。',icon:'❋'}];
export function ground(x,map=0){const n=x/W;return map===0?700-65*n+10*Math.sin(x/170):map===1?658+42*Math.sin(n*Math.PI)+12*Math.sin(x/140):700-105*Math.exp(-(((x-800)/250)**2))+9*Math.sin(x/110);}
export function baseStats(meta={}){return {damage:1+.04*(meta.bow||0),multi:1,fire:0,ice:0,poison:0,pierce:0,leech:0,armor:0,regen:0,crit:0,maxHp:100+5*(meta.life||0),heal:0};}
export function applyUpgrade(stats,id){if(id==='damage')stats.damage+=.2;else if(id==='multi')stats.multi=Math.min(8,stats.multi+1);else if(id==='vital')stats.maxHp+=25;else if(id==='crit')stats.crit=Math.min(.75,stats.crit+.15);else if(id==='leech')stats.leech=Math.min(.6,stats.leech+.12);else if(id==='ice')stats.ice=stats.ice>=3?stats.ice:Math.min(3,(stats.ice||0)+1);else if(id==='fire'||id==='poison')stats[id]=Math.min(MAX_ELEMENT_LEVEL,(stats[id]||0)+1);else stats[id]=(stats[id]||0)+1;return stats;}
export function upgradePreview(stats,id){
 const after=applyUpgrade({...stats},id),value=stats[id]||0,next=after[id]||0;
 if(id==='fire'||id==='poison'){
  if(value>=MAX_ELEMENT_LEVEL)return '已达 '+MAX_ELEMENT_LEVEL+' 阶上限';
  const fire=id==='fire',perStack=fire?5:stats.fire>0?5:3;
  return value+' → '+next+' 阶 · 每次命中 +'+value+' → +'+next+' 层'+(fire?'灼烧':'毒')+'\n单次叠层基础伤害 '+value*perStack+' → '+next*perStack+' /轮，持续 '+(fire?2:3)+' 轮';
 }
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
export function obstaclesFor(map,level,rogue=false){let arr=level===1&&!rogue?[[800,'crate',70,65]]:map===1?[[355,'post',30,145],[525,'crate',68,90],[790,'crate',90,115],[1075,'crate',68,90],[1245,'post',30,145]]:map===2?[[440,'crate',76,85],[800,'post',36,145],[1160,'crate',76,85]]:[[445,'crate',72,90],[810,'post',32,165],[1180,'crate',72,90]];return arr.map(([x,type,w,h],i)=>({id:i,x,y:ground(x,map),w,h,type,hp:type==='crate'?2:1,maxHp:type==='crate'?2:1,state:'standing',rot:0,dir:1}));}
export function collision(p,target,obs,map,ignored=new Set()){for(const o of obs)if(o.state==='standing'&&!ignored.has(o.id)&&p.x>=o.x-o.w/2&&p.x<=o.x+o.w/2&&p.y>=o.y-o.h&&p.y<=o.y)return {kind:'obstacle',o};if(target.body?.active){const hit=bodyCollision(p,target);if(hit)return hit;}else for(const z of zones(target))if(p.x>=z.x&&p.x<=z.x+z.w&&p.y>=z.y&&p.y<=z.y+z.h)return {kind:'hit',...z};if(!target.body?.active){const limb=bodyCollision(p,target);if(limb?.part==='arms')return limb;}if(p.x<-50||p.x>W+50||p.y>H+30)return {kind:'miss'};if(p.y>=ground(p.x,map))return {kind:'ground'};return null;}
export function trace(p,target,angle,obs,map){const b=launch(p,angle);for(let t=1/240;t<12;t+=1/240){const r=collision(position(b,t),target,obs,map);if(r)return r;}return {kind:'miss'};}
export class Game{
 constructor({save={},rng=Math.random,onEvent=()=>{}}={}){this.save=validSave(save);this.rng=rng;this.onEvent=onEvent;this.mode='campaign';this.stage=1;this.floor=1;this.upgrades=[];this.characterId='qingsong';this.stats=baseStats();this.effects=[];this.arrows=[];this.orbs=[];this.phase='home';this.phaseTime=0;this.totalTime=0;this.setup(true);this.phase='home';}
 emit(type,data={}){this.onEvent({type,...data});}
 persist(){this.emit('save',{save:this.save});}
 setup(fresh=true){this.map=this.mode==='rogue'?(this.floor-1)%3:this.stage-1;this.map=Math.max(0,Math.min(2,this.map));const close=this.mode==='campaign'&&this.stage===1||this.mode!=='rogue'&&this.stage===1;const xs=close?[380,1220]:[120,1480];let enemyStats=baseStats();this.opponent=opponentProfile(this.mode,this.stage,this.floor,this.stats.maxHp);if(this.mode!=='local')enemyStats.damage=this.opponent.damage;if(this.mode==='rogue')enemyStats=rogueEnemyStats(this.floor,enemyStats);
 const hp=fresh?this.stats.maxHp:Math.min(this.stats.maxHp,this.players?.[0]?.hp??this.stats.maxHp);this.players=xs.map((x,i)=>({x,homeX:x,y:ground(x,this.map),characterId:i===0?this.characterId:'chiyan',skills:{...createSkillState(i===0?this.characterId:'chiyan'),weapon:i===0&&this.mode==='rogue'?this.skill:null,extra:i===0?[...this.upgrades]:[]},body:null,dir:i===0?1:-1,hp:i===0?hp:this.mode==='campaign'&&this.stage===1?50:enemyStats.maxHp,stats:i===0?this.stats:enemyStats,status:{burn:0,burnTurns:0,poison:0,poisonTurns:0,ice:0},stuck:[],recoil:0,deadTime:0}));this.obs=obstaclesFor(this.map,this.stage,this.mode==='rogue');this.orbs=[];this.arrows=[];this.effects=[];this.trails=[];this.active=0;this.round=1;this.angles=close?[19,14]:[31,31];this.powers=[100,100];this.volleyCount=0;this.phaseTime=0;this.notice='';this.impact=null;this.shake=0;this.choices=[];this.lastDamage=0;this.lastHeal=0;this.npcVolleyDamage=0;this.npcHeadHits=0;this.icePenalty=0;this.vfx=[];this.skillUsed=false;this.hitStop=0;this.targets=[];this.targetHits=0;this.targetScore=0;this.targetMisses=0;this.volleyTargetHits=0;if(this.mode==='target'){this.obs=[];this.players[0].x=220;this.players[0].y=ground(220,this.map);this.newTargets();}}
 start(mode,stage=1,skill='split',characterId='qingsong'){if(mode!=='campaign'&&!this.save.unlocked)return false;this.mode=mode;this.characterId=characterById(characterId).id;this.skill=BOWS.some(b=>b.id===skill)?skill:'split';this.stage=mode==='rogue'?1:Math.max(1,Math.min(3,stage));this.floor=1;this.upgrades=[];this.stats=baseStats(mode==='rogue'?this.save:{});this.setup();this.setPhase(mode==='campaign'?'intro':'scout');this.emit('start');return true;}
 setPhase(p){this.phase=p;this.phaseTime=0;this.emit('phase',{phase:p});}
 goHome(){this.arrows=[];this.setPhase('home');}
 skipTutorial(){if(!['home','intro'].includes(this.phase))return false;const changed=!this.save.unlocked;this.save.unlocked=true;if(changed)this.persist();this.goHome();return true;}
 get storyBeatDuration(){return this.mode==='campaign'&&this.stage===1?2.5:4.5;}
 get scoutDuration(){return this.mode==='campaign'&&this.stage===1?1.5:2.6;}
 introNext(){if(this.phase==='intro'){this.phaseTime=(Math.floor(this.phaseTime/this.storyBeatDuration)+1)*this.storyBeatDuration;if(this.phaseTime>=this.storyBeatDuration*3)this.setPhase('scout');}}
 skip(){if(this.phase==='intro')this.setPhase('scout');else if(this.phase==='scout'){this.readyTurn();}}
 readyTurn(){const p=this.players[this.active],heal=turnSkillHealing(p);if(heal){this.heal(p,heal);this.pop(p.x,p.y-165,'沉着 · 回息','#b4d8a2');}if(this.active===1&&this.mode!=='local'){this.setPhase('thinking');this.angles[1]=this.chooseAI();this.powers[1]=100;this.shoot();}else this.setPhase('aim');}
 get canAim(){return this.phase==='aim';}
 aim(angle,power){if(!this.canAim)return;this.angles[this.active]=Math.max(5,Math.min(75,Math.round(angle)));this.powers[this.active]=Math.max(20,Math.min(100,Math.round(power)));}
 shoot(){if(!this.canAim&&this.phase!=='thinking')return false;const p=this.players[this.active];if(this.active===1){this.npcVolleyDamage=0;this.npcHeadHits=0;}this.volleyCount=0;this.trails=[];this.arrows=[];this.impact=null;this.skillUsed=false;this.volleyTargetHits=0;this.icePenalty=Math.min(.45,p.status.ice*.15);p.status.ice=0;const n=p.stats.multi;for(let i=0;i<n;i++){const b=launch(p,this.angles[this.active]+(i-(n-1)/2)*.65,this.powers[this.active]);this.addArrow(b);}this.emit('shoot');this.setPhase('flight');return true;}
 addArrow(b){if(this.volleyCount>=MAX_ARROWS)return false;this.arrows.push({scale:1,t:0,pierce:this.players[this.active].stats.pierce,ignored:new Set(),...b,dead:false,id:++this.volleyCount});return true;}
 get canSkill(){return this.mode==='rogue'&&this.active===0&&this.phase==='flight'&&!this.skillUsed&&this.arrows.some(b=>b.t>.12);}
 activateSkill(){if(!this.canSkill)return false;this.skillUsed=true;const arrows=[...this.arrows];for(const b of arrows){const p=position(b,b.t),vy=b.vy+G*b.t,scale=b.scale??1;if(this.skill==='split'){b.scale=scale*.6;for(const spread of [-32,32])this.addArrow({x:p.x,y:p.y,vx:b.vx,vy:vy+spread,scale:scale*.6,pierce:b.pierce,ignored:new Set(b.ignored)});this.fx('split',p.x,p.y,'#c5e4b0');}else if(this.skill==='dive'){Object.assign(b,{x:p.x,y:p.y,vx:b.vx*.04,vy:Math.max(520,vy),t:0,scale:scale*1.25,pierce:b.pierce+1});this.fx('split',p.x,p.y,'#adcdee');}else{const target=this.players[1],d=Math.hypot(p.x-target.x,p.y-(target.y-55));if(d<130)this.hitTarget(b,{damage:26*(1-d/180),part:'body'},p);for(const o of this.obs)if(o.state==='standing'&&Math.hypot(p.x-o.x,p.y-(o.y-o.h/2))<120)this.hitObstacle(o,1);this.fx('burst',p.x,p.y,'#efb26e');b.dead=true;}}this.arrows=this.arrows.filter(b=>!b.dead);this.emit('skill',{skill:this.skill});if(!this.arrows.length)this.setPhase('settle');return true;}
 fx(kind,x,y,color){this.vfx.push({kind,x,y,color,t:.7,life:.7});if(this.vfx.length>80)this.vfx.shift();}
 newTargets(){this.targets=[];const x=760+this.rng()*560;for(let i=0;i<3;i++){const xx=Math.min(W-95,x+(i-1)*90),yy=ground(xx,this.map)-100-i*76;this.targets.push({x:xx,baseY:yy,y:yy,r:27,used:false,gold:i===2,seed:this.rng()*6});}}
 hitTargetBoard(target){if(target.used)return;target.used=true;this.volleyTargetHits++;this.targetHits++;const points=(target.gold?150:100)*(1+Math.min(4,Math.floor(this.targetHits/3)));this.targetScore+=points;this.fx('shards',target.x,target.y,'#e3c278');this.pop(target.x,target.y-35,'+'+points,'#f3d293');this.emit('target',{points});}
 hitObstacle(o,dir){if(o.state!=='standing')return;o.hp--;o.dir=dir;if(o.hp<=0)o.state=o.type==='post'?'falling':'broken';this.fx('shards',o.x,o.y-o.h/2,'#be935f');this.emit('break',{x:o.x,y:o.y-o.h/2,kind:o.type,broken:o.hp<=0});this.pop(o.x,o.y-o.h-15,o.hp>0?'裂开':'击破','#e8b86c');}
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
  target.stuck.push(attachArrow(target,p,impactAngle,this.angles[1-this.active]));if(target.stuck.length>12)target.stuck.shift();
  impactBody(target,{point:p,vx:b.vx,vy:b.vy+G*b.t,damage:dealt,part:r.part,angle:this.angles[1-this.active]});
  if(st.fire){target.status.burn=Math.min(MAX_STATUS_STACKS,target.status.burn+Math.min(MAX_ELEMENT_LEVEL,st.fire));target.status.burnTurns=2;}
  if(st.poison){target.status.poison=Math.min(MAX_STATUS_STACKS,target.status.poison+Math.min(MAX_ELEMENT_LEVEL,st.poison));target.status.poisonTurns=3;}
  if(st.ice&&!melt)target.status.ice=Math.min(3,target.status.ice+st.ice);
  this.pop(p.x,p.y-30,(repeatHead?'擦伤 ':melt?'融爆 ':crit?'暴击 ':r.part==='head'?'爆头 ':'')+'−'+dealt,melt?'#f6b97e':'#f3d093');
  this.shake=r.part==='head'?.22:.12;this.hitStop=r.part==='head'?.065:.025;
  this.fx('impact',p.x,p.y,melt?'#efb276':'#efd6a5');this.emit('hit',{x:p.x,y:p.y,head:r.part==='head'&&!repeatHead,part:r.part,damage:dealt});
 }
 pickup(orb,b,p){if(orb.used)return;orb.used=true;const shooter=this.players[this.active];if(orb.type==='heart'){this.lastHeal=this.heal(shooter,20+shooter.stats.heal*15,orb.x,orb.y-25);}else{const currentVy=b.vy+G*b.t;const extra={x:p.x,y:p.y,vx:b.vx,vy:currentVy+(this.volleyCount%2?1:-1)*(this.active===1&&this.mode!=='local'?Math.min(48,22+this.volleyCount*6):8),scale:b.scale??1,pierce:b.pierce,ignored:new Set(b.ignored)};if(this.addArrow(extra))this.pop(orb.x,orb.y-35,'+1  共 '+this.volleyCount+' 箭','#f6dc85');else this.pop(orb.x,orb.y-35,'箭雨已满','#f6dc85');}this.fx('pickup',orb.x,orb.y,orb.type==='heart'?'#eaa1a0':'#f2d080');this.emit('pickup',{kind:orb.type,x:orb.x,y:orb.y});}
 tickArrows(dt){let left=dt;while(left>0&&this.arrows.length){const h=Math.min(left,1/300);for(const b of [...this.arrows]){b.t+=h;const p=position(b,b.t);if(Math.floor(b.t*40)!==b.lastTrail){this.trails.push({x:p.x,y:p.y,t:1});b.lastTrail=Math.floor(b.t*40);}for(const orb of this.orbs)if(!orb.used&&Math.hypot(p.x-orb.x,p.y-orb.y)<=orb.r)this.pickup(orb,b,p);if(this.mode==='target')for(const target of this.targets)if(!target.used&&Math.hypot(p.x-target.x,p.y-target.y)<=target.r){this.hitTargetBoard(target);b.dead=true;break;}if(b.dead)continue;const r=collision(p,this.mode==='target'?{x:-500,y:0}:this.players[1-this.active],this.obs,this.map,b.ignored);if(r){this.impact=p;if(r.kind==='obstacle'){this.hitObstacle(r.o,this.players[this.active].dir);if(b.pierce>0){b.pierce--;b.ignored.add(r.o.id);}else b.dead=true;}else{if(r.kind==='hit')this.hitTarget(b,r,p);b.dead=true;}}if(b.t>14)b.dead=true;}this.arrows=this.arrows.filter(b=>!b.dead);left-=h;}if(!this.arrows.length)this.setPhase('settle');}
 spawnOrbs(){if(!(this.mode==='rogue'||this.mode!=='target'&&this.stage===3))return;this.orbs=this.orbs.filter(o=>!o.used);for(let i=0;i<2&&this.orbs.length<12;i++){const shooter=this.players[i];const offset=220+this.rng()*270;const a=24+this.rng()*13;const b=launch(shooter,a);const p=position(b,offset/Math.abs(b.vx));const orb={id:'orb-'+this.round+'-'+i,x:Math.max(80,Math.min(W-80,p.x)),y:Math.min(p.y,ground(p.x,this.map)-65),r:25,type:this.rng()<.65?'plus':'heart',used:false};for(const o of this.obs)if(o.state==='standing'&&Math.abs(orb.x-o.x)<o.w/2+orb.r&&orb.y+orb.r>o.y-o.h)orb.y=o.y-o.h-orb.r-12;for(let n=0;n<12&&this.orbs.some(o=>Math.hypot(o.x-orb.x,o.y-orb.y)<58);n++)orb.y-=60;orb.y=Math.max(55,orb.y);this.orbs.push(orb);}}
 nextTurn(){if(this.mode==='target'){if(!this.volleyTargetHits)this.targetMisses++;if(this.targetMisses>=3){this.save.targetBest=Math.max(this.save.targetBest,this.targetScore);this.persist();this.win=false;this.winner=0;this.setPhase('defeat');return;}this.round++;this.active=0;if(this.targets.every(t=>t.used))this.newTargets();this.setPhase('scout');return;}if(this.players[1-this.active].hp<=0){this.complete(this.active===0||this.mode==='local');return;}this.active=1-this.active;this.round++;this.spawnOrbs();const p=this.players[this.active],source=this.players[1-this.active],poisonActive=p.status.poisonTurns>0,burning=p.status.burnTurns>0;let tick=0;if(p.status.burnTurns>0){tick+=p.status.burn*5;p.status.burnTurns--;if(!p.status.burnTurns)p.status.burn=0;}if(p.status.poisonTurns>0){tick+=p.status.poison*(burning?5:3);p.status.poisonTurns--;if(!p.status.poisonTurns)p.status.poison=0;}if(tick){const dealt=this.damage(p,tick,source,{leech:poisonActive});if(dealt)this.pop(p.x,p.y-145,'持续伤害 −'+dealt,'#c2d784');}if(p.hp<=0){impactBody(p,{point:{x:p.x,y:p.y-60},vx:source.dir*50,vy:20,damage:tick,part:'body',angle:this.angles[this.active]});this.complete(this.active!==0||this.mode==='local');return;}if(p.stats.cleanse){const before=p.status.burn+p.status.poison;for(const key of ['burn','poison'])p.status[key]=Math.ceil(p.status[key]*(1-p.stats.cleanse));if(p.status.burn+p.status.poison<before)this.pop(p.x,p.y-170,'净化 · 保留 '+Math.round((1-p.stats.cleanse)*100)+'% 层数','#b1d2d9');}if(p.stats.regen)this.heal(p,p.stats.regen*5+p.stats.armor*2);if(this.active===1&&this.mode!=='local')this.readyTurn();else this.setPhase('scout');}
 complete(win){this.win=win;this.winner=this.mode==='local'?(this.players[0].hp>0?0:1):win?0:1;if(win&&this.mode==='campaign'){if(this.stage===3){this.save.unlocked=true;this.save.checkpoint=1;}else this.save.checkpoint=Math.max(this.save.checkpoint,this.stage+1);this.persist();}if(this.mode==='rogue'){if(win){this.save.best=Math.max(this.save.best,this.floor);this.save.embers+=this.floor%3===0?3:1;this.persist();}this.emit('run',{floor:this.floor,win});}this.emit(win?'victory':'defeat');this.setPhase(win?'victory':'defeat');}
 resultNext(){if(this.phase==='victory'&&this.mode==='rogue'){this.choices=this.rollUpgrades();this.setPhase('upgrade');return;}if(this.phase==='victory'&&this.mode==='campaign'&&this.stage<3){this.stage++;this.stats=baseStats();this.setup();this.setPhase('intro');return;}if(this.phase==='defeat'&&this.mode==='campaign'){this.setup();this.setPhase('scout');return;}this.goHome();}
 rollUpgrades(){const ids=UPGRADES.filter(u=>!(u.id==='multi'&&this.stats.multi>=8)&&!(u.id==='ice'&&this.stats.ice>=3)&&!(u.id==='crit'&&this.stats.crit>=.75)&&!(u.id==='leech'&&this.stats.leech>=.6)&&!(['fire','poison'].includes(u.id)&&this.stats[u.id]>=MAX_ELEMENT_LEVEL));const result=[];const partner=SYNERGIES.flatMap(s=>s.needs.some(k=>this.stats[k]>0)&&!s.needs.every(k=>this.stats[k]>0)?s.needs.filter(k=>!this.stats[k]):[]);if(partner.length){const id=partner[Math.min(partner.length-1,Math.floor(this.rng()*partner.length))],i=ids.findIndex(u=>u.id===id);if(i>=0)result.push(ids.splice(i,1)[0]);}while(result.length<3&&ids.length){const i=Math.min(ids.length-1,Math.floor(this.rng()*ids.length));result.push(ids.splice(i,1)[0]);}return result;}
 chooseUpgrade(id){if(this.phase!=='upgrade'||!this.choices.some(c=>c.id===id))return false;applyUpgrade(this.stats,id);this.upgrades.push(id);const p=this.players[0];p.stats=this.stats;this.heal(p,(id==='vital'?25:id==='heal'?20:12)+(this.floor%3===0?25:0));this.floor++;this.stage=3;this.setup(false);this.setPhase('scout');return true;}
 buy(id){if(!this.save.unlocked||!['bow','life'].includes(id)||this.save[id]>=5)return false;const cost=3+this.save[id]*2;if(this.save.embers<cost)return false;this.save.embers-=cost;this.save[id]++;this.persist();return true;}
 chooseAI(){
  const p=this.players[1],target=this.players[0];let hits=[];
  for(const cover of [this.obs,[]]){
   for(let a=5;a<=75;a++){const hit=trace(p,target,a,cover,this.map);if(hit.kind==='hit')hits.push({angle:a,part:hit.part});}
   if(hits.length)break;
  }
  if(!hits.length)return 35;
  const group=hits.filter(h=>h.angle<hits[0].angle+12),lowBody=group.filter(h=>h.part!=='head');
  const body=lowBody.length?lowBody:hits.filter(h=>h.part!=='head');
  const choices=body.length&&this.rng()<.75?body:group;
  const chosen=choices[Math.min(choices.length-1,Math.floor(this.rng()*choices.length))].angle;
  // A high arc has a much narrower landing window. Use a smaller error there
  // so choosing a body route does not make the opponent miss every shot.
  const error=chosen>=45?Math.min(2,this.opponent.error):this.opponent.error;
  return Math.max(5,Math.min(75,Math.round(chosen+(this.rng()*2-1)*error)));
 }
 update(dt){dt=Math.min(dt,.05);if(this.hitStop>0){this.hitStop=Math.max(0,this.hitStop-dt);dt*=.2;}this.totalTime+=dt;this.phaseTime+=dt;for(const f of this.vfx)f.t-=dt;this.vfx=this.vfx.filter(f=>f.t>0);if(this.mode==='target')for(const t of this.targets)t.y=t.baseY+Math.sin(this.totalTime*1.1+t.seed)*24;this.shake=Math.max(0,this.shake-dt);for(const [i,p] of this.players.entries()){p.poseAngle=this.angles[i];updateBody(p,dt,x=>ground(x,this.map),W);p.recoil=Math.max(0,p.recoil-dt);if(p.hp<=0)p.deadTime+=dt;}for(const o of this.obs)if(o.state==='falling'){o.rot=Math.min(Math.PI/2,o.rot+dt*3);if(o.rot>=Math.PI/2)o.state='fallen';}for(const e of this.effects){e.t-=dt;e.y-=dt*20;}this.effects=this.effects.filter(e=>e.t>0);for(const t of this.trails)t.t-=dt*.32;this.trails=this.trails.filter(t=>t.t>0).slice(-1500);
 if(this.phase==='intro'&&this.phaseTime>=this.storyBeatDuration*3)this.setPhase('scout');else if(this.phase==='scout'&&this.phaseTime>=this.scoutDuration)this.readyTurn();else if(this.phase==='thinking'){this.angles[1]=this.chooseAI();this.powers[1]=100;this.shoot();}else if(this.phase==='flight')this.tickArrows(dt);else if(this.phase==='settle'&&this.phaseTime>=.85&&!this.players.some(p=>p.hp>0&&p.body?.active))this.nextTurn();}
}
