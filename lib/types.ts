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
  name: string;
  type: 'Melee' | 'Ranged';
  damage: number;
  accuracy: number;
  ap: number;
  currentFireMode?: FireMode;
  fireModes?: FireMode[];
  ammoCount?: number;
  range?: number[]; // This should be an array of numbers representing the weapon's range brackets
  recoilComp?: number; // Add this if it's not already present
  damageType: 'P' | 'S'; // Add this if it's not already present
  reach?: number;
  weaponType: WeaponType;
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
  physicalLimit: number
  mentalLimit: number
  calculate_wound_modifier: () => number
  check_status: () => string[]
}

// Add this new type definition
export type Vector = {
  x: number;
  y: number;
};

// Update the CombatCharacter interface
export interface CombatCharacter extends Character {
  faction: 'faction1' | 'faction2'
  total_initiative: () => number
  original_initiative: number
  position: Vector  // Changed from number to Vector
  previousPhysicalDamage: number
  previousStunDamage: number
  movement_remaining: number
  physical_damage: number;
  stun_damage: number;
  is_conscious: boolean;
  is_alive: boolean;
  isTakingCover: boolean;
  adjacentCoverCells: Vector[];
  hasMoved: boolean; // Add this new property
  isRunning: boolean; // Added as per the colleague's instructions
  isSprinting: boolean; // Added as per the colleague's instructions
  // New methods
  updateStatus(): void;
  getStatusChanges(): string[];
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

// Add this enum to the file
export enum WeaponType {
  Taser = "Taser",
  HoldOutPistol = "Hold-Out Pistol",
  LightPistol = "Light Pistol",
  HeavyPistol = "Heavy Pistol",
  MachinePistol = "Machine Pistol",
  SMG = "SMG",
  AssaultRifle = "Assault Rifle",
  ShotgunFlechette = "Shotgun (flechette)",
  ShotgunSlug = "Shotgun (slug)",
  SniperRifle = "Sniper Rifle",
  LightMachinegun = "Light Machinegun",
  MediumHeavyMachinegun = "Medium/Heavy Machinegun",
  AssaultCannon = "Assault Cannon",
  GrenadeLauncher = "Grenade Launcher",
  MissileLauncher = "Missile Launcher",
  Bow = "Bow",
  LightCrossbow = "Light Crossbow",
  MediumCrossbow = "Medium Crossbow",
  HeavyCrossbow = "Heavy Crossbow",
  ThrowingKnife = "Throwing Knife",
  Shuriken = "Shuriken",
  StandardGrenade = "Standard Grenade",
  AerodynamicGrenade = "Aerodynamic Grenade",
}

// Update the Weapon interface to include the new WeaponType
export interface Weapon {
  // ... (existing properties)
  weaponType: WeaponType;
  // ... (other properties)
}

// ... (rest of the existing code)