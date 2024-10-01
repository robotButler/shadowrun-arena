import React, { useState, useEffect, useMemo } from 'react';
import { GameMap, CellType } from '../lib/map';
import { Character, Vector, CombatCharacter } from '../lib/types';
import { Bed, BrickWall, Ghost } from 'lucide-react';
import * as PF from 'pathfinding';

interface MapDisplayProps {
  map: GameMap;
  onCellClick?: (position: Vector) => void;
  placedCharacters: Array<{character: Character, position: Vector}>;
  currentCharacter?: CombatCharacter;
  maxMoveDistance?: number;
  isSelectingMoveTarget?: boolean;
  faction1: string[];
  faction2: string[];
  placingCharacter: Character | null; // Add this prop
}

export function MapDisplay({ 
  map, 
  onCellClick, 
  placedCharacters, 
  currentCharacter,
  maxMoveDistance,
  isSelectingMoveTarget,
  faction1 = [],
  faction2 = [],
  placingCharacter // Add this prop
}: MapDisplayProps) {
  const [hoveredCell, setHoveredCell] = useState<Vector | null>(null);
  const [currentPath, setCurrentPath] = useState<Vector[]>([]);
  const [validMoveTargets, setValidMoveTargets] = useState<Vector[]>([]);

  const cellSize = 20;

  // Use useMemo to create the pathfinding grid
  const { pfGrid, finder } = useMemo(() => {
    const grid = new PF.Grid(map.width, map.height);
    map.cells.forEach((cell, index) => {
      const x = index % map.width;
      const y = Math.floor(index / map.width);
      if (cell === CellType.HardCover || cell === CellType.PartialCover) {
        grid.setWalkableAt(x, y, false);
      }
    });
    
    // Mark cells with characters as unwalkable
    placedCharacters.forEach(({ position }) => {
      grid.setWalkableAt(position.x, position.y, false);
    });

    return { pfGrid: grid, finder: new PF.AStarFinder() };
  }, [map, placedCharacters]);

  // Calculate valid move targets
  useEffect(() => {
    if (currentCharacter && isSelectingMoveTarget && maxMoveDistance !== undefined) {
      const newValidMoveTargets: Vector[] = [];
      const tempGrid = pfGrid.clone();
      tempGrid.setWalkableAt(currentCharacter.position.x, currentCharacter.position.y, true);

      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          if (map.cells[y * map.width + x] === CellType.Empty) {
            const path = finder.findPath(
              currentCharacter.position.x,
              currentCharacter.position.y,
              x,
              y,
              tempGrid.clone()
            );
            if (path.length > 0 && path.length - 1 <= maxMoveDistance) {
              newValidMoveTargets.push({ x, y });
            }
          }
        }
      }
      setValidMoveTargets(newValidMoveTargets);
    } else {
      setValidMoveTargets([]);
    }
  }, [currentCharacter, isSelectingMoveTarget, maxMoveDistance, pfGrid, finder, map]);

  useEffect(() => {
    if (currentCharacter && isSelectingMoveTarget && hoveredCell) {
      const tempGrid = pfGrid.clone();
      tempGrid.setWalkableAt(currentCharacter.position.x, currentCharacter.position.y, true);

      const path = finder.findPath(
        currentCharacter.position.x,
        currentCharacter.position.y,
        hoveredCell.x,
        hoveredCell.y,
        tempGrid
      );
      setCurrentPath(path.map(([x, y]) => ({ x, y })));
    } else {
      setCurrentPath([]);
    }
  }, [currentCharacter, isSelectingMoveTarget, hoveredCell, pfGrid, finder]);

  const getCellColor = (cellType: CellType, position: Vector) => {
    const character = placedCharacters.find(pc => pc.position.x === position.x && pc.position.y === position.y);
    
    if (character) {
      if (Array.isArray(faction1) && faction1.includes(character.character.id)) {
        return 'rgba(0, 255, 0, 0.5)';
      } else if (Array.isArray(faction2) && faction2.includes(character.character.id)) {
        return 'rgba(0, 0, 255, 0.5)';
      } else {
        return 'rgba(255, 0, 0, 0.5)';
      }
    }

    // First, determine the base color based on cell type
    let baseColor;
    switch (cellType) {
      case CellType.Empty: baseColor = 'white'; break;
      case CellType.PartialCover: baseColor = 'lightgray'; break;
      case CellType.HardCover: baseColor = 'gray'; break;
      default: baseColor = 'white';
    }

    if (currentCharacter && isSelectingMoveTarget) {
      const isInPath = currentPath.some(p => p.x === position.x && p.y === position.y);
      if (isInPath) {
        return 'rgba(128, 128, 128, 0.5)'; // Gray for the path
      }
      const isValidMoveTarget = validMoveTargets.some(p => p.x === position.x && p.y === position.y);
      if (isValidMoveTarget) {
        return 'rgba(0, 255, 0, 0.3)'; // Light green for valid move targets
      }
    }

    // If we're placing a character and hovering over an empty cell, show a preview
    if (placingCharacter && hoveredCell && hoveredCell.x === position.x && hoveredCell.y === position.y && cellType === CellType.Empty) {
      return 'rgba(255, 165, 0, 0.3)'; // Light orange for character placement preview
    }

    return baseColor;
  };

  const getCharacterInitial = (position: Vector) => {
    const character = placedCharacters.find(pc => pc.position.x === position.x && pc.position.y === position.y);
    return character ? character.character.name[0].toUpperCase() : null;
  };

  return (
    <svg 
      width={map.width * cellSize} 
      height={map.height * cellSize}
      onMouseLeave={() => setHoveredCell(null)}
    >
      {map.cells.map((cell, index) => {
        const x = index % map.width;
        const y = Math.floor(index / map.width);
        const position = { x, y };
        const characterInitial = getCharacterInitial(position);
        const isHovered = hoveredCell && hoveredCell.x === x && hoveredCell.y === y;

        return (
          <g 
            key={index} 
            onClick={() => onCellClick && onCellClick(position)}
            onMouseEnter={() => setHoveredCell(position)}
          >
            <rect
              x={x * cellSize}
              y={y * cellSize}
              width={cellSize}
              height={cellSize}
              fill={getCellColor(cell, position)}
              stroke="black"
              strokeWidth="1"
            />
            {cell === CellType.PartialCover && (
              <foreignObject x={x * cellSize} y={y * cellSize} width={cellSize} height={cellSize}>
                <div className="w-full h-full flex items-center justify-center">
                  <Bed className="w-4 h-4 text-gray-500" />
                </div>
              </foreignObject>
            )}
            {cell === CellType.HardCover && (
              <foreignObject x={x * cellSize} y={y * cellSize} width={cellSize} height={cellSize}>
                <div className="w-full h-full flex items-center justify-center">
                  <BrickWall className="w-4 h-4 text-dark-green-500" />
                </div>
              </foreignObject>
            )}
            {characterInitial && (
              <text
                x={x * cellSize + cellSize / 2}
                y={y * cellSize + cellSize / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={cellSize * 0.8}
                fill="orange"
              >
                {characterInitial}
              </text>
            )}
            
            {/* Add this block for character placement preview */}
            {placingCharacter && isHovered && cell === CellType.Empty && (
              <foreignObject x={x * cellSize} y={y * cellSize} width={cellSize} height={cellSize}>
                <div className="w-full h-full flex items-center justify-center">
                  <Ghost className="w-4 h-4 text-orange-500" />
                </div>
              </foreignObject>
            )}
          </g>
        );
      })}
    </svg>
  );
}