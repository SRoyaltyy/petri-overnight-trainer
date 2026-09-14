import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  loadBook,
  mergeBooks,
  parseBook,
  saveBook,
  seedBook,
  serializeBook,
  validateBook,
} from "../src/book.js";
import { Lab } from "../src/evolve.js";
import { ARCH, POPULATION, WEIGHT_COUNT } from "../src/types.js";
import { decodeWeights, encodeWeights, randomNet } from "../src/weights.js";

test("seed book is arch 5 with 546-float strains and Origin league[0]", () => {
  const book = serializeBook(seedBook());
  assert.equal(book.arch, ARCH);
  assert.ok(book.strains.length <= POPULATION);
  assert.equal(book.strains.length, 16);
  assert.equal(book.league.length, 1);
  assert.equal(book.league[0].gen, 0);
  const issues = validateBook(book);
  assert.deepEqual(issues, []);
  for (const s of book.strains) {
    const w = decodeWeights(s.w);
    assert.equal(w.length, WEIGHT_COUNT);
    assert.ok(Number.isFinite(w[0]));
    assert.ok(Number.isFinite(w[272]));
    assert.ok(Number.isFinite(w[545]));
  }
});

test("base64 Float32Array round-trip is 546 little-endian floats", () => {
  const net = randomNet(0.08);
  const b64 = encodeWeights(net.w);
  const back = decodeWeights(b64);
  assert.equal(back.length, WEIGHT_COUNT);
  for (let i = 0; i < WEIGHT_COUNT; i++) {
    assert.equal(back[i], net.w[i]);
  }
});

test("serializeBook keeps at most 16 strains and 16 league entries", () => {
  const book = seedBook();
  for (let i = 0; i < 8; i++) book.strains.push(book.strains[0]);
  for (let i = 0; i < 20; i++) book.league.push({ gen: i + 1, w: book.strains[0].w, elo: 1000 });
  const shaped = serializeBook(book);
  assert.ok(shaped.strains.length <= 16);
  assert.ok(shaped.league.length <= 16);
});

test("Wn prefers arch 5, then more games, then strength", () => {
  const a = seedBook();
  const b = seedBook();
  a.arch = 4;
  b.arch = 5;
  assert.equal(mergeBooks(a, b), b);
  a.arch = 5;
  a.games = 10;
  b.games = 3;
  assert.equal(mergeBooks(a, b), a);
  b.games = 10;
  a.strength = 1100;
  b.strength = 1200;
  assert.equal(mergeBooks(a, b), b);
});

test("decodeWeights pads short payloads to 546, matching client _n", () => {
  const short = Buffer.alloc(8).toString("base64");
  const padded = decodeWeights(short);
  assert.equal(padded.length, WEIGHT_COUNT);
  const book = seedBook();
  book.arch = 3;
  assert.ok(validateBook(book).some((i) => i.path === "arch"));
});

test("train --matches 2 writes a valid book with higher games", () => {
  const dir = mkdtempSync(join(tmpdir(), "petri-book-"));
  const path = join(dir, "latest.json");
  const start = seedBook();
  saveBook(path, start);
  const lab = new Lab(start);
  const played = lab.run({ matches: 2 });
  assert.equal(played, 2);
  assert.equal(lab.book.games, start.games + 2);
  assert.equal(lab.book.league[0].gen, 0, "Origin must survive");
  const written = saveBook(path, lab.book, {
    trainedAt: new Date().toISOString(),
    gamesAdded: 2,
    genBefore: start.gen,
    genAfter: lab.book.gen,
    strengthBefore: start.strength,
    strengthAfter: lab.book.strength,
    vsGhostAfter: lab.book.vsGhost,
  });
  const issues = validateBook(written);
  assert.deepEqual(issues, []);
  const reloaded = loadBook(path);
  assert.ok(reloaded);
  assert.equal(reloaded.arch, 5);
  assert.ok(reloaded.games > start.games);
  assert.ok(reloaded.strains.length <= 16);
  assert.equal(decodeWeights(reloaded.strains[0].w).length, WEIGHT_COUNT);
  const raw = JSON.parse(readFileSync(path, "utf8")) as { overnight?: { gamesAdded: number } };
  assert.equal(raw.overnight?.gamesAdded, 2);
});

test("committed books/latest.json is a valid Bn-shaped arch-5 book", () => {
  const book = loadBook(new URL("../books/latest.json", import.meta.url).pathname);
  assert.ok(book, "books/latest.json must exist");
  const issues = validateBook(serializeBook(book));
  assert.deepEqual(issues, []);
  assert.equal(book.arch, 5);
  assert.ok(book.strains.length <= 16);
  assert.ok(book.league.length <= 16);
  assert.equal(decodeWeights(book.strains[0].w).length, WEIGHT_COUNT);
});

test("parseBook drops non-arch-5 payloads", () => {
  const parsed = parseBook({ arch: 4, games: 99, strains: [], league: [] });
  assert.equal(parsed.arch, 5);
  assert.equal(parsed.games, 0);
});
