import type { Board } from '../types';
import { moveHero, setHero } from './boardRules';
import { loadHeroItemLoadouts } from './persistence';

/**
 * Places a hero into a role slot — shared by drag-and-drop and the
 * click-to-search picker. A hero can only be on the board once: if it's
 * already in a different slot, this relocates it (and everything it's
 * holding) instead of creating a duplicate. If the hero has a saved "Core
 * Items" build from its hero page, that seeds the slot's items.
 */
export function placeHeroInSlot(board: Board, slotId: string, heroSlug: string): Board {
  const existingSlot = board.slots.find((s) => s.heroSlug === heroSlug);
  if (existingSlot && existingSlot.slotId !== slotId) {
    return moveHero(board, existingSlot.slotId, slotId);
  }
  if (existingSlot) return board;

  const saved = loadHeroItemLoadouts()[heroSlug];
  const hasSavedItems = saved && (saved.regularItemSlugs.some((s) => s !== null) || saved.neutralItemSlug !== null);
  return setHero(board, slotId, heroSlug, hasSavedItems ? saved : undefined);
}
