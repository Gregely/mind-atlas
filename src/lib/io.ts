/** Export & import: JSON (full fidelity) and Markdown (for reading elsewhere). */
import type { AtlasData } from '../types';
import { normalizeData } from './store';
import { REGISTER_BY_ID } from './registers';
import { sortEntries } from './store';
import { dateLong, plateNo, questionNo, todayISO } from './format';
import { paragraphs } from './text';

/** Trigger a browser download of some text. */
export function download(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportJSON(data: AtlasData): void {
  download(`mind-atlas-${todayISO()}.json`, JSON.stringify(data, null, 2), 'application/json');
}

/** Render the whole archive as one Markdown document. */
export function toMarkdown(data: AtlasData): string {
  const out: string[] = [];
  const entries = sortEntries(data.entries);
  const byId = new Map(entries.map((e) => [e.id, e]));
  out.push('# Mind Atlas', '', `Exported ${dateLong(todayISO())} · ${entries.length} plates · ${data.questions.length} questions`, '');

  out.push('## Plates', '');
  for (const e of entries) {
    out.push(`### Plate ${plateNo(e.plate)}${e.title ? ` — ${e.title}` : ''}`, '');
    out.push(`- **Date:** ${dateLong(e.date)}`);
    out.push(`- **Register:** ${REGISTER_BY_ID[e.register].label}`);
    if (e.tags.length) out.push(`- **Tags:** ${e.tags.map((t) => `#${t.replace(/\s+/g, '-')}`).join(' ')}`);
    out.push('', e.body || '', '');
    if (e.annotations.length) {
      const paras = paragraphs(e.body);
      out.push('**Margin annotations**', '');
      for (const a of e.annotations) {
        const where = a.paragraph != null && paras[a.paragraph] ? ` (¶${a.paragraph + 1})` : '';
        out.push(`> ${a.text.replace(/\n/g, '\n> ')}${where} — ${a.createdAt.slice(0, 10)}`, '');
      }
    }
    out.push('---', '');
  }

  if (data.questions.length) {
    out.push('## Open Questions', '');
    for (const q of [...data.questions].sort((a, b) => a.number - b.number)) {
      out.push(`### Q.${questionNo(q.number)}${q.settled ? ' (settled)' : ''}`, '', q.text, '');
      out.push(`Logged ${q.createdAt.slice(0, 10)}`, '');
      if (q.notes) out.push(q.notes, '');
      const linked = q.entryIds.map((id) => byId.get(id)).filter(Boolean);
      if (linked.length) out.push(`Linked plates: ${linked.map((e) => `Plate ${plateNo(e!.plate)}`).join(', ')}`, '');
    }
  }

  if (data.studies.length) {
    out.push('## Further Study', '');
    for (const s of [...data.studies].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))) {
      out.push(`- ${s.createdAt.slice(0, 10)} — ${s.text.replace(/\n/g, ' ')}`);
    }
    out.push('');
  }
  return out.join('\n');
}

export function exportMarkdown(data: AtlasData): void {
  download(`mind-atlas-${todayISO()}.md`, toMarkdown(data), 'text/markdown');
}

/** Parse an imported JSON file into validated data (throws a readable Error). */
export function parseImport(text: string): AtlasData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('The file is not valid JSON.');
  }
  return normalizeData(raw);
}

/**
 * Merge an imported archive into the current one.
 * Records with an id already present are skipped; incoming plates whose number is
 * already taken receive the next free catalogue number.
 */
export function mergeData(current: AtlasData, incoming: AtlasData): { data: AtlasData; added: number } {
  const haveEntries = new Set(current.entries.map((e) => e.id));
  const takenPlates = new Set(current.entries.map((e) => e.plate));
  let plateCounter = Math.max(current.counters.plate, incoming.counters.plate);
  const newEntries = incoming.entries
    .filter((e) => !haveEntries.has(e.id))
    .map((e) => {
      if (takenPlates.has(e.plate)) e = { ...e, plate: ++plateCounter };
      takenPlates.add(e.plate);
      return e;
    });

  const haveQ = new Set(current.questions.map((q) => q.id));
  const takenQ = new Set(current.questions.map((q) => q.number));
  let qCounter = Math.max(current.counters.question, incoming.counters.question);
  const newQuestions = incoming.questions
    .filter((q) => !haveQ.has(q.id))
    .map((q) => {
      if (takenQ.has(q.number)) q = { ...q, number: ++qCounter };
      takenQ.add(q.number);
      return q;
    });

  const haveS = new Set(current.studies.map((s) => s.id));
  const newStudies = incoming.studies.filter((s) => !haveS.has(s.id));

  const maxPlate = Math.max(plateCounter, ...newEntries.map((e) => e.plate), 0);
  const maxQ = Math.max(qCounter, ...newQuestions.map((q) => q.number), 0);
  return {
    data: {
      ...current,
      entries: [...current.entries, ...newEntries],
      questions: [...current.questions, ...newQuestions],
      studies: [...current.studies, ...newStudies],
      counters: { plate: maxPlate, question: maxQ },
    },
    added: newEntries.length + newQuestions.length + newStudies.length,
  };
}
