import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import type { Board as BoardType, SavedStrategy } from './types';
import { NavBar } from './components/NavBar';
import { PlannerPage } from './pages/PlannerPage';
import { HeroesIndexPage } from './pages/HeroesIndexPage';
import { HeroPage } from './pages/HeroPage';
import {
  loadActiveBoard,
  saveActiveBoard,
  newGame as resetBoard,
  listSavedStrategies,
  saveStrategy,
  updateStrategy,
  renameStrategy,
  deleteStrategy,
} from './lib/persistence';

function App() {
  const [board, setBoard] = useState<BoardType>(() => loadActiveBoard());
  const [strategies, setStrategies] = useState<SavedStrategy[]>(() => listSavedStrategies());
  const [activeStrategyId, setActiveStrategyId] = useState<string | null>(null);

  useEffect(() => {
    saveActiveBoard(board);
  }, [board]);

  return (
    <div className="app-shell">
      <NavBar
        onNewGame={() => {
          setBoard(resetBoard());
          setActiveStrategyId(null);
        }}
        onSaveAs={(name) => {
          const strategy = saveStrategy(name, board);
          setStrategies(listSavedStrategies());
          setActiveStrategyId(strategy.id);
        }}
      />
      <main className="app-main">
        <Routes>
          <Route
            path="/"
            element={
              <PlannerPage
                board={board}
                setBoard={setBoard}
                strategies={strategies}
                activeStrategyId={activeStrategyId}
                onSaveActive={() => {
                  if (!activeStrategyId) return;
                  updateStrategy(activeStrategyId, board);
                  setStrategies(listSavedStrategies());
                }}
                onLoad={(id) => {
                  const strategy = strategies.find((s) => s.id === id);
                  if (!strategy) return;
                  setBoard(strategy.board);
                  setActiveStrategyId(id);
                }}
                onRename={(id, name) => {
                  renameStrategy(id, name);
                  setStrategies(listSavedStrategies());
                }}
                onDelete={(id) => {
                  deleteStrategy(id);
                  setStrategies(listSavedStrategies());
                  if (activeStrategyId === id) setActiveStrategyId(null);
                }}
              />
            }
          />
          <Route path="/heroes" element={<HeroesIndexPage />} />
          <Route path="/heroes/:slug" element={<HeroPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
