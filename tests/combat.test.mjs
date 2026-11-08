import assert from 'node:assert/strict';
import {Game, ground, launch, position, trace} from '../dist/core.mjs';
import {opponentProfile, characterById} from '../dist/combat.mjs';
import {BODY_BONES, bodyPose, bodyCollision, impactBody, updateBody, attachArrow, attachedArrowPose} from '../dist/body.mjs';
let checks = 0;
const ok = (v, m) => {assert.ok(v, m); checks++;};
const eq = (a, b, m) => {assert.deepEqual(a, b, m); checks++;};
const create = (mode = 'campaign', stage = 1) => {const g = new Game({save: {unlocked: true}, rng: () => .5}); g.start(mode, stage); return g;};
const hit = (g, part = 'head', damage = 42) => {
  const p = g.players[1 - g.active];
  g.hitTarget({...launch(g.players[g.active], 25), t: .5}, {part, damage}, {x: p.x, y: p.y - (part === 'head' ? 96 : 60)});
};

// Regression: two +1 balls yield three arrows, but the computer cannot erase a
// full health bar with three head contacts in the same volley.
for (const stage of [1, 2, 3]) {
  const g = create('campaign', stage); g.active = 1; g.phase = 'thinking'; g.shoot();
  const b = g.arrows[0], pt = position(b, .4);
  for (let i = 0; i < 2; i++) g.pickup({type: 'plus', used: false, ...pt}, b, pt);
  eq(g.volleyCount, 3, 'NPC still gains both +1 arrows in chapter ' + stage);
  hit(g); const firstDamage = g.lastDamage; hit(g); const extraDamage = g.lastDamage; hit(g);
  ok(g.players[0].hp >= 100 - [24, 28, 30][stage - 1], 'three head contacts respect chapter volley limit');
  ok(extraDamage < firstDamage, 'successive headshot damage is reduced');
  ok(Math.abs(g.arrows[1].vy - (b.vy + 155 * b.t)) >= 20, 'NPC extra arrow spreads away from original');
}
{
  const g = create('campaign', 3); g.active = 1; g.phase = 'thinking'; g.obs = []; g.angles[1] = 29;
  g.shoot(); const origin = launch(g.players[1], 29);
  g.orbs = [.6, 1.2].map(t => ({...position(origin, t), type: 'plus', used: false, r: 25}));
  for (let i = 0; i < 1200 && ['flight', 'settle'].includes(g.phase); i++) g.update(1 / 60);
  eq(g.volleyCount, 3, 'real flight passes two balls and creates exactly three arrows');
  ok(g.orbs.filter(o => o.used).length === 0 || g.round === 2, 'pickup cleanup occurs on the next turn');
  ok(g.players[0].hp >= 70, 'real NPC volley leaves room to counterattack');
  eq(g.active, 0, 'all projectiles and recovery finish before human turn');
  ok(!g.players[0].body?.active, 'human starts next turn standing');
}
for (const mode of ['campaign', 'rogue', 'duel']) {
  const g = create(mode, 3); g.active = 1; g.phase = 'thinking';
  Object.assign(g.players[1].stats, {multi: 8, fire: 4, poison: 5, crit: 1, damage: 10});
  g.shoot(); for (let i = 0; i < 24; i++) hit(g);
  const hp = g.players[0].hp; g.nextTurn();
  ok(100 - g.players[0].hp <= g.opponent.volleyCap, 'multishot, crit and next-turn status ticks share NPC budget: ' + mode);
  ok(hp > 0 && g.players[0].hp > 0, 'extreme NPC burst leaves player alive: ' + mode);
}
{
  const g = create('local'); g.active = 1; g.phase = 'aim'; g.shoot(); hit(g); hit(g); hit(g);
  eq(g.players[0].hp, 0, 'local player two keeps full headshot damage');
  const player = create('campaign', 3); player.phase = 'aim'; player.shoot(); hit(player); hit(player); hit(player);
  eq(player.players[1].hp, 0, 'player volleys are not capped');
}
{
  const g = create('campaign', 3);
  for (let turn = 0; turn < 3; turn++) {g.active = 1; g.phase = 'thinking'; g.shoot(); hit(g); hit(g); hit(g);}
  eq(g.players[0].hp, 10, 'even three maximized chapter-three NPC volleys do not kill a full-health player');
  const boss = opponentProfile('rogue', 3, 3), normal = opponentProfile('rogue', 3, 2);
  ok(boss.volleyCap > normal.volleyCap && boss.error < normal.error, 'guardians retain stronger but bounded pressure');
  const rogue = create('rogue'); rogue.floor = 3; rogue.setup();
  eq(rogue.players[1].stats.multi, 2, 'guardian keeps its two-arrow attack');
  ok(rogue.players[1].hp > 130 && rogue.players[1].hp < 180, 'guardian is durable without the old health spike');
}
{
  const g = create('campaign', 3), angle = g.chooseAI();
  const hit = trace(g.players[1], g.players[0], angle, g.obs, g.map);
  ok(angle > 45 && hit.kind === 'hit' && hit.part !== 'head', 'AI can choose high body route when low cover only exposes the head');
}

// Initial character skills, weapon skills and acquired upgrades have separate
// state. They survive floor changes without leaking into a new run.
{
  const g = create('rogue'); g.players[0].hp = 30; g.skip();
  eq(g.players[0].hp, 40, 'initial composure skill heals on own turn');
  g.players[0].hp = 20; g.readyTurn(); eq(g.players[0].hp, 20, 'initial skill activates only once per encounter');
  g.phase = 'upgrade'; g.choices = [{id: 'fire'}]; g.chooseUpgrade('fire');
  eq(g.players[0].skills.initial, ['composure'], 'initial skills remain after relic');
  eq(g.players[0].skills.extra, ['fire'], 'relic recorded separately');
  eq(g.players[0].skills.weapon, 'split', 'relic does not replace bow skill');
  eq(g.players[0].skills.used, [], 'initial skill refreshes in next encounter');
  g.start('rogue', 1, 'dive', 'invalid'); eq(g.characterId, 'qingsong', 'unknown character falls back without breaking old saves');
  eq(g.players[0].skills.extra, [], 'fresh run clears acquired skills');
  eq(g.players[0].skills.weapon, 'dive', 'selected bow remains independent of character');
  ok(characterById('chiyan').initialSkills.length > 0, 'second existing character has explicit initial skills');
}

// Independent articulated reactions, terrain contacts and recoverability.
for (const map of [0, 1, 2]) for (const [part, height, damage] of [['head', 96, 42], ['body', 60, 26], ['arms', 73, 22], ['legs', 25, 18], ['feet', 5, 12]]) {
  const p = {x: 800, homeX: 800, y: ground(800, map), dir: 1, hp: 100};
  const start = bodyPose(p), point = {x: p.x, y: p.y - height};
  impactBody(p, {point, vx: 450, vy: 30, damage, part});
  const arrow = attachArrow(p, point, .1, 25);
  for (let i = 0; i < 24; i++) updateBody(p, 1 / 120, x => ground(x, map));
  const pose = bodyPose(p);
  const arm = pose.handFront.x - start.handFront.x, leg = pose.footBack.x - start.footBack.x;
  ok(Math.hypot(arm - leg, (pose.handFront.y - start.handFront.y) - (pose.footBack.y - start.footBack.y)) > 1, part + ' drives separate limb motion on map ' + map);
  ok(p.x > 800 && p.x <= 885, 'impact knocks body back within arena bounds');
  ok(bodyCollision(pose.head, p)?.part === 'head', 'hit testing follows moving head');
  const stuck = attachedArrowPose(arrow, pose);
  ok(Number.isFinite(stuck.x) && Math.hypot(stuck.x - point.x, stuck.y - point.y) > 1, 'embedded arrow follows struck bone');
  for (let i = 0; i < 300; i++) updateBody(p, 1 / 120, x => ground(x, map));
  ok(!p.body.active, 'living character recovers rather than losing a turn');
  eq(p.y, ground(p.x, map), 'recovered feet return to terrain');
}
for (const x of [60, 1540]) {
  const p = {x, homeX: x, y: ground(x, 2), dir: x < 800 ? 1 : -1, hp: 0};
  impactBody(p, {point: {x, y: p.y - 96}, vx: x < 800 ? -800 : 800, vy: -100, damage: 100, part: 'head'});
  for (let i = 0; i < 700; i++) updateBody(p, 1 / 120, xx => ground(xx, 2));
  ok(p.body.active && p.body.sleeping, 'fallen defeated body remains articulated at rest');
  for (const n of Object.values(p.body.nodes)) ok(Number.isFinite(n.x) && Number.isFinite(n.y) && n.y <= ground(n.x, 2) + 1, 'resting joint cannot sink through terrain');
  const snapshot = JSON.stringify(p.body.nodes); updateBody(p, .05, xx => ground(xx, 2));
  eq(JSON.stringify(p.body.nodes), snapshot, 'resting corpse does not jitter forever');
  const maxError = Math.max(...BODY_BONES.map(([a, b], i) => Math.abs(Math.hypot(p.body.nodes[a].x - p.body.nodes[b].x, p.body.nodes[a].y - p.body.nodes[b].y) - p.body.lengths[i])));
  ok(maxError < 5, 'constraints keep all limbs connected');
}
console.log(checks + ' fair-combat, character-skill and articulated-body checks passed.');
