/**
 * I. Catalogue — the accession register. A sticky masthead with instrument readouts on
 * the left; a ledger of plates grouped by month on the right.
 */
import { useMemo, useState } from 'react';
import { useAtlas } from '../lib/store';
import { href, navigate } from '../lib/router';
import { useTitle } from '../lib/hooks';
import { dateMono, monthKey, monthLong, plateNo } from '../lib/format';
import { incipit, wordCount } from '../lib/text';
import { REGISTERS, REGISTER_BY_ID } from '../lib/registers';
import type { Entry, RegisterId } from '../types';
import { Glyph } from '../components/Glyph';
import { RegisterIcon } from '../components/RegisterMark';
import { Orrery, TickRule } from '../components/Instruments';

export function Catalogue({ tag }: { tag?: string }) {
  const { ordered, data } = useAtlas();
  const [register, setRegister] = useState<RegisterId | null>(null);
  const [newestFirst, setNewestFirst] = useState(true);
  useTitle(tag ? `Tag: ${tag}` : 'Catalogue');

  const totals = useMemo(() => {
    const tags = new Set<string>();
    let words = 0;
    const regs: Record<string, number> = {};
    for (const e of ordered) {
      e.tags.forEach((t) => tags.add(t));
      words += wordCount(e.body);
      regs[e.register] = (regs[e.register] || 0) + 1;
    }
    return { tags: tags.size, words, regs };
  }, [ordered]);

  const filtered = useMemo(() => {
    let list = ordered;
    if (tag) list = list.filter((e) => e.tags.includes(tag));
    if (register) list = list.filter((e) => e.register === register);
    return newestFirst ? [...list].reverse() : list;
  }, [ordered, tag, register, newestFirst]);

  // Group consecutive plates by month for the ledger.
  const groups = useMemo(() => {
    const out: { month: string; items: Entry[] }[] = [];
    for (const e of filtered) {
      const m = monthKey(e.date);
      if (!out.length || out[out.length - 1].month !== m) out.push({ month: m, items: [] });
      out[out.length - 1].items.push(e);
    }
    return out;
  }, [filtered]);

  const first = ordered[0];
  const latest = ordered[ordered.length - 1];
  const openQ = data.questions.filter((q) => !q.settled).length;

  return (
    <div className="page catalogue">
      <aside className="cat-masthead">
        <p className="eyebrow">Accession register</p>
        <h1 className="display cat-title">
          Mind
          <br />
          Atlas
        </h1>
        <div className="cat-orrery">
          <Orrery bodies={Math.min(5, ordered.length)} size={200} />
          <span className="cat-orrery-label">Fig. 0 · Instrument at rest</span>
        </div>
        <dl className="readout">
          <div><dt>Plates</dt><dd>{plateNo(ordered.length)}</dd></div>
          <div><dt>Tags in use</dt><dd>{plateNo(totals.tags)}</dd></div>
          <div><dt>Words recorded</dt><dd>{totals.words.toLocaleString('en-GB')}</dd></div>
          <div><dt>Open questions</dt><dd>{String(openQ).padStart(2, '0')}</dd></div>
          {first && <div><dt>First plate</dt><dd>{dateMono(first.date)}</dd></div>}
          {latest && <div><dt>Latest plate</dt><dd>{dateMono(latest.date)}</dd></div>}
        </dl>
        {ordered.length > 0 && (
          <div className="reg-legend">
            <span className="eyebrow">Registers</span>
            {REGISTERS.map((r) => (
              <button
                key={r.id}
                className={`reg-filter ${register === r.id ? 'is-on' : ''}`}
                onClick={() => setRegister(register === r.id ? null : r.id)}
                aria-pressed={register === r.id}
              >
                <RegisterIcon id={r.id} size={13} />
                <span>{r.label}</span>
                <span className="reg-count">{totals.regs[r.id] || 0}</span>
              </button>
            ))}
          </div>
        )}
      </aside>

      <section className="ledger" aria-label="Plates">
        {ordered.length === 0 ? (
          <EmptyCatalogue next={data.counters.plate + 1} />
        ) : (
          <>
            <div className="ledger-head">
              <div className="ledger-filters">
                {tag && (
                  <span className="chip chip-filter">
                    tag · {tag}
                    <a className="chip-x" href={href('/')} aria-label="Clear tag filter">
                      ×
                    </a>
                  </span>
                )}
                {register && (
                  <span className="chip chip-filter">
                    {REGISTER_BY_ID[register].label}
                    <button className="chip-x" onClick={() => setRegister(null)} aria-label="Clear register filter">
                      ×
                    </button>
                  </span>
                )}
                <span className="ledger-count">
                  {filtered.length} of {ordered.length} plates shown
                </span>
              </div>
              <button className="btn-quiet" onClick={() => setNewestFirst(!newestFirst)}>
                Order: {newestFirst ? 'newest first' : 'oldest first'}
              </button>
            </div>
            <div className="ledger-cols" aria-hidden>
              <span>No.</span>
              <span>Date</span>
              <span>Glyph</span>
              <span>Title · incipit</span>
              <span>Reg.</span>
              <span>Tags</span>
            </div>
            {groups.map((g) => (
              <div key={g.month} className="ledger-group">
                <TickRule label={monthLong(g.month)} right={`${g.items.length} plate${g.items.length === 1 ? '' : 's'}`} ticks={48} />
                {g.items.map((e) => (
                  <LedgerRow key={e.id} e={e} />
                ))}
              </div>
            ))}
            {filtered.length === 0 && <p className="muted ledger-none">No plates match these filters.</p>}
          </>
        )}
      </section>
    </div>
  );
}

function LedgerRow({ e }: { e: Entry }) {
  const words = wordCount(e.body);
  return (
    <a className="ledger-row" href={href(`/plate/${e.id}`)}>
      <span className="lr-plate">{plateNo(e.plate)}</span>
      <span className="lr-date">{dateMono(e.date)}</span>
      <span className="lr-glyph">
        <Glyph tags={e.tags} words={words} register={e.register} size={38} />
      </span>
      <span className="lr-text">
        {e.title ? <span className="lr-title">{e.title}</span> : <span className="lr-title lr-untitled">Untitled</span>}
        <span className="lr-incipit">{incipit(e.body, 140)}</span>
      </span>
      <span className="lr-reg" title={REGISTER_BY_ID[e.register].label}>
        <RegisterIcon id={e.register} size={12} />
        {REGISTER_BY_ID[e.register].abbr}
      </span>
      <span className="lr-tags">
        {e.tags.map((t) => (
          <span key={t} className="lr-tag">
            {t}
          </span>
        ))}
      </span>
    </a>
  );
}

function EmptyCatalogue({ next }: { next: number }) {
  return (
    <div className="empty-drawer">
      <svg viewBox="0 0 400 220" className="empty-drawer-svg" aria-hidden>
        <rect x="10" y="10" width="380" height="200" className="ed-line" />
        <rect x="24" y="24" width="352" height="172" className="ed-faint" />
        {Array.from({ length: 6 }, (_, i) => (
          <line key={i} x1={24 + (i + 1) * (352 / 7)} x2={24 + (i + 1) * (352 / 7)} y1="24" y2="196" className="ed-faint ed-dash" />
        ))}
        <rect x="170" y="100" width="60" height="22" className="ed-line" />
        <circle cx="200" cy="111" r="3" className="ed-accent" />
      </svg>
      <p className="eyebrow">Drawer empty</p>
      <h2 className="display">No plates catalogued</h2>
      <button className="btn btn-accent" onClick={() => navigate('/new')}>
        Begin Plate {plateNo(next)}
      </button>
      <p className="muted small">
        Or import an archive from <a href={href('/archive')}>the Archive</a>. Press <kbd>?</kbd> for keyboard shortcuts.
      </p>
    </div>
  );
}
