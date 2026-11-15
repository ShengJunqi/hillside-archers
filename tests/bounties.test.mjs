import assert from 'node:assert/strict';
import {BOUNTY_HEAL,bountyFor,createBountyState,recordBounty,bountyProgressText,rewardBounty} from '../dist/bounties.mjs';

let checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const equal=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);checks++;};
const stateFor=(kind,target=2,extra={})=>createBountyState({id:'test',kind,name:'观众悬赏',objective:'完成目标',target,...extra});
const event=(type,extra={})=>({type,shooterSide:0,...extra});

// A route preview must be repeatable without borrowing a random draw from combat.
const allKinds=new Set();
for(let floor=1;floor<=30;floor++){
 const arena={id:`arena-${floor}`,layoutId:'yard',cover:[[650,'crate',70,60],[900,'post',30,90]],supply:floor%2?'hearts':'mixed'};
 const before=JSON.stringify(arena),spec=bountyFor(arena,floor);
 equal(spec,bountyFor(arena,floor),'same encounter and floor yield identical optional challenge');
 equal(JSON.stringify(arena),before,'challenge generation does not mutate the route descriptor');
 ok(spec.target>=1&&spec.target<=3,'late-floor target remains bounded');allKinds.add(spec.kind);
 equal(spec.reward,{kind:'heal',amount:BOUNTY_HEAL},'default reward is small encounter healing, never permanent currency');
}
equal([...allKinds].sort(),['body','cover','pickup','skill-hit'],'route choices can offer all four challenge families');
for(let floor=1;floor<30;floor++)ok(bountyFor({id:'single-'+floor,cover:[[800,'crate',70,60]]},floor).kind!=='cover','one-cover arena never asks the player to destroy two');
equal(bountyFor(null),null,'missing encounter has no challenge');equal(createBountyState({kind:'bad'}),null,'unknown challenge family is ignored');equal(bountyProgressText(null),'','no challenge has no UI text');equal(recordBounty(null,event('hit')),false,'absent optional challenge never affects gameplay');

{
 const s=stateFor('cover'),crack=event('break',{obstacleId:0,broken:false,x:700,y:600});
 equal(recordBounty(s,crack),false,'cracking a two-hit crate does not complete demolition credit');
 equal(recordBounty(s,event('break',{shooterSide:1,obstacleId:0,broken:true})),false,'opponent cannot complete the player demolition goal');
 ok(recordBounty(s,event('break',{obstacleId:0,broken:true})),'numeric zero is a valid stable obstacle id');
 equal(recordBounty(s,event('break',{obstacleId:0,broken:true})),false,'same destroyed object only counts once across arrows');
 equal(recordBounty(s,event('arena-rule',{obstacleId:1,broken:true})),false,'automatically collapsing arena cover is not credited as a player hit');
 ok(recordBounty(s,event('break',{obstacleId:1,broken:true})),'second distinct cover completes demolition');
 equal([s.progress,s.complete],[2,true],'demolition progress is exact');
}
{
 const s=stateFor('pickup',2,{pickupKind:'plus'});
 equal(recordBounty(s,event('pickup',{orbId:'heart-1',kind:'heart'})),false,'plus-only goal does not count a heart');
 equal(recordBounty(s,event('pickup',{orbId:'npc-1',kind:'plus',shooterSide:1})),false,'opponent pickups cannot finish player goal');
 ok(recordBounty(s,event('pickup',{orbId:'plus-1',kind:'plus'})),'real plus pickup counts');
 equal(recordBounty(s,event('pickup',{orbId:'plus-1',kind:'plus'})),false,'split arrows cannot re-credit the same plus ball');
 equal(recordBounty(s,event('pickup',{kind:'plus'})),false,'pickup without identity or coordinates cannot fabricate credit');
 ok(recordBounty(s,event('pickup',{orbId:'plus-2',kind:'plus'})),'second ball counts independently');
 equal([s.progress,s.complete],[2,true],'pickup progress is exact');
 const coords=stateFor('pickup',2,{pickupKind:'any'});
 ok(recordBounty(coords,event('pickup',{kind:'heart',x:500,y:300})),'legacy coordinate event remains usable');
 equal(recordBounty(coords,event('pickup',{kind:'heart',x:500,y:300})),false,'coordinate fallback also prevents duplicate ball credit');
 ok(recordBounty(coords,event('pickup',{kind:'plus',x:600,y:300})),'any-ball challenge accepts both ball types');
}
{
 const s=stateFor('body');
 for(const part of ['head','nose',null])equal(recordBounty(s,event('hit',{part,damage:25})),false,'head or unknown zones do not count toward body challenge');
 for(const damage of [0,-1,NaN,Infinity,undefined])equal(recordBounty(s,event('hit',{part:'body',damage})),false,'non-damaging or invalid hit is not credited');
 equal(recordBounty(s,event('hit',{part:'body',damage:25,shooterSide:1})),false,'NPC body hits do not count');
 const first=event('hit',{part:'arms',damage:12,arrowId:'arrow-1',volleyId:1});ok(recordBounty(s,first),'real arm hit counts');
 equal(recordBounty(s,first),false,'replaying the same event object does not count');
 equal(recordBounty(s,{...first}),false,'replaying an identified arrow hit does not count');
 ok(recordBounty(s,event('hit',{part:'legs',damage:15,arrowId:'arrow-1',volleyId:2})),'a distinct next-volley arrow can legitimately hit again');
 equal([s.progress,s.complete],[2,true],'body or limb goal completes');
}
{
 const s=stateFor('skill-hit',1);
 equal(recordBounty(s,event('skill',{skill:'split'})),false,'activating a skill without a hit does not count');
 equal(recordBounty(s,event('hit',{part:'body',damage:12,skillUsed:false})),false,'ordinary volley cannot inherit an earlier activation');
 equal(recordBounty(s,event('hit',{part:'body',damage:0,skillUsed:true})),false,'skill glance cannot satisfy hit requirement');
 ok(recordBounty(s,event('hit',{part:'body',damage:12,skillUsed:true})),'skill-used captured on actual hit covers split, dive and burst ordering');
 equal([s.progress,s.complete],[1,true],'skill hit goal completes in one actual attack');
}
{
 const s=stateFor('body',1),unfinished=rewardBounty(s);
 equal(unfinished,{completed:false,granted:false,heal:0,rerolls:0},'unfinished optional goal grants no reward and does not alter progress');
 recordBounty(s,event('hit',{part:'feet',damage:6}));ok(bountyProgressText(s).includes('1/1 ✓'),'progress text shows completed target');
 const reward=rewardBounty(s);equal(reward,{completed:true,granted:true,heal:8,rerolls:0},'completed goal grants bounded healing once');
 equal(rewardBounty(s),{completed:true,granted:false,heal:0,rerolls:0},'reward claiming is idempotent');
 equal(recordBounty(s,event('hit',{part:'body',damage:12})),false,'finished challenge cannot overflow');ok(bountyProgressText(s).includes('奖励已领'),'UI text distinguishes claimed reward');
 const reroll=stateFor('skill-hit',1,{reward:{kind:'reroll',amount:99}});recordBounty(reroll,event('hit',{damage:10,skillUsed:true}));
 equal(rewardBounty(reroll),{completed:true,granted:true,heal:0,rerolls:1},'optional alternative reward remains exactly one reroll');
 const spec={kind:'body',target:999,objective:'有限目标',reward:{kind:'heal',amount:999}};const bounded=createBountyState(spec);
 equal([bounded.spec.target,bounded.spec.reward.amount],[3,8],'malformed counts and healing cannot create unbounded rewards');equal(spec.target,999,'state creation does not mutate caller spec');
}
console.log(checks+' optional-bounty, actual-event, deduplication and one-time reward checks passed.');
