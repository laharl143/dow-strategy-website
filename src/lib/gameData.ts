import type { Hero, RegularItem, NeutralItem } from '../types';
import heroesData from '../data/heroes.json';
import regularItemsData from '../data/regularItems.json';
import neutralItemsData from '../data/neutralItems.json';

export const heroes = heroesData as Hero[];
export const regularItems = regularItemsData as RegularItem[];
export const neutralItems = neutralItemsData as NeutralItem[];

export const heroBySlug = new Map(heroes.map((h) => [h.slug, h]));
export const regularItemBySlug = new Map(regularItems.map((i) => [i.slug, i]));
export const neutralItemBySlug = new Map(neutralItems.map((i) => [i.slug, i]));
