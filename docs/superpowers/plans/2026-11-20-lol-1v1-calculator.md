# LoL 1v1 Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static, local web app where you set up two champions (level, ability ranks, items, runes) and see full-combo damage estimates in both directions.

**Architecture:** Three layers: a data-fetch script that writes normalised JSON to `data/`, a pure damage library in `src/model`, and a thin UI in `src/ui`. The library never touches the network or the DOM, so it can later be fed by the Live Client API.

**Tech Stack:** TypeScript, Vite, Vitest, Node 20+ (fetch built in).

**Spec:** `docs/superpowers/specs/2026-11-20-lol-1v1-calculator-design.md`

## Global Constraints

- Static v1: no Live Client API, no overlay, no enemy cooldown tracking. Enemy damage is the full-combo worst case.
- Output is numbers plus a status colour. No "go in / don't go in" verdict.
- Only abilities whose damage is computable from the inputs are modelled. Everything else is tagged `not-modelled` with a reason and excluded from totals. Never guess silently.
- Item and rune effects beyond flat stats default to `not-modelled`.
- Data comes only from public sources (Data Dragon, plus Community Dragon or Meraki for ability data). The fetch script records the patch version.
- Summoner spells: Ignite and Smite only, and only if the data makes them trivial.

## Review Focus

- Level outside 1-18, or ability rank 0 (unlearned): the ability must contribute 0 damage, not error.
- Target resist at or below 0 (armor shred or negative stats): damage must increase and never become NaN or Infinity.
- Champion with no modelled abilities: the UI shows 0 combo damage plus the not-modelled list and never crashes.
- Missing or renamed champion or item ID after a patch: loading fails with a message naming the ID, not a blank page.
- Same champion on both sides (mirror matchup): both panels stay independent.

## File Structure

- `package.json`, `tsconfig.json`, `vite.config.ts`: tooling
- `src/model/types.ts`: shared types
- `src/model/stats.ts`: stat-at-level calculation
- `src/model/damage.ts`: mitigation, ability and combo damage
- `src/model/matchup.ts`: two-way comparison and status
- `scripts/fetch-data.ts`: downloads and normalises data
- `data/`: generated JSON, committed as assets so the app never calls an API at runtime (re-run `npm run fetch-data` only to update to a new patch). Small test samples live in `tests/fixtures/`.
- `src/data/load.ts`: loads the JSON into typed lookups
- `src/ui/*`: panels and results
- `tests/*`: Vitest tests mirroring `src/`

---

### Task 1: Project scaffold and shared types

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `src/model/types.ts`, `tests/smoke.test.ts`

**Interfaces:**
- Produces (in `src/model/types.ts`):
  - `type StatBlock = { hp: number; mana: number; armor: number; mr: number; ad: number; ap: number }`
  - `type ChampionBase = { id: string; name: string; base: StatBlock; growth: StatBlock }` (growth is the per-level value; `ap` is 0 in both)
  - `type Scaling = { stat: 'ad' | 'bonusAd' | 'ap' | 'maxHp' ; ratio: number }`
  - `type Ability = { key: 'Q' | 'W' | 'E' | 'R'; name: string; damageType: 'physical' | 'magic' | 'true'; baseByRank: number[]; scalings: Scaling[]; status: 'modelled' | 'not-modelled'; reason?: string }`
  - `type Build = { championId: string; level: number; ranks: Record<'Q'|'W'|'E'|'R', number>; itemIds: string[]; runeIds: string[] }`

- [ ] **Step 1:** Initialise a Vite vanilla-ts project with Vitest. Add `npm test` (vitest run) and `npm run dev`.
- [ ] **Step 2:** Write `tests/smoke.test.ts` asserting `1 + 1 === 2`, run `npm test`, expect PASS.
- [ ] **Step 3:** Add the types above to `src/model/types.ts`. Do not git-ignore `data/`; the generated JSON is committed as project assets.
- [ ] **Step 4:** Run `npx tsc --noEmit`, expect no errors.
- [ ] **Step 5:** Commit: `git add . && git commit -m "chore: scaffold project and types"`

### Task 2: Stats at level

**Files:**
- Create: `src/model/stats.ts`
- Test: `tests/stats.test.ts`

**Interfaces:**
- Consumes: `ChampionBase`, `StatBlock`
- Produces: `statsAtLevel(champ: ChampionBase, level: number): StatBlock`

- [ ] **Step 1:** Write failing tests in `tests/stats.test.ts`:
  - level 1 returns base values exactly
  - level 18 returns `base + growth * 17` (the multiplier at level 18 is exactly 17)
  - level 2 returns `base + growth * 0.72`
  - level 0 and level 19 clamp to 1 and 18 (Review Focus: level range)
- [ ] **Step 2:** Run `npx vitest run tests/stats.test.ts`, expect FAIL.
- [ ] **Step 3:** Implement `statsAtLevel` in `src/model/stats.ts` using multiplier `(n-1) * (0.7025 + 0.0175 * (n-1))` for each stat, with `n` clamped to 1-18.
- [ ] **Step 4:** Run the tests, expect PASS.
- [ ] **Step 5:** Commit.

### Task 3: Damage mitigation and ability damage

**Files:**
- Create: `src/model/damage.ts`
- Test: `tests/damage.test.ts`

**Interfaces:**
- Consumes: `Ability`, `StatBlock`
- Produces:
  - `mitigate(raw: number, resist: number): number` (multiplier `100/(100+resist)` for resist ≥ 0, `2 - 100/(100-resist)` for resist < 0)
  - `abilityRaw(ability: Ability, rank: number, attacker: { total: StatBlock; bonusAd: number }, target: StatBlock): number`
  - `abilityDamage(ability: Ability, rank: number, attacker: ..., target: StatBlock): number` (applies the correct resist by `damageType`; `true` is unmitigated)
  - `comboDamage(abilities: Ability[], ranks: Record<'Q'|'W'|'E'|'R', number>, attacker: ..., target: StatBlock, autoCount: number): { total: number; notModelled: Ability[] }` (adds `autoCount` physical auto-attacks at attacker AD; skips and returns not-modelled abilities)

- [ ] **Step 1:** Write failing tests: `mitigate(100, 100) === 50`; `mitigate(100, 0) === 100`; `mitigate(100, -50)` is finite and greater than 100 (Review Focus: negative resist); `abilityDamage` for rank 0 returns 0; a magic ability with base 100 and a 0.5 AP ratio at 100 AP against 0 MR returns 150; `comboDamage` leaves a `not-modelled` ability out of `total` and lists it in `notModelled`.
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3:** Implement the four functions in `src/model/damage.ts`.
- [ ] **Step 4:** Run, expect PASS.
- [ ] **Step 5:** Commit.

### Task 4: Matchup and status

**Files:**
- Create: `src/model/matchup.ts`
- Test: `tests/matchup.test.ts`

**Interfaces:**
- Consumes: `comboDamage`, `statsAtLevel`, `Build`, `ChampionBase`, `Ability`
- Produces: `computeMatchup(you: Side, enemy: Side): MatchupResult` where
  - `Side = { champion: ChampionBase; abilities: Ability[]; build: Build; itemStats: StatBlock }`
  - `MatchupResult = { yourDamage: number; yourPctOfEnemyHp: number; enemyDamage: number; enemyPctOfYourHp: number; status: 'safe' | 'even' | 'danger'; yourNotModelled: Ability[]; enemyNotModelled: Ability[] }`
  - Status rule: `danger` if `enemyPctOfYourHp >= 1`; else `safe` if `yourPctOfEnemyHp >= 1`; else `even`. If both are ≥ 1, `danger` wins (worst-case caution).

- [ ] **Step 1:** Write failing tests for each status outcome, for the mirror matchup (same champion on both sides gives symmetric results), and for a champion with no modelled abilities (0 damage, no throw).
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3:** Implement `computeMatchup`. Total stats = `statsAtLevel` + `itemStats`. Use `autoCount = 2` as a named constant `AUTOS_IN_COMBO` so it is easy to change.
- [ ] **Step 4:** Run, expect PASS.
- [ ] **Step 5:** Commit.

### Task 5: Data fetch script

**Files:**
- Create: `scripts/fetch-data.ts`, `tests/fixtures/` (small saved sample responses), `tests/fetch.test.ts`
- Modify: `package.json` (add `npm run fetch-data`)

**Interfaces:**
- Produces files in `data/`: `meta.json` (`{ patch: string; fetchedAt: string }`), `champions.json`, `items.json`, `runes.json`, `summoners.json`, `abilities.json` (a map of champion ID to `Ability[]`).
- Produces: `normaliseChampions(raw: unknown): ChampionBase[]`, `normaliseItems(raw: unknown): Record<string, { name: string; stats: Partial<StatBlock>; hasEffects: boolean }>`

- [ ] **Step 1:** Before coding, spend a short time inspecting the live sources: Data Dragon (`https://ddragon.leagueoflegends.com/api/versions.json`, then `cdn/<version>/data/en_US/{champion,item,runesReforged,summoner}.json`) and one champion file from Meraki or Community Dragon. Decide which of the two supplies ability damage and ratios more completely, and note the choice in the script's header comment. Save one small sample of each response in `tests/fixtures/`.
- [ ] **Step 2:** Write failing tests that run the normalisers against the fixtures: champion base HP and growth match the fixture's values; an item with only flat stats has `hasEffects: false`; an item with a passive has `hasEffects: true`.
- [ ] **Step 3:** Run, expect FAIL.
- [ ] **Step 4:** Implement the normalisers and the downloader (latest patch from `versions.json`, write `data/` files and `meta.json`).
- [ ] **Step 5:** Run the tests, expect PASS. Run `npm run fetch-data` once and check that `data/meta.json` has a patch number.
- [ ] **Step 6:** Commit the script and the generated `data/*.json` files together.

### Task 6: Ability normalisation

**Files:**
- Create: `src/data/abilities.ts`
- Test: `tests/abilities.test.ts`

**Interfaces:**
- Consumes: the chosen ability source's raw champion JSON (fixture)
- Produces: `normaliseAbilities(raw: unknown): Ability[]`. An ability is `modelled` only if its damage is a flat per-rank value plus ratios on `ad`, `bonusAd`, `ap` or `maxHp`. Anything else (missing-health scaling, recasts, stacking, conditional, no damage at all) is `not-modelled` with a one-line `reason`.

- [ ] **Step 1:** Write failing tests against fixtures: a plain damaging ability is `modelled` with the right `baseByRank` and `scalings`; an ability with a conditional or special scaling is `not-modelled` with a non-empty `reason`; a utility ability with no damage is `not-modelled` with reason "no damage".
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3:** Implement `normaliseAbilities` and wire it into `scripts/fetch-data.ts` to produce `abilities.json`.
- [ ] **Step 4:** Run, expect PASS.
- [ ] **Step 5:** Commit.

### Task 7: Data loader

**Files:**
- Create: `src/data/load.ts`
- Test: `tests/load.test.ts`

**Interfaces:**
- Produces: `loadData(): Promise<GameData>` where `GameData = { patch: string; champions: Record<string, ChampionBase>; abilities: Record<string, Ability[]>; items: Record<string, ItemData>; runes: Record<string, RuneData> }`, and `lookupChampion(data: GameData, id: string): ChampionBase`, which throws an `Error` whose message names the missing ID (Review Focus: renamed ID after patch).

- [ ] **Step 1:** Write failing tests: `lookupChampion` on an unknown ID throws with the ID in the message; item stats from a list of IDs sum into one `StatBlock` through `sumItemStats(data, ids): StatBlock`, and an unknown item ID throws with the ID in the message.
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3:** Implement the loader (Vite serves `data/` as static JSON) and the two helpers.
- [ ] **Step 4:** Run, expect PASS.
- [ ] **Step 5:** Commit.

### Task 8: UI

**Files:**
- Create: `src/ui/main.ts`, `src/ui/panel.ts`, `src/ui/results.ts`, `index.html`, `src/ui/style.css`
- Test: `tests/ui.test.ts` (jsdom, via Vitest)

**Interfaces:**
- Consumes: `loadData`, `computeMatchup`, `sumItemStats`
- Produces: two panels (you / enemy) with a champion select, level 1-18, ability rank inputs for Q/W/E/R, item multi-select (up to 6) and rune selects. A results area shows both damage numbers, both HP percentages, the status colour, the not-modelled lists, and the patch version.

- [ ] **Step 1:** Write failing jsdom tests: choosing two champions renders both damage numbers; the not-modelled list appears for a champion with such abilities; a load failure shows an error message that contains the missing ID instead of a blank page; setting the same champion in both panels does not link the panels.
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3:** Implement the panels and results. Layout and styling are the builder's call, and a plain functional layout is fine for v1.
- [ ] **Step 4:** Run tests, expect PASS. Run `npm run dev`, open the page, and confirm a real matchup with real data produces numbers.
- [ ] **Step 5:** Commit.

---

## Self-review notes

- **Spec coverage:** stats (T2), mitigation, abilities and combo (T3), two-way matchup and status (T4), data download with patch recorded (T5-T7), not-modelled flagging (T3, T6, T8), UI results (T8). Summoner spells are fetched in T5 but only Ignite and Smite would be used. Using them in the model is deferred, and the spec marks it optional.
- **Types:** `Ability`, `StatBlock`, `Build` and `ChampionBase` are defined once in T1 and reused by name.
- **Proportion:** the plan lists signatures, test cases and values only, with no function bodies.
