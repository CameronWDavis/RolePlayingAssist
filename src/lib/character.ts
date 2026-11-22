// Character model, persistence and derived 5e stats.
import {
  ABILITIES,
  type Ability,
  type DndClass,
  type Equipment,
  type Race,
  type Subrace,
  backgrounds,
  classById,
  equipmentById,
  raceById,
  skills,
} from '../data';
import { load, save } from './storage';

export interface InventoryItem {
  key: string;
  /** SRD id when the item came from the compendium. */
  refId?: string;
  source: 'equipment' | 'magic' | 'custom';
  name: string;
  qty: number;
  notes?: string;
}

export interface Character {
  id: string;
  name: string;
  playerName: string;
  raceId: string;
  subraceId: string;
  classId: string;
  level: number;
  backgroundId: string;
  alignment: string;
  baseScores: Record<Ability, number>;
  /** Skill ids the character is proficient in. */
  skillProfs: string[];
  expertise: string[];
  hpCurrent: number;
  hpTemp: number;
  /** Extra max HP from feats, traits, etc. */
  hpBonus: number;
  hitDiceUsed: number;
  armorId: string;
  shield: boolean;
  acBonus: number;
  deathSaves: { success: number; fail: number };
  inspiration: boolean;
  conditions: string[];
  slotsUsed: number[];
  spells: string[];
  inventory: InventoryItem[];
  currency: { cp: number; sp: number; gp: number; pp: number };
  notes: string;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'grimoire.characters.v1';

export function newId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createCharacter(): Character {
  const now = Date.now();
  return {
    id: newId(),
    name: 'New Adventurer',
    playerName: '',
    raceId: 'human',
    subraceId: '',
    classId: 'fighter',
    level: 1,
    backgroundId: 'acolyte',
    alignment: 'Neutral Good',
    // Standard array, assigned in a sensible default order.
    baseScores: { str: 15, dex: 14, con: 13, int: 10, wis: 12, cha: 8 },
    skillProfs: [],
    expertise: [],
    hpCurrent: -1, // -1 = "full", resolved on first render
    hpTemp: 0,
    hpBonus: 0,
    hitDiceUsed: 0,
    armorId: '',
    shield: false,
    acBonus: 0,
    deathSaves: { success: 0, fail: 0 },
    inspiration: false,
    conditions: [],
    slotsUsed: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    spells: [],
    inventory: [],
    currency: { cp: 0, sp: 0, gp: 15, pp: 0 },
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
}

/** Fills in fields that older saved characters may be missing. */
function normalize(c: Partial<Character>): Character {
  const base = createCharacter();
  return {
    ...base,
    ...c,
    baseScores: { ...base.baseScores, ...c.baseScores },
    deathSaves: { ...base.deathSaves, ...c.deathSaves },
    currency: { ...base.currency, ...c.currency },
  } as Character;
}

export function loadCharacters(): Character[] {
  const list = load<Partial<Character>[]>(STORAGE_KEY, []);
  return Array.isArray(list) ? list.map(normalize) : [];
}

export function saveCharacters(list: Character[]): boolean {
  return save(STORAGE_KEY, list);
}

export function importCharacter(json: string): Character {
  const parsed = JSON.parse(json) as Partial<Character>;
  if (!parsed || typeof parsed !== 'object' || !parsed.name) throw new Error('Not a character file');
  return normalize({ ...parsed, id: newId(), updatedAt: Date.now() });
}

// ---------- Derived stats ----------

export const mod = (score: number) => Math.floor((score - 10) / 2);
export const fmtMod = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
export const profBonusFor = (level: number) => 2 + Math.floor((Math.max(1, level) - 1) / 4);

export interface Derived {
  race?: Race;
  subrace?: Subrace;
  cls?: DndClass;
  armor?: Equipment;
  scores: Record<Ability, number>;
  mods: Record<Ability, number>;
  prof: number;
  hpMax: number;
  ac: number;
  acNote: string;
  initiative: number;
  speed: number;
  saves: Record<Ability, { value: number; proficient: boolean }>;
  skills: { id: string; name: string; ability: Ability; value: number; prof: 0 | 1 | 2; fromBackground: boolean }[];
  passivePerception: number;
  spellSlots: number[];
  maxSpellLevel: number;
  spellAbility: Ability | null;
  spellDC: number | null;
  spellAttack: number | null;
}

export function derive(c: Character): Derived {
  const race = raceById.get(c.raceId);
  const subrace = race?.subraces.find((s) => s.id === c.subraceId);
  const cls = classById.get(c.classId);
  const armor = c.armorId ? equipmentById.get(c.armorId) : undefined;
  const level = Math.min(20, Math.max(1, c.level));

  const scores = {} as Record<Ability, number>;
  const mods = {} as Record<Ability, number>;
  for (const a of ABILITIES) {
    scores[a] = (c.baseScores[a] ?? 10) + (race?.abilityBonuses[a] ?? 0) + (subrace?.abilityBonuses[a] ?? 0);
    mods[a] = mod(scores[a]);
  }

  const prof = cls?.levels[level - 1]?.profBonus ?? profBonusFor(level);

  // Fixed HP per level: max hit die at 1st, then the average rounded up.
  const hd = cls?.hitDie ?? 8;
  const hpMax = Math.max(1, hd + mods.con + (level - 1) * (hd / 2 + 1 + mods.con) + c.hpBonus);

  // Armor class
  let ac: number;
  let acNote: string;
  if (armor?.armor) {
    const dex = armor.armor.dex ? (armor.armor.maxDex != null ? Math.min(mods.dex, armor.armor.maxDex) : mods.dex) : 0;
    ac = armor.armor.base + dex;
    acNote = armor.name;
  } else if (c.classId === 'barbarian') {
    ac = 10 + mods.dex + mods.con;
    acNote = 'Unarmored Defense (Dex + Con)';
  } else if (c.classId === 'monk' && !c.shield) {
    ac = 10 + mods.dex + mods.wis;
    acNote = 'Unarmored Defense (Dex + Wis)';
  } else {
    ac = 10 + mods.dex;
    acNote = 'Unarmored';
  }
  if (c.shield) {
    ac += 2;
    acNote += ' + Shield';
  }
  ac += c.acBonus;

  const saves = {} as Derived['saves'];
  for (const a of ABILITIES) {
    const proficient = !!cls?.savingThrows.includes(a);
    saves[a] = { value: mods[a] + (proficient ? prof : 0), proficient };
  }

  const bgSkills = backgrounds.find((b) => b.id === c.backgroundId)?.skills ?? [];
  const skillRows = skills.map((s) => {
    const fromBackground = bgSkills.includes(s.id);
    const p: 0 | 1 | 2 = c.expertise.includes(s.id) ? 2 : c.skillProfs.includes(s.id) || fromBackground ? 1 : 0;
    return { id: s.id, name: s.name, ability: s.ability, value: mods[s.ability] + prof * p, prof: p, fromBackground };
  });
  const perception = skillRows.find((s) => s.id === 'perception');

  const spellSlots = cls?.levels[level - 1]?.slots ?? [0, 0, 0, 0, 0, 0, 0, 0, 0];
  let maxSpellLevel = 0;
  spellSlots.forEach((n, i) => {
    if (n > 0) maxSpellLevel = i + 1;
  });
  const spellAbility = cls?.spellcastingAbility ?? null;

  return {
    race,
    subrace,
    cls,
    armor,
    scores,
    mods,
    prof,
    hpMax,
    ac,
    acNote,
    initiative: mods.dex,
    speed: race?.speed ?? 30,
    saves,
    skills: skillRows,
    passivePerception: 10 + (perception?.value ?? mods.wis),
    spellSlots,
    maxSpellLevel,
    spellAbility,
    spellDC: spellAbility ? 8 + prof + mods[spellAbility] : null,
    spellAttack: spellAbility ? prof + mods[spellAbility] : null,
  };
}

/** Is the character proficient with this weapon, based on their class's proficiency list? */
export function weaponProficient(cls: DndClass | undefined, weapon: Equipment): boolean {
  if (!cls || !weapon.weapon) return false;
  const profs = cls.proficiencies.map((p) => p.toLowerCase());
  if (profs.includes(`${weapon.weapon.category.toLowerCase()} weapons`)) return true;
  // Specific weapons are listed in plural ("Longswords", "Crossbows, light").
  const singular = (s: string) => s.replace(/s\b/g, '').replace(/[^a-z]/g, '');
  const name = singular(weapon.name.toLowerCase());
  return profs.some((p) => singular(p) === name);
}

export function weaponAttack(d: Derived, weapon: Equipment) {
  const w = weapon.weapon!;
  const useDex = w.range === 'Ranged' || (w.finesse && d.mods.dex > d.mods.str);
  const abilityMod = useDex ? d.mods.dex : d.mods.str;
  const proficient = weaponProficient(d.cls, weapon);
  const withMod = (dice: string) => (abilityMod === 0 ? dice : `${dice}${fmtMod(abilityMod)}`);
  return {
    toHit: abilityMod + (proficient ? d.prof : 0),
    damage: withMod(w.dice),
    versatile: w.versatile ? withMod(w.versatile) : null,
    type: w.type,
    proficient,
  };
}
