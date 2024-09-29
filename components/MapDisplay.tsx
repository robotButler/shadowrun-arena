import React from 'react';
import { GameMap, Vector } from '../lib/map';
import { Character } from '../lib/types';

interface MapDisplayProps {
  map: GameMap;
  onCellClick?: (position: Vector) => void;
  placedCharacters: Array<{character: Character, position: Vector}>;
}

export const MapDisplay: React.FC<MapDisplayProps> = ({ map, onCellClick, placedCharacters }) => {
  const getCharacterInitial = (character: Character) => {
    const initial = character.name[0].toUpperCase();
    const sameInitialCount = placedCharacters.filter(pc => pc.character.name[0].toUpperCase() === initial).length;
    return sameInitialCount > 1 ? `${initial}${sameInitialCount}` : initial;
  };

  if (!map || !map.width || !map.height || !map.cells) {
    return <div>Invalid map data</div>;
  }

  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${map.width}, 1fr)` }}>
      {Array.from({ length: map.height }, (_, y) =>
        Array.from({ length: map.width }, (_, x) => {
          const cellIndex = y * map.width + x;
          const cell = map.cells[cellIndex];
          const placedCharacter = placedCharacters.find(pc => pc.position.x === x && pc.position.y === y);
          return (
            <div
              key={`${x}-${y}`}
              className={`w-8 h-8 flex items-center justify-center cursor-pointer ${
                cell === 1 ? 'bg-gray-300' : cell === 2 ? 'bg-gray-500' : 'bg-white'
              } border border-gray-400`}
              onClick={() => onCellClick && onCellClick({ x, y })}
            >
              {placedCharacter && getCharacterInitial(placedCharacter.character)}
            </div>
          );
        })
      )}
    </div>
  );
};
