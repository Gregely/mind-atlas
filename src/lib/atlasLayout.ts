/**
 * Layout for the Atlas chart.
 *
 * The idea: entries are placed on a golden-angle spiral in chronological order, so the
 * chart grows outward from the first plate like growth rings. A small, deterministic
 * force simulation then pulls entries that share tags towards each other (forming
 * constellations) while a weak radial force keeps each entry near its "time radius".
 * No randomness is used, so the same archive always produces the same chart.
 */
import type { Entry } from '../types';
import { hashString } from './seed';
import { monthKey } from './format';
import { wordCount } from './text';

export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
export const SPACING = 44; // world units between successive spiral positions

/** Radius on the spiral for the i-th entry. */
export const spiralRadius = (i: number) => SPACING * Math.sqrt(i + 0.6);

export interface AtlasNode {
  entry: Entry;
  index: number; // chronological index
  x: number;
  y: number;
  r: number; // drawn radius in world units
  words: number;
}

export interface Constellation {
  tag: string;
  ids: string[]; // chronological
  edges: [string, string][]; // minimum spanning tree between members
  cx: number;
  cy: number;
}

export interface MonthRing {
  month: string;
  radius: number;
}

export interface AtlasLayout {
  nodes: AtlasNode[];
  byId: Map<string, AtlasNode>;
  constellations: Constellation[]; // largest first
  rings: MonthRing[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  next: { x: number; y: number }; // where the next plate will be placed on the spiral
}

/** `ordered` must be chronological. */
export function computeLayout(ordered: Entry[]): AtlasLayout {
  const n = ordered.length;
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);

  // 1. Initial positions: golden spiral, with a small deterministic jitter per entry.
  ordered.forEach((e, i) => {
    const jitter = ((hashString(e.id) % 1000) / 1000 - 0.5) * 0.5;
    const th = i * GOLDEN_ANGLE + jitter;
    const rad = spiralRadius(i);
    xs[i] = Math.cos(th) * rad;
    ys[i] = Math.sin(th) * rad;
  });

  // 2. Links between entries weighted by number of shared tags.
  const byTag = new Map<string, number[]>();
  ordered.forEach((e, i) => e.tags.forEach((t) => (byTag.get(t) || byTag.set(t, []).get(t)!).push(i)));
  const weights = new Map<number, number>(); // key = a * n + b (a < b)
  for (const members of byTag.values()) {
    if (members.length < 2) continue;
    if (members.length <= 40) {
      for (let a = 0; a < members.length; a++)
        for (let b = a + 1; b < members.length; b++) {
          const k = members[a] * n + members[b];
          weights.set(k, (weights.get(k) || 0) + 1 / Math.sqrt(members.length));
        }
    } else {
      // Very common tags: chain chronologically, otherwise everything collapses into one blob.
      for (let a = 1; a < members.length; a++) {
        const k = members[a - 1] * n + members[a];
        weights.set(k, (weights.get(k) || 0) + 0.3);
      }
    }
  }
  const links = [...weights.entries()].map(([k, w]) => ({ a: Math.floor(k / n), b: k % n, w: Math.min(w, 2) }));

  // 3. Relax. Repulsion uses a spatial grid so it stays fast for large archives.
  const ITER = n > 600 ? 160 : 260;
  const CELL = 80;
  const fx = new Float64Array(n);
  const fy = new Float64Array(n);
  for (let it = 0; it < ITER; it++) {
    const alpha = 1 - it / ITER;
    fx.fill(0);
    fy.fill(0);

    const grid = new Map<string, number[]>();
    for (let i = 0; i < n; i++) {
      const key = `${Math.floor(xs[i] / CELL)},${Math.floor(ys[i] / CELL)}`;
      (grid.get(key) || grid.set(key, []).get(key)!).push(i);
    }
    for (let i = 0; i < n; i++) {
      const gx = Math.floor(xs[i] / CELL);
      const gy = Math.floor(ys[i] / CELL);
      for (let ox = -1; ox <= 1; ox++)
        for (let oy = -1; oy <= 1; oy++) {
          const cell = grid.get(`${gx + ox},${gy + oy}`);
          if (!cell) continue;
          for (const j of cell) {
            if (j <= i) continue;
            let dx = xs[i] - xs[j];
            let dy = ys[i] - ys[j];
            let d2 = dx * dx + dy * dy;
            if (d2 > CELL * CELL) continue;
            if (d2 < 1) {
              dx = ((i * 7) % 5) - 2 || 1;
              dy = ((j * 3) % 5) - 2 || 1;
              d2 = dx * dx + dy * dy;
            }
            const f = 900 / d2;
            fx[i] += dx * f;
            fy[i] += dy * f;
            fx[j] -= dx * f;
            fy[j] -= dy * f;
          }
        }
    }

    for (const { a, b, w } of links) {
      const dx = xs[b] - xs[a];
      const dy = ys[b] - ys[a];
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = ((d - 46) / d) * 0.035 * w;
      fx[a] += dx * f;
      fy[a] += dy * f;
      fx[b] -= dx * f;
      fy[b] -= dy * f;
    }

    for (let i = 0; i < n; i++) {
      // Weak pull back towards the entry's time radius keeps chronology legible.
      const r = Math.sqrt(xs[i] * xs[i] + ys[i] * ys[i]) || 1;
      const target = spiralRadius(i);
      const f = ((target - r) / r) * 0.05;
      fx[i] += xs[i] * f;
      fy[i] += ys[i] * f;

      const step = 0.6 * alpha + 0.05;
      xs[i] += Math.max(-12, Math.min(12, fx[i] * step));
      ys[i] += Math.max(-12, Math.min(12, fy[i] * step));
    }
  }

  const nodes: AtlasNode[] = ordered.map((e, i) => {
    const words = wordCount(e.body);
    return { entry: e, index: i, x: xs[i], y: ys[i], r: 2.8 + Math.min(7, Math.sqrt(words) / 3.4), words };
  });
  const byId = new Map(nodes.map((nd) => [nd.entry.id, nd]));

  // 4. Constellations: one per tag used at least twice, joined by a minimum spanning tree.
  const constellations: Constellation[] = [];
  for (const [tag, members] of byTag) {
    if (members.length < 2) continue;
    const pts = members.map((i) => nodes[i]);
    constellations.push({
      tag,
      ids: pts.map((p) => p.entry.id),
      edges: spanningTree(pts),
      cx: pts.reduce((s, p) => s + p.x, 0) / pts.length,
      cy: pts.reduce((s, p) => s + p.y, 0) / pts.length,
    });
  }
  constellations.sort((a, b) => b.ids.length - a.ids.length || a.tag.localeCompare(b.tag));

  // 5. Month rings: the spiral radius at which each month begins.
  const rings: MonthRing[] = [];
  let prev = '';
  ordered.forEach((e, i) => {
    const m = monthKey(e.date);
    if (m !== prev) {
      rings.push({ month: m, radius: i === 0 ? spiralRadius(0) * 0.5 : spiralRadius(i - 0.5) });
      prev = m;
    }
  });

  let minX = -240, minY = -240, maxX = 240, maxY = 240;
  for (const nd of nodes) {
    minX = Math.min(minX, nd.x - 60);
    minY = Math.min(minY, nd.y - 60);
    maxX = Math.max(maxX, nd.x + 60);
    maxY = Math.max(maxY, nd.y + 60);
  }

  const nr = spiralRadius(n);
  const next = { x: Math.cos(n * GOLDEN_ANGLE) * nr, y: Math.sin(n * GOLDEN_ANGLE) * nr };

  return { nodes, byId, constellations, rings, bounds: { minX, minY, maxX, maxY }, next };
}

/** Prim's algorithm on Euclidean distance (or a chronological chain for very large groups). */
function spanningTree(pts: AtlasNode[]): [string, string][] {
  const k = pts.length;
  if (k > 160) return pts.slice(1).map((p, i) => [pts[i].entry.id, p.entry.id]);
  const inTree = new Array(k).fill(false);
  const best = new Array(k).fill(Infinity);
  const from = new Array(k).fill(-1);
  best[0] = 0;
  const edges: [string, string][] = [];
  for (let step = 0; step < k; step++) {
    let u = -1;
    for (let i = 0; i < k; i++) if (!inTree[i] && (u === -1 || best[i] < best[u])) u = i;
    inTree[u] = true;
    if (from[u] >= 0) edges.push([pts[from[u]].entry.id, pts[u].entry.id]);
    for (let v = 0; v < k; v++) {
      if (inTree[v]) continue;
      const d = Math.hypot(pts[u].x - pts[v].x, pts[u].y - pts[v].y);
      if (d < best[v]) {
        best[v] = d;
        from[v] = u;
      }
    }
  }
  return edges;
}
