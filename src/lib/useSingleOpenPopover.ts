import { useCallback, useEffect, useState } from 'react';

const EVENT = 'planner:popover-open';

/**
 * Keeps at most one click-to-search popover open across the whole app —
 * without this, every item/hero slot manages its own open/closed state in
 * isolation, so opening a second slot's popover doesn't close the first
 * one and they stack up. Each caller passes a stable, unique id (e.g. the
 * slot's own dnd-kit id); opening broadcasts that id, and every other
 * instance currently open closes itself on hearing an id that isn't theirs.
 */
export function useSingleOpenPopover(id: string) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handleOtherOpen(e: Event) {
      if ((e as CustomEvent<string>).detail !== id) setOpen(false);
    }
    window.addEventListener(EVENT, handleOtherOpen);
    return () => window.removeEventListener(EVENT, handleOtherOpen);
  }, [open, id]);

  const openPopover = useCallback(() => {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: id }));
    setOpen(true);
  }, [id]);

  const closePopover = useCallback(() => setOpen(false), []);

  return { open, openPopover, closePopover };
}
