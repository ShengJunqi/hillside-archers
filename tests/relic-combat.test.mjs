import assert from 'node:assert/strict';
import {Game,MAX_ARROWS,UPGRADES,applyUpgrade,ground} from '../dist/core.mjs';
import {RETIRED_RELICS,fuseDamage} from '../dist/relics.mjs';

let checks=0;
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(v,w,m)=>{assert.deepEqual(v,w,m);checks++;};
const near=(v,w,m)=>{assert.ok(Math.abs(v-w)<1e-9,m);checks++;};
const make=(skill='split',mode='rogue')=>{
 const events=[],g=new Game({save:{unlocked:true},rng:()=>.5,onEvent:e=>events.push(e)});
 g.start(mode,1,skill);g.skip();g.obs=[];g.players.forEach(p=>{p.hp=p.stats.maxHp=10000;});
 return {g,events};
};
const shoot=(g,side=0)=>{
 g.active=side;g.phase=side===0?'aim':'thinking';ok(g.shoot(),'fixture begins an actual new volley');
 return g.arrows[0];
};
const hit=(g,b,{part='body',damage=26,noStick=false}={})=>{
 const target=g.players[1-g.active],height=part==='head'?96:part==='legs'?25:60;
 const before=target.hp;g.hitTarget(noStick?{...b,noStick:true}:b,{part,damage},{x:target.x,y:target.y-height});
 return before-target.hp;
};
const plus=(g,b,id)=>{const orb={id,x:b.x,y:b.y,type:'plus',r:25,used:false};g.pickup(orb,b,{x:b.x,y:b.y});return g.arrows.at(-1);};
const cover=(id,hp=2)=>({id,type:hp===1?'post':'crate',x:800,y:700,w:50,h:80,hp,maxHp:hp,state:'standing',rot:0,dir:1});

for(const rank of [1,2,3]){
 const {g}=make();g.stats.echo=rank;const b=shoot(g),before=g.volleyCount,ammo=g.specialAmmo;
 hit(g,b);eq(g.volleyCount,before+rank,'first physical hit summons one phantom per echo rank');
 const children=g.arrows.filter(a=>a.echo);eq(children.length,rank,'all newly summoned arrows carry their non-recursive identity');
 for(const child of children){
  eq(child.scale,.45,'phantom uses the agreed45% direct scale');ok(child.y<g.players[1].y-200&&child.vy>0,'phantom physically falls from above the target');
  ok(!child.special&&!child.bomb,'ordinary phantom does not gain a free bomb or special ammunition');
 }
 eq(g.specialAmmo,ammo,'echo does not consume an additional special charge');
 hit(g,b);eq(g.volleyCount,before+rank,'later parent hit in the same volley does not repeat echo');
 const child=children[0];g.echoTriggered=false;eq(hit(g,child),Math.round(26*.45),'real phantom body contact deals45% direct damage');eq(g.volleyCount,before+rank,'a phantom cannot recursively proc even when the volley guard is independently clear');
 const copy=plus(g,child,'echo-copy');ok(copy.echo,'+1 preserves phantom identity');g.echoTriggered=false;hit(g,copy);eq(g.volleyCount,before+rank+1,'a phantom pickup child cannot recursively proc');
 child.t=.2;ok(g.activateSkill(),'a real split activation can include phantom arrows');
 ok(g.arrows.filter(a=>a.echo).length>=3,'split children retain phantom identity');
 const splitChild=g.arrows.find(a=>a.echo&&a.special);ok(splitChild,'split preserves both phantom and transformed special flags');
 const count=g.volleyCount;g.echoTriggered=false;hit(g,splitChild);eq(g.volleyCount,count,'special transformation does not re-enable phantom recursion');
}
{
 const {g}=make();g.stats.echo=3;g.stats.damage=1.75;const b=shoot(g);
 while(g.volleyCount<MAX_ARROWS)g.addArrow({x:100,y:100,vx:100,vy:0});
 const damage=hit(g,b);eq(damage,Math.round((26+12*3)*g.stats.damage),'full arrow budget converts echo rank into one base damage bonus that retains arrow-damage growth');
 eq(g.volleyCount,MAX_ARROWS,'full-budget echo never adds a25th arrow');
 eq(hit(g,b),Math.round(26*g.stats.damage),'full-budget fallback remains once per volley');
}
{
 const {g}=make('burst');g.stats.echo=2;const b=shoot(g),target=g.players[1];
 Object.assign(b,{x:target.x-65,y:target.y-60,vx:180,vy:0,t:.2});
 ok(g.activateSkill(),'bound bomb uses an actual activation');eq(g.volleyCount,1,'range blast is not a physical arrow hit and does not summon echo');
 ok(g.vfx.some(f=>f.kind==='impact'&&f.blast),'fixture really dealt a proximity blast');
 for(let i=0;i<180&&!g.echoTriggered;i++)g.update(1/240);
 ok(g.echoTriggered&&g.arrows.some(a=>a.echo),'subsequent real boosted-arrow contact summons physical phantom arrows');
}

for(const rank of [1,2,3]){
 const {g}=make();Object.assign(g.stats,{fuse:rank,fire:1,poison:1});const b=shoot(g),target=g.players[1];
 target.status={burn:2,burnTurns:1,poison:3,poisonTurns:2,ice:0};
 const before={...target.status},packet=fuseDamage(g.stats,target.status);
 eq(hit(g,b),26,'ordinary hit cannot spend the special-only fuse proc');ok(!g.fuseTriggered,'ordinary contact leaves fuse available');
 // Ordinary contact applies its normal stacks; measure the packet immediately
 // before the special hit, without replacing the actual target status.
 const status={...target.status},expected=fuseDamage(g.stats,status);b.special=true;
 eq(hit(g,b),Math.round(26+expected),'first special contact adds exactly one current status packet');
 ok(g.fuseTriggered,'successful special packet consumes this volley proc');
 eq(target.status.burn,status.burn+1,'fuse adds no burn beyond the one normal hit application');
 eq(target.status.poison,status.poison+1,'fuse adds no poison beyond the one normal hit application');
 eq([target.status.burnTurns,target.status.poisonTurns],[2,3],'normal hit refresh is retained without an extra fuse refresh or tick consumption');
 eq(hit(g,b),26,'second special contact does not repeat the packet');
 ok(packet>0&&before.burnTurns===1,'fixture contained genuine pre-existing active statuses');
}
{
 const {g}=make();Object.assign(g.stats,{fuse:3,fire:1,poison:1});const b=shoot(g);b.special=true;
 eq(hit(g,b),26,'fuse is computed before this first hit adds fresh elemental stacks');ok(!g.fuseTriggered,'an empty prior status packet does not waste fuse');
 const expected=fuseDamage(g.stats,g.players[1].status);eq(hit(g,b),Math.round(26+expected),'a later special arrow can detonate the now-existing status once');
}
{
 const {g}=make();Object.assign(g.stats,{fuse:2,fire:1});const b=shoot(g);b.special=true;g.players[1].status={burn:4,burnTurns:1,poison:2,poisonTurns:0,ice:0};
 eq(hit(g,b),44,'expired poison is ignored while the live fire packet is added');eq(g.players[1].status.poisonTurns,0,'fuse does not revive an expired status');
}

{
 const {g}=make();g.stats.reclaim=1;const b=shoot(g);g.specialAmmo=1;
 hit(g,b,{part:'head',damage:42});eq(g.specialAmmo,1,'ordinary headshots do not refund special ammunition');
 b.special=true;hit(g,b);eq(g.specialAmmo,1,'special body shots do not satisfy headshot recovery');
 hit(g,b,{part:'head',damage:42});eq(g.specialAmmo,2,'first special headshot adds one real stored special charge');ok(g.headAmmoRefunded,'actual headshot gain is marked for this arena');
 hit(g,b,{part:'head',damage:42});eq(g.specialAmmo,2,'a repeated headshot cannot refund again');
 shoot(g);const next=g.arrows[0];next.special=true;hit(g,next,{part:'head',damage:42});eq(g.specialAmmo,2,'a new volley does not reset the per-arena headshot refund');
 g.setup(false);const fresh=shoot(g);fresh.special=true;hit(g,fresh,{part:'head',damage:42});eq(g.specialAmmo,3,'a genuinely fresh arena reset restores its one headshot opportunity');
}
{
 const {g}=make();g.stats.reclaim=1;const b=shoot(g);b.special=true;g.specialAmmo=5;
 hit(g,b,{part:'head',damage:42});eq(g.specialAmmo,5,'headshot cannot exceed arrow-bag capacity');ok(!g.headAmmoRefunded,'a full bag does not consume an unreceived refund');
 g.specialAmmo=4;hit(g,b,{part:'head',damage:42});eq(g.specialAmmo,5,'the first actually received headshot refund respects capacity');
}
{
 const {g}=make();g.stats.pierce=1;g.specialAmmo=1;const one=cover('one'),two=cover('two',1);
 g.hitObstacle(one,1);eq(one.hp,1,'first actual strike only cracks a two-hit crate');eq(g.specialAmmo,1,'cracking is not a recovery event');
 g.hitObstacle(one,1);eq(one.state,'broken','second actual strike destroys the crate');eq(g.specialAmmo,2,'first actual cover break refunds one special charge');ok(g.coverAmmoRefunded,'received cover refund has an arena guard');
 g.hitObstacle(one,1);g.hitObstacle(two,1);eq(g.specialAmmo,2,'destroyed cover and further cover cannot repeatedly grant ammunition');
 g.setup(false);g.stats.pierce=1;g.specialAmmo=2;g.active=1;g.hitObstacle(cover('npc',1),-1);eq(g.specialAmmo,2,'NPC breaking cover never grants the player ammunition');ok(!g.coverAmmoRefunded,'NPC break does not waste the player opportunity');
 g.active=0;g.arena.rule='collapse';g.obs=[cover('rule',1)];g.round=5;g.applyArenaRule();eq(g.obs[0].state,'falling','collapse fixture really removes the standing post');eq(g.specialAmmo,2,'automatic arena collapse does not count as player cover destruction');ok(!g.coverAmmoRefunded,'automatic collapse preserves the real break opportunity');
}
{
 const {g}=make();g.stats.pierce=1;g.specialAmmo=5;g.hitObstacle(cover('full',1),1);eq(g.specialAmmo,5,'cover recovery cannot overfill the bag');ok(!g.coverAmmoRefunded,'no actual ammo gain preserves cover opportunity');
 g.specialAmmo=4;g.hitObstacle(cover('space',1),1);eq(g.specialAmmo,5,'later actual cover recovery can fill the freed slot');
}

for(const mode of ['rogue','campaign','local']){
 const {g}=make('split',mode);const before=g.specialAmmo;
 Object.assign(g.players[1].stats,{echo:3,fuse:3,reclaim:1,fire:3,poison:3,crit:1});
 const b=shoot(g,1);b.special=true;
 for(let i=0;i<24;i++)hit(g,b,{part:'head',damage:42});
 eq(g.volleyCount,1,'NPC cannot summon echo arrows in '+mode);ok(!g.vfx.some(f=>f.kind==='echo'||f.kind==='fuse'),'NPC cannot inherit new player relic visual procs in '+mode);
 eq(g.specialAmmo,before,'NPC cannot receive player special-ammunition refunds in '+mode);
 if(mode!=='local'){
  ok(g.npcVolleyDamage<=g.opponent.volleyCap,'new relic fields do not bypass the NPC volley budget in '+mode);
  const hp=g.players[0].hp;g.arrows=[];g.nextTurn();eq(g.players[0].hp,hp,'subsequent elemental tick shares the already-exhausted NPC budget in '+mode);
 }
}

{
 const {g}=make();
 for(const id of RETIRED_RELICS){
  const st={...g.stats},key=id==='heal'?'heal':id;applyUpgrade(st,id);ok(st[key]>g.stats[key],'legacy '+id+' effect remains directly applicable');
  const legacy=make().g;legacy.floor=2;legacy.phase='upgrade';legacy.choices=[{id}];ok(legacy.chooseUpgrade(id),'an explicit legacy '+id+' reward still uses its compatible application path');ok(legacy.stats[key]>0,'legacy '+id+' survives the real next-floor setup');
 }
 for(let i=0;i<30;i++)ok(g.rollUpgrades().every(u=>!RETIRED_RELICS.includes(u.id)),'retired legacy effects never enter new reward choices');
 const only=id=>UPGRADES.filter(u=>u.id!==id).map(u=>u.id);
 eq(g.rollUpgrades(only('fuse')),[],'elementless build cannot be offered an inert fuse');
 g.stats.fire=1;eq(g.rollUpgrades(only('fuse')).map(u=>u.id),['fuse'],'an elemental build can receive its new fuse partner');
 for(const [id,max]of [['echo',3],['fuse',3],['reclaim',1],['pierce',3],['ice',3],['multi',8],['crit',.75],['leech',.6]]){
  g.stats[id]=max;eq(g.rollUpgrades(only(id)),[],id+' at its new cap is not offered as a wasted reward');
 }
}

console.log(checks+' actual relic combat, phantom inheritance, elemental packets, ammunition refunds and reward-pool checks passed.');
