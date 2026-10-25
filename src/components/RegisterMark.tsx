/**
 * A small instrument symbol for each register. Drawn centred on (0,0) with radius r,
 * so it can be dropped into any SVG (glyphs, the atlas, legends).
 */
import type { RegisterId } from '../types';

interface Props {
  id: RegisterId;
  r: number;
  className?: string;
}

/** Arc path from angle a0 to a1 (degrees, 0 = east, clockwise). */
export function arcPath(r: number, a0: number, a1: number): string {
  const rad = (d: number) => (d * Math.PI) / 180;
  const x0 = Math.cos(rad(a0)) * r, y0 = Math.sin(rad(a0)) * r;
  const x1 = Math.cos(rad(a1)) * r, y1 = Math.sin(rad(a1)) * r;
  const large = ((a1 - a0) % 360 + 360) % 360 > 180 ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

export function RegisterMark({ id, r, className }: Props) {
  switch (id) {
    case 'observation': // an eye / lens: ring with a pupil
      return (
        <g className={className}>
          <circle r={r} className="rm-line" />
          <circle r={r * 0.32} className="rm-fill" />
        </g>
      );
    case 'question': // an open ring: unclosed
      return (
        <g className={className}>
          <path d={arcPath(r, -50, 230)} className="rm-line" />
          <circle cx={0} cy={0} r={r * 0.18} className="rm-fill" />
        </g>
      );
    case 'memory': // a crescent
      return (
        <g className={className}>
          <path
            d={`M0 ${-r}A${r} ${r} 0 1 0 0 ${r}A${r * 0.72} ${r} 0 1 1 0 ${-r}Z`}
            className="rm-line rm-soft"
          />
        </g>
      );
    case 'argument': // a diamond with its centre: a structure
      return (
        <g className={className}>
          <path d={`M0 ${-r}L${r} 0L0 ${r}L${-r} 0Z`} className="rm-line" />
          <circle r={r * 0.2} className="rm-fill" />
        </g>
      );
    case 'fragment': // a broken ring
      return (
        <g className={className}>
          <path d={arcPath(r, -80, -10)} className="rm-line" />
          <path d={arcPath(r, 40, 110)} className="rm-line" />
          <path d={arcPath(r, 160, 230)} className="rm-line" />
        </g>
      );
  }
}

/** Standalone inline icon for use in text and buttons. */
export function RegisterIcon({ id, size = 14, title }: { id: RegisterId; size?: number; title?: string }) {
  return (
    <svg
      className="register-icon"
      width={size}
      height={size}
      viewBox="-10 -10 20 20"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <RegisterMark id={id} r={7.5} />
    </svg>
  );
}
