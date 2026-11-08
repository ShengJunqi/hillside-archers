// Small constrained body simulation. World coordinates, no DOM or game imports.
const limit = (v, min, max) => Math.max(min, Math.min(max, v));
const STEP = 1 / 120;
export const BODY_BONES = [
  ['head', 'chest', 'head', 42, 11], ['chest', 'hip', 'body', 26, 14],
  ['chest', 'elbowBack', 'arms', 22, 5], ['elbowBack', 'handBack', 'arms', 22, 5],
  ['chest', 'elbowFront', 'arms', 22, 5], ['elbowFront', 'handFront', 'arms', 22, 5],
  ['hip', 'kneeBack', 'legs', 18, 7], ['kneeBack', 'footBack', 'legs', 18, 7],
  ['hip', 'kneeFront', 'legs', 18, 7], ['kneeFront', 'footFront', 'legs', 18, 7],
];
export function standingPose(p, angle = 25, walk = 0, time = 0, drawn = false) {
  const a = angle * Math.PI / 180, d = p.dir, stride = Math.sin(time * 8) * walk;
  const hand = {x: d * 33 * Math.cos(a), y: -66 - 33 * Math.sin(a)};
  const points = {head: [0, -96], chest: [0, -73], hip: [0, -39],
    elbowBack: [-d * 21, drawn ? -79 : -55], handBack: [d * (drawn ? 12 : 20), -68],
    elbowFront: [hand.x * .48, -69 + (hand.y + 73) * .45], handFront: [hand.x, hand.y],
    kneeBack: [-8 + stride * 5, -23], footBack: [-13 + stride * 7, -5],
    kneeFront: [9 - stride * 5, -22], footFront: [13 - stride * 7, -5]};
  return Object.fromEntries(Object.entries(points).map(([key, [x, y]]) => [key, {x: p.x + x, y: p.y + y}]));
}
export function bodyPose(p, angle = 25, walk = 0, time = 0, drawn = false) {
  if (!p.body?.active) return standingPose(p, angle, walk, time, drawn);
  const dx = p.x - p.body.anchorX, dy = p.y - p.body.anchorY;
  return Object.fromEntries(Object.entries(p.body.nodes).map(([key, n]) => [key, {x: n.x + dx, y: n.y + dy}]));
}
function projection(point, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  const t = limit(((point.x - a.x) * dx + (point.y - a.y) * dy) / (len * len), 0, 1);
  const x = a.x + dx * t, y = a.y + dy * t;
  return {t, x, y, distance: Math.hypot(point.x - x, point.y - y), normal: ((point.x - x) * -dy + (point.y - y) * dx) / len, angle: Math.atan2(dy, dx)};
}
export function bodyCollision(point, p) {
  if (Math.abs(point.x - p.x) > 135 || point.y < p.y - 165 || point.y > p.y + 20) return null;
  const pose = bodyPose(p, p.poseAngle ?? 25);
  if (Math.hypot(point.x - pose.head.x, point.y - pose.head.y) <= 13) return {kind: 'hit', part: 'head', damage: 42};
  for (const name of ['footBack', 'footFront']) if (Math.hypot(point.x - pose[name].x, point.y - pose[name].y) <= 8) return {kind: 'hit', part: 'feet', damage: 12};
  for (const [a, b, part, damage, radius] of BODY_BONES.slice(1)) {
    if (projection(point, pose[a], pose[b]).distance <= radius) return {kind: 'hit', part, damage};
  }
  return null;
}
export function attachArrow(p, point, angle, aimAngle) {
  const pose = bodyPose(p, aimAngle);
  let closest;
  for (const [a, b] of BODY_BONES) {
    const hit = projection(point, pose[a], pose[b]);
    if (!closest || hit.distance < closest.distance) closest = {...hit, a, b};
  }
  return {a: closest.a, b: closest.b, along: closest.t, normal: closest.normal, angle: angle - closest.angle};
}
export function attachedArrowPose(arrow, pose) {
  const a = pose[arrow.a], b = pose[arrow.b];
  if (!a || !b) return null;
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  return {x: a.x + dx * arrow.along - dy / len * arrow.normal,
    y: a.y + dy * arrow.along + dx / len * arrow.normal, angle: Math.atan2(dy, dx) + arrow.angle};
}
export function impactBody(p, {point, vx, vy, damage, part, angle = 25}) {
  if (!p.body?.active) {
    const pose = standingPose(p, angle);
    p.body = {active: true, age: 0, hitAge: 0, accumulator: 0, anchorX: p.x, anchorY: p.y,
      nodes: Object.fromEntries(Object.entries(pose).map(([key, n]) => [key, {...n, px: n.x, py: n.y}])),
      lengths: BODY_BONES.map(([a, b]) => Math.hypot(pose[a].x - pose[b].x, pose[a].y - pose[b].y)), heavy: false};
  }
  const body = p.body, speed = Math.hypot(vx, vy) || 1, dx = vx / speed, dy = vy / speed;
  body.hitAge = 0; body.part = part; body.sleeping = false;
  body.heavy ||= damage >= 23 || p.hp <= 0;
  const force = limit(90 + damage * 3, 100, 230);
  for (const [key, n] of Object.entries(body.nodes)) {
    const proximity = Math.max(.08, 1 - Math.hypot(n.x - point.x, n.y - point.y) / 85);
    const foot = key.startsWith('foot'), lift = body.heavy ? 38 : 10;
    n.px -= dx * force * (.22 + proximity * 1.4) * STEP;
    n.py -= (dy * force * proximity - lift * (foot ? .3 : 1)) * STEP;
  }
}
export function updateBody(p, dt, terrain, width = 1600) {
  const body = p.body;
  if (!body?.active || body.sleeping) return;
  body.accumulator += dt;
  while (body.accumulator >= STEP) {
    body.accumulator -= STEP; body.age += STEP; body.hitAge += STEP;
    const alive = p.hp > 0, recovery = alive ? limit((body.hitAge - (body.heavy ? .85 : .16)) / .9, 0, 1) : 0;
    const desired = standingPose(p);
    for (const [key, n] of Object.entries(body.nodes)) {
      const vx = (n.x - n.px) * (recovery ? .8 : .98), vy = (n.y - n.py) * .98;
      n.px = n.x; n.py = n.y; n.x += vx; n.y += vy + 1050 * STEP * STEP;
      if (recovery) {const strength = recovery * .12; n.x += (desired[key].x - n.x) * strength; n.y += (desired[key].y - n.y) * strength;}
    }
    for (let pass = 0; pass < 7; pass++) {
      BODY_BONES.forEach(([a, b], i) => {
        const one = body.nodes[a], two = body.nodes[b], dx = two.x - one.x, dy = two.y - one.y;
        const distance = Math.hypot(dx, dy) || 1, correction = (distance - body.lengths[i]) / distance * .5;
        one.x += dx * correction; one.y += dy * correction; two.x -= dx * correction; two.y -= dy * correction;
      });
      for (const [key, n] of Object.entries(body.nodes)) {
        n.x = limit(n.x, 10, width - 10);
        const radius = key === 'head' ? 12 : key === 'hip' || key === 'chest' ? 9 : 4;
        const floor = terrain(n.x) - radius;
        if (n.y > floor) {n.y = floor; n.py = floor; n.px += (n.x - n.px) * .3;}
      }
    }
    const nextX = limit(body.nodes.hip.x, Math.max(55, (p.homeX ?? p.x) - 85), Math.min(width - 55, (p.homeX ?? p.x) + 85));
    const shift = nextX - body.nodes.hip.x;
    if (shift) for (const n of Object.values(body.nodes)) {n.x += shift; n.px += shift;}
    p.x = nextX; p.y = terrain(p.x); body.anchorX = p.x; body.anchorY = p.y;
    if (alive && body.hitAge >= (body.heavy ? 2.1 : 1.25)) {body.active = false; break;}
    // A corpse keeps its articulated resting pose without simulating forever.
    if (!alive && body.hitAge > 4) {body.accumulator = 0; body.sleeping = true; return;}
  }
}
