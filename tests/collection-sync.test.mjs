import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Game,validSave} from '../dist/core.mjs';
import {AUTHOR_CODE,validCollection} from '../dist/collection.mjs';
import {encodeProgress,decodeProgress,mergeProgress} from '../dist/save-transfer.mjs';
import {CloudProgress,CLOUD_META_KEY,reconcileCloudProgress,cloudRecord,progressSummary} from '../dist/cloud-save.mjs';
let checks=0;
const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const ok=(value,label)=>{assert.ok(value,label);checks++;};
const profile=overrides=>validCollection({revision:4,tokens:0,stats:{wins:1,heads:10},claimed:['first_win','ten_heads'],owned:['skin_sunset'],skin:'skin_sunset',...overrides});
const legacy=validSave({unlocked:true,checkpoint:3,best:6,targetBest:500,embers:7,bow:1,life:2});
const local=validSave({...legacy,collection:profile({revision:9,tokens:0})});
const newer=validSave({...legacy,best:12,collection:profile({revision:10,tokens:2,owned:['skin_night'],skin:'skin_night'})});
const copy=value=>structuredClone(value);

ok(!('collection' in legacy),'an old v2 save stays an old v2 save without fabricated purchases');
eq(decodeProgress(encodeProgress(legacy)),legacy,'legacy HA2 remains compatible');
eq(decodeProgress(encodeProgress(local)),local,'collection wallet, claims and selection round-trip in HA2');
eq(mergeProgress(local,newer).collection,newer.collection,'manual import chooses the higher-revision whole collection');
eq(mergeProgress(newer,local).collection,newer.collection,'older import cannot refund spent style tokens');
eq(mergeProgress(mergeProgress(local,newer),newer),mergeProgress(local,newer),'repeated collection import is idempotent');
const tie=validSave({...newer,collection:profile({revision:9,tokens:4,owned:['skin_night'],skin:'skin_night'})});
eq(mergeProgress(local,tie).collection,local.collection,'equal-revision different purchases preserve the current whole wallet');
eq(mergeProgress(legacy,local).collection,local.collection,'new collection can be imported into a legacy browser');
eq(mergeProgress(local,legacy).collection,local.collection,'legacy imports do not erase a known collection');
const currentText=JSON.stringify(local),incomingText=JSON.stringify(newer);
mergeProgress(local,newer);eq(JSON.stringify(local),currentText,'import never mutates current profile input');eq(JSON.stringify(newer),incomingText,'import never mutates incoming profile input');
for(const choice of ['local','cloud']){
 const reconciled=reconcileCloudProgress(local,newer,choice);
 eq(reconciled.collection,(choice==='local'?local:newer).collection,'cloud choice selects collection wallet/purchases together: '+choice);
 eq(reconciled.best,12,'separate records still merge: '+choice);
 ok(reconciled.collection.owned.length===1,'cloud reconciliation never unions two paid inventories');
}
eq(reconcileCloudProgress(legacy,newer,'local').collection,newer.collection,'legacy local choice preserves one known cloud collection');
eq(reconcileCloudProgress(local,legacy,'cloud').collection,local.collection,'legacy cloud choice preserves one known local collection');
eq(cloudRecord({revision:3,progress:newer}).progress,newer,'cloud reads retain the canonical collection');
ok(progressSummary(local).includes('风格券 0')&&progressSummary(local).includes('已购 1'),'cloud choice summary exposes style currency and inventory');

function memory(){const map=new Map();return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)};}
function fixture({current=legacy,remoteProgress=local,revision=5,pending=null,atCamp=true}={}){
 let currentSave=copy(current),row={revision,progress:copy(remoteProgress)},writes=0,applications=0,camp=atCamp;
 const storage=memory(),oldBaseline=copy(legacy),requestId=pending?.requestId||null;
 storage.setItem(CLOUD_META_KEY,JSON.stringify({userId:'collection-account',revision:pending?revision-1:revision,baseline:oldBaseline,pending}));
 const payloads=[];
 const backend={read:async()=>copy(row),write:async(expected,progress,id)=>{
  writes++;payloads.push(copy(progress));if(writes>3)throw Error('Unexpected repeated preservation upload');
  if(pending&&id===requestId)return {status:'saved',...copy(row)};
  if(expected!==row.revision)return {status:'conflict',...copy(row)};
  const next=copy(progress);
  if(!next.collection&&row.progress.collection)next.collection=copy(row.progress.collection);
  row={revision:row.revision+1,progress:next};return {status:'saved',...copy(row)};
 }};
 const sync=new CloudProgress({storage,getSave:()=>currentSave,applySave:progress=>{currentSave=copy(progress);applications++;},atCamp:()=>camp,requestId:()=> 'collection-request-000001'});
 return {sync,backend,storage,payloads,get current(){return currentSave;},get row(){return row;},get writes(){return writes;},get applications(){return applications;},set camp(value){camp=value;}};
}
{
 const f=fixture();await f.sync.connect({id:'collection-account'},f.backend);
 eq(f.current.collection,local.collection,'same-revision legacy browser metadata adopts the complete known cloud collection');
 eq(f.writes,0,'legacy field restoration does not create a save-upload loop');
 eq(f.applications,1,'legacy field is applied once at camp');eq(f.sync.phase,'synced','upgraded legacy metadata reaches a terminal synced state');f.sync.disconnect();
}
{
 const f=fixture({current:{...legacy,best:8}});await f.sync.connect({id:'collection-account'},f.backend);
 eq(f.writes,1,'new local records plus legacy omission require exactly one upload');
 eq(f.row.progress.collection,local.collection,'legitimate new progress retains the complete collection');eq(f.row.progress.best,8,'legacy profile upgrade never drops newly earned local records');f.sync.disconnect();
}
{
 const f=fixture({atCamp:false});await f.sync.connect({id:'collection-account'},f.backend);
 eq(f.sync.phase,'waiting','collection migration waits until camp');eq(f.applications,0,'collection migration does not change ongoing skin/talent state');eq(f.writes,0,'waiting never uploads an omission');
 f.camp=true;await f.sync.refresh();eq(f.current.collection,local.collection,'camp safely completes legacy collection restoration');eq(f.writes,0,'camp restoration still avoids an upload loop');f.sync.disconnect();
}
{
 const pending={revision:5,progress:copy(legacy),requestId:'old-client-retry-000001'};
 const f=fixture({revision:6,pending});await f.sync.connect({id:'collection-account'},f.backend);
 eq(f.writes,1,'a committed legacy request replays once');ok(!f.payloads[0].collection,'pending request payload remains exact instead of rewriting its idempotency packet');
 eq(f.row.revision,6,'lost-reply recovery does not apply a second debit or revision');eq(f.current.collection,local.collection,'lost-reply recovery retains cloud collection');eq(f.sync.phase,'synced','legacy retry finishes without recursive uploads');f.sync.disconnect();
}

// Exercise the actual constructor and permanent-save adapter. Unlike plain
// protocol fixtures, Game eagerly claims eligible records from a legacy save.
const paidCollection=validCollection({revision:19,tokens:0,stats:{wins:10,heads:10,casts:10,covers:20,bosses:3},claimed:['first_win','ten_heads','ten_casts','breaker','expedition6','target500'],owned:['skin_sunset','skin_night','talent_quiver'],skin:'skin_night',talent:'talent_quiver'});
function gameFixture({save=legacy,remoteProgress={...legacy,collection:paidCollection},revision=5,pending=null}={}){
 const game=new Game({save,rng:()=>.5}),storage=memory(),payloads=[],requests=[];
 let row={revision,progress:validSave(remoteProgress)},hold=null;
 storage.setItem(CLOUD_META_KEY,JSON.stringify({userId:'game-account',revision:pending?revision-1:revision,baseline:copy(save),pending}));
 const backend={read:async()=>copy(row),write:async(expected,progress,requestId)=>{
  payloads.push(copy(progress));requests.push({expected,requestId});if(payloads.length>3)throw Error('Unexpected repeated actual-Game upload');
  if(hold)await hold;
  if(pending&&requestId===pending.requestId)return {status:'saved',...copy(row)};
  if(expected!==row.revision)return {status:'conflict',...copy(row)};
  const next=copy(progress);if(!next.collection&&row.progress.collection)next.collection=copy(row.progress.collection);
  row={revision:row.revision+1,progress:next};return {status:'saved',...copy(row)};
 }};
 const sync=new CloudProgress({storage,getSave:()=>game.permanentSave,applySave:progress=>game.applyPermanentSave(progress),atCamp:()=>game.phase==='home'&&!game.authorMode,requestId:()=> 'actual-game-request-000001'});
 return {game,sync,backend,payloads,requests,get row(){return row;},set row(value){row=copy(value);},set hold(value){hold=value;}};
}
{
 const f=gameFixture();
 eq(f.game.collection.claimed,['expedition6','target500'],'actual Game constructor claims old records before cloud connection');
 await f.sync.connect({id:'game-account'},f.backend);
 eq(f.game.collection,paidCollection,'generated-only legacy collection adopts the entire paid cloud bundle');
 eq(f.row.progress.collection,paidCollection,'constructor rewards cannot erase existing cloud purchases or refund spent tokens');
 eq(f.payloads.length,0,'same-revision paid collection restoration needs no upload');eq(f.sync.phase,'synced','actual Game legacy upgrade terminates without a flush loop');f.sync.disconnect();
}
{
 const withoutTarget=validCollection({...paidCollection,claimed:paidCollection.claimed.filter(id=>id!=='target500')});
 const f=gameFixture({remoteProgress:{...legacy,targetBest:0,collection:withoutTarget}});await f.sync.connect({id:'game-account'},f.backend);
 eq(f.game.collection.owned,paidCollection.owned,'new record reward keeps existing cloud purchases whole');
 eq(f.game.collection.tokens,4,'only the genuinely unclaimed target record reward is granted');
 eq(f.game.collection.revision,20,'new record reward advances the selected collection once');
 eq(f.payloads.length,1,'new record plus its legitimate claim uploads exactly once');eq(f.row.progress.targetBest,500,'new local record survives collection restoration');f.sync.disconnect();
}
for(const change of ['gameplay','purchase']){
 const f=gameFixture();
 if(change==='gameplay')f.game.recordStyle('heads');
 else {f.game.recordStyle('wins');ok(f.game.buyCollection('skin_sunset'),'fixture makes a real local purchase before reconnect');}
 const before=copy(f.game.permanentSave);await f.sync.connect({id:'game-account'},f.backend);
 eq(f.sync.phase,'choice','substantive local '+change+' requires an explicit whole-collection choice');
 eq(f.payloads.length,0,'substantive local '+change+' cannot automatically overwrite paid cloud data');
 eq(f.game.permanentSave,before,'choice preserves the real local '+change+' snapshot');eq(f.row.progress.collection,paidCollection,'choice preserves paid remote data before selection');
 await f.sync.choose('local');eq(f.row.progress.collection,before.collection,'explicit local choice keeps its wallet and inventory together: '+change);
 eq(f.payloads.length,1,'explicit '+change+' choice uploads only its selected snapshot');f.sync.disconnect();
}
{
 const f=gameFixture();f.game.start('duel');await f.sync.connect({id:'game-account'},f.backend);
 eq(f.sync.phase,'waiting','actual Game constructor migration still waits for camp');eq(f.payloads.length,0,'ongoing combat cannot upload an autogenerated replacement collection');
 f.game.goHome();await f.sync.refresh();eq(f.game.collection,paidCollection,'returning to camp inherits the full paid collection');eq(f.payloads.length,0,'camp adoption has no flush loop');f.sync.disconnect();
}
{
 const pending={revision:5,progress:copy(legacy),requestId:'actual-legacy-lost-reply-000001'};
 const f=gameFixture({revision:6,pending});await f.sync.connect({id:'game-account'},f.backend);
 eq(f.payloads,[pending.progress],'actual Game legacy retry preserves the exact original pending payload');
 eq(f.requests,[{expected:5,requestId:pending.requestId}],'pending revision and idempotency key remain unchanged');
 eq(f.game.collection,paidCollection,'legacy retry restores purchases instead of constructor-only rewards');eq(f.row.revision,6,'committed retry does not apply a second transaction');eq(f.sync.phase,'synced','actual Game pending retry settles without a flush loop');f.sync.disconnect();
}
{
 const normal=validSave({unlocked:true,embers:7}),f=gameFixture({save:normal,remoteProgress:normal});await f.sync.connect({id:'game-account'},f.backend);
 let release;f.hold=new Promise(resolve=>release=resolve);f.game.save.embers=9;const flight=f.sync.flush();
 eq(f.payloads.length,1,'a genuine permanent write starts before practice');
 f.game.enterAuthorMode(AUTHOR_CODE);f.game.save.best=99;f.game.save.embers=9999;f.game.save.names=['练习','练习'];f.game.persist();release();await flight;f.hold=null;
 eq(f.payloads.length,1,'entering practice during a pending write cannot cause another upload');
 eq(f.payloads[0].embers,9,'in-flight request retains its genuine wallet');eq(f.payloads[0].best,0,'in-flight request excludes assisted records');
 eq(f.game.permanentSave.embers,9,'cloud-facing backup excludes the practice wallet');eq(f.game.permanentSave.best,0,'cloud-facing backup excludes practice records');
 f.row={revision:f.row.revision+1,progress:validSave({...f.row.progress,embers:11})};await f.sync.refresh();
 eq(f.sync.phase,'waiting','background remote update waits while author practice is active');
 f.game.exitAuthorMode();await f.sync.refresh();eq(f.game.save.embers,11,'leaving practice restores the latest remote permanent wallet');eq(f.game.save.best,0,'leaving practice never restores assisted records');eq(f.payloads.length,1,'remote update does not upload the practice copy');f.sync.disconnect();
}

// Structural migration checks are not execution of PostgreSQL. Live PG rollback
// checks are recorded separately only after an authenticated management session.
const sql=fs.readFileSync(new URL('../cloudbase/migrations/20261116050000_collection_profiles.sql',import.meta.url),'utf8');
for(const fragment of ['BEGIN;','COMMIT;','CREATE OR REPLACE FUNCTION public.archer_collection_valid(profile jsonb)','CREATE OR REPLACE FUNCTION public.archer_save(expected_revision bigint, new_progress jsonb, request_id text)',"'collection'",'public.archer_collection_valid(new_progress',"NOT (payload ? 'collection') AND saved.progress ? 'collection'","jsonb_build_object('collection', saved.progress->'collection')",'FOR UPDATE','saved.last_request_id = request_id','saved.revision <> expected_revision',"auth.role() <> 'authenticated'",'is_anonymous','octet_length(payload::text) > 8192','revision = revision + 1','REVOKE ALL ON FUNCTION public.archer_save(bigint,jsonb,text) FROM PUBLIC, anon, authenticated;'])ok(sql.includes(fragment),'migration keeps required guard: '+fragment);
for(const key of ['first_win','ten_heads','ten_casts','breaker','expedition6','target500','skin_sunset','skin_night','skin_storm','skin_meteor','talent_quiver','talent_breach'])ok(sql.includes("'"+key+"'"),'migration bounds collection ID: '+key);
ok(!/DROP\s+(TABLE|POLICY)|DISABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(sql),'migration does not remove tables or ownership isolation');
const accountGuard=fs.readFileSync(new URL('../cloudbase/migrations/20261109170600_guard_save_account.sql',import.meta.url),'utf8');
ok(accountGuard.includes('expected_owner IS DISTINCT FROM auth.uid()'),'account wrapper still verifies expected owner');
console.log(checks+' collection HA2, whole-wallet, legacy-cloud, pending-retry and SQL-guard checks passed (SQL structural checks only).');
