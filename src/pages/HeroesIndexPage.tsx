import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { heroes } from '../lib/gameData';
import { heroIconUrl } from '../lib/assets';
import { ItemShopDock } from '../components/ItemShopDock';

export function HeroesIndexPage() {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return heroes;
    return heroes.filter((h) => h.name.toLowerCase().includes(q));
  }, [query]);

  return (
    <ItemShopDock>
      <div className="heroes-index">
        <div className="heroes-index-head">
          <h1>Heroes</h1>
          <input
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
