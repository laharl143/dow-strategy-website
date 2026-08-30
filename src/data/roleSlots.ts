import type { RoleSlotDefinition } from '../types';

// Fixed order, per CONTEXT.md "Role Slot" — never grouped or reordered by category.
export const ROLE_SLOTS: RoleSlotDefinition[] = [
  { id: 'tank', order: 1, label: 'Tank', description: 'Frontline, absorbs damage.' },
  {
    id: 'core-magic-early',
    order: 2,
    label: 'Core — Magic Damage',
    description: 'Deals early magic damage.',
  },
  {
    id: 'support-gold',
    order: 3,
    label: 'Support — Gold',
    description: 'Provides gold generation benefits.',
  },
  {
    id: 'support-aoe-cc',
    order: 4,
    label: 'Support — AoE CC',
    description: 'Area stun or area silence.',
  },
  {
    id: 'support-heal',
    order: 5,
    label: 'Support — Healing',
    description: 'Healing capabilities.',
  },
  {
    id: 'core-physical-ranged',
    order: 6,
    label: 'Core — Physical Carry (Ranged)',
    description: 'Physical carry, must be ranged.',
  },
  {
    id: 'core-aoe-stun-pierce',
    order: 7,
    label: 'Core — AoE Stun (pierces magic immunity)',
    description: 'Area stun that pierces magic-immune buffs. Strong late game.',
  },
  {
    id: 'core-physical-flex',
    order: 8,
    label: 'Core — Physical Carry (Flex)',
    description: 'Strong physical carry, ranged or melee. Late game.',
  },
  {
    id: 'support-scaling',
    order: 9,
    label: 'Support — Late Scaling',
    description: 'Weak early, very strong late game.',
  },
];
