import { parseDreamGoal } from './game.js'

// Try the Claude-backed goal parser; fall back to the local rule-based parser
// if the server is down or no API key is configured. Either way the app works.
export async function parseDreamGoalRemote(goal) {
  try {
    const r = await fetch('/api/parse-goal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal }),
    })
    if (!r.ok) throw new Error(`status ${r.status}`)
    const d = await r.json()
    if (!Array.isArray(d.tasks) || d.tasks.length < 3) throw new Error('bad payload')
    return {
      domainId: 'claude',
      domainLabel: d.domainLabel,
      motivation: d.motivation,
      _tasks: d.tasks,
      source: 'claude',
    }
  } catch {
    return { ...parseDreamGoal(goal), source: 'local' }
  }
}

// Ask Claude for a full personalized 8-week plan for ONE goal. Returns null
// when the API server is down or has no key — callers fall back to the
// local rule-based template so onboarding never blocks.
export async function planGoalRemote(goal, details = {}) {
  try {
    const r = await fetch('/api/plan-goal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal, details }),
    })
    if (!r.ok) return null
    const p = await r.json()
    if (!Array.isArray(p.weeks) || p.weeks.length !== 8 || !p.task || !p.task.title) return null
    return p
  } catch {
    return null
  }
}
