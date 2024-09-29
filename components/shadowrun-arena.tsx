'use client'

import React from 'react';
import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { PlusCircle, Trash2, Edit, Swords, Play, ChevronDown, ChevronUp } from 'lucide-react'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import {
  startNewCombat,
  updateInitiative,
  handleMovement,
  handleComplexAction,
  handleSimpleActions,
  handleFireModeChange,
  displayRoundSummary
} from '../lib/combatInterface'
import { calculateMaxPhysicalHealth, calculateMaxStunHealth, isCharacterAlive, isCharacterConscious, cn, calculateDistance } from '../lib/utils'
import {
  Attribute,
  Skill,
  FireMode,
  Metatype,
  ActionType,
  SimpleAction,
  ComplexAction,
  Character,
  CombatCharacter,
  Weapon,
  RoundResult,
  MatchResult
} from '../lib/types'
import {
  initialCharacter,
  initialWeapon,
  saveCharacter,
  deleteCharacter,
  addToFaction,
  removeFromFaction,
  validateWeapon,
  addWeapon,
  removeWeapon
} from '@/lib/characterManagement'
import { ActionLogEntry, SimulationResult, FactionSelector } from './MiscComponents'
import { CharacterManagement } from './CharacterManagement'
import {
  runSingleSimulation,
  calculateRoundWins
} from '../lib/combatSimulation'
import { Vector, GameMap, generate_map } from '../lib/map'
import { MapDisplay } from './MapDisplay'

export function ShadowrunArena() {
  const [characters, setCharacters] = useState<Character[]>([])
  const [faction1, setFaction1] = useState<string[]>([])
  const [faction2, setFaction2] = useState<string[]>([])
  const [combatResults, setCombatResults] = useState<MatchResult[]>([])
  const [simulations, setSimulations] = useState<number>(100)
  const [factionModifiers, setFactionModifiers] = useState<Record<string, number>>({})
  const [_, setExpandedSimulations] = useState<number[]>([])
  const [combatCharacters, setCombatCharacters] = useState<CombatCharacter[]>([])
  const [currentInitiativePhase, setCurrentInitiativePhase] = useState(0)
  const [currentCharacterIndex, setCurrentCharacterIndex] = useState(0)
  const [selectedActionType, setSelectedActionType] = useState<ActionType | null>(null)
  const [selectedSimpleActions, setSelectedSimpleActions] = useState<SimpleAction[]>([])
  const [selectedComplexAction, setSelectedComplexAction] = useState<ComplexAction | null>(null)
  const [selectedWeapons, setSelectedWeapons] = useState<(Weapon | null)[]>([null, null])
  const [selectedTargets, setSelectedTargets] = useState<(string | null)[]>([null, null])
  const [movementDistance, setMovementDistance] = useState(0)
  const [movementDirection, setMovementDirection] = useState<'Toward' | 'Away'>('Toward')
  const [actionLog, setActionLog] = useState<{ summary: string, details: string[] }[]>([])
  const [initialDistance, setInitialDistance] = useState(10)
  const [selectedFreeAction, setSelectedFreeAction] = useState<'CallShot' | 'ChangeFireMode' | null>(null)
  const [roundNumber, setRoundNumber] = useState(1)
  const [initialInitiatives, setInitialInitiatives] = useState<Record<string, number>>({});
  const [isCombatActive, setIsCombatActive] = useState(false);
  const [simulationInitialDistance, setSimulationInitialDistance] = useState(10)
  const [remainingMovement, setRemainingMovement] = useState(0);
  const [meleeRangeError, setMeleeRangeError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [movementRemaining, setMovementRemaining] = useState(0);
  const [mapSize, setMapSize] = useState<Vector>({ x: 25, y: 25 })
  const [partialCoverProb, setPartialCoverProb] = useState(0.1)
  const [hardCoverProb, setHardCoverProb] = useState(0.05)
  const [gameMap, setGameMap] = useState<GameMap | null>(null)

  // Load characters from localStorage only once when the component mounts
  useEffect(() => {
    const storedCharacters = localStorage.getItem('shadowrunCharacters')
    if (storedCharacters) {
      setCharacters(JSON.parse(storedCharacters))
    }
  }, []) // Empty dependency array means this effect runs only once on mount

  // Save characters to localStorage whenever the characters state changes
  useEffect(() => {
    // Only save if characters is not empty
    if (characters.length > 0) {
      localStorage.setItem('shadowrunCharacters', JSON.stringify(characters))
    }
  }, [characters]) // This effect runs whenever characters state changes

  useEffect(() => {
    generateNewMap()
  }, [])

  const generateNewMap = () => {
    const newMap = generate_map(mapSize, partialCoverProb, hardCoverProb)
    setGameMap(newMap)
  }

  const startNewCombatHandler = () => {
    const { combatCharacters, initialInitiatives, currentInitiativePhase, currentCharacterIndex, actionLog } = startNewCombat(faction1, faction2, characters, factionModifiers, initialDistance);
    setCombatCharacters(combatCharacters);
    setInitialInitiatives(initialInitiatives);
    setCurrentInitiativePhase(currentInitiativePhase);
    setCurrentCharacterIndex(currentCharacterIndex);
    setActionLog(actionLog);
    clearInputs();
    setRoundNumber(1);
    setIsCombatActive(true);
  };

  const endCombat = () => {
    setIsCombatActive(false)
    toast.info("Combat has ended!")
  }

  const nextCharacter = () => {
    const { updatedCharacters, newInitiativePhase, newCharacterIndex, actionLog } = updateInitiative(combatCharacters, currentCharacterIndex, initialInitiatives);
    setCombatCharacters(updatedCharacters);
    setCurrentInitiativePhase(newInitiativePhase);
    setCurrentCharacterIndex(newCharacterIndex);
    if (actionLog) {
      setActionLog(prev => [...prev, actionLog]);
    }
  };

  const runSimulations = () => {
    const results: MatchResult[] = []

    for (let i = 0; i < simulations; i++) {
      const simulationResult = runSingleSimulation(faction1, faction2, characters, factionModifiers, simulationInitialDistance)
      results.push(simulationResult)
    }

    setCombatResults(results)
  }

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
      
      // For MeleeAttack, find the closest target within melee range
      if (action === 'MeleeAttack') {
        const meleeTargets = combatCharacters.filter(c => 
          c.faction !== currentChar.faction && 
          c.is_conscious &&
          calculateDistance(currentChar.position, c.position) <= 2 // Assuming melee range is 2 meters
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

    // Check melee range if MeleeAttack is selected
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
      toast.error('Please enter a movement distance')
      return
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
    setIsRunning(false); // Reset running state after movement
    
    // Update the movement distance dropdown
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
    setSelectedFreeAction(action === selectedFreeAction ? null : action)
  }

  const handleFireModeChangeHandler = (weaponIndex: number, newFireMode: FireMode) => {
    const { updatedCharacters, actionLog } = handleFireModeChange(combatCharacters, currentCharacterIndex, weaponIndex, newFireMode);
    setCombatCharacters(updatedCharacters);
    setActionLog(prev => [...prev, actionLog]);
  };

  const clearInputs = () => {
    setSelectedActionType(null)
    setSelectedSimpleActions([])
    setSelectedComplexAction(null)
    setSelectedWeapons([null, null])
    setSelectedTargets([null, null])
    setMovementDistance(0)
    setMovementDirection('Toward')
    setSelectedFreeAction(null)
  }

  const handleAddToFaction = (characterId: string, faction: 'faction1' | 'faction2') => {
    addToFaction(characterId, faction, faction1, setFaction1, faction2, setFaction2, setFactionModifiers);
  };

  const handleRemoveFromFaction = (characterId: string, faction: 'faction1' | 'faction2') => {
    removeFromFaction(characterId, faction, setFaction1, setFaction2, setFactionModifiers);
  };

  const handleRunAction = () => {
    setIsRunning(true);
    toast.info("Running activated. Movement distance doubled for this turn.");
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
      Math.abs(current.position - currentChar.position) < Math.abs(closest.position - currentChar.position) ? current : closest
    );

    const isMovingToward = (movementDirection === 'Toward') === (currentChar.position < closestOpponent.position);
    
    let availableDistances = [];
    for (let i = 1; i <= availableMovement; i++) {
      const newPosition = isMovingToward ? currentChar.position + i : currentChar.position - i;
      
      // Check if this new position would place the character on top of an opponent
      if (!opposingChars.some(opponent => opponent.position === newPosition)) {
        availableDistances.push(i);
      }
    }

    return availableDistances;
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-center mb-6">Shadowrun 5e Arena</h1>
      <Tabs defaultValue="characters">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          {["characters", "combat", "simulations"].map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className={cn(
                "py-2 px-4 text-sm font-medium transition-all",
                "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
                "data-[state=active]:shadow-md",
                "hover:bg-muted"
              )}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="characters">
          <CharacterManagement
            characters={characters}
            setCharacters={setCharacters}
            faction1={faction1}
            setFaction1={setFaction1}
            faction2={faction2}
            setFaction2={setFaction2}
            factionModifiers={factionModifiers}
            setFactionModifiers={setFactionModifiers}
          />
        </TabsContent>
        <TabsContent value="combat">
          <Card>
            <CardHeader>
              <CardTitle>Combat Simulator</CardTitle>
              <CardDescription>Set up factions and simulate combat.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <FactionSelector
                  faction="faction1"
                  characters={characters}
                  factionMembers={faction1}
                  factionModifiers={factionModifiers}
                  onAddToFaction={handleAddToFaction}
                  onRemoveFromFaction={handleRemoveFromFaction}
                  onModifierChange={(characterId, value) => setFactionModifiers(prev => ({ ...prev, [characterId]: value }))}
                />
                <FactionSelector
                  faction="faction2"
                  characters={characters}
                  factionMembers={faction2}
                  factionModifiers={factionModifiers}
                  onAddToFaction={handleAddToFaction}
                  onRemoveFromFaction={handleRemoveFromFaction}
                  onModifierChange={(characterId, value) => setFactionModifiers(prev => ({ ...prev, [characterId]: value }))}
                />
              </div>
              <div className="mt-4">
                <Label htmlFor="initialDistance">Initial Distance (meters):</Label>
                <Input
                  id="initialDistance"
                  type="number"
                  value={initialDistance}
                  onChange={(e) => setInitialDistance(parseInt(e.target.value))}
                  className="w-20"
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={startNewCombatHandler} disabled={faction1.length === 0 || faction2.length === 0 || isCombatActive}>
                <Swords className="mr-2 h-4 w-4" /> New Combat
              </Button>
            </CardFooter>
          </Card>
          
          {/* New Map Generation Card */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Map Generation</CardTitle>
              <CardDescription>Generate and customize the combat map.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <Label htmlFor="mapWidth">Map Width:</Label>
                  <Input
                    id="mapWidth"
                    type="number"
                    value={mapSize.x}
                    onChange={(e) => setMapSize(prev => ({ ...prev, x: parseInt(e.target.value) }))}
                    className="w-20"
                  />
                </div>
                <div>
                  <Label htmlFor="mapHeight">Map Height:</Label>
                  <Input
                    id="mapHeight"
                    type="number"
                    value={mapSize.y}
                    onChange={(e) => setMapSize(prev => ({ ...prev, y: parseInt(e.target.value) }))}
                    className="w-20"
                  />
                </div>
                <div>
                  <Label htmlFor="partialCoverProb">Partial Cover Probability:</Label>
                  <Input
                    id="partialCoverProb"
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={partialCoverProb}
                    onChange={(e) => setPartialCoverProb(parseFloat(e.target.value))}
                    className="w-20"
                  />
                </div>
                <div>
                  <Label htmlFor="hardCoverProb">Hard Cover Probability:</Label>
                  <Input
                    id="hardCoverProb"
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={hardCoverProb}
                    onChange={(e) => setHardCoverProb(parseFloat(e.target.value))}
                    className="w-20"
                  />
                </div>
              </div>
              <div className="flex justify-between">
                <Button onClick={generateNewMap}>Regenerate</Button>
                <Button onClick={() => toast.success("Map accepted!")}>Accept</Button>
              </div>
              {gameMap && (
                <div className="mt-4">
                  <MapDisplay map={gameMap} />
                </div>
              )}
            </CardContent>
          </Card>
          
          {isCombatActive && combatCharacters.length > 0 && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Combat Simulation</CardTitle>
                <CardDescription>Initiative Phase: {currentInitiativePhase}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold">Current Character: {combatCharacters[currentCharacterIndex].name}</h3>
                    <p>Faction: {combatCharacters[currentCharacterIndex].faction}</p>
                    <p>Position: {combatCharacters[currentCharacterIndex].position} meters</p>
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
                                (weapon.fireModes ?? []).map(mode => (
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
                    <div className="flex items-center space-x-2">
                      <Select 
                        defaultValue="Toward"
                        onValueChange={(value) => setMovementDirection(value as 'Toward' | 'Away')}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Select direction" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Toward">Toward</SelectItem>
                          <SelectItem value="Away">Away</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={movementDistance.toString()}
                        onValueChange={(value) => setMovementDistance(parseInt(value))}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Select distance" />
                        </SelectTrigger>
                        <SelectContent>
                          {getAvailableMovementDistances().map((distance) => (
                            <SelectItem key={distance} value={distance.toString()}>
                              {distance}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Label>Meters</Label>
                      <Button 
                        onClick={handleMovementHandler}
                        disabled={getAvailableMovementDistances().length === 0}
                      >
                        Move
                      </Button>
                    </div>
                    {movementRemaining > 0 && (
                      <p>Remaining movement: {movementRemaining} meters</p>
                    )}
                  </div>
                  <Button onClick={() => {
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
        </TabsContent>
        <TabsContent value="simulations">
          <Card>
            <CardHeader>
              <CardTitle>Combat Simulations</CardTitle>
              <CardDescription>Run multiple combat simulations and view the results.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <FactionSelector
                  faction="faction1"
                  characters={characters}
                  factionMembers={faction1}
                  factionModifiers={factionModifiers}
                  onAddToFaction={handleAddToFaction}
                  onRemoveFromFaction={handleRemoveFromFaction}
                  onModifierChange={(characterId, value) => setFactionModifiers(prev => ({ ...prev, [characterId]: value }))}
                />
                <FactionSelector
                  faction="faction2"
                  characters={characters}
                  factionMembers={faction2}
                  factionModifiers={factionModifiers}
                  onAddToFaction={handleAddToFaction}
                  onRemoveFromFaction={handleRemoveFromFaction}
                  onModifierChange={(characterId, value) => setFactionModifiers(prev => ({ ...prev, [characterId]: value }))}
                />
              </div>
              <div className="flex items-center space-x-2 mb-4">
                <Label htmlFor="simulationInitialDistance">Initial Distance (meters):</Label>
                <Input
                  id="simulationInitialDistance"
                  type="number"
                  value={simulationInitialDistance}
                  onChange={(e) => setSimulationInitialDistance(parseInt(e.target.value))}
                  className="w-20"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Label htmlFor="simulations">Number of Simulations:</Label>
                <Input
                  id="simulations"
                  type="number"
                  value={simulations}
                  onChange={(e) => setSimulations(parseInt(e.target.value))}
                  className="w-20"
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={runSimulations} disabled={faction1.length === 0 || faction2.length === 0}>
                <Play className="mr-2 h-4 w-4" /> Run Simulations
              </Button>
            </CardFooter>
          </Card>
          {combatResults.length > 0 && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Simulation Results</CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const roundWins = calculateRoundWins(combatResults);
                  const totalSimulations = combatResults.length;
                  const overallWinner = roundWins['Faction 1'] > roundWins['Faction 2'] ? 'Faction 1' : 'Faction 2';
                  return (
                    <>
                      <p>Overall Winner: {overallWinner}</p>
                      <p>Total Simulations: {totalSimulations}</p>
                      <p>Rounds Won by Faction 1: {roundWins['Faction 1']} ({((roundWins['Faction 1'] / totalSimulations) * 100).toFixed(2)}%)</p>
                      <p>Rounds Won by Faction 2: {roundWins['Faction 2']} ({((roundWins['Faction 2'] / totalSimulations) * 100).toFixed(2)}%)</p>
                      {roundWins['Draw'] > 0 && <p>Draws: {roundWins['Draw']} ({((roundWins['Draw'] / totalSimulations) * 100).toFixed(2)}%)</p>}
                    </>
                  );
                })()}
                <ScrollArea className="h-[300px] w-full mt-4">
                  {combatResults.map((result, index) => (
                    <SimulationResult key={index} result={result} index={index} />
                  ))}
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
      <ToastContainer position="bottom-right" />
    </div>
  )
}