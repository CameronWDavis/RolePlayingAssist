// Sanity checks on the generated SRD data, so a bad re-run of `npm run build:data`
// (or an upstream change in 5e-database) gets caught before it ships.
import { describe, expect, it } from 'vitest';
import { backgrounds, classes, conditions, equipment, races, skills } from './index';
import { magicItems, monsters, spells } from './library';
import counts from './counts.json';

const unique = (ids: string[]) => new Set(ids).size === ids.length;

describe('SRD data', () => {
  it('matches the counts shown on the home page', () => {
    expect(counts).toMatchObject({
      spells: spells.length,
      monsters: monsters.length,
      magicItems: magicItems.length,
      classes: classes.length,
      equipment: equipment.length,
      races: races.length,
      conditions: conditions.length,
    });
  });

  it('has the expected amount of content', () => {
    expect(classes).toHaveLength(12);
    expect(skills).toHaveLength(18);
    expect(races.length).toBeGreaterThanOrEqual(9);
    expect(backgrounds.length).toBeGreaterThanOrEqual(1);
    expect(spells.length).toBeGreaterThan(300);
    expect(monsters.length).toBeGreaterThan(300);
    expect(magicItems.length).toBeGreaterThan(200);
  });

  it('has unique ids in every list', () => {
    for (const list of [spells, monsters, magicItems, equipment, classes, races, skills, conditions]) {
      expect(unique(list.map((x) => x.id))).toBe(true);
    }
  });

  it('gives every class 20 levels, a hit die and a subclass', () => {
    for (const c of classes) {
      expect(c.levels.map((l) => l.level)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
      expect([6, 8, 10, 12]).toContain(c.hitDie);
      expect(c.savingThrows).toHaveLength(2);
      expect(c.subclasses.length).toBeGreaterThanOrEqual(1);
      expect(c.subclasses[0].features.length).toBeGreaterThan(0);
    }
  });

  it('only gives spell slots to classes with a spellcasting ability', () => {
    for (const c of classes) {
      const hasSlots = c.levels.some((l) => l.slots?.some((n) => n > 0));
      expect(hasSlots).toBe(c.spellcastingAbility !== null);
    }
  });

  it('has sensible spells', () => {
    for (const s of spells) {
      expect(s.level).toBeGreaterThanOrEqual(0);
      expect(s.level).toBeLessThanOrEqual(9);
      expect(s.name).not.toBe('');
      expect(s.desc).not.toBe('');
      expect(s.classes.length).toBeGreaterThan(0);
    }
  });

  it('has complete monster stat blocks', () => {
    for (const m of monsters) {
      expect(m.abilities).toHaveLength(6);
      expect(m.hp).toBeGreaterThan(0);
      expect(m.ac).toBeGreaterThan(0);
    }
  });

  it('only lists real weapon properties', () => {
    // "Monk" is a data-only tag in the source data that build-data.mjs strips out.
    expect(equipment.some((e) => e.properties.includes('Monk'))).toBe(false);
  });

  it('describes armor so AC can be calculated', () => {
    const armor = equipment.filter((e) => e.category === 'Armor');
    expect(armor.length).toBeGreaterThan(10);
    for (const a of armor) expect(a.armor).not.toBeNull();
  });
});
