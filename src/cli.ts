#!/usr/bin/env node
import { resolve } from "node:path";
import { loadBook, saveBook, saveHistory, seedBook, validateBook } from "./book.js";
import { Lab } from "./evolve.js";
import type { OvernightMeta } from "./types.js";

interface Args {
  budgetMs?: number;
  matches?: number;
  bookPath: string;
  historyDir: string;
  seed: boolean;
  history: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    bookPath: "books/latest.json",
    historyDir: "books/history",
    seed: false,
    history: true,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === "--seed") args.seed = true;
    else if (a === "--no-history") args.history = false;
    else if (a === "--budget-ms" && next) {
      args.budgetMs = Number(next);
      i++;
    } else if (a === "--matches" && next) {
      args.matches = Number(next);
      i++;
    } else if (a === "--book" && next) {
      args.bookPath = next;
      i++;
    } else if (a === "--history-dir" && next) {
      args.historyDir = next;
      i++;
    } else if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  return args;
}

function printHelp(): void {
  console.log(`Petri overnight trainer (arch-5, 546-float send+cut nets)

Usage:
  npm run train -- --budget-ms 60000
  npm run train -- --matches 5
  npm run seed

Options:
  --budget-ms N     Wall-clock cap in milliseconds
  --matches N       Stop after N completed matches
  --book PATH       Book JSON (default books/latest.json)
  --history-dir D   Snapshot dir (default books/history)
  --no-history      Do not write gen snapshots
  --seed            Write a fresh random arch-5 book and exit
`);
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const bookPath = resolve(args.bookPath);

  if (args.seed) {
    const fresh = seedBook();
    const written = saveBook(bookPath, fresh);
    const issues = validateBook(written);
    if (issues.length) {
      console.error("Seeded book failed validation:", issues);
      process.exit(1);
    }
    console.log(`Seeded ${bookPath} (arch ${written.arch}, ${written.strains.length} strains)`);
    return;
  }

  const existing = loadBook(bookPath);
  const start = existing ?? seedBook();
  if (!existing) {
    console.log(`No book at ${bookPath}; starting from a random arch-5 population.`);
  }

  const genBefore = start.gen;
  const strengthBefore = start.strength;
  const gamesBefore = start.games;
  const matches = args.matches;
  const budgetMs = args.budgetMs ?? (matches == null ? 60_000 : undefined);

  const lab = new Lab(start);
  const t0 = performance.now();
  let lastLog = t0;
  const played = lab.run({
    matches,
    budgetMs,
    onMatch(n, book) {
      const now = performance.now();
      if (now - lastLog > 5000 || n === 1 || (matches != null && n === matches)) {
        console.log(
          `match ${n}  games=${book.games} gen=${book.gen} strength=${book.strength.toFixed(1)} vsGhost=${book.vsGhost.toFixed(3)}`,
        );
        lastLog = now;
      }
    },
  });

  const overnight: OvernightMeta = {
    trainedAt: new Date().toISOString(),
    gamesAdded: lab.book.games - gamesBefore,
    genBefore,
    genAfter: lab.book.gen,
    strengthBefore,
    strengthAfter: lab.book.strength,
    vsGhostAfter: lab.book.vsGhost,
  };
  const written = saveBook(bookPath, lab.book, overnight);
  if (args.history && written.gen !== genBefore) saveHistory(resolve(args.historyDir), written);

  const issues = validateBook(written);
  if (issues.length) {
    console.error("Trained book failed validation:", issues);
    process.exit(1);
  }

  const ms = performance.now() - t0;
  console.log(
    `Wrote ${bookPath}  matches=${played} games=${written.games} (+${overnight.gamesAdded}) gen=${written.gen} strength=${written.strength.toFixed(1)} in ${(ms / 1000).toFixed(1)}s`,
  );
}

main();
