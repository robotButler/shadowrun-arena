import { toast } from 'react-toastify';
import {
  roll_initiative,
  resolve_attack,
  apply_damage,
  check_combat_end,
} from './combat';
import { calculateMaxPhysicalHealth, calculateMaxStunHealth, isCharacterAlive, isCharacterConscious } from './utils';
import {
  ActionType,
  SimpleAction,
  ComplexAction,
  CombatCharacter,
  Weapon,
  FireMode,
  Character
} from './types';

export const startNewCombat = (
  faction1: string[],
  faction2: string[],
  characters: Character[],
  factionModifiers: Record<string, number>,
  initialDistance: number
): {
  combatCharacters: CombatCharacter[],
  initialInitiatives: Record<string, number>,
  currentInitiativePhase: number,
  currentCharacterIndex: number,
  actionLog: { summary: string, details: string[] }[]
} => {
  const combatChars: CombatCharacter[] = [
    ...faction1.map(id => createCombatCharacter(characters.find(c => c.id === id)!, 'faction1', 0, factionModifiers[id] || 0)),
    ...faction2.map(id => createCombatCharacter(characters.find(c => c.id === id)!, 'faction2', initialDistance, factionModifiers[id] || 0))
  ];

  const initialInitiativeRolls: Record<string, number> = {};
  const initiativeLog: string[] = ["Initial Initiative Rolls:"];

  combatChars.forEach(char => {
    const { initiative_total, initiative_rolls } = roll_initiative(char as Character);
    char.initiative = initiative_total;
    char.current_initiative = initiative_total;
    initialInitiativeRolls[char.id] = initiative_total;

    initiativeLog.push(`${char.name}: ${initiative_total} (Dice: ${initiative_rolls.join(', ')})`);
  });

  combatChars.sort((a, b) => b.initiative - a.initiative);

  return {
    combatCharacters: combatChars,
    initialInitiatives: initialInitiativeRolls,
    currentInitiativePhase: combatChars[0].initiative,
    currentCharacterIndex: 0,
    actionLog: [{ summary: "Combat Started", details: initiativeLog }]
  };
};

export const createCombatCharacter = (
  character: Character,
  faction: 'faction1' | 'faction2',
  position: number,
  situationalModifiers: number
): CombatCharacter => ({
  ...character,
  faction,
  initiative: 0,
  position,
  current_initiative: 0,
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
  calculate_wound_modifier: () => 0,
  check_status: () => []
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
  let highestInitiative = -1;
  let nextCharacterIndex = -1;

  const updatedChars = combatCharacters.map((char, index) => {
    if (index === currentCharacterIndex) {
      char.current_initiative -= 10;
    }
    if (char.current_initiative > highestInitiative && char.is_conscious) {
      highestInitiative = char.current_initiative;
      nextCharacterIndex = index;
    }
    return char;
  });

  let actionLog = null;

  if (highestInitiative < 1) {
    updatedChars.forEach(char => {
      char.current_initiative = initialInitiatives[char.id];
    });
    highestInitiative = Math.max(...updatedChars.map(char => char.current_initiative));
    nextCharacterIndex = updatedChars.findIndex(char => char.current_initiative === highestInitiative && char.is_conscious);
    
    actionLog = { 
      summary: "Initiative Reset", 
      details: ["All characters' initiatives have been reset to their initial values."]
    };
  }

  return {
    updatedCharacters: updatedChars,
    newInitiativePhase: highestInitiative,
    newCharacterIndex: nextCharacterIndex,
    actionLog
  };
};

export const handleMovement = (
  combatCharacters: CombatCharacter[],
  currentCharacterIndex: number,
  movementDistance: number,
  movementDirection: 'Toward' | 'Away'
): {
  updatedCharacters: CombatCharacter[],
  actionLog: { summary: string, details: string[] }
} => {
  const currentChar = combatCharacters[currentCharacterIndex];
  const maxDistance = currentChar.attributes.agility * 2;

  if (movementDistance > maxDistance) {
    toast.error(`Maximum movement distance is ${maxDistance} meters`);
    return { updatedCharacters: combatCharacters, actionLog: { summary: '', details: [] } };
  }

  const updatedChars = [...combatCharacters];
  updatedChars[currentCharacterIndex].position += movementDirection === 'Toward' ? movementDistance : -movementDistance;

  return {
    updatedCharacters: updatedChars,
    actionLog: { 
      summary: `${currentChar.name} moved ${movementDistance} meters ${movementDirection.toLowerCase()} the opposing faction.`,
      details: []
    }
  };
};

export const handleComplexAction = (
  combatCharacters: CombatCharacter[],
  currentCharacterIndex: number,
  selectedComplexAction: ComplexAction,
  selectedWeapon: Weapon | null,
  selectedTargetId: string | null
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

    updatedChars[currentCharacterIndex].position += extraDistance;
    actionLog = { summary: `${currentChar.name} sprinted an extra ${extraDistance} meters!`, details: [] };
  } else if ((selectedComplexAction === 'FireWeapon' || selectedComplexAction === 'MeleeAttack') && selectedWeapon && selectedTargetId) {
    const target = combatCharacters.find(c => c.id === selectedTargetId);
    if (target) {
      const distance = Math.abs(currentChar.position - target.position);
      const result = resolve_attack(currentChar, target, selectedWeapon, selectedWeapon.currentFireMode, distance);
      
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
  selectedTargets: (string | null)[]
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
        const distance = Math.abs(currentChar.position - target.position);
        const result = resolve_attack(currentChar, target, weapon, weapon.currentFireMode, distance);
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

  character.is_alive = isCharacterAlive(character.physical_damage, maxPhysicalHealth);
  character.is_conscious = isCharacterConscious(character.stun_damage, maxStunHealth, character.physical_damage, maxPhysicalHealth);

  if (wasAlive && !character.is_alive) {
    statusChanges.push(`${character.name} has died!`);
  } else if (wasConscious && !character.is_conscious) {
    statusChanges.push(`${character.name} has been knocked unconscious!`);
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