'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Swords, Play } from 'lucide-react'
import { toast } from 'react-toastify'
import {
  startNewCombat,
  updateInitiative,
  handleMovement,
  handleComplexAction,
  handleSimpleActions,
  handleFireModeChange,
  handleRunAction as handleRunActionFromInterface,
  gridFromGameMap
} from '../lib/combatInterface'
import { calculateMaxPhysicalHealth, calculateMaxStunHealth, taxicabDistance,
  getRandomEmptyPosition, roundVector, canTakeCover, getIntersectedCoverCells, getIntersectedCells } from '../lib/utils'
import {
  ActionType,
  SimpleAction,
  ComplexAction,
  Character,
  CombatCharacter,
  Weapon,
  FireMode,
  Vector
} from '../lib/types'
import { FactionSelector } from './MiscComponents'
import { ActionLogEntry } from './MiscComponents'
import { GameMap, generate_map, CellType } from '../lib/map'
import { MapDisplay } from './MapDisplay'
import * as Tooltip from '@radix-ui/react-tooltip';
import { rollSprinting, getSprintingDistance } from '@/lib/combatSimulation'
import * as PF from 'pathfinding';
import { getRangeCategory } from '../lib/combat';

const WeaponStatsCard = ({ character }: { character: CombatCharacter }) => (
  <Card className="mt-4">
    <CardHeader>
      <CardTitle>{character.name}'s Weapons</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-6 gap-2 font-bold mb-2">
        <div>Name</div>
        <div>Type</div>
        <div>Damage</div>
        <div>AP</div>
        <div>Fire Modes</div>
        <div>Current Mode</div>
      </div>
      {character.weapons.map((weapon, index) => (
        <div key={index} className="grid grid-cols-6 gap-2 mb-1">
          <div>{weapon.name}</div>
          <div>{weapon.type}</div>
          <div>{weapon.damage}{weapon.damageType}</div>
          <div>{weapon.ap}</div>
          <div>{weapon.fireModes?.join(', ') || 'N/A'}</div>
          <div>{weapon.currentFireMode || 'N/A'}</div>
        </div>
      ))}
    </CardContent>
  </Card>
);

export function CombatTab({
  characters,
  faction1,
  faction2,
  factionModifiers,
  handleAddToFaction,
  handleRemoveFromFaction
}: {
  characters: Character[]
  faction1: string[]
  faction2: string[]
  factionModifiers: Record<string, number>
  handleAddToFaction: (characterId: string, faction: 'faction1' | 'faction2') => void
  handleRemoveFromFaction: (characterId: string, faction: 'faction1' | 'faction2') => void
}) {

  const [isCombatActive, setIsCombatActive] = useState(false);
  const [combatCharacters, setCombatCharacters] = useState<CombatCharacter[]>([]);
  const [currentInitiativeIndex, setCurrentInitiativeIndex] = useState(0);
  const [currentCharacterIndex, setCurrentCharacterIndex] = useState(0);
  const [selectedActionType, setSelectedActionType] = useState<ActionType | null>(null);
  const [selectedSimpleActions, setSelectedSimpleActions] = useState<(SimpleAction | null)[]>([null, null]);
  const [selectedComplexAction, setSelectedComplexAction] = useState<ComplexAction | null>(null);
  const [selectedWeapons, setSelectedWeapons] = useState<(Weapon | null)[]>([null, null]);
  const [selectedTargets, setSelectedTargets] = useState<(string | null)[]>([null, null]);
  const [actionLog, setActionLog] = useState<{ summary: string, details: string[] }[]>([]);
  const [selectedFreeAction, setSelectedFreeAction] = useState<'CallShot' | 'ChangeFireMode' | null>(null);
  const [initialInitiatives, setInitialInitiatives] = useState<Record<string, number>>({});
  const [remainingMovement, setRemainingMovement] = useState<number>(0);
  const [meleeRangeError, setMeleeRangeError] = useState<string | null>(null);
  const [mapSize, setMapSize] = useState<Vector>({ x: 35, y: 35 });
  const [partialCoverProb, setPartialCoverProb] = useState(0.05);
  const [hardCoverProb, setHardCoverProb] = useState(0.05);
  const [gameMap, setGameMap] = useState<GameMap | null>(null);
  const [isMapAccepted, setIsMapAccepted] = useState(false);
  const [showMapGeneration, setShowMapGeneration] = useState(false);
  const [placingCharacter, setPlacingCharacter] = useState<Character | null>(null);
  const [placedCharacters, setPlacedCharacters] = useState<Array<{character: Character, position: Vector}>>([]);
  const [isSelectingMoveTarget, setIsSelectingMoveTarget] = useState(false);
  const [maxMoveDistance, setMaxMoveDistance] = useState(0);
  const [combatEnded, setCombatEnded] = useState(false);
  const [hasMovedWhileRunning, setHasMovedWhileRunning] = useState(false);
  const [currentInitiativeOrder, setCurrentInitiativeOrder] = useState<{ char: CombatCharacter, phase: number }[]>([]);
  const [deadCharacters, setDeadCharacters] = useState<string[]>([]);
  const [unconsciousCharacters, setUnconsciousCharacters] = useState<string[]>([]);
  const [runModifier, setRunModifier] = useState(0);
  const [canUseTakeCover, setCanUseTakeCover] = useState(false);
  const [runningCharacters, setRunningCharacters] = useState<Set<string>>(new Set());
  const [sprintingCharacters, setSprintingCharacters] = useState<Set<string>>(new Set());
  const [sprintBonuses, setSprintBonuses] = useState<Record<string, number>>({});
  const [adjacentCoverCells, setAdjacentCoverCells] = useState<Vector[]>([]);
  const [hasValidRangedTargets, setHasValidRangedTargets] = useState(false);

  // Add this function near the top of your component, after the state declarations
  const isActionDisabled = () => {
    return combatEnded || !isCombatActive;
  };

  // Add this function near the top of your component, after the state declarations
  const isFireRangedWeaponDisabled = () => {
    const currentChar = combatCharacters[currentCharacterIndex];
    const rangedWeapons = currentChar.weapons.filter(w => w.type === 'Ranged');
    if (rangedWeapons.length === 0) return true;
    const validTargets = getValidRangedTargets(currentChar, rangedWeapons[0]);
    return validTargets.length === 0;
  };

  useEffect(() => {
    if (faction1.length > 0 || faction2.length > 0) {
      generateNewMap();
    }
  }, [faction1, faction2]);

  // Update this useEffect to keep placedCharacters in sync with combatCharacters
  useEffect(() => {
    if (combatCharacters.length > 0) {
      const updatedPlacedCharacters = combatCharacters.map(combatChar => ({
        character: combatChar,
        position: roundVector(combatChar.position)
      }));
      setPlacedCharacters(updatedPlacedCharacters);
    }
  }, [combatCharacters]);

  useEffect(() => {
    if (combatCharacters.length > 0) {
      setCurrentInitiativeOrder(calculateInitiativeOrder(combatCharacters));
    }
  }, [combatCharacters]);

  useEffect(() => {
    if (isSelectingMoveTarget) {
      const handleClickOutside = (event: MouseEvent) => {
        // Check if the click is outside the map
        if (!(event.target as Element).closest('.combat-map')) {
          setIsSelectingMoveTarget(false);
          toast.info("Move target selection cancelled.");
        }
      };

      document.addEventListener('mousedown', handleClickOutside);

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isSelectingMoveTarget]);

  useEffect(() => {
    const newDeadCharacters = combatCharacters
      .filter(char => !char.is_alive)
      .map(char => char.id);
    const newUnconsciousCharacters = combatCharacters
      .filter(char => char.is_alive && !char.is_conscious)
      .map(char => char.id);

    setDeadCharacters(newDeadCharacters);
    setUnconsciousCharacters(newUnconsciousCharacters);
  }, [combatCharacters]);

  useEffect(() => {
    if (combatCharacters.length > 0 && gameMap) {
      const currentChar = combatCharacters[currentCharacterIndex];
      const opponents = combatCharacters.filter(c => c.faction !== currentChar.faction && c.is_conscious);
      const canTakeCoverResult = canTakeCover(currentChar, gameMap, opponents);
      setCanUseTakeCover(canTakeCoverResult);

      // Calculate adjacent cover cells
      const adjacentCover = getIntersectedCoverCells(currentChar, gameMap, opponents);
      console.log("Adjacent cover cells Use Effect:", adjacentCover);
      setAdjacentCoverCells(adjacentCover);
    }
  }, [combatCharacters, currentCharacterIndex, gameMap]);

  useEffect(() => {
    if (combatCharacters.length > 0) {
      const currentChar = combatCharacters[currentCharacterIndex];
      setRemainingMovement(currentChar.movement_remaining);
      setMaxMoveDistance(getMaxMoveDistance(currentChar));
    }
  }, [currentCharacterIndex, combatCharacters]);

  useEffect(() => {
    if (currentInitiativeOrder.length > 0) {
      const currentChar = currentInitiativeOrder[currentInitiativeIndex % currentInitiativeOrder.length].char;
      const newIndex = combatCharacters.findIndex(char => char.id === currentChar.id);
      setCurrentCharacterIndex(newIndex);
      setRemainingMovement(currentChar.movement_remaining);
      setMaxMoveDistance(getMaxMoveDistance(currentChar));
    }
  }, [currentInitiativeOrder, combatCharacters]);

  // Update this useEffect to set hasValidRangedTargets
  useEffect(() => {
    if (combatCharacters.length > 0 && gameMap) {
      const currentChar = combatCharacters[currentCharacterIndex];
      const rangedWeapons = currentChar.weapons.filter(w => w.type === 'Ranged');
      if (rangedWeapons.length > 0) {
        const validTargets = getValidRangedTargets(currentChar, rangedWeapons[0]);
        setHasValidRangedTargets(validTargets.length > 0);
      } else {
        setHasValidRangedTargets(false);
      }
    }
  }, [combatCharacters, currentCharacterIndex, gameMap]);

  const calculateInitiativeOrder = (characters: CombatCharacter[]) => {
    const order: { char: CombatCharacter, phase: number }[] = [];
    characters.forEach(char => {
      if (char.is_conscious && char.is_alive) {
        let remainingInitiative = char.total_initiative();
        while (remainingInitiative > 0) {
          order.push({ char, phase: remainingInitiative });
          remainingInitiative -= 10;
        }
      }
    });
    return order.sort((a, b) => b.phase - a.phase);
  };

  const generateNewMap = () => {
    const newMap = generate_map(mapSize, partialCoverProb, hardCoverProb);
    
    // Automatically place characters in random positions
    const allCharacters = [...faction1, ...faction2].map(id => characters.find(c => c.id === id)).filter(Boolean) as Character[];

    const newPlacedCharacters = allCharacters.map(character => {
      const position = getRandomEmptyPosition(newMap, allCharacters.length);
      return { character, position };
    });
    
    // Update both map and placed characters in a single state update
    setGameMap(newMap);
    setPlacedCharacters(newPlacedCharacters);
  };

  const startNewCombatHandler = () => {
    if (!gameMap) {
      setShowMapGeneration(true);
      toast.info('Please generate and accept a map before starting combat');
      return;
    }
    if (placedCharacters.length !== [...faction1, ...faction2].length) {
      toast.error("Please place all characters before starting combat.");
      return;
    }
    const result = startNewCombat(faction1, faction2, characters, factionModifiers, gameMap, placedCharacters);
    setCombatCharacters(result.combatCharacters);
    setInitialInitiatives(result.initialInitiatives);
    setCurrentInitiativeIndex(result.currentInitiativeIndex);
    setCurrentCharacterIndex(result.currentCharacterIndex);
    setActionLog(result.actionLog);
    clearInputs();
    setIsCombatActive(true);
    setCombatEnded(false);
    
    // Set initial remaining movement for all characters
    const initialCombatCharacters = result.combatCharacters.map(char => ({
      ...char,
      movement_remaining: char.attributes.agility * 2,
      hasRunThisPhase: false // Add this line
    }));
    setCombatCharacters(initialCombatCharacters);
    
    // Set remaining movement for the first character
    setRemainingMovement(initialCombatCharacters[result.currentCharacterIndex].movement_remaining);
  };

  const endCombat = () => {
    setIsCombatActive(false);
    setCombatEnded(true);
    toast.info("Combat has ended!");
  };

  const nextCharacter = () => {
    const result = updateInitiative(combatCharacters, currentCharacterIndex, initialInitiatives);
    setCombatCharacters(result.updatedCharacters);
    setCurrentInitiativeIndex((prevIndex) => (prevIndex + 1) % currentInitiativeOrder.length);
    setCurrentCharacterIndex(result.newCharacterIndex);
    if (result.actionLog) {
      updateActionLog(result.actionLog);
    }
    
    // Reset action selections
    clearInputs();
    
    // Reset hasMovedWhileRunning for the new character
    setHasMovedWhileRunning(false);

    // Update remaining movement for the new character
    setRemainingMovement(result.updatedCharacters[result.newCharacterIndex].movement_remaining);
    setMaxMoveDistance(getMaxMoveDistance(result.updatedCharacters[result.newCharacterIndex]));

    // Reset running characters
    setRunningCharacters(new Set());
  };

  const currentCharacter = combatCharacters[currentCharacterIndex];
  const hasMeleeWeapon = currentCharacter?.weapons.some(w => w.type === 'Melee');
  const hasRangedWeapon = currentCharacter?.weapons.some(w => w.type === 'Ranged');

  // Add this function to check if there are melee targets in range
  const hasMeleeTargetsInRange = () => {
    const currentChar = combatCharacters[currentCharacterIndex];
    return combatCharacters.some(c => 
      c.faction !== currentChar.faction && 
      c.is_conscious &&
      taxicabDistance(currentChar.position, c.position, gameMap ? gridFromGameMap(gameMap, combatCharacters) : new PF.Grid(0, 0)) <= 2
    );
  };

  // Update this function
  const isFireWeaponDisabled = () => {
    return !hasValidRangedTargets || !hasRangedWeapon;
  };

  const handleSimpleActionSelection = (action: SimpleAction, index: number) => {
    if (!hasRangedWeapon && ['CallShot', 'ChangeFireMode', 'FireRangedWeapon', 'ReloadWeapon', 'TakeAim'].includes(action)) {
      return; // Do nothing if the character doesn't have a ranged weapon
    }

    if (action === 'FireRangedWeapon') {
      if (isFireWeaponDisabled()) {
        toast.error("No valid targets for ranged attack due to hard cover or out of range.");
        return;
      }
      const currentChar = combatCharacters[currentCharacterIndex];
      const rangedWeapons = currentChar.weapons.filter(w => w.type === 'Ranged');
      
      if (rangedWeapons.length > 0) {
        const validTargets = getValidRangedTargets(currentChar, rangedWeapons[0]);
        if (validTargets.length > 0) {
          setSelectedSimpleActions(prev => {
            const newActions = [...prev];
            newActions[index] = action;
            return newActions;
          });
          setSelectedWeapons(prev => {
            const newWeapons = [...prev];
            newWeapons[index] = rangedWeapons[0];
            return newWeapons;
          });
          setSelectedTargets(prev => {
            const newTargets = [...prev];
            newTargets[index] = validTargets[0].id;
            return newTargets;
          });
        } else {
          toast.error("No valid targets for ranged attack due to hard cover or out of range.");
          return;
        }
      } else {
        toast.error("No ranged weapons available.");
        return;
      }
    } else {
      // Handle other action selections
      setSelectedSimpleActions(prev => {
        const newActions = [...prev];
        if (newActions[index] === action) {
          newActions[index] = null;
        } else {
          newActions[index] = action;
        }
        return newActions;
      });
    }

    // Set selectedActionType to 'Simple' if any action is selected
    if (selectedSimpleActions.some(a => a !== null)) {
      setSelectedActionType('Simple');
    } else {
      setSelectedActionType(null);
    }

    setSelectedComplexAction(null);

    if (selectedSimpleActions[index] === action) {
      // Deselecting, so clear weapon and target
      setSelectedWeapons(prev => {
        const newWeapons = [...prev];
        newWeapons[index] = null;
        return newWeapons;
      });
      setSelectedTargets(prev => {
        const newTargets = [...prev];
        newTargets[index] = null;
        return newTargets;
      });
    } else {
      // Selecting, so set default weapon and target
      const currentChar = combatCharacters[currentCharacterIndex];
      let defaultWeapon = null;
      let defaultTarget = null;

      if (action === 'ReloadWeapon' || action === 'ChangeFireMode') {
        defaultWeapon = currentChar.weapons.find(w => w.type === 'Ranged') || null;
      }

      setSelectedWeapons(prev => {
        const newWeapons = [...prev];
        newWeapons[index] = defaultWeapon;
        return newWeapons;
      });
      setSelectedTargets(prev => {
        const newTargets = [...prev];
        newTargets[index] = defaultTarget;
        return newTargets;
      });
    }
  };

  const handleComplexActionSelection = (action: ComplexAction) => {
    if (action === 'MeleeAttack' && !hasMeleeWeapon) {
      return; // Do nothing if the character doesn't have a melee weapon
    }

    if (action === 'FireWeapon' && isFireWeaponDisabled()) {
      toast.error("No valid targets for ranged attack due to hard cover or out of range.");
      return;
    }

    if (action === 'Sprint') {
      handleSprintAction();
      return;
    }

    setSelectedActionType(prev => prev === 'Complex' && selectedComplexAction === action ? null : 'Complex');
    setSelectedComplexAction(prev => prev === action ? null : action);
    setSelectedSimpleActions([]);
    setMeleeRangeError(null);

    if (selectedComplexAction === action) {
      // Deselecting, so clear weapon and target
      setSelectedWeapons([null]);
      setSelectedTargets([null]);
    } else {
      // Selecting, so set default weapon and target
      const currentChar = combatCharacters[currentCharacterIndex];
      let defaultWeapon = null;
      let defaultTarget = null;

      if (action === 'FireWeapon' || action === 'MeleeAttack') {
        defaultWeapon = currentChar.weapons.find(w => w.type === (action === 'FireWeapon' ? 'Ranged' : 'Melee')) || null;
        
        if (action === 'MeleeAttack') {
          const meleeTargets = combatCharacters.filter(c => 
            c.faction !== currentChar.faction && 
            c.is_conscious &&
            taxicabDistance(currentChar.position, c.position, gameMap ? gridFromGameMap(gameMap, combatCharacters) : new PF.Grid(0, 0)) <= 2
          );
          defaultTarget = meleeTargets.length > 0 ? meleeTargets[0].id : null;
          
          if (!defaultTarget) {
            setMeleeRangeError("No opponents within melee range.");
          }
        } else {
          defaultTarget = combatCharacters.find(c => c.faction !== currentChar.faction && c.is_conscious)?.id || null;
        }
      }

      setSelectedWeapons([defaultWeapon]);
      setSelectedTargets([defaultTarget]);
    }
  };

  const handleWeaponSelection = (weapon: Weapon, index: number) => {
    setSelectedWeapons(prev => {
      const newWeapons = [...prev];
      newWeapons[index] = newWeapons[index] === weapon ? null : weapon;
      return newWeapons;
    });
  };

  const handleTargetSelection = (targetId: string, index: number) => {
    setSelectedTargets(prev => {
      const newTargets = [...prev];
      newTargets[index] = newTargets[index] === targetId ? null : targetId;
      return newTargets;
    });

    if (selectedComplexAction === 'MeleeAttack') {
      const attacker = combatCharacters[currentCharacterIndex];
      const target = combatCharacters.find(c => c.id === targetId);
      if (target && taxicabDistance(attacker.position, target.position, gameMap ? gridFromGameMap(gameMap, combatCharacters) : new PF.Grid(0, 0)) > 2) {
        setMeleeRangeError("Selected target is not within melee range.");
      } else {
        setMeleeRangeError(null);
      }
    }
  };

  const handleMovementHandler = (moveTo: Vector) => {
    if (!gameMap) {
      toast.error('Game map is not initialized');
      return;
    }
    const currentChar = combatCharacters[currentCharacterIndex];
    const isRunning = runningCharacters.has(currentChar.id);

    const { updatedCharacters, actionLog, remainingDistance } = handleMovement(
      combatCharacters,
      currentCharacterIndex,
      moveTo,
      isRunning,
      gameMap
    );
    setCombatCharacters(updatedCharacters);
    updateActionLog(actionLog);
    setRemainingMovement(remainingDistance);
    setMaxMoveDistance(getMaxMoveDistance(updatedCharacters[currentCharacterIndex]));
    // setHasMovedWhileRunning(isRunning);

    // setIsSelectingMoveTarget(false);
    // updateActionLog({ 
    //   summary: `${currentChar.name} moved ${moveDistance} meters.`, 
    //   details: [`New position: (${roundedPosition.x}, ${roundedPosition.y})`, `Remaining movement: ${remainingMovement - moveDistance} meters`] 
    // });

    // Update placedCharacters immediately after moving
    // setPlacedCharacters(prevPlaced => {
    //   const updatedPlaced = [...prevPlaced];
    //   const index = updatedPlaced.findIndex(pc => pc.character.id === currentChar.id);
    //   if (index !== -1) {
    //     updatedPlaced[index] = { ...updatedPlaced[index], position: roundedPosition };
    //   }
    //   return updatedPlaced;
    // });

    // Set hasMovedWhileRunning to true if the character is running
    // if (runningCharacters.has(currentChar.id)) {
    //   setHasMovedWhileRunning(true);
    // }
  };

  const handleComplexActionHandler = () => {
    if (selectedComplexAction === 'MeleeAttack' && meleeRangeError) {
      toast.error(meleeRangeError);
      return;
    }

    if (!gameMap) {
      toast.error("Game map is not initialized.");
      return;
    }

    const { updatedCharacters, actionLog, combatEnded } = handleComplexAction(
      combatCharacters,
      currentCharacterIndex,
      selectedComplexAction!,
      selectedWeapons[0],
      selectedTargets[0],
      remainingMovement,
      gameMap
    );
    setCombatCharacters(updatedCharacters);
    updateActionLog(actionLog);
    
    // Recalculate initiative order after action
    const newInitiativeOrder = calculateInitiativeOrder(updatedCharacters);
    setCurrentInitiativeOrder(newInitiativeOrder);
    
    if (combatEnded) {
      endCombat();
      return;
    }

    const newCurrentCharIndex = newInitiativeOrder[0] ? updatedCharacters.findIndex(char => char.id === newInitiativeOrder[0].char.id) : 0;
    setCurrentCharacterIndex(newCurrentCharIndex);
    setCurrentInitiativeIndex((currentInitiativeIndex + 1) % newInitiativeOrder.length);

    // Update remaining movement for the new character
    setRemainingMovement(updatedCharacters[newCurrentCharIndex].movement_remaining);
    setMaxMoveDistance(getMaxMoveDistance(updatedCharacters[newCurrentCharIndex]));

    // Reset Run button and other inputs
    setRunningCharacters(prev => {
      const newSet = new Set(prev);
      newSet.delete(updatedCharacters[currentCharacterIndex].id);  // Use currentCharacterIndex here
      return newSet;
    });
    clearInputs();
  };

  const handleSimpleActionsHandler = () => {
    if (!gameMap) {
      toast.error("Game map is not initialized.");
      return;
    }

    // Filter out null actions
    const validSimpleActions = selectedSimpleActions.filter((action): action is SimpleAction => action !== null);

    if (validSimpleActions.length === 0) {
      toast.error("No valid simple actions selected.");
      return;
    }

    const currentChar = combatCharacters[currentCharacterIndex];
    const isCurrentlyRunning = runningCharacters.has(currentChar.id);

    try {
      const result = handleSimpleActions(
        combatCharacters,
        currentCharacterIndex,
        validSimpleActions,
        selectedWeapons.filter((_, index) => selectedSimpleActions[index] !== null),
        selectedTargets.filter((_, index) => selectedSimpleActions[index] !== null),
        remainingMovement,
        isCurrentlyRunning,
        gameMap
      );

      // Update the combat characters
      setCombatCharacters(result.updatedCharacters);

      // Update the action log
      result.actionLog.forEach(entry => updateActionLog(entry));

      // Update the initiative of the current character
      const updatedCurrentChar = result.updatedCharacters[currentCharacterIndex];
      updatedCurrentChar.current_initiative -= 10;

      // Recalculate the initiative order
      const newInitiativeOrder = calculateInitiativeOrder(result.updatedCharacters);
      setCurrentInitiativeOrder(newInitiativeOrder);
      setCurrentInitiativeIndex((currentInitiativeIndex + 1) % newInitiativeOrder.length);

      // Set the new current character
      const newCurrentCharIndex = newInitiativeOrder[0] ? result.updatedCharacters.findIndex(char => char.id === newInitiativeOrder[0].char.id) : 0;
      setCurrentCharacterIndex(newCurrentCharIndex);

      // Update remaining movement for the new character
      setRemainingMovement(result.updatedCharacters[newCurrentCharIndex].movement_remaining);
      setMaxMoveDistance(getMaxMoveDistance(result.updatedCharacters[newCurrentCharIndex]));

      // Reset Run button and other inputs
      setRunningCharacters(prev => {
        const newSet = new Set(prev);
        newSet.delete(result.updatedCharacters[newCurrentCharIndex].id);
        return newSet;
      });
      clearInputs();

      if (result.combatEnded) {
        endCombat();
        return;
      }

    } catch (error) {
      console.error("Error in handleSimpleActions:", error);
    }
  };

  const handleFreeActionSelection = (action: 'CallShot' | 'ChangeFireMode') => {
    setSelectedFreeAction(action === selectedFreeAction ? null : action);
  };

  const handleFireModeChangeHandler = (weaponIndex: number, newFireMode: FireMode) => {
    const { updatedCharacters, actionLog } = handleFireModeChange(combatCharacters, currentCharacterIndex, weaponIndex, newFireMode);
    setCombatCharacters(updatedCharacters);
    updateActionLog(actionLog);
  };

  const clearInputs = () => {
    setSelectedActionType(null);
    setSelectedSimpleActions([]);
    setSelectedComplexAction(null);
    setSelectedWeapons([null, null]);
    setSelectedTargets([null, null]);
    setSelectedFreeAction(null);
    // Don't reset isRunning here, as it's now handled in nextCharacter
  };

  const handleRunActionInComponent = () => {
    const currentChar = combatCharacters[currentCharacterIndex];
    const isCurrentlyRunning = runningCharacters.has(currentChar.id);
    const isCurrentlySprinting = sprintingCharacters.has(currentChar.id);

    if (isCurrentlySprinting || currentChar.hasRunThisPhase) {
      return; // Do nothing if sprinting or has already run this phase
    }

    if (isCurrentlyRunning && hasMovedWhileRunning) {
      return; // Can't deselect after moving
    }
    
    const { updatedCharacter, actionLog } = handleRunActionFromInterface(currentChar, isCurrentlyRunning);
    
    if (actionLog.summary.includes("cannot run again")) {
      toast.error(actionLog.summary);
      return;
    }

    setRunningCharacters(prev => {
      const newSet = new Set(prev);
      if (isCurrentlyRunning) {
        newSet.delete(currentChar.id);
      } else {
        newSet.add(currentChar.id);
      }
      return newSet;
    });

    setCombatCharacters(prevChars => {
      const newChars = [...prevChars];
      newChars[currentCharacterIndex] = updatedCharacter;
      return newChars;
    });
    
    const newMaxMoveDistance = getMaxMoveDistance(updatedCharacter);
    setRemainingMovement(updatedCharacter.movement_remaining);
    setMaxMoveDistance(newMaxMoveDistance);
    updateActionLog(actionLog);
  };

  const handleAcceptMap = () => {
    if (placedCharacters.length !== [...faction1, ...faction2].length) {
      toast.error("Please place all characters before accepting the map.");
      return;
    }
    setIsMapAccepted(true);
    setShowMapGeneration(false);
    toast.success("Map accepted!");
    startNewCombatHandler();
  };

  const handleMapCellClick = (position: Vector) => {
    if (!placingCharacter || !gameMap) return;
    
    if (gameMap.cells[position.y * gameMap.width + position.x] !== 0) {
      toast.error("This cell is not empty. Please choose an empty cell.");
      return;
    }

    const existingIndex = placedCharacters.findIndex(pc => pc.character.id === placingCharacter.id);
    if (existingIndex !== -1) {
      setPlacedCharacters(prev => [
        ...prev.slice(0, existingIndex),
        { character: placingCharacter, position },
        ...prev.slice(existingIndex + 1)
      ]);
    } else {
      setPlacedCharacters(prev => [...prev, { character: placingCharacter, position }]);
    }

    setPlacingCharacter(null);
  };

  const getMaxMoveDistance = (character: CombatCharacter) => {
    const baseDistance = character.attributes.agility * 2;
    const runningMultiplier = runningCharacters.has(character.id) ? 2 : 1;
    const characterSprintBonus = sprintingCharacters.has(character.id) ? (sprintBonuses[character.id] || 0) : 0;
    return baseDistance * runningMultiplier + characterSprintBonus;
  };

  useEffect(() => {
    if (combatCharacters.length > 0) {
      const currentChar = combatCharacters[currentCharacterIndex];
      setMaxMoveDistance(getMaxMoveDistance(currentChar));
    }
  }, [combatCharacters, currentCharacterIndex, runningCharacters]);

  const handleMoveButtonClick = () => {
    if (remainingMovement <= 0) {
      toast.error("No movement remaining for this turn.");
      return;
    }
    setIsSelectingMoveTarget(true);
  };

  const handleMapClick = (position: Vector) => {
    if (!isSelectingMoveTarget) return;

    const currentChar = combatCharacters[currentCharacterIndex];
    const roundedPosition = roundVector(position);
    const moveDistance = Math.floor(taxicabDistance(currentChar.position, roundedPosition, gameMap ?
      gridFromGameMap(gameMap, combatCharacters) : new PF.Grid(0, 0)));

    if (moveDistance > remainingMovement) {
      toast.error("Selected position is too far away.");
      return;
    }

    if (gameMap?.cells?.[roundedPosition.y * (gameMap?.width ?? 0) + roundedPosition.x] !== 0) {
      toast.error("Cannot move to an occupied or obstacle cell.");
      return;
    }

    if (combatCharacters.some(char => char.position.x === roundedPosition.x && char.position.y === roundedPosition.y)) {
      toast.error("Cannot move to a cell occupied by another character.");
      return;
    }
    handleMovementHandler(roundedPosition);


    setIsSelectingMoveTarget(false);
    // setRemainingMovement(prev => prev - moveDistance);
    // console.log("handleMapClick: Remaining movement:", remainingMovement);
    // updateActionLog({ 
    //   summary: `${currentChar.name} moved ${moveDistance} meters.`, 
    //   details: [`New position: (${roundedPosition.x}, ${roundedPosition.y})`, `Remaining movement: ${remainingMovement - moveDistance} meters`] 
    // });

    // // Update placedCharacters immediately after moving
    // setPlacedCharacters(prevPlaced => {
    //   const updatedPlaced = [...prevPlaced];
    //   const index = updatedPlaced.findIndex(pc => pc.character.id === currentChar.id);
    //   if (index !== -1) {
    //     updatedPlaced[index] = { ...updatedPlaced[index], position: roundedPosition };
    //   }
    //   return updatedPlaced;
    // });

    // Set hasMovedWhileRunning to true if the character is running
    if (runningCharacters.has(currentChar.id)) {
      setHasMovedWhileRunning(true);
    }
  };

  const handleNewCombatClick = () => {
    setShowMapGeneration(true);
    setCombatEnded(false);
    setIsCombatActive(false);
    setActionLog([]);
    clearInputs();
    setIsMapAccepted(false);
    generateNewMap();
  };

  const handleSprintAction = () => {
    const currentChar = combatCharacters[currentCharacterIndex];
    const isCurrentlySprinting = sprintingCharacters.has(currentChar.id);

    if (isCurrentlySprinting) {
      // If already sprinting, cancel it
      setSprintingCharacters(prev => {
        const newSet = new Set(prev);
        newSet.delete(currentChar.id);
        return newSet;
      });
      setSprintBonuses(prev => {
        const newBonuses = { ...prev };
        delete newBonuses[currentChar.id];
        return newBonuses;
      });
      setRemainingMovement(prev => prev - (sprintBonuses[currentChar.id] || 0));
      setMaxMoveDistance(prev => prev - (sprintBonuses[currentChar.id] || 0));
      setRunningCharacters(prev => {
        const newSet = new Set(prev);
        newSet.delete(currentChar.id);
        return newSet;
      });
      updateActionLog({ 
        summary: `${currentChar.name} stopped sprinting.`, 
        details: [`Sprint bonus removed: -${sprintBonuses[currentChar.id] || 0} meters`] 
      });
    } else {
      // Roll for sprint
      const { sprintDistance, sprintRoll, hits } = rollSprinting(currentChar);
      setSprintBonuses(prev => ({
        ...prev,
        [currentChar.id]: sprintDistance
      }));
      setSprintingCharacters(prev => {
        const newSet = new Set(prev);
        newSet.add(currentChar.id);
        return newSet;
      });
      setRunningCharacters(prev => {
        const newSet = new Set(prev);
        newSet.add(currentChar.id);
        return newSet;
      });
      setRemainingMovement(prev => prev + sprintDistance);
      setMaxMoveDistance(prev => prev + sprintDistance);
      updateActionLog({ 
        summary: `${currentChar.name} started sprinting.`, 
        details: [
          `Sprint roll: <dice>${sprintRoll.join(', ')}</dice> (${hits} hits)`,
          `Movement increased by ${sprintDistance} meters`
        ] 
      });
    }
  };

  // Update this function to determine if the Perform Action button should be disabled
  const isPerformActionDisabled = () => {
    const currentChar = combatCharacters[currentCharacterIndex];
    if (!currentChar?.is_alive || !currentChar?.is_conscious) {
      return "Current character is incapacitated and cannot act.";
    }
    if (!selectedActionType && !selectedFreeAction && !selectedSimpleActions.some(action => action !== null)) {
      return "Please select an action type, enter a movement distance, choose a free action, or select at least one simple action.";
    }
    return null; // Not disabled
  };

  // Update the updateActionLog function to add new logs to the beginning of the array
  const updateActionLog = (newLog: { summary: string, details?: string[] }) => {
    const logWithDetails = {
      ...newLog,
      details: newLog.details || []
    };
    setActionLog(prev => [logWithDetails, ...prev]);
  };

  // Update the initiative order display in the CombatTab component
  const initiativeOrder = currentInitiativeOrder.map(({ char, phase }, index) => {
    const isActiveCharacter = index === currentInitiativeIndex;
    const totalInitiative = char.total_initiative();
    const woundModifier = char.original_initiative - totalInitiative;
    const textColor = isActiveCharacter 
      ? (char.faction === 'faction1' ? 'text-blue-600' : 'text-red-600')
      : 'text-black';
    return (
      <React.Fragment key={`${char.id}-${phase}`}>
        <div className="w-4 text-center text-black">{isActiveCharacter ? "➤" : ""}</div>
        <div className={`${isActiveCharacter ? "font-bold" : ""} truncate ${textColor}`}>{char.name}</div>
        <div className="text-right whitespace-nowrap px-1 text-black">
          {woundModifier > 0 && `${char.original_initiative} - ${woundModifier} wound =`}
        </div>
        <div className="w-8 text-right text-black">{phase}</div>
      </React.Fragment>
    );
  });

  // Add this function to get melee targets in range
  const getMeleeTargetsInRange = () => {
    const currentChar = combatCharacters[currentCharacterIndex];
    return combatCharacters.filter(c => 
      c.faction !== currentChar.faction && 
      c.is_conscious &&
      taxicabDistance(currentChar.position, c.position, gameMap ? gridFromGameMap(gameMap, combatCharacters) : new PF.Grid(0, 0)) <= 2
    );
  };

  const getValidRangedTargets = (attacker: CombatCharacter, weapon: Weapon): CombatCharacter[] => {
    if (!gameMap) return []; // Return empty array if gameMap is not initialized

    const opposingFaction = attacker.faction === 'faction1' ? faction2 : faction1;
    return combatCharacters.filter(target => {
      if (!opposingFaction.includes(target.id) || !target.is_conscious) {
        return false;
      }

      const distance = Math.sqrt(
        Math.pow(target.position.x - attacker.position.x, 2) +
        Math.pow(target.position.y - attacker.position.y, 2)
      );

      const { category } = getRangeCategory(weapon, distance);
      if (category === 'Out of Range') {
        return false;
      }

      const intersectedCells = getIntersectedCells(attacker.position, target.position);
      const hasFullCover = intersectedCells.some(cell => 
        gameMap.cells[cell.y * gameMap.width + cell.x] === CellType.HardCover
      );

      return !hasFullCover;
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Combat Simulator</CardTitle>
          <CardDescription>Set up factions and simulate combat.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FactionSelector
              faction="faction1"
              characters={characters}
              factionMembers={faction1}
              factionModifiers={factionModifiers}
              onAddToFaction={handleAddToFaction}
              onRemoveFromFaction={handleRemoveFromFaction}
              onModifierChange={(characterId, value) => {}}
            />
            <FactionSelector
              faction="faction2"
              characters={characters}
              factionMembers={faction2}
              factionModifiers={factionModifiers}
              onAddToFaction={handleAddToFaction}
              onRemoveFromFaction={handleRemoveFromFaction}
              onModifierChange={(characterId, value) => {}}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={handleNewCombatClick} 
            disabled={faction1.length === 0 || faction2.length === 0 || (isCombatActive && !combatEnded)}
          >
            <Swords className="mr-2 h-4 w-4" /> New Combat
          </Button>
        </CardFooter>
      </Card>
      
      {showMapGeneration && !isMapAccepted && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Map Generation and Character Placement</CardTitle>
            <CardDescription>Generate the map and place characters.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="w-1/2 space-y-4">
                <div className="flex gap-4">
                  <div className="w-1/2">
                    <Label htmlFor="mapWidth" className="block mb-2">Map Width:</Label>
                    <Input
                      id="mapWidth"
                      type="number"
                      value={mapSize.x}
                      onChange={(e) => setMapSize(prev => ({ ...prev, x: parseInt(e.target.value) }))}
                      className="w-full"
                    />
                  </div>
                  <div className="w-1/2">
                    <Label htmlFor="mapHeight" className="block mb-2">Map Height:</Label>
                    <Input
                      id="mapHeight"
                      type="number"
                      value={mapSize.y}
                      onChange={(e) => setMapSize(prev => ({ ...prev, y: parseInt(e.target.value) }))}
                      className="w-full"
                    />
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-1/2">
                    <Label htmlFor="partialCoverProb" className="block mb-2">Partial Cover Probability:</Label>
                    <Input
                      id="partialCoverProb"
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={partialCoverProb}
                      onChange={(e) => setPartialCoverProb(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div className="w-1/2">
                    <Label htmlFor="hardCoverProb" className="block mb-2">Hard Cover Probability:</Label>
                    <Input
                      id="hardCoverProb"
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={hardCoverProb}
                      onChange={(e) => setHardCoverProb(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <h5 className="font-semibold mb-2">Place Characters</h5>
                  <div className="grid grid-cols-2 gap-2">
                    {[...faction1, ...faction2].map(characterId => {
                      const character = characters.find(c => c.id === characterId);
                      return character ? (
                        <Button
                          key={character.id}
                          onClick={() => setPlacingCharacter(character)}
                          variant={placingCharacter?.id === character.id ? 'default' : 'outline'}
                        >
                          {character.name}
                        </Button>
                      ) : null;
                    })}
                  </div>
                </div>
              </div>
              <div className="w-1/2">
                {gameMap && (
                  <MapDisplay 
                    map={gameMap} 
                    onCellClick={handleMapCellClick}
                    deadCharacters={[]}
                    unconsciousCharacters={[]}
                    placedCharacters={placedCharacters}
                    faction1={faction1}
                    faction2={faction2}
                    placingCharacter={placingCharacter}
                    adjacentCoverCells={adjacentCoverCells}
                  />
                )}
              </div>
            </div>
            <div className="mt-4 flex justify-end space-x-2">
              <Button onClick={generateNewMap}>Regenerate</Button>
              <Button onClick={handleAcceptMap} disabled={placedCharacters.length !== [...faction1, ...faction2].length}>Accept</Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      {isMapAccepted && (isCombatActive || combatEnded) && combatCharacters.length > 0 && gameMap && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Combat Simulation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card className="col-span-1">
                    <CardHeader>
                      <CardTitle>Initiative Phases</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-[auto,auto,auto,1fr] gap-x-1 gap-y-1 text-sm">
                        {initiativeOrder}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="col-span-1">
                    <CardHeader>
                      <CardTitle>{combatCharacters[currentCharacterIndex].name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>Faction: {combatCharacters[currentCharacterIndex].faction}</div>
                        <div>Initiative: {combatCharacters[currentCharacterIndex].current_initiative}</div>
                        <div>Position: {combatCharacters[currentCharacterIndex].position.x}, {combatCharacters[currentCharacterIndex].position.y}</div>
                        {(() => {
                          const currentChar = combatCharacters[currentCharacterIndex];
                          const maxPhysical = calculateMaxPhysicalHealth(currentChar.attributes.body);
                          const maxStun = calculateMaxStunHealth(currentChar.attributes.willpower);
                          const woundModifier = Math.floor((currentChar.physical_damage + currentChar.stun_damage) / 3);
                          return (
                            <>
                              <div>Physical: {maxPhysical - currentChar.physical_damage} / {maxPhysical}</div>
                              <div>Stun: {maxStun - currentChar.stun_damage} / {maxStun}</div>
                              <div>Wound Modifier: -{woundModifier}</div>
                              <div>Status: {currentChar.is_alive ? (currentChar.is_conscious ? 'Conscious' : 'Unconscious') : 'Dead'}</div>
                            </>
                          );
                        })()}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Move WeaponStatsCard here, above the Movement card */}
                {combatCharacters.length > 0 && (
                  <WeaponStatsCard character={combatCharacters[currentCharacterIndex]} />
                )}

                <Card>
                  <CardHeader>
                    <CardTitle>Movement</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p>Remaining: {remainingMovement} / {maxMoveDistance} meters 
                         {sprintBonuses[currentCharacter.id] && 
                          `(+${sprintBonuses[currentCharacter.id]} sprint)`}
                      </p>
                      <div className="flex space-x-2">
                        <Button 
                          onClick={handleMoveButtonClick}
                          disabled={isActionDisabled() || isSelectingMoveTarget || remainingMovement <= 0}
                          className="bg-yellow-500 hover:bg-yellow-600 text-white"
                        >
                          {isSelectingMoveTarget ? 'Selecting Move Target...' : 'Select Move Target'}
                        </Button>
                      </div>
                      {isSelectingMoveTarget && (
                        <p className="mt-2">Click on the map to select your move target.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Free Action</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex space-x-2">
                      <Button
                        variant={selectedFreeAction === 'CallShot' ? 'default' : 'outline'}
                        onClick={() => handleFreeActionSelection('CallShot')}
                        disabled={isActionDisabled() || !hasRangedWeapon}
                      >
                        Call Shot
                      </Button>
                      <Button
                        variant={selectedFreeAction === 'ChangeFireMode' ? 'default' : 'outline'}
                        onClick={() => handleFreeActionSelection('ChangeFireMode')}
                        disabled={isActionDisabled() || !hasRangedWeapon}
                      >
                        Change Fire Mode
                      </Button>
                      <Button
                        variant={runningCharacters.has(currentCharacter.id) ? 'default' : 'outline'}
                        onClick={handleRunActionInComponent}
                        disabled={isActionDisabled() || sprintingCharacters.has(currentCharacter.id) || currentCharacter.hasRunThisPhase}
                      >
                        <Play className="mr-2 h-4 w-4" /> Run
                      </Button>
                    </div>
                    {selectedFreeAction === 'ChangeFireMode' && (
                      <div className="mt-2 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          {combatCharacters[currentCharacterIndex].weapons
                            .filter(w => w.type === 'Ranged')
                            .map((weapon, weaponIndex) => (
                              <div key={weaponIndex} className="space-y-1">
                                <p className="text-sm font-semibold">{weapon.name}</p>
                                <div className="grid grid-cols-2 gap-1">
                                  {weapon.fireModes?.map(mode => (
                                    <Button
                                      key={`${weaponIndex}-${mode}`}
                                      variant={selectedWeapons[0] === weapon && selectedTargets[0] === mode ? 'default' : 'outline'}
                                      onClick={() => {
                                        handleWeaponSelection(weapon, 0);
                                        handleTargetSelection(mode, 0);
                                        handleFireModeChangeHandler(weaponIndex, mode as FireMode);
                                      }}
                                      className="w-full text-xs"
                                    >
                                      {mode}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            ))
                          }
                        </div>
                      </div>
                    )}
                    {runningCharacters.has(currentCharacter.id) && (
                      <p className="mt-2">Character is running. Movement distance doubled for this turn. Run Modifier: {runModifier}</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Simple Actions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      {[0, 1].map((index) => (
                        <Card key={index}>
                          <CardHeader>
                            <CardTitle>Simple Action {index + 1}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 gap-2">
                              {['CallShot', 'ChangeFireMode', 'FireRangedWeapon', 'ReloadWeapon', 'TakeAim', 'TakeCover'].map((action) => (
                                <Button
                                  key={action}
                                  variant={selectedSimpleActions[index] === action ? 'default' : 'outline'}
                                  onClick={() => handleSimpleActionSelection(action as SimpleAction, index)}
                                  className="w-full"
                                  disabled={
                                    isActionDisabled() ||
                                    selectedActionType === 'Complex' ||
                                    (!hasRangedWeapon && ['CallShot', 'ChangeFireMode', 'FireRangedWeapon', 'ReloadWeapon', 'TakeAim'].includes(action)) ||
                                    (action === 'FireRangedWeapon' && !hasValidRangedTargets) ||
                                    (action === 'TakeCover' && !canUseTakeCover)
                                  }
                                >
                                  {action}
                                </Button>
                              ))}
                            </div>
                            {/* Weapon and target selection for simple actions */}
                            {(selectedSimpleActions[index] === 'FireRangedWeapon' || 
                              selectedSimpleActions[index] === 'ReloadWeapon' || 
                              selectedSimpleActions[index] === 'ChangeFireMode') && (
                              <div className="mt-2 space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  {combatCharacters[currentCharacterIndex].weapons
                                    .filter(w => w.type === 'Ranged')
                                    .map((weapon, i) => (
                                      <Button
                                        key={i}
                                        variant={selectedWeapons[index] === weapon ? 'default' : 'outline'}
                                        onClick={() => handleWeaponSelection(weapon, index)}
                                        className="w-full"
                                      >
                                        {weapon.name}
                                      </Button>
                                    ))
                                  }
                                </div>
                                {selectedSimpleActions[index] === 'FireRangedWeapon' && (
                                  <div className="grid grid-cols-2 gap-2">
                                    {combatCharacters
                                      .filter(c => c.faction !== combatCharacters[currentCharacterIndex].faction && c.is_conscious)
                                      .map((target) => (
                                        <Button
                                          key={target.id}
                                          variant={selectedTargets[index] === target.id ? 'default' : 'outline'}
                                          onClick={() => handleTargetSelection(target.id, index)}
                                          className="w-full"
                                        >
                                          {target.name}
                                        </Button>
                                      ))
                                    }
                                  </div>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Complex Action</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-2">
                      {['FireWeapon', 'MeleeAttack', 'Sprint'].map((action) => (
                        <Button
                          key={action}
                          variant={selectedComplexAction === action ? 'default' : 'outline'}
                          onClick={() => handleComplexActionSelection(action as ComplexAction)}
                          className={`w-full ${action === 'Sprint' ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : ''}`}
                          disabled={
                            isActionDisabled() ||
                            (selectedActionType === 'Simple' && action !== 'Sprint') ||
                            selectedSimpleActions.some(a => a !== null) ||
                            (action === 'MeleeAttack' && (!hasMeleeWeapon || !hasMeleeTargetsInRange())) ||
                            (action === 'FireWeapon' && (!hasRangedWeapon || isFireRangedWeaponDisabled())) ||
                            (action === 'Sprint' && sprintingCharacters.has(currentCharacter.id))
                          }
                        >
                          {action === 'Sprint' ? (sprintingCharacters.has(currentCharacter.id) ? 'Cancel Sprint' : 'Sprint') : action}
                        </Button>
                      ))}
                    </div>
                    {selectedComplexAction && (
                      <div className="mt-4">
                        {/* Weapon and target selection for complex actions */}
                        {(selectedComplexAction === 'FireWeapon' || selectedComplexAction === 'MeleeAttack') && (
                          <>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              {combatCharacters[currentCharacterIndex].weapons
                                .filter(w => selectedComplexAction === 'FireWeapon' ? w.type === 'Ranged' : w.type === 'Melee')
                                .map((weapon, i) => (
                                  <Button
                                    key={i}
                                    variant={selectedWeapons[0] === weapon ? 'default' : 'outline'}
                                    onClick={() => handleWeaponSelection(weapon, 0)}
                                    className="w-full"
                                  >
                                    {weapon.name}
                                  </Button>
                                ))
                              }
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              {(selectedComplexAction === 'FireWeapon' 
                                ? combatCharacters.filter(c => c.faction !== combatCharacters[currentCharacterIndex].faction && c.is_conscious)
                                : getMeleeTargetsInRange()
                              ).map((target) => (
                                <Button
                                  key={target.id}
                                  variant={selectedTargets[0] === target.id ? 'default' : 'outline'}
                                  onClick={() => handleTargetSelection(target.id, 0)}
                                  className="w-full"
                                >
                                  {target.name}
                                </Button>
                              ))}
                            </div>
                            {selectedComplexAction === 'MeleeAttack' && getMeleeTargetsInRange().length === 0 && (
                              <p className="text-red-500 mt-2">No targets within melee range.</p>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Perform Action button */}
                <Tooltip.Provider>
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <span className="w-full">
                        <Button 
                          onClick={() => {
                            const currentChar = combatCharacters[currentCharacterIndex];
                            if (!currentChar.is_alive || !currentChar.is_conscious) {
                              nextCharacter();
                              return;
                            }

                            const hasSimpleAction = selectedSimpleActions.some(action => action !== null);

                            if (hasSimpleAction || selectedActionType === 'Simple') {
                              handleSimpleActionsHandler();
                            } else if (selectedActionType === 'Complex') {
                              handleComplexActionHandler();
                            } else if (selectedFreeAction) {
                              updateActionLog({ summary: `${currentChar.name} performed a ${selectedFreeAction} action.`, details: [] });
                              clearInputs();
                              nextCharacter();
                            } else {
                              console.log("No action selected");
                            }
                          }}
                          className="w-full bg-green-500 hover:bg-green-600 text-white"
                          disabled={isActionDisabled() || !!isPerformActionDisabled()}
                        >
                          Perform Action
                        </Button>
                      </span>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        className="bg-gray-800 text-white p-2 rounded shadow-lg z-50"
                        sideOffset={5}
                      >
                        {isPerformActionDisabled()}
                        <Tooltip.Arrow className="fill-gray-800" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </Tooltip.Provider>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Combat Map</h3>
                <div className="combat-map">
                  <MapDisplay 
                    map={gameMap}
                    placedCharacters={placedCharacters}
                    placingCharacter={placingCharacter}
                    onCellClick={handleMapClick}
                    currentCharacter={combatCharacters[currentCharacterIndex]}
                    maxMoveDistance={remainingMovement}
                    isSelectingMoveTarget={isSelectingMoveTarget}
                    faction1={faction1}
                    faction2={faction2}
                    deadCharacters={deadCharacters}
                    unconsciousCharacters={unconsciousCharacters}
                    adjacentCoverCells={adjacentCoverCells}
                  />
                </div>
                {actionLog.length > 0 && (
                  <Card className="mt-4">
                    <CardHeader>
                      <CardTitle>Action Log (most recent first)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[1000px] w-full rounded-md border p-4">
                        {actionLog.map((log, index) => (
                          <ActionLogEntry key={index} summary={log.summary} details={log.details} />
                        ))}
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}