import { useEffect, useRef, useState } from 'react'
import { PILLARS, rankForLevel, levelFromXp, computeHumanScore, TIERS, TIER_META, TIER_COLORS, makeCustomTask, rewardsForTier, DEFAULT_PET, fruitsForTier, rollForward, addDays, STREAK_MILESTONES, REVIEW_THRESHOLD, reviewEvidence, buildDuel, generateHealthSnapshot, SHOP_ITEMS, IMGS, seedFeed, loadState, saveCore, saveHistory, resetState, todayKey, HISTORY_FIELDS } from './game.js'

import { Ic, Field, fmtThreshold, titleChipStyle, PageHead } from './ui.jsx'
import { Onboarding } from './features/Onboarding.jsx'
import { Profile } from './features/Profile.jsx'
import { Shop } from './features/Shop.jsx'
import { PetZone } from './features/Pet.jsx'
import { Feed } from './features/Feed.jsx'
import { Squad, Leaderboard, RivalDuel, FocusDuelCard } from './features/Arena.jsx'
import { Plan } from './features/Plan.jsx'
import { SpinWheel } from './features/SpinWheel.jsx'
import { Settings } from './features/Settings.jsx'
import { PredictionReceipt, EvidenceReview } from './features/Prediction.jsx'

import { backendEnabled, syncProfile, syncPredictionCommit, syncPredictionOutcome, syncPredictionReason } from './backend.js'
import { ProofRecorder } from './Proof.jsx'
import { DEFAULT_CAPTURE_MS } from './proof.js'

// Single source of truth + hot/cold persistence. One unified `state` object
// keeps every consumer's read/write signature unchanged, while TWO persistence
// effects with disjoint dependency arrays split the writes: the small "core"
// blob saves on any change (cheap), but the append-only history logs are
// re-serialized ONLY when one of their references actually changes. A task
// toggle leaves state.predictions/proofLog/etc referentially equal, so the
// history effect is skipped and the growing mountain never touches the main
// thread. Swap saveHistory's body for IndexedDB later without touching callers.
function useApexState() {
  const [state, setState] = useState(() => {
    const s = loadState()
    return s ? rollForward(s) : s
  })
  // Hot: fires on nearly every interaction, but only stringifies the small blob.
  useEffect(() => { if (state) saveCore(state) }, [state])
  // Cold: deps are the log references only — unchanged on a hot update, so this
  // effect no-ops on a task toggle and runs only on a real append/resolution.
  const cold = HISTORY_FIELDS.map((f) => state?.[f])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (state) saveHistory(state) }, cold)
  return [state, setState]
}

export default function App() {
  const [state, setState] = useApexState()
  const [splash, setSplash] = useState(true)
  const [leaving, setLeaving] = useState(false)

  // Theme lives at the root so even the splash and onboarding respect it.
  useEffect(() => {
    document.body.classList.toggle('light', state?.theme === 'light')
  }, [state?.theme])

  // Duolingo-style intro: letters bounce in, then the slogan gets a long,
  // slow reveal — you're meant to read it and feel it before the app opens.
  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), 3600)
    const t2 = setTimeout(() => setSplash(false), 4100)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <>
      {splash && (
        <div className={`splash ${leaving ? 'leaving' : ''}`}>
          <div className="splash-inner">
            <div>
              {'APEX'.split('').map((ch, i) => <span key={i} className="splash-letter">{ch}</span>)}
            </div>
            <div className="splash-tag">YOUR NEXT OPPONENT IS YOU</div>
          </div>
        </div>
      )}
      {!state ? <Onboarding onDone={setState} /> : <Dashboard state={state} setState={setState} />}
    </>
  )
}

// One daily task = one box. Time-based tasks get a START button that opens
// the live camera recorder; the rank ladder previews what each stretch of
// real work is worth. Steps auto-log from Health Sync; custom non-time tasks
// keep tappable tiers.
function TaskBox({ task, onStart, onLog, onRemove }) {
  const p = PILLARS[task.pillar]
  const achieved = task.achievedTier
  const autoLog = task.id === 't-body'
  const timeBased = /min/i.test(task.unit) && !autoLog
  const rewardsPreview = rewardsForTier(achieved != null ? Math.min(achieved + 1, TIERS.length - 1) : 2)

  return (
    <div
      className={`card task-box ${achieved != null ? 'done' : ''}`}
      style={{ borderLeft: `5px solid ${achieved != null ? 'var(--body)' : `var(--${task.pillar.toLowerCase()})`}` }}
    >
      <div className="task-head">
        <span className="ic" style={{ borderColor: `var(--${task.pillar.toLowerCase()})` }}><Ic src={p.img} alt={p.icon} size={26} /></span>
        <div className="grow">
          <div className="tt">{task.title}</div>
          <div className="meta">
            {p.label}
            {achieved != null
              ? <> · <b style={{ color: TIER_COLORS[TIERS[achieved]] }}>{TIER_META[TIERS[achieved]].fancy}</b> banked</>
              : autoLog
                ? <> · auto-logs from Apple Health (Profile → Health Sync)</>
                : timeBased
                  ? <> · hit START and climb the ranks live</>
                  : <> · tap a rank to log</>}
          </div>
        </div>
        {onRemove && <span className="link" onClick={() => onRemove(task.id)}>remove</span>}
      </div>

      <div className="ladder">
        {task.tiers.map((tier, i) => {
          const meta = TIER_META[tier.name]
          const hit = achieved != null && i <= achieved
          // Every tier wears its own color — full when earned, softly dimmed
          // when still locked, so the ladder reads as a vibrant rank rainbow.
          return (
            <div
              key={tier.name}
              className={`ladder-step ${hit ? 'hit' : ''}`}
              style={hit
                ? { borderColor: meta.color, color: meta.color, background: `${meta.color}1f` }
                : { color: meta.color, opacity: 0.5 }}
              title={`${meta.fancy}: ${tier.threshold} ${task.unit} · ${tier.xp} XP`}
              onClick={() => !autoLog && !timeBased && onLog(task.id, i)}
            >
              <span className="li"><Ic src={meta.img} alt={meta.icon} size={20} /></span>
              <span className="lt">{fmtThreshold(tier.threshold)}</span>
            </div>
          )
        })}
      </div>

      {timeBased && (
        <button
          className="btn start-btn"
          disabled={achieved === TIERS.length - 1}
          onClick={() => onStart(task.id)}
        >
          {achieved == null
            ? <>Start — record & rank up (next: +{rewardsPreview.emeralds} <Ic src={IMGS.gem} alt="emeralds" size={14} />)</>
            : achieved === TIERS.length - 1
              ? <><Ic src={IMGS.crown} alt="👑" size={16} /> APEX banked today</>
              : 'Go again — upgrade your rank'}
        </button>
      )}
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
            <option value="BODY">Body</option>
            <option value="MIND">Mind</option>
            <option value="INTELLECT">Intellect</option>
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

// Bottom nav — icon-first like Duolingo, each tab owns a color.
// Arena = league + duels + party in one competitive home; Spin lives in Shop.
const NAV_TABS = [
  { id: 'home', label: 'Tasks', img: IMGS.house, color: '#38bdf8' },
  { id: 'plan', label: 'Dream', img: IMGS.compass, color: '#a78bfa' },
  { id: 'feed', label: 'Feed', img: IMGS.globe, color: '#ec4899' },
  { id: 'pet', label: 'Pet', img: IMGS.pet, color: '#f59e0b' },
  { id: 'arena', label: 'Arena', img: IMGS.trophy, color: '#facc15' },
  { id: 'shop', label: 'Shop', img: IMGS.bags, color: '#fb923c' },
]

// Titles are tier-colored like banners: Truecel bronze → APEX gold.

function Dashboard({ state, setState }) {
  const [tab, setTab] = useState('home')
  const [toast, setToast] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [slideDir, setSlideDir] = useState('')
  const [profileEditSignal, setProfileEditSignal] = useState(0) // bumping it opens the profile editor
  const [lastTab, setLastTab] = useState('home') // where to return from the profile
  const [streakSplash, setStreakSplash] = useState(null)
  const [receipt, setReceipt] = useState(null) // the just-resolved prediction
  const [reviewing, setReviewing] = useState(false)
  const swipeRef = useRef(null)

  // Opening your profile remembers where you came from.
  function openProfile() {
    if (tab !== 'profile') setLastTab(tab)
    setTab('profile')
  }
  const lvl = levelFromXp(state.xp)
  const rank = rankForLevel(lvl.level)

  // Backfill duel/logs/pet for states saved before those features existed.
  // (No squad backfill — squads are opt-in, created from the Party tab.)
  useEffect(() => {
    if (!state.duel) setState((s) => ({ ...s, duel: buildDuel() }))
    if (!state.proofLog) setState((s) => ({ ...s, proofLog: [] }))
    if (!state.tierLog) setState((s) => ({ ...s, tierLog: [] }))
    if (!state.social) setState((s) => ({ ...s, social: { following: [], posts: seedFeed() } }))
    if (!state.pet) setState((s) => ({ ...s, pet: { ...DEFAULT_PET }, fruits: s.fruits || 0 }))
    if (!state.predictions) setState((s) => ({ ...s, predictions: [] }))
    if (!state.reviews) setState((s) => ({ ...s, reviews: [], lastReviewTs: 0 }))
  }, [state.duel, state.proofLog, state.tierLog, state.social, state.pet, state.predictions, state.reviews, setState])

  // MOUNT-ONLY abandonment sweep. No recording survives an app load, so any
  // prediction still 'committed' when the app opens was walked away from —
  // an abandonment, the funnel's most honest signal. This must never run
  // mid-session (a deps-driven version would abandon the ACTIVE prediction
  // the moment it's committed).
  useEffect(() => {
    const stale = (state.predictions || []).filter((p) => p.status === 'committed')
    if (stale.length === 0) return
    setState((s) => ({
      ...s,
      predictions: (s.predictions || []).map((p) => (p.status === 'committed' ? { ...p, status: 'abandoned', resolvedTs: Date.now() } : p)),
    }))
    if (backendEnabled) {
      stale.forEach((p) => syncPredictionOutcome(p.id, { status: 'abandoned' }).catch(() => {}))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The core protocol, full lifecycle. The row is created the moment the
  // user COMMITS — before the camera rolls — so every prediction ends as
  // exactly one of: resolved (verified), voided (camera failed — instrument
  // problem), or abandoned (user bailed — behavior signal). XP rewards the
  // exposure of an honest resolution, never its accuracy.
  const pendingPredIdRef = useRef(null)

  function commitPredictionRow(taskId, taskTitle, pred) {
    const task = state.tasks.find((t) => t.id === taskId)
    const id = `pred-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const row = {
      id, taskId, taskTitle,
      pillar: task?.pillar || 'OTHER',
      predictedMin: pred.predictedMin,
      confidence: pred.confidence,
      ts: pred.ts,
      status: 'committed',
      actualMin: null,
    }
    setState((s) => ({ ...s, predictions: [...(s.predictions || []), row] }))
    if (backendEnabled) syncPredictionCommit(row).catch(() => {})
    return id
  }

  function settlePrediction(id, status, actualMin = null) {
    if (!id) return
    setState((s) => ({
      ...s,
      xp: status === 'resolved' ? s.xp + 5 : s.xp,
      predictions: (s.predictions || []).map((p) =>
        p.id === id ? { ...p, status, actualMin, resolvedTs: Date.now() } : p),
    }))
    if (backendEnabled) syncPredictionOutcome(id, { status, actualMin }).catch(() => {})
  }

  // Optional attribution on a resolved prediction — WHY the gap. Evidence for
  // the Observe step, never advice, and never XP (a reason tag is too cheap to
  // reward without inviting gaming). It's captured now because it can't be
  // recovered later: nobody remembers why a session ran long a month on.
  function tagPredictionReason(id, reason) {
    if (!id) return
    setState((s) => ({
      ...s,
      predictions: (s.predictions || []).map((p) => (p.id === id ? { ...p, reason } : p)),
    }))
    if (backendEnabled) syncPredictionReason(id, reason).catch(() => {})
  }

  // Close the loop's Improve step: after enough new evidence, one forced
  // commitment — "what will you change?" — stored so next review can ask
  // whether you did. XP rewards the reflective commitment, never an outcome.
  function saveReview(change) {
    const text = (change || '').trim()
    if (text.length < 8) return
    setState((s) => ({
      ...s,
      xp: s.xp + 10,
      lastReviewTs: Date.now(),
      reviews: [...(s.reviews || []), { ts: Date.now(), change: text }],
    }))
    setReviewing(false)
    flash(<>Review saved — commitment logged <Ic src={IMGS.target} alt="" size={14} /></>)
  }

  // Mirror the public bits of your profile into Butterbase (no-op unless the
  // backend is configured AND you're signed in — see Settings → Cloud).
  useEffect(() => {
    if (!backendEnabled) return
    syncProfile(state).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.name, state.bio, state.equippedTitle, state.streak])

  // Swipe / horizontal scroll anywhere in the view to move between tabs.
  function shiftTab(dir) {
    const order = NAV_TABS.map((t) => t.id)
    const i = order.indexOf(tab === 'profile' ? 'home' : tab)
    const next = order[(i + dir + order.length) % order.length]
    setSlideDir(dir === 1 ? 'slide-left' : 'slide-right')
    setTab(next)
  }
  function swipeStart(e) {
    swipeRef.current = { x: e.clientX, y: e.clientY }
  }
  function swipeEnd(e) {
    const start = swipeRef.current
    swipeRef.current = null
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.abs(dx) < 70 || Math.abs(dy) > 60) return
    shiftTab(dx < 0 ? 1 : -1)
  }
  // Trackpad two-finger scroll: accumulate horizontal wheel deltas and flip
  // once past a threshold, then cool down so one gesture = one tab.
  const wheelAcc = useRef({ dx: 0, coolUntil: 0 })
  function onWheel(e) {
    const w = wheelAcc.current
    const now = Date.now()
    if (now < w.coolUntil) return
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) { w.dx = 0; return }
    w.dx += e.deltaX
    if (Math.abs(w.dx) > 120) {
      const dir = w.dx > 0 ? 1 : -1
      w.dx = 0
      w.coolUntil = now + 500
      shiftTab(dir)
    }
  }

  function flash(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 2200)
  }

  // Announce the result of a day-rollover: a full-screen streak moment when
  // it survived, a toast when it broke or a shield ate the miss.
  useEffect(() => {
    const note = state._rolloverNote
    if (note && note !== 'clean') {
      flash(note === 'shield'
        ? <><Ic src={IMGS.shield} alt="" size={16} /> Streak Shield used — streak saved!</>
        : <><Ic src={IMGS.hourglass} alt="" size={16} /> Streak broke — fresh start today</>)
      setState((s) => ({ ...s, _rolloverNote: null }))
    } else if (note === 'clean') {
      if ((state.streak || 0) > 0) setStreakSplash(state.streak)
      setState((s) => ({ ...s, _rolloverNote: null }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state._rolloverNote])

  // Starting a task opens the proof recorder; logTier only runs once the
  // camera session confirms. Time-based tasks record live against the whole
  // rank ladder — your rank is wherever the clock actually got to. Custom
  // non-time tasks still pick a tier and attach a short proof clip.
  const [pendingLog, setPendingLog] = useState(null)

  function startTask(id) {
    if (pendingLog) { flash('Finish the current recording first'); return }
    const task = state.tasks.find((t) => t.id === id)
    if (!task || task.id === 't-body') return
    setPendingLog({ taskId: id, taskTitle: task.title, live: true, liveTiers: task.tiers })
  }

  function requestLog(id, tierIndex) {
    if (pendingLog) { flash('Finish the current recording first'); return }
    const task = state.tasks.find((t) => t.id === id)
    if (!task) return
    // Daily steps has no honest time value to record against — it only
    // completes automatically via Health Sync (see syncHealth below).
    if (task.id === 't-body') return
    if (task.achievedTier != null && tierIndex <= task.achievedTier) return
    setPendingLog({ taskId: id, tierIndex, taskTitle: task.title, tierLabel: TIERS[tierIndex], fixedMs: DEFAULT_CAPTURE_MS })
  }

  // Log a task at a tier. Higher tier = more XP; you can only upgrade, and
  // you're awarded the *difference* in XP so re-logging higher feels fair.
  function logTier(id, tierIndex, proof) {
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

    // Rank-scaled rewards, paid as the *difference* from any tier already
    // banked today (so upgrading doesn't double-pay).
    const prevR = task.achievedTier != null ? rewardsForTier(task.achievedTier) : { bonusSpins: 0, emeralds: 0 }
    const r = rewardsForTier(tierIndex)
    const emeraldGain = Math.max(0, r.emeralds - prevR.emeralds) + (milestone ? 20 : 0)
    const spinGain = Math.max(0, r.bonusSpins - prevR.bonusSpins)
    // Harder finishes drop fruit for your pet (difference-paid like the rest).
    const prevFruit = task.achievedTier != null ? fruitsForTier(task.achievedTier) : 0
    const fruitGain = Math.max(0, fruitsForTier(tierIndex) - prevFruit)

    setState((s) => ({
      ...s,
      tasks: tasksAfter,
      xp: s.xp + delta,
      emeralds: (s.emeralds || 0) + emeraldGain,
      bonusSpins: (s.bonusSpins || 0) + spinGain,
      fruits: (s.fruits || 0) + fruitGain,
      xpBoost: 1,
      streak: newStreak,
      longestStreak: Math.max(s.longestStreak || 0, newStreak),
      shields: milestone ? (s.shields || 0) + 1 : s.shields,
      milestonesHit: milestone ? [...(s.milestonesHit || []), milestone] : s.milestonesHit,
      // Each first task completion scores a point in the active rival duel.
      duel: firstCompletion && s.duel && s.duel.status === 'active'
        ? { ...s.duel, userScore: s.duel.userScore + 1 }
        : s.duel,
      proofLog: proof
        ? [...(s.proofLog || []), {
            id: proof.id, taskId: id, taskTitle: task.title, tierLabel: TIERS[tierIndex],
            date: todayKey(), ts: Date.now(), thumbnail: proof.thumbnail, verified: true,
          }]
        : s.proofLog,
      // Permanent tier record — feeds the Human rank (avg tier achieved).
      tierLog: [...(s.tierLog || []), { date: todayKey(), taskId: id, tier: tierIndex }],
    }))

    const meta = TIER_META[TIERS[tierIndex]]
    const rewardBits = (
      <>
        +{delta} XP
        {emeraldGain ? <> +{emeraldGain} <Ic src={IMGS.gem} alt="" size={13} /></> : ''}
        {spinGain ? <> +{spinGain} spin{spinGain > 1 ? 's' : ''} <Ic src={IMGS.slot} alt="" size={13} /></> : ''}
        {fruitGain ? <> +{fruitGain} <Ic src={IMGS.apple} alt="fruit" size={13} /></> : ''}
      </>
    )
    if (newLevel > oldLevel) flash(<>LEVEL UP — Level {newLevel}!</>)
    else if (milestone) flash(<>{milestone}-day streak! +20 <Ic src={IMGS.gem} alt="" size={14} />, +1 shield</>)
    else if (completedToday) flash(<>All tasks done! Streak {newStreak} <Ic src={IMGS.fire} alt="" size={14} /></>)
    else flash(<><Ic src={meta.img} alt={meta.icon} size={16} /> {meta.fancy}! {rewardBits}{boosted ? ' (boosted!)' : ''}</>)
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
    flash('Simulated a new day')
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
  const iconItem = SHOP_ITEMS.find((i) => i.id === state.equippedIcon)
  const bannerItem = SHOP_ITEMS.find((i) => i.id === state.equippedBanner) || SHOP_ITEMS.find((i) => i.id === 'bn-default')
  const titleItem = SHOP_ITEMS.find((i) => i.id === state.equippedTitle)

  return (
    <div className="app">
      {/* Duolingo-style top bar: stats at a glance + person icon → your profile */}
      <div className="topbar">
        <span className="brand-sm">APEX</span>
        <div className="topbar-right">
          {state.shields > 0 && <span className="tb-stat" style={{ color: 'var(--body)' }}><Ic src={IMGS.shield} alt="🛡️" size={18} /> {state.shields}</span>}
          <span className="tb-stat tb-streak" style={{ color: 'var(--flame)' }}><Ic src={IMGS.fire} alt="🔥" size={18} /> {state.streak}</span>
          <span className="tb-stat" style={{ color: 'var(--emerald)' }}><Ic src={IMGS.gem} alt="emeralds" size={18} /> {state.emeralds || 0}</span>
          <span className="tb-stat" title="Pet fruit — earned from Gold+ finishes"><Ic src={IMGS.apple} alt="fruit" size={18} /> {state.fruits || 0}</span>
          <button
            className={`tb-avatar ${tab === 'profile' ? 'active' : ''}`}
            title="Your profile"
            onClick={openProfile}
            style={{ background: state.avatarImage ? 'transparent' : state.avatarColor || 'var(--blue)' }}
          >
            {state.avatarImage
              ? <img src={state.avatarImage} alt="" />
              : (iconItem?.icon || <Ic src={IMGS.person} alt="👤" size={18} />)}
          </button>
          <button className="tb-gear" title="Settings" onClick={() => setShowSettings(true)}>
            <Ic src={IMGS.gear} alt="⚙️" size={20} />
          </button>
        </div>
      </div>

      <div
        className={`view ${slideDir}`}
        key={tab}
        onPointerDown={swipeStart}
        onPointerUp={swipeEnd}
        onWheel={onWheel}
      >
        {tab === 'home' && (
          <>
            <PageHead eyebrow="NO ZERO DAYS" title="Tasks" color="#38bdf8" />
            <div className="card level-strip banner-card" style={{ background: bannerItem.gradient }}>
              <div className="ls-badge">LV {lvl.level}</div>
              <div className="grow">
                <div className="ls-rank">
                  {rank}
                  {titleItem && <span className="profile-title" style={{ fontSize: 9, padding: '1px 6px', marginLeft: 6, ...titleChipStyle(titleItem.id) }}>{titleItem.label}</span>}
                  {allDone && <span className="ls-done"><Ic src={IMGS.check} alt="" size={13} /> streak locked</span>}
                </div>
                <div className="bar xpbar xpbar-slim">
                  <i style={{ width: `${(lvl.xpInto / lvl.xpNeeded) * 100}%` }} />
                </div>
              </div>
              <span className="ls-xp">{lvl.xpInto}/{lvl.xpNeeded}<br />XP</span>
            </div>
            {(() => {
              const ev = reviewEvidence(state.predictions, state.lastReviewTs || 0)
              if (ev.n < REVIEW_THRESHOLD) return null
              return (
                <div className="card review-prompt" onClick={() => setReviewing(true)}>
                  <Ic src={IMGS.target} alt="🎯" size={26} />
                  <div className="grow">
                    <div className="tt">Evidence Review ready</div>
                    <div className="meta">{ev.n} resolved predictions since your last review — see what reality said.</div>
                  </div>
                  <span className="link">Review →</span>
                </div>
              )
            })()}
            {state.tasks.map((t) => (
              <TaskBox key={t.id} task={t} onStart={startTask} onLog={requestLog} onRemove={t.custom ? removeTask : null} />
            ))}
            <CustomTaskCreator onAdd={addCustomTask} />
          </>
        )}

        {tab === 'plan' && (
          <>
            <PageHead eyebrow="8 WEEKS TO DIFFERENT" title="The Dream" color="#a78bfa" />
            <Plan state={state} setState={setState} flash={flash} />
          </>
        )}
        {tab === 'feed' && <Feed state={state} setState={setState} flash={flash} openMyProfile={openProfile} />}
        {tab === 'pet' && (
          <>
            <PageHead eyebrow="GRIND BUDDY" title="Pet" color="#f59e0b" />
            <PetZone state={state} setState={setState} flash={flash} />
          </>
        )}
        {tab === 'arena' && (
          <>
            <PageHead eyebrow="COMPETE & CREW" title="Arena" color="#facc15" />
            <Leaderboard state={state} xp={state.xp} />
            <RivalDuel duel={state.duel} />
            <FocusDuelCard state={state} setState={setState} flash={flash} />
            <div className="section-label"><Ic src={IMGS.party} alt="🎉" size={16} /> YOUR PARTY</div>
            <Squad state={state} setState={setState} flash={flash} />
          </>
        )}
        {tab === 'shop' && (
          <>
            <PageHead eyebrow="SPEND THE GRIND" title="Shop" color="#fb923c" />
            <SpinWheel state={state} setState={setState} flash={flash} allDone={allDone} />
            <Shop state={state} setState={setState} flash={flash} />
          </>
        )}
        {tab === 'profile' && (
          <Profile
            state={state} setState={setState} flash={flash}
            onReBaseline={reBaseline} onSyncHealth={syncHealth}
            onBack={() => setTab(lastTab)}
            backLabel={NAV_TABS.find((t) => t.id === lastTab)?.label || 'Tasks'}
            onOpenShop={() => setTab('shop')}
            startEditing={profileEditSignal}
          />
        )}
      </div>

      <div className="tabs">
        {NAV_TABS.map((t) => (
          <div
            key={t.id}
            className={`tab ${tab === t.id ? 'active' : ''}`}
            style={tab === t.id ? { color: t.color, background: `${t.color}1f` } : undefined}
            onClick={() => setTab(t.id)}
          >
            <Ic src={t.img} alt={t.label} size={22} />
            <span className="tab-label">{t.label}</span>
          </div>
        ))}
      </div>

      <div className="foot">
        Goal: {state.dreamGoal} · <span className="link" onClick={simulateNextDay}>simulate next day</span> · <span className="link" onClick={() => { resetState(); location.reload() }}>reset</span>
      </div>

      {streakSplash != null && <StreakSplash streak={streakSplash} onDone={() => setStreakSplash(null)} />}

      {showSettings && (
        <Settings
          state={state}
          setState={setState}
          flash={flash}
          onClose={() => setShowSettings(false)}
          onEditProfile={() => { setShowSettings(false); openProfile(); setProfileEditSignal((n) => n + 1) }}
        />
      )}

      {toast && <div className="toast">{toast}</div>}

      {pendingLog && (
        <ProofRecorder
          taskTitle={pendingLog.taskTitle}
          tierLabel={pendingLog.tierLabel}
          liveTiers={pendingLog.live ? pendingLog.liveTiers : undefined}
          fixedMs={pendingLog.fixedMs}
          onCommit={(pred) => {
            pendingPredIdRef.current = commitPredictionRow(pendingLog.taskId, pendingLog.taskTitle, pred)
          }}
          onConfirm={(proof, finalTier, resolution) => {
            const tierIndex = pendingLog.live ? finalTier : pendingLog.tierIndex
            if (tierIndex != null) logTier(pendingLog.taskId, tierIndex, proof)
            // Only a verified session resolves a prediction (Article 1); a
            // camera failure voids it rather than trusting self-report.
            if (resolution && proof) {
              settlePrediction(pendingPredIdRef.current, 'resolved', resolution.actualMin)
              setReceipt({ ...resolution, taskTitle: pendingLog.taskTitle, predId: pendingPredIdRef.current })
            } else if (pendingPredIdRef.current) {
              settlePrediction(pendingPredIdRef.current, 'voided')
            }
            pendingPredIdRef.current = null
            setPendingLog(null)
          }}
        />
      )}

      {receipt && (
        <PredictionReceipt
          receipt={receipt}
          onReason={(reason) => tagPredictionReason(receipt.predId, reason)}
          onDone={() => setReceipt(null)}
        />
      )}

      {reviewing && (
        <EvidenceReview
          evidence={reviewEvidence(state.predictions, state.lastReviewTs || 0)}
          lastChange={(state.reviews || [])[(state.reviews || []).length - 1]?.change || null}
          onSave={saveReview}
          onClose={() => setReviewing(false)}
        />
      )}
    </div>
  )
}

/* ---------------- Streak splash ---------------- */

// First open of a new day with your streak alive: the number ticks up in a
// full-screen flame moment (3 → 4) before the app lets you in.
function StreakSplash({ streak, onDone }) {
  const [shown, setShown] = useState(Math.max(0, streak - 1))
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const tick = setTimeout(() => setShown(streak), 900)
    const out = setTimeout(() => setLeaving(true), 2600)
    const done = setTimeout(onDone, 3000)
    return () => { clearTimeout(tick); clearTimeout(out); clearTimeout(done) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={`streak-splash ${leaving ? 'leaving' : ''}`} onClick={onDone}>
      <div className="streak-splash-inner">
        <div className="streak-flame"><Ic src={IMGS.fire} alt="🔥" size={84} /></div>
        <div className={`streak-count ${shown === streak ? 'bumped' : ''}`}>{shown}</div>
        <div className="streak-caption">day streak — still alive</div>
        <div className="streak-hint">tap to continue</div>
      </div>
    </div>
  )
}

