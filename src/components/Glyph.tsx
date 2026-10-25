/**
 * The specimen glyph: a restrained, instrument-like figure generated from an entry's
 * tags and length. Same tags + same length = same glyph.
 *
 * Encoding (also explained on the Archive page):
 *   - concentric rings      one per tag (up to five)
 *   - arc on each ring      position set by the tag itself, so entries sharing a tag share that arc
 *   - outer graduations     density rises with word count
 *   - spokes                roughly log2 of the word count
 *   - needle (accent)       angle derived from the word count
 *   - tilted orbit          present for longer entries (over 200 words)
 *   - centre                the register symbol
 */
import { memo, type CSSProperties } from 'react';
import type { RegisterId } from '../types';
import { hashString, mulberry32 } from '../lib/seed';
import { RegisterMark, arcPath } from './RegisterMark';

export interface GlyphSpec {
  rings: number[];
  ticks: number;
  majorEvery: number;
  arcs: { r: number; start: number; sweep: number; tag: string }[];
  spokes: { a: number; r1: number; r2: number }[];
  needle: number;
  orbit: { rx: number; ry: number; rot: number; body: number } | null;
  tagCount: number;
}

const OUTER = 44;

export function glyphSpec(tags: string[], words: number): GlyphSpec {
  const sorted = [...tags].sort();
  const rng = mulberry32(hashString(sorted.join('|') + '#' + words));

  const ringCount = Math.max(1, Math.min(sorted.length, 5));
  const rings = Array.from({ length: ringCount }, (_, i) => (ringCount === 1 ? 27 : 14 + (i * 23) / (ringCount - 1)));

  const bucket = words < 50 ? 0 : words < 150 ? 1 : words < 300 ? 2 : words < 600 ? 3 : words < 1200 ? 4 : 5;
  const ticks = [24, 36, 48, 60, 72, 96][bucket];

  const arcs = sorted.slice(0, 5).map((tag, i) => {
    const h = hashString(tag);
    return { r: rings[i], start: h % 360, sweep: 36 + ((h >>> 9) % 110), tag };
  });

  const spokeCount = Math.max(1, Math.min(11, Math.round(Math.log2(words + 2))));
  const spokes = Array.from({ length: spokeCount }, () => {
    const a = rng() * 360;
    const r2 = rings[Math.floor(rng() * rings.length)] + (rng() - 0.5) * 4;
    return { a, r1: 7, r2: Math.max(9, r2) };
  });

  const needle = Math.round((words * 137.508) % 360);
  const orbit = words > 200 ? { rx: 41, ry: 10 + rng() * 16, rot: rng() * 180, body: rng() * 360 } : null;

  return { rings, ticks, majorEvery: ticks / 12, arcs, spokes, needle, orbit, tagCount: tags.length };
}

const P = (r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180; // 0° = north, clockwise
  return [Math.cos(a) * r, Math.sin(a) * r] as const;
};
const f = (n: number) => n.toFixed(2);

interface GlyphProps {
  tags: string[];
  words: number;
  register: RegisterId;
  size?: number;
  /** Plot-on animation when first shown. */
  animate?: boolean;
  /** Show labelled leader lines explaining the encoding (used on the plate view). */
  annotate?: boolean;
  className?: string;
  title?: string;
}

function GlyphInner({ tags, words, register, size = 64, animate = false, annotate = false, className = '', title }: GlyphProps) {
  const s = glyphSpec(tags, words);
  const vb = annotate ? '-100 -64 200 128' : '-50 -50 100 100';
  const unitsPerPx = (annotate ? 200 : 100) / size;
  const sw = Math.max(0.35, unitsPerPx * 0.85);
  let k = 0; // animation sequence counter
  const plot = (extra = '') => ({
    className: `${animate ? 'plot' : ''} ${extra}`.trim(),
    pathLength: 1,
    style: animate ? ({ '--d': `${(k++) * 70}ms` } as CSSProperties) : undefined,
  });

  // All graduation ticks in one path so they plot on in one sweep.
  let tickPath = '';
  for (let i = 0; i < s.ticks; i++) {
    const deg = (i * 360) / s.ticks;
    const major = i % s.majorEvery === 0;
    const [x0, y0] = P(OUTER, deg);
    const [x1, y1] = P(OUTER - (major ? 4.5 : 2.2), deg);
    tickPath += `M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}`;
  }

  const [nx, ny] = P(OUTER - 1, s.needle);
  const [nbx, nby] = P(9, s.needle + 180);

  return (
    <svg
      className={`glyph ${className}`}
      width={annotate ? undefined : size}
      height={annotate ? undefined : size}
      viewBox={vb}
      style={{ '--sw': sw } as CSSProperties}
      role="img"
      aria-label={title || `Glyph: ${tags.length} tags, ${words} words`}
    >
      <circle r={OUTER} {...plot('g-line')} />
      <path d={tickPath} {...plot('g-line g-faint')} />
      {s.rings.map((r, i) => (
        <circle key={`r${i}`} r={r} {...plot('g-line g-faint')} />
      ))}
      {s.spokes.map((sp, i) => {
        const [x0, y0] = P(sp.r1, sp.a);
        const [x1, y1] = P(sp.r2, sp.a);
        return <path key={`s${i}`} d={`M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}`} {...plot('g-line g-faint')} />;
      })}
      {s.arcs.map((a, i) => {
        const [ex, ey] = P(a.r, a.start + a.sweep);
        return (
          <g key={`a${i}`}>
            <path d={arcPath(a.r, a.start - 90, a.start + a.sweep - 90)} {...plot('g-line g-strong')} />
            <circle cx={ex} cy={ey} r={1.6} className="g-dot" />
          </g>
        );
      })}
      {s.orbit && (
        <g transform={`rotate(${f(s.orbit.rot)})`}>
          <ellipse rx={s.orbit.rx} ry={s.orbit.ry} {...plot('g-line g-faint g-dash')} />
          <circle
            cx={Math.cos((s.orbit.body * Math.PI) / 180) * s.orbit.rx}
            cy={Math.sin((s.orbit.body * Math.PI) / 180) * s.orbit.ry}
            r={2}
            className="g-dot"
          />
        </g>
      )}
      <path d={`M${f(nbx)} ${f(nby)}L${f(nx)} ${f(ny)}`} {...plot('g-needle')} />
      <circle cx={nx} cy={ny} r={1.3} className="g-needle-tip" />
      <g className="g-center">
        <circle r={7.5} className="g-occlude" />
        <RegisterMark id={register} r={5} />
      </g>

      {annotate && <Annotations s={s} words={words} />}
    </svg>
  );
}

/** Leader lines and labels describing the figure, like an anatomical plate. */
function Annotations({ s, words }: { s: GlyphSpec; words: number }) {
  const items: { deg: number; r: number; side: -1 | 1; y: number; label: string; value: string }[] = [
    { deg: 300, r: OUTER, side: -1, y: -44, label: 'GRADUATIONS', value: String(s.ticks) },
    { deg: 235, r: s.rings[0], side: -1, y: 34, label: 'SPOKES', value: String(s.spokes.length) },
    { deg: 50, r: s.rings[s.rings.length - 1], side: 1, y: -44, label: 'RINGS', value: `${s.rings.length} · ${s.tagCount} tag${s.tagCount === 1 ? '' : 's'}` },
    { deg: 140, r: OUTER - 6, side: 1, y: 34, label: 'NEEDLE', value: `${s.needle}°` },
  ];
  return (
    <g className="g-annot">
      {items.map((it) => {
        const [px, py] = P(it.r, it.deg);
        const ex = it.side * 62;
        const tx = it.side * 66;
        return (
          <g key={it.label}>
            <circle cx={px} cy={py} r={0.9} className="g-dot" />
            <path d={`M${f(px)} ${f(py)}L${f(ex - it.side * 6)} ${it.y}L${ex} ${it.y}`} className="g-leader" />
            <text x={tx} y={it.y - 1.5} textAnchor={it.side < 0 ? 'end' : 'start'} className="g-label">
              {it.label}
            </text>
            <text x={tx} y={it.y + 5} textAnchor={it.side < 0 ? 'end' : 'start'} className="g-value">
              {it.value}
            </text>
          </g>
        );
      })}
      {/* Scale bar: the radius in words */}
      <g transform="translate(0 56)">
        <path d={`M${-OUTER} 0H0M${-OUTER} -2V2M0 -2V2M${-OUTER / 2} -1.2V1.2`} className="g-leader" />
        <text x={4} y={1.6} className="g-value">
          R = {words} words
        </text>
      </g>
    </g>
  );
}

export const Glyph = memo(GlyphInner);
