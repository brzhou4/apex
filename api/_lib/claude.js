// Shared Claude client for Vercel serverless functions. Two hosted paths:
// an Anthropic API key (structured outputs), or the Butterbase AI gateway
// (OpenAI-compatible, billed to the app's Butterbase AI credits) when only
// BUTTERBASE_API_KEY is set. The local dev server additionally supports a
// headless Claude Code CLI fallback — a serverless function has no
// persistent login, so that path is dev-only (see server/index.js).
import Anthropic from '@anthropic-ai/sdk'

const apiKey = process.env.ANTHROPIC_API_KEY
export const client = apiKey ? new Anthropic() : null

const BB_KEY = process.env.BUTTERBASE_API_KEY
const BB_APP = process.env.VITE_BUTTERBASE_APP_ID || process.env.BUTTERBASE_APP_ID
export const gatewayReady = !!(BB_KEY && BB_APP)

// Ask Claude (via the Butterbase gateway) for a JSON object. No structured
// outputs on this path, so the schema is spelled out in the prompt and the
// reply is parsed out of the text — same technique as the CLI fallback.
export async function callGatewayJSON(systemPrompt, userPrompt, { model = 'anthropic/claude-sonnet-5', maxTokens = 3000 } = {}) {
  const r = await fetch(`https://api.butterbase.ai/v1/${BB_APP}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${BB_KEY}` },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: `${systemPrompt}\n\nRespond with ONLY the JSON object. No markdown fences, no commentary.` },
        { role: 'user', content: userPrompt },
      ],
    }),
  })
  const d = await r.json()
  if (!r.ok) throw new Error(d?.error?.message || `gateway ${r.status}`)
  const out = String(d?.choices?.[0]?.message?.content || '').trim()
  const s = out.indexOf('{')
  const e = out.lastIndexOf('}')
  if (s < 0 || e <= s) throw new Error('gateway returned no JSON')
  return JSON.parse(out.slice(s, e + 1))
}

export function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  try { return JSON.parse(req.body || '{}') } catch { return {} }
}
