# League of Legends 1v1 Laning Calculator - Design (v1)

Status: draft, awaiting approval.

## Intent and why

The long-term goal is a laning-phase overlay that warns when an enemy can kill you and shows when you can win an all-in. v1 is the foundation: a **static 1v1 damage calculator** with no live game connection and no overlay. It proves the damage model against public data, and the live API adapter and overlay can be added later on top of it.

## Goals

- Pick two champions, then set level, ability ranks, items and runes for each side.
- Estimate each side's HP, armor and MR from base stats, growth and items.
- Compute full-combo damage both ways: you against them, and them against you.
- Show the result as numbers: the share of the target's HP that the combo removes, and a simple status comparing the two directions.
- Download and cache public static data: champions, items, runes, summoner spells.

## Non-goals (v1)

- No Live Client API connection, no real-time updates, no overlay window.
- No enemy cooldown tracking and no screen reading. Each side's combo (ability hits and auto-attacks) is defined by the user.
- No "go in / don't go in" verdict. The app shows numbers and a status only.
- No hand-modelling of special abilities. Missing-health scaling, recasts, stacking effects, conditional passives and similar are listed as **not modelled** and excluded from totals.
- No summoner spell damage beyond the basics (Ignite, Smite) unless data makes it trivial. Flash and similar are out of scope until the live phase.

## Anti-goals

- Silent wrong numbers. If an ability or effect can't be calculated, the UI must say so instead of guessing.
- Anything that reads or infers hidden game state.

## Constraints

- Must stay within Riot's third-party tool policy. Enemy stats are estimated only from information visible to any player (level, items). The policy should be re-checked before the live phase.
- Data comes from public sources only. Patch data changes every ~2 weeks, so the download must be re-runnable and record the patch version.
- Runs on Windows 11 with Node.

## Approaches considered

1. **TypeScript web app (Vite), layered.** Separate data-download script, damage library, and UI. Easy to test, and the library can later move into an Electron or Tauri overlay unchanged. **Chosen** (builder's call, stated to the user as a proposal).
2. **Python calculator with a small UI.** Quick to write, but the overlay window is awkward on Windows later, and the model would have to be ported.
3. **Hand-modelling a few champions only.** More accurate for those champions, but the user preferred broad coverage with "not modelled" flags instead.

## Design

### Pieces

1. **Data download script** (`scripts/fetch-data`). Downloads Data Dragon (champion base stats and per-level growth, items, runes, summoner spells) and Community Dragon or Meraki data (structured ability damage and scaling ratios). Writes normalised JSON to `data/` with the patch version recorded.
2. **Damage library** (`src/model`). Pure functions with no UI or network access.
   - Stat calculation: base + growth at level (using the standard per-level growth formula), plus item and rune stats.
   - Ability damage: base damage by rank, plus scaling ratios on AD, AP and bonus stats, mitigated by the target's armor or MR.
   - Auto-attack damage is included in the combo (basic attacks only).
   - Each ability is tagged `modelled` or `not-modelled`, with a reason when it is not.
3. **UI** (`src/ui`). Two side-by-side panels (you / enemy) for champion, level, ability ranks, items and runes, plus a results area.

### Results shown

- Your combo damage and the % of the enemy's estimated HP it removes.
- The enemy's combo damage and the % of your HP it removes.
- A status colour comparing the two directions.
- A list of not-modelled abilities and effects, per champion.

### Testing

- The damage library is unit-tested against hand-checked cases (known champion at a known level with known items).
- The fetch script is tested against saved sample responses so tests don't need the network.

## Left to the builder

- Choice between Community Dragon and Meraki for ability data, depending on which is more complete and stable.
- Exact format for the normalised JSON files.
- Which item and rune effects are simple enough to model for v1. Anything beyond flat stats should default to not-modelled.
- UI layout and styling.

## Open items

- Re-check Riot's third-party policy before the live overlay phase.
- Decide later how the live API adapter feeds the model (same input shape as the UI forms is the intent).
