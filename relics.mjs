// Reward definitions and arithmetic only. Combat events, ammunition and turn
// state belong to Game; rendering a preview must never trigger those effects.
export const NEW_RELICS=Object.freeze([
 {id:'echo',name:'回声落羽',tag:'追击',icon:'⤓',desc:'每轮首次实体命中召来落羽追击：每阶1支，每支45%伤害，追随受击站位，落羽不再触发回声；24箭已满时改为每阶12点基础追击，随箭伤加成。'},
 {id:'fuse',name:'元素引信',tag:'引燃',icon:'✺',desc:'每轮首次特殊箭命中时，立即引爆目标已有的一轮火毒伤害：一至三阶为60%／90%／120%；不消耗持续回合、不重复叠层。'},
 {id:'reclaim',name:'神射回收',tag:'补弹',icon:'↶',desc:'每关首次特殊箭爆头返还1发特箭弹药；每关仅一次，最高一阶。'}
]);
export const RETIRED_RELICS=Object.freeze(['balance','heal','regen','impact','armor']);

const relicCaps=Object.freeze({echo:3,fuse:3,reclaim:1});
const relicNumber=(value,fallback=0)=>Number.isFinite(value)?Math.max(0,value):fallback;
const relicRank=(stats,id)=>Math.floor(relicNumber(stats?.[id]));
const rewardPercent=value=>Math.round(relicNumber(value)*100)+'%';
const rewardIncrement=(stats,id,amount,cap=Infinity,fallback=0)=>{
 const current=relicNumber(stats[id],fallback);
 // Retain an older run's already-higher value; a new offer must not reduce it.
 stats[id]=current>=cap?current:Math.min(cap,current+amount);
};

export function newRelicCap(id){return Object.hasOwn(relicCaps,id)?relicCaps[id]:0;}
export function newRelicEligible(stats,id){
 const cap=newRelicCap(id);
 return cap>0&&relicRank(stats,id)<cap&&(id!=='fuse'||relicNumber(stats?.fire)>0||relicNumber(stats?.poison)>0);
}
export function applyNewRelic(stats,id){
 const cap=newRelicCap(id);if(!cap)return false;
 const current=relicRank(stats,id);stats[id]=current>=cap?current:Math.min(cap,current+1);return true;
}
export function newRelicPreview(stats,id){
 const cap=newRelicCap(id);if(!cap)return null;
 const rank=relicRank(stats,id);if(rank>=cap)return '已达 '+cap+' 阶上限';
 const next=rank+1;
 if(id==='echo')return '落羽 '+rank+' → '+next+' 支 · 每支45%伤害\n每轮首次实体命中触发，落羽不递归；满24箭时基础追击 '+rank*12+' → '+next*12+'，随箭伤加成';
 if(id==='fuse')return '即时火毒 '+Math.round(([0,.6,.9,1.2][rank]||0)*100)+'% → '+Math.round([0,.6,.9,1.2][next]*100)+'%\n每轮首次特殊箭命中触发，不消耗持续回合';
 return '每关首次特殊箭爆头 · 返还1发特箭弹药\n每关最多一次，不能超过箭袋容量';
}

export function fuseDamage(stats,status){
 const rank=Math.min(3,relicRank(stats,'fuse'));
 if(!rank||!(relicNumber(stats?.fire)>0||relicNumber(stats?.poison)>0))return 0;
 const burn=Math.min(9999,Math.floor(relicNumber(status?.burn))),poison=Math.min(9999,Math.floor(relicNumber(status?.poison)));
 const burning=burn>0&&relicNumber(status?.burnTurns)>0,poisoned=poison>0&&relicNumber(status?.poisonTurns)>0;
 return ((burning?burn*5:0)+(poisoned?poison*(burning?5:3):0))*[0,.6,.9,1.2][rank];
}

// These stronger increments are used for the new two-floor reward cadence.
// Legacy applyUpgrade remains separate so callers can retain its old contract.
// true means handled, including an already-capped value; false means the caller
// may fall back to a legacy upgrade. Current HP is applied by Game, not here.
export function applyRewardUpgrade(stats,id){
 if(applyNewRelic(stats,id))return true;
 switch(id){
 case 'damage':rewardIncrement(stats,'damage',.4,Infinity,1);break;
 case 'multi':rewardIncrement(stats,'multi',1,8,1);break;
 case 'fire':case 'poison':rewardIncrement(stats,id,2,999);break;
 case 'ice':rewardIncrement(stats,id,1,3);break;
 case 'pierce':rewardIncrement(stats,id,1,3);break;
 case 'leech':rewardIncrement(stats,id,.18,.6);break;
 case 'crit':rewardIncrement(stats,id,.2,.75);break;
 case 'vital':rewardIncrement(stats,'maxHp',40,Infinity,100);break;
 default:return false;
 }
 return true;
}

export function rewardUpgradePreview(stats,id){
 const special=newRelicPreview(stats,id);if(special!==null)return special;
 const after={...stats};if(!applyRewardUpgrade(after,id))return null;
 const current=relicNumber(stats?.[id]),next=relicNumber(after[id]);
 if(id==='damage')return '直接伤害 '+rewardPercent(relicNumber(stats?.damage,1))+' → '+rewardPercent(after.damage)+' · 本次+40个百分点';
 if(id==='multi')return current>=8?'已达8箭上限':'起手箭数 '+relicNumber(stats?.multi,1)+' → '+after.multi;
 if(id==='fire'||id==='poison'){
  if(current>=999)return '已达999阶上限';
  const fire=id==='fire',perStack=fire?5:relicNumber(stats?.fire)>0?5:3;
  return current+' → '+next+' 阶 · 本次+2阶\n每次命中 +'+current+' → +'+next+' 层'+(fire?'灼烧':'毒')+'；单次基础 '+current*perStack+' → '+next*perStack+'/轮';
 }
 if(id==='ice')return current>=3?'已达3阶上限':'冰霜 '+current+' → '+next+' 阶 · 下一箭减伤 '+Math.round(Math.min(.45,current*.15)*100)+'% → '+Math.round(Math.min(.45,next*.15)*100)+'%';
 if(id==='pierce')return (current>=3?'已达3阶穿障上限':'每箭穿过障碍 '+current+' → '+next+' 个')+'\n每关首次击破掩体返还1发特箭弹药';
 if(id==='leech')return current>=.6?'已达60%吸血上限':'吸血率 '+rewardPercent(current)+' → '+rewardPercent(next)+' · 本次+18个百分点';
 if(id==='crit')return current>=.75?'已达75%暴击上限':'暴击率 '+rewardPercent(current)+' → '+rewardPercent(next)+' · 本次+20个百分点';
 return '最大生命 '+relicNumber(stats?.maxHp,100)+' → '+after.maxHp+' · 立即回复40';
}
