import { Vector } from './types';
import * as PF from 'pathfinding';

// Enum for movement types according to Shadowrun 5e rules
export enum MoveType {
  Walk = 'Walk',
  Run = 'Run',
  Sprint = 'Sprint',
}

// Interface for a character
export interface Character {
  name: string;
  movement: {
    walk: number;
    run: number;
    sprint: number;
  };
  // Add other character attributes as needed
}

// Types for map tiles
export enum TileType {
  Open = 'Open',
  PartialCover = 'PartialCover',
  HardCover = 'HardCover',
}

// Interface for a map tile
export interface MapTile {
  position: Vector;
  type: TileType;
}

// Enum for cell types
export enum CellType {
  Empty = 0,
  PartialCover = 1,
  HardCover = 2
}

// Interface for the Map
export interface GameMap {
  width: number;
  height: number;
  cells: CellType[];
}

// Interface for move result and details
export interface MoveResultAndDetails {
  success: boolean;
  path: Vector[];
  distance_moved: number;
  message: string;
}

// Function to generate the map
export function generate_map(
  size: Vector,
  partial_cover_prob: number,
  hard_cover_prob: number
): GameMap {
  const cells: CellType[] = [];

  // First pass: generate initial map
  for (let y = 0; y < size.y; y++) {
    for (let x = 0; x < size.x; x++) {
      const rand = Math.random();
      let cellType = CellType.Empty;

      if (rand < hard_cover_prob) {
        cellType = CellType.HardCover;
      } else if (rand < hard_cover_prob + partial_cover_prob) {
        cellType = CellType.PartialCover;
      }

      cells.push(cellType);
    }
  }

  // Second pass: adjust probabilities for adjacent cells
  const adjustmentFactor = 0.05; // Increase probability by 15%
  for (let y = 0; y < size.y; y++) {
    for (let x = 0; x < size.x; x++) {
      if (cells[y * size.x + x] === CellType.Empty) {
        const adjacentCover = hasAdjacentCover(x, y, size, cells);
        if (adjacentCover) {
          const rand = Math.random();
          if (rand < (hard_cover_prob + adjustmentFactor)) {
            cells[y * size.x + x] = CellType.HardCover;
          } else if (rand < (hard_cover_prob + partial_cover_prob + adjustmentFactor)) {
            cells[y * size.x + x] = CellType.PartialCover;
          }
        }
      }
    }
  }

  return {
    width: size.x,
    height: size.y,
    cells,
  };
}

function hasAdjacentCover(x: number, y: number, size: Vector, cells: CellType[]): boolean {
  const directions = [
    [-1, -1], [0, -1], [1, -1],
    [-1,  0],          [1,  0],
    [-1,  1], [0,  1], [1,  1]
  ];

  for (const [dx, dy] of directions) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && nx < size.x && ny >= 0 && ny < size.y) {
      const cell = cells[ny * size.x + nx];
      if (cell === CellType.PartialCover || cell === CellType.HardCover) {
        return true;
      }
    }
  }

  return false;
}

// Function to move a character
export function move_char(
  char: Character,
  start_pos: Vector,
  end_pos: Vector,
  move_type: MoveType,
  gameMap: GameMap,
  placedCharacters: Array<{character: Character, position: Vector}>
): MoveResultAndDetails {
  // Get movement allowance
  let movementAllowance = 0;
  switch (move_type) {
    case MoveType.Walk:
      movementAllowance = char.movement.walk;
      break;
    case MoveType.Run:
      movementAllowance = char.movement.run;
      break;
    case MoveType.Sprint:
      movementAllowance = char.movement.sprint;
      break;
  }

  // Create a pathfinding grid
  const grid = new PF.Grid(gameMap.width, gameMap.height);
  gameMap.cells.forEach((cell, index) => {
    const x = index % gameMap.width;
    const y = Math.floor(index / gameMap.width);
    if (cell === CellType.HardCover || cell === CellType.PartialCover) {
      grid.setWalkableAt(x, y, false);
    }
  });

  // Mark cells with other characters as unwalkable
  placedCharacters.forEach(({ position }) => {
    if (position.x !== start_pos.x || position.y !== start_pos.y) {
      grid.setWalkableAt(position.x, position.y, false);
    }
  });

  const finder = new PF.AStarFinder();
  const path = finder.findPath(
    start_pos.x,
    start_pos.y,
    end_pos.x,
    end_pos.y,
    grid
  );

  if (path.length === 0) {
    return {
      success: false,
      path: [],
      distance_moved: 0,
      message: 'No valid path to the destination.',
    };
  }

  const distance = path.length - 1; // Subtract 1 because the starting position is included

  if (distance > movementAllowance) {
    return {
      success: false,
      path: [],
      distance_moved: 0,
      message: 'Destination is too far for the chosen movement type.',
    };
  }

  const vectorPath = path.map(([x, y]) => ({ x, y }));

  return {
    success: true,
    path: vectorPath,
    distance_moved: distance,
    message: 'Character moved successfully.',
  };
}

