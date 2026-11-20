# Ability parsing sketch (for review)

Status: **sketch, nothing is wired into the calculator yet.** A throwaway prototype parsed the scraped
wiki ability text (`data/wiki-abilities.json`) into damage components. Below are the rules it applies,
what it gets wrong today, and its real output for eight champions. Please check whether the mechanics
match how the abilities actually work. Wiki text is CC BY-SA 3.0 (League of Legends Wiki).

## The proposed model

An ability becomes a list of **damage components**. One component per wiki damage line:

| Field | Meaning |
|---|---|
| label, stage | The wiki label ("First Sweetspot Damage") and the cast it belongs to ("First Cast") |
| type | physical / magic / true, or unknown (then flagged) |
| base | Flat damage per rank, e.g. `10/25/40/55/70` |
| scalings | List of `ratio per rank` + stat, e.g. `60/67.5/75/82.5/90% AD` |
| flags | `variant`, `needs-count`, `derived`, `not-vs-champions` (see rules) |

In the combo builder each non-excluded component would get its own row with a hit count, the way
abilities do now.

## Rules I applied (please confirm or correct)

1. **Damage line**: a wiki value line whose label contains "damage" (not "reduced damage", "damage reduction", shield, heal...).
2. **Type**: from the label ("Magic Damage"); otherwise from the ability text if it names exactly one damage type; otherwise unknown and flagged.
3. **Value**: `base/base/base (+ ratio% STAT) (+ ratio% STAT)`. A ratio can itself change per rank (Aatrox Q: `60/67.5/.../90% AD`).
4. **Stats recognised**: AP, AD, bonus AD, bonus HP, own max HP, target max/missing/current HP, armor, bonus armor, MR, max mana. "per 100 AP" style ratios keep their `per`.
5. **Excluded from totals**: "Maximum ..." / "Total ..." lines that are sums of other lines (so nothing is counted twice), and minion/monster/non-champion lines.
6. **Variants**: cast number, sweetspot, empowered, recast, bonus. Each becomes its own row.
7. **"Per tick / per dagger / per stack"**: a row with a count, default 1.

## Known problems in the prototype (visible in the samples)

- **Minimum/Maximum ranges are wrongly marked "derived".** Vi Q (charge time) and Jinx R (travel distance) have real min..max ranges, not sums. They need a "range" choice, such as a slider or a fixed fraction.
- **Sweetspot vs normal**: Aatrox lists First Cast and First Sweetspot as separate lines. Open question: is "sweetspot" a checkbox on each cast, or two separate rows?
- **Percent with no stat**: Darius W is `40/45/50/55/60%`. The percent is of AD, but the line doesn't say so. Needs a rule or an override.
- **Unknown stats (27 components)**: mostly wording such as "of his bonus health" (7), "bonus mana" (3), "per Feast stack", "per mark", "per 100% bonus attack speed" (Katarina R), and champion-specific ones (Zac, Sona, Ivern).
- **Level-based ranges** ("4% - 10% (based on level)", Aatrox passive) are not parsed yet.
- **Passives: none of the 177 are covered.** Their damage usually appears only in prose, so they need overrides.
- **Stacking and conditional damage** (Nasus Q stacks, Darius R per stack): the wiki gives the formula, but how many stacks apply is an assumption input.

## Coverage on the 713 Q/W/E/R blocks

(All characters' extra forms such as Jayce and Elise are included.)

| Result | Count |
|---|---|
| Parsed cleanly | 350 |
| Parsed, but with options (variants, per-tick counts) | 149 |
| Needs work (unknown stat, mixed or unknown type, level-based) | 41 |
| Only derived or non-champion lines | 26 |
| No damage lines (utility abilities) | 147 |

For comparison, the current Meraki-based model handles **191 of 692** Q/W/E/R abilities.
Roughly 500 of the 713 get usable components here, but that includes the options and flagged-variant cases above.
The 147 with no damage lines should be mostly pure utility; I have not spot-checked them.

# Real output for eight champions

The tables are raw prototype output. "Stage" is the wiki's own prefix ("First Cast:", "Active:", "Recast:").
`ap`, `ad` and `bonusAd` in the Parsed column are the stats the prototype recognised.

## Aatrox

### P - Deathbringer Stance  `no-damage-lines`

_No damage lines on the wiki page._

### Q - The Darkin Blade  `parsed-with-options`

| Wiki label | Stage | Type | Parsed | Flags |
|---|---|---|---|---|
| First Cast Damage | First Cast | physical | base 10/25/40/55/70 + 60/67.5/75/82.5/90% ad |  |
| First Sweetspot Damage | First Cast | physical | base 17.5/43.75/70/96.25/122.5 + 105/118.125/131.25/144.375/157.5% ad | variant |
| Second Cast Damage | Second Cast | physical | base 12.5/31.25/50/68.75/87.5 + 75/84.375/93.75/103.125/112.5% ad | variant |
| Second Sweetspot Damage | Second Cast | physical | base 21.875/54.6875/87.5/120.3125/153.125 + 131.25/147.65625/164.0625/180.46875/196.875% ad | variant |
| Third Cast Damage | Third Cast | physical | base 15/37.5/60/82.5/105 + 90/101.25/112.5/123.75/135% ad | variant |
| Third Sweetspot Damage | Third Cast | physical | base 26.25/65.625/105/144.375/183.75 + 157.5/177.1875/196.875/216.5625/236.25% ad | variant |
| Maximum Non-Minion Non-Sweetspot Damage |  | physical | base 37.5/93.75/150/206.25/262.5 + 225/253.125/281.25/309.375/337.5% ad | derived, not-vs-champions, variant |
| Maximum Non-Minion Sweetspot Damage |  | physical | base 65.625/164.0625/262.5/360.9375/459.375 + 393.75/442.96875/492.1875/541.40625/590.625% ad | derived, not-vs-champions, variant |

### W - Infernal Chains  `parsed-simple`

| Wiki label | Stage | Type | Parsed | Flags |
|---|---|---|---|---|
| Physical Damage | Active | physical | base 30/40/50/60/70 + 40% ad |  |
| Minion Damage | Active | physical | base 60/80/100/120/140 + 80% ad | not-vs-champions |
| Total Damage |  | physical | base 60/80/100/120/140 + 80% ad | derived |

### E - Umbral Dash  `no-damage-lines`

_No damage lines on the wiki page._

### R - World Ender  `no-damage-lines`

_No damage lines on the wiki page._

## Annie

### P - Pyromania  `no-damage-lines`

_No damage lines on the wiki page._

### Q - Disintegrate  `parsed-simple`

| Wiki label | Stage | Type | Parsed | Flags |
|---|---|---|---|---|
| Magic Damage | Active | magic | base 80/125/170/215/260 + 80% ap |  |

### W - Incinerate  `parsed-simple`

| Wiki label | Stage | Type | Parsed | Flags |
|---|---|---|---|---|
| Magic Damage | Active | magic | base 70/110/150/190/230 + 80% ap |  |

### E - Molten Shield  `parsed-simple`

| Wiki label | Stage | Type | Parsed | Flags |
|---|---|---|---|---|
| Magic Damage |  | magic | base 25/35/45/55/65 + 40% ap |  |

### R - Summon: Tibbers  `parsed-simple`

| Wiki label | Stage | Type | Parsed | Flags |
|---|---|---|---|---|
| Initial Magic Damage | Active | magic | base 150/275/400 + 75% ap |  |

## Darius

### P - Hemorrhage  `no-damage-lines`

_No damage lines on the wiki page._

### Q - Decimate  `parsed-simple`

| Wiki label | Stage | Type | Parsed | Flags |
|---|---|---|---|---|
| Physical Damage (Blade) | Active | physical | base 50/80/110/140/170 + 100/110/120/130/140% ad |  |

### W - Crippling Strike  `parsed-with-options`

| Wiki label | Stage | Type | Parsed | Flags |
|---|---|---|---|---|
| Bonus Physical Damage | Active | physical | base 40/45/50/55/60% | variant |

### E - Apprehend  `no-damage-lines`

_No damage lines on the wiki page._

### R - Noxian Guillotine  `parsed-with-options`

| Wiki label | Stage | Type | Parsed | Flags |
|---|---|---|---|---|
| True Damage | Active | true | base 125/250/375 + 75% bonusAd |  |
| Bonus Damage Per Stack | Active | true | base 25/50/75 + 15% bonusAd | needs-count, variant |
| Maximum True Damage | Active | true | base 250/500/750 + 150% bonusAd | derived |

## Vi

### P - Blast Shield  `no-damage-lines`

_No damage lines on the wiki page._

### Q - Vault Breaker  `only-derived-or-non-champion`

| Wiki label | Stage | Type | Parsed | Flags |
|---|---|---|---|---|
| Minimum Physical Damage | Recast | physical | base 40/60/80/100/120 + 60% bonusAd | derived, variant |
| Maximum Physical Damage | Recast | physical | base 100/150/200/250/300 + 150% bonusAd | derived, variant |

### W - Denting Blows  `parsed-with-options`

| Wiki label | Stage | Type | Parsed | Flags |
|---|---|---|---|---|
| Bonus Physical Damage | Passive | physical | base 4/5/6/7/8% + 3.5% per 100 bonusAd | variant |

### E - Relentless Force  `parsed-simple`

| Wiki label | Stage | Type | Parsed | Flags |
|---|---|---|---|---|
| Physical Damage | Active | physical | base 10/35/60/85/110 + 110% ad + 100% ap |  |

### R - Cease and Desist  `parsed-simple`

| Wiki label | Stage | Type | Parsed | Flags |
|---|---|---|---|---|
| Physical Damage | Active | physical | base 150/250/350 + 90% bonusAd |  |

## Jinx

### P - Get Excited!  `no-damage-lines`

_No damage lines on the wiki page._

### Q - Switcheroo!  `no-damage-lines`

_No damage lines on the wiki page._

### W - Zap!  `parsed-simple`

| Wiki label | Stage | Type | Parsed | Flags |
|---|---|---|---|---|
| Physical Damage | Active | physical | base 10/60/110/160/210 + 140% ad |  |

### E - Flame Chompers!  `parsed-simple`

| Wiki label | Stage | Type | Parsed | Flags |
|---|---|---|---|---|
| Magic Damage | Active | magic | base 90/140/190/240/290 + 100% ap |  |

### R - Super Mega Death Rocket!  `only-derived-or-non-champion`

| Wiki label | Stage | Type | Parsed | Flags |
|---|---|---|---|---|
| Maximum Physical Damage |  | physical | base 200/350/500 + 120% bonusAd + 25/30/35% targetMissingHp | derived |
| Minimum Physical Damage |  | physical | base 20/35/50 + 12% bonusAd + 25/30/35% targetMissingHp | derived |
| Maximum Secondary Damage |  | physical | base 160/280/400 + 96% bonusAd + 20/24/28% targetMissingHp | derived, variant |
| Minimum Secondary Damage |  | physical | base 16/28/40 + 9.6% bonusAd + 20/24/28% targetMissingHp | derived, variant |

## Katarina

### P - Voracity  `no-damage-lines`

_No damage lines on the wiki page._

### Q - Bouncing Blade  `parsed-simple`

| Wiki label | Stage | Type | Parsed | Flags |
|---|---|---|---|---|
| Magic Damage | Active | magic | base 80/115/150/185/220 + 40% ap |  |

### W - Preparation  `no-damage-lines`

_No damage lines on the wiki page._

### E - Shunpo  `parsed-simple`

| Wiki label | Stage | Type | Parsed | Flags |
|---|---|---|---|---|
| Magic Damage | Active | magic | base 20/30/40/50/60 + 40% ad + 25% ap |  |

### R - Death Lotus  `needs-work`

| Wiki label | Stage | Type | Parsed | Flags |
|---|---|---|---|---|
| Physical Damage Per Dagger | Active | physical | ⚠ could not parse: unknown stat "per 100% bonus attack speed" | needs-count |
| Maximum Physical Damage | Active | physical | ⚠ could not parse: unknown stat "per 100% bonus attack speed" | derived |
| Magic Damage Per Dagger | Active | magic | base 25/37.5/50 + 19% ap | needs-count |
| Maximum Magic Damage | Active | magic | base 375/562.5/750 + 285% ap | derived |
| On-Hit/On-Attack Damage Effectiveness | Active | multiple | base 25/30/35% |  |

## Garen

### P - Perseverance  `no-damage-lines`

_No damage lines on the wiki page._

### Q - Decisive Strike  `parsed-with-options`

| Wiki label | Stage | Type | Parsed | Flags |
|---|---|---|---|---|
| Bonus Physical Damage |  | physical | base 30/60/90/120/150 + 50% ad | variant |

### W - Courage  `no-damage-lines`

_No damage lines on the wiki page._

### E - Judgment  `parsed-simple`

| Wiki label | Stage | Type | Parsed | Flags |
|---|---|---|---|---|
| Physical Damage Per Spin | Active | physical | base 4/7/10/13/16 + 40/43/46/49/52% ad |  |
| Critical Strike Damage Per Spin | Active | physical | base 5.2/9.1/13/16.9/20.8 + 52/55.9/59.8/63.7/67.6% ad |  |
| IE Damage Per Spin | Active | physical | base 5.56/9.73/13.9/18.07/22.24 + 55.6/59.77/63.94/68.11/72.28% ad |  |

### R - Demacian Justice  `parsed-simple`

| Wiki label | Stage | Type | Parsed | Flags |
|---|---|---|---|---|
| True Damage | Active | true | base 125/200/275 + 25/30/35% targetMissingHp |  |

## Nasus

### P - Soul Eater  `no-damage-lines`

_No damage lines on the wiki page._

### Q - Siphoning Strike  `needs-work`

| Wiki label | Stage | Type | Parsed | Flags |
|---|---|---|---|---|
| Bonus Physical Damage | Active | physical | ⚠ could not parse: unknown stat "of Siphoning Strike stacks" | variant |

### W - Wither  `no-damage-lines`

_No damage lines on the wiki page._

### E - Spirit Fire  `parsed-with-options`

| Wiki label | Stage | Type | Parsed | Flags |
|---|---|---|---|---|
| Magic Damage | Active | magic | base 50/80/110/140/170 + 60% ap |  |
| Magic Damage Per Tick |  | magic | base 10/16/22/28/34 + 12% ap | needs-count |
| Total Magic Damage |  | magic | base 100/160/220/280/340 + 120% ap | derived |

### R - Fury of the Sands  `parsed-with-options`

| Wiki label | Stage | Type | Parsed | Flags |
|---|---|---|---|---|
| Magic Damage Per Tick |  | magic | base 1.5/2/2.5% + 0.5% per 100 ap | needs-count |
| Total Magic Damage |  | magic | base 45/60/75% + 15% per 100 ap | derived |
