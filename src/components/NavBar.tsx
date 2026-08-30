import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

export function NavBar({
  onNewGame,
  onSaveAs,
}: {
  onNewGame: () => void;
  onSaveAs: (name: string) => void;
}) {
  const location = useLocation();
  const [name, setName] = useState('');
  const onBoard = location.pathname === '/';

  return (
    <nav className="nav-bar">
      <span className="nav-bar-brand">DOW Strategy Planner</span>
      <div className="nav-bar-links">
        <NavLink to="/" end className="nav-bar-link">
          Main Board
        </NavLink>
        <NavLink to="/heroes" className="nav-bar-link">
          Heroes
        </NavLink>
      </div>

      {onBoard && (
        <div className="nav-bar-game-controls">
          <button type="button" className="nav-bar-new-game" onClick={onNewGame}>
            New Game
          </button>
          <input
            type="text"
            placeholder="Strategy name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            type="button"
            className="nav-bar-save-as"
            disabled={!name.trim()}
            onClick={() => {
              onSaveAs(name.trim());
              setName('');
            }}
          >
            Save As
          </button>
        </div>
      )}
    </nav>
  );
}
