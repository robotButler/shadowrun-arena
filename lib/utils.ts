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

export function roundVector(vector: Vector): Vector {
  return {
    x: Math.round(vector.x),
    y: Math.round(vector.y)
  };
}

/**
 * Returns all cells intersected by a line between the centers of two given cells.
 * @param start The starting cell coordinates
 * @param end The ending cell coordinates
 * @returns An array of cell coordinates intersected by the line
 */
export function getIntersectedCells(start: Vector, end: Vector): Vector[] {
  const intersectedCells: Vector[] = [];
  let x1 = Math.round(start.x);
  let y1 = Math.round(start.y);
  const x2 = Math.round(end.x);
  const y2 = Math.round(end.y);

  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;

  let err = dx - dy;
  let e2: number;

  while (true) {
    intersectedCells.push({ x: x1, y: y1 });

    if (x1 === x2 && y1 === y2) break;

    e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x1 += sx;
      // Add the cell in the x direction
      intersectedCells.push({ x: x1, y: y1 });
    }
    if (e2 < dx) {
      err += dx;
      y1 += sy;
      // Add the cell in the y direction
      intersectedCells.push({ x: x1, y: y1 });
    }
  }

  // Remove duplicates
  return intersectedCells.filter((cell, index, self) =>
    index === self.findIndex((t) => t.x === cell.x && t.y === cell.y)
  );
}

export function isAdjacentToCover(character: CombatCharacter, gameMap: GameMap): Vector[] {
  const adjacentCells: Vector[] = [];
  const { x, y } = character.position;

  if (!gameMap) {
    console.error("Game map is undefined in isAdjacentToCover");
    return adjacentCells;
  }

  console.log("Checking adjacent cells for cover");
  console.log("Character position:", { x, y });

  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      const newX = Math.floor(x + dx);
      const newY = Math.floor(y + dy);
      if (newX >= 0 && newX < gameMap.width && newY >= 0 && newY < gameMap.height) {
        const cellType = gameMap.cells[newY * gameMap.width + newX];
        console.log(`Cell at (${newX}, ${newY}):`, cellType);
        if (cellType === CellType.PartialCover || cellType === CellType.HardCover) {
          adjacentCells.push({ x: newX, y: newY });
          console.log("Found cover cell:", { x: newX, y: newY });
        }
      }
    }
  }

  console.log("Adjacent cover cells:", adjacentCells);
  return adjacentCells;
}

export function canTakeCover(character: CombatCharacter, gameMap: GameMap, opponents: CombatCharacter[]): boolean {
  if (!gameMap) {
    console.error("Game map is undefined in canTakeCover");
    return false;
  }

  console.log("Checking if character can take cover:", character.name);
  console.log("Character position:", character.position);
  console.log("Game map dimensions:", gameMap.width, "x", gameMap.height);

  const adjacentCoverCells = isAdjacentToCover(character, gameMap);
  console.log("Adjacent cover cells:", adjacentCoverCells);

  if (adjacentCoverCells.length === 0) {
    console.log("No adjacent cover cells found");
    return false;
  }

  for (const opponent of opponents) {
    console.log("Checking against opponent:", opponent.name);
    console.log("Opponent position:", opponent.position);

    const intersectedCells = getIntersectedCells(character.position, opponent.position);
    console.log("Intersected cells:", intersectedCells);

    for (const cell of intersectedCells) {
      if (adjacentCoverCells.some(coverCell => coverCell.x === cell.x && coverCell.y === cell.y)) {
        console.log("Found intersecting cover cell:", cell);
        return true;
      }
    }
  }

  console.log("No suitable cover found");
  return false;
}

export function getCoverBonus(attacker: CombatCharacter, defender: CombatCharacter, gameMap: GameMap): number {
  if (!defender.isTakingCover) return 0;

  const intersectedCells = getIntersectedCells(attacker.position, defender.position);
  for (const cell of intersectedCells) {
    if (defender.adjacentCoverCells.some(coverCell => coverCell.x === cell.x && coverCell.y === cell.y)) {
      const cellType = gameMap.cells[cell.y * gameMap.width + cell.x];
      return cellType === CellType.PartialCover ? 2 : 4;
    }
  }

  return 0;
}
