/**
 * Core data model for Mind Atlas.
 * Everything here is serialised as-is into localStorage and JSON exports,
 * so changing a shape means bumping `AtlasData.version` and migrating in store.ts.
 */

/** The intellectual mode an entry is written in. */
export type RegisterId = 'observation' | 'question' | 'memory' | 'argument' | 'fragment';

/** A margin note added while reading back. `paragraph` anchors it to a paragraph index (or null = whole plate). */
export interface Annotation {
  id: string;
  text: string;
  createdAt: string; // ISO timestamp
  paragraph: number | null;
}

/** One catalogued entry ("plate"). */
export interface Entry {
  id: string;
  plate: number; // catalogue number; assigned once and never reused
  date: string; // YYYY-MM-DD (the day the entry belongs to)
  title: string; // optional, may be ''
  body: string;
  tags: string[]; // normalised, lower-case
  register: RegisterId;
  createdAt: string;
  updatedAt: string;
  annotations: Annotation[];
}

/** An unresolved question being carried. Questions may remain open indefinitely. */
export interface Question {
  id: string;
  number: number; // Q.01, Q.02 ...
  text: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  entryIds: string[]; // plates that bear on this question
  settled: boolean; // optional, user-controlled; never prompted
}

/** A line written on the "Further Study" page. */
export interface StudyNote {
  id: string;
  text: string;
  createdAt: string;
}

export type ThemeId = 'ink' | 'paper';

export interface Settings {
  theme: ThemeId;
  lastReadId: string | null; // where Reading Back last stopped
}

/** The whole persisted archive. */
export interface AtlasData {
  version: 1;
  entries: Entry[];
  questions: Question[];
  studies: StudyNote[];
  settings: Settings;
  counters: { plate: number; question: number }; // last issued numbers
}
