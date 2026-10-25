/** The keyboard reference card, opened with "?". */
export const SHORTCUTS: { group: string; keys: [string, string][] }[] = [
  {
    group: 'Anywhere',
    keys: [
      ['/  or  Ctrl K', 'Search the archive'],
      ['N', 'New plate'],
      ['1 – 6', 'Catalogue · Atlas · Cabinet · Questions · Reading · Archive'],
      ['T', 'Switch between Ink and Paper'],
      ['?', 'This card'],
      ['Esc', 'Close a panel'],
    ],
  },
  {
    group: 'Plate & reading',
    keys: [
      ['← →  or  J K', 'Previous / next plate'],
      ['E', 'Edit the plate'],
      ['A', 'Annotate (reading back)'],
      ['Ctrl ↵', 'Save while writing'],
    ],
  },
  {
    group: 'Atlas',
    keys: [
      ['Drag · Arrows · WASD', 'Pan'],
      ['Wheel · + −', 'Zoom'],
      ['0', 'Fit the whole chart'],
      ['L', 'Constellation labels'],
      ['M', 'Minimap'],
    ],
  },
];

export function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <div className="shortcuts-card">
        <header>
          <span className="eyebrow">Reference card</span>
          <h2>Keyboard</h2>
          <button className="btn-quiet close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="shortcuts-grid">
          {SHORTCUTS.map((g) => (
            <section key={g.group}>
              <h3>{g.group}</h3>
              <dl>
                {g.keys.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
