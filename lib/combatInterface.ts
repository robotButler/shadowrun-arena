// combatInterface.ts

import { toast } from 'react-toastify';
import {
  roll_initiative,
  resolve_attack,
  apply_damage,
  check_combat_end,
} from './combat';
import { calculateMaxPhysicalHealth, calculateMaxStunHealth, isCharacterAlive, isCharacterConscious, calculate_wound_modifier } from './utils';
import {
  ActionType,
  SimpleAction,
  ComplexAction,
  CombatCharacter,
  Weapon,
  FireMode,
  Character,
  Vector
} from './types';
import { GameMap } from './map';
import { calculateDistance } from './utils';

const MELEE_RANGE = 2; // Melee range in meters

const updatePosition = (position: Vector, direction: Vector, distance: number): Vector => {
  return {
    x: position.x + direction.x * distance,
    y: position.y + direction.y * distance
  };
};

export const startNewCombat = (
  faction1: string[],
  faction2: string[],
  characters: Character[],
  factionModifiers: Record<string, number>,
  gameMap: GameMap,
  placedCharacters: Array<{character: Character, position: Vector}>
): {
  combatCharacters: CombatCharacter[],
  initialInitiatives: Record<string, number>,
  currentInitiativePhase: number,
  currentCharacterIndex: number,
  actionLog: { summary: string, details: string[] }[]
} => {
  const combatCharacters: CombatCharacter[] = [...faction1, ...faction2].map(id => {
    const character = characters.find(c => c.id === id);
    const placedCharacter = placedCharacters.find(pc => pc.character.id === id);
    if (!character || !placedCharacter) {
      throw new Error(`Character with id ${id} not found`);
    }
    return {
      ...character,
      ...placedCharacter,
      updateStatus: () => {
        // Implement updateStatus logic here
      },
      getStatusChanges: () => {
        // Implement getStatusChanges logic here
        return [];
      },
      faction: faction1.includes(id) ? 'faction1' : 'faction2',
      total_initiative: function() { return this.original_initiative - calculate_wound_modifier(this) },
      original_initiative: 0,
      position: placedCharacter.position,
      previousPhysicalDamage: 0,
      previousStunDamage: 0,
      movement_remaining: 0,
    };
  });

  const initialInitiativeRolls: Record<string, number> = {};
  const initiativeLog: string[] = ["Initial Initiative Rolls:"];

  combatCharacters.forEach(char => {
    const { initiative_total, initiative_rolls } = roll_initiative(char);
    char.original_initiative = initiative_total;
    char.current_initiative = initiative_total;
    initialInitiativeRolls[char.id] = initiative_total;

    initiativeLog.push(`${char.name}: ${initiative_total} (Dice: ${initiative_rolls.join(', ')})`);
  });

  combatCharacters.sort((a, b) => b.original_initiative - a.original_initiative);

  return {
    combatCharacters: combatCharacters,
    initialInitiatives: initialInitiativeRolls,
    currentInitiativePhase: combatCharacters[0].original_initiative,
    currentCharacterIndex: 0,
    actionLog: [{ summary: "Combat Started", details: initiativeLog }]
  };
};

export const createCombatCharacter = (
  character: Character,
  faction: 'faction1' | 'faction2',
  position: Vector,
  situationalModifiers: number
): CombatCharacter => ({
  ...character,
  faction,
  updateStatus: () => {},
  getStatusChanges: () => [],
  original_initiative: 0,
  total_initiative: function() { return this.original_initiative - calculate_wound_modifier(this) },
  position,
  current_initiative: 0,
  movement_remaining: 0,
  cumulative_recoil: 0,
  wound_modifier: 0,
  situational_modifiers: situationalModifiers,
  physical_damage: 0,
  stun_damage: 0,
  is_conscious: true,
  is_alive: true,
  total_damage_dealt: 0,
  previousPhysicalDamage: 0,
  previousStunDamage: 0,
  calculate_wound_modifier: function() {
    return calculate_wound_modifier(this);
  },
  check_status: function() {
    const statusChanges: string[] = [];
    const maxPhysicalHealth = calculateMaxPhysicalHealth(this.attributes.body);
    const maxStunHealth = calculateMaxStunHealth(this.attributes.willpower);

    const wasAlive = this.is_alive;
    const wasConscious = this.is_conscious;

    this.is_alive = isCharacterAlive(this.physical_damage, maxPhysicalHealth);
    this.is_conscious = isCharacterConscious(this.stun_damage, maxStunHealth, this.physical_damage, maxPhysicalHealth);

    if (wasAlive && !this.is_alive) {
      statusChanges.push(`${this.name} has died!`);
    } else if (wasConscious && !this.is_conscious) {
      statusChanges.push(`${this.name} has been knocked unconscious!`);
    }

    return statusChanges;
  }
});

export const updateInitiative = (
  combatCharacters: CombatCharacter[],
  currentCharacterIndex: number,
  initialInitiatives: Record<string, number>
): {
  updatedCharacters: CombatCharacter[],
  newInitiativePhase: number,
  newCharacterIndex: number,
  actionLog: { summary: string, details: string[] } | null
} => {
  const updatedCharacters = [...combatCharacters];
  let currentChar = updatedCharacters[currentCharacterIndex];
  
  // Calculate wound modifier
  const woundModifier = calculate_wound_modifier(currentChar);
  
  // Decrease initiative by 10, considering wound modifier
  currentChar.current_initiative -= (10 + woundModifier);

  if (currentChar.current_initiative <= 0) {
    // Reset initiative to initial value minus wound modifier
    currentChar.current_initiative = initialInitiatives[currentChar.id] - woundModifier;
    
    // Reset movement
    currentChar.movement_remaining = currentChar.attributes.agility * 2;
  }

  // Find the character with the highest initiative
  let highestInitiative = -Infinity;
  let newCharacterIndex = -1;

  for (let i = 0; i < updatedCharacters.length; i++) {
    const char = updatedCharacters[i];
    if (char.is_conscious && char.current_initiative > highestInitiative) {
      highestInitiative = char.current_initiative;
      newCharacterIndex = i;
    }
  }

  // If no conscious character found, end combat
  if (newCharacterIndex === -1) {
    return {
      updatedCharacters,
      newInitiativePhase: 0,
      newCharacterIndex: 0,
      actionLog: {
        summary: "Combat has ended. No conscious characters remaining.",
        details: []
      }
    };
  }

  const newInitiativePhase = updatedCharacters[newCharacterIndex].current_initiative;

  return {
    updatedCharacters,
    newInitiativePhase,
    newCharacterIndex,
    actionLog: {
      summary: `${currentChar.name}'s turn ended. Next up: ${updatedCharacters[newCharacterIndex].name}`,
      details: [
        `${currentChar.name}'s initiative decreased to ${currentChar.current_initiative}`,
        `Wound modifier applied: -${woundModifier}`,
        `New initiative phase: ${newInitiativePhase}`
      ]
    }
  };
};

export const handleMovement = (
  combatCharacters: CombatCharacter[],
  currentCharacterIndex: number,
  movementDistance: number,
  movementDirection: 'Toward' | 'Away',
  isRunning: boolean = false
): {
  updatedCharacters: CombatCharacter[],
  actionLog: { summary: string, details: string[] },
  remainingDistance: number
} => {
  const currentChar = combatCharacters[currentCharacterIndex];
  const baseMaxDistance = currentChar.attributes.agility * 2;
  const maxDistance = isRunning ? baseMaxDistance * 2 : baseMaxDistance;

  const availableMovement = Math.max(0, currentChar.movement_remaining);
  const actualMovementDistance = Math.min(movementDistance, availableMovement);

  const updatedChars = [...combatCharacters];
  const target = updatedChars.find(c => c.faction !== currentChar.faction && c.is_conscious);
  
  if (!target) {
    return { updatedCharacters: combatCharacters, actionLog: { summary: 'No valid target found', details: [] }, remainingDistance: currentChar.movement_remaining };
  }

  const initialDistance = calculateDistance(currentChar.position, target.position);
  
  // Calculate movement vector
  const dx = target.position.x - currentChar.position.x;
  const dy = target.position.y - currentChar.position.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const unitVector: Vector = { x: dx / length, y: dy / length };

  // Adjust movement direction
  const moveToward = movementDirection === 'Toward';
  const direction: Vector = moveToward ? unitVector : { x: -unitVector.x, y: -unitVector.y };

  const newPosition = updatePosition(currentChar.position, direction, actualMovementDistance);

  updatedChars[currentCharacterIndex] = {
    ...currentChar,
    position: newPosition,
    movement_remaining: currentChar.movement_remaining - actualMovementDistance
  };

  const newDistance = calculateDistance(newPosition, target.position);
  const actualMovement = Math.abs(initialDistance - newDistance);
  const remainingDistance = updatedChars[currentCharacterIndex].movement_remaining;

  return {
    updatedCharacters: updatedChars,
    actionLog: { 
      summary: `${currentChar.name} ${isRunning ? "ran" : "moved"} ${actualMovement.toFixed(2)} meters ${movementDirection.toLowerCase()} the opposing faction.`,
      details: [
        `New position: (${newPosition.x.toFixed(2)}, ${newPosition.y.toFixed(2)})`,
        `New distance to target: ${newDistance.toFixed(2)} meters`,
        `Remaining movement: ${remainingDistance.toFixed(2)} meters`,
        isRunning ? `Running used as a Free Action` : ''
      ].filter(Boolean)
    },
    remainingDistance
  };
};

export const handleComplexAction = (
  combatCharacters: CombatCharacter[],
  currentCharacterIndex: number,
  selectedComplexAction: ComplexAction,
  selectedWeapon: Weapon | null,
  selectedTargetId: string | null,
  remainingMovement: number
): {
  updatedCharacters: CombatCharacter[],
  actionLog: { summary: string, details: string[] },
  combatEnded: boolean
} => {
  const currentChar = combatCharacters[currentCharacterIndex];
  let updatedChars = [...combatCharacters];
  let actionLog: { summary: string, details: string[] } = { summary: '', details: [] };
  let combatEnded = false;

  if (selectedComplexAction === 'Sprint') {
    const runningSkill = currentChar.skills.running;
    const agilityDice = currentChar.attributes.agility;
    const sprintRoll = Array(runningSkill + agilityDice).fill(0).map(() => Math.floor(Math.random() * 6) + 1);
    const hits = sprintRoll.filter(roll => roll >= 5).length;
    const extraDistance = ['Dwarf', 'Troll'].includes(currentChar.metatype) ? hits : hits * 2;
    const additionalMovement = extraDistance;
    
    actionLog = {
      summary: `${currentChar.name} sprinted.`,
      details: [
        `Running Test: ${agilityDice} Agi + ${runningSkill} Run = ${sprintRoll.length} dice, ${hits} hits`,
        `Additional movement: ${additionalMovement} meters`
      ]
    };

    // Update the character's remaining movement
    updatedChars[currentCharacterIndex] = {
      ...currentChar,
      movement_remaining: (currentChar.movement_remaining || 0) + additionalMovement
    };
  } else if ((selectedComplexAction === 'FireWeapon' || selectedComplexAction === 'MeleeAttack') && selectedWeapon && selectedTargetId) {
    const target = combatCharacters.find(c => c.id === selectedTargetId);
    if (target) {
      const distance = calculateDistance(currentChar.position, target.position);
      
      if (selectedComplexAction === 'MeleeAttack' && distance > MELEE_RANGE) {
        if (remainingMovement >= distance - MELEE_RANGE) {
          // Move into melee range
          const direction: Vector = {
            x: (target.position.x - currentChar.position.x) / distance,
            y: (target.position.y - currentChar.position.y) / distance
          };
          updatedChars[currentCharacterIndex].position = updatePosition(currentChar.position, direction, distance - MELEE_RANGE);
          actionLog.details.push(`${currentChar.name} moved ${(distance - MELEE_RANGE).toFixed(2)} meters to engage in melee.`);
        } else {
          actionLog.summary = `${currentChar.name} couldn't reach the target for melee attack.`;
          return { updatedCharacters: updatedChars, actionLog, combatEnded: false };
        }
      }

      const result = resolve_attack(currentChar, target, selectedWeapon, selectedWeapon.currentFireMode ?? undefined, distance);
      
      actionLog.summary = `${currentChar.name} attacked ${target.name} with ${selectedWeapon.name}`;
      if (result.criticalGlitch) {
        actionLog.summary += ` and suffered a critical glitch!`;
      } else if (result.glitch) {
        actionLog.summary += ` but glitched!`;
      } else if (result.damage_dealt > 0) {
        actionLog.summary += ` and dealt ${result.damage_dealt} damage.`;
      } else {
        actionLog.summary += ` but missed.`;
      }
      
      actionLog.details = result.messages;
      
      updatedChars = combatCharacters.map(char => 
        char.id === currentChar.id ? { ...char, ...currentChar } :
        char.id === target.id ? { ...char, ...target } :
        char
      );

      // Add this block
      updatedChars = updatedChars.map(char => {
        if (!char.is_alive || !char.is_conscious) {
          return { ...char, current_initiative: -1 }; // Remove from initiative order
        }
        return char;
      });

      combatEnded = check_combat_end(updatedChars);
      if (combatEnded) {
        actionLog.details.push("Combat has ended!");
      }
    }
  }

  return { updatedCharacters: updatedChars, actionLog, combatEnded };
};

export const handleSimpleActions = (
  combatCharacters: CombatCharacter[],
  currentCharacterIndex: number,
  selectedSimpleActions: SimpleAction[],
  selectedWeapons: (Weapon | null)[],
  selectedTargets: (string | null)[],
  remainingMovement: number,
  isRunning: boolean = false
): {
  updatedCharacters: CombatCharacter[],
  actionLog: { summary: string, details: string[] }[],
  combatEnded: boolean
} => {
  const currentChar = combatCharacters[currentCharacterIndex];
  let updatedChars = [...combatCharacters];
  const actionLog: { summary: string, details: string[] }[] = [];
  let combatEnded = false;

  selectedSimpleActions.forEach((action, index) => {
    if (action === 'FireRangedWeapon' && selectedWeapons[index] && selectedTargets[index]) {
      const weapon = selectedWeapons[index] as Weapon;
      const targetId = selectedTargets[index]!;
      const target = combatCharacters.find(c => c.id === targetId);
      if (target) {
        const distance = calculateDistance(currentChar.position, target.position);
        const result = resolve_attack(currentChar, target, weapon, weapon.currentFireMode ?? 'SS', distance);
        const summary = `${currentChar.name} fired at ${target.name} with ${weapon.name} and dealt ${result.damage_dealt} damage.`;
        actionLog.push({ summary, details: result.messages });
        
        updatedChars = combatCharacters.map(char => 
          char.id === currentChar.id ? { ...char, ...currentChar } :
          char.id === target.id ? { ...char, ...target } :
          char
        );

        combatEnded = check_combat_end(updatedChars);
        if (combatEnded) {
          actionLog.push({ summary: "Combat has ended!", details: [] });
        }
      }
    } else if (action === 'ReloadWeapon' && selectedWeapons[index]) {
      const weapon = selectedWeapons[index] as Weapon;
      const weaponIndex = updatedChars[currentCharacterIndex].weapons.findIndex(w => w.name === weapon.name);
      if (weaponIndex !== -1) {
        updatedChars[currentCharacterIndex].weapons[weaponIndex].ammoCount = weapon.ammoCount;
        const summary = `${currentChar.name} reloaded their ${weapon.name}.`;
        actionLog.push({ summary, details: [] });
      }
    } else if (action === 'TakeAim') {
      actionLog.push({ summary: `${currentChar.name} took aim.`, details: [] });
    } else if (action === 'TakeCover') {
      actionLog.push({ summary: `${currentChar.name} took cover.`, details: [] });
    } else if (action === 'CallShot') {
      actionLog.push({ summary: `${currentChar.name} called a shot.`, details: [] });
    } else if (action === 'ChangeFireMode') {
      actionLog.push({ summary: `${currentChar.name} changed fire mode.`, details: [] });
    }
  });

  return { updatedCharacters: updatedChars, actionLog, combatEnded };
};

export const handleFireModeChange = (
  combatCharacters: CombatCharacter[],
  currentCharacterIndex: number,
  weaponIndex: number,
  newFireMode: FireMode
): {
  updatedCharacters: CombatCharacter[],
  actionLog: { summary: string, details: string[] }
} => {
  const updatedChars = [...combatCharacters];
  updatedChars[currentCharacterIndex].weapons[weaponIndex].currentFireMode = newFireMode;
  return {
    updatedCharacters: updatedChars,
    actionLog: {
      summary: `${combatCharacters[currentCharacterIndex].name} changed fire mode of ${updatedChars[currentCharacterIndex].weapons[weaponIndex].name} to ${newFireMode}`,
      details: []
    }
  };
};

export const checkAndUpdateCharacterStatus = (character: CombatCharacter): {
  updatedCharacter: CombatCharacter,
  statusChanges: string[]
} => {
  const statusChanges: string[] = [];
  const physicalDamageChange = character.physical_damage - character.previousPhysicalDamage;
  const stunDamageChange = character.stun_damage - character.previousStunDamage;

  if (physicalDamageChange > 0) {
    statusChanges.push(`${character.name} took ${physicalDamageChange} physical damage.`);
  }
  if (stunDamageChange > 0) {
    statusChanges.push(`${character.name} took ${stunDamageChange} stun damage.`);
  }

  const maxPhysicalHealth = calculateMaxPhysicalHealth(character.attributes.body);
  const maxStunHealth = calculateMaxStunHealth(character.attributes.willpower);

  const wasAlive = character.is_alive;
  const wasConscious = character.is_conscious;

  // Check if stun damage overflows to physical damage
  if (character.stun_damage > maxStunHealth) {
    const overflow = character.stun_damage - maxStunHealth;
    character.physical_damage += overflow;
    character.stun_damage = maxStunHealth;
  }

  // Update is_alive and is_conscious status
  character.is_alive = character.physical_damage <= maxPhysicalHealth;
  character.is_conscious = character.is_alive && (character.stun_damage < maxStunHealth);

  if (wasAlive && !character.is_alive) {
    statusChanges.push(`${character.name} has died!`);
  } else if (wasConscious && !character.is_conscious) {
    if (character.is_alive) {
      statusChanges.push(`${character.name} has been knocked unconscious!`);
    } else {
      statusChanges.push(`${character.name} has been killed!`);
    }
  }

  character.previousPhysicalDamage = character.physical_damage;
  character.previousStunDamage = character.stun_damage;

  return { updatedCharacter: character, statusChanges };
};

export const displayRoundSummary = (
  combatCharacters: CombatCharacter[],
  roundNumber: number
): {
  updatedCharacters: CombatCharacter[],
  roundSummary: string[],
  combatEnded: boolean
} => {
  const roundSummary: string[] = [`End of Round ${roundNumber}`];
  let combatEnded = false;

  const updatedChars = combatCharacters.map(char => {
    const { updatedCharacter, statusChanges } = checkAndUpdateCharacterStatus(char);
    roundSummary.push(...statusChanges);
    return updatedCharacter;
  });

  const faction1Conscious = updatedChars.some(char => char.faction === 'faction1' && char.is_conscious);
  const faction2Conscious = updatedChars.some(char => char.faction === 'faction2' && char.is_conscious);

  if (!faction1Conscious && !faction2Conscious) {
    roundSummary.push("Both factions are incapacitated. The combat ends in a draw.");
    combatEnded = true;
  } else if (!faction1Conscious) {
    roundSummary.push("Faction 2 wins! All members of Faction 1 are incapacitated.");
    combatEnded = true;
  } else if (!faction2Conscious) {
    roundSummary.push("Faction 1 wins! All members of Faction 2 are incapacitated.");
    combatEnded = true;
  }

  return { updatedCharacters: updatedChars, roundSummary, combatEnded };
};