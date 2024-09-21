import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateMaxPhysicalHealth(body: number): number {
  return Math.ceil(body / 2) + 8
}

export function calculateMaxStunHealth(willpower: number): number {
  return Math.ceil(willpower / 2) + 8
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
