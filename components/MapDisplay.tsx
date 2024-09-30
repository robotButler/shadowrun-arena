import React from 'react';
import { GameMap, CellType } from '../lib/map';
import { Character, Vector, CombatCharacter } from '../lib/types';
import { calculateDistance } from '../lib/utils';

interface MapDisplayProps {
  map: GameMap;
  onCellClick?: (position: Vector) => void;
  placedCharacters: Array<{character: Character, position: Vector}>;
  currentCharacter?: CombatCharacter;
  maxMoveDistance?: number;
  isSelectingMoveTarget?: boolean;
}

export function MapDisplay({ 
  map, 
  onCellClick, 
  placedCharacters, 
  currentCharacter,
  maxMoveDistance,
  isSelectingMoveTarget
}: MapDisplayProps) {
  console.log("Placed Characters:", placedCharacters);  // Add this line

  const cellSize = 20; // Size of each cell in pixels

  const getCellColor = (cellType: CellType, position: Vector) => {
    if (currentCharacter && isSelectingMoveTarget && maxMoveDistance) {
      const distance = calculateDistance(currentCharacter.position, position);
      if (distance <= maxMoveDistance) {
        return 'rgba(0, 255, 0, 0.3)'; // Light green for valid move targets
      }
    }
    switch (cellType) {
      case CellType.Empty: return 'white';
      case CellType.PartialCover: return 'lightgray';
      case CellType.HardCover: return 'gray';
      default: return 'white';
    }
  };

  const getCharacterInitial = (position: Vector) => {
    const character = placedCharacters.find(pc => pc.position.x === position.x && pc.position.y === position.y);
    return character ? character.character.name[0].toUpperCase() : null;
  };

  return (
    <svg width={map.width * cellSize} height={map.height * cellSize}>
      {map.cells.map((cell, index) => {
        const x = index % map.width;
        const y = Math.floor(index / map.width);
        const position = { x, y };
        const characterInitial = getCharacterInitial(position);

        return (
          <g key={index} onClick={() => onCellClick && onCellClick(position)}>
            <rect
              x={x * cellSize}
              y={y * cellSize}
              width={cellSize}
              height={cellSize}
              fill={getCellColor(cell, position)}
              stroke="black"
              strokeWidth="1"
            />
            {characterInitial && (
              <text
                x={x * cellSize + cellSize / 2}
                y={y * cellSize + cellSize / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={cellSize * 0.8}
                fill="red"
              >
                {characterInitial}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
