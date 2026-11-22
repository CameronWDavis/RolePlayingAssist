import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDice } from '../../components/Dice';
import { Picker, type PickerOption } from '../../components/Picker';
import { RichText } from '../../components/RichText';
import {
  ABILITY_NAMES,
  backgrounds,
  conditions,
  equipment,
  equipmentById,
  magicItemById,
  magicItems,
  spellById,
  spells,
  type Feature,
  type NamedBlock,
} from '../../data';
import { type Character, type Derived, fmtMod, newId, weaponAttack } from '../../lib/character';
import { ordinal } from '../compendium/Details';
import type { SetCharacter } from '../CharacterSheet';

type Tab = 'actions' | 'spells' | 'inventory' | 'features' | 'notes';

export function SheetTabs({ c, d, set }: { c: Character; d: Derived; set: SetCharacter }) {
  const [tab, setTab] = useState<Tab>('actions');
  const tabs: { id: Tab; label: string }[] = [
    { id: 'actions', label: 'Actions' },
    { id: 'spells', label: 'Spells' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'features', label: 'Features & Traits' },
    { id: 'notes', label: 'Notes' },
  ];
  return (
    <section className="panel tabs-panel">
      <div className="tab-bar" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="tab-body" role="tabpanel">
        {tab === 'actions' && <ActionsTab c={c} d={d} set={set} />}
        {tab === 'spells' && <SpellsTab c={c} d={d} set={set} />}
        {tab === 'inventory' && <InventoryTab c={c} set={set} />}
        {tab === 'features' && <FeaturesTab c={c} d={d} />}
        {tab === 'notes' && (
          <textarea
            className="notes"
            value={c.notes}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder="Backstory, allies, quest notes, anything you want to remember…"
            aria-label="Notes"
          />
        )}
      </div>
    </section>
  );
}

// ---------- Actions ----------

function ActionsTab({ c, d, set }: { c: Character; d: Derived; set: SetCharacter }) {
  const { roll } = useDice();
  const weapons = c.inventory
    .filter((i) => i.source === 'equipment' && i.refId && equipmentById.get(i.refId)?.weapon)
    .map((i) => equipmentById.get(i.refId!)!);
  const unarmedHit = d.mods.str + d.prof;

  return (
    <>
      <table className="attack-table">
        <thead>
          <tr>
            <th>Attack</th>
            <th>To hit</th>
            <th>Damage</th>
          </tr>
        </thead>
        <tbody>
          {weapons.map((w, idx) => {
            const a = weaponAttack(d, w);
            return (
              <tr key={`${w.id}-${idx}`}>
                <td>
                  {w.name}
                  <div className="muted small">
                    {w.weapon!.range} · {w.properties.join(', ') || 'no properties'}
                    {!a.proficient && ' · not proficient'}
                  </div>
                </td>
                <td>
                  <button className="roll-btn" onClick={() => roll(`1d20${fmtMod(a.toHit)}`, `${w.name} attack`, { d20: true })}>
                    {fmtMod(a.toHit)}
                  </button>
                </td>
                <td>
                  <button className="roll-btn wide" onClick={() => roll(a.damage, `${w.name} damage (${a.type})`)}>
                    {a.damage} {a.type}
                  </button>
                  {a.versatile && (
                    <button className="roll-btn wide" onClick={() => roll(a.versatile!, `${w.name} two-handed (${a.type})`)}>
                      {a.versatile} 2H
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
          <tr>
            <td>
              Unarmed Strike<div className="muted small">Melee</div>
            </td>
            <td>
              <button className="roll-btn" onClick={() => roll(`1d20${fmtMod(unarmedHit)}`, 'Unarmed strike', { d20: true })}>
                {fmtMod(unarmedHit)}
              </button>
            </td>
            <td>
              <button className="roll-btn wide" onClick={() => roll(String(Math.max(1, 1 + d.mods.str)), 'Unarmed strike damage')}>
                {Math.max(1, 1 + d.mods.str)} bludgeoning
              </button>
            </td>
          </tr>
          {d.spellAttack != null && (
            <tr>
              <td>
                Spell Attack<div className="muted small">{ABILITY_NAMES[d.spellAbility!]} · Save DC {d.spellDC}</div>
              </td>
              <td>
                <button className="roll-btn" onClick={() => roll(`1d20${fmtMod(d.spellAttack!)}`, 'Spell attack', { d20: true })}>
                  {fmtMod(d.spellAttack)}
                </button>
              </td>
              <td className="muted small">See the spell</td>
            </tr>
          )}
        </tbody>
      </table>
      {weapons.length === 0 && <p className="muted small">Add weapons in the Inventory tab and they'll show up here with attack and damage rolls.</p>}

      <h3>Conditions</h3>
      <div className="chips">
        {conditions.map((cond) => {
          const on = c.conditions.includes(cond.id);
          return (
            <button
              key={cond.id}
              className={`chip toggle ${on ? 'on' : ''}`}
              aria-pressed={on}
              title={cond.desc.replace(/- /g, '')}
              onClick={() => set({ conditions: on ? c.conditions.filter((x) => x !== cond.id) : [...c.conditions, cond.id] })}
            >
              {cond.name}
            </button>
          );
        })}
      </div>
    </>
  );
}

// ---------- Spells ----------

function SpellsTab({ c, d, set }: { c: Character; d: Derived; set: SetCharacter }) {
  const { roll } = useDice();
  const [picking, setPicking] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const className = d.cls?.name ?? '';
  const cantrips = d.cls?.levels[c.level - 1]?.cantrips ?? null;

  const options = useMemo<PickerOption[]>(
    () =>
      spells
        .filter((s) => showAll || (s.classes.includes(className) && s.level <= d.maxSpellLevel))
        .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
        .map((s) => ({ id: s.id, name: s.name, meta: `${s.level === 0 ? 'Cantrip' : ordinal(s.level)} · ${s.school}` })),
    [showAll, className, d.maxSpellLevel],
  );

  const known = c.spells.map((id) => spellById.get(id)).filter((s): s is NonNullable<typeof s> => !!s);
  const byLevel = Array.from({ length: 10 }, (_, lvl) => known.filter((s) => s.level === lvl));

  if (!d.spellAbility) {
    return (
      <div className="muted">
        <p>{className || 'This class'}s don't cast spells at this point in the free rules.</p>
        <p className="small">Racial spells and magic items can still be tracked in Notes or Inventory.</p>
      </div>
    );
  }

  const toggleSlot = (lvl: number, i: number) =>
    set((ch) => {
      const used = [...ch.slotsUsed];
      used[lvl] = i < used[lvl] ? i : i + 1;
      return { slotsUsed: used };
    });

  return (
    <>
      <div className="spell-stats">
        <div className="stat-box small">
          <div className="stat-label">Ability</div>
          <div className="stat-value">{d.spellAbility.toUpperCase()}</div>
        </div>
        <div className="stat-box small">
          <div className="stat-label">Save DC</div>
          <div className="stat-value">{d.spellDC}</div>
        </div>
        <button className="stat-box small clickable" onClick={() => roll(`1d20${fmtMod(d.spellAttack!)}`, 'Spell attack', { d20: true })}>
          <div className="stat-label">Attack</div>
          <div className="stat-value">{fmtMod(d.spellAttack!)}</div>
        </button>
        {cantrips != null && (
          <div className="stat-box small">
            <div className="stat-label">Cantrips known</div>
            <div className="stat-value">{byLevel[0].length}/{cantrips}</div>
          </div>
        )}
      </div>

      {d.maxSpellLevel > 0 && (
        <div className="slots">
          <h3>Spell Slots</h3>
          {d.spellSlots.map((n, lvl) =>
            n > 0 ? (
              <div className="slot-row" key={lvl}>
                <span className="slot-label">{ordinal(lvl + 1)}</span>
                {Array.from({ length: n }, (_, i) => (
                  <button
                    key={i}
                    className={`pip ${i < (c.slotsUsed[lvl] ?? 0) ? 'on' : ''}`}
                    onClick={() => toggleSlot(lvl, i)}
                    aria-label={`${ordinal(lvl + 1)} level slot ${i + 1} ${i < (c.slotsUsed[lvl] ?? 0) ? 'used' : 'available'}`}
                  />
                ))}
                <span className="muted small">{n - Math.min(n, c.slotsUsed[lvl] ?? 0)} left</span>
              </div>
            ) : null,
          )}
        </div>
      )}

      <div className="panel-head">
        <h3>Spells</h3>
        <button className="btn small primary" onClick={() => setPicking(true)}>+ Add spell</button>
      </div>
      {known.length === 0 && <p className="muted small">No spells yet. Add the ones your {className.toLowerCase()} knows or has prepared.</p>}
      {byLevel.map((list, lvl) =>
        list.length ? (
          <div key={lvl} className="spell-group">
            <h4>{lvl === 0 ? 'Cantrips' : `${ordinal(lvl)} Level`}</h4>
            {list.map((s) => (
              <details key={s.id} className="feature">
                <summary>
                  <span>
                    {s.name}
                    {s.concentration && <span className="mini-tag" title="Concentration">C</span>}
                    {s.ritual && <span className="mini-tag" title="Ritual">R</span>}
                  </span>
                  <span className="muted small">{s.castingTime} · {s.range}</span>
                </summary>
                <div className="muted small">
                  {s.components} · {s.duration}
                </div>
                <RichText text={s.desc} />
                {s.higherLevel && <RichText text={`**At Higher Levels.** ${s.higherLevel}`} />}
                <button className="link-btn danger" onClick={() => set({ spells: c.spells.filter((x) => x !== s.id) })}>
                  Remove spell
                </button>
              </details>
            ))}
          </div>
        ) : null,
      )}

      {picking && (
        <Picker
          title={showAll ? 'Add any spell' : `Add a ${className} spell (up to ${d.maxSpellLevel ? ordinal(d.maxSpellLevel) : 'cantrips'})`}
          options={options}
          isPicked={(id) => c.spells.includes(id)}
          onPick={(o) => set((ch) => ({ spells: ch.spells.includes(o.id) ? ch.spells : [...ch.spells, o.id] }))}
          onClose={() => setPicking(false)}
          footer={
            <label className="checkbox picker-footer">
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show spells from every class and level
            </label>
          }
        />
      )}
    </>
  );
}

// ---------- Inventory ----------

const itemOptions: PickerOption[] = [
  ...equipment.map((e) => ({ id: `equipment:${e.id}`, name: e.name, meta: [e.subcategory || e.category, e.cost].join(' · ') })),
  ...magicItems.map((m) => ({ id: `magic:${m.id}`, name: m.name, meta: `Magic · ${m.rarity}` })),
].sort((a, b) => a.name.localeCompare(b.name));

function InventoryTab({ c, set }: { c: Character; set: SetCharacter }) {
  const [picking, setPicking] = useState(false);
  const [customName, setCustomName] = useState('');

  const weight = c.inventory.reduce((sum, i) => {
    const w = i.source === 'equipment' && i.refId ? equipmentById.get(i.refId)?.weight ?? 0 : 0;
    return sum + w * i.qty;
  }, 0);

  const setQty = (key: string, qty: number) =>
    set((ch) => ({
      inventory: qty <= 0 ? ch.inventory.filter((i) => i.key !== key) : ch.inventory.map((i) => (i.key === key ? { ...i, qty } : i)),
    }));

  const addPicked = (o: PickerOption) => {
    const [source, refId] = o.id.split(':') as ['equipment' | 'magic', string];
    set((ch) => {
      const existing = ch.inventory.find((i) => i.refId === refId && i.source === source);
      if (existing) return { inventory: ch.inventory.map((i) => (i === existing ? { ...i, qty: i.qty + 1 } : i)) };
      return { inventory: [...ch.inventory, { key: newId(), refId, source, name: o.name, qty: 1 }] };
    });
  };

  return (
    <>
      <div className="panel-head">
        <span className="muted small">{weight ? `${Math.round(weight * 10) / 10} lb. carried` : ''}</span>
        <button className="btn small primary" onClick={() => setPicking(true)}>+ Add from compendium</button>
      </div>

      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!customName.trim()) return;
          set((ch) => ({ inventory: [...ch.inventory, { key: newId(), source: 'custom', name: customName.trim(), qty: 1 }] }));
          setCustomName('');
        }}
      >
        <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Add a custom item (e.g. Sealed letter from the duke)" aria-label="Custom item name" />
        <button className="btn small" type="submit">Add</button>
      </form>

      {c.inventory.length === 0 ? (
        <p className="muted small">Your pack is empty.</p>
      ) : (
        <ul className="inventory">
          {c.inventory.map((i) => {
            const eq = i.source === 'equipment' && i.refId ? equipmentById.get(i.refId) : undefined;
            const mi = i.source === 'magic' && i.refId ? magicItemById.get(i.refId) : undefined;
            const isArmor = eq?.armor && eq.armor.category !== 'Shield';
            const isShield = eq?.armor?.category === 'Shield';
            const worn = (isArmor && c.armorId === eq!.id) || (isShield && c.shield);
            const link = eq ? `/compendium/equipment/${eq.id}` : mi ? `/compendium/magic-items/${mi.id}` : null;
            return (
              <li key={i.key}>
                <div className="grow">
                  {link ? <Link to={link}>{i.name}</Link> : i.name}
                  <div className="muted small">
                    {eq ? [eq.detail, eq.weight ? `${eq.weight} lb.` : ''].filter(Boolean).join(' · ') : mi ? `${mi.rarity}${mi.attunement ? ' · attunement' : ''}` : 'Custom item'}
                  </div>
                </div>
                {(isArmor || isShield) && (
                  <button
                    className={`btn small ${worn ? 'primary' : ''}`}
                    onClick={() => (isShield ? set({ shield: !c.shield }) : set({ armorId: worn ? '' : eq!.id }))}
                  >
                    {worn ? 'Worn' : 'Wear'}
                  </button>
                )}
                <div className="stepper">
                  <button onClick={() => setQty(i.key, i.qty - 1)} aria-label={`Remove one ${i.name}`}>−</button>
                  <span>{i.qty}</span>
                  <button onClick={() => setQty(i.key, i.qty + 1)} aria-label={`Add one ${i.name}`}>+</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <h3>Coins</h3>
      <div className="coins">
        {(['cp', 'sp', 'gp', 'pp'] as const).map((k) => (
          <label key={k}>
            {k.toUpperCase()}
            <input
              type="number"
              min={0}
              value={c.currency[k]}
              onChange={(e) => set({ currency: { ...c.currency, [k]: Math.max(0, Number(e.target.value) || 0) } })}
            />
          </label>
        ))}
      </div>

      {picking && <Picker title="Add an item" options={itemOptions} onPick={addPicked} onClose={() => setPicking(false)} />}
    </>
  );
}

// ---------- Features ----------

function FeatureList({ title, items }: { title: string; items: (NamedBlock | Feature)[] }) {
  if (!items.length) return null;
  return (
    <div className="feature-group">
      <h3>{title}</h3>
      {items.map((f, i) => (
        <details key={`${f.name}-${i}`} className="feature">
          <summary>
            <span>{f.name}</span>
            {'level' in f && <span className="muted small">Level {f.level}</span>}
          </summary>
          <RichText text={f.desc} />
        </details>
      ))}
    </div>
  );
}

function FeaturesTab({ c, d }: { c: Character; d: Derived }) {
  const sub = d.cls?.subclasses[0];
  const subFeatures = sub?.features.filter((f) => f.level <= c.level) ?? [];
  const bg = backgrounds.find((b) => b.id === c.backgroundId);
  return (
    <>
      <FeatureList title={`${d.cls?.name ?? 'Class'} Features`} items={d.cls?.features.filter((f) => f.level <= c.level) ?? []} />
      {sub && subFeatures.length > 0 && <FeatureList title={`${sub.flavor}: ${sub.name}`} items={subFeatures} />}
      <FeatureList title={`${d.race?.name ?? 'Race'} Traits`} items={d.race?.traits ?? []} />
      {d.subrace && <FeatureList title={`${d.subrace.name} Traits`} items={d.subrace.traits} />}
      {bg?.feature && <FeatureList title={`Background: ${bg.name}`} items={[bg.feature]} />}
      {d.cls && (
        <div className="feature-group">
          <h3>Proficiencies</h3>
          <p className="small">{d.cls.proficiencies.join(', ')}</p>
          <p className="small muted">{d.race?.languages}</p>
        </div>
      )}
    </>
  );
}
