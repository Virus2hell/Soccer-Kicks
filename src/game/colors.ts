// Puck color kits. Each player picks one in the Squad screen.

export type PuckColorId = 'blue' | 'red' | 'green' | 'purple' | 'orange' | 'gold' | 'teal' | 'pink' | 'black';

export type PuckColor = {
  name: string;
  light: string; // highlight on the top face
  main: string;
  dark: string; // edge of the top face
  side: string; // the puck's side wall (the "3D" part)
  emblem: string; // center disc
  ink: string; // number color
};

export const PUCK_COLORS: Record<PuckColorId, PuckColor> = {
  blue: { name: 'Royal Blue', light: '#93c5fd', main: '#2563eb', dark: '#1e3a8a', side: '#172554', emblem: '#e0ecff', ink: '#1e3a8a' },
  red: { name: 'Crimson', light: '#fca5a5', main: '#dc2626', dark: '#7f1d1d', side: '#450a0a', emblem: '#ffe4e4', ink: '#7f1d1d' },
  green: { name: 'Emerald', light: '#86efac', main: '#16a34a', dark: '#14532d', side: '#052e16', emblem: '#dcfce7', ink: '#14532d' },
  purple: { name: 'Violet', light: '#d8b4fe', main: '#9333ea', dark: '#581c87', side: '#3b0764', emblem: '#f3e8ff', ink: '#581c87' },
  orange: { name: 'Bronze', light: '#fdba74', main: '#ea580c', dark: '#7c2d12', side: '#431407', emblem: '#ffedd5', ink: '#7c2d12' },
  gold: { name: 'Gold', light: '#fef08a', main: '#eab308', dark: '#854d0e', side: '#422006', emblem: '#fffbeb', ink: '#854d0e' },
  teal: { name: 'Teal', light: '#99f6e4', main: '#0d9488', dark: '#134e4a', side: '#042f2e', emblem: '#ccfbf1', ink: '#134e4a' },
  pink: { name: 'Pink', light: '#fbcfe8', main: '#db2777', dark: '#831843', side: '#500724', emblem: '#fce7f3', ink: '#831843' },
  black: { name: 'Carbon', light: '#94a3b8', main: '#334155', dark: '#0f172a', side: '#020617', emblem: '#facc15', ink: '#0f172a' },
};

export const PUCK_COLOR_IDS = Object.keys(PUCK_COLORS) as PuckColorId[];

export const isPuckColor = (c: unknown): c is PuckColorId => typeof c === 'string' && c in PUCK_COLORS;

/** The second player gets another color if both picked the same one */
export function resolveColors(a: PuckColorId, b: PuckColorId): [PuckColorId, PuckColorId] {
  if (a !== b) return [a, b];
  const fallback: PuckColorId = a === 'orange' ? 'blue' : 'orange';
  return [a, fallback];
}
