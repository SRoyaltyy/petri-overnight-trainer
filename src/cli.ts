#!/usr/bin/env node
import { resolve } from "node:path";
import { loadBook, saveBook, saveHistory, seedBook, validateBook } from "./book.js";
import { Lab } from "./evolve.js";
import type { OvernightMeta } from "./types.js";

interface Args {
  budgetMs?: number;
  matches?: number;
  checkpointMs: number;
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
    checkpointMs: 60_000,
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
    } else if (a === "--checkpoint-ms" && next) {
      args.checkpointMs = Number(next);
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
  --budget-ms N       Wall-clock cap in milliseconds
  --matches N         Stop after N completed matches
  --checkpoint-ms N   Flush latest.json every N ms (default 60000; 0 = end only)
  --book PATH         Book JSON (default books/latest.json)
  --history-dir D     Snapshot dir (default books/history)
  --no-history        Do not write gen snapshots
  --seed              Write a fresh random arch-5 book and exit
`);
}

function meta(lab: Lab, gamesBefore: number, genBefore: number, strengthBefore: number): OvernightMeta {
  return {
    trainedAt: new Date().toISOString(),
    gamesAdded: lab.book.games - gamesBefore,
    genBefore,
    genAfter: lab.book.gen,
    strengthBefore,
    strengthAfter: lab.book.strength,
    vsGhostAfter: lab.book.vsGhost,
  };
}

function flush(lab: Lab, bookPath: string, historyDir: string, history: boolean, gamesBefore: number, genBefore: number, strengthBefore: number) {
  const overnight = meta(lab, gamesBefore, genBefore, strengthBefore);
  const written = saveBook(bookPath, lab.book, overnight);
  if (history && written.gen !== genBefore) saveHistory(historyDir, written);
  return written;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const bookPath = resolve(args.bookPath);
  const historyDir = resolve(args.historyDir);

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
  let lastFlush = t0;
  let flushed = false;

  const persist = () => {
    const written = flush(lab, bookPath, historyDir, args.history, gamesBefore, genBefore, strengthBefore);
    flushed = true;
    return written;
  };

  const onSignal = (sig: string) => {
    console.log(`Caught ${sig}; flushing book…`);
    const written = persist();
    console.log(`Flushed gen=${written.gen} games=${written.games} strength=${written.strength.toFixed(1)}`);
    process.exit(0);
  };
  process.on("SIGINT", () => onSignal("SIGINT"));
  process.on("SIGTERM", () => onSignal("SIGTERM"));

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
      if (args.checkpointMs > 0 && now - lastFlush >= args.checkpointMs) {
        persist();
        lastFlush = now;
      }
    },
  });

  const written = persist();
  const issues = validateBook(written);
  if (issues.length) {
    console.error("Trained book failed validation:", issues);
    process.exit(1);
  }

  const ms = performance.now() - t0;
  console.log(
    `Wrote ${bookPath}  matches=${played} games=${written.games} (+${written.overnight?.gamesAdded ?? 0}) gen=${written.gen} strength=${written.strength.toFixed(1)} in ${(ms / 1000).toFixed(1)}s`,
  );
}

main();
