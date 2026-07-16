// Shared Claude client for Vercel serverless functions. Only the hosted
// API-key path applies here — the local dev server also supports a headless
// Claude Code CLI fallback, but a serverless function has no persistent
// login, so that path is dev-only (see server/index.js).
import Anthropic from '@anthropic-ai/sdk'

const apiKey = process.env.ANTHROPIC_API_KEY
export const client = apiKey ? new Anthropic() : null

export function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  try { return JSON.parse(req.body || '{}') } catch { return {} }
}
