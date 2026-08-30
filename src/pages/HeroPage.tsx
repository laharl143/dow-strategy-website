import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  heroBySlug,
  regularItems as regularItemsCatalog,
  regularItemBySlug,
  neutralItems as neutralItemsCatalog,
  neutralItemBySlug,
} from '../lib/gameData';
import { heroIconUrl, SCEPTER_ICON_URL, SHARD_ICON_URL } from '../lib/assets';
import {
  loadHeroAghFlags,
  saveHeroAghFlags,
  loadHeroItemLoadouts,
  saveHeroItemLoadouts,
  emptyHeroItemLoadout,
  type HeroAghFlags,
  type HeroItemLoadout,
} from '../lib/persistence';
import { AghUpgradeToggle } from '../components/AghUpgradeToggle';
import { ItemSlotBox } from '../components/ItemSlotBox';
import { ItemShopDock } from '../components/ItemShopDock';
import { useAuth } from '../lib/auth';
import { pushLoadout } from '../lib/heroLoadoutSync';
import type { RegularItem } from '../types';

interface DragData {
  kind: string;
  slotId?: string;
  itemIndex?: number;
  itemSlug?: string;
  fromItemIndex?: number;
}

function CoreItemsSection({
  heroSlug,
  loadout,
  aghFlags,
  onRemoveRegularItem,
  onPickRegularItem,
  onRemoveNeutralItem,
  onPickNeutralItem,
  onToggleScepter,
  onToggleShard,
}: {
  heroSlug: string;
  loadout: HeroItemLoadout;
  aghFlags: HeroAghFlags;
  onRemoveRegularItem: (index: number) => void;
  onPickRegularItem: (index: number, itemSlug: string) => void;
  onRemoveNeutralItem: () => void;
  onPickNeutralItem: (itemSlug: string) => void;
  onToggleScepter: () => void;
  onToggleShard: () => void;
}) {
  const slotId = `hero:${heroSlug}`;
  const regularItems = loadout.regularItemSlugs.map((slug) => (slug ? regularItemBySlug.get(slug) : undefined));
  const neutralItem = loadout.neutralItemSlug ? neutralItemBySlug.get(loadout.neutralItemSlug) : undefined;

  return (
    <section className="hero-page-item-section">
      <h2>Core Items</h2>
      <div className="item-bay">
        <div className="agh-toggle-stack">
          <AghUpgradeToggle
            iconUrl={SCEPTER_ICON_URL}
            label="Aghanim's Scepter"
            active={aghFlags.coreScepter}
            onToggle={onToggleScepter}
          />
          <AghUpgradeToggle
            iconUrl={SHARD_ICON_URL}
            label="Aghanim's Shard"
            active={aghFlags.coreShard}
            onToggle={onToggleShard}
          />
        </div>
        <div className="inventory-grid">
          {regularItems.map((item, i) => (
            <ItemSlotBox
              key={i}
              id={`${slotId}:regular:${i}`}
              data={{ kind: 'regular-item-slot', slotId, itemIndex: i }}
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
          id={`${slotId}:neutral`}
          data={{ kind: 'neutral-item-slot', slotId }}
          item={neutralItem}
          items={neutralItemsCatalog}
          onRemove={onRemoveNeutralItem}
          onPick={onPickNeutralItem}
          empty="Empty neutral slot"
          circular
        />
      </div>
    </section>
  );
}

function SituationalItemsRow({ itemSlugs }: { itemSlugs: string[] }) {
  const items = itemSlugs.map((slug) => regularItemBySlug.get(slug)).filter((i): i is RegularItem => !!i);

  return (
    <section className="hero-page-item-section">
      <h2>Situational Items</h2>
      {items.length === 0 ? (
        <p className="empty-tray">
          No situational items added yet — edit this hero's <code>situationalItemSlugs</code> in{' '}
          <code>src/data/heroes.json</code>.
        </p>
      ) : (
        <div className="hero-page-situational-row">
          {items.map((item) => (
            <div key={item.slug} className="hero-page-item-box" title={item.name}>
              {item.iconUrl ? <img src={item.iconUrl} alt={item.name} /> : <span>{item.name.slice(0, 2)}</span>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const EMPTY_AGH_FLAGS: HeroAghFlags = { coreScepter: false, coreShard: false };

export function HeroPage() {
  const { slug } = useParams<{ slug: string }>();
  const hero = slug ? heroBySlug.get(slug) : undefined;
  const { session } = useAuth();
  const [aghFlagsBySlug, setAghFlagsBySlug] = useState<Record<string, HeroAghFlags>>(() => loadHeroAghFlags());
  const [loadoutsBySlug, setLoadoutsBySlug] = useState<Record<string, HeroItemLoadout>>(() => loadHeroItemLoadouts());

  useEffect(() => {
    saveHeroAghFlags(aghFlagsBySlug);
  }, [aghFlagsBySlug]);

  useEffect(() => {
    saveHeroItemLoadouts(loadoutsBySlug);
  }, [loadoutsBySlug]);

  // Push this hero's build to Supabase whenever it actually changes (not on
  // every render — the object reference is stable unless this hero's entry
  // was the one just updated).
  const heroLoadout = hero ? loadoutsBySlug[hero.slug] : undefined;
  useEffect(() => {
    if (!session || !hero || !heroLoadout) return;
    void pushLoadout(session.user.id, hero.slug, heroLoadout);
  }, [session, hero, heroLoadout]);

  if (!hero) {
    return (
      <ItemShopDock>
        <div className="hero-page">
          <p>Hero not found.</p>
        </div>
      </ItemShopDock>
    );
  }

  const aghFlags = aghFlagsBySlug[hero.slug] ?? EMPTY_AGH_FLAGS;
  const loadout = loadoutsBySlug[hero.slug] ?? emptyHeroItemLoadout();
  const slotId = `hero:${hero.slug}`;

  function toggleFlag(key: keyof HeroAghFlags) {
    setAghFlagsBySlug((prev) => {
      const current = prev[hero!.slug] ?? EMPTY_AGH_FLAGS;
      return { ...prev, [hero!.slug]: { ...current, [key]: !current[key] } };
    });
  }

  function setLoadout(updater: (prev: HeroItemLoadout) => HeroItemLoadout) {
    setLoadoutsBySlug((prev) => {
      const current = prev[hero!.slug] ?? emptyHeroItemLoadout();
      return { ...prev, [hero!.slug]: updater(current) };
    });
  }

  function handleItemDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeData = active.data.current as DragData | undefined;
    const overData = over.data.current as DragData | undefined;
    if (!activeData || !overData || overData.slotId !== slotId) return;

    if (
      (activeData.kind === 'regular-item' || activeData.kind === 'regular-item-slot') &&
      overData.kind === 'regular-item-slot' &&
      overData.itemIndex !== undefined
    ) {
      setLoadout((prev) => {
        const slugs = [...prev.regularItemSlugs];
        if (activeData.kind === 'regular-item-slot' && activeData.fromItemIndex !== undefined) {
          slugs[activeData.fromItemIndex] = null;
        }
        slugs[overData.itemIndex!] = activeData.itemSlug ?? null;
        return { ...prev, regularItemSlugs: slugs };
      });
      return;
    }

    if (
      (activeData.kind === 'neutral-item' || activeData.kind === 'neutral-item-slot') &&
      overData.kind === 'neutral-item-slot'
    ) {
      setLoadout((prev) => ({ ...prev, neutralItemSlug: activeData.itemSlug ?? null }));
    }
  }

  return (
    <ItemShopDock onDragEnd={handleItemDragEnd}>
      <div className="hero-page">
        <div className="hero-page-header">
          <img className="hero-page-portrait" src={heroIconUrl(hero.code)} alt={hero.name} />
          <div>
            <h1>{hero.name}</h1>
            <div className="hero-page-meta">
              <span>{hero.code}</span>
              {hero.primaryAttribute && <span>{hero.primaryAttribute.toUpperCase()}</span>}
              {hero.attackType && <span>{hero.attackType}</span>}
            </div>
            <div className="hero-page-badges">
              {hero.compositionRoles.map((role) => (
                <span key={role} className={`hero-page-badge hero-page-badge-role-${role}`}>
                  {role}
                </span>
              ))}
              {hero.pickFrequency && (
                <span className={`hero-page-badge hero-page-badge-freq-${hero.pickFrequency}`}>
                  {hero.pickFrequency}
                </span>
              )}
            </div>
          </div>
        </div>

        <CoreItemsSection
          heroSlug={hero.slug}
          loadout={loadout}
          aghFlags={aghFlags}
          onRemoveRegularItem={(i) =>
            setLoadout((prev) => {
              const slugs = [...prev.regularItemSlugs];
              slugs[i] = null;
              return { ...prev, regularItemSlugs: slugs };
            })
          }
          onPickRegularItem={(i, itemSlug) =>
            setLoadout((prev) => {
              const slugs = [...prev.regularItemSlugs];
              slugs[i] = itemSlug;
              return { ...prev, regularItemSlugs: slugs };
            })
          }
          onRemoveNeutralItem={() => setLoadout((prev) => ({ ...prev, neutralItemSlug: null }))}
          onPickNeutralItem={(itemSlug) => setLoadout((prev) => ({ ...prev, neutralItemSlug: itemSlug }))}
          onToggleScepter={() => toggleFlag('coreScepter')}
          onToggleShard={() => toggleFlag('coreShard')}
        />
        <SituationalItemsRow itemSlugs={hero.situationalItemSlugs} />
      </div>
    </ItemShopDock>
  );
}
