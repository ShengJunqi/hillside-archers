// Only computer opponents use these limits; local players keep full arrow scaling.
export function opponentProfile(mode, stage = 1, floor = 1, playerMaxHp = 100) {
  if (mode === 'rogue') {
    const boss = floor % 3 === 0;
    const depth = Math.max(0, floor - 6), health = Math.max(100, playerMaxHp);
    const basicCap = Math.min(42, 26 + (floor - 1) * 2 + (boss ? 2 : 0));
    return {damage: Math.min(1.5, .62 + (floor - 1) * .018 + depth * .025),
      volleyCap: Math.floor(Math.min(health * .42, basicCap + (health - 100) * Math.min(.16, depth * .02))),
      error: Math.max(3, 5.5 - floor * .12 - (boss ? 1 : 0)), boss};
  }
  const chapter = Math.max(1, Math.min(3, stage));
  return {damage: [.6, .65, .7][chapter - 1], volleyCap: [24, 28, 30][chapter - 1],
    error: [9, 7, 6][chapter - 1], boss: false};
}

// Early floors keep their familiar opponents. Deeper encounters combine attack,
// sustain and selective cleansing instead of giving every enemy immunity.
export function rogueEnemyStats(floor, base) {
  const depth = Math.max(0, floor - 6), boss = floor % 3 === 0;
  const stats = {...base, maxHp: 100 + (floor - 1) * 16 + depth * depth * (boss ? 8 : 6)};
  if (floor >= 4 && floor < 7) {
    if (floor % 3 === 1) stats.poison = 1;
    if (floor % 3 === 2) stats.fire = 1;
  }
  if (floor >= 7) {
    const rank = 1 + Math.floor((floor - 7) / 9);
    if (floor % 3 === 1) Object.assign(stats, {fire: rank, poison: rank, pierce: 1 + Math.floor(rank / 3)});
    if (floor % 3 === 2) Object.assign(stats, {ice: Math.min(3, rank), armor: Math.min(3, rank), regen: rank, cleanse: floor >= 14 ? .25 : 0});
    if (floor % 3 === 0) Object.assign(stats, {fire: rank, poison: rank, ice: Math.min(3, Math.ceil(rank / 2)), regen: rank, leech: Math.min(.24, rank * .06), cleanse: floor >= 12 ? .25 : 0});
    if (floor >= 16 && floor % 3 === 1) stats.leech = Math.min(.24, rank * .06);
    if (floor >= 15) stats.multi = 2;
  }
  if (boss) {
    stats.maxHp += 30 + depth * 5;
    stats.multi = floor >= 24 ? 4 : floor >= 12 ? 3 : 2;
    stats.armor = Math.min(3, 1 + Math.floor(depth / 9));
  }
  return stats;
}

// Existing characters remain the defaults. Adding a character does not replace
// the selected bow, acquired relics or the save format.
export const CHARACTERS = [
  {id: 'qingsong', name: '青松', playable: true, initialSkills: ['composure'], description: '沉着：首次危急时，在自己的回合回复 10 点生命。'},
  {id: 'chiyan', name: '赤岩', playable: false, initialSkills: ['composure'], description: '沉着：首次危急时，在自己的回合回复 10 点生命。'},
  {id: 'panshi', name: '磐石', playable: true, initialSkills: ['heavystring'], description: '重弦：射出的箭造成的击退提高 20%，不额外增加伤害。',
    palette: {cloak:'#c69a4c',fold:'#756247',rim:'#f0d69b',cloth:'#dedbc8',leather:'#665243',skin:'#dbad84',hair:'#414b4a'}},
  {id: 'lingque', name: '灵雀', playable: true, initialSkills: ['lightgather'], description: '拾光：每场首次带伤拾球，额外回复 8 点生命；满血时保留。',
    palette: {cloak:'#6d9e81',fold:'#3e6658',rim:'#e7d092',cloth:'#f0eadb',leather:'#74604d',skin:'#edbc93',hair:'#3d5356'}},
];
export function characterById(id) {return CHARACTERS.find(c => c.id === id) || CHARACTERS[0];}
export function createSkillState(characterId) {
  return {initial: [...characterById(characterId).initialSkills], used: [], extra: []};
}
export function turnSkillHealing(player) {
  const skills = player.skills;
  if (player.hp > 0 && player.hp <= player.stats.maxHp * .35 &&
      skills?.initial.includes('composure') && !skills.used.includes('composure')) {
    skills.used.push('composure'); return 10;
  }
  return 0;
}

// Passive knockback only: the caller applies this multiplier to the impact,
// never to damage, arrow count, aiming accuracy or the NPC volley budget.
export function hitKnockbackScale(player) {
  return Array.isArray(player?.skills?.initial)&&player.skills.initial.includes('heavystring')?1.2:1;
}

// The first pickup while injured earns the bonus. The caller applies normal
// heart healing first; a full recovery keeps this charge for a later pickup.
// Returned healing still goes through Game.heal(); previews must not call it.
export function pickupSkillHealing(player) {
  const skills=player?.skills;
  if(!(player?.hp>0&&player.hp<player.stats?.maxHp)||!Array.isArray(skills?.initial)||!skills.initial.includes('lightgather')||Array.isArray(skills.used)&&skills.used.includes('lightgather'))return 0;
  if(!Array.isArray(skills.used))skills.used=[];
  skills.used.push('lightgather');return 8;
}
