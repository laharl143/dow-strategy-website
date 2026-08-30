# DOW Strategy Planner

A personal drag-and-drop planning tool for DOW (Dawn of War — the Dota 2 auto-battler mod by "rain"; called DOW from here on). Not a public wiki — a solo-use board for drafting a 9-hero lineup and assigning neutral/regular items before and during a match.

## Language

**DOW**:
Short name for the mod, used in place of "Dawn of War" throughout this project going forward.
_Avoid_: Dawn of War (spelled out), DoW

**Neutral Item**:
An item drawn from a limited, tier-gated pool (Tiers 1-5; in-game unlock rounds are 15/18/21/24/27, though the planner shows all tiers available from the start for advance planning). A player holds at most 6 neutral items total across a game, at most 1 per hero, in that hero's dedicated Neutral Slot.
_Avoid_: Neutral, drop item

**Regular Item**:
A hero-purchased item, unlimited supply, not tier-gated. Each hero has 9 Regular Item Slots — 6 Active Item Slots plus a 3-slot Backpack — separate from its single Neutral Slot.
_Avoid_: Normal item, shop item

**Backpack**:
The 3 non-active Regular Item Slots (of a hero's 9 total) shown visually dimmed on the board, matching Dota 2's own inventory layout. Items here aren't in active use but can be swapped with an Active Item Slot.
_Avoid_: Reserve slots, extra slots

**Pick Frequency**:
A per-hero tag — Always, Sometimes, or Never — for how often that hero is worth picking in the user's strategy. Tagged manually for all 126 heroes via a one-time sort-into-buckets pass, baked into `heroes.json`, and drives a hero-tray filter alongside the Tank/Core/Support filter.
_Avoid_: Priority, tier

**Role Slot**:
One of 9 fixed positions on the planning board, always rendered in this exact order: (1) Tank, (2) Core - Magic Damage (early), (3) Support - Gold Generation, (4) Support - AoE Stun/Silence, (5) Support - Healing, (6) Core - Physical Carry (ranged), (7) Core - AoE Stun piercing magic immunity (late game), (8) Core - Physical Carry (flex melee/ranged, late game), (9) Support - weak early / strong late. A board is a filled or partially-filled set of 9 Role Slots, always shown in this order — not grouped or reordered by category.
_Avoid_: Position, team slot

**Aghanim's Upgrade**:
A binary per-hero-per-game flag — Scepter and Shard are tracked independently — for whether that game's hero has bought the corresponding Aghanim's upgrade. Lives on the Board Slot (not on the Hero itself, since it's game-specific state), toggled by clicking its icon next to the item bay.
_Avoid_: Aghs, upgrade item (it isn't part of the Regular/Neutral item slots)

**Hero Page**:
A dedicated page per hero (`/heroes/:slug`) showing its portrait, tags, and two build-reference lists — Core Items (board-style grid) and Situational Items (single row) — distinct from the drag-and-drop board. Reached from the Heroes index, not from the board itself.
_Avoid_: Hero profile, hero detail (keep "Hero Page" as the canonical name)

**Heroes Index**:
The `/heroes` page — a grid of all hero portraits (styled after dota2.com/heroes), each linking to its Hero Page. The tool's two top-level destinations, reached via the nav bar, are Main Board (the planning tool) and Heroes (this index).
_Avoid_: Hero list, hero browser

**Shop Tab**:
Which of DOW's own item-shop categories a Regular Item belongs to — Basics or Upgrades — mirrored in the planner's item panel alongside a third Neutrals tab. Derived from whether the item is assembled from component items (Upgrades) or bought outright (Basics); a heuristic, not hand-verified against DOW's actual shop UI.
_Avoid_: Category (reserved for Neutral Item's Artifact/Enchantment split), item type
