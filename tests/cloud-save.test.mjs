import assert from 'node:assert/strict';
import {validSave} from '../dist/core.mjs';
import {CloudProgress,CLOUD_META_KEY,CLOUD_BACKUP_KEY,reconcileCloudProgress,cloudRecord} from '../dist/cloud-save.mjs';
import {cloudClient} from '../dist/cloud-client.mjs';

let checks = 0;
const equal = (a,b,label) => {assert.deepEqual(a,b,label); checks++;};
const ok = (a,label) => {assert.ok(a,label); checks++;};
const user = {id:'account-a',email:'player@example.test'};
const storage = () => {const map = new Map();return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)};};
function setup(progress = {}, memory = storage()) {
  let local = validSave(progress), remote = null, writes = 0, applications = 0, camp = true;
  let lastId, gate, failAfterCommit = false;
  const backend = {
    read:async()=>structuredClone(remote),
    async write(revision, progress, id) {
      writes++;
      if (gate) {const pending=gate;gate=null;await pending;}
      if (id === lastId) return {...structuredClone(remote),status:'saved'};
      if (revision !== (remote?.revision||0)) return {status:'conflict',...(structuredClone(remote)||{revision:0,progress:null})};
      lastId=id;remote={revision:revision+1,progress:structuredClone(progress)};
      if (failAfterCommit) {failAfterCommit=false;throw Error('connection lost after commit');}
      return {status:'saved',...structuredClone(remote)};
    },
  };
  const make = () => new CloudProgress({storage:memory,getSave:()=>local,applySave:p=>{applications++;local=p;},atCamp:()=>camp});
  return {backend,memory,make,get local(){return local;},set local(p){local=validSave(p);},get remote(){return remote;},set remote(r){remote=structuredClone(r);},get writes(){return writes;},get applications(){return applications;},set camp(v){camp=v;},set gate(v){gate=v;},set failAfterCommit(v){failAfterCommit=v;}};
}

const local = validSave({embers:0,bow:5,best:30,unlocked:true});
const remote = validSave({embers:18,bow:1,life:2,targetBest:200});
let merged = reconcileCloudProgress(local,remote,'cloud');
equal([merged.embers,merged.bow,merged.life],[18,1,2],'cloud wallet and purchases stay together');
equal([merged.best,merged.targetBest,merged.unlocked],[30,200,true],'records and unlocks combine');
merged = reconcileCloudProgress(local,remote,'local');
equal([merged.embers,merged.bow,merged.life],[0,5,0],'local economy is selected as a whole');
equal(reconcileCloudProgress(merged,remote,'local').embers,0,'reconciliation does not duplicate currency');
assert.throws(()=>cloudRecord({revision:-1,progress:local}));checks++;
assert.throws(()=>cloudRecord({revision:1,progress:{...local,version:3}}));checks++;

// Initial linking is an explicit choice, including an entirely new save.
let f=setup(), sync=f.make();
await sync.connect(user,f.backend);
equal(sync.phase,'choice','a new login does not silently attach local progress');
equal(f.writes,0,'no cloud upload before confirmation');
await sync.choose('local');
equal(f.remote.revision,1,'even default progress creates a real first save');
equal(f.applications,0,'uploading does not reset an ongoing game');
await sync.refresh();equal(f.writes,1,'identical progress avoids extra writes');

// Progress earned during a slow save is uploaded in the following revision.
f.local={...f.local,embers:3};
let release;f.gate=new Promise(resolve=>{release=resolve;});
const saving=sync.flush();
await Promise.resolve();f.local={...f.local,embers:6,best:4};release();await saving;
equal([f.remote.revision,f.remote.progress.embers,f.remote.progress.best],[3,6,4],'in-flight rewards are not lost');
equal(f.applications,0,'network acknowledgements do not replace live progress');

// A committed request whose reply was lost is replayed exactly after reload.
f.local={...f.local,embers:8};f.failAfterCommit=true;
await sync.flush();equal(sync.phase,'error','offline error leaves a retryable state');
ok(JSON.parse(f.memory.getItem(CLOUD_META_KEY)).pending,'request id is stored before the network call');
const revision=f.remote.revision;
sync=f.make();await sync.connect(user,f.backend);
equal(f.remote.revision,revision,'reload retry does not apply the same request twice');
equal(sync.phase,'synced','recovered request is acknowledged');
equal(JSON.parse(f.memory.getItem(CLOUD_META_KEY)).pending,null,'acknowledged retry record is cleared');

// Two devices changed progress from the same base: no automatic wallet merge.
f.local={...f.local,embers:2,bow:2,best:20};
f.remote={revision:revision+1,progress:validSave({embers:12,bow:1,life:3,best:9})};
const writes=f.writes;await sync.flush();
equal(sync.phase,'choice','a stale revision requires a decision');
equal(f.local.embers,2,'conflict preserves local progress');
f.camp=false;await sync.choose('cloud');
equal(sync.phase,'choice','cannot replace a save during a match');
equal(f.writes,writes+1,'conflict choice in a match performs no write');
f.camp=true;await sync.choose('cloud');
equal([f.local.embers,f.local.bow,f.local.life,f.local.best],[12,1,3,20],'chosen wallet and combined records are applied');
equal(JSON.parse(f.memory.getItem(CLOUD_BACKUP_KEY))[0].progress.embers,2,'replaced local progress has a recoverable backup');
equal(f.remote.progress.embers,12,'server stores the chosen balance, not the maximum of two purchases');

// An unchanged device can pull a newer cloud revision, but only in camp.
f.remote={revision:f.remote.revision+1,progress:validSave({...f.local,embers:25,best:32})};
f.camp=false;await sync.refresh();equal(sync.phase,'waiting','remote update waits until camp');
equal(f.local.embers,12,'current match keeps its progress');
f.camp=true;await sync.refresh();equal(f.local.embers,25,'camp applies newer progress');

// A late response after sign-out cannot rebind the old user or overwrite data.
f.local={...f.local,embers:26};f.gate=new Promise(resolve=>{release=resolve;});
const late=sync.flush();await Promise.resolve();sync.disconnect();release();await late;
equal(sync.user,null,'late acknowledgement does not log the old account back in');
equal(sync.phase,'guest','sign-out remains authoritative');
equal(f.local.embers,26,'sign-out retains local progress');

const blocked={getItem:()=>null,setItem:()=>{throw Error('storage blocked');}};
f=setup({best:10},blocked);sync=f.make();await sync.connect(user,f.backend);await sync.choose('local');
equal(f.writes,0,'unrecoverable revision metadata prevents cloud writes');
equal(f.local.best,10,'blocked storage never clears local progress');
equal(sync.phase,'error','blocked storage is reported');

// The adapter must use real sessions and OTP callbacks from the SDK result.
let session=null,readCount=0,sent,verified,credentials;
const auth={
  getSession:async()=>({data:{session}}),
  signInWithPassword:async args=>{credentials=args;return {data:{session:args.password==='correct'?{user}:null}};},
  signUp:async args=>{sent=args;return {data:{verifyOtp:async args=>{verified=args;return {data:{session:{user}}};}}};},
  signOut:async()=>({data:{}}),
};
const fakeDb={from:()=>{readCount++;return {select:()=>({eq:()=>({limit:async()=>({data:[]})})})};}};
const client=cloudClient({auth,rdb:()=>fakeDb});
await assert.rejects(()=>client.backend(user.id).read());checks++;
equal(readCount,0,'publishable key without login never reaches private data');
session={user:{...user,is_anonymous:true}};
await assert.rejects(()=>client.backend(user.id).read());checks++;
session={user:{id:'different-account'}};
await assert.rejects(()=>client.backend(user.id).read());checks++;
session={user};await client.backend(user.id).read();equal(readCount,1,'real expected session unlocks the read');
await assert.rejects(()=>client.password('mail@example.test','wrong'));checks++;
await client.password('  archer_01  ','correct');
equal(credentials,{username:'archer_01',password:'correct'},'plain account identifiers use the username login API');
await client.password('mail@example.test','correct');
equal(credentials,{email:'mail@example.test',password:'correct'},'existing email accounts retain password login');
const verify=await client.register('mail@example.test','Correct123','archer_01');await verify('123456');
equal(sent,{email:'mail@example.test',password:'Correct123',username:'archer_01'},'verified registration binds the selected username');
equal(verified,{token:'123456'},'registration verification calls the bound SDK closure');
console.log(checks+' cloud-save, retry, conflict, account-isolation and auth-adapter checks passed.');
