// Homebrew content: types, blank templates, persistence and shareable "packs".
import type { HomebrewSubclass, MagicItem, Monster, NamedBlock, Spell } from '../data';
import { load, save } from './storage';

export type HomebrewKind = 'spells' | 'magicItems' | 'monsters' | 'subclasses';

export interface HomebrewData {
  spells: Spell[];
  magicItems: MagicItem[];
  monsters: Monster[];
  subclasses: HomebrewSubclass[];
}

export interface HomebrewPack extends HomebrewData {
  format: 'grimoire-homebrew';
  version: 1;
  name?: string;
  exportedAt: string;
}

export const KIND_LABELS: Record<HomebrewKind, { one: string; many: string }> = {
  spells: { one: 'Spell', many: 'Spells' },
  magicItems: { one: 'Magic Item', many: 'Magic Items' },
  monsters: { one: 'Monster', many: 'Monsters' },
  subclasses: { one: 'Subclass', many: 'Subclasses' },
};
export const KINDS = Object.keys(KIND_LABELS) as HomebrewKind[];

const STORAGE_KEY = 'grimoire.homebrew.v1';

export const emptyHomebrew = (): HomebrewData => ({ spells: [], magicItems: [], monsters: [], subclasses: [] });

export const homebrewId = () =>
  `hb-${crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)}`;

// ---------- Reference lists used by the editors ----------

export const SPELL_SCHOOLS = [
  'Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation',
];
export const ITEM_CATEGORIES = ['Armor', 'Potion', 'Ring', 'Rod', 'Scroll', 'Staff', 'Wand', 'Weapon', 'Wondrous Items'];
export const RARITIES = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact'];
export const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
export const CREATURE_TYPES = [
  'aberration', 'beast', 'celestial', 'construct', 'dragon', 'elemental', 'fey', 'fiend', 'giant', 'humanoid',
  'monstrosity', 'ooze', 'plant', 'undead',
];

/** Challenge rating → XP, from the SRD's experience table. */
export const CR_XP: [number, string, number][] = [
  [0, '0', 10], [0.125, '1/8', 25], [0.25, '1/4', 50], [0.5, '1/2', 100],
  [1, '1', 200], [2, '2', 450], [3, '3', 700], [4, '4', 1100], [5, '5', 1800],
  [6, '6', 2300], [7, '7', 2900], [8, '8', 3900], [9, '9', 5000], [10, '10', 5900],
  [11, '11', 7200], [12, '12', 8400], [13, '13', 10000], [14, '14', 11500], [15, '15', 13000],
  [16, '16', 15000], [17, '17', 18000], [18, '18', 20000], [19, '19', 22000], [20, '20', 25000],
  [21, '21', 33000], [22, '22', 41000], [23, '23', 50000], [24, '24', 62000], [25, '25', 75000],
  [26, '26', 90000], [27, '27', 105000], [28, '28', 120000], [29, '29', 135000], [30, '30', 155000],
];

export const itemSubtitle = (m: Pick<MagicItem, 'category' | 'rarity' | 'attunement'>) => {
  const type = m.category === 'Wondrous Items' ? 'Wondrous item' : m.category;
  return `${type}, ${m.rarity.toLowerCase()}${m.attunement ? ' (requires attunement)' : ''}`;
};

// ---------- Blank templates ----------

export const blankSpell = (): Spell => ({
  id: homebrewId(),
  name: '',
  level: 1,
  school: 'Evocation',
  castingTime: '1 action',
  range: '60 feet',
  components: 'V, S',
  duration: 'Instantaneous',
  concentration: false,
  ritual: false,
  classes: [],
  desc: '',
  higherLevel: '',
  homebrew: true,
});

export const blankMagicItem = (): MagicItem => ({
  id: homebrewId(),
  name: '',
  category: 'Wondrous Items',
  rarity: 'Uncommon',
  attunement: false,
  subtitle: 'Wondrous item, uncommon',
  desc: '',
  homebrew: true,
});

export const blankMonster = (): Monster => ({
  id: homebrewId(),
  name: '',
  size: 'Medium',
  type: 'monstrosity',
  subtype: '',
  alignment: 'unaligned',
  ac: 12,
  acType: 'natural armor',
  hp: 22,
  hitDice: '4d8+4',
  speed: '30 ft.',
  abilities: [12, 12, 12, 8, 10, 8],
  saves: [],
  skills: [],
  vulnerabilities: [],
  resistances: [],
  immunities: [],
  conditionImmunities: [],
  senses: 'passive Perception 10',
  languages: '—',
  cr: 1,
  crLabel: '1',
  xp: 200,
  traits: [],
  actions: [{ name: 'Claw', desc: 'Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 4 (1d6 + 1) slashing damage.' }],
  reactions: [],
  legendary: [],
  homebrew: true,
});

export const blankSubclass = (classId = 'fighter', flavor = ''): HomebrewSubclass => ({
  id: homebrewId(),
  classId,
  name: '',
  flavor,
  desc: '',
  features: [{ name: '', level: 3, desc: '' }],
  homebrew: true,
});

// ---------- Validation / normalisation (used for storage and imports) ----------

const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
const num = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const strList = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const blocks = (v: unknown): NamedBlock[] =>
  Array.isArray(v) ? v.filter((b) => b && typeof b === 'object').map((b) => ({ name: str(b.name), desc: str(b.desc) })) : [];
const validId = (v: unknown) => (typeof v === 'string' && /^hb-[\w-]{1,40}$/.test(v) ? v : homebrewId());

type Loose = Record<string, unknown>;
const objects = (v: unknown): Loose[] => (Array.isArray(v) ? v.filter((x): x is Loose => !!x && typeof x === 'object') : []);

function cleanSpell(o: Loose): Spell {
  const b = blankSpell();
  return {
    ...b,
    id: validId(o.id),
    name: str(o.name),
    level: Math.min(9, Math.max(0, Math.round(num(o.level, 1)))),
    school: str(o.school, b.school),
    castingTime: str(o.castingTime, b.castingTime),
    range: str(o.range, b.range),
    components: str(o.components, b.components),
    duration: str(o.duration, b.duration),
    concentration: !!o.concentration,
    ritual: !!o.ritual,
    classes: strList(o.classes),
    desc: str(o.desc),
    higherLevel: str(o.higherLevel),
  };
}

function cleanItem(o: Loose): MagicItem {
  const b = blankMagicItem();
  const item = {
    ...b,
    id: validId(o.id),
    name: str(o.name),
    category: str(o.category, b.category),
    rarity: str(o.rarity, b.rarity),
    attunement: !!o.attunement,
    desc: str(o.desc),
  };
  return { ...item, subtitle: itemSubtitle(item) };
}

function cleanMonster(o: Loose): Monster {
  const b = blankMonster();
  const cr = num(o.cr, b.cr);
  const row = CR_XP.find(([v]) => v === cr) ?? CR_XP[4];
  const abilities = Array.isArray(o.abilities) && o.abilities.length === 6 ? o.abilities.map((a) => Math.min(30, Math.max(1, num(a, 10)))) : b.abilities;
  return {
    ...b,
    id: validId(o.id),
    name: str(o.name),
    size: str(o.size, b.size),
    type: str(o.type, b.type),
    subtype: str(o.subtype),
    alignment: str(o.alignment, b.alignment),
    ac: num(o.ac, b.ac),
    acType: str(o.acType),
    hp: num(o.hp, b.hp),
    hitDice: str(o.hitDice, b.hitDice),
    speed: str(o.speed, b.speed),
    abilities,
    saves: strList(o.saves),
    skills: strList(o.skills),
    vulnerabilities: strList(o.vulnerabilities),
    resistances: strList(o.resistances),
    immunities: strList(o.immunities),
    conditionImmunities: strList(o.conditionImmunities),
    senses: str(o.senses, b.senses),
    languages: str(o.languages, b.languages),
    cr: row[0],
    crLabel: row[1],
    xp: row[2],
    traits: blocks(o.traits),
    actions: blocks(o.actions),
    reactions: blocks(o.reactions),
    legendary: blocks(o.legendary),
  };
}

function cleanSubclass(o: Loose): HomebrewSubclass {
  return {
    ...blankSubclass(),
    id: validId(o.id),
    classId: str(o.classId, 'fighter'),
    name: str(o.name),
    flavor: str(o.flavor),
    desc: str(o.desc),
    features: objects(o.features).map((f) => ({ name: str(f.name), level: Math.min(20, Math.max(1, num(f.level, 1))), desc: str(f.desc) })),
  };
}

export function cleanHomebrew(raw: unknown): HomebrewData {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Loose;
  const named = <T extends { name: string }>(list: T[]) => list.filter((x) => x.name.trim());
  return {
    spells: named(objects(o.spells).map(cleanSpell)),
    magicItems: named(objects(o.magicItems).map(cleanItem)),
    monsters: named(objects(o.monsters).map(cleanMonster)),
    subclasses: named(objects(o.subclasses).map(cleanSubclass)),
  };
}

export const loadHomebrew = (): HomebrewData => cleanHomebrew(load<unknown>(STORAGE_KEY, {}));
export const saveHomebrew = (data: HomebrewData) => save(STORAGE_KEY, data);
export const HOMEBREW_STORAGE_KEY = STORAGE_KEY;

// ---------- Packs ----------

export function makePack(data: HomebrewData, name?: string): HomebrewPack {
  return { format: 'grimoire-homebrew', version: 1, name, exportedAt: new Date().toISOString(), ...data };
}

export function parsePack(json: string): HomebrewData {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  if (!raw || typeof raw !== 'object' || (raw as Loose).format !== 'grimoire-homebrew') {
    throw new Error("That file isn't a Grimoire homebrew pack.");
  }
  const data = cleanHomebrew(raw);
  if (!KINDS.some((k) => data[k].length)) throw new Error('That pack is empty.');
  return data;
}

export function countHomebrew(data: HomebrewData) {
  return KINDS.reduce((n, k) => n + data[k].length, 0);
}

/** The homebrew entries a character references, for bundling into a character export. */
export function homebrewUsedBy(
  c: { subclassId: string; spells: string[]; inventory: { source: string; refId?: string }[] },
  data: HomebrewData,
): HomebrewData {
  const itemIds = new Set(c.inventory.filter((i) => i.source === 'magic' && i.refId).map((i) => i.refId));
  return {
    spells: data.spells.filter((s) => c.spells.includes(s.id)),
    magicItems: data.magicItems.filter((m) => itemIds.has(m.id)),
    monsters: [],
    subclasses: data.subclasses.filter((s) => s.id === c.subclassId),
  };
}
