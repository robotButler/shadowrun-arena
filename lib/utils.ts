import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Attribute, Vector, CombatCharacter } from './types'  // Update this import
import { CellType, GameMap } from './map'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateMaxPhysicalHealth(body: number): number {
  return 8 + Math.ceil(body / 2);
}

export function calculateMaxStunHealth(willpower: number): number {
  return 8 + Math.ceil(willpower / 2);
}

export const isCharacterAlive = (physicalDamage: number, maxPhysicalHealth: number): boolean => {
  return physicalDamage <= maxPhysicalHealth;
};

export const isCharacterConscious = (stunDamage: number, maxStunHealth: number, physicalDamage: number, maxPhysicalHealth: number): boolean => {
  return physicalDamage <= maxPhysicalHealth && stunDamage < maxStunHealth;
};

/**
 * Calculates the Euclidean distance between two positions.
 * @param position1 The first position
 * @param position2 The second position
 * @returns The distance between the two positions
 */
export const calculateDistance = (pos1: Vector, pos2: Vector): number => {
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  return Math.sqrt(dx * dx + dy * dy);
};

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

export function calculate_wound_modifier(character: CombatCharacter): number {
  const physicalModifier = Math.floor(character.physical_damage / 3);
  const stunModifier = Math.floor(character.stun_damage / 3);
  return physicalModifier + stunModifier;
}

export function getRandomEmptyPosition(map: GameMap, numPositions: number): Vector {
  const emptyPositions: Vector[] = [];
  
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (map.cells[y * map.width + x] === 0) {
        emptyPositions.push({ x, y });
      }
    }
  }

  if (emptyPositions.length < numPositions) {
    throw new Error("Not enough empty positions on the map");
  }

  // Shuffle the array of empty positions
  for (let i = emptyPositions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [emptyPositions[i], emptyPositions[j]] = [emptyPositions[j], emptyPositions[i]];
  }

  return emptyPositions[Math.floor(Math.random() * emptyPositions.length)];
}

export function getRandomEmptyCell(map: GameMap): [number, number] {
  const height = map.height;
  const width = map.width;
  
  while (true) {
    const x = Math.floor(Math.random() * width);
    const y = Math.floor(Math.random() * height);
    
    if (map.cells[y * map.width + x] === CellType.Empty) {
      return [x, y];
    }
  }
}
