import { client, readJsonBody } from './_lib/claude.js'

// Takes ONE goal (however unusual — "own a capybara" included) plus the
// user's commitment answers, and returns a complete 8-week plan the app can
// render directly. Structured output keeps the shape guaranteed.
const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    typeLabel: { type: 'string', description: 'Short 2-4 word label for this goal, e.g. "Own a Capybara".' },
    scheduleLabel: { type: 'string', description: 'One-line summary of the weekly rhythm.' },
    schedule: {
      type: 'array',
      description: '2-4 recurring weekly blocks.',
      items: {
        type: 'object',
        properties: { day: { type: 'string', description: 'e.g. "Daily", "Wed", "Sat"' }, focus: { type: 'string' } },
        required: ['day', 'focus'],
        additionalProperties: false,
      },
    },
    weeks: {
      type: 'array',
      description: 'Exactly 8 weeks, numbered 1-8.',
      items: {
        type: 'object',
        properties: {
          week: { type: 'integer' },
          focus: { type: 'string', description: 'One concrete sentence for the week.' },
          objectives: { type: 'array', description: 'Exactly 3 specific, checkable objectives.', items: { type: 'string' } },
        },
        required: ['week', 'focus', 'objectives'],
        additionalProperties: false,
      },
    },
    task: {
      type: 'object',
      description: 'One recurring daily task for this goal.',
      properties: {
        pillar: { type: 'string', enum: ['MIND', 'BODY', 'INTELLECT'] },
        title: { type: 'string', description: 'Short imperative task name.' },
        unit: { type: 'string', description: 'Usually "min".' },
        goldTarget: { type: 'number', description: 'Gold-rank target in that unit (10-60 for minutes).' },
      },
      required: ['pillar', 'title', 'unit', 'goldTarget'],
      additionalProperties: false,
    },
    progress: { type: 'integer', description: '0-100: how far along they already are, judged from their answers.' },
  },
  required: ['typeLabel', 'scheduleLabel', 'schedule', 'weeks', 'task', 'progress'],
  additionalProperties: false,
}

const PLAN_SYSTEM = `You build hyper-specific 8-week plans for APEX, a self-improvement app. The user states a goal in their own words plus how much time they can commit, what skill they want to sharpen, and how they'll measure success.

Rules:
- Take EVERY goal seriously, however unusual, small, or personal — owning a capybara, exploring identity or feelings, learning to whistle. Meet the user where they are, warmly and without judgment.
- Be concrete: real actions, real numbers, real names of things to research or do. Never write filler like "work on your goal" or "stay consistent".
- Weeks must build on each other: research/foundations early, real-world action in the middle, a genuine test or milestone by week 8.
- For personal/identity/emotional goals, favor reflection, journaling prompts, safe conversations, and community — never prescribe outcomes about who the user should be, and never suggest anything unsafe.
- For goals involving animals, purchases, or legal matters, week 1 should include checking legality/requirements where they live.
- The daily task should be something they can actually do most days and film themselves doing (it gets camera-verified).
- Keep every string tight: focus lines under 12 words, objectives under 14 words.`

function normalizePlan(plan) {
  if (!Array.isArray(plan.weeks) || plan.weeks.length !== 8) throw new Error('bad weeks')
  if (!plan.task || !plan.task.title) throw new Error('bad task')
  plan.weeks = plan.weeks.map((w, i) => ({ ...w, week: i + 1, objectives: (w.objectives || []).slice(0, 3) }))
  plan.progress = Math.max(2, Math.min(97, Math.round(plan.progress || 10)))
  plan.task.goldTarget = Math.max(5, Math.min(120, Math.round(plan.task.goldTarget || 30)))
  if (!['MIND', 'BODY', 'INTELLECT'].includes(plan.task.pillar)) plan.task.pillar = 'MIND'
  return plan
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  const body = readJsonBody(req)
  const goal = ((body && body.goal) || '').toString().slice(0, 300)
  const details = (body && body.details) || {}
  if (!goal.trim()) return res.status(400).json({ error: 'missing_goal' })
  if (!client) {
    return res.status(503).json({ error: 'no_api_key', message: 'Set ANTHROPIC_API_KEY to enable AI plans.' })
  }

  const detailLines = Object.entries(details)
    .filter(([, v]) => String(v || '').trim())
    .map(([k, v]) => `- ${k}: ${String(v).slice(0, 120)}`)
    .join('\n')
  const userPrompt = `Goal, in the user's words: "${goal}"\n\nTheir answers:\n${detailLines || '- (none given)'}\n\nBuild the 8-week plan.`

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 2048,
      system: PLAN_SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
      output_config: { format: { type: 'json_schema', schema: PLAN_SCHEMA } },
    })
    const text = response.content.find((b) => b.type === 'text')?.text || '{}'
    const plan = JSON.parse(text)
    res.status(200).json({ source: 'claude', via: 'api', ...normalizePlan(plan) })
  } catch (err) {
    console.error('plan-goal error:', err?.message)
    res.status(502).json({ error: 'llm_failed', message: err?.message })
  }
}
