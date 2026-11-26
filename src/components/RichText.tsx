// Renders the lightweight markdown used in SRD text: paragraphs, "#" headings, **bold**,
// ***bold italic***, *italic* or _italic_, "- " bullet lists, "1. " numbered lists and pipe tables.
import { Fragment, type ReactNode } from 'react';

function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|_[^_]+_)/g);
  return parts.map((p, i) => {
    if (p.startsWith('***') && p.endsWith('***')) return <strong key={i}><em>{p.slice(3, -3)}</em></strong>;
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith('*') && p.endsWith('*') && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>;
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

const BULLET = /^\s*[-•]\s/;
const NUMBERED = /^\s*\d+\.\s/;
const HEADING = /^(#{1,6})\s+(.*)$/;

/**
 * Collects list items, allowing blank lines between them (SRD text often has them),
 * and returns the items plus the index of the first line after the list.
 */
function collectList(lines: string[], start: number, pattern: RegExp) {
  const items: string[] = [];
  let i = start;
  while (i < lines.length) {
    if (pattern.test(lines[i])) items.push(lines[i++].replace(pattern, ''));
    else if (!lines[i].trim()) {
      let j = i;
      while (j < lines.length && !lines[j].trim()) j++;
      if (j < lines.length && pattern.test(lines[j])) i = j;
      else break;
    } else break;
  }
  return { items, next: i };
}

export function RichText({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split(/\r?\n/);
  const out: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const heading = line.match(HEADING);
    if (heading) {
      // Pages already have an h1 title, so "#"/"##" start at h3 and deeper levels follow on.
      const level = Math.min(6, Math.max(3, heading[1].length + 1));
      const Tag = `h${level}` as 'h3' | 'h4' | 'h5' | 'h6';
      out.push(<Tag key={out.length} className="rich-heading">{inline(heading[2])}</Tag>);
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
    if (BULLET.test(line) || NUMBERED.test(line)) {
      const numbered = !BULLET.test(line);
      const { items, next } = collectList(lines, i, numbered ? NUMBERED : BULLET);
      i = next;
      const List = numbered ? 'ol' : 'ul';
      out.push(
        <List key={out.length}>
          {items.map((it, k) => <li key={k}>{inline(it)}</li>)}
        </List>,
      );
      continue;
    }
    out.push(<p key={out.length}>{inline(line)}</p>);
    i++;
  }
  return <div className="rich">{out}</div>;
}
