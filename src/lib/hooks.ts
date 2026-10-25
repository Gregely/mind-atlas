/** Small shared hooks. */
import { useEffect, useState } from 'react';

/** True when the user has asked the OS for reduced motion. */
export function useReducedMotion(): boolean {
  const q = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/** True if a keyboard event comes from somewhere the user is typing. */
export function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}

/** Register a keydown listener that ignores keys typed into fields (unless `always`). */
export function useKey(handler: (e: KeyboardEvent) => void, deps: unknown[], always = false): void {
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (!always && isTyping(e)) return;
      if (e.defaultPrevented) return;
      handler(e);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Set document.title for the current view. */
export function useTitle(t: string): void {
  useEffect(() => {
    document.title = t ? `${t} — Mind Atlas` : 'Mind Atlas';
  }, [t]);
}

/** Observe an element's width (for responsive SVG charts). */
export function useWidth<T extends HTMLElement>(initial = 800): [(el: T | null) => void, number] {
  const [width, setWidth] = useState(initial);
  const [el, setEl] = useState<T | null>(null);
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, width];
}
