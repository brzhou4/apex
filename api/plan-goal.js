import { client, gatewayReady, callGatewayJSON, readJsonBody } from './_lib/claude.js'

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

const PLAN_SYSTEM = `You build hyper-specific 8-week plans for APEX, a self-improvement app. You receive the goal in the user's own words, their commitment answers, and personal context (age, education level, weekly hours, other goals). The plan must read like it was written by a coach who knows THIS person — not a template with the goal name pasted in.

Hard rules:
- Take EVERY goal seriously, however unusual, small, or personal — owning a capybara, exploring identity or feelings, learning to whistle. Meet the user where they are, warmly and without judgment.
- SPECIFICITY TEST: every single objective must contain at least one concrete number (reps, pages, minutes, counts, scores) OR a named real-world thing (a specific technique, resource type, venue, or step). Forbidden phrasings: "work on", "practice more", "stay consistent", "keep improving", "focus on".
- USE THEIR CONTEXT: reference their actual weekly hours when sizing weeks (someone with 4 hrs/week gets a different plan than 15). If their age/education suggests school, schedule around a school week. If they gave a skill to sharpen or a success test, those words must appear in the plan.
- Weeks must escalate: foundations in weeks 1-2, real-world action by weeks 3-5, an honest dress rehearsal around week 6, the user's own stated success test (or the nearest real version of it) in weeks 7-8.
- Each week's focus line should be punchy and second-person ("Your first full run-through"), never generic ("Build the habit").
- For personal/identity/emotional goals, favor reflection, journaling prompts, safe conversations, and community — never prescribe outcomes about who the user should be, and never suggest anything unsafe.
- For goals involving animals, purchases, or legal matters, week 1 includes checking legality/requirements where they live.
- The daily task must be filmable (it gets camera-verified) and doable most days within their stated time budget.
- If a "note" is present in the context, it is the user telling you what the last plan got wrong — treat it as the highest-priority instruction.
- Keep strings tight: focus lines under 12 words, objectives under 16 words.`

// Plain-text schema spec for the gateway path (no structured outputs there).
const PLAN_SPEC = `Return a single JSON object with EXACTLY these fields:
{
  "typeLabel": "short 2-4 word label for the goal",
  "scheduleLabel": "one-line weekly rhythm summary",
  "schedule": [ { "day": "Daily|Mon|...|Sun", "focus": "..." } ]  (2-4 items),
  "weeks": [ { "week": 1-8, "focus": "one sentence", "objectives": ["...","...","..."] } ]  (EXACTLY 8 items, 3 objectives each),
  "task": { "pillar": "MIND|BODY|INTELLECT", "title": "short imperative daily task", "unit": "min", "goldTarget": 10-60 },
  "progress": 0-100
}`

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
  const context = (body && body.context) || {}
  if (!goal.trim()) return res.status(400).json({ error: 'missing_goal' })
  if (!client && !gatewayReady) {
    return res.status(503).json({ error: 'no_api_key', message: 'Set ANTHROPIC_API_KEY or BUTTERBASE_API_KEY to enable AI plans.' })
  }

  const detailLines = Object.entries(details)
    .filter(([, v]) => String(v || '').trim())
    .map(([k, v]) => `- ${k}: ${String(v).slice(0, 120)}`)
    .join('\n')
  const ctxLines = Object.entries(context)
    .filter(([, v]) => String(v || '').trim())
    .map(([k, v]) => `- ${k}: ${String(v).slice(0, 200)}`)
    .join('\n')
  const userPrompt = `Goal, in the user's words: "${goal}"\n\nTheir answers about this goal:\n${detailLines || '- (none given)'}\n\nAbout this person:\n${ctxLines || '- (nothing shared)'}\n\nBuild the 8-week plan. It must pass the specificity test on every objective and visibly use their context — this plan should not fit anyone else.`

  try {
    let plan
    let via
    if (client) {
      const response = await client.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 2048,
        system: PLAN_SYSTEM,
        messages: [{ role: 'user', content: userPrompt }],
        output_config: { format: { type: 'json_schema', schema: PLAN_SCHEMA } },
      })
      const text = response.content.find((b) => b.type === 'text')?.text || '{}'
      plan = JSON.parse(text)
      via = 'api'
    } else {
      plan = await callGatewayJSON(`${PLAN_SYSTEM}\n\n${PLAN_SPEC}`, userPrompt)
      via = 'gateway'
    }
    res.status(200).json({ source: 'claude', via, ...normalizePlan(plan) })
  } catch (err) {
    console.error('plan-goal error:', err?.message)
    res.status(502).json({ error: 'llm_failed', message: err?.message })
  }
}
