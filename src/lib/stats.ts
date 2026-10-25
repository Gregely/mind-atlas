/**
 * Descriptive statistics for the Cabinet of Themes.
 * These only count what exists; nothing here interprets the content.
 */
import type { Entry, RegisterId } from '../types';
import { monthKey, monthRange } from './format';
import { contentWords, wordCount } from './text';

export interface TagStat {
  tag: string;
  count: number;
  order: number; // 1-based order of first appearance ("atomic number")
  firstDate: string;
  lastDate: string;
  firstMonth: string;
  plates: Entry[]; // chronological
  byMonth: Map<string, number>;
}

export interface WordStat {
  word: string;
  count: number;
  firstPlate: number;
}

export interface CabinetStats {
  months: string[]; // every month from first to latest entry
  tags: TagStat[]; // by order of first appearance
  words: WordStat[]; // by frequency
  registersByMonth: Map<string, Record<RegisterId, number>>;
  wordsByMonth: Map<string, number>;
  totalWords: number;
}

/** `ordered` must be chronological. */
export function computeStats(ordered: Entry[]): CabinetStats {
  const months = ordered.length ? monthRange(monthKey(ordered[0].date), monthKey(ordered[ordered.length - 1].date)) : [];

  const tagMap = new Map<string, TagStat>();
  const wordMap = new Map<string, WordStat>();
  const registersByMonth = new Map<string, Record<RegisterId, number>>();
  const wordsByMonth = new Map<string, number>();
  let totalWords = 0;

  for (const m of months) {
    registersByMonth.set(m, { observation: 0, question: 0, memory: 0, argument: 0, fragment: 0 });
    wordsByMonth.set(m, 0);
  }

  for (const e of ordered) {
    const mk = monthKey(e.date);
    registersByMonth.get(mk)![e.register]++;
    const wc = wordCount(e.body);
    totalWords += wc;
    wordsByMonth.set(mk, (wordsByMonth.get(mk) || 0) + wc);

    for (const t of e.tags) {
      let s = tagMap.get(t);
      if (!s) {
        s = { tag: t, count: 0, order: tagMap.size + 1, firstDate: e.date, lastDate: e.date, firstMonth: mk, plates: [], byMonth: new Map() };
        tagMap.set(t, s);
      }
      s.count++;
      s.lastDate = e.date;
      s.plates.push(e);
      s.byMonth.set(mk, (s.byMonth.get(mk) || 0) + 1);
    }

    for (const w of contentWords(e.title + ' ' + e.body)) {
      const s = wordMap.get(w);
      if (s) s.count++;
      else wordMap.set(w, { word: w, count: 1, firstPlate: e.plate });
    }
  }

  return {
    months,
    tags: [...tagMap.values()],
    words: [...wordMap.values()].sort((a, b) => b.count - a.count || a.word.localeCompare(b.word)),
    registersByMonth,
    wordsByMonth,
    totalWords,
  };
}

/**
 * Periodic-table style symbols: capital initial + a following consonant, unique across tags.
 * Assigned in order of first appearance so symbols are stable as the archive grows.
 */
export function elementSymbols(tags: string[]): Map<string, string> {
  const used = new Set<string>();
  const out = new Map<string, string>();
  for (const tag of tags) {
    const letters = tag.replace(/[^\p{L}\p{N}]/gu, '');
    const first = (letters[0] || 'X').toUpperCase();
    let sym = '';
    const rest = letters.slice(1).toLowerCase();
    const consonants = rest.replace(/[aeiou]/g, '');
    for (const c of consonants + rest) {
      if (!used.has(first + c)) {
        sym = first + c;
        break;
      }
    }
    if (!sym && !used.has(first)) sym = first;
    for (let n = 2; !sym; n++) if (!used.has(first + n)) sym = first + n;
    used.add(sym);
    out.set(tag, sym);
  }
  return out;
}
