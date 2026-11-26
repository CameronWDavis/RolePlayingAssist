// The large SRD lists. Imported only by pages that need them (compendium, character
// sheet, homebrew editor), which are loaded on demand, so the home page stays light.
import magicItemsJson from './magicItems.json';
import monstersJson from './monsters.json';
import spellsJson from './spells.json';
import { type MagicItem, type Monster, type Spell, byId } from './index';

export const spells = spellsJson as Spell[];
export const monsters = monstersJson as Monster[];
export const magicItems = magicItemsJson as MagicItem[];

export const spellById = byId(spells);
export const magicItemById = byId(magicItems);
