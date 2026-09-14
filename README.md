# Petri overnight trainer

Headless neuroevolution for [Petri](https://bold-stone-royal-fleet.grok.me).
It trains arch-5 neural strains with silent self-play and publishes a
`Bn`-shaped book at `books/latest.json` that the Grok Petri app can later
pull and merge with local `Wn`.

No open browser tab is required. GitHub Actions runs the loop on a schedule
and commits the book with `GITHUB_TOKEN`.

## How it works

1. Load `books/latest.json` if present; otherwise seed 16 random arch-5 nets.
2. Play silent Lab matches (~36 s sim, 54 s on World, difficulty `live`, mode `spectate`):
   - Europe (Slide) — Gibraltar is the gate; ghost duels stay here
   - Americas (Royale) when `games % 7 === 6`
   - compact World (8 colours, live continent coasts) when `games % 4 === 1`
   - ghost duel vs a frozen league ancestor (`g-*`) when the league is
     nonempty and `games % 4 === 3`
   Each think can fire **two** concurrent legal actions. Oceans block a
   straight tentacle; famous straits are the only shot through.
3. Score every legal **send** and **cut**. Each strain is a 546-float net
   (send head + cut head). See [docs/ARCH.md](docs/ARCH.md).
4. Every 10 games: fitness EMA, Elo/strength, crossover/mutation.
   Snapshot the league every 5 generations. Origin (`league[0]`) is never wiped.
5. Write `books/latest.json` (client `Bn` shape + `overnight` metadata) and,
   when the generation advances, `books/history/gen-{N}.json`.

## Local use

```bash
npm ci
npm test
npm run train -- --matches 5
npm run train -- --budget-ms 60000
```

`--matches` and `--budget-ms` can be combined; training stops at whichever
hits first. A mid-flight match is finished so the book always records whole
games.

```bash
npm run seed          # overwrite books/latest.json with a fresh random book
```

## Petri pull contract

The live client stores the working book under local key `petri-strains-v5`.
Overnight output is the same JSON the client `Bn()` serializer writes, plus
an optional `overnight` object the client can ignore.

**Public repo (raw):**

```
GET https://raw.githubusercontent.com/<owner>/<repo>/main/books/latest.json
```

**Private repo:** raw.githubusercontent.com will 404 without auth. Use the
contents API and a fine-grained or classic token that can read this repo
(Contents: Read). Do **not** put that token in this trainer — Petri holds it.

```
GET https://api.github.com/repos/<owner>/<repo>/contents/books/latest.json?ref=main
Accept: application/vnd.github.raw
Authorization: Bearer <PETRI_GITHUB_TOKEN>
```

Expected body (abridged):

```json
{
  "arch": 5,
  "gen": 0,
  "games": 0,
  "strength": 1000,
  "vsGhost": 0.5,
  "ghostGames": 0,
  "strains": [{ "id": "s0-…", "gen": 0, "w": "<base64 Float32Array[546]>", "elo": 1000, "strength": 1000, "fitness": 0, "games": 0, "wins": 0 }],
  "league": [{ "gen": 0, "w": "<base64>", "elo": 1000 }],
  "overnight": {
    "trainedAt": "2026-09-14T00:00:00.000Z",
    "gamesAdded": 0,
    "genBefore": 0,
    "genAfter": 0,
    "strengthBefore": 1000,
    "strengthAfter": 1000,
    "vsGhostAfter": 0.5
  }
}
```

Client merge: `book = Wn(local, remote)`

- prefer `arch === 5`
- else higher `games`
- else higher `strength`

That pick is wholesale. Origin is `remote.league[0]` or `local.league[0]`
depending on which book wins — the trainer never rewrites Origin on its own
side.

After a successful pull, Petri can keep using `petri-strains-v5` as the
in-browser key.

## GitHub Actions

[`.github/workflows/overnight-train.yml`](.github/workflows/overnight-train.yml)

- `schedule`: every 6 hours UTC (`0 */6 * * *`)
- Each scheduled job trains for **up to 5.5 hours** (runner timeout 355 min) in
  ~12 minute slices. After every slice it commits `books/latest.json` so a
  cancelled job loses at most one slice. `SIGINT`/`SIGTERM` also flush the book.
- In-slice checkpoints dump `latest.json` every 60s.
- `workflow_dispatch`: run from the Actions tab. Default budget is 5.5h
  (`19800000` ms). Set `budget_ms` to `720000` for a 12-minute smoke, or
  `matches` for a fixed game count.
- `concurrency`: one trainer at a time; in-progress runs are not cancelled.
- `permissions.contents: write` so the job can commit `books/**`

The Node sim is the fast path (no canvas, no rAF). A 12-minute slice has
landed ~50k games. The old 12-minute-every-6-hours cadence was the throttle;
this layout spends almost the whole GitHub-hosted 6-hour job cap on training
(~22 hours of CPU per day).

The job uses the default `GITHUB_TOKEN`. No other secrets are required for
training or committing. If you later add a Petri-side pull from a private
clone, that token lives in the Grok app, not here.

### Manual dispatch

Actions → Overnight train → Run workflow. Leave defaults for a full 5.5h
grind, set `budget_ms` to `720000` for a 12-minute slice, or set `matches`
for a short smoke run.

### Seeding

The repo ships a random arch-5 `books/latest.json`. To re-seed:

```bash
npm run seed
git add books/latest.json
git commit -m "chore: reseed arch-5 book"
```

The next scheduled run continues from whatever is on `main`.

## Layout

```
src/cli.ts       trainer entry
src/engine.ts    silent dish simulator
src/evolve.ts    Lab dr loop, Elo, fitness, league
src/book.ts      Bn / Wn / seed / validate
src/weights.ts   546-float encode/decode + heads
docs/ARCH.md     feature layout and approximations
books/latest.json
```
