import {
  roll_d6,
  count_hits_and_ones,
  roll_initiative,
  calculate_recoil,
  get_range_modifier,
  resolve_attack,
  apply_damage,
  check_combat_end,
  select_best_weapon,
  get_ideal_range
} from './combat';
import { Character, Weapon, CombatCharacter, FireMode } from './types';
import { calculatePhysicalLimit, calculateMentalLimit } from './utils';
import { jest, describe, test, expect } from '@jest/globals';

// Mock character for testing
const mockCharacter: Character = {
  id: '1',
  name: 'Test Character',
  metatype: 'Human',
  attributes: {
    body: 4,
    agility: 4,
    reaction: 4,
    strength: 4,
    willpower: 4,
    logic: 4,
    intuition: 4,
    charisma: 4
  },
  skills: {
    firearms: 4,
    'close combat': 4,
    running: 4,
    armor: 4
  },
  weapons: [],
  initiativeDice: 1,
  faction: 'faction1',
  current_initiative: 0,
  cumulative_recoil: 0,
  wound_modifier: 0,
  situational_modifiers: 0,
  physical_damage: 0,
  stun_damage: 0,
  is_conscious: true,
  is_alive: true,
  total_damage_dealt: 0,
  physicalLimit: 5,
  mentalLimit: 5,
  calculate_wound_modifier: jest.fn().mockReturnValue(0) as jest.MockedFunction<() => number>,
  check_status: jest.fn().mockReturnValue([]) as jest.MockedFunction<() => string[]>
};

// Mock weapon for testing
const mockWeapon: Weapon = {
  name: 'Test Weapon',
  damage: 5,
  type: 'Ranged',
  damageType: 'P',
  ap: -2,
  recoilComp: 2,
  accuracy: 5,
  fireModes: ['SA', 'BF', 'FA'],
  currentFireMode: 'SA',
  ammoCount: 30,
  reach: 0
};

describe('Combat Functions', () => {
  test('roll_d6 returns correct number of dice', () => {
    const rolls = roll_d6(5);
    expect(rolls).toHaveLength(5);
    rolls.forEach(roll => {
      expect(roll).toBeGreaterThanOrEqual(1);
      expect(roll).toBeLessThanOrEqual(6);
    });
  });

  test('count_hits_and_ones counts correctly', () => {
    const rolls = [1, 2, 5, 5, 6, 1];
    const result = count_hits_and_ones(rolls);
    expect(result.hits).toBe(3);
    expect(result.ones).toBe(2);
    expect(result.isGlitch).toBe(false);
    expect(result.isCriticalGlitch).toBe(false);
  });

  test('roll_initiative calculates correctly', () => {
    const result = roll_initiative(mockCharacter);
    expect(result.initiative_total).toBeGreaterThanOrEqual(5); // 4 (reaction) + 4 (intuition) + 1d6
    expect(result.initiative_total).toBeLessThanOrEqual(14);
    expect(result.initiative_rolls).toHaveLength(1);
  });

  test('calculate_recoil returns correct penalty', () => {
    const recoilPenalty = calculate_recoil(mockCharacter, mockWeapon, 'BF');
    expect(recoilPenalty).toBe(0);
  });

  test('get_range_modifier returns correct modifier', () => {
    // This test assumes you have implemented the range_modifiers in your combat.ts file
    const modifier = get_range_modifier('Pistol', 10);
    expect(typeof modifier).toBe('number');
  });

  test('resolve_attack handles melee attack', () => {
    const attacker = { ...mockCharacter, attributes: { ...mockCharacter.attributes, strength: 6 } };
    const defender = { ...mockCharacter };
    const meleeWeapon: Weapon = { ...mockWeapon, type: 'Melee', reach: 1 };
    const result = resolve_attack(attacker, defender, meleeWeapon, 'SA', 1);
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.damage_dealt).toBeGreaterThanOrEqual(0);
  });

  test('resolve_attack handles ranged attack', () => {
    const attacker = { ...mockCharacter, attributes: { ...mockCharacter.attributes, agility: 6 } };
    const defender = { ...mockCharacter };
    const result = resolve_attack(attacker, defender, mockWeapon, 'SA', 10);
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.damage_dealt).toBeGreaterThanOrEqual(0);
  });

  test('apply_damage updates character correctly', () => {
    const character = { ...mockCharacter };
    apply_damage(character, 5, 'P');
    expect(character.physical_damage).toBe(5);
    apply_damage(character, 3, 'S');
    expect(character.stun_damage).toBe(3);
  });

  test('check_combat_end detects end of combat', () => {
    const characters: CombatCharacter[] = [
      { ...mockCharacter, faction: 'faction1', is_conscious: true, initiative: 0, position: 0, previousPhysicalDamage: 0, previousStunDamage: 0, movement_remaining: 0 },
      { ...mockCharacter, faction: 'faction1', is_conscious: false, initiative: 0, position: 0, previousPhysicalDamage: 0, previousStunDamage: 0, movement_remaining: 0 },
      { ...mockCharacter, faction: 'faction2', is_conscious: false, initiative: 0, position: 0, previousPhysicalDamage: 0, previousStunDamage: 0, movement_remaining: 0 }
    ];
    expect(check_combat_end(characters)).toBe(true);
  });

  test('select_best_weapon chooses correct weapon', () => {
    const character = {
      ...mockCharacter,
      weapons: [
        {
          name: 'Pistol',
          type: 'Ranged' as const,
          damage: '3d6',
          damageType: 'P' as const,
          ap: 0,
          recoilComp: 0,
          accuracy: 6,
          fireModes: ['SA'] as FireMode[], // Change this line
          currentFireMode: 'SA' as FireMode, // Change this line
          ammoCount: 17,
          reach: 0
        },
        {
          name: 'Knife',
          type: 'Melee' as const,
          damage: '2d6',
          damageType: 'S' as const,
          ap: 0,
          recoilComp: 0,
          accuracy: 0,
          fireModes: [], // Update other weapons similarly
          currentFireMode: null, // Update other weapons similarly
          ammoCount: 0, // Update other weapons similarly
          reach: 1
        },
      ]
    };
    const bestWeapon = select_best_weapon(character, 5);
    expect(bestWeapon.name).toBe('Pistol');
  });

  test('get_ideal_range returns correct range', () => {
    // This test assumes you have implemented the range_modifiers in your combat.ts file
    const idealRange = get_ideal_range('Pistol');
    expect(typeof idealRange).toBe('number');
  });
});

describe('Limit Calculations', () => {
  test('calculatePhysicalLimit returns correct value', () => {
    const limit = calculatePhysicalLimit(mockCharacter.attributes);
    expect(limit).toBe(6); // Updated expected value
  });

  test('calculateMentalLimit returns correct value', () => {
    const limit = calculateMentalLimit(mockCharacter.attributes);
    expect(limit).toBe(6); // Updated expected value
  });

});