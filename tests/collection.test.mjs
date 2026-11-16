import assert from 'node:assert/strict';
import {ACHIEVEMENTS,COLLECTION_ITEMS,AUTHOR_CODE,validCollection,hasCollectionData,collectionBalance,collectionSummary,skinById,talentById,achievementProgress,claimCollection,recordCollection,recordCollectionResult,purchaseCollection,equipCollection,makePracticeCollection} from '../dist/collection.mjs';

let checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);checks++;};
const text=value=>JSON.stringify(value);
const fresh=()=>validCollection();

eq(fresh(),{version:1,revision:0,tokens:0,stats:{wins:0,heads:0,casts:0,covers:0,bosses:0},claimed:[],owned:[],skin:'base',talent:'none'},'a new player has no earned or purchased resources');
for(const input of [undefined,null,false,7,'collection',[],{version:2,tokens:900}])eq(validCollection(input),fresh(),'invalid or incompatible profile keeps safe default');
ok(!hasCollectionData(fresh()),'empty optional collection can be omitted from old v2 saves');
eq(COLLECTION_ITEMS.length,6,'four real skins and two talents are available');eq(ACHIEVEMENTS.length,6,'six one-time milestones are defined');

{
 const raw={version:1,revision:1e20,tokens:90000,stats:{wins:-7,heads:13.9,casts:Infinity,covers:1e20,bosses:4,admin:999},claimed:['target500','bad','first_win','first_win'],owned:['talent_breach','skin_night','skin_night','invalid'],skin:'skin_storm',talent:'talent_breach',admin:true};
 const before=text(raw),c=validCollection(raw);
 eq(c.revision,1e9,'revision has a bounded storage range');eq(c.tokens,9999,'wallet is bounded');
 eq(c.stats,{wins:0,heads:13,casts:0,covers:999999,bosses:4},'only bounded known counters survive');
 eq(c.claimed,['first_win','target500'],'claims are known, unique and canonical');eq(c.owned,['skin_night','talent_breach'],'purchases are known, unique and canonical');
 eq(c.skin,'base','unowned skin cannot be equipped');eq(c.talent,'talent_breach','an owned talent is retained');
 eq(Object.keys(c),['version','revision','tokens','stats','claimed','owned','skin','talent'],'unexpected profile keys are discarded');eq(text(raw),before,'validation never mutates the source snapshot');
 const inherited=Object.create({tokens:400,revision:30,skin:'skin_night',owned:['skin_night'],stats:{wins:20}});
 eq(validCollection(inherited),fresh(),'inherited fields cannot create money, unlocks or stats');
 const polluted=JSON.parse('{"version":1,"__proto__":{"polluted":true},"stats":{"__proto__":{"wins":99}}}');
 eq(validCollection(polluted),fresh(),'prototype-like JSON keys are ignored');eq({}.polluted,undefined,'normalization never pollutes Object.prototype');
}

// Achievements mint only once and never through a validation/read operation.
{
 const raw={...fresh(),stats:{...fresh().stats,wins:1,heads:10,casts:10,covers:20}};
 eq(validCollection(raw).tokens,0,'normalizing earned stats does not silently mint money');
 const before=text(raw),first=claimCollection(raw,{best:6,targetBest:500});
 eq(first.awards.map(a=>a.id),ACHIEVEMENTS.map(a=>a.id),'all qualified milestones are claimed exactly once');
 eq(first.profile.tokens,24,'six milestone awards total24 style tokens');eq(first.profile.revision,1,'one claim transaction increments revision once');
 eq(text(raw),before,'claim does not mutate prior progress');
 const again=claimCollection(first.profile,{best:99,targetBest:9000});
 eq(again.awards,[],'higher records cannot re-award an already claimed milestone');eq(again.profile,first.profile,'repeated claim is idempotent');
 for(const definition of ACHIEVEMENTS){const progress=achievementProgress(first.profile,{best:6,targetBest:500},definition);ok(progress.completed&&progress.claimed&&progress.ratio===1,'completed milestone reports claimed progress: '+definition.id);}
 eq(achievementProgress(fresh(),{},'unknown'),{value:0,target:0,completed:false,claimed:false,ratio:0},'unknown milestone has no progress or reward');
 const partial=achievementProgress(recordCollection(fresh(),'heads',7),{},'ten_heads');eq([partial.value,partial.target,partial.ratio],[7,10,.7],'partial progress is displayed without marking a claim');
}

// Actual event counters grant resources atomically and produce immutable copies.
{
 const initial=fresh(),snapshot=text(initial),win=recordCollectionResult(initial,'wins');
 eq(win.awards.map(a=>a.id),['first_win'],'the first real win grants its single milestone');eq(win.profile.tokens,3,'first win finances the first skin');eq(win.profile.revision,1,'counter+claim share one revision');
 eq(text(initial),snapshot,'recording an event leaves earlier snapshot intact');
 const next=recordCollection(win.profile,'wins');eq(next.stats.wins,2,'additional wins still count');eq(next.tokens,3,'ordinary repeat wins do not generate free shop currency');eq(next.revision,2,'each real progress transaction advances revision');
 const bosses=recordCollection(next,'bosses',2);eq(bosses.tokens,5,'each real boss win grants one recurring style token');eq(bosses.stats.bosses,2,'boss reward and counter stay together');
 const capped={...bosses,tokens:9999,stats:{...bosses.stats,bosses:999999}};
 eq(recordCollection(capped,'bosses',99),capped,'already-capped boss count cannot re-mint currency');
 for(const amount of [0,-1,NaN,Infinity])eq(recordCollection(next,'casts',amount),next,'invalid/non-positive amount cannot advance progress');
 eq(recordCollection(next,'admin',999),next,'unrecognized event kind cannot change the wallet');
 const heads=recordCollection(next,'heads',10);eq(heads.tokens,7,'a new milestone adds its award to the current wallet');
 eq(collectionBalance(heads),7,'wallet accessor is read-only');ok(collectionSummary(heads).includes('风格券 7'),'summary exposes spendable currency');ok(hasCollectionData(heads),'real progression marks the optional profile as nonempty');
}

// Gate + wallet + ownership are one purchase transaction, never max-merged.
{
 const initial=fresh(),locked=purchaseCollection({...initial,tokens:999},'skin_sunset');ok(!locked.ok&&locked.message.includes('开门一箭'),'currency does not bypass an achievement gate');
 const earned=recordCollection(initial,'wins'),before=text(earned),buy=purchaseCollection(earned,'skin_sunset');
 ok(buy.ok,'first win can purchase the first skin');eq(buy.profile.tokens,0,'successful purchase spends the advertised cost');eq(buy.profile.owned,['skin_sunset'],'purchase receives the item once');eq(buy.profile.revision,earned.revision+1,'purchase advances snapshot revision');eq(text(earned),before,'purchase leaves the old wallet snapshot intact');
 const repeat=purchaseCollection(buy.profile,'skin_sunset');ok(!repeat.ok,'duplicate purchase is rejected');eq(repeat.profile,buy.profile,'duplicate purchase cannot charge or duplicate anything');
 const missing=purchaseCollection(buy.profile,'not_real');ok(!missing.ok,'unknown shop item rejected');eq(missing.profile,buy.profile,'unknown purchase preserves resources');
 const noMoney=claimCollection(recordCollection(buy.profile,'heads',10)).profile;eq(noMoney.tokens,4,'head milestone provides its advertised tokens');
 const rejected=purchaseCollection(noMoney,'skin_night');ok(!rejected.ok&&rejected.message.includes('1'),'insufficient-wallet rejection states the shortfall');eq(rejected.profile,noMoney,'insufficient-wallet rejection is atomic');
 const richer=recordCollection(noMoney,'bosses'),night=purchaseCollection(richer,'skin_night');ok(night.ok,'one boss reward can close the shortfall');eq(night.profile.tokens,0,'purchase cannot overdraw the wallet');
 const selected=equipCollection(night.profile,'skin_night');ok(selected.ok,'owned skin can be selected');eq(selected.profile.skin,'skin_night','skin selection stores the full catalogue itemID');eq(selected.profile.tokens,0,'equipping never spends another token');
 eq(equipCollection(selected.profile,'skin_night').profile,selected.profile,'selecting an already active item is idempotent');
 const unowned=equipCollection(selected.profile,'talent_quiver');ok(!unowned.ok,'unowned talent cannot be equipped');eq(unowned.profile,selected.profile,'failed equipment leaves snapshot untouched');
 const base=equipCollection(selected.profile,'base');ok(base.ok,'original appearance is always available');eq(base.profile.skin,'base','base choice restores character identity palette');
}

{
 const c=makePracticeCollection(fresh());
 for(const id of ['talent_quiver','talent_breach']){const selected=equipCollection(c,id);ok(selected.ok,'practice owns talent '+id);eq(selected.profile.talent,id,'talent stored independently of skin');eq(selected.profile.skin,'base','talent selection does not silently equip a skin');}
 eq(equipCollection(equipCollection(c,'talent_quiver').profile,'none').profile.talent,'none','talents can be explicitly disabled');
}

// All cosmetics provide concrete art data but never arbitrary combat modifiers.
for(const item of COLLECTION_ITEMS){
 ok(Number.isInteger(item.cost)&&item.cost>0,'item has a clear integer price: '+item.id);
 ok(ACHIEVEMENTS.some(a=>a.id===item.gate),'item has a known achievement gate: '+item.id);
 ok(Object.isFrozen(item),'catalogue entries are immutable: '+item.id);
 if(item.type==='skin'){
  eq(skinById(item.id),item,'skin resolver returns the actual palette');
  eq(Object.keys(item.palette),['cloak','fold','rim','cloth','leather','skin','hair','metal'],'skin palette includes all rendering fields');
  for(const color of [...Object.values(item.palette),item.trailColor])ok(/^#[0-9a-f]{6}$/i.test(color),'skin color is a concrete local RGB value');
  ok(!('damage' in item)&&!('maxHp' in item),'cosmetic has no hidden combat modifier');
 }else eq(talentById(item.id),item,'talent resolver returns the actual effect');
}
eq(skinById('bogus').id,'base','unknown cosmetic falls back to the original character');eq(skinById('base').palette,null,'base style does not overwrite character palettes');eq(talentById('bogus').id,'none','unknown talent is inert');

{
 const earned=recordCollection(fresh(),'wins'),before=text(earned),practice=makePracticeCollection(earned);
 eq(AUTHOR_CODE,'SHENG-ARCHER-2026','public director code is stable and documented by the caller');
 eq(practice.tokens,9999,'practice profile has a bounded test wallet');eq(practice.owned,COLLECTION_ITEMS.map(item=>item.id),'practice can inspect every shop item');eq(practice.claimed,ACHIEVEMENTS.map(a=>a.id),'practice previews all achievement states');
 eq(text(earned),before,'practice construction cannot mutate formal progression');
 ok(practice!==earned&&practice.stats!==earned.stats&&practice.owned!==earned.owned,'practice uses independent nested state');
}

console.log(checks+' collection validation, achievements, wallet transactions, catalogue, equipment and practice-copy checks passed.');
