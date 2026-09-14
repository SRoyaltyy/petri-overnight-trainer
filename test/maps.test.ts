import assert from "node:assert/strict";
import { test } from "node:test";
import { Engine } from "../src/engine.js";
import { pickDish } from "../src/evolve.js";
import { dishRadiusOf, factionCount, generateDish, pathBlocked } from "../src/maps.js";
import { EMPTY_EVENTS, TRAIN_SWARM_FACTIONS, TRAIN_SWARM_RADIUS } from "../src/types.js";

function rngFrom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

test("pathBlocked detects a crossing wall", () => {
  const wall = { x1: 0, y1: -40, x2: 0, y2: 40 };
  assert.equal(pathBlocked(-20, 0, 20, 0, [wall]), true);
  assert.equal(pathBlocked(-20, 50, 20, 50, [wall]), false);
});

test("send across a barrier is illegal", () => {
  const engine = new Engine("slide", "live", "spectate", EMPTY_EVENTS, true, true);
  const a = engine.cells.find((c) => c.owner === 1);
  const b = engine.cells.find((c) => c.owner === 2);
  assert.ok(a && b);
  engine.barriers = [
    { x1: (a.x + b.x) / 2 - 80, y1: (a.y + b.y) / 2 - 80, x2: (a.x + b.x) / 2 + 80, y2: (a.y + b.y) / 2 + 80 },
  ];
  if (pathBlocked(a.x, a.y, b.x, b.y, engine.barriers)) {
    assert.equal(engine.send(a.id, b.id), false);
  }
});

test("generated slide and royale dishes have no reefs (live parity)", () => {
  for (const id of ["slide", "royale"] as const) {
    let withWalls = 0;
    for (let i = 0; i < 24; i++) {
      const dish = generateDish(id, rngFrom((i + 1) * 9973));
      if ((dish.barriers?.length ?? 0) > 0) withWalls++;
    }
    assert.equal(withWalls, 0, `${id} must be open water like the live app`);
  }
});

test("compact swarm uses the live reef recipe at train scale", () => {
  const dish = generateDish("swarm", rngFrom(42));
  assert.equal(factionCount("swarm"), TRAIN_SWARM_FACTIONS);
  assert.equal(dishRadiusOf("swarm"), TRAIN_SWARM_RADIUS);
  assert.equal(dish.radius, TRAIN_SWARM_RADIUS);
  const owners = new Set(dish.cells.filter((c) => c.owner > 0).map((c) => c.owner));
  assert.equal(owners.size, TRAIN_SWARM_FACTIONS);
  assert.ok(dish.cells.length > 24, `expected a dense mid, got ${dish.cells.length} cells`);
  assert.ok((dish.barriers?.length ?? 0) >= 6, `expected dense reefs, got ${dish.barriers?.length ?? 0}`);
  const engine = new Engine("swarm", "live", "spectate", EMPTY_EVENTS, true, true);
  assert.equal(engine.factionCount(), TRAIN_SWARM_FACTIONS);
  assert.ok(engine.barriers.length >= 1);
  assert.equal(engine.brains.length, 33);
});

test("swarm walls stay off cells", () => {
  for (let i = 0; i < 12; i++) {
    const dish = generateDish("swarm", rngFrom((i + 3) * 7919));
    const walls = dish.barriers ?? [];
    for (const w of walls) {
      for (const c of dish.cells) {
        const dx = w.x2 - w.x1;
        const dy = w.y2 - w.y1;
        const len2 = dx * dx + dy * dy;
        const t = len2 < 1e-8 ? 0 : Math.max(0, Math.min(1, ((c.x - w.x1) * dx + (c.y - w.y1) * dy) / len2));
        const d = Math.hypot(c.x - (w.x1 + dx * t), c.y - (w.y1 + dy * t));
        assert.ok(d > 40, "wall stays off cells");
      }
    }
  }
});

test("legal set omits a send that would cross a wall", () => {
  const engine = new Engine("slide", "live", "spectate", EMPTY_EVENTS, true, true);
  const from = engine.cells.find((c) => c.owner === 1 && c.energy >= 4);
  const to = engine.cells.find((c) => c.id !== from?.id);
  assert.ok(from && to);
  engine.barriers = [{ x1: from.x, y1: from.y - 200, x2: to.x, y2: to.y + 200 }];
  if (!pathBlocked(from.x, from.y, to.x, to.y, engine.barriers)) {
    engine.barriers = [{ x1: (from.x + to.x) / 2, y1: -400, x2: (from.x + to.x) / 2, y2: 400 }];
  }
  const legal = engine.legalMoves(1);
  assert.ok(
    !legal.sends.some((s) => s.from === from.id && s.to === to.id && pathBlocked(from.x, from.y, to.x, to.y, engine.barriers)),
  );
});

test("pickDish actually schedules Swarm after the league exists", () => {
  const hasLeague = true;
  const seen = { slide: 0, culture: 0, royale: 0, swarm: 0 };
  for (let g = 0; g < 280; g++) seen[pickDish(g, hasLeague)]++;
  assert.ok(seen.swarm >= 60, `swarm should be ~25% of games, got ${seen.swarm}/280`);
  assert.ok(seen.slide >= 140, `slide (open + ghost) should dominate, got ${seen.slide}/280`);
  assert.ok(seen.royale >= 10, `royale should still appear, got ${seen.royale}/280`);
  assert.equal(seen.culture, 0);
  for (let g = 0; g < 80; g++) {
    if (g % 4 === 3) assert.equal(pickDish(g, true), "slide", "ghost slot stays slide");
    if (g % 4 === 1) assert.equal(pickDish(g, true), "swarm", "swarm must not collide with ghost");
  }
});
