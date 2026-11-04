import type { FormationId } from './types';

export type Role = 'GK' | 'DEF' | 'MID' | 'FWD';
export type Slot = { x: number; y: number; role: Role };

// Positions for the LEFT team as fractions of the field (x: 0..1, y: 0..1).
// The right team uses the mirror image. Slot 0 is always the goalkeeper.
export const FORMATIONS: Record<FormationId, { label: string; slots: Slot[] }> = {
  '2-2': {
    label: 'Box 2-2',
    slots: [
      { x: 0.045, y: 0.5, role: 'GK' },
      { x: 0.19, y: 0.22, role: 'DEF' },
      { x: 0.19, y: 0.78, role: 'DEF' },
      { x: 0.38, y: 0.38, role: 'MID' },
      { x: 0.38, y: 0.62, role: 'MID' },
    ],
  },
  '1-2-1': {
    label: 'Diamond 1-2-1',
    slots: [
      { x: 0.045, y: 0.5, role: 'GK' },
      { x: 0.17, y: 0.5, role: 'DEF' },
      { x: 0.28, y: 0.25, role: 'MID' },
      { x: 0.28, y: 0.75, role: 'MID' },
      { x: 0.39, y: 0.5, role: 'FWD' },
    ],
  },
  '2-1-1': {
    label: 'Arrow 2-1-1',
    slots: [
      { x: 0.045, y: 0.5, role: 'GK' },
      { x: 0.155, y: 0.22, role: 'DEF' },
      { x: 0.155, y: 0.78, role: 'DEF' },
      { x: 0.27, y: 0.5, role: 'MID' },
      { x: 0.39, y: 0.5, role: 'FWD' },
    ],
  },
  '3-1': {
    label: 'Wall 3-1',
    slots: [
      { x: 0.045, y: 0.5, role: 'GK' },
      { x: 0.19, y: 0.2, role: 'DEF' },
      { x: 0.19, y: 0.5, role: 'DEF' },
      { x: 0.19, y: 0.8, role: 'DEF' },
      { x: 0.38, y: 0.5, role: 'FWD' },
    ],
  },
  '1-3': {
    label: 'Attack 1-3',
    slots: [
      { x: 0.045, y: 0.5, role: 'GK' },
      { x: 0.17, y: 0.5, role: 'DEF' },
      { x: 0.35, y: 0.2, role: 'MID' },
      { x: 0.37, y: 0.5, role: 'MID' },
      { x: 0.35, y: 0.8, role: 'MID' },
    ],
  },
};

export const FORMATION_IDS = Object.keys(FORMATIONS) as FormationId[];
