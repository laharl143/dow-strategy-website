/**
 * Heroes whose kit lets a player field more than one at once in a real game
 * (Arc Warden's Tempest Double is its own independently-controlled unit with
 * its own inventory) — DoW tracks each as its own board slot with its own
 * loadout, so placing one of these heroes when it's already on the board
 * adds a new instance instead of relocating the existing one (mirrors
 * COMBO_HERO_SLUGS in comboHeroes.ts: a short, explicit exception list next
 * to the one general rule everything else follows).
 */
export const MULTI_INSTANCE_HERO_SLUGS = ['arc-warden'];
