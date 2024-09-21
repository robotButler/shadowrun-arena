import { Character, CombatCharacter, Weapon, MatchResult, RoundResult } from './types'
import { roll_initiative, resolve_attack, check_combat_end, select_best_weapon, get_ideal_range } from './combat'
import { calculateMaxPhysicalHealth, calculateMaxStunHealth, isCharacterAlive, isCharacterConscious } from './utils'
import { calculateDistance } from './utils';

const MELEE_RANGE = 2; // Melee range in meters

export const createCombatCharacter = (character: Character, faction: 'faction1' | 'faction2', position: number, factionModifiers: Record<string, number>): CombatCharacter => {
  const { initiative_total } = roll_initiative(character)
  return {
    ...character,
    faction,
    initiative: initiative_total,
    current_initiative: initiative_total,
    position,
    cumulative_recoil: 0,
    wound_modifier: 0,
    situational_modifiers: factionModifiers[character.id] || 0,
    physical_damage: 0,
    stun_damage: 0,
    is_conscious: true,
    is_alive: true,
    total_damage_dealt: 0,
    previousPhysicalDamage: 0,
    previousStunDamage: 0,
    calculate_wound_modifier: () => 0,
    check_status: () => []
  }
}

export const simulateRound = (characters: CombatCharacter[]): RoundResult => {
  const roundResult: RoundResult = {
    actingCharacter: '',
    initiativePhase: 0,
    attacker_hits: 0,
    defender_hits: 0,
    damage_dealt: 0,
    attack_rolls: [],
    defense_rolls: [],
    resistance_rolls: [],
    status_changes: [],
    messages: [],
    glitch: false,
    criticalGlitch: false
  }

  characters.sort((a, b) => b.current_initiative - a.current_initiative)

  if (characters[0].current_initiative < 1) {
    characters.forEach(char => {
      char.current_initiative = char.initiative;
    });
    roundResult.messages.push("Initiative reset: All characters' initiatives have been reset to their initial values.");
  }

  for (const character of characters) {
    if (!character.is_conscious) continue

    roundResult.actingCharacter = character.name
    roundResult.initiativePhase = character.current_initiative

    const target = selectTarget(character, characters)
    if (!target) continue

    const weapon = select_best_weapon(character, Math.abs(character.position - target.position))
    const distance = calculateDistance(character.position, target.position)

    // Handle movement for melee attacks
    if (weapon.type === 'Melee' && distance > MELEE_RANGE) {
      const moveDistance = Math.min(character.attributes.agility * 2, distance - MELEE_RANGE)
      const direction = character.position < target.position ? 1 : -1
      character.position += moveDistance * direction
      roundResult.messages.push(`${character.name} moved ${moveDistance} meters towards ${target.name}`)
    }

    // Check if now in melee range or if using a ranged weapon
    if ((weapon.type === 'Melee' && calculateDistance(character.position, target.position) <= MELEE_RANGE) || weapon.type !== 'Melee') {
      const attackResult = resolve_attack(character, target, weapon, weapon.currentFireMode, calculateDistance(character.position, target.position))
      roundResult.messages.push(...attackResult.messages)
      roundResult.damage_dealt += attackResult.damage_dealt
      roundResult.attack_rolls = attackResult.attack_rolls
      roundResult.defense_rolls = attackResult.defense_rolls
      roundResult.resistance_rolls = attackResult.resistance_rolls
      roundResult.glitch = attackResult.glitch
      roundResult.criticalGlitch = attackResult.criticalGlitch
    } else {
      roundResult.messages.push(`${character.name} couldn't reach ${target.name} for melee attack`)
    }

    updateCharacterStatus(character)
    updateCharacterStatus(target)

    character.current_initiative -= 10

    break
  }

  return roundResult
}

export const selectTarget = (attacker: CombatCharacter, characters: CombatCharacter[]): CombatCharacter | null => {
  return characters.find(c => c.faction !== attacker.faction && c.is_conscious) || null
}

export const updateCharacterStatus = (character: CombatCharacter) => {
  const maxPhysicalHealth = calculateMaxPhysicalHealth(character.attributes.body)
  const maxStunHealth = calculateMaxStunHealth(character.attributes.willpower)

  character.is_alive = isCharacterAlive(character.physical_damage, maxPhysicalHealth)
  character.is_conscious = isCharacterConscious(character.stun_damage, maxStunHealth, character.physical_damage, maxPhysicalHealth)
}

export const determineWinner = (characters: CombatCharacter[]): string => {
  const faction1Alive = characters.some(c => c.faction === 'faction1' && c.is_conscious)
  const faction2Alive = characters.some(c => c.faction === 'faction2' && c.is_conscious)

  if (faction1Alive && !faction2Alive) return 'Faction 1'
  if (!faction1Alive && faction2Alive) return 'Faction 2'
  return 'Draw'
}

export const runSingleSimulation = (faction1: string[], faction2: string[], characters: Character[], factionModifiers: Record<string, number>, simulationInitialDistance: number): MatchResult => {
  const combatChars: CombatCharacter[] = [
    ...faction1.map(id => createCombatCharacter(characters.find(c => c.id === id)!, 'faction1', 0, factionModifiers)),
    ...faction2.map(id => createCombatCharacter(characters.find(c => c.id === id)!, 'faction2', simulationInitialDistance, factionModifiers))
  ]

  let roundResults: RoundResult[] = []
  let round = 1
  let combatEnded = false

  while (!combatEnded && round <= 20) {
    const roundResult = simulateRound(combatChars)
    roundResults.push(roundResult)

    combatEnded = check_combat_end(combatChars)
    if (combatEnded) break

    round++
  }

  const winner = determineWinner(combatChars)
  const details = `Combat ended after ${round} rounds. ${winner} wins.`

  return {
    winner,
    rounds: round,
    roundResults,
    details
  }
}

export const calculateRoundWins = (results: MatchResult[]) => {
  const roundWins = { 'Faction 1': 0, 'Faction 2': 0, 'Draw': 0 };
  results.forEach(result => {
    roundWins[result.winner as keyof typeof roundWins]++;
  });
  return roundWins;
};

function selectWeapon(character: CombatCharacter): Weapon {
  const meleeWeapons = character.weapons.filter(w => w.type === 'Melee');
  const rangedWeapons = character.weapons.filter(w => w.type === 'Ranged');
  
  if (meleeWeapons.length > 0 && Math.random() < 0.3) {
    // 30% chance to choose a melee weapon if available
    return meleeWeapons[Math.floor(Math.random() * meleeWeapons.length)];
  } else if (rangedWeapons.length > 0) {
    return rangedWeapons[Math.floor(Math.random() * rangedWeapons.length)];
  } else {
    // Fallback to melee if no ranged weapons
    return meleeWeapons[Math.floor(Math.random() * meleeWeapons.length)];
  }
}