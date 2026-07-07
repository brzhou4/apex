import { useEffect, useMemo, useRef, useState } from 'react'
import {
  PILLARS, rankForLevel, levelFromXp, parseDreamGoal, buildDailyTasks,
  computeHumanScore, buildRoadmap, WHEEL, spinOutcome, buildLeaderboard,
  createSquad, squadTotalXp, membersAwaitingCheckin, userCheckedIn,
  TIERS, TIER_META, TIER_COLORS, TIER_TITLES, makeCustomTask, makeTiers, rewardsForTier,
  DEFAULT_PET, fruitsForTier, PET_UNLOCKS, feedPetOutcome, PARTY_EMBLEMS, partyRank,
  petStage, PET_STAGES, PET_COLORS, TITLE_ACHIEVEMENTS, earnedTitleIds, rankScoreBonus, leagueName,
  TITLE_COLORS,
  rollForward, addDays, daysBetween, STREAK_MILESTONES, weeklyInsight,
  buildDuel, generateHealthSnapshot,
  SHOP_ITEMS, AVATAR_COLORS, EXCLUSIVE_TITLES, IMGS, GOAL_IMGS,
  SOCIAL_USERS, seedFeed, lockedBoard,
  GOAL_TYPES, parseGoals, buildGoalPlan, tierCounts, humanRank,
  rollFocusRival, focusDuelReward,
  loadState, saveState, resetState, todayKey,
} from './game.js'

// Rendered artwork icon (Fluent 3D) — falls back to the alt emoji if the
// image can't load (offline). The gem artwork is a blue diamond, but our
// currency is EMERALDS — tint it green wherever it appears.
function Ic({ src, alt = '', size = 18, style }) {
  const emerald = src === IMGS.gem
  return <img className={`ic-img${emerald ? ' ic-emerald' : ''}`} src={src} alt={alt} width={size} height={size} loading="lazy" style={style} />
}
import { parseDreamGoalRemote } from './api.js'
import { ProofRecorder, TimelapseGallery, FocusDuel } from './Proof.jsx'
import { DEFAULT_CAPTURE_MS, loadTimelapse } from './proof.js'

export default function App() {
  const [state, setState] = useState(() => {
    const s = loadState()
    return s ? rollForward(s) : s
  })
  const [splash, setSplash] = useState(true)
  const [leaving, setLeaving] = useState(false)
  useEffect(() => { if (state) saveState(state) }, [state])

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

/* ---------------- Onboarding ---------------- */

const EMPTY_BASELINE = {
  age: '', heightFt: '', heightIn: '', weightLbs: '', sex: '',
  steps: '', workouts: '', sleepHrs: '', stress: '5', meditDays: '',
  gradeLevel: '', studyHrs: '', skill: '5',
}

function Onboarding({ onDone }) {
  // 'name' → 'birth' → 'bio' → 0 goal → 'details' specifics → 1 baseline → 2 gap analysis
  const [step, setStep] = useState('name')
  const [name, setName] = useState('')
  const [birthdate, setBirthdate] = useState('')
  const [bio, setBio] = useState('')
  const [goal, setGoal] = useState('')
  const [bl, setBl] = useState(EMPTY_BASELINE)
  const [parsed, setParsed] = useState(null)
  const [goals, setGoals] = useState([])
  const [goalDetails, setGoalDetails] = useState({}) // { goalId: { key: value } }
  const [parsing, setParsing] = useState(false)
  const score = useMemo(() => computeHumanScore(bl), [bl])

  const examples = [
    'Get shredded',
    'Eat lean',
    'Get all As',
    'Launch my own business',
    'Gain over 100k followers',
    'Score a 1600 on the SAT',
    'Get into my dream college',
    'Run a marathon',
  ]

  const baselineReady = isBaselineReady(bl)
  const set = (k) => (e) => setBl((b) => ({ ...b, [k]: e.target.value }))
  const setDetail = (goalId, key) => (e) =>
    setGoalDetails((d) => ({ ...d, [goalId]: { ...d[goalId], [key]: e.target.value } }))

  // Parse the goal via the Claude API (falls back to the local parser), then
  // split it into individual goals so each can ask its own follow-up questions.
  async function goToDetails() {
    setParsing(true)
    const p = await parseDreamGoalRemote(goal)
    setParsed(p)
    setGoals(parseGoals(goal))
    setParsing(false)
    setStep('details')
  }

  function finish() {
    const p = parsed || parseDreamGoal(goal)
    const sc = computeHumanScore(bl)
    const planGoals = goals.map((g) => ({ ...g, ...buildGoalPlan(g, goalDetails[g.goalId]) }))
    const goalTasks = planGoals.map((g, i) => ({
      id: `goal-${g.goalId}`,
      pillar: g.task.pillar,
      title: g.task.title,
      unit: g.task.unit,
      tiers: makeTiers(g.task.goldTarget),
      achievedTier: null,
    }))
    onDone({
      name: name.trim() || 'You',
      bio: bio.trim(),
      birthdate: birthdate || null,
      theme: 'dark',
      pet: { ...DEFAULT_PET },
      fruits: 0,
      dreamGoal: goal.trim(),
      parsed: p,
      plan: { goals: planGoals, createdOn: todayKey() },
      baseline: bl,
      score: sc,
      scoreHistory: [{ date: todayKey(), total: sc.total, mind: sc.mind, body: sc.body, intellect: sc.intellect }],
      roadmap: buildRoadmap(p),
      tasks: [...buildDailyTasks(p, bl), ...goalTasks],
      squad: null, // no auto-party — you create your own and invite people you follow
      duel: buildDuel(),
      health: null,
      xp: 0,
      emeralds: 30,
      bonusSpins: 0,
      social: { following: [], posts: seedFeed() },
      streak: 0,
      longestStreak: 0,
      milestonesHit: [],
      shields: 0,
      lastActiveDay: todayKey(),
      spunOn: null,
      avatarColor: AVATAR_COLORS[0],
      avatarImage: null,
      equippedIcon: 'av-default',
      equippedBanner: 'bn-default',
      equippedTitle: null,
      ownedIcons: ['av-default'],
      ownedBanners: ['bn-default'],
      ownedTitles: [],
      proofLog: [],
      tierLog: [],
      xpBoost: 1,
    })
  }

  // Age for the baseline, derived from the birthdate step.
  function ageFromBirthdate(bd) {
    if (!bd) return ''
    const diff = Date.now() - new Date(bd + 'T00:00:00').getTime()
    const yrs = Math.floor(diff / (365.25 * 86400000))
    return yrs > 0 && yrs < 120 ? String(yrs) : ''
  }

  return (
    <div className="app">
      <div className="brand">A P E X</div>
      <div className="tagline">Your next opponent is you.</div>

      {/* Each step is its own screen; the key re-triggers the slide-in. */}
      <div className="onb-step" key={String(step)}>

      {step === 'name' && (
        <div className="onb-hero">
          <div className="card">
            <div className="onb-q">First things first — what’s your name?</div>
            <input
              autoFocus
              maxLength={20}
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && name.trim() && setStep('birth')}
            />
            <button className="btn" disabled={!name.trim()} onClick={() => setStep('birth')}>Next →</button>
          </div>
        </div>
      )}

      {step === 'birth' && (
        <div className="onb-hero">
          <div className="card">
            <div className="onb-q"><Ic src={IMGS.cake} alt="🎂" size={24} /> When were you born, {name.trim()}?</div>
            <div className="sub" style={{ marginBottom: 10 }}>Your age tunes your baseline — nothing leaves your device.</div>
            <input
              type="date"
              value={birthdate}
              max={todayKey()}
              onChange={(e) => setBirthdate(e.target.value)}
            />
            <button className="btn ghost" onClick={() => setStep('name')}>← Back</button>
            <button
              className="btn"
              disabled={!birthdate}
              onClick={() => { setBl((b) => ({ ...b, age: ageFromBirthdate(birthdate) })); setStep('bio') }}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {step === 'bio' && (
        <div className="onb-hero">
          <div className="card">
            <div className="onb-q">Write your bio. Make it hit.</div>
            <div className="sub" style={{ marginBottom: 10 }}>This shows on your profile — 80 characters of pure motivation.</div>
            <textarea
              maxLength={80}
              placeholder="e.g. 5am club. Building the hardest version of me."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              style={{ minHeight: 64 }}
            />
            <button className="btn ghost" onClick={() => setStep('birth')}>← Back</button>
            <button className="btn" onClick={() => setStep(0)}>{bio.trim() ? 'Next →' : 'Skip for now →'}</button>
          </div>
        </div>
      )}

      {step === 0 && (
        <div className="onb-hero">
          <div className="card">
            <div className="onb-q">What is your end goal in life? Don’t hold back.</div>
            <textarea
              placeholder="Type it. All of it — separate goals with commas…"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
            <div className="chips">
              {examples.map((ex) => (
                <span key={ex} className="chip" onClick={() => setGoal((g) => (g.trim() ? `${g.trim().replace(/,\s*$/, '')}, ${ex.toLowerCase()}` : ex))}>{ex}</span>
              ))}
            </div>
            <button className="btn" disabled={!goal.trim() || parsing} onClick={goToDetails}>
              {parsing ? 'Analyzing your goals…' : 'Next →'}
            </button>
          </div>
        </div>
      )}

      {step === 'details' && (
        <>
          <div className="card">
            <h3>Let’s get specific</h3>
            <div className="sub">
              We found <b style={{ color: 'var(--text)' }}>{goals.length} goal{goals.length > 1 ? 's' : ''}</b> in there.
              A few questions each, so your plan is actually yours.
            </div>
          </div>
          {goals.map((g) => {
            const type = GOAL_TYPES.find((t) => t.id === g.typeId)
            return (
              <div className="card" key={g.goalId}>
                <h3><Ic src={GOAL_IMGS[g.typeId] || IMGS.dart} alt={g.icon} size={20} /> {g.typeLabel}</h3>
                <div className="sub" style={{ marginBottom: 8 }}>“{g.text}”</div>
                <div className="form-grid">
                  {(type?.questions || []).map((q) => (
                    <Field key={q.key} label={q.label}>
                      {q.type === 'select' ? (
                        <select value={goalDetails[g.goalId]?.[q.key] || ''} onChange={setDetail(g.goalId, q.key)}>
                          <option value="">—</option>
                          {q.options.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input
                          type={q.type === 'text' ? 'text' : 'number'}
                          placeholder={q.placeholder}
                          value={goalDetails[g.goalId]?.[q.key] || ''}
                          onChange={setDetail(g.goalId, q.key)}
                        />
                      )}
                    </Field>
                  ))}
                </div>
              </div>
            )
          })}
          <button className="btn ghost" onClick={() => setStep(0)}>← Back</button>
          <button className="btn" onClick={() => setStep(1)}>Next: baseline →</button>
        </>
      )}

      {step === 1 && (
        <div className="card">
          <h3>Baseline Assessment</h3>
          <div className="sub" style={{ marginBottom: 8 }}>Real numbers in, real score out. Nothing leaves your device.</div>
          <BaselineFields bl={bl} set={set} />
          <button className="btn ghost" onClick={() => setStep('details')} style={{ marginTop: 8 }}>← Back</button>
          <button className="btn" disabled={!baselineReady} onClick={() => setStep(2)}>
            {baselineReady ? 'Calculate my Human Score →' : 'Fill the required fields'}
          </button>
        </div>
      )}

      {step === 2 && (
        <>
          <div className="card">
            <h3>Gap Analysis</h3>
            <div className="sub">Detected domain: <b style={{ color: 'var(--text)' }}>{parsed?.domainLabel}</b> · {parsed?.motivation} motivation {parsed?.source === 'claude' ? '· parsed by Claude' : '· rule-based'}</div>
            <div className="score-big">{score.total}</div>
            <div className="sub" style={{ textAlign: 'center' }}>your Human Score{score.bmi ? ` · BMI ${score.bmi.toFixed(1)}` : ''}</div>
            <ScoreBar label={<><Ic src={IMGS.brain} alt="🧠" size={15} /> Mind</>} value={score.mind} color="var(--mind)" />
            <ScoreBar label={<><Ic src={IMGS.biceps} alt="💪" size={15} /> Body</>} value={score.body} color="var(--body)" />
            <ScoreBar label={<><Ic src={IMGS.books} alt="📚" size={15} /> Intellect</>} value={score.intellect} color="var(--intellect)" />
            <div className="sub" style={{ marginTop: 12 }}>
              You’re a <b style={{ color: 'var(--text)' }}>{score.total}</b>. Your goal requires a{' '}
              <b style={{ color: 'var(--accent)' }}>{score.target}</b>. Here’s your roadmap.
            </div>
          </div>
          <div className="card">
            <h3>Your Personalized Plan</h3>
            <div className="sub" style={{ marginBottom: 8 }}>An 8-week roadmap per goal — full detail in the Plan tab.</div>
            {goals.map((g) => {
              const plan = buildGoalPlan(g, goalDetails[g.goalId])
              return (
                <div className="task" key={g.goalId} style={{ alignItems: 'flex-start' }}>
                  <div className="ic"><Ic src={GOAL_IMGS[g.typeId] || IMGS.dart} alt={g.icon} size={24} /></div>
                  <div className="grow">
                    <div className="tt">{g.typeLabel}</div>
                    <div className="meta">{plan.scheduleLabel} · wk 1: {plan.weeks[0].focus}</div>
                    <div className="score-row" style={{ fontSize: 12 }}>
                      <span>how far along you already are</span><span>{plan.progress}%</span>
                    </div>
                    <div className="bar" style={{ height: 10 }}>
                      <i style={{ width: `${plan.progress}%`, background: 'var(--blue)' }} />
                    </div>
                  </div>
                </div>
              )
            })}
            <button className="btn ghost" onClick={() => setStep(1)}>← Edit baseline</button>
            <button className="btn" onClick={finish}>Start leveling up →</button>
          </div>
        </>
      )}
      </div>

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
      <div className="form-section"><Ic src={IMGS.biceps} alt="💪" size={16} /> Body</div>
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

      <div className="form-section"><Ic src={IMGS.brain} alt="🧠" size={16} /> Mind</div>
      <div className="form-grid">
        <Field label={`Stress (1–10): ${bl.stress}`}>
          <input type="range" min="1" max="10" value={bl.stress} onChange={set('stress')} />
        </Field>
        <Field label="Meditate (days/wk)"><input type="number" value={bl.meditDays} onChange={set('meditDays')} placeholder="0–7" /></Field>
      </div>

      <div className="form-section"><Ic src={IMGS.books} alt="📚" size={16} /> Intellect</div>
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
          return (
            <div
              key={tier.name}
              className={`ladder-step ${hit ? 'hit' : ''}`}
              style={hit ? { borderColor: meta.color, color: meta.color } : undefined}
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
const TIER_TITLE_IDS = {
  Bronze: 'tl-truecel', Silver: 'tl-sub5', Gold: 'tl-ltn', Platinum: 'tl-htn',
  Diamond: 'tl-chadlite', Ascendant: 'tl-ltg', Apex: 'tl-apex',
}
function titleChipStyle(id) {
  const c = TITLE_COLORS[id]
  return c ? { color: c, borderColor: c, background: `${c}22` } : undefined
}
function titleChipStyleByLabel(label) {
  const item = SHOP_ITEMS.find((i) => i.type === 'title' && i.label === label)
  return item ? titleChipStyle(item.id) : undefined
}

// Playful page header — colored eyebrow + big Archivo title, so every tab
// opens with its own identity instead of the same wall of cards.
function PageHead({ eyebrow, title, color, children }) {
  return (
    <div className="page-head">
      <div>
        <div className="eyebrow" style={{ color }}>{eyebrow}</div>
        <h2 className="page-title">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Dashboard({ state, setState }) {
  const [tab, setTab] = useState('home')
  const [toast, setToast] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [slideDir, setSlideDir] = useState('')
  const [profileEditSignal, setProfileEditSignal] = useState(0) // bumping it opens the profile editor
  const [lastTab, setLastTab] = useState('home') // where to return from the profile
  const [streakSplash, setStreakSplash] = useState(null)
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
  }, [state.duel, state.proofLog, state.tierLog, state.social, state.pet, setState])

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
          <span className="tb-stat" style={{ color: 'var(--flame)' }}><Ic src={IMGS.fire} alt="🔥" size={18} /> {state.streak}</span>
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
            {state.tasks.map((t) => (
              <TaskBox key={t.id} task={t} onStart={startTask} onLog={requestLog} onRemove={t.custom ? removeTask : null} />
            ))}
            <CustomTaskCreator onAdd={addCustomTask} />
          </>
        )}

        {tab === 'plan' && (
          <>
            <PageHead eyebrow="8 WEEKS TO DIFFERENT" title="The Dream" color="#a78bfa" />
            <Plan state={state} />
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
          onConfirm={(proof, finalTier) => {
            const tierIndex = pendingLog.live ? finalTier : pendingLog.tierIndex
            if (tierIndex != null) logTier(pendingLog.taskId, tierIndex, proof)
            setPendingLog(null)
          }}
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

/* ---------------- Settings ---------------- */

// Full-screen settings: theme, profile shortcuts, your timelapse vault, and
// the door out (delete account). Opened from the gear in the top bar.
function Settings({ state, setState, flash, onClose, onEditProfile }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const light = state.theme === 'light'

  function setTheme(theme) {
    setState((s) => ({ ...s, theme }))
    flash(theme === 'light' ? <><Ic src={IMGS.sun} alt="" size={15} /> Light mode on</> : <><Ic src={IMGS.moon} alt="" size={15} /> Dark mode on</>)
  }

  function deleteAccount() {
    resetState()
    try { indexedDB.deleteDatabase('apex.proofs') } catch { /* best effort */ }
    location.reload()
  }

  return (
    <div className="profile-page">
      <div className="profile-page-inner">
        <div className="pp-top">
          <button className="pp-back" onClick={onClose}>←</button>
          <span className="pp-handle"><Ic src={IMGS.gear} alt="⚙️" size={16} /> Settings</span>
        </div>

        <div className="card">
          <h3>Appearance</h3>
          <div className="theme-row">
            <button className={`theme-opt ${!light ? 'on' : ''}`} onClick={() => setTheme('dark')}>
              <Ic src={IMGS.moon} alt="🌙" size={22} />
              <span>Dark</span>
            </button>
            <button className={`theme-opt ${light ? 'on' : ''}`} onClick={() => setTheme('light')}>
              <Ic src={IMGS.sun} alt="☀️" size={22} />
              <span>Light</span>
            </button>
          </div>
        </div>

        <div className="card">
          <h3>Account</h3>
          <div className="settings-row" onClick={onEditProfile}>
            <Ic src={IMGS.pencil} alt="✏️" size={18} />
            <div className="grow">
              <div className="tt">Edit profile</div>
              <div className="meta">Name, bio, avatar color, picture, title</div>
            </div>
            <span className="link">→</span>
          </div>
        </div>

        <div className="card">
          <h3>Preferences</h3>
          {[
            { key: 'notifications', icon: IMGS.phone, label: 'Daily reminders', meta: 'Nudge me when my streak is on the line' },
            { key: 'sounds', icon: IMGS.party, label: 'Sound effects', meta: 'Level-ups, spins, and pet noises' },
            { key: 'reducedMotion', icon: IMGS.hourglass, label: 'Reduce motion', meta: 'Calmer animations everywhere' },
          ].map((p) => {
            const prefs = state.prefs || { notifications: true, sounds: true, reducedMotion: false }
            const on = !!prefs[p.key]
            return (
              <div className="settings-row" key={p.key} onClick={() => {
                setState((s) => ({ ...s, prefs: { ...(s.prefs || { notifications: true, sounds: true, reducedMotion: false }), [p.key]: !on } }))
                if (p.key === 'reducedMotion') document.body.classList.toggle('reduce-motion', !on)
              }}>
                <Ic src={p.icon} alt="" size={18} />
                <div className="grow">
                  <div className="tt">{p.label}</div>
                  <div className="meta">{p.meta}</div>
                </div>
                <span className={`toggle ${on ? 'on' : ''}`}><i /></span>
              </div>
            )
          })}
        </div>

        <div className="card">
          <h3>Your data</h3>
          <div className="settings-row" onClick={() => {
            const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blob)
            a.download = 'apex-data.json'
            a.click()
            setTimeout(() => URL.revokeObjectURL(a.href), 5000)
            flash('Your data is downloading')
          }}>
            <Ic src={IMGS.floppy} alt="💾" size={18} />
            <div className="grow">
              <div className="tt">Export my data</div>
              <div className="meta">Everything — goals, XP, streaks, pet — as JSON</div>
            </div>
            <span className="link">↓</span>
          </div>
          <div className="sub" style={{ marginTop: 6, fontSize: 11 }}>
            Everything lives on this device. Nothing is uploaded anywhere.
          </div>
        </div>

        <div className="card">
          <h3><Ic src={IMGS.camera} alt="🎞️" size={18} /> Your timelapses</h3>
          <TimelapseGallery proofLog={state.proofLog} />
        </div>

        <div className="card danger-card">
          <h3><Ic src={IMGS.warning} alt="⚠️" size={18} /> Danger zone</h3>
          {!confirmDelete ? (
            <button className="btn ghost danger" onClick={() => setConfirmDelete(true)}>
              <Ic src={IMGS.trash} alt="🗑️" size={15} /> Delete account
            </button>
          ) : (
            <>
              <div className="sub" style={{ marginBottom: 4 }}>
                This wipes your goals, XP, streaks, pet, and every timelapse on this device. No undo.
              </div>
              <button className="btn danger" onClick={deleteAccount}>Yes, delete everything</button>
              <button className="btn ghost" onClick={() => setConfirmDelete(false)}>Keep my account</button>
            </>
          )}
        </div>

        <div className="card">
          <h3>About</h3>
          <div className="sub">APEX · prototype build</div>
          <div className="sub" style={{ marginTop: 4, color: 'var(--blue)', fontWeight: 800 }}>Your next opponent is you.</div>
        </div>

        <button className="btn ghost" onClick={onClose}>← Back</button>
      </div>
    </div>
  )
}

/* ---------------- Spin Wheel ---------------- */

function SpinWheel({ state, setState, flash, allDone }) {
  const [angle, setAngle] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState(null)
  const wheelRef = useRef(null)

  // 1 free spin a day + every bonus spin earned from Gold+ task finishes.
  const maxSpins = 1 + (state.bonusSpins || 0)
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
    let msg = ''
    setState((s) => {
      const next = {
        ...s,
        spunOn: todayKey(),
        spinsUsed: (s.spunOn === todayKey() ? s.spinsUsed || 0 : 0) + 1,
      }
      if (o.kind === 'emeralds') { next.emeralds = (s.emeralds || 0) + o.value; msg = <>+{o.value} <Ic src={IMGS.gem} alt="" size={14} /> emeralds!</> }
      else if (o.kind === 'xpmult') { next.xpBoost = o.value; msg = `${o.value}× XP on next task!` }
      else if (o.kind === 'shield') { next.shields = (s.shields || 0) + 1; msg = <><Ic src={IMGS.shield} alt="" size={16} /> Streak Recovery earned!</> }
      else if (o.kind === 'limitedIcon') {
        const owned = s.ownedIcons || []
        if (owned.includes(o.value)) { next.emeralds = (s.emeralds || 0) + 10; msg = <>Already own the Sahur icon — +10 <Ic src={IMGS.gem} alt="" size={14} /> instead</> }
        else { next.ownedIcons = [...owned, o.value]; msg = 'LIMITED DROP: Tung Tung Tung Sahur icon unlocked!' }
      }
      else if (o.kind === 'title') {
        const owned = s.ownedTitles || []
        const pool = EXCLUSIVE_TITLES.map((t) => `tl-${t.toLowerCase()}`).filter((id) => !owned.includes(id))
        if (pool.length === 0) { next.emeralds = (s.emeralds || 0) + 5; msg = <>All exclusive titles owned — +5 <Ic src={IMGS.gem} alt="" size={14} /> instead</> }
        else {
          const drop = pool[Math.floor(Math.random() * pool.length)]
          next.ownedTitles = [...owned, drop]
          msg = <><Ic src={IMGS.crown} alt="" size={16} /> EXCLUSIVE TITLE: {SHOP_ITEMS.find((i) => i.id === drop)?.label} — equip it in your profile!</>
        }
      }
      else if (o.kind === 'jackpot') { next.emeralds = (s.emeralds || 0) + o.value; msg = <>JACKPOT — +{o.value} <Ic src={IMGS.gem} alt="" size={14} />!</> }
      return next
    })
    flash(msg)
  }

  // Casino-cabinet build: gradient segments, a gold rim ringed with blinking
  // marquee lights, and a chunky hub — big and loud on purpose.
  const R = 175, cx = 190, cy = 190, r = 152

  return (
    <div className="card wheel-card">
      <h3><Ic src={IMGS.slot} alt="🎰" size={20} /> Daily Spin {canSpin ? `(${maxSpins - usedToday} left)` : '(come back tomorrow)'}</h3>
      <div className="wheel-wrap">
        <div className="pointer" />
        <svg width="100%" viewBox="0 0 380 380" ref={wheelRef} className="wheel"
          style={{ transform: `rotate(${angle}deg)` }}>
          <defs>
            {WHEEL.map((w, i) => (
              <radialGradient key={w.id} id={`seg-${i}`} cx="50%" cy="50%" r="80%">
                <stop offset="30%" stopColor={w.color} />
                <stop offset="100%" stopColor={w.dark || w.color} />
              </radialGradient>
            ))}
            <radialGradient id="hub-gold" cx="35%" cy="35%" r="90%">
              <stop offset="0%" stopColor="#ffe98a" />
              <stop offset="55%" stopColor="#ffc800" />
              <stop offset="100%" stopColor="#8a6400" />
            </radialGradient>
          </defs>

          {/* gold rim */}
          <circle cx={cx} cy={cy} r={R} fill="url(#hub-gold)" />
          <circle cx={cx} cy={cy} r={r + 6} fill="#12060f" />

          {WHEEL.map((w, i) => {
            const a0 = (i * seg - 90) * (Math.PI / 180)
            const a1 = ((i + 1) * seg - 90) * (Math.PI / 180)
            const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0)
            const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1)
            const mid = ((i + 0.5) * seg - 90) * (Math.PI / 180)
            const tx = cx + r * 0.63 * Math.cos(mid), ty = cy + r * 0.63 * Math.sin(mid)
            // Flip labels on the bottom half so nothing reads upside-down.
            const rot = (i + 0.5) * seg
            const flipped = rot > 90 && rot < 270 ? rot + 180 : rot
            return (
              <g key={w.id}>
                <path d={`M${cx},${cy} L${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1} Z`} fill={`url(#seg-${i})`} stroke="#12060f" strokeWidth="3" />
                <text x={tx} y={ty} fill="#fff" fontSize="16" fontWeight="900" textAnchor="middle" dominantBaseline="middle" stroke="rgba(0,0,0,0.45)" strokeWidth="3" paintOrder="stroke"
                  transform={`rotate(${flipped}, ${tx}, ${ty})`}>{w.short || w.label}</text>
              </g>
            )
          })}

          {/* marquee lights on the rim */}
          {Array.from({ length: 16 }, (_, i) => {
            const a = ((i * 360) / 16 - 90) * (Math.PI / 180)
            return (
              <circle key={i} className={`wheel-light ${i % 2 ? 'odd' : ''}`}
                cx={cx + (r + 13) * Math.cos(a)} cy={cy + (r + 13) * Math.sin(a)} r="5" />
            )
          })}

          {/* hub */}
          <circle cx={cx} cy={cy} r="30" fill="url(#hub-gold)" stroke="#12060f" strokeWidth="3" />
          <circle cx={cx} cy={cy} r="12" fill="#12060f" />
        </svg>
      </div>
      <div className="outcome">{result ? `→ ${result.label}` : ''}</div>
      <button className="btn" disabled={spinning || !canSpin} onClick={doSpin}>
        {spinning ? 'Spinning…' : canSpin ? 'SPIN' : 'No spins left today'}
      </button>

      {/* Every prize spelled out — no more squinting at the wheel */}
      <div className="wheel-legend">
        {WHEEL.map((w) => (
          <div className="wl-item" key={w.id}>
            <i className="wl-dot" style={{ background: w.color }} />
            <span className="grow">{w.label}</span>
            <span className="wl-odds">{Math.round((w.weight / WHEEL.reduce((s, x) => s + x.weight, 0)) * 100)}%</span>
          </div>
        ))}
      </div>
      <div className="sub" style={{ marginTop: 10 }}>
        Finish tasks at Gaining Gold or higher to earn bonus spins.
      </div>
    </div>
  )
}

/* ---------------- Plan ---------------- */

// One goal's roadmap, kept SHORT: the weekly schedule, then a week-selector
// strip (✓ past, glowing current) with only the selected week's details shown.
function GoalPlanCard({ goal, currentWeek }) {
  const weeks = goal.weeks || []
  const [shown, setShown] = useState(Math.min(currentWeek, weeks.length))
  const w = weeks.find((x) => x.week === shown) || weeks[0]

  return (
    <div className="card">
      <h3><Ic src={GOAL_IMGS[goal.typeId] || IMGS.dart} alt={goal.icon} size={20} /> {goal.typeLabel}</h3>
      <div className="sub" style={{ marginBottom: 10 }}>“{goal.text}” · {goal.scheduleLabel}</div>

      {goal.schedule?.length > 0 && (
        <div className="plan-schedule">
          {goal.schedule.map((s, i) => (
            <div className="plan-day" key={i}>
              <span className="plan-day-name">{s.day}</span>
              <span className="plan-day-focus">{s.focus}</span>
            </div>
          ))}
        </div>
      )}

      <div className="week-strip">
        {weeks.map((x) => {
          const isPast = x.week < currentWeek
          const isCurrent = x.week === currentWeek
          return (
            <button
              key={x.week}
              className={`week-chip ${x.week === shown ? 'sel' : ''} ${isCurrent ? 'now' : ''} ${isPast ? 'past' : ''}`}
              onClick={() => setShown(x.week)}
            >
              {isPast ? '✓' : `W${x.week}`}
            </button>
          )
        })}
      </div>

      {w && (
        <div className="week-detail">
          <div className="tt">Week {w.week}{w.week === currentWeek ? ' · this week' : ''}</div>
          <div className="meta" style={{ marginTop: 2 }}>{w.focus}</div>
          <div className="plan-objectives" style={{ margin: '8px 0 0' }}>
            {w.objectives.map((o, i) => <div key={i} className="plan-objective">▸ {o}</div>)}
          </div>
        </div>
      )}
    </div>
  )
}

function Plan({ state }) {
  const parsed = state.parsed || {}
  const score = state.score || computeHumanScore(state.baseline || {})
  const startDate = state.plan?.createdOn || state.scoreHistory?.[0]?.date || state.lastActiveDay || todayKey()
  const daysIn = Math.max(0, daysBetween(startDate, todayKey()))
  const gap = Math.max(0, score.target - score.total)
  const pct = score.target > 0 ? Math.min(100, (score.total / score.target) * 100) : 0
  const planGoals = state.plan?.goals || []
  const legacyRoadmap = state.roadmap || []
  const maxWeeks = planGoals.length ? Math.max(...planGoals.map((g) => g.weeks?.length || 0)) : legacyRoadmap.length
  const currentWeek = Math.min(maxWeeks || 4, Math.floor(daysIn / 7) + 1)

  return (
    <>
      <div className="card">
        <h3><Ic src={IMGS.target} alt="🎯" size={20} /> Your goal{planGoals.length > 1 ? 's' : ''}</h3>
        <div className="sub" style={{ fontSize: 16, color: 'var(--text)', fontWeight: 800, marginBottom: 10 }}>
          “{state.dreamGoal || 'Level up'}”
        </div>
        <div className="chips">
          {planGoals.length > 0
            ? planGoals.map((g) => <span key={g.goalId} className="chip"><Ic src={GOAL_IMGS[g.typeId] || IMGS.dart} alt={g.icon} size={15} /> {g.typeLabel}</span>)
            : <span className="chip">{parsed.domainLabel || 'Whole-Person Growth'}</span>}
          <span className="chip"><Ic src={parsed.motivation === 'extrinsic' ? IMGS.fire : IMGS.seedling} alt="" size={15} /> {parsed.motivation === 'extrinsic' ? 'extrinsic drive' : 'intrinsic drive'}</span>
        </div>
      </div>

      <div className="card">
        <h3>Gap to target</h3>
        <div className="score-row"><span>Human Score</span><span>{score.total} / {score.target}</span></div>
        <div className="bar"><i style={{ width: `${pct}%`, background: 'var(--green)' }} /></div>
        <div className="sub" style={{ marginTop: 8 }}>
          Week {currentWeek} of {maxWeeks} · {gap > 0 ? `${gap} points to your target — keep stacking tiers and streaks.` : 'Target reached — re-baseline in Profile to raise the bar.'}
        </div>
      </div>

      {planGoals.length > 0 ? (
        planGoals.map((g) => <GoalPlanCard key={g.goalId} goal={g} currentWeek={currentWeek} />)
      ) : (
        <div className="card">
          <h3>Your {legacyRoadmap.length}-Week Roadmap</h3>
          {legacyRoadmap.map((r) => {
            const isCurrent = r.week === currentWeek
            const isPast = r.week < currentWeek
            return (
              <div className={`task ${isPast ? 'done' : ''}`} key={r.week}>
                <div className="ic" style={isCurrent ? { borderColor: 'var(--blue)', color: 'var(--blue)' } : isPast ? { borderColor: 'var(--green)', color: 'var(--green)' } : undefined}>
                  {isPast ? '✓' : r.week}
                </div>
                <div className="grow">
                  <div className="tt">Week {r.week}{isCurrent ? ' · this week' : ''}</div>
                  <div className="meta">{r.focus}</div>
                </div>
              </div>
            )
          })}
          <div className="sub" style={{ marginTop: 10 }}>Reset and redo onboarding to unlock per-goal personalized plans.</div>
        </div>
      )}
    </>
  )
}

/* ---------------- Focus Duel ---------------- */

function FocusDuelCard({ state, setState, flash }) {
  const [rival, setRival] = useState(null)
  const playedToday = state.focusDuel?.day === todayKey()
  const best = state.focusDuel?.bestMs || 0
  const fmt = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`

  function start() {
    if (playedToday) { flash('One duel per day — come back tomorrow'); return }
    setRival(rollFocusRival())
  }

  function finish(userMs, proof) {
    const reward = focusDuelReward(userMs, rival.enduranceMs)
    setState((s) => ({
      ...s,
      xp: s.xp + reward.xp,
      emeralds: (s.emeralds || 0) + reward.emeralds,
      focusDuel: { day: todayKey(), bestMs: Math.max(s.focusDuel?.bestMs || 0, userMs), lastResult: reward.won ? 'won' : 'lost' },
      proofLog: proof
        ? [...(s.proofLog || []), {
            id: proof.id, taskId: 'focus-duel', taskTitle: `Focus Duel vs ${rival.name}`,
            tierLabel: reward.won ? 'Won' : 'Lost', date: todayKey(), ts: Date.now(), thumbnail: proof.thumbnail, verified: true,
          }]
        : s.proofLog,
    }))
    flash(reward.won
      ? <><Ic src={IMGS.trophy} alt="" size={16} /> Outlasted {rival.name}! +{reward.xp} XP, +{reward.emeralds} <Ic src={IMGS.gem} alt="" size={13} /></>
      : `${rival.name} outlasted you — +${reward.xp} XP for the effort`)
    setRival(null)
  }

  return (
    <div className="card">
      <h3><Ic src={IMGS.brain} alt="🧠" size={20} /> Focus Duel</h3>
      <div className="sub">
        Camera on, phone down. Whoever stays focused longer wins bonus XP — your session saves as a timelapse.
        {best > 0 && <> Personal best: <b style={{ color: 'var(--text)' }}>{fmt(best)}</b>.</>}
      </div>
      <button className="btn" onClick={start} disabled={playedToday} style={{ marginTop: 12 }}>
        {playedToday ? `Played today (${state.focusDuel?.lastResult}) — back tomorrow` : 'Play competitively'}
      </button>
      {rival && (
        <FocusDuel
          rival={rival}
          onFinish={finish}
          onError={() => { flash('Camera unavailable — no duel without proof'); setRival(null) }}
        />
      )}
    </div>
  )
}

/* ---------------- Leaderboard ---------------- */

// Collapsed: top 5, a tappable ···, and YOUR row with your real placement.
// Tap the ··· and it expands into pages of 8 with ‹ › controls. The league
// carries the name of the rank you've actually earned.
function Leaderboard({ state, xp }) {
  const rows = buildLeaderboard(state.name, xp)
  const userIdx = rows.findIndex((r) => r.isUser)
  const [expanded, setExpanded] = useState(false)
  const PAGE = 8
  const pages = Math.ceil(rows.length / PAGE)
  const [page, setPage] = useState(0)

  const Row = ({ row, i }) => (
    <div className={`lb-row ${row.isUser ? 'me' : ''}`}>
      <span className="lb-rank">{i + 1}</span>
      <span>{row.name}{row.isUser && row.name !== 'You' ? ' (you)' : ''}</span>
      <span className="lb-xp">{row.xp} XP</span>
    </div>
  )

  return (
    <div className="card">
      <h3><Ic src={IMGS.trophy} alt="🏆" size={18} /> {leagueName(state)} · resets in 4 days</h3>
      <div className="sub" style={{ marginBottom: 8 }}>Top 20% advance · bottom 10% demote · {rows.length} grinders in your league</div>

      {!expanded ? (
        <>
          {rows.slice(0, 5).map((row, i) => <Row row={row} i={i} key={row.name + i} />)}
          {userIdx >= 5
            ? (
              <>
                <div className="lb-gap lb-gap-btn" onClick={() => { setPage(Math.floor(userIdx / PAGE)); setExpanded(true) }} title="Show the full league">···</div>
                <Row row={rows[userIdx]} i={userIdx} />
              </>
            )
            : <div className="lb-gap lb-gap-btn" onClick={() => setExpanded(true)} title="Show the full league">···</div>}
        </>
      ) : (
        <>
          {rows.slice(page * PAGE, page * PAGE + PAGE).map((row, i) => <Row row={row} i={page * PAGE + i} key={row.name + i} />)}
          <div className="lb-pager">
            <button className="lb-pg-btn" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>‹</button>
            <span className="lb-pg-label">{page + 1} / {pages}</span>
            <button className="lb-pg-btn" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>›</button>
            <span className="link" style={{ marginLeft: 'auto' }} onClick={() => { setExpanded(false); setPage(0) }}>collapse</span>
          </div>
        </>
      )}
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
    won: <><Ic src={IMGS.trophy} alt="" size={15} /> You won the duel! Claim it tomorrow.</>,
    lost: <><Ic src={IMGS.skull} alt="" size={15} /> You lost this duel. Run it back.</>,
    tied: 'Duel tied — rematch?',
  }[duel.status]
  return (
    <div className="card">
      <h3><Ic src={IMGS.swords} alt="⚔️" size={20} /> Rival Duel · vs {duel.opponent}</h3>
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

// First-time party experience: you're not in a squad until you make one.
// Create it, then invite the people you follow.
// Shared party identity form — used when creating a squad and when editing it.
function PartyIdentityFields({ name, setName, bio, setBio, emblem, setEmblem }) {
  return (
    <>
      <Field label="Squad name">
        <input value={name} maxLength={24} placeholder="e.g. Dawn Raiders" onChange={(e) => setName(e.target.value)} style={{ marginTop: 4 }} />
      </Field>
      <div style={{ marginTop: 8 }}>
        <Field label="Party bio">
          <input value={bio} maxLength={70} placeholder="What is this crew about?" onChange={(e) => setBio(e.target.value)} />
        </Field>
      </div>
      <div className="field-label" style={{ marginTop: 12 }}>Emblem</div>
      <div className="emblem-row">
        {PARTY_EMBLEMS.map((e) => (
          <button
            key={e.id}
            className={`emblem-opt ${emblem === e.id ? 'on' : ''}`}
            onClick={() => setEmblem(e.id)}
            title={e.icon}
          >
            <Ic src={e.img} alt={e.icon} size={24} />
          </button>
        ))}
      </div>
    </>
  )
}

function CreateSquad({ state, setState, flash }) {
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [emblem, setEmblem] = useState('em-party')
  const [invited, setInvited] = useState([])
  const followedUsers = SOCIAL_USERS.filter((u) => (state.social?.following || []).includes(u.id))

  function toggleInvite(id) {
    setInvited((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))
  }

  function create() {
    const invitees = SOCIAL_USERS.filter((u) => invited.includes(u.id))
    setState((s) => ({ ...s, squad: createSquad(name.trim() || 'My Squad', s.name, invitees, bio.trim(), emblem) }))
    flash(<><Ic src={IMGS.party} alt="" size={15} /> Squad created{invitees.length ? ` — ${invitees.length} invited` : ''}!</>)
  }

  return (
    <>
      <div className="card">
        <h3><Ic src={IMGS.party} alt="🎉" size={20} /> You’re not in a squad yet</h3>
        <div className="sub">
          A squad is your accountability crew — daily check-ins, a locked-in leaderboard, and people who notice when you slack.
        </div>
        <PartyIdentityFields name={name} setName={setName} bio={bio} setBio={setBio} emblem={emblem} setEmblem={setEmblem} />

        <div className="field-label" style={{ marginTop: 14 }}>Invite people you follow</div>
        {followedUsers.length === 0 ? (
          <div className="sub" style={{ marginTop: 6 }}>
            You’re not following anyone yet — find people in the <b style={{ color: 'var(--text)' }}>Feed</b> tab and follow them, then invite them here. You can also start solo.
          </div>
        ) : (
          followedUsers.map((u) => {
            const on = invited.includes(u.id)
            return (
              <div className="lb-row" key={u.id}>
                <img className="member-photo" src={u.photo} alt="" />
                <span>{u.name}</span>
                <button className={`follow-btn ${on ? 'on' : ''}`} style={{ marginLeft: 'auto' }} onClick={() => toggleInvite(u.id)}>
                  {on ? '✓ Invited' : 'Invite'}
                </button>
              </div>
            )
          })
        )}

        <button className="btn" onClick={create} style={{ marginTop: 14 }}>
          Create squad{invited.length > 0 ? ` with ${invited.length} ${invited.length === 1 ? 'friend' : 'friends'}` : ''}
        </button>
      </div>
    </>
  )
}

function Squad({ state, setState, flash }) {
  const squad = state.squad
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(squad?.name || '')
  const [bio, setBio] = useState(squad?.bio || '')
  const [emblem, setEmblem] = useState(squad?.emblem || 'em-party')
  if (!squad) return <CreateSquad state={state} setState={setState} flash={flash} />

  const ours = squadTotalXp(squad, state.xp)
  const checkedIn = userCheckedIn(squad)
  const waiting = membersAwaitingCheckin(squad).filter((m) => !m.isUser)
  const pRank = partyRank(ours)
  const emblemItem = PARTY_EMBLEMS.find((e) => e.id === squad.emblem) || PARTY_EMBLEMS[0]

  function saveParty() {
    setState((s) => ({ ...s, squad: { ...s.squad, name: name.trim() || s.squad.name, bio: bio.trim(), emblem } }))
    setEditing(false)
    flash('Party profile saved')
  }

  function checkIn() {
    if (checkedIn) return
    setState((s) => ({
      ...s,
      emeralds: (s.emeralds || 0) + 3,
      squad: {
        ...s.squad,
        members: s.squad.members.map((m) => (m.isUser ? { ...m, checkedInOn: todayKey() } : m)),
      },
    }))
    flash(<>Checked in! +3 <Ic src={IMGS.gem} alt="" size={14} /></>)
  }

  function nudge(name) {
    if (squad.nudged.includes(name)) return
    setState((s) => ({ ...s, squad: { ...s.squad, nudged: [...s.squad.nudged, name] } }))
    flash(`Nudged ${name}`)
  }

  return (
    <>
      <div className="card">
        <div className="hud">
          <div className="avatar" style={{ background: 'var(--panel-2)' }}><Ic src={emblemItem.img} alt={emblemItem.icon} size={28} /></div>
          <div className="grow">
            <div className="lvl">{squad.name}</div>
            <div className="rank">{squad.members.length} in the party · {ours.toLocaleString()} party XP this week</div>
          </div>
          <span className="pill" style={{ color: pRank.color }} title={`${ours.toLocaleString()} weekly XP`}>
            <Ic src={pRank.img} alt="" size={15} /> {pRank.label}
          </span>
        </div>
        {squad.bio && <div className="sub" style={{ marginTop: 8 }}>“{squad.bio}”</div>}

        {editing ? (
          <div style={{ marginTop: 12 }}>
            <PartyIdentityFields name={name} setName={setName} bio={bio} setBio={setBio} emblem={emblem} setEmblem={setEmblem} />
            <button className="btn" onClick={saveParty} style={{ marginTop: 12 }}>Save party</button>
            <button className="btn ghost" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        ) : (
          <>
            {!checkedIn && (
              <div className="sub" style={{ marginTop: 10, color: 'var(--flame)' }}>
                <Ic src={IMGS.warning} alt="⚠️" size={14} /> You haven’t checked in today. Your party is counting on you.
              </div>
            )}
            <button className="btn" disabled={checkedIn} onClick={checkIn} style={{ marginTop: 12 }}>
              {checkedIn ? <>✓ Checked in for today</> : <>I’m in for today (+3 <Ic src={IMGS.gem} alt="" size={13} />)</>}
            </button>
            <button
              className="btn ghost"
              onClick={() => { setName(squad.name); setBio(squad.bio || ''); setEmblem(squad.emblem || 'em-party'); setEditing(true) }}
            >
              <Ic src={IMGS.pencil} alt="✏️" size={14} /> Customize party
            </button>
          </>
        )}
      </div>

      <div className="card">
        <h3><Ic src={IMGS.lock} alt="🔒" size={18} /> Most Locked This Week</h3>
        <div className="sub" style={{ marginBottom: 8 }}>Ranked by focused minutes actually recorded on camera. No proof, no minutes.</div>
        {lockedBoard(squad, state).map((m, i) => (
          <div className={`lb-row ${m.isUser ? 'me' : ''}`} key={m.name}>
            <span className="lb-rank">{i === 0 ? <Ic src={IMGS.crown} alt="👑" size={16} /> : i + 1}</span>
            {m.photo
              ? <img className="member-photo" src={m.photo} alt="" />
              : <span className="member-photo member-photo-you">{(m.name || 'Y')[0]}</span>}
            <span>{m.name}{m.isUser && m.name !== 'You' ? ' (you)' : ''}</span>
            <span className="lb-xp">{m.locked} min locked</span>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Daily Check-In</h3>
        {squad.members.map((m) => {
          const inToday = m.checkedInOn === todayKey()
          const xp = m.isUser ? state.xp : m.weeklyXp
          return (
            <div className={`lb-row ${m.isUser ? 'me' : ''}`} key={m.name}>
              <span className="lb-rank">{inToday ? <Ic src={IMGS.check} alt="✅" size={16} /> : <Ic src={IMGS.hourglass} alt="⏳" size={16} />}</span>
              {m.photo && <img className="member-photo" src={m.photo} alt="" />}
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

      {/* Grow the party — anyone you follow can be pulled in right here. */}
      <div className="card">
        <h3><Ic src={IMGS.wave} alt="👋" size={18} /> Add to your party</h3>
        {(() => {
          const inParty = new Set(squad.members.map((m) => m.userId))
          const candidates = SOCIAL_USERS.filter((u) => (state.social?.following || []).includes(u.id) && !inParty.has(u.id))
          if (candidates.length === 0) {
            return (
              <div className="sub">
                Everyone you follow is already in — follow more grinders in the <b style={{ color: 'var(--text)' }}>Feed</b> to invite them.
              </div>
            )
          }
          return candidates.map((u) => (
            <div className="lb-row" key={u.id}>
              <img className="member-photo" src={u.photo} alt="" />
              <span>{u.name}</span>
              <button
                className="follow-btn"
                style={{ marginLeft: 'auto' }}
                onClick={() => {
                  setState((s) => ({
                    ...s,
                    squad: {
                      ...s.squad,
                      members: [...s.squad.members, {
                        name: u.name, userId: u.id, photo: u.photo,
                        weeklyXp: u.weeklyXp, lockedMins: u.lockedMins, checkedInOn: null,
                      }],
                    },
                  }))
                  flash(<><Ic src={IMGS.party} alt="" size={14} /> {u.name} joined the party!</>)
                }}
              >
                + Invite
              </button>
            </div>
          ))
        })()}
      </div>
    </>
  )
}

/* ---------------- Feed — the wall ---------------- */

function timeAgo(ts) {
  const mins = Math.max(1, Math.round((Date.now() - ts) / 60000))
  if (mins < 60) return `${mins}m`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.round(hrs / 24)}d`
}

// Tap any user and get a REAL profile — banner, Human Score with pillar
// bars, rank, streaks — the same anatomy as your own profile page, plus
// Instagram-style follower counts and a Follow button.
function UserProfilePage({ user, state, setState, flash, onClose }) {
  const following = (state.social?.following || []).includes(user.id)
  const inParty = (state.squad?.members || []).some((m) => m.userId === user.id)
  const score = user.score || { mind: 500, body: 500, intellect: 500 }
  const total = Math.round((score.mind + score.body + score.intellect) / 3)
  const rankMeta = TIER_META[user.rankTier] || null
  const postCount = (state.social?.posts || []).filter((p) => p.userId === user.id).length || 1

  function toggleFollow() {
    setState((s) => ({
      ...s,
      social: {
        ...s.social,
        following: following
          ? s.social.following.filter((id) => id !== user.id)
          : [...(s.social.following || []), user.id],
      },
    }))
    flash(following ? `Unfollowed ${user.name}` : `Following ${user.name}!`)
  }

  function invite() {
    if (inParty) return
    if (!state.squad) { flash('Create a squad in the Party tab first, then invite people'); return }
    setState((s) => ({
      ...s,
      squad: {
        ...s.squad,
        members: [...s.squad.members, {
          name: user.name, userId: user.id, photo: user.photo,
          weeklyXp: user.weeklyXp, lockedMins: user.lockedMins, checkedInOn: null,
        }],
      },
    }))
    flash(<><Ic src={IMGS.party} alt="" size={15} /> {user.name} joined your party!</>)
  }

  return (
    <div className="profile-page">
      <div className="profile-page-inner">
        <div className="pp-top">
          <button className="pp-back" onClick={onClose}>←</button>
          <span className="pp-handle">@{user.name}</span>
        </div>

        {/* Identity on their banner, IG-style counts row, follow/invite */}
        <div className="card banner-card" style={{ background: user.banner || 'linear-gradient(135deg,#0b1220,#12203a)' }}>
          <img className="profile-photo-lg" src={user.photo} alt="" />
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{user.name}</div>
            {user.title && <div style={{ marginTop: 4 }}><span className="profile-title" style={titleChipStyleByLabel(user.title)}>{user.title}</span></div>}
            <div className="sub" style={{ marginTop: 6 }}>{user.bio}</div>
          </div>
          <div className="pp-counts">
            <div><b>{postCount}</b><span>posts</span></div>
            <div><b>{(user.followers || 0) + (following ? 1 : 0)}</b><span>followers</span></div>
            <div><b>{user.followingCount || 0}</b><span>following</span></div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button className={`btn ${following ? 'ghost' : ''}`} style={{ flex: 1, marginTop: 0 }} onClick={toggleFollow}>
              {following ? '✓ Following' : 'Follow'}
            </button>
            <button className="btn ghost" style={{ flex: 1, marginTop: 0 }} disabled={inParty} onClick={invite}>
              {inParty ? '✓ In party' : '+ Party'}
            </button>
          </div>
        </div>

        {/* Their baseline — full Human Score, same as your profile */}
        <div className="card">
          <h3>Human Score</h3>
          <div className="score-big">{total}</div>
          <div className="sub" style={{ textAlign: 'center' }}>{user.name}’s current Human Score</div>
          <ScoreBar label={<><Ic src={IMGS.brain} alt="🧠" size={15} /> Mind</>} value={score.mind} color="var(--mind)" />
          <ScoreBar label={<><Ic src={IMGS.biceps} alt="💪" size={15} /> Body</>} value={score.body} color="var(--body)" />
          <ScoreBar label={<><Ic src={IMGS.books} alt="📚" size={15} /> Intellect</>} value={score.intellect} color="var(--intellect)" />
        </div>

        {/* Their rank + streaks, same anatomy as yours — shown as the title
            their tier earns (Truecel → APEX), not the tier's fancy name. */}
        <div className="card">
          <h3>Rank & Streaks</h3>
          {rankMeta && (
            <>
              <div className="score-big" style={{ fontSize: 26, color: rankMeta.color }}>
                <Ic src={rankMeta.img} alt={rankMeta.icon} size={24} /> {TIER_TITLES[user.rankTier]}
              </div>
              <div className="sub" style={{ textAlign: 'center' }}>{user.rankTier} tier</div>
            </>
          )}
          <div className="stat-grid" style={{ marginTop: 10 }}>
            <Stat value={<><Ic src={IMGS.fire} alt="🔥" size={16} /> {user.streak || 0}</>} label="current streak" />
            <Stat value={<><Ic src={IMGS.medal} alt="🏅" size={16} /> {user.longestStreak || 0}</>} label="longest streak" />
            <Stat value={`Lv ${user.level}`} label={rankForLevel(user.level)} />
            <Stat value={user.weeklyXp.toLocaleString()} label="weekly XP" />
          </div>
          <div className="sub" style={{ marginTop: 10 }}>
            <Ic src={IMGS.lock} alt="🔒" size={13} /> {user.lockedMins} focused minutes recorded on camera this week.
          </div>
        </div>

        <button className="btn ghost" onClick={onClose}>← Back to feed</button>
      </div>
    </div>
  )
}

// Timelapse attached to a post — loads the clip from IndexedDB and
// autoplays it inline (muted + looped), Instagram-style. Falls back to the
// thumbnail while loading or if the clip isn't on this device.
function InlineTimelapse({ proofId, thumbnail }) {
  const [url, setUrl] = useState(null)
  const [broken, setBroken] = useState(false)
  useEffect(() => {
    let objUrl
    loadTimelapse(proofId).then((blob) => {
      if (!blob) return
      objUrl = URL.createObjectURL(blob)
      setUrl(objUrl)
    })
    return () => { if (objUrl) URL.revokeObjectURL(objUrl) }
  }, [proofId])

  // No clip on this device, still loading, or the browser can't decode the
  // codec it was recorded with — fall back to the thumbnail still.
  if (!url || broken) {
    return thumbnail ? (
      <div className="fp-media feed-timelapse">
        <img src={thumbnail} alt="" />
        <span className="feed-play">{broken ? '🎞 timelapse (preview)' : '▶ timelapse'}</span>
      </div>
    ) : null
  }
  return (
    <div className="fp-media feed-timelapse">
      <video src={url} autoPlay muted loop playsInline onError={() => setBroken(true)} />
      <span className="feed-play">● timelapse</span>
    </div>
  )
}

// Instagram-style feed: create posts, search people, follow them, autoplay
// timelapses, and like / comment / share on every post.
// End-of-feed discovery — no story circles. Once you scroll past the last
// post it animates in: real profiles with names and their earned rank title.
function SuggestedFollows({ state, following, toggleFollow, onView }) {
  const ref = useRef(null)
  const [revealed, setRevealed] = useState(false)

  // Reveal once the card scrolls into view (plain rect check — reliable
  // everywhere, no IntersectionObserver dependence).
  useEffect(() => {
    const check = () => {
      const el = ref.current
      if (!el) return
      if (el.getBoundingClientRect().top < window.innerHeight - 60) {
        setRevealed(true)
        window.removeEventListener('scroll', check)
      }
    }
    check()
    window.addEventListener('scroll', check, { passive: true })
    return () => window.removeEventListener('scroll', check)
  }, [])

  const candidates = SOCIAL_USERS.filter((u) => !following.includes(u.id)).slice(0, 5)
  if (candidates.length === 0) return null

  return (
    <div ref={ref} className={`card suggest-card ${revealed ? 'revealed' : ''}`}>
      <div className="suggest-head">
        <Ic src={IMGS.bolt} alt="⚡" size={22} />
        <div>
          <div className="suggest-title">You’re all caught up</div>
          <div className="sub">Grinders on the same path — run it together.</div>
        </div>
      </div>
      {candidates.map((u, i) => {
        const titleId = TIER_TITLE_IDS[u.rankTier]
        return (
          <div className="lb-row suggest-row" style={{ transitionDelay: `${120 + i * 110}ms` }} key={u.id}>
            <img className="member-photo suggest-photo" src={u.photo} alt="" onClick={() => onView(u)} />
            <div className="grow" style={{ cursor: 'pointer' }} onClick={() => onView(u)}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{u.name}</div>
              <span className="profile-title" style={{ fontSize: 9, padding: '1px 6px', ...titleChipStyle(titleId) }}>
                {TIER_TITLES[u.rankTier]}
              </span>
            </div>
            <button className="follow-btn" onClick={() => toggleFollow(u)}>Follow</button>
          </div>
        )
      })}
    </div>
  )
}

function Feed({ state, setState, flash, openMyProfile }) {
  const [draft, setDraft] = useState('')
  const [composing, setComposing] = useState(false)
  const [attachId, setAttachId] = useState(null) // which timelapse to attach
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef(null)
  const [viewing, setViewing] = useState(null) // full user profile page
  const [openComments, setOpenComments] = useState({}) // postId -> bool
  const [commentDrafts, setCommentDrafts] = useState({}) // postId -> text

  function toggleSearch() {
    setSearchOpen((o) => {
      if (o) setQuery('')
      else setTimeout(() => searchRef.current?.focus(), 60)
      return !o
    })
  }
  const social = state.social || { following: [], posts: [] }
  const following = social.following || []

  const me = {
    id: 'me',
    name: state.name || 'You',
    photo: state.avatarImage,
    color: state.avatarColor,
    title: SHOP_ITEMS.find((i) => i.id === state.equippedTitle)?.label || null,
  }
  const authorOf = (post) => (post.userId === 'me' ? me : SOCIAL_USERS.find((u) => u.id === post.userId))

  function toggleFollow(user) {
    const isFollowing = following.includes(user.id)
    setState((s) => ({
      ...s,
      social: {
        ...s.social,
        following: isFollowing
          ? (s.social.following || []).filter((id) => id !== user.id)
          : [...(s.social.following || []), user.id],
      },
    }))
    flash(isFollowing ? `Unfollowed ${user.name}` : `Following ${user.name}!`)
  }

  function publish() {
    const text = draft.trim()
    const attached = (state.proofLog || []).find((p) => p.id === attachId) || null
    if (!text && !attached) { flash('Say something or attach a timelapse'); return }
    const post = {
      id: `p-${Date.now()}`,
      userId: 'me',
      text: text || `Locked in: ${attached.taskTitle} — ${attached.tierLabel}.`,
      proofId: attached ? attached.id : null,
      thumbnail: attached ? attached.thumbnail : null,
      likes: 0, likedByMe: false, comments: [], ts: Date.now(),
    }
    setState((s) => ({ ...s, social: { ...s.social, posts: [post, ...(s.social?.posts || [])] } }))
    setDraft(''); setAttachId(null); setComposing(false)
    flash(<>Posted <Ic src={IMGS.party} alt="" size={14} /></>)
  }

  function toggleLike(id) {
    setState((s) => ({
      ...s,
      social: {
        ...s.social,
        posts: s.social.posts.map((p) =>
          p.id === id ? { ...p, likedByMe: !p.likedByMe, likes: p.likes + (p.likedByMe ? -1 : 1) } : p),
      },
    }))
  }

  function addComment(id) {
    const text = (commentDrafts[id] || '').trim()
    if (!text) return
    const comment = { id: `c-${Date.now()}`, name: state.name || 'You', text, ts: Date.now() }
    setState((s) => ({
      ...s,
      social: {
        ...s.social,
        posts: s.social.posts.map((p) =>
          p.id === id ? { ...p, comments: [...(p.comments || []), comment] } : p),
      },
    }))
    setCommentDrafts((d) => ({ ...d, [id]: '' }))
    setOpenComments((o) => ({ ...o, [id]: true }))
  }

  async function share(post) {
    const author = authorOf(post)
    const text = `${author?.name || 'Someone'} on APEX: "${post.text}"`
    try {
      if (navigator.share) await navigator.share({ text })
      else { await navigator.clipboard.writeText(text); flash('Copied — paste it anywhere') }
    } catch { /* user cancelled the share sheet */ }
  }

  const posts = [...(social.posts || [])].sort((a, b) => b.ts - a.ts)
  const q = query.trim().toLowerCase()
  const results = q
    ? SOCIAL_USERS.filter((u) => u.name.toLowerCase().includes(q) || (u.bio || '').toLowerCase().includes(q))
    : null

  return (
    <>
      {/* Title row + magnifying glass that expands into the search bar */}
      <div className="page-head feed-head">
        {!searchOpen && (
          <div>
            <h2 className="page-title">Feed</h2>
          </div>
        )}
        <div className={`search-pill ${searchOpen ? 'open' : ''}`}>
          <input
            ref={searchRef}
            className="search-input"
            placeholder="Search friends and grinders…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && toggleSearch()}
          />
          <button className="search-toggle" title={searchOpen ? 'Close search' : 'Search people'} onClick={toggleSearch}>
            {searchOpen ? '✕' : <Ic src={IMGS.search} alt="🔍" size={18} />}
          </button>
        </div>
      </div>

      {results && (
        <div className="card">
          {results.length === 0
            ? <div className="sub">No one found for “{query}”.</div>
            : results.map((u) => (
                <div className="lb-row" key={u.id}>
                  <img className="member-photo" src={u.photo} alt="" style={{ cursor: 'pointer' }} onClick={() => setViewing(u)} />
                  <div className="grow" style={{ cursor: 'pointer' }} onClick={() => setViewing(u)}>
                    <div style={{ fontSize: 14 }}>{u.name}</div>
                    <div className="feed-time">{u.bio}</div>
                  </div>
                  <button className={`follow-btn ${following.includes(u.id) ? 'on' : ''}`} onClick={() => toggleFollow(u)}>
                    {following.includes(u.id) ? 'Following' : 'Follow'}
                  </button>
                </div>
              ))}
        </div>
      )}

      {posts.map((p) => {
        const author = authorOf(p)
        if (!author) return null
        const isMe = p.userId === 'me'
        const comments = p.comments || []
        const showComments = !!openComments[p.id]
        return (
          <div className="card feed-post boxed" key={p.id}>
            <div className="fp-pad feed-author">
              <span onClick={() => (isMe ? openMyProfile() : setViewing(author))} style={{ cursor: 'pointer', display: 'inline-flex' }}>
                {author.photo
                  ? <img className="member-photo" src={author.photo} alt="" />
                  : <span className="member-photo member-photo-you" style={{ background: author.color || 'var(--blue)' }}>{author.name[0]}</span>}
              </span>
              <div className="grow" onClick={() => (isMe ? openMyProfile() : setViewing(author))} style={{ cursor: 'pointer' }}>
                <div className="feed-name">
                  {author.name}
                  {author.title && <span className="profile-title" style={{ fontSize: 9, padding: '1px 6px', ...titleChipStyleByLabel(author.title) }}>{author.title}</span>}
                </div>
                <div className="feed-time">{timeAgo(p.ts)} ago</div>
              </div>
              {!isMe && !following.includes(author.id) && (
                <button className="follow-btn" onClick={() => toggleFollow(author)}>Follow</button>
              )}
            </div>
            <div className="fp-pad feed-text">{p.text}</div>
            {p.image && <img className="fp-media" src={p.image} alt="" loading="lazy" />}
            {p.proofId && <InlineTimelapse proofId={p.proofId} thumbnail={p.thumbnail} />}

            <div className="fp-pad feed-actions">
              <button className={`fa-btn ${p.likedByMe ? 'liked' : ''}`} onClick={() => toggleLike(p.id)} title="Like">
                <Ic src={IMGS.heart} alt="❤️" size={20} />
              </button>
              <button className="fa-btn" onClick={() => setOpenComments((o) => ({ ...o, [p.id]: !o[p.id] }))} title="Comment">
                <Ic src={IMGS.comment} alt="💬" size={20} />
              </button>
              <button className="fa-btn" onClick={() => share(p)} title="Share">
                <Ic src={IMGS.share} alt="📤" size={20} />
              </button>
            </div>
            <div className="fp-pad feed-likes">{p.likes.toLocaleString()} like{p.likes === 1 ? '' : 's'}</div>

            {comments.length > 0 && !showComments && (
              <div className="fp-pad feed-view-comments" onClick={() => setOpenComments((o) => ({ ...o, [p.id]: true }))}>
                View {comments.length === 1 ? '1 comment' : `all ${comments.length} comments`}
              </div>
            )}
            {showComments && comments.map((c) => (
              <div className="fp-pad feed-comment" key={c.id}>
                <b>{c.name}</b> {c.text}
              </div>
            ))}
            <div className="fp-pad feed-add-comment">
              <input
                placeholder="Add a comment…"
                value={commentDrafts[p.id] || ''}
                onChange={(e) => setCommentDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && addComment(p.id)}
              />
              {(commentDrafts[p.id] || '').trim() && (
                <span className="link" onClick={() => addComment(p.id)}>Post</span>
              )}
            </div>
          </div>
        )
      })}

      {/* After the last post: animated follow suggestions */}
      <SuggestedFollows state={state} following={following} toggleFollow={toggleFollow} onView={setViewing} />

      {/* Floating create button — YouTube/IG style */}
      <button className="fab" title="Create new post" onClick={() => setComposing(true)}>
        <Ic src={IMGS.pencil} alt="✏️" size={22} />
      </button>

      {composing && (
        <div className="modal-backdrop" onClick={() => setComposing(false)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <h3><Ic src={IMGS.pencil} alt="✏️" size={18} /> New post</h3>
            <input
              placeholder="What did you lock in today?"
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && publish()}
            />
            {(state.proofLog || []).length > 0 && (
              <>
                <div className="field-label" style={{ marginTop: 12 }}>Attach a timelapse</div>
                <div className="proof-pick-row">
                  <div className={`proof-pick proof-pick-none ${!attachId ? 'on' : ''}`} onClick={() => setAttachId(null)}>
                    <span>None</span>
                  </div>
                  {[...state.proofLog].reverse().map((p) => (
                    <div key={p.id} className={`proof-pick ${attachId === p.id ? 'on' : ''}`} onClick={() => setAttachId(p.id)} title={`${p.taskTitle} · ${p.tierLabel}`}>
                      {p.thumbnail
                        ? <img src={p.thumbnail} alt="" />
                        : <span className="proof-pick-blank"><Ic src={IMGS.camera} alt="🎞️" size={18} /></span>}
                      <span className="proof-pick-label">{p.taskTitle}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" style={{ flex: 1 }} onClick={publish}>Post</button>
              <button className="btn ghost" style={{ flex: 0.7 }} onClick={() => { setComposing(false); setDraft(''); setAttachId(null) }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {viewing && <UserProfilePage user={viewing} state={state} setState={setState} flash={flash} onClose={() => setViewing(null)} />}
    </>
  )
}

/* ---------------- Pet ---------------- */

// Your grind buddy — with a name you choose, a coat color you pick, and a
// real growth arc: every feeding is pet XP, and enough XP EVOLVES it
// (Pup → Hound → Dire Wolf → War Lion → Apex Dragon). Feedings also roll
// treats and unlock pet-exclusive icons.
function PetCard({ state, setState, flash }) {
  const pet = state.pet || DEFAULT_PET
  const fruits = state.fruits || 0
  const fed = pet.fed || 0
  const stage = petStage(fed)
  const color = PET_COLORS.find((c) => c.id === pet.color) || PET_COLORS[0]
  const nextUnlock = PET_UNLOCKS.find((u) => u.fed > fed)
  const [munching, setMunching] = useState(false)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(pet.name)

  function feed() {
    if (fruits <= 0) return
    const newFed = fed + 1
    const outcome = feedPetOutcome()
    const unlock = PET_UNLOCKS.find((u) => u.fed === newFed)
    const evolved = petStage(newFed).level > stage.level
    setMunching(true)
    setTimeout(() => setMunching(false), 700)
    setState((s) => {
      const next = { ...s, fruits: Math.max(0, (s.fruits || 0) - 1), pet: { ...(s.pet || DEFAULT_PET), fed: newFed } }
      if (outcome.kind === 'emeralds') next.emeralds = (s.emeralds || 0) + outcome.value
      else if (outcome.kind === 'spin') next.bonusSpins = (s.bonusSpins || 0) + outcome.value
      else if (outcome.kind === 'xpboost') next.xpBoost = outcome.value
      else if (outcome.kind === 'shield') next.shields = (s.shields || 0) + outcome.value
      if (unlock && !(s.ownedIcons || []).includes(unlock.icon)) {
        next.ownedIcons = [...(s.ownedIcons || []), unlock.icon]
      }
      return next
    })
    const unlockItem = unlock && SHOP_ITEMS.find((i) => i.id === unlock.icon)
    if (evolved) {
      const ns = petStage(newFed)
      flash(<><Ic src={ns.img} alt="" size={18} /> {pet.name} EVOLVED into a {ns.name}! (Lv {ns.level})</>)
    } else if (unlockItem) {
      flash(<><Ic src={unlockItem.img} alt="" size={16} /> {pet.name} dug up the {unlockItem.label} icon — pet exclusive!</>)
    } else if (outcome.kind === 'emeralds') {
      flash(<>{pet.name} says thanks! +{outcome.value} <Ic src={IMGS.gem} alt="" size={14} />{outcome.rare ? ' (rare!)' : ''}</>)
    } else if (outcome.kind === 'spin') {
      flash(<>{pet.name} fetched a bonus spin <Ic src={IMGS.slot} alt="" size={14} /></>)
    } else if (outcome.kind === 'xpboost') {
      flash(<>{pet.name} is hyped — {outcome.value}× XP on your next task!</>)
    } else {
      flash(<><Ic src={IMGS.shield} alt="" size={14} /> {pet.name} buried a Streak Recovery for you</>)
    }
  }

  function saveCustomization() {
    setState((s) => ({ ...s, pet: { ...(s.pet || DEFAULT_PET), name: name.trim() || 'Byte' } }))
    setEditing(false)
    flash('Pet updated!')
  }

  return (
    <div className="card pet-card">
      <div className={`pet-avatar ${munching ? 'munch' : ''}`}>
        <img src={stage.img} alt={stage.name} width={64} height={64} style={{ filter: color.filter }} className="ic-img" />
        {munching && (
          <>
            <span className="pet-heart h1">❤️</span>
            <span className="pet-heart h2">🍎</span>
            <span className="pet-heart h3">✨</span>
          </>
        )}
      </div>
      <div className="pet-name">
        {pet.name}
        <span className="pet-level">Lv {stage.level} · {stage.name}</span>
      </div>
      <div className="sub" style={{ textAlign: 'center' }}>
        {fed} pet XP · finish tasks at <b style={{ color: TIER_COLORS.Gold }}>Gold</b> or higher to earn fruit
      </div>

      {stage.next ? (
        <>
          <div className="score-row" style={{ marginTop: 12 }}>
            <span>Evolves into <b>{stage.next.name}</b></span>
            <span>{fed}/{stage.next.fed} XP</span>
          </div>
          <div className="bar"><i style={{ width: `${Math.min(100, (fed / stage.next.fed) * 100)}%`, background: 'var(--mind)' }} /></div>
        </>
      ) : (
        <div className="sub" style={{ textAlign: 'center', marginTop: 10 }}>
          <Ic src={IMGS.crown} alt="👑" size={14} /> Final form reached. {pet.name} is legendary.
        </div>
      )}

      {nextUnlock && (
        <>
          <div className="score-row" style={{ marginTop: 10 }}>
            <span>Next icon: <b>{SHOP_ITEMS.find((i) => i.id === nextUnlock.icon)?.label}</b></span>
            <span>{fed}/{nextUnlock.fed} feedings</span>
          </div>
          <div className="bar"><i style={{ width: `${Math.min(100, (fed / nextUnlock.fed) * 100)}%`, background: 'var(--flame)' }} /></div>
        </>
      )}

      <button className="btn" disabled={fruits <= 0} onClick={feed} style={{ marginTop: 14 }}>
        {fruits > 0
          ? <>Feed {pet.name} — {fruits} <Ic src={IMGS.apple} alt="fruit" size={15} /> left</>
          : <>No fruit yet — go rank up</>}
      </button>

      {!editing ? (
        <button className="btn ghost" onClick={() => { setName(pet.name); setEditing(true) }}>
          <Ic src={IMGS.pencil} alt="✏️" size={14} /> Customize {pet.name}
        </button>
      ) : (
        <div style={{ marginTop: 12, textAlign: 'left' }}>
          <Field label="Pet name">
            <input value={name} maxLength={14} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="field-label" style={{ marginTop: 10 }}>Coat color</div>
          <div className="pet-color-row">
            {PET_COLORS.map((c) => (
              <button
                key={c.id}
                className={`pet-color-opt ${pet.color === c.id ? 'on' : ''}`}
                title={c.label}
                onClick={() => setState((s) => ({ ...s, pet: { ...(s.pet || DEFAULT_PET), color: c.id } }))}
              >
                <img src={stage.img} alt={c.label} width={30} height={30} style={{ filter: c.filter }} />
              </button>
            ))}
          </div>
          <button className="btn" onClick={saveCustomization} style={{ marginTop: 12 }}>Save</button>
        </div>
      )}
    </div>
  )
}

// The Pet tab: the pet itself, its evolution ladder, and the icons only it
// can unlock.
function PetZone({ state, setState, flash }) {
  const fed = state.pet?.fed || 0
  const owned = state.ownedIcons || []

  function equipIcon(id) {
    if (!owned.includes(id)) return
    setState((s) => ({ ...s, equippedIcon: id, avatarImage: null }))
    flash('Icon equipped!')
  }

  return (
    <>
      <PetCard state={state} setState={setState} flash={flash} />

      <div className="card">
        <h3><Ic src={IMGS.chart} alt="📈" size={18} /> Evolution line</h3>
        <div className="evo-row">
          {PET_STAGES.map((s) => {
            const reached = fed >= s.fed
            return (
              <div key={s.level} className={`evo-step ${reached ? 'on' : ''}`} title={`${s.name} · ${s.fed} XP`}>
                <img src={s.img} alt={s.name} width={34} height={34} style={reached ? undefined : { filter: 'grayscale(1) opacity(0.45)' }} />
                <span>Lv {s.level}</span>
              </div>
            )
          })}
        </div>
        <div className="sub" style={{ marginTop: 8 }}>Every feeding = 1 pet XP. Evolutions at {PET_STAGES.slice(1).map((s) => s.fed).join(', ')} XP.</div>
      </div>

      <div className="card">
        <h3><Ic src={IMGS.pet} alt="🐶" size={18} /> Pet-exclusive icons</h3>
        <div className="sub" style={{ marginBottom: 6 }}>Only your pet can dig these up — no emeralds accepted.</div>
        {PET_UNLOCKS.map((u) => {
          const item = SHOP_ITEMS.find((i) => i.id === u.icon)
          const isOwned = owned.includes(u.icon)
          const equipped = state.equippedIcon === u.icon
          return (
            <div className="shop-item" key={u.icon}>
              <div className="shop-item-icon">
                <Ic src={item.img} alt={item.icon || ''} size={30} style={isOwned ? undefined : { filter: 'grayscale(1) opacity(0.4)' }} />
              </div>
              <div className="grow">
                <div className="tt">{item.label}</div>
                <div className="meta">{isOwned ? 'unlocked' : `unlocks at ${u.fed} feedings`}</div>
              </div>
              <button className="btn ghost" disabled={!isOwned || equipped} onClick={() => equipIcon(u.icon)}>
                {equipped ? 'Equipped' : isOwned ? 'Equip' : `${Math.min(fed, u.fed)}/${u.fed}`}
              </button>
            </div>
          )
        })}
      </div>
    </>
  )
}

/* ---------------- Shop ---------------- */

function Shop({ state, setState, flash }) {
  const ownership = {
    icon: { owned: state.ownedIcons || [], ownedKey: 'ownedIcons', equipped: state.equippedIcon, equipKey: 'equippedIcon' },
    banner: { owned: state.ownedBanners || [], ownedKey: 'ownedBanners', equipped: state.equippedBanner, equipKey: 'equippedBanner' },
    title: { owned: state.ownedTitles || [], ownedKey: 'ownedTitles', equipped: state.equippedTitle, equipKey: 'equippedTitle' },
  }

  function buyOrEquip(item) {
    if (item.type === 'utility') {
      if ((state.emeralds || 0) < item.price) { flash(<>Not enough emeralds <Ic src={IMGS.gem} alt="" size={13} /></>); return }
      if (item.id === 'ut-boost' && (state.xpBoost || 1) > 1) { flash('A boost is already armed — spend it on a task first'); return }
      setState((s) => ({
        ...s,
        emeralds: (s.emeralds || 0) - item.price,
        shields: item.id === 'ut-shield' ? (s.shields || 0) + 1 : s.shields,
        bonusSpins: item.id === 'ut-spin' ? (s.bonusSpins || 0) + 1 : s.bonusSpins,
        xpBoost: item.id === 'ut-boost' ? 2 : s.xpBoost,
      }))
      flash(item.id === 'ut-shield'
        ? <><Ic src={IMGS.shield} alt="" size={15} /> Streak Recovery ready — it auto-saves your next missed day</>
        : item.id === 'ut-spin'
          ? <><Ic src={IMGS.slot} alt="" size={15} /> Bonus spin added — the wheel awaits</>
          : <><Ic src={IMGS.bolt} alt="" size={15} /> 2× XP armed for your next task</>)
      return
    }
    const o = ownership[item.type]
    if (o.owned.includes(item.id)) {
      setState((s) => ({ ...s, [o.equipKey]: s[o.equipKey] === item.id ? (item.type === 'title' ? null : s[o.equipKey]) : item.id }))
      flash(`Equipped ${item.label}`)
      return
    }
    if (item.limited) { flash(<>Spin-exclusive — win it on the Daily Spin <Ic src={IMGS.slot} alt="" size={14} /></>); return }
    if (item.petOnly) { flash(<>Pet-exclusive — keep feeding your pet to dig this one up <Ic src={IMGS.pet} alt="" size={14} /></>); return }
    if ((state.emeralds || 0) < item.price) { flash(<>Not enough emeralds <Ic src={IMGS.gem} alt="" size={13} /></>); return }
    setState((s) => ({
      ...s,
      emeralds: (s.emeralds || 0) - item.price,
      [o.ownedKey]: [...(s[o.ownedKey] || []), item.id],
      [o.equipKey]: item.id,
    }))
    flash(`Unlocked ${item.label}!`)
  }

  function ShopRow({ item }) {
    const o = ownership[item.type]
    const isOwned = o ? o.owned.includes(item.id) : false
    const equipped = o ? o.equipped === item.id : false
    return (
      <div className={`shop-item ${equipped ? 'equipped' : ''}`}>
        <div className="shop-item-icon" style={item.type === 'banner' ? { background: item.gradient, borderRadius: 10 } : undefined}>
          {item.img ? <Ic src={item.img} alt={item.icon || ''} size={30} />
            : item.type === 'icon' ? <Ic src={IMGS.person} alt="" size={26} />
            : item.type === 'title' ? <Ic src={IMGS.crown} alt="🏷️" size={26} /> : ''}
        </div>
        <div className="grow">
          <div className="tt">{item.label}</div>
          <div className="meta">
            <span className="price-emerald">
              {item.limited ? <><Ic src={IMGS.slot} alt="" size={13} /> spin-only</>
                : item.petOnly ? <><Ic src={IMGS.pet} alt="" size={13} /> pet reward</>
                : item.price === 0 ? 'Free' : <><Ic src={IMGS.gem} alt="💎" size={13} /> {item.price}</>}
            </span>
            {item.blurb && <span> · {item.blurb}</span>}
          </div>
        </div>
        <button className="btn ghost" disabled={equipped || ((item.limited || item.petOnly) && !isOwned)} onClick={() => buyOrEquip(item)}>
          {item.type === 'utility' ? 'Buy' : equipped ? 'Equipped' : isOwned ? 'Equip' : (item.limited || item.petOnly) ? 'Locked' : 'Buy'}
        </button>
      </div>
    )
  }

  const section = (type) => SHOP_ITEMS.filter((i) => i.type === type)

  return (
    <>
      <div className="card">
        <h3><Ic src={IMGS.bags} alt="🛍️" size={20} /> Shop</h3>
        <div className="sub">Decorate your screen and profile. Everything runs on <b className="price-emerald"><Ic src={IMGS.gem} alt="💎" size={13} /> emeralds</b> — earn them from every ranked finish, spins, check-ins, and duels.</div>
        <div className="sub" style={{ marginTop: 6 }}>Balance: <span className="price-emerald"><Ic src={IMGS.gem} alt="💎" size={14} /> {state.emeralds || 0}</span></div>
      </div>
      <div className="card">
        <h3><Ic src={IMGS.bolt} alt="⚡" size={20} /> Power-ups</h3>
        <div className="sub" style={{ marginBottom: 4 }}>Shields absorb missed days · spins hit the wheel · boosters double your next task’s XP.</div>
        {section('utility').map((item) => <ShopRow key={item.id} item={item} />)}
        <div className="sub" style={{ marginTop: 6 }}>
          Shields owned: {state.shields || 0} · spins today: {1 + (state.bonusSpins || 0) - (state.spunOn === todayKey() ? state.spinsUsed || 0 : 0)} · boost: {state.xpBoost > 1 ? `${state.xpBoost}× armed` : 'none'}
        </div>
      </div>
      <div className="card">
        <h3>Profile banners</h3>
        {section('banner').map((item) => <ShopRow key={item.id} item={item} />)}
      </div>
      <div className="sub" style={{ marginTop: 12, textAlign: 'center' }}>
        Looking for icons or titles? Icons come from your <b style={{ color: 'var(--text)' }}>Pet</b> · titles are earned on your <b style={{ color: 'var(--text)' }}>Profile</b>.
      </div>
    </>
  )
}

/* ---------------- Titles ---------------- */

// Titles are trophies, not merchandise. Every title in the game is listed —
// what you've earned is wearable, what you haven't shows exactly how to get it.
function TitlesBox({ state, setState, flash }) {
  const earned = earnedTitleIds(state)
  return (
    <div className="card">
      <h3><Ic src={IMGS.crown} alt="👑" size={18} /> Titles</h3>
      <div className="sub" style={{ marginBottom: 8 }}>
        Earned, never bought. {earned.length}/{TITLE_ACHIEVEMENTS.length} unlocked — tap one to wear it.
      </div>
      {TITLE_ACHIEVEMENTS.map((t) => {
        const item = SHOP_ITEMS.find((i) => i.id === t.id)
        if (!item) return null
        const has = earned.includes(t.id)
        const wearing = state.equippedTitle === t.id
        return (
          <div className={`title-row ${has ? 'earned' : ''}`} key={t.id}>
            <span className={`profile-title ${has ? '' : 'title-locked'}`} style={has ? titleChipStyle(t.id) : undefined}>{item.label}</span>
            <span className="title-how">{has ? '✓ earned' : t.how}</span>
            <button
              className="follow-btn title-wear"
              disabled={!has}
              onClick={() => {
                setState((s) => ({ ...s, equippedTitle: wearing ? null : t.id }))
                flash(wearing ? 'Title removed' : `Now wearing “${item.label}”`)
              }}
            >
              {wearing ? 'Remove' : has ? 'Wear' : <Ic src={IMGS.lock} alt="🔒" size={13} />}
            </button>
          </div>
        )
      })}
    </div>
  )
}

/* ---------------- Profile ---------------- */

// Identity card — profile picture (upload / icon / plain color), name, bio,
// and equipped title, sitting on your equipped banner. `startEditing` (a
// counter) drops you straight into edit mode, e.g. from Settings.
function ProfileIdentity({ state, setState, flash, startEditing }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(state.name || 'You')
  const [bio, setBio] = useState(state.bio || '')
  const fileRef = useRef(null)
  const colorRef = useRef(null)
  const bannerItem = SHOP_ITEMS.find((i) => i.id === state.equippedBanner) || SHOP_ITEMS.find((i) => i.id === 'bn-default')
  const iconItem = SHOP_ITEMS.find((i) => i.id === state.equippedIcon)
  const titleItem = SHOP_ITEMS.find((i) => i.id === state.equippedTitle)
  const ownedTitleItems = SHOP_ITEMS.filter((i) => i.type === 'title' && earnedTitleIds(state).includes(i.id))

  useEffect(() => {
    if (startEditing) {
      setName(state.name || 'You')
      setBio(state.bio || '')
      setEditing(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startEditing])

  function onPickImage(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setState((s) => ({ ...s, avatarImage: reader.result }))
      flash('Profile picture updated')
    }
    reader.readAsDataURL(file)
  }

  function saveIdentity() {
    setState((s) => ({
      ...s,
      name: name.trim() || 'You',
      bio: bio.trim(),
      squad: s.squad
        ? { ...s.squad, members: s.squad.members.map((m) => (m.isUser ? { ...m, name: name.trim() || 'You' } : m)) }
        : s.squad,
    }))
    setEditing(false)
    flash('Profile saved')
  }

  return (
    <div className="card banner-card" style={{ background: bannerItem.gradient }}>
      <div
        className="avatar-lg avatar-clickable"
        title="Tap to pick your color"
        style={{ background: state.avatarImage ? 'transparent' : state.avatarColor || 'var(--blue)' }}
        onClick={() => colorRef.current?.click()}
      >
        {state.avatarImage ? <img src={state.avatarImage} alt="" /> : (iconItem?.icon || (state.name || 'Y')[0])}
      </div>
      <input
        ref={colorRef}
        type="color"
        value={state.avatarColor || '#38bdf8'}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0, padding: 0, border: 'none', pointerEvents: 'none' }}
        onChange={(e) => setState((s) => ({ ...s, avatarColor: e.target.value, avatarImage: null }))}
      />
      <div className="sub" style={{ textAlign: 'center', marginTop: 6, fontSize: 11 }}>tap your avatar to pick any color</div>
      <div style={{ textAlign: 'center', marginTop: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>{state.name || 'You'}</div>
        {titleItem && <div style={{ marginTop: 4 }}><span className="profile-title" style={titleChipStyle(titleItem.id)}>{titleItem.label}</span></div>}
        <div className="sub" style={{ marginTop: 6 }}>{state.bio || 'No bio yet — say something.'}</div>
      </div>

      {!editing ? (
        <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => { setName(state.name || 'You'); setBio(state.bio || ''); setEditing(true) }}>
<Ic src={IMGS.pencil} alt="✏️" size={15} /> Edit profile
        </button>
      ) : (
        <div style={{ marginTop: 12 }}>
          <Field label="Display name"><input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} /></Field>
          <div style={{ marginTop: 8 }}>
            <Field label="Bio"><input value={bio} maxLength={80} placeholder="80 chars of pure motivation" onChange={(e) => setBio(e.target.value)} /></Field>
          </div>

          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPickImage} />
          <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => fileRef.current?.click()}><Ic src={IMGS.camera} alt="📷" size={15} /> Upload profile picture</button>
          {state.avatarImage && (
            <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => setState((s) => ({ ...s, avatarImage: null }))}>Remove picture</button>
          )}

          {ownedTitleItems.length > 0 && (
            <>
              <div className="field-label" style={{ marginTop: 12 }}>Title</div>
              <select value={state.equippedTitle || ''} onChange={(e) => setState((s) => ({ ...s, equippedTitle: e.target.value || null }))}>
                <option value="">No title</option>
                {ownedTitleItems.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </>
          )}

          <button className="btn" style={{ marginTop: 12 }} onClick={saveIdentity}>Save</button>
        </div>
      )}
    </div>
  )
}

function Profile({ state, setState, flash, onReBaseline, onSyncHealth, onBack, backLabel = 'Tasks', onOpenShop, startEditing }) {
  const [editing, setEditing] = useState(false)
  const [bl, setBl] = useState(state.baseline || EMPTY_BASELINE)
  const set = (k) => (e) => setBl((b) => ({ ...b, [k]: e.target.value }))
  const score = state.score || computeHumanScore(state.baseline || {})
  const history = state.scoreHistory || []
  const prev = history.length > 1 ? history[history.length - 2].total : null
  const delta = prev != null ? score.total - prev : null
  const lvl = levelFromXp(state.xp)
  // Rank grind pays into your Human Score — a small, capped bonus.
  const grindBonus = rankScoreBonus(state.tierLog || [])
  const shownTotal = Math.min(1000, score.total + grindBonus)

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
      <ProfileIdentity state={state} setState={setState} flash={flash} startEditing={startEditing} />

      <div className="card">
        <h3>Human Score</h3>
        <div className="score-big">{shownTotal}</div>
        <div className="sub" style={{ textAlign: 'center' }}>
          {grindBonus > 0 && <span style={{ color: 'var(--body)' }}>includes +{grindBonus} from your rank grind · </span>}
          {delta != null ? (
            <span style={{ color: delta >= 0 ? 'var(--body)' : 'var(--flame)' }}>
              {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)} since last check
            </span>
          ) : 'your current Human Score'}
          {score.bmi ? ` · BMI ${score.bmi.toFixed(1)}` : ''}
        </div>
        <Sparkline points={history.map((h) => h.total)} />
        <ScoreBar label={<><Ic src={IMGS.brain} alt="🧠" size={15} /> Mind</>} value={score.mind} color="var(--mind)" />
        <ScoreBar label={<><Ic src={IMGS.biceps} alt="💪" size={15} /> Body</>} value={score.body} color="var(--body)" />
        <ScoreBar label={<><Ic src={IMGS.books} alt="📚" size={15} /> Intellect</>} value={score.intellect} color="var(--intellect)" />
        <button className="btn" onClick={() => { setBl(state.baseline || EMPTY_BASELINE); setEditing(true) }} style={{ marginTop: 12 }}>
          Re-take baseline
        </button>
      </div>

      <div className="card">
        <h3><Ic src={IMGS.phone} alt="📲" size={20} /> Health Sync</h3>
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
        <div className="sub"><Ic src={IMGS.bulb} alt="💡" size={14} /> {weeklyInsight(state)}</div>
      </div>

      {/* Your pet, front and center on your profile */}
      {(() => {
        const pet = state.pet || DEFAULT_PET
        const stage = petStage(pet.fed || 0)
        const color = PET_COLORS.find((c) => c.id === pet.color) || PET_COLORS[0]
        return (
          <div className="card">
            <div className="hud">
              <div className="avatar" style={{ background: 'var(--panel-2)' }}>
                <img src={stage.img} alt={stage.name} width={30} height={30} style={{ filter: color.filter }} className="ic-img" />
              </div>
              <div className="grow">
                <div className="lvl">{pet.name} · Lv {stage.level} {stage.name}</div>
                <div className="rank">{pet.fed || 0} pet XP · {state.fruits || 0} <Ic src={IMGS.apple} alt="fruit" size={12} /> in the bag</div>
              </div>
              {stage.next && (
                <span className="pill pill-sm" style={{ color: 'var(--mind)' }}>
                  {stage.next.fed - (pet.fed || 0)} XP to evolve
                </span>
              )}
            </div>
          </div>
        )
      })()}

      <TitlesBox state={state} setState={setState} flash={flash} />

      <div className="card">
        <h3>Streaks & Stats</h3>
        <div className="stat-grid">
          <Stat value={<><Ic src={IMGS.fire} alt="🔥" size={16} /> {state.streak}</>} label="current streak" />
          <Stat value={<><Ic src={IMGS.medal} alt="🏅" size={16} /> {state.longestStreak || 0}</>} label="longest streak" />
          <Stat value={<><Ic src={IMGS.shield} alt="🛡️" size={16} /> {state.shields || 0}</>} label="shields" />
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
        <h3>Rank Record</h3>
        {(() => {
          const log = state.tierLog || []
          const counts = tierCounts(log)
          const rank = humanRank(log)
          return (
            <>
              <div className="score-big" style={{ fontSize: 28, color: rank.tier ? TIER_COLORS[rank.tier] : 'var(--muted)' }}>
                {rank.img && <Ic src={rank.img} alt={rank.icon} size={26} />} {rank.label}
              </div>
              <div className="sub" style={{ textAlign: 'center', marginBottom: 10 }}>
                {log.length > 0 ? `your earned title (${rank.tier} tier) — average of ${log.length} logged rank${log.length > 1 ? 's' : ''} (avg ${rank.avg})` : 'complete ranked tasks to earn your title'}
              </div>
              <div className="ladder">
                {TIERS.map((t) => (
                  <div key={t} className={`ladder-step ${counts[t] > 0 ? 'hit' : ''}`} style={counts[t] > 0 ? { borderColor: TIER_COLORS[t], color: TIER_COLORS[t] } : undefined} title={TIER_META[t].fancy}>
                    <span className="li"><Ic src={TIER_META[t].img} alt={TIER_META[t].icon} size={20} /></span>
                    <span className="lt">× {counts[t]}</span>
                  </div>
                ))}
              </div>
            </>
          )
        })()}
      </div>

      <div className="card">
        <h3>Cosmetics</h3>
        {(() => {
          const owned = [...(state.ownedIcons || []), ...(state.ownedBanners || []), ...(state.ownedTitles || [])]
          const items = SHOP_ITEMS.filter((i) => owned.includes(i.id) && (i.price > 0 || i.limited))
          return items.length === 0
            ? <div className="sub">None yet — buy some in the Shop, or win limited drops on the Spin wheel.</div>
            : <div className="chips">{items.map((c) => (
                <span key={c.id} className="chip" style={{ color: c.limited ? 'var(--flame)' : 'var(--accent)' }}>
                  {c.img ? <Ic src={c.img} alt={c.icon || ''} size={16} /> : c.type === 'title' ? <Ic src={IMGS.crown} alt="🏷️" size={16} /> : <Ic src={IMGS.star} alt="✨" size={16} />} {c.label}
                </span>
              ))}</div>
        })()}
        {onOpenShop && <button className="btn ghost" onClick={onOpenShop} style={{ marginTop: 12 }}>Open Shop</button>}
      </div>

      <div className="card">
        <h3><Ic src={IMGS.camera} alt="🎞️" size={20} /> Proof timelapses</h3>
        <TimelapseGallery proofLog={state.proofLog} />
      </div>

      <button className="btn ghost" onClick={onBack}>← Back to {backLabel}</button>
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
