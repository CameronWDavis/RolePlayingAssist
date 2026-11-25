// Character model, persistence and derived 5e stats.
import {
  ABILITIES,
  type Ability,
  type DndClass,
  type Equipment,
  type HomebrewSubclass,
  type Race,
  type Subclass,
  type Subrace,
  backgrounds,
  classById,
  equipmentById,
  raceById,
  skills,
} from '../data';
import { type HomebrewData, cleanHomebrew, countHomebrew, homebrewUsedBy } from './homebrew';
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
  /** '' = none chosen, 'srd' = the class's SRD subclass, otherwise a homebrew subclass id. */
  subclassId: string;
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
    subclassId: '',
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

// ---------- Validation ----------
// Saved and imported characters are checked field by field, so a hand-edited or
// corrupted file falls back to sensible defaults instead of crashing the sheet.

type Loose = Record<string, unknown>;
const isObj = (v: unknown): v is Loose => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback);
const int = (v: unknown, fallback: number, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
const strList = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

function cleanInventory(v: unknown): InventoryItem[] {
  if (!Array.isArray(v)) return [];
  return v.filter(isObj).flatMap((i) => {
    const name = str(i.name, '').trim();
    if (!name) return [];
    const source = i.source === 'equipment' || i.source === 'magic' ? i.source : 'custom';
    return [
      {
        key: str(i.key, newId()),
        refId: typeof i.refId === 'string' ? i.refId : undefined,
        source,
        name,
        qty: int(i.qty, 1, 1, 9999),
        notes: typeof i.notes === 'string' ? i.notes : undefined,
      },
    ];
  });
}

/** Turns anything that looks roughly like a character into a valid Character. */
function normalize(raw: unknown): Character {
  const base = createCharacter();
  const c = isObj(raw) ? raw : {};
  const scores = isObj(c.baseScores) ? c.baseScores : {};
  const ds = isObj(c.deathSaves) ? c.deathSaves : {};
  const coins = isObj(c.currency) ? c.currency : {};
  const raceId = str(c.raceId, base.raceId);
  const classId = str(c.classId, base.classId);
  const slots = Array.isArray(c.slotsUsed) ? c.slotsUsed : [];
  const level = int(c.level, 1, 1, 20);
  return {
    id: str(c.id, base.id),
    name: str(c.name, base.name),
    playerName: str(c.playerName, ''),
    raceId: raceById.has(raceId) ? raceId : base.raceId,
    subraceId: str(c.subraceId, ''),
    classId: classById.has(classId) ? classId : base.classId,
    // Characters saved before subclasses were selectable showed the SRD one once they reached
    // the level that grants it, so files without the field keep that behaviour.
    subclassId: str(
      c.subclassId,
      c.subclassId === undefined && level >= (classById.get(classId)?.subclasses[0]?.features[0]?.level ?? 99) ? 'srd' : '',
    ),
    level,
    backgroundId: str(c.backgroundId, ''),
    alignment: str(c.alignment, base.alignment),
    baseScores: Object.fromEntries(ABILITIES.map((a) => [a, int(scores[a], base.baseScores[a], 1, 30)])) as Record<Ability, number>,
    skillProfs: strList(c.skillProfs),
    expertise: strList(c.expertise),
    hpCurrent: int(c.hpCurrent, -1, -1, 9999),
    hpTemp: int(c.hpTemp, 0, 0, 9999),
    hpBonus: int(c.hpBonus, 0, -999, 999),
    hitDiceUsed: int(c.hitDiceUsed, 0, 0, level),
    armorId: str(c.armorId, ''),
    shield: c.shield === true,
    acBonus: int(c.acBonus, 0, -99, 99),
    deathSaves: { success: int(ds.success, 0, 0, 3), fail: int(ds.fail, 0, 0, 3) },
    inspiration: c.inspiration === true,
    conditions: strList(c.conditions),
    slotsUsed: Array.from({ length: 9 }, (_, i) => int(slots[i], 0, 0, 99)),
    spells: strList(c.spells),
    inventory: cleanInventory(c.inventory),
    currency: {
      cp: int(coins.cp, 0, 0, 1e9),
      sp: int(coins.sp, 0, 0, 1e9),
      gp: int(coins.gp, 0, 0, 1e9),
      pp: int(coins.pp, 0, 0, 1e9),
    },
    notes: str(c.notes, ''),
    createdAt: int(c.createdAt, base.createdAt, 0, Number.MAX_SAFE_INTEGER),
    updatedAt: int(c.updatedAt, base.updatedAt, 0, Number.MAX_SAFE_INTEGER),
  };
}

export function loadCharacters(): Character[] {
  const list = load<unknown>(STORAGE_KEY, []);
  return Array.isArray(list) ? list.filter(isObj).map(normalize) : [];
}

export function saveCharacters(list: Character[]): boolean {
  return save(STORAGE_KEY, list);
}

/**
 * A character export file: the character's own fields at the top level (so older exports still
 * import), plus the homebrew it uses so a friend's copy isn't missing its subclass, spells or items.
 */
export type CharacterFile = Character & { format: 'grimoire-character'; homebrew?: HomebrewData };

export function makeCharacterFile(c: Character, homebrew: HomebrewData): CharacterFile {
  const used = homebrewUsedBy(c, homebrew);
  return { format: 'grimoire-character', ...c, ...(countHomebrew(used) ? { homebrew: used } : {}) };
}

export function importCharacter(json: string): { character: Character; homebrew: HomebrewData } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  if (!isObj(parsed) || typeof parsed.name !== 'string' || (parsed.classId === undefined && parsed.raceId === undefined)) {
    throw new Error("That file doesn't look like a Grimoire character export.");
  }
  return {
    character: normalize({ ...parsed, id: newId(), updatedAt: Date.now() }),
    homebrew: cleanHomebrew(parsed.homebrew),
  };
}

// ---------- Derived stats ----------

export const mod = (score: number) => Math.floor((score - 10) / 2);
export const fmtMod = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
export const profBonusFor = (level: number) => 2 + Math.floor((Math.max(1, level) - 1) / 4);

export interface Derived {
  race?: Race;
  subrace?: Subrace;
  cls?: DndClass;
  subclass?: Subclass & { homebrew?: boolean };
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

export function derive(c: Character, homebrewSubclasses: HomebrewSubclass[] = []): Derived {
  const race = raceById.get(c.raceId);
  const subrace = race?.subraces.find((s) => s.id === c.subraceId);
  const cls = classById.get(c.classId);
  const subclass =
    c.subclassId === 'srd'
      ? cls?.subclasses[0]
      : homebrewSubclasses.find((s) => s.id === c.subclassId && s.classId === c.classId);
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
    subclass,
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
  // Specific weapons are listed in plural and sometimes in a different word order than the
  // equipment name ("Hand crossbows" vs "Crossbow, hand"), so compare the sorted singular words.
  const key = (s: string) =>
    s
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter(Boolean)
      .map((w) => w.replace(/s$/, ''))
      .sort()
      .join(' ');
  const name = key(weapon.name);
  return profs.some((p) => key(p) === name);
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
