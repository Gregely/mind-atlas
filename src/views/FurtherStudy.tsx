/**
 * Further Study — where a reading arrives. A place to write what to pursue next.
 * Notes accumulate, dated; the atlas carries on growing from here.
 */
import { useRef, useState } from 'react';
import { useAtlas } from '../lib/store';
import { href } from '../lib/router';
import { useTitle } from '../lib/hooks';
import { dateLong, dateMono, plateNo } from '../lib/format';
import { uid } from '../lib/seed';

export function FurtherStudy() {
  useTitle('Further Study');
  const { data, dispatch, ordered } = useAtlas();
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  const notes = [...data.studies].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const latest = ordered[ordered.length - 1];

  const add = () => {
    if (!text.trim()) return;
    dispatch({ type: 'addStudy', note: { id: uid(), text: text.trim(), createdAt: new Date().toISOString() } });
    setText('');
    ref.current?.focus();
  };

  return (
    <div className="page further">
      <div className="fs-sheet">
        <svg className="fs-rule" viewBox="0 0 600 40" preserveAspectRatio="none" aria-hidden>
          <path d="M0 20H600" />
          <circle cx="300" cy="20" r="12" />
          <circle cx="300" cy="20" r="3" className="fill" />
          <path d="M260 20H240M340 20H360" />
        </svg>
        <p className="eyebrow">Following the reading{latest ? ` · through Plate ${plateNo(latest.plate)}` : ''}</p>
        <h1 className="display fs-title">Further Study</h1>
        <p className="fs-sub">Lines of inquiry to pursue</p>

        <label htmlFor="fs-new" className="visually-hidden">
          A line of inquiry
        </label>
        <textarea
          id="fs-new"
          ref={ref}
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              add();
            }
          }}
        />
        <div className="row-gap">
          <button className="btn btn-accent" onClick={add} disabled={!text.trim()}>
            Enter in the record <kbd>Ctrl ↵</kbd>
          </button>
        </div>

        {notes.length > 0 && (
          <ol className="fs-list">
            {notes.map((n) => (
              <li key={n.id}>
                <span className="fs-date" title={dateLong(n.createdAt.slice(0, 10))}>
                  {dateMono(n.createdAt)}
                </span>
                <span className="fs-text">{n.text}</span>
                <button className="chip-x" onClick={() => window.confirm('Remove this line?') && dispatch({ type: 'deleteStudy', id: n.id })} aria-label="Remove">
                  ×
                </button>
              </li>
            ))}
          </ol>
        )}

        <nav className="fs-onward">
          <a href={href('/atlas')}>Return to the Atlas</a>
          <a href={href('/new')}>Begin Plate {plateNo(data.counters.plate + 1)}</a>
          {ordered[0] && <a href={href(`/reading/${ordered[0].id}`)}>Read again from Plate {plateNo(ordered[0].plate)}</a>}
          <a href={href('/questions')}>Open Questions</a>
        </nav>
      </div>
    </div>
  );
}
