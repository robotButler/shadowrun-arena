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
  roll_initiative,
  resolve_attack,
  apply_damage,
  check_combat_end,
  select_best_weapon,
  get_ideal_range,
} from '../lib/combat'
import { calculateMaxPhysicalHealth, calculateMaxStunHealth, isCharacterAlive, isCharacterConscious, cn } from '../lib/utils'
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
} from '@/lib/character-management'

const ActionLogEntry = ({ summary, details }: { summary: string, details: string[] }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const highlightRoll = (roll: string) => {
    const numValue = parseInt(roll.trim());
    if (numValue >= 5) {
      return <span className="bg-green-200">{roll}</span>;
    } else if (numValue === 1) {
      return <span className="bg-red-200">{roll}</span>;
    }
    return roll;
  };

  const processDetail = (detail: string) => {
    if (detail.includes('rolls:')) {
      const [prefix, rollsAndSummary] = detail.split('rolls:');
      const [rolls, summary] = rollsAndSummary.split('(');
      const highlightedRolls = rolls.split(',').map((roll, index) => (
        <React.Fragment key={index}>
          {highlightRoll(roll.trim())}
          {index < rolls.split(',').length - 1 ? ',' : ''}
          {' '}
        </React.Fragment>
      ));
      return (
        <>
          {prefix}rolls: {highlightedRolls}({summary}
        </>
      );
    }
    return detail;
  };

  return (
    <div className="mb-2">
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="mr-2"
        >
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
        <span>{summary}</span>
      </div>
      {isExpanded && (
        <div className="mt-2 pl-6 text-sm text-muted-foreground">
          {details.map((detail, index) => (
            <p key={index}>{processDetail(detail)}</p>
          ))}
        </div>
      )}
    </div>
  );
};

const SimulationResult = ({ result, index }: { result: MatchResult, index: number }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedRound, setExpandedRound] = useState<number | null>(null);

  return (
    <div className="mb-4">
      <Button
        variant="ghost"
        className="w-full justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span>Simulation {index + 1}: {result.winner} won in {result.rounds} rounds</span>
        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </Button>
      {isExpanded && (
        <div className="mt-2 pl-4">
          {result.roundResults.map((round, roundIndex) => (
            <div key={roundIndex} className="mb-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between"
                onClick={() => setExpandedRound(expandedRound === roundIndex ? null : roundIndex)}
              >
                <span>Round {roundIndex + 1} - {round.actingCharacter} (Initiative Phase: {round.initiativePhase})</span>
                {expandedRound === roundIndex ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
              {expandedRound === roundIndex && (
                <div className="mt-1 pl-4 text-sm">
                  {round.messages.map((message, messageIndex) => (
                    <p key={messageIndex}>{message}</p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export function ShadowrunArena() {
  const [characters, setCharacters] = useState<Character[]>([])
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null)
  const [faction1, setFaction1] = useState<string[]>([])
  const [faction2, setFaction2] = useState<string[]>([])
  const [combatResults, setCombatResults] = useState<MatchResult[]>([])
  const [simulations, setSimulations] = useState<number>(100)
  const [newWeapon, setNewWeapon] = useState<Weapon>(initialWeapon)
  const [showWeaponForm, setShowWeaponForm] = useState(false)
  const [factionModifiers, setFactionModifiers] = useState<Record<string, number>>({})
  const [expandedSimulations, setExpandedSimulations] = useState<number[]>([])
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

  const handleSaveCharacter = (character: Character) => {
    saveCharacter(character, characters, setCharacters, setEditingCharacter, setShowWeaponForm)
  }

  const handleDeleteCharacter = (id: string) => {
    deleteCharacter(id, characters, setCharacters, faction1, setFaction1, faction2, setFaction2, factionModifiers, setFactionModifiers)
  }

  const handleAddToFaction = (characterId: string, faction: 'faction1' | 'faction2') => {
    addToFaction(characterId, faction, faction1, setFaction1, faction2, setFaction2, setFactionModifiers)
  }

  const handleRemoveFromFaction = (characterId: string, faction: 'faction1' | 'faction2') => {
    removeFromFaction(characterId, faction, setFaction1, setFaction2, setFactionModifiers)
  }

  const rollInitiative = (character: Character): number => {
    const initiativeRoll = Array(character.initiativeDice).fill(0).map(() => Math.floor(Math.random() * 6) + 1)
    return character.attributes.reaction + character.attributes.intuition + initiativeRoll.reduce((a, b) => a + b, 0)
  }

  const startNewCombat = () => {
    const combatChars: CombatCharacter[] = [
      ...faction1.map(id => ({
        ...characters.find(c => c.id === id)!,
        faction: 'faction1' as const,
        initiative: 0,
        position: 0,
        current_initiative: 0,
        cumulative_recoil: 0,
        wound_modifier: 0,
        situational_modifiers: factionModifiers[id] || 0,
        physical_damage: 0,
        stun_damage: 0,
        is_conscious: true,
        is_alive: true,
        total_damage_dealt: 0,
        previousPhysicalDamage: 0,
        previousStunDamage: 0,
        calculate_wound_modifier: () => 0,
        check_status: () => []
      })),
      ...faction2.map(id => ({
        ...characters.find(c => c.id === id)!,
        faction: 'faction2' as const,
        initiative: 0,
        position: simulationInitialDistance,
        current_initiative: 0,
        cumulative_recoil: 0,
        wound_modifier: 0,
        situational_modifiers: factionModifiers[id] || 0,
        physical_damage: 0,
        stun_damage: 0,
        is_conscious: true,
        is_alive: true,
        total_damage_dealt: 0,
        previousPhysicalDamage: 0,
        previousStunDamage: 0,
        calculate_wound_modifier: () => 0,
        check_status: () => []
      }))
    ]

    const initialInitiativeRolls: Record<string, number> = {};
    const initiativeLog: string[] = ["Initial Initiative Rolls:"];

    combatChars.forEach(char => {
      const { initiative_total, initiative_rolls } = roll_initiative(char as Character)
      char.initiative = initiative_total
      char.current_initiative = initiative_total
      initialInitiativeRolls[char.id] = initiative_total

      initiativeLog.push(`${char.name}: ${initiative_total} (Dice: ${initiative_rolls.join(', ')})`)
    })

    combatChars.sort((a, b) => b.initiative - a.initiative)
    setCombatCharacters(combatChars)
    setInitialInitiatives(initialInitiativeRolls)
    setCurrentInitiativePhase(combatChars[0].initiative)
    setCurrentCharacterIndex(0)
    setActionLog([{ summary: "Combat Started", details: initiativeLog }])
    clearInputs()
    setRoundNumber(1)
    setIsCombatActive(true)
  }

  const endCombat = () => {
    setIsCombatActive(false)
    toast.info("Combat has ended!")
  }

  const updateInitiative = () => {
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

    if (highestInitiative < 1) {
      // Reset all initiatives to their initial values
      updatedChars.forEach(char => {
        char.current_initiative = initialInitiatives[char.id];
      });
      highestInitiative = Math.max(...updatedChars.map(char => char.current_initiative));
      nextCharacterIndex = updatedChars.findIndex(char => char.current_initiative === highestInitiative && char.is_conscious);
      
      // Log the initiative reset
      setActionLog(prev => [...prev, { 
        summary: "Initiative Reset", 
        details: ["All characters' initiatives have been reset to their initial values."]
      }]);
    }

    setCombatCharacters(updatedChars);
    setCurrentInitiativePhase(highestInitiative);
    setCurrentCharacterIndex(nextCharacterIndex);
  }

  const nextCharacter = () => {
    const combatEnded = displayRoundSummary();
    if (combatEnded) {
      endCombat();
      return;
    }

    updateInitiative();
  }

  const runSimulations = () => {
    const results: MatchResult[] = []

    for (let i = 0; i < simulations; i++) {
      const simulationResult = runSingleSimulation()
      results.push(simulationResult)
    }

    setCombatResults(results)
  }

  const runSingleSimulation = (): MatchResult => {
    const combatChars: CombatCharacter[] = [
      ...faction1.map(id => createCombatCharacter(characters.find(c => c.id === id)!, 'faction1', 0)),
      ...faction2.map(id => createCombatCharacter(characters.find(c => c.id === id)!, 'faction2', simulationInitialDistance))
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

  const createCombatCharacter = (character: Character, faction: 'faction1' | 'faction2', position: number): CombatCharacter => {
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

  const simulateRound = (characters: CombatCharacter[]): RoundResult => {
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

    // Check if we need to reset initiatives
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
      const attackResult = resolve_attack(character, target, weapon, weapon.currentFireMode, Math.abs(character.position - target.position))

      roundResult.messages.push(...attackResult.messages)
      roundResult.damage_dealt += attackResult.damage_dealt

      // Update character statuses
      updateCharacterStatus(character)
      updateCharacterStatus(target)

      // Move character towards ideal range
      const idealRange = get_ideal_range(weapon.type)
      const currentDistance = Math.abs(character.position - target.position)
      const moveDistance = Math.min(character.attributes.agility * 2, Math.abs(currentDistance - idealRange))
      character.position += currentDistance > idealRange ? moveDistance : -moveDistance

      // Reduce initiative
      character.current_initiative -= 10

      // We break after the first character's action to simulate one character's turn per round
      break
    }

    return roundResult
  }

  const selectTarget = (attacker: CombatCharacter, characters: CombatCharacter[]): CombatCharacter | null => {
    return characters.find(c => c.faction !== attacker.faction && c.is_conscious) || null
  }

  const updateCharacterStatus = (character: CombatCharacter) => {
    const maxPhysicalHealth = calculateMaxPhysicalHealth(character.attributes.body)
    const maxStunHealth = calculateMaxStunHealth(character.attributes.willpower)

    character.is_alive = isCharacterAlive(character.physical_damage, maxPhysicalHealth)
    character.is_conscious = isCharacterConscious(character.stun_damage, maxStunHealth, character.physical_damage, maxPhysicalHealth)
  }

  const determineWinner = (characters: CombatCharacter[]): string => {
    const faction1Alive = characters.some(c => c.faction === 'faction1' && c.is_conscious)
    const faction2Alive = characters.some(c => c.faction === 'faction2' && c.is_conscious)

    if (faction1Alive && !faction2Alive) return 'Faction 1'
    if (!faction1Alive && faction2Alive) return 'Faction 2'
    return 'Draw'
  }

  const handleAddWeapon = () => {
    addWeapon(newWeapon, editingCharacter, setEditingCharacter, setNewWeapon, setShowWeaponForm)
  }

  const handleRemoveWeapon = (index: number) => {
    removeWeapon(index, editingCharacter, setEditingCharacter)
  }

  const toggleSimulationDetails = (index: number) => {
    setExpandedSimulations(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    )
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
    const currentChar = combatCharacters[currentCharacterIndex];
    let defaultWeapon = null;
    let defaultTarget = null;

    if (action === 'FireWeapon') {
      defaultWeapon = currentChar.weapons.find(w => w.type === 'Ranged') || null;
      defaultTarget = combatCharacters.find(c => c.faction !== currentChar.faction && c.is_conscious)?.id || null;
    } else if (action === 'MeleeAttack') {
      defaultWeapon = currentChar.weapons.find(w => w.type === 'Melee') || null;
      defaultTarget = combatCharacters.find(c => c.faction !== currentChar.faction && c.is_conscious)?.id || null;
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
  };

  const handleMovement = () => {
    if (movementDistance === 0) {
      toast.error('Please enter a movement distance')
      return
    }

    const currentChar = combatCharacters[currentCharacterIndex]
    const maxDistance = currentChar.attributes.agility * 2

    if (movementDistance > maxDistance) {
      toast.error(`Maximum movement distance is ${maxDistance} meters`)
      return
    }

    const updatedChars = [...combatCharacters]
    updatedChars[currentCharacterIndex].position += movementDirection === 'Toward' ? movementDistance : -movementDistance
    setCombatCharacters(updatedChars)

    setActionLog(prev => [...prev, { summary: `${currentChar.name} moved ${movementDistance} meters ${movementDirection.toLowerCase()} the opposing faction.`, details: [] }])
    clearInputs()
    nextCharacter()
  }

  const handleComplexAction = () => {
    const currentChar = combatCharacters[currentCharacterIndex]

    if (selectedComplexAction === 'Sprint') {
      const runningSkill = currentChar.skills.running
      const agilityDice = currentChar.attributes.agility
      const sprintRoll = Array(runningSkill + agilityDice).fill(0).map(() => Math.floor(Math.random() * 6) + 1)
      const hits = sprintRoll.filter(roll => roll >= 5).length
      const extraDistance = ['Dwarf', 'Troll'].includes(currentChar.metatype) ? hits : hits * 2

      const updatedChars = [...combatCharacters]
      updatedChars[currentCharacterIndex].position += extraDistance
      setCombatCharacters(updatedChars)

      const summary = `${currentChar.name} sprinted an extra ${extraDistance} meters!`
      setActionLog(prev => [...prev, { summary, details: [] }])
    } else if ((selectedComplexAction === 'FireWeapon' || selectedComplexAction === 'MeleeAttack') && selectedWeapons[0] && selectedTargets[0]) {
      const weapon = selectedWeapons[0] as Weapon
      const targetId = selectedTargets[0]
      const target = combatCharacters.find(c => c.id === targetId)
      if (target) {
        const distance = Math.abs(currentChar.position - target.position)
        const result = resolve_attack(currentChar, target, weapon, weapon.currentFireMode, distance)
        
        let summary = `${currentChar.name} attacked ${target.name} with ${weapon.name}`
        if (result.criticalGlitch) {
          summary += ` and suffered a critical glitch!`
        } else if (result.glitch) {
          summary += ` but glitched!`
        } else if (result.damage_dealt > 0) {
          summary += ` and dealt ${result.damage_dealt} damage.`
        } else {
          summary += ` but missed.`
        }
        
        setActionLog(prev => [...prev, { summary, details: result.messages }])
        
        // Update characters with new damage values
        const updatedChars = combatCharacters.map(char => 
          char.id === currentChar.id ? { ...char, ...currentChar } :
          char.id === target.id ? { ...char, ...target } :
          char
        )
        setCombatCharacters(updatedChars)

        if (check_combat_end(updatedChars)) {
          setActionLog(prev => [...prev, { summary: "Combat has ended!", details: [] }])
          // Handle end of combat
        }
      }
    }

    clearInputs()
    nextCharacter()
  }

  const handleSimpleActions = () => {
    const currentChar = combatCharacters[currentCharacterIndex]

    selectedSimpleActions.forEach((action, index) => {
      if (action === 'FireRangedWeapon' && selectedWeapons[index] && selectedTargets[index]) {
        const weapon = selectedWeapons[index] as Weapon
        const targetId = selectedTargets[index]!
        const target = combatCharacters.find(c => c.id === targetId)
        if (target) {
          const distance = Math.abs(currentChar.position - target.position)
          const result = resolve_attack(currentChar, target, weapon, weapon.currentFireMode, distance)
          const summary = `${currentChar.name} fired at ${target.name} with ${weapon.name} and dealt ${result.damage_dealt} damage.`
          setActionLog(prev => [...prev, { summary, details: result.messages }])
          
          // Update characters with new damage values
          const updatedChars = combatCharacters.map(char => 
            char.id === currentChar.id ? { ...char, ...currentChar } :
            char.id === target.id ? { ...char, ...target } :
            char
          )
          setCombatCharacters(updatedChars)

          if (check_combat_end(updatedChars)) {
            setActionLog(prev => [...prev, { summary: "Combat has ended!", details: [] }])
            // Handle end of combat
          }
        }
      } else if (action === 'ReloadWeapon' && selectedWeapons[index]) {
        const weapon = selectedWeapons[index] as Weapon
        const updatedChars = [...combatCharacters]
        const weaponIndex = updatedChars[currentCharacterIndex].weapons.findIndex(w => w.name === weapon.name)
        if (weaponIndex !== -1) {
          updatedChars[currentCharacterIndex].weapons[weaponIndex].ammoCount = weapon.ammoCount
          setCombatCharacters(updatedChars)
          const summary = `${currentChar.name} reloaded their ${weapon.name}.`
          setActionLog(prev => [...prev, { summary, details: [] }])
        }
      } else if (action === 'TakeAim') {
        const summary = `${currentChar.name} took aim.`
        setActionLog(prev => [...prev, { summary, details: [] }])
      } else if (action === 'TakeCover') {
        const summary = `${currentChar.name} took cover.`
        setActionLog(prev => [...prev, { summary, details: [] }])
      } else if (action === 'CallShot') {
        const summary = `${currentChar.name} called a shot.`
        setActionLog(prev => [...prev, { summary, details: [] }])
      } else if (action === 'ChangeFireMode') {
        const summary = `${currentChar.name} changed fire mode.`
        setActionLog(prev => [...prev, { summary, details: [] }])
      }
    })

    clearInputs()
    nextCharacter()
  }

  const handleFreeActionSelection = (action: 'CallShot' | 'ChangeFireMode') => {
    setSelectedFreeAction(action === selectedFreeAction ? null : action)
  }

  const handleFireModeChange = (weaponIndex: number, newFireMode: FireMode) => {
    const updatedChars = [...combatCharacters]
    updatedChars[currentCharacterIndex].weapons[weaponIndex].currentFireMode = newFireMode
    setCombatCharacters(updatedChars)
    setActionLog(prev => [...prev, { summary: `${combatCharacters[currentCharacterIndex].name} changed fire mode of ${updatedChars[currentCharacterIndex].weapons[weaponIndex].name} to ${newFireMode}`, details: [] }])
  }

  const checkAndUpdateCharacterStatus = (character: CombatCharacter): string[] => {
    const statusChanges: string[] = []
    const physicalDamageChange = character.physical_damage - character.previousPhysicalDamage
    const stunDamageChange = character.stun_damage - character.previousStunDamage

    if (physicalDamageChange > 0) {
      statusChanges.push(`${character.name} took ${physicalDamageChange} physical damage.`)
    }
    if (stunDamageChange > 0) {
      statusChanges.push(`${character.name} took ${stunDamageChange} stun damage.`)
    }

    const maxPhysicalHealth = calculateMaxPhysicalHealth(character.attributes.body)
    const maxStunHealth = calculateMaxStunHealth(character.attributes.willpower)

    const wasAlive = character.is_alive
    const wasConscious = character.is_conscious

    character.is_alive = isCharacterAlive(character.physical_damage, maxPhysicalHealth)
    character.is_conscious = isCharacterConscious(character.stun_damage, maxStunHealth, character.physical_damage, maxPhysicalHealth)

    if (wasAlive && !character.is_alive) {
      statusChanges.push(`${character.name} has died!`)
    } else if (wasConscious && !character.is_conscious) {
      statusChanges.push(`${character.name} has been knocked unconscious!`)
    }

    character.previousPhysicalDamage = character.physical_damage
    character.previousStunDamage = character.stun_damage

    return statusChanges
  }

  const displayRoundSummary = () => {
    const roundSummary: string[] = [`End of Round ${roundNumber}`]
    let combatEnded = false

    const updatedChars = combatCharacters.map(char => {
      const statusChanges = checkAndUpdateCharacterStatus(char)
      return { ...char, statusChanges }
    })

    updatedChars.forEach(char => {
      if (char.statusChanges.length > 0) {
        roundSummary.push(...char.statusChanges)
      }
    })

    const faction1Conscious = updatedChars.some(char => char.faction === 'faction1' && char.is_conscious)
    const faction2Conscious = updatedChars.some(char => char.faction === 'faction2' && char.is_conscious)

    if (!faction1Conscious && !faction2Conscious) {
      roundSummary.push("Both factions are incapacitated. The combat ends in a draw.")
      combatEnded = true
    } else if (!faction1Conscious) {
      roundSummary.push("Faction 2 wins! All members of Faction 1 are incapacitated.")
      combatEnded = true
    } else if (!faction2Conscious) {
      roundSummary.push("Faction 1 wins! All members of Faction 2 are incapacitated.")
      combatEnded = true
    }

    setActionLog(prev => [...prev, { summary: `Round ${roundNumber} Summary`, details: roundSummary }])
    setCombatCharacters(updatedChars)
    setRoundNumber(roundNumber + 1)

    return combatEnded
  }

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

  const calculateRoundWins = (results: MatchResult[]) => {
    const roundWins = { 'Faction 1': 0, 'Faction 2': 0, 'Draw': 0 };
    results.forEach(result => {
      roundWins[result.winner as keyof typeof roundWins]++;
    });
    return roundWins;
  };

  const FactionSelector = ({ faction }: { faction: 'faction1' | 'faction2' }) => (
    <div>
      <h3 className="mb-2 font-semibold">Faction {faction === 'faction1' ? '1' : '2'}</h3>
      <ScrollArea className="h-[200px] w-full rounded-md border p-4">
        {characters.map(character => (
          <div 
            key={character.id} 
            className={`flex items-center justify-between mb-2 p-2 rounded ${
              (faction === 'faction1' ? faction1 : faction2).includes(character.id) 
                ? 'bg-green-100' 
                : ''
            }`}
          >
            <span>{character.name}</span>
            {(faction === 'faction1' ? faction1 : faction2).includes(character.id) ? (
              <div className="flex items-center space-x-2">
                <Label htmlFor={`modifier-${character.id}`} className="mr-2">Situational Modifier:</Label>
                <Select
                  value={factionModifiers[character.id]?.toString() || '0'}
                  onValueChange={(value) => setFactionModifiers(prev => ({ ...prev, [character.id]: parseInt(value) }))}
                >
                  <SelectTrigger className="w-[100px]" id={`modifier-${character.id}`}>
                    <SelectValue placeholder="Modifier" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 19 }, (_, i) => i - 9).map(value => (
                      <SelectItem key={value} value={value.toString()}>{value > 0 ? `+${value}` : value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => handleRemoveFromFaction(character.id, faction)}>
                  Remove
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => handleAddToFaction(character.id, faction)}>
                Add
              </Button>
            )}
          </div>
        ))}
      </ScrollArea>
    </div>
  )

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
          <Card>
            <CardHeader>
              <CardTitle>Character Management</CardTitle>
              <CardDescription>Create, edit, and delete your Shadowrun 5e characters.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                {characters.map(character => (
                  <div key={character.id} className="flex items-center justify-between mb-2">
                    <span>{character.name} - {character.metatype}</span>
                    <div>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={() => {
                          setEditingCharacter(character)
                          setShowWeaponForm(false)
                        }} 
                        className="mr-2"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => handleDeleteCharacter(character.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </ScrollArea>
            </CardContent>
            <CardFooter>
              <Button onClick={() => {
                setEditingCharacter({
                  ...initialCharacter,
                  faction: '',
                  current_initiative: 0,
                  cumulative_recoil: 0,
                  wound_modifier: 0,
                  situational_modifiers: 0,
                  physical_damage: 0,
                  stun_damage: 0,
                  is_conscious: true,
                  is_alive: true,
                  total_damage_dealt: 0,
                  calculate_wound_modifier: () => 0,
                  check_status: () => ['Conscious'],
                });
                setShowWeaponForm(false);
              }}>
                <PlusCircle className="mr-2 h-4 w-4" /> New Character
              </Button>
            </CardFooter>
          </Card>
          {editingCharacter && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>{editingCharacter.id ? 'Edit' : 'Create'} Character</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={(e) => { e.preventDefault(); handleSaveCharacter(editingCharacter); }}>
                  <div className="grid w-full items-center gap-4">
                    <div className="flex flex-col space-y-1.5">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={editingCharacter.name}
                        onChange={(e) => setEditingCharacter({ ...editingCharacter, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="flex flex-col space-y-1.5">
                      <Label htmlFor="metatype">Metatype</Label>
                      <Select
                        value={editingCharacter.metatype}
                        onValueChange={(value: Metatype) => setEditingCharacter({ ...editingCharacter, metatype: value })}
                      >
                        <SelectTrigger id="metatype">
                          <SelectValue placeholder="Select metatype" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Human">Human</SelectItem>
                          <SelectItem value="Elf">Elf</SelectItem>
                          <SelectItem value="Ork">Ork</SelectItem>
                          <SelectItem value="Dwarf">Dwarf</SelectItem>
                          <SelectItem value="Troll">Troll</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(editingCharacter.attributes).map(([attr, value]) => (
                        <div key={attr} className="flex flex-col space-y-1.5">
                          <Label htmlFor={attr}>{attr.charAt(0).toUpperCase() + attr.slice(1)}</Label>
                          <Input
                            id={attr}
                            type="number"
                            value={value}
                            onChange={(e) => setEditingCharacter({
                              ...editingCharacter,
                              attributes: { ...editingCharacter.attributes, [attr]: parseInt(e.target.value) }
                            })}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(editingCharacter.skills).map(([skill, value]) => (
                        <div key={skill} className="flex flex-col space-y-1.5">
                          <Label htmlFor={skill}>{skill.charAt(0).toUpperCase() + skill.slice(1)}</Label>
                          <Input
                            id={skill}
                            type="number"
                            value={value}
                            onChange={(e) => setEditingCharacter({
                              ...editingCharacter,
                              skills: { ...editingCharacter.skills, [skill]: parseInt(e.target.value) }
                            })}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-col space-y-1.5">
                      <Label htmlFor="initiativeDice">Initiative Dice</Label>
                      <Input
                        id="initiativeDice"
                        type="number"
                        value={editingCharacter.initiativeDice}
                        onChange={(e) => setEditingCharacter({
                          ...editingCharacter,
                          initiativeDice: parseInt(e.target.value)
                        })}
                      />
                    </div>
                    <div className="flex flex-col space-y-1.5">
                      <Label>Weapons</Label>
                      {editingCharacter.weapons.map((weapon, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <span>
                            {weapon.name} - {weapon.damage} {weapon.damageType} ({weapon.type}) | 
                            AP: {weapon.ap} | RC: {weapon.recoilComp} | ACC: {weapon.accuracy} | 
                            {weapon.type === 'Ranged' ? `Ammo: ${weapon.ammoCount} | Modes: ${weapon.fireModes.join(', ')}` : `Reach: ${weapon.reach}`}
                          </span>
                          <Button type="button" variant="outline" size="sm" onClick={() => handleRemoveWeapon(index)}>Remove</Button>
                        </div>
                      ))}
                      {!showWeaponForm && (
                        <Button type="button" onClick={() => setShowWeaponForm(true)}>Add Weapon</Button>
                      )}
                      {showWeaponForm && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex flex-col space-y-1.5">
                            <Label htmlFor="weaponName">Weapon Name</Label>
                            <Input
                              id="weaponName"
                              value={newWeapon.name}
                              onChange={(e) => setNewWeapon({ ...newWeapon, name: e.target.value })}
                              required
                            />
                          </div>
                          <div className="flex flex-col space-y-1.5">
                            <Label htmlFor="weaponDamage">Damage</Label>
                            <Input
                              id="weaponDamage"
                              value={newWeapon.damage}
                              onChange={(e) => setNewWeapon({ ...newWeapon, damage: e.target.value })}
                              required
                            />
                          </div>
                          <div className="flex flex-col space-y-1.5">
                            <Label htmlFor="weaponType">Type</Label>
                            <Select
                              value={newWeapon.type}
                              onValueChange={(value) => setNewWeapon({ ...newWeapon, type: value as 'Melee' | 'Ranged' })}
                            >
                              <SelectTrigger id="weaponType">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Melee">Melee</SelectItem>
                                <SelectItem value="Ranged">Ranged</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex flex-col space-y-1.5">
                            <Label htmlFor="damageType">Damage Type</Label>
                            <Select
                              value={newWeapon.damageType}
                              onValueChange={(value) => setNewWeapon({ ...newWeapon, damageType: value as 'P' | 'S' })}
                            >
                              <SelectTrigger id="damageType">
                                <SelectValue placeholder="Select damage type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="P">Physical (P)</SelectItem>
                                <SelectItem value="S">Stun (S)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex flex-col space-y-1.5">
                            <Label htmlFor="ap">AP</Label>
                            <Select
                              value={newWeapon.ap.toString()}
                              onValueChange={(value) => setNewWeapon({ ...newWeapon, ap: parseInt(value) })}
                            >
                              <SelectTrigger id="ap">
                                <SelectValue placeholder="Select AP" />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 10 }, (_, i) => -i).map(value => (
                                  <SelectItem key={value} value={value.toString()}>{value}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {newWeapon.type === 'Ranged' && (
                            <>
                              <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="recoilComp">Recoil Comp</Label>
                                <Select
                                  value={newWeapon.recoilComp.toString()}
                                  onValueChange={(value) => setNewWeapon({ ...newWeapon, recoilComp: parseInt(value) })}
                                >
                                  <SelectTrigger id="recoilComp">
                                    <SelectValue placeholder="Select Recoil Comp" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Array.from({ length: 16 }, (_, i) => i).map(value => (
                                      <SelectItem key={value} value={value.toString()}>{value}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="ammoCount">Ammo Count</Label>
                                <Input
                                  id="ammoCount"
                                  type="number"
                                  value={newWeapon.ammoCount}
                                  onChange={(e) => setNewWeapon({ ...newWeapon, ammoCount: parseInt(e.target.value) })}
                                  min="1"
                                  required
                                />
                              </div>
                            </>
                          )}
                          {newWeapon.type === 'Melee' && (
                            <div className="flex flex-col space-y-1.5">
                              <Label htmlFor="reach">Reach</Label>
                              <Select
                                value={newWeapon.reach.toString()}
                                onValueChange={(value) => setNewWeapon({ ...newWeapon, reach: parseInt(value) })}
                              >
                                <SelectTrigger id="reach">
                                  <SelectValue placeholder="Select Reach" />
                                </SelectTrigger>
                                <SelectContent>
                                  {[1, 2, 3].map(value => (
                                    <SelectItem key={value} value={value.toString()}>{value}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          <div className="flex flex-col space-y-1.5">
                            <Label htmlFor="accuracy">Accuracy</Label>
                            <Select
                              value={newWeapon.accuracy.toString()}
                              onValueChange={(value) => setNewWeapon({ ...newWeapon, accuracy: parseInt(value) })}
                            >
                              <SelectTrigger id="accuracy">
                                <SelectValue placeholder="Select Accuracy" />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 16 }, (_, i) => i).map(value => (
                                  <SelectItem key={value} value={value.toString()}>{value}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {newWeapon.type === 'Ranged' && (
                            <div className="flex flex-col space-y-1.5">
                              <Label>Fire Modes</Label>
                              <div className="flex space-x-2">
                                {(['SS', 'SA', 'BF', 'FA'] as FireMode[]).map(mode => (
                                  <label key={mode} className="flex items-center space-x-2">
                                    <Checkbox
                                      checked={newWeapon.fireModes.includes(mode)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setNewWeapon({ ...newWeapon, fireModes: [...newWeapon.fireModes, mode] })
                                        } else {
                                          setNewWeapon({ ...newWeapon, fireModes: newWeapon.fireModes.filter(m => m !== mode) })
                                        }
                                      }}
                                    />
                                    <span>{mode}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                          <Button type="button" onClick={handleAddWeapon}>Save Weapon</Button>
                        </div>
                      )}
                    </div>
                  </div>
                  <Button type="submit" className="mt-4">Save Character</Button>
                </form>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="combat">
          <Card>
            <CardHeader>
              <CardTitle>Combat Simulator</CardTitle>
              <CardDescription>Set up factions and simulate combat.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <FactionSelector faction="faction1" />
                <FactionSelector faction="faction2" />
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
              <Button onClick={startNewCombat} disabled={faction1.length === 0 || faction2.length === 0 || isCombatActive}>
                <Swords className="mr-2 h-4 w-4" /> New Combat
              </Button>
            </CardFooter>
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
                              onValueChange={(value) => handleFireModeChange(combatCharacters[currentCharacterIndex].weapons.findIndex(w => w.name === selectedWeapons[index]?.name), value as FireMode)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select Fire Mode" />
                              </SelectTrigger>
                              <SelectContent>
                                {selectedWeapons[index]?.fireModes.map((mode) => (
                                  <SelectItem key={mode} value={mode}>{mode}</SelectItem>
                                ))}
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
                    </div>
                    {selectedFreeAction === 'ChangeFireMode' && (
                      <div className="mt-2">
                        <Select onValueChange={(value) => {
                          const [weaponIndex, newFireMode] = value.split('|')
                          handleFireModeChange(parseInt(weaponIndex), newFireMode as FireMode)
                        }}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Weapon and New Fire Mode" />
                          </SelectTrigger>
                          <SelectContent>
                            {combatCharacters[currentCharacterIndex].weapons
                              .filter(w => w.type === 'Ranged')
                              .map((weapon, weaponIndex) => 
                                weapon.fireModes.map(mode => (
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
                  </div>
                  <div>
                    <h5 className="font-semibold">Movement</h5>
                    <div className="flex items-center space-x-2">
                      <Select onValueChange={(value) => setMovementDirection(value as 'Toward' | 'Away')}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select direction" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Toward">Toward</SelectItem>
                          <SelectItem value="Away">Away</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        placeholder="Distance"
                        value={movementDistance}
                        onChange={(e) => setMovementDistance(parseInt(e.target.value))}
                        min="0"
                        max={combatCharacters[currentCharacterIndex].attributes.agility * 2}
                      />
                      <span>meters</span>
                    </div>
                  </div>
                  <Button onClick={() => {
                    if (selectedActionType === 'Simple') {
                      handleSimpleActions()
                    } else if (selectedActionType === 'Complex') {
                      handleComplexAction()
                    } else if (movementDistance > 0) {
                      handleMovement()
                    } else if (selectedFreeAction) {
                      // Handle free action here
                      setActionLog(prev => [...prev, { summary: `${combatCharacters[currentCharacterIndex].name} performed a ${selectedFreeAction} action.`, details: [] }])
                      clearInputs()
                      nextCharacter()
                    } else {
                      toast.error('Please select an action type, enter a movement distance, or choose a free action')
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
                <FactionSelector faction="faction1" />
                <FactionSelector faction="faction2" />
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