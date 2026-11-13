// Local-only art preferences; never part of game or account progress.
export const SCENERY_KEY='hillside-archers-scenery-v1';
export const SCENERY_IMAGES=Object.freeze({storybook:'art/storybook.webp',impasto:'art/impasto.webp',moonlit:'art/moonlit.webp',paper:'art/paper.webp',harbor:'art/harbor.webp',earth:'art/earth.webp'});
export const SCENERY_STYLES=Object.freeze([
 {id:'auto',name:'随赛场变化',description:'跟着山林、峡谷、遗迹和港湾换景。',asset:'storybook'},
 {id:'storybook',name:'晴空手绘',description:'明亮山谷、繁茂古树，轻快的动画冒险。',asset:'storybook'},
 {id:'impasto',name:'落日厚涂',description:'暖金峡谷、层叠岩壁与落日笔触。',asset:'impasto'},
 {id:'moonlit',name:'月夜奇幻',description:'冷蓝星空、废墟与远处的一点暖灯。',asset:'moonlit'},
 {id:'paper',name:'纸雕舞台',description:'纸纤维、折痕和层层投影组成的山谷。',asset:'paper'},
 {id:'harbor',name:'暖灯港湾',description:'手绘港城、船帆与晚风里的窗灯。',asset:'harbor'}
]);
export function validScenery(id){return SCENERY_STYLES.some(s=>s.id===id)?id:'auto';}
export function readScenery(storage){try{return validScenery(storage?.getItem(SCENERY_KEY));}catch{return 'auto';}}
export function writeScenery(storage,id){try{storage?.setItem(SCENERY_KEY,validScenery(id));return Boolean(storage);}catch{return false;}}
export function sceneryAssetFor(style,map=0,encounter=null){
 if(validScenery(style)!=='auto')return validScenery(style);
 if(['crane','market','podium','bowl'].includes(encounter?.landmark))return 'harbor';
 if(encounter?.landmark==='signs')return 'paper';
 return ['storybook','impasto','moonlit'][map]||'storybook';
}
export const SCENERY_PALETTES=Object.freeze({
 storybook:{sky:['#53b6b9','#e5f0d5'],soil:['#aa8657','#6e543b','#3c3931'],rock:'#a99170',shade:'#4c5039',edge:'#bacd76',grass:'#728d4e',light:'#e3d6aa'},
 impasto:{sky:['#b797a3','#edc79e'],soil:['#c69265','#986044','#513e37'],rock:'#dbab7a',shade:'#7e5140',edge:'#e4bd7a',grass:'#bca064',light:'#f6dbab'},
 moonlit:{sky:['#0b264d','#4f8298'],soil:['#6d8990','#4f6871','#253d50'],rock:'#99adb2',shade:'#324d60',edge:'#afc9ad',grass:'#668c7d',light:'#d2e1cc'},
 paper:{sky:['#d8dfca','#eee7ce'],soil:['#c1af8b','#938d72','#54645a'],rock:'#d1c3a1',shade:'#647466',edge:'#d8dfaa',grass:'#87a38a',light:'#eee3c4'},
 harbor:{sky:['#667db1','#bba1ba'],soil:['#aaa093','#747b80','#3b4c61'],rock:'#c0b7a0',shade:'#4f6574',edge:'#cac398',grass:'#859a86',light:'#ecd4ad'}
});
// At most two decoded backdrops retained. Loading / failure never blocks play.
export class SceneryAssets{
 constructor({imageFactory=()=>typeof Image==='undefined'?null:new Image(),limit=2}={}){this.imageFactory=imageFactory;this.limit=Math.max(1,limit);this.records=new Map();this.revision=0;}
 get(id){
  if(!Object.hasOwn(SCENERY_IMAGES,id))return null;
  let record=this.records.get(id);
  if(record){this.records.delete(id);this.records.set(id,record);return record.status==='ready'?record.image:null;}
  let image;try{image=this.imageFactory();}catch{return null;}if(!image)return null;
  record={image,status:'loading'};this.records.set(id,record);
  image.onload=()=>{if(this.records.get(id)!==record)return;if((image.naturalWidth||image.width)>0&&(image.naturalHeight||image.height)>0){record.status='ready';this.revision++;}else record.status='error';};
  image.onerror=()=>{if(this.records.get(id)===record){record.status='error';this.revision++;}};
  try{image.decoding='async';image.src=SCENERY_IMAGES[id];}catch{record.status='error';this.revision++;}
  while(this.records.size>this.limit){const [key,old]=this.records.entries().next().value;this.records.delete(key);old.image.onload=null;old.image.onerror=null;}
  return record.status==='ready'?record.image:null;
 }
}
