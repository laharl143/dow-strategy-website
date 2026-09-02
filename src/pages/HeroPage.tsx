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
import { heroIconUrl, abilityIconUrl, SCEPTER_ICON_URL, SHARD_ICON_URL } from '../lib/assets';
import type { Ability } from '../types';
import {
  loadHeroBuilds,
  saveHeroBuilds,
  emptyHeroBuildState,
  newHeroBuild,
  loadHeroCombos,
  saveHeroCombos,
  toggleHeroComboGiver,
  type HeroBuild,
  type HeroBuildState,
} from '../lib/persistence';
import { AghUpgradeToggle } from '../components/AghUpgradeToggle';
import { ComboToggle } from '../components/ComboToggle';
import { ItemSlotBox } from '../components/ItemSlotBox';
import { ItemShopDock } from '../components/ItemShopDock';
import { useAuth } from '../lib/auth';
import { pushHeroBuilds } from '../lib/heroLoadoutSync';

interface DragData {
  kind: string;
  slotId?: string;
  itemIndex?: number;
  itemSlug?: string;
  fromItemIndex?: number;
}

const HOTKEYS = ['Q', 'W', 'E', 'R'];

function SkillsSection({ abilities }: { abilities: Ability[] }) {
  return (
    <section className="hero-page-item-section">
      <h2>Skills</h2>
      <div className="skills-row">
        {abilities.map((ability, i) => (
          <div
            key={ability.slug}
            className={`skill-slot${ability.ultimate ? ' ultimate' : ''}`}
            title={`${ability.name}\n\n${ability.desc}`}
          >
            <span className="hotkey">{HOTKEYS[i]}</span>
            <img src={abilityIconUrl(ability.slug)} alt={ability.name} />
          </div>
        ))}
      </div>
    </section>
  );
}

function BuildTabs({
  builds,
  activeBuildId,
  onSelect,
  onAdd,
  onRemove,
  onRename,
}: {
  builds: HeroBuild[];
  activeBuildId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  function startRename(build: HeroBuild) {
    setRenamingId(build.id);
    setDraftName(build.name);
  }

  function commitRename() {
    if (renamingId && draftName.trim()) {
      onRename(renamingId, draftName.trim());
    }
    setRenamingId(null);
  }

  return (
    <div className="build-tabs">
      {builds.map((build) => (
        <div
          key={build.id}
          className={`build-tab${build.id === activeBuildId ? ' active' : ''}`}
          onClick={() => onSelect(build.id)}
        >
          {renamingId === build.id ? (
            <input
              className="build-tab-input"
              value={draftName}
              autoFocus
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setRenamingId(null);
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span onDoubleClick={(e) => { e.stopPropagation(); startRename(build); }}>{build.name}</span>
          )}
          {builds.length > 1 && (
            <button
              type="button"
              className="build-tab-remove"
              title={`Remove ${build.name}`}
              onClick={(e) => {
                e.stopPropagation();
                onRemove(build.id);
              }}
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <button type="button" className="build-tab-add" title="Add build" onClick={onAdd}>
        +
      </button>
    </div>
  );
}

function CoreItemsSection({
  heroSlug,
  build,
  builds,
  activeBuildId,
  onSelectBuild,
  onAddBuild,
  onRemoveBuild,
  onRenameBuild,
  onRemoveRegularItem,
  onPickRegularItem,
  onRemoveNeutralItem,
  onPickNeutralItem,
  onToggleScepter,
  onToggleShard,
  onToggleRegularAutocast,
  onToggleNeutralAutocast,
}: {
  heroSlug: string;
  build: HeroBuild;
  builds: HeroBuild[];
  activeBuildId: string;
  onSelectBuild: (id: string) => void;
  onAddBuild: () => void;
  onRemoveBuild: (id: string) => void;
  onRenameBuild: (id: string, name: string) => void;
  onRemoveRegularItem: (index: number) => void;
  onPickRegularItem: (index: number, itemSlug: string) => void;
  onRemoveNeutralItem: () => void;
  onPickNeutralItem: (itemSlug: string) => void;
  onToggleScepter: () => void;
  onToggleShard: () => void;
  onToggleRegularAutocast: (index: number) => void;
  onToggleNeutralAutocast: () => void;
}) {
  const slotId = `hero:${heroSlug}`;
  const regularItems = build.regularItemSlugs.map((slug) => (slug ? regularItemBySlug.get(slug) : undefined));
  const neutralItem = build.neutralItemSlug ? neutralItemBySlug.get(build.neutralItemSlug) : undefined;

  return (
    <section className="hero-page-item-section">
      <h2>Core Items</h2>
      <BuildTabs
        builds={builds}
        activeBuildId={activeBuildId}
        onSelect={onSelectBuild}
        onAdd={onAddBuild}
        onRemove={onRemoveBuild}
        onRename={onRenameBuild}
      />
      <div className="item-bay hero-page-item-slots">
        <div className="agh-toggle-stack">
          <AghUpgradeToggle
            iconUrl={SCEPTER_ICON_URL}
            label="Aghanim's Scepter"
            active={build.hasScepter}
            onToggle={onToggleScepter}
          />
          <AghUpgradeToggle
            iconUrl={SHARD_ICON_URL}
            label="Aghanim's Shard"
            active={build.hasShard}
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
              autocast={build.regularItemAutocast[i]}
              onToggleAutocast={() => onToggleRegularAutocast(i)}
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
          autocast={build.neutralItemAutocast}
          onToggleAutocast={onToggleNeutralAutocast}
        />
      </div>
    </section>
  );
}

function SituationalItemsSection({
  heroSlug,
  build,
  onRemoveSituationalItem,
  onPickSituationalItem,
  onRemoveSituationalNeutralItem,
  onPickSituationalNeutralItem,
}: {
  heroSlug: string;
  build: HeroBuild;
  onRemoveSituationalItem: (index: number) => void;
  onPickSituationalItem: (index: number, itemSlug: string) => void;
  onRemoveSituationalNeutralItem: (index: number) => void;
  onPickSituationalNeutralItem: (index: number, itemSlug: string) => void;
}) {
  const situationalSlotId = `hero:${heroSlug}:situational`;
  const situationalItems = build.situationalItemSlugs.map((slug) => (slug ? regularItemBySlug.get(slug) : undefined));
  const situationalNeutralItems = build.situationalNeutralItemSlugs.map((slug) =>
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

export function HeroPage() {
  const { slug } = useParams<{ slug: string }>();
  const hero = slug ? heroBySlug.get(slug) : undefined;
  const { session } = useAuth();
  const [buildsBySlug, setBuildsBySlug] = useState<Record<string, HeroBuildState>>(() => loadHeroBuilds());
  const [combos, setCombos] = useState<Record<string, string[]>>(() => loadHeroCombos());

  useEffect(() => {
    saveHeroBuilds(buildsBySlug);
  }, [buildsBySlug]);

  useEffect(() => {
    saveHeroCombos(combos);
  }, [combos]);

  // Push this hero's builds to Supabase after changes settle — debounced so
  // several drags in a row don't fire one network request per drop. The
  // note is deliberately excluded from what triggers this: it only syncs
  // when the user hits the Notes section's own Save button, not on every
  // keystroke (whatever note text is current still rides along on a push
  // triggered by an item change, since it's all one row).
  const heroBuildState = hero ? buildsBySlug[hero.slug] : undefined;
  const buildSyncSignature = heroBuildState
    ? JSON.stringify(
        heroBuildState.builds.map((b) => [
          b.id,
          b.name,
          b.regularItemSlugs,
          b.neutralItemSlug,
          b.situationalItemSlugs,
          b.situationalNeutralItemSlugs,
          b.hasScepter,
          b.hasShard,
        ]),
      )
    : null;
  useEffect(() => {
    if (!session || !hero || !heroBuildState) return;
    const timer = setTimeout(() => {
      void pushHeroBuilds(session.user.id, hero.slug, heroBuildState);
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, hero, buildSyncSignature]);

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

  const buildState = buildsBySlug[hero.slug] ?? emptyHeroBuildState();
  const activeBuild = buildState.builds.find((b) => b.id === buildState.activeBuildId) ?? buildState.builds[0];
  const slotId = `hero:${hero.slug}`;
  const situationalSlotId = `hero:${hero.slug}:situational`;

  function setBuildState(updater: (prev: HeroBuildState) => HeroBuildState) {
    setBuildsBySlug((prev) => {
      const current = prev[hero!.slug] ?? emptyHeroBuildState();
      return { ...prev, [hero!.slug]: updater(current) };
    });
  }

  function setActiveBuild(updater: (prev: HeroBuild) => HeroBuild) {
    setBuildState((prev) => ({
      ...prev,
      builds: prev.builds.map((b) => (b.id === prev.activeBuildId ? updater(b) : b)),
    }));
  }

  function selectBuild(buildId: string) {
    setBuildState((prev) => ({ ...prev, activeBuildId: buildId }));
  }

  function addBuild() {
    setBuildState((prev) => {
      const build = newHeroBuild(`Build ${prev.builds.length + 1}`);
      return { builds: [...prev.builds, build], activeBuildId: build.id };
    });
  }

  function removeBuild(buildId: string) {
    setBuildState((prev) => {
      if (prev.builds.length <= 1) return prev;
      const builds = prev.builds.filter((b) => b.id !== buildId);
      const activeBuildId = prev.activeBuildId === buildId ? builds[0].id : prev.activeBuildId;
      return { builds, activeBuildId };
    });
  }

  function renameBuild(buildId: string, name: string) {
    setBuildState((prev) => ({
      ...prev,
      builds: prev.builds.map((b) => (b.id === buildId ? { ...b, name } : b)),
    }));
  }

  function handleItemDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeData = active.data.current as DragData | undefined;
    const overData = over.data.current as DragData | undefined;
    if (!activeData || !overData) return;

    function moveInto(field: 'regularItemSlugs' | 'situationalItemSlugs' | 'situationalNeutralItemSlugs') {
      setActiveBuild((prev) => {
        const slugs = [...prev[field]];
        const fromIndex = activeData!.fromItemIndex;
        const toIndex = overData!.itemIndex!;
        // Dropping onto an occupied slot swaps the two, instead of silently
        // discarding whatever was already there. A drag from outside this
        // array (e.g. straight from the shop tray) has no fromIndex, so
        // there's nothing to swap back — it just places into the target.
        if (fromIndex !== undefined) slugs[fromIndex] = slugs[toIndex];
        slugs[toIndex] = activeData!.itemSlug ?? null;
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
      setActiveBuild((prev) => ({ ...prev, neutralItemSlug: activeData.itemSlug ?? null }));
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
            <ComboToggle
              hero={hero}
              giverSlugs={combos[hero.slug] ?? []}
              onToggleGiver={(giverSlug) => setCombos((prev) => toggleHeroComboGiver(prev, hero.slug, giverSlug))}
            />
          </div>
        </div>

        <SkillsSection abilities={hero.abilities} />

        <CoreItemsSection
          heroSlug={hero.slug}
          build={activeBuild}
          builds={buildState.builds}
          activeBuildId={buildState.activeBuildId}
          onSelectBuild={selectBuild}
          onAddBuild={addBuild}
          onRemoveBuild={removeBuild}
          onRenameBuild={renameBuild}
          onRemoveRegularItem={(i) =>
            setActiveBuild((prev) => {
              const slugs = [...prev.regularItemSlugs];
              slugs[i] = null;
              return { ...prev, regularItemSlugs: slugs };
            })
          }
          onPickRegularItem={(i, itemSlug) =>
            setActiveBuild((prev) => {
              const slugs = [...prev.regularItemSlugs];
              slugs[i] = itemSlug;
              return { ...prev, regularItemSlugs: slugs };
            })
          }
          onRemoveNeutralItem={() => setActiveBuild((prev) => ({ ...prev, neutralItemSlug: null }))}
          onPickNeutralItem={(itemSlug) => setActiveBuild((prev) => ({ ...prev, neutralItemSlug: itemSlug }))}
          onToggleScepter={() => setActiveBuild((prev) => ({ ...prev, hasScepter: !prev.hasScepter }))}
          onToggleShard={() => setActiveBuild((prev) => ({ ...prev, hasShard: !prev.hasShard }))}
          onToggleRegularAutocast={(i) =>
            setActiveBuild((prev) => {
              const flags = [...prev.regularItemAutocast];
              flags[i] = !flags[i];
              return { ...prev, regularItemAutocast: flags };
            })
          }
          onToggleNeutralAutocast={() =>
            setActiveBuild((prev) => ({ ...prev, neutralItemAutocast: !prev.neutralItemAutocast }))
          }
        />
        <SituationalItemsSection
          heroSlug={hero.slug}
          build={activeBuild}
          onRemoveSituationalItem={(i) =>
            setActiveBuild((prev) => {
              const slugs = [...prev.situationalItemSlugs];
              slugs[i] = null;
              return { ...prev, situationalItemSlugs: slugs };
            })
          }
          onPickSituationalItem={(i, itemSlug) =>
            setActiveBuild((prev) => {
              const slugs = [...prev.situationalItemSlugs];
              slugs[i] = itemSlug;
              return { ...prev, situationalItemSlugs: slugs };
            })
          }
          onRemoveSituationalNeutralItem={(i) =>
            setActiveBuild((prev) => {
              const slugs = [...prev.situationalNeutralItemSlugs];
              slugs[i] = null;
              return { ...prev, situationalNeutralItemSlugs: slugs };
            })
          }
          onPickSituationalNeutralItem={(i, itemSlug) =>
            setActiveBuild((prev) => {
              const slugs = [...prev.situationalNeutralItemSlugs];
              slugs[i] = itemSlug;
              return { ...prev, situationalNeutralItemSlugs: slugs };
            })
          }
        />
        <NoteSection
          note={activeBuild.note}
          onChange={(value) => setActiveBuild((prev) => ({ ...prev, note: value }))}
          onSave={() => {
            if (session) void pushHeroBuilds(session.user.id, hero.slug, buildState);
          }}
          canSave={!!session}
        />
      </div>
    </ItemShopDock>
  );
}
