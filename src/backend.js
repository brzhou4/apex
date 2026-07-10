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

const soft = (label) => (err) => {
  console.warn(`butterbase ${label}:`, err?.message || err)
  return null
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
  await bb.auth.signOut().catch(soft('signOut'))
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
  // Upsert by user_id: update first, insert when no row moved.
  const upd = await bb.from('profiles').update(row).eq('user_id', user.id).catch(soft('profile update'))
  if (!upd || !upd.data || upd.data.length === 0) {
    await bb.from('profiles').insert(row).catch(soft('profile insert'))
  }
  return row
}

// --- Shared feed ---

export async function fetchCloudPosts(limit = 30) {
  if (!bb) return []
  const { data, error } = await bb
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
    .catch(() => ({ data: null, error: 'network' }))
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
  const { data } = await bb
    .from('comments')
    .select('*')
    .in('post_id', cloudIds)
    .order('created_at', { ascending: true })
    .catch(() => ({ data: null }))
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
  const { data } = await bb.from('posts').insert({
    user_id: user.id,
    author_name: state.name || 'You',
    author_color: state.avatarColor || '',
    author_title: state.equippedTitle || '',
    text: post.text,
    thumbnail: post.thumbnail || null,
    likes: 0,
  }).catch(soft('post insert'))
  return data?.[0]?.id || null
}

export async function addCloudComment(state, cloudPostId, text) {
  const user = await cloudUser()
  if (!user) return
  await bb.from('comments').insert({
    post_id: cloudPostId,
    user_id: user.id,
    author_name: state.name || 'You',
    text,
  }).catch(soft('comment insert'))
}

export async function setCloudLike(cloudPostId, liked, newCount) {
  const user = await cloudUser()
  if (!user) return
  if (liked) {
    await bb.from('likes').insert({ post_id: cloudPostId, user_id: user.id }).catch(soft('like insert'))
  } else {
    await bb.from('likes').delete().eq('post_id', cloudPostId).eq('user_id', user.id).catch(soft('like delete'))
  }
  await bb.from('posts').update({ likes: Math.max(0, newCount) }).eq('id', cloudPostId).catch(soft('like count'))
}
