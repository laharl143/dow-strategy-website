import type { SavedStrategy } from '../types';

export function StrategyList({
  strategies,
  activeStrategyId,
  onSaveActive,
  onLoad,
  onRename,
  onDelete,
}: {
  strategies: SavedStrategy[];
  activeStrategyId: string | null;
  onSaveActive: () => void;
  onLoad: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="strategy-list-panel">
      <h3>Saved Strategies</h3>

      {activeStrategyId && (
        <button type="button" className="save-active-btn" onClick={onSaveActive}>
          Save Changes
        </button>
      )}

      {strategies.length === 0 ? (
        <p className="empty-tray">No saved strategies yet — name one in the nav bar and click Save As.</p>
      ) : (
        <ul className="strategy-list">
          {strategies.map((s) => (
            <li key={s.id} data-active={s.id === activeStrategyId || undefined}>
              <button type="button" className="strategy-load-btn" onClick={() => onLoad(s.id)}>
                {s.name}
              </button>
              <button
                type="button"
                className="strategy-rename-btn"
                onClick={() => {
                  const name = window.prompt('Rename strategy', s.name);
                  if (name && name.trim()) onRename(s.id, name.trim());
                }}
              >
                ✎
              </button>
              <button
                type="button"
                className="strategy-delete-btn"
                onClick={() => {
                  if (window.confirm(`Delete "${s.name}"? This can't be undone.`)) onDelete(s.id);
                }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
