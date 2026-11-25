import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { RichText } from '../../components/RichText';
import { useDice } from '../../components/Dice';
import {
  ABILITIES,
  ABILITY_NAMES,
  type Condition,
  type DndClass,
  type Equipment,
  type HomebrewSubclass,
  type MagicItem,
  type Subclass,
  type Monster,
  type NamedBlock,
  type Race,
  type Spell,
  skillById,
} from '../../data';
import { fmtMod, mod } from '../../lib/character';

export const ordinal = (n: number) => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`);
export const spellLevelLabel = (s: Spell) =>
  s.level === 0 ? `${s.school} cantrip` : `${ordinal(s.level)}-level ${s.school.toLowerCase()}`;

function Stat({ label, value }: { label: string; value: ReactNode }) {
  if (value === '' || value == null) return null;
  return (
    <div className="stat-line">
      <strong>{label}</strong> {value}
    </div>
  );
}

export function SpellDetail({ spell }: { spell: Spell }) {
  return (
    <article className="detail">
      <h1>{spell.name}</h1>
      <div className="subtitle">
        {spellLevelLabel(spell)}
        {spell.ritual && ' (ritual)'}
      </div>
      <div className="stat-grid">
        <Stat label="Casting Time" value={spell.castingTime} />
        <Stat label="Range" value={spell.range} />
        <Stat label="Components" value={spell.components} />
        <Stat label="Duration" value={`${spell.concentration ? 'Concentration, ' : ''}${spell.duration}`} />
      </div>
      <RichText text={spell.desc} />
      {spell.higherLevel && (
        <>
          <h3>At Higher Levels</h3>
          <RichText text={spell.higherLevel} />
        </>
      )}
      <div className="chips">
        {spell.classes.map((c) => (
          <span className="chip" key={c}>{c}</span>
        ))}
      </div>
    </article>
  );
}

/** Finds dice like "2d6 + 5" or "1d8" in text and makes them clickable. */
function RollableText({ text, label }: { text: string; label: string }) {
  const { roll } = useDice();
  const parts = text.split(/(\+\d+ to hit|\d+d\d+(?:\s*[+-]\s*\d+)?)/g);
  return (
    <>
      {parts.map((p, i) => {
        const hit = /^\+(\d+) to hit$/.exec(p);
        if (hit)
          return (
            <button key={i} className="inline-roll" onClick={() => roll(`1d20+${hit[1]}`, `${label}: to hit`, { d20: true })}>
              {p}
            </button>
          );
        if (/^\d+d\d+/.test(p))
          return (
            <button key={i} className="inline-roll" onClick={() => roll(p.replace(/\s/g, ''), `${label}: damage`)}>
              {p}
            </button>
          );
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

function BlockList({ title, items, monster }: { title: string; items: NamedBlock[]; monster: string }) {
  if (!items.length) return null;
  return (
    <section>
      <h3 className="rule">{title}</h3>
      {items.map((b) => (
        <p key={b.name}>
          <strong><em>{b.name}.</em></strong> <RollableText text={b.desc} label={`${monster} – ${b.name}`} />
        </p>
      ))}
    </section>
  );
}

export function MonsterDetail({ monster: m }: { monster: Monster }) {
  const { roll } = useDice();
  return (
    <article className="detail statblock">
      <h1>{m.name}</h1>
      <div className="subtitle">
        {m.size} {m.type}
        {m.subtype && ` (${m.subtype})`}, {m.alignment}
      </div>
      <div className="stat-grid">
        <Stat label="Armor Class" value={`${m.ac}${m.acType && m.acType !== 'dex' ? ` (${m.acType})` : ''}`} />
        <Stat
          label="Hit Points"
          value={
            <>
              {m.hp}{' '}
              <button className="inline-roll" onClick={() => roll(m.hitDice.replace(/\s/g, ''), `${m.name} HP`)}>
                ({m.hitDice})
              </button>
            </>
          }
        />
        <Stat label="Speed" value={m.speed} />
      </div>
      <div className="ability-row">
        {ABILITIES.map((a, i) => (
          <button
            key={a}
            className="ability-cell"
            onClick={() => roll(`1d20${fmtMod(mod(m.abilities[i]))}`, `${m.name}: ${ABILITY_NAMES[a]}`, { d20: true })}
            title={`Roll ${ABILITY_NAMES[a]} check`}
          >
            <span className="ab-name">{a.toUpperCase()}</span>
            <span className="ab-score">{m.abilities[i]}</span>
            <span className="ab-mod">({fmtMod(mod(m.abilities[i]))})</span>
          </button>
        ))}
      </div>
      <div className="stat-grid">
        <Stat label="Saving Throws" value={m.saves.join(', ')} />
        <Stat label="Skills" value={m.skills.join(', ')} />
        <Stat label="Damage Vulnerabilities" value={m.vulnerabilities.join(', ')} />
        <Stat label="Damage Resistances" value={m.resistances.join(', ')} />
        <Stat label="Damage Immunities" value={m.immunities.join(', ')} />
        <Stat label="Condition Immunities" value={m.conditionImmunities.join(', ')} />
        <Stat label="Senses" value={m.senses} />
        <Stat label="Languages" value={m.languages} />
        <Stat label="Challenge" value={`${m.crLabel} (${m.xp.toLocaleString()} XP)`} />
      </div>
      <BlockList title="Traits" items={m.traits} monster={m.name} />
      <BlockList title="Actions" items={m.actions} monster={m.name} />
      <BlockList title="Reactions" items={m.reactions} monster={m.name} />
      <BlockList title="Legendary Actions" items={m.legendary} monster={m.name} />
    </article>
  );
}

export function MagicItemDetail({ item }: { item: MagicItem }) {
  return (
    <article className="detail">
      <h1>{item.name}</h1>
      <div className="subtitle">
        <span className={`rarity rarity-${item.rarity.toLowerCase().replace(/\s/g, '-')}`}>{item.subtitle || `${item.category}, ${item.rarity}`}</span>
      </div>
      <RichText text={item.desc} />
    </article>
  );
}

export function EquipmentDetail({ item }: { item: Equipment }) {
  return (
    <article className="detail">
      <h1>{item.name}</h1>
      <div className="subtitle">
        {item.category}
        {item.subcategory && ` · ${item.subcategory}`}
      </div>
      <div className="stat-grid">
        <Stat label="Cost" value={item.cost} />
        <Stat label="Weight" value={item.weight != null ? `${item.weight} lb.` : ''} />
        <Stat label={item.armor ? 'Armor Class' : 'Damage'} value={item.detail} />
        <Stat label="Properties" value={item.properties.join(', ')} />
      </div>
      <RichText text={item.desc} />
    </article>
  );
}

export function ConditionDetail({ condition }: { condition: Condition }) {
  return (
    <article className="detail">
      <h1>{condition.name}</h1>
      <div className="subtitle">Condition</div>
      <RichText text={condition.desc} />
    </article>
  );
}

const bonusText = (b: Partial<Record<string, number>>) =>
  Object.entries(b)
    .map(([k, v]) => `${k.toUpperCase()} +${v}`)
    .join(', ');

export function RaceDetail({ race }: { race: Race }) {
  return (
    <article className="detail">
      <h1>{race.name}</h1>
      <div className="subtitle">Race</div>
      <div className="stat-grid">
        <Stat label="Ability Score Increase" value={bonusText(race.abilityBonuses)} />
        <Stat label="Size" value={race.size} />
        <Stat label="Speed" value={`${race.speed} ft.`} />
      </div>
      <RichText text={race.desc} />
      <h3 className="rule">Traits</h3>
      {race.traits.map((t) => (
        <div key={t.name}>
          <h4>{t.name}</h4>
          <RichText text={t.desc} />
        </div>
      ))}
      <h4>Languages</h4>
      <p>{race.languages}</p>
      {race.subraces.map((s) => (
        <section key={s.id}>
          <h3 className="rule">Subrace: {s.name}</h3>
          <p>{s.desc}</p>
          <Stat label="Ability Score Increase" value={bonusText(s.abilityBonuses)} />
          {s.traits.map((t) => (
            <div key={t.name}>
              <h4>{t.name}</h4>
              <RichText text={t.desc} />
            </div>
          ))}
        </section>
      ))}
    </article>
  );
}

export function ClassDetail({ cls, homebrew = [] }: { cls: DndClass; homebrew?: HomebrewSubclass[] }) {
  const slotCols = cls.levels.some((l) => l.slots?.some((n) => n > 0))
    ? Math.max(...cls.levels.map((l) => (l.slots ? l.slots.reduce((m, n, i) => (n > 0 ? i + 1 : m), 0) : 0)))
    : 0;
  const hasCantrips = cls.levels.some((l) => l.cantrips);
  return (
    <article className="detail">
      <h1>{cls.name}</h1>
      <div className="subtitle">Class</div>
      <div className="stat-grid">
        <Stat label="Hit Die" value={`d${cls.hitDie}`} />
        <Stat label="Saving Throws" value={cls.savingThrows.map((s) => ABILITY_NAMES[s]).join(', ')} />
        <Stat label="Proficiencies" value={cls.proficiencies.join(', ')} />
        <Stat
          label="Skills"
          value={`Choose ${cls.skillChoices.choose} from ${cls.skillChoices.from.map((s) => skillById.get(s)?.name ?? s).join(', ')}`}
        />
        <Stat label="Spellcasting Ability" value={cls.spellcastingAbility ? ABILITY_NAMES[cls.spellcastingAbility] : ''} />
      </div>

      <h3 className="rule">The {cls.name}</h3>
      <div className="table-wrap">
        <table className="level-table">
          <thead>
            <tr>
              <th>Level</th>
              <th>Prof.</th>
              <th>Features</th>
              {hasCantrips && <th>Cantrips</th>}
              {Array.from({ length: slotCols }, (_, i) => (
                <th key={i}>{ordinal(i + 1)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cls.levels.map((l) => (
              <tr key={l.level}>
                <td>{ordinal(l.level)}</td>
                <td>+{l.profBonus}</td>
                <td className="features-cell">{l.features.join(', ') || '—'}</td>
                {hasCantrips && <td>{l.cantrips ?? '—'}</td>}
                {Array.from({ length: slotCols }, (_, i) => (
                  <td key={i}>{l.slots?.[i] || '—'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="rule">Class Features</h3>
      {cls.features.map((f) => (
        <details key={`${f.name}-${f.level}`} className="feature">
          <summary>
            <span>{f.name}</span>
            <span className="muted">Level {f.level}</span>
          </summary>
          <RichText text={f.desc} />
        </details>
      ))}

      {[...cls.subclasses, ...homebrew].map((s: Subclass & Partial<HomebrewSubclass>) => (
        <section key={s.id ?? s.name}>
          <h3 className="rule">
            {s.flavor ? `${s.flavor}: ` : ''}
            {s.name}
            {s.homebrew && (
              <>
                <span className="mini-tag hb">HB</span>{' '}
                <Link className="link-btn small" to={`/homebrew/subclasses/${s.id}`}>Edit</Link>
              </>
            )}
          </h3>
          <RichText text={s.desc} />
          {s.features.map((f) => (
            <details key={`${f.name}-${f.level}`} className="feature">
              <summary>
                <span>{f.name}</span>
                <span className="muted">Level {f.level}</span>
              </summary>
              <RichText text={f.desc} />
            </details>
          ))}
        </section>
      ))}
      <p className="muted small">
        Only one subclass per class is part of the free SRD. Use the buttons above to make your own.
      </p>
    </article>
  );
}
