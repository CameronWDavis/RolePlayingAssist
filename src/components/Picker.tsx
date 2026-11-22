// Searchable modal list for adding spells and items to a character.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export interface PickerOption {
  id: string;
  name: string;
  meta?: string;
  group?: string;
}

export function Picker({
  title,
  options,
  onPick,
  onClose,
  footer,
  isPicked,
}: {
  title: string;
  options: PickerOption[];
  onPick: (o: PickerOption) => void;
  onClose: () => void;
  footer?: ReactNode;
  isPicked?: (id: string) => boolean;
}) {
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (s ? options.filter((o) => o.name.toLowerCase().includes(s) || o.meta?.toLowerCase().includes(s)) : options).slice(0, 200);
  }, [q, options]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <input ref={inputRef} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" aria-label="Search" />
        <ul className="picker-list">
          {filtered.map((o) => {
            const picked = isPicked?.(o.id);
            return (
              <li key={o.id}>
                <button onClick={() => onPick(o)} disabled={picked}>
                  <span className="r-name">{o.name}</span>
                  <span className="r-meta">{picked ? 'Added' : o.meta}</span>
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && <li className="muted empty">No matches.</li>}
        </ul>
        {footer}
      </div>
    </div>
  );
}
