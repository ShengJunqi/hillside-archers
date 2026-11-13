import assert from 'node:assert/strict';
import {ImpactFeedback,readFeedback} from '../dist/feedback.mjs';
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;},eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
eq(readFeedback({getItem:()=>null}),'light','default shake is restrained');eq(readFeedback({getItem:()=> 'garbage'}),'light','bad preference falls back safely');eq(readFeedback({getItem(){throw Error('blocked');}}),'light','privacy-mode storage failure does not block play');
for(const mode of ['light','standard','off']){
 const f=new ImpactFeedback(mode);eq(f.update(.016),{x:0,y:0},'camera stays still without an impact');ok(f.hit({dir:-1}),'first body hit starts one impulse');
 for(let i=0;i<24;i++)ok(!f.hit({dir:-1}),'additional body arrows do not extend shake');ok(f.hit({head:true,dir:-1}),'one stronger head impact can replace body impulse');ok(!f.hit({head:true}),'repeated headshots do not restart shake');
 let maximum=0;for(let i=0;i<30;i++){const p=f.update(1/120);maximum=Math.max(maximum,Math.abs(p.x),Math.abs(p.y));ok(Math.abs(p.x)<=3.6&&Math.abs(p.y)<=1.3,'CSS pixel motion has a bounded amplitude');}
 eq(f.update(.2),{x:0,y:0},'event-local movement fully settles');if(mode==='off')eq(maximum,0,'off produces no camera impulse');else ok(maximum>0,'enabled preference produces visible impulse');
 f.beginVolley();f.hit({head:true});eq(f.update(.01,{reduced:true}),{x:0,y:0},'system reduced motion overrides manual setting');
}
{
 const a=new ImpactFeedback('standard'),b=new ImpactFeedback('standard');a.hit({head:true});b.hit({head:true});const x=a.update(.02),y=b.update(.02,{scale:2});eq(y,{x:x.x*2,y:x.y*2},'same CSS shake strength survives high logical resolution');
 const f=new ImpactFeedback('light');f.hit({head:true});eq(f.update(0),f.update(0),'paused render does not advance the impulse');f.reset();eq(f.update(0),{x:0,y:0},'reset stops old shake at a new match');
}
console.log(checks+' impact-decay, multishot, preference and reduced-motion checks passed.');
