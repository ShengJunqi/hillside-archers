import assert from 'node:assert/strict';
import {Game,trace,position} from '../dist/core.mjs';
import {encounterFor} from '../dist/encounters.mjs';

let checks=0;
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
const near=(a,b,m)=>{assert.ok(Math.abs(a-b)<1e-7,m);checks++;};
function make(choice=1,hero='qingsong',skill='split'){
 const events=[],g=new Game({save:{unlocked:true},rng:()=>.5,onEvent:e=>events.push(e)});
 g.start('rogue',1,skill,hero);g.encounterFloor=0;g.pendingEncounter=encounterFor(0,choice);g.setup();
 g.stats.echo=1;g.obs=[];g.players[1].hp=g.players[1].stats.maxHp=10000;
 g.players.forEach((p,i)=>{p.poseAngle=g.angles[i];});g.skip();return {g,events};
}
function shotFor(g,part){
 for(const power of part==='head'?[50,65,80,100,40]:[65,50,80,100,40]){
  const groups=[];let group=[];
  for(let angle=5;angle<=75;angle++){
   const hit=trace(g.players[0],g.players[1],angle,[],g.world,power);
   if(hit.kind==='hit'&&hit.part===part)group.push(angle);
   else if(group.length){groups.push(group);group=[];}
  }
  if(group.length)groups.push(group);groups.sort((a,b)=>b.length-a.length);
  if(groups.length)return {angle:groups[0][Math.floor(groups[0].length/2)],power};
 }
 return null;
}

// Use a genuine initial arrow, its real collision, knockback and the actual
// spawned phantom flight. A manual hitTarget(child) would hide a missed chase.
for(const hero of ['qingsong','panshi'])for(let choice=1;choice<=12;choice++)for(const part of ['body','head']){
 const {g,events}=make(choice,hero),shot=shotFor(g,part),label=`${hero} map${choice} ${part}`;
 ok(shot,label+': legal first shot exists');g.aim(shot.angle,shot.power);ok(g.shoot(),label+': original real arrow launches');
 const original=g.arrows[0].id,initialHp=g.players[1].hp,initialAmmo=g.specialAmmo,spawned=new Map(),ages=new Map();
 let frames=0,finite=true,bounded=true,monotonic=true;
 while(g.round===1&&frames++<3600){
  g.update(1/240);
  for(const b of g.arrows)if(b.echo){
   spawned.set(b.id,b);finite&&=[b.x,b.y,b.vx,b.vy,b.t,...Object.values(position(b,b.t))].every(Number.isFinite);
   bounded&&=Math.abs(b.vx)<=800.000001;monotonic&&=b.t>=(ages.get(b.id)??0);ages.set(b.id,b.t);
  }
 }
 const hits=events.filter(e=>e.type==='hit'&&e.shooterSide===0),echoHits=hits.filter(e=>spawned.has(e.arrowId));
 eq(spawned.size,1,label+': the physical first hit summons one actual child ID');
 ok(hits.some(e=>e.arrowId===original),label+': initial projectile really made contact');
 ok(echoHits.length===1&&echoHits[0].damage>0,label+': spawned phantom adds a genuine second damage event');
 eq(initialHp-g.players[1].hp,hits.reduce((sum,e)=>sum+e.damage,0),label+': extra damage reaches actual health');
 ok(finite&&bounded&&monotonic,label+': chase stays finite, velocity-bounded and never resets lifetime');
 ok(frames<3600&&g.round===2,label+': all arrows and recovery eventually hand over the turn');
 eq(g.specialAmmo,initialAmmo,label+': passive pursuit does not consume special ammunition');
}

// Steering changes tangent at the current position, never teleports a live
// projectile or resets the clock. Dead targets cannot leave a lingering chase.
{
 const {g}=make();g.shoot();g.arrows=[];
 g.addArrow({x:g.players[1].x-130,y:g.players[1].y-260,vx:30,vy:540,t:.25,scale:.45,echo:true,bomb:false});
 const b=g.arrows[0],point=position(b,b.t),age=b.t;
 for(let i=0;i<10;i++)g.steerEcho(b);
 near(position(b,b.t).x,point.x,'repeated steering retains current world x');near(position(b,b.t).y,point.y,'steering retains current world y');
 eq(b.t,age,'steering does not reset projectile lifetime');ok(Math.abs(b.vx)<=800,'steering cannot exceed its bounded horizontal speed');
 g.players[1].hp=0;g.steerEcho(b);ok(b.dead,'defeated target ends the passive chase');
}

// A real intervening wall must block a non-piercing phantom. Giving it one
// legitimate penetration lets the same physical path continue through cover.
for(const pierce of [0,1]){
 const {g,events}=make();g.shoot();g.arrows=[];const target=g.players[1],hp=target.hp;
 const cover={id:991,x:target.x-90,y:target.y,w:50,h:260,hp:2,maxHp:2,type:'crate',state:'standing',rot:0,dir:1};g.obs=[cover];
 g.addArrow({x:target.x-160,y:target.y-250,vx:0,vy:540,t:0,scale:.45,pierce,echo:true,bomb:false});
 const b=g.arrows[0];for(let n=0;n<900&&g.round===1;n++)g.update(1/240);
 eq(cover.hp,1,'echo damages intervening cover exactly once with pierce '+pierce);
 const hits=events.filter(e=>e.type==='hit'&&e.shooterSide===0&&e.arrowId===b.id);
 if(!pierce){eq(hits.length,0,'non-piercing echo cannot pass through the wall');eq(target.hp,hp,'blocked echo adds no invisible target damage');}
 else {ok(hits.length===1&&target.hp<hp,'one real penetration lets the echo hit beyond the wall');ok(b.ignored.has(cover.id),'passed wall uses the ordinary projectile ignore state');}
}

// A player-transformed echo must honour its selected dive line, rather than
// secretly retaining the passive homing behaviour after manual pre-aim.
{
 const {g}=make(1,'qingsong','dive');g.shoot();g.arrows=[];const target=g.players[1];
 g.addArrow({x:target.x-150,y:target.y-350,vx:50,vy:10,t:.2,scale:.45,echo:true,bomb:false});
 const b=g.arrows[0];ok(g.beginSkillAim(),'a summoned echo may be deliberately transformed');g.aimSkill(-25);
 const preview=g.previewSkill();ok(preview.length===1,'manual echo dive has a real trajectory preview');ok(g.releaseSkillAim(),'manual echo dive commits');
 const before={...b},expected=position(before,1/240);g.update(1/240);const actual=position(b,b.t);
 near(actual.x,expected.x,'transformed echo follows the chosen horizontal tangent');near(actual.y,expected.y,'transformed echo follows ordinary gravity along the preview');
 ok(b.special&&b.diving&&b.echo,'manual transformation retains all real identities without re-enabling recursion');
}

console.log(checks+' actual echo pursuit, knockback, terrain, blocker, lifetime and manual-transform checks passed.');
