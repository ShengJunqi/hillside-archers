import assert from 'node:assert/strict';
import {CHARACTERS,characterById,createSkillState,turnSkillHealing,hitKnockbackScale,pickupSkillHealing,opponentProfile,rogueEnemyStats} from '../dist/combat.mjs';
import {Game,baseStats} from '../dist/core.mjs';

let checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const equal=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);checks++;};
const player=id=>({hp:100,stats:{maxHp:100,damage:1},skills:createSkillState(id)});

equal(CHARACTERS.filter(c=>c.playable).map(c=>c.id),['qingsong','panshi','lingque'],'loadout exposes the familiar hero and two new initial-skill choices');
for(const id of ['missing',undefined,null,{},'__proto__'])equal(characterById(id).id,'qingsong','unrecognized character keeps legacy default');
for(const id of ['qingsong','chiyan']){
 const p=player(id);p.hp=35;equal(p.skills.initial,['composure'],'existing character retains the original initial skill');equal(turnSkillHealing(p),10,'existing emergency heal remains ten');equal(turnSkillHealing(p),0,'existing emergency heal is still once per encounter');equal(hitKnockbackScale(p),1,'existing characters gain no unintended knockback');equal(pickupSkillHealing(p),0,'existing characters gain no unintended pickup healing');
}
{
 const p=player('panshi'),before=JSON.stringify(p);equal(hitKnockbackScale(p),1.2,'heavy-string gives exactly twenty percent more impact');equal(hitKnockbackScale(p),1.2,'passive impact increase remains available for later shots');equal(JSON.stringify(p),before,'passive query does not change damage, health, skills or charges');
 p.hp=20;equal(turnSkillHealing(p),0,'new heavy-string hero does not silently inherit composure');equal(pickupSkillHealing(p),0,'heavy-string hero has no pickup bonus');
 p.skills.extra=['heavystring','damage','fire'];equal(hitKnockbackScale(p),1.2,'acquired relic list does not multiply the initial passive again');
 const ordinary=player('qingsong');ordinary.skills.extra=['heavystring'];equal(hitKnockbackScale(ordinary),1,'relic strings cannot masquerade as an initial skill');
}
{
 const p=player('lingque');p.hp=40;const beforeStats=JSON.stringify(p.stats);equal(pickupSkillHealing(p),8,'first real pickup returns eight healing');equal(pickupSkillHealing(p),0,'additional balls and split arrows cannot heal repeatedly');equal(p.skills.used,['lightgather'],'only the initial pickup charge is marked used');equal(p.hp,40,'hook returns healing without directly bypassing Game.heal');equal(JSON.stringify(p.stats),beforeStats,'pickup hook never changes damage or stat scaling');equal(hitKnockbackScale(p),1,'pickup hero keeps normal impact scale');
 const full=player('lingque');equal(pickupSkillHealing(full),0,'pickup at full health preserves the first injured-pickup bonus');equal(full.skills.used,[],'full-health pickup never consumes the charge');full.hp=50;equal(pickupSkillHealing(full),8,'a later injured pickup earns the preserved healing');equal(pickupSkillHealing(full),0,'the later useful pickup still grants only one bonus');
 const heart=player('lingque');heart.hp=80;heart.hp=Math.min(heart.stats.maxHp,heart.hp+20);equal(pickupSkillHealing(heart),0,'normal heart healing that reaches full health leaves the extra charge unused');equal(heart.skills.used,[],'heart recovery does not waste a charge at full health');heart.hp=70;equal(pickupSkillHealing(heart),8,'a later plus pickup while injured can use the charge left by that heart');
 const dead=player('lingque');dead.hp=0;equal(pickupSkillHealing(dead),0,'dead player cannot gain pickup healing');equal(dead.skills.used,[],'dead-player check cannot consume a later living charge');
}
for(const value of [null,undefined,{}, {skills:{}},{skills:{initial:'heavystring',used:[]}}])equal(hitKnockbackScale(value),1,'missing or malformed legacy skill state is a neutral passive');
for(const value of [null,undefined,{}, {hp:10,skills:{}},{hp:10,skills:{initial:'lightgather'}}])equal(pickupSkillHealing(value),0,'malformed pickup state remains safe and neutral');
{
 const a=createSkillState('lingque'),b=createSkillState('lingque');a.used.push('lightgather');a.initial.push('unrelated');a.extra.push('poison');
 equal(b,{initial:['lightgather'],used:[],extra:[]},'encounters receive independent initial, use and relic arrays');equal(characterById('lingque').initialSkills,['lightgather'],'runtime skill use cannot modify the character definition');
}

// Exercise the existing Game.start and floor transition interfaces instead of
// assuming a loadout selection or a new encounter resets these charges.
for(const id of ['panshi','lingque']){
 const g=new Game({save:{unlocked:true},rng:()=>.5});ok(g.start('rogue',1,'dive',id),'Game.start accepts the new stable hero id');
 equal(g.characterId,id,'run retains chosen character id');equal(g.players[0].skills.weapon,'dive','initial hero choice remains independent of chosen bow');equal(g.players[0].skills.initial,characterById(id).initialSkills,'setup installs selected hero initial abilities');
 if(id==='lingque'){equal(pickupSkillHealing(g.players[0]),0,'new full-health run keeps its pickup charge');g.players[0].hp-=10;equal(pickupSkillHealing(g.players[0]),8,'new run offers healing on its first injured pickup');}
 g.complete(true);g.resultNext();const choice=g.choices[0].id;ok(g.chooseUpgrade(choice),'existing relic transition remains available with new hero');
 equal(g.players[0].skills.initial,characterById(id).initialSkills,'next encounter retains the chosen hero');equal(g.players[0].skills.used,[],'new encounter clears only per-encounter charges');equal(g.players[0].skills.extra,[choice],'new relic remains separate from initial ability');equal(g.players[0].skills.weapon,'dive','next floor retains the independent bow');
 if(id==='lingque'){g.players[0].hp=Math.max(1,g.players[0].stats.maxHp-6);equal(pickupSkillHealing(g.players[0]),8,'next encounter restores exactly one injured-pickup bonus');equal(pickupSkillHealing(g.players[0]),0,'next encounter also consumes the bonus only once');}
 g.start('rogue',1,'split','qingsong');equal(g.players[0].skills.initial,['composure'],'fresh ordinary run does not inherit new hero initial skills');equal(g.players[0].skills.extra,[],'fresh run clears acquired relics');equal(hitKnockbackScale(g.players[0]),1,'heavy-string cannot leak into a later ordinary run');equal(pickupSkillHealing(g.players[0]),0,'pickup bonus cannot leak into a later ordinary run');
}
{
 const profile=opponentProfile('campaign',1);equal([profile.damage,profile.volleyCap,profile.error],[.6,24,9],'new heroes do not alter tutorial NPC profile');
 equal([1,2,3].map(s=>opponentProfile('campaign',s).volleyCap),[24,28,30],'campaign protection remains unchanged');
 equal([1,2,3,4,5,6].map(f=>rogueEnemyStats(f,baseStats()).maxHp),[100,116,162,148,164,210],'early opponent health curve remains unchanged');
}
console.log(checks+' selectable-character, initial-skill, encounter-reset and NPC-compatibility checks passed.');
