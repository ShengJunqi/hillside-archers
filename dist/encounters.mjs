// A run combines authored, shootable arenas instead of random walls.
// This PRNG is separate from combat: previews and drawing never change a shot.
export const ARENAS=Object.freeze([
 {id:'yard',name:'歪旗训练场',shape:'slope',xs:[180,1420],landmark:'stands',tip:'低箱掩体，先找身体的落点',cover:[[620,'crate',74,58],[990,'crate',74,58]]},
 {id:'bowl',name:'碗底俱乐部',shape:'bowl',xs:[150,1450],landmark:'bowl',tip:'两边高，中间低；低弧线也能过',cover:[[710,'crate',90,62],[870,'crate',74,58]]},
 {id:'dock',name:'歪脖子码头',shape:'flat',xs:[120,1480],landmark:'crane',tip:'长距离，拆箱打开直射路线',cover:[[470,'crate',78,64],[810,'post',32,88],[1140,'crate',78,64]]},
 {id:'ridge',name:'巨龟背上',shape:'ridge',xs:[200,1400],landmark:'turtle',tip:'缓坡隆起，抬一点角度越过龟背',cover:[[690,'crate',68,52],[930,'crate',68,52]]},
 {id:'market',name:'打烊夜市',shape:'reverse',xs:[170,1430],landmark:'market',tip:'一高一低，别照抄上一场的角度',cover:[[560,'crate',76,62],[1020,'post',30,78]]},
 {id:'bridge',name:'纸箱收费站',shape:'bowl',xs:[230,1370],landmark:'bridge',tip:'近身赛场；第五回合中央路障会倒',rule:'collapse',cover:[[660,'crate',68,60],[800,'post',34,96],[950,'crate',68,60]]},
 {id:'signs',name:'路标全写反了',shape:'steps',xs:[120,1480],landmark:'signs',tip:'双台地长距离，薄路障一箭就倒',cover:[[550,'post',28,70],[1050,'post',28,70]]},
 {id:'festival',name:'空碗颁奖台',shape:'flat',xs:[210,1390],landmark:'podium',tip:'开阔短场，补给偏爱心，拼命中节奏',supply:'hearts',cover:[[800,'crate',92,54]]}
]);
export const ENEMY_STYLES=Object.freeze([
 {id:'steady',name:'认真打工人',tip:'偏好低弧线与身体落点'},
 {id:'loft',name:'高抛怪',tip:'喜欢高抛，但仍会射偏'},
 {id:'breaker',name:'拆台客',tip:'会先拆挡路的掩体'},
 {id:'forager',name:'追心鬼',tip:'受伤时会优先争抢爱心'}
]);
const encounterHash=n=>{n=Math.imul(n^(n>>>16),0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return (n^(n>>>16))>>>0;};
export function encounterFor(seed,floor=1,route=0,previousId=''){
 floor=Math.max(1,Math.floor(floor));const offset=encounterHash(seed) % ARENAS.length;
 let index=(offset+floor-1+route*3)%ARENAS.length;if(ARENAS[index].id===previousId)index=(index+1)%ARENAS.length;
 const a=ARENAS[index],map=(encounterHash(seed+91)%3+floor-1+Math.floor((floor-1)/3)+route)%3;
 const style=ENEMY_STYLES[(encounterHash(seed+507)+floor+route)%ENEMY_STYLES.length];
 return {id:`${seed}:${floor}:${route}:${a.id}`,layoutId:a.id,name:a.name,map,terrain:{shape:a.shape,map,key:`${a.shape}:${map}`},xs:[...a.xs],cover:a.cover.map(c=>[...c]),landmark:a.landmark,tip:a.tip,rule:a.rule||'none',supply:a.supply||(route?'hearts':'mixed'),enemy:{...style},boss:floor%3===0};
}
export function encounterRoutes(seed,floor,previousId=''){
 const a=encounterFor(seed,floor,0,previousId),b=encounterFor(seed,floor,1,previousId);
 if(a.layoutId===b.layoutId)return [a,encounterFor(seed,floor,2,previousId)];return [a,b];
}
export function encounterGround(x,terrain){
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
