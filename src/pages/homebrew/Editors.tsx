// One form per homebrew type. Each takes a draft and a patch function.
import { useState } from 'react';
import {
  ABILITIES,
  ABILITY_NAMES,
  type Background,
  type Feat,
  type HomebrewSubclass,
  type MagicItem,
  type Monster,
  type Race,
  type Spell,
  type Subrace,
  classById,
  classes,
  skills,
} from '../../data';
import {
  CREATURE_TYPES,
  CR_XP,
  ITEM_CATEGORIES,
  RARITIES,
  SIZES,
  SPELL_SCHOOLS,
  blankSubrace,
  itemSubtitle,
} from '../../lib/homebrew';
import { fmtMod, mod } from '../../lib/character';
import { AbilityBonusInputs, BlocksEditor, FORMATTING_HINT, Field, ListInput } from './FormParts';

type Props<T> = { draft: T; set: (patch: Partial<T>) => void };

// ---------- Spell ----------

function parseComponents(s: string) {
  const open = s.indexOf('(');
  const main = open >= 0 ? s.slice(0, open) : s;
  const material = open >= 0 ? s.slice(open + 1).replace(/\)\s*$/, '') : '';
  const flags = main.split(',').map((x) => x.trim().toUpperCase());
  return { v: flags.includes('V'), s: flags.includes('S'), m: flags.includes('M'), material };
}
function buildComponents(c: { v: boolean; s: boolean; m: boolean; material: string }) {
  const flags = [c.v && 'V', c.s && 'S', c.m && 'M'].filter(Boolean).join(', ');
  return c.m && c.material.trim() ? `${flags} (${c.material.trim()})` : flags;
}

export function SpellEditor({ draft, set }: Props<Spell>) {
  const comp = parseComponents(draft.components);
  const setComp = (patch: Partial<typeof comp>) => set({ components: buildComponents({ ...comp, ...patch }) });
  return (
    <div className="form-grid">
      <Field label="Name" wide>
        <input value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Ember Lance" autoFocus />
      </Field>
      <Field label="Level">
        <select value={draft.level} onChange={(e) => set({ level: Number(e.target.value) })}>
          {Array.from({ length: 10 }, (_, i) => (
            <option key={i} value={i}>{i === 0 ? 'Cantrip' : `Level ${i}`}</option>
          ))}
        </select>
      </Field>
      <Field label="School">
        <select value={draft.school} onChange={(e) => set({ school: e.target.value })}>
          {SPELL_SCHOOLS.map((s) => <option key={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="Casting time">
        <input value={draft.castingTime} onChange={(e) => set({ castingTime: e.target.value })} list="cast-times" />
      </Field>
      <Field label="Range">
        <input value={draft.range} onChange={(e) => set({ range: e.target.value })} list="ranges" />
      </Field>
      <Field label="Duration">
        <input value={draft.duration} onChange={(e) => set({ duration: e.target.value })} list="durations" />
      </Field>
      <div className="field">
        <span className="field-label">Components</span>
        <div className="checks">
          {(['v', 's', 'm'] as const).map((k) => (
            <label key={k} className="checkbox">
              <input type="checkbox" checked={comp[k]} onChange={(e) => setComp({ [k]: e.target.checked })} /> {k.toUpperCase()}
            </label>
          ))}
        </div>
      </div>
      {comp.m && (
        <Field label="Material" wide>
          <input value={comp.material} onChange={(e) => setComp({ material: e.target.value })} placeholder="a pinch of sulfur" />
        </Field>
      )}
      <div className="field wide">
        <div className="checks">
          <label className="checkbox">
            <input type="checkbox" checked={draft.concentration} onChange={(e) => set({ concentration: e.target.checked })} /> Concentration
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={draft.ritual} onChange={(e) => set({ ritual: e.target.checked })} /> Ritual
          </label>
        </div>
      </div>
      <div className="field wide">
        <span className="field-label">Classes that can learn it</span>
        <div className="checks">
          {classes
            .filter((c) => c.spellcastingAbility)
            .map((c) => (
              <label key={c.id} className="checkbox">
                <input
                  type="checkbox"
                  checked={draft.classes.includes(c.name)}
                  onChange={(e) => set({ classes: e.target.checked ? [...draft.classes, c.name] : draft.classes.filter((x) => x !== c.name) })}
                />{' '}
                {c.name}
              </label>
            ))}
        </div>
      </div>
      <Field label="Description" hint={FORMATTING_HINT} wide>
        <textarea rows={8} value={draft.desc} onChange={(e) => set({ desc: e.target.value })} placeholder="What the spell does…" />
      </Field>
      <Field label="At higher levels" wide>
        <textarea rows={3} value={draft.higherLevel} onChange={(e) => set({ higherLevel: e.target.value })} placeholder="Optional" />
      </Field>
      <datalist id="cast-times">
        {['1 action', '1 bonus action', '1 reaction', '1 minute', '10 minutes', '1 hour'].map((v) => <option key={v} value={v} />)}
      </datalist>
      <datalist id="ranges">
        {['Self', 'Touch', '30 feet', '60 feet', '120 feet', '150 feet', 'Self (15-foot cone)', 'Self (30-foot radius)'].map((v) => <option key={v} value={v} />)}
      </datalist>
      <datalist id="durations">
        {['Instantaneous', '1 round', 'Up to 1 minute', 'Up to 10 minutes', '1 hour', 'Up to 1 hour', '8 hours', '24 hours', 'Until dispelled'].map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
    </div>
  );
}

// ---------- Magic item ----------

export function MagicItemEditor({ draft, set }: Props<MagicItem>) {
  const patch = (p: Partial<MagicItem>) => {
    const next = { ...draft, ...p };
    set({ ...p, subtitle: itemSubtitle(next) });
  };
  return (
    <div className="form-grid">
      <Field label="Name" wide>
        <input value={draft.name} onChange={(e) => patch({ name: e.target.value })} placeholder="e.g. Lantern of Whispers" autoFocus />
      </Field>
      <Field label="Type">
        <select value={draft.category} onChange={(e) => patch({ category: e.target.value })}>
          {ITEM_CATEGORIES.map((c) => <option key={c} value={c}>{c === 'Wondrous Items' ? 'Wondrous item' : c}</option>)}
        </select>
      </Field>
      <Field label="Rarity">
        <select value={draft.rarity} onChange={(e) => patch({ rarity: e.target.value })}>
          {RARITIES.map((r) => <option key={r}>{r}</option>)}
        </select>
      </Field>
      <div className="field">
        <span className="field-label">&nbsp;</span>
        <label className="checkbox">
          <input type="checkbox" checked={draft.attunement} onChange={(e) => patch({ attunement: e.target.checked })} /> Requires attunement
        </label>
      </div>
      <Field label="Description" hint={FORMATTING_HINT} wide>
        <textarea rows={10} value={draft.desc} onChange={(e) => patch({ desc: e.target.value })} placeholder="What the item does, charges, curses…" />
      </Field>
    </div>
  );
}

// ---------- Monster ----------

export function MonsterEditor({ draft, set }: Props<Monster>) {
  const setCr = (value: string) => {
    const row = CR_XP.find(([, label]) => label === value) ?? CR_XP[4];
    set({ cr: row[0], crLabel: row[1], xp: row[2] });
  };
  return (
    <div className="form-grid">
      <Field label="Name" wide>
        <input value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Cinder Hound" autoFocus />
      </Field>
      <Field label="Size">
        <select value={draft.size} onChange={(e) => set({ size: e.target.value })}>
          {SIZES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="Type">
        <select value={draft.type} onChange={(e) => set({ type: e.target.value })}>
          {CREATURE_TYPES.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
        </select>
      </Field>
      <Field label="Subtype">
        <input value={draft.subtype} onChange={(e) => set({ subtype: e.target.value })} placeholder="Optional, e.g. goblinoid" />
      </Field>
      <Field label="Alignment">
        <input value={draft.alignment} onChange={(e) => set({ alignment: e.target.value })} />
      </Field>
      <Field label="Challenge" hint={`${draft.xp.toLocaleString()} XP`}>
        <select value={draft.crLabel} onChange={(e) => setCr(e.target.value)}>
          {CR_XP.map(([, label]) => <option key={label} value={label}>CR {label}</option>)}
        </select>
      </Field>
      <Field label="Armor class">
        <input type="number" min={1} max={30} value={draft.ac} onChange={(e) => set({ ac: Number(e.target.value) || 10 })} />
      </Field>
      <Field label="Armor type">
        <input value={draft.acType} onChange={(e) => set({ acType: e.target.value })} placeholder="natural armor" />
      </Field>
      <Field label="Hit points">
        <input type="number" min={1} value={draft.hp} onChange={(e) => set({ hp: Number(e.target.value) || 1 })} />
      </Field>
      <Field label="Hit dice">
        <input value={draft.hitDice} onChange={(e) => set({ hitDice: e.target.value })} placeholder="4d8+4" />
      </Field>
      <Field label="Speed" wide>
        <input value={draft.speed} onChange={(e) => set({ speed: e.target.value })} placeholder="30 ft., fly 60 ft." />
      </Field>

      <div className="field wide">
        <span className="field-label">Ability scores</span>
        <div className="ability-inputs">
          {ABILITIES.map((a, i) => (
            <label key={a}>
              <span>{a.toUpperCase()}</span>
              <input
                type="number"
                min={1}
                max={30}
                value={draft.abilities[i]}
                onChange={(e) => {
                  const abilities = [...draft.abilities];
                  abilities[i] = Math.min(30, Math.max(1, Number(e.target.value) || 1));
                  set({ abilities });
                }}
                aria-label={ABILITY_NAMES[a]}
              />
              <span className="muted small">{fmtMod(mod(draft.abilities[i]))}</span>
            </label>
          ))}
        </div>
      </div>

      <Field label="Saving throws" hint="Comma-separated, e.g. DEX +5, WIS +3">
        <ListInput value={draft.saves} onChange={(saves) => set({ saves })} />
      </Field>
      <Field label="Skills" hint="e.g. Perception +4, Stealth +6">
        <ListInput value={draft.skills} onChange={(skills) => set({ skills })} />
      </Field>
      <Field label="Damage resistances">
        <ListInput value={draft.resistances} onChange={(resistances) => set({ resistances })} placeholder="cold, poison" />
      </Field>
      <Field label="Damage immunities">
        <ListInput value={draft.immunities} onChange={(immunities) => set({ immunities })} placeholder="fire" />
      </Field>
      <Field label="Damage vulnerabilities">
        <ListInput value={draft.vulnerabilities} onChange={(vulnerabilities) => set({ vulnerabilities })} />
      </Field>
      <Field label="Condition immunities">
        <ListInput value={draft.conditionImmunities} onChange={(conditionImmunities) => set({ conditionImmunities })} placeholder="Charmed, Frightened" />
      </Field>
      <Field label="Senses">
        <input value={draft.senses} onChange={(e) => set({ senses: e.target.value })} placeholder="darkvision 60 ft., passive Perception 12" />
      </Field>
      <Field label="Languages">
        <input value={draft.languages} onChange={(e) => set({ languages: e.target.value })} />
      </Field>

      <div className="field wide">
        <p className="field-hint">
          Tip: write attacks like the SRD does ("+5 to hit … 7 (1d8 + 3) piercing damage") and the dice become clickable in the stat block.
        </p>
      </div>
      <div className="wide">
        <BlocksEditor title="Traits" items={draft.traits} onChange={(traits) => set({ traits })} addLabel="Add trait" namePlaceholder="e.g. Keen Smell" />
      </div>
      <div className="wide">
        <BlocksEditor title="Actions" items={draft.actions} onChange={(actions) => set({ actions })} addLabel="Add action" namePlaceholder="e.g. Bite" />
      </div>
      <div className="wide">
        <BlocksEditor title="Reactions" items={draft.reactions} onChange={(reactions) => set({ reactions })} addLabel="Add reaction" />
      </div>
      <div className="wide">
        <BlocksEditor title="Legendary actions" items={draft.legendary} onChange={(legendary) => set({ legendary })} addLabel="Add legendary action" />
      </div>
    </div>
  );
}

// ---------- Subclass ----------

export function SubclassEditor({ draft, set }: Props<HomebrewSubclass>) {
  const cls = classById.get(draft.classId);
  const srd = cls?.subclasses[0];
  // Remember whether the flavor was auto-filled so changing class can update it.
  const [autoFlavor, setAutoFlavor] = useState(!draft.flavor || draft.flavor === srd?.flavor);
  return (
    <div className="form-grid">
      <Field label="Class">
        <select
          value={draft.classId}
          onChange={(e) => {
            const next = classById.get(e.target.value);
            set({ classId: e.target.value, ...(autoFlavor ? { flavor: next?.subclasses[0]?.flavor ?? '' } : {}) });
          }}
        >
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="Name">
        <input value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Ashen Oath" autoFocus />
      </Field>
      <Field label="Subclass type" hint={srd ? `The SRD calls ${cls?.name} subclasses a "${srd.flavor}".` : undefined}>
        <input
          value={draft.flavor}
          onChange={(e) => {
            setAutoFlavor(false);
            set({ flavor: e.target.value });
          }}
        />
      </Field>
      <Field label="Description" hint={FORMATTING_HINT} wide>
        <textarea rows={4} value={draft.desc} onChange={(e) => set({ desc: e.target.value })} placeholder="Who follows this path, and what it's about." />
      </Field>
      <div className="wide">
        {srd && (
          <p className="field-hint">
            For reference, {srd.name} gets features at level {[...new Set(srd.features.map((f) => f.level))].join(', ')}.
          </p>
        )}
        <BlocksEditor
          title="Features"
          items={draft.features}
          onChange={(features) => set({ features })}
          withLevel
          addLabel="Add feature"
          namePlaceholder="Feature name"
          descPlaceholder="What the feature does"
        />
      </div>
    </div>
  );
}

// ---------- Race ----------

export function RaceEditor({ draft, set }: Props<Race>) {
  const setSub = (i: number, patch: Partial<Subrace>) =>
    set({ subraces: draft.subraces.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  return (
    <div className="form-grid">
      <Field label="Name" wide>
        <input value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Emberkin" autoFocus />
      </Field>
      <Field label="Size">
        <select value={draft.size} onChange={(e) => set({ size: e.target.value })}>
          {SIZES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="Speed (feet)">
        <input
          type="number"
          min={0}
          max={200}
          step={5}
          value={draft.speed}
          onChange={(e) => set({ speed: Math.min(200, Math.max(0, Math.round(Number(e.target.value) || 0))) })}
        />
      </Field>
      <AbilityBonusInputs value={draft.abilityBonuses} onChange={(abilityBonuses) => set({ abilityBonuses })} />
      <Field label="Description" hint={FORMATTING_HINT} wide>
        <textarea
          rows={4}
          value={draft.desc}
          onChange={(e) => set({ desc: e.target.value })}
          placeholder="Who these people are: age, typical alignment, build, where they live."
        />
      </Field>
      <Field label="Languages" wide>
        <textarea rows={2} value={draft.languages} onChange={(e) => set({ languages: e.target.value })} />
      </Field>
      <div className="wide">
        <BlocksEditor
          title="Traits"
          items={draft.traits}
          onChange={(traits) => set({ traits })}
          addLabel="Add trait"
          namePlaceholder="Trait name, e.g. Darkvision"
          descPlaceholder="What the trait does"
        />
      </div>
      <div className="wide subrace-list">
        {draft.subraces.map((s, i) => (
          <fieldset key={s.id} className="blocks-editor subrace-editor">
            <legend>Subrace {i + 1}</legend>
            <div className="block-row-head">
              <input value={s.name} onChange={(e) => setSub(i, { name: e.target.value })} placeholder="Subrace name" aria-label={`Subrace ${i + 1} name`} />
              <button
                type="button"
                className="icon-btn"
                onClick={() => set({ subraces: draft.subraces.filter((_, j) => j !== i) })}
                aria-label={`Remove ${s.name || 'subrace'}`}
              >
                ✕
              </button>
            </div>
            <textarea
              rows={2}
              value={s.desc}
              onChange={(e) => setSub(i, { desc: e.target.value })}
              placeholder="A short description"
              aria-label={`Subrace ${i + 1} description`}
            />
            <AbilityBonusInputs
              label="Extra ability score increases"
              value={s.abilityBonuses}
              onChange={(abilityBonuses) => setSub(i, { abilityBonuses })}
            />
            <BlocksEditor
              title="Subrace traits"
              items={s.traits}
              onChange={(traits) => setSub(i, { traits })}
              addLabel="Add trait"
              namePlaceholder="Trait name"
              descPlaceholder="What the trait does"
            />
          </fieldset>
        ))}
        <button type="button" className="btn small" onClick={() => set({ subraces: [...draft.subraces, blankSubrace()] })}>
          + Add subrace
        </button>
        <p className="field-hint">Optional. A subrace adds its own bonuses and traits on top of the race's.</p>
      </div>
    </div>
  );
}

// ---------- Background ----------

export function BackgroundEditor({ draft, set }: Props<Background>) {
  const feature = draft.feature ?? { name: '', desc: '' };
  return (
    <div className="form-grid">
      <Field label="Name" wide>
        <input value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Lighthouse Keeper" autoFocus />
      </Field>
      <div className="field wide">
        <span className="field-label">Skill proficiencies</span>
        <div className="checks">
          {skills.map((s) => (
            <label key={s.id} className="checkbox">
              <input
                type="checkbox"
                checked={draft.skills.includes(s.id)}
                onChange={(e) => set({ skills: e.target.checked ? [...draft.skills, s.id] : draft.skills.filter((x) => x !== s.id) })}
              />{' '}
              {s.name}
            </label>
          ))}
        </div>
        <span className="field-hint">
          Backgrounds usually give two. Characters with this background get them automatically.
          {draft.skills.length > 0 && ` Chosen: ${draft.skills.length}.`}
        </span>
      </div>
      <Field label="Tool proficiencies">
        <input value={draft.tools} onChange={(e) => set({ tools: e.target.value })} placeholder="e.g. Navigator's tools" />
      </Field>
      <Field label="Languages">
        <input value={draft.languages} onChange={(e) => set({ languages: e.target.value })} placeholder="e.g. One of your choice" />
      </Field>
      <Field label="Equipment" wide>
        <textarea
          rows={2}
          value={draft.equipment}
          onChange={(e) => set({ equipment: e.target.value })}
          placeholder="e.g. A spyglass, a lantern, common clothes, and a pouch with 10 gp"
        />
      </Field>
      <Field label="Feature name">
        <input value={feature.name} onChange={(e) => set({ feature: { ...feature, name: e.target.value } })} placeholder="e.g. Keeper of the Light" />
      </Field>
      <Field label="Feature description" hint={FORMATTING_HINT} wide>
        <textarea rows={4} value={feature.desc} onChange={(e) => set({ feature: { ...feature, desc: e.target.value } })} />
      </Field>
      <Field label="More details" hint="Optional: personality traits, ideals, bonds and flaws. A table works well." wide>
        <textarea
          rows={6}
          value={draft.desc}
          onChange={(e) => set({ desc: e.target.value })}
          placeholder={'| d6 | Personality Trait |\n|---|---|\n| 1 | I count everything, twice. |\n| 2 | I talk to the sea. |'}
        />
      </Field>
    </div>
  );
}

// ---------- Feat ----------

export function FeatEditor({ draft, set }: Props<Feat>) {
  return (
    <div className="form-grid">
      <Field label="Name">
        <input value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Storm Caller" autoFocus />
      </Field>
      <Field label="Prerequisite">
        <input value={draft.prerequisite} onChange={(e) => set({ prerequisite: e.target.value })} placeholder="e.g. Wisdom 13 or higher" />
      </Field>
      <AbilityBonusInputs value={draft.abilityBonuses} onChange={(abilityBonuses) => set({ abilityBonuses })} />
      <p className="field-hint wide">
        Only fixed increases are added to the sheet automatically, and never above 20. For "increase one score of your choice",
        leave these at 0 and raise the score on the character sheet.
      </p>
      <Field label="Description" hint={FORMATTING_HINT} wide>
        <textarea
          rows={8}
          value={draft.desc}
          onChange={(e) => set({ desc: e.target.value })}
          placeholder={'You gain the following benefits:\n\n- ...\n- ...'}
        />
      </Field>
    </div>
  );
}
