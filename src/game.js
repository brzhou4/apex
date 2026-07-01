// APEX core game logic — pure functions + persistence.
// Kept framework-agnostic so it could be lifted into a real backend later.

const STORAGE_KEY = 'apex.state.v2'

export const PILLARS = {
  MIND: { key: 'MIND', label: 'Mind', icon: '🧠', color: 'var(--mind)' },
  BODY: { key: 'BODY', label: 'Body', icon: '💪', color: 'var(--body)' },
  INTELLECT: { key: 'INTELLECT', label: 'Intellect', icon: '📚', color: 'var(--intellect)' },
}

// Level bands from the plan (section 5.4).
export function rankForLevel(level) {
  if (level >= 100) return 'APEX'
  if (level >= 76) return 'Legend'
  if (level >= 51) return 'Elite'
  if (level >= 26) return 'Contender'
  if (level >= 11) return 'Grinder'
  return 'Rookie'
}

// XP needed to clear a given level (gentle curve).
export function xpForLevel(level) {
  return 100 + (level - 1) * 40
}

// Convert total XP into {level, xpInto, xpNeeded}.
export function levelFromXp(totalXp) {
  let level = 1
  let remaining = totalXp
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level)
    level += 1
  }
  return { level, xpInto: remaining, xpNeeded: xpForLevel(level) }
}

// --- Onboarding: dream goal -> domain + roadmap (rule-based stand-in for the LLM) ---

const DOMAINS = [
  { id: 'software', label: 'Software Engineering', match: /(code|coding|software|developer|engineer|programming|dev\b)/i,
    tasks: ['Solve 1 algorithm problem', 'Build for 25 min on a side project', 'Read 1 engineering article'] },
  { id: 'fitness', label: 'Peak Fitness', match: /(fit|muscle|lift|gym|run|marathon|strong|shred|abs|weight)/i,
    tasks: ['Complete today’s strength block', 'Hit 8k steps', 'Log all meals'] },
  { id: 'founder', label: 'Founder / Entrepreneurship', match: /(startup|founder|business|entrepreneur|company|ceo)/i,
    tasks: ['Talk to 1 potential customer', 'Ship 1 visible improvement', 'Read 10 pages on business'] },
  { id: 'finance', label: 'Financial Mastery', match: /(money|rich|finance|invest|wealth|trading|stocks)/i,
    tasks: ['Review budget for 10 min', 'Read 1 finance lesson', 'Log net worth change'] },
  { id: 'creative', label: 'Creative Mastery', match: /(write|writer|art|music|design|create|paint|novel)/i,
    tasks: ['Create for 25 min', 'Study 1 work you admire', 'Publish or share something'] },
]

export function parseDreamGoal(text) {
  const domain = DOMAINS.find((d) => d.match.test(text)) || {
    id: 'general', label: 'Whole-Person Growth',
    tasks: ['Focus sprint: 25 min deep work', 'Move your body for 20 min', 'Learn something new for 15 min'],
  }
  // Motivation heuristic: extrinsic language vs. intrinsic language.
  const extrinsic = /(rich|money|famous|impress|beat|best|number one|prove)/i.test(text)
  return { domainId: domain.id, domainLabel: domain.label, motivation: extrinsic ? 'extrinsic' : 'intrinsic', _tasks: domain.tasks }
}

// --- Tier system (Bronze → Diamond) ---
// A tier ladder is auto-derived from a single "Gold" target, so setting
// Gold steps = 8000 makes Platinum = 10000, exactly like the user asked.
export const TIERS = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond']
export const TIER_COLORS = {
  Bronze: '#b45309', Silver: '#94a3b8', Gold: '#f59e0b', Platinum: '#22d3ee', Diamond: '#a78bfa',
}
const TIER_MULT = [0.5, 0.75, 1, 1.25, 1.6] // fraction of the Gold target
const TIER_XP = [20, 35, 55, 80, 110]

export function makeTiers(goldTarget, { round = 'auto' } = {}) {
  return TIERS.map((name, i) => {
    let threshold = goldTarget * TIER_MULT[i]
    if (round === 'auto') threshold = goldTarget >= 1000 ? Math.round(threshold / 100) * 100 : Math.round(threshold * 2) / 2
    return { name, threshold, xp: TIER_XP[i] }
  })
}

let customSeq = 0
export function makeCustomTask({ pillar, title, unit, goldTarget }) {
  return {
    id: `custom-${Date.now()}-${customSeq++}`,
    pillar, title, unit,
    custom: true,
    tiers: makeTiers(Number(goldTarget) || 1),
    achievedTier: null, // index into TIERS once logged today
  }
}

// One daily task per pillar, tiered, with targets nudged by the user's baseline.
export function buildDailyTasks(parsed, baseline = {}) {
  const stepGold = baseline.steps ? Math.max(6000, Math.round((baseline.steps * 1.15) / 100) * 100) : 8000
  const studyGold = baseline.studyHrs ? Math.max(20, Math.round((baseline.studyHrs * 60) / 7 / 5) * 5) : 25
  const domainTitle = (parsed._tasks && parsed._tasks[0]) || 'Deep-work sprint'
  return [
    { id: 't-body', pillar: 'BODY', title: 'Daily steps', unit: 'steps', tiers: makeTiers(stepGold), achievedTier: null },
    { id: 't-mind', pillar: 'MIND', title: 'Meditate / journal', unit: 'min', tiers: makeTiers(10), achievedTier: null },
    { id: 't-intel', pillar: 'INTELLECT', title: domainTitle, unit: 'min focus', tiers: makeTiers(studyGold), achievedTier: null },
  ]
}

// --- Human Score (0–1000 per pillar) computed from the actual baseline intake ---
const clamp01 = (x) => Math.max(0, Math.min(1, x))
const GRADE_PTS = {
  'Middle school': 60, 'High school': 110, 'College': 150, 'Grad school': 185, 'Working professional': 200,
}

export function bmiFrom(baseline) {
  const inches = (Number(baseline.heightFt) || 0) * 12 + (Number(baseline.heightIn) || 0)
  const lbs = Number(baseline.weightLbs) || 0
  if (!inches || !lbs) return null
  return (lbs / (inches * inches)) * 703
}

export function computeHumanScore(baseline = {}) {
  const steps = Number(baseline.steps) || 0
  const workouts = Number(baseline.workouts) || 0
  const sleep = Number(baseline.sleepHrs) || 0
  const stress = Number(baseline.stress) || 5
  const meditDays = Number(baseline.meditDays) || 0
  const studyHrs = Number(baseline.studyHrs) || 0
  const skill = Number(baseline.skill) || 0
  const bmi = bmiFrom(baseline)

  // BODY: steps + workouts + sleep + BMI proximity to ~22
  const sleepPts = (1 - Math.min(Math.abs(sleep - 8), 4) / 4) * 250
  const bmiPts = bmi == null ? 150 : (1 - Math.min(Math.abs(bmi - 22), 12) / 12) * 250
  const body = Math.round(clamp01(steps / 12000) * 250 + clamp01(workouts / 6) * 250 + sleepPts + bmiPts)

  // MIND: low stress + meditation + sleep
  const mind = Math.round((1 - clamp01((stress - 1) / 9)) * 400 + clamp01(meditDays / 7) * 350 + sleepPts)

  // INTELLECT: study load + self-rated skill + education level
  const intellect = Math.round(clamp01(studyHrs / 20) * 400 + clamp01(skill / 10) * 400 + (GRADE_PTS[baseline.gradeLevel] || 100))

  const clamp1000 = (x) => Math.max(0, Math.min(1000, x))
  const b = clamp1000(body), m = clamp1000(mind), it = clamp1000(intellect)
  const total = Math.round((b + m + it) / 3)
  return { mind: m, body: b, intellect: it, total, target: Math.min(960, total + 380), bmi }
}

export function buildRoadmap(parsed) {
  return [
    { week: 1, focus: 'Build the daily habit. Small wins only.' },
    { week: 2, focus: `Add depth to ${parsed.domainLabel}. Raise the bar.` },
    { week: 3, focus: 'Stack streaks. Introduce a rival challenge.' },
    { week: 4, focus: 'First milestone check. Re-baseline your Human Score.' },
  ]
}

// --- Spin wheel (section 5.3) — probability-weighted outcomes ---
export const WHEEL = [
  { id: 'coins-sm', weight: 40, label: '+120 Coins', kind: 'coins', value: 120, color: '#3b82f6' },
  { id: 'xp-mult', weight: 25, label: '2× XP Boost', kind: 'xpmult', value: 2, color: '#8b5cf6' },
  { id: 'cosmetic', weight: 15, label: 'Rare Cosmetic', kind: 'cosmetic', value: 'Neon Aura', color: '#ec4899' },
  { id: 'shield', weight: 10, label: 'Streak Shield', kind: 'shield', value: 1, color: '#22c55e' },
  { id: 'real', weight: 7, label: 'Partner Reward', kind: 'real', value: '10% off code', color: '#f59e0b' },
  { id: 'jackpot', weight: 3, label: 'JACKPOT', kind: 'jackpot', value: 'Apex Gold', color: '#ef4444' },
]

export function spinOutcome() {
  const total = WHEEL.reduce((s, w) => s + w.weight, 0)
  let r = Math.random() * total
  for (let i = 0; i < WHEEL.length; i++) {
    r -= WHEEL[i].weight
    if (r <= 0) return { ...WHEEL[i], index: i }
  }
  return { ...WHEEL[WHEEL.length - 1], index: WHEEL.length - 1 }
}

// --- Mock leaderboard ---
export function buildLeaderboard(userName, userXp) {
  const bots = [
    { name: 'Kaizen_Kai', xp: 1840 }, { name: 'IronWill', xp: 1610 },
    { name: 'FlowState99', xp: 1320 }, { name: 'NoZeroDays', xp: 980 },
    { name: 'DawnPatrol', xp: 740 }, { name: 'QuietGrind', xp: 520 },
  ]
  const all = [...bots, { name: userName || 'You', xp: userXp, isUser: true }]
  return all.sort((a, b) => b.xp - a.xp)
}

// --- Squad system (section 5.7) — social + accountability ---
export function buildSquad(userName) {
  return {
    name: 'Dawn Raiders',
    members: [
      { name: 'Kaizen_Kai', weeklyXp: 320, checkedInOn: todayKey() },
      { name: 'IronWill', weeklyXp: 280, checkedInOn: null },
      { name: 'FlowState99', weeklyXp: 210, checkedInOn: todayKey() },
      { name: userName || 'You', weeklyXp: 0, checkedInOn: null, isUser: true },
    ],
    rival: { name: 'Night Owls', weeklyXp: 1180 },
    nudged: [],
  }
}

// Squad's weekly XP pool — teammates' contributions + the user's live XP.
export function squadTotalXp(squad, userXp) {
  if (!squad) return 0
  return squad.members.reduce((sum, m) => sum + (m.isUser ? userXp : m.weeklyXp), 0)
}

export function membersAwaitingCheckin(squad) {
  if (!squad) return []
  return squad.members.filter((m) => m.checkedInOn !== todayKey())
}

export function userCheckedIn(squad) {
  if (!squad) return false
  const me = squad.members.find((m) => m.isUser)
  return !!me && me.checkedInOn === todayKey()
}

// --- Rival Duels (section 5.5) — 7-day head-to-head ---
export function buildDuel(opponent = 'IronWill') {
  return {
    opponent,
    metric: 'tasks completed',
    durationDays: 7,
    startDate: todayKey(),
    endDate: addDays(todayKey(), 7),
    userScore: 0,
    oppScore: 1,
    status: 'active', // active | won | lost | tied
  }
}

// Resolve the duel if it has ended; otherwise return unchanged.
export function resolveDuel(duel, today = todayKey()) {
  if (!duel || duel.status !== 'active') return duel
  if (daysBetween(today, duel.endDate) > 0) return duel // not over yet
  let status = 'tied'
  if (duel.userScore > duel.oppScore) status = 'won'
  else if (duel.userScore < duel.oppScore) status = 'lost'
  return { ...duel, status }
}

// --- Health import (section 7) — simulated wearable/HealthKit snapshot ---
export function generateHealthSnapshot() {
  const r = (min, max) => Math.round(min + Math.random() * (max - min))
  return {
    steps: r(3500, 12500),
    sleepHrs: +(6 + Math.random() * 2.6).toFixed(1),
    hrv: r(38, 92),
    restingHr: r(48, 70),
    activeKcal: r(180, 720),
    source: 'Apple Health (simulated)',
    syncedOn: todayKey(),
  }
}

// --- Persistence ---
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* ignore */ }
}

export function resetState() {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

export function addDays(key, n) {
  const d = new Date(key + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000)
}

// --- Streak milestones (section 5.6) ---
export const STREAK_MILESTONES = [7, 30, 100, 365]

// --- Weekly review insight (section 6.4) — rule-based stand-in for the LLM ---
export function weeklyInsight(state) {
  const b = state.baseline || {}
  if (Number(b.sleepHrs) && Number(b.sleepHrs) < 7)
    return 'You sleep under 7h. Mind & Body scores climb fast at 7–9h — protect your sleep this week.'
  if (Number(b.steps) && Number(b.steps) < 6000)
    return 'Steps are low. An evening walk is your quickest Body-score win.'
  if (Number(b.studyHrs) && Number(b.studyHrs) < 5)
    return 'Push focused learning toward 5+ hrs/week to move your Intellect score.'
  if (Number(b.stress) >= 7)
    return 'Stress is high. Daily meditation lifts your Mind score and steadies your streak.'
  return 'Strong baseline. Push one task to a higher tier to break into the next league.'
}

// --- Daily rollover engine ---
// Resets the day's tasks/spins, and breaks the streak if a day was missed
// (a Streak Shield absorbs one missed day). Pure: returns a new state.
export function rollForward(state, today = todayKey()) {
  if (!state || !state.lastActiveDay || state.lastActiveDay === today) return state

  const prevAllDone = state.tasks.length > 0 && state.tasks.every((t) => t.achievedTier != null)
  const gap = daysBetween(state.lastActiveDay, today)
  let streak = state.streak || 0
  let shields = state.shields || 0

  // Missed if the last active day wasn't fully completed, or a whole day was skipped.
  const missed = !prevAllDone || gap > 1
  let shieldUsed = false
  if (missed) {
    if (shields > 0) { shields -= 1; shieldUsed = true } else { streak = 0 }
  }

  // Rival opponent grinds away each day; resolve the duel if its window closed.
  let duel = state.duel
  if (duel && duel.status === 'active') {
    duel = { ...duel, oppScore: duel.oppScore + Math.round(1 + Math.random() * 2) }
    duel = resolveDuel(duel, today)
  }

  const tasks = state.tasks.map((t) => ({ ...t, achievedTier: null }))
  const squad = state.squad
    ? {
        ...state.squad,
        nudged: [],
        members: state.squad.members.map((m) =>
          m.isUser ? { ...m, checkedInOn: null } : { ...m, checkedInOn: Math.random() < 0.6 ? today : null }
        ),
      }
    : state.squad

  return {
    ...state,
    tasks,
    squad,
    duel,
    streak,
    shields,
    lastActiveDay: today,
    spunOn: null,
    spinsUsed: 0,
    xpBoost: 1,
    _rolloverNote: shieldUsed ? 'shield' : missed ? 'broken' : 'clean',
  }
}
