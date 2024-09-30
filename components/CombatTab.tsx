'use client'

import React, { useState, useEffect } from 'react'
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
  handleFireModeChange
} from '../lib/combatInterface'
import { calculateMaxPhysicalHealth, calculateMaxStunHealth, isCharacterAlive, isCharacterConscious, calculateDistance, getRandomEmptyPosition } from '../lib/utils'
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
  const [currentInitiativePhase, setCurrentInitiativePhase] = useState(0);
  const [currentCharacterIndex, setCurrentCharacterIndex] = useState(0);
  const [selectedActionType, setSelectedActionType] = useState<ActionType | null>(null);
  const [selectedSimpleActions, setSelectedSimpleActions] = useState<SimpleAction[]>([]);
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
  const [mapSize, setMapSize] = useState<Vector>({ x: 50, y: 50 });
  const [partialCoverProb, setPartialCoverProb] = useState(0.1);
  const [hardCoverProb, setHardCoverProb] = useState(0.05);
  const [gameMap, setGameMap] = useState<GameMap | null>(null);
  const [isMapAccepted, setIsMapAccepted] = useState(false);
  const [showMapGeneration, setShowMapGeneration] = useState(false);
  const [placingCharacter, setPlacingCharacter] = useState<Character | null>(null);
  const [placedCharacters, setPlacedCharacters] = useState<Array<{character: Character, position: Vector}>>([]);
  const [isSelectingMoveTarget, setIsSelectingMoveTarget] = useState(false);
  const [maxMoveDistance, setMaxMoveDistance] = useState(0);

  useEffect(() => {
    if (faction1.length > 0 || faction2.length > 0) {
      generateNewMap();
    }
  }, [faction1, faction2]);

  const generateNewMap = () => {
    const newMap = generate_map(mapSize, partialCoverProb, hardCoverProb);
    setGameMap(newMap);
    
    // Automatically place characters in random positions
    const allCharacters = [...faction1, ...faction2].map(id => characters.find(c => c.id === id)).filter(Boolean) as Character[];
    const newPlacedCharacters = allCharacters.map(character => ({
      character,
      position: getRandomEmptyPosition(newMap, allCharacters.length)
    }));
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
    toast.info("Combat has ended!");
  };

  const nextCharacter = () => {
    const { updatedCharacters, newInitiativePhase, newCharacterIndex, actionLog } = updateInitiative(combatCharacters, currentCharacterIndex, initialInitiatives);
    setCombatCharacters(updatedCharacters);
    setCurrentInitiativePhase(newInitiativePhase);
    setCurrentCharacterIndex(newCharacterIndex);
    if (actionLog) {
      setActionLog(prev => [...prev, actionLog]);
    }
    // Update remaining movement for the new character
    setRemainingMovement(updatedCharacters[newCharacterIndex].movement_remaining);
    setIsRunning(false);
    setMaxMoveDistance(getMaxMoveDistance(updatedCharacters[newCharacterIndex]));
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

  const handleActionTypeSelection = (actionType: ActionType) => {
    setSelectedActionType(actionType === selectedActionType ? null : actionType);
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
    setSelectedSimpleActions(prev => {
      const newActions = [...prev];
      newActions[index] = action;
      return newActions;
    });

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
  };

  const handleComplexActionSelection = (action: ComplexAction) => {
    setSelectedComplexAction(action);
    setMeleeRangeError(null);
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
  };

  const handleWeaponSelection = (weapon: Weapon, index: number) => {
    setSelectedWeapons(prev => {
      const newWeapons = [...prev];
      newWeapons[index] = weapon;
      return newWeapons;
    });
  };

  const handleTargetSelection = (targetId: string, index: number) => {
    setSelectedTargets(prev => {
      const newTargets = [...prev];
      newTargets[index] = targetId;
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
    setActionLog(prev => [...prev, actionLog]);
    setMovementRemaining(remainingDistance);
    setIsRunning(false);
    setMovementDistance(0);
  };

  const handleComplexActionHandler = () => {
    if (selectedComplexAction === 'MeleeAttack' && meleeRangeError) {
      toast.error(meleeRangeError);
      return;
    }

    const { updatedCharacters, actionLog, combatEnded } = handleComplexAction(
      combatCharacters,
      currentCharacterIndex,
      selectedComplexAction!,
      selectedWeapons[0],
      selectedTargets[0],
      remainingMovement
    );
    setCombatCharacters(updatedCharacters);
    setActionLog(prev => [...prev, actionLog]);
    if (combatEnded) {
      endCombat();
      return;
    }
    clearInputs();
    setRemainingMovement(0);
    nextCharacter();
  };

  const handleSimpleActionsHandler = () => {
    const { updatedCharacters, actionLog, combatEnded } = handleSimpleActions(
      combatCharacters,
      currentCharacterIndex,
      selectedSimpleActions,
      selectedWeapons,
      selectedTargets,
      remainingMovement
    );
    setCombatCharacters(updatedCharacters);
    setActionLog(prev => [...prev, ...actionLog]);
    if (combatEnded) {
      endCombat();
      return;
    }
    clearInputs();
    setRemainingMovement(0);
    nextCharacter();
  };

  const handleFreeActionSelection = (action: 'CallShot' | 'ChangeFireMode') => {
    setSelectedFreeAction(action === selectedFreeAction ? null : action);
  };

  const handleFireModeChangeHandler = (weaponIndex: number, newFireMode: FireMode) => {
    const { updatedCharacters, actionLog } = handleFireModeChange(combatCharacters, currentCharacterIndex, weaponIndex, newFireMode);
    setCombatCharacters(updatedCharacters);
    setActionLog(prev => [...prev, actionLog]);
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

  const handleRunAction = () => {
    if (isRunning) {
      toast.error("Already running.");
      return;
    }
    setIsRunning(true);
    const currentChar = combatCharacters[currentCharacterIndex];
    const baseMaxDistance = currentChar.attributes.agility * 2;
    const newMaxDistance = baseMaxDistance * 2;
    const newRemainingMovement = newMaxDistance - (baseMaxDistance - currentChar.movement_remaining);
    
    const updatedChars = [...combatCharacters];
    updatedChars[currentCharacterIndex] = {
      ...currentChar,
      movement_remaining: newRemainingMovement
    };
    setCombatCharacters(updatedChars);
    
    setRemainingMovement(newRemainingMovement);
    setMaxMoveDistance(newMaxDistance);
    setActionLog(prev => [...prev, { 
      summary: `${currentChar.name} started running.`, 
      details: [`New max move distance: ${newMaxDistance} meters`, `Remaining movement: ${newRemainingMovement} meters`] 
    }]);
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
    const moveDistance = Math.floor(calculateDistance(currentChar.position, position));

    if (moveDistance > currentChar.movement_remaining) {
      toast.error("Selected position is too far away.");
      return;
    }

    if (gameMap?.cells?.[position.y * (gameMap?.width ?? 0) + position.x] !== 0) {
      toast.error("Cannot move to an occupied or obstacle cell.");
      return;
    }

    if (combatCharacters.some(char => char.position.x === position.x && char.position.y === position.y)) {
      toast.error("Cannot move to a cell occupied by another character.");
      return;
    }

    const updatedChars = [...combatCharacters];
    updatedChars[currentCharacterIndex] = {
      ...updatedChars[currentCharacterIndex],
      position: position,
      movement_remaining: updatedChars[currentCharacterIndex].movement_remaining - moveDistance
    };

    setCombatCharacters(updatedChars);
    setIsSelectingMoveTarget(false);
    setRemainingMovement(updatedChars[currentCharacterIndex].movement_remaining);
    setActionLog(prev => [...prev, { 
      summary: `${currentChar.name} moved ${moveDistance} meters.`, 
      details: [`New position: (${position.x}, ${position.y})`, `Remaining movement: ${updatedChars[currentCharacterIndex].movement_remaining} meters`] 
    }]);
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
          <Button onClick={() => setShowMapGeneration(true)} disabled={faction1.length === 0 || faction2.length === 0 || isCombatActive}>
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
                    placedCharacters={placedCharacters}
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
      
      {isMapAccepted && (
        <>
          {isCombatActive && combatCharacters.length > 0 && gameMap && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Combat Simulation</CardTitle>
                <CardDescription>Initiative Phase: {currentInitiativePhase}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold">Current Character: {combatCharacters[currentCharacterIndex].name}</h3>
                      <p>Faction: {combatCharacters[currentCharacterIndex].faction}</p>
                      <p>Position: {combatCharacters[currentCharacterIndex].position.x}, {combatCharacters[currentCharacterIndex].position.y}</p>
                      <p>Current Initiative: {combatCharacters[currentCharacterIndex].current_initiative}</p>
                      {(() => {
                        const currentChar = combatCharacters[currentCharacterIndex];
                        const maxPhysical = calculateMaxPhysicalHealth(currentChar.attributes.body);
                        const maxStun = calculateMaxStunHealth(currentChar.attributes.willpower);
                        return (
                          <>
                            <p>Physical Damage: {currentChar.physical_damage} / {maxPhysical}</p>
                            <p>Stun Damage: {currentChar.stun_damage} / {maxStun}</p>
                            <p>Status: {currentChar.is_alive ? (currentChar.is_conscious ? 'Conscious' : 'Unconscious') : 'Dead'}</p>
                          </>
                        );
                      })()}
                    </div>
                    <div>
                      <h4 className="font-semibold">Action Type</h4>
                      <div className="flex space-x-2">
                        <Button
                          variant={selectedActionType === 'Simple' ? 'default' : 'outline'}
                          onClick={() => handleActionTypeSelection('Simple')}
                        >
                          Simple Actions (2)
                        </Button>
                        <Button
                          variant={selectedActionType === 'Complex' ? 'default' : 'outline'}
                          onClick={() => handleActionTypeSelection('Complex')}
                        >
                          Complex Action (1)
                        </Button>
                      </div>
                    </div>
                    {selectedActionType === 'Simple' && (
                      <div>
                        <h5 className="font-semibold">Simple Actions</h5>
                        {[0, 1].map((index) => (
                          <div key={index} className="space-y-2">
                            <Select 
                              value={selectedSimpleActions[index] || ''} 
                              onValueChange={(value) => handleSimpleActionSelection(value as SimpleAction, index)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={`Select Simple Action ${index + 1}`} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="CallShot">Call Shot</SelectItem>
                                <SelectItem value="ChangeFireMode">Change Fire Mode</SelectItem>
                                <SelectItem value="FireRangedWeapon">Fire Ranged Weapon</SelectItem>
                                <SelectItem value="ReloadWeapon">Reload Weapon</SelectItem>
                                <SelectItem value="TakeAim">Take Aim</SelectItem>
                                <SelectItem value="TakeCover">Take Cover</SelectItem>
                              </SelectContent>
                            </Select>
                            {(selectedSimpleActions[index] === 'FireRangedWeapon' || 
                              selectedSimpleActions[index] === 'ReloadWeapon' || 
                              selectedSimpleActions[index] === 'ChangeFireMode') && (
                              <Select 
                                value={selectedWeapons[index] ? JSON.stringify(selectedWeapons[index]) : ''}
                                onValueChange={(value) => handleWeaponSelection(JSON.parse(value), index)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select Weapon" />
                                </SelectTrigger>
                                <SelectContent>
                                  {combatCharacters[currentCharacterIndex].weapons
                                    .filter(w => w.type === 'Ranged')
                                    .map((weapon, i) => (
                                      <SelectItem key={i} value={JSON.stringify(weapon)}>{weapon.name}</SelectItem>
                                    ))
                                  }
                                </SelectContent>
                              </Select>
                            )}
                            {selectedSimpleActions[index] === 'FireRangedWeapon' && (
                              <Select 
                                value={selectedTargets[index] || ''}
                                onValueChange={(value) => handleTargetSelection(value, index)}
                              >
                                <SelectTrigger>
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
                            )}
                            {selectedSimpleActions[index] === 'ChangeFireMode' && selectedWeapons[index] && (
                              <Select
                                value={selectedWeapons[index]?.currentFireMode || ''}
                                onValueChange={(value) => handleFireModeChangeHandler(combatCharacters[currentCharacterIndex].weapons.findIndex(w => w.name === selectedWeapons[index]?.name), value as FireMode)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select Fire Mode" />
                                </SelectTrigger>
                                <SelectContent>
                                  {selectedWeapons[index]?.fireModes?.map((mode) => (
                                    <SelectItem key={mode} value={mode}>{mode}</SelectItem>
                                  )) ?? []}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {selectedActionType === 'Complex' && (
                      <div>
                        <h5 className="font-semibold">Complex Action</h5>
                        <Select onValueChange={(value) => handleComplexActionSelection(value as ComplexAction)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Complex Action" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="FireWeapon">Fire Weapon</SelectItem>
                            <SelectItem value="MeleeAttack">Melee Attack</SelectItem>
                            <SelectItem value="Sprint">Sprint</SelectItem>
                          </SelectContent>
                        </Select>
                        {(selectedComplexAction === 'FireWeapon' || selectedComplexAction === 'MeleeAttack') && (
                          <>
                            <Select onValueChange={(value) => handleWeaponSelection(JSON.parse(value), 0)}>
                              <SelectTrigger>
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
                            <Select onValueChange={(value) => handleTargetSelection(value, 0)}>
                              <SelectTrigger>
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
                    <div>
                      <h5 className="font-semibold">Free Action</h5>
                      <div className="flex space-x-2">
                        <Button
                          variant={selectedFreeAction === 'CallShot' ? 'default' : 'outline'}
                          onClick={() => handleFreeActionSelection('CallShot')}
                        >
                          Call Shot
                        </Button>
                        <Button
                          variant={selectedFreeAction === 'ChangeFireMode' ? 'default' : 'outline'}
                          onClick={() => handleFreeActionSelection('ChangeFireMode')}
                        >
                          Change Fire Mode
                        </Button>
                        <Button
                          variant={isRunning ? 'default' : 'outline'}
                          onClick={handleRunAction}
                          disabled={isRunning}
                        >
                          <Play className="mr-2 h-4 w-4" /> Run
                        </Button>
                      </div>
                      {selectedFreeAction === 'ChangeFireMode' && (
                        <div className="mt-2">
                          <Select onValueChange={(value) => {
                            const [weaponIndex, newFireMode] = value.split('|')
                            handleFireModeChangeHandler(parseInt(weaponIndex), newFireMode as FireMode)
                          }}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Weapon and New Fire Mode" />
                            </SelectTrigger>
                            <SelectContent>
                              {combatCharacters[currentCharacterIndex].weapons
                                .filter(w => w.type === 'Ranged')
                                .map((weapon, weaponIndex) => 
                                  weapon.fireModes?.map(mode => (
                                    <SelectItem key={`${weaponIndex}-${mode}`} value={`${weaponIndex}|${mode}`}>
                                      {weapon.name} - {mode}
                                    </SelectItem>
                                  ))
                                )
                              }
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {isRunning && (
                        <p className="mt-2">Character is running. Movement distance doubled for this turn.</p>
                      )}
                    </div>
                    <div>
                      <h5 className="font-semibold">Movement</h5>
                      <p>Max Move Distance: {maxMoveDistance} meters</p>
                      <p>Remaining Move Distance: {remainingMovement} meters</p>
                      <Button 
                        onClick={handleMoveButtonClick}
                        disabled={isSelectingMoveTarget || remainingMovement <= 0}
                      >
                        {isSelectingMoveTarget ? 'Selecting Move Target...' : 'Select Move Target'}
                      </Button>
                      {isSelectingMoveTarget && (
                        <p className="mt-2">Click on the map to select your move target.</p>
                      )}
                    </div>
                    <Button onClick={() => {
                      const currentChar = combatCharacters[currentCharacterIndex];
                      if (!currentChar.is_alive || !currentChar.is_conscious) {
                        toast.error("Current character is incapacitated and cannot act.");
                        nextCharacter();
                        return;
                      }
                      if (selectedActionType === 'Simple') {
                        handleSimpleActionsHandler();
                      } else if (selectedActionType === 'Complex') {
                        handleComplexActionHandler();
                      } else if (selectedFreeAction) {
                        setActionLog(prev => [...prev, { summary: `${combatCharacters[currentCharacterIndex].name} performed a ${selectedFreeAction} action.`, details: [] }]);
                        clearInputs();
                        nextCharacter();
                      } else if (movementDistance > 0) {
                        handleMovementHandler();
                      } else {
                        toast.error('Please select an action type, enter a movement distance, or choose a free action');
                      }
                    }}>
                      Perform Action
                    </Button>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Combat Map</h3>
                    <MapDisplay 
                      map={gameMap}
                      placedCharacters={placedCharacters}
                      onCellClick={handleMapClick}
                      currentCharacter={combatCharacters[currentCharacterIndex]}
                      maxMoveDistance={remainingMovement}
                      isSelectingMoveTarget={isSelectingMoveTarget}
                    />
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
      )}
    </>
  )
}