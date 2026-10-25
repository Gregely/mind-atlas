/**
 * Tag entry: type and press Enter, comma or Tab. Backspace on an empty field removes
 * the last tag. Matching tags you have used before are listed for quick selection.
 */
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { normalizeTag } from '../lib/text';

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
  known: string[]; // previously used tags, most used first
  id?: string;
}

export function TagInput({ value, onChange, known, id }: Props) {
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const q = normalizeTag(text);
    if (!q) return [];
    return known.filter((t) => t.includes(q) && !value.includes(t)).slice(0, 7);
  }, [text, known, value]);

  const add = (raw: string) => {
    const t = normalizeTag(raw);
    if (t && !value.includes(t)) onChange([...value, t]);
    setText('');
    setActive(0);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || (e.key === 'Tab' && text.trim())) {
      e.preventDefault();
      add(matches[active] && e.key !== ',' ? matches[active] : text);
    } else if (e.key === 'Backspace' && !text && value.length) {
      onChange(value.slice(0, -1));
    } else if (e.key === 'ArrowDown' && matches.length) {
      e.preventDefault();
      setActive((a) => (a + 1) % matches.length);
    } else if (e.key === 'ArrowUp' && matches.length) {
      e.preventDefault();
      setActive((a) => (a - 1 + matches.length) % matches.length);
    } else if (e.key === 'Escape' && text) {
      e.stopPropagation();
      setText('');
    }
  };

  return (
    <div className={`tag-input ${focused ? 'is-focused' : ''}`} onClick={() => inputRef.current?.focus()}>
      {value.map((t) => (
        <span className="chip" key={t}>
          {t}
          <button type="button" className="chip-x" aria-label={`Remove tag ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}>
            ×
          </button>
        </span>
      ))}
      <input
        id={id}
        ref={inputRef}
        value={text}
        onChange={(e) => {
          const v = e.target.value;
          if (v.endsWith(',')) add(v.slice(0, -1));
          else {
            setText(v);
            setActive(0);
          }
        }}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          if (text.trim()) add(text);
        }}
        aria-label="Add tag"
        autoComplete="off"
        spellCheck={false}
      />
      {focused && matches.length > 0 && (
        <ul className="tag-suggest" role="listbox">
          {matches.map((m, i) => (
            <li
              key={m}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'is-active' : ''}
              onMouseDown={(e) => {
                e.preventDefault();
                add(m);
              }}
            >
              {m}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
