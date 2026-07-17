import { useState, useRef, useEffect } from 'react'
import {
  earnedTitleIds, IMGS, TITLE_ACHIEVEMENTS, SHOP_ITEMS, goalFlags, computeHumanScore,
  levelFromXp, rankScoreBonus, validateBaseline, predictionStats, CALIBRATION_UNLOCK,
  weeklyInsight, DEFAULT_PET, petStage, PET_COLORS, rankForLevel, STREAK_MILESTONES,
  tierCounts, humanRank, TIER_COLORS, TIERS, TIER_META,
} from '../game.js'
import { Ic, Field, Sparkline, ScoreBar, Stat, titleChipStyle } from '../ui.jsx'
import { EMPTY_BASELINE, isBaselineReady, BaselineFields } from './Onboarding.jsx'
import { TimelapseGallery } from '../Proof.jsx'
/* ---------------- Titles ---------------- */

// Titles are trophies, not merchandise. Every title in the game is listed —
// what you've earned is wearable, what you haven't shows exactly how to get it.
export function TitlesBox({ state, setState, flash }) {
  const earned = earnedTitleIds(state)
  return (
    <div className="card">
      <h3><Ic src={IMGS.crown} alt="👑" size={18} /> Titles</h3>
      <div className="sub" style={{ marginBottom: 8 }}>
        Earned, never bought. {earned.length}/{TITLE_ACHIEVEMENTS.length} unlocked — tap one to wear it.
      </div>
      {TITLE_ACHIEVEMENTS.map((t) => {
        const item = SHOP_ITEMS.find((i) => i.id === t.id)
        if (!item) return null
        const has = earned.includes(t.id)
        const wearing = state.equippedTitle === t.id
        return (
          <div className={`title-row ${has ? 'earned' : ''}`} key={t.id}>
            <span className={`profile-title ${has ? '' : 'title-locked'}`} style={has ? titleChipStyle(t.id) : undefined}>{item.label}</span>
            <span className="title-how">{has ? '✓ earned' : t.how}</span>
            <button
              className="follow-btn title-wear"
              disabled={!has}
              onClick={() => {
                setState((s) => ({ ...s, equippedTitle: wearing ? null : t.id }))
                flash(wearing ? 'Title removed' : `Now wearing “${item.label}”`)
              }}
            >
              {wearing ? 'Remove' : has ? 'Wear' : <Ic src={IMGS.lock} alt="🔒" size={13} />}
            </button>
          </div>
        )
      })}
    </div>
  )
}

/* ---------------- Profile ---------------- */

// Identity card — profile picture (upload / icon / plain color), name, bio,
// and equipped title, sitting on your equipped banner. `startEditing` (a
// counter) drops you straight into edit mode, e.g. from Settings.
export function ProfileIdentity({ state, setState, flash, startEditing }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(state.name || 'You')
  const [bio, setBio] = useState(state.bio || '')
  const fileRef = useRef(null)
  const colorRef = useRef(null)
  const bannerItem = SHOP_ITEMS.find((i) => i.id === state.equippedBanner) || SHOP_ITEMS.find((i) => i.id === 'bn-default')
  const iconItem = SHOP_ITEMS.find((i) => i.id === state.equippedIcon)
  const titleItem = SHOP_ITEMS.find((i) => i.id === state.equippedTitle)
  const ownedTitleItems = SHOP_ITEMS.filter((i) => i.type === 'title' && earnedTitleIds(state).includes(i.id))

  useEffect(() => {
    if (startEditing) {
      setName(state.name || 'You')
      setBio(state.bio || '')
      setEditing(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startEditing])

  function onPickImage(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setState((s) => ({ ...s, avatarImage: reader.result }))
      flash('Profile picture updated')
    }
    reader.readAsDataURL(file)
  }

  function saveIdentity() {
    setState((s) => ({
      ...s,
      name: name.trim() || 'You',
      bio: bio.trim(),
      squad: s.squad
        ? { ...s.squad, members: s.squad.members.map((m) => (m.isUser ? { ...m, name: name.trim() || 'You' } : m)) }
        : s.squad,
    }))
    setEditing(false)
    flash('Profile saved')
  }

  return (
    <div className="card banner-card" style={{ background: bannerItem.gradient }}>
      <div
        className="avatar-lg avatar-clickable"
        title="Tap to pick your color"
        style={{ background: state.avatarImage ? 'transparent' : state.avatarColor || 'var(--blue)' }}
        onClick={() => colorRef.current?.click()}
      >
        {state.avatarImage ? <img src={state.avatarImage} alt="" /> : (iconItem?.icon || (state.name || 'Y')[0])}
      </div>
      <input
        ref={colorRef}
        type="color"
        value={state.avatarColor || '#38bdf8'}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0, padding: 0, border: 'none', pointerEvents: 'none' }}
        onChange={(e) => setState((s) => ({ ...s, avatarColor: e.target.value, avatarImage: null }))}
      />
      <div className="sub" style={{ textAlign: 'center', marginTop: 6, fontSize: 11 }}>tap your avatar to pick any color</div>
      <div style={{ textAlign: 'center', marginTop: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>{state.name || 'You'}</div>
        {titleItem && <div style={{ marginTop: 4 }}><span className="profile-title" style={titleChipStyle(titleItem.id)}>{titleItem.label}</span></div>}
        <div className="sub" style={{ marginTop: 6 }}>{state.bio || 'No bio yet — say something.'}</div>
      </div>

      {!editing ? (
        <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => { setName(state.name || 'You'); setBio(state.bio || ''); setEditing(true) }}>
<Ic src={IMGS.pencil} alt="✏️" size={15} /> Edit profile
        </button>
      ) : (
        <div style={{ marginTop: 12 }}>
          <Field label="Display name"><input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} /></Field>
          <div style={{ marginTop: 8 }}>
            <Field label="Bio"><input value={bio} maxLength={80} placeholder="80 chars of pure motivation" onChange={(e) => setBio(e.target.value)} /></Field>
          </div>

          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPickImage} />
          <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => fileRef.current?.click()}><Ic src={IMGS.camera} alt="📷" size={15} /> Upload profile picture</button>
          {state.avatarImage && (
            <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => setState((s) => ({ ...s, avatarImage: null }))}>Remove picture</button>
          )}

          {ownedTitleItems.length > 0 && (
            <>
              <div className="field-label" style={{ marginTop: 12 }}>Title</div>
              <select value={state.equippedTitle || ''} onChange={(e) => setState((s) => ({ ...s, equippedTitle: e.target.value || null }))}>
                <option value="">No title</option>
                {ownedTitleItems.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </>
          )}

          <button className="btn" style={{ marginTop: 12 }} onClick={saveIdentity}>Save</button>
        </div>
      )}
    </div>
  )
}

export function Profile({ state, setState, flash, onReBaseline, onSyncHealth, onBack, backLabel = 'Tasks', onOpenShop, startEditing }) {
  const [editing, setEditing] = useState(false)
  const [bl, setBl] = useState(state.baseline || EMPTY_BASELINE)
  const set = (k) => (e) => setBl((b) => ({ ...b, [k]: e.target.value }))
  const blFlags = goalFlags(state.dreamGoal || '')
  const score = state.score || computeHumanScore(state.baseline || {})
  const history = state.scoreHistory || []
  const prev = history.length > 1 ? history[history.length - 2].total : null
  const delta = prev != null ? score.total - prev : null
  const lvl = levelFromXp(state.xp)
  // Rank grind pays into your Human Score — a small, capped bonus.
  const grindBonus = rankScoreBonus(state.tierLog || [])
  const shownTotal = Math.min(1000, score.total + grindBonus)

  function save() {
    if (!isBaselineReady(bl, blFlags)) return
    onReBaseline({ ...bl, relevance: { body: blFlags.body, mind: blFlags.mind, intellect: blFlags.intellect } })
    setEditing(false)
  }

  if (editing) {
    const blErrors = validateBaseline(bl)
    return (
      <div className="card">
        <h3>Re-baseline</h3>
        <div className="sub" style={{ marginBottom: 8 }}>Update your numbers — we’ll snapshot the new score onto your trend. Only what your dream measures is asked.</div>
        <BaselineFields bl={bl} set={set} errors={blErrors} flags={blFlags} />
        <button className="btn ghost" onClick={() => setEditing(false)} style={{ marginTop: 8 }}>Cancel</button>
        <button className="btn" disabled={!isBaselineReady(bl, blFlags)} onClick={save}>
          {Object.keys(blErrors).length > 0 ? 'Fix the highlighted values' : 'Save new baseline'}
        </button>
      </div>
    )
  }

  return (
    <>
      <ProfileIdentity state={state} setState={setState} flash={flash} startEditing={startEditing} />

      <div className="card">
        <h3>Human Score</h3>
        <div className="score-big">{shownTotal}</div>
        <div className="sub" style={{ textAlign: 'center' }}>
          {grindBonus > 0 && <span style={{ color: 'var(--body)' }}>includes +{grindBonus} from your rank grind · </span>}
          {delta != null ? (
            <span style={{ color: delta >= 0 ? 'var(--body)' : 'var(--flame)' }}>
              {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)} since last check
            </span>
          ) : 'your current Human Score'}
          {score.bmi ? ` · BMI ${score.bmi.toFixed(1)}` : ''}
        </div>
        <Sparkline points={history.map((h) => h.total)} />
        <ScoreBar label={<><Ic src={IMGS.brain} alt="🧠" size={15} /> Mind</>} value={score.mind} color="var(--mind)" />
        <ScoreBar label={<><Ic src={IMGS.biceps} alt="💪" size={15} /> Body</>} value={score.body} color="var(--body)" />
        <ScoreBar label={<><Ic src={IMGS.books} alt="📚" size={15} /> Intellect</>} value={score.intellect} color="var(--intellect)" />
        <button className="btn" onClick={() => { setBl(state.baseline || EMPTY_BASELINE); setEditing(true) }} style={{ marginTop: 12 }}>
          Re-take baseline
        </button>
      </div>

      {/* Judgment — receipts immediately, calibration only when the evidence
          is big enough to mean something (CONSTITUTION.md). */}
      {(() => {
        const preds = state.predictions || []
        const resolved = preds.filter((p) => p.status === 'resolved' || (p.status == null && p.actualMin != null))
        const voided = preds.filter((p) => p.status === 'voided').length
        const abandoned = preds.filter((p) => p.status === 'abandoned').length
        const stats = predictionStats(preds)
        return (
          <div className="card">
            <h3><Ic src={IMGS.target} alt="🎯" size={20} /> Judgment</h3>
            {(voided > 0 || abandoned > 0) && (
              <div className="sub" style={{ marginBottom: 8, fontSize: 11 }}>
                {resolved.length} resolved{voided > 0 ? ` · ${voided} voided (camera)` : ''}{abandoned > 0 ? ` · ${abandoned} abandoned` : ''} — abandonments count too; walking away is data.
              </div>
            )}
            {resolved.length === 0 ? (
              <div className="sub">
                Every recorded session starts with a prediction. Reality resolves it — your receipts land here.
              </div>
            ) : (
              [...resolved].slice(-5).reverse().map((p) => {
                const diff = Math.round((p.actualMin - p.predictedMin) * 10) / 10
                return (
                  <div className="receipt-row" key={p.id}>
                    <span className="rr-task">{p.taskTitle}</span>
                    <span className="rr-nums">{p.predictedMin}m → {p.actualMin}m</span>
                    <span className={`rr-diff ${diff >= 0 ? 'receipt-pos' : 'receipt-neg'}`}>{diff >= 0 ? '+' : ''}{diff}m</span>
                  </div>
                )
              })
            )}

            {stats.n < CALIBRATION_UNLOCK ? (
              <>
                <div className="score-row" style={{ marginTop: 12 }}>
                  <span>Calibration</span><span>{stats.n}/{CALIBRATION_UNLOCK} resolved</span>
                </div>
                <div className="bar"><i style={{ width: `${(stats.n / CALIBRATION_UNLOCK) * 100}%`, background: 'var(--intellect)' }} /></div>
                <div className="sub" style={{ marginTop: 8 }}>
                  We don’t know yet. Calibration unlocks at {CALIBRATION_UNLOCK} resolved predictions — enough evidence to mean something.
                </div>
              </>
            ) : (
              <>
                <div className="stat-grid" style={{ marginTop: 12 }}>
                  <Stat value={`${stats.meanAbsErrPct}%`} label="avg prediction error" />
                  <Stat value={stats.brier} label="Brier score (lower = better)" />
                </div>
                <div className="sub" style={{ marginTop: 8 }}>
                  Built from {stats.n} camera-verified resolutions. Still a small sample — treat as weak evidence. It sharpens as you keep predicting.
                </div>
              </>
            )}
          </div>
        )
      })()}

      <div className="card">
        <h3><Ic src={IMGS.phone} alt="📲" size={20} /> Health Sync</h3>
        {state.health ? (
          <>
            <div className="stat-grid">
              <Stat value={state.health.steps.toLocaleString()} label="steps" />
              <Stat value={`${state.health.sleepHrs}h`} label="sleep" />
              <Stat value={state.health.hrv} label="HRV (ms)" />
              <Stat value={state.health.restingHr} label="resting HR" />
            </div>
            <div className="sub" style={{ marginTop: 8 }}>Last sync: {state.health.source} · auto-logs your steps task.</div>
          </>
        ) : (
          <div className="sub">Connect a wearable to auto-import steps, sleep, and HRV — and auto-complete your steps task.</div>
        )}
        <button className="btn" onClick={onSyncHealth} style={{ marginTop: 12 }}>
          {state.health ? 'Sync now' : 'Connect Apple Health'}
        </button>
        <div className="sub" style={{ marginTop: 8, fontSize: 10 }}>Simulated — a real build uses Apple HealthKit / Google Health Connect.</div>
      </div>

      <div className="card">
        <h3>This Week in Review</h3>
        <div className="sub"><Ic src={IMGS.bulb} alt="💡" size={14} /> {weeklyInsight(state)}</div>
      </div>

      {/* Your pet, front and center on your profile */}
      {(() => {
        const pet = state.pet || DEFAULT_PET
        const stage = petStage(pet.fed || 0)
        const color = PET_COLORS.find((c) => c.id === pet.color) || PET_COLORS[0]
        return (
          <div className="card">
            <div className="hud">
              <div className="avatar" style={{ background: 'var(--panel-2)' }}>
                <img src={stage.img} alt={stage.name} width={30} height={30} style={{ filter: color.filter }} className="ic-img" />
              </div>
              <div className="grow">
                <div className="lvl">{pet.name} · Lv {stage.level} {stage.name}</div>
                <div className="rank">{pet.fed || 0} pet XP · {state.fruits || 0} <Ic src={IMGS.apple} alt="fruit" size={12} /> in the bag</div>
              </div>
              {stage.next && (
                <span className="pill pill-sm" style={{ color: 'var(--mind)' }}>
                  {stage.next.fed - (pet.fed || 0)} XP to evolve
                </span>
              )}
            </div>
          </div>
        )
      })()}

      <TitlesBox state={state} setState={setState} flash={flash} />

      <div className="card">
        <h3>Streaks & Stats</h3>
        <div className="stat-grid">
          <Stat value={<><Ic src={IMGS.fire} alt="🔥" size={16} /> {state.streak}</>} label="current streak" />
          <Stat value={<><Ic src={IMGS.medal} alt="🏅" size={16} /> {state.longestStreak || 0}</>} label="longest streak" />
          <Stat value={<><Ic src={IMGS.shield} alt="🛡️" size={16} /> {state.shields || 0}</>} label="shields" />
          <Stat value={`Lv ${lvl.level}`} label={rankForLevel(lvl.level)} />
        </div>
        <div className="milestones">
          {STREAK_MILESTONES.map((m) => {
            const hit = (state.milestonesHit || []).includes(m) || state.streak >= m
            return <span key={m} className={`milestone ${hit ? 'hit' : ''}`}>{m}d</span>
          })}
        </div>
      </div>

      <div className="card">
        <h3>Rank Record</h3>
        {(() => {
          const log = state.tierLog || []
          const counts = tierCounts(log)
          const rank = humanRank(log)
          return (
            <>
              <div className="score-big" style={{ fontSize: 28, color: rank.tier ? TIER_COLORS[rank.tier] : 'var(--muted)' }}>
                {rank.img && <Ic src={rank.img} alt={rank.icon} size={26} />} {rank.label}
              </div>
              <div className="sub" style={{ textAlign: 'center', marginBottom: 10 }}>
                {log.length > 0 ? `your earned title (${rank.tier} tier) — average of ${log.length} logged rank${log.length > 1 ? 's' : ''} (avg ${rank.avg})` : 'complete ranked tasks to earn your title'}
              </div>
              <div className="ladder">
                {TIERS.map((t) => (
                  <div key={t} className={`ladder-step ${counts[t] > 0 ? 'hit' : ''}`} style={counts[t] > 0 ? { borderColor: TIER_COLORS[t], color: TIER_COLORS[t] } : undefined} title={TIER_META[t].fancy}>
                    <span className="li"><Ic src={TIER_META[t].img} alt={TIER_META[t].icon} size={20} /></span>
                    <span className="lt">× {counts[t]}</span>
                  </div>
                ))}
              </div>
            </>
          )
        })()}
      </div>

      <div className="card">
        <h3>Cosmetics</h3>
        {(() => {
          const owned = [...(state.ownedIcons || []), ...(state.ownedBanners || []), ...(state.ownedTitles || [])]
          const items = SHOP_ITEMS.filter((i) => owned.includes(i.id) && (i.price > 0 || i.limited))
          return items.length === 0
            ? <div className="sub">None yet — buy some in the Shop, or win limited drops on the Spin wheel.</div>
            : <div className="chips">{items.map((c) => (
                <span key={c.id} className="chip" style={{ color: c.limited ? 'var(--flame)' : 'var(--accent)' }}>
                  {c.img ? <Ic src={c.img} alt={c.icon || ''} size={16} /> : c.type === 'title' ? <Ic src={IMGS.crown} alt="🏷️" size={16} /> : <Ic src={IMGS.star} alt="✨" size={16} />} {c.label}
                </span>
              ))}</div>
        })()}
        {onOpenShop && <button className="btn ghost" onClick={onOpenShop} style={{ marginTop: 12 }}>Open Shop</button>}
      </div>

      <div className="card">
        <h3><Ic src={IMGS.camera} alt="🎞️" size={20} /> Proof timelapses</h3>
        <TimelapseGallery proofLog={state.proofLog} />
      </div>

      <button className="btn ghost" onClick={onBack}>← Back to {backLabel}</button>
    </>
  )
}

