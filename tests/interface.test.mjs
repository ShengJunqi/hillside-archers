import assert from 'node:assert/strict';
import fs from 'node:fs';
import {shippedInterface} from './helpers/shipped-interface.mjs';

let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;},eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
const snapshot=g=>JSON.stringify({save:g.permanentSave,players:g.players,arrows:g.arrows,round:g.round,active:g.active,phase:g.phase,time:g.phaseTime,ammo:g.specialAmmo,angles:g.angles,powers:g.powers});
const begin=(ui,mode='duel',skill='dive')=>{ui.api.game.start(mode,1,skill);ui.api.game.skip();ui.frame();eq(ui.api.game.phase,'aim','test reaches a real aiming turn');};

for(const width of [320,390,844,1280]){
 const ui=shippedInterface({width,height:width===844?390:780}),{api,$,document,frame,key}=ui,g=api.game;
 ok($('pause').hidden&&$('settingsButton').visible(),'camp exposes settings and hides combat pause');
 ok($('arena').contains($('pause'))&&!$('gameShell').querySelector('header').contains($('pause')),'combat pause belongs to the actual arena');
 const original=snapshot(g);$('settingsButton').click();
 ok(api.paused&&$('pausePanel').visible(),'camp settings opens the modal without starting a match');eq(api.pauseTab,'settings','camp entrance selects settings immediately');
 eq($('settingsButton').getAttribute('aria-expanded'),true,'camp entrance exposes its expanded state');eq(document.activeElement,$('pauseSettingsTab'),'settings entrance focuses its selected tab');
 ok(!$('pauseOverviewTab').visible()&&!$('restart').visible()&&!$('pauseHome').visible(),'camp never offers unrelated match actions');
 eq($('resumeLabel').textContent,'返回旅营','camp has a clear closing action');frame(20);eq(snapshot(g),original,'camp settings neither unlocks nor mutates progress');
 key('ArrowLeft',$('pauseSettingsTab'));eq(api.pauseTab,'help','home tabs skip the unavailable match page');eq(document.activeElement,$('pauseHelpTab'),'tab arrows move keyboard focus');
 eq($('pauseHelpTab').tabIndex,0,'selected tab participates in normal focus order');eq($('pauseSettingsTab').tabIndex,-1,'inactive tab leaves normal focus order');
 key('Escape');ok(!api.paused&&$('pausePanel').hidden,'Escape closes camp settings');eq(document.activeElement,$('settingsButton'),'camp focus returns to its visible entrance');
}

{
 const ui=shippedInterface(),{api,$,frame,pointer,key,document}=ui,g=api.game;begin(ui);
 ok($('pause').visible()&&!$('settingsButton').visible(),'a match has one prominent pause entrance');
 const aim=[g.angles[0],g.powers[0]],turn=g.round,save=JSON.stringify(g.permanentSave),icons=$('pause').querySelectorAll('svg').length;
 pointer('pointerdown');pointer('pointermove',110,355);ok(api.input.drag,'real canvas has begun drawing the bow');
 $('pause').click();ok(api.paused&&!api.input.drag,'pause cancels the held bow before opening');eq([g.angles[0],g.powers[0]],aim,'pausing restores the uncommitted aim');
 pointer('pointerup',110,355);eq(g.phase,'aim','release after pause cannot fire');eq(g.round,turn,'pausing does not consume the current turn');eq(JSON.stringify(g.permanentSave),save,'pause does not mutate permanent progress');
 eq($('pause').getAttribute('aria-expanded'),true,'combat button exposes the open dialog');eq($('pause').getAttribute('aria-label'),'继续游戏','combat entrance keeps its accessible state');
 eq($('pause').querySelectorAll('svg').length,icons,'button icons survive state changes');eq(document.activeElement,$('resume'),'primary resume is focused on entry');
 const frozen=snapshot(g);frame(30);eq(snapshot(g),frozen,'paused frames freeze physical projectiles, players, clocks and turn');
 $('pauseSettingsTab').click();ok($('pauseSettings').visible()&&!$('pauseOverview').visible(),'settings tab actually replaces the visible page');
 key('Home',$('pauseSettingsTab'));eq(api.pauseTab,'overview','Home chooses the first available tab');key('End',$('pauseOverviewTab'));eq(api.pauseTab,'help','End chooses the last available tab');
 key('Tab',$('pauseHelpTab'));eq(document.activeElement,$('resume'),'last page control wraps to the primary action');key('Tab',$('resume'),{shiftKey:true});eq(document.activeElement,$('pauseHelpTab'),'reverse Tab stays in the modal');
 const event=key('ArrowRight',$('pauseHelpTab'));ok(event.prevented,'tab navigation does not scroll or aim the bow');eq(api.pauseTab,'overview','tab arrows wrap around');
 $('resume').click();ok(!api.paused&&$('pausePanel').hidden,'resume closes the modal');eq(document.activeElement,$('game'),'resuming restores canvas keyboard control');eq(g.round,turn,'resuming preserves whose turn it is');eq($('pauseLabel').textContent,'暂停','real button returns to pause state');
}

{
 const ui=shippedInterface(),{api,$,frame,key,up}=ui,g=api.game;begin(ui,'rogue','dive');
 key(' ',$('game'));for(let i=0;i<4;i++)g.update(.05);up(' ');frame();ok(g.canSkill,'a real special shot reaches its manual activation window');
 key(' ',$('game'));ok(g.skillAim,'space starts the held in-flight preview');const ammo=g.specialAmmo;
 $('pause').click();ok(api.paused&&!g.skillAim,'pause cancels an in-flight held preview');eq(g.timeScale,1,'pause restores the regular simulation clock');eq(g.specialAmmo,ammo,'cancelled preview does not spend ammunition');
 up(' ');ok(!g.skillUsed,'late key release after pausing cannot activate the skill');const frozen=snapshot(g);frame(25);eq(snapshot(g),frozen,'arrows in flight stay frozen throughout the menu');
 $('pauseSettingsTab').click();$('viewMode').click();ok($('viewMenu').visible(),'display choices can be opened within settings');key('Escape');ok($('viewMenu').hidden&&api.paused,'first Escape closes display choices while retaining pause');
 $('viewMode').click();$('chooseDesktop').click();eq(ui.document.body.dataset.layout,'desktop','settings can switch to desktop');ok(api.paused,'layout changes retain the pause state');eq(snapshot(g),frozen,'layout switching does not restart or change combat data');
 $('viewMode').click();$('chooseMobile').click();eq(ui.document.body.dataset.layout,'mobile','settings can return to mobile');eq(snapshot(g),frozen,'switching back preserves the same in-flight shot');
 key('Escape');ok(!api.paused&&$('pausePanel').hidden,'second Escape returns to play');frame();ok(g.arrows.some(b=>b.t>JSON.parse(frozen).arrows[0].t),'the same projectile continues after resuming');eq(g.specialAmmo,ammo,'menu navigation has not spent a special arrow');
}

{
 const ui=shippedInterface(),{api,$,frame}=ui,g=api.game;$('rogueStart').click();frame();eq(g.phase,'loadout','camp reaches the real pre-run loadout');
 const before=snapshot(g);$('pause').click();ok(api.paused,'pre-run selection can open settings');eq(api.pauseTab,'settings','pre-run menu avoids showing a previous match');
 ok(!$('restart').visible()&&!$('pauseOverviewTab').visible(),'pre-run menu cannot restart an unrelated previous mode');eq($('resumeLabel').textContent,'继续选弓','resume explains the actual destination');
 $('resume').click();eq(snapshot(g),before,'closing settings keeps loadout choices and phase');frame();eq(g.phase,'loadout','resumed selection stays on loadout');
}

for(const mode of ['home','duel']){
 const ui=shippedInterface(),{api,$,key,document,frame}=ui,g=api.game;if(mode!=='home')begin(ui);
 (mode==='home'?$('settingsButton'):$('pause')).click();$('pauseSettingsTab').click();
 $('editNamesPause').click();ok($('namesPanel').visible()&&api.paused,'names opens above the paused menu');key('Escape',$('archerName0'));ok($('namesPanel').hidden&&api.paused,'names Escape returns to the paused menu');eq(document.activeElement,$('editNamesPause'),'names focus returns inside its parent modal');
 $('transferPause').click();ok($('transferPanel').visible(),'progress transfer is still reachable');key('Escape',$('transferClose'));eq(document.activeElement,$('transferPause'),'transfer closes to its actual parent control');ok(api.paused,'closing transfer does not resume implicitly');
 $('accountPause').click();ok($('accountPanel').visible(),'account dialog opens without any network in offline QA');key('Escape',$('accountClose'));ok($('accountPanel').hidden&&api.paused,'account closes while preserving pause');eq(document.activeElement,$('accountPause'),'cloud dialog restores focus to its visible parent, including camp');
 $('sceneryPause').click();ok($('sceneryPanel').visible(),'scenery remains accessible through settings');key('Escape',$('sceneryBack'));ok($('sceneryPanel').hidden&&api.paused,'scenery back returns to the pause sheet');eq(document.activeElement,$('sceneryPause'),'scenery restores parent focus');
 $('sceneryPause').click();$('sceneryClose').click();frame();ok(!api.paused&&$('pausePanel').hidden,'scenery primary action exits both layers cleanly');eq(g.phase,mode==='home'?'home':'aim','closing scenery preserves the underlying game phase');
}

{
 const ui=shippedInterface(),{api,$,frame,window,document}=ui,g=api.game;begin(ui,'local');const save=JSON.stringify(g.permanentSave);
 $('pause').click();$('restart').click();frame();eq(g.mode,'local','restart retains the selected game mode');eq(JSON.stringify(g.permanentSave),save,'restart retains the permanent save');ok(!api.paused&&$('pausePanel').hidden,'restart removes the pause layer');
 g.skip();frame();window.dispatch('blur');ok(api.paused&&$('pausePanel').visible(),'window blur uses the same real pause interface');$('resume').click();frame();document.hidden=true;document.dispatch('visibilitychange');ok(api.paused,'backgrounding pauses again');
 document.hidden=false;document.dispatch('visibilitychange');ok(api.paused,'foregrounding never resumes a match without user input');
 $('pauseHome').click();frame();eq(g.phase,'home','camp action returns home');ok(!api.paused&&$('pause').hidden&&$('settingsButton').visible(),'returning home restores the camp controls');eq(JSON.stringify(g.permanentSave),save,'returning home retains progress');
}

const offline=fs.readFileSync(new URL('../dist/download.html',import.meta.url),'utf8');
ok(!offline.includes('href="interface.css"')&&offline.includes('/* A real, thumb-sized pause button'),'offline export includes the new interface stylesheet');
console.log(checks+' shipped pause, modal focus, held-shot cancellation, layout-switch and offline-interface checks passed (DOM adapter; not browser QA).');
