import React from 'react'
import { GameMap, TileType } from '../lib/map'
import { Shield, BrickWall } from 'lucide-react'

interface MapDisplayProps {
  map: GameMap
}

export const MapDisplay: React.FC<MapDisplayProps> = ({ map }) => {
  return (
    <div className="grid" style={{ gridTemplateColumns: `repeat(${map.size.x}, 1fr)` }}>
      {map.tiles.flat().map((cell, index) => (
        <div
          key={index}
          className="w-6 h-6 border border-gray-300 flex items-center justify-center"
        >
          {cell.type === TileType.PartialCover && <Shield className="w-4 h-4 text-yellow-500" />}
          {cell.type === TileType.HardCover && <BrickWall className="w-4 h-4 text-red-500" />}
        </div>
      ))}
    </div>
  )
}
