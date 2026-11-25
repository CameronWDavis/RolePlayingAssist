// Holds the user's homebrew in memory, mirrors it to localStorage, and offers
// merged SRD + homebrew lookups so the compendium and character sheet see both.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  type HomebrewSubclass,
  type MagicItem,
  type Spell,
  magicItemById as srdItemById,
  magicItems as srdItems,
  spellById as srdSpellById,
  spells as srdSpells,
} from '../data';
import {
  HOMEBREW_STORAGE_KEY,
  type HomebrewData,
  type HomebrewKind,
  loadHomebrew,
  saveHomebrew,
} from '../lib/homebrew';

type Entry<K extends HomebrewKind> = HomebrewData[K][number];

interface HomebrewApi {
  data: HomebrewData;
  saveFailed: boolean;
  /** Adds the entry, or replaces the existing one with the same id. */
  upsert: <K extends HomebrewKind>(kind: K, entry: Entry<K>) => void;
  remove: (kind: HomebrewKind, id: string) => void;
  /**
   * Merges an imported pack and returns how many entries were added vs. updated.
   * Entries with the same id are replaced, unless keepExisting is set (used when a character
   * file carries homebrew: your own edited copy wins over the one inside the file).
   */
  merge: (incoming: HomebrewData, opts?: { keepExisting?: boolean }) => { added: number; updated: number };
  allSpells: Spell[];
  allMagicItems: MagicItem[];
  getSpell: (id: string) => Spell | undefined;
  getMagicItem: (id: string) => MagicItem | undefined;
  subclassesFor: (classId: string) => HomebrewSubclass[];
}

const Ctx = createContext<HomebrewApi | null>(null);

export function HomebrewProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<HomebrewData>(loadHomebrew);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    setSaveFailed(!saveHomebrew(data));
  }, [data]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === HOMEBREW_STORAGE_KEY) setData(loadHomebrew());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const upsert = useCallback(<K extends HomebrewKind>(kind: K, entry: Entry<K>) => {
    setData((d) => {
      const list = d[kind] as Entry<K>[];
      const exists = list.some((x) => x.id === entry.id);
      return { ...d, [kind]: exists ? list.map((x) => (x.id === entry.id ? entry : x)) : [...list, entry] };
    });
  }, []);

  const remove = useCallback((kind: HomebrewKind, id: string) => {
    setData((d) => ({ ...d, [kind]: (d[kind] as { id: string }[]).filter((x) => x.id !== id) }));
  }, []);

  const merge = useCallback(
    (incoming: HomebrewData, opts?: { keepExisting?: boolean }) => {
      let added = 0;
      let updated = 0;
      const next = { ...data };
      for (const kind of Object.keys(incoming) as HomebrewKind[]) {
        const list = [...(next[kind] as { id: string }[])];
        for (const entry of incoming[kind] as { id: string }[]) {
          const i = list.findIndex((x) => x.id === entry.id);
          if (i >= 0 && opts?.keepExisting) continue;
          if (i >= 0) {
            list[i] = entry;
            updated++;
          } else {
            list.push(entry);
            added++;
          }
        }
        (next as Record<HomebrewKind, unknown>)[kind] = list;
      }
      setData(next);
      return { added, updated };
    },
    [data],
  );

  const api = useMemo<HomebrewApi>(() => {
    const hbSpells = new Map(data.spells.map((s) => [s.id, s]));
    const hbItems = new Map(data.magicItems.map((m) => [m.id, m]));
    return {
      data,
      saveFailed,
      upsert,
      remove,
      merge,
      allSpells: [...srdSpells, ...data.spells],
      allMagicItems: [...srdItems, ...data.magicItems],
      getSpell: (id) => srdSpellById.get(id) ?? hbSpells.get(id),
      getMagicItem: (id) => srdItemById.get(id) ?? hbItems.get(id),
      subclassesFor: (classId) => data.subclasses.filter((s) => s.classId === classId),
    };
  }, [data, saveFailed, upsert, remove, merge]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useHomebrew(): HomebrewApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useHomebrew must be used inside HomebrewProvider');
  return ctx;
}
