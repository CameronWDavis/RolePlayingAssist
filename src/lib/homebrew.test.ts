import { describe, expect, it } from 'vitest';
import {
  blankMonster,
  blankRace,
  blankSpell,
  cleanEntry,
  cleanHomebrew,
  countHomebrew,
  emptyHomebrew,
  homebrewUsedBy,
  itemSubtitle,
  makePack,
  parsePack,
} from './homebrew';

describe('parsePack', () => {
  it('rejects files that are not homebrew packs', () => {
    expect(() => parsePack('nope')).toThrow("isn't valid JSON");
    expect(() => parsePack(JSON.stringify({ spells: [] }))).toThrow("isn't a Grimoire homebrew pack");
    expect(() => parsePack(JSON.stringify(makePack(emptyHomebrew())))).toThrow('empty');
  });

  it('round-trips a pack', () => {
    const data = { ...emptyHomebrew(), spells: [{ ...blankSpell(), name: 'Frostball', level: 3 }] };
    expect(parsePack(JSON.stringify(makePack(data)))).toEqual(data);
  });
});

describe('cleanHomebrew', () => {
  it('drops unnamed entries and anything that is not an object', () => {
    const out = cleanHomebrew({ spells: [{ name: 'Keep' }, { name: '   ' }, null, 'junk', 5] });
    expect(out.spells.map((s) => s.name)).toEqual(['Keep']);
  });

  it('copes with garbage input', () => {
    expect(countHomebrew(cleanHomebrew(null))).toBe(0);
    expect(countHomebrew(cleanHomebrew('text'))).toBe(0);
    expect(countHomebrew(cleanHomebrew({ spells: 'not a list' }))).toBe(0);
  });

  it('keeps valid homebrew ids and replaces unsafe ones', () => {
    const out = cleanHomebrew({ spells: [{ id: 'hb-abc123', name: 'A' }, { id: 'fireball', name: 'B' }, { id: '<script>', name: 'C' }] });
    expect(out.spells[0].id).toBe('hb-abc123');
    expect(out.spells[1].id).toMatch(/^hb-/);
    expect(out.spells[2].id).toMatch(/^hb-/);
  });

  it('drops fields it does not know about', () => {
    const out = cleanHomebrew({ magicItems: [{ name: 'Ring', evil: '<script>alert(1)</script>' }] });
    expect(out.magicItems[0]).not.toHaveProperty('evil');
  });

  it('clamps spell levels and fixes types', () => {
    const out = cleanHomebrew({ spells: [{ name: 'A', level: 15, concentration: 'yes', classes: ['Wizard', 7] }] });
    expect(out.spells[0]).toMatchObject({ level: 9, concentration: true, classes: ['Wizard'] });
  });

  it('derives monster XP from challenge rating, and resets an unknown CR', () => {
    const out = cleanHomebrew({ monsters: [{ name: 'Hound', cr: 2, xp: 999999 }, { name: 'Odd', cr: 2.5 }] });
    expect(out.monsters[0]).toMatchObject({ cr: 2, crLabel: '2', xp: 450 });
    expect(out.monsters[1]).toMatchObject({ cr: 1, xp: 200 });
  });

  it('keeps monster ability scores between 1 and 30', () => {
    const out = cleanHomebrew({ monsters: [{ name: 'M', abilities: [0, 50, 10, 10, 10, 'x'] }] });
    expect(out.monsters[0].abilities).toEqual([1, 30, 10, 10, 10, 10]);
    expect(cleanHomebrew({ monsters: [{ name: 'M', abilities: [1, 2] }] }).monsters[0].abilities).toEqual(blankMonster().abilities);
  });

  it('rebuilds magic item subtitles from their fields', () => {
    const out = cleanHomebrew({ magicItems: [{ name: 'Lamp', category: 'Wondrous Items', rarity: 'Rare', attunement: true, subtitle: 'lies' }] });
    expect(out.magicItems[0].subtitle).toBe('Wondrous item, rare (requires attunement)');
  });

  it('clamps subclass feature levels', () => {
    const out = cleanHomebrew({ subclasses: [{ name: 'S', classId: 'wizard', features: [{ name: 'F', level: 99 }, { name: 'G', level: -3 }] }] });
    expect(out.subclasses[0].features.map((f) => f.level)).toEqual([20, 1]);
  });

  it('cleans races: ability bonuses, speed, empty traits and unnamed subraces', () => {
    const out = cleanHomebrew({
      races: [
        {
          name: 'Emberkin',
          speed: 999,
          abilityBonuses: { str: 2, cha: 1.6, luck: 5, dex: 0, wis: 'lots', int: -40 },
          traits: [{ name: 'Darkvision', desc: 'See in the dark.' }, { name: '', desc: '  ' }],
          subraces: [{ id: 'ash', name: 'Ashborn', abilityBonuses: { con: 1 } }, { name: '' }, { id: 'bad id!', name: 'Cinder' }],
        },
      ],
    });
    const race = out.races[0];
    expect(race.speed).toBe(200);
    expect(race.abilityBonuses).toEqual({ str: 2, cha: 2, int: -10 });
    expect(race.traits.map((t) => t.name)).toEqual(['Darkvision']);
    expect(race.subraces.map((s) => s.name)).toEqual(['Ashborn', 'Cinder']);
    expect(race.subraces[0]).toMatchObject({ id: 'ash', abilityBonuses: { con: 1 } });
    expect(race.subraces[1].id).toMatch(/^sub-/);
    expect(race.homebrew).toBe(true);
  });

  it('cleans backgrounds: only real skills, once each, and no empty feature', () => {
    const out = cleanHomebrew({
      backgrounds: [
        { name: 'Keeper', skills: ['perception', 'perception', 'flying', 3], feature: { name: '', desc: '' } },
        { name: 'Sailor', skills: ['athletics'], feature: { name: 'Ship Hand', desc: 'Free passage.' } },
      ],
    });
    expect(out.backgrounds[0]).toMatchObject({ skills: ['perception'], feature: null });
    expect(out.backgrounds[1].feature).toEqual({ name: 'Ship Hand', desc: 'Free passage.' });
  });

  it('cleans feats', () => {
    const out = cleanHomebrew({ feats: [{ name: 'Storm Caller', prerequisite: 7, abilityBonuses: { wis: 1 }, desc: 'Zap.' }] });
    expect(out.feats[0]).toMatchObject({ name: 'Storm Caller', prerequisite: '', abilityBonuses: { wis: 1 }, desc: 'Zap.', homebrew: true });
  });

  it('reads packs saved before races, backgrounds and feats existed', () => {
    const old = { format: 'grimoire-homebrew', version: 1, spells: [{ name: 'Old Spell' }], magicItems: [], monsters: [], subclasses: [] };
    const data = parsePack(JSON.stringify(old));
    expect(data.spells.map((s) => s.name)).toEqual(['Old Spell']);
    expect(data).toMatchObject({ races: [], backgrounds: [], feats: [] });
  });
});

describe('cleanEntry', () => {
  it('cleans a single editor draft and returns nothing for an unnamed one', () => {
    const race = cleanEntry('races', { ...blankRace(), name: 'Gnoll-kin', traits: [{ name: '', desc: '' }] });
    expect(race).toMatchObject({ name: 'Gnoll-kin', traits: [] });
    expect(cleanEntry('feats', { name: '  ' })).toBeUndefined();
  });
});

describe('itemSubtitle', () => {
  it('describes an item like the SRD does', () => {
    expect(itemSubtitle({ category: 'Ring', rarity: 'Very Rare', attunement: false })).toBe('Ring, very rare');
  });
});

describe('homebrewUsedBy', () => {
  it('collects only the referenced spells, items, subclass, race, background and feats', () => {
    const data = cleanHomebrew({
      spells: [{ id: 'hb-s1', name: 'Used' }, { id: 'hb-s2', name: 'Unused' }],
      magicItems: [{ id: 'hb-m1', name: 'Ring' }, { id: 'hb-m2', name: 'Other' }],
      subclasses: [{ id: 'hb-c1', name: 'Embers', classId: 'wizard' }],
      monsters: [{ id: 'hb-x1', name: 'Never bundled' }],
      races: [{ id: 'hb-r1', name: 'Emberkin' }, { id: 'hb-r2', name: 'Other race' }],
      backgrounds: [{ id: 'hb-b1', name: 'Keeper' }],
      feats: [{ id: 'hb-f1', name: 'Storm Caller' }, { id: 'hb-f2', name: 'Unused feat' }],
    });
    const used = homebrewUsedBy(
      {
        subclassId: 'hb-c1',
        raceId: 'hb-r1',
        backgroundId: 'hb-b1',
        feats: ['hb-f1', 'grappler'],
        spells: ['hb-s1', 'fireball'],
        // An equipment item with a homebrew-looking id must not pull in a magic item.
        inventory: [
          { source: 'magic', refId: 'hb-m1' },
          { source: 'equipment', refId: 'hb-m2' },
        ],
      },
      data,
    );
    expect(used.spells.map((s) => s.name)).toEqual(['Used']);
    expect(used.magicItems.map((m) => m.name)).toEqual(['Ring']);
    expect(used.subclasses.map((s) => s.name)).toEqual(['Embers']);
    expect(used.monsters).toEqual([]);
    expect(used.races.map((r) => r.name)).toEqual(['Emberkin']);
    expect(used.backgrounds.map((b) => b.name)).toEqual(['Keeper']);
    expect(used.feats.map((f) => f.name)).toEqual(['Storm Caller']);
  });
});
