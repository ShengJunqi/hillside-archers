// Optional, per-encounter crowd challenges. No combat RNG, permanent currency,
// storage or Game reference belongs here; callers decide when to apply a reward.
export const BOUNTY_HEAL=8;
export const BOUNTY_KINDS=Object.freeze(['cover','body','pickup','skill-hit']);
const bountyHash=text=>{let value=2166136261;for(const char of String(text)){value^=char.codePointAt(0);value=Math.imul(value,16777619);}value=Math.imul(value^(value>>>16),0x7feb352d);value=Math.imul(value^(value>>>15),0x846ca68b);return (value^(value>>>16))>>>0;};
const bountyLimit=(value,min,max)=>Math.max(min,Math.min(max,Number.isFinite(value)?Math.floor(value):min));
const bountyId=value=>(typeof value==='string'&&value.length>0)||(typeof value==='number'&&Number.isFinite(value));
const bountyReward=reward=>reward?.kind==='reroll'?{kind:'reroll',amount:1}:{kind:'heal',amount:BOUNTY_HEAL};

export function bountyFor(encounter,floor=1){
 if(!encounter||typeof encounter!=='object')return null;
 const depth=bountyLimit(floor,1,99999),coverCount=Array.isArray(encounter.cover)?encounter.cover.length:0;
 const hash=bountyHash(`${encounter.id||encounter.layoutId||encounter.name||'arena'}:${depth}`);
 const kinds=['body','pickup','skill-hit'];if(coverCount>=2)kinds.push('cover');
 const kind=kinds[hash%kinds.length],target=kind==='skill-hit'?1:kind==='cover'?Math.min(coverCount,depth>=16?3:2):depth>=20?3:2;
 const pickupKind=kind==='pickup'?(encounter.supply==='hearts'?'heart':hash%3===0?'plus':'any'):null;
 const names={cover:'拆台嘉宾',body:'别只盯着头',pickup:'路过就带走','skill-hit':'空中加个戏'};
 const pickupName=pickupKind==='heart'?'爱心':pickupKind==='plus'?'+1 道具':'道具球';
 const objectives={cover:`击破 ${target} 个掩体`,body:`命中身体或四肢 ${target} 次`,pickup:`穿过 ${pickupName} ${target} 个`,'skill-hit':`施展弓术并命中 ${target} 次`};
 return {id:`bounty:${encounter.id||encounter.layoutId||hash}:${depth}:${kind}`,kind,name:names[kind],objective:objectives[kind],target,pickupKind,reward:{kind:'heal',amount:BOUNTY_HEAL}};
}

export function createBountyState(spec){
 if(!spec||!BOUNTY_KINDS.includes(spec.kind))return null;
 const target=bountyLimit(spec.target,1,3),reward=bountyReward(spec.reward);
 return {spec:{...spec,target,reward},progress:0,complete:false,claimed:false,seen:new Set(),seenEvents:new WeakSet()};
}

function bountyObjectKey(event,field,prefix){
 const id=event[field]??event.id;
 if(bountyId(id))return `${prefix}:${id}`;
 // Real core events already carry coordinates. IDs are preferable because a
 // later round may spawn a different ball at the same position.
 if(Number.isFinite(event.x)&&Number.isFinite(event.y))return `${prefix}:${event.x.toFixed(2)}:${event.y.toFixed(2)}`;
 return null;
}

export function recordBounty(state,event){
 if(!state||state.complete||!event||typeof event!=='object'||event.shooterSide!==0)return false;
 if(state.seenEvents.has(event))return false;
 const spec=state.spec;let key=null;
 if(spec.kind==='cover'){
  if(event.type!=='break'||event.broken!==true)return false;
  key=bountyObjectKey(event,'obstacleId','cover');if(key===null)return false;
 }else if(spec.kind==='pickup'){
  if(event.type!=='pickup'||!['heart','plus'].includes(event.kind))return false;
  if(spec.pickupKind&&spec.pickupKind!=='any'&&spec.pickupKind!==event.kind)return false;
  key=bountyObjectKey(event,'orbId','orb');if(key===null)return false;
 }else{
  if(event.type!=='hit'||!Number.isFinite(event.damage)||event.damage<=0)return false;
  if(spec.kind==='body'&&!['body','arms','legs','feet'].includes(event.part))return false;
  // The flag is captured when the hit happens. Merely activating a skill, or a
  // hit from an earlier/later volley, is not enough to earn this challenge.
  if(spec.kind==='skill-hit'&&event.skillUsed!==true&&event.bySkill!==true)return false;
  const id=event.eventId??event.arrowId;
  if(bountyId(id))key=`hit:${event.volleyId??''}:${id}`;
 }
 if(key!==null&&state.seen.has(key))return false;
 if(key!==null)state.seen.add(key);state.seenEvents.add(event);
 state.progress=Math.min(spec.target,state.progress+1);state.complete=state.progress>=spec.target;return true;
}

export function bountyProgressText(state){
 if(!state)return '';
 const reward=state.spec.reward.kind==='reroll'?'奖励重选一次':`奖励回血 ${state.spec.reward.amount}`;
 return `${state.spec.objective} · ${state.progress}/${state.spec.target}${state.complete?' ✓':''} · ${state.claimed?'奖励已领':reward}`;
}

export function rewardBounty(state){
 const complete=Boolean(state?.complete),granted=complete&&!state.claimed;
 if(granted)state.claimed=true;
 return {completed:complete,granted,heal:granted&&state.spec.reward.kind==='heal'?state.spec.reward.amount:0,rerolls:granted&&state.spec.reward.kind==='reroll'?1:0};
}
