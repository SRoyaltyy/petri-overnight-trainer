import assert from "node:assert/strict";
import { test } from "node:test";
import { Engine } from "../src/engine.js";
import { pickDish } from "../src/evolve.js";
import { onLand, project, projectLand, regionOf } from "../src/geo.js";
import { dishRadiusOf, factionCount, generateDish, pathBlocked } from "../src/maps.js";
import { EMPTY_EVENTS, TRAIN_SWARM_FACTIONS } from "../src/types.js";

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

test("generated dishes are continents with coastline walls", () => {
  for (const id of ["slide", "royale", "swarm"] as const) {
    const dish = generateDish(id, rngFrom(42));
    assert.ok((dish.barriers?.length ?? 0) >= 20, `${id} needs coastline walls, got ${dish.barriers?.length ?? 0}`);
    const owners = new Set(dish.cells.filter((c) => c.owner > 0).map((c) => c.owner));
    assert.equal(owners.size, factionCount(id));
    const land = projectLand(regionOf(id));
    for (const c of dish.cells) assert.equal(onLand(c.x, c.y, land), true, `${id} cell off land`);
  }
});

test("compact world keeps eight colours on live coasts", () => {
  const dish = generateDish("swarm", rngFrom(42));
  assert.equal(factionCount("swarm"), TRAIN_SWARM_FACTIONS);
  assert.ok(dishRadiusOf("swarm") > 800, `world should be wide, got ${dishRadiusOf("swarm")}`);
  assert.ok((dish.radius ?? 0) > 800);
  const owners = new Set(dish.cells.filter((c) => c.owner > 0).map((c) => c.owner));
  assert.equal(owners.size, TRAIN_SWARM_FACTIONS);
  assert.ok(dish.cells.length > 16, `expected a populated world, got ${dish.cells.length} cells`);
  assert.ok((dish.barriers?.length ?? 0) >= 80, `expected coastlines, got ${dish.barriers?.length ?? 0}`);
  const engine = new Engine("swarm", "live", "spectate", EMPTY_EVENTS, true, true);
  assert.equal(engine.factionCount(), TRAIN_SWARM_FACTIONS);
  assert.ok(engine.barriers.length >= 1);
  assert.equal(engine.brains.length, 33);
});

test("gibraltar is open and the atlantic is a moat", () => {
  const eu = generateDish("slide", rngFrom(3));
  const world = generateDish("swarm", rngFrom(7));
  const paris = project(-1.2, 47.2, "europe");
  const rabat = project(-6.8, 34.0, "europe");
  const nyc = project(-74, 41, "world");
  const lisbon = project(-9, 39, "world");
  const chuk = project(172, 66, "world");
  const alaska = project(-166, 65, "world");
  assert.equal(pathBlocked(paris.x, paris.y, rabat.x, rabat.y, eu.barriers ?? []), false);
  assert.equal(pathBlocked(nyc.x, nyc.y, lisbon.x, lisbon.y, world.barriers ?? []), true);
  assert.equal(pathBlocked(chuk.x, chuk.y, alaska.x, alaska.y, world.barriers ?? []), false);
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
