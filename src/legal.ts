import { pathBlocked, reachOf, tentacleSlots } from "./maps.js";
import { MAX_ENERGY, type Barrier, type Cell, type Tentacle } from "./types.js";

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
  /** HG-2/4: a soft target existed, so fortified / graveyard sends were dropped. */
  droppedFortified: boolean;
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

/**
 * HG-3: T is spending on an attack pipe — growing, or latched/locked onto
 * a cell that is not the same owner (enemy or neutral). Ally-to-ally
 * latched/locked pipes are idle support, not spend.
 */
export function hasActiveOutboundSpend(
  cell: Cell,
  tentacles: Tentacle[],
  cells: Cell[] = [],
): boolean {
  if (hasGrowingOutbound(cell, tentacles)) return true;
  return tentacles.some((t) => {
    if (t.from !== cell.id || t.owner !== cell.owner) return false;
    if (t.state !== "latched" && t.state !== "locked") return false;
    const dest = cells[t.to];
    return !!dest && dest.owner !== cell.owner;
  });
}

/** Same-owner T at cap, not under attack, no active outbound spend (HG-3). */
export function isSaturatedSafeAlly(
  cell: Cell,
  tentacles: Tentacle[],
  maxEnergy = MAX_ENERGY,
  cells: Cell[] = [],
): boolean {
  if (cell.owner === 0) return false;
  if (cell.energy < maxEnergy) return false;
  if (hostileIncomingCount(cell, tentacles) > 0) return false;
  if (hasActiveOutboundSpend(cell, tentacles, cells)) return false;
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
    return !!dest && dest.owner === owner && isSaturatedSafeAlly(dest, tentacles, maxEnergy, cells);
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

/** Same-faction pipes touching `cell` (feeds or outbound). Neutral has none. */
export function factionSupportCount(cell: Cell, tentacles: Tentacle[]): number {
  if (cell.owner === 0) return 0;
  let n = 0;
  for (const t of tentacles) {
    if (t.owner !== cell.owner) continue;
    if (t.from === cell.id || t.to === cell.id) n++;
  }
  return n;
}

/** Enemy is winning a locked clash (their outbound lockT is at/past the midpoint). */
export function isStrongSideLock(cell: Cell, tentacles: Tentacle[]): boolean {
  for (const t of tentacles) {
    if (t.state !== "locked") continue;
    if (t.owner === cell.owner && t.from === cell.id && t.lockT >= 0.5) return true;
  }
  return false;
}

/** Distinct hostile colours with a pipe onto this cell. */
export function contestingFactions(cell: Cell, tentacles: Tentacle[]): number {
  const seen = new Set<number>();
  for (const t of tentacles) {
    if (t.to !== cell.id) continue;
    if (t.owner === 0 || t.owner === cell.owner) continue;
    seen.add(t.owner);
  }
  return seen.size;
}

/**
 * HG-4 graveyard: a neutral two or more colours are already paying rent on.
 * One lone pipe cannot flip it; enough committed pipes can.
 */
export function isContestedGraveyard(cell: Cell, tentacles: Tentacle[]): boolean {
  if (cell.owner !== 0) return false;
  return contestingFactions(cell, tentacles) >= 2 || hostileIncomingCount(cell, tentacles) >= 3;
}

/** Own pipes already on `cell`. */
export function ownPipesOn(cell: Cell, owner: number, tentacles: Tentacle[]): number {
  let n = 0;
  for (const t of tentacles) {
    if (t.to === cell.id && t.owner === owner) n++;
  }
  return n;
}

/**
 * Pipes needed to out-pump the current contest.
 * Two rival colours on a mid → 3 own pipes; three incoming → at least 3.
 */
export function contestNeed(cell: Cell, tentacles: Tentacle[]): number {
  const colours = contestingFactions(cell, tentacles);
  const incoming = hostileIncomingCount(cell, tentacles);
  if (colours >= 2) return colours + 1;
  if (incoming >= 3) return incoming;
  return 1;
}

/** Owned cells that can still grow a new pipe onto `dest`. */
export function spareCommitters(
  dest: Cell,
  owner: number,
  cells: Cell[],
  tentacles: Tentacle[],
): number {
  let n = 0;
  for (const from of cells) {
    if (from.owner !== owner || from.id === dest.id || from.energy < 4) continue;
    if (outgoingCount(from.id, tentacles) >= tentacleSlots(from.energy)) continue;
    if (alreadyAimed(from.id, dest.id, tentacles)) continue;
    const dist = Math.hypot(dest.x - from.x, dest.y - from.y);
    if (dist > reachOf(from.energy) * 1.06) continue;
    n++;
  }
  return n;
}

/**
 * Arithmetic, not a ban: a contested mid is worth taking only if this
 * faction can put `contestNeed` pipes on it (already on + still able to send).
 */
export function canAffordContest(
  dest: Cell,
  owner: number,
  cells: Cell[],
  tentacles: Tentacle[],
): boolean {
  if (!isContestedGraveyard(dest, tentacles)) return true;
  return ownPipesOn(dest, owner, tentacles) + spareCommitters(dest, owner, cells, tentacles) >=
    contestNeed(dest, tentacles);
}

export function outboundAttackCount(cell: Cell, tentacles: Tentacle[], cells: Cell[]): number {
  let n = 0;
  for (const t of tentacles) {
    if (t.from !== cell.id || t.owner !== cell.owner) continue;
    const dest = cells[t.to];
    if (dest && dest.owner !== cell.owner) n++;
  }
  return n;
}

export function inboundAllyCount(cell: Cell, tentacles: Tentacle[]): number {
  if (cell.owner === 0) return 0;
  let n = 0;
  for (const t of tentacles) {
    if (t.to === cell.id && t.owner === cell.owner) n++;
  }
  return n;
}

/**
 * HG-4 exposed: enemy spending 2+ attack pipes with no inbound ally feed.
 * A 200 cell with three tentacles and no support is a pickoff, not a fortress.
 */
export function isExposedEnemy(
  to: Cell,
  viewer: number,
  tentacles: Tentacle[],
  cells: Cell[],
): boolean {
  if (to.owner === 0 || to.owner === viewer) return false;
  if (isStrongSideLock(to, tentacles)) return false;
  if (inboundAllyCount(to, tentacles) > 0) return false;
  return outboundAttackCount(to, tentacles, cells) >= 2;
}

/**
 * HG-4 weaker: enemy clearly poorer than the source and not well supported.
 */
export function isWeakerPrey(
  to: Cell,
  from: Cell | undefined,
  viewer: number,
  tentacles: Tentacle[],
  maxEnergy = MAX_ENERGY,
): boolean {
  if (!from) return false;
  if (to.owner === 0 || to.owner === viewer) return false;
  if (factionSupportCount(to, tentacles) > 1) return false;
  if (isStrongSideLock(to, tentacles)) return false;
  const ratio = to.energy <= from.energy * 0.5;
  const abs = to.energy <= 80 && from.energy >= maxEnergy * 0.7;
  return ratio || abs;
}

/**
 * HG-2/4 soft target: open (uncontested) neutral, isolated weak enemy,
 * exposed overextended enemy, or energy-asymmetric enemy.
 * A contested graveyard is *not* soft.
 */
export function isEasyPrey(
  to: Cell,
  viewer: number,
  tentacles: Tentacle[],
  maxEnergy = MAX_ENERGY,
  cells: Cell[] = [],
  from?: Cell,
): boolean {
  if (to.owner === viewer) return false;
  if (to.owner === 0) return !isContestedGraveyard(to, tentacles);
  if (isExposedEnemy(to, viewer, tentacles, cells)) return true;
  if (isWeakerPrey(to, from, viewer, tentacles, maxEnergy)) return true;
  const low = to.energy <= 40 || to.energy <= 0.2 * maxEnergy;
  if (!low) return false;
  if (factionSupportCount(to, tentacles) > 1) return false;
  if (isStrongSideLock(to, tentacles)) return false;
  return true;
}

/** High-energy supported enemy that is not exposed or weaker than the source. */
export function isFortifiedEnemy(
  to: Cell,
  viewer: number,
  tentacles: Tentacle[],
  maxEnergy = MAX_ENERGY,
  cells: Cell[] = [],
  from?: Cell,
): boolean {
  if (to.owner === 0 || to.owner === viewer) return false;
  return !isEasyPrey(to, viewer, tentacles, maxEnergy, cells, from);
}

/**
 * Hard-ground legal set for one think tick.
 * HG-1a drops send-to-saturated-safe-ally.
 * HG-1b: if any dead support pipe exists, the set is only cuts on those pipes.
 * HG-2: if any soft-target sends exist, drop fortified *enemy* sends.
 *        Ally snowball (sub-200 / threatened / growing-out) stays legal.
 * HG-4: a contested mid is not soft prey unless this faction can commit
 *        contestNeed pipes (2 rival 200s → 3 own tentacles). Underfunded
 *        graveyard sends drop when a real pickoff exists; a funded pile
 *        stays legal. Exposed / weaker enemies are soft even at 200.
 * HG-3: saturated-safe requires no active outbound spend. Growing, or
 *        latched/locked onto enemy/neutral, lifts the ban so inbound feeds
 *        can hold the 200 cliff. Latched/locked onto an ally does not.
 */
export function legalThinkMoves(
  owner: number,
  cells: Cell[],
  tentacles: Tentacle[],
  maxEnergy = MAX_ENERGY,
  barriers: Barrier[] = [],
): LegalSet {
  const dead = deadSupportPipes(owner, cells, tentacles, maxEnergy);
  if (dead.length > 0) {
    return {
      forcedCuts: true,
      droppedFortified: false,
      sends: [],
      cuts: dead.map((t) => ({ kind: "cut", tentacleId: t.id })),
    };
  }

  let sends: LegalSend[] = [];
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
      if (barriers.length && pathBlocked(from.x, from.y, to.x, to.y, barriers)) continue;
      // HG-1a
      if (to.owner === owner && isSaturatedSafeAlly(to, tentacles, maxEnergy, cells)) continue;
      sends.push({ kind: "send", from: from.id, to: to.id });
    }
  }

  const hasEasyPrey = sends.some((s) => {
    const dest = cells[s.to];
    const src = cells[s.from];
    return dest && isEasyPrey(dest, owner, tentacles, maxEnergy, cells, src);
  });
  if (hasEasyPrey) {
    sends = sends.filter((s) => {
      const dest = cells[s.to];
      const src = cells[s.from];
      if (!dest) return false;
      if (isContestedGraveyard(dest, tentacles) && !canAffordContest(dest, owner, cells, tentacles)) {
        return false;
      }
      if (isFortifiedEnemy(dest, owner, tentacles, maxEnergy, cells, src)) return false;
      return true;
    });
  }

  for (const t of tentacles) {
    if (t.owner !== owner) continue;
    if (!cells[t.from] || !cells[t.to]) continue;
    cuts.push({ kind: "cut", tentacleId: t.id });
  }

  return { forcedCuts: false, droppedFortified: hasEasyPrey, sends, cuts };
}
