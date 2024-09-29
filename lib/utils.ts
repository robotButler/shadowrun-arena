import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Attribute, Vector } from './types'  // Update this import

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
 * Calculates the Euclidean distance between two positions.
 * @param position1 The first position
 * @param position2 The second position
 * @returns The distance between the two positions
 */
export function calculateDistance(position1: Vector, position2: Vector): number {
  const dx = position1.x - position2.x;
  const dy = position1.y - position2.y;
  return Math.sqrt(dx * dx + dy * dy);
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

/**
 * Calculates the Manhattan distance between two positions.
 * This can be useful for grid-based movement.
 * @param position1 The first position
 * @param position2 The second position
 * @returns The Manhattan distance between the two positions
 */
export function calculateManhattanDistance(position1: Vector, position2: Vector): number {
  return Math.abs(position1.x - position2.x) + Math.abs(position1.y - position2.y);
}

/**
 * Checks if two positions are adjacent (including diagonally).
 * @param position1 The first position
 * @param position2 The second position
 * @returns True if the positions are adjacent, false otherwise
 */
export function arePositionsAdjacent(position1: Vector, position2: Vector): boolean {
  const dx = Math.abs(position1.x - position2.x);
  const dy = Math.abs(position1.y - position2.y);
  return (dx <= 1 && dy <= 1) && !(dx === 0 && dy === 0);
}
