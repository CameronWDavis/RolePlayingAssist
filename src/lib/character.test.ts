import { describe, expect, it } from 'vitest';
import { classById, equipmentById } from '../data';
import {
  type Character,
  createCharacter,
  derive,
  fmtMod,
  importCharacter,
  makeCharacterFile,
  mod,
  profBonusFor,
  weaponAttack,
  weaponProficient,
} from './character';
import {
  blankBackground,
  blankFeat,
  blankMagicItem,
  blankRace,
  blankSpell,
  blankSubclass,
  blankSubrace,
  emptyHomebrew,
} from './homebrew';

/** A fresh character with overrides. Defaults: Human Fighter 1, scores 15/14/13/10/12/8, Acolyte. */
const make = (patch: Partial<Character> = {}): Character => ({ ...createCharacter(), ...patch });
const STANDARD_WIZARD = { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 };

describe('basic math', () => {
  it('computes ability modifiers', () => {
    expect([1, 8, 9, 10, 11, 12, 15, 20, 30].map(mod)).toEqual([-5, -1, -1, 0, 0, 1, 2, 5, 10]);
    expect(fmtMod(3)).toBe('+3');
    expect(fmtMod(0)).toBe('+0');
    expect(fmtMod(-1)).toBe('-1');
  });

  it('computes proficiency bonus by level', () => {
    expect([1, 4, 5, 8, 9, 12, 13, 16, 17, 20].map(profBonusFor)).toEqual([2, 2, 3, 3, 4, 4, 5, 5, 6, 6]);
  });
});

describe('derive: a level 1 Human Fighter', () => {
  const d = derive(make());

  it('applies the human +1 to every ability', () => {
    expect(d.scores).toEqual({ str: 16, dex: 15, con: 14, int: 11, wis: 13, cha: 9 });
  });

  it('has max hit die + Con for HP', () => {
    expect(d.hpMax).toBe(12); // d10 + 2
  });

  it('is unarmored: 10 + Dex', () => {
    expect(d.ac).toBe(12);
    expect(d.acNote).toBe('Unarmored');
  });

  it('adds proficiency to Strength and Constitution saves only', () => {
    expect(d.saves.str).toEqual({ value: 5, proficient: true });
    expect(d.saves.con).toEqual({ value: 4, proficient: true });
    expect(d.saves.dex).toEqual({ value: 2, proficient: false });
  });

  it('gets Insight and Religion from the Acolyte background', () => {
    const insight = d.skills.find((s) => s.id === 'insight')!;
    expect(insight).toMatchObject({ prof: 1, fromBackground: true, value: 3 });
    expect(d.skills.find((s) => s.id === 'athletics')!.prof).toBe(0);
  });

  it('has no spellcasting', () => {
    expect(d.spellAbility).toBeNull();
    expect(d.spellDC).toBeNull();
    expect(d.maxSpellLevel).toBe(0);
  });
});

describe('derive: a level 5 High Elf Wizard', () => {
  const d = derive(make({ raceId: 'elf', subraceId: 'high-elf', classId: 'wizard', level: 5, baseScores: STANDARD_WIZARD }));

  it('stacks race and subrace bonuses', () => {
    expect(d.scores.dex).toBe(16); // 14 + 2 elf
    expect(d.scores.int).toBe(16); // 15 + 1 high elf
  });

  it('uses fixed average HP per level after 1st', () => {
    expect(d.hpMax).toBe(27); // 6+1, then 4 levels × (4+1)
  });

  it('computes spell save DC and attack bonus', () => {
    expect(d.prof).toBe(3);
    expect(d.spellDC).toBe(14); // 8 + 3 + 3
    expect(d.spellAttack).toBe(6);
  });

  it('has the right spell slots', () => {
    expect(d.spellSlots.slice(0, 4)).toEqual([4, 3, 2, 0]);
    expect(d.maxSpellLevel).toBe(3);
  });
});

describe('derive: spell slots for other casters', () => {
  it('gives a level 5 Warlock two 3rd-level pact slots', () => {
    const d = derive(make({ classId: 'warlock', level: 5 }));
    expect(d.spellSlots.slice(0, 4)).toEqual([0, 0, 2, 0]);
    expect(d.maxSpellLevel).toBe(3);
  });

  it('gives half-casters slots from level 2', () => {
    expect(derive(make({ classId: 'paladin', level: 1 })).maxSpellLevel).toBe(0);
    expect(derive(make({ classId: 'paladin', level: 2 })).spellSlots[0]).toBe(2);
  });
});

describe('derive: armor class', () => {
  const dex18 = { str: 15, dex: 17, con: 14, int: 10, wis: 14, cha: 8 }; // 18 Dex / 15 Wis with human +1

  it('uses Unarmored Defense for Barbarians (Dex + Con)', () => {
    const d = derive(make({ classId: 'barbarian', baseScores: dex18 }));
    expect(d.ac).toBe(10 + 4 + 2);
  });

  it('uses Unarmored Defense for Monks (Dex + Wis), but not with a shield', () => {
    const monk = { str: 10, dex: 17, con: 12, int: 10, wis: 17, cha: 8 }; // 18 Dex, 18 Wis with human +1
    expect(derive(make({ classId: 'monk', baseScores: monk })).ac).toBe(10 + 4 + 4);
    // With a shield the monk loses Unarmored Defense: 10 + Dex, then +2 for the shield.
    expect(derive(make({ classId: 'monk', baseScores: monk, shield: true })).ac).toBe(10 + 4 + 2);
  });

  it('adds full Dex to light armor', () => {
    expect(derive(make({ armorId: 'leather-armor', baseScores: dex18 })).ac).toBe(11 + 4);
  });

  it('caps Dex at +2 for medium armor', () => {
    expect(derive(make({ armorId: 'half-plate-armor', baseScores: dex18 })).ac).toBe(15 + 2);
  });

  it('ignores Dex for heavy armor', () => {
    expect(derive(make({ armorId: 'chain-mail', baseScores: dex18 })).ac).toBe(16);
  });

  it('adds a shield and other bonuses', () => {
    const d = derive(make({ armorId: 'chain-mail', shield: true, acBonus: 1 }));
    expect(d.ac).toBe(16 + 2 + 1);
    expect(d.acNote).toBe('Chain Mail + Shield');
  });
});

describe('derive: skills and HP extras', () => {
  it('doubles proficiency for expertise', () => {
    const d = derive(make({ classId: 'rogue', level: 5, skillProfs: ['stealth'], expertise: ['stealth'] }));
    expect(d.skills.find((s) => s.id === 'stealth')!.value).toBe(2 + 3 * 2);
  });

  it('adds bonus max HP and never drops below 1', () => {
    expect(derive(make({ hpBonus: 5 })).hpMax).toBe(17);
    // Elves get no Con bonus, so Con 1 is a -5 modifier.
    const frail = { classId: 'wizard', raceId: 'elf', subraceId: '', baseScores: { ...STANDARD_WIZARD, con: 1 } };
    expect(derive(make({ ...frail, level: 1 })).hpMax).toBe(1); // 6 - 5
    expect(derive(make({ ...frail, level: 3 })).hpMax).toBe(1); // would be -1, floored at 1
  });

  it('computes passive Perception from the Perception skill', () => {
    expect(derive(make()).passivePerception).toBe(11);
    expect(derive(make({ skillProfs: ['perception'] })).passivePerception).toBe(13);
  });
});

describe('derive: subclasses', () => {
  it('uses the SRD subclass when chosen', () => {
    expect(derive(make({ classId: 'wizard', subclassId: 'srd' })).subclass?.name).toBe('Evocation');
  });

  it('finds a homebrew subclass for the same class only', () => {
    const sub = { ...blankSubclass('wizard'), name: 'School of Embers' };
    expect(derive(make({ classId: 'wizard', subclassId: sub.id }), { subclasses: [sub] }).subclass?.name).toBe('School of Embers');
    expect(derive(make({ classId: 'fighter', subclassId: sub.id }), { subclasses: [sub] }).subclass).toBeUndefined();
  });

  it('has no subclass when none is chosen', () => {
    expect(derive(make({ subclassId: '' })).subclass).toBeUndefined();
  });
});

describe('derive: homebrew races, backgrounds and feats', () => {
  const race = {
    ...blankRace(),
    name: 'Emberkin',
    speed: 35,
    abilityBonuses: { str: 2 },
    subraces: [{ ...blankSubrace(), id: 'ashborn', name: 'Ashborn', abilityBonuses: { con: 1 } }],
  };
  const background = { ...blankBackground(), name: 'Keeper', skills: ['perception', 'survival'] };
  const feat = { ...blankFeat(), name: 'Mighty', abilityBonuses: { str: 2, dex: 1 } };
  const hb = { races: [race], backgrounds: [background], feats: [feat] };
  const base = { str: 14, dex: 13, con: 12, int: 10, wis: 12, cha: 8 };

  it('applies a homebrew race and subrace', () => {
    const d = derive(make({ raceId: race.id, subraceId: 'ashborn', baseScores: base }), hb);
    expect(d.race?.name).toBe('Emberkin');
    expect(d.speed).toBe(35);
    expect(d.scores).toMatchObject({ str: 16, con: 13, dex: 13 });
  });

  it('falls back safely when a homebrew race was deleted', () => {
    const d = derive(make({ raceId: 'hb-gone', baseScores: base }), hb);
    expect(d.race).toBeUndefined();
    expect(d.speed).toBe(30);
    expect(d.scores.str).toBe(14);
  });

  it('gives the skills of a homebrew background', () => {
    const d = derive(make({ backgroundId: background.id }), hb);
    expect(d.background?.name).toBe('Keeper');
    expect(d.skills.find((s) => s.id === 'survival')).toMatchObject({ prof: 1, fromBackground: true });
    expect(d.skills.find((s) => s.id === 'insight')!.prof).toBe(0); // no longer Acolyte
  });

  it('adds feat ability increases, but not above 20', () => {
    const d = derive(make({ raceId: race.id, feats: [feat.id], baseScores: { ...base, str: 17 } }), hb);
    expect(d.feats.map((f) => f.name)).toEqual(['Mighty']);
    expect(d.scores.str).toBe(20); // 17 + 2 race = 19, feat +2 stops at 20
    expect(d.scores.dex).toBe(14);
  });

  it('never lowers a score that is already over 20', () => {
    const d = derive(make({ raceId: race.id, feats: [feat.id], baseScores: { ...base, str: 20 } }), hb);
    expect(d.scores.str).toBe(22);
  });

  it('finds the SRD feat and ignores unknown feat ids', () => {
    const d = derive(make({ feats: ['grappler', 'hb-deleted'] }));
    expect(d.feats.map((f) => f.name)).toEqual(['Grappler']);
  });
});

describe('weapons', () => {
  const cls = (id: string) => classById.get(id);
  const weapon = (id: string) => equipmentById.get(id)!;

  it.each([
    ['fighter', 'crossbow-heavy', true],
    ['rogue', 'crossbow-hand', true],
    ['bard', 'crossbow-hand', true],
    ['rogue', 'rapier', true],
    ['rogue', 'crossbow-heavy', false],
    ['wizard', 'dagger', true],
    ['wizard', 'crossbow-light', true],
    ['wizard', 'longsword', false],
    ['druid', 'scimitar', true],
    ['monk', 'shortsword', true],
    ['monk', 'longsword', false],
  ])('%s with %s: proficient = %s', (c, w, expected) => {
    expect(weaponProficient(cls(c), weapon(w))).toBe(expected);
  });

  it('uses Dex for finesse weapons when it is higher', () => {
    const d = derive(make({ classId: 'rogue', baseScores: { str: 10, dex: 15, con: 12, int: 10, wis: 10, cha: 10 } }));
    expect(weaponAttack(d, weapon('rapier'))).toMatchObject({ toHit: 3 + 2, damage: '1d8+3', proficient: true });
  });

  it('uses Str for heavy melee weapons and shows versatile damage', () => {
    const d = derive(make());
    expect(weaponAttack(d, weapon('longsword'))).toMatchObject({ toHit: 5, damage: '1d8+3', versatile: '1d10+3' });
  });

  it('uses Dex for ranged weapons and leaves off a +0', () => {
    const d = derive(make({ baseScores: { str: 15, dex: 9, con: 13, int: 10, wis: 12, cha: 8 } }));
    expect(weaponAttack(d, weapon('longbow'))).toMatchObject({ toHit: 2, damage: '1d8' });
  });
});

describe('importCharacter', () => {
  const imp = (obj: unknown) => importCharacter(JSON.stringify(obj)).character;

  it('rejects non-JSON and non-character files', () => {
    expect(() => importCharacter('{oops')).toThrow("isn't valid JSON");
    expect(() => importCharacter(JSON.stringify({ name: 42, classId: 'wizard' }))).toThrow("doesn't look like");
    expect(() => importCharacter(JSON.stringify({ name: 'No class or race' }))).toThrow("doesn't look like");
    expect(() => importCharacter('[]')).toThrow("doesn't look like");
  });

  it('replaces bad values with safe defaults', () => {
    const c = imp({
      name: 'Messy',
      classId: 'not-a-class',
      level: 'seven',
      baseScores: { str: 'high', dex: 99 },
      inventory: [{ name: 'Rope', qty: -5 }, null, 'junk', { qty: 2 }],
      slotsUsed: 'x',
      deathSaves: 5,
      currency: null,
      hpCurrent: 'lots',
    });
    expect(c.classId).toBe('fighter');
    expect(c.level).toBe(1);
    expect(c.baseScores.str).toBe(15);
    expect(c.baseScores.dex).toBe(30);
    expect(c.inventory).toEqual([expect.objectContaining({ name: 'Rope', qty: 1, source: 'custom' })]);
    expect(c.slotsUsed).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(c.deathSaves).toEqual({ success: 0, fail: 0 });
    expect(c.currency).toEqual({ cp: 0, sp: 0, gp: 0, pp: 0 });
    expect(c.hpCurrent).toBe(-1);
    expect(() => derive(c)).not.toThrow();
  });

  it('gives imports a new id so they never overwrite an existing character', () => {
    const c = imp({ id: 'same-id', name: 'A', classId: 'fighter' });
    expect(c.id).not.toBe('same-id');
  });

  it('gives old files the SRD subclass only once they reach its level', () => {
    expect(imp({ name: 'A', classId: 'fighter', level: 1 }).subclassId).toBe('');
    expect(imp({ name: 'B', classId: 'fighter', level: 3 }).subclassId).toBe('srd');
    expect(imp({ name: 'C', classId: 'cleric', level: 1 }).subclassId).toBe('srd');
    expect(imp({ name: 'D', classId: 'fighter', level: 5, subclassId: '' }).subclassId).toBe('');
  });

  it('keeps homebrew race ids and feats, but resets unknown SRD race ids', () => {
    const c = imp({ name: 'H', classId: 'wizard', raceId: 'hb-emberkin', feats: ['grappler', 'grappler', 5] });
    expect(c.raceId).toBe('hb-emberkin');
    expect(c.feats).toEqual(['grappler']);
    expect(imp({ name: 'I', classId: 'wizard', raceId: 'tortle' }).raceId).toBe('human');
    expect(imp({ name: 'J', classId: 'wizard' }).feats).toEqual([]);
  });

  it('returns any homebrew bundled in the file, cleaned up', () => {
    const { homebrew } = importCharacter(
      JSON.stringify({ name: 'E', classId: 'wizard', homebrew: { spells: [{ id: 'hb-spark01', name: 'Spark' }, { name: '' }] } }),
    );
    expect(homebrew.spells.map((s) => s.name)).toEqual(['Spark']);
  });
});

describe('makeCharacterFile', () => {
  it('bundles only the homebrew the character uses', () => {
    const used = { ...blankSpell(), name: 'Used' };
    const unused = { ...blankSpell(), name: 'Unused' };
    const ring = { ...blankMagicItem(), name: 'Ring' };
    const sub = { ...blankSubclass('wizard'), name: 'Embers' };
    const data = { ...emptyHomebrew(), spells: [used, unused], magicItems: [ring], subclasses: [sub] };
    const c = make({
      classId: 'wizard',
      subclassId: sub.id,
      spells: [used.id, 'fireball'],
      inventory: [{ key: 'k', source: 'magic', refId: ring.id, name: 'Ring', qty: 1 }],
    });
    const file = makeCharacterFile(c, data);
    expect(file.format).toBe('grimoire-character');
    expect(file.homebrew?.spells.map((s) => s.name)).toEqual(['Used']);
    expect(file.homebrew?.magicItems.map((m) => m.name)).toEqual(['Ring']);
    expect(file.homebrew?.subclasses.map((s) => s.name)).toEqual(['Embers']);
  });

  it('leaves out the homebrew field when nothing is used', () => {
    expect('homebrew' in makeCharacterFile(make(), emptyHomebrew())).toBe(false);
  });

  it('round-trips through import', () => {
    const c = make({ name: 'Round Trip', classId: 'bard', level: 7, skillProfs: ['performance'] });
    const back = importCharacter(JSON.stringify(makeCharacterFile(c, emptyHomebrew()))).character;
    expect({ ...back, id: c.id, updatedAt: c.updatedAt }).toEqual(c);
  });
});
