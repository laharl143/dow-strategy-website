import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { heroes } from '../lib/gameData';
import { heroIconUrl } from '../lib/assets';
import { heroMatchesQuery } from '../lib/heroSearch';
import { ItemShopDock } from '../components/ItemShopDock';

export function HeroesIndexPage() {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return heroes;
    return heroes.filter((h) => heroMatchesQuery(h, q));
  }, [query]);

  // Typing anywhere on the page starts a search, same as HeroPageSearch —
  // no need to click the field first. Ignored while some other input,
  // textarea, or contenteditable already has focus (so it doesn't hijack
  // normal typing there), and while a modifier key is held (so browser/OS
  // shortcuts like Cmd+R still work).
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
      const active = document.activeElement;
      const alreadyTyping =
        active instanceof HTMLElement &&
        (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
      if (alreadyTyping) return;
      // Without this, focusing the input mid-keydown lets the browser's own
      // default action (which fires after this handler, against the now-
      // focused input) insert the character a second time on top of the
      // manual append below.
      e.preventDefault();
      inputRef.current?.focus();
      setQuery((prev) => prev + e.key);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // A search narrowed to exactly one match jumps there automatically — no
  // need to also click it. Mirrors HeroPageSearch/HeroPickerPopover's same
  // behavior (DOW-4).
  useEffect(() => {
    if (query.trim() && filtered.length === 1) navigate(`/heroes/${filtered[0].slug}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filtered]);

  return (
    <ItemShopDock>
      <div className="heroes-index">
        <div className="heroes-index-head">
          <h1>Heroes</h1>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search heroes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="heroes-index-grid">
          {filtered.map((hero) => (
            <Link key={hero.slug} to={`/heroes/${hero.slug}`} className="heroes-index-card">
              <img src={heroIconUrl(hero.code)} alt="" />
              <span>{hero.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </ItemShopDock>
  );
}
