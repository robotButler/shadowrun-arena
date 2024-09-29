import React, { useState } from 'react';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChevronDown, ChevronUp } from 'lucide-react'
import { ActionLogEntryProps, SimulationResultProps, FactionSelectorProps, Character, MatchResult } from '../lib/types'

export const ActionLogEntry: React.FC<{ summary: string; details: string[] }> = ({ summary, details }) => (
  <div className="mb-4">
    <p className="font-semibold">{summary}</p>
    {details.map((detail, index) => (
      <p key={index} className="ml-4">{detail}</p>
    ))}
  </div>
);

export const SimulationResult = ({ result, index }: SimulationResultProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedRound, setExpandedRound] = useState<number | null>(null);

  return (
    <div className="mb-4">
      <Button
        variant="ghost"
        className="w-full justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span>Simulation {index + 1}: {result.winner} won in {result.rounds} rounds</span>
        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </Button>
      {isExpanded && (
        <div className="mt-2 pl-4">
          {result.roundResults.map((round, roundIndex) => (
            <div key={roundIndex} className="mb-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between"
                onClick={() => setExpandedRound(expandedRound === roundIndex ? null : roundIndex)}
              >
                <span>Round {roundIndex + 1} - {round.actingCharacter} (Initiative Phase: {round.initiativePhase})</span>
                {expandedRound === roundIndex ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
              {expandedRound === roundIndex && (
                <div className="mt-1 pl-4 text-sm">
                  {round.messages.map((message, messageIndex) => (
                    <p key={messageIndex}>{message}</p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const FactionSelector = ({ 
  faction, 
  characters, 
  factionMembers, 
  factionModifiers, 
  onAddToFaction, 
  onRemoveFromFaction, 
  onModifierChange 
}: FactionSelectorProps) => (
  <div>
    <h3 className="mb-2 font-semibold">Faction {faction === 'faction1' ? '1' : '2'}</h3>
    <ScrollArea className="h-[200px] w-full rounded-md border p-4">
      {characters.map(character => (
        <div 
          key={character.id} 
          className={`flex items-center justify-between mb-2 p-2 rounded ${
            factionMembers.includes(character.id) 
              ? 'bg-green-100' 
              : ''
          }`}
        >
          <span>{character.name}</span>
          {factionMembers.includes(character.id) ? (
            <div className="flex items-center space-x-2">
              <Label htmlFor={`modifier-${character.id}`} className="mr-2">Situational Modifier:</Label>
              <Select
                value={factionModifiers[character.id]?.toString() || '0'}
                onValueChange={(value) => onModifierChange(character.id, parseInt(value))}
              >
                <SelectTrigger className="w-[100px]" id={`modifier-${character.id}`}>
                  <SelectValue placeholder="Modifier" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 19 }, (_, i) => i - 9).map(value => (
                    <SelectItem key={value} value={value.toString()}>{value > 0 ? `+${value}` : value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => onRemoveFromFaction(character.id, faction)}>
                Remove
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => onAddToFaction(character.id, faction)}>
              Add
            </Button>
          )}
        </div>
      ))}
    </ScrollArea>
  </div>
);