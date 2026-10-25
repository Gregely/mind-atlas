import type { RegisterId } from '../types';

/**
 * The five registers (intellectual modes) an entry can be written in.
 * The `gloss` is an interface label shown in pickers and legends.
 * Add or rename here; the RegisterMark component draws one symbol per id.
 */
export interface RegisterDef {
  id: RegisterId;
  label: string;
  abbr: string;
  gloss: string;
}

export const REGISTERS: RegisterDef[] = [
  { id: 'observation', label: 'Observation', abbr: 'OBS', gloss: 'a thing noticed' },
  { id: 'question', label: 'Question', abbr: 'QUE', gloss: 'a thing asked' },
  { id: 'memory', label: 'Memory', abbr: 'MEM', gloss: 'a thing remembered' },
  { id: 'argument', label: 'Argument', abbr: 'ARG', gloss: 'a thing reasoned' },
  { id: 'fragment', label: 'Fragment', abbr: 'FRG', gloss: 'a thing unfinished' },
];

export const REGISTER_BY_ID: Record<RegisterId, RegisterDef> = Object.fromEntries(
  REGISTERS.map((r) => [r.id, r]),
) as Record<RegisterId, RegisterDef>;

export const isRegister = (v: unknown): v is RegisterId =>
  typeof v === 'string' && v in REGISTER_BY_ID;
