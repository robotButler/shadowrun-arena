'use client'

import React from 'react'
import { CharacterManagement } from './CharacterManagement'
import { Character } from '../lib/types'

interface CharacterTabProps {
  characters: Character[]
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>
  faction1: string[]
  setFaction1: React.Dispatch<React.SetStateAction<string[]>>
  faction2: string[]
  setFaction2: React.Dispatch<React.SetStateAction<string[]>>
  factionModifiers: Record<string, number>
  setFactionModifiers: React.Dispatch<React.SetStateAction<Record<string, number>>>
}

export function CharacterTab({
  characters,
  setCharacters,
  faction1,
  setFaction1,
  faction2,
  setFaction2,
  factionModifiers,
  setFactionModifiers
}: CharacterTabProps) {
  return (
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
  )
}