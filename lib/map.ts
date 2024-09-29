// Define the Vector type for positions and sizes
export type Vector = {
  x: number;
  y: number;
};

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

// Interface for the Map
export type GameMap = {
  width: number;
  height: number;
  cells: number[];
};

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
  const cells: number[] = [];

  for (let y = 0; y < size.y; y++) {
    for (let x = 0; x < size.x; x++) {
      const rand = Math.random();
      let cellType = 0; // Open

      if (rand < hard_cover_prob) {
        cellType = 2; // Hard Cover
      } else if (rand < hard_cover_prob + partial_cover_prob) {
        cellType = 1; // Partial Cover
      }

      cells.push(cellType);
    }
  }

  return {
    width: size.x,
    height: size.y,
    cells,
  };
}

// Function to move a character
export function move_char(
  char: Character,
  start_pos: Vector,
  end_pos: Vector,
  move_type: MoveType,
  gameMap: GameMap
): MoveResultAndDetails {
  // Calculate the distance
  const dx = end_pos.x - start_pos.x;
  const dy = end_pos.y - start_pos.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

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

  if (distance > movementAllowance) {
    return {
      success: false,
      path: [],
      distance_moved: 0,
      message: 'Destination is too far for the chosen movement type.',
    };
  }

  // Simple straight-line pathfinding (placeholder for actual pathfinding algorithm)
  const path: Vector[] = [];
  const steps = Math.ceil(distance);
  for (let i = 1; i <= steps; i++) {
    const x = start_pos.x + (dx * i) / steps;
    const y = start_pos.y + (dy * i) / steps;
    const tileX = Math.round(x);
    const tileY = Math.round(y);

    // Check for obstacles
    if (
      tileX < 0 ||
      tileY < 0 ||
      tileX >= gameMap.size.x ||
      tileY >= gameMap.size.y ||
      gameMap.tiles[tileY][tileX].type === TileType.HardCover
    ) {
      return {
        success: false,
        path: [],
        distance_moved: 0,
        message: 'Path is blocked by an obstacle.',
      };
    }

    path.push({ x: tileX, y: tileY });
  }

  const distanceMoved = path.length - 1; // Subtract 1 because the starting position is included

  return {
    success: true,
    path,
    distance_moved: distanceMoved,
    message: 'Character moved successfully.',
  };
}

