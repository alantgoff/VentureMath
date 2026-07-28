# VentureMath

A phone-first calculator for venture case interviews. Three pages — **Fund**,
**Company** and **Calc** — that recompute on every keystroke and show the
substituted formula under every number, so you can read your reasoning out
loud instead of reconstructing it.

Live at **https://alantgoff.github.io/VentureMath/**

Add it to your home screen (Share → Add to Home Screen) and it runs standalone
and offline.

## Fund

Defaults to a $400M fund, 2% fees stepping down after a 5-year investment
period, 20% carry, 10-year life.

- **Fees over life** — flat or stepped-down, with the year-by-year schedule
- **Investable capital** — net of fees, expenses and recycling, and the
  multiple on invested capital needed just to return the fund
- **Gross vs net** — gross distributions needed for a target net multiple via
  `D = F(n − c) ÷ (1 − c)`, the carry split, and both IRRs
- **Fund returners** — the exit that returns the fund at your ownership, the
  ownership needed at a given exit, how many returners the target implies
- **Portfolio construction** — company count, implied entry post-money,
  reserves per company, and what share of the portfolio has to be a returner

## Company

Defaults to $4M for 10% on a $40M post, 1x non-participating.

- **Entry** — solve for ownership, post-money or check from the other two;
  pre-money and round dilution fall out
- **Preference** — Zx multiple, participating with an optional cap, plus
  senior and pari passu preference stacked around you
- **Dilution** — any number of rounds, each by dilution % or round size over
  post-money, with option pool refresh and pro-rata follow-ons
- **Outcomes** — proceeds, MOIC and IRR across a row of exit values, each
  labeled with whether the preference or common ownership governed
- **Thresholds** — breakeven exit, the pref-to-common crossover, the exit for
  a target multiple, and the exit that returns the fund size set on the Fund
  page

## Calc

A plain arithmetic keypad with K/M/B and % keys, a running result as you type,
and a tape of the last dozen lines you kept.

Its real job is **show my work**. Every formula line on the Fund and Company
pages is tappable — including the ones under each row of the exit table. Tap
one and the Calc page opens with that formula broken into one step per
operation, and its arithmetic already loaded into the keypad so you can change
a number and watch the answer move:

```
Ownership at exit
10.0% × (1 − 20.0%) × (1 − 20.0%) × (1 − 15.0%) = 5.44%
  1. 1 − 20.0% = 0.8
  2. 10.0% × 0.8 = 0.08
  3. 1 − 20.0% = 0.8
  4. 0.08 × 0.8 = 0.064
  5. 1 − 15.0% = 0.85
  6. 0.064 × 0.85 = 0.0544
```

Some results — the breakeven exit, the exit for a target multiple — are solved
by search rather than by one expression. Tapping those says so instead of
inventing steps for them.

### Entering numbers

A bare number in a dollar field means **millions** — type `400` for $400M.
Suffixes override it: `1.4b`, `500k`. Percent fields read `20` as 20%.
Everything persists to local storage, so the app reopens where you left it.

## Modeling assumptions

- The carry waterfall is whole-fund European with no hurdle or GP catch-up.
  Below a 1x target there is no profit to carry, so gross equals net.
- On conversion to common, senior and pari passu preferences are assumed to
  still take their money off the top, so your converted value is
  `ownership × (exit − those prefs)`.
- Follow-on checks add to both your invested basis and your preference claim.
- Recycling is a flat percentage of the fund rather than time-weighted.

## Development

```sh
npm install
npm run dev      # local dev server
npm test         # 74 tests over the fund, waterfall and formula maths
npm run build    # production build into dist/
npm run icons    # regenerate the app icons
```

All arithmetic lives in `src/lib/fund.js` and `src/lib/startup.js` as pure
functions that return `{ v, f }` — the value and the formula string that
produced it. The React layer only renders; it never computes. If you change a
number, change it there and the displayed formula follows.

`src/lib/expr.js` reads those formula strings back for the Calc page. Because
that means guessing at prose, `extract` throws away any reading that does not
reproduce the value it came from, and a test walks every result the app can
produce to insist the two never quietly disagree.

## Deploying

`.github/workflows/deploy.yml` runs the tests, builds, and publishes to GitHub
Pages on every push to `main` (and, for now, to the feature branch). Two
one-time settings are needed before the deploy step can succeed:

1. **Settings → Pages → Source: GitHub Actions.** The workflow token is not
   allowed to enable Pages itself, so this has to be clicked once.
2. **The repository must be public**, unless the account is on GitHub Pro or
   Team — Pages does not serve private repositories on the free plan.

Until then the build and test steps still pass and the deploy step is the only
thing that fails.
