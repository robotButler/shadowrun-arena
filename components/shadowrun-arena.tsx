'use client'

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

type Attribute = 'body' | 'agility' | 'reaction' | 'strength' | 'willpower' | 'logic' | 'intuition' | 'charisma'
type Skill = 'firearms' | 'close combat' | 'running' | 'armor'
type FireMode = 'SS' | 'SA' | 'BF' | 'FA'
type Metatype = 'Human' | 'Elf' | 'Ork' | 'Dwarf' | 'Troll'
type ActionType = 'Simple' | 'Complex'
type SimpleAction = 'CallShot' | 'ChangeFireMode' | 'FireRangedWeapon' | 'ReloadWeapon' | 'TakeAim' | 'TakeCover'
type ComplexAction = 'FireWeapon' | 'MeleeAttack' | 'Sprint'

interface Weapon {
  name: string
  damage: string
  type: 'Melee' | 'Ranged'
  damageType: 'P' | 'S'
  ap: number
  recoilComp: number
  accuracy: number
  fireModes: FireMode[]
  currentFireMode: FireMode
  ammoCount: number
  reach: number
}

interface Character {
  id: string
  name: string
  metatype: Metatype
  attributes: Record<Attribute, number>
  skills: Record<Skill, number>
  weapons: Weapon[]
  initiativeDice: number
}

interface CombatResult {
  winner: string
  rounds: number
  details: string
}

interface CombatCharacter extends Character {
  faction: 'faction1' | 'faction2'
  initiative: number
  position: number
}

const initialCharacter: Character = {
  id: '',
  name: '',
  metatype: 'Human',
  attributes: {
    body: 1, agility: 1, reaction: 1, strength: 1,
    willpower: 1, logic: 1, intuition: 1, charisma: 1
  },
  skills: { firearms: 0, 'close combat': 0, running: 0, armor: 0 },
  weapons: [],
  initiativeDice: 1
}

const initialWeapon: Weapon = {
  name: '',
  damage: '',
  type: 'Melee',
  damageType: 'P',
  ap: 0,
  recoilComp: 0,
  accuracy: 0,
  fireModes: [],
  currentFireMode: 'SS',
  ammoCount: 0,
  reach: 1
}

export function ShadowrunArena() {
  const [characters, setCharacters] = useState<Character[]>([])
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null)
  const [faction1, setFaction1] = useState<string[]>([])
  const [faction2, setFaction2] = useState<string[]>([])
  const [combatResults, setCombatResults] = useState<CombatResult[]>([])
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
  const [actionLog, setActionLog] = useState<string[]>([])
  const [initialDistance, setInitialDistance] = useState(10)
  const [selectedFreeAction, setSelectedFreeAction] = useState<'CallShot' | 'ChangeFireMode' | null>(null)

  useEffect(() => {
    const storedCharacters = localStorage.getItem('shadowrunCharacters')
    if (storedCharacters) {
      setCharacters(JSON.parse(storedCharacters))
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('shadowrunCharacters', JSON.stringify(characters))
  }, [characters])

  const saveCharacter = (character: Character) => {
    if (!character.name.trim()) {
      toast.error('Character must have a name')
      return
    }

    if (character.id) {
      setCharacters(characters.map(c => c.id === character.id ? character : c))
    } else {
      const newCharacter = { ...character, id: Date.now().toString() }
      setCharacters([...characters, newCharacter])
    }
    setEditingCharacter(null)
    setShowWeaponForm(false)
    toast.success('Character saved successfully')
  }

  const deleteCharacter = (id: string) => {
    setCharacters(characters.filter(c => c.id !== id))
    setFaction1(faction1.filter(cId => cId !== id))
    setFaction2(faction2.filter(cId => cId !== id))
    setFactionModifiers(prevModifiers => {
      const { [id]: _, ...rest } = prevModifiers
      return rest
    })
    toast.info('Character deleted')
  }

  const addToFaction = (characterId: string, faction: 'faction1' | 'faction2') => {
    if (faction === 'faction1') {
      setFaction1([...faction1, characterId])
      setFaction2(faction2.filter(id => id !== characterId))
    } else {
      setFaction2([...faction2, characterId])
      setFaction1(faction1.filter(id => id !== characterId))
    }
    setFactionModifiers(prevModifiers => ({ ...prevModifiers, [characterId]: 0 }))
  }

  const removeFromFaction = (characterId: string, faction: 'faction1' | 'faction2') => {
    if (faction === 'faction1') {
      setFaction1(faction1.filter(id => id !== characterId))
    } else {
      setFaction2(faction2.filter(id => id !== characterId))
    }
    setFactionModifiers(prevModifiers => {
      const { [characterId]: _, ...rest } = prevModifiers
      return rest
    })
  }

  const rollInitiative = (character: Character): number => {
    const initiativeRoll = Array(character.initiativeDice).fill(0).map(() => Math.floor(Math.random() * 6) + 1)
    return character.attributes.reaction + character.attributes.intuition + initiativeRoll.reduce((a, b) => a + b, 0)
  }

  const simulateCombat = () => {
    const combatChars: CombatCharacter[] = [
      ...faction1.map(id => ({
        ...characters.find(c => c.id === id)!,
        faction: 'faction1' as const,
        initiative: 0,
        position: 0
      })),
      ...faction2.map(id => ({
        ...characters.find(c => c.id === id)!,
        faction: 'faction2' as const,
        initiative: 0,
        position: initialDistance
      }))
    ]

    combatChars.forEach(char => {
      char.initiative = rollInitiative(char)
    })

    combatChars.sort((a, b) => b.initiative - a.initiative)
    setCombatCharacters(combatChars)
    setCurrentInitiativePhase(1)
    setCurrentCharacterIndex(0)
    setActionLog([])
    clearInputs()
  }

  const runSimulations = () => {
    const results: CombatResult[] = []
    let faction1Wins = 0
    for (let i = 0; i < simulations; i++) {
      const winner = Math.random() < 0.5 ? 'Faction 1' : 'Faction 2'
      const rounds = Math.floor(Math.random() * 10) + 1
      const details = `Detailed combat log for simulation ${i + 1}: ${winner} victory in ${rounds} rounds.`
      results.push({ winner, rounds, details })
      if (winner === 'Faction 1') faction1Wins++
    }
    setCombatResults(results)
  }

  const addWeapon = () => {
    if (!validateWeapon(newWeapon)) {
      return
    }

    if (editingCharacter) {
      setEditingCharacter({
        ...editingCharacter,
        weapons: [...editingCharacter.weapons, newWeapon]
      })
      setNewWeapon(initialWeapon)
      setShowWeaponForm(false)
      toast.success('Weapon added successfully')
    }
  }

  const validateWeapon = (weapon: Weapon): boolean => {
    if (!weapon.name.trim()) {
      toast.error('Weapon must have a name')
      return false
    }
    if (!weapon.damage.trim()) {
      toast.error('Weapon must have a damage value')
      return false
    }
    if (weapon.type === 'Ranged') {
      if (weapon.ammoCount <= 0) {
        toast.error('Ranged weapons must have a positive ammo count')
        return false
      }
      if (weapon.fireModes.length === 0) {
        toast.error('Ranged weapons must have at least one fire mode')
        return false
      }
    }
    return true
  }

  const removeWeapon = (index: number) => {
    if (editingCharacter) {
      const updatedWeapons = editingCharacter.weapons.filter((_, i) => i !== index)
      setEditingCharacter({ ...editingCharacter, weapons: updatedWeapons })
    }
  }

  const toggleSimulationDetails = (index: number) => {
    setExpandedSimulations(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    )
  }

  const handleActionTypeSelection = (actionType: ActionType) => {
    setSelectedActionType(actionType === selectedActionType ? null : actionType)
    setSelectedSimpleActions([])
    setSelectedComplexAction(null)
    setSelectedWeapons([null, null])
    setSelectedTargets([null, null])
  }

  const handleSimpleActionSelection = (action: SimpleAction, index: number) => {
    setSelectedSimpleActions(prev => {
      const newActions = [...prev]
      newActions[index] = action
      return newActions
    })
    if (action === 'FireRangedWeapon' || action === 'ReloadWeapon' || action === 'ChangeFireMode') {
      setSelectedWeapons(prev => {
        const newWeapons = [...prev]
        newWeapons[index] = null
        return newWeapons
      })
      setSelectedTargets(prev => {
        const newTargets = [...prev]
        newTargets[index] = null
        return newTargets
      })
    }
  }

  const handleComplexActionSelection = (action: ComplexAction) => {
    setSelectedComplexAction(action)
    if (action === 'FireWeapon' || action === 'MeleeAttack') {
      setSelectedWeapons([null])
      setSelectedTargets([null])
    }
  }

  const handleWeaponSelection = (weapon: Weapon, index: number) => {
    setSelectedWeapons(prev => {
      const newWeapons = [...prev]
      newWeapons[index] = weapon
      return newWeapons
    })
  }

  const handleTargetSelection = (targetId: string, index: number) => {
    setSelectedTargets(prev => {
      const newTargets = [...prev]
      newTargets[index] = targetId
      return newTargets
    })
  }

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

    setActionLog(prev => [...prev, `${currentChar.name} moved ${movementDistance} meters ${movementDirection.toLowerCase()} the opposing faction.`])
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

      setActionLog(prev => [...prev, `${currentChar.name} sprinted an extra ${extraDistance} meters!`])
    } else if ((selectedComplexAction === 'FireWeapon' || selectedComplexAction === 'MeleeAttack') && selectedWeapons[0] && selectedTargets[0]) {
      const weapon = selectedWeapons[0]
      const targetId = selectedTargets[0]
      const target = combatCharacters.find(c => c.id === targetId)
      if (target) {
        // Implement attack logic here
        setActionLog(prev => [...prev, `${currentChar.name} attacked ${target.name} with ${weapon.name}!`])
      }
    }

    clearInputs()
    nextCharacter()
  }

  const handleSimpleActions = () => {
    const currentChar = combatCharacters[currentCharacterIndex]

    selectedSimpleActions.forEach((action, index) => {
      if (action === 'FireRangedWeapon' && selectedWeapons[index] && selectedTargets[index]) {
        const weapon = selectedWeapons[index]!
        const targetId = selectedTargets[index]!
        const target = combatCharacters.find(c => c.id === targetId)
        if (target) {
          // Implement firing logic here
          setActionLog(prev => [...prev, `${currentChar.name} fired at ${target.name} with ${weapon.name}!`])
        }
      } else if (action === 'ReloadWeapon' && selectedWeapons[index]) {
        const weapon = selectedWeapons[index]!
        const updatedChars = [...combatCharacters]
        const weaponIndex = updatedChars[currentCharacterIndex].weapons.findIndex(w => w.name === weapon.name)
        if (weaponIndex !== -1) {
          updatedChars[currentCharacterIndex].weapons[weaponIndex].ammoCount = weapon.ammoCount
          setCombatCharacters(updatedChars)
          setActionLog(prev => [...prev, `${currentChar.name} reloaded their ${weapon.name}!`])
        }
      } else if (action === 'TakeAim') {
        setActionLog(prev => [...prev, `${currentChar.name} took aim!`])
      } else if (action === 'TakeCover') {
        setActionLog(prev => [...prev, `${currentChar.name} took cover!`])
      } else if (action === 'CallShot') {
        setActionLog(prev => [...prev, `${currentChar.name} called a shot!`])
      } else if (action === 'ChangeFireMode') {
        setActionLog(prev => [...prev, `${currentChar.name} changed fire mode!`])
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
    setActionLog(prev => [...prev, `${combatCharacters[currentCharacterIndex].name} changed fire mode of ${updatedChars[currentCharacterIndex].weapons[weaponIndex].name} to ${newFireMode}`])
  }

  const nextCharacter = () => {
    if (currentCharacterIndex < combatCharacters.length - 1) {
      setCurrentCharacterIndex(currentCharacterIndex + 1)
    } else {
      setCurrentInitiativePhase(currentInitiativePhase + 1)
      setCurrentCharacterIndex(0)
    }
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
                <Button variant="outline" size="sm" onClick={() => removeFromFaction(character.id, faction)}>
                  Remove
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => addToFaction(character.id, faction)}>
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="characters">Characters</TabsTrigger>
          <TabsTrigger value="combat">Combat</TabsTrigger>
          <TabsTrigger value="simulations">Simulations</TabsTrigger>
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
                      <Button variant="outline" size="icon" onClick={() => deleteCharacter(character.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </ScrollArea>
            </CardContent>
            <CardFooter>
              <Button onClick={() => {
                setEditingCharacter({...initialCharacter})
                setShowWeaponForm(false)
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
                <form onSubmit={(e) => { e.preventDefault(); saveCharacter(editingCharacter); }}>
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
                          <Button type="button" variant="outline" size="sm" onClick={() => removeWeapon(index)}>Remove</Button>
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
                          <Button type="button" onClick={addWeapon}>Save Weapon</Button>
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
              <Button onClick={simulateCombat} disabled={faction1.length === 0 || faction2.length === 0}>
                <Swords className="mr-2 h-4 w-4" /> Simulate Combat
              </Button>
            </CardFooter>
          </Card>
          {combatCharacters.length > 0 && (
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
                                  .filter(c => c.faction !== combatCharacters[currentCharacterIndex].faction)
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
                                .filter(c => c.faction !== combatCharacters[currentCharacterIndex].faction)
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
                      setActionLog(prev => [...prev, `${combatCharacters[currentCharacterIndex].name} performed a ${selectedFreeAction} action.`])
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
                <ScrollArea className="h-[200px] w-full rounded-md border p-4">
                  {actionLog.map((log, index) => (
                    <p key={index} className="mb-2">{log}</p>
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
                <p>Overall Winner: {combatResults.filter(r => r.winner === 'Faction 1').length > combatResults.length / 2 ? 'Faction 1' : 'Faction 2'}</p>
                <p>Total Simulations: {combatResults.length}</p>
                <ScrollArea className="h-[300px] w-full mt-4">
                  {combatResults.map((result, index) => (
                    <div key={index} className="mb-2">
                      <Button
                        variant="ghost"
                        className="w-full justify-between"
                        onClick={() => toggleSimulationDetails(index)}
                      >
                        <span>Simulation {index + 1}: {result.winner} won in {result.rounds} rounds</span>
                        {expandedSimulations.includes(index) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                      {expandedSimulations.includes(index) && (
                        <div className="mt-2 p-2 bg-muted rounded-md">
                          <p>{result.details}</p>
                        </div>
                      )}
                    </div>
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