import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {Game} from '../dist/core.mjs';
import {AimInput, pullGeometry} from '../dist/input.mjs';
import {VIEW_KEY, validView, readView, writeView, resolveView} from '../dist/display.mjs';

let checks = 0;
const ok = (value, message) => {assert.ok(value, message); checks++;};
const equal = (value, expected, message) => {assert.deepEqual(value, expected, message); checks++;};
const pointer = (x, y, extra = {}) => ({pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, button: 0, buttons: 1, preventDefault() {}, ...extra});

class Element {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase(); this.style = {}; this.dataset = {}; this.children = [];
    this.listeners = new Map(); this.attributes = {}; this.hidden = false; this.disabled = false;
    this.value = '1'; this.captures = new Set(); this.rect = {left: 0, top: 0, width: 390, height: 650};
    const classes = new Set();
    this.classList = {add: value => classes.add(value), contains: value => classes.has(value), toggle(value, forced) {const enabled = forced ?? !classes.has(value); if (enabled) classes.add(value); else classes.delete(value); return enabled;}};
  }
  addEventListener(name, fn) {const list = this.listeners.get(name) || []; list.push(fn); this.listeners.set(name, list);}
  dispatch(name, event = {}) {event.preventDefault ??= () => {}; event.target ??= this; for (const fn of this.listeners.get(name) || []) fn(event);}
  getBoundingClientRect() {return this.rect;}
  setPointerCapture(id) {this.captures.add(id);}
  hasPointerCapture(id) {return this.captures.has(id);}
  releasePointerCapture(id) {this.captures.delete(id); this.dispatch('lostpointercapture', {pointerId: id});}
  focus() {}
  setAttribute(name, value) {this.attributes[name] = value;}
  append(child) {this.children.push(child);}
  contains(child) {return child === this || this.children.some(node => node.contains(child));}
  replaceChildren(...children) {this.children = children;}
  querySelector(selector) {if (selector === '.mode-state') return this.modeState ??= new Element(); throw Error('Unknown selector: ' + selector);}
  click() {if (!this.disabled) return this.onclick?.({target: this, preventDefault() {}});}
}

function setupInput() {
  const canvas = new Element('canvas'); canvas.width = 540; canvas.height = 900;
  const game = new Game({save: {unlocked: true}}); game.start('local'); game.skip();
  let paused = false;
  const input = new AimInput(canvas, game, {isPaused: () => paused});
  return {canvas, game, input, pause: () => {paused = true;}};
}

let {canvas, game, input, pause} = setupInput();
const originalAngle = game.angles[0], originalPower = game.powers[0];
canvas.dispatch('pointerdown', pointer(210, 300)); canvas.dispatch('pointerup', pointer(210, 300, {buttons: 0}));
equal(game.phase, 'aim', 'a tap does not accidentally fire');
canvas.dispatch('pointerdown', pointer(210, 300)); canvas.dispatch('pointermove', pointer(110, 355));
ok(input.drag && !input.drag.inside, 'a deliberate touch pull aims');
ok(Number.isInteger(game.angles[0]), 'touch aiming still uses integer angles');
canvas.dispatch('pointermove', pointer(195, 308)); canvas.dispatch('pointerup', pointer(195, 308, {buttons: 0}));
equal(game.phase, 'aim', 'return to the larger touch circle cancels');
equal(game.angles[0], originalAngle, 'cancel restores previous angle');
equal(game.powers[0], originalPower, 'cancel restores previous power');
canvas.dispatch('pointerdown', pointer(210, 300)); canvas.dispatch('pointermove', pointer(110, 355));
canvas.dispatch('pointerdown', pointer(100, 100, {pointerId: 2, isPrimary: false}));
canvas.dispatch('pointermove', pointer(50, 50, {pointerId: 2, isPrimary: false}));
canvas.dispatch('pointerup', pointer(50, 50, {pointerId: 2, isPrimary: false, buttons: 0}));
equal(input.drag.id, 1, 'a second finger cannot take over the active pull');
equal(game.phase, 'aim', 'releasing a second finger cannot shoot');
input.cancel(); canvas.dispatch('pointerup', pointer(110, 355, {buttons: 0}));
equal(game.phase, 'aim', 'releasing the first finger after cancellation cannot shoot');
for (const name of ['pointercancel', 'lostpointercapture', 'contextmenu']) {
  canvas.dispatch('pointerdown', pointer(210, 300)); canvas.dispatch('pointermove', pointer(110, 355));
  canvas.dispatch(name, pointer(110, 355)); canvas.dispatch('pointerup', pointer(110, 355, {buttons: 0}));
  equal(input.drag, null, name + ' clears the held pointer'); equal(game.phase, 'aim', name + ' does not consume a turn');
}
canvas.dispatch('pointerdown', pointer(210, 300)); canvas.dispatch('pointermove', pointer(110, 355)); pause();
canvas.dispatch('pointerup', pointer(110, 355, {buttons: 0})); equal(game.phase, 'aim', 'pausing while held cancels instead of shooting');
({canvas, game, input} = setupInput());
canvas.dispatch('pointerdown', pointer(210, 300)); canvas.dispatch('pointermove', pointer(110, 355));
canvas.dispatch('pointerup', pointer(110, 355, {buttons: 0}));
equal(game.phase, 'flight', 'valid touch release fires'); equal(game.arrows.length, 1, 'valid release fires only one volley');
canvas.dispatch('pointerup', pointer(110, 355, {buttons: 0})); equal(game.arrows.length, 1, 'duplicate release is harmless');
({canvas, game, input} = setupInput()); game.active = 1;
canvas.dispatch('pointerdown', pointer(150, 300)); canvas.dispatch('pointermove', pointer(250, 355));
equal(game.angles[1], 29, 'player two pulls in the mirrored direction');
canvas.dispatch('pointerup', pointer(250, 355, {buttons: 0})); equal(game.phase, 'flight', 'player two can fire on the same phone');
for (const [width, height] of [[320, 480], [390, 650], [844, 300], [1024, 680]]) {
  const geometry = pullGeometry({width, height}, 'touch');
  ok(geometry.cancelRadius >= 32, 'touch cancel radius stays finger-sized at ' + width);
  ok(geometry.fullPull >= 85 && geometry.fullPull <= 140, 'touch strength stays usable at ' + width);
}
equal(pullGeometry({width: 960, height: 540}, 'mouse').cancelRadius, 48, 'desktop cancellation feel is preserved');
equal(pullGeometry({width: 960, height: 540}, 'mouse').fullPull, 145, 'desktop full pull is preserved');
({canvas, game, input} = setupInput()); game.start('rogue'); game.skip(); game.shoot(); for (let i = 0; i < 4; i++) game.update(.05);
canvas.dispatch('pointerdown', pointer(200, 300, {pointerId: 2, isPrimary: false})); ok(!game.skillUsed, 'secondary touch cannot spend a skill');
canvas.dispatch('pointerdown', pointer(200, 300)); ok(game.skillUsed, 'a new primary touch activates the flight skill');
equal(input.drag, null, 'skill activation does not start an aim gesture');

// Run the real app against a small DOM/event adapter. This is not a browser layout test.
async function appChecks(offline = false, preference = 'auto', blockedStorage = false) {
  const html = fs.readFileSync(new URL('../dist/' + (offline ? 'download.html' : 'index.html'), import.meta.url), 'utf8');
  const ids = new Map();
  for (const match of html.matchAll(/<([a-z]+)[^>]*\bid="([^"]+)"[^>]*>/g)) {
    assert.ok(!ids.has(match[2]), 'HTML IDs must be unique'); ids.set(match[2], new Element(match[1]));
  }
  const document = new Element('document'), window = new Element('window');
  document.body = new Element('body'); document.documentElement = new Element('html'); document.hidden = false;
  document.documentElement.dataset.offline = String(offline);
  ids.get('namesPanel').hidden = true; ids.get('viewMenu').hidden = true; ids.get('transferPanel').hidden = true;
  ids.get('viewPicker').append(ids.get('viewMode')); ids.get('viewPicker').append(ids.get('viewMenu'));
  document.getElementById = id => {assert.ok(ids.has(id), 'HTML element exists: ' + id); return ids.get(id);};
  document.createElement = tag => new Element(tag);
  const right = new Element(); document.querySelector = selector => {assert.equal(selector, '.health.right'); return right;};
  window.matchMedia = () => ({matches: true}); window.visualViewport = new Element();
  window.innerWidth = 390; window.innerHeight = 740;
  const noop = () => {};
  const ctx = new Proxy({}, {get: (obj, name) => name in obj ? obj[name] : name === 'createLinearGradient' ? () => ({addColorStop: noop}) : noop, set: (obj, name, value) => {obj[name] = value; return true;}});
  const cv = ids.get('game'); cv.getContext = () => ctx;
  let resizeCallback, nextFrame, now = 0;
  const memory = new Map([[VIEW_KEY, preference]]);
  const sandbox = {document, window, navigator: {maxTouchPoints: 5}, console, btoa, atob,
    localStorage: {getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value)},
    ResizeObserver: class {constructor(fn) {resizeCallback = fn;} observe() {}},
    performance: {now: () => now}, requestAnimationFrame: fn => {nextFrame = fn;}};
  if (blockedStorage) Object.defineProperty(sandbox, 'localStorage', {get() {throw new Error('Storage access denied');}});
  const context = vm.createContext(sandbox);
  const code = offline ? html.match(/<script>([\s\S]*?)<\/script>/)[1] : ['names', 'combat', 'body', 'encounters', 'core', 'save-transfer', 'emotes', 'feedback', 'render', 'input', 'display', 'cloud-save', 'cloud-client', 'cloud-ui', 'app'].map(name => fs.readFileSync(new URL('../dist/' + name + '.mjs', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '').replace(/\bexport /g, '')).join('\n');
  vm.runInContext(code + '\nglobalThis.api={game,input,renderer,encodeProgress,archerName,get paused(){return paused;}};', context);
  const api = context.api, $ = id => ids.get(id), frame = () => {now += 16.67; nextFrame(now);};
  frame();
  if (preference === 'desktop' && !blockedStorage) {
    equal(document.body.dataset.layout, 'desktop', 'saved desktop preference overrides phone detection after loading');
    $('chooseAuto').click();
  }
  ok(document.body.classList.contains('touch-ui'), 'touch device gets touch UI');
  $('editNamesHome').click();
  ok(!$('namesPanel').hidden, 'home opens character naming settings');
  $('archerName0').value = '小山🏹'; $('archerName1').value = '小红'; $('namesSave').click(); frame();
  equal(api.game.save.names.join('/'), '小山🏹/小红', 'both chosen names are stored');
  if (!blockedStorage) equal(JSON.parse(memory.get('hillside-archers-save-v2')).names.join('/'), '小山🏹/小红', 'chosen names persist in browser save');
  $('campaignStart').click(); frame();
  ok($('skipStory').textContent.includes('解锁玩法'), 'first-run skip explicitly says it unlocks modes');
  equal($('speaker').textContent, '小山🏹', 'story speaker uses chosen name');
  $('skipStory').click(); frame();
  equal(api.game.phase, 'home', 'skip tutorial returns to mode selection');
  ok(api.game.save.unlocked && !$('rogueStart').disabled && !$('localStart').disabled, 'skip tutorial immediately unlocks later modes');
  equal(api.game.save.embers, 0, 'skip tutorial does not award currency');
  equal(api.game.save.checkpoint, 1, 'skip tutorial preserves story checkpoint');
  ok(!$('saveNote').textContent.includes('已完成'), 'skipping tutorial is not presented as a story victory');
  api.game.save.unlocked = false; api.game.goHome(); frame();
  $('campaignQuick').click(); frame();
  ok(api.game.phase === 'home' && api.game.save.unlocked, 'homepage tutorial skip also unlocks without firing');
  $('transferHome').click();
  ok(!$('transferPanel').hidden && !$('importProgressButton').disabled, 'home offers progress import and export');
  ok($('exportProgress').value.startsWith('HA2:'), 'export shows a portable progress code');
  await $('copyProgress').click(); ok($('transferMessage').textContent.includes('Ctrl/Cmd+C'), 'clipboard failure offers manual copying');
  let copiedProgress;
  sandbox.navigator.clipboard = {writeText: async value => {copiedProgress = value;}};
  await $('copyProgress').click();
  equal(copiedProgress, $('exportProgress').value, 'explicit copy button writes the exported progress code');
  delete sandbox.navigator.clipboard;
  const beforeInvalidImport = JSON.stringify(api.game.save);
  $('importProgress').value = 'broken'; $('importProgressButton').click();
  ok($('transferMessage').textContent.length > 0 && JSON.stringify(api.game.save) === beforeInvalidImport, 'bad code reports an error without changing progress');
  $('importProgress').value = api.encodeProgress({...api.game.save, unlocked: true, best: 12, embers: 20});
  $('importProgressButton').click();
  ok(api.game.save.unlocked && api.game.save.best === 12 && api.game.phase === 'home', 'valid import merges progress without starting a run');
  window.dispatch('keydown', {key: 'Escape', target: $('importProgress')});
  ok($('transferPanel').hidden, 'Escape closes migration while typing');
  ok($('campaignQuick').hidden, 'already-unlocked players no longer see the tutorial skip entry');
  api.game.goHome(); frame();
  $('campaignStart').click(); frame();
  equal(api.game.phase, 'intro', 'normal story entry remains available');
  equal($('speaker').textContent, '小山🏹', 'renamed speaker remains after progress import');
  ok($('storyLine').textContent.length > 20, 'story text appears immediately without typing delay');
  $('skipStory').click(); frame();
  ok(!$('skipTurn').hidden, 'camera skip button is available without a keyboard');
  $('skipTurn').click(); frame(); equal(api.game.phase, 'aim', 'touch skip starts the turn');
  equal($('name0').textContent, '小山🏹', 'HUD uses chosen player name');
  equal($('name1').textContent, '小红', 'HUD uses chosen opponent name');
  $('pause').click(); $('editNamesPause').click();
  const beforeRename = JSON.stringify([api.game.players, api.game.arrows, api.game.round, api.game.phase]);
  $('archerName0').value = '名字长度超过八个字啦'; $('namesSave').click();
  ok(!$('namesPanel').hidden && $('namesMessage').textContent.includes('最多'), 'overlong name is rejected visibly');
  $('archerName0').value = '<b>X</b>'; $('archerName1').value = '小红'; $('namesSave').click(); frame();
  equal($('name0').textContent, '<b>X</b>', 'nickname markup is displayed as text');
  equal(JSON.stringify([api.game.players, api.game.arrows, api.game.round, api.game.phase]), beforeRename, 'renaming from pause cannot reset the match');
  $('editNamesPause').click(); $('namesReset').click();
  window.dispatch('keydown', {key: 'Escape', target: $('archerName0')});
  ok($('namesPanel').hidden && api.archerName(0) === '<b>X</b>', 'canceling defaults does not save an unwanted rename');
  $('resume').click(); frame();
  cv.dispatch('pointerdown', pointer(210, 300)); cv.dispatch('pointerup', pointer(210, 300, {buttons: 0})); frame();
  equal(api.renderer.emote.kind, 'jump', 'real app tap starts a character animation');
  equal(api.game.phase, 'aim', 'app character animation does not consume a turn');
  ok(!$('touchControls').hidden, 'human turn has a touch control bar');
  const angle = api.game.angles[0]; $('angleUp').click(); frame(); equal(api.game.angles[0], angle + 1, 'touch + changes angle by one degree');
  $('angleDown').click(); frame(); equal(api.game.angles[0], angle, 'touch minus changes angle by one degree');
  const state = JSON.stringify([api.game.save, api.game.players, api.game.round, api.game.active, api.game.mode]);
  const oldPower = api.game.powers[0];
  cv.dispatch('pointerdown', pointer(210, 300)); cv.dispatch('pointermove', pointer(110, 355));
  $('viewMode').click();
  equal(api.input.drag, null, 'opening display menu cancels a held shot');
  equal(api.game.angles[0], angle, 'opening display menu restores previous aim');
  equal(api.game.powers[0], oldPower, 'opening display menu restores previous power');
  $('chooseDesktop').click(); cv.dispatch('pointerup', pointer(110, 355, {buttons: 0}));
  equal(api.game.phase, 'aim', 'switching display while held does not fire or consume a turn');
  equal(JSON.stringify([api.game.save, api.game.players, api.game.round, api.game.active, api.game.mode]), state, 'switch keeps current match and saved progress');
  equal(document.body.dataset.layout, 'desktop', 'manual desktop overrides a phone viewport');
  ok($('touchControls').hidden, 'desktop mode hides touch-only controls');
  if (!blockedStorage) equal(memory.get(VIEW_KEY), 'desktop', 'preference is saved independently of game progress');
  window.dispatch('resize');
  cv.dispatch('pointerdown', pointer(210, 300));
  equal(document.body.dataset.layout, 'desktop', 'resize and touch cannot override explicit desktop choice');
  api.input.cancel();
  $('viewMode').click(); window.dispatch('keydown', {key: 'Escape'});
  ok($('viewMenu').hidden && !api.paused, 'Escape closes display menu without pausing the match');
  $('viewMode').click(); document.dispatch('pointerdown', {target: $('viewMode')});
  ok(!$('viewMenu').hidden, 'clicking inside selector leaves it open');
  document.dispatch('pointerdown', {target: document.body});
  ok($('viewMenu').hidden, 'clicking elsewhere closes selector');
  $('chooseAuto').click();
  equal(document.body.dataset.layout, 'mobile', 'returning to auto restores phone layout');
  window.innerWidth = 1440; window.innerHeight = 900; window.dispatch('resize');
  equal(document.body.dataset.layout, 'desktop', 'auto adapts to wide desktop viewport');
  $('chooseMobile').click(); window.dispatch('resize');
  equal(document.body.dataset.layout, 'mobile', 'manual mobile remains selected on a large screen');
  window.innerWidth = 844; window.innerHeight = 390; window.dispatch('resize');
  equal(document.body.dataset.orientation, 'landscape', 'mobile mode follows phone rotation');
  window.innerWidth = 390; window.innerHeight = 740; $('chooseAuto').click();
  cv.dispatch('pointerdown', pointer(210, 300)); cv.dispatch('pointermove', pointer(110, 355));
  ok(!$('cancelShot').disabled && $('touchFire').disabled, 'holding a pull enables cancel and prevents double fire');
  $('cancelShot').dispatch('pointerdown', pointer(200, 600, {pointerId: 2, isPrimary: false}));
  cv.dispatch('pointerup', pointer(110, 355, {buttons: 0}));
  equal(api.game.phase, 'aim', 'second-finger cancel button prevents release firing');
  cv.dispatch('pointerdown', pointer(210, 300)); cv.dispatch('pointermove', pointer(110, 355));
  cv.rect = {left: 0, top: 0, width: 844, height: 300}; resizeCallback();
  equal(api.input.drag, null, 'viewport resize cancels an active pull');
  cv.dispatch('pointerup', pointer(110, 355, {buttons: 0})); equal(api.game.phase, 'aim', 'rotating mid-pull does not shoot');
  for (const [width, height] of [[320, 480], [390, 650], [844, 300], [1024, 680]]) {
    cv.rect = {left: 0, top: 0, width, height}; resizeCallback(); frame();
    ok(Math.abs(cv.width / cv.height - width / height) < .002, 'canvas matches viewport aspect at ' + width);
    const player = api.game.players[api.game.active], camera = api.renderer.cam;
    const angleTop = (cv.height + (player.y - 157 - camera.y) * camera.z) * height / cv.height;
    const feet = (cv.height + (player.y - camera.y) * camera.z) * height / cv.height;
    ok(angleTop >= 60, 'aim label stays below phone HUD at ' + width);
    ok(feet <= height - 60, 'player stays above touch controls at ' + width);
  }
  await $('fullscreen').click(); ok(document.body.classList.contains('immersive'), 'fullscreen fallback expands the shell');
  await $('fullscreen').click(); ok(!document.body.classList.contains('immersive'), 'fullscreen fallback can be exited');
  $('gameShell').requestFullscreen = () => Promise.reject(new Error('Not supported'));
  await $('fullscreen').click(); ok(document.body.classList.contains('immersive'), 'rejected native fullscreen falls back safely');
  await $('fullscreen').click(); ok(!document.body.classList.contains('immersive'), 'fallback after rejection can be exited');
  cv.rect = {left: 0, top: 0, width: 390, height: 650}; resizeCallback();
  cv.dispatch('pointerdown', pointer(210, 300)); cv.dispatch('pointermove', pointer(110, 355));
  window.dispatch('blur'); frame(); equal(api.input.drag, null, 'backgrounding cancels touch input');
  ok(api.paused, 'backgrounding pauses the game'); $('resume').click(); frame();
  $('pause').click(); $('transferPause').click();
  ok(!$('transferPanel').hidden && $('importProgressButton').disabled, 'ongoing game permits export but blocks import');
  const saveDuringPlay = JSON.stringify(api.game.save);
  $('importProgress').value = api.encodeProgress({...api.game.save, best: 100});
  $('importProgressButton').onclick();
  equal(JSON.stringify(api.game.save), saveDuringPlay, 'import handler also guards an active run');
  $('transferClose').click(); $('resume').click();
  $('touchFire').click(); frame(); equal(api.game.phase, 'flight', 'touch fire button starts a shot');
  ok($('touchControls').hidden, 'aim buttons disappear during flight');
  const flight = JSON.stringify([api.game.arrows, api.game.phase, api.game.round, api.game.active]);
  $('chooseDesktop').click(); $('chooseMobile').click();
  equal(JSON.stringify([api.game.arrows, api.game.phase, api.game.round, api.game.active]), flight, 'switching during flight preserves arrows and turn state');
  api.game.save.unlocked = true; api.game.start('rogue'); api.game.skip(); frame();
  ok($('skillButton').hidden, 'disabled skill button does not overlap aiming buttons');
  $('touchFire').click(); for (let i = 0; i < 12; i++) frame();
  ok(!$('skillButton').hidden && !$('skillButton').disabled, 'flight offers a tappable skill button');
  $('skillButton').click(); ok(api.game.skillUsed, 'touch skill button activates the selected bow');
  api.game.stats.fire = 2; api.game.stats.poison = 3;
  api.game.choices = [{id: 'fire', name: '焰羽', tag: '火焰', icon: '焰', desc: '强化火焰'}, {id: 'poison', name: '青毒', tag: '毒素', icon: '毒', desc: '强化毒素'}];
  api.game.setPhase('upgrade'); frame();
  ok($('upgradeCards').children[0].innerHTML.includes('2 → 3') && $('upgradeCards').children[1].innerHTML.includes('3 → 4'), 'repeated elemental choices show current and next tier benefits');
  api.game.complete(true); frame(); $('resultNext').click(); frame();
  equal($('routeCards').children.length, 2, 'upgrade screen offers two route buttons');
  const routeId = api.game.nextRoutes[1].id; $('routeCards').children[1].click();
  equal(api.game.selectedRoute, routeId, 'touching route ticket selects its physical encounter');
  equal($('routeCards').children[1].attributes['aria-pressed'], true, 'route selection is exposed accessibly');
  $('upgradeCards').children[0].click(); frame();
  equal(api.game.encounter.id, routeId, 'relic card begins the selected route without another menu');
  $('pause').click(); frame(); const originalFeedback = api.renderer.feedback.mode, beforeFeedback = JSON.stringify(api.game.save);
  $('feedbackMode').click(); ok(api.renderer.feedback.mode !== originalFeedback, 'pause button cycles camera feedback');
  equal(JSON.stringify(api.game.save), beforeFeedback, 'camera preference does not modify progress or cloud balance');
  $('feedbackMode').click(); $('feedbackMode').click(); equal(api.renderer.feedback.mode, originalFeedback, 'feedback cycle includes all three modes');
  $('resume').click(); frame();
  api.game.floor = 15; api.game.setup(); api.game.setPhase('scout'); frame();
  ok(!$('enemyTraits').hidden && $('enemyTraits').textContent.includes(' · '), 'late enemy combinations are shown during observation');
  ok($('sceneHint').hidden, 'generic hint does not overlap enemy abilities during observation');
  api.game.active = 1; api.game.readyTurn(); frame();
  equal(api.game.phase, 'flight', 'robot starts its shot without a thinking delay');
  api.game.players[0].status = {burn: 2, burnTurns: 2, poison: 12, poisonTurns: 3, ice: 0};
  api.game.emit('phase'); frame();
  ok($('status0').textContent.includes('12层') && $('status0').textContent.includes('余3轮'), 'HUD distinguishes accumulated poison stacks from remaining turns');
  ok($('status0').title.includes('60/轮') && $('inventory').textContent.includes('基础60/轮'), 'full elemental tick damage remains available in pause details');
}
const phone = {width: 390, height: 740, coarse: true}, desktop = {width: 1440, height: 900};
equal(resolveView('auto', phone).layout, 'mobile', 'auto recognizes phone');
equal(resolveView('auto', desktop).layout, 'desktop', 'auto recognizes desktop');
equal(resolveView('desktop', phone).layout, 'desktop', 'manual desktop wins');
equal(resolveView('mobile', desktop), {layout: 'mobile', handset: true, orientation: 'portrait'}, 'desktop mobile preview has a portrait handset shape');
equal(resolveView('mobile', {width: 844, height: 390, coarse: true}).orientation, 'landscape', 'mobile landscape follows touch device');
equal(validView('invalid'), 'auto', 'invalid preferences recover safely');
equal(readView({getItem() {throw Error('denied');}}), 'auto', 'unavailable storage defaults to auto');
ok(!writeView({setItem() {throw Error('denied');}}, 'mobile'), 'storage failure cannot block switching');
await appChecks(); await appChecks(true); await appChecks(false, 'desktop'); await appChecks(false, 'auto', true);
console.log(checks + ' mobile gesture and app-event checks passed (DOM adapter, not browser QA).');
