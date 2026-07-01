// APEX goal-parser API — Claude-backed.
// Holds the API key server-side (never shipped to the browser) and turns a
// free-text dream goal into a structured plan. Run with: npm run server
// (set ANTHROPIC_API_KEY in the environment first).
import express from 'express'
import cors from 'cors'
import Anthropic from '@anthropic-ai/sdk'

const app = express()
app.use(cors())
app.use(express.json())

const apiKey = process.env.ANTHROPIC_API_KEY
const client = apiKey ? new Anthropic() : null

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

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, claude: !!client })
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

const port = process.env.PORT || 8787
app.listen(port, () => console.log(`APEX goal-parser API on :${port} (claude ${client ? 'enabled' : 'DISABLED — set ANTHROPIC_API_KEY'})`))
