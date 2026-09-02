import { useEffect } from 'react';
import { useSingleOpenPopover } from '../lib/useSingleOpenPopover';
import { loadHeroBuilds, type HeroBuild } from '../lib/persistence';

/**
 * A small pill under a placed hero's portrait for switching which of its
 * saved hero-page builds this board slot is using — only rendered when the
 * hero actually has more than one build (DOW-8). Picking one loads that
 * build's items/agh flags into this slot, replacing what's there now.
 */
export function BuildSwitchPill({
  id,
  heroSlug,
  appliedBuildId,
  onApply,
}: {
  id: string;
  heroSlug: string;
  appliedBuildId: string | null;
  onApply: (build: HeroBuild) => void;
}) {
  const { open, openPopover, closePopover } = useSingleOpenPopover(id);

  useEffect(() => {
    if (!open) return;
    window.addEventListener('click', closePopover);
    return () => window.removeEventListener('click', closePopover);
  }, [open, closePopover]);

  const builds = loadHeroBuilds()[heroSlug]?.builds ?? [];
  if (builds.length <= 1) return null;

  const active = builds.find((b) => b.id === appliedBuildId) ?? builds[0];

  return (
    <div className="build-switch">
      <button
        type="button"
        className="build-switch-pill"
        title="Switch which saved build this slot uses"
        onClick={(e) => {
          e.stopPropagation();
          if (open) closePopover();
          else openPopover();
        }}
      >
        <span className="build-switch-name">{active.name}</span>
        <span className="build-switch-caret">▾</span>
      </button>
      {open && (
        <div className="build-switch-list" onClick={(e) => e.stopPropagation()}>
          {builds.map((build) => (
            <button
              key={build.id}
              type="button"
              className="build-switch-item"
              data-active={build.id === active.id || undefined}
              onClick={() => {
                onApply(build);
                closePopover();
              }}
            >
              {build.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
