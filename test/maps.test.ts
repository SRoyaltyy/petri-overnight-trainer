import assert from "node:assert/strict";
import { test } from "node:test";
import { Engine } from "../src/engine.js";
import { factionCount, generateDish, pathBlocked } from "../src/maps.js";
import { EMPTY_EVENTS, TRAIN_SWARM_FACTIONS } from "../src/types.js";

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
  engine.barriers = [{ x1: (a.x + b.x) / 2 - 80, y1: (a.y + b.y) / 2 - 80, x2: (a.x + b.x) / 2 + 80, y2: (a.y + b.y) / 2 + 80 }];
  if (pathBlocked(a.x, a.y, b.x, b.y, engine.barriers)) {
    assert.equal(engine.send(a.id, b.id), false);
  }
});

test("generated slide dishes include open-gap walls and never hug cells", () => {
  let withWalls = 0;
  for (let i = 0; i < 24; i++) {
    let s = (i + 1) * 9973;
    const rng = () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
    const dish = generateDish("slide", rng);
    const walls = dish.barriers ?? [];
    if (walls.length === 0) continue;
    withWalls++;
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
  assert.ok(withWalls >= 6, `expected reefs on some slide dishes, got ${withWalls}`);
});

test("compact swarm is 8 colours with walls", () => {
  const dish = generateDish("swarm", () => Math.random());
  assert.equal(factionCount("swarm"), TRAIN_SWARM_FACTIONS);
  const owners = new Set(dish.cells.filter((c) => c.owner > 0).map((c) => c.owner));
  assert.equal(owners.size, TRAIN_SWARM_FACTIONS);
  assert.ok(dish.cells.length > 20);
  assert.ok((dish.barriers?.length ?? 0) >= 4);
  const engine = new Engine("swarm", "live", "spectate", EMPTY_EVENTS, true, true);
  assert.equal(engine.factionCount(), TRAIN_SWARM_FACTIONS);
  assert.ok(engine.barriers.length >= 1);
  assert.equal(engine.brains.length, 33);
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
  assert.ok(!legal.sends.some((s) => s.from === from.id && s.to === to.id && pathBlocked(from.x, from.y, to.x, to.y, engine.barriers)));
});
