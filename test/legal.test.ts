import assert from "node:assert/strict";
import { test } from "node:test";
import { Engine } from "../src/engine.js";
import {
  deadSupportPipes,
  isEasyPrey,
  isFortifiedEnemy,
  isSaturatedSafeAlly,
  legalThinkMoves,
} from "../src/legal.js";
import { EMPTY_EVENTS, MAX_ENERGY, type Cell, type Tentacle, type TentacleState } from "../src/types.js";
import { randomNet } from "../src/weights.js";

function makeCell(id: number, owner: number, energy: number, x = 0, y = 0): Cell {
  return {
    id,
    x,
    y,
    energy,
    owner,
    captureNeed: 10,
    occupancy: [0, 0, 0, 0, 0],
    radius: 20,
  };
}

function makeTent(
  id: number,
  from: number,
  to: number,
  owner: number,
  state: TentacleState = "latched",
): Tentacle {
  return {
    id,
    from,
    to,
    owner,
    progress: state === "growing" ? 0.4 : 1,
    charge: 8,
    state,
    lockT: 1,
    lockMate: 0,
    packets: [],
    pumpAcc: 0,
    stall: 0,
    pressure: 0,
    clashGlow: 0,
    wave: 0,
    seed: 0,
  };
}

function fixture(cells: Cell[], tents: Tentacle[]): Engine {
  const engine = new Engine("slide", "live", "spectate", EMPTY_EVENTS, true, true);
  engine.cells = cells;
  engine.tentacles = tents;
  engine.incoming = new Int16Array(cells.length);
  engine.outgoing = new Int16Array(cells.length);
  engine.aimed = new Int16Array(cells.length);
  engine.nextTentacleId = tents.reduce((m, t) => Math.max(m, t.id), 0) + 1;
  return engine;
}

/** A at (0,0), full ally T at (40,0), rival R at (80,0). A can reach both. */
function triangle(tEnergy = MAX_ENERGY) {
  const A = makeCell(0, 1, 80, 0, 0);
  const T = makeCell(1, 1, tEnergy, 40, 0);
  const R = makeCell(2, 2, 40, 80, 0);
  return { A, T, R, cells: [A, T, R] };
}

test("HG-1a: send to a saturated safe ally is not legal and is never scored", () => {
  const { A, T, R, cells } = triangle();
  assert.equal(isSaturatedSafeAlly(T, []), true);
  const legal = legalThinkMoves(1, cells, []);
  assert.equal(legal.forcedCuts, false);
  assert.ok(
    legal.sends.some((s) => s.from === A.id && s.to === R.id),
    "send to rival stays legal",
  );
  assert.ok(
    !legal.sends.some((s) => s.to === T.id),
    "send to saturated safe ally is banned",
  );
  const engine = fixture(cells, []);
  const set = engine.legalMoves(1);
  assert.ok(!set.sends.some((s) => s.to === T.id));
});

test("HG-1b: a dead support pipe makes the legal set only those cuts", () => {
  const { A, T, R, cells } = triangle();
  const pipe = makeTent(7, A.id, T.id, 1, "latched");
  const other = makeTent(8, A.id, R.id, 1, "growing");
  assert.equal(isSaturatedSafeAlly(T, [pipe, other]), true);
  const dead = deadSupportPipes(1, cells, [pipe, other]);
  assert.deepEqual(
    dead.map((t) => t.id),
    [7],
  );
  const legal = legalThinkMoves(1, cells, [pipe, other]);
  assert.equal(legal.forcedCuts, true);
  assert.deepEqual(legal.sends, []);
  assert.deepEqual(legal.cuts, [{ kind: "cut", tentacleId: 7 }]);
  assert.ok(!legal.cuts.some((c) => c.tentacleId === 8), "rival pipe is not a dead support");
});

test("send to ally remains legal when the ally is under attack", () => {
  const { A, T, R, cells } = triangle();
  const assault = makeTent(3, R.id, T.id, 2, "growing");
  assert.equal(isSaturatedSafeAlly(T, [assault]), false);
  const legal = legalThinkMoves(1, cells, [assault]);
  assert.equal(legal.forcedCuts, false);
  assert.ok(legal.sends.some((s) => s.from === A.id && s.to === T.id));
});

test("send to ally remains legal when the ally is growing an outbound tentacle", () => {
  const { A, T, R, cells } = triangle();
  const outbound = makeTent(4, T.id, R.id, 1, "growing");
  assert.equal(isSaturatedSafeAlly(T, [outbound]), false);
  const legal = legalThinkMoves(1, cells, [outbound]);
  assert.equal(legal.forcedCuts, false);
  assert.ok(legal.sends.some((s) => s.from === A.id && s.to === T.id));
});

test("send to ally remains legal when ally energy is below 200", () => {
  const { A, T, cells } = triangle(199);
  assert.equal(isSaturatedSafeAlly(T, []), false);
  const legal = legalThinkMoves(1, cells, []);
  assert.ok(legal.sends.some((s) => s.from === A.id && s.to === T.id));
});

test("latched outbound from T does not lift the saturated-safe-ally ban", () => {
  const { A, T, R, cells } = triangle();
  const feed = makeTent(5, T.id, R.id, 1, "latched");
  assert.equal(isSaturatedSafeAlly(T, [feed]), true);
  const legal = legalThinkMoves(1, cells, [feed]);
  assert.ok(!legal.sends.some((s) => s.to === T.id));
});

test("thinkNet never samples a send onto a saturated safe ally", () => {
  const net = randomNet(0.01);
  net.w[272] = 50;
  net.w[545] = -50;
  for (let i = 0; i < 12; i++) {
    const { cells, T } = triangle();
    const engine = fixture(cells, []);
    engine.thinkNet(1, net);
    assert.ok(
      !engine.tentacles.some((t) => t.owner === 1 && t.to === T.id),
      "no send landed on saturated safe ally",
    );
  }
});

/** A can reach a sub-200 ally, a neutral, a weak isolated enemy, and a fat enemy. */
function preyBoard() {
  const A = makeCell(0, 1, 80, 0, 0);
  const ally = makeCell(1, 1, 80, 35, 0);
  const neutral = makeCell(2, 0, 0, 0, 35);
  const weak = makeCell(3, 2, 25, -35, 0);
  const fat = makeCell(4, 2, 160, 35, 35);
  return { A, ally, neutral, weak, fat, cells: [A, ally, neutral, weak, fat] };
}

test("HG-2: when easy prey exists, drop fortified enemy sends only", () => {
  const { A, ally, neutral, weak, fat, cells } = preyBoard();
  assert.equal(isEasyPrey(neutral, 1, []), true);
  assert.equal(isEasyPrey(weak, 1, []), true);
  assert.equal(isEasyPrey(ally, 1, []), false);
  assert.equal(isFortifiedEnemy(fat, 1, []), true);
  const legal = legalThinkMoves(1, cells, []);
  assert.equal(legal.forcedCuts, false);
  assert.equal(legal.droppedFortified, true);
  const targets = new Set(legal.sends.filter((s) => s.from === A.id).map((s) => s.to));
  assert.ok(targets.has(neutral.id), "neutral stays legal");
  assert.ok(targets.has(weak.id), "isolated weak enemy stays legal");
  assert.ok(targets.has(ally.id), "sub-200 ally snowball stays legal beside neutrals");
  assert.ok(!targets.has(fat.id), "fortified enemy send is removed");
});

test("HG-2: ally snowball to 200 stays legal alongside open neutrals", () => {
  const A = makeCell(0, 1, 90, 0, 0);
  const ally = makeCell(1, 1, 170, 40, 0);
  const neutral = makeCell(2, 0, 0, 0, 40);
  const legal = legalThinkMoves(1, [A, ally, neutral], []);
  assert.ok(legal.sends.some((s) => s.from === A.id && s.to === ally.id));
  assert.ok(legal.sends.some((s) => s.from === A.id && s.to === neutral.id));
});

test("HG-2: HG-1a still bans a saturated safe ally even when neutrals are open", () => {
  const A = makeCell(0, 1, 90, 0, 0);
  const full = makeCell(1, 1, MAX_ENERGY, 40, 0);
  const neutral = makeCell(2, 0, 0, 0, 40);
  assert.equal(isSaturatedSafeAlly(full, []), true);
  const legal = legalThinkMoves(1, [A, full, neutral], []);
  assert.ok(!legal.sends.some((s) => s.to === full.id));
  assert.ok(legal.sends.some((s) => s.to === neutral.id));
});

test("HG-2: well-supported weak enemy is fortified and dropped when easy prey exists", () => {
  const A = makeCell(0, 1, 80, 0, 0);
  const neutral = makeCell(1, 0, 0, 0, 40);
  const weak = makeCell(2, 2, 20, 40, 0);
  const s1 = makeCell(3, 2, 40, 70, 10);
  const s2 = makeCell(4, 2, 40, 70, -10);
  const tents = [makeTent(1, s1.id, weak.id, 2, "latched"), makeTent(2, s2.id, weak.id, 2, "latched")];
  assert.equal(isEasyPrey(weak, 1, tents), false);
  assert.equal(isFortifiedEnemy(weak, 1, tents), true);
  const legal = legalThinkMoves(1, [A, neutral, weak, s1, s2], tents);
  assert.ok(legal.sends.some((s) => s.to === neutral.id));
  assert.ok(!legal.sends.some((s) => s.to === weak.id));
});

test("HG-2: strong-side lock makes a weak enemy fortified", () => {
  const A = makeCell(0, 1, 80, 0, 0);
  const neutral = makeCell(1, 0, 0, 0, 40);
  const weak = makeCell(2, 2, 20, 40, 0);
  const lock = makeTent(9, weak.id, A.id, 2, "locked");
  lock.lockT = 0.72;
  assert.equal(isEasyPrey(weak, 1, [lock]), false);
  const legal = legalThinkMoves(1, [A, neutral, weak], [lock]);
  assert.ok(!legal.sends.some((s) => s.to === weak.id));
  assert.ok(legal.sends.some((s) => s.to === neutral.id));
});

test("HG-2: without easy prey, fortified enemy sends stay legal", () => {
  const A = makeCell(0, 1, 80, 0, 0);
  const fat = makeCell(1, 2, 160, 40, 0);
  assert.equal(isFortifiedEnemy(fat, 1, []), true);
  const legal = legalThinkMoves(1, [A, fat], []);
  assert.equal(legal.droppedFortified, false);
  assert.ok(legal.sends.some((s) => s.from === A.id && s.to === fat.id));
});

test("HG-1b still outranks HG-2 when a dead support pipe exists", () => {
  const { A, ally, cells } = preyBoard();
  ally.energy = MAX_ENERGY;
  const pipe = makeTent(3, A.id, ally.id, 1, "latched");
  assert.equal(isSaturatedSafeAlly(ally, [pipe]), true);
  const legal = legalThinkMoves(1, cells, [pipe]);
  assert.equal(legal.forcedCuts, true);
  assert.deepEqual(legal.sends, []);
  assert.deepEqual(legal.cuts, [{ kind: "cut", tentacleId: 3 }]);
});

test("thinkNet forced-cuts a dead support pipe even when the cut head is hostile", () => {
  const { A, T, cells } = triangle();
  const pipe = makeTent(11, A.id, T.id, 1, "latched");
  const engine = fixture(cells, [pipe]);
  const net = randomNet(0.01);
  net.w[272] = 50;
  net.w[545] = -50;
  engine.thinkNet(1, net);
  assert.equal(
    engine.tentacles.some((t) => t.id === 11),
    false,
    "dead support pipe must be cut this tick",
  );
  assert.equal(engine.cutCount[1], 1);
});
