import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Attribute } from './types'  // Add this import

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateMaxPhysicalHealth(body: number): number {
  return 8 + Math.ceil(body / 2);
}

export function calculateMaxStunHealth(willpower: number): number {
  return 8 + Math.ceil(willpower / 2);
}

export function isCharacterAlive(physicalDamage: number, maxPhysicalHealth: number): boolean {
  return physicalDamage < maxPhysicalHealth
}

export function isCharacterConscious(stunDamage: number, maxStunHealth: number, physicalDamage: number, maxPhysicalHealth: number): boolean {
  return stunDamage < maxStunHealth && physicalDamage < maxPhysicalHealth
}

/**
 * Calculates the distance between two positions.
 * @param position1 The first position
 * @param position2 The second position
 * @returns The absolute distance between the two positions
 */
export function calculateDistance(position1: number, position2: number): number {
  return Math.abs(position1 - position2);
}

export function calculatePhysicalLimit(strength: number, body: number, reaction: number): number {
  console.log(`Calculating physical limit: strength=${strength}, body=${body}, reaction=${reaction}`);
  if (isNaN(strength) || isNaN(body) || isNaN(reaction)) {
    console.error(`Invalid input for calculatePhysicalLimit: strength=${strength}, body=${body}, reaction=${reaction}`);
    return 0; // or another default value
  }
  const physicalLimit = Math.ceil((strength * 2 + body + reaction) / 3.0);
  console.log(`Calculated physicalLimit: ${physicalLimit}`);
  console.log(strength * 2 + body + reaction);
  console.log((strength * 2 + body + reaction) / 3);
  if (isNaN(physicalLimit)) {
    console.error(`Calculated physicalLimit is NaN: strength=${strength}, body=${body}, reaction=${reaction}`);
    return 0; // or another default value
  }
  return physicalLimit;
}

export function calculateMentalLimit(attributes: Record<Attribute, number>): number {
  return Math.ceil((attributes.logic * 2 + attributes.intuition + attributes.willpower) / 3);
}

export function calculateSocialLimit(attributes: Record<Attribute, number>): number {
  return Math.ceil((attributes.charisma * 2 + attributes.willpower + attributes.essence) / 3);
}
