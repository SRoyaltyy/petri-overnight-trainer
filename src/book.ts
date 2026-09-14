import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import {
  ARCH,
  EMPTY_BOOK,
  POPULATION,
  WEIGHT_COUNT,
  type Book,
  type OvernightMeta,
  type Strain,
  type LeagueEntry,
} from "./types.js";
import { decodeWeights, encodeWeights, randomNet } from "./weights.js";

export function newStrainId(gen: number): string {
  return `s${gen}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function makeStrain(
  w: Float32Array,
  gen: number,
  elo = 1000,
): Strain {
  return {
    id: newStrainId(gen),
    gen,
    w: encodeWeights(w),
    elo,
    strength: 1000,
    fitness: 0,
    games: 0,
    wins: 0,
  };
}

export function normalizeStrain(raw: Partial<Strain>): Strain {
  return {
    id: String(raw.id ?? newStrainId(raw.gen ?? 0)),
    gen: raw.gen ?? 0,
    w: String(raw.w ?? encodeWeights(randomNet().w)),
    elo: raw.elo ?? 1000,
    strength: raw.strength ?? 1000,
    fitness: raw.fitness ?? 0,
    games: raw.games ?? 0,
    wins: raw.wins ?? 0,
  };
}

export function seedBook(count = POPULATION): Book {
  const strains: Strain[] = [];
  for (let i = 0; i < count; i++) strains.push(makeStrain(randomNet(0.08).w, 0));
  return {
    arch: ARCH,
    gen: 0,
    games: 0,
    strength: 1000,
    vsGhost: 0.5,
    ghostGames: 0,
    strains,
    league: [{ gen: 0, w: String(strains[0].w), elo: 1000 }],
  };
}

export function padBook(book: Book, count = POPULATION): Book {
  const next: Book = {
    ...book,
    arch: ARCH,
    strains: book.strains.slice(),
    league: book.league.slice(),
  };
  while (next.strains.length < count) {
    next.strains.push(makeStrain(randomNet(0.08).w, next.gen));
  }
  if (next.league.length === 0 && next.strains[0]) {
    next.league.push({ gen: 0, w: String(next.strains[0].w), elo: 1000 });
  }
  return next;
}

export function parseBook(raw: unknown): Book {
  if (!raw || typeof raw !== "object") return { ...EMPTY_BOOK, strains: [], league: [] };
  const t = raw as Partial<Book>;
  if (t.arch !== ARCH) return { ...EMPTY_BOOK, strains: [], league: [] };
  return {
    arch: ARCH,
    gen: t.gen ?? 0,
    games: t.games ?? 0,
    strength: t.strength ?? 1000,
    vsGhost: t.vsGhost ?? 0.5,
    ghostGames: t.ghostGames ?? 0,
    strains: Array.isArray(t.strains) ? t.strains.map(normalizeStrain) : [],
    league: Array.isArray(t.league) ? (t.league as LeagueEntry[]) : [],
    overnight: t.overnight,
  };
}

/** Client Bn: top 16 strains by strength/fitness; league ≤ 16. */
export function serializeBook(book: Book, overnight?: OvernightMeta): Book {
  const strains = book.strains
    .slice()
    .sort((a, b) => b.strength - a.strength || b.fitness - a.fitness)
    .slice(0, POPULATION);
  const league = book.league.slice(0, POPULATION);
  const out: Book = {
    arch: ARCH,
    gen: book.gen,
    games: book.games,
    strength: book.strength,
    vsGhost: book.vsGhost,
    ghostGames: book.ghostGames,
    strains,
    league,
  };
  if (overnight) out.overnight = overnight;
  else if (book.overnight) out.overnight = book.overnight;
  return out;
}

/** Merge Wn(a,b): prefer arch 5; else higher games; else higher strength. */
export function mergeBooks(a: Book, b: Book): Book {
  if (a.arch !== ARCH && b.arch === ARCH) return b;
  if (b.arch !== ARCH && a.arch === ARCH) return a;
  if (b.games === a.games) return b.strength >= a.strength ? b : a;
  return b.games > a.games ? b : a;
}

export function loadBook(path: string): Book | null {
  if (!existsSync(path)) return null;
  try {
    return parseBook(JSON.parse(readFileSync(path, "utf8")));
  } catch {
    return null;
  }
}

export function saveBook(path: string, book: Book, overnight?: OvernightMeta): Book {
  const shaped = serializeBook(book, overnight);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(shaped, null, 2)}\n`);
  return shaped;
}

export function saveHistory(dir: string, book: Book): void {
  mkdirSync(dir, { recursive: true });
  const shaped = serializeBook(book);
  writeFileSync(`${dir}/gen-${shaped.gen}.json`, `${JSON.stringify(shaped, null, 2)}\n`);
}

export interface BookIssue {
  path: string;
  message: string;
}

export function validateBook(book: Book): BookIssue[] {
  const issues: BookIssue[] = [];
  if (book.arch !== ARCH) issues.push({ path: "arch", message: `expected ${ARCH}` });
  if (!Array.isArray(book.strains)) issues.push({ path: "strains", message: "missing array" });
  if (!Array.isArray(book.league)) issues.push({ path: "league", message: "missing array" });
  if (book.strains.length > POPULATION) {
    issues.push({ path: "strains", message: `expected ≤${POPULATION}` });
  }
  if (book.league.length > POPULATION) {
    issues.push({ path: "league", message: `expected ≤${POPULATION}` });
  }
  book.strains.forEach((s, i) => {
    try {
      const w = decodeWeights(s.w);
      if (w.length !== WEIGHT_COUNT) {
        issues.push({ path: `strains[${i}].w`, message: `decoded length ${w.length}` });
      }
    } catch (err) {
      issues.push({ path: `strains[${i}].w`, message: String(err) });
    }
    for (const key of ["id", "gen", "elo", "strength", "fitness", "games", "wins"] as const) {
      if (s[key] === undefined) issues.push({ path: `strains[${i}].${key}`, message: "missing" });
    }
  });
  book.league.forEach((g, i) => {
    try {
      const w = decodeWeights(g.w);
      if (w.length !== WEIGHT_COUNT) {
        issues.push({ path: `league[${i}].w`, message: `decoded length ${w.length}` });
      }
    } catch (err) {
      issues.push({ path: `league[${i}].w`, message: String(err) });
    }
  });
  return issues;
}
