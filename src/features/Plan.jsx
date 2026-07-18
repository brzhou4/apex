import { useState } from 'react'
import { GOAL_IMGS, IMGS, computeHumanScore, makeTiers, todayKey, daysBetween } from '../game.js'
import { Ic, Field } from '../ui.jsx'
import { planGoalRemote } from '../api.js'
/* ---------------- Plan ---------------- */

// One goal's roadmap, kept SHORT: the weekly schedule, then a week-selector
// strip (✓ past, glowing current) with only the selected week's details shown.
function GoalPlanCard({ goal, currentWeek, onSharpen, sharpening }) {
  const weeks = goal.weeks || []
  const [shown, setShown] = useState(Math.min(currentWeek, weeks.length))
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')
  const w = weeks.find((x) => x.week === shown) || weeks[0]

  return (
    <div className="card">
      <h3>
        <Ic src={GOAL_IMGS[goal.typeId] || IMGS.dart} alt={goal.icon} size={20} /> {goal.typeLabel}
        {goal.source === 'claude' && <span className="ai-chip" title="Plan written by Claude for this exact goal">✦ AI plan</span>}
      </h3>
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

      {/* Doesn't hit? Tell Claude what it got wrong and get a rewrite. */}
      {onSharpen && (!noteOpen ? (
        <button className="btn ghost btn-sm" disabled={sharpening} onClick={() => setNoteOpen(true)}>
          {sharpening ? 'Rewriting your plan…' : '✦ Sharpen this plan'}
        </button>
      ) : (
        <div style={{ marginTop: 12 }}>
          <Field label="What should this plan know about you? (optional)">
            <input
              value={note}
              autoFocus
              maxLength={200}
              placeholder="e.g. I'm a junior, tournaments start in March, weekends only"
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !sharpening && (setNoteOpen(false), onSharpen(goal, note))}
            />
          </Field>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" style={{ flex: 1 }} disabled={sharpening} onClick={() => { setNoteOpen(false); onSharpen(goal, note) }}>
              {sharpening ? 'Rewriting…' : 'Rewrite with Claude'}
            </button>
            <button className="btn ghost" style={{ flex: 0.6 }} onClick={() => setNoteOpen(false)}>Cancel</button>
          </div>
        </div>
      ))}
    </div>
  )
}

export function Plan({ state, setState, flash }) {
  const parsed = state.parsed || {}
  const score = state.score || computeHumanScore(state.baseline || {})
  const [sharpening, setSharpening] = useState(null) // goalId being rewritten

  // Re-personalize one goal's plan without redoing onboarding. The note is
  // the user telling Claude what the last plan got wrong — highest priority.
  async function sharpen(goal, note) {
    if (sharpening) return
    setSharpening(goal.goalId)
    const bl = state.baseline || {}
    const remote = await planGoalRemote(goal.text, goal.details || {}, {
      name: state.name || undefined,
      age: bl.age || undefined,
      educationLevel: bl.gradeLevel || undefined,
      studyHoursPerWeek: bl.studyHrs || undefined,
      sleepHoursPerNight: bl.sleepHrs || undefined,
      fullDreamText: state.dreamGoal || undefined,
      note: (note || '').trim() || undefined,
    })
    setSharpening(null)
    if (!remote) {
      flash('AI plans need the backend — run `npm run server` (one-time setup in the README)')
      return
    }
    setState((s) => ({
      ...s,
      plan: {
        ...s.plan,
        goals: (s.plan?.goals || []).map((g) => (g.goalId === goal.goalId ? { ...g, ...remote, source: 'claude' } : g)),
      },
      // Keep the daily task in step with the rewritten plan (rank progress
      // already banked today is preserved).
      tasks: (s.tasks || []).map((t) => (t.id === `goal-${goal.goalId}`
        ? { ...t, pillar: remote.task.pillar, title: remote.task.title, unit: remote.task.unit, tiers: makeTiers(remote.task.goldTarget) }
        : t)),
    }))
    flash(<>Plan rewritten for you ✦</>)
  }
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
        {planGoals.length > 0 && !planGoals.some((g) => g.source === 'claude') && (
          <div className="sub" style={{ marginTop: 10, fontSize: 11 }}>
            These are template plans. Run <b style={{ color: 'var(--text)' }}>npm run server</b> with an ANTHROPIC_API_KEY and redo onboarding for plans Claude writes for your exact dream.
          </div>
        )}
      </div>

      <div className="card">
        <h3>Gap to target</h3>
        <div className="score-row"><span>Human Score</span><span>{score.total} / {score.target}</span></div>
        <div className="bar"><i style={{ width: `${pct}%`, background: 'var(--primary)' }} /></div>
        <div className="sub" style={{ marginTop: 8 }}>
          Week {currentWeek} of {maxWeeks} · {gap > 0 ? `${gap} points to your target — keep stacking tiers and streaks.` : 'Target reached — re-baseline in Profile to raise the bar.'}
        </div>
      </div>

      {planGoals.length > 0 ? (
        planGoals.map((g) => (
          <GoalPlanCard
            key={g.goalId}
            goal={g}
            currentWeek={currentWeek}
            onSharpen={sharpen}
            sharpening={sharpening === g.goalId}
          />
        ))
      ) : (
        <div className="card">
          <h3>Your {legacyRoadmap.length}-Week Roadmap</h3>
          {legacyRoadmap.map((r) => {
            const isCurrent = r.week === currentWeek
            const isPast = r.week < currentWeek
            return (
              <div className={`task ${isPast ? 'done' : ''}`} key={r.week}>
                <div className="ic" style={isCurrent ? { borderColor: 'var(--blue)', color: 'var(--blue)' } : isPast ? { borderColor: 'var(--primary)', color: 'var(--primary)' } : undefined}>
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

