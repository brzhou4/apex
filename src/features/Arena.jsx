import { useState } from 'react'
import {
  todayKey, rollFocusRival, focusDuelReward, IMGS, buildLeaderboard, leagueName,
  daysBetween, PARTY_EMBLEMS, SOCIAL_USERS, createSquad, squadTotalXp, userCheckedIn,
  membersAwaitingCheckin, partyRank, lockedBoard,
} from '../game.js'
import { Ic, Field } from '../ui.jsx'
import { FocusDuel } from '../Proof.jsx'
/* ---------------- Focus Duel ---------------- */

export function FocusDuelCard({ state, setState, flash }) {
  const [rival, setRival] = useState(null)
  const playedToday = state.focusDuel?.day === todayKey()
  const best = state.focusDuel?.bestMs || 0
  const fmt = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`

  function start() {
    if (playedToday) { flash('One duel per day — come back tomorrow'); return }
    setRival(rollFocusRival())
  }

  function finish(userMs, proof) {
    const reward = focusDuelReward(userMs, rival.enduranceMs)
    setState((s) => ({
      ...s,
      xp: s.xp + reward.xp,
      emeralds: (s.emeralds || 0) + reward.emeralds,
      focusDuel: { day: todayKey(), bestMs: Math.max(s.focusDuel?.bestMs || 0, userMs), lastResult: reward.won ? 'won' : 'lost' },
      proofLog: proof
        ? [...(s.proofLog || []), {
            id: proof.id, taskId: 'focus-duel', taskTitle: `Focus Duel vs ${rival.name}`,
            tierLabel: reward.won ? 'Won' : 'Lost', date: todayKey(), ts: Date.now(), thumbnail: proof.thumbnail, verified: true,
          }]
        : s.proofLog,
    }))
    flash(reward.won
      ? <><Ic src={IMGS.trophy} alt="" size={16} /> Outlasted {rival.name}! +{reward.xp} XP, +{reward.emeralds} <Ic src={IMGS.gem} alt="" size={13} /></>
      : `${rival.name} outlasted you — +${reward.xp} XP for the effort`)
    setRival(null)
  }

  return (
    <div className="card">
      <h3><Ic src={IMGS.brain} alt="🧠" size={20} /> Focus Duel</h3>
      <div className="sub">
        Camera on, phone down. Whoever stays focused longer wins bonus XP — your session saves as a timelapse.
        {best > 0 && <> Personal best: <b style={{ color: 'var(--text)' }}>{fmt(best)}</b>.</>}
      </div>
      <button className="btn" onClick={start} disabled={playedToday} style={{ marginTop: 12 }}>
        {playedToday ? `Played today (${state.focusDuel?.lastResult}) — back tomorrow` : 'Play competitively'}
      </button>
      {rival && (
        <FocusDuel
          rival={rival}
          onFinish={finish}
          onError={() => { flash('Camera unavailable — no duel without proof'); setRival(null) }}
        />
      )}
    </div>
  )
}

/* ---------------- Leaderboard ---------------- */

// Collapsed: top 5, a tappable ···, and YOUR row with your real placement.
// Tap the ··· and it expands into pages of 8 with ‹ › controls. The league
// carries the name of the rank you've actually earned.
export function Leaderboard({ state, xp }) {
  const rows = buildLeaderboard(state.name, xp)
  const userIdx = rows.findIndex((r) => r.isUser)
  const [expanded, setExpanded] = useState(false)
  const PAGE = 8
  const pages = Math.ceil(rows.length / PAGE)
  const [page, setPage] = useState(0)

  const Row = ({ row, i }) => (
    <div className={`lb-row ${row.isUser ? 'me' : ''}`}>
      <span className="lb-rank">{i + 1}</span>
      <span>{row.name}{row.isUser && row.name !== 'You' ? ' (you)' : ''}</span>
      <span className="lb-xp">{row.xp} XP</span>
    </div>
  )

  return (
    <div className="card">
      <h3><Ic src={IMGS.trophy} alt="🏆" size={18} /> {leagueName(state)} · resets in 4 days</h3>
      <div className="sub" style={{ marginBottom: 8 }}>Top 20% advance · bottom 10% demote · {rows.length} grinders in your league</div>

      {!expanded ? (
        <>
          {rows.slice(0, 5).map((row, i) => <Row row={row} i={i} key={row.name + i} />)}
          {userIdx >= 5
            ? (
              <>
                <div className="lb-gap lb-gap-btn" onClick={() => { setPage(Math.floor(userIdx / PAGE)); setExpanded(true) }} title="Show the full league">···</div>
                <Row row={rows[userIdx]} i={userIdx} />
              </>
            )
            : <div className="lb-gap lb-gap-btn" onClick={() => setExpanded(true)} title="Show the full league">···</div>}
        </>
      ) : (
        <>
          {rows.slice(page * PAGE, page * PAGE + PAGE).map((row, i) => <Row row={row} i={page * PAGE + i} key={row.name + i} />)}
          <div className="lb-pager">
            <button className="lb-pg-btn" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>‹</button>
            <span className="lb-pg-label">{page + 1} / {pages}</span>
            <button className="lb-pg-btn" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>›</button>
            <span className="link" style={{ marginLeft: 'auto' }} onClick={() => { setExpanded(false); setPage(0) }}>collapse</span>
          </div>
        </>
      )}
    </div>
  )
}

/* ---------------- Squad ---------------- */

export function RivalDuel({ duel }) {
  if (!duel) return null
  const total = duel.userScore + duel.oppScore
  const pct = total === 0 ? 50 : Math.round((duel.userScore / total) * 100)
  const daysLeft = Math.max(0, daysBetween(todayKey(), duel.endDate))
  const ahead = duel.userScore >= duel.oppScore
  const banner = {
    won: <><Ic src={IMGS.trophy} alt="" size={15} /> You won the duel! Claim it tomorrow.</>,
    lost: <><Ic src={IMGS.skull} alt="" size={15} /> You lost this duel. Run it back.</>,
    tied: 'Duel tied — rematch?',
  }[duel.status]
  return (
    <div className="card">
      <h3><Ic src={IMGS.swords} alt="⚔️" size={20} /> Rival Duel · vs {duel.opponent}</h3>
      <div className="sub" style={{ marginBottom: 8 }}>
        {duel.status === 'active' ? `Most ${duel.metric} in 7 days · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : banner}
      </div>
      <div className="score-row">
        <span style={{ color: ahead ? 'var(--body)' : 'var(--muted)' }}>You {duel.userScore}</span>
        <span style={{ color: !ahead ? 'var(--flame)' : 'var(--muted)' }}>{duel.opponent} {duel.oppScore}</span>
      </div>
      <div className="bar" style={{ marginTop: 6 }}>
        <i style={{ width: `${pct}%`, background: ahead ? 'var(--body)' : 'var(--flame)' }} />
      </div>
      {duel.status === 'active' && (
        <div className="sub" style={{ marginTop: 8 }}>
          {ahead ? 'You’re ahead — complete tasks to extend your lead.' : 'You’re behind — every completed task scores a point.'}
        </div>
      )}
    </div>
  )
}

// First-time party experience: you're not in a squad until you make one.
// Create it, then invite the people you follow.
// Shared party identity form — used when creating a squad and when editing it.
function PartyIdentityFields({ name, setName, bio, setBio, emblem, setEmblem }) {
  return (
    <>
      <Field label="Squad name">
        <input value={name} maxLength={24} placeholder="e.g. Dawn Raiders" onChange={(e) => setName(e.target.value)} style={{ marginTop: 4 }} />
      </Field>
      <div style={{ marginTop: 8 }}>
        <Field label="Party bio">
          <input value={bio} maxLength={70} placeholder="What is this crew about?" onChange={(e) => setBio(e.target.value)} />
        </Field>
      </div>
      <div className="field-label" style={{ marginTop: 12 }}>Emblem</div>
      <div className="emblem-row">
        {PARTY_EMBLEMS.map((e) => (
          <button
            key={e.id}
            className={`emblem-opt ${emblem === e.id ? 'on' : ''}`}
            onClick={() => setEmblem(e.id)}
            title={e.icon}
          >
            <Ic src={e.img} alt={e.icon} size={24} />
          </button>
        ))}
      </div>
    </>
  )
}

function CreateSquad({ state, setState, flash }) {
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [emblem, setEmblem] = useState('em-party')
  const [invited, setInvited] = useState([])
  const followedUsers = SOCIAL_USERS.filter((u) => (state.social?.following || []).includes(u.id))

  function toggleInvite(id) {
    setInvited((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))
  }

  function create() {
    const invitees = SOCIAL_USERS.filter((u) => invited.includes(u.id))
    setState((s) => ({ ...s, squad: createSquad(name.trim() || 'My Squad', s.name, invitees, bio.trim(), emblem) }))
    flash(<><Ic src={IMGS.party} alt="" size={15} /> Squad created{invitees.length ? ` — ${invitees.length} invited` : ''}!</>)
  }

  return (
    <>
      <div className="card">
        <h3><Ic src={IMGS.party} alt="🎉" size={20} /> You’re not in a squad yet</h3>
        <div className="sub">
          A squad is your accountability crew — daily check-ins, a locked-in leaderboard, and people who notice when you slack.
        </div>
        <PartyIdentityFields name={name} setName={setName} bio={bio} setBio={setBio} emblem={emblem} setEmblem={setEmblem} />

        <div className="field-label" style={{ marginTop: 14 }}>Invite people you follow</div>
        {followedUsers.length === 0 ? (
          <div className="sub" style={{ marginTop: 6 }}>
            You’re not following anyone yet — find people in the <b style={{ color: 'var(--text)' }}>Feed</b> tab and follow them, then invite them here. You can also start solo.
          </div>
        ) : (
          followedUsers.map((u) => {
            const on = invited.includes(u.id)
            return (
              <div className="lb-row" key={u.id}>
                <img className="member-photo" src={u.photo} alt="" />
                <span>{u.name}</span>
                <button className={`follow-btn ${on ? 'on' : ''}`} style={{ marginLeft: 'auto' }} onClick={() => toggleInvite(u.id)}>
                  {on ? '✓ Invited' : 'Invite'}
                </button>
              </div>
            )
          })
        )}

        <button className="btn" onClick={create} style={{ marginTop: 14 }}>
          Create squad{invited.length > 0 ? ` with ${invited.length} ${invited.length === 1 ? 'friend' : 'friends'}` : ''}
        </button>
      </div>
    </>
  )
}

export function Squad({ state, setState, flash }) {
  const squad = state.squad
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(squad?.name || '')
  const [bio, setBio] = useState(squad?.bio || '')
  const [emblem, setEmblem] = useState(squad?.emblem || 'em-party')
  if (!squad) return <CreateSquad state={state} setState={setState} flash={flash} />

  const ours = squadTotalXp(squad, state.xp)
  const checkedIn = userCheckedIn(squad)
  const waiting = membersAwaitingCheckin(squad).filter((m) => !m.isUser)
  const pRank = partyRank(ours)
  const emblemItem = PARTY_EMBLEMS.find((e) => e.id === squad.emblem) || PARTY_EMBLEMS[0]

  function saveParty() {
    setState((s) => ({ ...s, squad: { ...s.squad, name: name.trim() || s.squad.name, bio: bio.trim(), emblem } }))
    setEditing(false)
    flash('Party profile saved')
  }

  function checkIn() {
    if (checkedIn) return
    setState((s) => ({
      ...s,
      emeralds: (s.emeralds || 0) + 3,
      squad: {
        ...s.squad,
        members: s.squad.members.map((m) => (m.isUser ? { ...m, checkedInOn: todayKey() } : m)),
      },
    }))
    flash(<>Checked in! +3 <Ic src={IMGS.gem} alt="" size={14} /></>)
  }

  function nudge(name) {
    if (squad.nudged.includes(name)) return
    setState((s) => ({ ...s, squad: { ...s.squad, nudged: [...s.squad.nudged, name] } }))
    flash(`Nudged ${name}`)
  }

  return (
    <>
      <div className="card">
        <div className="hud">
          <div className="avatar" style={{ background: 'var(--panel-2)' }}><Ic src={emblemItem.img} alt={emblemItem.icon} size={28} /></div>
          <div className="grow">
            <div className="lvl">{squad.name}</div>
            <div className="rank">{squad.members.length} in the party · {ours.toLocaleString()} party XP this week</div>
          </div>
          <span className="pill" style={{ color: pRank.color }} title={`${ours.toLocaleString()} weekly XP`}>
            <Ic src={pRank.img} alt="" size={15} /> {pRank.label}
          </span>
        </div>
        {squad.bio && <div className="sub" style={{ marginTop: 8 }}>“{squad.bio}”</div>}

        {editing ? (
          <div style={{ marginTop: 12 }}>
            <PartyIdentityFields name={name} setName={setName} bio={bio} setBio={setBio} emblem={emblem} setEmblem={setEmblem} />
            <button className="btn" onClick={saveParty} style={{ marginTop: 12 }}>Save party</button>
            <button className="btn ghost" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        ) : (
          <>
            {!checkedIn && (
              <div className="sub" style={{ marginTop: 10, color: 'var(--flame)' }}>
                <Ic src={IMGS.warning} alt="⚠️" size={14} /> You haven’t checked in today. Your party is counting on you.
              </div>
            )}
            <button className="btn" disabled={checkedIn} onClick={checkIn} style={{ marginTop: 12 }}>
              {checkedIn ? <>✓ Checked in for today</> : <>I’m in for today (+3 <Ic src={IMGS.gem} alt="" size={13} />)</>}
            </button>
            <button
              className="btn ghost"
              onClick={() => { setName(squad.name); setBio(squad.bio || ''); setEmblem(squad.emblem || 'em-party'); setEditing(true) }}
            >
              <Ic src={IMGS.pencil} alt="✏️" size={14} /> Customize party
            </button>
          </>
        )}
      </div>

      <div className="card">
        <h3><Ic src={IMGS.lock} alt="🔒" size={18} /> Most Locked This Week</h3>
        <div className="sub" style={{ marginBottom: 8 }}>Ranked by focused minutes actually recorded on camera. No proof, no minutes.</div>
        {lockedBoard(squad, state).map((m, i) => (
          <div className={`lb-row ${m.isUser ? 'me' : ''}`} key={m.name}>
            <span className="lb-rank">{i === 0 ? <Ic src={IMGS.crown} alt="👑" size={16} /> : i + 1}</span>
            {m.photo
              ? <img className="member-photo" src={m.photo} alt="" />
              : <span className="member-photo member-photo-you">{(m.name || 'Y')[0]}</span>}
            <span>{m.name}{m.isUser && m.name !== 'You' ? ' (you)' : ''}</span>
            <span className="lb-xp">{m.locked} min locked</span>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Daily Check-In</h3>
        {squad.members.map((m) => {
          const inToday = m.checkedInOn === todayKey()
          const xp = m.isUser ? state.xp : m.weeklyXp
          return (
            <div className={`lb-row ${m.isUser ? 'me' : ''}`} key={m.name}>
              <span className="lb-rank">{inToday ? <Ic src={IMGS.check} alt="✅" size={16} /> : <Ic src={IMGS.hourglass} alt="⏳" size={16} />}</span>
              {m.photo && <img className="member-photo" src={m.photo} alt="" />}
              <span>{m.name}{m.isUser && m.name !== 'You' ? ' (you)' : ''}</span>
              {!inToday && !m.isUser && (
                <span className="link" style={{ marginLeft: 'auto' }} onClick={() => nudge(m.name)}>
                  {squad.nudged.includes(m.name) ? 'nudged' : 'nudge'}
                </span>
              )}
              <span className="lb-xp" style={{ marginLeft: !inToday && !m.isUser ? 12 : 'auto' }}>{xp.toLocaleString()} XP</span>
            </div>
          )
        })}
        {waiting.length > 0 && (
          <div className="sub" style={{ marginTop: 10 }}>
            {waiting.length} teammate{waiting.length > 1 ? 's' : ''} {waiting.length > 1 ? 'haven’t' : 'hasn’t'} checked in. A nudge helps.
          </div>
        )}
      </div>

      {/* Grow the party — anyone you follow can be pulled in right here. */}
      <div className="card">
        <h3><Ic src={IMGS.wave} alt="👋" size={18} /> Add to your party</h3>
        {(() => {
          const inParty = new Set(squad.members.map((m) => m.userId))
          const candidates = SOCIAL_USERS.filter((u) => (state.social?.following || []).includes(u.id) && !inParty.has(u.id))
          if (candidates.length === 0) {
            return (
              <div className="sub">
                Everyone you follow is already in — follow more grinders in the <b style={{ color: 'var(--text)' }}>Feed</b> to invite them.
              </div>
            )
          }
          return candidates.map((u) => (
            <div className="lb-row" key={u.id}>
              <img className="member-photo" src={u.photo} alt="" />
              <span>{u.name}</span>
              <button
                className="follow-btn"
                style={{ marginLeft: 'auto' }}
                onClick={() => {
                  setState((s) => ({
                    ...s,
                    squad: {
                      ...s.squad,
                      members: [...s.squad.members, {
                        name: u.name, userId: u.id, photo: u.photo,
                        weeklyXp: u.weeklyXp, lockedMins: u.lockedMins, checkedInOn: null,
                      }],
                    },
                  }))
                  flash(<><Ic src={IMGS.party} alt="" size={14} /> {u.name} joined the party!</>)
                }}
              >
                + Invite
              </button>
            </div>
          ))
        })()}
      </div>
    </>
  )
}

