// Homebrew content: types, blank templates, persistence and shareable "packs".
import {
  ABILITIES,
  type Ability,
  type Background,
  type Feat,
  type HomebrewSubclass,
  type MagicItem,
  type Monster,
  type NamedBlock,
  type Race,
  type Spell,
  type Subrace,
  skillById,
} from '../data';
import { load, save } from './storage';

export type HomebrewKind = 'spells' | 'magicItems' | 'monsters' | 'subclasses' | 'races' | 'backgrounds' | 'feats';

export interface HomebrewData {
  spells: Spell[];
  magicItems: MagicItem[];
  monsters: Monster[];
  subclasses: HomebrewSubclass[];
  races: Race[];
  backgrounds: Background[];
  feats: Feat[];
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
  races: { one: 'Race', many: 'Races' },
  backgrounds: { one: 'Background', many: 'Backgrounds' },
  feats: { one: 'Feat', many: 'Feats' },
};
export const KINDS = Object.keys(KIND_LABELS) as HomebrewKind[];

/** URL slug ↔ storage key. Slugs match the compendium's so links feel consistent. */
export const KIND_SLUGS: Record<string, HomebrewKind> = {
  spells: 'spells',
  'magic-items': 'magicItems',
  monsters: 'monsters',
  subclasses: 'subclasses',
  races: 'races',
  backgrounds: 'backgrounds',
  feats: 'feats',
};
export const slugFor = (kind: HomebrewKind) => Object.keys(KIND_SLUGS).find((s) => KIND_SLUGS[s] === kind)!;

/** Where an entry lives in the compendium once saved. */
export function compendiumPath(kind: HomebrewKind, entry: { id: string; classId?: string }) {
  if (kind === 'subclasses') return `/compendium/classes/${entry.classId}`;
  return `/compendium/${slugFor(kind)}/${entry.id}`;
}

const STORAGE_KEY = 'grimoire.homebrew.v1';

export const emptyHomebrew = (): HomebrewData => ({
  spells: [],
  magicItems: [],
  monsters: [],
  subclasses: [],
  races: [],
  backgrounds: [],
  feats: [],
});

export const homebrewId = () =>
  `hb-${crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)}`;

/** Homebrew ids always look like "hb-xxxxxxxx", so they can't collide with SRD ids. */
export const isHomebrewId = (v: unknown): v is string => typeof v === 'string' && /^hb-[\w-]{1,40}$/.test(v);

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

export const blankRace = (): Race => ({
  id: homebrewId(),
  name: '',
  size: 'Medium',
  speed: 30,
  abilityBonuses: {},
  desc: '',
  languages: 'You can speak, read, and write Common and one other language of your choice.',
  traits: [{ name: '', desc: '' }],
  subraces: [],
  homebrew: true,
});

export const blankSubrace = (): Subrace => ({
  id: `sub-${homebrewId().slice(3)}`,
  name: '',
  desc: '',
  abilityBonuses: {},
  traits: [],
});

export const blankBackground = (): Background => ({
  id: homebrewId(),
  name: '',
  skills: [],
  tools: '',
  languages: '',
  equipment: '',
  feature: { name: '', desc: '' },
  desc: '',
  homebrew: true,
});

export const blankFeat = (): Feat => ({
  id: homebrewId(),
  name: '',
  prerequisite: '',
  abilityBonuses: {},
  desc: '',
  homebrew: true,
});

// ---------- Validation / normalisation (used for storage and imports) ----------

const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
const num = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const strList = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const blocks = (v: unknown): NamedBlock[] =>
  Array.isArray(v) ? v.filter((b) => b && typeof b === 'object').map((b) => ({ name: str(b.name), desc: str(b.desc) })) : [];
/** Blocks with at least a name or some text; empty rows left over in the editor are dropped. */
const filledBlocks = (v: unknown) => blocks(v).filter((b) => b.name.trim() || b.desc.trim());
const validId = (v: unknown) => (isHomebrewId(v) ? v : homebrewId());

type Loose = Record<string, unknown>;
const objects = (v: unknown): Loose[] => (Array.isArray(v) ? v.filter((x): x is Loose => !!x && typeof x === 'object') : []);

/** Ability bonuses between -10 and +10; zero and unknown abilities are dropped. */
const bonuses = (v: unknown): Partial<Record<Ability, number>> => {
  const o = (v && typeof v === 'object' ? v : {}) as Loose;
  const out: Partial<Record<Ability, number>> = {};
  for (const a of ABILITIES) {
    const n = Math.min(10, Math.max(-10, Math.round(num(o[a]))));
    if (n) out[a] = n;
  }
  return out;
};

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

function cleanRace(o: Loose): Race {
  const b = blankRace();
  return {
    ...b,
    id: validId(o.id),
    name: str(o.name),
    size: str(o.size, b.size),
    speed: Math.min(200, Math.max(0, Math.round(num(o.speed, 30)))),
    abilityBonuses: bonuses(o.abilityBonuses),
    desc: str(o.desc),
    languages: str(o.languages),
    traits: filledBlocks(o.traits),
    subraces: objects(o.subraces)
      .map((s) => ({
        // Subrace ids only need to be unique inside their race; SRD copies keep ids like "hill-dwarf".
        id: typeof s.id === 'string' && /^[\w-]{1,60}$/.test(s.id) ? s.id : blankSubrace().id,
        name: str(s.name),
        desc: str(s.desc),
        abilityBonuses: bonuses(s.abilityBonuses),
        traits: filledBlocks(s.traits),
      }))
      .filter((s) => s.name.trim()),
  };
}

function cleanBackground(o: Loose): Background {
  const f = o.feature && typeof o.feature === 'object' ? (o.feature as Loose) : null;
  const feature = f && (str(f.name).trim() || str(f.desc).trim()) ? { name: str(f.name), desc: str(f.desc) } : null;
  return {
    ...blankBackground(),
    id: validId(o.id),
    name: str(o.name),
    skills: [...new Set(strList(o.skills).filter((id) => skillById.has(id)))],
    tools: str(o.tools),
    languages: str(o.languages),
    equipment: str(o.equipment),
    feature,
    desc: str(o.desc),
  };
}

function cleanFeat(o: Loose): Feat {
  return {
    ...blankFeat(),
    id: validId(o.id),
    name: str(o.name),
    prerequisite: str(o.prerequisite),
    abilityBonuses: bonuses(o.abilityBonuses),
    desc: str(o.desc),
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
    races: named(objects(o.races).map(cleanRace)),
    backgrounds: named(objects(o.backgrounds).map(cleanBackground)),
    feats: named(objects(o.feats).map(cleanFeat)),
  };
}

/** Cleans one entry of the given kind, e.g. before saving it from the editor. */
export function cleanEntry<K extends HomebrewKind>(kind: K, entry: unknown): HomebrewData[K][number] | undefined {
  return cleanHomebrew({ [kind]: [entry] })[kind][0] as HomebrewData[K][number] | undefined;
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
  c: {
    subclassId: string;
    raceId: string;
    backgroundId: string;
    feats: string[];
    spells: string[];
    inventory: { source: string; refId?: string }[];
  },
  data: HomebrewData,
): HomebrewData {
  const itemIds = new Set(c.inventory.filter((i) => i.source === 'magic' && i.refId).map((i) => i.refId));
  return {
    spells: data.spells.filter((s) => c.spells.includes(s.id)),
    magicItems: data.magicItems.filter((m) => itemIds.has(m.id)),
    monsters: [],
    subclasses: data.subclasses.filter((s) => s.id === c.subclassId),
    races: data.races.filter((r) => r.id === c.raceId),
    backgrounds: data.backgrounds.filter((b) => b.id === c.backgroundId),
    feats: data.feats.filter((f) => c.feats.includes(f.id)),
  };
}
