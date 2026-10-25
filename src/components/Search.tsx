/**
 * Search across everything: plate titles, bodies, tags, margin annotations,
 * questions and Further Study notes. Opened with "/" or Ctrl/⌘+K.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAtlas } from '../lib/store';
import { navigate } from '../lib/router';
import { dateMono, plateNo, questionNo } from '../lib/format';
import { escapeRegExp } from '../lib/text';
import { RegisterIcon } from './RegisterMark';

interface Hit {
  key: string;
  kind: 'plate' | 'question' | 'study';
  score: number;
  ref: string; // "PL 007"
  title: ReactNode;
  snippet: ReactNode;
  path: string;
  icon?: ReactNode;
}

/** Wrap occurrences of the query terms in <mark>. */
function highlight(text: string, terms: string[]): ReactNode {
  if (!terms.length) return text;
  const re = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi');
  return text.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}

/** A window of text around the first match. */
function snippetOf(text: string, terms: string[], len = 160): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const lower = flat.toLowerCase();
  let at = -1;
  for (const t of terms) {
    const i = lower.indexOf(t);
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  if (at < 0) return flat.slice(0, len);
  const start = Math.max(0, at - 50);
  return (start > 0 ? '… ' : '') + flat.slice(start, start + len) + (start + len < flat.length ? ' …' : '');
}

export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const { ordered, data } = useAtlas();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const terms = useMemo(() => q.toLowerCase().split(/\s+/).filter((t) => t.length > 0), [q]);

  const hits = useMemo<Hit[]>(() => {
    if (!terms.length) return [];
    const out: Hit[] = [];
    const all = (s: string) => terms.every((t) => s.includes(t));

    for (const e of ordered) {
      const title = e.title.toLowerCase();
      const body = e.body.toLowerCase();
      const tags = e.tags.join(' ');
      const notes = e.annotations.map((a) => a.text).join(' ').toLowerCase();
      const plateRef = `plate ${plateNo(e.plate)} ${e.plate}`;
      const hay = `${title} ${body} ${tags} ${notes} ${plateRef}`;
      if (!all(hay)) continue;
      let score = 0;
      for (const t of terms) {
        if (title.includes(t)) score += 4;
        if (e.tags.some((x) => x.includes(t))) score += 3;
        if (body.includes(t)) score += 1;
        if (notes.includes(t)) score += 1;
      }
      const inNotes = !terms.some((t) => body.includes(t) || title.includes(t)) && terms.some((t) => notes.includes(t));
      const source = inNotes ? e.annotations.map((a) => a.text).join(' · ') : e.body;
      out.push({
        key: e.id,
        kind: 'plate',
        score,
        ref: `PL ${plateNo(e.plate)}`,
        title: (
          <>
            {highlight(e.title || 'Untitled', terms)} <span className="search-meta">{dateMono(e.date)}</span>
            {e.tags.length > 0 && <span className="search-tags">{highlight(e.tags.join(' · '), terms)}</span>}
          </>
        ),
        snippet: (
          <>
            {inNotes && <span className="search-meta">margin · </span>}
            {highlight(snippetOf(source, terms), terms)}
          </>
        ),
        path: `/plate/${e.id}`,
        icon: <RegisterIcon id={e.register} size={14} />,
      });
    }

    for (const qu of data.questions) {
      const hay = `${qu.text} ${qu.notes}`.toLowerCase();
      if (!all(hay)) continue;
      out.push({
        key: qu.id,
        kind: 'question',
        score: 2,
        ref: `Q ${questionNo(qu.number)}`,
        title: highlight(qu.text, terms),
        snippet: qu.notes ? highlight(snippetOf(qu.notes, terms), terms) : null,
        path: `/questions/${qu.id}`,
      });
    }

    for (const s of data.studies) {
      if (!all(s.text.toLowerCase())) continue;
      out.push({
        key: s.id,
        kind: 'study',
        score: 1,
        ref: 'F.S.',
        title: <span className="search-meta">Further Study · {dateMono(s.createdAt)}</span>,
        snippet: highlight(snippetOf(s.text, terms), terms),
        path: '/further',
      });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 60);
  }, [terms, ordered, data.questions, data.studies]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const go = (h: Hit | undefined) => {
    if (!h) return;
    navigate(h.path);
    onClose();
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-label="Search">
      <div className="search-panel">
        <div className="search-field">
          <span className="search-label">Search the archive</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(hits.length - 1, a + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                go(hits[active]);
              }
            }}
            spellCheck={false}
            aria-label="Search terms"
          />
          <span className="search-count">{terms.length ? `${hits.length} found` : ''}</span>
        </div>
        <ul className="search-results" ref={listRef}>
          {hits.map((h, i) => (
            <li key={h.kind + h.key} className={i === active ? 'is-active' : ''} onMouseEnter={() => setActive(i)} onClick={() => go(h)}>
              <span className="search-ref">
                {h.icon}
                {h.ref}
              </span>
              <span className="search-body">
                <span className="search-title">{h.title}</span>
                {h.snippet && <span className="search-snippet">{h.snippet}</span>}
              </span>
            </li>
          ))}
          {terms.length > 0 && hits.length === 0 && <li className="search-empty">No matching records.</li>}
        </ul>
        <div className="search-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> select</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
