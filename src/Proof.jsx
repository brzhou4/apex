import { useEffect, useRef, useState } from 'react'
import { ProofSession, LOCK_CAP_MS, DEFAULT_CAPTURE_MS, saveTimelapse, loadTimelapse } from './proof.js'
import { TIERS, TIER_META, IMGS, rewardsForTier } from './game.js'

function Ic({ src, alt = '', size = 18 }) {
  return <img className="ic-img" src={src} alt={alt} width={size} height={size} loading="lazy" />
}

function fmtRemaining(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`
}

// Records you actually doing the task, climbing the rank ladder live: each
// rank unlocks as its real-time threshold passes. You can bank your current
// rank once Bronze is reached, or keep going all the way to APEX (auto-
// finishes there). For tasks without a live ladder (fixed clips), pass
// fixedMs + tierLabel instead of liveTiers.
// The modal blocks the screen for up to LOCK_CAP_MS; past that the recording
// keeps running in a small badge so the app stays usable.
export function ProofRecorder({ taskTitle, liveTiers, fixedMs, tierLabel, onConfirm, onCommit }) {
  const live = !!liveTiers
  // Article 2 — commit before observation. Live sessions open with a
  // preregistration step: predict your minutes before the camera rolls.
  const [phase, setPhase] = useState(live ? 'predict' : 'starting') // predict | starting | live | processing | error
  const [predictedMin, setPredictedMin] = useState('')
  const [confidence, setConfidence] = useState(null) // % confident you'll hit at least that
  const [elapsed, setElapsed] = useState(0)
  const [errMsg, setErrMsg] = useState('')
  const videoRef = useRef(null)
  const sessionRef = useRef(null)
  const tickRef = useRef(null)
  const finishedRef = useRef(false)
  const predictionRef = useRef(null)

  const totalMs = live ? liveTiers[liveTiers.length - 1].threshold * 60000 : (fixedMs || DEFAULT_CAPTURE_MS)
  // You start at Bronze the moment the camera rolls — every rank above it
  // unlocks as its real-time threshold passes.
  const achievedIdx = live
    ? Math.max(0, liveTiers.reduce((acc, t, i) => (elapsed >= t.threshold * 60000 ? i : acc), 0))
    : null

  useEffect(() => {
    if (phase === 'predict') return // camera waits for the commitment
    let cancelled = false
    const session = new ProofSession()
    sessionRef.current = session
    session.start(totalMs)
      .then(() => {
        if (cancelled) return
        setPhase('live')
        tickRef.current = setInterval(() => setElapsed(session.elapsedMs()), 200)
      })
      .catch((err) => {
        if (cancelled) return
        setErrMsg(err.name === 'NotAllowedError' ? 'Camera permission denied.' : 'Camera unavailable.')
        setPhase('error')
      })
    return () => {
      cancelled = true
      clearInterval(tickRef.current)
      session.stopCamera()
      session.release()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase === 'predict'])

  function commitPrediction() {
    // Believable minutes only: whole numbers, 1–600 (a 10-hour session is
    // already heroic; a 5000-minute one is a typo).
    const mins = Math.round(Number(predictedMin))
    if (!mins || mins < 1 || mins > 600) return
    predictionRef.current = { predictedMin: mins, confidence: confidence ?? 50, ts: Date.now() }
    onCommit?.(predictionRef.current)
    setPhase('starting')
  }

  const inBackground = phase === 'live' && totalMs > LOCK_CAP_MS && elapsed >= LOCK_CAP_MS

  // Live preview only exists while the blocking modal is shown — reattach
  // the still-running stream to it whenever it (re)mounts.
  useEffect(() => {
    if (!inBackground && videoRef.current && sessionRef.current) {
      videoRef.current.srcObject = sessionRef.current.liveStream
    }
  }, [phase, inBackground])

  // Auto-finish: fixed clips end at their duration; live ladders end at APEX.
  useEffect(() => {
    if (phase === 'live' && elapsed >= totalMs && !finishedRef.current) {
      finishedRef.current = true
      finish()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, elapsed])

  async function finish() {
    const session = sessionRef.current
    clearInterval(tickRef.current)
    session.stopCamera()
    setPhase('processing')
    const finalTier = live ? Math.max(0, liveTiers.reduce((acc, t, i) => (session.elapsedMs() >= t.threshold * 60000 ? i : acc), 0)) : null
    // Resolve the preregistered prediction against the verified clock —
    // reality is the authority (Article 1), not self-report.
    const resolution = predictionRef.current
      ? { ...predictionRef.current, actualMin: Math.round((session.elapsedMs() / 60000) * 10) / 10, resolvedTs: Date.now() }
      : null
    try {
      const { blob, thumbnail, sourceMs, outputMs } = await session.buildTimelapse()
      const id = `proof-${Date.now()}`
      await saveTimelapse(id, blob)
      session.release()
      onConfirm({ id, thumbnail, sourceMs, outputMs }, finalTier, resolution)
    } catch {
      setErrMsg('Could not build the timelapse on this device.')
      setPhase('error')
    }
  }

  function bank() {
    // Live mode only: lock in the current rank — allowed anytime (you start at Bronze).
    if (finishedRef.current) return
    finishedRef.current = true
    finish()
  }

  if (inBackground) {
    const nextIdx = achievedIdx != null ? achievedIdx + 1 : null
    return (
      <div className="proof-bg-badge">
        <span className="proof-rec-dot">● REC</span>
        <div className="proof-bg-text">
          <b>{taskTitle}{live && achievedIdx >= 0 ? ` · ${TIER_META[TIERS[achievedIdx]].icon} ${TIERS[achievedIdx]} locked` : ''}</b>
          <span>
            {live && nextIdx != null && nextIdx < liveTiers.length
              ? `${fmtRemaining(liveTiers[nextIdx].threshold * 60000 - elapsed)} to ${TIERS[nextIdx]} — recording continues`
              : `${fmtRemaining(totalMs - elapsed)} left — keeps recording, logs itself when done`}
          </span>
        </div>
      </div>
    )
  }

  const pct = Math.min(100, (elapsed / totalMs) * 100)
  const nextIdx = live ? achievedIdx + 1 : null

  if (phase === 'predict') {
    return (
      <div className="modal-backdrop">
        <div className="modal card">
          <h3><Ic src={IMGS.target} alt="🎯" size={20} /> {taskTitle}</h3>
          <div className="predict-q">How many minutes do you honestly think you'll work?</div>
          <input
            type="number"
            min="1"
            autoFocus
            placeholder="minutes"
            value={predictedMin}
            onChange={(e) => setPredictedMin(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && commitPrediction()}
          />
          <div className="sub" style={{ marginTop: 12, marginBottom: 6 }}>How confident are you? (optional)</div>
          <div className="conf-row">
            {[20, 50, 80, 95].map((c) => (
              <button
                key={c}
                className={`conf-chip ${confidence === c ? 'on' : ''}`}
                onClick={() => setConfidence(confidence === c ? null : c)}
              >
                {c}%
              </button>
            ))}
          </div>
          <button
            className="btn"
            disabled={!(Math.round(Number(predictedMin)) >= 1 && Math.round(Number(predictedMin)) <= 600)}
            onClick={commitPrediction}
          >
            Commit & start recording
          </button>
          {Number(predictedMin) > 600 && (
            <div className="field-error" style={{ textAlign: 'center', marginTop: 6 }}>Keep it believable — 600 minutes max.</div>
          )}
          <div className="sub" style={{ marginTop: 10, fontSize: 11, textAlign: 'center' }}>
            Your prediction is locked before the camera rolls. Reality resolves it — not you, not the app.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-backdrop">
      <div className="modal card">
        <h3><Ic src={IMGS.camera} alt="📸" size={20} /> {taskTitle}</h3>
        {predictionRef.current && (
          // Deliberately does NOT show the number: a visible target turns the
          // forecast into a commitment device and contaminates the measurement.
          <div className="sub" style={{ marginBottom: 4 }}>
            <Ic src={IMGS.lock} alt="🔒" size={13} /> Prediction locked — reality reveals it when you finish
          </div>
        )}
        <div className="sub" style={{ marginBottom: 10 }}>
          {live
            ? 'Camera on, work on. Every rank unlocks as real time passes — bank your rank or push for APEX.'
            : `${tierLabel} · stay on camera for the full ${fmtRemaining(totalMs)} — it logs automatically as a timelapse.`}
        </div>

        {phase !== 'error' && (
          <div className="proof-video-wrap">
            <video ref={videoRef} autoPlay muted playsInline className="proof-video" />
            {phase === 'live' && (
              <div className="proof-rec-dot">
                ● REC {live
                  ? (nextIdx < liveTiers.length ? `${fmtRemaining(liveTiers[nextIdx].threshold * 60000 - elapsed)} → ${TIERS[nextIdx]}` : 'MAX')
                  : `${fmtRemaining(totalMs - elapsed)} left`}
              </div>
            )}
            {phase === 'processing' && <div className="proof-processing">Building timelapse…</div>}
          </div>
        )}

        {live && phase !== 'error' && (
          <div className="rank-list" style={{ marginTop: 10 }}>
            {liveTiers.map((t, i) => {
              const meta = TIER_META[t.name]
              const hit = i <= achievedIdx
              const isNext = i === achievedIdx + 1
              const r = rewardsForTier(i)
              return (
                <div key={t.name} className={`rank-row ${hit ? 'hit' : ''} ${isNext ? 'current' : ''}`}
                  style={hit ? { borderColor: meta.color } : undefined}>
                  <img className="ic-img" src={meta.img} alt={meta.icon} width={20} height={20} />
                  <span className="rank-row-name" style={hit ? { color: meta.color } : undefined}>{meta.fancy}</span>
                  <span className="rank-row-thr">{t.threshold}m</span>
                  <span className="rank-row-reward">
                    +{t.xp} XP · +{r.emeralds} <img className="ic-img ic-emerald" src={IMGS.gem} alt="emeralds" width={12} height={12} />
                    {r.bonusSpins > 0 && <> · +{r.bonusSpins} <img className="ic-img" src={IMGS.slot} alt="spin" width={12} height={12} /></>}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {phase === 'live' && (
          <div className="bar" style={{ marginTop: 10 }}><i style={{ width: `${pct}%`, background: 'var(--blue)' }} /></div>
        )}

        {live && phase === 'live' && (
          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexDirection: 'column' }}>
            {nextIdx < liveTiers.length ? (
              <div className="next-rank-strip">
                <Ic src={TIER_META[TIERS[nextIdx]].img} alt="" size={18} />
                <span>Keep going — <b>{TIER_META[TIERS[nextIdx]].fancy}</b> in {fmtRemaining(liveTiers[nextIdx].threshold * 60000 - elapsed)}</span>
              </div>
            ) : (
              <div className="next-rank-strip apexed">
                <Ic src={IMGS.crown} alt="👑" size={18} />
                <span>You're at APEX — it locks in automatically</span>
              </div>
            )}
            <button className="btn" onClick={bank}>
              <Ic src={IMGS.floppy} alt="💾" size={15} /> Save & Exit — Bank {TIER_META[TIERS[achievedIdx]].fancy}
            </button>
          </div>
        )}

        {phase === 'error' && (
          <>
            <div className="sub" style={{ color: 'var(--flame)', margin: '10px 0' }}>
              {errMsg} No camera means no timelapse — this log will be forced through as unverified.
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button className="btn" onClick={() => onConfirm(null, live ? 0 : null)}>Continue (unverified)</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// Plays back a saved timelapse blob by id, fetched from IndexedDB on demand.
export function TimelapsePlayer({ proofId, onClose }) {
  const [url, setUrl] = useState(null)
  const [missing, setMissing] = useState(false)
  const [broken, setBroken] = useState(false)

  useEffect(() => {
    let objUrl
    loadTimelapse(proofId).then((blob) => {
      if (!blob) { setMissing(true); return }
      objUrl = URL.createObjectURL(blob)
      setUrl(objUrl)
    })
    return () => { if (objUrl) URL.revokeObjectURL(objUrl) }
  }, [proofId])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <h3>Timelapse proof</h3>
        {missing && <div className="sub">This clip isn't on this device (proofs are stored locally, per-browser).</div>}
        {broken && <div className="sub">This browser can't play the format this clip was recorded in.</div>}
        {url && !broken && <video src={url} controls autoPlay loop className="proof-video" onError={() => setBroken(true)} />}
        <button className="btn ghost" style={{ marginTop: 12 }} onClick={onClose}>Close</button>
      </div>
    </div>
  )
}

// Focus Duel — a live camera endurance match against a rival with a hidden
// endurance. Stay focused on camera longer than they do to win bonus XP.
// The whole session records and saves as a timelapse like any other proof.
export function FocusDuel({ rival, onFinish, onError }) {
  const [elapsed, setElapsed] = useState(0)
  const [phase, setPhase] = useState('starting') // starting | live | processing
  const videoRef = useRef(null)
  const sessionRef = useRef(null)
  const tickRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    const session = new ProofSession()
    sessionRef.current = session
    session.start(rival.enduranceMs * 2)
      .then(() => {
        if (cancelled) return
        if (videoRef.current) videoRef.current.srcObject = session.liveStream
        setPhase('live')
        tickRef.current = setInterval(() => setElapsed(session.elapsedMs()), 200)
      })
      .catch(() => { if (!cancelled) onError() })
    return () => {
      cancelled = true
      clearInterval(tickRef.current)
      session.stopCamera()
      session.release()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rivalOut = elapsed >= rival.enduranceMs

  async function tapOut() {
    const session = sessionRef.current
    clearInterval(tickRef.current)
    session.stopCamera()
    setPhase('processing')
    let proof = null
    try {
      const { blob, thumbnail } = await session.buildTimelapse()
      const id = `proof-${Date.now()}`
      await saveTimelapse(id, blob)
      proof = { id, thumbnail }
    } catch { /* duel still counts without a saved clip */ }
    session.release()
    onFinish(elapsed, proof)
  }

  const mins = Math.floor(elapsed / 60000)
  const secs = Math.floor((elapsed % 60000) / 1000)

  return (
    <div className="modal-backdrop">
      <div className="modal card">
        <h3><Ic src={IMGS.brain} alt="🧠" size={20} /> Focus Duel vs {rival.name}</h3>
        <div className="sub" style={{ marginBottom: 10 }}>
          Stay focused on camera. Last one focusing wins. {rival.name}'s endurance is hidden.
        </div>
        <div className="proof-video-wrap">
          <video ref={videoRef} autoPlay muted playsInline className="proof-video" />
          {phase === 'live' && <div className="proof-rec-dot">● {mins}:{String(secs).padStart(2, '0')}</div>}
          {phase === 'processing' && <div className="proof-processing">Saving your timelapse…</div>}
        </div>
        <div className="sub" style={{ marginTop: 10, textAlign: 'center', fontWeight: 800, color: rivalOut ? 'var(--body)' : 'var(--flame)' }}>
          {phase === 'live' && (rivalOut ? <><Ic src={IMGS.party} alt="🎉" size={15} /> {rival.name} tapped out — you've won, cash in whenever!</> : `${rival.name} is still focusing…`)}
        </div>
        {phase === 'live' && (
          <button className="btn" onClick={tapOut} style={{ marginTop: 12 }}>
            {rivalOut ? 'Claim the win' : 'Tap out'}
          </button>
        )}
      </div>
    </div>
  )
}

// When exactly a clip was recorded — full date + time if we have it.
function recordedAt(p) {
  if (p.ts) {
    const d = new Date(p.ts)
    return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
  }
  return p.date || ''
}

// Grid of past proof-of-work clips, newest first, stamped with when they
// were recorded.
export function TimelapseGallery({ proofLog }) {
  const [open, setOpen] = useState(null)
  const entries = [...(proofLog || [])].reverse()

  if (entries.length === 0) {
    return <div className="sub">No timelapses yet — proof clips appear here once you log a task tier.</div>
  }
  return (
    <>
      <div className="timelapse-grid">
        {entries.map((p) => (
          <div key={p.id} className="timelapse-thumb" onClick={() => setOpen(p.id)}>
            {p.thumbnail ? <img src={p.thumbnail} alt="" /> : <div className="timelapse-thumb-blank"><Ic src={IMGS.hourglass} alt="" size={22} /></div>}
            <div className="timelapse-meta">
              <span>{p.taskTitle}</span>
              <span className="link">{p.tierLabel}</span>
            </div>
            <div className="timelapse-when">{recordedAt(p)}</div>
          </div>
        ))}
      </div>
      {open && <TimelapsePlayer proofId={open} onClose={() => setOpen(null)} />}
    </>
  )
}
