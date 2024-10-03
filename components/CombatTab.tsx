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
  handleRunAction as handleRunActionFromInterface
} from '../lib/combatInterface'
import { calculateMaxPhysicalHealth, calculateMaxStunHealth, isCharacterAlive, isCharacterConscious, calculateDistance, getRandomEmptyPosition, roundVector, canTakeCover } from '../lib/utils'
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
import { GameMap, generate_map } from '../lib/map'
import { MapDisplay } from './MapDisplay'
import * as Tooltip from '@radix-ui/react-tooltip';
import { rollSprinting, getSprintingDistance } from '@/lib/combatSimulation'

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
  console.log("CombatTab received factions:", { faction1, faction2 });

  const [isCombatActive, setIsCombatActive] = useState(false);
  const [combatCharacters, setCombatCharacters] = useState<CombatCharacter[]>([]);
  const [currentInitiativePhase, setCurrentInitiativePhase] = useState(0);
  const [currentCharacterIndex, setCurrentCharacterIndex] = useState(0);
  const [selectedActionType, setSelectedActionType] = useState<ActionType | null>(null);
  const [selectedSimpleActions, setSelectedSimpleActions] = useState<(SimpleAction | null)[]>([null, null]);
  const [selectedComplexAction, setSelectedComplexAction] = useState<ComplexAction | null>(null);
  const [selectedWeapons, setSelectedWeapons] = useState<(Weapon | null)[]>([null, null]);
  const [selectedTargets, setSelectedTargets] = useState<(string | null)[]>([null, null]);
  const [movementDistance, setMovementDistance] = useState(0);
  const [movementDirection, setMovementDirection] = useState<'Toward' | 'Away'>('Toward');
  const [actionLog, setActionLog] = useState<{ summary: string, details: string[] }[]>([]);
  const [selectedFreeAction, setSelectedFreeAction] = useState<'CallShot' | 'ChangeFireMode' | null>(null);
  const [roundNumber, setRoundNumber] = useState(1);
  const [initialInitiatives, setInitialInitiatives] = useState<Record<string, number>>({});
  const [remainingMovement, setRemainingMovement] = useState<number>(0);
  const [meleeRangeError, setMeleeRangeError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [movementRemaining, setMovementRemaining] = useState(0);
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
  const [sprintBonus, setSprintBonus] = useState<number | null>(null);
  const [isSprinting, setIsSprinting] = useState(false);
  const [mostRecentLog, setMostRecentLog] = useState<{ summary: string, details: string[] } | null>(null);
  const [runModifier, setRunModifier] = useState(0);
  const [canUseTakeCover, setCanUseTakeCover] = useState(false);

  console.log("CombatTab props:", { 
    characters, 
    faction1, 
    faction2, 
    factionModifiers 
  });

  useEffect(() => {
    if (faction1.length > 0 || faction2.length > 0) {
      generateNewMap();
    }
  }, [faction1, faction2]);

  useEffect(() => {
    if (isCombatActive) {
      console.log("Factions changed during active combat:", { faction1, faction2 });
    }
  }, [faction1, faction2, isCombatActive]);

  // Debug: Log placedCharacters whenever it changes
  useEffect(() => {
    console.log("placedCharacters updated:", placedCharacters);
  }, [placedCharacters]);

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
      console.log("Checking if character can take cover:", currentChar.name);
      console.log("Game map:", gameMap);
      console.log("Opponents:", opponents);
      const canTakeCoverResult = canTakeCover(currentChar, gameMap, opponents);
      console.log("Can take cover result:", canTakeCoverResult);
      setCanUseTakeCover(canTakeCoverResult);
    }
  }, [combatCharacters, currentCharacterIndex, gameMap]);

  useEffect(() => {
    console.log("Current character index changed to:", currentCharacterIndex);
    if (combatCharacters.length > 0) {
      const currentChar = combatCharacters[currentCharacterIndex];
      console.log("Current character:", currentChar.name);
      setRemainingMovement(currentChar.movement_remaining);
      setMaxMoveDistance(getMaxMoveDistance(currentChar));
    }
  }, [currentCharacterIndex, combatCharacters]);

  useEffect(() => {
    console.log("--- Initiative order changed ---");
    console.log("New initiative order:", currentInitiativeOrder.map(io => `${io.char.name} (${io.phase})`));
    if (currentInitiativeOrder.length > 0) {
      const currentChar = currentInitiativeOrder[0].char;
      console.log("Current character from initiative order:", currentChar.name);
      const newIndex = combatCharacters.findIndex(char => char.id === currentChar.id);
      console.log(`Setting current character index to ${newIndex}`);
      setCurrentCharacterIndex(newIndex);
      setRemainingMovement(currentChar.movement_remaining);
      setMaxMoveDistance(getMaxMoveDistance(currentChar));
      console.log("Updated current character index to:", newIndex);
    }
  }, [currentInitiativeOrder, combatCharacters]);

  useEffect(() => {
    console.log("Initiative order changed:", currentInitiativeOrder.map(io => `${io.char.name} (${io.phase})`));
    console.log("Current character index:", currentCharacterIndex);
  }, [currentInitiativeOrder, currentCharacterIndex]);

  const calculateInitiativeOrder = (characters: CombatCharacter[]) => {
    const order: { char: CombatCharacter, phase: number }[] = [];
    characters.forEach(char => {
      if (char.is_conscious && char.is_alive) {
        let remainingInitiative = char.current_initiative;
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
    console.log("New map generated:", newMap);
    
    // Automatically place characters in random positions
    const allCharacters = [...faction1, ...faction2].map(id => characters.find(c => c.id === id)).filter(Boolean) as Character[];
    console.log("All characters to place:", allCharacters);

    const newPlacedCharacters = allCharacters.map(character => {
      const position = getRandomEmptyPosition(newMap, allCharacters.length);
      console.log(`Placing ${character.name} at position:`, position);
      return { character, position };
    });
    console.log("New placed characters:", newPlacedCharacters);
    
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
    setCurrentInitiativePhase(result.currentInitiativePhase);
    setCurrentCharacterIndex(result.currentCharacterIndex);
    setActionLog(result.actionLog);
    clearInputs();
    setRoundNumber(1);
    setIsCombatActive(true);
    setCombatEnded(false);
    
    // Set initial remaining movement for all characters
    const initialCombatCharacters = result.combatCharacters.map(char => ({
      ...char,
      movement_remaining: char.attributes.agility * 2
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
    console.log("--- nextCharacter started ---");
    console.log("Current initiative order:", currentInitiativeOrder.map(io => `${io.char.name} (${io.phase})`));
    
    setCurrentInitiativeOrder(prevOrder => {
      const newOrder = [...prevOrder];
      const removedChar = newOrder.shift();
      console.log(`Removed character from initiative: ${removedChar?.char.name}`);
      console.log("New initiative order:", newOrder.map(io => `${io.char.name} (${io.phase})`));
      return newOrder;
    });

    setCurrentCharacterIndex(0);
    console.log("Set current character index to 0");
    console.log("--- nextCharacter finished ---");
  };

  const setDefaultWeaponAndTarget = () => {
    if (combatCharacters.length > 0) {
      const currentChar = combatCharacters[currentCharacterIndex];
      const defaultWeapon = currentChar.weapons[0] || null;
      const defaultTarget = combatCharacters.find(c => c.faction !== currentChar.faction && c.is_conscious)?.id || null;
      
      setSelectedWeapons([defaultWeapon, null]);
      setSelectedTargets([defaultTarget, null]);
    }
  };

  const currentCharacter = combatCharacters[currentCharacterIndex];
  const hasMeleeWeapon = currentCharacter?.weapons.some(w => w.type === 'Melee');
  const hasRangedWeapon = currentCharacter?.weapons.some(w => w.type === 'Ranged');

  const handleActionTypeSelection = (actionType: ActionType) => {
    setSelectedActionType(prev => {
      if (prev === actionType) {
        return null;
      }
      return actionType;
    });
    setSelectedSimpleActions([]);
    setSelectedComplexAction(null);
    if (actionType) {
      setDefaultWeaponAndTarget();
    } else {
      setSelectedWeapons([null, null]);
      setSelectedTargets([null, null]);
    }
  };

  const handleSimpleActionSelection = (action: SimpleAction, index: number) => {
    if (!hasRangedWeapon && ['CallShot', 'ChangeFireMode', 'FireRangedWeapon', 'ReloadWeapon', 'TakeAim'].includes(action)) {
      return; // Do nothing if the character doesn't have a ranged weapon
    }

    if (action === 'TakeCover') {
      if (!canUseTakeCover) {
        toast.error("No suitable cover available.");
        return;
      }
      setSelectedSimpleActions(prev => {
        const newActions = [...prev];
        if (newActions[index] === 'TakeCover') {
          newActions[index] = null;
        } else {
          newActions[index] = 'TakeCover';
          // Deactivate Take Cover for the other Simple Action
          newActions[1 - index] = newActions[1 - index] === 'TakeCover' ? null : newActions[1 - index];
        }
        return newActions;
      });
    } else {
      setSelectedSimpleActions(prev => {
        const newActions = [...prev];
        if (newActions[index] === action) {
          newActions[index] = null;
        } else {
          newActions[index] = action;
        }

        // Set selectedActionType to 'Simple' if any action is selected
        if (newActions.some(a => a !== null)) {
          setSelectedActionType('Simple');
        } else {
          setSelectedActionType(null);
        }

        return newActions;
      });

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

        if (action === 'FireRangedWeapon') {
          defaultWeapon = currentChar.weapons.find(w => w.type === 'Ranged') || null;
          defaultTarget = combatCharacters.find(c => c.faction !== currentChar.faction && c.is_conscious)?.id || null;
        } else if (action === 'ReloadWeapon' || action === 'ChangeFireMode') {
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
    }
  };

  const handleComplexActionSelection = (action: ComplexAction) => {
    if (action === 'MeleeAttack' && !hasMeleeWeapon) {
      return; // Do nothing if the character doesn't have a melee weapon
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
            calculateDistance(currentChar.position, c.position) <= 2
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
      if (target && calculateDistance(attacker.position, target.position) > 2) {
        setMeleeRangeError("Selected target is not within melee range.");
      } else {
        setMeleeRangeError(null);
      }
    }
  };

  const handleMovementHandler = () => {
    if (movementDistance === 0) {
      toast.error('Please enter a movement distance');
      return;
    }

    const { updatedCharacters, actionLog, remainingDistance } = handleMovement(
      combatCharacters,
      currentCharacterIndex,
      movementDistance,
      movementDirection,
      isRunning
    );
    setCombatCharacters(updatedCharacters);
    updateActionLog(actionLog);
    setMovementRemaining(remainingDistance);
    setIsRunning(false);
    setMovementDistance(0);
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
      gameMap  // Add this parameter
    );
    setCombatCharacters(updatedCharacters);
    updateActionLog(actionLog);
    
    // Recalculate initiative order after action
    setCurrentInitiativeOrder(calculateInitiativeOrder(updatedCharacters));
    
    if (combatEnded) {
      endCombat();
      return;
    }
    clearInputs();
    setRemainingMovement(0);
    nextCharacter();
  };

  const handleSimpleActionsHandler = () => {
    console.log("--- handleSimpleActionsHandler started ---");
    console.log("Current character:", combatCharacters[currentCharacterIndex].name);
    console.log("Current initiative order:", currentInitiativeOrder.map(io => `${io.char.name} (${io.phase})`));

    if (!gameMap) {
      console.error("Game map is not initialized.");
      toast.error("Game map is not initialized.");
      return;
    }

    // Filter out null actions
    const validSimpleActions = selectedSimpleActions.filter((action): action is SimpleAction => action !== null);
    console.log("Valid simple actions:", validSimpleActions);

    if (validSimpleActions.length === 0) {
      console.error("No valid simple actions selected.");
      toast.error("No valid simple actions selected.");
      return;
    }

    console.log("Calling handleSimpleActions with:", {
      combatCharacters: combatCharacters.map(c => ({ id: c.id, name: c.name })),
      currentCharacterIndex,
      validSimpleActions,
      selectedWeapons: selectedWeapons.filter((_, index) => selectedSimpleActions[index] !== null),
      selectedTargets: selectedTargets.filter((_, index) => selectedSimpleActions[index] !== null),
      remainingMovement,
      isRunning,
      gameMap: "Initialized"
    });

    try {
      const result = handleSimpleActions(
        combatCharacters,
        currentCharacterIndex,
        validSimpleActions,
        selectedWeapons.filter((_, index) => selectedSimpleActions[index] !== null),
        selectedTargets.filter((_, index) => selectedSimpleActions[index] !== null),
        remainingMovement,
        isRunning,
        gameMap
      );

      console.log("handleSimpleActions result:", result);
      console.log("Updated characters:", result.updatedCharacters.map(c => `${c.name} (Initiative: ${c.current_initiative})`));

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

      console.log("New initiative order:", newInitiativeOrder.map(io => `${io.char.name} (${io.phase})`));

      // Set the new current character
      const newCurrentCharIndex = newInitiativeOrder[0] ? result.updatedCharacters.findIndex(char => char.id === newInitiativeOrder[0].char.id) : 0;
      setCurrentCharacterIndex(newCurrentCharIndex);

      console.log("New current character index:", newCurrentCharIndex);
      console.log("New current character:", result.updatedCharacters[newCurrentCharIndex].name);

      // Clear inputs for the next turn
      clearInputs();

    } catch (error) {
      console.error("Error in handleSimpleActions:", error);
    }
    console.log("--- handleSimpleActionsHandler finished ---");
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
    setMovementDistance(0);
    setMovementDirection('Toward');
    setSelectedFreeAction(null);
  };

  const handleRunActionInComponent = () => {
    if (isSprinting) {
      return; // Do nothing if sprinting
    }

    if (hasMovedWhileRunning) {
      return; // Can't deselect after moving
    }
    
    const { updatedCharacter, actionLog } = handleRunActionFromInterface(combatCharacters[currentCharacterIndex], isRunning);
    
    setIsRunning(!isRunning);
    setCombatCharacters(prevChars => {
      const newChars = [...prevChars];
      newChars[currentCharacterIndex] = updatedCharacter;
      return newChars;
    });
    
    // Remove the line setting runModifier as it doesn't exist on CombatCharacter
    setRemainingMovement(updatedCharacter.movement_remaining);
    setMaxMoveDistance(updatedCharacter.movement_remaining);
    updateActionLog(actionLog);
  };

  const getAvailableMovementDistances = () => {
    const currentChar = combatCharacters[currentCharacterIndex];
    const maxDistance = currentChar.attributes.agility * (isRunning ? 4 : 2);
    const availableMovement = maxDistance - currentChar.movement_remaining;
    
    if (availableMovement <= 0) {
      return [];
    }

    const opposingChars = combatCharacters.filter(c => c.faction !== currentChar.faction && c.is_conscious);
    if (opposingChars.length === 0) {
      return [];
    }

    const closestOpponent = opposingChars.reduce((closest, current) => 
      calculateDistance(current.position, currentChar.position) < calculateDistance(closest.position, currentChar.position) ? current : closest
    );

    const isMovingToward = (movementDirection === 'Toward') === (calculateDistance(currentChar.position, closestOpponent.position) > 0);
    
    let availableDistances = [];
    for (let i = 1; i <= availableMovement; i++) {
      const newPosition = {
        x: isMovingToward ? currentChar.position.x + (closestOpponent.position.x - currentChar.position.x) / Math.abs(closestOpponent.position.x - currentChar.position.x) * i : currentChar.position.x,
        y: isMovingToward ? currentChar.position.y + (closestOpponent.position.y - currentChar.position.y) / Math.abs(closestOpponent.position.y - currentChar.position.y) * i : currentChar.position.y
      };
      
      if (!opposingChars.some(opponent => opponent.position.x === newPosition.x && opponent.position.y === newPosition.y)) {
        availableDistances.push(i);
      }
    }

    return availableDistances;
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
    return isRunning ? baseDistance * 2 : baseDistance;
  };

  useEffect(() => {
    if (combatCharacters.length > 0) {
      const currentChar = combatCharacters[currentCharacterIndex];
      setMaxMoveDistance(getMaxMoveDistance(currentChar));
    }
  }, [combatCharacters, currentCharacterIndex, isRunning]);

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
    const moveDistance = Math.floor(calculateDistance(currentChar.position, roundedPosition));

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

    setCombatCharacters(prevChars => {
      const updatedChars = [...prevChars];
      updatedChars[currentCharacterIndex] = {
        ...updatedChars[currentCharacterIndex],
        position: roundedPosition,
        movement_remaining: updatedChars[currentCharacterIndex].movement_remaining - moveDistance
      };
      return updatedChars;
    });

    setIsSelectingMoveTarget(false);
    setRemainingMovement(prev => prev - moveDistance);
    updateActionLog({ 
      summary: `${currentChar.name} moved ${moveDistance} meters.`, 
      details: [`New position: (${roundedPosition.x}, ${roundedPosition.y})`, `Remaining movement: ${remainingMovement - moveDistance} meters`] 
    });

    // Update placedCharacters immediately after moving
    setPlacedCharacters(prevPlaced => {
      const updatedPlaced = [...prevPlaced];
      const index = updatedPlaced.findIndex(pc => pc.character.id === currentChar.id);
      if (index !== -1) {
        updatedPlaced[index] = { ...updatedPlaced[index], position: roundedPosition };
      }
      return updatedPlaced;
    });

    // Set hasMovedWhileRunning to true if the character is running
    if (isRunning) {
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
    if (isSprinting) {
      // If already sprinting, cancel it
      setIsSprinting(false);
      setSprintBonus(null);
      setRemainingMovement(prev => prev - (sprintBonus || 0));
      setMaxMoveDistance(prev => prev - (sprintBonus || 0));
      setIsRunning(false); // Also cancel running
      updateActionLog({ 
        summary: `${combatCharacters[currentCharacterIndex].name} stopped sprinting.`, 
        details: [`Sprint bonus removed: -${sprintBonus} meters`] 
      });
    } else {
      // Roll for sprint
      const currentChar = combatCharacters[currentCharacterIndex];
      const sprintDistance = getSprintingDistance(currentChar);
      const sprintRoll = rollSprinting(currentChar);
      setSprintBonus(sprintDistance);
      setIsSprinting(true);
      setIsRunning(true); // Automatically set running to true
      setRemainingMovement(prev => prev + sprintDistance);
      setMaxMoveDistance(prev => prev + sprintDistance);
      updateActionLog({ 
        summary: `${currentChar.name} started sprinting.`, 
        details: [`Sprint roll: ${sprintRoll}`, `Movement increased by ${sprintDistance} meters`] 
      });
    }
  };

  // Update this function to determine if the Perform Action button should be disabled
  const isPerformActionDisabled = () => {
    const currentChar = combatCharacters[currentCharacterIndex];
    if (!currentChar?.is_alive || !currentChar?.is_conscious) {
      return "Current character is incapacitated and cannot act.";
    }
    if (!selectedActionType && !selectedFreeAction && movementDistance === 0 && !selectedSimpleActions.some(action => action !== null)) {
      return "Please select an action type, enter a movement distance, choose a free action, or select at least one simple action.";
    }
    return null; // Not disabled
  };

  const updateActionLog = (newLog: { summary: string, details?: string[] }) => {
    const logWithDetails = {
      ...newLog,
      details: newLog.details || []
    };
    setActionLog(prev => [...prev, logWithDetails]);
    setMostRecentLog(logWithDetails);
  };

  const initiativeOrder = currentInitiativeOrder;

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
            disabled={faction1.length === 0 || faction2.length === 0 || isCombatActive}
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
                    deadCharacters={[]} // Add this line
                    unconsciousCharacters={[]} // Add this line
                    placedCharacters={placedCharacters}
                    faction1={faction1}
                    faction2={faction2}
                    placingCharacter={placingCharacter}
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
                        {currentInitiativeOrder.map(({ char, phase }, index) => {
                          const isActiveCharacter = index === 0;
                          const hasWoundModifier = char.original_initiative !== char.total_initiative();
                          const woundModifier = char.original_initiative - char.current_initiative;
                          const textColor = isActiveCharacter 
                            ? (char.faction === 'faction1' ? 'text-blue-600' : 'text-red-600')
                            : 'text-black';
                          return (
                            <React.Fragment key={`${char.id}-${phase}`}>
                              <div className="w-4 text-center text-black">{isActiveCharacter ? "➤" : ""}</div>
                              <div className={`${isActiveCharacter ? "font-bold" : ""} truncate ${textColor}`}>{char.name}</div>
                              <div className="text-right whitespace-nowrap px-1 text-black">
                                {hasWoundModifier && `${char.original_initiative} - ${woundModifier} wound =`}
                              </div>
                              <div className="w-8 text-right text-black">{phase}</div>
                            </React.Fragment>
                          );
                        })}
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
                              <div>Physical: {currentChar.physical_damage} / {maxPhysical}</div>
                              <div>Stun: {currentChar.stun_damage} / {maxStun}</div>
                              <div>Wound Modifier: -{woundModifier}</div>
                              <div>Status: {currentChar.is_alive ? (currentChar.is_conscious ? 'Conscious' : 'Unconscious') : 'Dead'}</div>
                            </>
                          );
                        })()}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Movement</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p>Remaining: {remainingMovement} / {maxMoveDistance} meters {sprintBonus && `(+${sprintBonus} sprint)`}</p>
                      <div className="flex space-x-2">
                        <Button 
                          onClick={handleMoveButtonClick}
                          disabled={isSelectingMoveTarget || remainingMovement <= 0}
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
                        disabled={!hasRangedWeapon}
                      >
                        Call Shot
                      </Button>
                      <Button
                        variant={selectedFreeAction === 'ChangeFireMode' ? 'default' : 'outline'}
                        onClick={() => handleFreeActionSelection('ChangeFireMode')}
                        disabled={!hasRangedWeapon}
                      >
                        Change Fire Mode
                      </Button>
                      <Button
                        variant={isRunning ? 'default' : 'outline'}
                        onClick={handleRunActionInComponent}
                        disabled={isSprinting}
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
                    {isRunning && (
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
                                    selectedActionType === 'Complex' ||
                                    (!hasRangedWeapon && ['CallShot', 'ChangeFireMode', 'FireRangedWeapon', 'ReloadWeapon', 'TakeAim'].includes(action))
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
                            (selectedActionType === 'Simple' && action !== 'Sprint') ||
                            selectedSimpleActions.some(a => a !== null) ||
                            (action === 'MeleeAttack' && !hasMeleeWeapon) ||
                            (action === 'Sprint' && isSprinting)
                          }
                        >
                          {action === 'Sprint' ? (isSprinting ? 'Cancel Sprint' : 'Sprint') : action}
                        </Button>
                      ))}
                    </div>
                    {selectedComplexAction && (
                      <div className="mt-4">
                        {/* Weapon and target selection for complex actions */}
                        {(selectedComplexAction === 'FireWeapon' || selectedComplexAction === 'MeleeAttack') && (
                          <>
                            <Select 
                              value={selectedWeapons[0] ? JSON.stringify(selectedWeapons[0]) : ''}
                              onValueChange={(value) => handleWeaponSelection(JSON.parse(value), 0)}
                            >
                              <SelectTrigger className="mt-2">
                                <SelectValue placeholder="Select Weapon" />
                              </SelectTrigger>
                              <SelectContent>
                                {combatCharacters[currentCharacterIndex].weapons
                                  .filter(w => selectedComplexAction === 'FireWeapon' ? w.type === 'Ranged' : w.type === 'Melee')
                                  .map((weapon, i) => (
                                    <SelectItem key={i} value={JSON.stringify(weapon)}>{weapon.name}</SelectItem>
                                  ))
                                }
                              </SelectContent>
                            </Select>
                            <Select 
                              value={selectedTargets[0] || ''}
                              onValueChange={(value) => handleTargetSelection(value, 0)}
                            >
                              <SelectTrigger className="mt-2">
                                <SelectValue placeholder="Select Target" />
                              </SelectTrigger>
                              <SelectContent>
                                {combatCharacters
                                  .filter(c => c.faction !== combatCharacters[currentCharacterIndex].faction && c.is_conscious)
                                  .map((target) => (
                                    <SelectItem key={target.id} value={target.id}>{target.name}</SelectItem>
                                  ))
                                }
                              </SelectContent>
                            </Select>
                          </>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Tooltip.Provider>
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <span className="w-full">
                        <Button 
                          onClick={() => {
                            console.log("--- Perform Action button clicked ---");
                            console.log("Current character:", combatCharacters[currentCharacterIndex].name);
                            console.log("Selected action type:", selectedActionType);
                            console.log("Selected simple actions:", selectedSimpleActions);

                            const currentChar = combatCharacters[currentCharacterIndex];
                            if (!currentChar.is_alive || !currentChar.is_conscious) {
                              console.log("Current character is incapacitated");
                              nextCharacter();
                              return;
                            }

                            const hasSimpleAction = selectedSimpleActions.some(action => action !== null);

                            if (hasSimpleAction || selectedActionType === 'Simple') {
                              console.log("Calling handleSimpleActionsHandler");
                              handleSimpleActionsHandler();
                            } else if (selectedActionType === 'Complex') {
                              console.log("Calling handleComplexActionHandler");
                              handleComplexActionHandler();
                            } else if (selectedFreeAction) {
                              console.log("Handling Free Action");
                              updateActionLog({ summary: `${currentChar.name} performed a ${selectedFreeAction} action.`, details: [] });
                              clearInputs();
                              nextCharacter();
                            } else if (movementDistance > 0) {
                              console.log("Calling handleMovementHandler");
                              handleMovementHandler();
                            } else {
                              console.log("No action selected");
                            }
                          }}
                          className="w-full bg-green-500 hover:bg-green-600 text-white"
                          disabled={!!isPerformActionDisabled()}
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
                <div className="combat-map"> {/* Add this wrapper div with a class */}
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
                  />
                </div>
                {/* Add this section to display the most recent log entry */}
                {mostRecentLog && (
                  <div className="mt-4 p-2 bg-gray-100 rounded">
                    <h4 className="font-semibold">Most Recent Action:</h4>
                    <p>{mostRecentLog.summary}</p>
                    {mostRecentLog.details && mostRecentLog.details.length > 0 && (
                      <ul className="list-disc list-inside">
                        {mostRecentLog.details.map((detail, index) => (
                          <li key={index}>{detail}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {actionLog.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Action Log</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] w-full rounded-md border p-4">
              {actionLog.map((log, index) => (
                <ActionLogEntry key={index} summary={log.summary} details={log.details} />
              ))}
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </>
  )
}