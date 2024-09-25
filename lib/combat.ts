// combat.ts

import { Weapon, Character, RoundResult, MatchResult } from './types';

// Utility functions
function roll_d6(numDice: number): number[] {
    const rolls: number[] = [];
    for (let i = 0; i < numDice; i++) {
        rolls.push(Math.floor(Math.random() * 6) + 1);
    }
    return rolls;
}

function count_hits_and_ones(rolls: number[]): { hits: number, ones: number, isGlitch: boolean, isCriticalGlitch: boolean } {
    let hits = 0;
    let ones = 0;
    for (const roll of rolls) {
        if (roll >= 5) hits += 1;
        if (roll === 1) ones += 1;
    }
    const isGlitch = ones > rolls.length / 2;
    const isCriticalGlitch = isGlitch && hits === 0;
    return { hits, ones, isGlitch, isCriticalGlitch };
}

// Constants
const range_modifiers: { [weaponType: string]: [number, number][] } = {
    // Define your range modifiers here
    // Example:
    // 'Pistol': [[0, 0], [5, -1], [20, -3], [40, -6]],
};

// Functions
function roll_initiative(character: Character): { initiative_total: number, initiative_rolls: number[] } {
    const initiative_score = character.attributes.reaction + character.attributes.intuition;
    const initiative_rolls = roll_d6(character.initiativeDice);
    const initiative_total = initiative_score + initiative_rolls.reduce((a, b) => a + b, 0);
    character.current_initiative = initiative_total;
    return { initiative_total, initiative_rolls };
}

function calculate_recoil(attacker: Character, weapon: Weapon, fire_mode: string): number {
    let bullets_fired = 1; // Default for SS and SA
    if (fire_mode === 'BF') {
        bullets_fired = 3;
    } else if (fire_mode === 'FA') {
        bullets_fired = 6; // For simplicity, assume 6 bullets fired in FA
    }
    // Calculate recoil penalty
    let recoil_penalty = attacker.cumulative_recoil + bullets_fired - 1 - weapon.recoilComp;
    recoil_penalty = Math.max(recoil_penalty, 0); // Penalty is negative
    // Update cumulative recoil
    attacker.cumulative_recoil += bullets_fired - 1;
    return recoil_penalty;
}

function get_range_modifier(weapon_type: string, distance: number): number {
    const ranges = range_modifiers[weapon_type];
    if (!ranges) {
        return 0;
    }
    for (const [max_range, modifier] of ranges) {
        if (distance <= max_range) {
            return modifier;
        }
    }
    return -6; // If beyond extreme range, default to -6
}

// Update the resolve_attack function
function resolve_attack(attacker: Character, defender: Character, weapon: Weapon, fire_mode: 'SS' | 'SA' | 'BF' | 'FA' = 'SA', distance: number = 0): RoundResult {
    const result: RoundResult = {
        actingCharacter: attacker.name,
        initiativePhase: 0,
        attacker_hits: 0,
        defender_hits: 0,
        damage_dealt: 0,
        attack_rolls: [],
        defense_rolls: [],
        resistance_rolls: [],
        status_changes: [],
        messages: [], // Initialize as an empty array
        glitch: false,
        criticalGlitch: false,
    };

    if (weapon.type.toLowerCase() === 'melee') {
        // Melee attack
        const base_pool = attacker.attributes.agility + (attacker.skills['close combat'] || 0);
        const reach_modifier = weapon.reach - 0; // Assuming defender has no reach weapon
        attacker.calculate_wound_modifier();
        const total_attack_pool = Math.max(base_pool + reach_modifier + attacker.wound_modifier + attacker.situational_modifiers, 1);
        result.messages.push(`Melee Attack: Base pool (${base_pool}) + Reach modifier (${reach_modifier}) + Wound modifier (${attacker.wound_modifier}) + Situational modifiers (${attacker.situational_modifiers}) = Total attack pool (${total_attack_pool})`);

        const attack_rolls = roll_d6(total_attack_pool);
        const { hits: attack_hits, ones: attack_ones, isGlitch, isCriticalGlitch } = count_hits_and_ones(attack_rolls);
        
        // Apply Physical Limit
        const limited_attack_hits = Math.min(attack_hits, attacker.physicalLimit);
        
        result.attack_rolls = attack_rolls;
        result.attacker_hits = limited_attack_hits;
        result.glitch = isGlitch;
        result.criticalGlitch = isCriticalGlitch;

        result.messages.push(`Attack rolls: ${attack_rolls.join(', ')} (${attack_hits} hits, limited to ${limited_attack_hits} by Physical Limit, ${attack_ones} ones)`);

        if (isCriticalGlitch) {
            const stunDamage = Math.floor(Math.random() * 6) + 1;
            apply_damage(attacker, stunDamage, 'S');
            result.messages.push(`Critical Glitch! ${attacker.name} takes ${stunDamage} stun damage.`);
            return result;
        } else if (isGlitch) {
            result.messages.push(`Glitch! The attack fails and has no effect.`);
            return result;
        }

        // Defender's defense test
        const base_defense_pool = defender.attributes.reaction + defender.attributes.intuition;
        defender.calculate_wound_modifier();
        const total_defense_pool = Math.max(base_defense_pool - reach_modifier + defender.wound_modifier + defender.situational_modifiers, 1);
        result.messages.push(`Defense: Base pool (${base_defense_pool}) - Reach modifier (${reach_modifier}) + Wound modifier (${defender.wound_modifier}) + Situational modifiers (${defender.situational_modifiers}) = Total defense pool (${total_defense_pool})`);

        const defense_rolls = roll_d6(total_defense_pool);
        const { hits: defense_hits } = count_hits_and_ones(defense_rolls);
        result.defense_rolls = defense_rolls;
        result.defender_hits = defense_hits;
        result.messages.push(`Defense rolls: ${defense_rolls.join(', ')} (${defense_hits} hits)`);

        // Calculate net hits
        const net_hits = limited_attack_hits - defense_hits;
        result.messages.push(`Net hits: ${limited_attack_hits} - ${defense_hits} = ${net_hits}`);
        if (net_hits <= 0) {
            result.messages.push("Attack missed.");
            return result;
        }

        // Calculate total damage
        // Assume the weapon damage value already includes the strength bonus
        const base_damage = parseInt(weapon.damage);
        const total_damage = base_damage + net_hits;
        result.messages.push(`Damage: Base (${base_damage}) + Net hits (${net_hits}) = Total damage (${total_damage})`);

        // Apply AP to defender's armor
        const modified_armor = defender.skills.armor + weapon.ap;
        result.messages.push(`Modified armor: ${defender.skills.armor} + ${weapon.ap} = ${modified_armor}`);

        // Damage resistance test
        let resistance_pool = defender.attributes.body + Math.max(modified_armor, 0);
        defender.calculate_wound_modifier();
        resistance_pool += defender.wound_modifier + defender.situational_modifiers;
        resistance_pool = Math.max(resistance_pool, 1);
        result.messages.push(`Damage resistance pool: Body (${defender.attributes.body}) + Modified armor (${Math.max(modified_armor, 0)}) + Wound modifier (${defender.wound_modifier}) + Situational modifiers (${defender.situational_modifiers}) = ${resistance_pool}`);

        const resistance_rolls = roll_d6(resistance_pool);
        const { hits: resistance_hits } = count_hits_and_ones(resistance_rolls);
        result.resistance_rolls = resistance_rolls;
        result.messages.push(`Resistance rolls: ${resistance_rolls.join(', ')} (${resistance_hits} hits)`);

        // Calculate damage taken
        const damage_taken = Math.max(total_damage - resistance_hits, 0);
        result.damage_dealt = damage_taken;
        result.messages.push(`Final damage: ${total_damage} - ${resistance_hits} = ${damage_taken}`);

        if (damage_taken === 0) {
            result.messages.push("No damage penetrated armor.");
        } else {
            apply_damage(defender, damage_taken, weapon.damageType);
            attacker.total_damage_dealt += damage_taken;
            result.status_changes = defender.check_status();
            result.messages.push(`${defender.name} takes ${damage_taken} ${weapon.damageType} damage.`);
        }
    } else {
        // Ranged attack
        const base_pool = attacker.attributes.agility + (attacker.skills['firearms'] || 0);
        const range_modifier = get_range_modifier(weapon.type, distance);
        const recoil_modifier = calculate_recoil(attacker, weapon, fire_mode);
        attacker.calculate_wound_modifier();
        const modifiers = range_modifier + recoil_modifier + attacker.wound_modifier + attacker.situational_modifiers;
        const total_attack_pool = Math.max(base_pool + modifiers, 1);
        result.messages.push(`Ranged Attack: Base pool (${base_pool}) + Range modifier (${range_modifier}) + Recoil modifier (${recoil_modifier}) + Wound modifier (${attacker.wound_modifier}) + Situational modifiers (${attacker.situational_modifiers}) = Total attack pool (${total_attack_pool})`);

        const attack_rolls = roll_d6(total_attack_pool);
        const { hits: attack_hits, ones: attack_ones, isGlitch, isCriticalGlitch } = count_hits_and_ones(attack_rolls);
        
        // Apply Physical Limit
        const limited_attack_hits = Math.min(attack_hits, attacker.physicalLimit);
        
        result.attack_rolls = attack_rolls;
        result.attacker_hits = limited_attack_hits;
        result.glitch = isGlitch;
        result.criticalGlitch = isCriticalGlitch;

        result.messages.push(`Attack rolls: ${attack_rolls.join(', ')} (${attack_hits} hits, limited to ${limited_attack_hits} by Physical Limit, ${attack_ones} ones)`);

        if (isCriticalGlitch) {
            const stunDamage = Math.floor(Math.random() * 6) + 1;
            apply_damage(attacker, stunDamage, 'S');
            result.messages.push(`Critical Glitch! ${attacker.name} takes ${stunDamage} stun damage.`);
            return result;
        } else if (isGlitch) {
            result.messages.push(`Glitch! The attack fails and has no effect.`);
            return result;
        }

        // Defender's defense test
        const base_defense_pool = defender.attributes.reaction + defender.attributes.intuition;
        let defense_modifiers = 0;
        if (fire_mode === 'BF') {
            defense_modifiers -= 2;
        } else if (fire_mode === 'FA') {
            defense_modifiers -= 5;
        }
        defender.calculate_wound_modifier();
        defense_modifiers += defender.wound_modifier + defender.situational_modifiers;
        const total_defense_pool = Math.max(base_defense_pool + defense_modifiers, 1);
        result.messages.push(`Defense: Base pool (${base_defense_pool}) + Defense modifiers (${defense_modifiers}) + Wound modifier (${defender.wound_modifier}) + Situational modifiers (${defender.situational_modifiers}) = Total defense pool (${total_defense_pool})`);

        const defense_rolls = roll_d6(total_defense_pool);
        const { hits: defense_hits } = count_hits_and_ones(defense_rolls);
        result.defense_rolls = defense_rolls;
        result.defender_hits = defense_hits;
        result.messages.push(`Defense rolls: ${defense_rolls.join(', ')} (${defense_hits} hits)`);

        // Calculate net hits
        const net_hits = limited_attack_hits - defense_hits;
        result.messages.push(`Net hits: ${limited_attack_hits} - ${defense_hits} = ${net_hits}`);
        if (net_hits <= 0) {
            result.messages.push("Attack missed.");
            return result;
        }

        // Calculate total damage
        const base_damage = parseInt(weapon.damage);
        const total_damage = base_damage + net_hits;
        result.messages.push(`Damage: Base (${base_damage}) + Net hits (${net_hits}) = Total damage (${total_damage})`);

        // Apply AP to defender's armor
        const modified_armor = defender.skills.armor + weapon.ap;
        result.messages.push(`Modified armor: ${defender.skills.armor} + ${weapon.ap} = ${modified_armor}`);

        // Damage resistance test
        let resistance_pool = defender.attributes.body + Math.max(modified_armor, 0);
        defender.calculate_wound_modifier();
        resistance_pool += defender.wound_modifier + defender.situational_modifiers;
        resistance_pool = Math.max(resistance_pool, 1);
        result.messages.push(`Damage resistance pool: Body (${defender.attributes.body}) + Modified armor (${Math.max(modified_armor, 0)}) + Wound modifier (${defender.wound_modifier}) + Situational modifiers (${defender.situational_modifiers}) = ${resistance_pool}`);

        const resistance_rolls = roll_d6(resistance_pool);
        const { hits: resistance_hits } = count_hits_and_ones(resistance_rolls);
        result.resistance_rolls = resistance_rolls;
        result.messages.push(`Resistance rolls: ${resistance_rolls.join(', ')} (${resistance_hits} hits)`);

        // Calculate damage taken
        const damage_taken = Math.max(total_damage - resistance_hits, 0);
        result.damage_dealt = damage_taken;
        result.messages.push(`Final damage: ${total_damage} - ${resistance_hits} = ${damage_taken}`);

        if (damage_taken === 0) {
            result.messages.push("No damage penetrated armor.");
        } else {
            apply_damage(defender, damage_taken, weapon.damageType);
            attacker.total_damage_dealt += damage_taken;
            result.status_changes = defender.check_status();
            result.messages.push(`${defender.name} takes ${damage_taken} ${weapon.damageType} damage.`);
        }

    }

    return result;
}

function apply_damage(character: Character, damage: number, damage_type: string): void {
    if (damage_type === 'P') {
        character.physical_damage += damage;
    } else if (damage_type === 'S') {
        character.stun_damage += damage;
    }
    character.calculate_wound_modifier();
}

function check_combat_end(match_characters: Character[]): boolean {
    const active_factions = new Set<string>();
    for (const c of match_characters) {
        if (c.is_conscious && c.is_alive) {
            active_factions.add(c.faction);
        }
    }
    return active_factions.size <= 1;
}

function select_best_weapon(character: Character, distance: number): Weapon {
    let best_weapon: Weapon | null = null;
    let best_modifier = -Infinity;
    for (const weapon of character.weapons) {
        if (weapon.type.toLowerCase() === 'melee' && distance <= 2) {
            return weapon; // Melee weapon in range
        } else if (weapon.type.toLowerCase() !== 'melee') {
            const range_modifier = get_range_modifier(weapon.type, distance);
            if (range_modifier > best_modifier) {
                best_modifier = range_modifier;
                best_weapon = weapon;
            }
        }
    }
    if (best_weapon) {
        return best_weapon;
    } else {
        // If no suitable ranged weapon, return any melee weapon
        for (const weapon of character.weapons) {
            if (weapon.type.toLowerCase() === 'melee') {
                return weapon;
            }
        }
    }
    return character.weapons[0]; // Default to first weapon
}

function get_ideal_range(weapon_type: string): number {
    const ranges = range_modifiers[weapon_type];
    if (!ranges) {
        return 0;
    }
    // Ideal range is the middle of the 'Short' range category
    const short_range = ranges[0][0];
    return short_range / 2;
}

// Add these export statements at the end of the file
export {
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
}
