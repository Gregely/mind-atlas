/**
 * The archive store: one React context holding all data, persisted to localStorage.
 *
 * Components read `data` via useAtlas() and change it by calling `dispatch` with
 * one of the actions below. The reducer is the only place data is mutated.
 */
import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import type { Annotation, AtlasData, Entry, Question, RegisterId, StudyNote, ThemeId } from '../types';
import { isRegister } from './registers';
import { normalizeTag } from './text';

export const STORAGE_KEY = 'mind-atlas:v1';

export function emptyData(): AtlasData {
  return {
    version: 1,
    entries: [],
    questions: [],
    studies: [],
    settings: { theme: 'ink', lastReadId: null },
    counters: { plate: 0, question: 0 },
  };
}

/* ------------------------------------------------------------------------- */
/* Validation: used on load and on import, so a damaged file can't crash us. */
/* ------------------------------------------------------------------------- */

const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);
const num = (v: unknown, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});

/** Coerce unknown JSON into a valid AtlasData, filling defaults. Throws if it is clearly not an archive. */
export function normalizeData(raw: unknown): AtlasData {
  const r = obj(raw);
  if (!Array.isArray(r.entries)) throw new Error('This file does not look like a Mind Atlas archive (no "entries" list).');
  const now = new Date().toISOString();

  const entries: Entry[] = arr(r.entries).map((e0, i) => {
    const e = obj(e0);
    return {
      id: str(e.id) || `imported-${i}-${Math.random().toString(36).slice(2, 7)}`,
      plate: num(e.plate, i + 1),
      date: /^\d{4}-\d{2}-\d{2}/.test(str(e.date)) ? str(e.date).slice(0, 10) : now.slice(0, 10),
      title: str(e.title),
      body: str(e.body),
      tags: [...new Set(arr(e.tags).map((t) => normalizeTag(str(t))).filter(Boolean))],
      register: isRegister(e.register) ? (e.register as RegisterId) : 'fragment',
      createdAt: str(e.createdAt, now),
      updatedAt: str(e.updatedAt, now),
      annotations: arr(e.annotations).map((a0, j) => {
        const a = obj(a0);
        return {
          id: str(a.id) || `a-${i}-${j}`,
          text: str(a.text),
          createdAt: str(a.createdAt, now),
          paragraph: typeof a.paragraph === 'number' ? a.paragraph : null,
        };
      }),
    };
  });

  const ids = new Set(entries.map((e) => e.id));
  const questions: Question[] = arr(r.questions).map((q0, i) => {
    const q = obj(q0);
    return {
      id: str(q.id) || `q-${i}-${Math.random().toString(36).slice(2, 7)}`,
      number: num(q.number, i + 1),
      text: str(q.text),
      notes: str(q.notes),
      createdAt: str(q.createdAt, now),
      updatedAt: str(q.updatedAt, now),
      entryIds: arr(q.entryIds).map((x) => str(x)).filter((x) => ids.has(x)),
      settled: q.settled === true,
    };
  });

  const studies: StudyNote[] = arr(r.studies).map((s0, i) => {
    const s = obj(s0);
    return { id: str(s.id) || `s-${i}`, text: str(s.text), createdAt: str(s.createdAt, now) };
  });

  const settings = obj(r.settings);
  const counters = obj(r.counters);
  const maxPlate = entries.reduce((m, e) => Math.max(m, e.plate), 0);
  const maxQ = questions.reduce((m, q) => Math.max(m, q.number), 0);

  return {
    version: 1,
    entries,
    questions,
    studies,
    settings: {
      theme: settings.theme === 'paper' ? 'paper' : 'ink',
      lastReadId: typeof settings.lastReadId === 'string' && ids.has(settings.lastReadId) ? settings.lastReadId : null,
    },
    counters: {
      plate: Math.max(num(counters.plate), maxPlate),
      question: Math.max(num(counters.question), maxQ),
    },
  };
}

function load(): AtlasData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    return normalizeData(JSON.parse(raw));
  } catch (err) {
    console.error('Mind Atlas: could not read saved data', err);
    return emptyData();
  }
}

/* ------------------------------------------------------------------------- */
/* Actions & reducer                                                          */
/* ------------------------------------------------------------------------- */

export type EntryDraft = Pick<Entry, 'date' | 'title' | 'body' | 'tags' | 'register'>;

export type Action =
  | { type: 'createEntry'; id: string; draft: EntryDraft }
  | { type: 'updateEntry'; id: string; draft: EntryDraft }
  | { type: 'deleteEntry'; id: string }
  | { type: 'addAnnotation'; entryId: string; annotation: Annotation }
  | { type: 'deleteAnnotation'; entryId: string; annotationId: string }
  | { type: 'createQuestion'; id: string; text: string }
  | { type: 'updateQuestion'; id: string; patch: Partial<Pick<Question, 'text' | 'notes' | 'settled'>> }
  | { type: 'deleteQuestion'; id: string }
  | { type: 'toggleQuestionLink'; questionId: string; entryId: string }
  | { type: 'addStudy'; note: StudyNote }
  | { type: 'deleteStudy'; id: string }
  | { type: 'setTheme'; theme: ThemeId }
  | { type: 'setLastRead'; id: string | null }
  | { type: 'replaceAll'; data: AtlasData };

function clean(d: EntryDraft): EntryDraft {
  return {
    date: d.date,
    title: d.title.trim(),
    body: d.body.replace(/\s+$/, ''),
    tags: [...new Set(d.tags.map(normalizeTag).filter(Boolean))],
    register: d.register,
  };
}

function reducer(state: AtlasData, a: Action): AtlasData {
  const now = new Date().toISOString();
  switch (a.type) {
    case 'createEntry': {
      const plate = state.counters.plate + 1;
      const entry: Entry = { id: a.id, plate, ...clean(a.draft), createdAt: now, updatedAt: now, annotations: [] };
      return { ...state, entries: [...state.entries, entry], counters: { ...state.counters, plate } };
    }
    case 'updateEntry':
      return {
        ...state,
        entries: state.entries.map((e) => (e.id === a.id ? { ...e, ...clean(a.draft), updatedAt: now } : e)),
      };
    case 'deleteEntry':
      // The plate number is not reused: catalogue numbers stay stable.
      return {
        ...state,
        entries: state.entries.filter((e) => e.id !== a.id),
        questions: state.questions.map((q) => ({ ...q, entryIds: q.entryIds.filter((x) => x !== a.id) })),
        settings: state.settings.lastReadId === a.id ? { ...state.settings, lastReadId: null } : state.settings,
      };
    case 'addAnnotation':
      return {
        ...state,
        entries: state.entries.map((e) =>
          e.id === a.entryId ? { ...e, annotations: [...e.annotations, a.annotation] } : e,
        ),
      };
    case 'deleteAnnotation':
      return {
        ...state,
        entries: state.entries.map((e) =>
          e.id === a.entryId ? { ...e, annotations: e.annotations.filter((n) => n.id !== a.annotationId) } : e,
        ),
      };
    case 'createQuestion': {
      const number = state.counters.question + 1;
      const q: Question = { id: a.id, number, text: a.text.trim(), notes: '', createdAt: now, updatedAt: now, entryIds: [], settled: false };
      return { ...state, questions: [...state.questions, q], counters: { ...state.counters, question: number } };
    }
    case 'updateQuestion':
      return {
        ...state,
        questions: state.questions.map((q) => (q.id === a.id ? { ...q, ...a.patch, updatedAt: now } : q)),
      };
    case 'deleteQuestion':
      return { ...state, questions: state.questions.filter((q) => q.id !== a.id) };
    case 'toggleQuestionLink':
      return {
        ...state,
        questions: state.questions.map((q) => {
          if (q.id !== a.questionId) return q;
          const has = q.entryIds.includes(a.entryId);
          return { ...q, updatedAt: now, entryIds: has ? q.entryIds.filter((x) => x !== a.entryId) : [...q.entryIds, a.entryId] };
        }),
      };
    case 'addStudy':
      return { ...state, studies: [...state.studies, a.note] };
    case 'deleteStudy':
      return { ...state, studies: state.studies.filter((s) => s.id !== a.id) };
    case 'setTheme':
      return { ...state, settings: { ...state.settings, theme: a.theme } };
    case 'setLastRead':
      return { ...state, settings: { ...state.settings, lastReadId: a.id } };
    case 'replaceAll':
      return a.data;
  }
}

/* ------------------------------------------------------------------------- */
/* Context                                                                    */
/* ------------------------------------------------------------------------- */

interface AtlasContextValue {
  data: AtlasData;
  dispatch: (a: Action) => void;
  /** Entries in reading order: by date, then plate number. */
  ordered: Entry[];
  byId: Map<string, Entry>;
  /** Set when localStorage refused a write (e.g. quota). */
  saveError: string | null;
}

const AtlasContext = createContext<AtlasContextValue | null>(null);

export function AtlasProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(reducer, undefined, load);
  const [saveError, setSaveError] = useState<string | null>(null);
  const first = useRef(true);

  // Persist after every change (skipping the initial load).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setSaveError(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    }
  }, [data]);

  // Reflect the theme on <html data-theme>.
  useEffect(() => {
    document.documentElement.dataset.theme = data.settings.theme;
  }, [data.settings.theme]);

  const value = useMemo<AtlasContextValue>(() => {
    const ordered = sortEntries(data.entries);
    return { data, dispatch, ordered, byId: new Map(ordered.map((e) => [e.id, e])), saveError };
  }, [data, saveError]);

  return <AtlasContext.Provider value={value}>{children}</AtlasContext.Provider>;
}

export function useAtlas(): AtlasContextValue {
  const v = useContext(AtlasContext);
  if (!v) throw new Error('useAtlas must be used inside <AtlasProvider>');
  return v;
}

/** Chronological order: date, then plate number. */
export function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.plate - b.plate));
}
