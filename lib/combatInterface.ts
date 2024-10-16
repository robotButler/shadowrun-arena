// combatInterface.ts

import { toast } from 'react-toastify';
import {
  roll_initiative,
  resolve_attack,
  apply_damage,
  check_combat_end,
} from './combat';
import { calculateMaxPhysicalHealth, calculateMaxStunHealth, isCharacterAlive, isCharacterConscious, calculate_wound_modifier,
  canTakeCover, getIntersectedCoverCells } from './utils';
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
import { GameMap, CellType } from './map';
import { taxicabDistance, roundVector } from './utils';
import * as PF from 'pathfinding';

const MELEE_RANGE = 2; // Melee range in meters

// Add this constant at the top of the file
const RUN_MELEE_BONUS = 4;
const RUN_OTHER_PENALTY = -2;

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
  currentInitiativeIndex: number,
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
      isTakingCover: false,
      adjacentCoverCells: [],
      hasMoved: false,
      base_movement: character.attributes.agility * 2,
      isRunning: false,
      isSprinting: false,
      hasRunThisPhase: false,
    };
  });

  const initialInitiativeRolls: Record<string, number> = {};
  const initiativeLog: string[] = ["Initial Initiative Rolls:"];

  combatCharacters.forEach(char => {
    const { initiative_total, initiative_rolls } = roll_initiative(char);
    char.original_initiative = initiative_total;
    char.current_initiative = initiative_total;
    initialInitiativeRolls[char.id] = initiative_total;

    const initiativeBase = char.attributes.reaction + char.attributes.intuition;
    initiativeLog.push(JSON.stringify({
      name: char.name,
      total: initiative_total,
      base: initiativeBase,
      dice: initiative_rolls,
      initiativeDice: char.initiativeDice
    }));
  });

  combatCharacters.sort((a, b) => b.original_initiative - a.original_initiative);

  return {
    combatCharacters: combatCharacters,
    initialInitiatives: initialInitiativeRolls,
    currentInitiativeIndex: 0,
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
  total_initiative: function() { 
    const woundModifier = Math.floor((this.physical_damage + this.stun_damage) / 3);
    return this.original_initiative - woundModifier;
  },
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
  isTakingCover: false,
  adjacentCoverCells: [],
  hasMoved: false,
  isRunning: false,
  isSprinting: false,
  hasRunThisPhase: false,
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
  },
  base_movement: character.attributes.agility * 2,
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
  const woundModifier = Math.floor((currentChar.physical_damage + currentChar.stun_damage) / 3);
  
  // Decrease initiative by 10, considering wound modifier
  currentChar.current_initiative = Math.max(0, currentChar.current_initiative - 10);

  if (currentChar.current_initiative <= 0) {
    // Reset initiative to initial value minus wound modifier
    currentChar.current_initiative = Math.max(0, initialInitiatives[currentChar.id] - woundModifier);
  }
  
  // Reset movement and running/sprinting status for all characters
  updatedCharacters.forEach(char => {
    char.base_movement = char.attributes.agility * 2;
    char.movement_remaining = char.base_movement;
    char.isRunning = false;
    char.isSprinting = false;
    char.hasRunThisPhase = false;
  });

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
        `New initiative phase: ${newInitiativePhase}`,
        `All characters' movement reset for the next turn`
      ]
    }
  };
};

export const gridFromGameMap = (gameMap: GameMap, combatCharacters: CombatCharacter[]): PF.Grid => {
  const grid = new PF.Grid(gameMap.width, gameMap.height);
  gameMap.cells.forEach((cell, index) => {
    const x = index % gameMap.width;
    const y = Math.floor(index / gameMap.width);
    if (cell === CellType.HardCover || cell === CellType.PartialCover) {
      grid.setWalkableAt(x, y, false);
    }
  });
  combatCharacters.forEach((char, index) => {
    const { x, y } = roundVector(char.position);
    grid.setWalkableAt(x, y, false);
  });
  return grid;
};
  

export const handleMovement = (
  combatCharacters: CombatCharacter[],
  currentCharacterIndex: number,
  moveTo: Vector,
  isRunning: boolean = false,
  gameMap: GameMap
): {
  updatedCharacters: CombatCharacter[],
  actionLog: { summary: string, details: string[] },
  remainingDistance: number
} => {
  console.log("handleMovement called with:", {
    currentCharacterIndex,
    moveTo,
    isRunning,
    gameMap
  });
  const currentChar = combatCharacters[currentCharacterIndex];
  const maxDistance = isRunning ? currentChar.base_movement * 2 : currentChar.base_movement;

  const availableMovement = Math.min(currentChar.movement_remaining, maxDistance);
  
  const updatedChars = [...combatCharacters];

  // Create pathfinding grid
  const grid = gridFromGameMap(gameMap, combatCharacters);

  const finder = new PF.AStarFinder();
  const startPos = roundVector(currentChar.position);
  let endPos = roundVector(moveTo);

  const path = finder.findPath(startPos.x, startPos.y, endPos.x, endPos.y, grid);

  // Calculate actual movement distance
  const actualMovementDistance = Math.min(path.length - 1, availableMovement);
  
  // Get new position
  const newPosition = actualMovementDistance > 0 ? { x: path[actualMovementDistance][0], y: path[actualMovementDistance][1] } : startPos;

  updatedChars[currentCharacterIndex] = {
    ...currentChar,
    position: newPosition,
    movement_remaining: Math.max(0, currentChar.movement_remaining - actualMovementDistance),
    isTakingCover: false,
    hasMoved: true,
  };

  const newDistance = path.length;
  const remainingDistance = updatedChars[currentCharacterIndex].movement_remaining;

  return {
    updatedCharacters: updatedChars,
    actionLog: { 
      summary: `${currentChar.name} ${isRunning ? "ran" : "moved"} ${actualMovementDistance} meters.`,
      details: [
        `New position: (${newPosition.x.toFixed(2)}, ${newPosition.y.toFixed(2)})`,
        `New distance to target: ${newDistance.toFixed(2)} meters`,
        `Remaining movement: ${remainingDistance} meters`,
        isRunning ? `Running used as a Free Action` : '',
        `Lost cover bonus due to movement`
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
  remainingMovement: number,
  gameMap: GameMap
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
      const distance = taxicabDistance(currentChar.position, target.position, gameMap ? gridFromGameMap(gameMap, combatCharacters) : new PF.Grid(0, 0));
      
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

      let runModifier = 0;
      if (currentChar.isRunning) {
        if (selectedComplexAction === 'MeleeAttack') {
          runModifier = RUN_MELEE_BONUS;
          actionLog.details.push(`Applied +${RUN_MELEE_BONUS} bonus to melee attack while running.`);
        } else {
          runModifier = RUN_OTHER_PENALTY;
          actionLog.details.push(`Applied ${RUN_OTHER_PENALTY} penalty to ranged attack while running.`);
        }
      }

      const result = resolve_attack(
        currentChar,
        target,
        selectedWeapon,
        selectedWeapon.currentFireMode ?? undefined,
        distance,
        gameMap,
        runModifier
      );
      
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
  isRunning: boolean = false,
  gameMap: GameMap
): {
  updatedCharacters: CombatCharacter[],
  actionLog: { summary: string, details: string[] }[],
  combatEnded: boolean
} => {
  console.log("handleSimpleActions called with:", {
    currentCharacterIndex,
    selectedSimpleActions,
    selectedWeapons,
    selectedTargets,
    remainingMovement,
    isRunning,
    gameMap: gameMap ? "Initialized" : "Not initialized"
  });

  const currentChar = combatCharacters[currentCharacterIndex];
  let updatedChars = [...combatCharacters];
  const actionLog: { summary: string, details: string[] }[] = [];
  let combatEnded = false;

  selectedSimpleActions.forEach((action, index) => {
    console.log(`Processing action: ${action}`);
    if (action === 'FireRangedWeapon' && selectedWeapons[index] && selectedTargets[index]) {
      const weapon = selectedWeapons[index] as Weapon;
      const targetId = selectedTargets[index]!;
      const target = combatCharacters.find(c => c.id === targetId);
      if (target) {
        const distance = taxicabDistance(currentChar.position, target.position, gameMap ? gridFromGameMap(gameMap, combatCharacters) : new PF.Grid(0, 0));
        const runModifier = isRunning ? RUN_OTHER_PENALTY : 0;
        const result = resolve_attack(currentChar, target, weapon, weapon.currentFireMode ?? 'SS', distance, gameMap, runModifier);
        
        const summary = `${currentChar.name} fired at ${target.name} with ${weapon.name} and dealt ${result.damage_dealt} damage.`;
        const details = [
          ...result.messages,
          isRunning ? `Applied ${RUN_OTHER_PENALTY} penalty to ranged attack while running.` : ''
        ].filter(Boolean);
        
        actionLog.push({ summary, details });
        
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
      const runModifier = isRunning ? RUN_OTHER_PENALTY : 0;
      actionLog.push({
        summary: `${currentChar.name} took aim.`,
        details: isRunning ? [`Applied ${RUN_OTHER_PENALTY} penalty to Take Aim action while running.`] : []
      });
      // Apply the run modifier to the character's situational modifiers
      updatedChars[currentCharacterIndex].situational_modifiers += runModifier;
    } else if (action === 'TakeCover') {
      console.log("Attempting to take cover");
      const opponents = updatedChars.filter(c => c.faction !== currentChar.faction && c.is_conscious);
      if (canTakeCover(currentChar, gameMap, opponents)) {
        console.log("Taking cover successful");
        updatedChars[currentCharacterIndex] = {
          ...updatedChars[currentCharacterIndex],
          isTakingCover: true,
          adjacentCoverCells: getIntersectedCoverCells(currentChar, gameMap, opponents),
          hasMoved: false,
        };
        actionLog.push({ summary: `${currentChar.name} took cover.`, details: [] });
      } else {
        console.log("Taking cover failed");
        actionLog.push({ summary: `${currentChar.name} attempted to take cover but couldn't find suitable cover.`, details: [] });
      }
    } else if (action === 'CallShot') {
      actionLog.push({ summary: `${currentChar.name} called a shot.`, details: [] });
    } else if (action === 'ChangeFireMode') {
      actionLog.push({ summary: `${currentChar.name} changed fire mode.`, details: [] });
    }
  });

  console.log("handleSimpleActions finished. Returning:", {
    updatedCharacters: updatedChars.map(c => ({ id: c.id, name: c.name })),
    actionLog,
    combatEnded
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

export const handleRunAction = (character: CombatCharacter, isCurrentlyRunning: boolean): { updatedCharacter: CombatCharacter, actionLog: { summary: string, details: string[] } } => {
  const updatedCharacter = { ...character };
  
  if (!isCurrentlyRunning) {
    // Start running
    if (updatedCharacter.hasRunThisPhase) {
      return {
        updatedCharacter,
        actionLog: {
          summary: `${character.name} cannot run again in this initiative phase.`,
          details: [`Characters can only run once per initiative phase.`]
        }
      };
    }
    updatedCharacter.isRunning = true;
    updatedCharacter.hasRunThisPhase = true;
    // Apply the run bonus to both max movement and remaining movement
    const runBonus = updatedCharacter.base_movement;
    updatedCharacter.movement_remaining += runBonus;
    return {
      updatedCharacter,
      actionLog: {
        summary: `${character.name} started running.`,
        details: [
          `Movement doubled for this turn`,
          `Run Modifier applied`,
          `Remaining movement increased by ${runBonus} meters`
        ]
      }
    };
  } else {
    // Stop running
    updatedCharacter.isRunning = false;
    // We don't reduce the remaining movement when stopping running
    return {
      updatedCharacter,
      actionLog: {
        summary: `${character.name} stopped running.`,
        details: [
          `Run Modifier removed`,
          `Remaining movement unchanged`
        ]
      }
    };
  }
};