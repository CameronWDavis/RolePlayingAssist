// Renders the lightweight markdown used in SRD text: paragraphs, **bold**, ***bold italic***,
// "- " bullet lists and pipe tables.
import { Fragment, type ReactNode } from 'react';

function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|_[^_]+_)/g);
  return parts.map((p, i) => {
    if (p.startsWith('***') && p.endsWith('***')) return <strong key={i}><em>{p.slice(3, -3)}</em></strong>;
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith('_') && p.endsWith('_') && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>;
    return <Fragment key={i}>{p}</Fragment>;
  });
}

const cells = (row: string) =>
  row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());

export function RichText({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split('\n');
  const out: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.trim().startsWith('|')) {
      const rows: string[] = [];
      // SRD data often puts a blank line between table rows, so skip blanks that sit inside a table.
      while (i < lines.length) {
        if (lines[i].trim().startsWith('|')) rows.push(lines[i++]);
        else if (!lines[i].trim()) {
          let j = i;
          while (j < lines.length && !lines[j].trim()) j++;
          if (j < lines.length && lines[j].trim().startsWith('|')) i = j;
          else break;
        } else break;
      }
      const body = rows.filter((r) => !/^\|?[\s:|-]+\|?$/.test(r.trim()));
      const [head, ...rest] = body;
      out.push(
        <div className="table-wrap" key={out.length}>
          <table>
            {head && (
              <thead>
                <tr>{cells(head).map((c, j) => <th key={j}>{inline(c)}</th>)}</tr>
              </thead>
            )}
            <tbody>
              {rest.map((r, k) => (
                <tr key={k}>{cells(r).map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*[-•]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-•]\s/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-•]\s/, ''));
      out.push(
        <ul key={out.length}>
          {items.map((it, k) => <li key={k}>{inline(it)}</li>)}
        </ul>,
      );
      continue;
    }
    out.push(<p key={out.length}>{inline(line)}</p>);
    i++;
  }
  return <div className="rich">{out}</div>;
}
