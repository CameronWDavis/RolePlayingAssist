import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCharacters } from '../components/CharacterStore';
import { useDice } from '../components/Dice';
import { ABILITIES, ABILITY_NAMES, type Ability, backgrounds, classes, equipment, races, skillById } from '../data';
import { type Character, derive, fmtMod } from '../lib/character';
import { downloadCharacter } from './Characters';
import { SheetTabs } from './sheet/SheetTabs';

const ALIGNMENTS = [
  'Lawful Good', 'Neutral Good', 'Chaotic Good',
  'Lawful Neutral', 'True Neutral', 'Chaotic Neutral',
  'Lawful Evil', 'Neutral Evil', 'Chaotic Evil', 'Unaligned',
];

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
// Which abilities matter most for each class, used to place the standard array.
const PRIORITY: Record<string, Ability[]> = {
  barbarian: ['str', 'con', 'dex', 'wis', 'cha', 'int'],
  bard: ['cha', 'dex', 'con', 'wis', 'int', 'str'],
  cleric: ['wis', 'con', 'str', 'dex', 'cha', 'int'],
  druid: ['wis', 'con', 'dex', 'int', 'cha', 'str'],
  fighter: ['str', 'con', 'dex', 'wis', 'cha', 'int'],
  monk: ['dex', 'wis', 'con', 'str', 'int', 'cha'],
  paladin: ['str', 'cha', 'con', 'wis', 'dex', 'int'],
  ranger: ['dex', 'wis', 'con', 'str', 'int', 'cha'],
  rogue: ['dex', 'con', 'int', 'wis', 'cha', 'str'],
  sorcerer: ['cha', 'con', 'dex', 'wis', 'int', 'str'],
  warlock: ['cha', 'con', 'dex', 'wis', 'int', 'str'],
  wizard: ['int', 'con', 'dex', 'wis', 'cha', 'str'],
};

const armors = equipment.filter((e) => e.armor && e.armor.category !== 'Shield');

export default function CharacterSheet() {
  const { id } = useParams();
  const { get, update, remove } = useCharacters();
  const navigate = useNavigate();
  const c = id ? get(id) : undefined;

  if (!c) {
    return (
      <div className="page empty-state">
        <h2>Character not found</h2>
        <p className="muted">It may have been deleted, or it was saved in a different browser.</p>
        <Link className="btn primary" to="/characters">Back to My Characters</Link>
      </div>
    );
  }

  return (
    <Sheet
      c={c}
      set={(patch) => update(c.id, patch)}
      onDelete={() => {
        if (window.confirm(`Delete ${c.name}? This can't be undone unless you've exported them.`)) {
          remove(c.id);
          navigate('/characters');
        }
      }}
    />
  );
}

export type SetCharacter = (patch: Partial<Character> | ((c: Character) => Partial<Character>)) => void;

function Sheet({ c, set, onDelete }: { c: Character; set: SetCharacter; onDelete: () => void }) {
  const d = derive(c);
  const { roll } = useDice();
  const [amount, setAmount] = useState('');
  const hp = c.hpCurrent < 0 ? d.hpMax : Math.min(c.hpCurrent, d.hpMax);
  const hd = d.cls?.hitDie ?? 8;
  const hitDiceLeft = Math.max(0, c.level - c.hitDiceUsed);

  const classSkillCount = c.skillProfs.filter((s) => d.cls?.skillChoices.from.includes(s)).length;

  const applyDamage = () => {
    const n = Math.abs(parseInt(amount, 10));
    if (!n) return;
    const fromTemp = Math.min(c.hpTemp, n);
    set({ hpTemp: c.hpTemp - fromTemp, hpCurrent: Math.max(0, hp - (n - fromTemp)) });
    setAmount('');
  };
  const applyHeal = (n = Math.abs(parseInt(amount, 10))) => {
    if (!n) return;
    set({ hpCurrent: Math.min(d.hpMax, hp + n), deathSaves: { success: 0, fail: 0 } });
    setAmount('');
  };

  const spendHitDie = () => {
    if (hitDiceLeft <= 0) return;
    const r = roll(`1d${hd}${d.mods.con ? fmtMod(d.mods.con) : ''}`, 'Hit die (short rest)');
    if (r) set({ hitDiceUsed: c.hitDiceUsed + 1, hpCurrent: Math.min(d.hpMax, hp + Math.max(0, r.total)) });
  };

  const longRest = () =>
    set({
      hpCurrent: d.hpMax,
      hpTemp: 0,
      slotsUsed: [0, 0, 0, 0, 0, 0, 0, 0, 0],
      hitDiceUsed: Math.max(0, c.hitDiceUsed - Math.max(1, Math.floor(c.level / 2))),
      deathSaves: { success: 0, fail: 0 },
    });

  const rollDeathSave = () => {
    const r = roll('1d20', 'Death saving throw');
    if (!r) return;
    const { success, fail } = c.deathSaves;
    if (r.total === 20) set({ hpCurrent: 1, deathSaves: { success: 0, fail: 0 } });
    else if (r.total === 1) set({ deathSaves: { success, fail: Math.min(3, fail + 2) } });
    else if (r.total >= 10) set({ deathSaves: { success: Math.min(3, success + 1), fail } });
    else set({ deathSaves: { success, fail: Math.min(3, fail + 1) } });
  };

  const cycleSkill = (skillId: string, fromBackground: boolean) =>
    set((ch) => {
      const prof = ch.skillProfs.includes(skillId) || fromBackground;
      const exp = ch.expertise.includes(skillId);
      if (exp) {
        return {
          expertise: ch.expertise.filter((s) => s !== skillId),
          skillProfs: ch.skillProfs.filter((s) => s !== skillId),
        };
      }
      if (prof) return { expertise: [...ch.expertise, skillId] };
      return { skillProfs: [...ch.skillProfs, skillId] };
    });

  const applyStandardArray = () => {
    const order = PRIORITY[c.classId] ?? ABILITIES;
    const scores = { ...c.baseScores };
    order.forEach((a, i) => (scores[a] = STANDARD_ARRAY[i]));
    set({ baseScores: scores });
  };

  const rollScores = () => {
    if (!window.confirm('Roll 4d6 (drop the lowest) for each ability? This replaces your current scores.')) return;
    const scores = { ...c.baseScores };
    for (const a of ABILITIES) {
      const r = roll('4d6kh3', `${ABILITY_NAMES[a]} score`);
      if (r) scores[a] = r.total;
    }
    set({ baseScores: scores });
  };

  return (
    <div className="page sheet">
      {/* ---------- Header ---------- */}
      <header className="sheet-head panel">
        <div className="avatar big" aria-hidden="true">{c.name.trim().charAt(0).toUpperCase() || '?'}</div>
        <div className="sheet-title">
          <input className="name-input" value={c.name} onChange={(e) => set({ name: e.target.value })} aria-label="Character name" />
          <div className="muted">
            Level {c.level} {d.subrace?.name ?? d.race?.name} {d.cls?.name}
            {d.cls?.subclasses[0] && c.level >= (d.cls.subclasses[0].features[0]?.level ?? 3) && ` · ${d.cls.subclasses[0].name}`}
          </div>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => downloadCharacter(c)}>Export</button>
          <button className="btn danger" onClick={onDelete}>Delete</button>
        </div>
      </header>

      {/* ---------- Basics ---------- */}
      <section className="panel basics">
        <label>
          Race
          <select
            value={c.raceId}
            onChange={(e) => {
              const r = races.find((x) => x.id === e.target.value);
              set({ raceId: e.target.value, subraceId: r?.subraces[0]?.id ?? '' });
            }}
          >
            {races.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        {d.race && d.race.subraces.length > 0 && (
          <label>
            Subrace
            <select value={c.subraceId} onChange={(e) => set({ subraceId: e.target.value })}>
              <option value="">None</option>
              {d.race.subraces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        )}
        <label>
          Class
          <select
            value={c.classId}
            onChange={(e) => set({ classId: e.target.value, skillProfs: [], expertise: [], slotsUsed: [0, 0, 0, 0, 0, 0, 0, 0, 0] })}
          >
            {classes.map((cl) => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
          </select>
        </label>
        <label>
          Level
          <select value={c.level} onChange={(e) => set({ level: Number(e.target.value), hitDiceUsed: Math.min(c.hitDiceUsed, Number(e.target.value)) })}>
            {Array.from({ length: 20 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
          </select>
        </label>
        <label>
          Background
          <select value={c.backgroundId} onChange={(e) => set({ backgroundId: e.target.value })}>
            <option value="">Custom / none</option>
            {backgrounds.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <label>
          Alignment
          <select value={c.alignment} onChange={(e) => set({ alignment: e.target.value })}>
            {ALIGNMENTS.map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>
        <label>
          Player
          <input value={c.playerName} onChange={(e) => set({ playerName: e.target.value })} placeholder="Your name" />
        </label>
      </section>

      {/* ---------- Ability scores ---------- */}
      <section className="panel">
        <div className="panel-head">
          <h2>Ability Scores</h2>
          <div className="actions">
            <button className="btn small" onClick={applyStandardArray} title="15, 14, 13, 12, 10, 8 placed for your class">
              Standard array
            </button>
            <button className="btn small" onClick={rollScores}>Roll 4d6</button>
          </div>
        </div>
        <div className="abilities">
          {ABILITIES.map((a) => {
            const bonus = (d.race?.abilityBonuses[a] ?? 0) + (d.subrace?.abilityBonuses[a] ?? 0);
            return (
              <div className="ability" key={a}>
                <div className="ability-name">{ABILITY_NAMES[a]}</div>
                <button
                  className="ability-mod"
                  onClick={() => roll(`1d20${fmtMod(d.mods[a])}`, `${ABILITY_NAMES[a]} check`, { d20: true })}
                  title={`Roll a ${ABILITY_NAMES[a]} check`}
                >
                  {fmtMod(d.mods[a])}
                </button>
                <div className="ability-score">{d.scores[a]}</div>
                <div className="ability-base">
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={c.baseScores[a]}
                    onChange={(e) =>
                      set({ baseScores: { ...c.baseScores, [a]: Math.max(1, Math.min(30, Number(e.target.value) || 1)) } })
                    }
                    aria-label={`${ABILITY_NAMES[a]} base score`}
                  />
                  {bonus !== 0 && <span className="muted small">{fmtMod(bonus)} race</span>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------- Combat stats ---------- */}
      <section className="stat-strip">
        <div className="stat-box">
          <div className="stat-label">Armor Class</div>
          <div className="stat-value">{d.ac}</div>
          <div className="stat-note">{d.acNote}</div>
        </div>
        <button className="stat-box clickable" onClick={() => roll(`1d20${fmtMod(d.initiative)}`, 'Initiative', { d20: true })}>
          <div className="stat-label">Initiative</div>
          <div className="stat-value">{fmtMod(d.initiative)}</div>
          <div className="stat-note">click to roll</div>
        </button>
        <div className="stat-box">
          <div className="stat-label">Speed</div>
          <div className="stat-value">{d.speed}<small> ft.</small></div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Proficiency</div>
          <div className="stat-value">{fmtMod(d.prof)}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Passive Perception</div>
          <div className="stat-value">{d.passivePerception}</div>
        </div>
        <button className={`stat-box clickable ${c.inspiration ? 'lit' : ''}`} onClick={() => set({ inspiration: !c.inspiration })} aria-pressed={c.inspiration}>
          <div className="stat-label">Inspiration</div>
          <div className="stat-value">{c.inspiration ? '★' : '☆'}</div>
        </button>
      </section>

      <div className="sheet-grid">
        {/* ---------- Left column ---------- */}
        <div className="sheet-col">
          <section className="panel">
            <h2>Saving Throws</h2>
            <ul className="check-list">
              {ABILITIES.map((a) => (
                <li key={a}>
                  <span className={`prof-dot ${d.saves[a].proficient ? 'p1' : ''}`} aria-label={d.saves[a].proficient ? 'Proficient' : 'Not proficient'} />
                  <span className="grow">{ABILITY_NAMES[a]}</span>
                  <button className="roll-btn" onClick={() => roll(`1d20${fmtMod(d.saves[a].value)}`, `${ABILITY_NAMES[a]} save`, { d20: true })}>
                    {fmtMod(d.saves[a].value)}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Skills</h2>
              {d.cls && (
                <span className={`muted small ${classSkillCount > d.cls.skillChoices.choose ? 'warn' : ''}`}>
                  {d.cls.name} skills: {classSkillCount}/{d.cls.skillChoices.choose}
                </span>
              )}
            </div>
            <p className="muted small hint">Click the circle to cycle: not proficient → proficient → expertise. Highlighted skills are ones your class can pick.</p>
            <ul className="check-list">
              {d.skills.map((s) => {
                const classOption = d.cls?.skillChoices.from.includes(s.id);
                return (
                  <li key={s.id} className={classOption ? 'class-skill' : ''}>
                    <button
                      className={`prof-dot p${s.prof}`}
                      onClick={() => cycleSkill(s.id, s.fromBackground)}
                      aria-label={`${s.name}: ${['not proficient', 'proficient', 'expertise'][s.prof]}`}
                      title={s.fromBackground ? 'Proficient from your background' : undefined}
                    />
                    <span className="grow">
                      {s.name} <span className="muted small">{s.ability.toUpperCase()}</span>
                      {s.fromBackground && <span className="mini-tag" title="From background">BG</span>}
                    </span>
                    <button className="roll-btn" onClick={() => roll(`1d20${fmtMod(s.value)}`, `${skillById.get(s.id)?.name} check`, { d20: true })}>
                      {fmtMod(s.value)}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        {/* ---------- Right column ---------- */}
        <div className="sheet-col wide">
          <section className="panel hp-panel">
            <div className="panel-head">
              <h2>Hit Points</h2>
              <div className="actions">
                <button className="btn small" onClick={spendHitDie} disabled={hitDiceLeft === 0 || hp >= d.hpMax} title="Roll a hit die and heal">
                  Spend hit die ({hitDiceLeft}/{c.level} d{hd})
                </button>
                <button className="btn small" onClick={longRest}>Long rest</button>
              </div>
            </div>
            <div className="hp-row">
              <div className="hp-numbers">
                <div>
                  <div className="stat-label">Current</div>
                  <div className={`hp-current ${hp === 0 ? 'down' : hp <= d.hpMax / 2 ? 'bloodied' : ''}`}>{hp}</div>
                </div>
                <div className="hp-slash">/</div>
                <div>
                  <div className="stat-label">Max</div>
                  <div className="hp-max">{d.hpMax}</div>
                </div>
                <div>
                  <div className="stat-label">Temp</div>
                  <input
                    className="temp-input"
                    type="number"
                    min={0}
                    value={c.hpTemp}
                    onChange={(e) => set({ hpTemp: Math.max(0, Number(e.target.value) || 0) })}
                    aria-label="Temporary hit points"
                  />
                </div>
              </div>
              <form className="hp-adjust" onSubmit={(e) => e.preventDefault()}>
                <input
                  type="number"
                  min={0}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Amount"
                  aria-label="Damage or healing amount"
                />
                <button className="btn danger" onClick={applyDamage} type="button">Damage</button>
                <button className="btn heal" onClick={() => applyHeal()} type="button">Heal</button>
              </form>
            </div>
            <div className="hp-bar" aria-hidden="true">
              <div style={{ width: `${(hp / d.hpMax) * 100}%` }} />
              {c.hpTemp > 0 && <div className="temp" style={{ width: `${Math.min(100, (c.hpTemp / d.hpMax) * 100)}%` }} />}
            </div>
            {hp === 0 && (
              <div className="death-saves">
                <strong>Death Saves</strong>
                <span>
                  Successes{' '}
                  {[0, 1, 2].map((i) => (
                    <button key={i} className={`pip ${i < c.deathSaves.success ? 'on success' : ''}`}
                      onClick={() => set({ deathSaves: { ...c.deathSaves, success: i < c.deathSaves.success ? i : i + 1 } })}
                      aria-label={`Success ${i + 1}`} />
                  ))}
                </span>
                <span>
                  Failures{' '}
                  {[0, 1, 2].map((i) => (
                    <button key={i} className={`pip ${i < c.deathSaves.fail ? 'on fail' : ''}`}
                      onClick={() => set({ deathSaves: { ...c.deathSaves, fail: i < c.deathSaves.fail ? i : i + 1 } })}
                      aria-label={`Failure ${i + 1}`} />
                  ))}
                </span>
                <button className="btn small" onClick={rollDeathSave}>Roll death save</button>
                {c.deathSaves.success >= 3 && <span className="tag">Stable</span>}
                {c.deathSaves.fail >= 3 && <span className="tag tag-fumble">Dead</span>}
              </div>
            )}
            <details className="hp-settings">
              <summary>Max HP and armor settings</summary>
              <div className="settings-grid">
                <label>
                  Bonus max HP
                  <input type="number" value={c.hpBonus} onChange={(e) => set({ hpBonus: Number(e.target.value) || 0 })} />
                  <span className="muted small">Max HP uses the fixed average per level. Add feats or traits here (e.g. Hill Dwarf +{c.level}).</span>
                </label>
                <label>
                  Armor worn
                  <select value={c.armorId} onChange={(e) => set({ armorId: e.target.value })}>
                    <option value="">None</option>
                    {armors.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.detail})</option>)}
                  </select>
                </label>
                <label className="checkbox">
                  <input type="checkbox" checked={c.shield} onChange={(e) => set({ shield: e.target.checked })} /> Shield (+2 AC)
                </label>
                <label>
                  Other AC bonus
                  <input type="number" value={c.acBonus} onChange={(e) => set({ acBonus: Number(e.target.value) || 0 })} />
                </label>
              </div>
            </details>
          </section>

          <SheetTabs c={c} d={d} set={set} />
        </div>
      </div>
    </div>
  );
}
