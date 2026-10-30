// Shared types used by the app AND the online server.
// Keep this folder free of React Native imports so the server can use it too.

export type Team = 0 | 1;

export type StatKey = 'power' | 'accuracy' | 'aim' | 'stamina';
export const STAT_KEYS: StatKey[] = ['power', 'accuracy', 'aim', 'stamina'];
export type StatLevels = Record<StatKey, number>;

export type FormationId = '2-2' | '1-2-1' | '2-1-1' | '3-1' | '1-3';

// A puck the player owns (saved on the server)
export type PuckData = {
  id: string;
  name: string;
  number: number;
  levels: StatLevels;
  goals: number;
  shots: number;
  matches: number;
};

export type PlayerStats = {
  played: number;
  wins: number;
  losses: number;
  goals: number;
  conceded: number;
  shootoutWins: number;
};

export type Profile = {
  username: string;
  coins: number;
  formation: FormationId;
  lineup: string[]; // puck ids: first 5 = starters (in formation slot order), rest = bench
  pucks: PuckData[];
  stats: PlayerStats;
};

export type MatchMode = 'time' | 'goals';
export type MatchSettings = { mode: MatchMode; minutes: number; goals: number };
export const TIME_OPTIONS = [2, 5, 7, 10];
export const GOAL_OPTIONS = [2, 5];

// What a finished match means for one player's profile
export type MatchResult = {
  won: boolean;
  goalsFor: number;
  goalsAgainst: number;
  wonOnShootout: boolean;
  puckStats: Record<string, { goals: number; shots: number; played: boolean }>;
};
