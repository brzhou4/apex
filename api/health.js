import { client } from './_lib/claude.js'

export default function handler(req, res) {
  res.status(200).json({ ok: true, claude: !!client })
}
