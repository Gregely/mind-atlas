/**
 * III. Cabinet of Themes — descriptive figures of tags, registers and words over time.
 * Every figure only counts what is there. Nothing here interprets the content.
 *
 *   Fig. I    Periodic table of tags (periods = month a tag first appeared)
 *   Fig. II   Spectrum of tag occurrence over time
 *   Fig. III  Strata of registers over time
 *   Fig. IV   Lexicon: most frequent content words
 *   Fig. V    Words recorded over time
 */
import { useMemo, useState, type CSSProperties } from 'react';
import { useAtlas } from '../lib/store';
import { href } from '../lib/router';
import { useReducedMotion, useTitle, useWidth } from '../lib/hooks';
import { computeStats, elementSymbols, type TagStat } from '../lib/stats';
import { dateMono, dateShort, monthAxis, monthKey, plateNo, roman } from '../lib/format';
import { wordCount } from '../lib/text';
import { REGISTERS } from '../lib/registers';
import type { Entry, RegisterId } from '../types';
import { FigCaption } from '../components/Instruments';

/* ------------------------------------------------------------------------- */
/* Time bins: weeks for a short archive, months once it spans longer.        */
/* ------------------------------------------------------------------------- */

interface Bin {
  key: string;
  label: string;
  entries: Entry[];
}

const DAY = 86400000;
const dayNum = (iso: string) => Math.floor(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY);

function makeBins(ordered: Entry[], months: string[]): { bins: Bin[]; unit: 'week' | 'month' } {
  if (!ordered.length) return { bins: [], unit: 'month' };
  const d0 = dayNum(ordered[0].date);
  const d1 = dayNum(ordered[ordered.length - 1].date);
  if (d1 - d0 < 120) {
    const n = Math.floor((d1 - d0) / 7) + 1;
    const bins: Bin[] = Array.from({ length: n }, (_, i) => {
      const start = new Date((d0 + i * 7) * DAY).toISOString().slice(0, 10);
      return { key: `w${i}`, label: dateShort(start).replace(/ \d{4}$/, ''), entries: [] };
    });
    for (const e of ordered) bins[Math.floor((dayNum(e.date) - d0) / 7)].entries.push(e);
    return { bins, unit: 'week' };
  }
  const idx = new Map(months.map((m, i) => [m, i]));
  const bins: Bin[] = months.map((m) => ({ key: m, label: monthAxis(m, m.endsWith('-01') || months.length < 13), entries: [] }));
  for (const e of ordered) bins[idx.get(monthKey(e.date))!].entries.push(e);
  return { bins, unit: 'month' };
}

export function Cabinet() {
  useTitle('Cabinet of Themes');
  const { ordered } = useAtlas();
  const stats = useMemo(() => computeStats(ordered), [ordered]);
  const symbols = useMemo(() => elementSymbols(stats.tags.map((t) => t.tag)), [stats.tags]);
  const { bins, unit } = useMemo(() => makeBins(ordered, stats.months), [ordered, stats.months]);
  const [selected, setSelected] = useState<string | null>(null);
  const sel = stats.tags.find((t) => t.tag === selected) || null;

  if (!ordered.length) {
    return (
      <div className="page cabinet">
        <header className="cab-head">
          <p className="eyebrow">Section III</p>
          <h1 className="display">Cabinet of Themes</h1>
        </header>
        <div className="cab-empty">
          <p className="display">The cabinet is empty</p>
          <p className="muted">Figures are drawn here from the tags, registers and words of catalogued plates.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page cabinet">
      <header className="cab-head">
        <div>
          <p className="eyebrow">Section III</p>
          <h1 className="display">Cabinet of Themes</h1>
        </div>
        <dl className="readout readout-row">
          <div><dt>Plates</dt><dd>{plateNo(ordered.length)}</dd></div>
          <div><dt>Distinct tags</dt><dd>{plateNo(stats.tags.length)}</dd></div>
          <div><dt>Words</dt><dd>{stats.totalWords.toLocaleString('en-GB')}</dd></div>
          <div><dt>Span</dt><dd>{dateMono(ordered[0].date)} – {dateMono(ordered[ordered.length - 1].date)}</dd></div>
        </dl>
      </header>

      <section className="cab-fig cab-fig-table">
        <PeriodicTable tags={stats.tags} symbols={symbols} selected={selected} onSelect={setSelected} />
        <FigCaption n="I">
          Periodic table of tags. Numbered in order of first use; each period is the month in which its tags first appear. Shade follows
          frequency.
        </FigCaption>
        {sel && <ElementDetail stat={sel} symbol={symbols.get(sel.tag)!} onClose={() => setSelected(null)} />}
      </section>

      <div className="cab-split">
        <section className="cab-fig cab-fig-spectrum">
          <Spectrum tags={stats.tags} bins={bins} selected={selected} onSelect={setSelected} />
          <FigCaption n="II">
            Spectrum of occurrence: the {Math.min(16, stats.tags.length)} most frequent tags, one line per {unit} in which each appears.
            Line height follows the number of plates.
          </FigCaption>
        </section>

        <section className="cab-fig cab-fig-strata">
          <Strata bins={bins} />
          <FigCaption n="III">Strata of registers: plates per {unit}, layered by register.</FigCaption>
        </section>
      </div>

      <section className="cab-fig cab-fig-lexicon">
        <Lexicon words={stats.words.slice(0, 40)} />
        <FigCaption n="IV">Lexicon: the forty most frequent content words across all plates, with occurrences. Common function words are omitted.</FigCaption>
      </section>

      <section className="cab-fig cab-fig-trace">
        <Trace bins={bins} />
        <FigCaption n="V">Words recorded per {unit}.</FigCaption>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------------- */

function PeriodicTable({
  tags,
  symbols,
  selected,
  onSelect,
}: {
  tags: TagStat[];
  symbols: Map<string, string>;
  selected: string | null;
  onSelect: (t: string | null) => void;
}) {
  const max = Math.max(1, ...tags.map((t) => t.count));
  const periods = useMemo(() => {
    const m = new Map<string, TagStat[]>();
    tags.forEach((t) => (m.get(t.firstMonth) || m.set(t.firstMonth, []).get(t.firstMonth)!).push(t));
    return [...m.entries()];
  }, [tags]);

  if (!tags.length) return <p className="muted">No tags have been recorded yet.</p>;

  return (
    <div className="ptable" role="list">
      {periods.map(([month, list], pi) => (
        <div className="ptable-period" key={month}>
          <div className="ptable-plabel">
            <span className="mono">{roman(pi + 1)}</span>
            <span className="eyebrow">{month.replace('-', '·')}</span>
          </div>
          <div className="ptable-cells">
            {list.map((t) => {
              const shade = Math.pow(t.count / max, 0.6);
              return (
                <button
                  key={t.tag}
                  role="listitem"
                  className={`element ${selected === t.tag ? 'is-on' : ''}`}
                  style={{ '--shade': shade.toFixed(3) } as CSSProperties}
                  onClick={() => onSelect(selected === t.tag ? null : t.tag)}
                  title={`${t.tag} — ${t.count} plate${t.count === 1 ? '' : 's'}`}
                >
                  <span className="el-num">{t.order}</span>
                  <span className="el-count">{t.count}</span>
                  <span className="el-sym">{symbols.get(t.tag)}</span>
                  <span className="el-name">{t.tag}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function ElementDetail({ stat, symbol, onClose }: { stat: TagStat; symbol: string; onClose: () => void }) {
  return (
    <div className="el-detail">
      <div className="el-detail-sym">
        <span className="el-num">{stat.order}</span>
        <span className="el-sym">{symbol}</span>
      </div>
      <div className="el-detail-body">
        <h3>{stat.tag}</h3>
        <dl className="readout readout-row">
          <div><dt>Plates</dt><dd>{stat.count}</dd></div>
          <div><dt>First recorded</dt><dd>{dateMono(stat.firstDate)}</dd></div>
          <div><dt>Latest</dt><dd>{dateMono(stat.lastDate)}</dd></div>
          <div><dt>Months present</dt><dd>{stat.byMonth.size}</dd></div>
        </dl>
        <div className="el-plates">
          {stat.plates.map((e) => (
            <a key={e.id} href={href(`/plate/${e.id}`)} className="mono" title={e.title || 'Untitled'}>
              {plateNo(e.plate)}
            </a>
          ))}
        </div>
        <a className="small" href={href(`/tag/${encodeURIComponent(stat.tag)}`)}>
          List these plates in the catalogue →
        </a>
      </div>
      <button className="btn-quiet close" onClick={onClose} aria-label="Close">
        ×
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------------- */

function Spectrum({ tags, bins, selected, onSelect }: { tags: TagStat[]; bins: Bin[]; selected: string | null; onSelect: (t: string) => void }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const reduced = useReducedMotion();
  let rows = [...tags].sort((a, b) => b.count - a.count || a.order - b.order).slice(0, 16);
  const selStat = tags.find((t) => t.tag === selected);
  if (selStat && !rows.includes(selStat)) rows = [...rows.slice(0, 15), selStat];

  // Count per (tag, bin).
  const cells = rows.map((t) => bins.map((b) => b.entries.filter((e) => e.tags.includes(t.tag)).length));
  const maxCell = Math.max(1, ...cells.flat());

  const LW = Math.min(150, W * 0.3);
  const RH = 24;
  const top = 8;
  const H = top + rows.length * RH + 34;
  const plotW = Math.max(40, W - LW - 12);
  const colW = plotW / Math.max(1, bins.length);
  const labelEvery = Math.max(1, Math.ceil(46 / colW));

  return (
    <div ref={ref} className="chart">
      {!rows.length ? (
        <p className="muted">No tags have been recorded yet.</p>
      ) : (
        <svg width={W} height={H} className="spectrum">
          {rows.map((t, ri) => {
            const y = top + ri * RH;
            const on = selected === t.tag;
            return (
              <g key={t.tag} className={`sp-row ${on ? 'is-on' : ''}`} onClick={() => onSelect(t.tag)}>
                <rect x={0} y={y} width={W} height={RH} className="sp-hit" />
                <text x={LW - 10} y={y + RH / 2 + 4} textAnchor="end" className="sp-label">
                  {t.tag.length > 20 ? t.tag.slice(0, 19) + '…' : t.tag}
                </text>
                <line x1={LW} x2={LW + plotW} y1={y + RH - 3} y2={y + RH - 3} className="sp-base" />
                {cells[ri].map((c, bi) => {
                  if (!c) return null;
                  const h = (RH - 6) * Math.sqrt(c / maxCell);
                  const x = LW + bi * colW + colW / 2;
                  return (
                    <line
                      key={bi}
                      x1={x}
                      x2={x}
                      y1={y + RH - 3}
                      y2={y + RH - 3 - h}
                      className={`sp-line ${reduced ? '' : 'plot'}`}
                      pathLength={1}
                      style={{ '--d': `${(ri * 3 + bi) * 18}ms`, strokeWidth: Math.max(1, Math.min(3, colW * 0.35)) } as CSSProperties}
                    />
                  );
                })}
              </g>
            );
          })}
          {/* time axis */}
          <g className="axis" transform={`translate(0 ${top + rows.length * RH + 4})`}>
            <line x1={LW} x2={LW + plotW} y1={0} y2={0} />
            {bins.map((b, i) => (
              <g key={b.key} transform={`translate(${LW + i * colW + colW / 2} 0)`}>
                <line y1={0} y2={i % labelEvery === 0 ? 6 : 3} />
                {i % labelEvery === 0 && (
                  <text y={20} textAnchor="middle">
                    {b.label}
                  </text>
                )}
              </g>
            ))}
          </g>
        </svg>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------- */

const STRATA_PATTERN: Record<RegisterId, string> = {
  observation: 'pat-solid',
  question: 'pat-horiz',
  memory: 'pat-dots',
  argument: 'pat-diag',
  fragment: 'pat-cross',
};

/** SVG hatch patterns, like the legend of a geological section. */
function StrataPatterns() {
  return (
    <defs>
      <pattern id="pat-solid" width="4" height="4" patternUnits="userSpaceOnUse">
        <rect width="4" height="4" className="pat-fill" />
      </pattern>
      <pattern id="pat-horiz" width="4" height="4" patternUnits="userSpaceOnUse">
        <path d="M0 2H4" className="pat-line" />
      </pattern>
      <pattern id="pat-dots" width="5" height="5" patternUnits="userSpaceOnUse">
        <circle cx="2.5" cy="2.5" r="0.9" className="pat-dot" />
      </pattern>
      <pattern id="pat-diag" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <path d="M0 2.5H5" className="pat-line" />
      </pattern>
      <pattern id="pat-cross" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <path d="M0 3H6M3 0V6" className="pat-line" />
      </pattern>
    </defs>
  );
}

function Strata({ bins }: { bins: Bin[] }) {
  const [ref, W] = useWidth<HTMLDivElement>(400);
  const H = 260;
  const left = 30;
  const plotH = H - 50;
  const max = Math.max(1, ...bins.map((b) => b.entries.length));
  const colW = (W - left - 6) / Math.max(1, bins.length);
  const barW = Math.max(2, Math.min(36, colW * 0.72));
  const unitH = plotH / max;
  const labelEvery = Math.max(1, Math.ceil(46 / colW));
  const ticks = Array.from(new Set([0, Math.ceil(max / 2), max]));

  return (
    <div ref={ref} className="chart">
      <svg width={W} height={H} className="strata">
        <StrataPatterns />
        {ticks.map((t) => (
          <g key={t} className="axis">
            <line x1={left - 4} x2={W} y1={10 + plotH - t * unitH} y2={10 + plotH - t * unitH} className="axis-faint" />
            <text x={left - 8} y={14 + plotH - t * unitH} textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        {bins.map((b, i) => {
          let y = 10 + plotH;
          const x = left + i * colW + (colW - barW) / 2;
          return (
            <g key={b.key}>
              {REGISTERS.map((r) => {
                const c = b.entries.filter((e) => e.register === r.id).length;
                if (!c) return null;
                const h = c * unitH;
                y -= h;
                return (
                  <rect key={r.id} x={x} y={y} width={barW} height={h} fill={`url(#${STRATA_PATTERN[r.id]})`} className="stratum">
                    <title>
                      {b.label}: {c} {r.label}
                    </title>
                  </rect>
                );
              })}
              <g className="axis" transform={`translate(${x + barW / 2} ${12 + plotH})`}>
                <line y1={0} y2={4} />
                {i % labelEvery === 0 && (
                  <text y={18} textAnchor="middle">
                    {b.label}
                  </text>
                )}
              </g>
            </g>
          );
        })}
      </svg>
      <div className="strata-legend">
        {REGISTERS.map((r) => (
          <span key={r.id}>
            <svg width="16" height="12" aria-hidden>
              <StrataPatterns />
              <rect x="0.5" y="0.5" width="15" height="11" fill={`url(#${STRATA_PATTERN[r.id]})`} className="stratum" />
            </svg>
            {r.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */

function Lexicon({ words }: { words: { word: string; count: number; firstPlate: number }[] }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const reduced = useReducedMotion();
  if (!words.length) return <p className="muted">No words recorded yet.</p>;
  const H = 230;
  const base = 120;
  const max = Math.max(1, ...words.map((w) => w.count));
  const gap = (W - 20) / words.length;
  return (
    <div ref={ref} className="chart">
      <svg width={W} height={H} className="lexicon">
        <line x1={0} x2={W} y1={base} y2={base} className="lx-base" />
        {words.map((w, i) => {
          const x = 10 + i * gap + gap / 2;
          const h = 10 + (base - 30) * (w.count / max);
          return (
            <g key={w.word}>
              <line x1={x} x2={x} y1={base} y2={base - h} className={`lx-line ${reduced ? '' : 'plot'}`} pathLength={1} style={{ '--d': `${i * 25}ms` } as CSSProperties}>
                <title>
                  {w.word}: {w.count} (first in Plate {plateNo(w.firstPlate)})
                </title>
              </line>
              <text x={x} y={base - h - 6} textAnchor="middle" className="lx-count">
                {w.count}
              </text>
              <text transform={`translate(${x + 3} ${base + 10}) rotate(55)`} className="lx-word">
                {w.word}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------------- */

function Trace({ bins }: { bins: Bin[] }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const reduced = useReducedMotion();
  const H = 140;
  const left = 46;
  const plotH = H - 40;
  const vals = bins.map((b) => b.entries.reduce((s, e) => s + wordCount(e.body), 0));
  const max = Math.max(1, ...vals);
  const colW = (W - left - 10) / Math.max(1, bins.length);
  const pts = vals.map((v, i) => [left + i * colW + colW / 2, 10 + plotH - (v / max) * plotH] as const);
  const labelEvery = Math.max(1, Math.ceil(46 / colW));
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
  return (
    <div ref={ref} className="chart">
      <svg width={W} height={H} className="trace">
        {[0, max].map((t) => (
          <g key={t} className="axis">
            <line x1={left - 4} x2={W} y1={10 + plotH - (t / max) * plotH} y2={10 + plotH - (t / max) * plotH} className="axis-faint" />
            <text x={left - 8} y={14 + plotH - (t / max) * plotH} textAnchor="end">
              {t.toLocaleString('en-GB')}
            </text>
          </g>
        ))}
        <path d={d} className={`trace-line ${reduced ? '' : 'plot'}`} pathLength={1} />
        {pts.map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r={2} className="trace-dot">
              <title>
                {bins[i].label}: {vals[i]} words
              </title>
            </circle>
            <g className="axis" transform={`translate(${x} ${12 + plotH})`}>
              <line y1={0} y2={4} />
              {i % labelEvery === 0 && (
                <text y={18} textAnchor="middle">
                  {bins[i].label}
                </text>
              )}
            </g>
          </g>
        ))}
      </svg>
    </div>
  );
}
