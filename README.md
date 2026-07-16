# APEX — prototype

A runnable prototype of the APEX core loop: **onboarding → baseline → daily tiered tasks → XP/level → streak → spin wheel → leaderboard → squad → rival duels → profile/health**. Vite + React front end; an optional Node server adds a Claude-backed goal parser. App state lives in `localStorage`.

## Run

```bash
npm install
npm run dev          # front end (works fully on its own)
```

Open the printed URL (mobile-width layout, ~375px).

### Optional: Claude goal parser + AI plans (real LLM)

Two ways to power it — pick either:

```bash
# Option A: an API key (billed to your Anthropic console account)
export ANTHROPIC_API_KEY=sk-ant-...   # key stays server-side, never shipped to the browser
npm run server                         # starts the API on :8787

# Option B: no key — headless Claude Code on your Claude subscription
npm i -g @anthropic-ai/claude-code     # once
claude                                 # once — run /login, then exit
npm run server
```

With the server running (either way):
- onboarding parses your dream goal with **Claude** (`/api/parse-goal`, structured outputs), and
- **every goal gets a personalized 8-week plan written by Claude** (`/api/plan-goal`, `claude-sonnet-5`) — any goal works, from "score a 1600" to "own a capybara"; plans show a "✦ AI plan" badge in the Dream tab.

Without the server, the app falls back to local rule-based templates automatically — no errors, no setup required. The front end proxies `/api` → `:8787` (see `vite.config.js`).

### Optional: Butterbase backend (accounts + shared feed)

APEX is offline-first — but point it at [Butterbase](https://butterbase.ai) and it grows real user accounts, cloud profile sync, and a **shared live feed** (posts, comments, likes land in Postgres and show up for every signed-in user):

```bash
npx @butterbase/cli login                            # paste your Butterbase API key (free tier works)
npx @butterbase/cli apps create apex                 # note the app_... id it prints
npx @butterbase/cli schema apply butterbase/schema.json
cp .env.example .env                                 # then set VITE_BUTTERBASE_APP_ID=app_...
```

Sign in from **Settings → Cloud**. Without the env vars, the cloud card shows these setup steps and everything else behaves exactly as before.

## What APEX records (and why)

APEX is an instrument, so it discloses its own measurements. Locally (and in
Butterbase when you're signed in), the app records the full lifecycle of every
prediction: what you predicted, your confidence, when you committed, and how
it ended — **resolved** (camera-verified), **voided** (camera failure — an
instrument problem, never blamed on you), or **abandoned** (you walked away —
which is honest data too). The headline metric is the *resolution rate*: no
resolution, no learning. Nothing is sold, nothing feeds ads, and the
preregistered claims this data will test live in [PREDICTIONS.md](PREDICTIONS.md).

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
