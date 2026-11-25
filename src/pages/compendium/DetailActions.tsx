// Buttons above a compendium entry: edit/delete your homebrew, or copy an SRD entry into homebrew.
import { Link, useNavigate } from 'react-router-dom';
import { useHomebrew } from '../../components/HomebrewStore';
import { KIND_SLUGS } from '../homebrew/HomebrewEdit';

export function DetailActions({ category, item }: { category: string; item: { id: string; name: string; homebrew?: boolean } }) {
  const hb = useHomebrew();
  const navigate = useNavigate();
  const kind = KIND_SLUGS[category];

  if (category === 'classes') {
    return (
      <div className="detail-actions">
        <Link className="btn small" to={`/homebrew/subclasses/new?class=${item.id}`}>+ Create a {item.name} subclass</Link>
        <Link className="btn small" to={`/homebrew/subclasses/new?class=${item.id}&from=srd`}>Copy the SRD subclass</Link>
      </div>
    );
  }
  if (!kind) return null;

  if (item.homebrew) {
    return (
      <div className="detail-actions">
        <span className="chip hb">Homebrew</span>
        <Link className="btn small" to={`/homebrew/${category}/${item.id}`}>Edit</Link>
        <button
          className="btn small danger"
          onClick={() => {
            if (!window.confirm(`Delete "${item.name}"? This can't be undone unless you've exported it.`)) return;
            hb.remove(kind, item.id);
            navigate(`/compendium/${category}`);
          }}
        >
          Delete
        </button>
      </div>
    );
  }

  return (
    <div className="detail-actions">
      <Link className="btn small" to={`/homebrew/${category}/new?from=${item.id}`} title="Start a homebrew version from this entry">
        Make a homebrew copy
      </Link>
    </div>
  );
}
