import { useState } from 'react'
import { IMGS } from '../game.js'
import { Ic, Stat } from '../ui.jsx'
/* ---------------- Prediction receipt ---------------- */

// The face of the protocol: prediction vs reality, no interpretation, no
// judgment. The user needed a receipt, not an insight. XP already flowed
// for the exposure itself — being wrong costs nothing, hiding would have.
// One optional question — WHY the gap — captured as evidence, never advice.
const RECEIPT_REASONS = ['Interrupted', 'Harder than expected', 'Distracted', 'Finished early', 'About right']

export function PredictionReceipt({ receipt, onReason, onDone }) {
  const [reason, setReason] = useState(null)
  const diff = Math.round((receipt.actualMin - receipt.predictedMin) * 10) / 10
  return (
    <div className="modal-backdrop" onClick={onDone}>
      <div className="modal card receipt-card" onClick={(e) => e.stopPropagation()}>
        <h3><Ic src={IMGS.target} alt="🎯" size={20} /> Receipt · {receipt.taskTitle}</h3>
        <div className="receipt-grid">
          <div className="receipt-cell">
            <span className="receipt-label">Prediction</span>
            <span className="receipt-value">{receipt.predictedMin}m</span>
            {receipt.confidence != null && <span className="receipt-conf">@ {receipt.confidence}%</span>}
          </div>
          <div className="receipt-cell">
            <span className="receipt-label">Reality</span>
            <span className="receipt-value">{receipt.actualMin}m</span>
            <span className="receipt-conf">camera-verified</span>
          </div>
          <div className="receipt-cell">
            <span className="receipt-label">Difference</span>
            <span className={`receipt-value ${diff >= 0 ? 'receipt-pos' : 'receipt-neg'}`}>
              {diff >= 0 ? '+' : ''}{diff}m
            </span>
          </div>
        </div>

        <div className="receipt-why">Why the gap? <span className="receipt-why-opt">optional</span></div>
        <div className="conf-row receipt-reasons">
          {RECEIPT_REASONS.map((r) => (
            <button
              key={r}
              className={`conf-chip ${reason === r ? 'on' : ''}`}
              onClick={() => { const next = reason === r ? null : r; setReason(next); onReason(next) }}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="sub" style={{ textAlign: 'center', marginTop: 12 }}>
          +5 XP for the exposure — not for being right.
        </div>
        <button className="btn ghost" onClick={onDone} style={{ marginTop: 10 }}>Noted</button>
      </div>
    </div>
  )
}

/* ---------------- Evidence Review ---------------- */

// The loop's Improve step. Shows this batch of evidence with zero
// interpretation, then forces exactly one commitment: what will you change?
// If you committed something last time, it's shown first — so the review
// quietly asks whether you followed through.
export function EvidenceReview({ evidence, lastChange, onSave, onClose }) {
  const [change, setChange] = useState('')
  const ev = evidence || { n: 0 }
  const biasWord = ev.signed > 0 ? 'over' : 'under' // ran longer than predicted = you under-estimated
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <h3><Ic src={IMGS.target} alt="🎯" size={20} /> Evidence Review</h3>
        <div className="sub" style={{ marginBottom: 10 }}>
          {ev.n} resolved prediction{ev.n === 1 ? '' : 's'} since last time. Just the evidence — no advice.
        </div>

        {lastChange && (
          <div className="review-last">
            Last time you committed to: <b>“{lastChange}”</b> — did you?
          </div>
        )}

        <div className="stat-grid" style={{ marginTop: 4 }}>
          <Stat value={`${ev.avgAbs}m`} label="avg miss" />
          <Stat value={`${Math.abs(ev.signed)}m ${biasWord}`} label="you tend to run" />
        </div>
        {ev.biggest && (
          <div className="review-surprise">
            <span className="receipt-label">Biggest surprise</span>
            <div>{ev.biggest.task} — predicted {ev.biggest.predicted}m, ran {ev.biggest.actual}m</div>
          </div>
        )}
        {ev.topReason && (
          <div className="sub" style={{ marginTop: 8 }}>
            Most common reason you logged: <b style={{ color: 'var(--text)' }}>{ev.topReason}</b>.
          </div>
        )}

        <div className="review-q">What will you change next week?</div>
        <textarea
          value={change}
          autoFocus
          maxLength={140}
          placeholder="One concrete thing…"
          onChange={(e) => setChange(e.target.value)}
          style={{ minHeight: 60 }}
        />
        <button className="btn" disabled={change.trim().length < 8} onClick={() => onSave(change)}>
          Commit the change
        </button>
        <button className="btn ghost" onClick={onClose}>Later</button>
      </div>
    </div>
  )
}
