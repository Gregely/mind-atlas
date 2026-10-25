/**
 * An entry's body set as paragraphs, with a margin beside each one for annotations.
 * Used on the plate view and in Reading Back. Notes can be pinned to a paragraph or
 * to the plate as a whole.
 */
import { useEffect, useRef, useState } from 'react';
import type { Entry } from '../types';
import { useAtlas } from '../lib/store';
import { uid } from '../lib/seed';
import { dateMono } from '../lib/format';
import { paragraphs } from '../lib/text';

interface Props {
  entry: Entry;
  editable?: boolean;
  /** Increment to open the whole-plate note form (keyboard "A"). */
  annotateSignal?: number;
  large?: boolean;
}

export function AnnotatedBody({ entry, editable = true, annotateSignal = 0, large = false }: Props) {
  const { dispatch } = useAtlas();
  const paras = paragraphs(entry.body);
  const [adding, setAdding] = useState<number | 'whole' | null>(null);

  useEffect(() => {
    if (annotateSignal > 0) setAdding('whole');
  }, [annotateSignal]);
  useEffect(() => setAdding(null), [entry.id]);

  const notesFor = (p: number | null) => entry.annotations.filter((a) => a.paragraph === p || (p === null && a.paragraph != null && a.paragraph >= paras.length));

  const add = (p: number | null, text: string) => {
    if (!text.trim()) return;
    dispatch({ type: 'addAnnotation', entryId: entry.id, annotation: { id: uid(), text: text.trim(), createdAt: new Date().toISOString(), paragraph: p } });
    setAdding(null);
  };

  const remove = (annotationId: string) => {
    if (window.confirm('Remove this margin note?')) dispatch({ type: 'deleteAnnotation', entryId: entry.id, annotationId });
  };

  return (
    <div className={`annotated ${large ? 'annotated-large' : ''}`}>
      {paras.map((p, i) => (
        <div className="ab-row" key={i}>
          <p className="ab-text">
            <span className="ab-pilcrow" aria-hidden>
              {i + 1}
            </span>
            {p}
          </p>
          <div className="ab-margin">
            {notesFor(i).map((n) => (
              <Note key={n.id} text={n.text} date={n.createdAt} onRemove={editable ? () => remove(n.id) : undefined} />
            ))}
            {editable &&
              (adding === i ? (
                <NoteForm onSubmit={(t) => add(i, t)} onCancel={() => setAdding(null)} />
              ) : (
                <button className="ab-add" onClick={() => setAdding(i)} aria-label={`Annotate paragraph ${i + 1}`} title="Annotate this paragraph">
                  + note
                </button>
              ))}
          </div>
        </div>
      ))}
      {paras.length === 0 && <p className="ab-text muted">(No body text)</p>}

      {(notesFor(null).length > 0 || editable) && (
        <div className="ab-whole">
          <span className="eyebrow">Notes on the whole plate</span>
          {notesFor(null).map((n) => (
            <Note key={n.id} text={n.text} date={n.createdAt} onRemove={editable ? () => remove(n.id) : undefined} />
          ))}
          {editable &&
            (adding === 'whole' ? (
              <NoteForm onSubmit={(t) => add(null, t)} onCancel={() => setAdding(null)} />
            ) : (
              <button className="ab-add ab-add-whole" onClick={() => setAdding('whole')}>
                + margin note <kbd>A</kbd>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

function Note({ text, date, onRemove }: { text: string; date: string; onRemove?: () => void }) {
  return (
    <aside className="note">
      <span className="note-date">{dateMono(date)}</span>
      <span className="note-text">{text}</span>
      {onRemove && (
        <button className="note-x" onClick={onRemove} aria-label="Remove note">
          ×
        </button>
      )}
    </aside>
  );
}

function NoteForm({ onSubmit, onCancel }: { onSubmit: (t: string) => void; onCancel: () => void }) {
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className="note-form">
      <textarea
        ref={ref}
        value={text}
        rows={3}
        onChange={(e) => setText(e.target.value)}
        aria-label="Margin note"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            e.stopPropagation();
            onSubmit(text);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }
        }}
      />
      <div className="note-form-actions">
        <button className="btn btn-small" onClick={() => onSubmit(text)} disabled={!text.trim()}>
          Pin note
        </button>
        <button className="btn-quiet" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
