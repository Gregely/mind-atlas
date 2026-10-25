/**
 * IV. Open Questions — unresolved questions being carried, each linkable to plates.
 * Questions stay open as long as you like. "Settled" is an optional, quiet state.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAtlas } from '../lib/store';
import { href, navigate } from '../lib/router';
import { useTitle } from '../lib/hooks';
import { dateMono, plateNo, questionNo } from '../lib/format';
import { uid } from '../lib/seed';
import { wordCount } from '../lib/text';
import type { Entry, Question } from '../types';
import { Glyph } from '../components/Glyph';
import { arcPath } from '../components/RegisterMark';

export function Questions({ selectedId }: { selectedId?: string }) {
  useTitle('Open Questions');
  const { data, dispatch } = useAtlas();
  const [text, setText] = useState('');

  const open = useMemo(() => data.questions.filter((q) => !q.settled).sort((a, b) => b.number - a.number), [data.questions]);
  const settled = useMemo(() => data.questions.filter((q) => q.settled).sort((a, b) => b.number - a.number), [data.questions]);
  const selected = data.questions.find((q) => q.id === selectedId) || null;

  const log = () => {
    if (!text.trim()) return;
    const id = uid();
    dispatch({ type: 'createQuestion', id, text });
    setText('');
    navigate(`/questions/${id}`);
  };

  return (
    <div className="page questions">
      <section className="q-index">
        <header>
          <p className="eyebrow">Section IV</p>
          <h1 className="display">Open Questions</h1>
        </header>
        <div className="q-log">
          <label htmlFor="q-new" className="eyebrow">
            Log a question · Q·{questionNo(data.counters.question + 1)}
          </label>
          <textarea
            id="q-new"
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                log();
              }
            }}
          />
          <button className="btn btn-small" onClick={log} disabled={!text.trim()}>
            Log question <kbd>Ctrl ↵</kbd>
          </button>
        </div>

        <ol className="q-list">
          {open.map((q) => (
            <QuestionRow key={q.id} q={q} active={q.id === selectedId} />
          ))}
        </ol>
        {open.length === 0 && <p className="muted small">No open questions logged.</p>}

        {settled.length > 0 && (
          <>
            <p className="eyebrow q-settled-head">Settled</p>
            <ol className="q-list q-list-settled">
              {settled.map((q) => (
                <QuestionRow key={q.id} q={q} active={q.id === selectedId} />
              ))}
            </ol>
          </>
        )}
      </section>

      <section className="q-detail">
        {selected ? (
          <QuestionDetail key={selected.id} q={selected} />
        ) : (
          <div className="q-detail-empty">
            <QuestionDiagram q={null} linked={[]} />
            <p className="muted small">Select a question to see the plates that bear on it.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function QuestionRow({ q, active }: { q: Question; active: boolean }) {
  return (
    <li className={`q-row ${active ? 'is-active' : ''} ${q.settled ? 'is-settled' : ''}`}>
      <a href={href(`/questions/${q.id}`)}>
        <span className="q-num">Q·{questionNo(q.number)}</span>
        <span className="q-text">{q.text}</span>
        <span className="q-meta">
          {dateMono(q.createdAt)}
          <span className="q-links" aria-label={`${q.entryIds.length} linked plates`}>
            {q.entryIds.slice(0, 12).map((id) => (
              <i key={id} />
            ))}
            {q.entryIds.length > 12 && <span>+{q.entryIds.length - 12}</span>}
          </span>
        </span>
      </a>
    </li>
  );
}

function QuestionDetail({ q }: { q: Question }) {
  const { dispatch, ordered, byId } = useAtlas();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(q.text);
  const [notes, setNotes] = useState(q.notes);
  const [filter, setFilter] = useState('');
  const notesTimer = useRef<number | undefined>(undefined);

  const linked = q.entryIds.map((id) => byId.get(id)).filter((e): e is Entry => !!e);
  linked.sort((a, b) => ordered.indexOf(a) - ordered.indexOf(b));

  // Save notes shortly after typing stops.
  useEffect(() => {
    if (notes === q.notes) return;
    window.clearTimeout(notesTimer.current);
    notesTimer.current = window.setTimeout(() => dispatch({ type: 'updateQuestion', id: q.id, patch: { notes } }), 500);
    return () => window.clearTimeout(notesTimer.current);
  }, [notes, q.notes, q.id, dispatch]);

  const candidates = useMemo(() => {
    const f = filter.toLowerCase().trim();
    return ordered
      .filter((e) => !q.entryIds.includes(e.id))
      .filter((e) => !f || `${plateNo(e.plate)} ${e.title} ${e.body} ${e.tags.join(' ')}`.toLowerCase().includes(f))
      .reverse()
      .slice(0, 30);
  }, [ordered, q.entryIds, filter]);

  const toggle = (entryId: string) => dispatch({ type: 'toggleQuestionLink', questionId: q.id, entryId });

  return (
    <div className="qd">
      <div className="qd-head">
        <span className="q-num q-num-large">Q·{questionNo(q.number)}</span>
        <span className="eyebrow">
          Logged {dateMono(q.createdAt)}
          {q.settled ? ' · settled' : ' · open'}
        </span>
      </div>
      {editing ? (
        <div className="qd-edit">
          <textarea value={text} rows={3} onChange={(e) => setText(e.target.value)} aria-label="Question text" autoFocus />
          <div className="row-gap">
            <button
              className="btn btn-small"
              disabled={!text.trim()}
              onClick={() => {
                dispatch({ type: 'updateQuestion', id: q.id, patch: { text: text.trim() } });
                setEditing(false);
              }}
            >
              Save
            </button>
            <button className="btn-quiet" onClick={() => (setText(q.text), setEditing(false))}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <h2 className="qd-text" onDoubleClick={() => setEditing(true)}>
          {q.text}
        </h2>
      )}

      <div className="qd-grid">
        <QuestionDiagram q={q} linked={linked} />
        <div className="qd-notes">
          <label htmlFor="qd-notes" className="eyebrow">
            Working notes
          </label>
          <textarea id="qd-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={8} />
        </div>
      </div>

      <div className="qd-linked">
        <p className="eyebrow">Plates bearing on this question · {linked.length}</p>
        <ul>
          {linked.map((e) => (
            <li key={e.id}>
              <a href={href(`/plate/${e.id}`)}>
                <Glyph tags={e.tags} words={wordCount(e.body)} register={e.register} size={34} />
                <span className="mono">{plateNo(e.plate)}</span>
                <span>{e.title || <span className="muted">Untitled</span>}</span>
                <span className="mono muted">{dateMono(e.date)}</span>
              </a>
              <button className="chip-x" onClick={() => toggle(e.id)} aria-label={`Unlink plate ${plateNo(e.plate)}`}>
                ×
              </button>
            </li>
          ))}
        </ul>
        {ordered.length > linked.length && (
          <details className="qd-picker">
            <summary>Link a plate…</summary>
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by number, title, text or tag" aria-label="Filter plates" />
            <ul>
              {candidates.map((e) => (
                <li key={e.id}>
                  <button onClick={() => toggle(e.id)}>
                    <span className="mono">{plateNo(e.plate)}</span>
                    <span>{e.title || <span className="muted">Untitled</span>}</span>
                    <span className="mono muted">{dateMono(e.date)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div className="qd-actions">
        <button className="btn-quiet" onClick={() => setEditing(true)}>
          Edit wording
        </button>
        <button className="btn-quiet" onClick={() => dispatch({ type: 'updateQuestion', id: q.id, patch: { settled: !q.settled } })}>
          {q.settled ? 'Return to open' : 'Mark as settled'}
        </button>
        <button
          className="btn-quiet"
          onClick={() => {
            if (window.confirm(`Remove Q·${questionNo(q.number)} and its notes? Linked plates are not affected.`)) {
              dispatch({ type: 'deleteQuestion', id: q.id });
              navigate('/questions');
            }
          }}
        >
          Remove…
        </button>
      </div>
    </div>
  );
}

/** The question as an open ring at the centre, linked plates around it on hairlines. */
function QuestionDiagram({ q, linked }: { q: Question | null; linked: Entry[] }) {
  const R = 74;
  return (
    <svg className="q-diagram" viewBox="-110 -110 220 220" aria-hidden>
      <circle r={100} className="qg-faint" />
      <circle r={R} className="qg-faint qg-dash" />
      {Array.from({ length: 36 }, (_, i) => {
        const a = (i * 10 * Math.PI) / 180;
        return <line key={i} x1={Math.cos(a) * 100} y1={Math.sin(a) * 100} x2={Math.cos(a) * (i % 3 ? 97 : 94)} y2={Math.sin(a) * (i % 3 ? 97 : 94)} className="qg-faint" />;
      })}
      {linked.map((e, i) => {
        const a = (i / Math.max(1, linked.length)) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(a) * R;
        const y = Math.sin(a) * R;
        return (
          <g key={e.id}>
            <line x1={0} y1={0} x2={x} y2={y} className="qg-line plot" pathLength={1} style={{ ['--d' as string]: `${i * 90}ms` }} />
            <circle cx={x} cy={y} r={3.2} className="qg-body" />
            <text x={x * 1.18} y={y * 1.18 + 3} textAnchor="middle" className="qg-label">
              {plateNo(e.plate)}
            </text>
          </g>
        );
      })}
      <path d={arcPath(22, -60, 240)} className="qg-ring" />
      {q && (
        <text y={4} textAnchor="middle" className="qg-label">
          Q·{questionNo(q.number)}
        </text>
      )}
    </svg>
  );
}
