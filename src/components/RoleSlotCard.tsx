import { useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { BoardSlot, Hero, Item, NeutralItem, RoleSlotDefinition } from '../types';
import { heroIconUrl, SCEPTER_ICON_URL, SHARD_ICON_URL } from '../lib/assets';
import { useDoubleClick } from '../lib/useDoubleClick';
import { AghUpgradeToggle } from './AghUpgradeToggle';
import { ItemSlotBox } from './ItemSlotBox';
import { HeroPickerPopover } from './HeroPickerPopover';

export function RoleSlotCard({
  definition,
  slot,
  hero,
  heroes,
  assignedHeroSlugs,
  regularItems,
  regularItemsCatalog,
  neutralItem,
  neutralItemsCatalog,
  onRemoveHero,
  onPickHero,
  onRemoveRegularItem,
  onPickRegularItem,
  onRemoveNeutralItem,
  onPickNeutralItem,
  onToggleScepter,
  onToggleShard,
  onHeroContextMenu,
}: {
  definition: RoleSlotDefinition;
  slot: BoardSlot;
  hero: Hero | undefined;
  heroes: Hero[];
  assignedHeroSlugs: Set<string>;
  regularItems: (Item | undefined)[];
  regularItemsCatalog: Item[];
  neutralItem: NeutralItem | undefined;
  neutralItemsCatalog: NeutralItem[];
  onRemoveHero: () => void;
  onPickHero: (heroSlug: string) => void;
  onRemoveRegularItem: (index: number) => void;
  onPickRegularItem: (index: number, itemSlug: string) => void;
  onRemoveNeutralItem: () => void;
  onPickNeutralItem: (itemSlug: string) => void;
  onToggleScepter: () => void;
  onToggleShard: () => void;
  onHeroContextMenu: (e: React.MouseEvent, heroSlug: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const { setNodeRef, isOver } = useDroppable({
    id: `slot:${slot.slotId}:hero`,
    data: { kind: 'hero-slot', slotId: slot.slotId },
  });
  const heroDraggable = useDraggable({
    id: `slot:${slot.slotId}:hero:occupant`,
    data: { kind: 'hero-slot', fromSlotId: slot.slotId, heroSlug: hero?.slug },
    disabled: !hero,
  });

  const activeCount = regularItems.slice(0, 6).filter(Boolean).length;
  const backpackCount = regularItems.slice(6, 9).filter(Boolean).length;
  const handleHeroClick = useDoubleClick(onRemoveHero);

  return (
    <div className="role-slot-card">
      <span className={`role-slot-tag role-slot-tag-${definition.role}`}>{definition.tag}</span>
      <div className="role-slot-header">
        <span className="role-slot-order">{definition.order}</span>
        <div>
          <div className="role-slot-label">{definition.label}</div>
          <div className="role-slot-description">{definition.description}</div>
        </div>
      </div>

      <div className="loadout-panel">
        <div ref={setNodeRef} className="hero-dropzone" data-over={isOver || undefined}>
          {hero ? (
            <div
              ref={heroDraggable.setNodeRef}
              {...heroDraggable.listeners}
              {...heroDraggable.attributes}
              className="role-slot-hero"
              data-dragging={heroDraggable.isDragging || undefined}
              onClick={handleHeroClick}
              onContextMenu={(e) => onHeroContextMenu(e, hero.slug)}
              title={`${hero.name} — drag to move, double-click to remove, right-click to inspect`}
            >
              <img className="role-slot-hero-icon" src={heroIconUrl(hero.code)} alt={hero.name} draggable={false} />
            </div>
          ) : (
            <>
              <button
                type="button"
                className="role-slot-hero-empty"
                onClick={(e) => {
                  e.stopPropagation();
                  setPickerOpen(true);
                }}
              >
                Drop hero here
              </button>
              {pickerOpen && (
                <HeroPickerPopover
                  heroes={heroes}
                  assignedHeroSlugs={assignedHeroSlugs}
                  onPick={(heroSlug) => {
                    onPickHero(heroSlug);
                    setPickerOpen(false);
                  }}
                  onClose={() => setPickerOpen(false)}
                />
              )}
            </>
          )}
        </div>

        {hero && (
          <>
            <div className="loadout-divider" />
            <div className="agh-toggle-stack">
              <AghUpgradeToggle
                iconUrl={SCEPTER_ICON_URL}
                label="Aghanim's Scepter"
                active={slot.hasScepter}
                onToggle={onToggleScepter}
              />
              <AghUpgradeToggle
                iconUrl={SHARD_ICON_URL}
                label="Aghanim's Shard"
                active={slot.hasShard}
                onToggle={onToggleShard}
              />
            </div>
            <div className="item-bay">
              <div className="inventory-grid">
                {regularItems.map((item, i) => (
                  <ItemSlotBox
                    key={i}
                    id={`slot:${slot.slotId}:regular:${i}`}
                    data={{ kind: 'regular-item-slot', slotId: slot.slotId, itemIndex: i }}
                    item={item}
                    items={regularItemsCatalog}
                    onRemove={() => onRemoveRegularItem(i)}
                    onPick={(itemSlug) => onPickRegularItem(i, itemSlug)}
                    empty={i < 6 ? 'Empty item slot' : 'Empty backpack slot'}
                    backpack={i >= 6}
                  />
                ))}
              </div>
              <ItemSlotBox
                id={`slot:${slot.slotId}:neutral`}
                data={{ kind: 'neutral-item-slot', slotId: slot.slotId }}
                item={neutralItem}
                items={neutralItemsCatalog}
                onRemove={onRemoveNeutralItem}
                onPick={onPickNeutralItem}
                empty="Empty neutral slot"
                circular
              />
            </div>
            <div className="loadout-status">
              <span className="fill-chip">
                <span className={activeCount > 0 ? 'good' : undefined}>{activeCount}</span>/6 active
              </span>
              <span className="fill-chip">{backpackCount}/3 pack</span>
              <span className="fill-chip">
                {neutralItem ? <span className="good">✓</span> : '—'} neutral
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
