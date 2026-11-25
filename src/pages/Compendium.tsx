import { useMemo, useState, type ReactNode } from 'react';
import { useHomebrew } from '../components/HomebrewStore';
import type { HomebrewData } from '../lib/homebrew';
import { Link, NavLink, Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  classes,
  conditions,
  equipment,
  magicItems,
  monsters,
  races,
  spells,
  type Condition,
  type DndClass,
  type Equipment,
  type MagicItem,
  type Monster,
  type Race,
  type Spell,
} from '../data';
import {
  ClassDetail,
  ConditionDetail,
  EquipmentDetail,
  MagicItemDetail,
  MonsterDetail,
  RaceDetail,
  SpellDetail,
  ordinal,
} from './compendium/Details';
import { DetailActions } from './compendium/DetailActions';

interface Base {
  id: string;
  name: string;
}

interface Filter<T> {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  test: (item: T, value: string) => boolean;
}

interface Category<T extends Base> {
  id: string;
  label: string;
  items: T[];
  meta: (item: T) => ReactNode;
  badge?: (item: T) => ReactNode;
  filters: Filter<T>[];
  sorts?: { key: string; label: string; compare: (a: T, b: T) => number }[];
  detail: (item: T) => ReactNode;
}

const uniq = (arr: string[]) => [...new Set(arr)].sort().map((v) => ({ value: v, label: v }));
const define = <T extends Base>(c: Category<T>) => c as unknown as Category<Base>;
const byName = (a: Base, b: Base) => a.name.localeCompare(b.name);

const RARITY_ORDER = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact', 'Varies'];

const sourceFilter = <T extends Base & { homebrew?: boolean }>(): Filter<T> => ({
  key: 'source',
  label: 'Source',
  options: [
    { value: 'srd', label: 'Official (SRD)' },
    { value: 'homebrew', label: 'Homebrew' },
  ],
  test: (x, v) => (v === 'homebrew' ? !!x.homebrew : !x.homebrew),
});
const hbTag = (x: { homebrew?: boolean }) => (x.homebrew ? <span className="mini-tag hb" title="Homebrew">HB</span> : null);

function buildCategories(hb: HomebrewData): Category<Base>[] {
  const allSpells = [...spells, ...hb.spells];
  const allMonsters = [...monsters, ...hb.monsters];
  const allItems = [...magicItems, ...hb.magicItems];
  return [
  define<Spell>({
    id: 'spells',
    label: 'Spells',
    items: [...allSpells].sort(byName),
    meta: (s) => `${s.level === 0 ? 'Cantrip' : `${ordinal(s.level)} level`} · ${s.school}`,
    badge: (s) => (
      <>
        {s.concentration && <span className="mini-tag" title="Concentration">C</span>}
        {s.ritual && <span className="mini-tag" title="Ritual">R</span>}
        {hbTag(s)}
      </>
    ),
    filters: [
      {
        key: 'level',
        label: 'Level',
        options: Array.from({ length: 10 }, (_, i) => ({ value: String(i), label: i === 0 ? 'Cantrip' : ordinal(i) })),
        test: (s, v) => s.level === Number(v),
      },
      { key: 'class', label: 'Class', options: uniq(allSpells.flatMap((s) => s.classes)), test: (s, v) => s.classes.includes(v) },
      { key: 'school', label: 'School', options: uniq(allSpells.map((s) => s.school)), test: (s, v) => s.school === v },
      sourceFilter<Spell>(),
    ],
    sorts: [
      { key: 'name', label: 'Name', compare: byName },
      { key: 'level', label: 'Level', compare: (a, b) => a.level - b.level || byName(a, b) },
    ],
    detail: (s) => <SpellDetail spell={s} />,
  }),
  define<Monster>({
    id: 'monsters',
    label: 'Monsters',
    items: [...allMonsters].sort(byName),
    meta: (m) => `CR ${m.crLabel} · ${m.size} ${m.type}`,
    badge: hbTag,
    filters: [
      {
        key: 'cr',
        label: 'Challenge',
        options: [
          { value: '0-1', label: 'CR 0 – 1' },
          { value: '2-4', label: 'CR 2 – 4' },
          { value: '5-10', label: 'CR 5 – 10' },
          { value: '11-16', label: 'CR 11 – 16' },
          { value: '17-30', label: 'CR 17+' },
        ],
        test: (m, v) => {
          const [lo, hi] = v.split('-').map(Number);
          return m.cr >= lo && m.cr <= hi;
        },
      },
      { key: 'type', label: 'Type', options: uniq(allMonsters.map((m) => m.type)), test: (m, v) => m.type === v },
      { key: 'size', label: 'Size', options: uniq(allMonsters.map((m) => m.size)), test: (m, v) => m.size === v },
      sourceFilter<Monster>(),
    ],
    sorts: [
      { key: 'name', label: 'Name', compare: byName },
      { key: 'cr', label: 'Challenge', compare: (a, b) => a.cr - b.cr || byName(a, b) },
    ],
    detail: (m) => <MonsterDetail monster={m} />,
  }),
  define<MagicItem>({
    id: 'magic-items',
    label: 'Magic Items',
    items: [...allItems].sort(byName),
    meta: (m) => `${m.category} · ${m.rarity}`,
    badge: (m) => (
      <>
        {m.attunement && <span className="mini-tag" title="Requires attunement">A</span>}
        {hbTag(m)}
      </>
    ),
    filters: [
      {
        key: 'rarity',
        label: 'Rarity',
        options: RARITY_ORDER.filter((r) => allItems.some((m) => m.rarity === r)).map((r) => ({ value: r, label: r })),
        test: (m, v) => m.rarity === v,
      },
      { key: 'category', label: 'Type', options: uniq(allItems.map((m) => m.category)), test: (m, v) => m.category === v },
      {
        key: 'attune',
        label: 'Attunement',
        options: [
          { value: 'yes', label: 'Requires attunement' },
          { value: 'no', label: 'No attunement' },
        ],
        test: (m, v) => m.attunement === (v === 'yes'),
      },
      sourceFilter<MagicItem>(),
    ],
    detail: (m) => <MagicItemDetail item={m} />,
  }),
  define<Equipment>({
    id: 'equipment',
    label: 'Equipment',
    items: [...equipment].sort(byName),
    meta: (e) => [e.subcategory || e.category, e.cost].filter(Boolean).join(' · '),
    filters: [
      { key: 'category', label: 'Category', options: uniq(equipment.map((e) => e.category)), test: (e, v) => e.category === v },
      {
        key: 'sub',
        label: 'Subcategory',
        options: uniq(equipment.map((e) => e.subcategory).filter(Boolean)),
        test: (e, v) => e.subcategory === v,
      },
    ],
    detail: (e) => <EquipmentDetail item={e} />,
  }),
  define<DndClass>({
    id: 'classes',
    label: 'Classes',
    items: classes,
    meta: (c) => `d${c.hitDie} hit die${c.spellcastingAbility ? ' · Spellcaster' : ''}`,
    filters: [],
    detail: (c) => <ClassDetail cls={c} homebrew={hb.subclasses.filter((s) => s.classId === c.id)} />,
  }),
  define<Race>({
    id: 'races',
    label: 'Races',
    items: races,
    meta: (r) => `${r.size} · ${r.speed} ft.${r.subraces.length ? ` · ${r.subraces.map((s) => s.name).join(', ')}` : ''}`,
    filters: [],
    detail: (r) => <RaceDetail race={r} />,
  }),
  define<Condition>({
    id: 'conditions',
    label: 'Conditions',
    items: conditions,
    meta: () => 'Condition',
    filters: [],
    detail: (c) => <ConditionDetail condition={c} />,
  }),
  ];
}

export default function Compendium() {
  const { category = 'spells', id } = useParams();
  const hb = useHomebrew();
  const categories = useMemo(() => buildCategories(hb.data), [hb.data]);
  const cat = categories.find((c) => c.id === category);
  if (!cat) return <Navigate to="/compendium/spells" replace />;
  return (
    <div className="compendium">
      <nav className="cat-tabs" aria-label="Compendium sections">
        {categories.map((c) => (
          <NavLink key={c.id} to={`/compendium/${c.id}`} className={({ isActive }) => (isActive ? 'on' : '')}>
            {c.label}
            <span className="count">{c.items.length}</span>
          </NavLink>
        ))}
      </nav>
      {/* key resets search & filters when the category changes */}
      <CategoryBrowser key={cat.id} cat={cat} selectedId={id} />
    </div>
  );
}

function CategoryBrowser({ cat, selectedId }: { cat: Category<Base>; selectedId?: string }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState(cat.sorts?.[0]?.key ?? 'name');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = cat.items.filter((item) => {
      if (q && !item.name.toLowerCase().includes(q)) return false;
      return cat.filters.every((f) => !filters[f.key] || f.test(item, filters[f.key]));
    });
    const sorter = cat.sorts?.find((s) => s.key === sort);
    if (sorter) list = [...list].sort(sorter.compare);
    return list;
  }, [cat, query, filters, sort]);

  const selected = selectedId ? cat.items.find((i) => i.id === selectedId) : undefined;
  const activeFilters = Object.values(filters).filter(Boolean).length;

  return (
    <div className={`browser ${selected ? 'has-selection' : ''}`}>
      <div className="list-pane">
        <div className="list-controls">
          <input
            type="search"
            placeholder={`Search ${cat.label.toLowerCase()}…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={`Search ${cat.label}`}
          />
          {(cat.filters.length > 0 || (cat.sorts?.length ?? 0) > 1) && (
            <div className="filter-row">
              {cat.filters.map((f) => (
                <select
                  key={f.key}
                  value={filters[f.key] ?? ''}
                  onChange={(e) => setFilters((s) => ({ ...s, [f.key]: e.target.value }))}
                  aria-label={f.label}
                  className={filters[f.key] ? 'active' : ''}
                >
                  <option value="">{f.label}: Any</option>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ))}
              {cat.sorts && cat.sorts.length > 1 && (
                <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by">
                  {cat.sorts.map((s) => (
                    <option key={s.key} value={s.key}>
                      Sort: {s.label}
                    </option>
                  ))}
                </select>
              )}
              {activeFilters > 0 && (
                <button className="link-btn" onClick={() => setFilters({})}>
                  Clear filters
                </button>
              )}
            </div>
          )}
          <div className="result-count muted">
            {results.length} of {cat.items.length}
          </div>
        </div>
        <ul className="result-list">
          {results.map((item) => (
            <li key={item.id}>
              <Link
                to={`/compendium/${cat.id}/${item.id}`}
                className={item.id === selectedId ? 'selected' : ''}
                aria-current={item.id === selectedId ? 'true' : undefined}
              >
                <span className="r-name">
                  {item.name}
                  {cat.badge?.(item)}
                </span>
                <span className="r-meta">{cat.meta(item)}</span>
              </Link>
            </li>
          ))}
          {results.length === 0 && <li className="muted empty">Nothing matches. Try a different search.</li>}
        </ul>
      </div>
      <div className="detail-pane">
        {selected ? (
          <>
            <button className="btn back-btn" onClick={() => navigate(`/compendium/${cat.id}`)}>
              ← Back to {cat.label}
            </button>
            <DetailActions category={cat.id} item={selected} />
            {cat.detail(selected)}
          </>
        ) : (
          <div className="detail-empty">
            <p>Pick something from the list to read it here.</p>
            <p className="muted small">Tip: in monster stat blocks, click any dice or "to hit" bonus to roll it.</p>
          </div>
        )}
      </div>
    </div>
  );
}
