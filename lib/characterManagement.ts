import { Character, CombatCharacter, Weapon, Attribute, Skill, Metatype, Vector } from './types'
import { toast } from 'react-toastify'
import { calculatePhysicalLimit, calculateMentalLimit } from './utils'

export const initialCharacter: Omit<Character, 'faction' | 'current_initiative' | 'cumulative_recoil' | 'wound_modifier' | 'situational_modifiers' | 'physical_damage' | 'stun_damage' | 'is_conscious' | 'is_alive' | 'total_damage_dealt' | 'calculate_wound_modifier' | 'check_status'> = {
  id: '',
  name: '',
  metatype: 'Human',
  attributes: {
    body: 3, agility: 3, reaction: 3, strength: 3,
    willpower: 3, logic: 3, intuition: 3, charisma: 3
  },
  skills: { firearms: 0, 'close combat': 0, running: 0, armor: 0 },
  weapons: [],
  initiativeDice: 1,
  physicalLimit: 0,
  mentalLimit: 0,
}

export const initialWeapon: Weapon = {
  name: '',
  damage: 0,
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
  if (typeof weapon.damage !== 'number' || isNaN(weapon.damage)) {
    toast.error('Weapon must have a valid damage value')
    return false
  }
  // Add more validations as needed
  return true
}

export const addWeapon = (
  weapon: Weapon,
  editingCharacter: Character | null,
  setEditingCharacter: React.Dispatch<React.SetStateAction<Character | null>>,
  setNewWeapon: React.Dispatch<React.SetStateAction<Weapon>>,
  setShowWeaponForm: React.Dispatch<React.SetStateAction<boolean>>
) => {
  if (!editingCharacter) return

  if (validateWeapon(weapon)) {
    setEditingCharacter({
      ...editingCharacter,
      weapons: [...editingCharacter.weapons, weapon]
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

export class ManagedCharacter implements CombatCharacter {
  id: string;
  name: string;
  metatype: Metatype;
  attributes: Record<Attribute, number>;
  skills: Record<Skill, number>;
  weapons: Weapon[];
  initiativeDice: number;
  faction: 'faction1' | 'faction2';
  initiative: number;
  current_initiative: number;
  position: Vector;
  cumulative_recoil: number;
  wound_modifier: number;
  situational_modifiers: number;
  physical_damage: number;
  stun_damage: number;
  is_conscious: boolean;
  is_alive: boolean;
  total_damage_dealt: number;
  previousPhysicalDamage: number;
  previousStunDamage: number;
  movement_remaining: number;
  physicalLimit: number;
  mentalLimit: number;

  private previousStatus: { is_conscious: boolean, is_alive: boolean };
  private statusChanges: string[];

  constructor(character: Character, faction: 'faction1' | 'faction2', position: Vector) {
    this.id = character.id;
    this.name = character.name;
    this.metatype = character.metatype;
    this.attributes = { ...character.attributes };
    this.skills = { ...character.skills };
    this.weapons = [...character.weapons];
    this.initiativeDice = character.initiativeDice;
    this.faction = faction;
    this.initiative = 0; // This will be set by roll_initiative
    this.current_initiative = 0; // This will be set by roll_initiative
    this.position = position;
    this.cumulative_recoil = 0;
    this.wound_modifier = 0;
    this.situational_modifiers = 0;
    this.physical_damage = 0;
    this.stun_damage = 0;
    this.is_conscious = true;
    this.is_alive = true;
    this.total_damage_dealt = 0;
    this.previousPhysicalDamage = 0;
    this.previousStunDamage = 0;
    this.movement_remaining = 0;
    this.physicalLimit = calculatePhysicalLimit(this.attributes.strength, this.attributes.body, this.attributes.reaction);
    this.mentalLimit = calculateMentalLimit(this.attributes);

    this.previousStatus = { is_conscious: true, is_alive: true };
    this.statusChanges = [];
  }

  updateStatus(): void {
    this.previousStatus = { is_conscious: this.is_conscious, is_alive: this.is_alive };
    this.statusChanges = [];

    const maxPhysicalHealth = this.attributes.body;
    const maxStunHealth = this.attributes.willpower;

    // Check for unconsciousness (max stun damage)
    if (this.stun_damage >= maxStunHealth) {
      if (this.is_conscious) {
        this.is_conscious = false;
        this.statusChanges.push("Fell unconscious");
      }
    } else if (!this.is_conscious && this.stun_damage < maxStunHealth) {
      this.is_conscious = true;
      this.statusChanges.push("Regained consciousness");
    }

    // Check for death (max physical damage)
    if (this.physical_damage >= maxPhysicalHealth) {
      if (this.is_alive) {
        this.is_alive = false;
        this.is_conscious = false;
        this.statusChanges.push("Died");
      }
    }

    // Update wound modifier
    const oldWoundModifier = this.wound_modifier;
    this.wound_modifier = this.calculate_wound_modifier();
    if (this.wound_modifier !== oldWoundModifier) {
      this.statusChanges.push(`Wound modifier changed to ${this.wound_modifier}`);
    }
  }

  getStatusChanges(): string[] {
    return this.statusChanges;
  }

  calculate_wound_modifier(): number {
    const totalDamage = this.physical_damage + this.stun_damage;
    const damageBoxes = Math.ceil(totalDamage / 3);
    return -damageBoxes;
  }

  check_status(): string[] {
    this.updateStatus();
    return this.getStatusChanges();
  }
}

// Update the createCombatCharacter function to use ManagedCharacter
export const createCombatCharacter = (character: Character, faction: 'faction1' | 'faction2', position: number, factionModifiers: Record<string, number>): CombatCharacter => {
  const managedCharacter = new ManagedCharacter(character, faction, { x: position, y: 0 });
  managedCharacter.situational_modifiers = factionModifiers[character.id] || 0;
  return managedCharacter;
}