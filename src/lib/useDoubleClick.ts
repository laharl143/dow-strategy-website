import { useRef } from 'react';

/**
 * A same-element double-click detector based on two `onClick` events within a
 * time window, rather than the browser's native `dblclick` event. Native
 * dblclick synthesis is unreliable on elements that also carry dnd-kit
 * draggable listeners (pointer capture on pointerdown interferes with the
 * browser pairing up the two clicks), so this is the robust alternative.
 */
export function useDoubleClick(onDoubleClick: () => void, thresholdMs = 400) {
  const lastClickAtRef = useRef(0);
  return () => {
    const now = Date.now();
    if (now - lastClickAtRef.current < thresholdMs) {
      lastClickAtRef.current = 0;
      onDoubleClick();
    } else {
      lastClickAtRef.current = now;
    }
  };
}
