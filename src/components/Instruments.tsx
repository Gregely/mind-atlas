/** Decorative technical linework used across screens: rules, corner registration marks, scale bars. */
import type { ReactNode } from 'react';

/** A hairline rule with tick marks, optionally labelled at the left. */
export function TickRule({ label, right, ticks = 40 }: { label?: ReactNode; right?: ReactNode; ticks?: number }) {
  return (
    <div className="tick-rule">
      {label && <span className="tick-rule-label">{label}</span>}
      <svg className="tick-rule-svg" preserveAspectRatio="none" viewBox={`0 0 ${ticks * 10} 10`} aria-hidden>
        <line x1="0" y1="9.5" x2={ticks * 10} y2="9.5" />
        {Array.from({ length: ticks + 1 }, (_, i) => (
          <line key={i} x1={i * 10} x2={i * 10} y1={i % 5 === 0 ? 3 : 6.5} y2="9.5" />
        ))}
      </svg>
      {right && <span className="tick-rule-right">{right}</span>}
    </div>
  );
}

/** Registration marks in the four corners of a positioned container. */
export function CornerMarks() {
  return (
    <>
      {['tl', 'tr', 'bl', 'br'].map((c) => (
        <svg key={c} className={`corner-mark corner-${c}`} viewBox="0 0 12 12" aria-hidden>
          <path d="M0 6H12M6 0V12" />
          <circle cx="6" cy="6" r="3" />
        </svg>
      ))}
    </>
  );
}

/** Figure caption in the museum-plate style: "Fig. II — ..." */
export function FigCaption({ n, children }: { n: string; children: ReactNode }) {
  return (
    <figcaption className="fig-caption">
      <span className="fig-n">Fig. {n}</span>
      <span className="fig-text">{children}</span>
    </figcaption>
  );
}

/** A small orrery: concentric rings with bodies, slowly turning (static under reduced motion). */
export function Orrery({ bodies, size = 220 }: { bodies: number; size?: number }) {
  const rings = [22, 38, 56, 76, 98];
  return (
    <svg className="orrery" width={size} height={size} viewBox="-110 -110 220 220" aria-hidden>
      <circle r="106" className="o-faint" />
      {Array.from({ length: 72 }, (_, i) => {
        const a = (i * 5 * Math.PI) / 180;
        const l = i % 6 === 0 ? 6 : 3;
        return <line key={i} x1={Math.cos(a) * 106} y1={Math.sin(a) * 106} x2={Math.cos(a) * (106 - l)} y2={Math.sin(a) * (106 - l)} className="o-faint" />;
      })}
      <line x1="-110" x2="110" y1="0" y2="0" className="o-faint o-dash" />
      <line y1="-110" y2="110" x1="0" x2="0" className="o-faint o-dash" />
      {rings.map((r, i) => (
        <g key={r} className="o-ring" style={{ animationDuration: `${90 + i * 55}s`, animationDirection: i % 2 ? 'reverse' : 'normal' }}>
          <circle r={r} className="o-line" />
          {i < Math.max(1, Math.min(rings.length, bodies)) && (
            <circle cx={r} cy={0} r={i === 0 ? 3.2 : 2.2} className={i === 0 ? 'o-accent' : 'o-body'} transform={`rotate(${i * 67})`} />
          )}
        </g>
      ))}
      <circle r="5" className="o-accent" />
    </svg>
  );
}
