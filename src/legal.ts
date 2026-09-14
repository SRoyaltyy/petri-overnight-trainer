import { reachOf, tentacleSlots } from "./maps.js";
import { MAX_ENERGY, type Cell, type Tentacle } from "./types.js";

export interface LegalSend {
  kind: "send";
  from: number;
  to: number;
}

export interface LegalCut {
  kind: "cut";
  tentacleId: number;
}

export type LegalAction = LegalSend | LegalCut;

export interface LegalSet {
  /** HG-1b: this tick is cut-only on dead support pipes. */
  forcedCuts: boolean;
  sends: LegalSend[];
  cuts: LegalCut[];
}

export function hostileIncomingCount(cell: Cell, tentacles: Tentacle[]): number {
  let n = 0;
  for (const t of tentacles) {
    if (t.to === cell.id && t.owner !== 0 && t.owner !== cell.owner) n++;
  }
  return n;
}

export function hasGrowingOutbound(cell: Cell, tentacles: Tentacle[]): boolean {
  return tentacles.some((t) => t.from === cell.id && t.owner === cell.owner && t.state === "growing");
}

/** Same-owner T at cap, not under attack, not growing an outbound pipe. */
export function isSaturatedSafeAlly(
  cell: Cell,
  tentacles: Tentacle[],
  maxEnergy = MAX_ENERGY,
): boolean {
  if (cell.owner === 0) return false;
  if (cell.energy < maxEnergy) return false;
  if (hostileIncomingCount(cell, tentacles) > 0) return false;
  if (hasGrowingOutbound(cell, tentacles)) return false;
  return true;
}

export function deadSupportPipes(
  owner: number,
  cells: Cell[],
  tentacles: Tentacle[],
  maxEnergy = MAX_ENERGY,
): Tentacle[] {
  return tentacles.filter((t) => {
    if (t.owner !== owner) return false;
    const dest = cells[t.to];
    return !!dest && dest.owner === owner && isSaturatedSafeAlly(dest, tentacles, maxEnergy);
  });
}

function outgoingCount(fromId: number, tentacles: Tentacle[]): number {
  let n = 0;
  for (const t of tentacles) if (t.from === fromId) n++;
  return n;
}

function alreadyAimed(fromId: number, toId: number, tentacles: Tentacle[]): boolean {
  return tentacles.some((t) => t.from === fromId && t.to === toId);
}

/**
 * Hard-ground legal set for one think tick.
 * HG-1a drops send-to-saturated-safe-ally.
 * HG-1b: if any dead support pipe exists, the set is only cuts on those pipes.
 */
export function legalThinkMoves(
  owner: number,
  cells: Cell[],
  tentacles: Tentacle[],
  maxEnergy = MAX_ENERGY,
): LegalSet {
  const dead = deadSupportPipes(owner, cells, tentacles, maxEnergy);
  if (dead.length > 0) {
    return {
      forcedCuts: true,
      sends: [],
      cuts: dead.map((t) => ({ kind: "cut", tentacleId: t.id })),
    };
  }

  const sends: LegalSend[] = [];
  const cuts: LegalCut[] = [];

  for (const from of cells) {
    if (from.owner !== owner || from.energy < 4) continue;
    if (outgoingCount(from.id, tentacles) >= tentacleSlots(from.energy)) continue;
    const reach = reachOf(from.energy) * 1.06;
    for (const to of cells) {
      if (to.id === from.id) continue;
      if (alreadyAimed(from.id, to.id, tentacles)) continue;
      const dist = Math.hypot(to.x - from.x, to.y - from.y);
      if (dist > reach) continue;
      // HG-1a
      if (to.owner === owner && isSaturatedSafeAlly(to, tentacles, maxEnergy)) continue;
      sends.push({ kind: "send", from: from.id, to: to.id });
    }
  }

  for (const t of tentacles) {
    if (t.owner !== owner) continue;
    if (!cells[t.from] || !cells[t.to]) continue;
    cuts.push({ kind: "cut", tentacleId: t.id });
  }

  return { forcedCuts: false, sends, cuts };
}
