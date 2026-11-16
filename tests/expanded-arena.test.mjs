import assert from 'node:assert/strict';
import {Game,W,SPEED,ground,launch,position,collision,trace} from '../dist/core.mjs';
import {ARENAS,ARENA_LEFT,ARENA_RIGHT,arenaBounds,encounterFor} from '../dist/encounters.mjs';
import {syncGroundContact} from '../dist/body.mjs';

let checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);checks++;};
const oldStations={yard:[520,1080],bowl:[360,1240],dock:[140,1460],ridge:[260,1340],market:[300,1300],bridge:[440,1160],signs:[180,1420],festival:[540,1060],switchback:[280,1320],sinkhole:[400,1200],balcony:[160,1440],crossing:[380,1220]};
const create=(mode='local',choice=1)=>{const g=new Game({save:{unlocked:true},rng:()=>.5});ok(g.start(mode,choice),'mode starts: '+mode);return g;};
const place=(g,side,x)=>{
 const p=g.players[side];Object.assign(p,{x,homeX:x,y:ground(x,g.world),body:null,groundSlope:0});
 syncGroundContact(p,xx=>ground(xx,g.world));return p;
};
function bodyShot(g,side){
 const p=g.players[side],target=g.players[1-side];
 for(const power of [100,95,90,85,80,75,70,65,60,55,50,45,40,35,30,25,20])for(let angle=5;angle<=75;angle++){
  const b=launch(p,angle,power),t=(target.x-b.x)/b.vx;
  if(t<=0||t>=12)continue;
  const y=position(b,t).y;if(y<target.y-125||y>target.y+20)continue;
  const hit=trace(p,target,angle,g.obs,g.world,power);
  if(hit.kind==='hit'&&hit.part!=='head')return {angle,power};
 }
 return null;
}
function newContact(g,targetSide,{direction=targetSide===0?-1:1,part='head',damage=42}={}){
 g.active=1-targetSide;g.phase='aim';ok(g.shoot(),'each contact begins a fresh real volley');
 const arrow={...g.arrows[0],vx:direction*SPEED,vy:0,t:0};g.arrows=[];
 const p=g.players[targetSide];g.hitTarget(arrow,{part,damage},{x:p.x,y:p.y-(part==='head'?96:60)});
 g.phase='settle';g.phaseTime=0;return p;
}
function recoverTurn(g,p){
 const round=g.round;let frames=0;
 while((p.body?.active||g.round===round)&&frames++<360)g.update(1/60);
 ok(frames<360&&!p.body?.active,'expanded-area reaction recovers and hands over the turn');
 eq(g.round,round+1,'expanded-area recovery advances exactly one turn');
 eq(p.y,ground(p.x,g.world),'recovered archer stands on the actual outer terrain');
 eq(p.homeX,p.x,'recovery persists the displaced station');
 return frames;
}

eq(W,1600,'logical view width remains unchanged');
ok(ARENA_LEFT<0&&ARENA_RIGHT>W,'both sides of the existing arena gain actual playable space');
ok(ARENA_RIGHT-ARENA_LEFT>=3500,'expanded space is materially wider than the old view');
ok(SPEED>500,'full draw increases real projectile speed');
for(const [choice,a]of ARENAS.entries()){
 eq(a.xs,oldStations[a.id],a.id+': authored starting coordinates stay unchanged');
 for(const mode of ['local','duel']){
  const g=create(mode,choice+1);
  eq(g.players.map(p=>p.x),g.arena.xs,`${mode} ${a.id}: players use the seeded stance preview`);
  eq(g.players.map(p=>p.y),g.arena.xs.map(x=>ground(x,g.world)),`${mode} ${a.id}: initial terrain height is retained`);
  for(const [x,y]of a.profile)eq(ground(x,g.world),y,`${mode} ${a.id}: the original central profile node ${x} keeps its height`);
  eq(arenaBounds(g.world),{left:ARENA_LEFT,right:ARENA_RIGHT,width:ARENA_RIGHT-ARENA_LEFT},`${mode} ${a.id}: runtime uses expanded physical bounds`);
  eq(g.orbs.length,0,`${mode} ${a.id}: larger space does not add opening pickups`);
 }
 const target=create('target',choice+1);
 eq(target.players.map(p=>p.x),[220,target.arena.xs[1]],a.id+': target mode keeps the existing shooter station while the descriptor varies');
 const rogue=create('rogue');rogue.pendingEncounter=encounterFor(0,choice+1);rogue.encounterFloor=0;rogue.setup();
 eq(rogue.players.map(p=>p.x),oldStations[a.id],a.id+': roguelike setup also keeps the authored stations');
}
for(const [stage,id]of ['yard','dock','signs'].entries()){
 const g=create('campaign',stage+1);
 eq(g.players.map(p=>p.x),g.arena.xs,id+': campaign uses its actual stance descriptor');if(stage===0)eq(g.players.map(p=>p.x),oldStations[id],'tutorial keeps its authored learning stations');
 eq(g.players[1].hp,stage===0?50:100,id+': expanded maps retain chapter health balance');
}

// Test actual collisions through the entire new travel range, including the
// old projectile kill lines. This is independent of the NPC choosing a shot.
for(let choice=1;choice<=ARENAS.length;choice++){
 const g=create('duel',choice);g.obs=[];g.arena.enemy.id='steady';
 place(g,0,ARENA_LEFT+55);place(g,1,ARENA_RIGHT-55);
 for(const side of [0,1]){
  const shot=bodyShot(g,side);ok(shot,g.arena.layoutId+': far-edge side '+side+' retains an integer non-head shot');
  eq(trace(g.players[side],g.players[1-side],shot.angle,[],g.world,shot.power).kind,'hit','full-range projectile reaches the opposite archer');
 }
 const angle=g.chooseAI(),power=g.powers[1];
 eq(trace(g.players[1],g.players[0],angle,[],g.world,power).kind,'hit',g.arena.layoutId+': zero-error NPC replans from the new edge');
 ok(Number.isInteger(angle)&&angle>=5&&angle<=75&&Number.isInteger(power)&&power>=20&&power<=100,'far-edge NPC retains legal controls');
 for(const x of [-75,1675]){
  const sample={x,y:ground(x,g.world)-140};
  eq(collision(sample,{x:800,y:700},[],g.world),null,'projectile survives beyond the former horizontal boundary at '+x);
 }
}

for(const side of [0,1]){
 const g=create('local',3);g.obs=[];place(g,0,ARENA_LEFT+55);place(g,1,ARENA_RIGHT-55);
 g.players.forEach(p=>{p.hp=p.stats.maxHp=1000;});
 const shot=bodyShot(g,side),target=g.players[1-side],hp=target.hp;
 g.active=side;g.phase='aim';g.aim(shot.angle,shot.power);ok(g.shoot(),'far-edge shot begins an actual Game flight');
 let frames=0;while(g.round===1&&frames++<1200)g.update(1/60);
 ok(frames<1200&&target.hp<hp,'full-range Game flight reaches and damages the distant opponent');
 ok(!target.body?.active&&g.active===1-side,'actual far-edge flight and recovery hand over a playable turn');
}

{
 const g=create('local',3);place(g,0,-700);place(g,1,2300);g.spawnOrbs();
 eq(g.orbs.length,2,'displaced stations still generate the usual pair of supplies');
 ok(g.orbs.some(o=>o.x<0)&&g.orbs.some(o=>o.x>W),'supplies can follow both archers into the new side terrain');
 ok(g.orbs.every(o=>o.x>=ARENA_LEFT+80&&o.x<=ARENA_RIGHT-80&&o.y<=ground(o.x,g.world)-65),'new-area supplies remain clear of physical world edges and ground');
}

// Several distinct real volleys carry fighters across the old world edges.
// Recovery and turn handoff still run through Game.update, not a body mock.
for(const side of [0,1]){
 const g=create('local',3);g.players.forEach(p=>{p.hp=p.stats.maxHp=10000;});
 const start=g.players[side].x,direction=side===0?-1:1;let previous=start;
 for(let volley=0;volley<10;volley++){
  const p=newContact(g,side);recoverTurn(g,p);
  ok((p.x-previous)*direction>5,'fresh volley keeps moving the station past the old edge');
  ok(p.x>=ARENA_LEFT+55&&p.x<=ARENA_RIGHT-55,'station remains inside expanded physical bounds');
  ok(Object.values(p.body.nodes).every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)&&n.x>=ARENA_LEFT+10&&n.x<=ARENA_RIGHT-10),'moving limbs are finite and use the new world boundary');
  previous=p.x;
 }
 ok(side===0?previous<0:previous>W,'repeated shots move the archer into genuinely additional terrain');
 eq(g.active,side,'the displaced archer receives the next local turn');
 const station=g.players[side].x;for(let i=0;i<30;i++)g.update(1/60);
 eq(g.players[side].x,station,'standing in new terrain does not snap back into the former view');
}

// At the final safety wall, an outward impact can finish normally; a later
// inward impulse must release the body rather than leave its nodes pinned.
for(const side of [0,1]){
 const g=create('local',3);g.players.forEach(p=>{p.hp=p.stats.maxHp=1000;});
 const edge=side===0?ARENA_LEFT+55:ARENA_RIGHT-55,direction=side===0?-1:1;
 place(g,side,edge);newContact(g,side);recoverTurn(g,g.players[side]);
 const before=g.players[side].x;
 ok((before-edge)*direction<=0&&Math.abs(before-edge)<40,'outermost wall remains a safe bounded station with room for slope settling');
 const after=newContact(g,side,{direction:-direction});recoverTurn(g,after);
 ok((after.x-before)*-direction>25,'an inward hit releases the archer from the expanded wall');
}

// More range is not extra NPC damage: bonus arrows and their status tick still
// share the original chapter budget even while the player is outside0..1600.
for(const stage of [1,2,3]){
 const g=create('campaign',stage);place(g,0,-250);g.active=1;g.phase='thinking';
 Object.assign(g.players[1].stats,{damage:20,crit:1,fire:4,poison:5,multi:8});g.shoot();
 const arrow={...g.arrows[0],vx:-SPEED,vy:0,t:0};
 for(let i=0;i<24;i++)g.hitTarget(arrow,{part:'head',damage:42},{x:g.players[0].x,y:g.players[0].y-96});
 g.arrows=[];g.nextTurn();
 ok(g.players[0].hp>=100-g.opponent.volleyCap&&g.players[0].hp>0,'chapter '+stage+': larger bow preserves multiarrow, crit and status damage protection');
 eq(g.opponent.volleyCap,[24,28,30][stage-1],'chapter '+stage+': damage allowance does not grow with map size');
}

console.log(checks+' expanded-world, descriptor-spawn, long-range, edge-recovery and NPC-budget checks passed.');
