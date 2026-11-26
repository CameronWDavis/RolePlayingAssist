// SRD + homebrew spells and magic items, merged. Pulls in the big SRD lists, so only
// on-demand pages (character sheet, compendium, homebrew) should use it.
import { useMemo } from 'react';
import type { MagicItem, Spell } from '../data';
import { magicItemById, magicItems, spellById, spells } from '../data/library';
import { useHomebrew } from './HomebrewStore';

export function useLibrary() {
  const { data } = useHomebrew();
  return useMemo(() => {
    const hbSpells = new Map(data.spells.map((s) => [s.id, s]));
    const hbItems = new Map(data.magicItems.map((m) => [m.id, m]));
    return {
      allSpells: [...spells, ...data.spells] as Spell[],
      allMagicItems: [...magicItems, ...data.magicItems] as MagicItem[],
      getSpell: (id: string): Spell | undefined => spellById.get(id) ?? hbSpells.get(id),
      getMagicItem: (id: string): MagicItem | undefined => magicItemById.get(id) ?? hbItems.get(id),
    };
  }, [data.spells, data.magicItems]);
}
