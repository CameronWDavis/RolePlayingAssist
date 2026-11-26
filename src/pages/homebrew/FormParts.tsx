// Small form building blocks shared by the homebrew editors.
import { useState, type ReactNode } from 'react';
import { ABILITIES, ABILITY_NAMES, type Ability, type Feature, type NamedBlock } from '../../data';

export function Field({ label, hint, children, wide = false }: { label: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`field ${wide ? 'wide' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

/** Comma-separated list input that keeps what you type (spaces included) until it's parsed. */
export function ListInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [text, setText] = useState(value.join(', '));
  return (
    <input
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        setText(e.target.value);
        onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean));
      }}
      onBlur={() => setText(value.join(', '))}
    />
  );
}

type Block = NamedBlock | Feature;

/** Editable list of named text blocks: monster actions, traits, or subclass features (withLevel). */
export function BlocksEditor<T extends Block>({
  title,
  items,
  onChange,
  withLevel = false,
  addLabel = 'Add',
  namePlaceholder = 'Name',
  descPlaceholder = 'Description',
}: {
  title: string;
  items: T[];
  onChange: (items: T[]) => void;
  withLevel?: boolean;
  addLabel?: string;
  namePlaceholder?: string;
  descPlaceholder?: string;
}) {
  const update = (i: number, patch: Partial<Feature>) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <fieldset className="blocks-editor">
      <legend>{title}</legend>
      {items.map((it, i) => (
        <div className="block-row" key={i}>
          <div className="block-row-head">
            <input value={it.name} onChange={(e) => update(i, { name: e.target.value })} placeholder={namePlaceholder} aria-label={`${title} ${i + 1} name`} />
            {withLevel && (
              <select
                value={(it as Feature).level ?? 1}
                onChange={(e) => update(i, { level: Number(e.target.value) })}
                aria-label={`${title} ${i + 1} level`}
              >
                {Array.from({ length: 20 }, (_, n) => (
                  <option key={n + 1} value={n + 1}>Level {n + 1}</option>
                ))}
              </select>
            )}
            <div className="block-row-tools">
              <button type="button" className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
              <button type="button" className="icon-btn" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Move down">↓</button>
              <button type="button" className="icon-btn" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={`Remove ${it.name || 'entry'}`}>✕</button>
            </div>
          </div>
          <textarea
            rows={3}
            value={it.desc}
            onChange={(e) => update(i, { desc: e.target.value })}
            placeholder={descPlaceholder}
            aria-label={`${title} ${i + 1} description`}
          />
        </div>
      ))}
      <button
        type="button"
        className="btn small"
        onClick={() => {
          // New features default to the same level as the last one, which is usually what you want next.
          const lastLevel = (items[items.length - 1] as Feature | undefined)?.level ?? 3;
          const blank = withLevel ? { name: '', level: lastLevel, desc: '' } : { name: '', desc: '' };
          onChange([...items, blank as T]);
        }}
      >
        + {addLabel}
      </button>
    </fieldset>
  );
}

export const FORMATTING_HINT = 'Supports **bold**, *italic*, "## " headings, "- " bullet lists and | pipe | tables |. Leave a blank line between paragraphs.';

/** Six small number boxes for ability score bonuses (race, subrace or feat). Zero means none. */
export function AbilityBonusInputs({
  value,
  onChange,
  label = 'Ability score increases',
}: {
  value: Partial<Record<Ability, number>>;
  onChange: (v: Partial<Record<Ability, number>>) => void;
  label?: string;
}) {
  return (
    <div className="field wide">
      <span className="field-label">{label}</span>
      <div className="ability-inputs">
        {ABILITIES.map((a) => (
          <label key={a}>
            {a.toUpperCase()}
            <input
              type="number"
              min={-10}
              max={10}
              value={value[a] ?? 0}
              onChange={(e) => {
                const n = Math.min(10, Math.max(-10, Math.round(Number(e.target.value) || 0)));
                const next = { ...value };
                if (n) next[a] = n;
                else delete next[a];
                onChange(next);
              }}
              aria-label={`${ABILITY_NAMES[a]} bonus`}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
