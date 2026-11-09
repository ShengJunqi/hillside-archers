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
let local=validSave({unlocked:true,best:6,embers:9}),session=null,remote=null,sent,token,readCount=0,loadCount=0,listener,failSignOut=false,loginAccount,registrations=0;
const user={id:'ui-user',email:'player@example.test',user_metadata:{username:'archer_01'}};
const sdk={
  auth:{onAuthStateChange:fn=>{listener=fn;}},
  session:async()=>session,
  async password(identifier,password){
    loginAccount=identifier;
    if(password!=='Correct123')throw Error('Invalid credentials');
    session={user};listener('SIGNED_IN',session);return {session};
  },
  async register(email,password,username){
    registrations++;sent={email,password,username};
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
  equal(el('accountEmail').type,'text','login accepts a username rather than forcing email format');
  ok(el('accountUsernameLabel').hidden,'login does not require registration fields');
  ok(el('accountUsername').disabled,'hidden registration input cannot invalidate password login');
  el('accountEmail').value='player@example.test';el('accountPassword').value='wrong';
  el('accountForm').submit();await settle();
  equal(el('accountMessage').textContent,'Invalid credentials','real auth error reaches the form');
  equal(readCount,0,'failed login does not reach private saves');

  el('authregister').click();el('accountPassword').value='Correct123';el('accountUsername').value='bad name';
  el('accountForm').submit();await settle();
  equal(registrations,0,'invalid account names do not send a verification email');
  el('accountUsername').value='archer_01';
  el('accountPassword').value='A'.repeat(40)+'1';el('accountForm').submit();await settle();
  equal(registrations,0,'passwords beyond the provider limit do not send a registration email');
  el('accountPassword').value='Correct123';
  el('accountForm').submit();await settle();
  equal(sent,{email:'player@example.test',password:'Correct123',username:'archer_01'},'registration sends the chosen username and a one-time verification email');
  ok(!el('accountCodeLabel').hidden,'registration exposes the code verification step');
  ok(el('accountEmail').readOnly,'verification stays attached to the original mailbox');
  ok(el('accountUsername').readOnly,'verification stays attached to the chosen account');
  el('accountCode').value='123456';el('accountForm').submit();await settle();
  equal(token,'123456','the submitted code reaches the returned verification callback');
  ok(!el('accountMember').hidden&&el('accountGuest').hidden,'verified login updates the visible dialog');
  equal(el('accountIdentity').textContent,'archer_01','signed-in screen displays the actual account name');
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
  el('authpassword').click();el('authregister').click();el('accountPassword').value='Correct123';
  el('accountForm').submit();await settle();equal(registrations,1,'switching modes cannot bypass the registration email cooldown');
  let prevented=false;
  ok(account.key({key:'Escape',preventDefault(){prevented=true;}}),'account dialog captures game keyboard shortcuts');
  ok(prevented&&el('accountPanel').hidden,'Escape closes the dialog');
  account.dispose();

  const login=setupCloudAccount({storage,getSave:()=>local,applySave:p=>{local=p;},atCamp:()=>true,beforeOpen:()=>{},loadClient:async()=>sdk});
  el('accountHome').click();await settle();
  el('accountEmail').value='archer_01';el('accountPassword').value='Correct123';
  el('accountForm').submit();await settle();
  equal(loginAccount,'archer_01','password login forwards the username from the actual form');
  ok(!el('accountMember').hidden,'password-login submit reaches the signed-in screen');
  equal(registrations,1,'ordinary password login sends no email');
  failSignOut=true;el('accountSignOut').click();await settle();
  ok(!el('accountMember').hidden,'failed sign-out restores the actual SDK session');
  equal(el('accountMessage').textContent,'Sign-out unavailable','sign-out failure is visible');
  failSignOut=false;
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
