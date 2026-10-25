/**
 * A single specimen plate: placard on the left, the text in the middle with its margin,
 * and the annotated glyph figure on the right.
 */
import { useAtlas } from '../lib/store';
import { href, navigate } from '../lib/router';
import { useKey, useTitle } from '../lib/hooks';
import { dateLong, plateNo, questionNo, timeOf } from '../lib/format';
import { paragraphs, wordCount } from '../lib/text';
import { REGISTER_BY_ID } from '../lib/registers';
import { Glyph } from '../components/Glyph';
import { RegisterIcon } from '../components/RegisterMark';
import { AnnotatedBody } from '../components/AnnotatedBody';
import { FigCaption } from '../components/Instruments';

export function PlateView({ id }: { id: string }) {
  const { byId, ordered, data, dispatch } = useAtlas();
  const e = byId.get(id);
  const idx = e ? ordered.indexOf(e) : -1;
  const prev = idx > 0 ? ordered[idx - 1] : undefined;
  const next = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : undefined;
  useTitle(e ? `Plate ${plateNo(e.plate)}${e.title ? ` · ${e.title}` : ''}` : 'Plate');

  useKey(
    (ev) => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey || !e) return;
      if ((ev.key === 'ArrowLeft' || ev.key === 'j') && prev) navigate(`/plate/${prev.id}`);
      else if ((ev.key === 'ArrowRight' || ev.key === 'k') && next) navigate(`/plate/${next.id}`);
      else if (ev.key === 'e' || ev.key === 'E') navigate(`/plate/${e.id}/edit`);
    },
    [e, prev, next],
  );

  if (!e) {
    return (
      <div className="page page-narrow">
        <p className="eyebrow">Not in the catalogue</p>
        <h1 className="display">No plate with this reference</h1>
        <a href={href('/')}>Return to the catalogue</a>
      </div>
    );
  }

  const reg = REGISTER_BY_ID[e.register];
  const words = wordCount(e.body);
  const linked = data.questions.filter((q) => q.entryIds.includes(e.id));
  const unlinked = data.questions.filter((q) => !q.entryIds.includes(e.id));

  return (
    <article className="page plate">
      <aside className="placard">
        <div className="placard-no">
          <span className="eyebrow">Plate</span>
          <span className="placard-num">{plateNo(e.plate)}</span>
        </div>
        <div className="placard-reg">
          <RegisterIcon id={e.register} size={18} />
          <span>{reg.label}</span>
          <span className="muted">— {reg.gloss}</span>
        </div>
        <dl className="readout readout-tight">
          <div><dt>Date</dt><dd>{dateLong(e.date)}</dd></div>
          <div><dt>Words</dt><dd>{words}</dd></div>
          <div><dt>Paragraphs</dt><dd>{paragraphs(e.body).length}</dd></div>
          <div><dt>Margin notes</dt><dd>{e.annotations.length}</dd></div>
          <div><dt>Catalogued</dt><dd>{e.createdAt.slice(0, 10).replace(/-/g, '·')} {timeOf(e.createdAt)}</dd></div>
          {e.updatedAt !== e.createdAt && <div><dt>Revised</dt><dd>{e.updatedAt.slice(0, 10).replace(/-/g, '·')} {timeOf(e.updatedAt)}</dd></div>}
        </dl>
        {e.tags.length > 0 && (
          <div className="placard-tags">
            <span className="eyebrow">Tags</span>
            <div>
              {e.tags.map((t) => (
                <a key={t} className="chip chip-link" href={href(`/tag/${encodeURIComponent(t)}`)}>
                  {t}
                </a>
              ))}
            </div>
          </div>
        )}
        <div className="placard-questions">
          <span className="eyebrow">Bears on</span>
          {linked.map((q) => (
            <div key={q.id} className="pq-row">
              <a href={href(`/questions/${q.id}`)}>
                <span className="mono">Q·{questionNo(q.number)}</span> {q.text}
              </a>
              <button className="chip-x" onClick={() => dispatch({ type: 'toggleQuestionLink', questionId: q.id, entryId: e.id })} aria-label="Unlink question">
                ×
              </button>
            </div>
          ))}
          {unlinked.length > 0 ? (
            <select
              className="select-quiet"
              value=""
              onChange={(ev) => ev.target.value && dispatch({ type: 'toggleQuestionLink', questionId: ev.target.value, entryId: e.id })}
              aria-label="Link this plate to a question"
            >
              <option value="">Link to a question…</option>
              {unlinked.map((q) => (
                <option key={q.id} value={q.id}>
                  Q·{questionNo(q.number)} — {q.text.slice(0, 70)}
                </option>
              ))}
            </select>
          ) : (
            linked.length === 0 && (
              <a className="small" href={href('/questions')}>
                Log a question
              </a>
            )
          )}
        </div>
        <nav className="plate-nav" aria-label="Neighbouring plates">
          {prev ? (
            <a href={href(`/plate/${prev.id}`)}>← {plateNo(prev.plate)}</a>
          ) : (
            <span />
          )}
          {next && <a href={href(`/plate/${next.id}`)}>{plateNo(next.plate)} →</a>}
        </nav>
      </aside>

      <div className="plate-text">
        <h1 className="plate-title">{e.title || <span className="muted">Untitled</span>}</h1>
        <AnnotatedBody entry={e} />
      </div>

      <figure className="plate-figure">
        <div className="plate-figure-frame">
          <Glyph tags={e.tags} words={words} register={e.register} size={420} annotate animate />
        </div>
        <FigCaption n={plateNo(e.plate)}>Specimen glyph, drawn from {e.tags.length} tag{e.tags.length === 1 ? '' : 's'} and {words} words.</FigCaption>
        <div className="plate-actions">
          <a className="btn" href={href(`/plate/${e.id}/edit`)}>
            Edit <kbd>E</kbd>
          </a>
          <a className="btn-quiet" href={href(`/reading/${e.id}`)}>
            Read on from here
          </a>
          <a className="btn-quiet" href={href(`/atlas/${e.id}`)}>
            Locate on the atlas
          </a>
        </div>
      </figure>
    </article>
  );
}
