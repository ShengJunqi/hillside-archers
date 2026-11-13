import {SceneryAssets,readScenery,validScenery,sceneryAssetFor,SCENERY_PALETTES} from './scenery.mjs';
import {ImpactFeedback,readFeedback} from './feedback.mjs';
import {EMOTES,emotePose} from './emotes.mjs';
import {bodyPose,attachedArrowPose} from './body.mjs';
import {W,H,G,MAPS,ground,position,launch} from './core.mjs';
const rHash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const ART=[
 {sky:['#b6d9ce','#f1e6bd'],ink:'#182c32',far:'#9cbeb1',mid:'#7ba493',near:'#577d6c',soil:'#a58f65',rock:'#c4ae82',edge:'#d6df8a',shade:'#555f43',glow:'#ffd260'},
 {sky:['#f0bb8c','#fae4b6'],ink:'#342c35',far:'#d69f84',mid:'#ba826d',near:'#936959',soil:'#bb875f',rock:'#d6ac7b',edge:'#f5cf80',shade:'#76513f',glow:'#ffdc7a'},
 {sky:['#283b61','#91b4b5'],ink:'#1b2b3f',far:'#6c8b9e',mid:'#587783',near:'#3f616d',soil:'#6d8185',rock:'#9bb0ab',edge:'#d2dcaa',shade:'#3f5563',glow:'#71e1d4'}
];
const rClamp=(v,a,b)=>Math.max(a,Math.min(b,v));const rEase=t=>t*t*(3-2*t);
export class Renderer{
 constructor(canvas){this.canvas=canvas;canvas.width=W;canvas.height=H;this.c=canvas.getContext('2d');this.c.imageSmoothingEnabled=true;this.cam={x:W/2,y:H,z:1};this.lastPhase='';this.allView=false;this.time=0;this.emote=null;this.emoteIndex=0;const motion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');this.reducedMotion=Boolean(motion?.matches);motion?.addEventListener?.('change',e=>{this.reducedMotion=e.matches;this.feedback?.reset();});this.dust=[];this.lastImpact=null;this.lastRound=0;let storage;try{storage=globalThis.localStorage;}catch{}this.feedback=new ImpactFeedback(readFeedback(storage));this.hitFocus=null;this.sceneryStyle=readScenery(storage);this.scenery=new SceneryAssets();this.sceneryAssetId=null;}
 playEmote(game){if(!game.canAim||game.players[game.active].hp<=0||game.players[game.active].body?.active)return false;const choice=EMOTES[this.emoteIndex++%EMOTES.length];this.emote={kind:choice.id,duration:choice.duration,time:0,side:game.active};return true;}
 resize(width,height){if(!width||!height)return;const nextW=Math.round(H*width/height);if(this.canvas.width===nextW&&this.canvas.height===H)return;this.canvas.width=nextW;this.canvas.height=H;this.c.imageSmoothingEnabled=true;this.resized=true;}
 rect(x,y,w,h,color){this.c.fillStyle=color;this.c.fillRect(Math.round(x),Math.round(y),w,h);}
 line(points,color,width=2){const c=this.c;c.beginPath();c.strokeStyle=color;c.lineWidth=width;points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();}
 poly(points,color){const c=this.c;c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
 text(txt,x,y,size,color,align='center'){const c=this.c;c.font=size>=22?`oblique 400 ${size}px "Smiley Sans", "Noto Sans CJK SC", sans-serif`:`500 ${size}px "Noto Sans CJK SC", "Microsoft YaHei", sans-serif`;c.textAlign=align;c.fillStyle=color;c.fillText(txt,x,y);}
 circle(x,y,r,color){const c=this.c;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=color;c.fill();}
 tree(x,y,size=1,color='#27483e',t=0){const c=this.c;c.save();c.translate(x,y);c.scale(size,size);const sway=this.reducedMotion?0:Math.sin(t*.6+x)*2;
  this.poly([[-9,0],[-6,-154],[1,-213],[7,-148],[10,0]],'#344b3d');
  for(let j=3;j>=0;j--){const y0=-240+j*39,w=39+j*10;this.poly([[sway,y0],[-w*.34+sway,y0+29],[-w*.22+sway,y0+33],[-w*.67+sway,y0+61],[-w*.51+sway,y0+63],[-w+sway,y0+88],[-w*.35+sway,y0+82],[-w*.18+sway,y0+89],[w*.43+sway,y0+83],[w+sway,y0+87],[w*.57+sway,y0+55],[w*.66+sway,y0+57],[w*.26+sway,y0+29],[w*.34+sway,y0+30]],color);
   this.line([[-w*.58+sway,y0+64],[-w*.13+sway,y0+42],[sway,y0+14]],'#c2cc9d14',2);this.line([[w*.2+sway,y0+69],[w*.62+sway,y0+83]],'#102f2d33',3);}
  this.line([[-3,-60],[-2,-8]],'#b7b18a22',3);this.poly([[-14,0],[-5,-13],[2,-4],[13,-11],[17,0]],'#2c493b');c.restore();}
 arch(x,y,width,height,color){this.rect(x,y-height,width,17,color);this.rect(x,y-height,15,height,color);this.rect(x+width-15,y-height,15,height,color);this.rect(x-7,y-height+15,width+14,12,color);for(let i=0;i<width/20;i++)this.rect(x+i*20,y-height-10,15,10,color);}

 inkpoly(points,fill,ink='#1b3031',width=2){const c=this.c;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(width){c.lineWidth=width;c.lineJoin='round';c.strokeStyle=ink;c.stroke();}}
 stone(x,y,w,h,col,seed=0){
  const k=rHash(seed+4),pts=[[x-w*.5,y],[x-w*.48,y-h*.7],[x-w*.25,y-h],[x+w*.24,y-h*(.92+k*.08)],[x+w*.48,y-h*.56],[x+w*.5,y]];
  this.inkpoly(pts,col,'#18282c44',2);this.poly([[x-w*.25,y-h],[x-w*.02,y-h*.94],[x-w*.08,y-h*.24],[x-w*.5,y]],'#ffffff0b');
  this.poly([[x+w*.24,y-h*.98],[x+w*.48,y-h*.56],[x+w*.5,y],[x+w*.13,y]],'#101e2620');
  this.line([[x-w*.2,y-h*.73],[x+w*.08,y-h*.69],[x-w*.02,y-h*.46]],'#172a2833',2);
 }
 setSceneryStyle(id){this.sceneryStyle=validScenery(id);this.terrainArtKey=null;this.backdropKey=null;}
 hdBackdrop(map,encounter){
  this.sceneryAssetId=sceneryAssetFor(this.sceneryStyle,map,encounter);const profile=SCENERY_PALETTES[this.sceneryAssetId],image=this.scenery.get(this.sceneryAssetId);
  if(!image)return false;
  const c=this.c,g=c.createLinearGradient(0,-900,0,750);g.addColorStop(0,profile.sky[0]);g.addColorStop(1,profile.sky[1]);c.fillStyle=g;c.fillRect(-1500,-5000,4600,7000);
  const key=this.sceneryAssetId+':'+this.scenery.revision;
  if(this.backdropKey!==key){
   this.backdropKey=key;this.backdropLayer=null;
   const layer=this.surfaceFactory?.(1800,1013)??(typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(1800,1013):globalThis.document?.createElement?.('canvas'));
   if(layer?.getContext){layer.width=1800;layer.height=1013;const l=layer.getContext('2d');if(l){l.imageSmoothingEnabled=true;l.imageSmoothingQuality='high';l.drawImage(image,0,0,1800,1013);l.globalCompositeOperation='destination-in';const fade=l.createLinearGradient(0,0,0,1013);fade.addColorStop(0,'#00000000');fade.addColorStop(.13,'#000000');fade.addColorStop(1,'#000000');l.fillStyle=fade;l.fillRect(0,0,1800,1013);l.globalCompositeOperation='source-over';this.backdropLayer=layer;}}
  }
  c.save();c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';const shift=(this.cam.x-W/2)*.12;c.drawImage(this.backdropLayer||image,-100+shift,-220,1800,1013);c.restore();
  return true;
 }
 background(map,t,encounter=null){
  if(this.hdBackdrop(map,encounter))return;
  const c=this.c,m=ART[map],g=c.createLinearGradient(0,-200,0,780);g.addColorStop(0,m.sky[0]);g.addColorStop(1,m.sky[1]);c.fillStyle=g;c.fillRect(-1500,-5000,4600,7000);
  // Flat print colors and quieter background silhouettes leave shots readable.
  const sunX=map===0?1160:map===1?1280:1240,sunY=map===2?150:190;
  if(map===2){c.save();c.beginPath();c.arc(sunX,sunY,48,0,Math.PI*2);c.clip();c.beginPath();c.arc(sunX,sunY,48,0,Math.PI*2);c.moveTo(sunX+65,sunY-12);c.arc(sunX+20,sunY-12,45,0,Math.PI*2);c.fillStyle='#dbe1d2';c.fill('evenodd');c.restore();}else this.circle(sunX,sunY,map===1?72:48,'#f2d39d');
  for(let i=0;i<7;i++){
   const x=((i*311+t*(map===1?2.2:1.4))%2200)-250,y=90+rHash(i+11)*200;
   this.poly([[x,y+16],[x+28,y+10],[x+42,y],[x+80,y-5],[x+99,y+8],[x+155,y+12],[x+190,y+23],[x-15,y+23]],map===2?'#bdd1db0a':'#f5dfbd17');
  }
  if(map===2){for(let i=0;i<80;i++){const x=rHash(i*3)*W,y=30+rHash(i*7+1)*370;this.rect(x,y,i%9===0?3:1.5,i%9===0?3:1.5,'#dce9d388');}for(let i=0;i<3;i++)this.poly([[-100,150+i*32],[470,90+i*36],[1020,180+i*35],[1700,100+i*40],[1700,112+i*40],[1020,196+i*35],[470,104+i*36],[-100,164+i*32]],'#9bdcc00b');}
  this.skyline(encounter,map,t);
  if(encounter){this.venueBackdrop(encounter,map,t);}else if(map===0){
   for(let i=0;i<23;i++){const x=i*80-70,y=625+Math.sin(i)*25;this.tree(x,y,.55+rHash(i+41)*.42,i%3?'#2c5149':'#335e52',t);}
   // A weathered mountain gateway, not a row of identical buildings.
   for(const x of [675,900]){this.stone(x,640,45,190,'#526d59',x);this.rect(x-29,435,58,16,'#8a9675');this.line([[x-13,470],[x-5,525],[x-16,560]],'#29493f',3);}
   this.inkpoly([[633,431],[672,416],[694,390],[708,416],[883,417],[908,394],[920,418],[945,431],[912,444],[665,444]],'#284b43','#203d38',3);
   this.line([[655,432],[924,432]],'#a6ab7e',4);this.rect(748,450,80,37,'#384f42');this.text('青 岚',788,475,20,'#d2c18b');
   for(let i=0;i<6;i++){const x=700+i*34;this.stone(x,653,35,8+rHash(i)*10,'#62735d',i);}
   for(let i=0;i<4;i++){const x=900+Math.sin(t*.18+i)*210+i*35,y=260+i*17;this.line([[x-5,y+2],[x,y],[x+5,y+2]],'#344c4870',1.4);}
  }else if(map===1){
   for(let i=0;i<8;i++){const x=i*250-50,y=620,h=110+rHash(i+30)*180,w=95+rHash(i+8)*75;
    this.poly([[x-w*.6,y],[x-w*.48,y-h*.65],[x-w*.3,y-h],[x+w*.35,y-h+8],[x+w*.48,y-h*.6],[x+w*.7,y]],i%2?'#815444':'#90604c');
    this.poly([[x+w*.1,y-h+4],[x+w*.35,y-h+8],[x+w*.48,y-h*.6],[x+w*.7,y],[x+w*.25,y]],'#553e3938');
    for(let j=0;j<5;j++){const yy=y-h+25+j*(h/6);this.line([[x-w*.38,yy],[x+w*.35,yy+6]],j%2?'#d99b6930':'#4c343b40',3);}
   }
   for(const x of [665,920]){this.stone(x,649,54,205,'#76523f',x);for(let j=0;j<5;j++)this.line([[x-20,464+j*35],[x+20,468+j*35]],'#ba865c55',2);}
   this.inkpoly([[622,441],[641,424],[674,429],[700,415],[728,431],[873,428],[892,415],[920,425],[947,422],[962,443]],'#a07551','#5d4438',3);
   this.rect(687,446,210,14,'#503e35');this.poly([[767,462],[775,462],[775,540],[758,528],[748,544],[737,526],[737,463]],'#c3a47666');
   this.line([[660,530],[786,558],[919,534]],'#3f3a3477',3);
   for(let i=0;i<4;i++)this.stone(500+i*35,644,47,15+rHash(i+9)*23,'#9c7051',i);
  }else{
   for(let i=0;i<9;i++){const x=80+i*187,y=650,h=100+rHash(i+19)*165;this.stone(x,y,34,h,'#4b6473',i);this.rect(x-26,y-h-8,52,12,'#6b858b');this.line([[x-6,y-h+30],[x+4,y-h+52],[x-3,y-h+73]],'#a1d9c444',2);if(i%2===0)this.poly([[x+11,y-h+18],[x+40,y-h+5],[x+32,y-h+40],[x+19,y-h+58]],'#96dec624');}
   this.line([[692,492],[730,454],[788,446],[854,460],[896,496]],'#738f98',20);
   this.line([[692,492],[730,454],[767,449]],'#a6b8af55',4);
   for(const x of [685,900])this.stone(x,650,40,158,'#526f7b',x);
   this.poly([[789,400],[816,437],[788,477],[762,437]],'#153545');this.line([[789,408],[807,437],[788,466],[772,437],[789,408]],'#9ee2cb',3);
   this.circle(789,437,8,'#d9f0ca');
  }
  // Low-contrast valley mist stays behind the combat silhouettes.
  for(let i=0;i<4;i++){const x=(i*530+t*4)%2300-450;this.poly([[x,600+i*18],[x+180,587+i*18],[x+480,608+i*18],[x+220,614+i*18]],map===2?'#aec8c30d':'#ded3b40b');}
 }
 skyline(encounter,map,t){
  const c=this.c,m=ART[map],kind=encounter?.landmark||['forest','gorge','ruin'][map];
  // Authored silhouettes: broad shapes, visible negative space, no repeated
  // triangular mountain stamps. These are background-only, softer than cover.
  const ridges=[
   [[-800,512],[-300,402],[0,421],[190,282],[360,346],[490,303],[690,401],[860,331],[1050,370],[1280,265],[1460,342],[1900,420],[2400,390]],
   [[-800,596],[-100,527],[180,481],[370,502],[610,428],[790,499],[1010,467],[1230,486],[1500,418],[2000,545],[2400,488]],
   [[-800,684],[-180,620],[140,581],[380,613],[610,554],[840,588],[1090,564],[1340,604],[1680,559],[2100,620],[2400,596]]
  ];
  if(['crane','bowl'].includes(kind)){
   this.poly([[-800,520],[-120,510],[140,489],[440,525],[740,496],[1020,512],[1380,479],[1900,515],[2400,505],[2400,1000],[-800,1000]],m.far);
   this.poly([[-800,593],[2400,593],[2400,1000],[-800,1000]],m.mid);
   for(let i=0;i<15;i++){const x=i*132-180,y=609+i%3*18;this.line([[x,y],[x+63,y]],m.edge+'44',2);}
   if(kind==='crane'){const x=290;this.inkpoly([[x-190,563],[x-122,594],[x+148,594],[x+185,564]],m.far,m.mid,3);this.line([[x,566],[x,346]],m.mid,6);this.poly([[x-6,358],[x-6,523],[x-143,523]],m.far);this.poly([[x+9,374],[x+9,516],[x+148,516]],m.far);this.line([[x-11,362],[x-11,516]],m.edge+'44',2);}
   else{for(const x of [130,1270]){this.line([[x,570],[x+25,362]],m.mid,10);this.inkpoly([[x+25,366],[x+77,320],[x+110,347],[x+74,398]],m.far,m.mid,3);}}
  }else if(['market','podium'].includes(kind)){
   for(let i=0;i<14;i++){const x=i*148-180,h=110+rHash(i+51)*190;this.poly([[x,633],[x,633-h],[x+57,615-h],[x+126,633-h],[x+126,633]],i%2?m.far:m.mid);for(let j=0;j<3;j++)this.rect(x+20+j*31,666-h,13,19,m.edge+'44');}
   if(kind==='podium')for(let i=0;i<3;i++){const x=220+i*590,y=230+i%2*70;c.save();c.translate(x,y);this.inkpoly([[-32,-22],[-21,-53],[8,-64],[36,-41],[40,-6],[16,39],[-10,35]],m.far,m.mid,3);this.line([[-10,35],[-4,64],[13,63],[16,39]],m.mid,2);this.rect(-4,63,18,14,m.mid);c.restore();}
  }else if(['bridge','gorge'].includes(kind)){
   for(const [x,dir] of [[-20,1],[1620,-1]]){c.save();c.translate(x,0);c.scale(dir,1);this.poly([[-800,280],[80,320],[230,257],[410,297],[490,460],[380,558],[550,611],[560,1000],[-800,1000]],m.far);this.poly([[-800,446],[82,480],[240,417],[320,480],[380,633],[240,703],[400,1000],[-800,1000]],m.mid);for(let j=0;j<5;j++)this.line([[-30,345+j*57],[220+j%2*80,363+j*57]],m.edge+'33',4);c.restore();}
   this.poly([[490,566],[790,518],[1100,573],[1100,1000],[490,1000]],m.far);this.line([[570,570],[1030,570]],m.edge+'44',3);
  }else{
   for(let i=0;i<3;i++)this.poly([...ridges[i],[2400,1100],[-800,1100]],[m.far,m.mid,m.near][i]);
   if(['stands','forest'].includes(kind))for(let i=0;i<13;i++){const x=i*140-100,y=630,h=100+rHash(i+3)*190,w=60+rHash(i)*60;this.line([[x,y],[x+9,y-h]],m.near,8);this.poly([[x-w,y-h*.48],[x-w*.9,y-h*.8],[x-w*.4,y-h],[x+w*.4,y-h*1.08],[x+w,y-h*.8],[x+w*.7,y-h*.38]],m.mid);this.line([[x+3,y-h*.7],[x-w*.4,y-h*.84]],m.near+'66',4);}
   if(kind==='turtle')for(let i=0;i<5;i++){const x=i*370-100;this.poly([[x-190,611],[x-110,533],[x-50,507],[x+26,504],[x+112,551],[x+180,611]],m.near);}
  }
  if(kind==='signs'){this.line([[110,445],[225,319],[350,342],[443,249]],m.edge+'55',4);this.text('真 的 没 走 错 吗',1120,278,27,m.edge+'77');}
 }
 venueBackdrop(encounter,map,t){
  const c=this.c,m=ART[map],ink=map===2?'#466776':'#647d70',paper=map===2?'#8eaaa9':'#d3ccaa',accent=map===2?'#a6c3ad':'#c1ad76',y=628;
  c.save();c.globalAlpha=.82;
  // Background scenery deliberately has softer outlines than destructible cover.
  const plank=(x,yy,w,h,fill=paper)=>this.inkpoly([[x,yy],[x+w,yy-3],[x+w+3,yy+h],[x-2,yy+h]],fill,ink,3);
  const pennants=(x1,x2,yy)=>{this.line([[x1,yy],[800,yy+30],[x2,yy-8]],ink,2);for(let x=x1+20;x<x2;x+=58){const cy=yy+25*Math.sin((x-x1)/(x2-x1)*Math.PI);this.poly([[x,cy],[x+26,cy],[x+15,cy+27]],(Math.floor(x/58)%2)?accent:paper);}};
  const spectator=(x,yy,i)=>{this.circle(x,yy,8,i%3?paper:accent);this.line([[x-12,yy+19],[x,yy+8],[x+13,yy+19]],ink,5);this.line([[x-5,yy-1],[x-1,yy-1]],ink,2);this.line([[x+3,yy-1],[x+6,yy-1]],ink,2);};
  const nameplate=(x,yy,text)=>{plank(x-105,yy,210,43,ink);this.text(text,x,yy+29,24,paper);};
  switch(encounter.landmark){
   case 'stands':
    for(let row=0;row<3;row++){const yy=y-row*48;plank(520+row*35,yy,530-row*70,16);for(let j=0;j<8-row;j++)spectator(550+row*35+j*61,yy-23,j+row);}
    this.line([[510,632],[545,360]],ink,7);this.line([[1080,632],[1045,345]],ink,7);pennants(545,1045,360);nameplate(800,416,'歪旗杯 · 不包箭');break;
   case 'bowl':
    this.inkpoly([[525,510],[550,570],[630,624],[960,624],[1040,565],[1070,510]],paper,ink,6);this.line([[530,510],[1070,510]],accent,12);this.inkpoly([[678,506],[640,454],[725,474],[778,421],[819,473],[893,449],[873,505]],accent,ink,3);this.text('碗 底 见',800,574,33,ink);this.line([[590,627],[570,648],[1030,648],[1010,627]],ink,8);break;
   case 'crane':
    this.line([[650,641],[690,345],[719,641]],ink,13);this.line([[690,346],[1000,392]],ink,14);this.line([[691,350],[926,392],[697,494]],accent,5);this.line([[960,390],[960,506]],ink,3);this.inkpoly([[934,505],[982,508],[988,551],[936,549]],paper,ink,3);this.text('易碎',961,535,18,ink);for(let i=0;i<4;i++){plank(490+i*145,614,140,18);this.line([[510+i*145,630],[510+i*145,657]],ink,7);}nameplate(815,558,'码头禁止钓鱼');break;
   case 'turtle':
    this.inkpoly([[481,625],[511,554],[597,486],[708,459],[846,473],[934,519],[998,624]],paper,ink,5);this.line([[512,554],[675,543],[719,461]],ink,3);this.line([[675,543],[710,618]],ink,3);this.line([[675,543],[816,554],[846,478]],ink,3);this.line([[816,554],[897,623]],ink,3);this.inkpoly([[990,617],[1023,565],[1084,574],[1117,613],[1092,640],[1034,636]],accent,ink,4);this.circle(1071,589,6,ink);this.line([[1080,616],[1105,611]],ink,3);this.text('它说它没报名',781,434,25,ink);break;
   case 'market':
    for(let j=0;j<3;j++){const x=485+j*218;this.line([[x,637],[x,460],[x+192,460],[x+192,636]],ink,6);this.inkpoly([[x-16,461],[x+24,410],[x+166,410],[x+207,461]],paper,ink,3);for(let k=0;k<5;k++)this.poly([[x+24+k*28,411],[x+38+k*28,411],[x+56+k*30,461],[x+24+k*30,461]],accent);plank(x+5,591,182,44);this.text(['热箭','凉心','别问价'][j],x+98,540,27,ink);this.line([[x+164,475],[x+164,508]],ink,2);this.circle(x+164,510,13,accent);}pennants(450,1160,360);break;
   case 'bridge':
    this.line([[475,636],[590,513],[1020,513],[1140,636]],ink,13);this.line([[500,637],[615,556],[994,556],[1110,637]],paper,7);for(let i=0;i<6;i++)this.line([[604+i*73,515],[604+i*73,552]],ink,5);nameplate(805,422,'收箭两支 · 不找零');break;
   case 'signs':
    for(const x of [620,984]){this.line([[x,643],[x+12,365]],ink,12);for(let j=0;j<3;j++){const yy=411+j*65,dx=j%2?-1:1;this.inkpoly([[x-dx*95,yy],[x+dx*68,yy-3],[x+dx*102,yy+20],[x+dx*67,yy+43],[x-dx*95,yy+41]],j%2?paper:accent,ink,3);this.text(['终点？','可能这边','原地转圈'][j],x,yy+29,21,ink);}}break;
   default:
    for(let j=0;j<3;j++){const xx=630+j*135,hh=[62,125,36][j];plank(xx,y-hh,124,hh);this.text(['2','1','3'][j],xx+62,y-hh+40,32,ink);}this.inkpoly([[762,486],[754,453],[769,459],[790,436],[812,457],[830,450],[824,487]],accent,ink,3);this.text('奖杯正在路上',821,383,29,paper);pennants(510,1110,333);
  }
  c.restore();
 }
 terrainBase(game){
  const c=this.c,m=SCENERY_PALETTES[this.sceneryAssetId||sceneryAssetFor(this.sceneryStyle,game.map,game.encounter)],pts=[[0,H+700]];
  for(let x=0;x<=W;x+=2)pts.push([x,ground(x,game.world)]);pts.push([W,H+700]);
  c.save();c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.clip();
  const soil=c.createLinearGradient(0,610,0,1100);soil.addColorStop(0,m.soil[0]);soil.addColorStop(.3,m.soil[1]);soil.addColorStop(1,m.soil[2]);c.fillStyle=soil;c.fillRect(0,550,W,1100);
  if(this.terrainTexture){c.save();c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.globalCompositeOperation='soft-light';c.globalAlpha=.92;c.drawImage(this.terrainTexture,0,550,W,1100);c.restore();}
  // Irregular geological beds follow the actual slope, with shaded crevices.
  for(let band=0;band<6;band++){
   const upper=[],lower=[];for(let x=0;x<=W;x+=14){const y=ground(x,game.world)+28+band*69+Math.sin(x/(120+band*19)+band*3.8)*(9+band*2)+Math.sin(x/43+band)*3;upper.push([x,y]);lower.unshift([x,y+22+band*5]);}
   this.poly([...upper,...lower],band%2?m.rock+'28':m.shade+'38');this.line(upper,band%2?m.light+'30':m.shade+'70',1.5);
  }
  // Large, varied stone faces use curves and facet highlights, not repeated tiles.
  for(let i=0;i<(this.terrainTexture?14:88);i++){
   const x=rHash(i*7+63)*W,y=ground(x,game.world)+28+rHash(i*3+81)*330,w=9+rHash(i+11)*70,h=6+rHash(i+53)*31;
   c.save();c.translate(x,y);c.rotate((rHash(i+3)-.5)*.35);c.beginPath();c.moveTo(-w/2,1);c.quadraticCurveTo(-w*.65,-h*.7,-w*.23,-h);c.quadraticCurveTo(w*.23,-h*1.18,w*.5,-h*.48);c.lineTo(w*.4,3);c.quadraticCurveTo(-w*.1,h*.2,-w/2,1);c.fillStyle=i%3?m.rock+'55':m.shade+'66';c.fill();
   this.line([[-w*.37,-h*.65],[-w*.16,-h*.9],[w*.2,-h*.82]],m.light+'45',1);this.line([[w*.18,-h*.6],[w*.36,-h*.34],[w*.3,1]],m.shade+'88',1);c.restore();
  }
  // Deterministic grain is baked once into the cached soil surface.
  for(let i=0;i<(this.terrainTexture?450:3900);i++){const x=rHash(i*5+906)*W,y=ground(x,game.world)+6+rHash(i*11+431)*490;c.globalAlpha=.07+rHash(i+19)*.12;this.rect(x,y,1+rHash(i+7)*2,1,i%3?m.light:m.shade);}c.globalAlpha=1;
  c.restore();
  const lip=[];for(let x=0;x<=W;x+=2)lip.push([x,ground(x,game.world)+4]);this.line(lip,m.shade,11);this.line(lip,m.grass,7);this.line(lip.map(([x,y])=>[x,y-3]),m.edge,2.4);
  for(let i=0;i<330;i++){
   const x=rHash(i*3+61)*W,y=ground(x,game.world),h=3+rHash(i+19)*12,lean=(rHash(i+31)-.5)*11;
   this.line([[x-2,y+2],[x+lean,y-h]],i%4?m.grass:m.edge,1.1+rHash(i)*1.3);
   if(i%9===0){this.line([[x+2,y],[x+5,y-10],[x+11,y-14]],m.grass,1.4);this.circle(x+11,y-14,1.7,m.light);}
  }
  for(let i=0;i<22;i++){const x=12+rHash(i+801)*(W-24),y=ground(x,game.world)+1;this.stone(x,y,7+rHash(i)*16,4+rHash(i+13)*7,m.rock,i);}
 }
 terrain(game){
  this.terrainTexture=this.scenery.get('earth');
  const artKey=this.sceneryStyle+':'+this.sceneryAssetId+':'+this.scenery.revision;
  if(this.terrainMap!==game.map||this.terrainKey!==game.world||this.terrainArtKey!==artKey){
   this.terrainMap=game.map;this.terrainKey=game.world;this.terrainArtKey=artKey;this.terrainLayer=null;
   const surface=this.surfaceFactory?.(W,1600)??(typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(W,1600):globalThis.document?.createElement?.('canvas'));
   if(surface?.getContext){surface.width=W;surface.height=1600;const c=surface.getContext('2d');if(c){const original=this.c;this.c=c;this.terrainBase(game);this.c=original;this.terrainLayer=surface;}}
  }
  if(this.terrainLayer)this.c.drawImage(this.terrainLayer,0,0);else this.terrainBase(game);
  for(const x of [270,1330]){const y=ground(x,game.world);this.line([[x,y],[x,y-111]],'#2a3731',6);this.line([[x-1,y],[x-1,y-111]],'#9b8861',2);const flap=Math.sin(this.time*2.8+x)*6;
   this.inkpoly([[x+1,y-110],[x+41,y-104+flap*.2],[x+31,y-91+flap*.4],[x+43,y-79+flap],[x+1,y-84]],game.map===1?'#b76c44':'#376c5a',ART[game.map].ink,2);this.line([[x+6,y-104],[x+28,y-99+flap*.2]],'#f1d49366',2);this.stone(x,y+2,19,7,ART[game.map].rock,x);}
 }
 arrow(x,y,a,color='#e7d5a7',size=1){const c=this.c;c.save();c.translate(x,y);c.rotate(a);c.scale(size,size);this.line([[-30,.5],[8,.5]],'#20323ad9',5);this.rect(-29,-1,37,3,color);this.inkpoly([[8,-5],[17,0],[8,5]],'#e1e7d7','#20323ad9',1);this.poly([[-28,-1],[-36,-7],[-24,-5],[-19,-1]],color);this.poly([[-28,1],[-36,7],[-24,5],[-19,1]],color);c.restore();}

 limb(a,b,width,color,shade){
  const c=this.c,length=Math.hypot(b.x-a.x,b.y-a.y);c.save();c.translate(a.x,a.y);c.rotate(Math.atan2(b.y-a.y,b.x-a.x));
  this.inkpoly([[-3,-width*.45],[length*.36,-width*.6],[length+2,-width*.34],[length+3,width*.31],[length*.4,width*.52],[-2,width*.4]],color,'#1b2b2c',2);
  this.poly([[1,width*.1],[length-1,width*.05],[length,width*.3],[2,width*.4]],shade);c.restore();
 }
 character(p,side,{angle=25,time=0,walk=0,drawn=false,dead=false,boss=false,scale=1,bow='plain',emote=null}={}){
  const c=this.c,dir=p.dir,ink='#17262e',pal=side===0?{cloak:'#21b7c9',fold:'#247581',rim:'#b7eddd',cloth:'#f4ecdd',leather:'#755242',skin:'#edbb8d'}:{cloak:boss?'#9673b4':'#ea6752',fold:boss?'#594974':'#a44338',rim:boss?'#e3c1e8':'#ffcd78',cloth:'#f4e1c1',leather:'#68473a',skin:'#e9ac84'};
  const pose=emotePose(bodyPose(p,angle,walk,time,drawn),p,emote),reacting=p.body?.active;
  if(!reacting&&!drawn&&!dead&&!emote){const breath=Math.sin(time*2.4+side)*.6;pose.head.y+=breath;pose.chest.y+=breath*.6;}
  if(dead&&!reacting){const f=rEase(rClamp((p.deadTime||time)/.8,0,1)),a=dir*f*1.35;for(const n of Object.values(pose)){const x=n.x-p.x,y=n.y-p.y;n.x=p.x+x*Math.cos(a)-y*Math.sin(a);n.y=p.y+x*Math.sin(a)+y*Math.cos(a);}}
  c.save();c.translate(p.x,p.y);c.scale(scale,scale);c.translate(-p.x,-p.y);
  c.save();c.globalAlpha=.3;c.translate(p.x,p.y-1);c.scale(1,.18);this.circle(0,0,reacting?39:28,ink);c.restore();
  const {head,chest,hip,elbowBack,handBack,elbowFront,handFront,kneeBack,footBack,kneeFront,footFront}=pose;
  const leg=(knee,foot,front)=>{
   this.limb(hip,knee,front?13:11,front?'#4d5846':'#34443c','#283b34');this.limb(knee,foot,front?11:9,front?'#66705a':'#3b4e42','#304036');
   const a=Math.atan2(foot.y-knee.y,foot.x-knee.x)-Math.PI/2;c.save();c.translate(foot.x,foot.y);c.rotate(a);
   this.inkpoly([[-7,-9],[5,-9],[7,-3],[18,0],[17,6],[-9,6]],pal.leather,ink,2);this.rect(-6,2,18,3,'#23332d');this.line([[-5,-6],[4,-5]],'#b69764',2);c.restore();
   this.inkpoly([[knee.x-4,knee.y-4],[knee.x+4,knee.y-3],[knee.x+5,knee.y+2],[knee.x-3,knee.y+4]],front?'#a38b5e':'#6d6c4d',ink,1);this.line([[knee.x-2,knee.y-1],[knee.x+3,knee.y]],'#d8bd7c66',1);
  };
  const arm=(elbow,hand,front)=>{
   this.limb(chest,elbow,front?12:10,front?pal.cloth:'#9d936f','#8b805d');this.limb(elbow,hand,front?9:8,pal.skin,'#a17654');
   const ratio=.67,brace={x:elbow.x+(hand.x-elbow.x)*ratio,y:elbow.y+(hand.y-elbow.y)*ratio};this.limb(brace,hand,10,pal.leather,'#473d31');
   this.circle(hand.x,hand.y,4.2,pal.skin);this.line([[hand.x-2,hand.y],[hand.x+2,hand.y+1]],'#a47854',1);
  };
  leg(kneeBack,footBack,false);if(emote?.kind!=='flex')arm(elbowBack,handBack,false);
  const torsoAngle=Math.atan2(chest.y-hip.y,chest.x-hip.x)+Math.PI/2,len=Math.hypot(chest.x-hip.x,chest.y-hip.y);
  c.save();c.translate(hip.x,hip.y);c.rotate(torsoAngle);c.scale(dir,1);
  const wind=this.reducedMotion?0:Math.sin(time*3.4+side)*4;
  this.inkpoly([[-8,-len-7],[-24,-len+2],[-31+wind,-8],[-23+wind,4],[-17,0],[-10,8],[1,-6]],pal.cloak,ink,2.5);
  this.poly([[-19,-len+4],[-27+wind,-6],[-21+wind,0],[-12,-12]],pal.fold);this.line([[-22,-len+5],[-24+wind,-7]],pal.rim+'66',2);
  // Real quiver silhouette, three distinct feathered arrows and stitched leather.
  this.inkpoly([[-22,-len+1],[-29,-len+5],[-24,-4],[-16,-8]],pal.leather,ink,2);
  for(let i=0;i<3;i++){this.line([[-25+i*4,-len+7],[-29+i*4,-len-21-i%2*5]],'#c7b58a',2);this.poly([[-29+i*4,-len-14],[-34+i*4,-len-24],[-28+i*4,-len-22]],pal.rim);}
  this.inkpoly([[-13,-len-5],[9,-len-7],[17,-len+1],[13,-9],[18,3],[1,7],[-16,3],[-13,-13]],pal.cloth,ink,2.4);
  this.poly([[4,-len+1],[13,-len+4],[10,-8],[15,2],[2,5]],'#9c916b');
  this.inkpoly([[-16,-len-4],[-7,-len-7],[-4,-12],[-11,-4],[-17,-8]],pal.cloak,ink,1.3);
  this.poly([[9,-len-5],[16,-len+1],[13,-8],[7,-9]],pal.cloak);this.line([[-6,-len+5],[-4,-12]],'#fff5df',2);this.rect(-2,-len+12,15,17,pal.cloak);this.text(side===0?'01':'02',5,-len+25,11,'#f4ecdd');
  this.line([[-13,-len+7],[11,-10]],pal.leather,5);this.line([[-13,-len+7],[11,-10]],'#b89965',1);
  this.inkpoly([[-17,-7],[15,-8],[17,-1],[-16,0]],'#5b4433',ink,1.5);this.rect(-1,-8,8,9,'#d8ad5e');this.rect(1,-6,4,5,'#604733');
  this.inkpoly([[10,-2],[18,-3],[19,9],[11,12],[8,7]],'#8a6541',ink,1.4);this.rect(12,1,3,2,'#d5b77e');
  for(let i=0;i<3;i++)this.rect(-8+i*6,-len+14+i%2*5,2,2,'#756b4a66');
  this.inkpoly([[-17,-len-3],[-8,-len-9],[8,-len-7],[16,-len+1],[9,-len+7],[-8,-len+5]],pal.cloak,ink,2);this.line([[-12,-len-3],[8,-len+3]],pal.rim,2);c.restore();
  leg(kneeFront,footFront,true);
  const headAngle=Math.atan2(head.y-chest.y,head.x-chest.x)+Math.PI/2;
  c.save();c.translate(head.x,head.y);c.rotate(headAngle);c.scale(dir,1);
  this.inkpoly([[-12,-8],[-5,-13],[8,-12],[13,-7],[13,0],[17,4],[12,7],[10,16],[0,19],[-11,12]],pal.skin,ink,2.3);
  this.poly([[-10,-6],[-2,-8],[-1,11],[7,17],[0,19],[-11,12]],'#a67b57');
  this.inkpoly([[-15,-5],[-16,-13],[-7,-20],[4,-21],[15,-14],[14,-7],[6,-11],[-2,-8],[-8,2],[-8,13],[-14,10]],side===0?'#294b3c':'#583e36',ink,2);
  this.poly([[-16,-13],[-7,-20],[4,-21],[12,-16],[0,-17],[-9,-10]],pal.cloak);this.line([[-14,-10],[-4,-14],[9,-13]],pal.rim,2);
  if(dead||p.hp<=0){this.line([[4,-1],[9,4]],ink,1.7);this.line([[9,-1],[4,4]],ink,1.7);}else{this.line([[3,-1],[10,-2]],ink,2.5);this.rect(5,0,5,5,'#fff4df');this.rect(8,1,2,4,ink);this.line([[1,-5],[11,-7]],ink,3);}if(reacting&&p.body.hitAge<.4)this.inkpoly([[6,9],[11,8],[12,13],[7,14]],'#684238',ink,1);else{this.inkpoly([[5,8],[14,7],[12,12],[7,12]],'#fff4da',ink,1.3);this.line([[9,8],[9,11]],ink,1);}this.rect(-4,4,3,4,'#d9b685');
  if(side===1)this.line([[0,5],[2,11]],'#9d6451',1.4);
  if(boss){this.inkpoly([[-13,-11],[-21,-27],[-7,-19],[2,-28],[9,-18],[20,-26],[14,-9]],'#b39767',ink,2);this.rect(-2,-22,5,5,'#b6dacf');}
  c.restore();
  if(emote?.kind==='flex'){arm(elbowBack,handBack,true);if(emote.time>.15&&emote.time<.95)this.circle((chest.x+elbowBack.x)/2,(chest.y+elbowBack.y)/2,6,pal.skin);}
  arm(elbowFront,handFront,true);
  const a=angle*Math.PI/180,bowAngle=emote?.kind==='flex'?(dir>0?0:Math.PI):reacting?Math.atan2(handFront.y-elbowFront.y,handFront.x-elbowFront.x):dir>0?-a:Math.PI+a;
  const color=bow==='split'?'#a9c981':bow==='dive'?'#a4cddc':bow==='burst'?'#e0a36d':'#bf995f';
  c.save();c.translate(handFront.x,handFront.y);c.rotate(bowAngle);
  this.line([[-2,-37],[8,-29],[16,-12],[18,0],[15,16],[7,30],[-2,37]],ink,7);this.line([[-2,-37],[8,-29],[16,-12],[18,0],[15,16],[7,30],[-2,37]],color,4);
  this.line([[6,-29],[13,-12],[15,1],[12,16],[5,30]],'#e3c88e',1.3);this.rect(13,-6,7,12,pal.leather);
  if(bow!=='plain'){this.inkpoly([[10,-23],[17,-31],[20,-17],[15,-10]],color,ink,1.4);this.poly([[13,20],[18,27],[8,32]],color);}
  this.line([[-2,-37],[-(drawn&&!reacting&&!emote?16:2),0],[-2,37]],'#e7d9b7',1.3);if(drawn&&!reacting&&!emote)this.arrow(-8,0,0,'#e4cc98',.9);c.restore();
  for(const arrow of p.stuck||[]){const attached=attachedArrowPose(arrow,pose);if(attached)this.arrow(attached.x,attached.y,attached.angle,'#d8b87f',.8);}
  c.restore();
 }

 objects(game){const c=this.c,m=ART[game.map];for(const o of game.obs){
  if(o.state==='broken'){for(let j=0;j<9;j++){const x=o.x-34+j*8,y=o.y-4-j%3*3;c.save();c.translate(x,y);c.rotate((rHash(j+o.x)-.5)*.8);this.inkpoly([[-7,0],[-5,-5],[7,-3],[9,1]],j%2?'#9b754e':'#74533b','#3d332b',1);c.restore();}continue;}
  c.save();c.translate(o.x,o.y);c.rotate(o.rot*o.dir);
  if(o.type==='crate'){
   this.inkpoly([[-o.w/2,-o.h],[o.w/2,-o.h],[o.w/2,0],[-o.w/2,0]],'#6f4d32','#332e29',3);
   this.rect(-o.w/2+4,-o.h+4,o.w-8,o.h-8,'#d4a36a');
   for(let i=0;i<4;i++){const x=-o.w/2+5+i*(o.w-10)/4;this.rect(x,-o.h+5,(o.w-12)/4-2,o.h-10,i%2?'#9e7449':'#b08a58');this.line([[x+4,-o.h+14],[x+6,-o.h*.5],[x+3,-9]],'#65482f77',1.4);this.line([[x+8,-o.h*.7],[x+11,-o.h*.63],[x+9,-o.h*.5]],'#d0a26c66',1);}
   const left=-o.w/2+4,right=o.w/2-4;this.line([[left,-o.h+5],[right,-5]],'#493c2d',8);this.line([[left,-o.h+5],[right,-5]],'#c49a62',5);
   this.line([[right,-o.h+5],[left,-5]],'#493c2d',8);this.line([[right,-o.h+5],[left,-5]],'#c49a62',5);
   this.line([[left,-o.h+2],[right,-o.h+2]],'#dbc08a',3);
   for(const x of [left+1,right-1])for(const y of [-o.h+7,-8])this.circle(x,y,2,'#4b4638');
   this.inkpoly([[-12,-o.h+12],[11,-o.h+10],[14,-o.h+31],[-10,-o.h+34]],'#f4ecdd','#322d2a',1.2);this.text('×',1,-o.h+28,17,'#322d2a');
   if(o.hp<o.maxHp){this.line([[0,-o.h],[-12,-o.h*.72],[2,-o.h*.51],[-10,-o.h*.28],[-5,-2]],'#352a24',4);this.line([[3,-o.h],[-8,-o.h*.72]],'#e1b77a',1);}
  }else{
   this.inkpoly([[-o.w/2,-o.h],[0,-o.h-12],[o.w/2,-o.h+1],[o.w/2,0],[-o.w/2,0]],'#ffd260','#1b2b32',3);for(let y=-o.h+10;y<-8;y+=27)this.poly([[-o.w/2+2,y],[o.w/2-2,y+11],[o.w/2-2,y+20],[-o.w/2+2,y+9]],'#28343b');
   this.poly([[-o.w/2+4,-o.h+2],[0,-o.h-7],[1,-4],[-o.w/2+4,-1]],'#b4925d');
   for(let j=0;j<3;j++)this.line([[-o.w/2+6+j*6,-o.h+9],[j*5-5,-o.h*.6],[j*5-3,-8]],'#5e482f88',1);
   for(const y of [-o.h+17,-34]){this.rect(-o.w/2-3,y,o.w+6,8,'#334b47');this.rect(-o.w/2-3,y,o.w+6,2,'#8f9c78');this.circle(-o.w/2+3,y+4,1.8,'#c9b584');this.circle(o.w/2-3,y+4,1.8,'#c9b584');}
   this.line([[-o.w/2+2,-o.h],[0,-o.h-10],[o.w/2-1,-o.h]],'#c6aa72',2);
  }c.restore();
 }
 for(const target of game.targets||[]){if(target.used)continue;this.line([[target.x,target.y+26],[target.x,ground(target.x,game.world)]],'#8e907477',2);this.circle(target.x,target.y,29,'#243a3e');this.circle(target.x,target.y,26,target.gold?'#e5bf6f':'#bd8167');this.circle(target.x,target.y,18,'#e1d2aa');this.circle(target.x,target.y,10,target.gold?'#ac783e':'#964d4a');this.circle(target.x,target.y,3,'#f6e1ad');this.text(target.gold?'金靶':'',target.x,target.y-42,17,'#eed9a2');}
 for(const orb of game.orbs){if(orb.used)continue;const gold=orb.type==='plus',color=gold?'#edcf81':'#e7a0a0',pulse=this.reducedMotion?0:Math.sin(this.time*3+orb.x)*2;
  c.save();c.translate(orb.x,orb.y);c.rotate(Math.sin(this.time+orb.x)*.06);const points=[];for(let i=0;i<8;i++){const a=i*Math.PI/4;points.push([Math.cos(a)*(orb.r+2),Math.sin(a)*(orb.r+2)]);}this.inkpoly(points,'#263f3d',color,2.5);this.circle(0,0,orb.r+8+pulse,color+'10');
  if(gold){this.text('+1',0,8,23,'#f5dda0');this.line([[-10,-orb.r-9],[0,-orb.r-12],[10,-orb.r-9]],color+'88',1.5);}else this.inkpoly([[-12,-5],[-8,-11],[-2,-11],[0,-7],[3,-11],[9,-11],[13,-5],[11,1],[0,13],[-10,2]],'#db8c87','#f5cfb7',1.4);
  c.restore();
 }
 }
 observeVisuals(game,dt){
  if(!this.seenFX)this.seenFX=new WeakSet();
  if(game.phase==='flight'&&!this.wasFlying){this.feedback.beginVolley();this.hitFocus=null;this.comicLabel=null;const p=game.players[game.active],b=launch(p,game.angles[game.active],game.powers[game.active]);this.release={x:b.x,y:b.y,angle:Math.atan2(b.vy,b.vx),age:0};}
  for(const f of game.vfx||[])if(!this.seenFX.has(f)){
   this.seenFX.add(f);
   if(f.kind==='impact'){
    const strongest=this.feedback.hit(f);if(!this.hitFocus)this.hitFocus={x:f.x,y:f.y};
    if(strongest)this.comicLabel={x:f.x-(f.dir||1)*38,y:f.y-55,text:f.head?'好头！':'啪！',head:f.head,age:0};
   }else if(f.kind==='burst')this.feedback.hit({burst:true});
  }
  if(game.impact&&game.impact!==this.lastImpact){this.lastImpact=game.impact;if(Math.abs(game.impact.y-ground(game.impact.x,game.world))<16){this.dust.push({x:game.impact.x,y:game.impact.y,age:0});if(this.dust.length>8)this.dust.shift();}}
  if(['home','intro','scout'].includes(game.phase)){this.dust=[];this.lastImpact=null;this.hitFocus=null;this.comicLabel=null;this.feedback.reset();}
  for(const puff of this.dust)puff.age+=dt;this.dust=this.dust.filter(puff=>puff.age<.65);
  if(this.comicLabel){this.comicLabel.age+=dt;if(this.comicLabel.age>.5)this.comicLabel=null;}
  this.wasFlying=game.phase==='flight';if(this.release){this.release.age+=dt;if(this.release.age>.23)this.release=null;}
 }
 arrowEffects(game){const c=this.c,stats=game.players[game.active].stats;for(let i=0;i<game.arrows.length;i++){
  const b=game.arrows[i],p=position(b,b.t),a=Math.atan2(b.vy+G*b.t,b.vx),n=this.reducedMotion?3:this.canvas.width<900||i>8?5:9;
  const colors=[...(stats.fire?['#f5b16b']:[]),...(stats.poison?['#a8c481']:[]),...(stats.ice?['#a8dce6']:[])];if(!colors.length)colors.push('#e4ce99');
  const points=[];for(let j=n;j>=0;j--){const q=position(b,Math.max(0,b.t-j*.014));points.push([q.x,q.y]);}
  c.save();c.globalAlpha=.18;this.line(points,'#233b35',7);c.globalAlpha=.62;this.line(points,colors[0],2.3);
  for(let k=1;k<colors.length;k++){c.globalAlpha=.45;this.line(points.map(([x,y],j)=>[x,y+Math.sin(j*.8+this.time*15+k)*3]),colors[k],1.8);}c.restore();
  if(stats.fire&&!this.reducedMotion)for(let j=0;j<3;j++){const q=position(b,Math.max(0,b.t-(j+1)*.024));this.poly([[q.x-3,q.y+2],[q.x-8,q.y-3-j],[q.x+3,q.y-1]],j%2?'#dc6e3b':'#f5cc85');}
  if(stats.ice){c.save();c.translate(p.x-17*Math.cos(a),p.y-17*Math.sin(a));c.rotate(this.time*3);this.line([[-5,0],[5,0]],'#c7e7e6',1.3);this.line([[0,-5],[0,5]],'#c7e7e6',1.3);c.restore();}
  this.arrow(p.x,p.y,a,colors[0]);
 }
 }
 statusFX(game){
  const c=this.c;for(const p of game.players){if(p.hp<=0)continue;const s=p.status;if(!s)continue;const anchor=bodyPose(p).chest;
   if(s.burnTurns>0&&s.burn>0)for(let i=0;i<(this.reducedMotion?3:6);i++){const t=(this.time*1.4+i*.17)%1,x=anchor.x-18+i*7,y=anchor.y+30-t*40;c.save();c.globalAlpha=(1-t)*.65;this.poly([[x-4,y+6],[x-2,y-7-Math.sin(this.time*7+i)*3],[x+1,y-2],[x+4,y+5]],i%2?'#e29b55':'#f4cf82');c.restore();}
   if(s.poisonTurns>0&&s.poison>0)for(let i=0;i<4;i++){const t=(this.time*.55+i*.25)%1,x=anchor.x-18+i*12,y=anchor.y+35-t*38;c.save();c.globalAlpha=(1-t)*.6;this.circle(x,y,2+t*2,'#a2bb70');this.line([[x-2,y-2],[x,y-3]],'#d8e4a3',1);c.restore();}
   if(s.ice>0)for(let i=0;i<3;i++){const x=anchor.x-16+i*15,y=anchor.y+22-i%2*9;this.inkpoly([[x-4,y],[x-2,y-12],[x+5,y-4],[x+3,y+4]],'#96c3cd88','#d3e9e066',1);}
  }
 }
 particles(game){
  const c=this.c,reduced=this.reducedMotion,fx=(game.vfx||[]).slice(reduced?-6:-18);
  for(const f of fx){const age=rClamp(1-f.t/f.life,0,1),burst=f.kind==='burst',hit=f.kind==='impact',wood=f.kind==='shards',reach=burst?130:hit?70:55,count=reduced?4:burst?22:wood?13:12;
   c.save();c.translate(f.x,f.y);c.globalAlpha=1-age;
   if(burst){this.circle(0,0,15+age*90,'#dc794b22');c.lineWidth=4*(1-age)+1;c.strokeStyle=f.color;c.beginPath();c.arc(0,0,12+age*115,0,Math.PI*2);c.stroke();}
   if(hit&&age<.48){const r=10+age*(f.head?74:52),pts=[];for(let i=0;i<16;i++){const a=i*Math.PI/8,rr=i%2?r*.32:r;pts.push([Math.cos(a)*rr,Math.sin(a)*rr]);}this.inkpoly(pts,age<.15?'#fff9e9':'#ffd260','#192a32',2.4);}
   if(f.kind==='pickup'||f.kind==='split'){c.strokeStyle=f.color;c.lineWidth=2;c.beginPath();c.arc(0,0,10+age*65,-age,Math.PI*2-age);c.stroke();for(let i=0;i<4;i++){const a=i*Math.PI/2+age,r=18+age*45;this.line([[Math.cos(a)*r,Math.sin(a)*r],[Math.cos(a)*(r+9),Math.sin(a)*(r+9)]],f.color,2);}}
   for(let i=0;i<count;i++){const a=i*2.399+.23,rr=(.4+rHash(i+f.x)*.7)*age*reach,x=Math.cos(a)*rr,y=Math.sin(a)*rr+age*age*48;
    if(wood){c.save();c.translate(x,y);c.rotate(a+age*3);this.inkpoly([[-5,-2],[5,-3],[8,1],[-4,3]],i%2?'#bc9664':'#795239','#3a352a88',1);c.restore();}
    else if(i%3===0){this.line([[x-Math.cos(a)*6*(1-age),y-Math.sin(a)*6*(1-age)],[x,y]],f.color,2.5);}
    else this.rect(x,y,burst?5:3,2+i%2,f.color);
   }
   if(burst&&age>.2)for(let i=0;i<5;i++){c.globalAlpha=(1-age)*.26;this.circle(Math.cos(i*1.7)*age*65,Math.sin(i*1.7)*age*40-15,10+age*20,'#42382e');}
   c.restore();
  }
  if(this.comicLabel){const f=this.comicLabel,age=f.age/.5;c.save();c.globalAlpha=1-age*age;c.translate(f.x,f.y-(this.reducedMotion?0:age*15));c.rotate(f.head?-.12:.09);c.font=`oblique 400 ${f.head?32:26}px "Smiley Sans", sans-serif`;c.textAlign='center';c.strokeStyle='#182c32';c.lineWidth=5;c.lineJoin='round';c.strokeText(f.text,0,0);this.text(f.text,0,0,f.head?32:26,f.head?'#ffd260':'#f4ecdd');c.restore();}
  for(const puff of this.dust){const t=puff.age/.65;c.save();c.globalAlpha=(1-t)*.6;for(let i=0;i<7;i++){const x=puff.x+(i-3)*t*15,y=puff.y-Math.sin(t*Math.PI)*(10+i%3*6);this.poly([[x-5,y+3],[x-8,y-2],[x,y-5],[x+8,y+1]],ART[game.map].edge+'77');}c.restore();}
  if(this.release){const f=this.release,t=f.age/.23;c.save();c.translate(f.x,f.y);c.rotate(f.angle);c.globalAlpha=1-t;this.line([[0,-18-t*18],[-7-t*12,0],[0,18+t*18]],'#e9d0a6',2);for(let i=0;i<4;i++)this.rect(-12-t*20+i*5,-8+i*5,5,2,'#ead6a2');c.restore();}
 }
 weather(map){const c=this.c;for(let i=0;i<(this.reducedMotion?7:20);i++){
  const x=(i*173+this.time*(map===2?5:map===1?24:13))%(W+100)-50,y=270+(i*97+this.time*(map===1?3:8))%390;
  if(map===0){c.save();c.translate(x,y);c.rotate(Math.sin(this.time+i)*.8);this.poly([[-3,-2],[4,-1],[2,3],[-3,1]],i%3?'#c7bc803d':'#d3c49366');c.restore();}
  else if(map===1){this.line([[x,y],[x+5+i%3*4,y-1]],'#efd29b3d',1.3);}
  else{this.rect(x,y,2,2,'#cee9d38a');if(i%5===0)this.line([[x-3,y],[x+4,y]],'#c4e5d33d',1);}
 }
 }
 cinematic(game){const t=game.phaseTime,map=game.map,terrain=game.world,hero={...game.players[0],body:['victory','defeat'].includes(game.phase)?game.players[0].body:null,stuck:[],deadTime:0},enemy={...game.players[1],body:['victory','defeat'].includes(game.phase)?game.players[1].body:null,stuck:[],deadTime:0};
 if(game.phase==='intro'){
 const beat=Math.min(2,Math.floor(t/game.storyBeatDuration)),u=(t%game.storyBeatDuration)*4.5/game.storyBeatDuration;hero.x=beat===0?420+Math.min(100,u*27):520;hero.y=ground(hero.x,terrain);enemy.x=1080;enemy.y=ground(enemy.x,terrain);
 this.character(hero,0,{time:this.time,walk:beat===0?1:0,angle:beat===2?18:5,drawn:beat===2});this.character(enemy,1,{time:this.time,angle:beat===1?28:12,drawn:beat===1});
 // A red practice arrow lands at the traveller's feet, then the answer crosses the valley.
 if(map===0&&beat===1&&u>1){const f=rClamp((u-1)/1.5,0,1),x=1050-470*f,y=enemy.y-82+(hero.y-enemy.y+70)*f-Math.sin(f*Math.PI)*60;this.arrow(x,y,f===1?.8:Math.PI-.1,'#d99c75');if(f===1)for(let i=0;i<5;i++)this.rect(x-15+i*6,hero.y-7-i%2*4,4,3,'#d9c494');}
 if(map===1){const y=ground(795,terrain);this.rect(757,y-100,76,100,'#946b4a');this.line([[764,y-92],[824,y-8]],'#d2a76b',7);this.line([[823,y-92],[764,y-8]],'#d2a76b',7);if(beat===2&&u>2){this.c.save();this.c.translate(795,y);this.c.rotate(rEase(rClamp((u-2)/.9,0,1))*1.4);this.rect(-16,-152,32,152,'#b18d63');this.c.restore();}else this.rect(779,y-152,32,152,'#b18d63');}
 if(map===2){this.beacon(800,ground(800,terrain),beat===2?rClamp(u/4,0,1):.1);for(let i=0;i<12;i++){const a=i*Math.PI/6+this.time*.15;this.rect(800+Math.cos(a)*110,430+Math.sin(a)*80,3,5,'#bce2d4');}}
 if(beat===2&&u>1){const f=rClamp((u-1)/2,0,1);this.arrow(555+f*470,hero.y-80-Math.sin(f*Math.PI)*85,-.1,'#e9d6a6');}
 }else if(game.phase==='victory'||game.phase==='defeat'){
 const win=game.winner??0,finale=game.mode==='campaign'&&game.stage===3&&game.phase==='victory';hero.x=1020;hero.y=ground(hero.x,terrain);enemy.x=1260;enemy.y=ground(enemy.x,terrain);
 if(finale){this.beacon(1130,ground(1130,terrain),rClamp(t/2.5,0,1));enemy.x=1290-Math.min(70,Math.max(0,t-2)*18);enemy.y=ground(enemy.x,terrain);this.character({...hero,body:null},0,{time:this.time,angle:5});this.character({...enemy,body:null},1,{time:this.time,angle:5,walk:t>2&&t<6?1:0});}
 else for(const [p,i] of (game.mode==='target'?[[hero,0]]:[[hero,0],[enemy,1]])){p.deadTime=t;this.character(p,i,{time:this.time,angle:10,dead:i!==win});}
 if(game.phase==='victory')for(let i=0;i<35;i++){const x=920+(i*61)%450,y=ground(x,terrain)-50-((t*38+i*37)%300);this.rect(x,y,3,6,i%2?'#c6d7a6':'#e4bf72');}
 }else{hero.x=1050;hero.y=ground(hero.x,terrain);this.character(hero,0,{time:this.time,angle:12});this.rect(1120,hero.y-12,45,12,'#6b5140');for(let i=0;i<6;i++)this.poly([[1120+i*8,hero.y-10],[1124+i*8,hero.y-43-Math.sin(this.time*9+i)*12],[1129+i*8,hero.y-10]],i%2?'#ebba69':'#bd6e46');}
 }
 beacon(x,y,light){this.rect(x-28,y-28,56,28,'#657d78');this.rect(x-20,y-128,40,100,'#536e71');this.rect(x-35,y-141,70,15,'#95a394');this.rect(x-25,y-170,50,30,'#223c4d');if(light>0){this.c.save();this.c.globalAlpha=light*.65;this.poly([[x-22,y-168],[x-100,-300],[x+100,-300],[x+22,y-168]],'#a6e6d41c');this.circle(x,y-166,60,'#c1edca15');for(let i=0;i<5;i++)this.poly([[x-22+i*9,y-160],[x-18+i*9,y-190-Math.sin(this.time*5+i)*15],[x-12+i*9,y-160]],i%2?'#f0d38f':'#bce5c4');this.c.restore();}}
 draw(game,dt,{drag=null,paused=false}={}){this.time+=paused?0:dt;this.observeVisuals(game,paused?0:dt);if(this.emote){if(!game.canAim||drag||game.active!==this.emote.side||game.players[this.emote.side].body?.active)this.emote=null;else if(!paused){this.emote.time+=dt;if(this.emote.time>=this.emote.duration)this.emote=null;}}const viewW=this.canvas.width,viewH=this.canvas.height,portrait=viewW<viewH,wideScale=Math.max(1,viewW/W);const cinematic=['home','intro','victory','defeat','upgrade','loadout'].includes(game.phase);let z=viewW/W,x=W/2,y=H;if(cinematic){z=game.phase==='home'?1.12:1.25;x=game.phase==='home'?1000:800;if(game.phase==='intro'){const beat=Math.floor(game.phaseTime/game.storyBeatDuration);x=beat===0?620:beat===1?1000:800;z=beat===1?1.5:1.25;if(portrait){y=H+100;if(beat===2)z=Math.min(z,(viewW-60)/650);}}if(portrait&&['victory','defeat'].includes(game.phase))x=1160;}else if(!this.allView){z=1.6*wideScale;if(game.phase==='scout'){const t=game.phaseTime,hold=game.scoutDuration*.85/2.6,travel=game.scoutDuration*1.55/2.6;const a=game.mode==='target'?(game.targets.find(t=>!t.used)?.x??1100):game.players[1-game.active].x,b=game.players[game.active].x;x=t<hold?a:a+(b-a)*rEase(rClamp((t-hold)/travel,0,1));}else if(game.phase==='flight'&&game.arrows.length){z=1.35*wideScale;const p=this.hitFocus||position(game.arrows[0],game.arrows[0].t);x=p.x;y=Math.min(H,p.y+H*.56/z);}else if(game.phase==='settle'&&game.impact){x=(this.hitFocus||game.impact).x;z=1.45*wideScale;}else x=game.players[game.active].x;if(wideScale>1&&game.phase!=='flight')y=ground(x,game.world)+viewH*.28/z;}
 z=Math.max(z,viewW/W);const half=viewW/2/z;x=rClamp(x,half,W-half);const snap=this.resized||this.lastPhase==='home'&&game.phase==='intro'||this.lastPhase!=='scout'&&game.phase==='scout';this.resized=false;const blend=snap?1:Math.min(1,dt*(game.phase==='scout'?8*2.6/game.scoutDuration:4));this.cam.z+=(z-this.cam.z)*blend;this.cam.x+=(x-this.cam.x)*blend;this.cam.y+=(y-this.cam.y)*blend;this.lastPhase=game.phase;const c=this.c;c.save();c.clearRect(0,0,viewW,viewH);const cssH=this.canvas.getBoundingClientRect?.().height||viewH,shake=this.feedback.update(paused?0:dt,{reduced:this.reducedMotion,scale:viewH/cssH});c.translate(viewW/2+shake.x,viewH+shake.y);c.scale(this.cam.z,this.cam.z);c.translate(-this.cam.x,-this.cam.y);this.background(game.map,this.time,game.encounter);this.terrain(game);
 if(cinematic){this.cinematic(game);}else{this.objects(game);for(const point of game.trails){c.globalAlpha=Math.min(.6,point.t);this.rect(point.x,point.y,3,3,'#efd6a0');}c.globalAlpha=1;for(let i=0;i<(game.mode==='target'?1:2);i++)this.character(game.players[i],i,{time:this.time,angle:game.angles[i],drawn:game.active===i&&['aim','thinking'].includes(game.phase),dead:game.players[i].hp<=0,boss:i===1&&game.mode==='rogue'&&game.floor%3===0,bow:i===0&&game.mode==='rogue'?game.skill:'plain',emote:this.emote?.side===i?this.emote:null});if(game.canAim){const p=game.players[game.active],b=launch(p,game.angles[game.active],game.powers[game.active]);for(let j=1;j<12;j++){const pt=position(b,j*.045);if(pt.y>=ground(pt.x,game.world))break;this.circle(pt.x,pt.y,3.2,'#20323abf');this.circle(pt.x,pt.y,1.9,'#fff0d4');}this.rect(p.x-30,p.y-157,60,31,'#152d2bdb');this.text(game.angles[game.active]+'°',p.x,p.y-134,22,'#edd4a0');this.rect(p.x-27,p.y-129,54,3,'#557267');this.rect(p.x-27,p.y-129,54*game.powers[game.active]/100,3,'#e6c98c');this.poly([[p.x-7,p.y-120],[p.x+7,p.y-120],[p.x,p.y-113]],'#edd4a0');}
 this.arrowEffects(game);this.statusFX(game);for(const e of game.effects){c.globalAlpha=Math.min(1,e.t);c.font='oblique 400 23px "Smiley Sans", sans-serif';c.textAlign='center';c.strokeStyle='#20322ee0';c.lineWidth=4;c.lineJoin='round';c.strokeText(e.text,e.x,e.y);this.text(e.text,e.x,e.y,23,e.color);}c.globalAlpha=1;this.particles(game);}
 this.weather(game.map);c.restore();
 // Letterbox bars frame the animated story beats.
 if(cinematic&&game.phase!=='home'){this.rect(0,0,viewW,45,'#0e1b22e6');this.rect(0,viewH-48,viewW,48,'#0e1b22e6');}
 if(drag&&!paused){const scale=drag.screenScale,x=drag.screenX,y=drag.screenY,r=drag.cancelRadius*scale;this.circle(x,y,r,drag.inside?'#d9bc7650':'#d9bc7618');c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.strokeStyle=drag.inside?'#f2d58f':'#bba67b77';c.lineWidth=2;c.setLineDash([6,7]);c.stroke();c.setLineDash([]);this.text(drag.inside?'松手取消':'拉回圈内取消',rClamp(x,75*scale,viewW-75*scale),Math.min(viewH-18*scale,y+r+24*scale),14*scale,'#fff0ce');}
 }
}
