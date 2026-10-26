/**
 * The writing desk: a field-notebook sheet for the body, with a specimen label in the
 * margin for date, register and tags. The glyph redraws live as you write.
 * New-plate drafts are kept in localStorage until saved, so nothing is lost on reload.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAtlas, type EntryDraft } from '../lib/store';
import { navigate } from '../lib/router';
import { useKey, useTitle } from '../lib/hooks';
import { plateNo, todayISO } from '../lib/format';
import { paragraphs, wordCount } from '../lib/text';
import { uid } from '../lib/seed';
import { REGISTERS } from '../lib/registers';
import { Glyph } from '../components/Glyph';
import { RegisterIcon } from '../components/RegisterMark';
import { TagInput } from '../components/TagInput';
import { CornerMarks } from '../components/Instruments';

const DRAFT_KEY = 'mind-atlas:draft';

function loadDraft(): EntryDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as EntryDraft) : null;
  } catch {
    return null;
  }
}

export function Editor({ id }: { id?: string }) {
  const { data, byId, dispatch } = useAtlas();
  const existing = id ? byId.get(id) : undefined;
  const isNew = !id;

  const [draft, setDraft] = useState<EntryDraft>(() => {
    if (existing) {
      const { date, title, body, tags, register } = existing;
      return { date, title, body, tags, register };
    }
    const saved = loadDraft();
    return saved && typeof saved.body === 'string'
      ? { ...saved, date: saved.date || todayISO(), tags: saved.tags || [], register: saved.register || 'observation' }
      : { date: todayISO(), title: '', body: '', tags: [], register: 'observation' };
  });

  const plate = existing ? existing.plate : data.counters.plate + 1;
  useTitle(isNew ? `Plate ${plateNo(plate)} · new` : `Plate ${plateNo(plate)} · revision`);

  // Keep the new-plate draft safe between visits.
  useEffect(() => {
    if (!isNew) return;
    try {
      if (draft.body || draft.title || draft.tags.length) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      else localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* storage full or unavailable: the draft simply isn't kept */
    }
  }, [draft, isNew]);

  // Auto-size the body to its content.
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(el.scrollHeight, 420) + 'px';
  }, [draft.body]);

  useEffect(() => {
    if (isNew) bodyRef.current?.focus();
  }, [isNew]);

  const knownTags = useMemo(() => {
    const counts = new Map<string, number>();
    data.entries.forEach((e) => e.tags.forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [data.entries]);

  const words = wordCount(draft.body);
  const isSavable = (d: EntryDraft) => !!(d.body.trim() || d.title.trim()) && /^\d{4}-\d{2}-\d{2}$/.test(d.date);
  const canSave = isSavable(draft);

  // The latest draft, readable from keyboard handlers even mid-event
  // (e.g. a tag committed by the same Ctrl+Enter that saves).
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const save = () => {
    const draft = draftRef.current;
    if (!isSavable(draft)) return;
    if (existing) {
      dispatch({ type: 'updateEntry', id: existing.id, draft });
      navigate(`/plate/${existing.id}`);
    } else {
      const newId = uid();
      dispatch({ type: 'createEntry', id: newId, draft });
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      navigate(`/plate/${newId}`);
    }
  };

  const cancel = () => navigate(existing ? `/plate/${existing.id}` : '/');

  const remove = () => {
    if (!existing) return;
    const ok = window.confirm(
      `Remove Plate ${plateNo(existing.plate)} from the catalogue?\n\nIts text, tags and margin notes will be deleted from this browser. The number ${plateNo(existing.plate)} will not be reissued.`,
    );
    if (ok) {
      dispatch({ type: 'deleteEntry', id: existing.id });
      navigate('/');
    }
  };

  // Ctrl/⌘+Enter saves even while typing.
  useKey(
    (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        save();
      } else if (e.key === 'Escape' && !(e.target instanceof HTMLInputElement && e.target.closest('.tag-input'))) {
        // Esc leaves the desk; drafts are kept.
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      }
    },
    [draft, canSave],
    true,
  );

  if (id && !existing) {
    return (
      <div className="page page-narrow">
        <p className="eyebrow">Not in the catalogue</p>
        <h1 className="display">No plate with this reference</h1>
      </div>
    );
  }

  return (
    <form
      className="page editor"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="ed-sheet">
        <CornerMarks />
        <div className="ed-sheet-head">
          <span className="eyebrow">
            Plate {plateNo(plate)} · {isNew ? 'in preparation' : 'revision'}
          </span>
          <span className="eyebrow ed-coords">{draft.date.replace(/-/g, '·')}</span>
        </div>
        <label className="visually-hidden" htmlFor="ed-title">
          Title (optional)
        </label>
        <input
          id="ed-title"
          className="ed-title"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          placeholder="Untitled"
          autoComplete="off"
        />
        <label className="visually-hidden" htmlFor="ed-body">
          Body
        </label>
        <textarea
          id="ed-body"
          ref={bodyRef}
          className="ed-body"
          value={draft.body}
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          spellCheck
        />
        <div className="ed-sheet-foot">
          <span>{words} words</span>
          <span>{paragraphs(draft.body).length} ¶</span>
          <span>{draft.body.length} characters</span>
          {isNew && (draft.body || draft.title) && <span className="muted">Draft kept in this browser</span>}
        </div>
      </div>

      <aside className="ed-label">
        <div className="ed-glyph">
          <Glyph tags={draft.tags} words={words} register={draft.register} size={180} />
          <span className="ed-glyph-cap">Glyph · drawn from tags &amp; length</span>
        </div>

        <div className="field">
          <label htmlFor="ed-date">Date</label>
          <input id="ed-date" type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} required />
        </div>

        <fieldset className="field">
          <legend>Register</legend>
          <div className="register-picker">
            {REGISTERS.map((r) => (
              <label key={r.id} className={`reg-option ${draft.register === r.id ? 'is-on' : ''}`}>
                <input type="radio" name="register" value={r.id} checked={draft.register === r.id} onChange={() => setDraft({ ...draft, register: r.id })} />
                <RegisterIcon id={r.id} size={16} />
                <span className="reg-name">{r.label}</span>
                <span className="reg-gloss">{r.gloss}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="field">
          <label htmlFor="ed-tags">Tags</label>
          <TagInput id="ed-tags" value={draft.tags} onChange={(tags) => setDraft({ ...draft, tags })} known={knownTags} />
          <span className="hint">Enter or comma to add · Backspace removes</span>
        </div>

        <div className="ed-actions">
          <button type="submit" className="btn btn-accent" disabled={!canSave}>
            {isNew ? 'Catalogue plate' : 'Save revision'} <kbd>Ctrl ↵</kbd>
          </button>
          <button type="button" className="btn-quiet" onClick={cancel}>
            {isNew ? 'Leave desk' : 'Cancel'}
          </button>
        </div>
        {existing && (
          <button type="button" className="btn-quiet ed-remove" onClick={remove}>
            Remove this plate…
          </button>
        )}
      </aside>
    </form>
  );
}
