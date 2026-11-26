import { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useHomebrew } from '../../components/HomebrewStore';
import { classById, classes } from '../../data';
import {
  type HomebrewData,
  type HomebrewKind,
  KINDS,
  KIND_LABELS,
  countHomebrew,
  emptyHomebrew,
  homebrewId,
  makePack,
  parsePack,
  compendiumPath,
  slugFor,
} from '../../lib/homebrew';

function download(filename: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface Row {
  id: string;
  name: string;
  meta: string;
  classId?: string;
}

function rowsFor(kind: HomebrewKind, data: HomebrewData): Row[] {
  const byName = (a: Row, b: Row) => a.name.localeCompare(b.name);
  switch (kind) {
    case 'spells':
      return data.spells.map((s) => ({ id: s.id, name: s.name, meta: `${s.level === 0 ? 'Cantrip' : `Level ${s.level}`} · ${s.school}` })).sort(byName);
    case 'magicItems':
      return data.magicItems.map((m) => ({ id: m.id, name: m.name, meta: m.subtitle })).sort(byName);
    case 'monsters':
      return data.monsters.map((m) => ({ id: m.id, name: m.name, meta: `CR ${m.crLabel} · ${m.size} ${m.type}` })).sort(byName);
    case 'subclasses':
      return data.subclasses
        .map((s) => ({ id: s.id, name: s.name, meta: `${classById.get(s.classId)?.name ?? s.classId} · ${s.features.length} features`, classId: s.classId }))
        .sort(byName);
  }
}

export default function HomebrewHome() {
  const hb = useHomebrew();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const slug = params.get('tab') ?? 'magic-items';
  const kind = KINDS.find((k) => slugFor(k) === slug) ?? 'magicItems';
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [subclassClass, setSubclassClass] = useState('fighter');

  const total = countHomebrew(hb.data);
  const rows = rowsFor(kind, hb.data);
  const label = KIND_LABELS[kind];

  const onImport = async (file: File) => {
    try {
      const incoming = parsePack(await file.text());
      const { added, updated } = hb.merge(incoming);
      setMessage({ kind: 'ok', text: `Imported ${added} new and updated ${updated} existing homebrew ${added + updated === 1 ? 'entry' : 'entries'}.` });
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'Import failed.' });
    }
  };

  const exportOne = (row: Row) => {
    const pack = emptyHomebrew();
    const entry = (hb.data[kind] as { id: string }[]).find((x) => x.id === row.id);
    if (!entry) return;
    (pack[kind] as unknown[]).push(entry);
    download(`${row.name.replace(/[^\w\- ]+/g, '').trim() || 'homebrew'}.json`, makePack(pack, row.name));
  };

  const duplicate = (row: Row) => {
    const entry = (hb.data[kind] as { id: string; name: string }[]).find((x) => x.id === row.id);
    if (!entry) return;
    hb.upsert(kind, { ...structuredClone(entry), id: homebrewId(), name: `${entry.name} (copy)` } as never);
  };

  const del = (row: Row) => {
    if (window.confirm(`Delete "${row.name}"? This can't be undone unless you've exported it.`)) hb.remove(kind, row.id);
  };

  const newPath = kind === 'subclasses' ? `/homebrew/subclasses/new?class=${subclassClass}` : `/homebrew/${slug}/new`;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Homebrew</h1>
          <p className="muted">
            Make your own magic items, spells, monsters and subclasses. They show up in the compendium and on character sheets next to the
            official rules. Saved in this browser. Export a pack to back it up or share it with your table.
          </p>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => fileRef.current?.click()}>Import pack</button>
          <button className="btn" disabled={total === 0} onClick={() => download('grimoire-homebrew.json', makePack(hb.data, 'All homebrew'))}>
            Export all ({total})
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {message && (
        <div className={`banner ${message.kind === 'error' ? 'error' : 'ok'}`} role="status">
          {message.text}
          <button className="icon-btn" onClick={() => setMessage(null)} aria-label="Dismiss">✕</button>
        </div>
      )}
      {hb.saveFailed && <div className="banner error">Your browser is blocking storage, so homebrew won't be saved after you close this tab. Export a pack to keep it.</div>}

      <nav className="cat-tabs" aria-label="Homebrew types">
        {KINDS.map((k) => (
          <button key={k} className={k === kind ? 'on' : ''} onClick={() => setParams({ tab: slugFor(k) })}>
            {KIND_LABELS[k].many}
            <span className="count">{hb.data[k].length}</span>
          </button>
        ))}
      </nav>

      <div className="panel">
        <div className="panel-head">
          <h2>Your {label.many.toLowerCase()}</h2>
          <div className="actions">
            {kind === 'subclasses' && (
              <select value={subclassClass} onChange={(e) => setSubclassClass(e.target.value)} aria-label="Class for the new subclass">
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            <button className="btn primary" onClick={() => navigate(newPath)}>+ New {label.one.toLowerCase()}</button>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="empty-state compact">
            <p>No homebrew {label.many.toLowerCase()} yet.</p>
            <p className="muted small">
              Start from scratch, or open any {kind === 'subclasses' ? 'class' : label.one.toLowerCase()} in the{' '}
              <Link to={`/compendium/${kind === 'subclasses' ? 'classes' : slug}`}>compendium</Link> and choose "Make a homebrew copy".
            </p>
          </div>
        ) : (
          <ul className="hb-list">
            {rows.map((r) => (
              <li key={r.id}>
                <Link to={compendiumPath(kind, r)} className="grow">
                  <span className="r-name">{r.name}</span>
                  <span className="r-meta">{r.meta}</span>
                </Link>
                <div className="actions">
                  <Link className="btn small" to={`/homebrew/${slug}/${r.id}`}>Edit</Link>
                  <button className="link-btn" onClick={() => duplicate(r)}>Duplicate</button>
                  <button className="link-btn" onClick={() => exportOne(r)}>Export</button>
                  <button className="link-btn danger" onClick={() => del(r)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
