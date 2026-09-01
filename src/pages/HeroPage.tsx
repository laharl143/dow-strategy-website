import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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
      <div className="item-bay hero-page-item-slots">
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

function SituationalItemsSection({
  heroSlug,
  loadout,
  onRemoveSituationalItem,
  onPickSituationalItem,
  onRemoveSituationalNeutralItem,
  onPickSituationalNeutralItem,
}: {
  heroSlug: string;
  loadout: HeroItemLoadout;
  onRemoveSituationalItem: (index: number) => void;
  onPickSituationalItem: (index: number, itemSlug: string) => void;
  onRemoveSituationalNeutralItem: (index: number) => void;
  onPickSituationalNeutralItem: (index: number, itemSlug: string) => void;
}) {
  const situationalSlotId = `hero:${heroSlug}:situational`;
  const situationalItems = loadout.situationalItemSlugs.map((slug) => (slug ? regularItemBySlug.get(slug) : undefined));
  const situationalNeutralItems = loadout.situationalNeutralItemSlugs.map((slug) =>
    slug ? neutralItemBySlug.get(slug) : undefined,
  );

  return (
    <section className="hero-page-item-section">
      <h2>Situational Items</h2>
      <div className="hero-page-item-slots">
        <div className="hero-page-situational-editable-row">
          {situationalItems.map((item, i) => (
            <ItemSlotBox
              key={`item-${i}`}
              id={`${situationalSlotId}:item:${i}`}
              data={{ kind: 'situational-item-slot', slotId: situationalSlotId, itemIndex: i }}
              item={item}
              items={regularItemsCatalog}
              onRemove={() => onRemoveSituationalItem(i)}
              onPick={(itemSlug) => onPickSituationalItem(i, itemSlug)}
              empty="Empty situational slot"
            />
          ))}
          {situationalNeutralItems.map((item, i) => (
            <ItemSlotBox
              key={`neutral-${i}`}
              id={`${situationalSlotId}:neutral:${i}`}
              data={{ kind: 'situational-neutral-item-slot', slotId: situationalSlotId, itemIndex: i }}
              item={item}
              items={neutralItemsCatalog}
              onRemove={() => onRemoveSituationalNeutralItem(i)}
              onPick={(itemSlug) => onPickSituationalNeutralItem(i, itemSlug)}
              empty="Empty situational neutral slot"
              circular
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function NoteSection({
  note,
  onChange,
  onSave,
  canSave,
}: {
  note: string;
  onChange: (value: string) => void;
  onSave: () => void;
  canSave: boolean;
}) {
  const [justSaved, setJustSaved] = useState(false);

  function handleSave() {
    onSave();
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1500);
  }

  return (
    <section className="hero-page-item-section">
      <div className="hero-page-note-header">
        <h2>Notes</h2>
        {canSave && (
          <button type="button" className="hero-page-note-save" onClick={handleSave}>
            {justSaved ? 'Saved ✓' : 'Save'}
          </button>
        )}
      </div>
      <textarea
        className="hero-page-note"
        placeholder="Write build notes, timings, matchup tips…"
        value={note}
        onChange={(e) => onChange(e.target.value)}
      />
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

  // Push this hero's build to Supabase after changes settle — debounced so
  // several drags in a row don't fire one network request per drop. The
  // note is deliberately excluded from what triggers this: it only syncs
  // when the user hits the Notes section's own Save button, not on every
  // keystroke (whatever note text is current still rides along on a push
  // triggered by an item change, since it's all one row).
  const heroLoadout = hero ? loadoutsBySlug[hero.slug] : undefined;
  const itemSyncSignature = heroLoadout
    ? JSON.stringify([
        heroLoadout.regularItemSlugs,
        heroLoadout.neutralItemSlug,
        heroLoadout.situationalItemSlugs,
        heroLoadout.situationalNeutralItemSlugs,
      ])
    : null;
  useEffect(() => {
    if (!session || !hero || !heroLoadout) return;
    const timer = setTimeout(() => {
      void pushLoadout(session.user.id, hero.slug, heroLoadout);
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, hero, itemSyncSignature]);

  if (!hero) {
    return (
      <ItemShopDock>
        <div className="hero-page">
          <Link to="/heroes" className="hero-page-back">
            ‹ Back to Heroes
          </Link>
          <p>Hero not found.</p>
        </div>
      </ItemShopDock>
    );
  }

  const aghFlags = aghFlagsBySlug[hero.slug] ?? EMPTY_AGH_FLAGS;
  const loadout = loadoutsBySlug[hero.slug] ?? emptyHeroItemLoadout();
  const slotId = `hero:${hero.slug}`;
  const situationalSlotId = `hero:${hero.slug}:situational`;

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
    if (!activeData || !overData) return;

    function moveInto(field: 'regularItemSlugs' | 'situationalItemSlugs' | 'situationalNeutralItemSlugs') {
      setLoadout((prev) => {
        const slugs = [...prev[field]];
        if (activeData!.fromItemIndex !== undefined) slugs[activeData!.fromItemIndex] = null;
        slugs[overData!.itemIndex!] = activeData!.itemSlug ?? null;
        return { ...prev, [field]: slugs };
      });
    }

    if (
      overData.kind === 'regular-item-slot' &&
      overData.slotId === slotId &&
      overData.itemIndex !== undefined &&
      (activeData.kind === 'regular-item' || activeData.kind === 'regular-item-slot')
    ) {
      moveInto('regularItemSlugs');
      return;
    }

    if (
      overData.kind === 'neutral-item-slot' &&
      overData.slotId === slotId &&
      (activeData.kind === 'neutral-item' || activeData.kind === 'neutral-item-slot')
    ) {
      setLoadout((prev) => ({ ...prev, neutralItemSlug: activeData.itemSlug ?? null }));
      return;
    }

    if (
      overData.kind === 'situational-item-slot' &&
      overData.slotId === situationalSlotId &&
      overData.itemIndex !== undefined &&
      (activeData.kind === 'regular-item' || activeData.kind === 'situational-item-slot')
    ) {
      moveInto('situationalItemSlugs');
      return;
    }

    if (
      overData.kind === 'situational-neutral-item-slot' &&
      overData.slotId === situationalSlotId &&
      overData.itemIndex !== undefined &&
      (activeData.kind === 'neutral-item' || activeData.kind === 'situational-neutral-item-slot')
    ) {
      moveInto('situationalNeutralItemSlugs');
    }
  }

  return (
    <ItemShopDock onDragEnd={handleItemDragEnd}>
      <div className="hero-page">
        <Link to="/heroes" className="hero-page-back">
          ‹ Back to Heroes
        </Link>
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
        <SituationalItemsSection
          heroSlug={hero.slug}
          loadout={loadout}
          onRemoveSituationalItem={(i) =>
            setLoadout((prev) => {
              const slugs = [...prev.situationalItemSlugs];
              slugs[i] = null;
              return { ...prev, situationalItemSlugs: slugs };
            })
          }
          onPickSituationalItem={(i, itemSlug) =>
            setLoadout((prev) => {
              const slugs = [...prev.situationalItemSlugs];
              slugs[i] = itemSlug;
              return { ...prev, situationalItemSlugs: slugs };
            })
          }
          onRemoveSituationalNeutralItem={(i) =>
            setLoadout((prev) => {
              const slugs = [...prev.situationalNeutralItemSlugs];
              slugs[i] = null;
              return { ...prev, situationalNeutralItemSlugs: slugs };
            })
          }
          onPickSituationalNeutralItem={(i, itemSlug) =>
            setLoadout((prev) => {
              const slugs = [...prev.situationalNeutralItemSlugs];
              slugs[i] = itemSlug;
              return { ...prev, situationalNeutralItemSlugs: slugs };
            })
          }
        />
        <NoteSection
          note={loadout.note}
          onChange={(value) => setLoadout((prev) => ({ ...prev, note: value }))}
          onSave={() => {
            if (session) void pushLoadout(session.user.id, hero.slug, loadout);
          }}
          canSave={!!session}
        />
      </div>
    </ItemShopDock>
  );
}
