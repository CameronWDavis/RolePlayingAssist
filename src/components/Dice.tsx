// Dice system: a context any page can roll through, a floating tray that shows
// the latest roll, and the full roller panel used on the Dice page and in the tray.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { applyRollMode, parseDice, roll as rollDice, type RollResult } from '../lib/dice';
import { load, save } from '../lib/storage';

export type RollMode = 'normal' | 'advantage' | 'disadvantage';

interface DiceApi {
  history: RollResult[];
  mode: RollMode;
  setMode: (m: RollMode) => void;
  /** Rolls an expression. Pass d20: true for checks, saves and attacks so advantage applies. */
  roll: (expression: string, label?: string, opts?: { d20?: boolean }) => RollResult | null;
  clear: () => void;
  trayOpen: boolean;
  setTrayOpen: (open: boolean) => void;
}

const DiceContext = createContext<DiceApi | null>(null);
const HISTORY_KEY = 'grimoire.rollHistory.v1';

export function DiceProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<RollResult[]>(() => load<RollResult[]>(HISTORY_KEY, []));
  const [mode, setMode] = useState<RollMode>('normal');
  const [trayOpen, setTrayOpen] = useState(false);

  useEffect(() => {
    save(HISTORY_KEY, history.slice(0, 50));
  }, [history]);

  const roll = useCallback<DiceApi['roll']>(
    (expression, label = '', opts) => {
      const expr = opts?.d20 ? applyRollMode(expression, mode) : expression;
      const result = rollDice(expr, label);
      if (result) {
        setHistory((h) => [result, ...h].slice(0, 50));
        // A one-shot advantage/disadvantage resets after it is used.
        if (opts?.d20 && mode !== 'normal') setMode('normal');
      }
      return result;
    },
    [mode],
  );

  const value = useMemo<DiceApi>(
    () => ({ history, mode, setMode, roll, clear: () => setHistory([]), trayOpen, setTrayOpen }),
    [history, mode, roll, trayOpen],
  );
  return <DiceContext.Provider value={value}>{children}</DiceContext.Provider>;
}

export function useDice(): DiceApi {
  const ctx = useContext(DiceContext);
  if (!ctx) throw new Error('useDice must be used inside DiceProvider');
  return ctx;
}

// ---------- Display ----------

export function RollBreakdown({ r }: { r: RollResult }) {
  return (
    <span className="breakdown">
      {r.terms.map((t, i) => (
        <span key={i}>
          {i > 0 && <span className="op">{t.term.sign < 0 ? ' − ' : ' + '}</span>}
          {t.term.sides === 0 ? (
            <span>{t.term.count}</span>
          ) : (
            <span>
              [
              {t.rolls.map((v, j) => (
                <span
                  key={j}
                  className={[
                    'die-val',
                    !t.kept[j] && 'dropped',
                    t.term.sides === 20 && v === 20 && t.kept[j] && 'crit',
                    t.term.sides === 20 && v === 1 && t.kept[j] && 'fumble',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {v}
                  {j < t.rolls.length - 1 ? ', ' : ''}
                </span>
              ))}
              ]
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

function RollRow({ r, big = false }: { r: RollResult; big?: boolean }) {
  const crit = r.natural === 20;
  const fumble = r.natural === 1;
  return (
    <div className={`roll-row ${big ? 'big' : ''} ${crit ? 'is-crit' : ''} ${fumble ? 'is-fumble' : ''}`}>
      <div className="roll-main">
        <div className="roll-label">
          {r.label || 'Roll'} <span className="muted">{r.expression}</span>
        </div>
        <div className="roll-detail">
          <RollBreakdown r={r} />
          {crit && <span className="tag tag-crit">Natural 20!</span>}
          {fumble && <span className="tag tag-fumble">Natural 1</span>}
        </div>
      </div>
      <div className="roll-total">{r.total}</div>
    </div>
  );
}

const DICE = [4, 6, 8, 10, 12, 20, 100];

export function DicePanel({ compact = false }: { compact?: boolean }) {
  const { roll, history, mode, setMode, clear } = useDice();
  const [pool, setPool] = useState<Record<number, number>>({});
  const [modifier, setModifier] = useState(0);
  const [custom, setCustom] = useState('');
  const [error, setError] = useState('');

  const poolExpr = useMemo(() => {
    const dice = DICE.filter((d) => pool[d])
      .map((d) => `${pool[d]}d${d}`)
      .join(' + ');
    if (!dice) return '';
    return modifier ? `${dice} ${modifier < 0 ? '-' : '+'} ${Math.abs(modifier)}` : dice;
  }, [pool, modifier]);

  const rollPool = () => {
    if (!poolExpr) return;
    const onlyD20 = DICE.every((d) => d === 20 || !pool[d]) && pool[20] === 1;
    roll(poolExpr, '', { d20: onlyD20 });
    setPool({});
  };

  const rollCustom = () => {
    if (!parseDice(custom)) {
      setError('Try something like 2d6+3, d20, or 4d6kh3');
      return;
    }
    setError('');
    roll(custom, '', { d20: /^\s*1?d20/i.test(custom) });
  };

  return (
    <div className={`dice-panel ${compact ? 'compact' : ''}`}>
      <div className="dice-grid">
        {DICE.map((d) => (
          <button
            key={d}
            className={`die-btn ${pool[d] ? 'active' : ''}`}
            onClick={() => setPool((p) => ({ ...p, [d]: (p[d] ?? 0) + 1 }))}
            onContextMenu={(e) => {
              e.preventDefault();
              setPool((p) => ({ ...p, [d]: Math.max(0, (p[d] ?? 0) - 1) }));
            }}
            title="Click to add, right-click to remove"
          >
            <DieIcon sides={d} />
            <span>d{d}</span>
            {pool[d] ? <span className="die-count">{pool[d]}</span> : null}
          </button>
        ))}
      </div>

      <div className="dice-controls">
        <label className="mod-input">
          Modifier
          <div className="stepper">
            <button onClick={() => setModifier((m) => m - 1)} aria-label="Decrease modifier">−</button>
            <span>{modifier >= 0 ? `+${modifier}` : modifier}</span>
            <button onClick={() => setModifier((m) => m + 1)} aria-label="Increase modifier">+</button>
          </div>
        </label>
        <div className="segmented" role="group" aria-label="Roll mode">
          {(['disadvantage', 'normal', 'advantage'] as RollMode[]).map((m) => (
            <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
              {m === 'normal' ? 'Normal' : m === 'advantage' ? 'Adv' : 'Dis'}
            </button>
          ))}
        </div>
      </div>

      <div className="dice-actions">
        <button className="btn primary grow" disabled={!poolExpr} onClick={rollPool}>
          {poolExpr ? `Roll ${poolExpr}` : 'Pick some dice'}
        </button>
        {poolExpr && (
          <button className="btn" onClick={() => { setPool({}); setModifier(0); }}>
            Reset
          </button>
        )}
      </div>

      <form
        className="custom-roll"
        onSubmit={(e) => {
          e.preventDefault();
          rollCustom();
        }}
      >
        <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Custom: 2d6+1d4+3, 4d6kh3…" aria-label="Custom dice expression" />
        <button className="btn" type="submit">Roll</button>
      </form>
      {error && <div className="error-text">{error}</div>}

      <div className="history-head">
        <h3>History</h3>
        {history.length > 0 && <button className="link-btn" onClick={clear}>Clear</button>}
      </div>
      <div className="history">
        {history.length === 0 && <div className="muted empty">No rolls yet.</div>}
        {history.slice(0, compact ? 12 : 50).map((r, i) => (
          <RollRow key={r.id} r={r} big={i === 0} />
        ))}
      </div>
    </div>
  );
}

export function DieIcon({ sides }: { sides: number }) {
  // Simple silhouettes so each die is recognisable at a glance.
  const shapes: Record<number, string> = {
    4: 'M12 2 L22 20 L2 20 Z',
    6: 'M4 4 H20 V20 H4 Z',
    8: 'M12 2 L22 12 L12 22 L2 12 Z',
    10: 'M12 2 L22 10 L12 22 L2 10 Z',
    12: 'M12 2 L21 8 L18 20 L6 20 L3 8 Z',
    20: 'M12 2 L21 7 L21 17 L12 22 L3 17 L3 7 Z',
    100: 'M12 2 L21 7 L21 17 L12 22 L3 17 L3 7 Z',
  };
  return (
    <svg viewBox="0 0 24 24" className="die-icon" aria-hidden="true">
      <path d={shapes[sides]} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

/** Floating button + latest-roll toast + slide-out tray. Rendered once in the app shell. */
export function DiceTray() {
  const { history, trayOpen, setTrayOpen } = useDice();
  const [toast, setToast] = useState<RollResult | null>(null);
  const lastId = useRef(history[0]?.id);

  useEffect(() => {
    const latest = history[0];
    if (latest && latest.id !== lastId.current) {
      lastId.current = latest.id;
      if (!trayOpen) {
        setToast(latest);
        const t = setTimeout(() => setToast(null), 4500);
        return () => clearTimeout(t);
      }
    }
  }, [history, trayOpen]);

  return (
    <>
      {toast && !trayOpen && (
        <div className="roll-toast" onClick={() => setTrayOpen(true)} role="status">
          <RollRow r={toast} big />
        </div>
      )}
      <button className="tray-fab" onClick={() => setTrayOpen(!trayOpen)} aria-label="Open dice tray">
        <DieIcon sides={20} />
      </button>
      {trayOpen && (
        <>
          <div className="tray-backdrop" onClick={() => setTrayOpen(false)} />
          <aside className="tray" aria-label="Dice tray">
            <div className="tray-head">
              <h2>Dice</h2>
              <button className="icon-btn" onClick={() => setTrayOpen(false)} aria-label="Close dice tray">✕</button>
            </div>
            <DicePanel compact />
          </aside>
        </>
      )}
    </>
  );
}
