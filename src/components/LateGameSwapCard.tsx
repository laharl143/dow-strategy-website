import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { BoardSlot, Hero, Item, NeutralItem } from '../types';
import { heroIconUrl, SCEPTER_ICON_URL, SHARD_ICON_URL } from '../lib/assets';
import { useDoubleClick } from '../lib/useDoubleClick';
import { useSingleOpenPopover } from '../lib/useSingleOpenPopover';
import { AghUpgradeToggle } from './AghUpgradeToggle';
import { ItemSlotBox } from './ItemSlotBox';
import { HeroPickerPopover } from './HeroPickerPopover';

/**
 * "I'll swap this hero out later" — an optional second hero+loadout card
 * for a role slot, tracked alongside its primary hero. Mirrors the primary
 * card's own drag/drop and click-to-search behavior, addressed by the same
 * role slot's id but under the 'lategame-*' drag-data kinds so the two
 * never get confused during a drag.
 */
export function LateGameSwapCard({
  slotId,
  swap,
  hero,
  heroes,
  assignedHeroSlugs,
  regularItems,
  regularItemsCatalog,
  neutralItem,
  neutralItemsCatalog,
  onRemove,
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
  slotId: string;
  swap: BoardSlot['lateGameSwap'];
  hero: Hero | undefined;
  heroes: Hero[];
  assignedHeroSlugs: Set<string>;
  regularItems: (Item | undefined)[];
  regularItemsCatalog: Item[];
  neutralItem: NeutralItem | undefined;
  neutralItemsCatalog: NeutralItem[];
  onRemove: () => void;
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
  const { open: pickerOpen, openPopover, closePopover } = useSingleOpenPopover(`slot:${slotId}:lategame:hero-picker`);
  const { setNodeRef, isOver } = useDroppable({
    id: `slot:${slotId}:lategame:hero`,
    data: { kind: 'lategame-hero-slot', slotId },
  });
  const heroDraggable = useDraggable({
    id: `slot:${slotId}:lategame:hero:occupant`,
    data: { kind: 'lategame-hero-slot', fromSlotId: slotId, heroSlug: hero?.slug },
    disabled: !hero,
  });
  const handleHeroClick = useDoubleClick(onRemoveHero);

  if (!swap) return null;

  return (
    <div className="late-game-card">
      <div className="late-game-card-corner">
        <button type="button" className="late-game-card-remove" title="Remove late-game swap" onClick={onRemove}>
          ×
        </button>
      </div>

      <div className="loadout-panel late-game-card-loadout">
        <div ref={setNodeRef} className="hero-dropzone late-game-hero-dropzone" data-over={isOver || undefined}>
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
                  openPopover();
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
                    closePopover();
                  }}
                  onClose={closePopover}
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
                active={swap.hasScepter}
                onToggle={onToggleScepter}
              />
              <AghUpgradeToggle
                iconUrl={SHARD_ICON_URL}
                label="Aghanim's Shard"
                active={swap.hasShard}
                onToggle={onToggleShard}
              />
            </div>
            <div className="item-bay">
              <div className="inventory-grid">
                {regularItems.map((item, i) => (
                  <ItemSlotBox
                    key={i}
                    id={`slot:${slotId}:lategame:regular:${i}`}
                    data={{ kind: 'lategame-regular-item-slot', slotId, itemIndex: i }}
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
                id={`slot:${slotId}:lategame:neutral`}
                data={{ kind: 'lategame-neutral-item-slot', slotId }}
                item={neutralItem}
                items={neutralItemsCatalog}
                onRemove={onRemoveNeutralItem}
                onPick={onPickNeutralItem}
                empty="Empty neutral slot"
                circular
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
