import type { PuckData, Profile, StatKey, StatLevels } from './types';

export const MAX_LEVEL = 10;
export const MAX_HEALTH = 100;
export const SHOT_DRAIN = 6; // health lost by the shooter on every shot
export const STARTING_COINS = 200;
export const MAX_NAME_LENGTH = 12;

// ---- How each stat level turns into gameplay numbers ----

// Fastest shot (game units per frame) at full pull
export const maxShotSpeed = (power: number) => 12 + power * 0.45;

// Random error added to a shot, in degrees (lower = more accurate)
export const maxDeviationDeg = (accuracy: number) => 9.5 - accuracy * 0.85;

// Length of the aiming guide line (game units)
export const aimLength = (aim: number) => 90 + aim * 40;

// Multiplies every health loss (higher stamina = loses less health)
export const drainMultiplier = (stamina: number) => 1.3 - stamina * 0.07;

// A tired puck is weaker: 100% at full health, 45% at zero health
export const effectiveness = (health: number) => 0.45 + 0.55 * (health / MAX_HEALTH);

export const upgradeCost = (level: number) => 40 * level;

export const matchReward = (won: boolean, goals: number) => (won ? 100 : 40) + goals * 15;

export const puckRating = (levels: StatLevels) =>
  Math.round(((levels.power + levels.accuracy + levels.aim + levels.stamina) / 4) * 10);

export const STAT_INFO: Record<StatKey, { label: string; icon: string; describe: (lvl: number) => string }> = {
  power: { label: 'Power', icon: '💥', describe: (l) => `Max shot speed ${maxShotSpeed(l).toFixed(1)}` },
  accuracy: { label: 'Accuracy', icon: '🎯', describe: (l) => `Shot error ±${maxDeviationDeg(l).toFixed(1)}°` },
  aim: { label: 'Aim', icon: '📏', describe: (l) => `Guide line ${aimLength(l)} long` },
  stamina: { label: 'Stamina', icon: '🔋', describe: (l) => `Health loss x${drainMultiplier(l).toFixed(2)}` },
};

const DEFAULT_PUCKS: { name: string; levels: StatLevels }[] = [
  { name: 'Wall', levels: { power: 1, accuracy: 1, aim: 1, stamina: 3 } },
  { name: 'Tank', levels: { power: 2, accuracy: 1, aim: 1, stamina: 2 } },
  { name: 'Rocket', levels: { power: 3, accuracy: 1, aim: 1, stamina: 1 } },
  { name: 'Sniper', levels: { power: 1, accuracy: 3, aim: 2, stamina: 1 } },
  { name: 'Flash', levels: { power: 2, accuracy: 2, aim: 1, stamina: 1 } },
  { name: 'Ghost', levels: { power: 1, accuracy: 2, aim: 2, stamina: 1 } },
  { name: 'Blaze', levels: { power: 2, accuracy: 1, aim: 2, stamina: 1 } },
  { name: 'Storm', levels: { power: 1, accuracy: 1, aim: 3, stamina: 1 } },
];

export function createDefaultPucks(): PuckData[] {
  return DEFAULT_PUCKS.map((p, i) => ({
    id: `pk${i + 1}`,
    name: p.name,
    number: i + 1,
    levels: { ...p.levels },
    goals: 0,
    shots: 0,
    matches: 0,
  }));
}

export function createDefaultProfile(username: string): Profile {
  const pucks = createDefaultPucks();
  return {
    username,
    coins: STARTING_COINS,
    color: 'blue',
    formation: '2-2',
    lineup: pucks.map((p) => p.id),
    pucks,
    stats: { played: 0, wins: 0, losses: 0, goals: 0, conceded: 0, shootoutWins: 0 },
  };
}
