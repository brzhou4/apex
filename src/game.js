// APEX core game logic — pure functions + persistence.
// Kept framework-agnostic so it could be lifted into a real backend later.

const STORAGE_KEY = 'apex.state.v4'

// Real rendered artwork instead of text emojis — Microsoft's Fluent 3D emoji
// set (MIT licensed), hotlinked from the official repo. Every UI surface
// renders these as <img> for that glossy Duolingo-style look.
const FLUENT = 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets'
const fl = (folder, file) => `${FLUENT}/${encodeURIComponent(folder)}/3D/${file}_3d.png`
export const IMGS = {
  fire: fl('Fire', 'fire'),
  gem: fl('Gem stone', 'gem_stone'),
  shield: fl('Shield', 'shield'),
  brain: fl('Brain', 'brain'),
  biceps: `${FLUENT}/${encodeURIComponent('Flexed biceps')}/Default/3D/flexed_biceps_3d_default.png`,
  books: fl('Books', 'books'),
  house: fl('House', 'house'),
  compass: fl('Compass', 'compass'),
  slot: fl('Slot machine', 'slot_machine'),
  trophy: fl('Trophy', 'trophy'),
  party: fl('Party popper', 'party_popper'),
  bags: fl('Shopping bags', 'shopping_bags'),
  globe: fl('Globe showing americas', 'globe_showing_americas'),
  camera: fl('Camera with flash', 'camera_with_flash'),
  bolt: fl('High voltage', 'high_voltage'),
  target: fl('Bullseye', 'bullseye'),
  heart: fl('Red heart', 'red_heart'),
  crown: fl('Crown', 'crown'),
  star: fl('Glowing star', 'glowing_star'),
  lock: fl('Locked', 'locked'),
  wave: `${FLUENT}/${encodeURIComponent('Waving hand')}/Default/3D/waving_hand_3d_default.png`,
  check: fl('Check mark button', 'check_mark_button'),
  hourglass: fl('Hourglass not done', 'hourglass_not_done'),
  pencil: fl('Pencil', 'pencil'),
  bulb: fl('Light bulb', 'light_bulb'),
  warning: fl('Warning', 'warning'),
  skull: fl('Skull', 'skull'),
  swords: fl('Crossed swords', 'crossed_swords'),
  seedling: fl('Seedling', 'seedling'),
  phone: fl('Mobile phone', 'mobile_phone'),
  medal: fl('Sports medal', 'sports_medal'),
  rocket: fl('Rocket', 'rocket'),
  gradcap: fl('Graduation cap', 'graduation_cap'),
  shoe: fl('Running shoe', 'running_shoe'),
  salad: fl('Green salad', 'green_salad'),
  hundred: fl('Hundred points', 'hundred_points'),
  dart: fl('Bullseye', 'bullseye'),
  memo: fl('Memo', 'memo'),
  floppy: fl('Floppy disk', 'floppy_disk'),
  chart: fl('Chart increasing', 'chart_increasing'),
  person: fl('Bust in silhouette', 'bust_in_silhouette'),
  comment: fl('Speech balloon', 'speech_balloon'),
  share: fl('Outbox tray', 'outbox_tray'),
  search: fl('Magnifying glass tilted left', 'magnifying_glass_tilted_left'),
  pet: fl('Dog face', 'dog_face'),
  apple: fl('Red apple', 'red_apple'),
  gear: fl('Gear', 'gear'),
  sun: fl('Sun', 'sun'),
  moon: fl('Crescent moon', 'crescent_moon'),
  trash: fl('Wastebasket', 'wastebasket'),
  cake: fl('Birthday cake', 'birthday_cake'),
}

// Rendered artwork per goal type (keyed by GOAL_TYPES id)
export const GOAL_IMGS = {
  muscle: IMGS.biceps,
  sat: IMGS.memo,
  college: IMGS.gradcap,
  endurance: IMGS.shoe,
  nutrition: IMGS.salad,
  grades: IMGS.hundred,
  social: IMGS.phone,
  business: IMGS.rocket,
  generic: IMGS.dart,
}

export const PILLARS = {
  MIND: { key: 'MIND', label: 'Mind', icon: '🧠', img: IMGS.brain, color: 'var(--mind)' },
  BODY: { key: 'BODY', label: 'Body', icon: '💪', img: IMGS.biceps, color: 'var(--body)' },
  INTELLECT: { key: 'INTELLECT', label: 'Intellect', icon: '📚', img: IMGS.books, color: 'var(--intellect)' },
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

// --- Rank system (Building Bronze → APEX) ---
// A rank ladder is auto-derived from a single "Gold" target, so setting
// Gold steps = 8000 makes Platinum = 10000. Seven ranks, each with its own
// identity and icon.
export const TIERS = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Apex']
export const TIER_META = {
  Bronze: { fancy: 'Building Bronze', icon: '🧱', img: fl('Brick', 'brick'), color: '#b45309' },
  Silver: { fancy: 'Steep Silver', icon: '🗻', img: fl('Mount fuji', 'mount_fuji'), color: '#94a3b8' },
  Gold: { fancy: 'Gaining Gold', icon: '💰', img: fl('Money bag', 'money_bag'), color: '#f59e0b' },
  Platinum: { fancy: 'Preaching Platinum', icon: '📣', img: fl('Megaphone', 'megaphone'), color: '#22d3ee' },
  Diamond: { fancy: 'Digging Diamond', icon: '⛏️', img: fl('Pick', 'pick'), color: '#a78bfa' },
  Ascendant: { fancy: 'Achieving Ascendant', icon: '🌠', img: fl('Shooting star', 'shooting_star'), color: '#f472b6' },
  Apex: { fancy: 'APEX', icon: '👑', img: fl('Crown', 'crown'), color: '#38bdf8' },
}
export const TIER_COLORS = Object.fromEntries(TIERS.map((t) => [t, TIER_META[t].color]))

// Every title gets its own color, tier-matched like the banners — Truecel
// wears bronze, APEX wears apex gold.
export const TITLE_COLORS = {
  'tl-truecel': '#b45309',
  'tl-sub5': '#94a3b8',
  'tl-ltn': '#f59e0b',
  'tl-htn': '#22d3ee',
  'tl-chadlite': '#a78bfa',
  'tl-ltg': '#f472b6',
  'tl-apex': '#ffc800',
  'tl-maxxer': '#10b981',
  'tl-ascended': '#ec4899',
  'tl-iceman': '#7dd3fc',
  'tl-octane': '#fb923c',
  'tl-brick': '#ef4444',
}

// What each tier is CALLED on a profile — the titles ladder, in order.
// You're not "Preaching Platinum", you're a High Tier Normie.
export const TIER_TITLES = {
  Bronze: 'Truecel',
  Silver: 'Sub 5',
  Gold: 'Low Tier Normie',
  Platinum: 'High Tier Normie',
  Diamond: 'Chadlite',
  Ascendant: 'Low Tier God',
  Apex: 'APEX',
}
const TIER_MULT = [0.5, 0.75, 1, 1.25, 1.6, 2, 2.5] // fraction of the Gold target
const TIER_XP = [20, 35, 55, 80, 110, 150, 200]

export function makeTiers(goldTarget, { round = 'auto' } = {}) {
  return TIERS.map((name, i) => {
    let threshold = goldTarget * TIER_MULT[i]
    if (round === 'auto') threshold = goldTarget >= 1000 ? Math.round(threshold / 100) * 100 : Math.round(threshold * 2) / 2
    return { name, threshold, xp: TIER_XP[i] }
  })
}

// Rewards scale with the rank you finish at. Emeralds are the only currency;
// bonus spins unlock from Gold up.
export function rewardsForTier(i) {
  return {
    bonusSpins: (i >= 2 ? 1 : 0) + (i >= 5 ? 1 : 0),
    emeralds: [1, 2, 3, 5, 8, 12, 20][i] || 1,
  }
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

// --- Personalized multi-goal plans ---
// The dream-goal text is split into individual goals ("get jacked, 1600 SAT,
// attend Berkeley" -> 3 goals), each matched to an expert template that asks
// its own follow-up questions and expands into an 8-week roadmap, weekly
// objectives, a training/study schedule, and a daily task.

const num = (v, fallback) => (Number(v) > 0 ? Number(v) : fallback)
const pct = (x) => Math.max(2, Math.min(97, Math.round(x)))

export const GOAL_TYPES = [
  {
    id: 'muscle', icon: '🏋️', label: 'Build Muscle',
    match: /(jacked|muscle|shredded|bulk|lift|gym|strong|swole|buff|bodybuild)/i,
    questions: [
      { key: 'days', label: 'Training days / week', type: 'number', placeholder: '4' },
      { key: 'level', label: 'Experience', type: 'select', options: ['Beginner', 'Intermediate', 'Advanced'] },
    ],
    progress(d = {}) {
      const base = { Beginner: 15, Intermediate: 45, Advanced: 72 }[d.level] || 15
      return pct(base + (num(d.days, 0) >= 5 ? 8 : 0))
    },
    buildPlan(d = {}) {
      const days = Math.min(6, Math.max(2, num(d.days, 4)))
      const splits = {
        2: ['Upper body', 'Lower body'],
        3: ['Push (chest/shoulders/triceps)', 'Pull (back/biceps)', 'Legs'],
        4: ['Push', 'Pull', 'Legs', 'Upper body'],
        5: ['Push', 'Pull', 'Legs', 'Upper body', 'Lower body'],
        6: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'],
      }
      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      const schedule = splits[days].map((focus, i) => ({ day: dayNames[Math.floor((i * 7) / days)], focus }))
      const beginner = (d.level || 'Beginner') === 'Beginner'
      return {
        schedule,
        scheduleLabel: `${days}-day ${days >= 3 && days <= 6 ? 'push/pull/legs' : 'upper/lower'} split`,
        weeks: [
          { week: 1, focus: beginner ? 'Learn the lifts — form first, light weight.' : 'Re-establish baselines on the big lifts.', objectives: [`${days} sessions on the split`, 'Film one set per lift to check form', 'Protein at every meal'] },
          { week: 2, focus: 'Groove the split. Same weights, cleaner reps.', objectives: [`${days} sessions`, 'Add 1 rep per set vs last week', 'Sleep 7.5h+'] },
          { week: 3, focus: 'Progressive overload begins — +2.5–5% on main lifts.', objectives: [`${days} sessions`, 'Beat last week on 2 lifts', 'Log every workout'] },
          { week: 4, focus: 'Volume week — add one set to weak muscle groups.', objectives: [`${days} sessions`, '+1 set on lagging groups', 'Body-weight check-in'] },
          { week: 5, focus: 'Keep overloading. Intensity over novelty.', objectives: [`${days} sessions`, 'PR attempt on one lift', 'Protein ≥0.8g/lb daily'] },
          { week: 6, focus: 'Push hard — last heavy block before deload.', objectives: [`${days} sessions`, 'Beat week-5 numbers', 'No missed sessions'] },
          { week: 7, focus: 'Deload — 60% weight, full recovery.', objectives: ['Light sessions only', 'Mobility work 3×', 'Extra sleep'] },
          { week: 8, focus: 'Retest week — measure strength + physique progress.', objectives: ['Retest main lifts', 'Progress photos', 'Set next 8-week targets'] },
        ],
        task: { pillar: 'BODY', title: 'Training session (follow your split)', unit: 'min', goldTarget: 45 },
      }
    },
  },
  {
    id: 'sat', icon: '📝', label: 'SAT Score',
    match: /(sat|psat|\b1[0-6]00\b|test score|standardized)/i,
    questions: [
      { key: 'current', label: 'Current score', type: 'number', placeholder: '1200' },
      { key: 'target', label: 'Target score', type: 'number', placeholder: '1600' },
    ],
    progress(d = {}) {
      const current = num(d.current, 1200)
      const target = num(d.target, 1600)
      return pct(((current - 400) / Math.max(1, target - 400)) * 100)
    },
    buildPlan(d = {}) {
      const current = num(d.current, 1200)
      const target = num(d.target, 1600)
      const gain = Math.max(0, target - current)
      const perBlock = Math.ceil(gain / 3 / 10) * 10
      return {
        schedule: [
          { day: 'Mon', focus: 'Math drills (no calculator section)' },
          { day: 'Wed', focus: 'Reading — 2 timed passages + review' },
          { day: 'Fri', focus: 'Writing & grammar rules' },
          { day: 'Sat', focus: 'Timed section + error log review' },
        ],
        scheduleLabel: `${current} → ${target} study rotation`,
        weeks: [
          { week: 1, focus: 'Full diagnostic test — find your real baseline.', objectives: ['1 full timed practice test', 'Build an error log', 'Learn the test structure'] },
          { week: 2, focus: 'Attack your weakest section first.', objectives: ['4 study blocks', '50 practice problems in weak section', 'Review every miss'] },
          { week: 3, focus: `Math foundations — target +${perBlock} points.`, objectives: ['Master 3 recurring math patterns', '2 timed math sections', 'Error log review'] },
          { week: 4, focus: 'Full mock test #2 under real conditions.', objectives: ['1 full timed test', 'Compare vs diagnostic', 'Adjust weak-section plan'] },
          { week: 5, focus: `Reading speed + evidence questions — +${perBlock} more.`, objectives: ['6 timed passages', 'Vocabulary-in-context drills', '4 study blocks'] },
          { week: 6, focus: 'Grammar rules to automaticity.', objectives: ['All punctuation rules drilled', '2 timed writing sections', 'Error log shrinking'] },
          { week: 7, focus: 'Full mock test #3 — pacing dialed in.', objectives: ['1 full timed test', 'Section timing within ±1 min', 'Review every miss'] },
          { week: 8, focus: `Final polish — close the last gap to ${target}.`, objectives: ['Light review only', 'Sleep schedule matched to test day', 'Confidence reps on strongest sections'] },
        ],
        task: { pillar: 'INTELLECT', title: 'SAT practice block', unit: 'min', goldTarget: 40 },
      }
    },
  },
  {
    id: 'college', icon: '🎓', label: 'College Admissions',
    match: /(berkeley|stanford|harvard|mit|ivy|college|university|admission|get into)/i,
    questions: [
      { key: 'gpa', label: 'Current GPA', type: 'number', placeholder: '3.8' },
      { key: 'grade', label: 'Current grade', type: 'select', options: ['Freshman', 'Sophomore', 'Junior', 'Senior'] },
      { key: 'ecs', label: 'Extracurriculars you do now', type: 'text', placeholder: 'e.g. robotics club, varsity soccer' },
      { key: 'aps', label: 'AP / honors classes taken', type: 'number', placeholder: '3' },
    ],
    progress(d = {}) {
      const gpaPts = (num(d.gpa, 3.0) / 4.0) * 55
      const ecPts = (d.ecs || '').trim() ? 22 : 4
      const apPts = Math.min(15, num(d.aps, 0) * 4)
      return pct(gpaPts + ecPts + apPts)
    },
    buildPlan(d = {}) {
      const gpa = num(d.gpa, 3.7)
      const ecs = (d.ecs || '').trim()
      const gpaFocus = gpa < 3.8 ? `Raise GPA from ${gpa} — grades are the #1 factor.` : `Protect your ${gpa} GPA while building spikes.`
      const spikeFocus = ecs
        ? `Go deeper on what you already do: ${ecs}. Admissions rewards depth + leadership, not a longer list.`
        : 'Pick ONE spike activity and go deep — you listed none yet, so this is priority #1.'
      return {
        schedule: [
          { day: 'Mon', focus: 'Hardest class — extra hour of depth' },
          { day: 'Wed', focus: ecs ? `Extracurricular block: ${ecs.split(',')[0].trim()}` : 'Start your spike activity' },
          { day: 'Sat', focus: 'Essay drafting or application research' },
        ],
        scheduleLabel: `${d.grade || 'Student'} admissions track`,
        weeks: [
          { week: 1, focus: gpaFocus, objectives: ['Audit current grades', 'List target schools + requirements', ecs ? `Rank your activities (${ecs}) by depth potential` : 'Pick 1 spike activity to go deep on'] },
          { week: 2, focus: spikeFocus, objectives: ['3 hrs on spike activity', 'Reach out to 1 mentor/teacher', 'Grade check-in'] },
          { week: 3, focus: 'Leadership evidence — start something ownable.', objectives: [ecs ? `Take a leadership role in ${ecs.split(',')[0].trim()}` : 'Take on a concrete leadership role', 'Document impact with numbers', 'Keep GPA steady'] },
          { week: 4, focus: 'Research target schools deeply.', objectives: ['Essay prompts collected', 'Requirements spreadsheet done', 'Visit/virtual tour 1 school'] },
          { week: 5, focus: 'First personal-statement draft.', objectives: ['Full rough draft written', 'One story, told specifically', 'Feedback from 1 reader'] },
          { week: 6, focus: 'Extracurricular impact sprint.', objectives: ['Measurable output from spike', '3 hrs on activity', 'Draft revision #2'] },
          { week: 7, focus: 'Teacher recommendations groundwork.', objectives: ['Identify 2 recommenders', 'Give them your brag sheet', 'Essay near-final'] },
          { week: 8, focus: 'Application package review.', objectives: ['Mock application review', 'Gap list for next cycle', 'Celebrate the streak'] },
        ],
        task: { pillar: 'INTELLECT', title: 'Admissions work (GPA / essays / spike)', unit: 'min', goldTarget: 30 },
      }
    },
  },
  {
    id: 'endurance', icon: '🏃', label: 'Endurance / Running',
    match: /(marathon|run|5k|10k|half|cardio|endurance|triathlon)/i,
    questions: [
      { key: 'longest', label: 'Longest recent run (mi)', type: 'number', placeholder: '3' },
      { key: 'goalDist', label: 'Goal distance (mi)', type: 'number', placeholder: '26.2' },
    ],
    progress(d = {}) {
      return pct((num(d.longest, 3) / num(d.goalDist, 26.2)) * 100)
    },
    buildPlan(d = {}) {
      const base = num(d.longest, 3)
      const wk = (n) => Math.round(base * (1 + n * 0.15) * 10) / 10
      return {
        schedule: [
          { day: 'Tue', focus: 'Easy run (conversational pace)' },
          { day: 'Thu', focus: 'Intervals or tempo run' },
          { day: 'Sat', focus: 'Long run (weekly builder)' },
        ],
        scheduleLabel: '3-day run base building',
        weeks: Array.from({ length: 8 }, (_, i) => ({
          week: i + 1,
          focus: i === 3 || i === 7 ? 'Recovery week — cut volume 30%, keep legs fresh.' : `Build week — long run to ${wk(i + 1)} mi.`,
          objectives: ['3 runs completed', i % 2 ? 'One tempo/interval session' : 'All runs easy pace', 'Stretch after every run'],
        })),
        task: { pillar: 'BODY', title: 'Run (follow the plan)', unit: 'min', goldTarget: 30 },
      }
    },
  },
  {
    id: 'nutrition', icon: '🥗', label: 'Eat Lean',
    match: /(eat lean|eat clean|diet|nutrition|healthy eating|cut sugar|meal prep|lose fat|lose weight)/i,
    questions: [
      { key: 'mealsOut', label: 'Takeout / junk meals per week', type: 'number', placeholder: '6' },
      { key: 'cook', label: 'Can you cook?', type: 'select', options: ['Not really', 'Basics', 'Confident'] },
    ],
    progress(d = {}) {
      const junk = num(d.mealsOut, 8)
      const cookPts = { 'Not really': 5, Basics: 18, Confident: 32 }[d.cook] || 5
      return pct(Math.max(0, 55 - junk * 5) + cookPts)
    },
    buildPlan(d = {}) {
      const junk = num(d.mealsOut, 6)
      return {
        schedule: [
          { day: 'Sun', focus: 'Meal prep: 3 protein bases + 2 carb bases' },
          { day: 'Daily', focus: 'Protein + veg at every meal, water over drinks' },
          { day: 'Sat', focus: 'One planned free meal — earned, not stolen' },
        ],
        scheduleLabel: `cutting from ${junk} junk meals/wk`,
        weeks: [
          { week: 1, focus: 'Baseline — log everything you actually eat, no judgment.', objectives: ['Log every meal for 7 days', 'One grocery run with a list', 'Swap drinks for water'] },
          { week: 2, focus: `Cut junk meals from ${junk} to ${Math.max(1, junk - 2)}/week.`, objectives: ['First Sunday meal prep', 'Protein at every meal', `≤${Math.max(1, junk - 2)} takeout meals`] },
          { week: 3, focus: 'Build 5 go-to lean meals you actually like.', objectives: ['Cook 2 new recipes', 'Prep lunches for weekdays', 'No seconds on carbs'] },
          { week: 4, focus: 'Checkpoint — weight, photos, energy levels.', objectives: ['Progress check-in', 'Adjust portions to results', 'Plan next 4 weeks of menus'] },
          { week: 5, focus: 'Dial in eating out — order lean anywhere.', objectives: ['Learn 3 restaurant default orders', 'Keep meal prep streak', 'Veg at every dinner'] },
          { week: 6, focus: 'Tighten the last leaks: snacks and late nights.', objectives: ['Kitchen closed after 9pm', 'Swap snacks for protein options', 'Full log again for 7 days'] },
          { week: 7, focus: 'Make it automatic — habits over willpower.', objectives: ['Same 5 breakfasts/lunches all week', 'One batch-cook session', 'Zero unplanned junk meals'] },
          { week: 8, focus: 'Re-measure and set the next standard.', objectives: ['Compare to week 1 baseline', 'Lock in your maintenance rules', 'Set next cut or maintain target'] },
        ],
        task: { pillar: 'BODY', title: 'Cook / prep a lean meal', unit: 'min', goldTarget: 20 },
      }
    },
  },
  {
    id: 'grades', icon: '🅰️', label: 'Straight As',
    match: /(all as|straight a|gpa|grades|honor roll|4\.0)/i,
    questions: [
      { key: 'gpa', label: 'Current GPA', type: 'number', placeholder: '3.5' },
      { key: 'weakest', label: 'Weakest subject', type: 'text', placeholder: 'e.g. chemistry' },
    ],
    progress(d = {}) {
      return pct((num(d.gpa, 3.0) / 4.0) * 100)
    },
    buildPlan(d = {}) {
      const weak = (d.weakest || 'your weakest class').trim()
      return {
        schedule: [
          { day: 'Daily', focus: 'Same-day review: 20 min per class with new material' },
          { day: 'Tue', focus: `Extra block on ${weak}` },
          { day: 'Sun', focus: 'Weekly preview: skim what’s coming, list deadlines' },
        ],
        scheduleLabel: `${num(d.gpa, 3.5)} → 4.0 system`,
        weeks: [
          { week: 1, focus: 'Audit — where exactly are the lost points?', objectives: ['List every class + current grade', 'Find the missing/low assignments', `Diagnose why ${weak} is weakest`] },
          { week: 2, focus: 'Kill the backlog — recover every recoverable point.', objectives: ['Submit/redo anything allowed', 'Meet each teacher once', 'Set up the daily review habit'] },
          { week: 3, focus: `War on ${weak} — office hours + active recall.`, objectives: [`3 focused blocks on ${weak}`, 'Make flashcards from errors', 'Ask 3 questions in class'] },
          { week: 4, focus: 'Test-taking system: practice under time pressure.', objectives: ['1 timed practice test', 'Error log per subject', 'Review before sleep, not just before tests'] },
          { week: 5, focus: 'Consistency block — no missed daily reviews.', objectives: ['7/7 daily reviews', 'Preview material before class', `${weak} grade check`] },
          { week: 6, focus: 'Grind the details — homework quality = easy points.', objectives: ['Every assignment submitted early', 'Rubric-check before submitting', 'Study group or teach a friend'] },
          { week: 7, focus: 'Finals prep starts now, not the night before.', objectives: ['Master study guide per class', 'Spaced repetition running', '2 timed practice exams'] },
          { week: 8, focus: 'Peak week — execute and collect the As.', objectives: ['Sleep 8h before every test', 'Final error-log review', 'Post-mortem: what to keep next term'] },
        ],
        task: { pillar: 'INTELLECT', title: 'Study block (weakest subject first)', unit: 'min', goldTarget: 45 },
      }
    },
  },
  {
    id: 'social', icon: '📱', label: 'Grow a Following',
    match: /(followers|instagram|tiktok|youtube|subscriber|influencer|audience|content creator)/i,
    questions: [
      { key: 'current', label: 'Current followers', type: 'number', placeholder: '500' },
      { key: 'target', label: 'Target followers', type: 'number', placeholder: '100000' },
      { key: 'niche', label: 'Your niche', type: 'text', placeholder: 'e.g. fitness, gaming, study' },
    ],
    progress(d = {}) {
      // Log scale — 1k followers is genuinely a big chunk of the way to 100k.
      const cur = Math.max(1, num(d.current, 100))
      const tgt = Math.max(2, num(d.target, 100000))
      return pct((Math.log10(cur) / Math.log10(tgt)) * 100)
    },
    buildPlan(d = {}) {
      const niche = (d.niche || 'your niche').trim()
      const cur = num(d.current, 500)
      const tgt = num(d.target, 100000)
      return {
        schedule: [
          { day: 'Daily', focus: 'Post 1 piece of content — volume beats perfection' },
          { day: 'Daily', focus: '30 min genuine engagement in your niche' },
          { day: 'Sun', focus: 'Analytics review: double down on what worked' },
        ],
        scheduleLabel: `${cur.toLocaleString()} → ${tgt.toLocaleString()} in ${niche}`,
        weeks: [
          { week: 1, focus: `Define your lane in ${niche} — who is it for, why follow you?`, objectives: ['Write your one-line positioning', 'Study 5 top accounts in the niche', 'Post 5 pieces of content'] },
          { week: 2, focus: 'Volume week — find your format.', objectives: ['7 posts in 7 days', 'Try 3 different formats', 'Reply to every comment'] },
          { week: 3, focus: 'Hooks decide everything — first 1.5 seconds.', objectives: ['Write 10 hooks before making anything', 'Remake your best post with a better hook', '30 min/day engagement'] },
          { week: 4, focus: 'Analytics checkpoint — kill what doesn’t work.', objectives: ['Identify top 20% of posts', 'Drop weakest format', 'DM/collab with 3 similar-size creators'] },
          { week: 5, focus: 'Series > singles — give people a reason to follow.', objectives: ['Launch a repeatable series', 'Batch-create 5 episodes', 'Pin your best performer'] },
          { week: 6, focus: 'Ride distribution — trends, sounds, timing.', objectives: ['3 trend-jacked posts in your niche', 'Post at your top 2 time slots', 'Collab post goes live'] },
          { week: 7, focus: 'Community — turn viewers into fans.', objectives: ['Ask questions in every caption', 'Feature followers/replies in content', 'Story/community post daily'] },
          { week: 8, focus: 'Scale review — systemize what works.', objectives: ['Document your content playbook', 'Set weekly output quota', `Growth check vs ${cur.toLocaleString()} start`] },
        ],
        task: { pillar: 'MIND', title: `Create + post content (${niche})`, unit: 'min', goldTarget: 40 },
      }
    },
  },
  {
    id: 'business', icon: '🚀', label: 'Launch a Business',
    match: /(business|startup|company|entrepreneur|founder|side hustle|saas|ecommerce)/i,
    questions: [
      { key: 'stage', label: 'Where are you now?', type: 'select', options: ['Just an idea', 'Building it', 'Launched, no revenue', 'Making some money'] },
      { key: 'hours', label: 'Hours / week you can commit', type: 'number', placeholder: '10' },
    ],
    progress(d = {}) {
      return pct({ 'Just an idea': 8, 'Building it': 32, 'Launched, no revenue': 55, 'Making some money': 78 }[d.stage] || 8)
    },
    buildPlan(d = {}) {
      const hours = num(d.hours, 10)
      const early = !d.stage || d.stage === 'Just an idea'
      return {
        schedule: [
          { day: 'Daily', focus: `${Math.max(1, Math.round(hours / 7))}h build block — ship something visible` },
          { day: 'Wed', focus: 'Talk to 2 potential customers' },
          { day: 'Sun', focus: 'Weekly metrics + next-week priorities' },
        ],
        scheduleLabel: `${d.stage || 'Idea'} → revenue, ${hours}h/wk`,
        weeks: [
          { week: 1, focus: early ? 'Validate before you build — find the burning problem.' : 'Audit: what do users actually do vs what you built?', objectives: ['10 customer conversations', 'Write the problem statement', 'Define your one metric'] },
          { week: 2, focus: 'Smallest sellable version — scope ruthlessly.', objectives: ['Cut scope to 1 core feature', `${hours}h of build time logged`, '5 more customer conversations'] },
          { week: 3, focus: 'Ship the MVP — embarrassingly early beats perfectly late.', objectives: ['MVP live and shareable', 'First 10 users onboarded', 'Collect raw feedback'] },
          { week: 4, focus: 'Iterate on real usage, not opinions.', objectives: ['Fix top 3 user complaints', 'Watch 3 users live', 'Checkpoint: is the metric moving?'] },
          { week: 5, focus: 'First dollar — charge someone.', objectives: ['Put up a price', 'Ask 5 users to pay', 'Handle every objection in writing'] },
          { week: 6, focus: 'Distribution sprint — nobody finds you by accident.', objectives: ['Pick 1 channel and go hard', '10 pieces of content/outreach', 'Track conversion end-to-end'] },
          { week: 7, focus: 'Double down on the working channel.', objectives: ['2× output on best channel', 'Automate one manual step', 'Revenue/user check'] },
          { week: 8, focus: 'Review + decide: persevere, pivot, or push harder.', objectives: ['Honest metrics review', 'Write next 8-week thesis', 'Celebrate shipping'] },
        ],
        task: { pillar: 'INTELLECT', title: 'Build block (ship something)', unit: 'min', goldTarget: 60 },
      }
    },
  },
  {
    id: 'generic', icon: '🎯', label: 'Custom Goal',
    match: /./,
    questions: [
      { key: 'hours', label: 'Hours / week you can commit', type: 'number', placeholder: '5' },
      { key: 'focus', label: 'Main skill to sharpen', type: 'text', placeholder: 'e.g. rebuttals, case research' },
      { key: 'test', label: 'How you’ll know it’s working', type: 'text', placeholder: 'e.g. win a scrimmage, pass a mock' },
    ],
    progress(d = {}) {
      return pct((num(d.hours, 0) > 0 ? 18 : 8) + ((d.focus || '').trim() ? 6 : 0))
    },
    // Whatever the goal actually is — debate, chess, violin — the plan talks
    // about THAT, using the user's own words in every week.
    buildPlan(d = {}, label = 'your goal') {
      const hours = num(d.hours, 5)
      const thing = (label || 'your goal').trim()
      const skill = (d.focus || '').trim() || 'your weakest skill'
      const test = (d.test || '').trim() || 'a real test run'
      // The goal is quoted or placed after a colon so any phrasing reads clean
      // ("win state debate" → Drill block: rebuttals).
      return {
        schedule: [
          { day: 'Daily', focus: `${Math.round((hours / 7) * 60)} min of deliberate practice` },
          { day: 'Wed', focus: `Drill block: ${skill}` },
          { day: 'Sat', focus: `Pressure test: ${test}` },
        ],
        scheduleLabel: `${hours} hrs/week · “${thing}”`,
        weeks: [
          { week: 1, focus: `Map the goal — what does great look like for “${thing}”?`, objectives: ['Study 3 people who have already done it', 'Write your measurable definition of success', `${hours} hrs of practice logged`] },
          { week: 2, focus: 'Build the daily reps.', objectives: ['No zero days', `2 focused drill blocks: ${skill}`, 'One small visible win — share it on the Feed'] },
          { week: 3, focus: `Attack your weakness: ${skill}.`, objectives: [`3 drill blocks: ${skill}`, 'Get feedback from someone ahead of you', `${hours} hrs logged`] },
          { week: 4, focus: `First checkpoint: ${test}.`, objectives: [`Run it under real conditions: ${test}`, 'Compare against week 1', 'Cut the practice that isn’t moving you'] },
          { week: 5, focus: 'Double down on what works.', objectives: ['80% of time on your highest-leverage practice', `${hours} hrs logged`, 'Publish or perform something publicly'] },
          { week: 6, focus: 'Push through the boring middle.', objectives: ['No missed days', `One uncomfortable stretch: ${skill}, harder than feels comfortable`, `${hours} hrs logged`] },
          { week: 7, focus: 'Compound — chain your skills together.', objectives: ['Full run-throughs, not isolated drills', 'Teach someone one thing you learned', `${hours} hrs logged`] },
          { week: 8, focus: `Final test: ${test} — for real.`, objectives: [`Score it honestly: ${test}`, 'Re-baseline your Human Score', 'Draft the next 8 weeks'] },
        ],
        task: { pillar: 'MIND', title: `Practice: ${thing}`, unit: 'min', goldTarget: 45 },
      }
    },
  },
]

// Split a dream-goal sentence into individual typed goals.
export function parseGoals(text) {
  const frags = (text || '')
    .split(/,|;|\n|\band\b|\+/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 2)
  const list = frags.length ? frags : [text || 'Level up']
  const seen = new Set()
  return list.map((frag, i) => {
    let type = GOAL_TYPES.find((t) => t.id !== 'generic' && t.match.test(frag))
    if (!type || seen.has(type.id)) type = GOAL_TYPES[GOAL_TYPES.length - 1] // generic
    if (type.id !== 'generic') seen.add(type.id)
    return { goalId: `g${i}`, typeId: type.id, icon: type.icon, typeLabel: type.label, text: frag }
  })
}

export function buildGoalPlan(goal, details) {
  const type = GOAL_TYPES.find((t) => t.id === goal.typeId) || GOAL_TYPES[GOAL_TYPES.length - 1]
  const plan = type.buildPlan(details || {}, goal.text)
  // How far along you already are, judged from your own answers.
  plan.progress = type.progress ? type.progress(details || {}) : 10
  return plan
}

// --- Tier record + Human rank ---
// Every tier completion is logged; the average tier you hit determines what
// rank of human you are (Bronze Human ... Diamond Human).
export function tierCounts(tierLog = []) {
  const counts = Object.fromEntries(TIERS.map((t) => [t, 0]))
  tierLog.forEach((e) => { if (TIERS[e.tier]) counts[TIERS[e.tier]] += 1 })
  return counts
}

export function humanRank(tierLog = []) {
  if (!tierLog.length) return { label: 'Unranked', tier: null, icon: null, img: null, avg: 0 }
  const avg = tierLog.reduce((s, e) => s + e.tier, 0) / tierLog.length
  const idx = Math.min(TIERS.length - 1, Math.round(avg))
  const meta = TIER_META[TIERS[idx]]
  // label = the title you've earned (Truecel → APEX), not the tier's fancy name.
  return { label: TIER_TITLES[TIERS[idx]], tier: TIERS[idx], icon: meta.icon, img: meta.img, avg: Math.round(avg * 100) / 100 }
}

// --- Pet — your grind buddy ---
// Harder finishes drop fruit; feeding your pet rolls a reward and marches
// toward pet-exclusive icon unlocks. The pet is the only source of those icons.
export const DEFAULT_PET = { name: 'Byte', fed: 0, color: 'classic' }

// Every feeding = 1 pet XP. Stack enough and the pet EVOLVES.
export const PET_STAGES = [
  { level: 1, name: 'Pup', fed: 0, img: fl('Dog face', 'dog_face') },
  { level: 2, name: 'Hound', fed: 6, img: fl('Dog', 'dog') },
  { level: 3, name: 'Dire Wolf', fed: 14, img: fl('Wolf', 'wolf') },
  { level: 4, name: 'War Lion', fed: 24, img: fl('Lion', 'lion') },
  { level: 5, name: 'Apex Dragon', fed: 36, img: fl('Dragon', 'dragon') },
]

export function petStage(fed = 0) {
  let stage = PET_STAGES[0]
  for (const s of PET_STAGES) if (fed >= s.fed) stage = s
  const next = PET_STAGES[PET_STAGES.indexOf(stage) + 1] || null
  return { ...stage, next }
}

// Coat colors — pure CSS filters over the same artwork.
export const PET_COLORS = [
  { id: 'classic', label: 'Classic', filter: 'none' },
  { id: 'ice', label: 'Ice', filter: 'hue-rotate(175deg) saturate(1.15)' },
  { id: 'toxic', label: 'Toxic', filter: 'hue-rotate(80deg) saturate(1.3)' },
  { id: 'rose', label: 'Rose', filter: 'hue-rotate(300deg) saturate(1.25)' },
  { id: 'gold', label: 'Gold', filter: 'saturate(1.7) brightness(1.15)' },
  { id: 'shadow', label: 'Shadow', filter: 'grayscale(0.85) brightness(0.75)' },
]

// Fruit drops scale with the rank you finish at: Gold+ = 1, Diamond+ = 2, APEX = 3.
export function fruitsForTier(i) {
  return i >= 6 ? 3 : i >= 4 ? 2 : i >= 2 ? 1 : 0
}

// Feeding milestones → pet-exclusive icons, in order.
export const PET_UNLOCKS = [
  { fed: 3, icon: 'av-fox' },
  { fed: 6, icon: 'av-wolf' },
  { fed: 10, icon: 'av-lion' },
  { fed: 15, icon: 'av-robot' },
  { fed: 21, icon: 'av-dragon' },
  { fed: 28, icon: 'av-alien' },
]

// --- Titles as achievements ---
// Titles aren't bought — they're earned. The ladder titles unlock by hitting
// a rank tier on any task; the grind titles unlock from streaks; the rest
// stay spin-exclusive drops.
export const TITLE_ACHIEVEMENTS = [
  { id: 'tl-truecel', how: 'Log any task at Bronze rank', check: (s) => maxTierLogged(s) >= 0 },
  { id: 'tl-sub5', how: 'Log a task at Silver rank or higher', check: (s) => maxTierLogged(s) >= 1 },
  { id: 'tl-ltn', how: 'Log a task at Gold rank or higher', check: (s) => maxTierLogged(s) >= 2 },
  { id: 'tl-htn', how: 'Log a task at Platinum rank or higher', check: (s) => maxTierLogged(s) >= 3 },
  { id: 'tl-chadlite', how: 'Log a task at Diamond rank or higher', check: (s) => maxTierLogged(s) >= 4 },
  { id: 'tl-ltg', how: 'Log a task at Ascendant rank or higher', check: (s) => maxTierLogged(s) >= 5 },
  { id: 'tl-apex', how: 'Log a task at APEX rank', check: (s) => maxTierLogged(s) >= 6 },
  { id: 'tl-maxxer', how: 'Hit a 7-day streak', check: (s) => (s.longestStreak || 0) >= 7 },
  { id: 'tl-ascended', how: 'Hit a 30-day streak', check: (s) => (s.longestStreak || 0) >= 30 },
  { id: 'tl-iceman', how: 'Win it on the Daily Spin', check: (s) => (s.ownedTitles || []).includes('tl-iceman') },
  { id: 'tl-octane', how: 'Win it on the Daily Spin', check: (s) => (s.ownedTitles || []).includes('tl-octane') },
  { id: 'tl-brick', how: 'Win it on the Daily Spin', check: (s) => (s.ownedTitles || []).includes('tl-brick') },
]

function maxTierLogged(state) {
  const log = state.tierLog || []
  return log.length ? Math.max(...log.map((e) => e.tier)) : -1
}

export function earnedTitleIds(state) {
  return TITLE_ACHIEVEMENTS.filter((t) => t.check(state)).map((t) => t.id)
}

// --- Rank grind → Human Score ---
// Every logged rank nudges your Human Score up a little (0.4/tier step,
// capped at +40) — proof that showing up at higher intensity compounds.
export function rankScoreBonus(tierLog = []) {
  return Math.min(40, Math.round(tierLog.reduce((s, e) => s + e.tier * 0.4, 0)))
}

// Your league is named after the rank you've actually earned.
export function leagueName(state) {
  const rank = humanRank(state.tierLog || [])
  return `${rank.tier || 'Bronze'} League`
}

// One roll per feeding. Weighted toward small treats, with rare jackpots.
export function feedPetOutcome() {
  const r = Math.random()
  if (r < 0.34) return { kind: 'emeralds', value: 5 }
  if (r < 0.54) return { kind: 'spin', value: 1 }
  if (r < 0.74) return { kind: 'xpboost', value: 2 }
  if (r < 0.88) return { kind: 'shield', value: 1 }
  return { kind: 'emeralds', value: 12, rare: true }
}

// --- Focus Duel — camera endurance vs a simulated rival ---
export const FOCUS_RIVALS = ['Kaizen_Kai', 'IronWill', 'FlowState99', 'NoZeroDays', 'DawnPatrol']

export function rollFocusRival() {
  return {
    name: FOCUS_RIVALS[Math.floor(Math.random() * FOCUS_RIVALS.length)],
    // Hidden endurance: 1–5 minutes in the prototype so a demo duel is winnable.
    enduranceMs: Math.round(60000 + Math.random() * 240000),
  }
}

export function focusDuelReward(userMs, rivalMs) {
  const minutes = Math.floor(userMs / 60000)
  const won = userMs > rivalMs
  return { won, xp: won ? 50 + minutes * 10 : minutes * 5, emeralds: won ? 10 : 0 }
}

// --- Spin wheel (section 5.3) — probability-weighted outcomes ---
// Includes limited-time drops (Tung Tung Tung Sahur icon), exclusive
// spin-only titles, and streak recovery.
export const EXCLUSIVE_TITLES = ['Iceman', 'Octane', 'Brick']

// `short` is what fits on the wheel itself; `label` is the full prize name
// shown in the legend under the wheel. Colors are casino-hot on purpose —
// each segment gets a bright base and a darker edge for a 3D pop.
export const WHEEL = [
  { id: 'em-sm', weight: 32, label: '+8 Emeralds', short: '+8', kind: 'emeralds', value: 8, color: '#00e676', dark: '#00893f' },
  { id: 'em-md', weight: 16, label: '+20 Emeralds', short: '+20', kind: 'emeralds', value: 20, color: '#2979ff', dark: '#0d47a1' },
  { id: 'xp-mult', weight: 15, label: '2× XP Boost', short: '2× XP', kind: 'xpmult', value: 2, color: '#d500f9', dark: '#7b1fa2' },
  { id: 'recovery', weight: 11, label: 'Streak Recovery', short: 'SHIELD', kind: 'shield', value: 1, color: '#00e5ff', dark: '#0097a7' },
  { id: 'limited', weight: 9, label: 'LIMITED: Tung Tung Tung Sahur', short: 'SAHUR', kind: 'limitedIcon', value: 'av-sahur', color: '#ff9100', dark: '#c25e00' },
  { id: 'title', weight: 10, label: 'Exclusive Title', short: 'TITLE', kind: 'title', value: null, color: '#f50057', dark: '#ad1457' },
  { id: 'jackpot', weight: 7, label: 'JACKPOT: +100 Emeralds', short: 'JACKPOT', kind: 'jackpot', value: 100, color: '#ffd600', dark: '#c7a500' },
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

// --- Shop ---
// Coins buy icons/banners/streak recovery; emeralds (premium, earned from
// Platinum+ finishes and spins) buy titles.
export const AVATAR_COLORS = ['#38bdf8', '#22c55e', '#f59e0b', '#ef4444', '#a78bfa', '#ec4899', '#94a3b8', '#10b981']

export const SHOP_ITEMS = [
  // Icons — earned by feeding your pet (see PET_UNLOCKS), never bought.
  { id: 'av-default', type: 'icon', label: 'Initial', icon: null, price: 0, currency: 'emeralds' },
  { id: 'av-fox', type: 'icon', label: 'Fox', icon: '🦊', img: fl('Fox', 'fox'), price: null, currency: 'emeralds', petOnly: true },
  { id: 'av-wolf', type: 'icon', label: 'Wolf', icon: '🐺', img: fl('Wolf', 'wolf'), price: null, currency: 'emeralds', petOnly: true },
  { id: 'av-lion', type: 'icon', label: 'Lion', icon: '🦁', img: fl('Lion', 'lion'), price: null, currency: 'emeralds', petOnly: true },
  { id: 'av-robot', type: 'icon', label: 'Robot', icon: '🤖', img: fl('Robot', 'robot'), price: null, currency: 'emeralds', petOnly: true },
  { id: 'av-dragon', type: 'icon', label: 'Dragon', icon: '🐉', img: fl('Dragon', 'dragon'), price: null, currency: 'emeralds', petOnly: true },
  { id: 'av-alien', type: 'icon', label: 'Alien', icon: '👽', img: fl('Alien', 'alien'), price: null, currency: 'emeralds', petOnly: true },
  // The real Tung Tung Tung Sahur (Wikimedia Commons) — spin-only drop.
  { id: 'av-sahur', type: 'icon', label: 'Tung Tung Tung Sahur', icon: '🥁', img: 'https://commons.wikimedia.org/wiki/Special:FilePath/Full_image_of_Tung_Tung_Tung_Sahur.png?width=128', price: null, currency: 'emeralds', limited: true }, // spin-only
  // Profile banners — decorate your HUD/profile header
  { id: 'bn-default', type: 'banner', label: 'Midnight', gradient: 'linear-gradient(135deg,#0b1220,#12203a)', price: 0, currency: 'emeralds' },
  { id: 'bn-ocean', type: 'banner', label: 'Deep Ocean', gradient: 'linear-gradient(135deg,#082f49,#0369a1)', price: 20, currency: 'emeralds' },
  { id: 'bn-ember', type: 'banner', label: 'Ember', gradient: 'linear-gradient(135deg,#7c2d12,#dc2626)', price: 25, currency: 'emeralds' },
  { id: 'bn-aurora', type: 'banner', label: 'Aurora', gradient: 'linear-gradient(135deg,#065f46,#7c3aed)', price: 35, currency: 'emeralds' },
  { id: 'bn-carbon', type: 'banner', label: 'Carbon Fiber', gradient: 'repeating-linear-gradient(45deg,#0a0a0a,#0a0a0a 6px,#1c1c1c 6px,#1c1c1c 12px)', price: 45, currency: 'emeralds' },
  { id: 'bn-gold', type: 'banner', label: 'Apex Gold', gradient: 'linear-gradient(135deg,#78350f,#f59e0b)', price: 80, currency: 'emeralds' },
  // Titles (emeralds) — the grind hierarchy
  { id: 'tl-truecel', type: 'title', label: 'Truecel', price: 5, currency: 'emeralds' },
  { id: 'tl-sub5', type: 'title', label: 'Sub 5', price: 10, currency: 'emeralds' },
  { id: 'tl-ltn', type: 'title', label: 'Low Tier Normie', price: 20, currency: 'emeralds' },
  { id: 'tl-htn', type: 'title', label: 'High Tier Normie', price: 35, currency: 'emeralds' },
  { id: 'tl-chadlite', type: 'title', label: 'Chadlite', price: 60, currency: 'emeralds' },
  { id: 'tl-ltg', type: 'title', label: 'Low Tier God', price: 100, currency: 'emeralds' },
  { id: 'tl-maxxer', type: 'title', label: 'True Maxxer', price: 175, currency: 'emeralds' },
  { id: 'tl-ascended', type: 'title', label: 'Ascended', price: 300, currency: 'emeralds' },
  { id: 'tl-apex', type: 'title', label: 'APEX', price: 500, currency: 'emeralds' },
  // Spin-exclusive titles (not purchasable)
  { id: 'tl-iceman', type: 'title', label: 'Iceman', price: null, currency: 'emeralds', limited: true },
  { id: 'tl-octane', type: 'title', label: 'Octane', price: null, currency: 'emeralds', limited: true },
  { id: 'tl-brick', type: 'title', label: 'Brick', price: null, currency: 'emeralds', limited: true },
  // Utility / power-ups
  { id: 'ut-shield', type: 'utility', label: 'Streak Recovery', icon: '🛡️', img: IMGS.shield, price: 15, currency: 'emeralds', repeatable: true, blurb: 'absorbs one missed day automatically' },
  { id: 'ut-spin', type: 'utility', label: 'Bonus Spin', icon: '🎰', img: IMGS.slot, price: 10, currency: 'emeralds', repeatable: true, blurb: 'one extra pull on the wheel today' },
  { id: 'ut-boost', type: 'utility', label: '2× XP Booster', icon: '⚡', img: IMGS.bolt, price: 12, currency: 'emeralds', repeatable: true, blurb: 'doubles the XP on your next task' },
]
export const DEFAULT_OWNED_COSMETICS = ['av-default', 'bn-default']

// --- Mock leaderboard --- a whole league's worth, so the expanded view
// actually has pages to flip through.
export function buildLeaderboard(userName, userXp) {
  const bots = [
    { name: 'Kaizen_Kai', xp: 1840 }, { name: 'IronWill', xp: 1610 },
    { name: 'FlowState99', xp: 1320 }, { name: 'NoZeroDays', xp: 980 },
    { name: 'DawnPatrol', xp: 740 }, { name: 'QuietGrind', xp: 520 },
    { name: 'AtlasMode', xp: 1470 }, { name: 'NovaGrinds', xp: 860 },
    { name: 'SigmaStudy', xp: 640 }, { name: 'RepsForBreakfast', xp: 460 },
    { name: 'MonkMode_', xp: 380 }, { name: 'GrindNeverLies', xp: 300 },
    { name: 'ZeroExcuses', xp: 210 }, { name: 'LateNightLibrary', xp: 140 },
    { name: 'FirstGenFuture', xp: 90 },
  ]
  const all = [...bots, { name: userName || 'You', xp: userXp, isUser: true }]
  return all.sort((a, b) => b.xp - a.xp)
}

// --- Social platform (mocked, local-only) ---
// A pool of "online" users you can follow, view, and invite to your party.
// Photos are real portraits from pravatar (a placeholder-photo CDN).
const pfp = (n) => `https://i.pravatar.cc/150?img=${n}`
// Every user carries a full profile — Human Score per pillar, rank, streaks,
// follower counts, and a banner — so tapping them shows a real profile page.
export const SOCIAL_USERS = [
  { id: 'u-kai', name: 'Kaizen_Kai', photo: pfp(12), level: 14, title: 'Chadlite', bio: '1% better daily. Ship or sleep.', weeklyXp: 320, lockedMins: 340,
    score: { mind: 640, body: 710, intellect: 580 }, streak: 23, longestStreak: 41, rankTier: 'Platinum', followers: 218, followingCount: 87, banner: 'linear-gradient(135deg,#082f49,#0369a1)' },
  { id: 'u-iron', name: 'IronWill', photo: pfp(33), level: 11, title: 'High Tier Normie', bio: '5am club. Deadlifts + calculus.', weeklyXp: 280, lockedMins: 295,
    score: { mind: 520, body: 810, intellect: 600 }, streak: 45, longestStreak: 45, rankTier: 'Gold', followers: 134, followingCount: 201, banner: 'linear-gradient(135deg,#7c2d12,#dc2626)' },
  { id: 'u-flow', name: 'FlowState99', photo: pfp(56), level: 17, title: 'True Maxxer', bio: 'Deep work is my personality.', weeklyXp: 210, lockedMins: 410,
    score: { mind: 830, body: 490, intellect: 760 }, streak: 12, longestStreak: 63, rankTier: 'Diamond', followers: 402, followingCount: 56, banner: 'linear-gradient(135deg,#065f46,#7c3aed)' },
  { id: 'u-nozero', name: 'NoZeroDays', photo: pfp(68), level: 9, title: null, bio: 'streak > everything', weeklyXp: 190, lockedMins: 180,
    score: { mind: 560, body: 540, intellect: 500 }, streak: 71, longestStreak: 71, rankTier: 'Silver', followers: 89, followingCount: 143, banner: 'linear-gradient(135deg,#0b1220,#12203a)' },
  { id: 'u-dawn', name: 'DawnPatrol', photo: pfp(5), level: 21, title: 'Low Tier God', bio: 'Sunrise runs. Berkeley ’28.', weeklyXp: 260, lockedMins: 330,
    score: { mind: 700, body: 780, intellect: 820 }, streak: 34, longestStreak: 58, rankTier: 'Ascendant', followers: 517, followingCount: 112, banner: 'linear-gradient(135deg,#78350f,#f59e0b)' },
  { id: 'u-quiet', name: 'QuietGrind', photo: pfp(15), level: 8, title: null, bio: 'no posts, all reps', weeklyXp: 150, lockedMins: 150,
    score: { mind: 610, body: 470, intellect: 590 }, streak: 9, longestStreak: 22, rankTier: 'Bronze', followers: 41, followingCount: 38, banner: 'linear-gradient(135deg,#0b1220,#12203a)' },
  { id: 'u-atlas', name: 'AtlasMode', photo: pfp(59), level: 25, title: 'Ascended', bio: 'Carrying my GPA and my squat.', weeklyXp: 380, lockedMins: 460,
    score: { mind: 750, body: 860, intellect: 790 }, streak: 52, longestStreak: 97, rankTier: 'Apex', followers: 903, followingCount: 74, banner: 'repeating-linear-gradient(45deg,#0a0a0a,#0a0a0a 6px,#1c1c1c 6px,#1c1c1c 12px)' },
  { id: 'u-nova', name: 'NovaGrinds', photo: pfp(44), level: 13, title: 'Iceman', bio: '100k by summer. Watch me.', weeklyXp: 240, lockedMins: 270,
    score: { mind: 590, body: 620, intellect: 680 }, streak: 18, longestStreak: 29, rankTier: 'Gold', followers: 356, followingCount: 264, banner: 'linear-gradient(135deg,#082f49,#0369a1)' },
]

// Seed posts so the wall feels alive on day one. Images come from picsum
// (placeholder photo CDN) seeded per-post so they're stable.
export function seedFeed() {
  const img = (seed) => `https://picsum.photos/seed/${seed}/480/280`
  return [
    { id: 'p-1', userId: 'u-atlas', text: 'Week 6 of the push/pull split. Diamond on every session this week, no days off.', image: img('gym-grind'), likes: 42, likedByMe: false, ts: Date.now() - 3600e3 * 5,
      comments: [
        { id: 'c-1a', name: 'FlowState99', text: 'Insane consistency 🔥', ts: Date.now() - 3600e3 * 4 },
        { id: 'c-1b', name: 'NovaGrinds', text: 'What does your deload week look like?', ts: Date.now() - 3600e3 * 3 },
      ] },
    { id: 'p-2', userId: 'u-flow', text: '4h10m locked in today. The library doesn’t know my name but the rank ladder does.', image: img('library-study'), likes: 31, likedByMe: false, ts: Date.now() - 3600e3 * 9,
      comments: [{ id: 'c-2a', name: 'QuietGrind', text: 'this is the way', ts: Date.now() - 3600e3 * 8 }] },
    { id: 'p-3', userId: 'u-dawn', text: 'Sunrise 10k before my SAT mock. Achieving Ascendant on both. Who’s coming to the party leaderboard?', image: img('sunrise-run'), likes: 57, likedByMe: false, ts: Date.now() - 3600e3 * 26,
      comments: [{ id: 'c-3a', name: 'IronWill', text: 'Save me a spot 🏃', ts: Date.now() - 3600e3 * 20 }] },
    { id: 'p-4', userId: 'u-nova', text: 'Posted my first timelapse — 90 minutes of content editing compressed to 12 seconds. Proof or it didn’t happen.', image: img('desk-setup'), likes: 24, likedByMe: false, ts: Date.now() - 3600e3 * 30, comments: [] },
    { id: 'p-5', userId: 'u-iron', text: 'Streak day 45. The Building Bronze days were the hardest — now Gold feels like a warmup.', image: img('morning-weights'), likes: 38, likedByMe: false, ts: Date.now() - 3600e3 * 50,
      comments: [{ id: 'c-5a', name: 'DawnPatrol', text: 'day 45?? locked in fr', ts: Date.now() - 3600e3 * 44 }] },
  ]
}

// --- Party system — social + accountability + who's the most locked ---

// Emblems a party can fly.
export const PARTY_EMBLEMS = [
  { id: 'em-party', icon: '🎉', img: IMGS.party },
  { id: 'em-fire', icon: '🔥', img: IMGS.fire },
  { id: 'em-swords', icon: '⚔️', img: IMGS.swords },
  { id: 'em-crown', icon: '👑', img: IMGS.crown },
  { id: 'em-rocket', icon: '🚀', img: IMGS.rocket },
  { id: 'em-skull', icon: '💀', img: IMGS.skull },
  { id: 'em-brain', icon: '🧠', img: IMGS.brain },
  { id: 'em-bolt', icon: '⚡', img: IMGS.bolt },
]

// A party earns a rank from its weekly XP pool, on the same tier ladder.
export function partyRank(totalXp) {
  const tier =
    totalXp >= 3800 ? 'Apex' :
    totalXp >= 2800 ? 'Ascendant' :
    totalXp >= 2000 ? 'Diamond' :
    totalXp >= 1400 ? 'Platinum' :
    totalXp >= 800 ? 'Gold' :
    totalXp >= 400 ? 'Silver' : 'Bronze'
  return { tier, label: `${tier} Party`, color: TIER_COLORS[tier], img: TIER_META[tier].img }
}

// New users start squadless: they create their own squad — name, bio, and
// emblem included — and invite people they follow. No rival war is attached.
export function createSquad(name, userName, invitees = [], bio = '', emblem = 'em-party') {
  return {
    name: name || 'My Squad',
    bio: bio || '',
    emblem,
    members: [
      { name: userName || 'You', weeklyXp: 0, lockedMins: 0, checkedInOn: null, isUser: true },
      ...invitees.map((u) => ({
        name: u.name, userId: u.id, photo: u.photo,
        weeklyXp: u.weeklyXp, lockedMins: u.lockedMins, checkedInOn: null,
      })),
    ],
    nudged: [],
  }
}

export function buildSquad(userName) {
  return {
    name: 'Dawn Raiders',
    members: [
      { name: 'Kaizen_Kai', userId: 'u-kai', photo: pfp(12), weeklyXp: 320, lockedMins: 340, checkedInOn: todayKey() },
      { name: 'IronWill', userId: 'u-iron', photo: pfp(33), weeklyXp: 280, lockedMins: 295, checkedInOn: null },
      { name: 'FlowState99', userId: 'u-flow', photo: pfp(56), weeklyXp: 210, lockedMins: 410, checkedInOn: todayKey() },
      { name: userName || 'You', weeklyXp: 0, lockedMins: 0, checkedInOn: null, isUser: true },
    ],
    rival: { name: 'Night Owls', weeklyXp: 1180 },
    nudged: [],
  }
}

// "Most locked" = who has banked the most focused minutes this week. The
// user's figure is derived from their tier log (real recorded thresholds).
export function lockedBoard(squad, state) {
  if (!squad) return []
  const userMins = (state.tierLog || []).reduce((sum, e) => {
    const task = (state.tasks || []).find((t) => t.id === e.taskId)
    const thr = task && /min/i.test(task.unit) ? task.tiers[e.tier]?.threshold || 0 : 0
    return sum + thr
  }, 0)
  return squad.members
    .map((m) => ({ ...m, locked: m.isUser ? Math.round(userMins) : m.lockedMins || 0 }))
    .sort((a, b) => b.locked - a.locked)
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
    bonusSpins: 0,
    xpBoost: 1,
    _rolloverNote: shieldUsed ? 'shield' : missed ? 'broken' : 'clean',
  }
}
