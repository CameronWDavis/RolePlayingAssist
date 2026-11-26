import { describe, expect, it } from 'vitest';
import {
  blankMonster,
  blankSpell,
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
});

describe('itemSubtitle', () => {
  it('describes an item like the SRD does', () => {
    expect(itemSubtitle({ category: 'Ring', rarity: 'Very Rare', attunement: false })).toBe('Ring, very rare');
  });
});

describe('homebrewUsedBy', () => {
  it('collects only referenced spells, magic items and the chosen subclass', () => {
    const data = cleanHomebrew({
      spells: [{ id: 'hb-s1', name: 'Used' }, { id: 'hb-s2', name: 'Unused' }],
      magicItems: [{ id: 'hb-m1', name: 'Ring' }, { id: 'hb-m2', name: 'Other' }],
      subclasses: [{ id: 'hb-c1', name: 'Embers', classId: 'wizard' }],
      monsters: [{ id: 'hb-x1', name: 'Never bundled' }],
    });
    const used = homebrewUsedBy(
      {
        subclassId: 'hb-c1',
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
  });
});
