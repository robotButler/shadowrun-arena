import React, { useState } from 'react';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { PlusCircle, Trash2, Edit } from 'lucide-react'
import { Character, Weapon, Metatype, FireMode } from '../lib/types'
import { initialCharacter, initialWeapon, saveCharacter, deleteCharacter, addWeapon, removeWeapon } from '../lib/characterManagement'

interface CharacterManagementProps {
  characters: Character[];
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
  faction1: string[];
  setFaction1: React.Dispatch<React.SetStateAction<string[]>>;
  faction2: string[];
  setFaction2: React.Dispatch<React.SetStateAction<string[]>>;
  factionModifiers: Record<string, number>;
  setFactionModifiers: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}

export function CharacterManagement({
  characters,
  setCharacters,
  faction1,
  setFaction1,
  faction2,
  setFaction2,
  factionModifiers,
  setFactionModifiers
}: CharacterManagementProps) {
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [showWeaponForm, setShowWeaponForm] = useState(false);
  const [newWeapon, setNewWeapon] = useState<Weapon>(initialWeapon);

  const handleSaveCharacter = (character: Character) => {
    saveCharacter(character, characters, setCharacters, setEditingCharacter, setShowWeaponForm);
  };

  const handleDeleteCharacter = (id: string) => {
    deleteCharacter(id, characters, setCharacters, faction1, setFaction1, faction2, setFaction2, factionModifiers, setFactionModifiers);
  };

  const handleAddWeapon = () => {
    addWeapon(newWeapon, editingCharacter, setEditingCharacter, setNewWeapon, setShowWeaponForm);
  };

  const handleRemoveWeapon = (index: number) => {
    removeWeapon(index, editingCharacter, setEditingCharacter);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Character Management</CardTitle>
          <CardDescription>Create, edit, and delete your Shadowrun 5e characters.</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] w-full rounded-md border p-4">
            {characters.map(character => (
              <div key={character.id} className="flex items-center justify-between mb-2">
                <span>{character.name} - {character.metatype}</span>
                <div>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => {
                      setEditingCharacter(character)
                      setShowWeaponForm(false)
                    }} 
                    className="mr-2"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => handleDeleteCharacter(character.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </ScrollArea>
        </CardContent>
        <CardFooter>
          <Button onClick={() => {
            setEditingCharacter({
              ...initialCharacter,
              faction: '',
              current_initiative: 0,
              cumulative_recoil: 0,
              wound_modifier: 0,
              situational_modifiers: 0,
              physical_damage: 0,
              stun_damage: 0,
              is_conscious: true,
              is_alive: true,
              total_damage_dealt: 0,
              calculate_wound_modifier: () => 0,
              check_status: () => ['Conscious'],
            });
            setShowWeaponForm(false);
          }}>
            <PlusCircle className="mr-2 h-4 w-4" /> New Character
          </Button>
        </CardFooter>
      </Card>
      {editingCharacter && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>{editingCharacter.id ? 'Edit' : 'Create'} Character</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); handleSaveCharacter(editingCharacter); }}>
              <div className="grid w-full items-center gap-4">
                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={editingCharacter.name}
                    onChange={(e) => setEditingCharacter({ ...editingCharacter, name: e.target.value })}
                    required
                  />
                </div>
                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="metatype">Metatype</Label>
                  <Select
                    value={editingCharacter.metatype}
                    onValueChange={(value: Metatype) => setEditingCharacter({ ...editingCharacter, metatype: value })}
                  >
                    <SelectTrigger id="metatype">
                      <SelectValue placeholder="Select metatype" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Human">Human</SelectItem>
                      <SelectItem value="Elf">Elf</SelectItem>
                      <SelectItem value="Ork">Ork</SelectItem>
                      <SelectItem value="Dwarf">Dwarf</SelectItem>
                      <SelectItem value="Troll">Troll</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(editingCharacter.attributes).map(([attr, value]) => (
                    <div key={attr} className="flex flex-col space-y-1.5">
                      <Label htmlFor={attr}>{attr.charAt(0).toUpperCase() + attr.slice(1)}</Label>
                      <Input
                        id={attr}
                        type="number"
                        value={value}
                        onChange={(e) => setEditingCharacter({
                          ...editingCharacter,
                          attributes: { ...editingCharacter.attributes, [attr]: parseInt(e.target.value) }
                        })}
                      />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(editingCharacter.skills).map(([skill, value]) => (
                    <div key={skill} className="flex flex-col space-y-1.5">
                      <Label htmlFor={skill}>{skill.charAt(0).toUpperCase() + skill.slice(1)}</Label>
                      <Input
                        id={skill}
                        type="number"
                        value={value}
                        onChange={(e) => setEditingCharacter({
                          ...editingCharacter,
                          skills: { ...editingCharacter.skills, [skill]: parseInt(e.target.value) }
                        })}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="initiativeDice">Initiative Dice</Label>
                  <Input
                    id="initiativeDice"
                    type="number"
                    value={editingCharacter.initiativeDice}
                    onChange={(e) => setEditingCharacter({
                      ...editingCharacter,
                      initiativeDice: parseInt(e.target.value)
                    })}
                  />
                </div>
                <div className="flex flex-col space-y-1.5">
                  <Label>Weapons</Label>
                  {editingCharacter.weapons.map((weapon, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <span>
                        {weapon.name} - {weapon.damage} {weapon.damageType} ({weapon.type}) | 
                        AP: {weapon.ap} | RC: {weapon.recoilComp} | ACC: {weapon.accuracy} | 
                        {weapon.type === 'Ranged' ? `Ammo: ${weapon.ammoCount} | Modes: ${weapon.fireModes?.join(', ') ?? 'N/A'}` : `Reach: ${weapon.reach}`}
                      </span>
                      <Button type="button" variant="outline" size="sm" onClick={() => handleRemoveWeapon(index)}>Remove</Button>
                    </div>
                  ))}
                  {!showWeaponForm && (
                    <Button type="button" onClick={() => setShowWeaponForm(true)}>Add Weapon</Button>
                  )}
                  {showWeaponForm && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col space-y-1.5">
                        <Label htmlFor="weaponName">Weapon Name</Label>
                        <Input
                          id="weaponName"
                          value={newWeapon.name}
                          onChange={(e) => setNewWeapon({ ...newWeapon, name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="flex flex-col space-y-1.5">
                        <Label htmlFor="weaponDamage">Damage</Label>
                        <Input
                          id="weaponDamage"
                          type="number"
                          value={newWeapon.damage}
                          onChange={(e) => setNewWeapon({ ...newWeapon, damage: e.target.value ? parseInt(e.target.value) : 0 })}
                          required
                        />
                      </div>
                      <div className="flex flex-col space-y-1.5">
                        <Label htmlFor="weaponType">Type</Label>
                        <Select
                          value={newWeapon.type}
                          onValueChange={(value) => setNewWeapon({ ...newWeapon, type: value as 'Melee' | 'Ranged' })}
                        >
                          <SelectTrigger id="weaponType">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Melee">Melee</SelectItem>
                            <SelectItem value="Ranged">Ranged</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col space-y-1.5">
                        <Label htmlFor="damageType">Damage Type</Label>
                        <Select
                          value={newWeapon.damageType}
                          onValueChange={(value) => setNewWeapon({ ...newWeapon, damageType: value as 'P' | 'S' })}
                        >
                          <SelectTrigger id="damageType">
                            <SelectValue placeholder="Select damage type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="P">Physical (P)</SelectItem>
                            <SelectItem value="S">Stun (S)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col space-y-1.5">
                        <Label htmlFor="ap">AP</Label>
                        <Select
                          value={newWeapon.ap.toString()}
                          onValueChange={(value) => setNewWeapon({ ...newWeapon, ap: parseInt(value) })}
                        >
                          <SelectTrigger id="ap">
                            <SelectValue placeholder="Select AP" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 10 }, (_, i) => -i).map(value => (
                              <SelectItem key={value} value={value.toString()}>{value}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {newWeapon.type === 'Ranged' && (
                        <>
                          <div className="flex flex-col space-y-1.5">
                            <Label htmlFor="recoilComp">Recoil Comp</Label>
                            <Select
                              value={(newWeapon.recoilComp ?? 0).toString()}
                              onValueChange={(value) => setNewWeapon({ ...newWeapon, recoilComp: parseInt(value) })}
                            >
                              <SelectTrigger id="recoilComp">
                                <SelectValue placeholder="Select Recoil Comp" />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 16 }, (_, i) => i).map(value => (
                                  <SelectItem key={value} value={value.toString()}>{value}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex flex-col space-y-1.5">
                            <Label htmlFor="ammoCount">Ammo Count</Label>
                            <Input
                              id="ammoCount"
                              type="number"
                              value={newWeapon.ammoCount}
                              onChange={(e) => setNewWeapon({ ...newWeapon, ammoCount: parseInt(e.target.value) })}
                              min="1"
                              required
                            />
                          </div>
                        </>
                      )}
                      {newWeapon.type === 'Melee' && (
                        <div className="flex flex-col space-y-1.5">
                          <Label htmlFor="reach">Reach</Label>
                          <Select
                            value={newWeapon.reach?.toString() ?? ''}
                            onValueChange={(value) => setNewWeapon({ ...newWeapon, reach: parseInt(value) })}
                          >
                            <SelectTrigger id="reach">
                              <SelectValue placeholder="Select Reach" />
                            </SelectTrigger>
                            <SelectContent>
                              {[1, 2, 3].map(value => (
                                <SelectItem key={value} value={value.toString()}>{value}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="flex flex-col space-y-1.5">
                        <Label htmlFor="accuracy">Accuracy</Label>
                        <Select
                          value={newWeapon.accuracy.toString()}
                          onValueChange={(value) => setNewWeapon({ ...newWeapon, accuracy: parseInt(value) })}
                        >
                          <SelectTrigger id="accuracy">
                            <SelectValue placeholder="Select Accuracy" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 16 }, (_, i) => i).map(value => (
                              <SelectItem key={value} value={value.toString()}>{value}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {newWeapon.type === 'Ranged' && (
                        <div className="flex flex-col space-y-1.5">
                          <Label>Fire Modes</Label>
                          <div className="flex space-x-2">
                            {(['SS', 'SA', 'BF', 'FA'] as FireMode[]).map(mode => (
                              <label key={mode} className="flex items-center space-x-2">
                                <Checkbox
                                  checked={newWeapon.fireModes?.includes(mode) ?? false}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setNewWeapon({ ...newWeapon, fireModes: [...(newWeapon.fireModes ?? []), mode] })
                                    } else {
                                      setNewWeapon({ ...newWeapon, fireModes: (newWeapon.fireModes ?? []).filter(m => m !== mode) })
                                    }
                                  }}
                                />
                                <span>{mode}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      <Button type="button" onClick={handleAddWeapon}>Save Weapon</Button>
                    </div>
                  )}
                </div>
              </div>
              <Button type="submit" className="mt-4">Save Character</Button>
            </form>
          </CardContent>
        </Card>
      )}
    </>
  );
}