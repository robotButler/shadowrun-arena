import { Character, Weapon } from './types'
import { toast } from 'react-toastify'

export const initialCharacter: Omit<Character, 'faction' | 'current_initiative' | 'cumulative_recoil' | 'wound_modifier' | 'situational_modifiers' | 'physical_damage' | 'stun_damage' | 'is_conscious' | 'is_alive' | 'total_damage_dealt' | 'calculate_wound_modifier' | 'check_status'> = {
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

export const initialWeapon: Weapon = {
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

export const saveCharacter = (character: Character, characters: Character[], setCharacters: React.Dispatch<React.SetStateAction<Character[]>>, setEditingCharacter: React.Dispatch<React.SetStateAction<Character | null>>, setShowWeaponForm: React.Dispatch<React.SetStateAction<boolean>>) => {
  if (!character.name.trim()) {
    toast.error('Character must have a name')
    return
  }

  setCharacters(prevCharacters => {
    if (character.id) {
      return prevCharacters.map(c => c.id === character.id ? character : c)
    } else {
      const newCharacter = { ...character, id: Date.now().toString() }
      return [...prevCharacters, newCharacter]
    }
  })

  setEditingCharacter(null)
  setShowWeaponForm(false)
  toast.success('Character saved successfully')
}

export const deleteCharacter = (id: string, characters: Character[], setCharacters: React.Dispatch<React.SetStateAction<Character[]>>, faction1: string[], setFaction1: React.Dispatch<React.SetStateAction<string[]>>, faction2: string[], setFaction2: React.Dispatch<React.SetStateAction<string[]>>, factionModifiers: Record<string, number>, setFactionModifiers: React.Dispatch<React.SetStateAction<Record<string, number>>>) => {
  setCharacters(characters.filter(c => c.id !== id))
  setFaction1(faction1.filter(cId => cId !== id))
  setFaction2(faction2.filter(cId => cId !== id))
  setFactionModifiers(prevModifiers => {
    const { [id]: _, ...rest } = prevModifiers
    return rest
  })
  toast.info('Character deleted')
}

export const addToFaction = (characterId: string, faction: 'faction1' | 'faction2', faction1: string[], setFaction1: React.Dispatch<React.SetStateAction<string[]>>, faction2: string[], setFaction2: React.Dispatch<React.SetStateAction<string[]>>, setFactionModifiers: React.Dispatch<React.SetStateAction<Record<string, number>>>) => {
  if (faction === 'faction1') {
    setFaction1([...faction1, characterId])
    setFaction2(faction2.filter(id => id !== characterId))
  } else {
    setFaction2([...faction2, characterId])
    setFaction1(faction1.filter(id => id !== characterId))
  }
  setFactionModifiers(prevModifiers => ({ ...prevModifiers, [characterId]: 0 }))
}

export const removeFromFaction = (characterId: string, faction: 'faction1' | 'faction2', setFaction1: React.Dispatch<React.SetStateAction<string[]>>, setFaction2: React.Dispatch<React.SetStateAction<string[]>>, setFactionModifiers: React.Dispatch<React.SetStateAction<Record<string, number>>>) => {
  if (faction === 'faction1') {
    setFaction1(prev => prev.filter(id => id !== characterId))
  } else {
    setFaction2(prev => prev.filter(id => id !== characterId))
  }
  setFactionModifiers(prevModifiers => {
    const { [characterId]: _, ...rest } = prevModifiers
    return rest
  })
}

export const validateWeapon = (weapon: Weapon): boolean => {
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

export const addWeapon = (newWeapon: Weapon, editingCharacter: Character | null, setEditingCharacter: React.Dispatch<React.SetStateAction<Character | null>>, setNewWeapon: React.Dispatch<React.SetStateAction<Weapon>>, setShowWeaponForm: React.Dispatch<React.SetStateAction<boolean>>) => {
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

export const removeWeapon = (index: number, editingCharacter: Character | null, setEditingCharacter: React.Dispatch<React.SetStateAction<Character | null>>) => {
  if (editingCharacter) {
    const updatedWeapons = editingCharacter.weapons.filter((_, i) => i !== index)
    setEditingCharacter({ ...editingCharacter, weapons: updatedWeapons })
  }
}