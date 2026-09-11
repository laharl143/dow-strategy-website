import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';

const GAP = 6;

/**
 * Viewport-aware placement for a portaled popover anchored to a slot button
 * — flips above the anchor when there's more room there than below, clamps
 * to the anchor's containing <section> (falling back to the viewport), and
 * starts hidden off-screen until measured to avoid a flash at the wrong
 * spot. Shared by ItemPickerPopover and HeroPickerPopover (DOW-35) so the
 * flip/clamp math isn't hand-rolled per popover.
 */
export function usePopoverPlacement({
  anchorRef,
  popoverRef,
  width,
  minHeight,
  maxHeightCap,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  popoverRef: RefObject<HTMLElement | null>;
  width: number;
  minHeight: number;
  maxHeightCap: number;
}): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({ top: -9999, left: -9999, width, visibility: 'hidden' });

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const popover = popoverRef.current;
    if (!anchor || !popover) return;

    function recompute() {
      const anchorRect = anchor!.getBoundingClientRect();
      const naturalHeight = popover!.getBoundingClientRect().height;
      const sectionRect = anchor!.closest('section')?.getBoundingClientRect();

      const belowLimit = Math.min(sectionRect?.bottom ?? Infinity, window.innerHeight);
      const aboveLimit = Math.max(sectionRect?.top ?? 0, 0);
      const spaceBelow = belowLimit - anchorRect.bottom - GAP;
      const spaceAbove = anchorRect.top - aboveLimit - GAP;

      let top: number | undefined;
      let bottom: number | undefined;
      let maxHeight = maxHeightCap;
      if (naturalHeight > spaceBelow && spaceAbove > spaceBelow) {
        maxHeight = Math.max(minHeight, Math.min(naturalHeight, spaceAbove));
        // Anchor by `bottom`, not `top` — max-height is just a cap, so the box
        // often renders shorter than it. Anchoring by `top` assuming the box
        // fills maxHeight leaves its actual bottom edge floating short of the
        // slot; `bottom` stays pinned regardless of how tall the box ends up.
        bottom = window.innerHeight - anchorRect.top + GAP;
      } else {
        if (naturalHeight > spaceBelow) maxHeight = Math.max(minHeight, Math.min(naturalHeight, spaceBelow));
        top = anchorRect.bottom + GAP;
      }

      const left = Math.min(anchorRect.left, window.innerWidth - width - GAP);

      setStyle({ top, bottom, left: Math.max(GAP, left), width, maxHeight, visibility: 'visible' });
    }

    recompute();

    // The anchor sits inside a scrolling ancestor (e.g. .board-panel), not
    // the window itself, so this has to listen in the capture phase to see
    // scroll events from that ancestor — they don't bubble to window like a
    // window-level scroll would.
    window.addEventListener('scroll', recompute, { capture: true });
    window.addEventListener('resize', recompute);
    return () => {
      window.removeEventListener('scroll', recompute, { capture: true });
      window.removeEventListener('resize', recompute);
    };
  }, [anchorRef, popoverRef, width, minHeight, maxHeightCap]);

  return style;
}
