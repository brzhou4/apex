import { useState, useRef } from 'react'
import { todayKey, WHEEL, spinOutcome, IMGS, EXCLUSIVE_TITLES, SHOP_ITEMS } from '../game.js'
import { Ic } from '../ui.jsx'
/* ---------------- Spin Wheel ---------------- */

export function SpinWheel({ state, setState, flash, allDone }) {
  const [angle, setAngle] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState(null)
  const wheelRef = useRef(null)

  // 1 free spin a day + every bonus spin earned from Gold+ task finishes.
  const maxSpins = 1 + (state.bonusSpins || 0)
  const usedToday = state.spunOn === todayKey() ? state.spinsUsed || 0 : 0
  const canSpin = usedToday < maxSpins

  const seg = 360 / WHEEL.length

  function doSpin() {
    if (spinning || !canSpin) return
    setSpinning(true)
    setResult(null)
    const outcome = spinOutcome()
    // Land pointer (top) on the chosen segment center.
    const target = 360 * 5 + (360 - (outcome.index * seg + seg / 2))
    setAngle((a) => a - (a % 360) + target)

    setTimeout(() => {
      setSpinning(false)
      setResult(outcome)
      applyOutcome(outcome)
    }, 4100)
  }

  function applyOutcome(o) {
    let msg = ''
    setState((s) => {
      const next = {
        ...s,
        spunOn: todayKey(),
        spinsUsed: (s.spunOn === todayKey() ? s.spinsUsed || 0 : 0) + 1,
      }
      if (o.kind === 'emeralds') { next.emeralds = (s.emeralds || 0) + o.value; msg = <>+{o.value} <Ic src={IMGS.gem} alt="" size={14} /> emeralds!</> }
      else if (o.kind === 'xpmult') { next.xpBoost = o.value; msg = `${o.value}× XP on next task!` }
      else if (o.kind === 'shield') { next.shields = (s.shields || 0) + 1; msg = <><Ic src={IMGS.shield} alt="" size={16} /> Streak Recovery earned!</> }
      else if (o.kind === 'limitedIcon') {
        const owned = s.ownedIcons || []
        if (owned.includes(o.value)) { next.emeralds = (s.emeralds || 0) + 10; msg = <>Already own the Sahur icon — +10 <Ic src={IMGS.gem} alt="" size={14} /> instead</> }
        else { next.ownedIcons = [...owned, o.value]; msg = 'LIMITED DROP: Tung Tung Tung Sahur icon unlocked!' }
      }
      else if (o.kind === 'title') {
        const owned = s.ownedTitles || []
        const pool = EXCLUSIVE_TITLES.map((t) => `tl-${t.toLowerCase()}`).filter((id) => !owned.includes(id))
        if (pool.length === 0) { next.emeralds = (s.emeralds || 0) + 5; msg = <>All exclusive titles owned — +5 <Ic src={IMGS.gem} alt="" size={14} /> instead</> }
        else {
          const drop = pool[Math.floor(Math.random() * pool.length)]
          next.ownedTitles = [...owned, drop]
          msg = <><Ic src={IMGS.crown} alt="" size={16} /> EXCLUSIVE TITLE: {SHOP_ITEMS.find((i) => i.id === drop)?.label} — equip it in your profile!</>
        }
      }
      else if (o.kind === 'jackpot') { next.emeralds = (s.emeralds || 0) + o.value; msg = <>JACKPOT — +{o.value} <Ic src={IMGS.gem} alt="" size={14} />!</> }
      return next
    })
    flash(msg)
  }

  // Casino-cabinet build: gradient segments, a gold rim ringed with blinking
  // marquee lights, and a chunky hub — big and loud on purpose.
  const R = 175, cx = 190, cy = 190, r = 152

  return (
    <div className="card wheel-card">
      <h3><Ic src={IMGS.slot} alt="🎰" size={20} /> Daily Spin {canSpin ? `(${maxSpins - usedToday} left)` : '(come back tomorrow)'}</h3>
      <div className="wheel-wrap">
        <div className="pointer" />
        <svg width="100%" viewBox="0 0 380 380" ref={wheelRef} className="wheel"
          style={{ transform: `rotate(${angle}deg)` }}>
          <defs>
            {WHEEL.map((w, i) => (
              <radialGradient key={w.id} id={`seg-${i}`} cx="50%" cy="50%" r="80%">
                <stop offset="30%" stopColor={w.color} />
                <stop offset="100%" stopColor={w.dark || w.color} />
              </radialGradient>
            ))}
            <radialGradient id="hub-gold" cx="35%" cy="35%" r="90%">
              <stop offset="0%" stopColor="#ffe98a" />
              <stop offset="55%" stopColor="#ffc800" />
              <stop offset="100%" stopColor="#8a6400" />
            </radialGradient>
          </defs>

          {/* gold rim */}
          <circle cx={cx} cy={cy} r={R} fill="url(#hub-gold)" />
          <circle cx={cx} cy={cy} r={r + 6} fill="#12060f" />

          {WHEEL.map((w, i) => {
            const a0 = (i * seg - 90) * (Math.PI / 180)
            const a1 = ((i + 1) * seg - 90) * (Math.PI / 180)
            const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0)
            const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1)
            const mid = ((i + 0.5) * seg - 90) * (Math.PI / 180)
            const tx = cx + r * 0.63 * Math.cos(mid), ty = cy + r * 0.63 * Math.sin(mid)
            // Flip labels on the bottom half so nothing reads upside-down.
            const rot = (i + 0.5) * seg
            const flipped = rot > 90 && rot < 270 ? rot + 180 : rot
            return (
              <g key={w.id}>
                <path d={`M${cx},${cy} L${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1} Z`} fill={`url(#seg-${i})`} stroke="#12060f" strokeWidth="3" />
                <text x={tx} y={ty} fill="#fff" fontSize="16" fontWeight="900" textAnchor="middle" dominantBaseline="middle" stroke="rgba(0,0,0,0.45)" strokeWidth="3" paintOrder="stroke"
                  transform={`rotate(${flipped}, ${tx}, ${ty})`}>{w.short || w.label}</text>
              </g>
            )
          })}

          {/* marquee lights on the rim */}
          {Array.from({ length: 16 }, (_, i) => {
            const a = ((i * 360) / 16 - 90) * (Math.PI / 180)
            return (
              <circle key={i} className={`wheel-light ${i % 2 ? 'odd' : ''}`}
                cx={cx + (r + 13) * Math.cos(a)} cy={cy + (r + 13) * Math.sin(a)} r="5" />
            )
          })}

          {/* hub */}
          <circle cx={cx} cy={cy} r="30" fill="url(#hub-gold)" stroke="#12060f" strokeWidth="3" />
          <circle cx={cx} cy={cy} r="12" fill="#12060f" />
        </svg>
      </div>
      <div className="outcome">{result ? `→ ${result.label}` : ''}</div>
      <button className="btn" disabled={spinning || !canSpin} onClick={doSpin}>
        {spinning ? 'Spinning…' : canSpin ? 'SPIN' : 'No spins left today'}
      </button>

      {/* Every prize spelled out — no more squinting at the wheel */}
      <div className="wheel-legend">
        {WHEEL.map((w) => (
          <div className="wl-item" key={w.id}>
            <i className="wl-dot" style={{ background: w.color }} />
            <span className="grow">{w.label}</span>
            <span className="wl-odds">{Math.round((w.weight / WHEEL.reduce((s, x) => s + x.weight, 0)) * 100)}%</span>
          </div>
        ))}
      </div>
      <div className="sub" style={{ marginTop: 10 }}>
        Finish tasks at Gaining Gold or higher to earn bonus spins.
      </div>
    </div>
  )
}

