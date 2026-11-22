// Holds all characters in memory and mirrors them to localStorage.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { type Character, createCharacter, loadCharacters, newId, saveCharacters } from '../lib/character';

interface Store {
  characters: Character[];
  saveFailed: boolean;
  get: (id: string) => Character | undefined;
  create: () => Character;
  add: (c: Character) => void;
  update: (id: string, patch: Partial<Character> | ((c: Character) => Partial<Character>)) => void;
  duplicate: (id: string) => Character | undefined;
  remove: (id: string) => void;
}

const StoreContext = createContext<Store | null>(null);

export function CharacterStoreProvider({ children }: { children: ReactNode }) {
  const [characters, setCharacters] = useState<Character[]>(loadCharacters);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    setSaveFailed(!saveCharacters(characters));
  }, [characters]);

  // Keep tabs in sync if the user has the app open twice.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'grimoire.characters.v1') setCharacters(loadCharacters());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const update = useCallback<Store['update']>((id, patch) => {
    setCharacters((list) =>
      list.map((c) => (c.id === id ? { ...c, ...(typeof patch === 'function' ? patch(c) : patch), updatedAt: Date.now() } : c)),
    );
  }, []);

  const store = useMemo<Store>(
    () => ({
      characters,
      saveFailed,
      get: (id) => characters.find((c) => c.id === id),
      create: () => {
        const c = createCharacter();
        setCharacters((list) => [c, ...list]);
        return c;
      },
      add: (c) => setCharacters((list) => [c, ...list]),
      update,
      duplicate: (id) => {
        const src = characters.find((c) => c.id === id);
        if (!src) return undefined;
        const copy = { ...structuredClone(src), id: newId(), name: `${src.name} (copy)`, createdAt: Date.now(), updatedAt: Date.now() };
        setCharacters((list) => [copy, ...list]);
        return copy;
      },
      remove: (id) => setCharacters((list) => list.filter((c) => c.id !== id)),
    }),
    [characters, saveFailed, update],
  );

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useCharacters(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useCharacters must be used inside CharacterStoreProvider');
  return ctx;
}
