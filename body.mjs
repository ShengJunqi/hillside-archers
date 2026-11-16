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
const LEG_LENGTHS = {
  Back: [Math.hypot(8, 16), Math.hypot(5, 18)],
  Front: [Math.hypot(9, 17), Math.hypot(4, 17)],
};
// Store sampled contact data, not a terrain closure. Standing feet use the
// actual two ground points; a steep bank narrows the stance instead of growing
// one leg. The hip/head remain at their ordinary heights above the station.
export function syncGroundContact(p, groundAt) {
  const y = groundAt(p.x), slope = (groundAt(p.x + 3) - groundAt(p.x - 3)) / 6;
  p.groundSlope = Number.isFinite(slope) ? slope : 0;
  const contact = {x: p.x, y};
  for (const [name, direction] of [['Back', -1], ['Front', 1]]) {
    let offset = 13 * direction, footY = y - 5;
    for (let i = 0; i < 18; i++) {
      footY = groundAt(p.x + offset) - 5;
      if (Math.hypot(offset, footY - (y - 39)) <= LEG_LENGTHS[name][0] + LEG_LENGTHS[name][1] - .05) break;
      offset *= .76;
    }
    const key = name.toLowerCase();contact[key + 'X'] = p.x + offset; contact[key + 'Y'] = footY;
  }
  p.groundContact = contact;
  return p.groundContact;
}
function standingKnee(hip, foot, lengths, bend) {
  const dx = foot[0] - hip[0], dy = foot[1] - hip[1], actual = Math.hypot(dx, dy) || 1;
  const distance = limit(actual, Math.abs(lengths[0] - lengths[1]) + .001, lengths[0] + lengths[1] - .001);
  const along = (lengths[0] ** 2 - lengths[1] ** 2 + distance ** 2) / (2 * distance);
  const height = Math.sqrt(Math.max(0, lengths[0] ** 2 - along ** 2));
  const ux = dx / actual, uy = dy / actual;
  return [hip[0] + ux * along - uy * height * bend, hip[1] + uy * along + ux * height * bend];
}
export function standingPose(p, angle = 25, walk = 0, time = 0, drawn = false) {
  const a = angle * Math.PI / 180, d = p.dir, stride = Math.sin(time * 8) * walk;
  const hand = {x: d * 33 * Math.cos(a), y: -66 - 33 * Math.sin(a)};
  const points = {head: [0, -96], chest: [0, -73], hip: [0, -39],
    elbowBack: [-d * 21, drawn ? -79 : -55], handBack: [d * (drawn ? 12 : 20), -68],
    elbowFront: [hand.x * .48, -69 + (hand.y + 73) * .45], handFront: [hand.x, hand.y],
    kneeBack: [-8 + stride * 5, -23], footBack: [-13 + stride * 7, -5],
    kneeFront: [9 - stride * 5, -22], footFront: [13 - stride * 7, -5]};
  const contact = p.groundContact;
  if (!walk && contact && Math.abs(contact.x - p.x) < .001 && Math.abs(contact.y - p.y) < .001) {
    points.footBack = [contact.backX - p.x, contact.backY - p.y];
    points.footFront = [contact.frontX - p.x, contact.frontY - p.y];
    points.kneeBack = standingKnee(points.hip, points.footBack, LEG_LENGTHS.Back, 1);
    points.kneeFront = standingKnee(points.hip, points.footFront, LEG_LENGTHS.Front, -1);
  } else {
    const slope = limit(Number.isFinite(p.groundSlope) ? p.groundSlope : 0, -.8, .8);
    for (const [key, point] of Object.entries(points)) if (key.startsWith('foot')) point[1] += point[0] * slope; else if (key.startsWith('knee')) point[1] += point[0] * slope * .45;
  }
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
export function bodyCollision(point, p, allowedParts = null) {
  const active = p.body?.active;
  if (!active && (Math.abs(point.x - p.x) > 135 || point.y < p.y - 165 || point.y > p.y + 36)) return null;
  if (active) {
    // A falling head or foot can be below the station/root. Broad-phase the
    // same current nodes that are rendered, including any anchor translation.
    // Check the raw nodes first so distant arrows do not allocate a full pose.
    const dx = p.x - p.body.anchorX, dy = p.y - p.body.anchorY, margin = 14;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const key in p.body.nodes) {
      const n = p.body.nodes[key], x = n.x + dx, y = n.y + dy;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    if (point.x < minX - margin || point.x > maxX + margin || point.y < minY - margin || point.y > maxY + margin) return null;
  }
  const pose = bodyPose(p, p.poseAngle ?? 25);
  if ((!allowedParts || allowedParts.has('head')) && Math.hypot(point.x - pose.head.x, point.y - pose.head.y) <= 13) return {kind: 'hit', part: 'head', damage: 42};
  if (!allowedParts || allowedParts.has('feet')) for (const name of ['footBack', 'footFront']) if (Math.hypot(point.x - pose[name].x, point.y - pose[name].y) <= 8) return {kind: 'hit', part: 'feet', damage: 12};
  for (const [a, b, part, damage, radius] of BODY_BONES.slice(1)) {
    if (allowedParts && !allowedParts.has(part)) continue;
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
// A reaction moves the player's actual station. The ragdoll then settles and
// stands at that new position; there is no spring back to the spawn point.
export function impactBody(p, {point, vx, vy, damage, part, angle = 25, volleyId = null, forceScale = 1}) {
  if (!p.body?.active) {
    const pose = standingPose(p, angle);
    p.body = {active: true, age: 0, hitAge: 0, accumulator: 0, anchorX: p.x, anchorY: p.y,
      originX: p.x, rootX: p.x, rootY: p.y, rootVX: 0, rootVY: 0, hits: 0,
      nodes: Object.fromEntries(Object.entries(pose).map(([key, n]) => [key, {...n, px: n.x, py: n.y}])),
      lengths: BODY_BONES.map(([a, b]) => Math.hypot(pose[a].x - pose[b].x, pose[a].y - pose[b].y)), heavy: false};
  }
  const body = p.body, speed = Math.hypot(vx, vy) || 1, dx = vx / speed, dy = vy / speed;
  const direction = Math.abs(dx) > .08 ? Math.sign(dx) : -(p.dir || 1);
  const dealt = limit(Number.isFinite(damage) ? damage : 0, 0, 100);
  const head = part === 'head', trip = part === 'legs' || part === 'feet';
  const partScale = head ? 1.42 : part === 'body' ? 1 : part === 'arms' ? .82 : part === 'legs' ? .78 : .65;
  const pushScale = limit(Number.isFinite(forceScale) ? forceScale : 1, .5, 1.75);
  const distance = limit((18 + dealt * 1.22) * partScale, 21, 114) * pushScale;
  body.hitAge = 0; body.part = part; body.sleeping = false; body.hits++;
  body.heavy ||= head || dealt >= 23 || p.hp <= 0;
  // The caller can supply a stable volley id so late-arriving arrows still
  // share a displacement boundary, even if the first reaction has recovered.
  if (volleyId !== null) {
    if (p.knockbackVolley?.id !== volleyId) p.knockbackVolley = {id: volleyId, originX: p.x};
    body.originX = p.knockbackVolley.originX;
  }
  const repeat = 1 / (1 + Math.max(0, body.hits - 1) * .8);
  body.rootVX = limit(body.rootVX + direction * distance * 4.8 * repeat, -620, 620);
  const lift = head ? 255 + dealt * .6 : trip ? 110 + dealt * .7 : 165 + dealt * 1.15;
  body.rootVY = Math.min(body.rootVY, -limit(lift * (body.hits === 1 ? 1 : .55), 70, 295));
  const force = limit(100 + dealt * 3, 110, 260) * repeat * pushScale;
  const pivot = body.nodes.hip, torque = direction * (head ? 4.5 : trip ? -3.4 : 2.25) * repeat * pushScale;
  for (const [key, n] of Object.entries(body.nodes)) {
    const proximity = Math.max(.08, 1 - Math.hypot(n.x - point.x, n.y - point.y) / 85);
    const foot = key.startsWith('foot'), liftNode = head ? 55 : trip ? 20 : 35;
    const tangentX = -(n.y - pivot.y) * torque, tangentY = (n.x - pivot.x) * torque;
    n.px -= (dx * force * (.12 + proximity * .8) + tangentX) * STEP;
    n.py -= (dy * force * proximity - liftNode * (foot ? .35 : 1) + tangentY) * STEP;
  }
}
export function updateBody(p, dt, terrain, width = 1600, options = {}) {
  const body = p.body;
  if (!body?.active || body.sleeping) {syncGroundContact(p, terrain); return;}
  // The view width is retained for legacy callers; extended arenas declare
  // their own world coordinates, including retreat ground left of zero.
  // Root and joint bounds must use the same extent or a crossing body tears
  // back toward the old view edge while its station continues moving.
  const worldMin = Number.isFinite(options.worldMinX) ? options.worldMinX : 0;
  const worldMax = Math.max(worldMin + 110, Number.isFinite(options.worldMaxX) ? options.worldMaxX : width);
  const lower = limit(Number.isFinite(options.minX) ? options.minX : worldMin + 55, worldMin + 55, worldMax - 55);
  const upper = limit(Number.isFinite(options.maxX) ? options.maxX : worldMax - 55, worldMin + 55, worldMax - 55);
  const minX = Math.min(lower, upper), maxX = Math.max(lower, upper);
  const obstacles = (options.obstacles || []).filter(o => o.state === 'standing');
  body.accumulator += Math.min(Math.max(0, dt), .1);
  while (body.accumulator >= STEP) {
    body.accumulator -= STEP; body.age += STEP; body.hitAge += STEP;
    const alive = p.hp > 0, delay = body.heavy ? .72 : .3;
    const recovery = alive ? limit((body.hitAge - delay) / .82, 0, 1) : 0;
    const oldX = body.rootX, oldY = body.rootY;
    const standingFloor = terrain(body.rootX), grounded = body.rootY >= standingFloor - .4;
    const slope = (terrain(body.rootX + 3) - terrain(body.rootX - 3)) / 6;
    if (grounded && recovery < .8) body.rootVX += limit(slope, -1.2, 1.2) * 240 * STEP * (1 - recovery);
    body.rootVX *= Math.exp(-(grounded ? 8 : 5) * STEP);
    // Multi-arrow hits can add visible flinches, but cannot push a target
    // indefinitely or off the world. Each volley/reaction has a 140px envelope.
    let lo = Math.max(minX, body.originX - 140), hi = Math.min(maxX, body.originX + 140);
    if (lo > hi) lo = hi = limit(body.originX, minX, maxX);
    body.rootX = limit(body.rootX + body.rootVX * STEP, lo, hi);
    if (body.rootX === lo || body.rootX === hi) body.rootVX = 0;
    for (const o of obstacles) {
      const left = o.x - o.w / 2 - 23, right = o.x + o.w / 2 + 23;
      if (body.rootX > left && body.rootX < right && body.rootY > o.y - o.h - 4 && body.rootY - 106 < o.y + 4) {
        body.rootX = oldX <= left ? left : oldX >= right ? right : Math.abs(oldX - left) < Math.abs(oldX - right) ? left : right;
        body.rootX = limit(body.rootX, lo, hi); body.rootVX = 0;
      }
    }
    body.rootVY += 950 * STEP;
    body.rootY += body.rootVY * STEP;
    const floor = terrain(body.rootX);
    if (body.rootY >= floor) {body.rootY = floor; body.rootVY = 0;}
    body.airborne = body.rootY < floor - 1;
    const rootDX = body.rootX - oldX, rootDY = body.rootY - oldY;
    for (const n of Object.values(body.nodes)) {n.x += rootDX; n.px += rootDX; n.y += rootDY; n.py += rootDY;}
    p.x = body.rootX; p.y = body.rootY; syncGroundContact(p, terrain); body.anchorX = p.x; body.anchorY = p.y;
    const desired = standingPose({...p, y: floor}, p.poseAngle ?? 25);
    for (const [key, n] of Object.entries(body.nodes)) {
      const vx = (n.x - n.px) * (recovery ? .8 : .982), vy = (n.y - n.py) * .982;
      n.px = n.x; n.py = n.y; n.x += vx; n.y += vy + 900 * STEP * STEP;
      if (recovery) {const strength = recovery * .15; n.x += (desired[key].x - n.x) * strength; n.y += (desired[key].y - n.y) * strength;}
    }
    for (let pass = 0; pass < 9; pass++) {
      BODY_BONES.forEach(([a, b], i) => {
        const one = body.nodes[a], two = body.nodes[b], dx = two.x - one.x, dy = two.y - one.y;
        const distance = Math.hypot(dx, dy) || 1, correction = (distance - body.lengths[i]) / distance * .5;
        one.x += dx * correction; one.y += dy * correction; two.x -= dx * correction; two.y -= dy * correction;
      });
      for (const [key, n] of Object.entries(body.nodes)) {
        n.x = limit(n.x, worldMin + 10, worldMax - 10);
        const radius = key === 'head' ? 12 : key === 'hip' || key === 'chest' ? 9 : 4;
        const floorNode = terrain(n.x) - radius;
        if (n.y > floorNode) {n.y = floorNode; n.py = floorNode; n.px += (n.x - n.px) * .35;}
        for (const o of obstacles) {
          const left = o.x - o.w / 2 - radius, right = o.x + o.w / 2 + radius, top = o.y - o.h - radius, bottom = o.y + radius;
          if (n.x <= left || n.x >= right || n.y <= top || n.y >= bottom) continue;
          const toLeft = n.x - left, toRight = right - n.x, toTop = n.y - top;
          if (toTop <= Math.min(toLeft, toRight) && n.py <= top + radius * 2) {n.y = top; n.py = top;}
          else {n.x = toLeft < toRight ? left : right; n.px = n.x;}
        }
      }
    }
    // Recovery duration is bounded even when a large volley adds many flinches.
    if (alive && (body.hitAge >= (body.heavy ? 1.8 : 1.3) || body.age >= 3.25)) {
      body.active = false; body.airborne = false; body.rootVX = 0; body.rootVY = 0;
      p.x = limit(body.rootX, minX, maxX); p.y = terrain(p.x); p.homeX = p.x; body.anchorX = p.x; body.anchorY = p.y;
      syncGroundContact(p, terrain);
      break;
    }
    if (!alive && body.hitAge > 4) {body.accumulator = 0; body.sleeping = true; return;}
  }
}
