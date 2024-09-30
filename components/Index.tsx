'use client'

import React from 'react';
import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { Character } from '../lib/types'
import {
  addToFaction,
  removeFromFaction
} from '@/lib/characterManagement'
import { CharacterManagement } from './CharacterManagement'
import { CombatTab } from './CombatTab'
import { SimulationsTab } from './SimulationsTab'

export function ShadowrunArena() {
  const [characters, setCharacters] = useState<Character[]>([])
  const [faction1, setFaction1] = useState<string[]>([])
  const [faction2, setFaction2] = useState<string[]>([])
  const [factionModifiers, setFactionModifiers] = useState<Record<string, number>>({})

  // Load characters from localStorage only once when the component mounts
  useEffect(() => {
    const storedCharacters = localStorage.getItem('shadowrunCharacters')
    if (storedCharacters) {
      setCharacters(JSON.parse(storedCharacters))
    }
  }, [])

  // Save characters to localStorage whenever the characters state changes
  useEffect(() => {
    // Only save if characters is not empty
    if (characters.length > 0) {
      localStorage.setItem('shadowrunCharacters', JSON.stringify(characters))
    }
  }, [characters])

  useEffect(() => {
    console.log("Faction states updated:", { faction1, faction2 });
  }, [faction1, faction2])

  const handleAddToFaction = (characterId: string, faction: 'faction1' | 'faction2') => {
    addToFaction(characterId, faction, faction1, setFaction1, faction2, setFaction2, setFactionModifiers);
  };

  const handleRemoveFromFaction = (characterId: string, faction: 'faction1' | 'faction2') => {
    removeFromFaction(characterId, faction, setFaction1, setFaction2, setFactionModifiers);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-center mb-6">Shadowrun 5e Arena</h1>
      <Tabs defaultValue="characters">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          {["characters", "combat", "simulations"].map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="py-2 px-4 text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-muted"
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="characters">
          <CharacterManagement
            characters={characters}
            setCharacters={setCharacters}
            faction1={faction1}
            setFaction1={setFaction1}
            faction2={faction2}
            setFaction2={setFaction2}
            factionModifiers={factionModifiers}
            setFactionModifiers={setFactionModifiers}
          />
        </TabsContent>
        <TabsContent value="combat">
          <CombatTab
            characters={characters}
            faction1={faction1}
            faction2={faction2}
            factionModifiers={factionModifiers}
            handleAddToFaction={handleAddToFaction}
            handleRemoveFromFaction={handleRemoveFromFaction}
          />
        </TabsContent>
        <TabsContent value="simulations">
          <SimulationsTab
            characters={characters}
            faction1={faction1}
            faction2={faction2}
            factionModifiers={factionModifiers}
            handleAddToFaction={handleAddToFaction}
            handleRemoveFromFaction={handleRemoveFromFaction}
          />
        </TabsContent>
      </Tabs>
      <ToastContainer position="bottom-right" />
    </div>
  )
}