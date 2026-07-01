import { useEffect, useMemo, useRef, useState } from 'react'
import {
  PILLARS, rankForLevel, levelFromXp, parseDreamGoal, buildDailyTasks,
  computeHumanScore, buildRoadmap, WHEEL, spinOutcome, buildLeaderboard,
  buildSquad, squadTotalXp, membersAwaitingCheckin, userCheckedIn,
  TIERS, TIER_COLORS, makeCustomTask,
  rollForward, addDays, daysBetween, STREAK_MILESTONES, weeklyInsight,
  buildDuel, generateHealthSnapshot,
  loadState, saveState, resetState, todayKey,
} from './game.js'
import { parseDreamGoalRemote } from './api.js'

export default function App() {
  const [state, setState] = useState(() => {
    const s = loadState()
    return s ? rollForward(s) : s
  })
  useEffect(() => { if (state) saveState(state) }, [state])

  if (!state) return <Onboarding onDone={setState} />
  return <Dashboard state={state} setState={setState} />
}

/* ---------------- Onboarding ---------------- */

const EMPTY_BASELINE = {
  age: '', heightFt: '', heightIn: '', weightLbs: '', sex: '',
  steps: '', workouts: '', sleepHrs: '', stress: '5', meditDays: '',
  gradeLevel: '', studyHrs: '', skill: '5',
}

function Onboarding({ onDone }) {
  const [step, setStep] = useState(0)
  const [goal, setGoal] = useState('')
  const [bl, setBl] = useState(EMPTY_BASELINE)
  const [parsed, setParsed] = useState(null)
  const [parsing, setParsing] = useState(false)
  const score = useMemo(() => computeHumanScore(bl), [bl])

  const examples = [
    'Become a senior software engineer',
    'Get shredded and run a marathon',
    'Launch a profitable startup',
    'Master my finances and invest',
  ]

  const baselineReady = isBaselineReady(bl)
  const set = (k) => (e) => setBl((b) => ({ ...b, [k]: e.target.value }))

  // Parse the goal via the Claude API (falls back to the local parser), then advance.
  async function goToBaseline() {
    setParsing(true)
    const p = await parseDreamGoalRemote(goal)
    setParsed(p)
    setParsing(false)
    setStep(1)
  }

  function finish() {
    const p = parsed || parseDreamGoal(goal)
    const sc = computeHumanScore(bl)
    onDone({
      name: 'You',
      dreamGoal: goal.trim(),
      parsed: p,
      baseline: bl,
      score: sc,
      scoreHistory: [{ date: todayKey(), total: sc.total, mind: sc.mind, body: sc.body, intellect: sc.intellect }],
      roadmap: buildRoadmap(p),
      tasks: buildDailyTasks(p, bl),
      squad: buildSquad('You'),
      duel: buildDuel(),
      health: null,
      xp: 0,
      coins: 200,
      streak: 0,
      longestStreak: 0,
      milestonesHit: [],
      shields: 0,
      lastActiveDay: todayKey(),
      spunOn: null,
      cosmetics: [],
      xpBoost: 1,
    })
  }

  return (
    <div className="app">
      <div className="brand">A P E X</div>
      <div className="tagline">Every version of you should embarrass the last.</div>

      {step === 0 && (
        <div className="card">
          <div className="onb-q">Where do you want to be in 5 years? Don’t hold back.</div>
          <textarea
            placeholder="Type your dream goal…"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
          <div className="chips">
            {examples.map((ex) => (
              <span key={ex} className="chip" onClick={() => setGoal(ex)}>{ex}</span>
            ))}
          </div>
          <button className="btn" disabled={!goal.trim() || parsing} onClick={goToBaseline}>
            {parsing ? 'Analyzing your goal…' : 'Next: baseline →'}
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="card">
          <h3>Baseline Assessment</h3>
          <div className="sub" style={{ marginBottom: 8 }}>Real numbers in, real score out. Nothing leaves your device.</div>
          <BaselineFields bl={bl} set={set} />
          <button className="btn ghost" onClick={() => setStep(0)} style={{ marginTop: 8 }}>← Back</button>
          <button className="btn" disabled={!baselineReady} onClick={() => setStep(2)}>
            {baselineReady ? 'Calculate my Human Score →' : 'Fill the required fields'}
          </button>
        </div>
      )}

      {step === 2 && (
        <>
          <div className="card">
            <h3>Gap Analysis</h3>
            <div className="sub">Detected domain: <b style={{ color: 'var(--text)' }}>{parsed?.domainLabel}</b> · {parsed?.motivation} motivation {parsed?.source === 'claude' ? '· 🤖 parsed by Claude' : '· rule-based'}</div>
            <div className="score-big">{score.total}</div>
            <div className="sub" style={{ textAlign: 'center' }}>your Human Score{score.bmi ? ` · BMI ${score.bmi.toFixed(1)}` : ''}</div>
            <ScoreBar label="🧠 Mind" value={score.mind} color="var(--mind)" />
            <ScoreBar label="💪 Body" value={score.body} color="var(--body)" />
            <ScoreBar label="📚 Intellect" value={score.intellect} color="var(--intellect)" />
            <div className="sub" style={{ marginTop: 12 }}>
              You’re a <b style={{ color: 'var(--text)' }}>{score.total}</b>. Your goal requires a{' '}
              <b style={{ color: 'var(--accent)' }}>{score.target}</b>. Here’s your roadmap.
            </div>
          </div>
          <div className="card">
            <h3>Your 4-Week Roadmap</h3>
            {buildRoadmap(parsed).map((r) => (
              <div className="task" key={r.week}>
                <div className="ic">{r.week}</div>
                <div className="grow"><div className="tt">Week {r.week}</div><div className="meta">{r.focus}</div></div>
              </div>
            ))}
            <button className="btn ghost" onClick={() => setStep(1)}>← Edit baseline</button>
            <button className="btn" onClick={finish}>Start leveling up →</button>
          </div>
        </>
      )}
      <div className="foot">Prototype · score from your baseline · rule-based stand-in for the LLM</div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}

// The required fields that drive a meaningful score.
export function isBaselineReady(bl) {
  return !!(bl.heightFt && bl.weightLbs && bl.steps !== '' &&
    bl.sleepHrs !== '' && bl.studyHrs !== '' && bl.gradeLevel)
}

// Shared baseline intake — used by onboarding and re-baselining in Profile.
function BaselineFields({ bl, set }) {
  return (
    <>
      <div className="form-section">💪 Body</div>
      <div className="form-grid">
        <Field label="Age"><input type="number" value={bl.age} onChange={set('age')} placeholder="yrs" /></Field>
        <Field label="Sex">
          <select value={bl.sex} onChange={set('sex')}>
            <option value="">—</option><option>Male</option><option>Female</option><option>Other</option>
          </select>
        </Field>
        <Field label="Height">
          <div className="inline">
            <input type="number" value={bl.heightFt} onChange={set('heightFt')} placeholder="ft" />
            <input type="number" value={bl.heightIn} onChange={set('heightIn')} placeholder="in" />
          </div>
        </Field>
        <Field label="Weight"><input type="number" value={bl.weightLbs} onChange={set('weightLbs')} placeholder="lbs" /></Field>
        <Field label="Avg daily steps"><input type="number" value={bl.steps} onChange={set('steps')} placeholder="e.g. 6000" /></Field>
        <Field label="Workouts / week"><input type="number" value={bl.workouts} onChange={set('workouts')} placeholder="0–7" /></Field>
        <Field label="Sleep (hrs/night)"><input type="number" value={bl.sleepHrs} onChange={set('sleepHrs')} placeholder="e.g. 7" /></Field>
      </div>

      <div className="form-section">🧠 Mind</div>
      <div className="form-grid">
        <Field label={`Stress (1–10): ${bl.stress}`}>
          <input type="range" min="1" max="10" value={bl.stress} onChange={set('stress')} />
        </Field>
        <Field label="Meditate (days/wk)"><input type="number" value={bl.meditDays} onChange={set('meditDays')} placeholder="0–7" /></Field>
      </div>

      <div className="form-section">📚 Intellect</div>
      <div className="form-grid">
        <Field label="Education level">
          <select value={bl.gradeLevel} onChange={set('gradeLevel')}>
            <option value="">—</option>
            <option>Middle school</option><option>High school</option><option>College</option>
            <option>Grad school</option><option>Working professional</option>
          </select>
        </Field>
        <Field label="Study/learn (hrs/wk)"><input type="number" value={bl.studyHrs} onChange={set('studyHrs')} placeholder="e.g. 5" /></Field>
        <Field label={`Skill in goal (1–10): ${bl.skill}`}>
          <input type="range" min="1" max="10" value={bl.skill} onChange={set('skill')} />
        </Field>
      </div>
    </>
  )
}

// Tiny SVG sparkline for the score-history trend.
function Sparkline({ points, color = 'var(--accent)' }) {
  if (!points || points.length < 2) {
    return <div className="sub" style={{ marginTop: 6 }}>Take another baseline to start your trend line.</div>
  }
  const w = 280, h = 60, pad = 4
  const xs = points.map((_, i) => pad + (i * (w - pad * 2)) / (points.length - 1))
  const min = Math.min(...points), max = Math.max(...points)
  const span = max - min || 1
  const ys = points.map((p) => h - pad - ((p - min) / span) * (h - pad * 2))
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ marginTop: 8 }}>
      <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {xs.map((x, i) => <circle key={i} cx={x} cy={ys[i]} r="3" fill={color} />)}
    </svg>
  )
}

function ScoreBar({ label, value, color }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div className="score-row"><span>{label}</span><span>{value}/1000</span></div>
      <div className="bar"><i style={{ width: `${(value / 1000) * 100}%`, background: color }} /></div>
    </div>
  )
}

const fmtThreshold = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : n)

function TaskRow({ task, onLog, onRemove }) {
  const p = PILLARS[task.pillar]
  const achieved = task.achievedTier
  return (
    <div className={`task-card ${achieved != null ? 'done' : ''}`}>
      <div className="task-head">
        <span className="ic">{p.icon}</span>
        <div className="grow">
          <div className="tt">{task.title}</div>
          <div className="meta">
            {p.label}
            {achieved != null
              ? <> · <b style={{ color: TIER_COLORS[TIERS[achieved]] }}>{TIERS[achieved]}</b> logged</>
              : <> · tap a tier to log</>}
          </div>
        </div>
        {onRemove && <span className="link" onClick={() => onRemove(task.id)}>remove</span>}
      </div>
      <div className="tiers">
        {task.tiers.map((tier, i) => {
          const hit = achieved != null && i <= achieved
          const locked = achieved != null && i <= achieved
          return (
            <button
              key={tier.name}
              className={`tier ${hit ? 'hit' : ''}`}
              style={hit ? { borderColor: TIER_COLORS[tier.name], color: TIER_COLORS[tier.name] } : undefined}
              disabled={locked}
              onClick={() => onLog(task.id, i)}
              title={`${tier.name}: ${tier.threshold} ${task.unit} · ${tier.xp} XP`}
            >
              <span className="tier-name">{tier.name}</span>
              <span className="tier-thr">{fmtThreshold(tier.threshold)} {task.unit}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CustomTaskCreator({ onAdd }) {
  const [open, setOpen] = useState(false)
  const [pillar, setPillar] = useState('BODY')
  const [title, setTitle] = useState('')
  const [unit, setUnit] = useState('reps')
  const [goldTarget, setGoldTarget] = useState('')

  function submit() {
    if (!title.trim() || !goldTarget) return
    onAdd({ pillar, title: title.trim(), unit: unit.trim() || 'units', goldTarget })
    setTitle(''); setGoldTarget(''); setUnit('reps'); setOpen(false)
  }

  if (!open) {
    return (
      <button className="btn ghost" onClick={() => setOpen(true)} style={{ marginTop: 14 }}>
        + Create your own task
      </button>
    )
  }
  return (
    <div className="card">
      <h3>New custom task</h3>
      <div className="form-grid">
        <Field label="Pillar">
          <select value={pillar} onChange={(e) => setPillar(e.target.value)}>
            <option value="BODY">💪 Body</option>
            <option value="MIND">🧠 Mind</option>
            <option value="INTELLECT">📚 Intellect</option>
          </select>
        </Field>
        <Field label="Unit"><input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="reps, min, pages…" /></Field>
        <Field label="Task name"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Push-ups" /></Field>
        <Field label="Gold target"><input type="number" value={goldTarget} onChange={(e) => setGoldTarget(e.target.value)} placeholder="e.g. 8000" /></Field>
      </div>
      {goldTarget && (
        <div className="sub" style={{ marginTop: 8 }}>
          Tiers auto-scale: Gold {fmtThreshold(Number(goldTarget))} → Platinum {fmtThreshold(Math.round(Number(goldTarget) * 1.25))} → Diamond {fmtThreshold(Math.round(Number(goldTarget) * 1.6))} {unit}
        </div>
      )}
      <button className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
      <button className="btn" disabled={!title.trim() || !goldTarget} onClick={submit}>Add task</button>
    </div>
  )
}

/* ---------------- Dashboard ---------------- */

function Dashboard({ state, setState }) {
  const [tab, setTab] = useState('home')
  const [toast, setToast] = useState(null)
  const lvl = levelFromXp(state.xp)
  const rank = rankForLevel(lvl.level)

  // Backfill squad/duel for states saved before those features existed.
  useEffect(() => {
    if (!state.squad) setState((s) => ({ ...s, squad: buildSquad(s.name) }))
    if (!state.duel) setState((s) => ({ ...s, duel: buildDuel() }))
  }, [state.squad, state.duel, setState])

  function flash(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 2200)
  }

  // Announce the result of a day-rollover (streak broke / shield saved it).
  useEffect(() => {
    const note = state._rolloverNote
    if (note && note !== 'clean') {
      flash(note === 'shield' ? '🛡️ Streak Shield used — streak saved!' : '💔 Streak broke — fresh start today')
      setState((s) => ({ ...s, _rolloverNote: null }))
    } else if (note === 'clean') {
      setState((s) => ({ ...s, _rolloverNote: null }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state._rolloverNote])

  // Log a task at a tier. Higher tier = more XP; you can only upgrade, and
  // you're awarded the *difference* in XP so re-logging higher feels fair.
  function logTier(id, tierIndex) {
    const task = state.tasks.find((t) => t.id === id)
    if (!task) return
    if (task.achievedTier != null && tierIndex <= task.achievedTier) return
    const prevXp = task.achievedTier != null ? task.tiers[task.achievedTier].xp : 0
    const delta = Math.round((task.tiers[tierIndex].xp - prevXp) * (state.xpBoost || 1))
    const boosted = state.xpBoost > 1
    const firstCompletion = task.achievedTier == null

    const tasksAfter = state.tasks.map((t) => (t.id === id ? { ...t, achievedTier: tierIndex } : t))
    const everyDone = tasksAfter.every((t) => t.achievedTier != null)
    const wasEveryDone = state.tasks.every((t) => t.achievedTier != null)
    const completedToday = everyDone && !wasEveryDone
    const newStreak = completedToday ? (state.streak || 0) + 1 : state.streak || 0
    const oldLevel = levelFromXp(state.xp).level
    const newLevel = levelFromXp(state.xp + delta).level
    const milestone = completedToday && STREAK_MILESTONES.includes(newStreak) &&
      !(state.milestonesHit || []).includes(newStreak) ? newStreak : null

    setState((s) => ({
      ...s,
      tasks: tasksAfter,
      xp: s.xp + delta,
      coins: s.coins + (firstCompletion ? 20 : 0) + (milestone ? 200 : 0),
      xpBoost: 1,
      streak: newStreak,
      longestStreak: Math.max(s.longestStreak || 0, newStreak),
      shields: milestone ? (s.shields || 0) + 1 : s.shields,
      milestonesHit: milestone ? [...(s.milestonesHit || []), milestone] : s.milestonesHit,
      // Each first task completion scores a point in the active rival duel.
      duel: firstCompletion && s.duel && s.duel.status === 'active'
        ? { ...s.duel, userScore: s.duel.userScore + 1 }
        : s.duel,
    }))

    if (newLevel > oldLevel) flash(`⬆️ LEVEL UP — Level ${newLevel}!`)
    else if (milestone) flash(`🔥 ${milestone}-day streak! +200 coins, +1 shield`)
    else if (completedToday) flash(`✅ All tasks done! Streak ${newStreak} 🔥`)
    else flash(`${TIERS[tierIndex]}! +${delta} XP${boosted ? ' (boosted!)' : ''}`)
  }

  function addCustomTask(t) {
    setState((s) => ({ ...s, tasks: [...s.tasks, makeCustomTask(t)] }))
    flash(`Added "${t.title}"`)
  }

  function removeTask(id) {
    setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }))
  }

  // Dev helper: pretend a day passed so rollover (streak break / shield / reset) is testable.
  function simulateNextDay() {
    setState((s) => {
      const next = rollForward({ ...s, lastActiveDay: addDays(todayKey(), -1) }, todayKey())
      return next
    })
    flash('⏭️ Simulated a new day')
  }

  function reBaseline(newBaseline) {
    const sc = computeHumanScore(newBaseline)
    setState((s) => ({
      ...s,
      baseline: newBaseline,
      score: sc,
      scoreHistory: [...(s.scoreHistory || []), { date: todayKey(), total: sc.total, mind: sc.mind, body: sc.body, intellect: sc.intellect }],
    }))
    flash(`Re-baselined — Human Score ${sc.total}`)
  }

  // Pull a (simulated) wearable snapshot and auto-log the steps task to the tier it earns.
  function syncHealth() {
    const snap = generateHealthSnapshot()
    setState((s) => ({ ...s, health: snap }))
    const stepsTask = state.tasks.find((t) => t.id === 't-body')
    if (stepsTask) {
      let tier = -1
      stepsTask.tiers.forEach((t, i) => { if (snap.steps >= t.threshold) tier = i })
      if (tier >= 0 && (stepsTask.achievedTier == null || tier > stepsTask.achievedTier)) {
        logTier('t-body', tier)
        return
      }
    }
    flash(`Synced ${snap.steps.toLocaleString()} steps · ${snap.sleepHrs}h sleep`)
  }

  const allDone = state.tasks.length > 0 && state.tasks.every((t) => t.achievedTier != null)

  return (
    <div className="app">
      <div className="brand">A P E X</div>

      <div className="card hud-card" onClick={() => setTab('profile')} title="Open profile">
        <div className="hud">
          <div className="avatar">{(state.name || 'Y')[0]}</div>
          <div className="grow">
            <div className="lvl">Level {lvl.level} · {rank}</div>
            <div className="rank">{state.parsed?.domainLabel}</div>
          </div>
          {state.shields > 0 && <span className="pill" style={{ color: 'var(--body)' }}>🛡️ {state.shields}</span>}
          <span className="pill flame">🔥 {state.streak}</span>
          <span className="pill coin">🪙 {state.coins}</span>
        </div>
        <div className="bar xpbar" style={{ marginTop: 12 }}>
          <i style={{ width: `${(lvl.xpInto / lvl.xpNeeded) * 100}%` }} />
        </div>
        <div className="xp-meta"><span>{lvl.xpInto} / {lvl.xpNeeded} XP</span><span>{state.xpBoost > 1 ? `${state.xpBoost}× boost ready` : 'tap for profile →'}</span></div>
      </div>

      <div className="view" key={tab}>
        {tab === 'home' && (
          <>
            <div className="card">
              <h3>Today’s Tasks {allDone && '✅'}</h3>
              {state.tasks.map((t) => (
                <TaskRow key={t.id} task={t} onLog={logTier} onRemove={t.custom ? removeTask : null} />
              ))}
              {allDone && <div className="sub" style={{ marginTop: 10 }}>All done — streak extended and a 2nd spin unlocked. 🔥</div>}
            </div>
            <CustomTaskCreator onAdd={addCustomTask} />
          </>
        )}

        {tab === 'spin' && <SpinWheel state={state} setState={setState} flash={flash} allDone={allDone} />}
        {tab === 'league' && <Leaderboard state={state} xp={state.xp} />}
        {tab === 'squad' && <Squad state={state} setState={setState} flash={flash} />}
        {tab === 'profile' && <Profile state={state} onReBaseline={reBaseline} onSyncHealth={syncHealth} onBack={() => setTab('home')} />}
      </div>

      <div className="tabs">
        <div className={`tab ${tab === 'home' ? 'active' : ''}`} onClick={() => setTab('home')}>🏠 Today</div>
        <div className={`tab ${tab === 'spin' ? 'active' : ''}`} onClick={() => setTab('spin')}>🎰 Spin</div>
        <div className={`tab ${tab === 'league' ? 'active' : ''}`} onClick={() => setTab('league')}>🏆 League</div>
        <div className={`tab ${tab === 'squad' ? 'active' : ''}`} onClick={() => setTab('squad')}>👥 Squad</div>
      </div>

      <div className="foot">
        Goal: {state.dreamGoal} · <span className="link" onClick={simulateNextDay}>simulate next day</span> · <span className="link" onClick={() => { resetState(); location.reload() }}>reset</span>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

/* ---------------- Spin Wheel ---------------- */

function SpinWheel({ state, setState, flash, allDone }) {
  const [angle, setAngle] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState(null)
  const wheelRef = useRef(null)

  const maxSpins = allDone ? 2 : 1
  const usedToday = state.spunOn === todayKey() ? state.spinsUsed || 0 : 0
  const canSpin = usedToday < maxSpins

  const seg = 360 / WHEEL.length

  function doSpin() {
    if (spinning || !canSpin) return
    setSpinning(true)
    setResult(null)
    const outcome = spinOutcome()
    // Land pointer (top) on the chosen segment center.
    const target = 360 * 5 + (360 - (outcome.index * seg + seg / 2))
    setAngle((a) => a - (a % 360) + target)

    setTimeout(() => {
      setSpinning(false)
      setResult(outcome)
      applyOutcome(outcome)
    }, 4100)
  }

  function applyOutcome(o) {
    const messages = {
      coins: `Won ${o.value} coins!`,
      xpmult: `${o.value}× XP on next task!`,
      shield: 'Streak Shield earned!',
      cosmetic: `Unlocked: ${o.value}`,
      real: `Partner reward: ${o.value}`,
      jackpot: '🎉 JACKPOT — Apex Gold!',
    }
    setState((s) => {
      const next = {
        ...s,
        spunOn: todayKey(),
        spinsUsed: (s.spunOn === todayKey() ? s.spinsUsed || 0 : 0) + 1,
      }
      if (o.kind === 'coins') next.coins = s.coins + o.value
      else if (o.kind === 'xpmult') next.xpBoost = o.value
      else if (o.kind === 'shield') next.shields = (s.shields || 0) + 1
      else if (o.kind === 'cosmetic') next.cosmetics = [...(s.cosmetics || []), o.value]
      else if (o.kind === 'jackpot') next.coins = s.coins + 1000
      return next
    })
    flash(messages[o.kind])
  }

  const r = 130, cx = 150, cy = 150

  return (
    <div className="card">
      <h3>Daily Spin {canSpin ? `(${maxSpins - usedToday} left)` : '(come back tomorrow)'}</h3>
      <div className="wheel-wrap">
        <div className="pointer" />
        <svg width="300" height="300" viewBox="0 0 300 300" ref={wheelRef} className="wheel"
          style={{ transform: `rotate(${angle}deg)` }}>
          {WHEEL.map((w, i) => {
            const a0 = (i * seg - 90) * (Math.PI / 180)
            const a1 = ((i + 1) * seg - 90) * (Math.PI / 180)
            const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0)
            const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1)
            const mid = ((i + 0.5) * seg - 90) * (Math.PI / 180)
            const tx = cx + r * 0.62 * Math.cos(mid), ty = cy + r * 0.62 * Math.sin(mid)
            return (
              <g key={w.id}>
                <path d={`M${cx},${cy} L${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1} Z`} fill={w.color} stroke="#0a0a12" strokeWidth="2" />
                <text x={tx} y={ty} fill="#fff" fontSize="10" fontWeight="700" textAnchor="middle"
                  transform={`rotate(${(i + 0.5) * seg}, ${tx}, ${ty})`}>{w.label}</text>
              </g>
            )
          })}
          <circle cx={cx} cy={cy} r="18" fill="#14141f" stroke="var(--accent)" strokeWidth="3" />
        </svg>
      </div>
      <div className="outcome">{result ? `→ ${result.label}` : ''}</div>
      <button className="btn" disabled={spinning || !canSpin} onClick={doSpin}>
        {spinning ? 'Spinning…' : canSpin ? 'SPIN' : 'No spins left today'}
      </button>
      <div className="sub" style={{ marginTop: 10 }}>
        Complete all daily tasks to unlock a 2nd spin. Odds: 40% coins · 25% XP · 15% cosmetic · 10% shield · 7% reward · 3% jackpot.
      </div>
    </div>
  )
}

/* ---------------- Leaderboard ---------------- */

function Leaderboard({ state, xp }) {
  const rows = buildLeaderboard(state.name, xp)
  return (
    <div className="card">
      <h3>Gold League · resets in 4 days</h3>
      <div className="sub" style={{ marginBottom: 8 }}>Top 20% advance · bottom 10% demote</div>
      {rows.map((row, i) => (
        <div className={`lb-row ${row.isUser ? 'me' : ''}`} key={row.name + i}>
          <span className="lb-rank">{i + 1}</span>
          <span>{row.name}{row.isUser && row.name !== 'You' ? ' (you)' : ''}</span>
          <span className="lb-xp">{row.xp} XP</span>
        </div>
      ))}
    </div>
  )
}

/* ---------------- Squad ---------------- */

function RivalDuel({ duel }) {
  if (!duel) return null
  const total = duel.userScore + duel.oppScore
  const pct = total === 0 ? 50 : Math.round((duel.userScore / total) * 100)
  const daysLeft = Math.max(0, daysBetween(todayKey(), duel.endDate))
  const ahead = duel.userScore >= duel.oppScore
  const banner = {
    won: '🏆 You won the duel! Claim it tomorrow.',
    lost: '💀 You lost this duel. Run it back.',
    tied: '🤝 Duel tied — rematch?',
  }[duel.status]
  return (
    <div className="card">
      <h3>⚔️ Rival Duel · vs {duel.opponent}</h3>
      <div className="sub" style={{ marginBottom: 8 }}>
        {duel.status === 'active' ? `Most ${duel.metric} in 7 days · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : banner}
      </div>
      <div className="score-row">
        <span style={{ color: ahead ? 'var(--body)' : 'var(--muted)' }}>You {duel.userScore}</span>
        <span style={{ color: !ahead ? 'var(--flame)' : 'var(--muted)' }}>{duel.opponent} {duel.oppScore}</span>
      </div>
      <div className="bar" style={{ marginTop: 6 }}>
        <i style={{ width: `${pct}%`, background: ahead ? 'var(--body)' : 'var(--flame)' }} />
      </div>
      {duel.status === 'active' && (
        <div className="sub" style={{ marginTop: 8 }}>
          {ahead ? 'You’re ahead — complete tasks to extend your lead.' : 'You’re behind — every completed task scores a point.'}
        </div>
      )}
    </div>
  )
}

function Squad({ state, setState, flash }) {
  const squad = state.squad
  if (!squad) return <div className="card"><h3>Loading squad…</h3></div>

  const ours = squadTotalXp(squad, state.xp)
  const theirs = squad.rival.weeklyXp
  const winning = ours >= theirs
  const warPct = Math.round((ours / (ours + theirs)) * 100)
  const checkedIn = userCheckedIn(squad)
  const waiting = membersAwaitingCheckin(squad).filter((m) => !m.isUser)

  function checkIn() {
    if (checkedIn) return
    setState((s) => ({
      ...s,
      coins: s.coins + 25,
      squad: {
        ...s.squad,
        members: s.squad.members.map((m) => (m.isUser ? { ...m, checkedInOn: todayKey() } : m)),
      },
    }))
    flash('Checked in! +25 coins 🔥')
  }

  function nudge(name) {
    if (squad.nudged.includes(name)) return
    setState((s) => ({ ...s, squad: { ...s.squad, nudged: [...s.squad.nudged, name] } }))
    flash(`Nudged ${name} 👀`)
  }

  return (
    <>
      <div className="card">
        <div className="hud">
          <div className="avatar" style={{ background: 'linear-gradient(135deg,var(--body),var(--intellect))' }}>👥</div>
          <div className="grow">
            <div className="lvl">{squad.name}</div>
            <div className="rank">{squad.members.length} members · {ours.toLocaleString()} squad XP this week</div>
          </div>
        </div>
        {!checkedIn && (
          <div className="sub" style={{ marginTop: 10, color: 'var(--flame)' }}>
            ⚠️ You haven’t checked in today. Your squad is counting on you.
          </div>
        )}
        <button className="btn" disabled={checkedIn} onClick={checkIn} style={{ marginTop: 12 }}>
          {checkedIn ? '✓ Checked in for today' : 'I’m in for today'}
        </button>
      </div>

      <RivalDuel duel={state.duel} />

      <div className="card">
        <h3>Squad War · {squad.name} vs {squad.rival.name}</h3>
        <div className="score-row">
          <span style={{ color: winning ? 'var(--body)' : 'var(--muted)' }}>{squad.name} {ours.toLocaleString()}</span>
          <span style={{ color: !winning ? 'var(--flame)' : 'var(--muted)' }}>{squad.rival.name} {theirs.toLocaleString()}</span>
        </div>
        <div className="bar" style={{ marginTop: 6 }}>
          <i style={{ width: `${warPct}%`, background: winning ? 'var(--body)' : 'var(--flame)' }} />
        </div>
        <div className="sub" style={{ marginTop: 8 }}>
          {winning ? `You’re ahead by ${(ours - theirs).toLocaleString()} XP. Keep grinding.` : `Down by ${(theirs - ours).toLocaleString()} XP. Rally the squad.`}
        </div>
      </div>

      <div className="card">
        <h3>Daily Check-In</h3>
        {squad.members.map((m) => {
          const inToday = m.checkedInOn === todayKey()
          const xp = m.isUser ? state.xp : m.weeklyXp
          return (
            <div className={`lb-row ${m.isUser ? 'me' : ''}`} key={m.name}>
              <span className="lb-rank">{inToday ? '✅' : '⏳'}</span>
              <span>{m.name}{m.isUser && m.name !== 'You' ? ' (you)' : ''}</span>
              {!inToday && !m.isUser && (
                <span className="link" style={{ marginLeft: 'auto' }} onClick={() => nudge(m.name)}>
                  {squad.nudged.includes(m.name) ? 'nudged' : 'nudge'}
                </span>
              )}
              <span className="lb-xp" style={{ marginLeft: !inToday && !m.isUser ? 12 : 'auto' }}>{xp.toLocaleString()} XP</span>
            </div>
          )
        })}
        {waiting.length > 0 && (
          <div className="sub" style={{ marginTop: 10 }}>
            {waiting.length} teammate{waiting.length > 1 ? 's' : ''} {waiting.length > 1 ? 'haven’t' : 'hasn’t'} checked in. A nudge helps.
          </div>
        )}
      </div>
    </>
  )
}

/* ---------------- Profile ---------------- */

function Profile({ state, onReBaseline, onSyncHealth, onBack }) {
  const [editing, setEditing] = useState(false)
  const [bl, setBl] = useState(state.baseline || EMPTY_BASELINE)
  const set = (k) => (e) => setBl((b) => ({ ...b, [k]: e.target.value }))
  const score = state.score || computeHumanScore(state.baseline || {})
  const history = state.scoreHistory || []
  const prev = history.length > 1 ? history[history.length - 2].total : null
  const delta = prev != null ? score.total - prev : null
  const lvl = levelFromXp(state.xp)

  function save() {
    if (!isBaselineReady(bl)) return
    onReBaseline(bl)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="card">
        <h3>Re-baseline</h3>
        <div className="sub" style={{ marginBottom: 8 }}>Update your numbers — we’ll snapshot the new score onto your trend.</div>
        <BaselineFields bl={bl} set={set} />
        <button className="btn ghost" onClick={() => setEditing(false)} style={{ marginTop: 8 }}>Cancel</button>
        <button className="btn" disabled={!isBaselineReady(bl)} onClick={save}>Save new baseline</button>
      </div>
    )
  }

  return (
    <>
      <div className="card">
        <h3>Human Score</h3>
        <div className="score-big">{score.total}</div>
        <div className="sub" style={{ textAlign: 'center' }}>
          {delta != null ? (
            <span style={{ color: delta >= 0 ? 'var(--body)' : 'var(--flame)' }}>
              {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)} since last check
            </span>
          ) : 'your current Human Score'}
          {score.bmi ? ` · BMI ${score.bmi.toFixed(1)}` : ''}
        </div>
        <Sparkline points={history.map((h) => h.total)} />
        <ScoreBar label="🧠 Mind" value={score.mind} color="var(--mind)" />
        <ScoreBar label="💪 Body" value={score.body} color="var(--body)" />
        <ScoreBar label="📚 Intellect" value={score.intellect} color="var(--intellect)" />
        <button className="btn" onClick={() => { setBl(state.baseline || EMPTY_BASELINE); setEditing(true) }} style={{ marginTop: 12 }}>
          Re-take baseline
        </button>
      </div>

      <div className="card">
        <h3>📲 Health Sync</h3>
        {state.health ? (
          <>
            <div className="stat-grid">
              <Stat value={state.health.steps.toLocaleString()} label="steps" />
              <Stat value={`${state.health.sleepHrs}h`} label="sleep" />
              <Stat value={state.health.hrv} label="HRV (ms)" />
              <Stat value={state.health.restingHr} label="resting HR" />
            </div>
            <div className="sub" style={{ marginTop: 8 }}>Last sync: {state.health.source} · auto-logs your steps task.</div>
          </>
        ) : (
          <div className="sub">Connect a wearable to auto-import steps, sleep, and HRV — and auto-complete your steps task.</div>
        )}
        <button className="btn" onClick={onSyncHealth} style={{ marginTop: 12 }}>
          {state.health ? 'Sync now' : 'Connect Apple Health'}
        </button>
        <div className="sub" style={{ marginTop: 8, fontSize: 10 }}>Simulated — a real build uses Apple HealthKit / Google Health Connect.</div>
      </div>

      <div className="card">
        <h3>This Week in Review</h3>
        <div className="sub">💡 {weeklyInsight(state)}</div>
      </div>

      <div className="card">
        <h3>Streaks & Stats</h3>
        <div className="stat-grid">
          <Stat value={`🔥 ${state.streak}`} label="current streak" />
          <Stat value={`🏅 ${state.longestStreak || 0}`} label="longest streak" />
          <Stat value={`🛡️ ${state.shields || 0}`} label="shields" />
          <Stat value={`Lv ${lvl.level}`} label={rankForLevel(lvl.level)} />
        </div>
        <div className="milestones">
          {STREAK_MILESTONES.map((m) => {
            const hit = (state.milestonesHit || []).includes(m) || state.streak >= m
            return <span key={m} className={`milestone ${hit ? 'hit' : ''}`}>{m}d</span>
          })}
        </div>
      </div>

      <div className="card">
        <h3>Cosmetics</h3>
        {(state.cosmetics || []).length === 0
          ? <div className="sub">None yet — win them on the Spin wheel.</div>
          : <div className="chips">{state.cosmetics.map((c, i) => <span key={i} className="chip" style={{ color: 'var(--accent)' }}>✨ {c}</span>)}</div>}
      </div>

      <button className="btn ghost" onClick={onBack}>← Back to today</button>
    </>
  )
}

function Stat({ value, label }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}
