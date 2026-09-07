import type { Hero } from '../types';

/**
 * Reduces a hero name to its word-initials abbreviation, e.g. "Shadow Demon"
 * -> "sd", "Anti-Mage" -> "am", "Keeper of the Light" -> "kotl" — matching
 * how players actually abbreviate hero names in chat (DOW-32).
 */
function heroInitials(name: string): string {
  return name
    .split(/[\s-]+/)
    .map((word) => word[0] ?? '')
    .join('')
    .toLowerCase();
}

/** Whether `hero` matches a trimmed, lowercased search `query` by substring or initials abbreviation. */
export function heroMatchesQuery(hero: Hero, query: string): boolean {
  if (!query) return true;
  return hero.name.toLowerCase().includes(query) || heroInitials(hero.name) === query;
}
