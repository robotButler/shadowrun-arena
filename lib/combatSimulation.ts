// combatSimulation.ts

import { Character, CombatCharacter, Weapon, MatchResult, RoundResult } from './types'
import { roll_initiative, resolve_attack, check_combat_end, select_best_weapon, get_ideal_range } from './combat'
import { calculateMaxPhysicalHealth, calculateMaxStunHealth, isCharacterAlive, isCharacterConscious, calculatePhysicalLimit, calculateMentalLimit } from './utils';
import { calculateDistance } from './utils';
import { ManagedCharacter } from './characterManagement';

const MELEE_RANGE = 2; // Melee range in meters

type Vector = { x: number, y: number };

function calculateRunningDistance(character: CombatCharacter): number {
  return character.attributes.agility * 4; // Updated to running speed
}

function rollSprinting(character: CombatCharacter): number {
  const runningSkill = character.skills.running || 0;
  const sprintPool = runningSkill + character.attributes.strength;
  const rolls = Array(sprintPool).fill(0).map(() => Math.floor(Math.random() * 6) + 1);
  const hits = rolls.filter(roll => roll >= 5).length;
  return hits;
}

function calculateSprintingDistance(character: CombatCharacter, sprintHits: number): number {
  const baseDistance = calculateRunningDistance(character);
  const extraDistance = sprintHits * (character.metatype === 'Dwarf' || character.metatype === 'Troll' ? 1 : 2);
  return baseDistance + extraDistance;
}

export const createCombatCharacter = (character: Character, faction: 'faction1' | 'faction2', position: number, factionModifiers: Record<string, number>): CombatCharacter => {
  const managedCharacter = new ManagedCharacter(character, faction, { x: position, y: 0 });
  const { initiative_total } = roll_initiative(managedCharacter);
  managedCharacter.initiative = initiative_total;
  managedCharacter.current_initiative = initiative_total;
  managedCharacter.situational_modifiers = factionModifiers[character.id] || 0;
  managedCharacter.movement_remaining = calculateRunningDistance(managedCharacter);
  return managedCharacter;
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
      char.movement_remaining = calculateRunningDistance(char);
    });
    roundResult.messages.push("Initiative reset: All characters' initiatives have been reset to their initial values.");
  }

  for (const character of characters) {
    if (!character.is_conscious) continue

    roundResult.actingCharacter = character.name
    roundResult.initiativePhase = character.current_initiative

    const target = selectTarget(character, characters)
    if (!target) continue

    const weapon = selectWeapon(character)
    let distance = calculateDistance(character.position, target.position)

    // Determine action based on distance and weapon type
    const maxRange = getMaxRange(weapon);

    if (distance > maxRange && character.movement_remaining > 0) {
      // Move towards target
      const moveDistance = Math.min(character.movement_remaining, distance - maxRange);
      const direction = character.position < target.position ? 1 : -1;
      character.position += moveDistance * direction;
      character.movement_remaining -= moveDistance;
      distance = calculateDistance(character.position, target.position); // Recalculate distance after movement
      roundResult.messages.push(`${character.name} moved ${moveDistance} meters towards ${target.name}. New distance: ${distance} meters.`);
    }

    // Perform attack if in range
    if (distance <= maxRange) {
      const attackResult = resolve_attack(character, target, weapon, weapon.currentFireMode || 'SA', distance)
      roundResult.messages.push(...attackResult.messages)
      roundResult.damage_dealt += attackResult.damage_dealt
      roundResult.attack_rolls = attackResult.attack_rolls
      roundResult.defense_rolls = attackResult.defense_rolls
      roundResult.resistance_rolls = attackResult.resistance_rolls
      roundResult.glitch = attackResult.glitch
      roundResult.criticalGlitch = attackResult.criticalGlitch

      // Update ammo count
      if (weapon.type === 'Ranged') {
        const bulletsFired = weapon.currentFireMode === 'BF' ? 3 : weapon.currentFireMode === 'FA' ? 6 : 1;
        weapon.ammoCount = (weapon.ammoCount || 0) - bulletsFired;
        if (weapon.ammoCount < 0) {
          roundResult.messages.push(`${character.name}'s ${weapon.name} is out of ammo!`);
        }
      }

      // Update status of both attacker and target
      character.updateStatus();
      target.updateStatus();
      roundResult.status_changes.push(...character.getStatusChanges(), ...target.getStatusChanges());
    } else {
      roundResult.messages.push(`${character.name} couldn't reach ${target.name} for attack. Distance: ${distance} meters, Max weapon range: ${maxRange} meters.`)
    }

    character.current_initiative -= 10

    // Check if combat has ended after this character's action
    if (check_combat_end(characters)) {
      break;
    }
  }

  return roundResult
}

export const selectTarget = (attacker: CombatCharacter, characters: CombatCharacter[]): CombatCharacter | null => {
  const enemies = characters.filter(c => c.faction !== attacker.faction && c.is_conscious);
  enemies.sort((a, b) => calculateDistance(attacker.position, a.position) - calculateDistance(attacker.position, b.position));
  return enemies[0] || null;
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

// Add this new function to get the maximum range of a weapon
function getMaxRange(weapon: Weapon): number {
  if (weapon.type === 'Melee') {
    return MELEE_RANGE;
  } else if (weapon.type === 'Ranged' && weapon.range) {
    return Math.max(...weapon.range);
  }
  // Default range if not specified (you may want to adjust this)
  return 50;
}

// Update the selectWeapon function to prefer ranged weapons when not in melee range
function selectWeapon(character: CombatCharacter): Weapon {
  const meleeWeapons = character.weapons.filter(w => w.type === 'Melee');
  const rangedWeapons = character.weapons.filter(w => w.type === 'Ranged');
  
  if (meleeWeapons.length > 0 && Math.random() < 0.3) {
    // 30% chance to choose a melee weapon if available
    return meleeWeapons[Math.floor(Math.random() * meleeWeapons.length)];
  } else if (rangedWeapons.length > 0) {
    // Sort ranged weapons by maximum range
    rangedWeapons.sort((a, b) => (Math.max(...(b.range || [0])) - Math.max(...(a.range || [0]))));
    return rangedWeapons[0]; // Choose the ranged weapon with the longest range
  } else {
    // Fallback to melee if no ranged weapons
    return meleeWeapons[Math.floor(Math.random() * meleeWeapons.length)];
  }
}