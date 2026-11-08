// Only computer opponents use these limits; local players keep full arrow scaling.
export function opponentProfile(mode, stage = 1, floor = 1) {
  if (mode === 'rogue') {
    const boss = floor % 3 === 0;
    return {damage: Math.min(.92, .62 + (floor - 1) * .018),
      volleyCap: Math.min(42, 26 + (floor - 1) * 2 + (boss ? 2 : 0)),
      error: Math.max(3, 5.5 - floor * .12 - (boss ? 1 : 0)), boss};
  }
  const chapter = Math.max(1, Math.min(3, stage));
  return {damage: [.6, .65, .7][chapter - 1], volleyCap: [24, 28, 30][chapter - 1],
    error: [9, 7, 6][chapter - 1], boss: false};
}

// Existing characters remain the defaults. Adding a character does not replace
// the selected bow, acquired relics or the save format.
export const CHARACTERS = [
  {id: 'qingsong', name: '青松', initialSkills: ['composure'], description: '沉着：首次危急时，在自己的回合回复 10 点生命。'},
  {id: 'chiyan', name: '赤岩', initialSkills: ['composure'], description: '沉着：首次危急时，在自己的回合回复 10 点生命。'},
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
