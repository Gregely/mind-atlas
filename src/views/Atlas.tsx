/**
 * II. The Atlas — a pannable, zoomable star chart of every plate.
 *
 *   World coordinates come from lib/atlasLayout (older plates near the centre).
 *   The view is { cx, cy, k }: the world point at the centre of the screen and the zoom.
 *   world → screen:  sx = (x - cx) * k + W/2
 *
 * Layers, back to front: parallax star field, graticule, month rings, constellation
 * lines, hidden annotations, bodies, then HTML overlays (placard, legend, minimap, readouts).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useAtlas } from '../lib/store';
import { navigate } from '../lib/router';
import { useKey, useReducedMotion, useTitle } from '../lib/hooks';
import { computeLayout, type AtlasNode } from '../lib/atlasLayout';
import { coord, dateMono, monthAxis, plateNo } from '../lib/format';
import { incipit } from '../lib/text';
import { mulberry32 } from '../lib/seed';
import { REGISTERS, REGISTER_BY_ID } from '../lib/registers';
import type { RegisterId } from '../types';
import { RegisterMark } from '../components/RegisterMark';
import { RegisterIcon } from '../components/RegisterMark';

interface View {
  cx: number;
  cy: number;
  k: number;
}

const MIN_K = 0.06;
const MAX_K = 8;
const clampK = (k: number) => Math.max(MIN_K, Math.min(MAX_K, k));

/** A "nice" graticule step (1, 2 or 5 × 10ⁿ) giving roughly `px` pixels per cell. */
function niceStep(k: number, px = 110): number {
  const raw = px / k;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

/** Deterministic background stars, in a square tile that repeats. */
const STAR_TILE = 900;
const STARS = (() => {
  const rng = mulberry32(20261025);
  return Array.from({ length: 140 }, () => ({ x: rng() * STAR_TILE, y: rng() * STAR_TILE, r: rng() < 0.08 ? 1.1 : 0.55, o: 0.25 + rng() * 0.5 }));
})();

export function Atlas({ focusId }: { focusId?: string }) {
  useTitle('Atlas');
  const { ordered, data } = useAtlas();
  const reduced = useReducedMotion();
  const layout = useMemo(() => computeLayout(ordered), [ordered]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1200, h: 800 });
  const [view, setView] = useState<View>({ cx: 0, cy: 0, k: 1 });
  const [hover, setHover] = useState<AtlasNode | null>(null);
  const [pinTag, setPinTag] = useState<string | null>(null);
  const [regFilter, setRegFilter] = useState<Set<RegisterId>>(new Set());
  const [showLabels, setShowLabels] = useState(true);
  const [showMinimap, setShowMinimap] = useState(true);
  const [legendOpen, setLegendOpen] = useState(true);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [settle, setSettle] = useState(reduced ? 1 : 0); // 0 → 1 orbit-settling animation
  const animRef = useRef<number | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  // Track the container size.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setSize({ w: Math.max(200, r.width), h: Math.max(200, r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** View that fits the whole chart on screen. */
  const fitView = useCallback((): View => {
    const b = layout.bounds;
    const k = clampK(Math.min(size.w / (b.maxX - b.minX), size.h / (b.maxY - b.minY)) * 0.9);
    return { cx: (b.minX + b.maxX) / 2, cy: (b.minY + b.maxY) / 2, k };
  }, [layout, size]);

  /** Smoothly move the view (instant under reduced motion). */
  const flyTo = useCallback(
    (target: View, ms = 900) => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (reduced) {
        setView(target);
        return;
      }
      const from = { ...viewRef.current };
      const t0 = performance.now();
      const step = (t: number) => {
        const p = Math.min(1, (t - t0) / ms);
        const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        // Interpolate zoom logarithmically so it feels even.
        const k = Math.exp(Math.log(from.k) + (Math.log(target.k) - Math.log(from.k)) * e);
        setView({ cx: from.cx + (target.cx - from.cx) * e, cy: from.cy + (target.cy - from.cy) * e, k });
        if (p < 1) animRef.current = requestAnimationFrame(step);
      };
      animRef.current = requestAnimationFrame(step);
    },
    [reduced],
  );
  // Initial view: fit everything, or focus a plate if one was requested.
  const initialised = useRef(false);
  useEffect(() => {
    if (initialised.current || size.w === 1200) return; // wait for the real size
    initialised.current = true;
    const fit = fitView();
    const focus = focusId ? layout.byId.get(focusId) : undefined;
    if (focus) {
      setView(fit);
      setTimeout(() => flyTo({ cx: focus.x, cy: focus.y, k: 2.2 }, 1400), reduced ? 0 : 900);
    } else setView(fit);
  }, [size, fitView, focusId, layout, flyTo, reduced]);

  // Bodies settle into orbit once on arrival.
  useEffect(() => {
    if (reduced) {
      setSettle(1);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 2200);
      setSettle(p);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  useEffect(() => () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
  }, []);

  const { w: W, h: H } = size;
  const toScreen = (x: number, y: number) => [(x - view.cx) * view.k + W / 2, (y - view.cy) * view.k + H / 2] as const;
  const toWorld = (sx: number, sy: number) => [(sx - W / 2) / view.k + view.cx, (sy - H / 2) / view.k + view.cy] as const;

  /** Node position during the settling animation: swings in along its orbit. */
  const nodePos = (nd: AtlasNode) => {
    if (settle >= 1) return [nd.x, nd.y] as const;
    const n = layout.nodes.length || 1;
    const local = Math.max(0, Math.min(1, settle * 1.5 - (nd.index / n) * 0.5));
    const e = 1 - Math.pow(1 - local, 3);
    const r = Math.hypot(nd.x, nd.y);
    const th = Math.atan2(nd.y, nd.x) - (1 - e) * 1.2;
    const rr = r * (0.7 + 0.3 * e);
    return [Math.cos(th) * rr, Math.sin(th) * rr] as const;
  };

  /* ---------------- Interaction: drag, wheel, pinch, keys ---------------- */

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ moved: number; nodeId: string | null } | null>(null);

  const zoomAt = useCallback((sx: number, sy: number, factor: number) => {
    setView((v) => {
      const k = clampK(v.k * factor);
      const wx = (sx - size.w / 2) / v.k + v.cx;
      const wy = (sy - size.h / 2) / v.k + v.cy;
      return { k, cx: wx - (sx - size.w / 2) / k, cy: wy - (sy - size.h / 2) / k };
    });
  }, [size]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (animRef.current) cancelAnimationFrame(animRef.current);
      const rect = el.getBoundingClientRect();
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-delta * 0.0015));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const onPointerDown = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest('.atlas-ui')) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // Remember which body (if any) was pressed: it opens on release if the pointer didn't travel.
    const nodeEl = (e.target as Element).closest('[data-id]');
    drag.current = { moved: 0, nodeId: pointers.current.size === 1 && nodeEl ? nodeEl.getAttribute('data-id') : null };
    if (animRef.current) cancelAnimationFrame(animRef.current);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    const [wx, wy] = toWorld(e.clientX - rect.left, e.clientY - rect.top);
    setCursor({ x: wx, y: wy });
    const prev = pointers.current.get(e.pointerId);
    if (!prev || !drag.current) return;
    const pts = pointers.current;
    if (pts.size === 2) {
      // Pinch zoom around the midpoint.
      const [a, b] = [...pts.values()];
      const before = Math.hypot(a.x - b.x, a.y - b.y);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [a2, b2] = [...pts.values()];
      const after = Math.hypot(a2.x - b2.x, a2.y - b2.y);
      if (before > 0) zoomAt((a2.x + b2.x) / 2 - rect.left, (a2.y + b2.y) / 2 - rect.top, after / before);
      drag.current.moved += 10;
      return;
    }
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    drag.current.moved += Math.abs(dx) + Math.abs(dy);
    setView((v) => ({ ...v, cx: v.cx - dx / v.k, cy: v.cy - dy / v.k }));
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    pointers.current.delete(e.pointerId);
    const d = drag.current;
    if (pointers.current.size === 0) {
      drag.current = null;
      if (d && d.nodeId && d.moved < 6 && e.type === 'pointerup') navigate(`/plate/${d.nodeId}`);
    }
  };

  useKey(
    (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const step = 80 / view.k;
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') setView((v) => ({ ...v, cx: v.cx - step }));
      else if (k === 'arrowright' || k === 'd') setView((v) => ({ ...v, cx: v.cx + step }));
      else if (k === 'arrowup' || k === 'w') setView((v) => ({ ...v, cy: v.cy - step }));
      else if (k === 'arrowdown' || k === 's') setView((v) => ({ ...v, cy: v.cy + step }));
      else if (k === '+' || k === '=') zoomAt(W / 2, H / 2, 1.3);
      else if (k === '-' || k === '_') zoomAt(W / 2, H / 2, 1 / 1.3);
      else if (k === '0') flyTo(fitView());
      else if (k === 'l') setShowLabels((s) => !s);
      else if (k === 'm') setShowMinimap((s) => !s);
      else if (k === 'escape') setPinTag(null);
      else return;
      e.preventDefault();
    },
    [view, W, H, fitView, flyTo, zoomAt],
  );

  /* ---------------- Derived drawing data ---------------- */

  const activeTags = useMemo(() => {
    if (pinTag) return new Set([pinTag]);
    if (hover) return new Set(hover.entry.tags);
    return null;
  }, [pinTag, hover]);

  const visibleNode = (nd: AtlasNode) => regFilter.size === 0 || regFilter.has(nd.entry.register);

  // Graticule lines for the visible region.
  const [wx0, wy0] = toWorld(0, 0);
  const [wx1, wy1] = toWorld(W, H);
  const step = niceStep(view.k);
  const gridX: number[] = [];
  const gridY: number[] = [];
  for (let x = Math.ceil(wx0 / step) * step; x <= wx1; x += step) gridX.push(x);
  for (let y = Math.ceil(wy0 / step) * step; y <= wy1; y += step) gridY.push(y);

  // Parallax: the star field moves at a fraction of the pan speed.
  const par = 0.25;
  const offX = (((-view.cx * view.k * par) % STAR_TILE) + STAR_TILE) % STAR_TILE;
  const offY = (((-view.cy * view.k * par) % STAR_TILE) + STAR_TILE) % STAR_TILE;
  const tiles: [number, number][] = [];
  for (let tx = -1; tx * STAR_TILE < W; tx++) for (let ty = -1; ty * STAR_TILE < H; ty++) tiles.push([tx * STAR_TILE + offX, ty * STAR_TILE + offY]);

  const nodeScale = Math.max(0.3, Math.min(2.4, Math.sqrt(view.k) * 1.1));
  const [ox, oy] = toScreen(0, 0);
  const outerR = layout.rings.length ? Math.hypot(layout.bounds.maxX - layout.bounds.minX, layout.bounds.maxY - layout.bounds.minY) / 2 : 300;

  // Scale bar: a nice length in world units ≈ 120px.
  const scaleUnits = niceStep(view.k, 120);
  const scalePx = scaleUnits * view.k;

  const hoverScreen = hover ? toScreen(...nodePos(hover)) : null;
  const firstEntry = ordered[0];

  return (
    <div
      className={`atlas ${hover ? 'is-hovering' : ''}`}
      ref={wrapRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => setCursor(null)}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('.atlas-ui')) return;
        const rect = wrapRef.current!.getBoundingClientRect();
        zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.shiftKey ? 1 / 1.8 : 1.8);
      }}
    >
      <svg className="atlas-svg" width={W} height={H} role="img" aria-label={`Star chart of ${ordered.length} plates`}>
        {/* Star field (parallax) */}
        <g className="atlas-stars">
          {tiles.map(([tx, ty], i) => (
            <g key={i} transform={`translate(${tx - STAR_TILE} ${ty - STAR_TILE})`}>
              {STARS.map((s, j) => (
                <circle key={j} cx={s.x} cy={s.y} r={s.r} opacity={s.o} />
              ))}
            </g>
          ))}
        </g>

        {/* Graticule */}
        <g className="atlas-grid">
          {gridX.map((x) => {
            const [sx] = toScreen(x, 0);
            const major = Math.round(x / step) % 5 === 0;
            return <line key={`gx${x}`} x1={sx} x2={sx} y1={0} y2={H} className={major ? 'major' : ''} />;
          })}
          {gridY.map((y) => {
            const [, sy] = toScreen(0, y);
            const major = Math.round(y / step) % 5 === 0;
            return <line key={`gy${y}`} y1={sy} y2={sy} x1={0} x2={W} className={major ? 'major' : ''} />;
          })}
        </g>
        <g className="atlas-grid-labels">
          {gridX.map((x) => {
            const [sx] = toScreen(x, 0);
            return (
              <text key={`lx${x}`} x={sx + 3} y={14}>
                {coord(x)}
              </text>
            );
          })}
          {gridY.map((y) => {
            const [, sy] = toScreen(0, y);
            return (
              <text key={`ly${y}`} x={W - 4} y={sy - 3} textAnchor="end">
                {coord(-y)}
              </text>
            );
          })}
        </g>

        {/* Growth rings: each month begins at a radius on the spiral */}
        <g className="atlas-rings">
          {layout.rings.map((r, i) => (
            <g key={r.month}>
              <circle cx={ox} cy={oy} r={r.radius * view.k} className={i === 0 ? 'ring-origin' : ''} />
              {view.k * r.radius > 30 && (
                <text x={ox + r.radius * view.k * Math.cos(-0.6) + 4} y={oy + r.radius * view.k * Math.sin(-0.6)} className="ring-label">
                  {monthAxis(r.month, true)}
                </text>
              )}
            </g>
          ))}
          {/* Crosshair through the origin */}
          <line x1={ox - 14} x2={ox + 14} y1={oy} y2={oy} className="origin-cross" />
          <line y1={oy - 14} y2={oy + 14} x1={ox} x2={ox} className="origin-cross" />
        </g>

        {/* Constellations */}
        <g className={`atlas-links ${settle < 1 ? 'is-settling' : ''}`}>
          {layout.constellations.map((c) =>
            c.edges.map(([a, b]) => {
              const na = layout.byId.get(a)!;
              const nb = layout.byId.get(b)!;
              if (!visibleNode(na) || !visibleNode(nb)) return null;
              const [x1, y1] = toScreen(...nodePos(na));
              const [x2, y2] = toScreen(...nodePos(nb));
              const on = activeTags?.has(c.tag);
              return <line key={`${c.tag}-${a}-${b}`} x1={x1} y1={y1} x2={x2} y2={y2} className={on ? 'is-on' : activeTags ? 'is-dim' : ''} />;
            }),
          )}
        </g>

        {/* Constellation names: placed above the member nearest the group's centre, skipping any that would collide. */}
        {showLabels && (
          <g className="atlas-clabels">
            {(() => {
              const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
              const limit = view.k > 1.6 ? 40 : view.k > 0.8 ? 18 : 8;
              const out = [];
              for (const c of layout.constellations) {
                if (out.length >= limit) break;
                let anchor = layout.byId.get(c.ids[0])!;
                let best = Infinity;
                for (const id of c.ids) {
                  const nd = layout.byId.get(id)!;
                  const d = (nd.x - c.cx) ** 2 + (nd.y - c.cy) ** 2;
                  if (d < best) (best = d), (anchor = nd);
                }
                const [sx, sy0] = toScreen(...nodePos(anchor));
                const sy = sy0 - anchor.r * nodeScale - 12;
                if (sx < -100 || sx > W + 100 || sy < -40 || sy > H + 40) continue;
                const half = ((c.tag.length + 3) * 11) / 2;
                const box = { x0: sx - half, x1: sx + half, y0: sy - 12, y1: sy + 4 };
                if (placed.some((b) => b.x0 < box.x1 && box.x0 < b.x1 && b.y0 < box.y1 && box.y0 < b.y1)) continue;
                placed.push(box);
                const on = activeTags?.has(c.tag);
                out.push(
                  <text key={c.tag} x={sx} y={sy} textAnchor="middle" className={on ? 'is-on' : activeTags ? 'is-dim' : ''}>
                    {c.tag.toUpperCase()}
                    <tspan className="clabel-count" dx="6">
                      {c.ids.length}
                    </tspan>
                  </text>,
                );
              }
              return out;
            })()}
          </g>
        )}

        {/* Hidden annotations — cartographer's marginalia that appear at certain zooms. */}
        <g className="atlas-hidden">
          {firstEntry && view.k > 2.6 && (
            <text x={ox + 18} y={oy + 26}>
              MERIDIAN OF ORIGIN · PLATE {plateNo(firstEntry.plate)} · {dateMono(firstEntry.date)}
            </text>
          )}
          {ordered.length > 0 && view.k > 1.4 && (() => {
            const [nx, ny] = toScreen(layout.next.x, layout.next.y);
            return (
              <g>
                <circle cx={nx} cy={ny} r={7 * nodeScale} className="next-slot" />
                <text x={nx + 12} y={ny + 3}>
                  PLATE {plateNo(data.counters.plate + 1)} · UNPLOTTED
                </text>
              </g>
            );
          })()}
          {view.k < 0.42 && (() => {
            const [tx, ty] = toScreen(outerR * 1.05, -outerR * 0.75);
            return (
              <text x={tx} y={ty} className="hidden-large">
                TERRA INCOGNITA
              </text>
            );
          })()}
          {view.k < 0.14 && (
            <text x={ox} y={oy + outerR * view.k + 60} textAnchor="middle" className="hidden-large">
              THE CHART HAS NO EDGE
            </text>
          )}
          {(() => {
            // Far out in the empty quadrant, for anyone who wanders there.
            const [dx, dy] = toScreen(-14000, 11000);
            return dx > -200 && dx < W + 200 && dy > -50 && dy < H + 50 ? (
              <text x={dx} y={dy} textAnchor="middle" className="hidden-large">
                HIC SUNT DRACONES
              </text>
            ) : null;
          })()}
        </g>

        {/* Bodies */}
        <g className="atlas-nodes">
          {layout.nodes.map((nd) => {
            if (!visibleNode(nd)) return null;
            const [px, py] = nodePos(nd);
            const [sx, sy] = toScreen(px, py);
            if (sx < -40 || sx > W + 40 || sy < -40 || sy > H + 40) return null;
            const r = nd.r * nodeScale;
            const related = activeTags ? nd.entry.tags.some((t) => activeTags.has(t)) : false;
            const cls = hover?.entry.id === nd.entry.id ? 'is-hover' : related ? 'is-related' : activeTags ? 'is-dim' : '';
            return (
              <g
                key={nd.entry.id}
                className={`atlas-node ${cls} ${focusId === nd.entry.id ? 'is-focus' : ''}`}
                transform={`translate(${sx.toFixed(1)} ${sy.toFixed(1)})`}
                onPointerEnter={() => setHover(nd)}
                onPointerLeave={() => setHover((h) => (h === nd ? null : h))}
                data-id={nd.entry.id}
                role="link"
                aria-label={`Plate ${plateNo(nd.entry.plate)} ${nd.entry.title}`}
              >
                <circle r={r + 6} className="node-hit" />
                {(view.k > 1.8 || cls === 'is-hover') && <circle r={r + 4} className="node-halo" />}
                <circle r={r} className="node-occlude" />
                <RegisterMark id={nd.entry.register} r={r} />
                {view.k > 1.15 && (
                  <text x={r + 4} y={3} className="node-label">
                    {plateNo(nd.entry.plate)}
                  </text>
                )}
                {view.k > 4 && (
                  <text x={r + 4} y={13} className="node-coords">
                    {coord(nd.x)} {coord(-nd.y)}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {ordered.length === 0 && (
        <div className="atlas-empty">
          <p className="eyebrow">Chart</p>
          <p className="display">No bodies charted</p>
          <p className="muted small">Each plate you catalogue is plotted here.</p>
        </div>
      )}

      {/* Placard tooltip */}
      {hover && hoverScreen && (
        <div
          className="placard-tip atlas-ui"
          style={{
            left: Math.min(W - 300, hoverScreen[0] + 18),
            top: Math.max(10, Math.min(H - 220, hoverScreen[1] - 20)),
          }}
          aria-hidden
        >
          <div className="pt-head">
            <span>PLATE {plateNo(hover.entry.plate)}</span>
            <span>
              <RegisterIcon id={hover.entry.register} size={11} /> {REGISTER_BY_ID[hover.entry.register].label}
            </span>
          </div>
          <div className="pt-title">{hover.entry.title || <span className="muted">Untitled</span>}</div>
          <div className="pt-meta">
            {dateMono(hover.entry.date)} · {hover.words} words
          </div>
          {hover.entry.body && <div className="pt-incipit">{incipit(hover.entry.body, 150)}</div>}
          {hover.entry.tags.length > 0 && <div className="pt-tags">{hover.entry.tags.join(' · ')}</div>}
        </div>
      )}

      {/* Legend & constellation index */}
      <div className={`atlas-legend atlas-ui ${legendOpen ? '' : 'is-closed'}`}>
        <button className="legend-toggle" onClick={() => setLegendOpen(!legendOpen)} aria-expanded={legendOpen}>
          <span className="eyebrow">Chart key</span>
          <span>{legendOpen ? '−' : '+'}</span>
        </button>
        {legendOpen && (
          <>
            <div className="legend-regs">
              {REGISTERS.map((r) => (
                <button
                  key={r.id}
                  className={`reg-filter ${regFilter.size === 0 || regFilter.has(r.id) ? 'is-on' : 'is-off'}`}
                  onClick={() => {
                    const next = new Set(regFilter);
                    if (next.has(r.id)) next.delete(r.id);
                    else next.add(r.id);
                    setRegFilter(next.size === REGISTERS.length ? new Set() : next);
                  }}
                >
                  <RegisterIcon id={r.id} size={12} />
                  <span>{r.label}</span>
                </button>
              ))}
            </div>
            {layout.constellations.length > 0 && (
              <>
                <span className="eyebrow legend-sub">Constellations</span>
                <ul className="legend-cons">
                  {layout.constellations.slice(0, 24).map((c) => (
                    <li key={c.tag}>
                      <button
                        className={pinTag === c.tag ? 'is-on' : ''}
                        onClick={() => {
                          const next = pinTag === c.tag ? null : c.tag;
                          setPinTag(next);
                          if (next) flyTo({ cx: c.cx, cy: c.cy, k: Math.max(view.k, 1.2) });
                        }}
                      >
                        <span>{c.tag}</span>
                        <span className="mono">{c.ids.length}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="legend-note">Lines join plates sharing a tag. Distance from the centre follows the order of plates.</p>
          </>
        )}
      </div>

      {/* Instrument readouts */}
      <div className="atlas-readout atlas-ui" aria-live="off">
        <div className="scalebar">
          <svg width={scalePx + 2} height="10" aria-hidden>
            <path d={`M1 1V9M${scalePx + 1} 1V9M1 5H${scalePx + 1}M${scalePx / 2 + 1} 3V7`} />
          </svg>
          <span>{scaleUnits >= 1 ? scaleUnits : scaleUnits.toFixed(1)} u</span>
        </div>
        <div className="mono">×{view.k.toFixed(2)}</div>
        <div className="mono">{cursor ? `${coord(cursor.x)} ${coord(-cursor.y)}` : `${coord(view.cx)} ${coord(-view.cy)}`}</div>
        <div className="atlas-buttons">
          <button onClick={() => zoomAt(W / 2, H / 2, 1.3)} aria-label="Zoom in">+</button>
          <button onClick={() => zoomAt(W / 2, H / 2, 1 / 1.3)} aria-label="Zoom out">−</button>
          <button onClick={() => flyTo(fitView())} aria-label="Fit chart" title="Fit (0)">⊙</button>
          <button onClick={() => setShowMinimap(!showMinimap)} aria-label="Toggle minimap" title="Minimap (M)" className={showMinimap ? 'is-on' : ''}>▣</button>
        </div>
      </div>

      {/* Compass */}
      <svg className="atlas-compass atlas-ui" width="64" height="64" viewBox="-32 -32 64 64" aria-hidden>
        <circle r="22" />
        <circle r="15" className="faint" />
        <path d="M0 -28L3 0L0 4L-3 0Z" className="needle" />
        <path d="M0 28L3 0L-3 0Z" className="faint-fill" />
        <text y="-24" textAnchor="middle" dy="-2">N</text>
      </svg>

      {showMinimap && ordered.length > 0 && <Minimap layout={layout} view={view} W={W} H={H} onJump={(cx, cy) => setView((v) => ({ ...v, cx, cy }))} />}
    </div>
  );
}

/** Overview of the whole chart with the current viewport; click or drag to move. */
function Minimap({
  layout,
  view,
  W,
  H,
  onJump,
}: {
  layout: ReturnType<typeof computeLayout>;
  view: View;
  W: number;
  H: number;
  onJump: (cx: number, cy: number) => void;
}) {
  const MW = 180;
  const b = layout.bounds;
  const bw = b.maxX - b.minX;
  const bh = b.maxY - b.minY;
  const s = MW / Math.max(bw, bh);
  const MH = Math.max(80, bh * s);
  const mx = (x: number) => (x - b.minX) * s + (MW - bw * s) / 2;
  const my = (y: number) => (y - b.minY) * s + (MH - bh * s) / 2;
  const toWorld = (px: number, py: number) => [(px - (MW - bw * s) / 2) / s + b.minX, (py - (MH - bh * s) / 2) / s + b.minY] as const;
  const dragging = useRef(false);

  const vw = (W / view.k) * s;
  const vh = (H / view.k) * s;
  const jump = (e: ReactPointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onJump(...toWorld(e.clientX - r.left, e.clientY - r.top));
  };

  return (
    <div className="atlas-minimap atlas-ui">
      <svg
        width={MW}
        height={MH}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          jump(e);
        }}
        onPointerMove={(e) => dragging.current && jump(e)}
        onPointerUp={() => (dragging.current = false)}
        aria-label="Minimap"
      >
        <rect x="0.5" y="0.5" width={MW - 1} height={MH - 1} className="mm-frame" />
        {layout.rings.map((r) => (
          <circle key={r.month} cx={mx(0)} cy={my(0)} r={r.radius * s} className="mm-ring" />
        ))}
        {layout.nodes.map((nd) => (
          <circle key={nd.entry.id} cx={mx(nd.x)} cy={my(nd.y)} r={1.2} className="mm-node" />
        ))}
        <rect
          x={mx(view.cx) - vw / 2}
          y={my(view.cy) - vh / 2}
          width={Math.max(4, vw)}
          height={Math.max(4, vh)}
          className="mm-view"
        />
      </svg>
      <span className="mm-label">Overview</span>
    </div>
  );
}
