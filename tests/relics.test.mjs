import assert from 'node:assert/strict';
import {NEW_RELICS,RETIRED_RELICS,newRelicCap,newRelicEligible,applyNewRelic,newRelicPreview,fuseDamage,applyRewardUpgrade,rewardUpgradePreview} from '../dist/relics.mjs';

let checks=0;
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(v,w,m)=>{assert.deepEqual(v,w,m);checks++;};
const near=(v,w,m)=>{assert.ok(Math.abs(v-w)<1e-9,m);checks++;};
const base=()=>({damage:1,multi:1,fire:0,poison:0,ice:0,pierce:0,leech:0,crit:0,maxHp:100,echo:0,fuse:0,reclaim:0});

eq(NEW_RELICS.map(r=>r.id),['echo','fuse','reclaim'],'three new effects have stable IDs');
eq(RETIRED_RELICS,['balance','heal','regen','impact','armor'],'only the agreed legacy choices leave the new pool');
for(const r of NEW_RELICS){
 ok(r.name&&r.tag&&r.icon&&r.desc,'new relic carries complete card copy');
 const stats={...base(),fire:1},cap=newRelicCap(r.id);
 for(let i=0;i<cap;i++){
  ok(newRelicEligible(stats,r.id),'uncapped relevant relic can be offered');
  const before=JSON.stringify(stats),preview=newRelicPreview(stats,r.id);
  ok(preview&&preview!==null,'new relic has actionable next-rank preview');eq(JSON.stringify(stats),before,'preview is pure');
  ok(applyNewRelic(stats,r.id),'known relic is handled');eq(stats[r.id],i+1,'applying new relic grants exactly one rank');
 }
 ok(!newRelicEligible(stats,r.id),'maxed relic is not offered again');
 ok(applyNewRelic(stats,r.id),'maxed relic is still handled instead of triggering fallback');eq(stats[r.id],cap,'maxed relic cannot increase');
 ok(newRelicPreview(stats,r.id).includes('上限'),'capped preview explains the limit');
}
eq(newRelicCap('unknown'),0,'unknown relic has no cap');
ok(!newRelicEligible(base(),'unknown'),'unknown relic is never eligible');
const unchanged=base();ok(!applyNewRelic(unchanged,'unknown'),'unknown new relic is not handled');eq(unchanged,base(),'unknown new relic leaves stats unchanged');
eq(newRelicPreview(base(),'unknown'),null,'unknown relic has no preview');
ok(!newRelicEligible(base(),'fuse'),'elementless build is not offered an inert fuse');
ok(newRelicEligible({...base(),fire:1},'fuse'),'fire enables fuse choice');
ok(newRelicEligible({...base(),poison:1},'fuse'),'poison enables fuse choice');
ok(newRelicEligible(base(),'echo')&&newRelicEligible(base(),'reclaim'),'non-elemental relics stay available');

for(const [rank,mult]of [[0,0],[1,.6],[2,.9],[3,1.2],[10,1.2]]){
 const stats={...base(),fuse:rank,fire:1,poison:1},status={burn:2,burnTurns:2,poison:3,poisonTurns:3};
 const before=JSON.stringify([stats,status]);
 near(fuseDamage(stats,status),(2*5+3*5)*mult,'active burning empowers poison before multiplying fuse packet');
 eq(JSON.stringify([stats,status]),before,'fuse damage neither consumes turns nor applies new stacks');
 near(fuseDamage(stats,{...status,burnTurns:0}),3*3*mult,'expired fire does not empower poison');
 near(fuseDamage(stats,{...status,poisonTurns:0}),2*5*mult,'expired poison contributes no damage');
 near(fuseDamage(stats,{...status,burnTurns:0,poisonTurns:0}),0,'expired statuses produce no packet');
 near(fuseDamage(stats,{...status,burn:0}),3*3*mult,'zero burning stacks do not empower poison');
}
eq(fuseDamage({...base(),fuse:1},{burn:3,burnTurns:2}),0,'an elementless source cannot create fuse damage');
eq(fuseDamage({...base(),fuse:1,fire:1},{}),0,'missing status fields are harmless');
eq(fuseDamage({...base(),fuse:1,fire:1},{burn:NaN,burnTurns:2,poison:-3,poisonTurns:2}),0,'invalid status numbers cannot create NaN damage');

const expected={damage:1.4,multi:2,fire:2,poison:2,ice:1,pierce:1,leech:.18,crit:.2,maxHp:140};
for(const id of ['damage','multi','fire','poison','ice','pierce','leech','crit','vital']){
 const stats=base(),key=id==='vital'?'maxHp':id,before=JSON.stringify(stats);
 ok(rewardUpgradePreview(stats,id),'new reward has a real next-effect preview');eq(JSON.stringify(stats),before,'reward preview is pure');
 ok(applyRewardUpgrade(stats,id),'known new-cadence reward is handled');near(stats[key],expected[key],id+' gets the agreed stronger increment');
}
for(const [id,key,limit]of [['multi','multi',8],['fire','fire',999],['poison','poison',999],['ice','ice',3],['pierce','pierce',3],['leech','leech',.6],['crit','crit',.75]]){
 const stats=base();for(let i=0;i<600;i++)applyRewardUpgrade(stats,id);
 near(stats[key],limit,id+' is capped through repeated rewards');
 ok(rewardUpgradePreview(stats,id).includes('上限'),id+' capped preview does not promise another increase');
 const legacy={...base(),[key]:limit+1};applyRewardUpgrade(legacy,id);near(legacy[key],limit+1,id+' reward does not reduce an older higher value');
}
for(const id of RETIRED_RELICS){
 const stats=base();ok(!applyRewardUpgrade(stats,id),'retired reward returns control to legacy handler');eq(stats,base(),'retired reward does not change stats inside the new module');
 eq(rewardUpgradePreview(stats,id),null,'retired reward has no new-cadence preview');
}
ok(rewardUpgradePreview({...base(),fire:2},'fire').includes('2 → 4'),'fire preview shows two-rank gain');
ok(rewardUpgradePreview({...base(),poison:3},'poison').includes('3 → 5'),'poison preview shows two-rank gain');
ok(rewardUpgradePreview(base(),'vital').includes('100 → 140')&&rewardUpgradePreview(base(),'vital').includes('回复40'),'vital preview matches new capacity and heal contract');
ok(rewardUpgradePreview(base(),'pierce').includes('返还1发'),'pierce preview includes its actual cover refund hook');
for(const r of NEW_RELICS){const stats=base();ok(applyRewardUpgrade(stats,r.id),'new-cadence handler delegates new relic');eq(stats[r.id],1,'delegation grants one new relic rank');}
const invalid=base();ok(!applyRewardUpgrade(invalid,'unknown'),'unknown reward is rejected');eq(invalid,base(),'unknown reward is inert');eq(rewardUpgradePreview(base(),'unknown'),null,'unknown reward has no preview');
console.log(checks+' pure relic definitions, reward increments, caps, previews and fuse-packet checks passed.');
