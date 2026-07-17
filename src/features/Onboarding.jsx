import { useState, useMemo } from 'react'
import {
  goalFlags, computeHumanScore, validateBaseline, parseDreamGoal, parseGoals,
  buildGoalPlan, makeTiers, buildDailyTasks, buildRoadmap, DEFAULT_PET,
  AVATAR_COLORS, todayKey, seedFeed, buildDuel, GOAL_IMGS, IMGS, GOAL_TYPES,
} from '../game.js'
import { parseDreamGoalRemote, planGoalRemote } from '../api.js'
import { Ic, Field, NumField, ScoreBar } from '../ui.jsx'

export const EMPTY_BASELINE = {
  age: '', heightFt: '', heightIn: '', weightLbs: '', sex: '',
  steps: '', workouts: '', sleepHrs: '', stress: '5', meditDays: '',
  gradeLevel: '', studyHrs: '', skill: '5',
}

export function Onboarding({ onDone }) {
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
  const [building, setBuilding] = useState(false)
  // Dream-driven baseline sections + honesty checks. The relevance flags ride
  // along with the baseline so unmeasured pillars score null, not zero.
  const flags = useMemo(() => goalFlags(goal), [goal])
  const score = useMemo(() => computeHumanScore({ ...bl, relevance: flags }), [bl, flags])
  const blErrors = useMemo(() => validateBaseline(bl), [bl])

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

  const baselineReady = isBaselineReady(bl, flags)
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

  async function finish() {
    if (building) return
    setBuilding(true)
    const p = parsed || parseDreamGoal(goal)
    const blWithRel = { ...bl, relevance: { body: flags.body, mind: flags.mind, intellect: flags.intellect } }
    const sc = computeHumanScore(blWithRel)
    // Each goal gets a Claude-written plan when the API server is up; the
    // local template only exists so onboarding never blocks. The personal
    // context is what makes plans fit THIS person; details are stored on the
    // goal so the plan can be re-sharpened later without redoing onboarding.
    const personCtx = {
      name: name.trim() || undefined,
      age: bl.age || undefined,
      educationLevel: bl.gradeLevel || undefined,
      studyHoursPerWeek: bl.studyHrs || undefined,
      sleepHoursPerNight: bl.sleepHrs || undefined,
      fullDreamText: goal.trim(),
    }
    const planGoals = await Promise.all(goals.map(async (g) => {
      const otherGoals = goals.filter((o) => o.goalId !== g.goalId).map((o) => o.text).join('; ') || undefined
      const remote = await planGoalRemote(g.text, goalDetails[g.goalId], { ...personCtx, otherGoals })
      if (remote) return { ...g, details: goalDetails[g.goalId] || {}, ...remote, source: 'claude' }
      return { ...g, details: goalDetails[g.goalId] || {}, ...buildGoalPlan(g, goalDetails[g.goalId]), source: 'local' }
    }))
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
      baseline: blWithRel,
      score: sc,
      scoreHistory: [{ date: todayKey(), total: sc.total, mind: sc.mind, body: sc.body, intellect: sc.intellect }],
      roadmap: buildRoadmap(p),
      tasks: [...buildDailyTasks(p, blWithRel), ...goalTasks],
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
      {step === 'name' && (
        <div className="tagline-sub">Commit before reality. Compare after. Learn from the difference.</div>
      )}

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
          <BaselineFields bl={bl} set={set} errors={blErrors} flags={flags} />
          <button className="btn ghost" onClick={() => setStep('details')} style={{ marginTop: 8 }}>← Back</button>
          <button className="btn" disabled={!baselineReady} onClick={() => setStep(2)}>
            {Object.keys(blErrors).length > 0 ? 'Fix the highlighted values' : baselineReady ? 'Calculate my Human Score →' : 'Fill the required fields'}
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
            <button className="btn" disabled={building} onClick={finish}>
              {building ? 'Claude is writing your plans…' : 'Start leveling up →'}
            </button>
          </div>
        </>
      )}
      </div>

      <div className="foot">Commit before reality · your baseline is the starting line · nothing leaves your device</div>
    </div>
  )
}

// The required fields that drive a meaningful score — present AND believable.
export function isBaselineReady(bl, flags = { body: true, mind: true, intellect: true }) {
  const filled = !!(bl.sleepHrs !== '' &&
    (!flags.body || (bl.heightFt && bl.weightLbs && bl.steps !== '')) &&
    (!flags.intellect || (bl.studyHrs !== '' && bl.gradeLevel)))
  return filled && Object.keys(validateBaseline(bl)).length === 0
}

// One validated number input: red border + plain-English range message when
// the value is outside what a human can actually be.
// Shared baseline intake — used by onboarding and re-baselining in Profile.
// `flags` (from the dream text) decides which sections exist at all: the
// baseline only measures distance-to-goal, so a dream that never mentions
// the body never asks for your weight. Sleep + skill are always asked —
// every goal runs on recovery and has a skill level.
export function BaselineFields({ bl, set, errors = {}, flags = { body: true, mind: true, intellect: true } }) {
  return (
    <>
      <div className="form-section"><Ic src={IMGS.dart} alt="🎯" size={16} /> Basics</div>
      <div className="form-grid">
        <NumField label="Sleep (hrs/night)" field="sleepHrs" bl={bl} set={set} errors={errors} placeholder="e.g. 7" />
        <Field label={`Skill in goal (1–10): ${bl.skill}`}>
          <input type="range" min="1" max="10" value={bl.skill} onChange={set('skill')} />
        </Field>
      </div>

      {flags.body && (
        <>
          <div className="form-section"><Ic src={IMGS.biceps} alt="💪" size={16} /> Body (from your dream)</div>
          <div className="form-grid">
            <NumField label="Age" field="age" bl={bl} set={set} errors={errors} placeholder="yrs" />
            <Field label="Sex">
              <select value={bl.sex} onChange={set('sex')}>
                <option value="">—</option><option>Male</option><option>Female</option><option>Other</option>
              </select>
            </Field>
            <Field label="Height">
              <div className="inline">
                <input type="number" className={errors.heightFt ? 'invalid' : ''} value={bl.heightFt} onChange={set('heightFt')} placeholder="ft" />
                <input type="number" className={errors.heightIn ? 'invalid' : ''} value={bl.heightIn} onChange={set('heightIn')} placeholder="in" />
              </div>
              {(errors.heightFt || errors.heightIn) && <span className="field-error">{errors.heightFt || errors.heightIn}</span>}
            </Field>
            <NumField label="Weight" field="weightLbs" bl={bl} set={set} errors={errors} placeholder="lbs" />
            <NumField label="Avg daily steps" field="steps" bl={bl} set={set} errors={errors} placeholder="e.g. 6000" />
            <NumField label="Workouts / week" field="workouts" bl={bl} set={set} errors={errors} placeholder="0–7" />
          </div>
        </>
      )}

      {flags.strength && (
        <>
          <div className="form-section"><Ic src={IMGS.bolt} alt="⚡" size={16} /> Strength (from your dream)</div>
          <div className="form-grid">
            <NumField label="Push-ups in one set" field="pushups" bl={bl} set={set} errors={errors} placeholder="e.g. 20" />
            <NumField label="Bench press 1RM (lbs)" field="benchLbs" bl={bl} set={set} errors={errors} placeholder="optional" />
          </div>
        </>
      )}

      {flags.cut && (
        <>
          <div className="form-section"><Ic src={IMGS.chart} alt="📉" size={16} /> Weight goal (from your dream)</div>
          <div className="form-grid">
            <NumField label="Goal weight (lbs)" field="goalWeightLbs" bl={bl} set={set} errors={errors} placeholder="e.g. 165" />
          </div>
        </>
      )}

      {flags.mind && (
        <>
          <div className="form-section"><Ic src={IMGS.brain} alt="🧠" size={16} /> Mind (from your dream)</div>
          <div className="form-grid">
            <Field label={`Stress (1–10): ${bl.stress}`}>
              <input type="range" min="1" max="10" value={bl.stress} onChange={set('stress')} />
            </Field>
            <NumField label="Meditate (days/wk)" field="meditDays" bl={bl} set={set} errors={errors} placeholder="0–7" />
          </div>
        </>
      )}

      {flags.intellect && (
        <>
          <div className="form-section"><Ic src={IMGS.books} alt="📚" size={16} /> Intellect (from your dream)</div>
          <div className="form-grid">
            <Field label="Education level">
              <select value={bl.gradeLevel} onChange={set('gradeLevel')}>
                <option value="">—</option>
                <option>Middle school</option><option>High school</option><option>College</option>
                <option>Grad school</option><option>Working professional</option>
              </select>
            </Field>
            <NumField label="Study/learn (hrs/wk)" field="studyHrs" bl={bl} set={set} errors={errors} placeholder="e.g. 5" />
          </div>
        </>
      )}
    </>
  )
}
