// APEX goal-parser API — Claude-backed.
// Holds the API key server-side (never shipped to the browser) and turns a
// free-text dream goal into a structured plan. Run with: npm run server
// (set ANTHROPIC_API_KEY in the environment first).
import express from 'express'
import cors from 'cors'
import Anthropic from '@anthropic-ai/sdk'
import { execFile } from 'node:child_process'

const app = express()
app.use(cors())
app.use(express.json())

const apiKey = process.env.ANTHROPIC_API_KEY
const client = apiKey ? new Anthropic() : null

// No API key? Fall back to headless Claude Code (`claude -p`) — it runs on
// your Claude subscription. Install: npm i -g @anthropic-ai/claude-code,
// then run `claude` once and /login.
let cliReady = null
function checkCli() {
  if (cliReady !== null) return Promise.resolve(cliReady)
  return new Promise((resolve) => {
    execFile('claude', ['--version'], { timeout: 10000 }, (err) => {
      cliReady = !err
      resolve(cliReady)
    })
  })
}

function callClaudeCliJSON(systemPrompt, userPrompt) {
  return new Promise((resolve, reject) => {
    const prompt = `${systemPrompt}\n\n---\n\n${userPrompt}\n\nRespond with ONLY the JSON object. No markdown fences, no commentary.`
    const child = execFile('claude', ['-p', prompt, '--model', 'sonnet'], { timeout: 180000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout = '', stderr = '') => {
      const out = String(stdout).trim()
      if (/not logged in/i.test(out + stderr)) return reject(new Error('Claude Code CLI is not logged in — run `claude` once and /login.'))
      if (err) return reject(new Error(out || String(stderr).trim() || err.message))
      const s = out.indexOf('{')
      const e = out.lastIndexOf('}')
      if (s < 0 || e <= s) return reject(new Error('CLI returned no JSON'))
      try { resolve(JSON.parse(out.slice(s, e + 1))) } catch (x) { reject(x) }
    })
    child.stdin?.end()
  })
}

// Structured-output schema — guarantees the model returns parseable JSON.
const SCHEMA = {
  type: 'object',
  properties: {
    domainLabel: {
      type: 'string',
      description: 'Short label for the goal domain, e.g. "Software Engineering" or "Peak Fitness".',
    },
    motivation: { type: 'string', enum: ['intrinsic', 'extrinsic'] },
    tasks: {
      type: 'array',
      description: 'Exactly three concrete daily micro-tasks (5–25 min each), ordered [intellect/skill, body, mind].',
      items: { type: 'string' },
    },
  },
  required: ['domainLabel', 'motivation', 'tasks'],
  additionalProperties: false,
}

const SYSTEM = `You parse a user's 5-year dream goal into a structured plan for APEX, a self-improvement app.
Return a concise domain label, whether their stated motivation reads as intrinsic (growth, mastery, meaning) or extrinsic (money, status, beating others), and exactly three concrete daily micro-tasks tailored to the goal — the first skill/intellect-focused, the second body/fitness, the third mind/reflection. Keep each task short and actionable.`

app.get('/api/health', async (_req, res) => {
  res.json({ ok: true, claude: !!client, cli: await checkCli() })
})

app.post('/api/parse-goal', async (req, res) => {
  const goal = ((req.body && req.body.goal) || '').toString().slice(0, 500)
  if (!goal.trim()) return res.status(400).json({ error: 'missing_goal' })
  if (!client) {
    return res.status(503).json({ error: 'no_api_key', message: 'Set ANTHROPIC_API_KEY to enable the Claude goal parser.' })
  }
  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{ role: 'user', content: `Dream goal: ${goal}` }],
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    })
    const text = response.content.find((b) => b.type === 'text')?.text || '{}'
    const parsed = JSON.parse(text)
    res.json({ source: 'claude', ...parsed })
  } catch (err) {
    console.error('parse-goal error:', err?.message)
    res.status(502).json({ error: 'llm_failed', message: err?.message })
  }
})

// --- Full personalized plan builder ---
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

// Plain-text schema spec for the CLI path (no structured outputs there).
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

app.post('/api/plan-goal', async (req, res) => {
  const goal = ((req.body && req.body.goal) || '').toString().slice(0, 300)
  const details = (req.body && req.body.details) || {}
  const context = (req.body && req.body.context) || {}
  if (!goal.trim()) return res.status(400).json({ error: 'missing_goal' })

  const detailLines = Object.entries(details)
    .filter(([, v]) => String(v || '').trim())
    .map(([k, v]) => `- ${k}: ${String(v).slice(0, 120)}`)
    .join('\n')
  const ctxLines = Object.entries(context)
    .filter(([, v]) => String(v || '').trim())
    .map(([k, v]) => `- ${k}: ${String(v).slice(0, 200)}`)
    .join('\n')
  const userPrompt = `Goal, in the user's words: "${goal}"

Their answers about this goal:
${detailLines || '- (none given)'}

About this person:
${ctxLines || '- (nothing shared)'}

Build the 8-week plan. It must pass the specificity test on every objective and visibly use their context — this plan should not fit anyone else.`

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
    } else if (await checkCli()) {
      plan = await callClaudeCliJSON(`${PLAN_SYSTEM}\n\n${PLAN_SPEC}`, userPrompt)
      via = 'claude-code'
    } else {
      return res.status(503).json({
        error: 'no_backend',
        message: 'Set ANTHROPIC_API_KEY, or install Claude Code (npm i -g @anthropic-ai/claude-code) and /login once.',
      })
    }
    res.json({ source: 'claude', via, ...normalizePlan(plan) })
  } catch (err) {
    console.error('plan-goal error:', err?.message)
    res.status(502).json({ error: 'llm_failed', message: err?.message })
  }
})

const port = process.env.PORT || 8787
app.listen(port, () => console.log(`APEX goal-parser API on :${port} (claude ${client ? 'enabled' : 'DISABLED — set ANTHROPIC_API_KEY'})`))
