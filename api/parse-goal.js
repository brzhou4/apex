import { client, gatewayReady, callGatewayJSON, readJsonBody } from './_lib/claude.js'

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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  const body = readJsonBody(req)
  const goal = ((body && body.goal) || '').toString().slice(0, 500)
  if (!goal.trim()) return res.status(400).json({ error: 'missing_goal' })
  if (!client && !gatewayReady) {
    return res.status(503).json({ error: 'no_api_key', message: 'Set ANTHROPIC_API_KEY or BUTTERBASE_API_KEY to enable the Claude goal parser.' })
  }
  try {
    let parsed
    if (client) {
      const response = await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1024,
        system: SYSTEM,
        messages: [{ role: 'user', content: `Dream goal: ${goal}` }],
        output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      })
      const text = response.content.find((b) => b.type === 'text')?.text || '{}'
      parsed = JSON.parse(text)
    } else {
      const spec = 'Return a single JSON object: { "domainLabel": "...", "motivation": "intrinsic|extrinsic", "tasks": ["skill task", "body task", "mind task"] }'
      parsed = await callGatewayJSON(`${SYSTEM}\n\n${spec}`, `Dream goal: ${goal}`, { maxTokens: 1024 })
    }
    res.status(200).json({ source: 'claude', ...parsed })
  } catch (err) {
    console.error('parse-goal error:', err?.message)
    res.status(502).json({ error: 'llm_failed', message: err?.message })
  }
}
