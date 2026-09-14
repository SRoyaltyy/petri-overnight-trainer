# Petri overnight trainer — architecture notes

This CLI re-implements the silent Lab `dr` loop from the live Grok Petri app
(`https://bold-stone-royal-fleet.grok.me`, client book key `petri-strains-v5`)
so GitHub Actions can train without an open browser tab.

The original minified game source is **not** vendored. Behaviour below is the
contract the client uses to encode, score, and merge books. Anything we could
not run bit-identically is listed under [Approximations](#approximations).

## Book (`Bn`)

```json
{
  "arch": 5,
  "gen": 0,
  "games": 0,
  "strength": 1000,
  "vsGhost": 0.5,
  "ghostGames": 0,
  "strains": [],
  "league": [],
  "overnight": {
    "trainedAt": "ISO-8601",
    "gamesAdded": 0,
    "genBefore": 0,
    "genAfter": 0,
    "strengthBefore": 1000,
    "strengthAfter": 1000,
    "vsGhostAfter": 0.5
  }
}
```

- Strain: `{ id, gen, w, elo, strength, fitness, games, wins }`
- `w` is standard base64 of a little-endian `Float32Array` of length **546**
- League entry: `{ gen, w, elo }`
- Serialize like client `Bn`: top 16 strains by `strength` then `fitness`; league ≤ 16
- `overnight` is trainer-only metadata. The client ignores unknown keys when it
  reads `arch/gen/games/strength/vsGhost/ghostGames/strains/league`.

### Merge `Wn(a, b)`

1. Prefer the book whose `arch === 5`
2. Else prefer higher `games`
3. Else prefer higher `strength`

`Wn` picks one whole book. It does not splice strains. Origin (`league[0]`) is
therefore whatever the winning book already stored.

### Origin

`league[0]` is the frozen ancestor ("Origin"). League snapshots every 5
generations push a new entry; if the list would exceed 16 it becomes
`[league[0], ...league.slice(-15)]`. Training never resets `league[0]`.

## Net (arch 5)

Two independent 32→8→1 heads, ReLU hidden, linear output.

| Region | Offset | Count | Role |
| --- | --- | --- | --- |
| Send W | 0 | 256 | 8 × 32 hidden weights |
| Send b | 256 | 8 | hidden biases |
| Send out W | 264 | 8 | output weights |
| Send out b | 272 | 1 | output bias (init `0.07`) |
| Cut W | 273 | 256 | 8 × 32 hidden weights |
| Cut b | 529 | 8 | hidden biases |
| Cut out W | 537 | 8 | output weights |
| Cut out b | 545 | 1 | output bias (init `0.06`) |

Random init: `U(-scale, scale)` with `scale = 0.08`, then the two output biases
above. Mutation: each weight `+= U(-s, s)` with probability `0.22`,
`s = 0.12 * (0.4 + 0.6 / (1 + gen/60))`. Crossover: mix `0.35 + U(0, 0.3)`.

The client only **scores legal send and cut actions**. There is no movement head.

## Feature layout (32 floats)

Shared tail `bn` written at indices 24–31 for both heads:

| i | Name | Notes |
| --- | --- | --- |
| 24 | dominance | leader energy / total |
| 25 | leaderDelta / 4 | clamped 0–1 |
| 26 | myShare | my energy / total |
| 27 | rivalFriction | side-flow / all-flow |
| 28 | pressureOnMe | incoming rival mass |
| 29 | targetIsLeader | 0/1 |
| 30 | buffer | third-party under a runaway leader |
| 31 | dump | send: aimed-at-target/3; cut: distal mass fraction |

### Send head (`xn`)

Evaluated for every owned cell with energy ≥ 4 that still has a tentacle slot,
against every other cell in reach (`reach(energy) * 1.06`).

| i | Feature |
| --- | --- |
| 0 | from.energy / 200 |
| 1 | to.energy / 200 |
| 2 | distance / 720 |
| 3 | (reach(from) − distance) / 400 |
| 4 | to is mine |
| 5 | to is rival |
| 6 | to is neutral |
| 7 | outgoing from / 3 |
| 8 | incoming on from / 3 |
| 9 | incoming on to / 3 |
| 10 | (from − to) energy / 200 |
| 11 | my cell count / 8 |
| 12 | my energy / 800 |
| 13 | capture progress if neutral |
| 14 | distance / 14 / max(4, from.energy) |
| 15 | time / 90 |
| 16 | incoming on from / 2 |
| 17 | incoming on to / 2 |
| 18 | idle friendly target energy (if no incoming) |
| 19 | my tentacles aimed at to / 3 |
| 20 | remaining tentacle slots / 3 |
| 21 | to is rival (repeat) |
| 22 | any rival in reach of from |
| 23 | dump / capture / energy-delta heuristic |

### Cut head (`Sn`)

Evaluated at cut samples `[0.22, 0.50, 0.78, 0.92]` plus a packet-weighted
point, or `[0.5, lockT * 0.92]` when locked.

| i | Feature |
| --- | --- |
| 0–1 | from / to energy / 200 |
| 2 | charge / 200 |
| 3 | progress |
| 4 | locked |
| 5 | lockT |
| 6 | to is rival |
| 7 | to is mine |
| 8 | incoming on from / 3 |
| 9 | from.energy < 12 |
| 10 | charge+2 ≥ to.energy and to is foreign |
| 11 | packet count / 8 |
| 12 | stall / 0.55 |
| 13–15 | my cells / energy / time |
| 16 | dump-ready (own cell ≥ 160, no incoming) |
| 17 | incoming on from / 2 |
| 18 | locked onto a rival |
| 19 | aimed at to / 3 |
| 20 | free tentacle slots / 3 |
| 21 | growing and from.energy < 12 |
| 22 | incoming on to / 2 |
| 23 | sampled cutT |

Actions with score `< -0.08` are ignored. Silent Lab picks softmax among
candidates 28% of the time and forces a cut candidate 16% of the time.

## Silent match

- Dish: mostly `slide`; `royale` when `games % 7 === 6`; ghost duel (`slide`,
  live vs `g-*` league ancestor) when `league.length > 0 && games % 4 === 3`
- Difficulty `live`, mode `spectate`, `silent = true`
- Step `1/60` s, match length 36 s (or last colour standing)
- Think interval for a net on live: 0.28 s, spectate pace 0.85
- Legal send: owned cell, energy ≥ 4, under tentacle cap
  (`energy ≥ 120 → 3`, `≥ 15 → 2`, else 1), no duplicate edge
- Legal cut: own tentacle; host mass refunds to the source, burrow mass
  delivers at the tip (locked cuts dump the far side as spray / fail)

## Hard ground

Trainer-only legal-move filters applied when candidates are built
(`src/legal.ts` → `Engine.legalMoves` / `thinkNet`). Book arch and the 546-float
layout are unchanged.

**Saturated safe ally.** Same-owner target `T` when all of: `T.energy >= 200`,
no enemy tentacle onto `T` (growing / latched / locked), and `T` itself is not
`growing` an outbound tentacle.

- **HG-1a.** `send(from, to=T)` is not legal. It is never scored or sampled.
  Send to that ally stays legal if `T` is under attack, growing outbound, or
  below 200.
- **HG-1b.** An own tentacle `L` with `L.to == T` is a dead support pipe. If the
  acting faction has any this think tick, the legal set is **only** cuts on
  those pipes (any cutT). The `-.08` score floor is skipped so the pipe is
  actually cleared — a live feed into a full, safe ally just burns a slot.

## Evolution (every 10 games)

Fitness EMA: `fitness = fitness * 0.7 + matchScore * 0.3`.
Keep 4 elites, breed from top 8, add one random immigrant, then mutate.
League snapshot every 5 generations. Ghost duels update live `strength`
against the frozen `elo` (`k = 28`) and, if the ghost is Origin (`gen === 0`),
`vsGhost = vsGhost * 0.9 + win * 0.1`.

## Approximations

Faithful, silent-path only:

- Particles, spores, slash ribbons, camera trauma, and clash sparks are omitted.
  The client already no-ops those when `silent` is set.
- The in-tab Lab `pump` yields every 30 steps and hard-caps 80 iterations so the
  UI stays interactive. This CLI finishes matches and uses `--budget-ms` /
  `--matches` as the only throttle.
- Culture (3-colour) dishes exist in the client but Lab never schedules them;
  we keep the generator for completeness and do not train on it.
- `overnight` is written by the trainer and is not part of client `Bn`.
- Base64 uses Node `Buffer` instead of `btoa`/`atob`. Bytes are identical for
  a 546-float `Float32Array`.
- Procedural dish layouts (`un`) are stochastic. Authored Slide / Royale maps
  are the fallback when a colour fails to place, same as the client.

If Petri later changes arch or the 546-float layout, bump the book key
(`petri-strains-v5`) and reject the old `arch` the way client `Rn` does.
