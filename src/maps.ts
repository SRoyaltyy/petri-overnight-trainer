import type { CellTemplate, DishId, DishTemplate } from "./types.js";

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

export const DISHES: Record<DishId, DishTemplate> = {
  slide: SLIDE,
  culture: CULTURE,
  royale: ROYALE,
};

export function factionCount(dish: DishId): number {
  return dish === "slide" ? 2 : dish === "culture" ? 3 : 4;
}

const DISH_BOUND = 302.4;

function clampToDish(x: number, y: number): { x: number; y: number } {
  const n = Math.hypot(x, y);
  if (n <= DISH_BOUND || n < 1e-6) return { x, y };
  const s = DISH_BOUND / n;
  return { x: x * s, y: y * s };
}

function roomFor(cells: CellTemplate[], x: number, y: number, energy: number): boolean {
  const r = cellRadius(energy);
  for (const c of cells) {
    const need = 70 + (r + cellRadius(c.energy)) * 0.22;
    if (Math.hypot(c.x - x, c.y - y) < need) return false;
  }
  return true;
}

function tryPlace(
  cells: CellTemplate[],
  x: number,
  y: number,
  owner: number,
  energy: number,
  captureNeed: number | undefined,
  rng: () => number,
): boolean {
  for (let s = 0; s < 36; s++) {
    const dist = s === 0 ? 0 : 18 + rng() * 90;
    const ang = rng() * Math.PI * 2;
    const p = clampToDish(x + Math.cos(ang) * dist, y + Math.sin(ang) * dist);
    if (!roomFor(cells, p.x, p.y, energy)) continue;
    const cell: CellTemplate = { x: p.x, y: p.y, owner, energy };
    if (captureNeed != null) cell.captureNeed = captureNeed;
    cells.push(cell);
    return true;
  }
  return false;
}

/** Client `un`: procedural dish, fallback to the authored layout if a colour is missing. */
export function generateDish(id: DishId, rng: () => number = Math.random): DishTemplate {
  const authored = DISHES[id];
  const factions = factionCount(id);
  const extrasPer = id === "royale" ? 2 + Math.floor(rng() * 3) : 2 + Math.floor(rng() * 2);
  let neutrals =
    id === "royale" ? 6 + Math.floor(rng() * 7) : id === "culture" ? 5 + Math.floor(rng() * 5) : 4 + Math.floor(rng() * 5);
  let owned = factions * extrasPer;
  if (owned + neutrals > 24) neutrals = Math.max(3, 24 - owned);

  const cells: CellTemplate[] = [];
  const spin = rng() * Math.PI * 2;
  for (let f = 0; f < factions; f++) {
    const owner = f + 1;
    const ang = spin + (f / factions) * Math.PI * 2 + (rng() - 0.5) * 0.35;
    const dist = 170 + rng() * 90;
    const x = Math.cos(ang) * dist;
    const y = Math.sin(ang) * dist;
    tryPlace(cells, x, y, owner, 30 + rng() * 40, undefined, rng);
    for (let k = 1; k < extrasPer; k++) {
      const a = ang + (rng() - 0.5) * 1.1;
      const r = 48 + rng() * 78;
      tryPlace(cells, x + Math.cos(a) * r, y + Math.sin(a) * r, owner, 10 + rng() * 24, undefined, rng);
    }
  }
  for (let i = 0; i < neutrals; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * 360 * 0.72;
    const need = 6 + Math.floor(rng() * 11);
    tryPlace(cells, Math.cos(a) * r, Math.sin(a) * r, 0, 0, need, rng) ||
      tryPlace(cells, (rng() - 0.5) * 80, (rng() - 0.5) * 80, 0, 0, need, rng);
  }
  const present = new Set(cells.filter((c) => c.owner !== 0).map((c) => c.owner));
  if (present.size < factions) return authored;
  return { id, name: authored.name, blurb: authored.blurb, maxEnergy: 200, cells };
}
