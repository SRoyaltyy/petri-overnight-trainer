import { makeStrain, padBook } from "./book.js";
import { Engine } from "./engine.js";
import {
  EMPTY_EVENTS,
  EVOLVE_EVERY,
  LEAGUE_EVERY_GENS,
  MATCH_SECONDS,
  POPULATION,
  type Book,
  type DishId,
  type LeagueEntry,
  type Strain,
} from "./types.js";
import { cloneNet, crossoverNet, mutationScale, mutateNet, netFromWeights, randomNet } from "./weights.js";
import { factionCount, tentacleSlots, reachOf } from "./maps.js";

function isGhost(s: Strain): boolean {
  return s.id.startsWith("g-");
}

function updateElo(a: Strain, b: Strain, aWon: boolean, k = 20): void {
  const ea = 10 ** (a.elo / 400);
  const expected = ea / (ea + 10 ** (b.elo / 400));
  const score = +!!aWon;
  a.elo += k * (score - expected);
  b.elo += k * (1 - score - (1 - expected));
}

function updateStrength(s: Strain, oppElo: number, won: boolean, k = 24): void {
  const expected = 10 ** (s.strength / 400) / (10 ** (s.strength / 400) + 10 ** (oppElo / 400));
  s.strength += k * (+!!won - expected);
}

function snapshotLeague(book: Book): Book {
  const top = book.strains.slice().sort((a, b) => b.strength - a.strength || b.elo - a.elo)[0];
  if (!top) return book;
  const next: Book = { ...book, league: book.league.slice() };
  if (next.league.length === 0) {
    next.league.push({ gen: top.gen, w: String(top.w), elo: top.strength });
    return next;
  }
  const last = next.league[next.league.length - 1];
  if (last && last.gen === top.gen) return next;
  next.league.push({ gen: top.gen, w: String(top.w), elo: top.strength });
  if (next.league.length > POPULATION) {
    // Never wipe Origin (league[0]).
    next.league = [next.league[0], ...next.league.slice(-15)];
  }
  return next;
}

function evolve(book: Book): Book {
  const next: Book = { ...book, strains: book.strains.slice() };
  next.strains.sort((a, b) => b.fitness - a.fitness || b.strength - a.strength);
  const elites = next.strains.slice(0, 4);
  const pool = next.strains.slice(0, 8);
  const kids: Strain[] = elites.map((s) => ({ ...s, w: s.w }));
  next.gen++;
  const scale = mutationScale(next.gen);
  while (kids.length < 15) {
    const a = pool[Math.floor(Math.random() * pool.length)];
    const b = pool[Math.floor(Math.random() * pool.length)];
    let net =
      a.id !== b.id && Math.random() < 0.4
        ? crossoverNet(netFromWeights(a.w), netFromWeights(b.w))
        : cloneNet(netFromWeights(a.w));
    net = mutateNet(net, scale, 0.22);
    const child = makeStrain(net.w, next.gen, (a.elo + b.elo) / 2);
    child.strength = (a.strength + b.strength) / 2;
    kids.push(child);
  }
  kids.push(makeStrain(randomNet(0.1).w, next.gen));
  next.strains = kids;
  return next.gen % LEAGUE_EVERY_GENS === 0 ? snapshotLeague(next) : next;
}

function impliedWinner(winner: number | null, seats: number[], scores: number[]): number | null {
  if (winner) return winner;
  if (seats.length !== 2) return null;
  const a = seats[0];
  const b = seats[1];
  if (scores[a] > scores[b] + 5) return a;
  if (scores[b] > scores[a] + 5) return b;
  return null;
}

export function scoreMatch(engine: Engine, seats: number[]): { winner: number | null; scores: number[] } {
  const cellsN = [0, 0, 0, 0, 0];
  const energy = [0, 0, 0, 0, 0];
  const incoming = new Int16Array(engine.cells.length);
  const aimed = [
    new Int16Array(0),
    new Int16Array(engine.cells.length),
    new Int16Array(engine.cells.length),
    new Int16Array(engine.cells.length),
    new Int16Array(engine.cells.length),
  ];
  const outgoing = new Int16Array(engine.cells.length);
  for (const t of engine.tentacles) {
    if (t.from < engine.cells.length) outgoing[t.from]++;
    const to = engine.cells[t.to];
    if (!to) continue;
    if (to.owner !== t.owner && t.owner !== 0) incoming[t.to]++;
    if (to.owner !== t.owner && to.owner !== 0 && t.owner > 0) aimed[t.owner][t.to]++;
  }
  for (const c of engine.cells) {
    if (c.owner !== 0) {
      cellsN[c.owner]++;
      energy[c.owner] += c.energy;
    }
  }
  for (const t of engine.tentacles) energy[t.owner] += t.charge;

  const alive = seats.filter((s) => cellsN[s] > 0);
  const winner =
    engine.winner && engine.winner > 0 ? engine.winner : alive.length === 1 ? alive[0] : null;
  const multi = seats.length >= 3;
  const rankOrder = seats.slice().sort((a, b) => (cellsN[b] === cellsN[a] ? energy[b] - energy[a] : cellsN[b] - cellsN[a]));
  const place = [0, 0, 0, 0, 0];
  rankOrder.forEach((s, i) => {
    place[s] = i + 1;
  });
  const placeBonus = multi ? [0, 220, 70, 12, -28] : [0, 180, -8, -8, -8];
  let richest = seats[0];
  let richestE = -1;
  for (const s of seats) {
    if (energy[s] > richestE) {
      richestE = energy[s];
      richest = s;
    }
  }
  const totalE = Math.max(1, energy.reduce((a, b) => a + b, 0));
  const runaway = richestE / totalE > 0.48;
  const scores = [0, 0, 0, 0, 0];

  for (const seat of seats) {
    const drainRate = engine.time > 1 ? engine.drainCount[seat] / engine.time : 0;
    scores[seat] =
      (multi ? cellsN[seat] * 6 + energy[seat] * 0.02 : cellsN[seat] * 16 + energy[seat] * 0.05) +
      engine.captureCount[seat] * (multi ? 7 : 24) +
      Math.min(8, engine.sendCount[seat]) * 1.1 +
      Math.min(10, engine.cutCount[seat]) * 4.2 +
      drainRate * (multi ? 1.6 : 0.8);
    scores[seat] += placeBonus[place[seat]] ?? 0;
    if (winner === seat) scores[seat] += 40 + Math.max(0, MATCH_SECONDS - engine.time) * (multi ? 0.4 : 1.1);
    if (cellsN[seat] === 0) scores[seat] -= 30;

    let dump = 0;
    for (const t of engine.tentacles) {
      if (t.owner !== seat) continue;
      const to = engine.cells[t.to];
      if (to && to.owner === seat && to.energy >= 175 && incoming[to.id] === 0) dump++;
    }
    scores[seat] -= dump * 9;

    let idle = 0;
    for (const c of engine.cells) {
      if (c.owner !== seat || outgoing[c.id] >= tentacleSlots(c.energy)) continue;
      const reach = reachOf(c.energy) * 1.06;
      let threat = false;
      for (const other of engine.cells) {
        if (other.owner !== seat && other.owner !== 0 && Math.hypot(other.x - c.x, other.y - c.y) <= reach) {
          threat = true;
          break;
        }
      }
      if (threat) idle++;
    }
    scores[seat] -= idle * 5;

    let maxAim = 0;
    let aimSum = 0;
    for (let i = 0; i < engine.cells.length; i++) {
      const a = aimed[seat][i];
      aimSum += a;
      if (a > maxAim) maxAim = a;
    }
    if (aimSum > 1) scores[seat] += (maxAim / aimSum) * 22;
    if (engine.time > 14 && engine.captureCount[seat] === 0 && cellsN[seat] >= 2) {
      scores[seat] -= multi ? 18 : 36;
    }
    if (engine.time > 10 && engine.cutCount[seat] === 0 && engine.sendCount[seat] >= 3) {
      scores[seat] -= 16;
    }
    if (multi && runaway && richest !== seat && place[seat] > 2 && engine.captureCount[seat] >= 2) {
      scores[seat] -= 22;
    }
  }
  return { winner, scores };
}

export function settleBook(
  book: Book,
  group: Strain[],
  seats: number[],
  winner: number | null,
  scores: number[],
): Book {
  const next: Book = { ...book, strains: book.strains, league: book.league };
  next.games++;
  const decided = impliedWinner(winner, seats, scores);
  for (let i = 0; i < group.length; i++) {
    const strain = group[i];
    if (isGhost(strain)) continue;
    const seat = seats[i];
    strain.games++;
    strain.fitness = strain.fitness * 0.7 + scores[seat] * 0.3;
    if (decided === seat) strain.wins++;
  }
  const ghostAt = group.findIndex(isGhost);
  if (ghostAt >= 0 && group.length === 2) {
    const liveAt = +(ghostAt === 0);
    const live = group[liveAt];
    const ghost = group[ghostAt];
    if (!isGhost(live) && decided) {
      const won = decided === seats[liveAt];
      updateStrength(live, ghost.elo, won, 28);
      if (ghost.gen === 0) {
        next.vsGhost = next.vsGhost * 0.9 + +!!won * 0.1;
        next.ghostGames++;
      }
    }
  } else if (decided) {
    const winIdx = seats.indexOf(decided);
    if (winIdx >= 0 && !isGhost(group[winIdx])) {
      const champ = group[winIdx];
      for (let i = 0; i < group.length; i++) {
        if (i === winIdx || isGhost(group[i])) continue;
        updateElo(champ, group[i], true, 16);
      }
    }
  }
  next.strength = next.strains.reduce((best, s) => (s.strength > best ? s.strength : best), 1000);
  return next.games > 0 && next.games % EVOLVE_EVERY === 0 ? evolve(next) : next;
}

export class Lab {
  book: Book;
  engine: Engine | null = null;
  group: Strain[] = [];
  seats: number[] = [];

  constructor(book: Book) {
    this.book = padBook(book, POPULATION);
  }

  begin(): void {
    this.book = padBook(this.book, POPULATION);
    const ghost = this.book.league.length > 0 && this.book.games % 4 === 3;
    const dish: DishId = ghost ? "slide" : this.book.games % 7 === 6 ? "royale" : "slide";
    this.seats = Array.from({ length: factionCount(dish) }, (_, i) => i + 1);
    const rot = (this.book.games * 3) % this.book.strains.length;
    this.group = [];
    if (ghost && this.seats.length >= 2) {
      const live = this.book.strains[rot % this.book.strains.length];
      const frozen = this.book.league[Math.floor(Math.random() * this.book.league.length)];
      const ghostStrain: Strain = {
        id: `g-${frozen.gen}`,
        gen: frozen.gen,
        w: frozen.w,
        elo: frozen.elo,
        strength: frozen.elo,
        fitness: 0,
        games: 0,
        wins: 0,
      };
      this.seats = [1, 2];
      this.group = [live, ghostStrain];
    } else {
      for (let i = 0; i < this.seats.length; i++) {
        this.group.push(this.book.strains[(rot + i) % this.book.strains.length]);
      }
    }
    const nets = this.group.map((s) => netFromWeights(s.w));
    this.engine = new Engine(dish, "live", "spectate", EMPTY_EVENTS, true, true);
    this.engine.brains = [null, null, null, null, null];
    for (let i = 0; i < this.seats.length; i++) this.engine.brains[this.seats[i]] = nets[i];
  }

  settle(): void {
    if (!this.engine) return;
    const result = scoreMatch(this.engine, this.seats);
    this.book = settleBook(this.book, this.group, this.seats, result.winner, result.scores);
    this.engine = null;
  }

  /**
   * Run silent self-play until `matches` complete or `budgetMs` elapses.
   * Unlike the in-tab Lab pump (80-iteration UI cap), this finishes matches
   * so a wall-clock budget is the only throttle.
   */
  run(opts: { matches?: number; budgetMs?: number; onMatch?: (n: number, book: Book) => void }): number {
    const matchCap = opts.matches ?? Number.POSITIVE_INFINITY;
    const budget = opts.budgetMs ?? Number.POSITIVE_INFINITY;
    const t0 = performance.now();
    let done = 0;
    while (done < matchCap && performance.now() - t0 < budget) {
      if (!this.engine || this.engine.ended || this.engine.time >= MATCH_SECONDS) {
        if (this.engine) {
          this.settle();
          done++;
          opts.onMatch?.(done, this.book);
          if (done >= matchCap) break;
        }
        this.begin();
      }
      this.engine?.advance(30, MATCH_SECONDS);
    }
    if (this.engine && (this.engine.ended || this.engine.time >= MATCH_SECONDS || this.engine.time > 1)) {
      this.settle();
      done++;
      opts.onMatch?.(done, this.book);
    }
    this.engine = null;
    return done;
  }
}

export function pickTopStrains(book: Book, n: number): Strain[] {
  return book.strains.slice().sort((a, b) => b.strength - a.strength || b.elo - a.elo).slice(0, n);
}

export type { LeagueEntry };
