// Butterbase backend — cloud accounts, profiles, and a REAL shared feed.
//
// Offline-first: everything in APEX works from localStorage exactly as
// before. When VITE_BUTTERBASE_APP_ID is configured (see .env.example) the
// app additionally signs users in, syncs their profile, and reads/writes
// the social feed through Butterbase Postgres. Every cloud call is
// fire-and-forget with a local fallback — the UI never blocks on the network.
import { createClient } from '@butterbase/sdk'

const appId = import.meta.env.VITE_BUTTERBASE_APP_ID
const apiUrl = import.meta.env.VITE_BUTTERBASE_API_URL || 'https://api.butterbase.ai'
const anonKey = import.meta.env.VITE_BUTTERBASE_ANON_KEY

export const backendEnabled = !!appId

export const bb = backendEnabled
  ? createClient({ appId, apiUrl, ...(anonKey ? { anonKey } : {}) })
  : null

// The SDK's query builder is thenable but NOT a full Promise (no .catch),
// so every call goes through run(): await it, swallow + log failures.
async function run(query, label) {
  try {
    return await query
  } catch (err) {
    console.warn(`butterbase ${label}:`, err?.message || err)
    return { data: null, error: err }
  }
}

// Inserts return a single row object; selects return arrays. Normalize.
const firstRow = (res) => {
  const d = res?.data
  return Array.isArray(d) ? d[0] : d || null
}

// --- Auth ---

export async function cloudUser() {
  if (!bb) return null
  const { data } = await bb.auth.getUser().catch(() => ({ data: null }))
  return data?.user || data || null
}

export async function cloudSignUp(email, password) {
  if (!bb) return { error: 'backend disabled' }
  const { data, error } = await bb.auth.signUp({ email, password })
  return { data, error: error?.message || null }
}

export async function cloudSignIn(email, password) {
  if (!bb) return { error: 'backend disabled' }
  const { data, error } = await bb.auth.signIn({ email, password })
  return { data, error: error?.message || null }
}

export async function cloudSignOut() {
  if (!bb) return
  await run(bb.auth.signOut(), 'signOut')
}

export function onCloudAuthChange(cb) {
  if (!bb) return () => {}
  const { unsubscribe } = bb.onAuthStateChange(cb)
  return unsubscribe
}

// --- Profile sync ---

// Mirror the local profile into the cloud so other users' apps can render
// real profiles (name, bio, title, rank) for you.
export async function syncProfile(state) {
  const user = await cloudUser()
  if (!user) return null
  const row = {
    user_id: user.id,
    name: state.name || 'You',
    bio: state.bio || '',
    avatar_color: state.avatarColor || '',
    title: state.equippedTitle || '',
    streak: state.streak || 0,
    xp: state.xp || 0,
  }
  // Upsert by user_id. Updates/deletes only work through the primary key on
  // Butterbase, so: find the row id first, then update by id, else insert.
  const existing = await run(bb.from('profiles').select('id').eq('user_id', user.id).limit(1), 'profile lookup')
  const row0 = firstRow(existing)
  if (row0?.id) {
    await run(bb.from('profiles').update(row).eq('id', row0.id), 'profile update')
  } else {
    await run(bb.from('profiles').insert(row), 'profile insert')
  }
  return row
}

// --- Shared feed ---

export async function fetchCloudPosts(limit = 30) {
  if (!bb) return []
  const { data, error } = await run(bb
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit), 'posts fetch')
  if (error || !Array.isArray(data)) return []
  // Map DB rows onto the app's post shape.
  return data.map((r) => ({
    id: `cloud-${r.id}`,
    cloudId: r.id,
    userId: r.user_id,
    authorName: r.author_name || 'Grinder',
    authorColor: r.author_color || '',
    authorTitle: r.author_title || '',
    text: r.text || '',
    thumbnail: r.thumbnail || null,
    likes: r.likes || 0,
    likedByMe: false,
    comments: [],
    ts: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    cloud: true,
  }))
}

export async function fetchCloudComments(cloudIds) {
  if (!bb || cloudIds.length === 0) return {}
  const { data } = await run(bb
    .from('comments')
    .select('*')
    .in('post_id', cloudIds)
    .order('created_at', { ascending: true }), 'comments fetch')
  const byPost = {}
  ;(data || []).forEach((c) => {
    const list = byPost[c.post_id] || (byPost[c.post_id] = [])
    list.push({ id: `cc-${c.id}`, name: c.author_name || 'Grinder', text: c.text, ts: new Date(c.created_at).getTime() })
  })
  return byPost
}

export async function publishCloudPost(state, post) {
  const user = await cloudUser()
  if (!user) return null
  const res = await run(bb.from('posts').insert({
    user_id: user.id,
    author_name: state.name || 'You',
    author_color: state.avatarColor || '',
    author_title: state.equippedTitle || '',
    text: post.text,
    thumbnail: post.thumbnail || null,
    likes: 0,
  }), 'post insert')
  return firstRow(res)?.id || null
}

export async function addCloudComment(state, cloudPostId, text) {
  const user = await cloudUser()
  if (!user) return
  await run(bb.from('comments').insert({
    post_id: cloudPostId,
    user_id: user.id,
    author_name: state.name || 'You',
    text,
  }), 'comment insert')
}

// --- Predictions (the core protocol) ---
// The full lifecycle mirrors to Postgres so resolution/abandonment rates are
// measurable across users. Local state stays the source of truth; every call
// is fire-and-forget. Rows are keyed by local_id so a later status change can
// find its cloud row without the client storing cloud ids.

export async function syncPredictionCommit(row) {
  const user = await cloudUser()
  if (!user) return
  await run(bb.from('predictions').insert({
    local_id: row.id,
    user_id: user.id,
    task_title: row.taskTitle || '',
    pillar: row.pillar || 'OTHER',
    predicted_min: row.predictedMin,
    confidence: row.confidence ?? null,
    status: 'committed',
    camera_verified: false,
  }), 'prediction commit')
}

export async function syncPredictionOutcome(localId, { status, actualMin = null }) {
  const user = await cloudUser()
  if (!user) return
  const found = await run(bb.from('predictions').select('id').eq('local_id', localId).limit(1), 'prediction lookup')
  const row = firstRow(found)
  if (!row?.id) return
  await run(bb.from('predictions').update({
    status,
    actual_min: actualMin,
    camera_verified: status === 'resolved',
    resolved_at: new Date().toISOString(),
  }).eq('id', row.id), 'prediction outcome')
}

export async function setCloudLike(cloudPostId, liked, newCount) {
  const user = await cloudUser()
  if (!user) return
  if (liked) {
    await run(bb.from('likes').insert({ post_id: cloudPostId, user_id: user.id }), 'like insert')
  } else {
    // Deletes only work by primary key — look the like row up first.
    const found = await run(bb.from('likes').select('id').eq('post_id', cloudPostId).eq('user_id', user.id).limit(1), 'like lookup')
    const like = firstRow(found)
    if (like?.id) await run(bb.from('likes').delete().eq('id', like.id), 'like delete')
  }
  await run(bb.from('posts').update({ likes: Math.max(0, newCount) }).eq('id', cloudPostId), 'like count')
}
