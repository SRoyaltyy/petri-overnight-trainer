import assert from "node:assert/strict";
import { test } from "node:test";
import { Engine } from "../src/engine.js";
import {
  deadSupportPipes,
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
  const { cells, T } = triangle();
  const engine = fixture(cells, []);
  const net = randomNet(0.01);
  net.w[272] = 50;
  net.w[545] = -50;
  engine.brains[1] = net;
  for (let i = 0; i < 20; i++) engine.thinkNet(1, net);
  assert.ok(
    !engine.tentacles.some((t) => t.owner === 1 && t.to === T.id),
    "no send landed on saturated safe ally",
  );
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
