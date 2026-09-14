import {
  GEO_CLEARANCE,
  boundsOf,
  coastBarriers,
  homesFor,
  onLand,
  project,
  projectLand,
  regionOf,
  type GeoRegion,
  type Pt,
} from "./geo.js";
import {
  MAX_ENERGY,
  TRAIN_SWARM_FACTIONS,
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

const META: Record<DishId, { name: string; blurb: string }> = {
  slide: { name: "Europe", blurb: "Two colours. Gibraltar is the gate." },
  culture: { name: "Asia", blurb: "Three colours. Hormuz and Malacca bottleneck." },
  royale: { name: "Americas", blurb: "Four colours. Panama is a land pinch." },
  swarm: { name: "World", blurb: "Compact eight-colour world. Oceans block. Straits are the shot." },
};

function metaDish(id: DishId): DishTemplate {
  return {
    id,
    name: META[id].name,
    blurb: META[id].blurb,
    maxEnergy: MAX_ENERGY,
    cells: [],
    barriers: [],
  };
}

export const SLIDE: DishTemplate = metaDish("slide");
export const CULTURE: DishTemplate = metaDish("culture");
export const ROYALE: DishTemplate = metaDish("royale");
export const SWARM: DishTemplate = metaDish("swarm");

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
  const land = projectLand(regionOf(id));
  const b = boundsOf(land);
  return Math.max(b.w, b.h) / 2;
}

function fits(cells: CellTemplate[], x: number, y: number, energy: number, gap: number): boolean {
  const r = cellRadius(energy);
  for (const c of cells) {
    const need = gap + (r + cellRadius(c.energy)) * 0.22;
    if (Math.hypot(c.x - x, c.y - y) < need) return false;
  }
  return true;
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
  const minAx = ax < bx ? ax : bx;
  const maxAx = ax < bx ? bx : ax;
  const minAy = ay < by ? ay : by;
  const maxAy = ay < by ? by : ay;
  for (const w of barriers) {
    const minWx = w.x1 < w.x2 ? w.x1 : w.x2;
    const maxWx = w.x1 < w.x2 ? w.x2 : w.x1;
    const minWy = w.y1 < w.y2 ? w.y1 : w.y2;
    const maxWy = w.y1 < w.y2 ? w.y2 : w.y1;
    if (maxAx < minWx || minAx > maxWx || maxAy < minWy || minAy > maxWy) continue;
    const den = (ax - bx) * (w.y1 - w.y2) - (ay - by) * (w.x1 - w.x2);
    if (Math.abs(den) < 1e-8) continue;
    const t = ((ax - w.x1) * (w.y1 - w.y2) - (ay - w.y1) * (w.x1 - w.x2)) / den;
    const u = ((ax - w.x1) * (ay - by) - (ay - w.y1) * (ax - bx)) / den;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return true;
  }
  return false;
}

function cellClearOfBarriers(x: number, y: number, energy: number, walls: Barrier[], clearance = GEO_CLEARANCE): boolean {
  const need = cellRadius(energy) + clearance;
  for (const w of walls) {
    const minWx = w.x1 < w.x2 ? w.x1 : w.x2;
    const maxWx = w.x1 < w.x2 ? w.x2 : w.x1;
    const minWy = w.y1 < w.y2 ? w.y1 : w.y2;
    const maxWy = w.y1 < w.y2 ? w.y2 : w.y1;
    if (x + need < minWx || x - need > maxWx || y + need < minWy || y - need > maxWy) continue;
    if (closestSegDist(x, y, w) < need) return false;
  }
  return true;
}

function nudgeLand(x: number, y: number, land: Pt[][]): { x: number; y: number } | null {
  if (onLand(x, y, land)) return { x, y };
  for (let r = 10; r <= 90; r += 10) {
    const steps = 10;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (onLand(px, py, land)) return { x: px, y: py };
    }
  }
  return null;
}

function tryPlace(
  cells: CellTemplate[],
  x0: number,
  y0: number,
  owner: number,
  energy: number,
  captureNeed: number | undefined,
  rng: () => number,
  land: Pt[][],
  walls: Barrier[],
  gap: number,
  attempts = 36,
  clearance = GEO_CLEARANCE,
  force = false,
): boolean {
  let fallback: { x: number; y: number } | null = null;
  for (let k = 0; k < attempts; k++) {
    const jitter = k === 0 ? 0 : 8 + rng() * 56;
    const a = rng() * Math.PI * 2;
    const nudged = nudgeLand(x0 + Math.cos(a) * jitter, y0 + Math.sin(a) * jitter, land);
    if (!nudged) continue;
    const { x, y } = nudged;
    if (!onLand(x, y, land)) continue;
    if (!fits(cells, x, y, energy, gap)) continue;
    if (!fallback) fallback = { x, y };
    if (clearance > 0 && !cellClearOfBarriers(x, y, energy, walls, clearance)) continue;
    const cell: CellTemplate = { x, y, owner, energy };
    if (captureNeed != null) cell.captureNeed = captureNeed;
    cells.push(cell);
    return true;
  }
  if (force && fallback) {
    const cell: CellTemplate = { x: fallback.x, y: fallback.y, owner, energy };
    if (captureNeed != null) cell.captureNeed = captureNeed;
    cells.push(cell);
    return true;
  }
  return false;
}

function randomLand(rng: () => number, land: Pt[][], bounds: { minX: number; minY: number; w: number; h: number }): Pt | null {
  const pad = 24;
  for (let i = 0; i < 48; i++) {
    const x = bounds.minX + pad + rng() * Math.max(8, bounds.w - pad * 2);
    const y = bounds.minY + pad + rng() * Math.max(8, bounds.h - pad * 2);
    if (onLand(x, y, land)) return { x, y };
  }
  return null;
}

function buildGeo(id: DishId, rng: () => number, players = factionCount(id)): DishTemplate {
  const region: GeoRegion = regionOf(id);
  const land = projectLand(region);
  const bounds = boundsOf(land);
  const walls = coastBarriers(region);
  const cells: CellTemplate[] = [];
  const swarm = id === "swarm";
  const gap = swarm ? SWARM_CELL_GAP : MIN_CELL_GAP;
  const homes = homesFor(region, players);
  const ownedPer = swarm ? 2 : id === "royale" ? 2 + Math.floor(rng() * 2) : 2;
  let neutrals = swarm
    ? 18 + Math.floor(rng() * 12)
    : id === "royale"
      ? 6 + Math.floor(rng() * 5)
      : id === "culture"
        ? 5 + Math.floor(rng() * 4)
        : 4 + Math.floor(rng() * 4);

  for (let p = 0; p < players; p++) {
    const owner = p + 1;
    const seed = homes[p] ?? homes[p % homes.length];
    const home = project(seed[0], seed[1], region);
    const coreE = swarm ? 28 + rng() * 28 : 30 + rng() * 40;
    if (!tryPlace(cells, home.x, home.y, owner, coreE, undefined, rng, land, walls, Math.min(gap, 32), 80, 4, true)) {
      const nudged = nudgeLand(home.x, home.y, land) ?? home;
      cells.push({ x: nudged.x, y: nudged.y, owner, energy: coreE });
    }
    for (let s = 1; s < ownedPer; s++) {
      const a2 = rng() * Math.PI * 2;
      const r2 = 36 + rng() * 64;
      const satE = swarm ? 10 + rng() * 16 : 10 + rng() * 24;
      tryPlace(cells, home.x + Math.cos(a2) * r2, home.y + Math.sin(a2) * r2, owner, satE, undefined, rng, land, walls, gap, 64, 8, false);
    }
  }

  const cap = swarm ? MAX_SWARM_CELLS_TRAIN : MAX_CELLS;
  const owned = cells.length;
  if (owned + neutrals > cap) neutrals = Math.max(3, cap - owned);

  let guard = 0;
  while (cells.filter((c) => c.owner === 0).length < neutrals && guard++ < 1600) {
    const p = randomLand(rng, land, bounds);
    if (!p) continue;
    const need = 6 + Math.floor(rng() * 10);
    if (!cellClearOfBarriers(p.x, p.y, 0, walls, 8)) continue;
    tryPlace(cells, p.x, p.y, 0, 0, need, rng, land, walls, gap, 20, 8, false);
  }

  if (cells.length > cap) cells.length = cap;
  const radius = Math.max(bounds.w, bounds.h) / 2;
  return {
    id,
    name: META[id].name,
    blurb: META[id].blurb,
    maxEnergy: MAX_ENERGY,
    radius,
    cells,
    barriers: walls,
  };
}

export function generateDish(id: DishId, rng: () => number = Math.random): DishTemplate {
  return buildGeo(id, rng, factionCount(id));
}
