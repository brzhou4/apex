import { useState, useEffect, useRef } from 'react'
import {
  TIER_META, TIER_TITLES, TIER_TITLE_IDS, rankForLevel, SOCIAL_USERS, SHOP_ITEMS, IMGS,
} from '../game.js'
import { Ic, ScoreBar, Stat, titleChipStyle, titleChipStyleByLabel } from '../ui.jsx'
import { loadTimelapse } from '../proof.js'
import {
  backendEnabled, fetchCloudPosts, fetchCloudComments, publishCloudPost, setCloudLike, addCloudComment,
} from '../backend.js'
/* ---------------- Feed — the wall ---------------- */

function timeAgo(ts) {
  const mins = Math.max(1, Math.round((Date.now() - ts) / 60000))
  if (mins < 60) return `${mins}m`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.round(hrs / 24)}d`
}

// Tap any user and get a REAL profile — banner, Human Score with pillar
// bars, rank, streaks — the same anatomy as your own profile page, plus
// Instagram-style follower counts and a Follow button.
function UserProfilePage({ user, state, setState, flash, onClose }) {
  const following = (state.social?.following || []).includes(user.id)
  const inParty = (state.squad?.members || []).some((m) => m.userId === user.id)
  const score = user.score || { mind: 500, body: 500, intellect: 500 }
  const total = Math.round((score.mind + score.body + score.intellect) / 3)
  const rankMeta = TIER_META[user.rankTier] || null
  const postCount = (state.social?.posts || []).filter((p) => p.userId === user.id).length || 1

  function toggleFollow() {
    setState((s) => ({
      ...s,
      social: {
        ...s.social,
        following: following
          ? s.social.following.filter((id) => id !== user.id)
          : [...(s.social.following || []), user.id],
      },
    }))
    flash(following ? `Unfollowed ${user.name}` : `Following ${user.name}!`)
  }

  function invite() {
    if (inParty) return
    if (!state.squad) { flash('Create a squad in the Party tab first, then invite people'); return }
    setState((s) => ({
      ...s,
      squad: {
        ...s.squad,
        members: [...s.squad.members, {
          name: user.name, userId: user.id, photo: user.photo,
          weeklyXp: user.weeklyXp, lockedMins: user.lockedMins, checkedInOn: null,
        }],
      },
    }))
    flash(<><Ic src={IMGS.party} alt="" size={15} /> {user.name} joined your party!</>)
  }

  return (
    <div className="profile-page">
      <div className="profile-page-inner">
        <div className="pp-top">
          <button className="pp-back" onClick={onClose}>←</button>
          <span className="pp-handle">@{user.name}</span>
        </div>

        {/* Identity on their banner, IG-style counts row, follow/invite */}
        <div className="card banner-card" style={{ background: user.banner || 'linear-gradient(135deg,#0b1220,#12203a)' }}>
          <img className="profile-photo-lg" src={user.photo} alt="" />
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{user.name}</div>
            {user.title && <div style={{ marginTop: 4 }}><span className="profile-title" style={titleChipStyleByLabel(user.title)}>{user.title}</span></div>}
            <div className="sub" style={{ marginTop: 6 }}>{user.bio}</div>
          </div>
          <div className="pp-counts">
            <div><b>{postCount}</b><span>posts</span></div>
            <div><b>{(user.followers || 0) + (following ? 1 : 0)}</b><span>followers</span></div>
            <div><b>{user.followingCount || 0}</b><span>following</span></div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button className={`btn ${following ? 'ghost' : ''}`} style={{ flex: 1, marginTop: 0 }} onClick={toggleFollow}>
              {following ? '✓ Following' : 'Follow'}
            </button>
            <button className="btn ghost" style={{ flex: 1, marginTop: 0 }} disabled={inParty} onClick={invite}>
              {inParty ? '✓ In party' : '+ Party'}
            </button>
          </div>
        </div>

        {/* Their baseline — full Human Score, same as your profile */}
        <div className="card">
          <h3>Human Score</h3>
          <div className="score-big">{total}</div>
          <div className="sub" style={{ textAlign: 'center' }}>{user.name}’s current Human Score</div>
          <ScoreBar label={<><Ic src={IMGS.brain} alt="🧠" size={15} /> Mind</>} value={score.mind} color="var(--mind)" />
          <ScoreBar label={<><Ic src={IMGS.biceps} alt="💪" size={15} /> Body</>} value={score.body} color="var(--body)" />
          <ScoreBar label={<><Ic src={IMGS.books} alt="📚" size={15} /> Intellect</>} value={score.intellect} color="var(--intellect)" />
        </div>

        {/* Their rank + streaks, same anatomy as yours — shown as the title
            their tier earns (Truecel → APEX), not the tier's fancy name. */}
        <div className="card">
          <h3>Rank & Streaks</h3>
          {rankMeta && (
            <>
              <div className="score-big" style={{ fontSize: 26, color: rankMeta.color }}>
                <Ic src={rankMeta.img} alt={rankMeta.icon} size={24} /> {TIER_TITLES[user.rankTier]}
              </div>
              <div className="sub" style={{ textAlign: 'center' }}>{user.rankTier} tier</div>
            </>
          )}
          <div className="stat-grid" style={{ marginTop: 10 }}>
            <Stat value={<><Ic src={IMGS.fire} alt="🔥" size={16} /> {user.streak || 0}</>} label="current streak" />
            <Stat value={<><Ic src={IMGS.medal} alt="🏅" size={16} /> {user.longestStreak || 0}</>} label="longest streak" />
            <Stat value={`Lv ${user.level}`} label={rankForLevel(user.level)} />
            <Stat value={user.weeklyXp.toLocaleString()} label="weekly XP" />
          </div>
          <div className="sub" style={{ marginTop: 10 }}>
            <Ic src={IMGS.lock} alt="🔒" size={13} /> {user.lockedMins} focused minutes recorded on camera this week.
          </div>
        </div>

        <button className="btn ghost" onClick={onClose}>← Back to feed</button>
      </div>
    </div>
  )
}

// Timelapse attached to a post — loads the clip from IndexedDB and
// autoplays it inline (muted + looped), Instagram-style. Falls back to the
// thumbnail while loading or if the clip isn't on this device.
function InlineTimelapse({ proofId, thumbnail }) {
  const [url, setUrl] = useState(null)
  const [broken, setBroken] = useState(false)
  useEffect(() => {
    let objUrl
    loadTimelapse(proofId).then((blob) => {
      if (!blob) return
      objUrl = URL.createObjectURL(blob)
      setUrl(objUrl)
    })
    return () => { if (objUrl) URL.revokeObjectURL(objUrl) }
  }, [proofId])

  // No clip on this device, still loading, or the browser can't decode the
  // codec it was recorded with — fall back to the thumbnail still.
  if (!url || broken) {
    return thumbnail ? (
      <div className="fp-media feed-timelapse">
        <img src={thumbnail} alt="" />
        <span className="feed-play">{broken ? '🎞 timelapse (preview)' : '▶ timelapse'}</span>
      </div>
    ) : null
  }
  return (
    <div className="fp-media feed-timelapse">
      <video src={url} autoPlay muted loop playsInline onError={() => setBroken(true)} />
      <span className="feed-play">● timelapse</span>
    </div>
  )
}

// Instagram-style feed: create posts, search people, follow them, autoplay
// timelapses, and like / comment / share on every post.
// End-of-feed discovery — no story circles. Once you scroll past the last
// post it animates in: real profiles with names and their earned rank title.
function SuggestedFollows({ state, following, toggleFollow, onView }) {
  const ref = useRef(null)
  const [revealed, setRevealed] = useState(false)

  // Reveal once the card scrolls into view (plain rect check — reliable
  // everywhere, no IntersectionObserver dependence).
  useEffect(() => {
    const check = () => {
      const el = ref.current
      if (!el) return
      if (el.getBoundingClientRect().top < window.innerHeight - 60) {
        setRevealed(true)
        window.removeEventListener('scroll', check)
      }
    }
    check()
    window.addEventListener('scroll', check, { passive: true })
    return () => window.removeEventListener('scroll', check)
  }, [])

  const candidates = SOCIAL_USERS.filter((u) => !following.includes(u.id)).slice(0, 5)
  if (candidates.length === 0) return null

  return (
    <div ref={ref} className={`card suggest-card ${revealed ? 'revealed' : ''}`}>
      <div className="suggest-head">
        <Ic src={IMGS.bolt} alt="⚡" size={22} />
        <div>
          <div className="suggest-title">You’re all caught up</div>
          <div className="sub">Grinders on the same path — run it together.</div>
        </div>
      </div>
      {candidates.map((u, i) => {
        const titleId = TIER_TITLE_IDS[u.rankTier]
        return (
          <div className="lb-row suggest-row" style={{ transitionDelay: `${120 + i * 110}ms` }} key={u.id}>
            <img className="member-photo suggest-photo" src={u.photo} alt="" onClick={() => onView(u)} />
            <div className="grow" style={{ cursor: 'pointer' }} onClick={() => onView(u)}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{u.name}</div>
              <span className="profile-title" style={{ fontSize: 9, padding: '1px 6px', ...titleChipStyle(titleId) }}>
                {TIER_TITLES[u.rankTier]}
              </span>
            </div>
            <button className="follow-btn" onClick={() => toggleFollow(u)}>Follow</button>
          </div>
        )
      })}
    </div>
  )
}

export function Feed({ state, setState, flash, openMyProfile }) {
  const [draft, setDraft] = useState('')
  const [composing, setComposing] = useState(false)
  const [attachId, setAttachId] = useState(null) // which timelapse to attach
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef(null)
  const [viewing, setViewing] = useState(null) // full user profile page
  const [openComments, setOpenComments] = useState({}) // postId -> bool
  const [commentDrafts, setCommentDrafts] = useState({}) // postId -> text

  function toggleSearch() {
    setSearchOpen((o) => {
      if (o) setQuery('')
      else setTimeout(() => searchRef.current?.focus(), 60)
      return !o
    })
  }
  const social = state.social || { following: [], posts: [] }
  const following = social.following || []

  // Real posts from other Butterbase users, merged into the feed.
  const [cloudPosts, setCloudPosts] = useState([])
  useEffect(() => {
    if (!backendEnabled) return
    let dead = false
    fetchCloudPosts().then(async (ps) => {
      if (dead || ps.length === 0) return
      const commentsByPost = await fetchCloudComments(ps.map((p) => p.cloudId))
      if (!dead) setCloudPosts(ps.map((p) => ({ ...p, comments: commentsByPost[p.cloudId] || [] })))
    })
    return () => { dead = true }
  }, [])

  const me = {
    id: 'me',
    name: state.name || 'You',
    photo: state.avatarImage,
    color: state.avatarColor,
    title: SHOP_ITEMS.find((i) => i.id === state.equippedTitle)?.label || null,
  }
  const authorOf = (post) => {
    if (post.cloud) {
      return {
        id: post.userId,
        name: post.authorName,
        color: post.authorColor || 'var(--blue)',
        title: SHOP_ITEMS.find((i) => i.id === post.authorTitle)?.label || null,
        photo: null,
        cloudAuthor: true,
      }
    }
    return post.userId === 'me' ? me : SOCIAL_USERS.find((u) => u.id === post.userId)
  }

  function toggleFollow(user) {
    const isFollowing = following.includes(user.id)
    setState((s) => ({
      ...s,
      social: {
        ...s.social,
        following: isFollowing
          ? (s.social.following || []).filter((id) => id !== user.id)
          : [...(s.social.following || []), user.id],
      },
    }))
    flash(isFollowing ? `Unfollowed ${user.name}` : `Following ${user.name}!`)
  }

  function publish() {
    const text = draft.trim()
    const attached = (state.proofLog || []).find((p) => p.id === attachId) || null
    if (!text && !attached) { flash('Say something or attach a timelapse'); return }
    const post = {
      id: `p-${Date.now()}`,
      userId: 'me',
      text: text || `Locked in: ${attached.taskTitle} — ${attached.tierLabel}.`,
      proofId: attached ? attached.id : null,
      thumbnail: attached ? attached.thumbnail : null,
      likes: 0, likedByMe: false, comments: [], ts: Date.now(),
    }
    setState((s) => ({ ...s, social: { ...s.social, posts: [post, ...(s.social?.posts || [])] } }))
    setDraft(''); setAttachId(null); setComposing(false)
    // Write-through to the shared cloud feed (no-op unless signed in).
    if (backendEnabled) publishCloudPost(state, post).catch(() => {})
    flash(<>Posted <Ic src={IMGS.party} alt="" size={14} /></>)
  }

  function toggleLike(id) {
    const cp = cloudPosts.find((p) => p.id === id)
    if (cp) {
      const liked = !cp.likedByMe
      const likes = cp.likes + (liked ? 1 : -1)
      setCloudPosts((ps) => ps.map((p) => (p.id === id ? { ...p, likedByMe: liked, likes } : p)))
      setCloudLike(cp.cloudId, liked, likes)
      return
    }
    setState((s) => ({
      ...s,
      social: {
        ...s.social,
        posts: s.social.posts.map((p) =>
          p.id === id ? { ...p, likedByMe: !p.likedByMe, likes: p.likes + (p.likedByMe ? -1 : 1) } : p),
      },
    }))
  }

  function addComment(id) {
    const text = (commentDrafts[id] || '').trim()
    if (!text) return
    const comment = { id: `c-${Date.now()}`, name: state.name || 'You', text, ts: Date.now() }
    const cp = cloudPosts.find((p) => p.id === id)
    if (cp) {
      setCloudPosts((ps) => ps.map((p) => (p.id === id ? { ...p, comments: [...p.comments, comment] } : p)))
      addCloudComment(state, cp.cloudId, text)
    } else {
      setState((s) => ({
        ...s,
        social: {
          ...s.social,
          posts: s.social.posts.map((p) =>
            p.id === id ? { ...p, comments: [...(p.comments || []), comment] } : p),
        },
      }))
    }
    setCommentDrafts((d) => ({ ...d, [id]: '' }))
    setOpenComments((o) => ({ ...o, [id]: true }))
  }

  async function share(post) {
    const author = authorOf(post)
    const text = `${author?.name || 'Someone'} on APEX: "${post.text}"`
    try {
      if (navigator.share) await navigator.share({ text })
      else { await navigator.clipboard.writeText(text); flash('Copied — paste it anywhere') }
    } catch { /* user cancelled the share sheet */ }
  }

  const posts = [...cloudPosts, ...(social.posts || [])].sort((a, b) => b.ts - a.ts)
  const q = query.trim().toLowerCase()
  const results = q
    ? SOCIAL_USERS.filter((u) => u.name.toLowerCase().includes(q) || (u.bio || '').toLowerCase().includes(q))
    : null

  return (
    <>
      {/* Title row + search that expands + compose */}
      <div className="page-head feed-head">
        {!searchOpen && (
          <div>
            <div className="eyebrow" style={{ color: 'var(--blue)' }}>The wall</div>
            <h2 className="page-title">Feed</h2>
          </div>
        )}
        <div className="feed-head-actions">
          <div className={`search-pill ${searchOpen ? 'open' : ''}`}>
            <input
              ref={searchRef}
              className="search-input"
              placeholder="Search friends and grinders…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && toggleSearch()}
            />
            <button className="search-toggle" title={searchOpen ? 'Close search' : 'Search people'} onClick={toggleSearch}>
              {searchOpen ? '✕' : <Ic src={IMGS.search} alt="Search" size={18} />}
            </button>
          </div>
          {!searchOpen && (
            <button className="feed-compose-btn" title="New post" onClick={() => setComposing(true)}>
              <Ic src={IMGS.pencil} alt="New post" size={18} />
            </button>
          )}
        </div>
      </div>

      {results && (
        <div className="card">
          {results.length === 0
            ? <div className="sub">No one found for “{query}”.</div>
            : results.map((u) => (
                <div className="lb-row" key={u.id}>
                  <img className="member-photo" src={u.photo} alt="" style={{ cursor: 'pointer' }} onClick={() => setViewing(u)} />
                  <div className="grow" style={{ cursor: 'pointer' }} onClick={() => setViewing(u)}>
                    <div style={{ fontSize: 14 }}>{u.name}</div>
                    <div className="feed-time">{u.bio}</div>
                  </div>
                  <button className={`follow-btn ${following.includes(u.id) ? 'on' : ''}`} onClick={() => toggleFollow(u)}>
                    {following.includes(u.id) ? 'Following' : 'Follow'}
                  </button>
                </div>
              ))}
        </div>
      )}

      {posts.map((p) => {
        const author = authorOf(p)
        if (!author) return null
        const isMe = p.userId === 'me'
        const comments = p.comments || []
        const showComments = !!openComments[p.id]
        return (
          <div className="card feed-post boxed" key={p.id}>
            <div className="fp-pad feed-author">
              <span onClick={() => (isMe ? openMyProfile() : author.cloudAuthor ? null : setViewing(author))} style={{ cursor: author.cloudAuthor && !isMe ? 'default' : 'pointer', display: 'inline-flex' }}>
                {author.photo
                  ? <img className="member-photo" src={author.photo} alt="" />
                  : <span className="member-photo member-photo-you" style={{ background: author.color || 'var(--blue)' }}>{author.name[0]}</span>}
              </span>
              <div className="grow" onClick={() => (isMe ? openMyProfile() : author.cloudAuthor ? null : setViewing(author))} style={{ cursor: author.cloudAuthor && !isMe ? 'default' : 'pointer' }}>
                <div className="feed-name">
                  {author.name}
                  {author.title && <span className="profile-title" style={{ fontSize: 9, padding: '1px 6px', ...titleChipStyleByLabel(author.title) }}>{author.title}</span>}
                  {p.cloud && <Ic src={IMGS.globe} alt="live" size={12} />}
                </div>
                <div className="feed-time">{timeAgo(p.ts)} ago</div>
              </div>
              {!isMe && !author.cloudAuthor && !following.includes(author.id) && (
                <button className="follow-btn" onClick={() => toggleFollow(author)}>Follow</button>
              )}
            </div>
            <div className="fp-pad feed-text">{p.text}</div>
            {p.image && <img className="fp-media" src={p.image} alt="" loading="lazy" />}
            {p.proofId && <InlineTimelapse proofId={p.proofId} thumbnail={p.thumbnail} />}

            <div className="fp-pad feed-actions">
              <button className={`fa-btn ${p.likedByMe ? 'liked' : ''}`} onClick={() => toggleLike(p.id)} title="Like">
                <Ic src={IMGS.heart} alt="❤️" size={20} />
              </button>
              <button className="fa-btn" onClick={() => setOpenComments((o) => ({ ...o, [p.id]: !o[p.id] }))} title="Comment">
                <Ic src={IMGS.comment} alt="💬" size={20} />
              </button>
              <button className="fa-btn" onClick={() => share(p)} title="Share">
                <Ic src={IMGS.share} alt="📤" size={20} />
              </button>
            </div>
            <div className="fp-pad feed-likes">{p.likes.toLocaleString()} like{p.likes === 1 ? '' : 's'}</div>

            {comments.length > 0 && !showComments && (
              <div className="fp-pad feed-view-comments" onClick={() => setOpenComments((o) => ({ ...o, [p.id]: true }))}>
                View {comments.length === 1 ? '1 comment' : `all ${comments.length} comments`}
              </div>
            )}
            {showComments && comments.map((c) => (
              <div className="fp-pad feed-comment" key={c.id}>
                <b>{c.name}</b> {c.text}
              </div>
            ))}
            <div className="fp-pad feed-add-comment">
              <input
                placeholder="Add a comment…"
                value={commentDrafts[p.id] || ''}
                onChange={(e) => setCommentDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && addComment(p.id)}
              />
              {(commentDrafts[p.id] || '').trim() && (
                <span className="link" onClick={() => addComment(p.id)}>Post</span>
              )}
            </div>
          </div>
        )
      })}

      {/* After the last post: animated follow suggestions */}
      <SuggestedFollows state={state} following={following} toggleFollow={toggleFollow} onView={setViewing} />

      {composing && (
        <div className="modal-backdrop" onClick={() => setComposing(false)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <h3><Ic src={IMGS.pencil} alt="✏️" size={18} /> New post</h3>
            <input
              placeholder="What did you lock in today?"
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && publish()}
            />
            {(state.proofLog || []).length > 0 && (
              <>
                <div className="field-label" style={{ marginTop: 12 }}>Attach a timelapse</div>
                <div className="proof-pick-row">
                  <div className={`proof-pick proof-pick-none ${!attachId ? 'on' : ''}`} onClick={() => setAttachId(null)}>
                    <span>None</span>
                  </div>
                  {[...state.proofLog].reverse().map((p) => (
                    <div key={p.id} className={`proof-pick ${attachId === p.id ? 'on' : ''}`} onClick={() => setAttachId(p.id)} title={`${p.taskTitle} · ${p.tierLabel}`}>
                      {p.thumbnail
                        ? <img src={p.thumbnail} alt="" />
                        : <span className="proof-pick-blank"><Ic src={IMGS.camera} alt="🎞️" size={18} /></span>}
                      <span className="proof-pick-label">{p.taskTitle}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" style={{ flex: 1 }} onClick={publish}>Post</button>
              <button className="btn ghost" style={{ flex: 0.7 }} onClick={() => { setComposing(false); setDraft(''); setAttachId(null) }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {viewing && <UserProfilePage user={viewing} state={state} setState={setState} flash={flash} onClose={() => setViewing(null)} />}
    </>
  )
}
