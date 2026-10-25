/**
 * Application shell: top navigation, global keyboard shortcuts, overlays and routing.
 * Each route renders one view from ./views.
 */
import { useEffect, useState } from 'react';
import { useAtlas } from './lib/store';
import { href, navigate, useRoute } from './lib/router';
import { useKey } from './lib/hooks';
import { dateMono, plateNo, todayISO } from './lib/format';
import { SearchOverlay } from './components/Search';
import { ShortcutsOverlay } from './components/Shortcuts';
import { Catalogue } from './views/Catalogue';
import { Editor } from './views/Editor';
import { PlateView } from './views/Plate';
import { Atlas } from './views/Atlas';
import { Cabinet } from './views/Cabinet';
import { Questions } from './views/Questions';
import { Reading } from './views/Reading';
import { FurtherStudy } from './views/FurtherStudy';
import { Archive } from './views/Archive';
import { NotFound } from './views/NotFound';

const NAV = [
  { n: 'I', key: '1', path: '/', label: 'Catalogue', match: ['', 'plate', 'new', 'tag'] },
  { n: 'II', key: '2', path: '/atlas', label: 'Atlas', match: ['atlas'] },
  { n: 'III', key: '3', path: '/cabinet', label: 'Cabinet', match: ['cabinet'] },
  { n: 'IV', key: '4', path: '/questions', label: 'Questions', match: ['questions'] },
  { n: 'V', key: '5', path: '/reading', label: 'Reading Back', match: ['reading', 'further'] },
  { n: 'VI', key: '6', path: '/archive', label: 'Archive', match: ['archive'] },
];

export function App() {
  const route = useRoute();
  const { data, dispatch, saveError } = useAtlas();
  const [overlay, setOverlay] = useState<'search' | 'keys' | null>(null);
  const section = route[0] || '';

  // Scroll to top on navigation (the atlas manages its own viewport).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.join('/')]);

  // Search can be opened even while typing (Ctrl/⌘+K).
  useKey(
    (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOverlay((o) => (o === 'search' ? null : 'search'));
      }
    },
    [],
    true,
  );

  useKey(
    (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (overlay) {
        if (e.key === 'Escape') setOverlay(null);
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        setOverlay('search');
      } else if (e.key === '?') {
        setOverlay('keys');
      } else if (e.key === 'n' || e.key === 'N') {
        if (section !== 'new') navigate('/new');
      } else if (e.key === 't' || e.key === 'T') {
        dispatch({ type: 'setTheme', theme: data.settings.theme === 'ink' ? 'paper' : 'ink' });
      } else {
        const item = NAV.find((x) => x.key === e.key);
        if (item) navigate(item.path);
      }
    },
    [overlay, section, data.settings.theme],
  );

  const fullBleed = section === 'atlas';
  const quiet = section === 'reading' || section === 'further';

  return (
    <div className={`shell ${fullBleed ? 'shell-full' : ''} ${quiet ? 'shell-quiet' : ''}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <a className="brand" href={href('/')} aria-label="Mind Atlas — catalogue">
          <svg viewBox="-12 -12 24 24" width="22" height="22" aria-hidden>
            <circle r="10.5" className="brand-line" />
            <circle r="6" className="brand-line brand-faint" />
            <circle r="1.6" className="brand-accent" />
            <circle cx="7.4" cy="-7.4" r="1.4" className="brand-body" />
          </svg>
          <span>Mind Atlas</span>
        </a>
        <nav className="nav" aria-label="Sections">
          {NAV.map((item) => (
            <a key={item.path} href={href(item.path)} className={item.match.includes(section) ? 'is-current' : ''} title={`${item.label} (${item.key})`}>
              <span className="nav-n">{item.n}</span>
              <span className="nav-label">{item.label}</span>
            </a>
          ))}
        </nav>
        <div className="topbar-tools">
          <button className="tool" onClick={() => setOverlay('search')} title="Search (/)">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
              <circle cx="6.5" cy="6.5" r="4.5" />
              <path d="M10 10l4 4" />
            </svg>
            <span className="tool-label">Search</span>
            <kbd>/</kbd>
          </button>
          <button
            className="tool tool-theme"
            onClick={() => dispatch({ type: 'setTheme', theme: data.settings.theme === 'ink' ? 'paper' : 'ink' })}
            title="Switch theme (T)"
            aria-label={`Switch to ${data.settings.theme === 'ink' ? 'Paper' : 'Ink'} theme`}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
              <circle cx="8" cy="8" r="6" />
              <path d="M8 2a6 6 0 0 1 0 12z" className="fill" />
            </svg>
            <span className="tool-label">{data.settings.theme === 'ink' ? 'Ink' : 'Paper'}</span>
          </button>
          <button className="tool tool-keys" onClick={() => setOverlay('keys')} title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts">
            <kbd>?</kbd>
          </button>
          <a className="btn btn-accent new-plate" href={href('/new')} title="New plate (N)">
            <span className="plus">+</span> <span className="np-label">Plate</span> {plateNo(data.counters.plate + 1)}
          </a>
        </div>
      </header>

      <main id="main" className="main">
        <Route route={route} />
      </main>

      {!fullBleed && !quiet && (
        <footer className="statusbar">
          <span>
            {data.entries.length} plate{data.entries.length === 1 ? '' : 's'} catalogued · {data.questions.filter((q) => !q.settled).length} open question
            {data.questions.filter((q) => !q.settled).length === 1 ? '' : 's'}
          </span>
          <span className="statusbar-mid">Stored locally in this browser</span>
          <span>{dateMono(todayISO())}</span>
        </footer>
      )}

      {saveError && (
        <div className="save-notice" role="status">
          The browser declined to save the latest change ({saveError}). Export a JSON copy from the Archive to keep it.
        </div>
      )}

      {overlay === 'search' && <SearchOverlay onClose={() => setOverlay(null)} />}
      {overlay === 'keys' && <ShortcutsOverlay onClose={() => setOverlay(null)} />}
    </div>
  );
}

function Route({ route }: { route: string[] }) {
  const [a, b, c] = route;
  switch (a) {
    case undefined:
      return <Catalogue />;
    case 'tag':
      return <Catalogue tag={b} />;
    case 'new':
      return <Editor key="new" />;
    case 'plate':
      return c === 'edit' ? <Editor key={`edit-${b}`} id={b} /> : <PlateView key={b} id={b} />;
    case 'atlas':
      return <Atlas focusId={b} />;
    case 'cabinet':
      return <Cabinet />;
    case 'questions':
      return <Questions selectedId={b} />;
    case 'reading':
      return <Reading id={b} />;
    case 'further':
      return <FurtherStudy />;
    case 'archive':
      return <Archive />;
    default:
      return <NotFound />;
  }
}
