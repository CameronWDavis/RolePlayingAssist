import { Suspense, lazy, useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useCharacters } from './components/CharacterStore';
import { DicePanel, DiceTray, DieIcon } from './components/Dice';
import { ErrorBoundary } from './components/ErrorBoundary';
import counts from './data/counts.json';
import { useHomebrew } from './components/HomebrewStore';

// Each page downloads only when it's first opened, so the home page loads fast.
const CharacterSheet = lazy(() => import('./pages/CharacterSheet'));
const Characters = lazy(() => import('./pages/Characters'));
const Compendium = lazy(() => import('./pages/Compendium'));
const HomebrewEdit = lazy(() => import('./pages/homebrew/HomebrewEdit'));
const HomebrewHome = lazy(() => import('./pages/homebrew/HomebrewHome'));
import { countHomebrew } from './lib/homebrew';

export default function App() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <DieIcon sides={20} />
          <span>Grimoire</span>
        </Link>
        <button className="menu-btn" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label="Menu">
          ☰
        </button>
        <nav className={`main-nav ${menuOpen ? 'open' : ''}`}>
          <NavLink to="/characters">Characters</NavLink>
          <NavLink to="/compendium">Compendium</NavLink>
          <NavLink to="/homebrew">Homebrew</NavLink>
          <NavLink to="/dice">Dice</NavLink>
        </nav>
      </header>

      <main>
        {/* Moving to another page clears a crash, so one broken page never locks up the whole app. */}
        <ErrorBoundary resetKey={location.pathname}>
        <Suspense fallback={<div className="page-loading" role="status">Loading…</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/characters" element={<Characters />} />
          <Route path="/characters/:id" element={<CharacterSheet />} />
          <Route path="/compendium" element={<Navigate to="/compendium/spells" replace />} />
          <Route path="/compendium/:category" element={<Compendium />} />
          <Route path="/compendium/:category/:id" element={<Compendium />} />
          <Route path="/homebrew" element={<HomebrewHome />} />
          <Route path="/homebrew/:kind/:id" element={<HomebrewEdit />} />
          <Route path="/dice" element={<DicePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
      </main>

      <footer className="footer">
        <p>
          This site uses material from the System Reference Document 5.1 by Wizards of the Coast LLC, available at{' '}
          <a href="https://dnd.wizards.com/resources/systems-reference-document" target="_blank" rel="noreferrer">
            dnd.wizards.com
          </a>
          , licensed under{' '}
          <a href="https://creativecommons.org/licenses/by/4.0/legalcode" target="_blank" rel="noreferrer">
            CC-BY-4.0
          </a>
          . Data prepared by the{' '}
          <a href="https://github.com/5e-bits/5e-database" target="_blank" rel="noreferrer">
            5e-database
          </a>{' '}
          project (MIT License). Grimoire is a fan-made tool and is not affiliated with or endorsed by Wizards of the Coast.
        </p>
      </footer>

      {location.pathname !== '/dice' && <DiceTray />}
    </div>
  );
}

function Home() {
  const { characters, create } = useCharacters();
  const hb = useHomebrew();
  const navigate = useNavigate();
  const recent = characters.slice(0, 3);
  return (
    <div className="page home">
      <section className="hero">
        <h1>Your table's free spellbook, bestiary and character sheet.</h1>
        <p className="muted">
          Build characters, look up rules, and roll dice. No account, no paywall. Everything is saved in your browser.
        </p>
        <div className="actions">
          <button
            className="btn primary"
            onClick={() => navigate(`/characters/${recent.length ? recent[0].id : create().id}`)}
          >
            {recent.length ? `Continue ${recent[0].name}` : 'Create a Character'}
          </button>
          <Link to="/compendium" className="btn">Browse the Compendium</Link>
        </div>
      </section>

      <section className="feature-cards">
        <Link to="/characters" className="feature-card">
          <h2>Characters</h2>
          <p>All 12 classes, levels 1–20. Ability scores, skills, HP, spell slots and inventory worked out for you.</p>
          <span className="muted small">{characters.length} saved</span>
        </Link>
        <Link to="/compendium/spells" className="feature-card">
          <h2>Compendium</h2>
          <p>
            {counts.spells} spells, {counts.monsters} monsters, {counts.magicItems} magic items, plus {counts.classes} classes, races,
            equipment and conditions.
          </p>
          <span className="muted small">Search and filter everything</span>
        </Link>
        <Link to="/homebrew" className="feature-card">
          <h2>Homebrew</h2>
          <p>Make your own magic items, spells, monsters and subclasses, then use them on character sheets and share them as packs.</p>
          <span className="muted small">{countHomebrew(hb.data)} created</span>
        </Link>
        <Link to="/dice" className="feature-card">
          <h2>Dice</h2>
          <p>Every die from d4 to d100, advantage and disadvantage, keep-highest pools, and a roll history.</p>
          <span className="muted small">Or tap the d20 button anywhere</span>
        </Link>
      </section>
    </div>
  );
}

function DicePage() {
  return (
    <div className="page dice-page">
      <h1>Dice Roller</h1>
      <p className="muted">Click dice to build a pool (right-click removes one), or type any expression, like <code>2d6+1d4+3</code> or <code>4d6kh3</code>.</p>
      <div className="panel">
        <DicePanel />
      </div>
    </div>
  );
}
