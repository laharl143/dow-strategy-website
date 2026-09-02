import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { BoardSlot, Hero, Item, NeutralItem, RoleSlotDefinition } from '../types';
import type { HeroBuild } from '../lib/persistence';
import { heroIconUrl, SCEPTER_ICON_URL, SHARD_ICON_URL } from '../lib/assets';
import { useDoubleClick } from '../lib/useDoubleClick';
import { useSingleOpenPopover } from '../lib/useSingleOpenPopover';
import { AghUpgradeToggle } from './AghUpgradeToggle';
import { ItemSlotBox } from './ItemSlotBox';
import { HeroPickerPopover } from './HeroPickerPopover';
import { BuildSwitchPill } from './BuildSwitchPill';
import { ComboDots } from './ComboDots';

export function RoleSlotCard({
  definition,
  slot,
  hero,
  heroes,
  assignedHeroSlugs,
  regularItems,
  regularItemsCatalog,
  neutralItem,
  neutralTierGlow,
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
  onApplyBuild,
  onToggleRegularAutocast,
  onToggleNeutralAutocast,
}: {
  definition: RoleSlotDefinition;
  slot: BoardSlot;
  hero: Hero | undefined;
  heroes: Hero[];
  assignedHeroSlugs: Set<string>;
  regularItems: (Item | undefined)[];
  regularItemsCatalog: Item[];
  neutralItem: NeutralItem | undefined;
  /** Set to the item's tier when another slot on the board shares it (DOW-23) — glows the ring. */
  neutralTierGlow?: number;
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
  onApplyBuild: (build: HeroBuild) => void;
  onToggleRegularAutocast: (index: number) => void;
  onToggleNeutralAutocast: () => void;
}) {
  const { open: pickerOpen, openPopover, closePopover } = useSingleOpenPopover(`slot:${slot.slotId}:hero-picker`);
  const { setNodeRef, isOver } = useDroppable({
    id: `slot:${slot.slotId}:hero`,
    data: { kind: 'hero-slot', slotId: slot.slotId },
  });
  const heroDraggable = useDraggable({
    id: `slot:${slot.slotId}:hero:occupant`,
    data: { kind: 'hero-slot', fromSlotId: slot.slotId, heroSlug: hero?.slug },
    disabled: !hero,
  });

  const handleHeroClick = useDoubleClick(onRemoveHero);

  return (
    <div className="role-slot-card">
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
            <>
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
                <ComboDots hero={hero} />
                <img className="role-slot-hero-icon" src={heroIconUrl(hero.code)} alt={hero.name} draggable={false} />
              </div>
              <BuildSwitchPill
                id={`slot:${slot.slotId}:build-switch`}
                heroSlug={hero.slug}
                appliedBuildId={slot.appliedBuildId}
                onApply={onApplyBuild}
              />
            </>
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
                    autocast={slot.regularItemAutocast[i]}
                    onToggleAutocast={() => onToggleRegularAutocast(i)}
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
                tierGlow={neutralTierGlow}
                autocast={slot.neutralItemAutocast}
                onToggleAutocast={onToggleNeutralAutocast}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
