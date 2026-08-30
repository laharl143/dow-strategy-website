import { useMemo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { CompositionRole, Hero, PickFrequency } from '../types';
import { heroIconUrl } from '../lib/assets';
import { useHeroContextMenu } from './HeroContextMenu';

const ROLE_FILTERS: { value: CompositionRole | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'tank', label: 'Tank' },
  { value: 'core', label: 'Core' },
  { value: 'support', label: 'Support' },
];

const PICK_FREQUENCY_FILTERS: { value: PickFrequency | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'always', label: 'Always' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'never', label: 'Never' },
];

function HeroChip({
  hero,
  assigned,
  onContextMenu,
}: {
  hero: Hero;
  assigned: boolean;
  onContextMenu: (e: React.MouseEvent, heroSlug: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `hero-tray:${hero.slug}`,
    data: { kind: 'hero', heroSlug: hero.slug },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="hero-chip"
      data-dragging={isDragging || undefined}
      data-assigned={assigned || undefined}
      title={`${hero.name} (${hero.code})${hero.needsReview ? ' — needs review' : ''}`}
      onContextMenu={(e) => onContextMenu(e, hero.slug)}
    >
      <img className="hero-chip-icon" src={heroIconUrl(hero.code)} alt={hero.name} draggable={false} />
      {hero.needsReview && <span className="hero-chip-flag">?</span>}
    </div>
  );
}

export function HeroTray({ heroes, assignedSlugs }: { heroes: Hero[]; assignedSlugs: Set<string> }) {
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<CompositionRole | 'all'>('all');
  const [pickFrequencyFilter, setPickFrequencyFilter] = useState<PickFrequency | 'all'>('all');
  const { openMenu, menuNode } = useHeroContextMenu();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return heroes.filter((h) => {
      if (roleFilter !== 'all' && !h.compositionRoles.includes(roleFilter)) return false;
      if (pickFrequencyFilter !== 'all' && h.pickFrequency !== pickFrequencyFilter) return false;
      if (q && !h.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [heroes, query, roleFilter, pickFrequencyFilter]);

  return (
    <div className="hero-tray">
      <div className="hero-tray-controls">
        <input
          type="text"
          placeholder="Search heroes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="role-filters">
          {ROLE_FILTERS.map((f) => (
            <button
              key={f.value}
              className="role-filter-btn"
              data-active={roleFilter === f.value || undefined}
              onClick={() => setRoleFilter(f.value)}
              type="button"
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="role-filters pick-frequency-filters">
          {PICK_FREQUENCY_FILTERS.map((f) => (
            <button
              key={f.value}
              className="role-filter-btn"
              data-active={pickFrequencyFilter === f.value || undefined}
              onClick={() => setPickFrequencyFilter(f.value)}
              type="button"
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="hero-chip-list">
        {filtered.map((hero) => (
          <HeroChip key={hero.slug} hero={hero} assigned={assignedSlugs.has(hero.slug)} onContextMenu={openMenu} />
        ))}
      </div>

      {menuNode}
    </div>
  );
}
