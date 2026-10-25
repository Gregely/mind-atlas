/**
 * V. Reading Back — a quiet reading mode that walks through plates in order,
 * with margin annotations. After the latest plate it continues to Further Study.
 */
import { useEffect, useState } from 'react';
import { useAtlas } from '../lib/store';
import { href, navigate } from '../lib/router';
import { useKey, useTitle } from '../lib/hooks';
import { dateLong, dateMono, plateNo } from '../lib/format';
import { wordCount } from '../lib/text';
import { REGISTER_BY_ID } from '../lib/registers';
import { AnnotatedBody } from '../components/AnnotatedBody';
import { Glyph } from '../components/Glyph';
import { RegisterIcon } from '../components/RegisterMark';

export function Reading({ id }: { id?: string }) {
  return id ? <Reader id={id} /> : <ReadingStart />;
}

function ReadingStart() {
  useTitle('Reading Back');
  const { ordered, byId, data } = useAtlas();
  const resume = data.settings.lastReadId ? byId.get(data.settings.lastReadId) : undefined;
  const first = ordered[0];

  useKey(
    (e) => {
      if (e.key === 'Enter' && first) navigate(`/reading/${(resume || first).id}`);
    },
    [first, resume],
  );

  return (
    <div className="page reading-start">
      <div className="rs-col">
        <p className="eyebrow">Section V</p>
        <h1 className="display">Reading Back</h1>
        {first ? (
          <>
            <div className="rs-actions">
              <a className="btn btn-accent" href={href(`/reading/${first.id}`)}>
                Begin at Plate {plateNo(first.plate)}
              </a>
              {resume && resume !== first && (
                <a className="btn" href={href(`/reading/${resume.id}`)}>
                  Resume at Plate {plateNo(resume.plate)}
                </a>
              )}
            </div>
            <p className="muted small">
              Plates are read in date order. <kbd>←</kbd> <kbd>→</kbd> to turn, <kbd>A</kbd> for a margin note, <kbd>Esc</kbd> to leave.
            </p>
            <a className="small" href={href('/further')}>
              Go to Further Study
            </a>
          </>
        ) : (
          <p className="muted">Nothing to read back yet. Catalogued plates appear here in order.</p>
        )}
      </div>
      {ordered.length > 0 && (
        <ol className="rs-index" aria-label="Begin at any plate">
          {ordered.map((e) => (
            <li key={e.id}>
              <a href={href(`/reading/${e.id}`)}>
                <span className="mono">{plateNo(e.plate)}</span>
                <span className="mono muted">{dateMono(e.date)}</span>
                <span>{e.title || <span className="muted">Untitled</span>}</span>
              </a>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Reader({ id }: { id: string }) {
  const { byId, ordered, dispatch } = useAtlas();
  const e = byId.get(id);
  const i = e ? ordered.indexOf(e) : -1;
  const prev = i > 0 ? ordered[i - 1] : undefined;
  const next = i >= 0 && i < ordered.length - 1 ? ordered[i + 1] : undefined;
  const [annotate, setAnnotate] = useState(0);
  useTitle(e ? `Reading · Plate ${plateNo(e.plate)}` : 'Reading Back');

  useEffect(() => {
    if (e) dispatch({ type: 'setLastRead', id: e.id });
  }, [e?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const goNext = () => navigate(next ? `/reading/${next.id}` : '/further');

  useKey(
    (ev) => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (ev.key === 'ArrowRight' || ev.key === 'k') goNext();
      else if ((ev.key === 'ArrowLeft' || ev.key === 'j') && prev) navigate(`/reading/${prev.id}`);
      else if (ev.key === 'a' || ev.key === 'A') {
        ev.preventDefault();
        setAnnotate((n) => n + 1);
      } else if (ev.key === 'Escape') navigate('/reading');
    },
    [prev, next],
  );

  if (!e) {
    return (
      <div className="page page-narrow">
        <p className="eyebrow">Not in the catalogue</p>
        <a href={href('/reading')}>Return to Reading Back</a>
      </div>
    );
  }

  const reg = REGISTER_BY_ID[e.register];
  return (
    <article className="page reader" key={e.id}>
      <header className="reader-head">
        <a className="eyebrow" href={href('/reading')}>
          Reading Back
        </a>
        <span className="eyebrow">
          Plate {plateNo(e.plate)} · {dateLong(e.date)}
        </span>
      </header>

      <div className="reader-grid">
        <aside className="reader-meta">
          <Glyph tags={e.tags} words={wordCount(e.body)} register={e.register} size={120} animate />
          <span className="reader-plate">{plateNo(e.plate)}</span>
          <span className="reader-reg">
            <RegisterIcon id={e.register} size={13} /> {reg.label}
          </span>
          {e.tags.length > 0 && <span className="reader-tags">{e.tags.join(' · ')}</span>}
          <a className="small" href={href(`/plate/${e.id}`)}>
            Open plate
          </a>
        </aside>
        <div className="reader-text">
          {e.title && <h1 className="reader-title">{e.title}</h1>}
          <AnnotatedBody entry={e} annotateSignal={annotate} large />
        </div>
      </div>

      <nav className="reader-nav" aria-label="Turn the page">
        {prev ? (
          <a href={href(`/reading/${prev.id}`)}>
            <kbd>←</kbd> Plate {plateNo(prev.plate)}
          </a>
        ) : (
          <span />
        )}
        <a href={href(next ? `/reading/${next.id}` : '/further')}>
          {next ? `Plate ${plateNo(next.plate)}` : 'Further Study'} <kbd>→</kbd>
        </a>
      </nav>
    </article>
  );
}
