import { useState, useEffect } from 'react'
import { IMGS, resetState } from '../game.js'
import { Ic, Field } from '../ui.jsx'
import { backendEnabled, cloudUser, cloudSignIn, cloudSignUp, cloudSignOut, syncProfile } from '../backend.js'
import { TimelapseGallery } from '../Proof.jsx'
/* ---------------- Cloud account (Butterbase) ---------------- */

// Sign in to the shared world: your profile syncs and your posts land on
// every user's feed. Renders setup instructions until the backend is
// configured; the whole app works offline without it.
function CloudAccount({ state, flash }) {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [meCloud, setMeCloud] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (backendEnabled) cloudUser().then(setMeCloud)
  }, [])

  if (!backendEnabled) {
    return (
      <div className="card">
        <h3><Ic src={IMGS.globe} alt="🌐" size={18} /> Cloud (Butterbase)</h3>
        <div className="sub">
          Not configured yet — the app runs fully on this device. To go live with real accounts and a shared feed:
        </div>
        <div className="sub" style={{ marginTop: 8, fontFamily: 'monospace', fontSize: 11, lineHeight: 1.8 }}>
          npx @butterbase/cli login<br />
          npx @butterbase/cli apps create apex<br />
          npx @butterbase/cli schema apply butterbase/schema.json<br />
          echo "VITE_BUTTERBASE_APP_ID=app_…" &gt;&gt; .env
        </div>
      </div>
    )
  }

  async function go(kind) {
    if (busy) return
    setBusy(true); setErr('')
    const fn = kind === 'in' ? cloudSignIn : cloudSignUp
    const { error } = await fn(email.trim(), pw)
    if (error) {
      setErr(error)
    } else {
      const u = await cloudUser()
      setMeCloud(u)
      syncProfile(state).catch(() => {})
      flash(kind === 'in' ? <><Ic src={IMGS.globe} alt="" size={15} /> Signed in — your feed is live</> : 'Account created — you are live!')
    }
    setBusy(false)
  }

  async function bye() {
    await cloudSignOut()
    setMeCloud(null)
    flash('Signed out — back to device-only mode')
  }

  return (
    <div className="card">
      <h3><Ic src={IMGS.globe} alt="🌐" size={18} /> Cloud (Butterbase)</h3>
      {meCloud ? (
        <>
          <div className="sub">
            Signed in as <b style={{ color: 'var(--text)' }}>{meCloud.email || 'you'}</b> — your profile syncs and your posts reach everyone's feed.
          </div>
          <button className="btn ghost" onClick={bye} style={{ marginTop: 10 }}>Sign out</button>
        </>
      ) : (
        <>
          <div className="sub" style={{ marginBottom: 8 }}>Sign in to post to the shared feed and sync your profile.</div>
          <Field label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></Field>
          <div style={{ marginTop: 8 }}>
            <Field label="Password"><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="8+ characters" /></Field>
          </div>
          {err && <div className="field-error" style={{ marginTop: 6 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" style={{ flex: 1 }} disabled={busy || !email.trim() || pw.length < 8} onClick={() => go('in')}>
              {busy ? '…' : 'Sign in'}
            </button>
            <button className="btn ghost" style={{ flex: 1 }} disabled={busy || !email.trim() || pw.length < 8} onClick={() => go('up')}>
              Create account
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/* ---------------- Settings ---------------- */

// Full-screen settings: theme, profile shortcuts, your timelapse vault, and
// the door out (delete account). Opened from the gear in the top bar.
export function Settings({ state, setState, flash, onClose, onEditProfile }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const light = state.theme === 'light'

  function setTheme(theme) {
    setState((s) => ({ ...s, theme }))
    flash(theme === 'light' ? <><Ic src={IMGS.sun} alt="" size={15} /> Light mode on</> : <><Ic src={IMGS.moon} alt="" size={15} /> Dark mode on</>)
  }

  function deleteAccount() {
    resetState()
    try { indexedDB.deleteDatabase('apex.proofs') } catch { /* best effort */ }
    location.reload()
  }

  return (
    <div className="profile-page">
      <div className="profile-page-inner">
        <div className="pp-top">
          <button className="pp-back" onClick={onClose}>←</button>
          <span className="pp-handle"><Ic src={IMGS.gear} alt="⚙️" size={16} /> Settings</span>
        </div>

        <div className="card">
          <h3>Appearance</h3>
          <div className="theme-row">
            <button className={`theme-opt ${!light ? 'on' : ''}`} onClick={() => setTheme('dark')}>
              <Ic src={IMGS.moon} alt="🌙" size={22} />
              <span>Dark</span>
            </button>
            <button className={`theme-opt ${light ? 'on' : ''}`} onClick={() => setTheme('light')}>
              <Ic src={IMGS.sun} alt="☀️" size={22} />
              <span>Light</span>
            </button>
          </div>
        </div>

        <CloudAccount state={state} flash={flash} />

        <div className="card">
          <h3>Account</h3>
          <div className="settings-row" onClick={onEditProfile}>
            <Ic src={IMGS.pencil} alt="✏️" size={18} />
            <div className="grow">
              <div className="tt">Edit profile</div>
              <div className="meta">Name, bio, avatar color, picture, title</div>
            </div>
            <span className="link">→</span>
          </div>
        </div>

        <div className="card">
          <h3>Preferences</h3>
          {[
            { key: 'notifications', icon: IMGS.phone, label: 'Daily reminders', meta: 'Nudge me when my streak is on the line' },
            { key: 'sounds', icon: IMGS.party, label: 'Sound effects', meta: 'Level-ups, spins, and pet noises' },
            { key: 'reducedMotion', icon: IMGS.hourglass, label: 'Reduce motion', meta: 'Calmer animations everywhere' },
          ].map((p) => {
            const prefs = state.prefs || { notifications: true, sounds: true, reducedMotion: false }
            const on = !!prefs[p.key]
            return (
              <div className="settings-row" key={p.key} onClick={() => {
                setState((s) => ({ ...s, prefs: { ...(s.prefs || { notifications: true, sounds: true, reducedMotion: false }), [p.key]: !on } }))
                if (p.key === 'reducedMotion') document.body.classList.toggle('reduce-motion', !on)
              }}>
                <Ic src={p.icon} alt="" size={18} />
                <div className="grow">
                  <div className="tt">{p.label}</div>
                  <div className="meta">{p.meta}</div>
                </div>
                <span className={`toggle ${on ? 'on' : ''}`}><i /></span>
              </div>
            )
          })}
        </div>

        <div className="card">
          <h3>Your data</h3>
          <div className="settings-row" onClick={() => {
            const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blob)
            a.download = 'apex-data.json'
            a.click()
            setTimeout(() => URL.revokeObjectURL(a.href), 5000)
            flash('Your data is downloading')
          }}>
            <Ic src={IMGS.floppy} alt="💾" size={18} />
            <div className="grow">
              <div className="tt">Export my data</div>
              <div className="meta">Everything — goals, XP, streaks, pet — as JSON</div>
            </div>
            <span className="link">↓</span>
          </div>
          <div className="sub" style={{ marginTop: 6, fontSize: 11 }}>
            Everything lives on this device. Nothing is uploaded anywhere.
          </div>
        </div>

        <div className="card">
          <h3><Ic src={IMGS.camera} alt="🎞️" size={18} /> Your timelapses</h3>
          <TimelapseGallery proofLog={state.proofLog} />
        </div>

        <div className="card danger-card">
          <h3><Ic src={IMGS.warning} alt="⚠️" size={18} /> Danger zone</h3>
          {!confirmDelete ? (
            <button className="btn ghost danger" onClick={() => setConfirmDelete(true)}>
              <Ic src={IMGS.trash} alt="🗑️" size={15} /> Delete account
            </button>
          ) : (
            <>
              <div className="sub" style={{ marginBottom: 4 }}>
                This wipes your goals, XP, streaks, pet, and every timelapse on this device. No undo.
              </div>
              <button className="btn danger" onClick={deleteAccount}>Yes, delete everything</button>
              <button className="btn ghost" onClick={() => setConfirmDelete(false)}>Keep my account</button>
            </>
          )}
        </div>

        <div className="card">
          <h3>About</h3>
          <div className="sub">APEX · prototype build</div>
          <div className="sub" style={{ marginTop: 4, color: 'var(--blue)', fontWeight: 800 }}>Your next opponent is you.</div>
        </div>

        <button className="btn ghost" onClick={onClose}>← Back</button>
      </div>
    </div>
  )
}

