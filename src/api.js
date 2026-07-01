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
