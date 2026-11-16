export const EMOTES = [{id: 'bowspin', duration: .9}, {id: 'shadowstep', duration: .82}, {id: 'skycut', duration: .98}];
const bound = value => Math.max(0, Math.min(1, value));
const smooth = value => {const t = bound(value); return t * t * (3 - 2 * t);};

// Everything here is a visual copy. These flourishes never move the gameplay
// root, joints, hitboxes, arrows or random sequence.
export function emoteMotion(emote, reducedMotion = false) {
  if (!emote) return {progress: 0, strength: 0, bowTurn: 0, catch: 0};
  const progress = bound((Number(emote.time) || 0) / (emote.duration || EMOTES.find(e => e.id === emote.kind)?.duration || 1));
  if (reducedMotion) return {progress, strength: 1, bowTurn: 0, catch: 0};
  const strength = progress >= 1 ? 0 : Math.sin(progress * Math.PI);
  const spin = smooth((progress - .08) / .7);
  return {progress, strength,
    bowTurn: emote.kind === 'bowspin' ? spin * Math.PI * 2 : emote.kind === 'shadowstep' ? -.6 * strength : emote.kind === 'skycut' ? -1.18 * Math.sin(smooth(progress) * Math.PI) : 0,
    catch: emote.kind === 'bowspin' ? Math.max(0, 1 - Math.abs(progress - .8) / .1) : 0};
}

export function emotePose(pose, player, emote, reducedMotion = false) {
  const copy = Object.fromEntries(Object.entries(pose).map(([key, point]) => [key, {...point}]));
  if (!emote) return copy;
  const t = emote.time, dir = player.dir;
  const blend = (key, x, y, strength) => {
    copy[key].x += (player.x + dir * x - copy[key].x) * strength;
    copy[key].y += (player.y + y - copy[key].y) * strength;
  };
  if (['bowspin', 'shadowstep', 'skycut'].includes(emote.kind)) {
    if (reducedMotion) {
      blend('elbowBack', -22, -61, 1); blend('handBack', -8, -88, 1);
      blend('elbowFront', 20, -62, 1); blend('handFront', 34, -66, 1);
      return copy;
    }
    const {progress, strength} = emoteMotion(emote);
    if (emote.kind === 'bowspin') {
      const orbit = smooth((progress - .08) / .65) * Math.PI * 2;
      blend('elbowFront', 16 + Math.sin(orbit) * 6, -66, strength);
      blend('handFront', 31 + Math.sin(orbit) * 12, -81 - Math.cos(orbit) * 16, strength);
      blend('elbowBack', -26, -58, strength); blend('handBack', -13, -43, strength);
      copy.head.x -= dir * strength * 6; copy.chest.x -= dir * strength * 3;
      copy.head.y -= strength * 3;
    } else if (emote.kind === 'shadowstep') {
      for (const point of Object.values(copy)) point.x += dir * strength * 16;
      copy.hip.y += strength * 11; copy.chest.y += strength * 13; copy.head.y += strength * 10;
      copy.head.x += dir * strength * 8; copy.chest.x += dir * strength * 5;
      blend('kneeBack', -23, -17, strength); blend('footBack', -29, -1, strength);
      blend('kneeFront', 29, -14, strength); blend('footFront', 42, 0, strength);
      blend('elbowFront', 24, -58, strength); blend('handFront', 44, -73, strength);
      blend('elbowBack', -18, -57, strength); blend('handBack', -10, -83, strength);
    } else {
      const sweep = Math.sin(smooth(progress) * Math.PI);
      blend('elbowFront', 25, -80, sweep); blend('handFront', 31, -119, sweep);
      blend('elbowBack', -25, -63, strength); blend('handBack', -35, -83, strength);
      copy.head.y -= sweep * 7; copy.chest.y -= sweep * 5; copy.hip.y -= sweep * 2;
      copy.head.x += dir * sweep * 3;
    }
  // Legacy poses are retained for old visual fixtures and story callers.
  } else if (emote.kind === 'jump') {
    const crouch = t < .12 ? Math.sin(t / .12 * Math.PI) * 8 : t > .67 ? Math.sin(bound((t - .67) / .18) * Math.PI) * 6 : 0;
    const air = Math.sin(bound((t - .12) / .55) * Math.PI), lift = Math.max(0, air) * 35;
    for (const point of Object.values(copy)) point.y -= lift;
    for (const key of ['head', 'chest', 'hip']) copy[key].y += crouch;
    copy.kneeBack.x -= dir * air * 7; copy.kneeFront.x += dir * air * 7;
    copy.footBack.y -= air * 9; copy.footFront.y -= air * 4;
    copy.handBack.y -= air * 13;
  } else if (emote.kind === 'flex') {
    const strength = smooth(t / .2) * (1 - smooth((t - .85) / .35));
    const target = {elbowBack: [-dir * 36, -69], handBack: [-dir * 26, -99],
      elbowFront: [dir * 24, -57], handFront: [dir * 31, -41]};
    for (const [key, [x, y]] of Object.entries(target)) {
      copy[key].x += (player.x + x - copy[key].x) * strength;
      copy[key].y += (player.y + y - copy[key].y) * strength;
    }
    copy.chest.y -= strength * 3; copy.head.y -= strength * 3;
    copy.head.x += dir * strength * 2;
  }
  return copy;
}
