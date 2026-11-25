import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useBlocker, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useHomebrew } from '../../components/HomebrewStore';
import { RichText } from '../../components/RichText';
import {
  type HomebrewSubclass,
  type MagicItem,
  type Monster,
  type Spell,
  classById,
  magicItemById,
  monsters as srdMonsters,
  spellById,
} from '../../data';
import {
  type HomebrewKind,
  KIND_LABELS,
  blankMagicItem,
  blankMonster,
  blankSpell,
  blankSubclass,
  homebrewId,
} from '../../lib/homebrew';
import { MagicItemDetail, MonsterDetail, SpellDetail } from '../compendium/Details';
import { MagicItemEditor, MonsterEditor, SpellEditor, SubclassEditor } from './Editors';

/** URL slug ↔ storage key. Slugs match the compendium's so links feel consistent. */
export const KIND_SLUGS: Record<string, HomebrewKind> = {
  spells: 'spells',
  'magic-items': 'magicItems',
  monsters: 'monsters',
  subclasses: 'subclasses',
};
export const slugFor = (kind: HomebrewKind) => Object.keys(KIND_SLUGS).find((s) => KIND_SLUGS[s] === kind)!;

/** Where an entry lives in the compendium once saved. */
export function compendiumPath(kind: HomebrewKind, entry: { id: string; classId?: string }) {
  if (kind === 'subclasses') return `/compendium/classes/${entry.classId}`;
  return `/compendium/${slugFor(kind)}/${entry.id}`;
}

type Draft = Spell | MagicItem | Monster | HomebrewSubclass;

function startingDraft(kind: HomebrewKind, from: string | null, classParam: string | null): Draft {
  // "from" copies an SRD entry so you can tweak it instead of starting blank.
  const copy = <T extends object>(src: T | undefined) =>
    src ? ({ ...structuredClone(src), id: homebrewId(), homebrew: true } as T) : undefined;
  switch (kind) {
    case 'spells':
      return copy(from ? spellById.get(from) : undefined) ?? blankSpell();
    case 'magicItems':
      return copy(from ? magicItemById.get(from) : undefined) ?? blankMagicItem();
    case 'monsters':
      return copy(from ? srdMonsters.find((m) => m.id === from) : undefined) ?? blankMonster();
    case 'subclasses': {
      const classId = classParam && classById.has(classParam) ? classParam : 'fighter';
      const srd = classById.get(classId)?.subclasses[0];
      if (from === 'srd' && srd) return { ...blankSubclass(classId), ...structuredClone(srd), id: homebrewId(), classId, homebrew: true };
      return blankSubclass(classId, srd?.flavor ?? '');
    }
  }
}

/**
 * Remounts the editor whenever the route changes (e.g. back/forward from a monster to a new spell),
 * so a form never keeps the previous entry's draft.
 */
export default function HomebrewEditRoute() {
  const { kind = '', id = 'new' } = useParams();
  const { search } = useLocation();
  return <HomebrewEditor key={`${kind}/${id}${search}`} />;
}

function HomebrewEditor() {
  const { kind: slug = '', id = 'new' } = useParams();
  const [params] = useSearchParams();
  const kind = KIND_SLUGS[slug];
  const hb = useHomebrew();
  const navigate = useNavigate();

  const existing = useMemo(
    () => (kind && id !== 'new' ? (hb.data[kind] as Draft[]).find((x) => x.id === id) : undefined),
    // Only look this up once per route, so saving doesn't reset the form.
    [kind, id],
  );
  const [initial] = useState<Draft | null>(() =>
    kind ? (existing ? structuredClone(existing) : id === 'new' ? startingDraft(kind, params.get('from'), params.get('class')) : null) : null,
  );
  const [draft, setDraft] = useState<Draft | null>(initial);
  const [saved, setSaved] = useState(false);
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(initial) && !saved;

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // Warn before leaving through an in-app link (top menu, breadcrumbs, back button).
  // Save, Cancel and Delete set `leaving` first, since they've already handled the question.
  const leaving = useRef(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      !leaving.current &&
      (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search),
  );
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm('You have unsaved changes. Leave without saving?')) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  if (!kind || !draft) {
    return (
      <div className="page empty-state">
        <h2>Homebrew not found</h2>
        <p className="muted">It may have been deleted.</p>
        <Link className="btn primary" to="/homebrew">Back to Homebrew</Link>
      </div>
    );
  }

  const label = KIND_LABELS[kind].one;
  const set = (patch: Partial<Draft>) => {
    setSaved(false);
    setDraft((d) => ({ ...d!, ...patch }) as Draft);
  };
  const canSave = draft.name.trim().length > 0;

  const save = () => {
    if (!canSave) return;
    const entry = { ...draft, name: draft.name.trim(), homebrew: true } as Draft;
    hb.upsert(kind, entry);
    setSaved(true);
    leaving.current = true;
    navigate(compendiumPath(kind, entry as { id: string; classId?: string }));
  };

  const cancel = () => {
    if (dirty && !window.confirm('Discard your unsaved changes?')) return;
    leaving.current = true;
    navigate(`/homebrew?tab=${slug}`);
  };

  const del = () => {
    if (!window.confirm(`Delete "${draft.name || 'this homebrew'}"? This can't be undone unless you've exported it.`)) return;
    hb.remove(kind, draft.id);
    leaving.current = true;
    navigate(`/homebrew?tab=${slug}`);
  };

  const previewName = draft.name.trim() || `Untitled ${label.toLowerCase()}`;

  return (
    <div className="page homebrew-edit">
      <div className="page-head">
        <div>
          <div className="crumbs">
            <Link to={`/homebrew?tab=${slug}`}>Homebrew</Link> / {KIND_LABELS[kind].many}
          </div>
          <h1>{existing ? `Edit ${label}` : `New ${label}`}</h1>
        </div>
        <div className="actions">
          {existing && <button className="btn danger" onClick={del}>Delete</button>}
          <button className="btn" onClick={cancel}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={!canSave} title={canSave ? undefined : 'Give it a name first'}>
            Save {label.toLowerCase()}
          </button>
        </div>
      </div>

      <div className="editor-layout">
        <form
          className="panel editor-form"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          {kind === 'spells' && <SpellEditor draft={draft as Spell} set={set} />}
          {kind === 'magicItems' && <MagicItemEditor draft={draft as MagicItem} set={set} />}
          {kind === 'monsters' && <MonsterEditor draft={draft as Monster} set={set} />}
          {kind === 'subclasses' && <SubclassEditor draft={draft as HomebrewSubclass} set={set} />}
          <div className="editor-footer">
            {!canSave && <span className="muted small">Give it a name to save.</span>}
            <button className="btn primary" type="submit" disabled={!canSave}>
              Save {label.toLowerCase()}
            </button>
          </div>
        </form>

        <aside className="editor-preview" aria-label="Preview">
          <div className="preview-label">Preview</div>
          {kind === 'spells' && <SpellDetail spell={{ ...(draft as Spell), name: previewName }} />}
          {kind === 'magicItems' && <MagicItemDetail item={{ ...(draft as MagicItem), name: previewName }} />}
          {kind === 'monsters' && <MonsterDetail monster={{ ...(draft as Monster), name: previewName }} />}
          {kind === 'subclasses' && <SubclassPreview sub={{ ...(draft as HomebrewSubclass), name: previewName }} />}
        </aside>
      </div>
    </div>
  );
}

export function SubclassPreview({ sub }: { sub: HomebrewSubclass }) {
  const cls = classById.get(sub.classId);
  const features = [...sub.features].sort((a, b) => a.level - b.level);
  return (
    <article className="detail">
      <h1>{sub.name}</h1>
      <div className="subtitle">
        {cls?.name} subclass{sub.flavor && ` · ${sub.flavor}`}
      </div>
      <RichText text={sub.desc} />
      {features.map((f, i) => (
        <div key={i}>
          <h4>
            {f.name || 'Unnamed feature'} <span className="muted small">Level {f.level}</span>
          </h4>
          <RichText text={f.desc} />
        </div>
      ))}
    </article>
  );
}
