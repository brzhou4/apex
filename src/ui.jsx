// Shared presentational primitives — used across every feature. Pure and
// stateless; the only data dependency is game.js constants (icon URLs, colors).
import { IMGS, TITLE_COLORS, SHOP_ITEMS } from './game.js'
import { ICONS, FALLBACK_ICON } from './icons.jsx'

// One consistent SVG line icon, inheriting color from context (currentColor).
// `src` is an icon key (from IMGS/TIER_META); emeralds get the premium green.
export function Ic({ src, alt = '', size = 18, style }) {
  const emerald = src === IMGS.gem
  const inner = ICONS[src] || FALLBACK_ICON
  return (
    <svg
      className={`ic-img${emerald ? ' ic-emerald' : ''}`}
      viewBox="0 0 24 24" width={size} height={size}
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      role="img" aria-label={alt || undefined} aria-hidden={alt ? undefined : 'true'}
      style={style}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  )
}

export function Field({ label, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}

// One validated number input: red border + plain-English range message when
// the value is outside what a human can actually be.
export function NumField({ label, field, bl, set, errors, placeholder }) {
  const err = errors?.[field]
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input type="number" className={err ? 'invalid' : ''} value={bl[field] ?? ''} onChange={set(field)} placeholder={placeholder} />
      {err && <span className="field-error">{err}</span>}
    </label>
  )
}

// Tiny SVG sparkline for the score-history trend.
export function Sparkline({ points, color = 'var(--accent)' }) {
  if (!points || points.length < 2) {
    return <div className="sub" style={{ marginTop: 6 }}>Take another baseline to start your trend line.</div>
  }
  const w = 280, h = 60, pad = 4
  const xs = points.map((_, i) => pad + (i * (w - pad * 2)) / (points.length - 1))
  const min = Math.min(...points), max = Math.max(...points)
  const span = max - min || 1
  const ys = points.map((p) => h - pad - ((p - min) / span) * (h - pad * 2))
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ marginTop: 8 }}>
      <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {xs.map((x, i) => <circle key={i} cx={x} cy={ys[i]} r="3" fill={color} />)}
    </svg>
  )
}

export function ScoreBar({ label, value, color }) {
  // null = this pillar isn't part of the dream, so it was never measured.
  // Saying "not measured" beats faking a zero — we didn't look.
  if (value == null) {
    return (
      <div style={{ marginTop: 10, opacity: 0.55 }}>
        <div className="score-row"><span>{label}</span><span style={{ fontSize: 11 }}>not measured — not in this dream</span></div>
      </div>
    )
  }
  return (
    <div style={{ marginTop: 10 }}>
      <div className="score-row"><span>{label}</span><span>{value}/1000</span></div>
      <div className="bar"><i style={{ width: `${(value / 1000) * 100}%`, background: color }} /></div>
    </div>
  )
}

export const fmtThreshold = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : n)

export function titleChipStyle(id) {
  const c = TITLE_COLORS[id]
  return c ? { color: c, borderColor: c, background: `${c}22` } : undefined
}
export function titleChipStyleByLabel(label) {
  const item = SHOP_ITEMS.find((i) => i.type === 'title' && i.label === label)
  return item ? titleChipStyle(item.id) : undefined
}

// Playful page header — colored eyebrow + big Archivo title, so every tab
// opens with its own identity instead of the same wall of cards.
export function PageHead({ eyebrow, title, color, children }) {
  return (
    <div className="page-head">
      <div>
        <div className="eyebrow" style={{ color }}>{eyebrow}</div>
        <h2 className="page-title">{title}</h2>
      </div>
      {children}
    </div>
  )
}

export function Stat({ value, label }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}
