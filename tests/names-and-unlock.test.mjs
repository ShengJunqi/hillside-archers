import assert from 'node:assert/strict';
import {Game,validSave} from '../dist/core.mjs';
import {DEFAULT_NAMES,normalizeNames,storyNames} from '../dist/names.mjs';
import {encodeProgress,decodeProgress,mergeProgress} from '../dist/save-transfer.mjs';
let checks=0;
const eq=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);checks++;};
const ok=(value,message)=>{assert.ok(value,message);checks++;};
eq(normalizeNames(),DEFAULT_NAMES,'legacy saves use the familiar two names');
eq(normalizeNames(['  小山  ','\n']),['小山','赤岩'],'blank names fall back and extra whitespace is removed');
eq(normalizeNames(['123456789','\u202e红\u0000箭']),['12345678','红箭'],'long names and hidden formatting are normalized');
eq(normalizeNames(['🏹山河','😀赤焰']),['🏹山河','😀赤焰'],'emoji names keep intact code points');
eq(storyNames('青松向赤岩点头。',['赤岩','青松']),'赤岩向青松点头。','swapped names are replaced in a single pass');
eq(validSave({unlocked:true,names:['山河','小红']}).names,['山河','小红'],'custom names survive save validation');
ok(!Object.hasOwn(validSave({names:['青松','赤岩']}),'names'),'default names preserve legacy save shape');
const named=validSave({unlocked:true,checkpoint:2,best:8,embers:20,bow:2,life:1,names:['🏹小山','红箭']});
eq(decodeProgress(encodeProgress(named)),named,'Chinese and emoji names round-trip through HA2 progress codes');
const old=validSave({best:2});
eq(decodeProgress('HA2:'+btoa(JSON.stringify(old))),old,'old ASCII progress codes still decode');
eq(mergeProgress(old,named).names,named.names,'new browser imports selected names');
eq(mergeProgress({...old,names:['我的弓手','赤岩']},named).names,['我的弓手','红箭'],'import preserves chosen local name while filling a default name');
eq(decodeProgress(encodeProgress({...named,names:['<b>X</b>','&小红']})).names,['<b>X</b>','&小红'],'names travel as plain text');

for(const phase of ['home','intro']){
 let saves=0;const g=new Game({save:named,onEvent:event=>{if(event.type==='save')saves++;}});
 g.save.unlocked=false;if(phase==='intro')g.start('campaign',2);
 const before={...g.save};g.arrows=[];
 ok(g.skipTutorial(),'explicit tutorial skip succeeds on '+phase);
 eq(g.phase,'home','tutorial skip returns to mode selection');
 ok(g.save.unlocked,'tutorial skip unlocks subsequent modes');
 eq({...g.save,unlocked:false},{...before,unlocked:false},'tutorial skip changes no checkpoint, currency, record, training or names');
 eq(g.arrows.length,0,'tutorial skip cannot shoot');eq(saves,1,'unlock persists once');
 g.skipTutorial();eq(saves,1,'repeat tutorial skip does not grant or write duplicate rewards');
 const restored=new Game({save:JSON.stringify(g.save)});
 for(const mode of ['rogue','duel','local','target'])ok(restored.start(mode),'restored skip unlocks '+mode);
}
{
 const g=new Game();g.start('campaign');g.introNext();g.introNext();g.introNext();
 eq(g.phase,'scout','watching the tutorial normally leads to the first match');
 ok(!g.save.unlocked,'normal tutorial progression retains the win-to-unlock path');
 g.skip();g.shoot();ok(!g.skipTutorial(),'tutorial skip API cannot interrupt an active shot');
 ok(!g.save.unlocked,'blocked skip cannot alter an in-flight save');
}
console.log(checks+' character-name, migration and tutorial-unlock checks passed.');
