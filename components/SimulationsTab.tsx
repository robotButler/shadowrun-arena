'use client'

import React, { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Play } from 'lucide-react'
import { Character, MatchResult } from '../lib/types'
import { FactionSelector, SimulationResult } from './MiscComponents'
import {
  runSingleSimulation,
  calculateRoundWins
} from '../lib/combatSimulation'

export function SimulationsTab({
  characters,
  faction1,
  faction2,
  factionModifiers,
  handleAddToFaction,
  handleRemoveFromFaction
}: {
  characters: Character[]
  faction1: string[]
  faction2: string[]
  factionModifiers: Record<string, number>
  handleAddToFaction: (characterId: string, faction: 'faction1' | 'faction2') => void
  handleRemoveFromFaction: (characterId: string, faction: 'faction1' | 'faction2') => void
}) {
  const [combatResults, setCombatResults] = useState<MatchResult[]>([])
  const [simulations, setSimulations] = useState<number>(100)
  const [simulationInitialDistance, setSimulationInitialDistance] = useState(10)

  const runSimulations = () => {
    const results: MatchResult[] = []

    for (let i = 0; i < simulations; i++) {
      const simulationResult = runSingleSimulation(faction1, faction2, characters, factionModifiers, simulationInitialDistance)
      results.push(simulationResult)
    }

    setCombatResults(results)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Combat Simulations</CardTitle>
          <CardDescription>Run multiple combat simulations and view the results.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <FactionSelector
              faction="faction1"
              characters={characters}
              factionMembers={faction1}
              factionModifiers={factionModifiers}
              onAddToFaction={handleAddToFaction}
              onRemoveFromFaction={handleRemoveFromFaction}
              onModifierChange={(characterId, value) => {/* Handle modifier change */}}
            />
            <FactionSelector
              faction="faction2"
              characters={characters}
              factionMembers={faction2}
              factionModifiers={factionModifiers}
              onAddToFaction={handleAddToFaction}
              onRemoveFromFaction={handleRemoveFromFaction}
              onModifierChange={(characterId, value) => {/* Handle modifier change */}}
            />
          </div>
          <div className="flex items-center space-x-2 mb-4">
            <Label htmlFor="simulationInitialDistance">Initial Distance (meters):</Label>
            <Input
              id="simulationInitialDistance"
              type="number"
              value={simulationInitialDistance}
              onChange={(e) => setSimulationInitialDistance(parseInt(e.target.value))}
              className="w-20"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Label htmlFor="simulations">Number of Simulations:</Label>
            <Input
              id="simulations"
              type="number"
              value={simulations}
              onChange={(e) => setSimulations(parseInt(e.target.value))}
              className="w-20"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={runSimulations} disabled={faction1.length === 0 || faction2.length === 0}>
            <Play className="mr-2 h-4 w-4" /> Run Simulations
          </Button>
        </CardFooter>
      </Card>
      {combatResults.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Simulation Results</CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const roundWins = calculateRoundWins(combatResults);
              const totalSimulations = combatResults.length;
              const overallWinner = roundWins['Faction 1'] > roundWins['Faction 2'] ? 'Faction 1' : 'Faction 2';
              return (
                <>
                  <p>Overall Winner: {overallWinner}</p>
                  <p>Total Simulations: {totalSimulations}</p>
                  <p>Rounds Won by Faction 1: {roundWins['Faction 1']} ({((roundWins['Faction 1'] / totalSimulations) * 100).toFixed(2)}%)</p>
                  <p>Rounds Won by Faction 2: {roundWins['Faction 2']} ({((roundWins['Faction 2'] / totalSimulations) * 100).toFixed(2)}%)</p>
                  {roundWins['Draw'] > 0 && <p>Draws: {roundWins['Draw']} ({((roundWins['Draw'] / totalSimulations) * 100).toFixed(2)}%)</p>}
                </>
              );
            })()}
            <ScrollArea className="h-[300px] w-full mt-4">
              {combatResults.map((result, index) => (
                <SimulationResult key={index} result={result} index={index} />
              ))}
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </>
  )
}