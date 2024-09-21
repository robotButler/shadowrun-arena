// Basic types
export type Attribute = 'body' | 'agility' | 'reaction' | 'strength' | 'willpower' | 'logic' | 'intuition' | 'charisma'
export type Skill = 'firearms' | 'close combat' | 'running' | 'armor'
export type FireMode = 'SS' | 'SA' | 'BF' | 'FA'
export type Metatype = 'Human' | 'Elf' | 'Ork' | 'Dwarf' | 'Troll'
export type ActionType = 'Simple' | 'Complex'
export type SimpleAction = 'CallShot' | 'ChangeFireMode' | 'FireRangedWeapon' | 'ReloadWeapon' | 'TakeAim' | 'TakeCover'
export type ComplexAction = 'FireWeapon' | 'MeleeAttack' | 'Sprint'

// Weapon interface
export interface Weapon {
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

// Character interfaces
export interface Character {
  id: string
  name: string
  metatype: Metatype
  attributes: Record<Attribute, number>
  skills: Record<Skill, number>
  weapons: Weapon[]
  initiativeDice: number
  faction: string
  current_initiative: number
  cumulative_recoil: number
  wound_modifier: number
  situational_modifiers: number
  physical_damage: number
  stun_damage: number
  is_conscious: boolean
  is_alive: boolean
  total_damage_dealt: number
  calculate_wound_modifier: () => number
  check_status: () => string[]
}

export interface CombatCharacter extends Character {
  faction: 'faction1' | 'faction2'
  initiative: number
  position: number
  previousPhysicalDamage: number
  previousStunDamage: number
}

// Combat result interfaces
export interface RoundResult {
  actingCharacter: string
  initiativePhase: number
  attacker_hits: number
  defender_hits: number
  damage_dealt: number
  attack_rolls: number[]
  defense_rolls: number[]
  resistance_rolls: number[]
  status_changes: string[]
  messages: string[]
  glitch: boolean
  criticalGlitch: boolean
}

export interface MatchResult {
  winner: string
  rounds: number
  roundResults: RoundResult[]
  details: string
}

// Component prop types
export interface ActionLogEntryProps {
  summary: string
  details: string[]
}

export interface SimulationResultProps {
  result: MatchResult
  index: number
}

export interface FactionSelectorProps {
  faction: 'faction1' | 'faction2'
  characters: Character[]
  factionMembers: string[]
  factionModifiers: Record<string, number>
  onAddToFaction: (characterId: string, faction: 'faction1' | 'faction2') => void
  onRemoveFromFaction: (characterId: string, faction: 'faction1' | 'faction2') => void
  onModifierChange: (characterId: string, value: number) => void
}

// Add any other types or interfaces you need here