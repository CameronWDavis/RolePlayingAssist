import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCharacters } from '../components/CharacterStore';
import { type Character, derive, importCharacter } from '../lib/character';

export function downloadCharacter(c: Character) {
  const blob = new Blob([JSON.stringify(c, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${c.name.replace(/[^\w\- ]+/g, '').trim() || 'character'}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Characters() {
  const { characters, create, add, duplicate, remove, saveFailed } = useCharacters();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState('');

  const onImport = async (file: File) => {
    try {
      const c = importCharacter(await file.text());
      add(c);
      setImportError('');
      navigate(`/characters/${c.id}`);
    } catch {
      setImportError("That file doesn't look like a Grimoire character export.");
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>My Characters</h1>
          <p className="muted">Saved in this browser. Export a character to back it up or move it to another device.</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => fileRef.current?.click()}>Import</button>
          <button className="btn primary" onClick={() => navigate(`/characters/${create().id}`)}>+ New Character</button>
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
      {importError && <div className="banner error">{importError}</div>}
      {saveFailed && (
        <div className="banner error">
          Your browser is blocking storage, so characters won't be saved after you close this tab. Use Export to keep a copy.
        </div>
      )}

      {characters.length === 0 ? (
        <div className="empty-state">
          <h2>No characters yet</h2>
          <p className="muted">Create your first adventurer. It takes about two minutes.</p>
          <button className="btn primary" onClick={() => navigate(`/characters/${create().id}`)}>Create a Character</button>
        </div>
      ) : (
        <div className="card-grid">
          {characters.map((c) => {
            const d = derive(c);
            const hp = c.hpCurrent < 0 ? d.hpMax : c.hpCurrent;
            return (
              <div className="char-card" key={c.id}>
                <Link to={`/characters/${c.id}`} className="char-card-main">
                  <div className="avatar" aria-hidden="true">{c.name.trim().charAt(0).toUpperCase() || '?'}</div>
                  <div>
                    <h3>{c.name || 'Unnamed'}</h3>
                    <div className="muted">
                      Level {c.level} {d.subrace?.name ?? d.race?.name} {d.cls?.name}
                    </div>
                    <div className="char-card-stats">
                      <span>HP {hp}/{d.hpMax}</span>
                      <span>AC {d.ac}</span>
                    </div>
                  </div>
                </Link>
                <div className="char-card-actions">
                  <button className="link-btn" onClick={() => downloadCharacter(c)}>Export</button>
                  <button className="link-btn" onClick={() => duplicate(c.id)}>Duplicate</button>
                  <button
                    className="link-btn danger"
                    onClick={() => {
                      if (window.confirm(`Delete ${c.name}? This can't be undone unless you've exported them.`)) remove(c.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
