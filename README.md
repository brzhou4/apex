# APEX — prototype

A runnable prototype of the APEX core loop: **onboarding → baseline → daily tiered tasks → XP/level → streak → spin wheel → leaderboard → squad → rival duels → profile/health**. Vite + React front end; an optional Node server adds a Claude-backed goal parser. App state lives in `localStorage`.

## Run

```bash
npm install
npm run dev          # front end (works fully on its own)
```

Open the printed URL (mobile-width layout, ~375px).

### Optional: Claude goal parser (real LLM)

```bash
export ANTHROPIC_API_KEY=sk-ant-...   # key stays server-side, never shipped to the browser
npm run server                         # starts the parser API on :8787
```

With the server + key running, onboarding parses your dream goal with **Claude (`claude-opus-4-8`, structured outputs)** and the Gap Analysis shows "🤖 parsed by Claude". Without it, the app falls back to the local rule-based parser automatically — no errors, no setup required. The front end proxies `/api` → `:8787` (see `vite.config.js`).

## What's implemented (from the plan)

| Plan section | Status |
|---|---|
| §4 Onboarding — Dream Goal → **Baseline intake** → Gap Analysis → Roadmap | ✅ score from real inputs; goal parsed by **Claude** when the server is running, else rule-based |
| §5.5 Rival Duels | ✅ 7-day 1v1 vs a rival; your completions score points, opponent grinds each day, auto-resolves win/lose/tie |
| §7 Health integrations | ✅ "Connect Apple Health" pulls a (simulated) snapshot — steps/sleep/HRV/resting HR — and auto-logs your steps task |
| §3 Three pillars (Mind/Body/Intellect) daily tasks | ✅ 1 task/pillar/day, **tiered Bronze→Diamond** |
| Custom tasks | ✅ set a Gold target, tiers auto-scale (Gold 8k → Platinum 10k → Diamond 12.8k) |
| §5.4 Level & rank bands | ✅ Rookie→APEX from total XP, **level-up celebration** |
| §5.6 Streaks + milestones | ✅ **daily rollover engine**: streak breaks on a missed day, Streak Shield absorbs one; 7/30/100/365 milestones reward coins + shield |
| §5.2 Two-currency (XP + Coins) | ✅ |
| §5.3 Daily Spin Wheel | ✅ animated SVG, probability-weighted outcomes, 2nd spin when all tasks done |
| §5.5 Leagues / leaderboard | ✅ weekly XP ranking (mock rivals) |
| §5.7 Squad system | ✅ XP pool, daily 1-tap check-in, accountability status, nudges, Squad War vs rival squad |
| §6.4 Profile / Weekly Review | ✅ tap the HUD: Human Score + **trend sparkline**, **re-baseline** (snapshots history), rule-based weekly insight, streak stats, cosmetics |

## Testing day-rollover

Tasks/spins reset and streaks are evaluated when the date changes. Use the **"simulate next day"** link in the dashboard footer to fast-forward: complete all tasks first to see the streak survive, or skip them to see it break (or a Streak Shield get consumed).

## Deliberately faked / deferred

- **Human Score weightings** → the formula (`computeHumanScore`) is transparent and input-driven, but the relative weights are reasonable guesses, not clinically validated.
- **Squad teammates & rival opponent** → static/mock; check-ins, nudges, and duel opponent progress are local only (no real users, DMs, or push).
- **Health import is simulated** → `generateHealthSnapshot()` fabricates plausible numbers. A real build uses Apple HealthKit / Google Health Connect (native permissions + OAuth), not buildable in a web prototype.
- **Wagered spins, real prizes** → not built.

## Structure

- `src/game.js` — pure game logic + persistence: scoring, tier ladders, spin odds, daily `rollForward` engine, squad, duels, health, insights (framework-agnostic; the part that would move to a real backend).
- `src/api.js` — client wrapper for the Claude goal parser, with local fallback.
- `server/index.js` — Express API holding the Anthropic key, calling Claude with structured outputs.
- `src/App.jsx` — all UI (Onboarding, Dashboard, SpinWheel, Leaderboard, Squad, RivalDuel, Profile).
- `src/styles.css` — dark, game-like theme.

Reset all state via the "reset" link at the bottom of the dashboard.
