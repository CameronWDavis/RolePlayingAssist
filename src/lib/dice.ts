// Dice expression parser and roller.
// Supports: 1d20+5, 2d6 + 1d4 - 1, d20, 4d6kh3 (keep highest 3), 2d20kl1 (keep lowest 1).

export interface DiceTerm {
  sign: 1 | -1;
  count: number;
  sides: number; // 0 means a flat number (stored in count)
  keep?: { type: 'h' | 'l'; n: number };
}

export interface TermResult {
  term: DiceTerm;
  label: string;
  rolls: number[];
  kept: boolean[];
  subtotal: number;
}

export interface RollResult {
  id: string;
  label: string;
  expression: string;
  total: number;
  terms: TermResult[];
  /** Set when the roll contains exactly one kept d20. */
  natural?: number;
  time: number;
}

const TERM_RE = /([+-])?(?:(\d*)d(\d+)(?:k([hl])(\d+))?|(\d+))/gy;

export function parseDice(input: string): DiceTerm[] | null {
  const expr = input.toLowerCase().replace(/\s+/g, '');
  if (!expr) return null;
  const terms: DiceTerm[] = [];
  TERM_RE.lastIndex = 0;
  let pos = 0;
  while (pos < expr.length) {
    TERM_RE.lastIndex = pos;
    const m = TERM_RE.exec(expr);
    if (!m || m.index !== pos || m[0] === '') return null;
    // Every term after the first needs an explicit sign.
    if (terms.length > 0 && !m[1]) return null;
    const sign = m[1] === '-' ? -1 : 1;
    if (m[3]) {
      const count = m[2] ? parseInt(m[2], 10) : 1;
      const sides = parseInt(m[3], 10);
      if (count < 1 || count > 100 || sides < 2 || sides > 1000) return null;
      const term: DiceTerm = { sign, count, sides };
      if (m[4]) {
        const n = parseInt(m[5], 10);
        if (n < 1 || n > count) return null;
        term.keep = { type: m[4] as 'h' | 'l', n };
      }
      terms.push(term);
    } else {
      terms.push({ sign, count: parseInt(m[6], 10), sides: 0 });
    }
    pos = TERM_RE.lastIndex;
  }
  return terms;
}

function randomInt(sides: number): number {
  const buf = new Uint32Array(1);
  // Rejection sampling keeps every face equally likely.
  const limit = Math.floor(0x1_0000_0000 / sides) * sides;
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return (buf[0] % sides) + 1;
}

export function termLabel(t: DiceTerm): string {
  if (t.sides === 0) return String(t.count);
  return `${t.count}d${t.sides}${t.keep ? `k${t.keep.type}${t.keep.n}` : ''}`;
}

export function formatExpression(terms: DiceTerm[]): string {
  return terms
    .map((t, i) => `${i === 0 ? (t.sign < 0 ? '-' : '') : t.sign < 0 ? ' - ' : ' + '}${termLabel(t)}`)
    .join('');
}

export function roll(expression: string, label = ''): RollResult | null {
  const terms = parseDice(expression);
  if (!terms) return null;
  const results: TermResult[] = terms.map((term) => {
    if (term.sides === 0) {
      return { term, label: termLabel(term), rolls: [], kept: [], subtotal: term.sign * term.count };
    }
    const rolls = Array.from({ length: term.count }, () => randomInt(term.sides));
    let kept = rolls.map(() => true);
    if (term.keep) {
      const order = rolls
        .map((v, i) => ({ v, i }))
        .sort((a, b) => (term.keep!.type === 'h' ? b.v - a.v : a.v - b.v));
      const keepIdx = new Set(order.slice(0, term.keep.n).map((o) => o.i));
      kept = rolls.map((_, i) => keepIdx.has(i));
    }
    const sum = rolls.reduce((acc, v, i) => (kept[i] ? acc + v : acc), 0);
    return { term, label: termLabel(term), rolls, kept, subtotal: term.sign * sum };
  });

  const d20s = results.filter((r) => r.term.sides === 20);
  let natural: number | undefined;
  if (d20s.length === 1) {
    const keptVals = d20s[0].rolls.filter((_, i) => d20s[0].kept[i]);
    if (keptVals.length === 1) natural = keptVals[0];
  }

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label,
    expression: formatExpression(terms),
    total: results.reduce((a, r) => a + r.subtotal, 0),
    terms: results,
    natural,
    time: Date.now(),
  };
}

/** Rewrites a single leading 1d20 to 2d20kh1 / 2d20kl1 for advantage / disadvantage. */
export function applyRollMode(expression: string, mode: 'normal' | 'advantage' | 'disadvantage'): string {
  if (mode === 'normal') return expression;
  const keep = mode === 'advantage' ? 'kh1' : 'kl1';
  return expression.replace(/^\s*1?d20(?![\dk])/i, `2d20${keep}`);
}
