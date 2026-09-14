export const ARCH = 5;
export const WEIGHT_COUNT = 546;
export const FEATURE_COUNT = 32;
export const HIDDEN = 8;
export const HEAD_SIZE = 273;
export const POPULATION = 16;
export const MATCH_SECONDS = 36;
export const MATCH_SECONDS_SWARM = 54;
export const EVOLVE_EVERY = 10;
export const LEAGUE_EVERY_GENS = 5;
export const MAX_ENERGY = 200;
export const DT = 1 / 60;
export const BOOK_KEY = "petri-strains-v5";
export const MAX_FACTIONS = 32;
/**
 * Compact Swarm for overnight: 8 colours, live reef recipe, ~60–90 cells on a
 * 720-radius dish. Live Petri is 32 colours / radius 1120 / up to 220 cells.
 */
export const TRAIN_SWARM_FACTIONS = 8;
export const TRAIN_SWARM_RADIUS = 720;
export const CONCURRENT_ACTIONS = 2;

export type DishId = "slide" | "culture" | "royale" | "swarm";
export type Difficulty = "calm" | "live" | "predatory";
export type EngineMode = "play" | "spectate" | "attract";
export type TentacleState = "growing" | "latched" | "locked";

export function emptyOccupancy(): number[] {
  return new Array(MAX_FACTIONS + 1).fill(0);
}

export function emptyFactionStats(): number[] {
  return new Array(MAX_FACTIONS + 1).fill(0);
}

export interface Strain {
  id: string;
  gen: number;
  w: string;
  elo: number;
  strength: number;
  fitness: number;
  games: number;
  wins: number;
}

export interface LeagueEntry {
  gen: number;
  w: string;
  elo: number;
}

export interface OvernightMeta {
  trainedAt: string;
  gamesAdded: number;
  genBefore: number;
  genAfter: number;
  strengthBefore: number;
  strengthAfter: number;
  vsGhostAfter: number;
}

export interface Book {
  arch: number;
  gen: number;
  games: number;
  strength: number;
  vsGhost: number;
  ghostGames: number;
  strains: Strain[];
  league: LeagueEntry[];
  overnight?: OvernightMeta;
}

export interface Net {
  w: Float32Array;
}

export interface CellTemplate {
  x: number;
  y: number;
  owner: number;
  energy: number;
  captureNeed?: number;
}

export interface Barrier {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface DishTemplate {
  id: DishId;
  name: string;
  blurb: string;
  maxEnergy: number;
  cells: CellTemplate[];
  radius?: number;
  barriers?: Barrier[];
}

export interface Cell {
  id: number;
  x: number;
  y: number;
  energy: number;
  owner: number;
  captureNeed: number;
  occupancy: number[];
  radius: number;
}

export interface Packet {
  t: number;
  energy: number;
  speed: number;
}

export interface Tentacle {
  id: number;
  from: number;
  to: number;
  owner: number;
  progress: number;
  charge: number;
  state: TentacleState;
  lockT: number;
  lockMate: number;
  packets: Packet[];
  pumpAcc: number;
  stall: number;
  pressure: number;
  clashGlow: number;
  wave: number;
  seed: number;
}

export interface MacroFeat {
  dominance: number;
  leaderDelta: number;
  myShare: number;
  rivalFriction: number;
  pressureOnMe: number;
  alive: number;
  targetIsLeader: number;
  buffer: number;
  dump: number;
}

export interface PowerTables {
  energy: number[];
  cellsN: number[];
  total: number;
  leader: number;
  flow: number[];
  stride: number;
}

export interface EngineEvents {
  onCapture: (cell: Cell, newOwner: number, oldOwner: number) => void;
  onCut: (locked: boolean) => void;
  onSend: () => void;
  onWin: (winner: number) => void;
  onLose: () => void;
  onClash?: () => void;
}

export const EMPTY_EVENTS: EngineEvents = {
  onCapture: () => {},
  onCut: () => {},
  onSend: () => {},
  onWin: () => {},
  onLose: () => {},
};

export const EMPTY_BOOK: Book = {
  arch: ARCH,
  gen: 0,
  games: 0,
  strength: 1000,
  vsGhost: 0.5,
  ghostGames: 0,
  strains: [],
  league: [],
};
