export const EMOTES = [{id: 'jump', duration: .85}, {id: 'flex', duration: 1.2}];
const bound = value => Math.max(0, Math.min(1, value));
const smooth = value => {const t = bound(value); return t * t * (3 - 2 * t);};

// Pose changes are cosmetic. They never move the gameplay body or hit boxes.
export function emotePose(pose, player, emote) {
  const copy = Object.fromEntries(Object.entries(pose).map(([key, point]) => [key, {...point}]));
  if (!emote) return copy;
  const t = emote.time, dir = player.dir;
  if (emote.kind === 'jump') {
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
