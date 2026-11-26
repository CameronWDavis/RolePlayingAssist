// Converts the raw 5e SRD JSON (from github.com/5e-bits/5e-database, CC-BY-4.0)
// in data-raw/ into the lean files the app imports from src/data/.
// Run with: npm run build:data
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = path.join(root, 'data-raw');
const outDir = path.join(root, 'src', 'data');
fs.mkdirSync(outDir, { recursive: true });

const read = (name) => JSON.parse(fs.readFileSync(path.join(rawDir, `5e-SRD-${name}.json`), 'utf8'));
const counts = {};
const write = (name, data) => {
  fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(data));
  counts[name] = data.length;
  console.log(`${name}: ${data.length}`);
};
// The home page shows how much content there is without downloading all of it.
process.on('exit', () => fs.writeFileSync(path.join(outDir, 'counts.json'), JSON.stringify(counts)));
const names = (arr = []) => arr.map((x) => x.name);
const joinDesc = (d) => (Array.isArray(d) ? d.join('\n\n') : d || '');

// ---------- Spells ----------
write(
  'spells',
  read('Spells').map((s) => ({
    id: s.index,
    name: s.name,
    level: s.level,
    school: s.school.name,
    castingTime: s.casting_time,
    range: s.range,
    components: s.components.join(', ') + (s.material ? ` (${s.material})` : ''),
    duration: s.duration,
    concentration: s.concentration,
    ritual: s.ritual,
    classes: names(s.classes),
    desc: joinDesc(s.desc),
    higherLevel: joinDesc(s.higher_level),
  })),
);

// ---------- Monsters ----------
const crLabel = (cr) => (cr === 0.125 ? '1/8' : cr === 0.25 ? '1/4' : cr === 0.5 ? '1/2' : String(cr));
const blocks = (arr = []) => arr.map((a) => ({ name: a.name, desc: a.desc }));
write(
  'monsters',
  read('Monsters').map((m) => ({
    id: m.index,
    name: m.name,
    size: m.size,
    type: m.type,
    subtype: m.subtype || '',
    alignment: m.alignment,
    ac: m.armor_class?.[0]?.value ?? 10,
    acType: m.armor_class?.[0]?.type ?? '',
    hp: m.hit_points,
    hitDice: m.hit_points_roll || m.hit_dice,
    speed: Object.entries(m.speed || {})
      .map(([k, v]) => (k === 'walk' ? v : `${k} ${v}`))
      .join(', '),
    abilities: [m.strength, m.dexterity, m.constitution, m.intelligence, m.wisdom, m.charisma],
    saves: (m.proficiencies || [])
      .filter((p) => p.proficiency.index.startsWith('saving-throw'))
      .map((p) => `${p.proficiency.name.replace('Saving Throw: ', '')} +${p.value}`),
    skills: (m.proficiencies || [])
      .filter((p) => p.proficiency.index.startsWith('skill'))
      .map((p) => `${p.proficiency.name.replace('Skill: ', '')} +${p.value}`),
    vulnerabilities: m.damage_vulnerabilities || [],
    resistances: m.damage_resistances || [],
    immunities: m.damage_immunities || [],
    conditionImmunities: names(m.condition_immunities),
    senses: Object.entries(m.senses || {})
      .map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`)
      .join(', '),
    languages: m.languages || '—',
    cr: m.challenge_rating,
    crLabel: crLabel(m.challenge_rating),
    xp: m.xp,
    traits: blocks(m.special_abilities),
    actions: blocks(m.actions),
    reactions: blocks(m.reactions),
    legendary: blocks(m.legendary_actions),
  })),
);

// ---------- Magic items ----------
write(
  'magicItems',
  read('Magic-Items')
    .filter((m) => !m.variant)
    .map((m) => ({
      id: m.index,
      name: m.name,
      category: m.equipment_category.name,
      rarity: m.rarity.name,
      attunement: /requires attunement/i.test(m.desc?.[0] || ''),
      subtitle: m.desc?.[0] || '',
      desc: joinDesc(m.desc?.slice(1)),
    })),
);

// ---------- Equipment ----------
write(
  'equipment',
  read('Equipment').map((e) => {
    let detail = '';
    if (e.damage) detail = `${e.damage.damage_dice} ${e.damage.damage_type.name.toLowerCase()}`;
    if (e.two_handed_damage) detail += ` (${e.two_handed_damage.damage_dice} two-handed)`;
    if (e.armor_class)
      detail = `AC ${e.armor_class.base}${e.armor_class.dex_bonus ? (e.armor_class.max_bonus ? ` + Dex (max ${e.armor_class.max_bonus})` : ' + Dex') : ''}`;
    return {
      id: e.index,
      name: e.name,
      category: e.equipment_category.name,
      subcategory: e.category_range || (e.armor_category ? `${e.armor_category} Armor` : e.gear_category?.name || e.tool_category || e.vehicle_category || ''),
      cost: e.cost ? `${e.cost.quantity} ${e.cost.unit}` : '—',
      weight: e.weight ?? null,
      detail,
      // "Monk" is a data-only tag for monk weapons, not a real weapon property.
      properties: names(e.properties).filter((p) => p !== 'Monk'),
      weapon: e.damage
        ? {
            category: e.weapon_category,
            range: e.weapon_range,
            dice: e.damage.damage_dice,
            type: e.damage.damage_type.name.toLowerCase(),
            versatile: e.two_handed_damage?.damage_dice ?? null,
            finesse: names(e.properties).includes('Finesse'),
          }
        : null,
      armor: e.armor_class
        ? { base: e.armor_class.base, dex: !!e.armor_class.dex_bonus, maxDex: e.armor_class.max_bonus ?? null, category: e.armor_category }
        : null,
      desc: joinDesc(e.desc),
    };
  }),
);

// ---------- Conditions ----------
write('conditions', read('Conditions').map((c) => ({ id: c.index, name: c.name, desc: joinDesc(c.desc) })));

// ---------- Races (with subraces + traits) ----------
const traits = Object.fromEntries(read('Traits').map((t) => [t.index, { name: t.name, desc: joinDesc(t.desc) }]));
const bonuses = (arr = []) => Object.fromEntries(arr.map((b) => [b.ability_score.index, b.bonus]));
const subraces = read('Subraces');
write(
  'races',
  read('Races').map((r) => ({
    id: r.index,
    name: r.name,
    speed: r.speed,
    size: r.size,
    abilityBonuses: bonuses(r.ability_bonuses),
    desc: [r.age, r.alignment, r.size_description].filter(Boolean).join('\n\n'),
    languages: r.language_desc,
    traits: (r.traits || []).map((t) => traits[t.index]).filter(Boolean),
    subraces: subraces
      .filter((s) => s.race.index === r.index)
      .map((s) => ({
        id: s.index,
        name: s.name,
        desc: s.desc,
        abilityBonuses: bonuses(s.ability_bonuses),
        traits: (s.racial_traits || []).map((t) => traits[t.index]).filter(Boolean),
      })),
  })),
);

// ---------- Classes (with level table, features, subclass) ----------
const levels = read('Levels');
const features = read('Features');
const subclasses = read('Subclasses');
write(
  'classes',
  read('Classes').map((c) => {
    const classLevels = levels
      .filter((l) => l.class.index === c.index && !l.subclass)
      .sort((a, b) => a.level - b.level)
      .map((l) => ({
        level: l.level,
        profBonus: l.prof_bonus,
        features: names(l.features),
        slots: l.spellcasting
          ? Array.from({ length: 9 }, (_, i) => l.spellcasting[`spell_slots_level_${i + 1}`] ?? 0)
          : null,
        cantrips: l.spellcasting?.cantrips_known ?? null,
      }));
    const skillChoice = c.proficiency_choices?.find((p) => /skill/i.test(JSON.stringify(p.from)));
    return {
      id: c.index,
      name: c.name,
      hitDie: c.hit_die,
      savingThrows: c.saving_throws.map((s) => s.index),
      proficiencies: names(c.proficiencies).filter((p) => !p.startsWith('Saving Throw')),
      skillChoices: {
        choose: skillChoice?.choose ?? 2,
        from: (skillChoice?.from?.options || [])
          .map((o) => o.item?.index)
          .filter((i) => i?.startsWith('skill-'))
          .map((i) => i.replace('skill-', '')),
      },
      spellcastingAbility: c.spellcasting?.spellcasting_ability?.index ?? null,
      levels: classLevels,
      features: features
        .filter((f) => f.class.index === c.index && !f.subclass && !f.parent)
        .sort((a, b) => a.level - b.level)
        .map((f) => ({ name: f.name, level: f.level, desc: joinDesc(f.desc) })),
      subclasses: subclasses
        .filter((s) => s.class.index === c.index)
        .map((s) => ({
          name: s.name,
          flavor: s.subclass_flavor,
          desc: joinDesc(s.desc),
          features: features
            .filter((f) => f.subclass?.index === s.index)
            .sort((a, b) => a.level - b.level)
            .map((f) => ({ name: f.name, level: f.level, desc: joinDesc(f.desc) })),
        })),
    };
  }),
);

// ---------- Skills & backgrounds ----------
write('skills', read('Skills').map((s) => ({ id: s.index, name: s.name, ability: s.ability_score.index, desc: joinDesc(s.desc) })));
write(
  'backgrounds',
  read('Backgrounds').map((b) => ({
    id: b.index,
    name: b.name,
    skills: (b.starting_proficiencies || []).filter((p) => p.index.startsWith('skill-')).map((p) => p.index.replace('skill-', '')),
    feature: b.feature ? { name: b.feature.name, desc: joinDesc(b.feature.desc) } : null,
  })),
);
