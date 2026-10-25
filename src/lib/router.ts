/**
 * A minimal hash router. Routes look like "#/plate/<id>" and are parsed into segments.
 * Hash routing means the app works from any static host (or file) without server config.
 */
import { useEffect, useState } from 'react';

function parse(): string[] {
  const h = window.location.hash.replace(/^#\/?/, '');
  return h.split('?')[0].split('/').filter(Boolean).map(decodeURIComponent);
}

export function useRoute(): string[] {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

/** Navigate to a path such as "/atlas" or "/plate/abc". */
export function navigate(path: string): void {
  const target = '#' + (path.startsWith('/') ? path : '/' + path);
  if (window.location.hash !== target) window.location.hash = target;
}

/** Build an href for an <a>. */
export const href = (path: string) => '#' + (path.startsWith('/') ? path : '/' + path);
