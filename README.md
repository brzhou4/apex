# APEX

**Your next opponent is you.**

APEX is a camera-verified self-improvement app built around one idea: you get better at judgment by **committing to a prediction before reality answers, then comparing**. Onboard with a dream goal, get a personalized 8-week plan, and do daily tiered tasks — but before each timed session you predict how long you'll actually work, the number stays hidden, and the verified clock resolves it. The gap is the lesson.

Live: **[apexlocked.vercel.app](https://apexlocked.vercel.app)** · Vite + React, offline-first, state in `localStorage`.

The product philosophy lives in [CONSTITUTION.md](CONSTITUTION.md); the company's own preregistered, falsifiable claims live in [PREDICTIONS.md](PREDICTIONS.md).

## Run

```bash
npm install
npm run dev          # front end (works fully on its own, mobile-width ~375px)
```

### Optional: AI-written plans (real Claude)

With a backend running, onboarding parses your dream goal with Claude and **every goal gets a personalized 8-week plan** (`claude-sonnet-5`) — any goal works, from "score a 1600" to "own a capybara." Without one, the app falls back to local rule-based templates automatically — no errors, no setup. Three ways to power it:

```bash
# Option A — Anthropic API key (key stays server-side, never shipped to the browser)
export ANTHROPIC_API_KEY=sk-ant-...
npm run server        # API on :8787; front end proxies /api → :8787 (see vite.config.js)

# Option B — no key: headless Claude Code on your Claude subscription
npm i -g @anthropic-ai/claude-code
claude setup-token    # one-time browser login; store the token in .env as CLAUDE_CODE_OAUTH_TOKEN
npm run server        # server auto-loads .env

# Option C — deployed on Vercel: the serverless functions fall back to the
# Butterbase AI gateway (set BUTTERBASE_API_KEY) so plans work in prod with no
# Anthropic key. This is how apexlocked.vercel.app serves live AI plans.
```

### Optional: Butterbase backend (accounts + shared feed)

APEX is offline-first — but point it at [Butterbase](https://butterbase.ai) and it grows real accounts, cloud profile sync, and a **shared live feed** (posts, comments, likes in Postgres, visible to every signed-in user):

```bash
npx @butterbase/cli login                            # paste your Butterbase API key (free tier works)
npx @butterbase/cli apps create apex                 # note the app_... id it prints
npx @butterbase/cli schema apply butterbase/schema.json
cp .env.example .env                                 # then set VITE_BUTTERBASE_APP_ID=app_...
```

Sign in from **Settings → Cloud**. Without the env vars, the cloud card shows these setup steps and everything else behaves exactly as before.

## The prediction protocol (and what APEX records)

APEX is an instrument, so it discloses its own measurements. Before each timed session you commit a prediction ("how many minutes will you *actually* work?") with a confidence. The number is **hidden during the session** — reward may motivate exposure, but it must never distort the measurement. On finish, the verified clock resolves it and shows a receipt: prediction vs. reality, no interpretation. XP rewards the *exposure* of an honest resolution, never being right.

Locally (and in Butterbase when signed in) the app records the full lifecycle of every prediction — what you predicted, your confidence, when you committed, and how it ended:

- **resolved** — camera-verified
- **voided** — camera failure (an instrument problem, never blamed on you)
- **abandoned** — you walked away (honest data too)

The headline metric is the *resolution rate*: no resolution, no learning. Nothing is sold, nothing feeds ads. After enough evidence, an **Evidence Review** asks the one question that closes the loop — "what will you change?" — and the preregistered claims this data tests live in [PREDICTIONS.md](PREDICTIONS.md).

## What's implemented

| Area | Status |
|---|---|
| Onboarding — Dream Goal → **goal-relevant baseline** → Gap Analysis → 8-week plan | ✅ baseline only measures pillars your dream needs; plan written by **Claude** when a backend is up, else rule-based |
| Prediction protocol | ✅ commit-before-observe, hidden prediction, verified resolution, receipt, funnel (resolved/voided/abandoned), Evidence Review |
| Three pillars (Mind/Body/Intellect) daily tasks | ✅ tiered Bronze→APEX, custom tasks with auto-scaling tiers |
| Level & rank bands, streaks + milestones | ✅ Rookie→APEX from XP; daily rollover engine, Streak Shields, 7/30/100/365 milestones |
| Daily Spin Wheel, leagues/leaderboard, squads, rival duels | ✅ animated SVG wheel; weekly XP ranking; squad XP pool + check-ins; 7-day 1v1 duels |
| Pet | ✅ names, colors, evolves on evidence (Pup → … → Apex Dragon) |
| Profile / Judgment card | ✅ Human Score + trend sparkline, re-baseline, calibration gated until enough resolutions |
| Cloud | ✅ accounts, profile sync, shared feed via Butterbase |

Use the **"simulate next day"** link in the dashboard footer to fast-forward the rollover engine; **"reset"** clears all state.

## Architecture

State is one unified object in `useApexState()` (App.jsx), but persistence is **split hot/cold** across two `localStorage` keys so a task toggle never re-serializes the append-only logs:

- `apex.core.v5` — small, frequently-mutated state; saved on nearly every change (cheap).
- `apex.history.v5` — append-only logs (`predictions`, `proofLog`, `tierLog`, `reviews`, `scoreHistory`), re-serialized *only* when one of those references actually changes (two effects with disjoint dependency arrays). `loadState()` migrates the legacy `apex.state.v4` blob and retires it.

### Structure

- `src/game.js` — pure logic + persistence: scoring, tier ladders, spin odds, the daily `rollForward` engine, prediction stats, squads, duels, health. Framework-agnostic.
- `src/ui.jsx` — shared stateless primitives (`Ic`, `Field`, `ScoreBar`, `Sparkline`, `PageHead`, `Stat`, …).
- `src/App.jsx` — the shell only: `App`, `useApexState`, `Dashboard`, `TaskBox`, `StreakSplash`.
- `src/features/` — one module per view: `Onboarding`, `Profile`, `Feed`, `Arena`, `Settings`, `Plan`, `Shop`, `Pet`, `SpinWheel`, `Prediction`.
- `src/Proof.jsx` / `src/proof.js` — camera recorder (getUserMedia → canvas stills → timelapse) + IndexedDB store.
- `src/api.js` / `src/backend.js` — client wrappers for the AI endpoints and Butterbase.
- `server/index.js` — Express API (dev): Anthropic key path + headless Claude Code fallback.
- `api/*.js` — Vercel serverless twins: Anthropic key path + Butterbase AI gateway fallback.
- `scripts/check-refs.mjs` — Babel-based checker that flags undeclared references (missing imports a `vite build` won't catch). Run `node scripts/check-refs.mjs src/features/Feed.jsx`.

## Deliberately faked / deferred

- **Human Score weightings** — the formula (`computeHumanScore`) is transparent and input-driven, but the weights are reasonable guesses, not clinically validated.
- **Squad teammates & rival opponents** — static/mock; check-ins, nudges, and duel progress are local only.
- **Health import is simulated** — `generateHealthSnapshot()` fabricates plausible numbers; a real build uses Apple HealthKit / Google Health Connect.
- **Aggregate calibration** — gated until enough resolutions exist to mean anything ("we don't know yet" is a first-class answer).
