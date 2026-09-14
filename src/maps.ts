import {
  MAX_ENERGY,
  TRAIN_SWARM_FACTIONS,
  TRAIN_SWARM_RADIUS,
  type Barrier,
  type CellTemplate,
  type DishId,
  type DishTemplate,
} from "./types.js";

export const DISH_RADIUS = 360;
export const MAX_CELLS = 24;
export const MAX_SWARM_CELLS_TRAIN = 96;
export const MIN_CELL_GAP = 70;
export const SWARM_CELL_GAP = 48;
const BARRIER_CLEARANCE = 52;

export function cellRadius(energy: number): number {
  return 20 + Math.sqrt(Math.max(energy, 0)) * 2.05;
}

export function tentacleSlots(energy: number): number {
  return energy >= 120 ? 3 : energy >= 15 ? 2 : 1;
}

export function growSpeed(energy: number): number {
  return 78 + energy * 0.55;
}

export function pumpRate(energy: number): number {
  return 0.7 + Math.min(1, Math.max(0, energy / 200)) ** 2.55 * 58;
}

export function packetSpeed(energy: number): number {
  return 1.05 + Math.min(1, Math.max(0, energy / 200)) ** 2.2 * 5.4;
}

export function regenRate(energy: number): number {
  return 0.32 + Math.min(energy, 200) * 0.0018;
}

export function reachOf(energy: number): number {
  return 78 + energy * 3.15;
}

export const SLIDE: DishTemplate = {
  id: "slide",
  name: "Slide",
  blurb: "Two cultures. Learn the cut.",
  maxEnergy: 200,
  cells: [
    { x: -210, y: 150, owner: 1, energy: 42 },
    { x: -120, y: 210, owner: 1, energy: 18 },
    { x: 210, y: -150, owner: 2, energy: 36 },
    { x: 130, y: -210, owner: 2, energy: 16 },
    { x: -40, y: 20, owner: 0, energy: 0, captureNeed: 10 },
    { x: 50, y: -30, owner: 0, energy: 0, captureNeed: 10 },
    { x: -160, y: -40, owner: 0, energy: 0, captureNeed: 8 },
    { x: 170, y: 50, owner: 0, energy: 0, captureNeed: 8 },
    { x: 20, y: 170, owner: 0, energy: 0, captureNeed: 12 },
    { x: -10, y: -180, owner: 0, energy: 0, captureNeed: 12 },
  ],
};

export const CULTURE: DishTemplate = {
  id: "culture",
  name: "Culture",
  blurb: "Three-way standoff.",
  maxEnergy: 200,
  cells: [
    { x: 0, y: 230, owner: 1, energy: 48 },
    { x: -70, y: 170, owner: 1, energy: 20 },
    { x: 70, y: 170, owner: 1, energy: 16 },
    { x: -210, y: -140, owner: 2, energy: 44 },
    { x: -150, y: -200, owner: 2, energy: 18 },
    { x: -230, y: -60, owner: 2, energy: 14 },
    { x: 210, y: -140, owner: 3, energy: 44 },
    { x: 150, y: -200, owner: 3, energy: 18 },
    { x: 230, y: -60, owner: 3, energy: 14 },
    { x: 0, y: 20, owner: 0, energy: 0, captureNeed: 14 },
    { x: -110, y: 20, owner: 0, energy: 0, captureNeed: 10 },
    { x: 110, y: 20, owner: 0, energy: 0, captureNeed: 10 },
    { x: -40, y: -90, owner: 0, energy: 0, captureNeed: 9 },
    { x: 40, y: -90, owner: 0, energy: 0, captureNeed: 9 },
    { x: 0, y: 100, owner: 0, energy: 0, captureNeed: 8 },
  ],
};

export const ROYALE: DishTemplate = {
  id: "royale",
  name: "Royale",
  blurb: "Four colours. Last cell standing.",
  maxEnergy: 200,
  cells: [
    { x: -200, y: 200, owner: 1, energy: 50 },
    { x: -250, y: 120, owner: 1, energy: 18 },
    { x: -120, y: 250, owner: 1, energy: 14 },
    { x: 200, y: -200, owner: 2, energy: 50 },
    { x: 250, y: -120, owner: 2, energy: 18 },
    { x: 120, y: -250, owner: 2, energy: 14 },
    { x: -200, y: -200, owner: 3, energy: 50 },
    { x: -250, y: -120, owner: 3, energy: 18 },
    { x: -120, y: -250, owner: 3, energy: 14 },
    { x: 200, y: 200, owner: 4, energy: 50 },
    { x: 250, y: 120, owner: 4, energy: 18 },
    { x: 120, y: 250, owner: 4, energy: 14 },
    { x: 0, y: 0, owner: 0, energy: 0, captureNeed: 16 },
    { x: -80, y: 40, owner: 0, energy: 0, captureNeed: 10 },
    { x: 80, y: -40, owner: 0, energy: 0, captureNeed: 10 },
    { x: -40, y: -80, owner: 0, energy: 0, captureNeed: 10 },
    { x: 40, y: 80, owner: 0, energy: 0, captureNeed: 10 },
    { x: 0, y: 140, owner: 0, energy: 0, captureNeed: 8 },
    { x: 0, y: -140, owner: 0, energy: 0, captureNeed: 8 },
    { x: 140, y: 0, owner: 0, energy: 0, captureNeed: 8 },
    { x: -140, y: 0, owner: 0, energy: 0, captureNeed: 8 },
  ],
};

export const SWARM: DishTemplate = {
  id: "swarm",
  name: "Swarm",
  blurb: "Thirty-two colours. Hundreds of cells. Walls.",
  maxEnergy: 200,
  radius: TRAIN_SWARM_RADIUS,
  cells: [],
  barriers: [],
};

export const DISHES: Record<DishId, DishTemplate> = {
  slide: SLIDE,
  culture: CULTURE,
  royale: ROYALE,
  swarm: SWARM,
};

export function factionCount(dish: DishId): number {
  if (dish === "slide") return 2;
  if (dish === "culture") return 3;
  if (dish === "swarm") return TRAIN_SWARM_FACTIONS;
  return 4;
}

export function dishRadiusOf(id: DishId): number {
  return id === "swarm" ? TRAIN_SWARM_RADIUS : DISH_RADIUS;
}

function clampToDish(x: number, y: number, radius: number): { x: number; y: number } {
  const d = Math.hypot(x, y);
  const max = radius * 0.84;
  if (d <= max || d < 1e-6) return { x, y };
  const s = max / d;
  return { x: x * s, y: y * s };
}

function fits(cells: CellTemplate[], x: number, y: number, energy: number, gap: number): boolean {
  const r = cellRadius(energy);
  for (const c of cells) {
    const need = gap + (r + cellRadius(c.energy)) * 0.22;
    if (Math.hypot(c.x - x, c.y - y) < need) return false;
  }
  return true;
}

function tryPlace(
  cells: CellTemplate[],
  x0: number,
  y0: number,
  owner: number,
  energy: number,
  captureNeed: number | undefined,
  rng: () => number,
  radius: number,
  gap: number,
  attempts = 36,
): boolean {
  for (let k = 0; k < attempts; k++) {
    const jitter = k === 0 ? 0 : 18 + rng() * 90;
    const a = rng() * Math.PI * 2;
    const p = clampToDish(x0 + Math.cos(a) * jitter, y0 + Math.sin(a) * jitter, radius);
    if (!fits(cells, p.x, p.y, energy, gap)) continue;
    const cell: CellTemplate = { x: p.x, y: p.y, owner, energy };
    if (captureNeed != null) cell.captureNeed = captureNeed;
    cells.push(cell);
    return true;
  }
  return false;
}

function closestSegDist(px: number, py: number, b: Barrier): number {
  const dx = b.x2 - b.x1;
  const dy = b.y2 - b.y1;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-8) return Math.hypot(px - b.x1, py - b.y1);
  const t = Math.max(0, Math.min(1, ((px - b.x1) * dx + (py - b.y1) * dy) / len2));
  return Math.hypot(px - (b.x1 + dx * t), py - (b.y1 + dy * t));
}

export function pathBlocked(ax: number, ay: number, bx: number, by: number, barriers: Barrier[]): boolean {
  for (const w of barriers) {
    const den = (ax - bx) * (w.y1 - w.y2) - (ay - by) * (w.x1 - w.x2);
    if (Math.abs(den) < 1e-8) continue;
    const t = ((ax - w.x1) * (w.y1 - w.y2) - (ay - w.y1) * (w.x1 - w.x2)) / den;
    const u = ((ax - w.x1) * (ay - by) - (ay - w.y1) * (ax - bx)) / den;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return true;
  }
  return false;
}

function barrierClearOfCells(b: Barrier, cells: CellTemplate[]): boolean {
  for (const c of cells) {
    if (closestSegDist(c.x, c.y, b) < cellRadius(c.energy) + BARRIER_CLEARANCE) return false;
  }
  return true;
}

function tryWall(walls: Barrier[], cells: CellTemplate[], x1: number, y1: number, x2: number, y2: number): boolean {
  if (Math.hypot(x2 - x1, y2 - y1) < 80) return false;
  const b: Barrier = { x1, y1, x2, y2 };
  if (!barrierClearOfCells(b, cells)) return false;
  walls.push(b);
  return true;
}

/** Live-app reef recipe: 8–10 radial spokes with gaps + 4–6 broken chords. */
function placeBarriers(cells: CellTemplate[], radius: number, rng: () => number): Barrier[] {
  const walls: Barrier[] = [];
  const spokes = 8 + Math.floor(rng() * 3);
  const a0 = rng() * Math.PI * 2;
  for (let i = 0; i < spokes; i++) {
    const ang = a0 + (i / spokes) * Math.PI * 2 + (rng() - 0.5) * 0.12;
    const cs = Math.cos(ang);
    const sn = Math.sin(ang);
    const gapAt = 0.34 + rng() * 0.08;
    const gapW = 0.055 + rng() * 0.03;
    const rA = (0.14 + rng() * 0.04) * radius;
    const rB = (gapAt - gapW) * radius;
    const rC = (gapAt + gapW) * radius;
    const rD = (0.58 + rng() * 0.04) * radius;
    tryWall(walls, cells, cs * rA, sn * rA, cs * rB, sn * rB);
    tryWall(walls, cells, cs * rC, sn * rC, cs * rD, sn * rD);
  }

  const chords = 4 + Math.floor(rng() * 3);
  for (let i = 0; i < chords; i++) {
    const ang = rng() * Math.PI * 2;
    const midR = (0.28 + rng() * 0.22) * radius;
    const mx = Math.cos(ang) * midR;
    const my = Math.sin(ang) * midR;
    const tx = -Math.sin(ang);
    const ty = Math.cos(ang);
    const half = (0.16 + rng() * 0.14) * radius;
    const gap = (0.045 + rng() * 0.03) * radius;
    tryWall(walls, cells, mx - tx * half, my - ty * half, mx - tx * gap, my - ty * gap);
    tryWall(walls, cells, mx + tx * gap, my + ty * gap, mx + tx * half, my + ty * half);
  }
  return walls;
}

function cellClearOfBarriers(x: number, y: number, energy: number, walls: Barrier[]): boolean {
  const need = cellRadius(energy) + BARRIER_CLEARANCE;
  for (const w of walls) {
    if (closestSegDist(x, y, w) < need) return false;
  }
  return true;
}

/**
 * Compact overnight Swarm. Same generator as the live 32-colour / radius-1120
 * dish, scaled to TRAIN_SWARM_FACTIONS on TRAIN_SWARM_RADIUS so a slice still
 * finishes tens of thousands of games. Walls, home placement, and satellite
 * geometry match the live recipe.
 */
function makeSwarm(rng: () => number): DishTemplate {
  const radius = TRAIN_SWARM_RADIUS;
  const cells: CellTemplate[] = [];
  const players = TRAIN_SWARM_FACTIONS;
  const angle0 = rng() * Math.PI * 2;
  const homeR = radius * 0.76;
  for (let p = 0; p < players; p++) {
    const owner = p + 1;
    const ang = angle0 + (p / players) * Math.PI * 2 + (rng() - 0.5) * 0.04;
    const hx = Math.cos(ang) * homeR;
    const hy = Math.sin(ang) * homeR;
    const coreE = 28 + rng() * 28;
    tryPlace(cells, hx, hy, owner, coreE, undefined, rng, radius, SWARM_CELL_GAP, 64);
    const a2 = ang + (rng() - 0.5) * 0.55;
    const r2 = 56 + rng() * 50;
    tryPlace(
      cells,
      hx + Math.cos(a2) * r2,
      hy + Math.sin(a2) * r2,
      owner,
      10 + rng() * 16,
      undefined,
      rng,
      radius,
      SWARM_CELL_GAP,
      64,
    );
  }

  const barriers = placeBarriers(cells, radius, rng);

  const target = 40 + Math.floor(rng() * 16);
  let guard = 0;
  while (cells.filter((c) => c.owner === 0).length < target && guard++ < 1200) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * radius * 0.7;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    const need = 6 + Math.floor(rng() * 10);
    if (!cellClearOfBarriers(x, y, 0, barriers)) continue;
    const before = cells.length;
    if (!tryPlace(cells, x, y, 0, 0, need, rng, radius, SWARM_CELL_GAP, 20)) continue;
    const placed = cells[cells.length - 1];
    if (cells.length > before && !cellClearOfBarriers(placed.x, placed.y, 0, barriers)) {
      cells.pop();
    }
  }

  if (cells.length > MAX_SWARM_CELLS_TRAIN) cells.length = MAX_SWARM_CELLS_TRAIN;
  return {
    id: "swarm",
    name: "Swarm",
    blurb: SWARM.blurb,
    maxEnergy: MAX_ENERGY,
    radius,
    cells,
    barriers,
  };
}

/** Client `randomDish`: procedural dish, authored fallback if a colour is missing. */
export function generateDish(id: DishId, rng: () => number = Math.random): DishTemplate {
  if (id === "swarm") return makeSwarm(rng);

  const base = DISHES[id];
  const players = factionCount(id);
  const radius = DISH_RADIUS;
  const ownedPer = id === "royale" ? 2 + Math.floor(rng() * 3) : 2 + Math.floor(rng() * 2);
  let neutrals =
    id === "royale" ? 6 + Math.floor(rng() * 7) : id === "culture" ? 5 + Math.floor(rng() * 5) : 4 + Math.floor(rng() * 5);
  const owned = players * ownedPer;
  if (owned + neutrals > MAX_CELLS) neutrals = Math.max(3, MAX_CELLS - owned);

  const cells: CellTemplate[] = [];
  const angle0 = rng() * Math.PI * 2;
  for (let p = 0; p < players; p++) {
    const owner = p + 1;
    const ang = angle0 + (p / players) * Math.PI * 2 + (rng() - 0.5) * 0.35;
    const homeR = 170 + rng() * 90;
    const hx = Math.cos(ang) * homeR;
    const hy = Math.sin(ang) * homeR;
    const coreE = 30 + rng() * 40;
    tryPlace(cells, hx, hy, owner, coreE, undefined, rng, radius, MIN_CELL_GAP);
    for (let s = 1; s < ownedPer; s++) {
      const a2 = ang + (rng() - 0.5) * 1.1;
      const r2 = 48 + rng() * 78;
      const satE = 10 + rng() * 24;
      tryPlace(cells, hx + Math.cos(a2) * r2, hy + Math.sin(a2) * r2, owner, satE, undefined, rng, radius, MIN_CELL_GAP);
    }
  }

  for (let n = 0; n < neutrals; n++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * radius * 0.72;
    const need = 6 + Math.floor(rng() * 11);
    if (!tryPlace(cells, Math.cos(a) * r, Math.sin(a) * r, 0, 0, need, rng, radius, MIN_CELL_GAP)) {
      tryPlace(cells, (rng() - 0.5) * 80, (rng() - 0.5) * 80, 0, 0, need, rng, radius, MIN_CELL_GAP);
    }
  }

  const owners = new Set(cells.filter((c) => c.owner !== 0).map((c) => c.owner));
  if (owners.size < players) return { ...base };

  return {
    id,
    name: base.name,
    blurb: base.blurb,
    maxEnergy: MAX_ENERGY,
    radius,
    cells,
  };
}
