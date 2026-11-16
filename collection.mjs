// Permanent cosmetic progression. Pure data/arithmetic only: game events,
// account selection and author-practice isolation are owned by the caller.
export const AUTHOR_CODE='SHENG-ARCHER-2026';
export const ACHIEVEMENTS=Object.freeze([
 {id:'first_win',name:'开门一箭',description:'赢下一场电脑对决。',source:'stats',key:'wins',target:1,tokens:3},
 {id:'ten_heads',name:'尽量别打脸',description:'累计命中对手头部10次。',source:'stats',key:'heads',target:10,tokens:4},
 {id:'ten_casts',name:'弓术入门',description:'累计成功施展10次特殊弓术。',source:'stats',key:'casts',target:10,tokens:4},
 {id:'breaker',name:'场地拆迁队',description:'累计真正击破20个掩体。',source:'stats',key:'covers',target:20,tokens:4},
 {id:'expedition6',name:'六关巡回客',description:'无尽纪录达到第6关。',source:'records',key:'best',target:6,tokens:5},
 {id:'target500',name:'百步穿杨',description:'射靶纪录达到500分。',source:'records',key:'targetBest',target:500,tokens:4}
].map(Object.freeze));

const collectionSkin=(id,name,description,cost,gate,motif,trailColor,palette)=>Object.freeze({id,type:'skin',name,description,cost,gate,motif,trailColor,palette:Object.freeze(palette)});
export const COLLECTION_ITEMS=Object.freeze([
 collectionSkin('skin_sunset','赤霞游侠','赤金披风与日轮纹饰，箭迹带暖色流光。',3,'first_win','sunset','#ffc16e',
  {cloak:'#d75d35',fold:'#853e39',rim:'#ffcf80',cloth:'#f4dfb0',leather:'#674037',skin:'#edbb8d',hair:'#442b32',metal:'#e3b267'}),
 collectionSkin('skin_night','夜行鸦','鸦羽暗袍与月色面饰，留下紫色夜行箭迹。',5,'ten_heads','night','#b8a5ff',
  {cloak:'#484064',fold:'#252c43',rim:'#b9b0ec',cloth:'#acaec6',leather:'#343849',skin:'#dfb899',hair:'#202b39',metal:'#9ca6cb'}),
 collectionSkin('skin_storm','雷羽','青蓝雷纹和明亮肩饰，箭迹像一线电光。',7,'expedition6','storm','#9cecff',
  {cloak:'#198aa7',fold:'#25536b',rim:'#b4f5ed',cloth:'#e4f2d9',leather:'#394f63',skin:'#edbb8d',hair:'#284250',metal:'#d1d8a2'}),
 collectionSkin('skin_meteor','流星机甲','银青护甲与星核纹饰，保留原来的人体受击轮廓。',8,'breaker','meteor','#9ef3d5',
  {cloak:'#547c88',fold:'#354653',rim:'#a3f3d9',cloth:'#c9d7db',leather:'#3f5366',skin:'#e3b794',hair:'#314457',metal:'#b9d6dc'}),
 Object.freeze({id:'talent_quiver',type:'talent',name:'轻装箭匣',description:'无尽开局额外携带1份特箭弹药；容量仍为5份。',cost:8,gate:'ten_casts',effect:'quiver'}),
 Object.freeze({id:'talent_breach',type:'talent',name:'破阵先锋',description:'无尽每关的第一轮射击额外穿过1个障碍。',cost:8,gate:'breaker',effect:'breach'})
]);
const collectionBaseSkin=Object.freeze({id:'base',type:'skin',name:'原装弓手',description:'保留当前角色原本的装束。',cost:0,gate:null,motif:'base',trailColor:'#e7d5a7',palette:null});
const collectionNoTalent=Object.freeze({id:'none',type:'talent',name:'未携带',description:'不携带商店天赋。',cost:0,gate:null,effect:'none'});
const collectionStats=Object.freeze(['wins','heads','casts','covers','bosses']);
const collectionOwn=(object,key)=>Boolean(object&&Object.prototype.hasOwnProperty.call(object,key));
const collectionObject=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const collectionInteger=(value,max)=>Number.isFinite(value)?Math.max(0,Math.min(max,Math.floor(value))):0;
const collectionEmpty=()=>({version:1,revision:0,tokens:0,stats:{wins:0,heads:0,casts:0,covers:0,bosses:0},claimed:[],owned:[],skin:'base',talent:'none'});
const collectionBump=profile=>{profile.revision=Math.min(1e9,profile.revision+1);return profile;};
const collectionIds=(raw,catalogue)=>{
 const supplied=new Set(Array.isArray(raw)?raw.filter(value=>typeof value==='string'):[]);
 return catalogue.filter(item=>supplied.has(item.id)).map(item=>item.id);
};

export function validCollection(raw){
 const input=collectionObject(raw),profile=collectionEmpty();
 if(collectionOwn(input,'version')&&input.version!==1)return profile;
 profile.revision=collectionInteger(collectionOwn(input,'revision')?input.revision:0,1e9);
 profile.tokens=collectionInteger(collectionOwn(input,'tokens')?input.tokens:0,9999);
 const stats=collectionObject(collectionOwn(input,'stats')?input.stats:null);
 for(const key of collectionStats)profile.stats[key]=collectionInteger(collectionOwn(stats,key)?stats[key]:0,999999);
 profile.claimed=collectionIds(collectionOwn(input,'claimed')?input.claimed:null,ACHIEVEMENTS);
 profile.owned=collectionIds(collectionOwn(input,'owned')?input.owned:null,COLLECTION_ITEMS);
 const selectedSkin=COLLECTION_ITEMS.find(item=>item.id===input.skin&&item.type==='skin');
 const selectedTalent=COLLECTION_ITEMS.find(item=>item.id===input.talent&&item.type==='talent');
 if(collectionOwn(input,'skin')&&selectedSkin&&profile.owned.includes(selectedSkin.id))profile.skin=selectedSkin.id;
 if(collectionOwn(input,'talent')&&selectedTalent&&profile.owned.includes(selectedTalent.id))profile.talent=selectedTalent.id;
 return profile;
}

export function hasCollectionData(raw){
 const c=validCollection(raw);
 return c.revision>0||c.tokens>0||c.claimed.length>0||c.owned.length>0||c.skin!=='base'||c.talent!=='none'||collectionStats.some(key=>c.stats[key]>0);
}
export function collectionBalance(raw){return validCollection(raw).tokens;}
export function collectionSummary(raw){const c=validCollection(raw);return '风格券 '+c.tokens+' · 已购 '+c.owned.length+' 件 · 成就 '+c.claimed.length+'/'+ACHIEVEMENTS.length;}
export function skinById(id){return COLLECTION_ITEMS.find(item=>item.id===id&&item.type==='skin')||collectionBaseSkin;}
export function talentById(id){return COLLECTION_ITEMS.find(item=>item.id===id&&item.type==='talent')||collectionNoTalent;}

export function achievementProgress(raw,records={},id){
 const definition=typeof id==='string'?ACHIEVEMENTS.find(item=>item.id===id):ACHIEVEMENTS.find(item=>item.id===id?.id),profile=validCollection(raw);
 if(!definition)return {value:0,target:0,completed:false,claimed:false,ratio:0};
 const source=definition.source==='stats'?profile.stats:collectionObject(records),value=collectionInteger(collectionOwn(source,definition.key)?source[definition.key]:0,999999);
 return {value,target:definition.target,completed:value>=definition.target,claimed:profile.claimed.includes(definition.id),ratio:Math.min(1,value/definition.target)};
}
function collectionAwards(profile,records){
 const awards=[];
 for(const achievement of ACHIEVEMENTS)if(!profile.claimed.includes(achievement.id)&&achievementProgress(profile,records,achievement).completed){
  profile.claimed.push(achievement.id);profile.tokens=Math.min(9999,profile.tokens+achievement.tokens);awards.push(achievement);
 }
 // Canonical order makes cloud and manual snapshot comparison deterministic.
 profile.claimed=collectionIds(profile.claimed,ACHIEVEMENTS);return awards;
}
export function claimCollection(raw,records={}){
 const profile=validCollection(raw),awards=collectionAwards(profile,records);
 if(awards.length)collectionBump(profile);
 return {profile,awards};
}
export function recordCollectionResult(raw,kind,amount=1,records={}){
 const profile=validCollection(raw);let changed=false;
 if(collectionStats.includes(kind)){
  const increment=collectionInteger(amount,999999),before=profile.stats[kind];
  profile.stats[kind]=Math.min(999999,before+increment);
  const actual=profile.stats[kind]-before;changed=actual>0;
  if(kind==='bosses'&&actual>0)profile.tokens=Math.min(9999,profile.tokens+actual);
 }
 const awards=collectionAwards(profile,records);
 if(changed||awards.length)collectionBump(profile);
 return {profile,awards};
}
export function recordCollection(raw,kind,amount=1,records={}){return recordCollectionResult(raw,kind,amount,records).profile;}

export function purchaseCollection(raw,id){
 const profile=validCollection(raw),item=COLLECTION_ITEMS.find(entry=>entry.id===id);
 if(!item)return {ok:false,profile,message:'找不到这件商品。'};
 if(profile.owned.includes(item.id))return {ok:false,profile,message:'已经拥有这件商品。'};
 if(!profile.claimed.includes(item.gate))return {ok:false,profile,message:'先完成「'+ACHIEVEMENTS.find(entry=>entry.id===item.gate).name+'」解锁购买。'};
 if(profile.tokens<item.cost)return {ok:false,profile,message:'风格券不足，还需要 '+(item.cost-profile.tokens)+' 张。'};
 profile.tokens-=item.cost;profile.owned.push(item.id);profile.owned=collectionIds(profile.owned,COLLECTION_ITEMS);collectionBump(profile);
 return {ok:true,profile,message:'已购入「'+item.name+'」，可立即装备。'};
}
export function equipCollection(raw,id){
 const profile=validCollection(raw);let field,value,name;
 if(id==='base'){field='skin';value='base';name=collectionBaseSkin.name;}
 else if(id==='none'){field='talent';value='none';name=collectionNoTalent.name;}
 else{
  const item=COLLECTION_ITEMS.find(entry=>entry.id===id);
  if(!item||!profile.owned.includes(id))return {ok:false,profile,message:'请先购买这件商品。'};
  field=item.type==='skin'?'skin':'talent';value=id;name=item.name;
 }
 if(profile[field]===value)return {ok:true,profile,message:'正在使用「'+name+'」。'};
 profile[field]=value;collectionBump(profile);return {ok:true,profile,message:'已装备「'+name+'」。'};
}
export function makePracticeCollection(raw){
 const profile=validCollection(raw);profile.tokens=9999;profile.claimed=ACHIEVEMENTS.map(item=>item.id);profile.owned=COLLECTION_ITEMS.map(item=>item.id);
 return collectionBump(profile);
}
