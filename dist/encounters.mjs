// Authored physical arenas: distances and elevations are gameplay, not backdrops.
// Profile nodes use a monotone smooth interpolation so each shelf is walkable.
// Keep the original combat coordinates; extra land is retreat room, not a
// larger opening gap. W=1600 remains the presentation/reference coordinate size.
export const ARENA_LEFT=-1000,ARENA_RIGHT=2600;
export function arenaBounds(terrain){
 const bounds=terrain?.bounds,left=bounds?.left,right=bounds?.right;
 return Number.isFinite(left)&&Number.isFinite(right)&&right>left?{left,right,width:right-left}:{left:0,right:1600,width:1600};
}
function retreatProfile(profile){
 const leftY=profile[0][1],rightY=profile.at(-1)[1];
 // Gentle inward-facing berms ease a fighter off the far wall. The whole
 // original 0..1600 surface, including both starting shelves, stays exact.
 return [[ARENA_LEFT,leftY-60],[ARENA_LEFT+300,leftY],...profile.map(p=>[...p]),[ARENA_RIGHT-300,rightY],[ARENA_RIGHT,rightY-60]];
}
export const ARENAS=Object.freeze([
 {id:'yard',name:'歪旗训练场',kind:'近距浅谷',xs:[520,1080],landmark:'stands',tip:'近距离对射；浅谷给低抛留出空间，半力也能打出好落点',profile:[[0,735],[350,735],[470,690],[580,690],[800,735],[1020,690],[1130,690],[1250,735],[1600,735]],cover:[[800,'crate',72,54]],recommendedPower:45},
 {id:'bowl',name:'碗底俱乐部',kind:'高岸深谷',xs:[360,1240],landmark:'bowl',tip:'左岸高、右岸低，中间深谷；下坡试着收力，上坡抬角度',profile:[[0,650],[180,650],[300,560],[450,560],[800,755],[1140,680],[1300,680],[1470,740],[1600,740]],cover:[[730,'crate',80,58],[940,'post',30,70]],recommendedPower:55},
 {id:'dock',name:'歪脖子码头',kind:'超远平岸',xs:[140,1460],landmark:'crane',tip:'长距离双岸；先打薄木桩，也能越过低箱直达身体',profile:[[0,730],[90,670],[280,670],[620,710],[1020,710],[1320,670],[1510,670],[1600,730]],cover:[[500,'crate',76,64],[800,'post',32,86],[1110,'crate',76,64]],recommendedPower:65},
 {id:'ridge',name:'巨龟背上',kind:'仰攻高台',xs:[260,1340],landmark:'turtle',tip:'右侧高出两层楼；仰攻要抬角，顶上的对手也得重新算落点',profile:[[0,750],[140,680],[390,680],[650,630],[920,570],[1210,470],[1400,470],[1600,650]],cover:[[630,'crate',68,52],[1030,'post',28,65]],recommendedPower:65},
 {id:'market',name:'打烊夜市',kind:'陡岸俯射',xs:[300,1300],landmark:'market',tip:'左高右低；高处不代表稳赢，近乎直射的满力箭容易飞过',profile:[[0,650],[80,650],[240,470],[420,470],[650,580],[920,715],[1160,650],[1360,650],[1600,750]],cover:[[720,'crate',76,60],[1030,'post',30,72]],recommendedPower:55},
 {id:'bridge',name:'纸箱收费站',kind:'短桥双坡',xs:[440,1160],landmark:'bridge',tip:'双岸短距离；第五回合中央路障会倒，别一直等同一个角度',rule:'collapse',profile:[[0,740],[220,740],[350,650],[540,650],[800,755],[1060,650],[1240,650],[1400,740],[1600,740]],cover:[[700,'crate',66,55],[800,'post',32,96],[925,'crate',66,55]],recommendedPower:55},
 {id:'signs',name:'路标全写反了',kind:'落差长坡',xs:[180,1420],landmark:'signs',tip:'两侧相差240高度；左侧俯射，右侧仰射，照搬角度一定歪',profile:[[0,610],[130,470],[330,470],[610,590],[900,590],[1260,710],[1470,710],[1600,760]],cover:[[580,'post',28,66],[1020,'post',28,66]],recommendedPower:65},
 {id:'festival',name:'空碗颁奖台',kind:'贴身快打',xs:[540,1060],landmark:'podium',tip:'最短赛场；力度很重要，补给更偏爱心，抓住对手失误',supply:'hearts',profile:[[0,700],[300,700],[480,640],[620,640],[800,680],[980,640],[1120,640],[1300,700],[1600,700]],cover:[[800,'crate',82,50]],recommendedPower:40},
 {id:'switchback',name:'弯路不包邮',kind:'错层上坡',xs:[280,1320],landmark:'signs',tip:'先越矮岭再上高台；掩体倒下后，用较低弧线逼对手失衡',profile:[[0,770],[100,770],[220,710],[410,710],[640,650],[810,750],[1120,530],[1390,530],[1600,700]],cover:[[620,'crate',72,52],[970,'post',30,68]],recommendedPower:65},
 {id:'sinkhole',name:'漏风碗底',kind:'双崖深沟',xs:[400,1200],landmark:'bowl',tip:'两岸齐平，中间陷得很深；看清地形，低抛不会被谷底吞掉',profile:[[0,730],[120,730],[330,620],[500,620],[760,770],[880,770],[1100,620],[1270,620],[1490,730],[1600,730]],cover:[[720,'crate',72,55],[890,'crate',72,55]],recommendedPower:50},
 {id:'balcony',name:'楼上请收箭',kind:'高台远投',xs:[160,1440],landmark:'market',tip:'右台很高、距离也远；打出稳定仰角，再抢下空中补给',profile:[[0,735],[100,650],[310,650],[700,700],[970,610],[1290,440],[1480,440],[1600,610]],cover:[[660,'crate',78,62],[1090,'post',30,62]],recommendedPower:65},
 {id:'crossing',name:'上下班交界',kind:'阶梯中场',xs:[380,1220],landmark:'stands',tip:'右边高一层，中间有缓台；身体命中也能把对手推离好位置',profile:[[0,730],[80,730],[320,650],[490,650],[710,590],[900,625],[1100,560],[1290,560],[1530,680],[1600,680]],cover:[[720,'crate',70,54],[980,'post',28,62]],recommendedPower:55}
]);
export const ENEMY_STYLES=Object.freeze([
 {id:'steady',name:'认真打工人',tip:'偏好低弧线与身体落点'},
 {id:'loft',name:'高抛怪',tip:'喜欢高抛，但仍会射偏'},
 {id:'breaker',name:'拆台客',tip:'会先拆挡路的掩体'},
 {id:'forager',name:'追心鬼',tip:'受伤时会优先争抢爱心'}
]);
const encounterHash=n=>{n=Math.imul(n^(n>>>16),0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return (n^(n>>>16))>>>0;};
const encounterEase=t=>t*t*(3-2*t);
const encounterProfileY=(x,profile)=>{
 if(x<=profile[0][0])return profile[0][1];
 for(let i=1;i<profile.length;i++)if(x<=profile[i][0]){const a=profile[i-1],b=profile[i],t=encounterEase((x-a[0])/(b[0]-a[0]));return a[1]+(b[1]-a[1])*t;}
 return profile[profile.length-1][1];
};
// A new run can vary its real stations without deforming the authored ground.
// Keep this separate from encounterFor: the tutorial and reference fixtures can
// retain their base layout, while previews and gameplay share the same variant.
export function varyEncounter(encounter,seed=0){
 const originalXs=[...(encounter.variation?.originalXs||encounter.xs)],originalPower=encounter.variation?.originalPower??encounter.geometry.recommendedPower;
 const variationSeed=Number.isFinite(seed)?Math.trunc(seed)>>>0:0,bounds=arenaBounds(encounter.terrain),surface=encounter.terrain;
 const safe=(x,origin)=>{
  if(x<Math.max(70,bounds.left+70)||x>Math.min(1530,bounds.right-70)||Math.abs(encounterGround(x,surface)-encounterGround(origin,surface))>65)return false;
  if(encounter.cover.some(([ox,,w])=>Math.abs(x-ox)<w/2+85))return false;
  if(Math.abs(encounterGround(x+18,surface)-encounterGround(x-18,surface))>29)return false;
  return [-18,-9,0,9,18].every(offset=>Math.abs((encounterGround(x+offset+3,surface)-encounterGround(x+offset-3,surface))/6)<=.9);
 };
 const candidates=originalXs.map(origin=>Array.from({length:19},(_,i)=>origin+(i-9)*20).filter(x=>safe(x,origin))),pairs=[];
 for(const left of candidates[0])for(const right of candidates[1])if(right-left>=430&&right-left<=1540)pairs.push([left,right]);
 let layoutHash=0;for(const letter of String(encounter.layoutId||''))layoutHash=Math.imul(layoutHash,31)+letter.charCodeAt(0)|0;
 const selected=pairs.length?pairs[encounterHash(variationSeed^layoutHash)%pairs.length]:originalXs;
 const xs=[...selected],profile=surface.profile.map(point=>[...point]),terrain={...surface,profile,...(surface.bounds?{bounds:{...surface.bounds}}:{})};
 const leftY=encounterGround(xs[0],terrain),rightY=encounterGround(xs[1],terrain),distance=xs[1]-xs[0],baseDistance=originalXs[1]-originalXs[0];
 const recommendedPower=Math.max(20,Math.min(100,Math.round(originalPower*Math.sqrt(distance/baseDistance)/5)*5));
 const originalId=encounter.variation?.originalId??encounter.id;
 return {...encounter,id:`${originalId}:stance:${variationSeed}`,terrain,xs,cover:encounter.cover.map(cover=>[...cover]),enemy:{...encounter.enemy},
  geometry:{...encounter.geometry,distance,leftY,rightY,heightDelta:Math.round(leftY-rightY),recommendedPower},
  preview:{...encounter.preview,profile:profile.map(point=>[...point]),xs:[...xs]},
  variation:{seed:variationSeed,originalId,originalXs,originalPower,offsets:xs.map((x,i)=>x-originalXs[i])}};
}
export function encounterFor(seed,floor=1,route=0,previousId=''){
 floor=Math.max(1,Math.floor(floor));const offset=encounterHash(seed)%ARENAS.length;
 let index=(offset+floor-1+route*5)%ARENAS.length;if(ARENAS[index].id===previousId)index=(index+1)%ARENAS.length;
 const a=ARENAS[index],map=(encounterHash(seed+91)%3+floor-1+Math.floor((floor-1)/3)+route)%3;
 const style=ENEMY_STYLES[(encounterHash(seed+507)+floor+route)%ENEMY_STYLES.length],profile=retreatProfile(a.profile);
 const terrain={shape:'profile',profile,map,key:`${a.id}:${map}`,bounds:{left:ARENA_LEFT,right:ARENA_RIGHT}};
 const leftY=encounterProfileY(a.xs[0],profile),rightY=encounterProfileY(a.xs[1],profile),heightDelta=Math.round(leftY-rightY);
 const geometry={distance:a.xs[1]-a.xs[0],leftY,rightY,heightDelta,relief:Math.max(...profile.map(p=>p[1]))-Math.min(...profile.map(p=>p[1])),kind:a.kind,recommendedPower:a.recommendedPower};
 return {id:`${seed}:${floor}:${route}:${a.id}`,layoutId:a.id,name:a.name,map,terrain,xs:[...a.xs],cover:a.cover.map(c=>[...c]),landmark:a.landmark,tip:a.tip,rule:a.rule||'none',supply:a.supply||(route?'hearts':'mixed'),enemy:{...style},boss:floor%3===0,geometry,preview:{profile:profile.map(p=>[...p]),xs:[...a.xs]}};
}
export function encounterRoutes(seed,floor,previousId=''){
 const a=encounterFor(seed,floor,0,previousId);
 // Tickets differ in an actual shot constraint: range or platform elevation.
 for(let route=1;route<ARENAS.length;route++){
  const b=encounterFor(seed,floor,route,previousId);
  if(a.layoutId!==b.layoutId&&(Math.abs(a.geometry.distance-b.geometry.distance)>=180||Math.abs(a.geometry.heightDelta-b.geometry.heightDelta)>=90))return [a,b];
 }
 return [a,encounterFor(seed,floor,1,previousId)];
}
export function encounterGround(x,terrain){
 if(Array.isArray(terrain.profile)&&terrain.profile.length>1)return encounterProfileY(x,terrain.profile);
 // Retain numeric-shape compatibility for older callers and isolated previews.
 const n=Math.max(0,Math.min(1,x/1600)),wave=Math.sin(x/180)*4;
 switch(terrain.shape){
 case 'slope':return 700-60*n+wave;
 case 'reverse':return 640+60*n+wave;
 case 'bowl':return 650+48*Math.sin(Math.PI*n)+wave;
 case 'ridge':return 700-36*Math.sin(Math.PI*n)+wave;
 case 'steps':return 680-22*Math.tanh((x-800)/170)+wave;
 default:return 682+wave;
 }
}
export function encounterObstacles(encounter,groundAt){return encounter.cover.map(([x,type,w,h],id)=>({id,x,y:groundAt(x),w,h,type,hp:type==='crate'?2:1,maxHp:type==='crate'?2:1,state:'standing',rot:0,dir:1}));}
