/**
 * VI. Archive — instruments and records: theme, export, import, storage, the glyph key.
 */
import { useRef, useState } from 'react';
import { useAtlas, STORAGE_KEY, emptyData } from '../lib/store';
import { exportJSON, exportMarkdown, mergeData, parseImport } from '../lib/io';
import { useTitle } from '../lib/hooks';
import { bytes, plateNo } from '../lib/format';
import { REGISTERS } from '../lib/registers';
import type { AtlasData, ThemeId } from '../types';
import { Glyph } from '../components/Glyph';
import { RegisterIcon } from '../components/RegisterMark';
import { SHORTCUTS } from '../components/Shortcuts';
import { CornerMarks } from '../components/Instruments';

export function Archive() {
  useTitle('Archive');
  const { data, dispatch } = useAtlas();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<AtlasData | null>(null);

  let used = 0;
  try {
    used = (localStorage.getItem(STORAGE_KEY) || '').length * 2; // UTF-16
  } catch {
    /* unavailable */
  }

  const onFile = async (file: File) => {
    setMessage(null);
    try {
      const incoming = parseImport(await file.text());
      setPending(incoming);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const applyImport = () => {
    if (!pending) return;
    if (mode === 'replace') {
      dispatch({ type: 'replaceAll', data: { ...pending, settings: { ...pending.settings, theme: data.settings.theme } } });
      setMessage(`Archive replaced: ${pending.entries.length} plates, ${pending.questions.length} questions.`);
    } else {
      const { data: merged, added } = mergeData(data, pending);
      dispatch({ type: 'replaceAll', data: merged });
      setMessage(added ? `Merged ${added} new record${added === 1 ? '' : 's'} into the archive.` : 'Nothing new to merge: every record was already present.');
    }
    setPending(null);
  };

  const themes: { id: ThemeId; label: string; gloss: string }[] = [
    { id: 'ink', label: 'Ink', gloss: 'Observatory night: ink navy, bone, brass' },
    { id: 'paper', label: 'Paper', gloss: 'Archive paper: cream, graphite, sepia' },
  ];

  return (
    <div className="page archive">
      <header className="ar-head">
        <p className="eyebrow">Section VI</p>
        <h1 className="display">Archive</h1>
        <p className="muted">Everything is kept in this browser’s local storage. Export a copy to keep it elsewhere.</p>
      </header>

      <section className="ar-panel ar-theme">
        <h2 className="ar-h">Plate stock</h2>
        <div className="theme-swatches">
          {themes.map((t) => (
            <button
              key={t.id}
              className={`swatch swatch-${t.id} ${data.settings.theme === t.id ? 'is-on' : ''}`}
              onClick={() => dispatch({ type: 'setTheme', theme: t.id })}
              aria-pressed={data.settings.theme === t.id}
            >
              <span className="swatch-sample" aria-hidden>
                <i />
                <i />
                <i />
              </span>
              <span className="swatch-label">{t.label}</span>
              <span className="swatch-gloss">{t.gloss}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="ar-panel ar-export">
        <CornerMarks />
        <h2 className="ar-h">Export</h2>
        <dl className="readout">
          <div><dt>Plates</dt><dd>{plateNo(data.entries.length)}</dd></div>
          <div><dt>Questions</dt><dd>{plateNo(data.questions.length)}</dd></div>
          <div><dt>Further study lines</dt><dd>{plateNo(data.studies.length)}</dd></div>
          <div><dt>Margin notes</dt><dd>{plateNo(data.entries.reduce((s, e) => s + e.annotations.length, 0))}</dd></div>
          <div><dt>Stored</dt><dd>{bytes(used)}</dd></div>
        </dl>
        <div className="row-gap">
          <button className="btn" onClick={() => exportJSON(data)}>
            Export JSON
          </button>
          <button className="btn" onClick={() => exportMarkdown(data)}>
            Export Markdown
          </button>
        </div>
        <p className="hint">JSON keeps everything and can be imported again. Markdown is for reading elsewhere.</p>
      </section>

      <section className="ar-panel ar-import">
        <h2 className="ar-h">Import</h2>
        <div className="radio-row" role="radiogroup" aria-label="Import mode">
          <label>
            <input type="radio" checked={mode === 'merge'} onChange={() => setMode('merge')} /> Merge into this archive
          </label>
          <label>
            <input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} /> Replace this archive
          </label>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} aria-label="Choose a JSON archive" />
        {pending && (
          <div className="import-confirm">
            <p>
              File contains {pending.entries.length} plates, {pending.questions.length} questions and {pending.studies.length} further study lines.
              {mode === 'replace' && ' Replacing removes what is currently stored here.'}
            </p>
            <div className="row-gap">
              <button className="btn btn-accent" onClick={applyImport}>
                {mode === 'merge' ? 'Merge' : 'Replace'}
              </button>
              <button className="btn-quiet" onClick={() => setPending(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
        {message && (
          <p className="ar-message" role="status">
            {message}
          </p>
        )}
      </section>

      <section className="ar-panel ar-key">
        <h2 className="ar-h">Key to the glyphs</h2>
        <div className="glyph-key">
          <Glyph tags={['light', 'memory', 'river']} words={340} register="observation" size={340} annotate />
          <dl>
            <div><dt>Concentric rings</dt><dd>One per tag, up to five.</dd></div>
            <div><dt>Bold arc on a ring</dt><dd>Placed by the tag itself: plates sharing a tag share that arc.</dd></div>
            <div><dt>Outer graduations</dt><dd>Finer as the entry grows longer.</dd></div>
            <div><dt>Spokes</dt><dd>Roughly the logarithm of the word count.</dd></div>
            <div><dt>Needle</dt><dd>Its angle is derived from the word count.</dd></div>
            <div><dt>Tilted orbit</dt><dd>Drawn for entries over two hundred words.</dd></div>
            <div><dt>Centre</dt><dd>The register symbol.</dd></div>
          </dl>
        </div>
        <div className="reg-key">
          {REGISTERS.map((r) => (
            <span key={r.id}>
              <RegisterIcon id={r.id} size={16} /> <b>{r.label}</b> <span className="muted">{r.gloss}</span>
            </span>
          ))}
        </div>
      </section>

      <section className="ar-panel ar-keys">
        <h2 className="ar-h">Keyboard</h2>
        {SHORTCUTS.map((g) => (
          <dl key={g.group} className="keys-list">
            <dt className="eyebrow">{g.group}</dt>
            {g.keys.map(([k, v]) => (
              <dd key={k}>
                <kbd>{k}</kbd> <span>{v}</span>
              </dd>
            ))}
          </dl>
        ))}
      </section>

      <section className="ar-panel ar-erase">
        <h2 className="ar-h">Clear this browser</h2>
        <p className="hint">Removes every plate, question and note stored here. Export first if you want a copy.</p>
        <button
          className="btn-quiet"
          onClick={() => {
            if (!window.confirm('Remove the entire archive from this browser?')) return;
            if (!window.confirm('Confirm once more: this cannot be undone unless you have an export.')) return;
            dispatch({ type: 'replaceAll', data: { ...emptyData(), settings: { ...emptyData().settings, theme: data.settings.theme } } });
            setMessage('The archive in this browser is now empty.');
          }}
        >
          Clear archive…
        </button>
      </section>
    </div>
  );
}
