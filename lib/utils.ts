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
