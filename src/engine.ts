import { writeCutFeatures, writeSendFeatures } from "./features.js";
import { legalThinkMoves, type LegalSet } from "./legal.js";
import {
  cellRadius,
  factionCount,
  generateDish,
  growSpeed,
  packetSpeed,
  pumpRate,
  reachOf,
  regenRate,
  tentacleSlots,
} from "./maps.js";
import {
  DT,
  EMPTY_EVENTS,
  MAX_ENERGY,
  type Cell,
  type Difficulty,
  type DishId,
  type EngineEvents,
  type EngineMode,
  type MacroFeat,
  type Net,
  type PowerTables,
  type Tentacle,
} from "./types.js";
import { clamp, scoreCut, scoreSend } from "./weights.js";

const PUSH_PRESSURE = 0.02;
const PUSH_MASS = 0.48;
const LOCK_MAX = 0.97;
const LOCK_MIN = 0.03;
const CUT_TS = [0.22, 0.5, 0.78, 0.92];

function hypot(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

export class Engine {
  cells: Cell[] = [];
  tentacles: Tentacle[] = [];
  mode: EngineMode;
  difficulty: Difficulty;
  dishId: DishId;
  maxEnergy = MAX_ENERGY;
  player: number;
  time = 0;
  ended = false;
  winner: number | null = null;
  lost = false;
  silent: boolean;
  brains: Array<Net | null> = [null, null, null, null, null];
  thinkAcc = [0, 0, 0, 0, 0];
  sendCount = [0, 0, 0, 0, 0];
  captureCount = [0, 0, 0, 0, 0];
  cutCount = [0, 0, 0, 0, 0];
  drainCount = [0, 0, 0, 0, 0];
  events: EngineEvents;
  feat = new Float32Array(32);
  incoming = new Int16Array(24);
  outgoing = new Int16Array(24);
  aimed = new Int16Array(24);
  started = new Set<number>();
  nextTentacleId = 1;

  constructor(
    dishId: DishId,
    difficulty: Difficulty,
    mode: EngineMode,
    events: EngineEvents = EMPTY_EVENTS,
    _reducedMotion = true,
    silent = true,
  ) {
    this.dishId = dishId;
    this.difficulty = difficulty;
    this.mode = mode;
    this.events = events;
    this.silent = silent;
    this.player = +(mode === "play");
    const dish = generateDish(dishId);
    this.cells = dish.cells.map((c, id) => ({
      id,
      x: c.x,
      y: c.y,
      energy: c.energy,
      owner: c.owner,
      captureNeed: c.captureNeed ?? 10,
      occupancy: [0, 0, 0, 0, 0],
      radius: cellRadius(c.energy),
    }));
    this.started = new Set(this.cells.map((c) => c.owner));
    this.incoming = new Int16Array(this.cells.length);
    this.outgoing = new Int16Array(this.cells.length);
    this.aimed = new Int16Array(this.cells.length);
    this.thinkAcc = this.thinkAcc.map((_, i) => -i * 0.27);
  }

  factionCount(): number {
    return factionCount(this.dishId);
  }

  advance(steps: number, until = Infinity): void {
    let n = 0;
    while (!this.ended && n < steps && this.time < until) {
      this.step(DT);
      n++;
    }
  }

  step(dt: number): void {
    this.time += dt;
    for (const cell of this.cells) {
      cell.radius = cellRadius(cell.energy);
      if (cell.owner === 0 || this.ended) continue;
      if (cell.energy < this.maxEnergy) {
        cell.energy = Math.min(this.maxEnergy, cell.energy + regenRate(cell.energy) * dt);
      }
    }
    if (!this.ended) {
      this.stepTentacles(dt);
      this.stepAI(dt);
      this.checkEnd();
    }
  }

  tentacleMass(t: Tentacle): number {
    return t.charge + t.packets.reduce((s, p) => s + p.energy, 0);
  }

  stepTentacles(dt: number): void {
    const fail: Tentacle[] = [];
    for (const t of this.tentacles) {
      const from = this.cells[t.from];
      const to = this.cells[t.to];
      if (!from || !to || from.owner !== t.owner) {
        fail.push(t);
        continue;
      }
      const dist = hypot(from.x, from.y, to.x, to.y);
      const gap = Math.max(8, dist - from.radius - to.radius);
      const reach = reachOf(from.energy + t.charge);
      if (t.state === "growing") {
        const target = Math.min(1, reach / gap);
        const remain = target - t.progress;
        if (remain > 1e-4) {
          const rate = growSpeed(from.energy) / gap;
          const step = Math.min(remain, rate * dt);
          const cost = (step * gap) / 14;
          if (from.energy > 1 && cost > 0) {
            const take = Math.min(from.energy - 1, cost);
            if (take > 0) {
              const actual = (take / cost) * step;
              from.energy -= take;
              t.charge += take;
              t.progress += actual;
            }
          }
        }
        if (t.progress >= 0.995 && reach >= gap) {
          t.progress = 1;
          t.state = "latched";
          t.stall = 0;
        } else if (reach < gap) {
          const stuck = dist <= 0.002 || t.progress >= target - 0.002;
          const starved = from.energy <= 1.05;
          if (stuck || starved) {
            const opp = this.findOpposite(t);
            if (opp && t.progress + opp.progress >= 0.99) t.stall = 0;
            else {
              t.stall += dt;
              if (t.stall >= 0.55) fail.push(t);
            }
          }
        } else {
          t.stall = 0;
        }
      }
      if (t.state === "latched" || t.state === "locked") {
        const rate = pumpRate(from.energy) * (t.state === "locked" ? 0.95 : 1);
        t.pumpAcc += rate * dt;
        const spd = packetSpeed(from.energy);
        while (t.pumpAcc >= 1) {
          t.pumpAcc -= 1;
          t.packets.push({ t: 0.02, energy: 1, speed: spd });
        }
      }
      const cap = t.state === "locked" ? t.lockT : 1;
      for (let i = t.packets.length - 1; i >= 0; i--) {
        const p = t.packets[i];
        p.t += p.speed * dt;
        if (p.t >= cap) {
          t.packets.splice(i, 1);
          if (t.state === "locked") t.pressure += p.energy;
          else this.deliver(to, t.owner, p.energy, from);
        }
      }
    }
    for (const t of fail) this.failTentacle(t);
    this.updateLocks(dt);
  }

  findOpposite(t: Tentacle): Tentacle | undefined {
    return this.tentacles.find((o) => o.from === t.to && o.to === t.from && o.owner !== t.owner);
  }

  updateLocks(dt: number): void {
    const seen = new Set<number>();
    for (const t of [...this.tentacles]) {
      if (seen.has(t.id)) continue;
      const opp = this.findOpposite(t);
      if (!opp) {
        if (t.state === "locked") {
          t.state = t.progress >= 0.995 ? "latched" : "growing";
          t.lockMate = 0;
          t.lockT = 1;
        }
        continue;
      }
      seen.add(t.id);
      seen.add(opp.id);
      if (t.progress + opp.progress < 0.995) {
        if (t.state === "locked") {
          t.state = t.progress >= 0.995 ? "latched" : "growing";
          t.lockMate = 0;
        }
        if (opp.state === "locked") {
          opp.state = opp.progress >= 0.995 ? "latched" : "growing";
          opp.lockMate = 0;
        }
        t.pressure = 0;
        opp.pressure = 0;
        continue;
      }
      const fresh = t.state !== "locked" || opp.state !== "locked";
      if (fresh) {
        const lock = clamp((t.progress + 1 - opp.progress) / 2, LOCK_MIN, LOCK_MAX);
        t.lockT = lock;
        opp.lockT = 1 - lock;
        t.progress = t.lockT;
        opp.progress = opp.lockT;
        this.slamPackets(t);
        this.slamPackets(opp);
      }
      t.state = "locked";
      opp.state = "locked";
      t.lockMate = opp.id;
      opp.lockMate = t.id;
      this.applyPush(t, opp, dt);
    }
  }

  slamPackets(t: Tentacle): void {
    for (let i = t.packets.length - 1; i >= 0; i--) {
      if (t.packets[i].t >= t.lockT) {
        t.pressure += t.packets[i].energy;
        t.packets.splice(i, 1);
      }
    }
  }

  applyPush(a: Tentacle, b: Tentacle, dt: number): void {
    const ca = this.cells[a.from];
    const cb = this.cells[b.from];
    if (!ca || !cb) {
      a.pressure = 0;
      b.pressure = 0;
      return;
    }
    const mass = ca.energy + cb.energy + 10;
    const bias = (ca.energy + 5) / mass - 0.5;
    const press = (a.pressure - b.pressure) * PUSH_PRESSURE;
    const delta = bias * 2 * PUSH_MASS * dt + press;
    a.lockT = clamp(a.lockT + delta, LOCK_MIN, LOCK_MAX);
    b.lockT = 1 - a.lockT;
    a.progress = a.lockT;
    b.progress = b.lockT;
    a.pressure = 0;
    b.pressure = 0;
    if (a.lockT >= 0.97) this.breakLock(a, b);
    else if (a.lockT <= 0.03) this.breakLock(b, a);
  }

  breakLock(winner: Tentacle, loser: Tentacle): void {
    this.removeTentacle(loser, true);
    winner.state = "latched";
    winner.lockMate = 0;
    winner.lockT = 1;
    winner.progress = 1;
    winner.pressure = 0;
  }

  deliver(cell: Cell, owner: number, amount: number, from: Cell): void {
    if (amount <= 0) return;
    if (cell.owner === 0) {
      cell.occupancy[owner] += amount;
      if (cell.occupancy[owner] >= cell.captureNeed) this.convert(cell, owner, 10);
      return;
    }
    if (cell.owner === owner) {
      cell.energy = Math.min(this.maxEnergy, cell.energy + amount);
      return;
    }
    cell.energy -= amount;
    this.drainCount[owner] += amount;
    if (cell.energy <= 0) {
      const leftover = -cell.energy;
      this.convert(cell, owner, 10 + leftover);
    }
    void from;
  }

  convert(cell: Cell, owner: number, seed: number): void {
    const outgoing = this.tentacles.filter((t) => t.from === cell.id);
    let mass = 0;
    for (const t of outgoing) {
      mass += this.tentacleMass(t);
      this.unlockMate(t);
      const idx = this.tentacles.indexOf(t);
      if (idx >= 0) this.tentacles.splice(idx, 1);
    }
    const prev = cell.owner;
    cell.owner = owner;
    cell.energy = Math.min(this.maxEnergy, Math.max(6, seed) + mass);
    cell.occupancy = [0, 0, 0, 0, 0];
    this.captureCount[owner]++;
    this.events.onCapture(cell, owner, prev);
  }

  unlockMate(t: Tentacle): void {
    if (!t.lockMate) return;
    const mate = this.tentacles.find((o) => o.id === t.lockMate);
    if (!mate) return;
    mate.lockMate = 0;
    mate.progress = clamp(mate.lockT, 0.04, 1);
    mate.state = mate.progress >= 0.995 ? "latched" : "growing";
    mate.lockT = 1;
    mate.pressure = 0;
  }

  removeTentacle(t: Tentacle, refund: boolean): void {
    const idx = this.tentacles.indexOf(t);
    if (idx >= 0) this.tentacles.splice(idx, 1);
    this.unlockMate(t);
    if (!refund) return;
    const from = this.cells[t.from];
    const mass = this.tentacleMass(t);
    if (from && from.owner === t.owner && mass > 0) {
      from.energy = Math.min(this.maxEnergy, from.energy + mass);
    }
  }

  failTentacle(t: Tentacle): void {
    const from = this.cells[t.from];
    const mass = this.tentacleMass(t);
    const idx = this.tentacles.indexOf(t);
    if (idx >= 0) this.tentacles.splice(idx, 1);
    this.unlockMate(t);
    if (from && mass > 0) from.energy = Math.min(this.maxEnergy, from.energy + mass);
  }

  send(fromId: number, toId: number): boolean {
    if (fromId === toId) return false;
    const from = this.cells[fromId];
    const to = this.cells[toId];
    if (!from || !to || from.owner === 0 || from.energy < 4) return false;
    const mine = this.tentacles.filter((t) => t.from === fromId);
    if (mine.length >= tentacleSlots(from.energy) || mine.some((t) => t.to === toId)) return false;
    this.tentacles.push({
      id: this.nextTentacleId++,
      from: fromId,
      to: toId,
      owner: from.owner,
      progress: 0.04,
      charge: 0,
      state: "growing",
      lockT: 1,
      lockMate: 0,
      packets: [],
      pumpAcc: 0,
      stall: 0,
      pressure: 0,
      clashGlow: 0,
      wave: Math.random() * Math.PI * 2,
      seed: Math.random() * 1000,
    });
    this.sendCount[from.owner]++;
    if (from.owner === this.player) this.events.onSend();
    return true;
  }

  splitCut(t: Tentacle, cutT: number): { hostAmt: number; burrowAmt: number; locked: boolean } {
    const locked = t.state === "locked";
    const u = clamp(cutT, 0, 1);
    const span = Math.max(0.001, locked ? t.lockT : t.progress);
    let host = locked ? t.charge : t.charge * u;
    let burrow = locked ? 0 : t.charge * (1 - u);
    for (const p of t.packets) {
      if (locked || p.t <= u * span) host += p.energy;
      else burrow += p.energy;
    }
    return { hostAmt: host, burrowAmt: burrow, locked };
  }

  cutTentacle(t: Tentacle, cutT: number): void {
    const from = this.cells[t.from];
    const to = this.cells[t.to];
    if (!from) return;
    const { hostAmt, burrowAmt, locked } = this.splitCut(t, cutT);
    from.energy = Math.min(this.maxEnergy, from.energy + hostAmt);
    if (burrowAmt > 0 && to) this.deliver(to, t.owner, burrowAmt, from);
    const idx = this.tentacles.indexOf(t);
    if (idx >= 0) this.tentacles.splice(idx, 1);
    this.unlockMate(t);
    this.cutCount[t.owner]++;
    this.events.onCut(locked);
  }

  stepAI(dt: number): void {
    const hasBrains = this.brains.some((b, i) => i > 0 && b);
    const interval = hasBrains
      ? this.difficulty === "predatory"
        ? 0.2
        : this.difficulty === "calm"
          ? 0.48
          : 0.28
      : this.difficulty === "calm"
        ? 1.35
        : this.difficulty === "live"
          ? 0.82
          : 0.46;
    const pace = this.mode === "attract" || this.mode === "spectate" ? 0.85 : 1;
    for (let owner = 1; owner <= 4; owner++) {
      if (this.mode === "play" && owner === this.player) continue;
      if (!this.cells.some((c) => c.owner === owner)) continue;
      this.thinkAcc[owner] += dt * pace;
      const wobble = hasBrains ? 0 : 0.12 * Math.sin(this.time + owner * 2);
      if (this.thinkAcc[owner] < interval + wobble) continue;
      this.thinkAcc[owner] = 0;
      this.think(owner);
    }
  }

  powerTables(): PowerTables {
    const energy = [0, 0, 0, 0, 0];
    const cellsN = [0, 0, 0, 0, 0];
    const flow = new Array(25).fill(0);
    for (const c of this.cells) {
      if (c.owner !== 0) {
        energy[c.owner] += c.energy;
        cellsN[c.owner]++;
      }
    }
    for (const t of this.tentacles) {
      const mass = this.tentacleMass(t);
      energy[t.owner] += mass;
      const to = this.cells[t.to];
      if (to && to.owner !== t.owner && t.owner !== 0 && to.owner !== 0) {
        flow[t.owner * 5 + to.owner] += mass;
      }
    }
    let total = 0;
    let leader = 1;
    let best = -1;
    for (let i = 1; i <= 4; i++) {
      total += energy[i];
      if (energy[i] > best) {
        best = energy[i];
        leader = i;
      }
    }
    return { energy, cellsN, total: Math.max(1, total), leader, flow };
  }

  macroFor(owner: number, targetOwner: number, dump: number, pow: PowerTables): MacroFeat {
    const mine = Math.max(1, pow.energy[owner]);
    const leadE = pow.energy[pow.leader];
    const tgtE = pow.energy[targetOwner] ?? 0;
    let side = 0;
    let onMe = 0;
    let all = 0;
    for (let a = 1; a <= 4; a++) {
      for (let b = 1; b <= 4; b++) {
        if (a === b) continue;
        const f = pow.flow[a * 5 + b];
        all += f;
        if (b === owner) onMe += f;
        if (a !== owner && b !== owner) side += f;
      }
    }
    const dominance = leadE / pow.total;
    const targetShare = tgtE / pow.total;
    const targetIsLeader = +(targetOwner === pow.leader && targetOwner !== 0 && targetOwner !== owner);
    const buffer =
      targetOwner !== 0 && targetOwner !== owner && targetOwner !== pow.leader && dominance > 0.38
        ? dominance * (1 - targetShare)
        : 0;
    let alive = 0;
    for (let i = 1; i <= 4; i++) if (pow.energy[i] > 0) alive++;
    return {
      dominance,
      leaderDelta: leadE / mine,
      myShare: mine / pow.total,
      rivalFriction: all > 0 ? side / all : 0,
      pressureOnMe: Math.min(1, onMe / (mine + 8)),
      alive,
      targetIsLeader,
      buffer,
      dump,
    };
  }

  distalFraction(t: Tentacle, cutT: number): number {
    const { hostAmt, burrowAmt } = this.splitCut(t, cutT);
    const sum = hostAmt + burrowAmt;
    return sum < 0.4 ? 0 : burrowAmt / sum;
  }

  /** Hard-ground legal set (HG-1a / HG-1b) for one think tick. */
  legalMoves(owner: number): LegalSet {
    return legalThinkMoves(owner, this.cells, this.tentacles, this.maxEnergy);
  }

  thinkNet(owner: number, net: Net): void {
    const n = this.cells.length;
    this.incoming.fill(0);
    this.outgoing.fill(0);
    this.aimed.fill(0);
    let myEnergy = 0;
    let myCells = 0;
    for (const t of this.tentacles) {
      if (t.from < n) this.outgoing[t.from]++;
      if (t.to < n && t.owner !== owner && t.owner !== 0) this.incoming[t.to]++;
      if (t.to < n && t.owner === owner) this.aimed[t.to]++;
    }
    for (const c of this.cells) {
      if (c.owner === owner) {
        myEnergy += c.energy;
        myCells++;
      }
    }
    const legal = this.legalMoves(owner);
    const legalSend = new Set(legal.sends.map((s) => `${s.from}->${s.to}`));
    const legalCut = new Set(legal.cuts.map((c) => c.tentacleId));
    const pow = this.powerTables();
    const noisy = this.silent ? Math.random() > 0.72 : this.difficulty === "calm";
    const noise = this.silent
      ? noisy
        ? 0.42
        : 0.08
      : this.difficulty === "calm"
        ? 0.22
        : this.difficulty === "live"
          ? 0.07
          : 0.03;
    type Cand =
      | { kind: "send"; score: number; from: number; to: number }
      | { kind: "cut"; score: number; tent: Tentacle; cutT: number };
    const cands: Cand[] = [];
    for (const from of this.cells) {
      if (from.owner !== owner || from.energy < 4 || this.outgoing[from.id] >= tentacleSlots(from.energy)) continue;
      const reach = reachOf(from.energy) * 1.06;
      let nearby = 0;
      for (const other of this.cells) {
        if (other.id === from.id || other.owner === owner || other.owner === 0) continue;
        if (hypot(from.x, from.y, other.x, other.y) <= reach) nearby++;
      }
      for (const to of this.cells) {
        if (to.id === from.id) continue;
        if (this.tentacles.some((t) => t.from === from.id && t.to === to.id)) continue;
        const dist = hypot(from.x, from.y, to.x, to.y);
        if (dist > reach) continue;
        if (!legalSend.has(`${from.id}->${to.id}`)) continue;
        const macro = this.macroFor(owner, to.owner, Math.min(1, this.aimed[to.id] / 3), pow);
        writeSendFeatures(
          this.feat,
          from.energy,
          to.energy,
          dist,
          owner,
          to.owner,
          this.outgoing[from.id],
          this.incoming[from.id],
          this.incoming[to.id],
          myCells,
          myEnergy,
          this.time,
          this.aimed[to.id],
          nearby,
          reachOf(from.energy),
          tentacleSlots(from.energy),
          to.occupancy[owner],
          to.captureNeed,
          macro,
        );
        const score = scoreSend(net, this.feat) + (Math.random() - 0.5) * noise;
        cands.push({ kind: "send", score, from: from.id, to: to.id });
      }
    }
    for (const t of this.tentacles) {
      if (t.owner !== owner) continue;
      if (!legalCut.has(t.id)) continue;
      const from = this.cells[t.from];
      const to = this.cells[t.to];
      if (!from || !to) continue;
      const free = Math.max(0, tentacleSlots(from.energy) - this.outgoing[from.id]);
      let extra = 0.88;
      if (t.packets.length > 0) {
        let mass = 0;
        let moment = 0;
        for (const p of t.packets) {
          mass += p.energy;
          moment += p.t * p.energy;
        }
        if (mass > 0) extra = Math.min(0.94, Math.max(0.12, moment / mass - 0.04));
      }
      const samples = t.state === "locked" ? [0.5, t.lockT * 0.92] : [...CUT_TS, extra];
      for (const cutT of samples) {
        const dump = this.distalFraction(t, cutT);
        const macro = this.macroFor(owner, to.owner, dump, pow);
        writeCutFeatures(
          this.feat,
          t.charge,
          t.progress,
          t.state,
          t.lockT,
          from.energy,
          to.energy,
          owner,
          to.owner,
          this.incoming[from.id],
          this.incoming[to.id],
          myCells,
          myEnergy,
          this.time,
          this.aimed[to.id],
          free,
          cutT,
          t.packets.length,
          t.stall,
          macro,
        );
        const score = scoreCut(net, this.feat) + (Math.random() - 0.5) * noise;
        cands.push({ kind: "cut", score, tent: t, cutT });
      }
    }
    if (cands.length === 0) return;
    const pick = (list: Cand[]): Cand => {
      if (list.length === 1) return list[0];
      if (this.silent && Math.random() < 0.28) {
        let best = -1e9;
        for (const c of list) if (c.score > best) best = c.score;
        const weights = list.map((c) => Math.exp(Math.min(12, (c.score - best) / 0.38)));
        let sum = 0;
        for (const w of weights) sum += w;
        let roll = Math.random() * sum;
        for (let i = 0; i < list.length; i++) {
          roll -= weights[i];
          if (roll <= 0) return list[i];
        }
        return list[list.length - 1];
      }
      let best = list[0];
      for (let i = 1; i < list.length; i++) if (list[i].score > best.score) best = list[i];
      return best;
    };
    const cuts = cands.filter((c) => c.kind === "cut");
    const chosen = legal.forcedCuts
      ? pick(cuts.length > 0 ? cuts : cands)
      : this.silent && cuts.length > 0 && Math.random() < 0.16
        ? pick(cuts)
        : pick(cands);
    // HG-1b must clear the dead pipe this tick; do not drop a forced cut on the -.08 floor.
    if (!legal.forcedCuts && chosen.score < -0.08) return;
    if (chosen.kind === "cut") this.cutTentacle(chosen.tent, chosen.cutT);
    else this.send(chosen.from, chosen.to);
  }

  think(owner: number): void {
    const net = this.brains[owner];
    if (net) this.thinkNet(owner, net);
  }

  checkEnd(): void {
    if (this.mode === "attract" || this.ended) return;
    const alive = new Set<number>();
    for (const c of this.cells) if (c.owner !== 0) alive.add(c.owner);
    if (this.mode === "spectate") {
      if (alive.size <= 1) {
        this.ended = true;
        this.winner = alive.size === 1 ? [...alive][0] : 0;
        this.events.onWin(this.winner);
      }
      return;
    }
    if (!alive.has(this.player)) {
      this.ended = true;
      this.lost = true;
      this.events.onLose();
      return;
    }
    if (alive.size === 1 && alive.has(this.player)) {
      this.ended = true;
      this.winner = this.player;
      this.events.onWin(this.player);
    }
  }
}
