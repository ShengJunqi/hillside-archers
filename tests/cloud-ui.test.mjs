import assert from 'node:assert/strict';
import fs from 'node:fs';
import {setupCloudAccount} from '../dist/cloud-ui.mjs';
import {validSave} from '../dist/core.mjs';

let checks=0;
const ok=(value,label)=>{assert.ok(value,label);checks++;};
const equal=(value,expected,label)=>{assert.deepEqual(value,expected,label);checks++;};
class Control {
  constructor(){this.hidden=false;this.value='';this.textContent='';this.disabled=false;this.listeners={};this.dataset={};}
  setAttribute(key,value){this[key]=value;}
  addEventListener(name,fn){this.listeners[name]=fn;}
  focus(){document.activeElement=this;}
  click(){if(!this.disabled)return this.onclick?.();}
  submit(){this.listeners.submit({preventDefault(){}});}
}
const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const controls=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(match=>[match[1],new Control()]));
const el=id=>controls.get(id);
const prior={document:globalThis.document,window:globalThis.window};
globalThis.document={getElementById:el,documentElement:{dataset:{}},activeElement:null};
const events={};globalThis.window={addEventListener:(name,fn)=>{events[name]=fn;}};
const memory=new Map();const storage={getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value)};
let local=validSave({unlocked:true,best:6,embers:9}),session=null,remote=null,sent,token,readCount=0,loadCount=0,listener,failSignOut=false;
const user={id:'ui-user',email:'player@example.test'};
const sdk={
  auth:{onAuthStateChange:fn=>{listener=fn;}},
  session:async()=>session,
  async password(email,password){
    if(password!=='Correct123')throw Error('Invalid credentials');
    session={user};listener('SIGNED_IN',session);return {session};
  },
  async send(mode,email,password){
    sent={mode,email,password};
    return async code=>{token=code;session={user};listener('SIGNED_IN',session);return {session};};
  },
  async signOut(){if(failSignOut)throw Error('Sign-out unavailable');session=null;listener('SIGNED_OUT',null);},
  backend:()=>({
    read:async()=>{readCount++;return remote;},
    write:async(revision,progress)=>{remote={revision:revision+1,progress};return {status:'saved',...remote};},
  }),
};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const account=setupCloudAccount({storage,getSave:()=>local,applySave:p=>{local=p;},atCamp:()=>true,beforeOpen:()=>{},loadClient:async()=>{loadCount++;return sdk;}});
try {
  equal(loadCount,0,'new guests do not contact CloudBase at startup');
  el('accountHome').click();await settle();
  ok(!el('accountPanel').hidden,'camp opens the account dialog');
  equal(loadCount,1,'the online client is initialized on demand');
  equal(readCount,0,'opening login does not read private progress');
  el('accountEmail').value='player@example.test';el('accountPassword').value='wrong';
  el('accountForm').submit();await settle();
  equal(el('accountMessage').textContent,'Invalid credentials','real auth error reaches the form');
  equal(readCount,0,'failed login does not reach private saves');

  el('authregister').click();el('accountPassword').value='Correct123';
  el('accountForm').submit();await settle();
  equal(sent,{mode:'register',email:'player@example.test',password:'Correct123'},'the registration form sends the active inputs');
  ok(!el('accountCodeLabel').hidden,'registration exposes the code verification step');
  ok(el('accountEmail').readOnly,'verification stays attached to the original mailbox');
  el('accountCode').value='123456';el('accountForm').submit();await settle();
  equal(token,'123456','the submitted code reaches the returned verification callback');
  ok(!el('accountMember').hidden&&el('accountGuest').hidden,'verified login updates the visible dialog');
  ok(!el('accountChoice').hidden,'first login offers an explicit progress choice');
  equal(local.embers,9,'login leaves existing progress intact');
  el('keepLocal').click();await settle();
  equal(remote.progress.best,6,'the actual confirmation button uploads local progress');
  equal(el('accountSyncStatus').textContent,'永久进度已同步','only a server acknowledgement shows synced');
  equal(el('accountPassword').value,'','successful login clears the password field');
  ok([...memory.values()].every(value=>!value.includes('Correct123')),'application metadata never stores passwords');

  el('accountSignOut').click();await settle();
  ok(el('accountMember').hidden,'sign-out removes account controls');
  equal(local.best,6,'sign-out preserves local progress');
  el('authreset').click();el('accountPassword').value='NewPassword123';
  el('accountForm').submit();await settle();
  equal(sent.mode,'register','cooldown prevents changing mode to bypass the send limit');
  let prevented=false;
  ok(account.key({key:'Escape',preventDefault(){prevented=true;}}),'account dialog captures game keyboard shortcuts');
  ok(prevented&&el('accountPanel').hidden,'Escape closes the dialog');
  account.dispose();

  const recovery=setupCloudAccount({storage,getSave:()=>local,applySave:p=>{local=p;},atCamp:()=>true,beforeOpen:()=>{},loadClient:async()=>sdk});
  el('accountHome').click();await settle();el('authreset').click();
  el('accountEmail').value='player@example.test';el('accountPassword').value='NewPassword123';
  el('accountForm').submit();await settle();
  equal(sent,{mode:'reset',email:'player@example.test',password:'NewPassword123'},'forgot-password form sends the new password to the SDK adapter');
  el('accountCode').value='654321';el('accountForm').submit();await settle();
  equal(token,'654321','forgot-password verification is wired to the active form');
  ok(!el('accountMember').hidden,'password recovery restores the account controls');
  failSignOut=true;el('accountSignOut').click();await settle();
  ok(!el('accountMember').hidden,'failed sign-out restores the actual SDK session');
  equal(el('accountMessage').textContent,'Sign-out unavailable','sign-out failure is visible');
  failSignOut=false;el('accountSignOut').click();await settle();recovery.dispose();

  const login=setupCloudAccount({storage,getSave:()=>local,applySave:p=>{local=p;},atCamp:()=>true,beforeOpen:()=>{},loadClient:async()=>sdk});
  el('accountHome').click();await settle();
  el('accountEmail').value='player@example.test';el('accountPassword').value='Correct123';
  el('accountForm').submit();await settle();
  ok(!el('accountMember').hidden,'password-login submit reaches the signed-in screen');
  el('accountSignOut').click();await settle();el('authotp').click();
  ok(el('accountPasswordLabel').hidden,'code-only login does not require a password');
  el('accountForm').submit();await settle();equal(sent.mode,'otp','OTP login uses the active code-login mode');
  el('accountCode').value='987654';el('accountForm').submit();await settle();
  equal(token,'987654','OTP-login form verifies the returned code');
  ok(!el('accountMember').hidden,'OTP login restores the signed-in screen');
  el('accountSignOut').click();await settle();login.dispose();

  // Offline build must not initialize the SDK, even when linked metadata exists.
  document.documentElement.dataset.offline='true';
  const offline=setupCloudAccount({storage,getSave:()=>local,applySave:()=>{throw Error('offline overwrite');},atCamp:()=>true,beforeOpen:()=>{},loadClient:()=>{throw Error('offline network request');}});
  el('accountHome').click();
  ok(el('accountGuest').hidden,'offline version has no nonfunctional login form');
  ok(el('accountMessage').textContent.includes('离线版'),'offline version explains how to use the online account feature');
  equal(local.embers,9,'offline account window does not alter progress');
  offline.dispose();
  console.log(checks+' account-form event and offline-dialog checks passed (DOM adapter; not browser QA).');
} finally {
  account.dispose();globalThis.document=prior.document;globalThis.window=prior.window;
}
