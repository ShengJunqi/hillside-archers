import assert from 'node:assert/strict';
import {Game,launch,position,baseStats,validSave} from '../dist/core.mjs';
import {createBountyState,bountyProgressText} from '../dist/bounties.mjs';
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;},eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
const game=()=>{const g=new Game({save:{unlocked:true,embers:19,bow:2},rng:()=>.5});g.start('rogue');return g;};
const spec=(kind,target=2,reward={kind:'heal'})=>({id:'fixture',kind,target,objective:'测试目标',reward});
{
 const g=game(),before=JSON.stringify(g.save);g.players[0].hp=60;g.bounty=createBountyState(spec('body'));
 g.emit('hit',{shooterSide:1,part:'body',damage:26,arrowId:1});eq(g.bounty.progress,0,'NPC cannot earn player reward');
 g.emit('hit',{shooterSide:0,part:'head',damage:42,arrowId:1});eq(g.bounty.progress,0,'head hit does not satisfy body challenge');
 for(const arrowId of[1,2])g.emit('hit',{shooterSide:0,part:'legs',damage:18,arrowId});
 eq(g.players[0].hp,68,'completion immediately applies actual eight HP reward');ok(g.bounty.claimed,'reward is claimed exactly once');
 g.emit('hit',{shooterSide:0,part:'body',damage:26,arrowId:3});eq(g.players[0].hp,68,'extra hits do not repeat reward');eq(JSON.stringify(g.save),before,'suspense reward never changes permanent balance or upgrades');
}
{
 const g=game();g.bounty=createBountyState(spec('pickup',1));g.emit('pickup',{kind:'plus',orbId:'one',shooterSide:0});eq(g.players[0].hp,g.stats.maxHp,'full health is not overfilled');eq(g.rerolls,1,'full-health water reward becomes useful reroll');
 g.emit('pickup',{kind:'plus',orbId:'one',shooterSide:0});eq(g.rerolls,1,'duplicate pickup cannot earn another reroll');
 g.complete(true);g.resultNext();const old=g.choices.map(u=>u.id),save=JSON.stringify(g.save);ok(g.rerollUpgrades(),'earned reroll works in upgrade phase');eq(g.rerolls,0,'reroll consumes one credit');eq(g.choices.length,3,'reroll still offers three relics');ok(g.choices.every(u=>!old.includes(u.id)),'reroll cannot show the same three options');
 const current=JSON.stringify(g.choices);ok(!g.rerollUpgrades(),'zero-credit reroll rejected');eq(JSON.stringify(g.choices),current,'rejected reroll does not silently change options');eq(JSON.stringify(g.save),save,'reroll never spends permanent embers');
}
{
 const g=game();g.bounty=createBountyState(spec('cover',1,{kind:'reroll'}));const cover={...g.obs[0],id:987,hp:2,maxHp:2,state:'standing'};g.hitObstacle(cover,1);eq(g.bounty.progress,0,'cracking a crate is not breaking cover');g.hitObstacle(cover,1);eq(g.rerolls,1,'real second hit on crate grants cover reroll');g.hitObstacle(cover,1);eq(g.rerolls,1,'destroyed cover cannot be counted twice');
 g.players[0].hp=51;g.complete(true);g.resultNext();g.chooseUpgrade(g.choices[0].id);eq(g.rerolls,1,'unused reroll carries across this expedition');ok(!g.rerollUpgrades(),'cannot reroll while aiming/scouting');g.start('rogue');eq(g.rerolls,0,'new expedition clears temporary credits');eq(validSave(g.save).embers,g.save.embers,'v2 save remains a permanent-progress record');
}
{
 const g=game();g.skill='burst';g.bounty=createBountyState(spec('skill-hit',1,{kind:'reroll'}));g.phase='aim';g.shoot();const target=g.players[1],b=g.arrows[0];b.x=target.x+30;b.y=target.y-60;b.vx=80;b.vy=0;b.t=.2;g.activateSkill();
 ok(g.skillUsed&&target.hp<target.stats.maxHp,'burst inflicts real skill damage');eq(target.stuck.length,0,'explosion does not leave a floating arrow at blast origin');ok(target.body.rootVX<0,'burst beyond opponent pushes away from its actual explosion side');eq(g.rerolls,1,'real burst hit satisfies skill bounty');
}
console.log(checks+' real bounty, reroll, full-health reward and blast-feedback integration checks passed.');
