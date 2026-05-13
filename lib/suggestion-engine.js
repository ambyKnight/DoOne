/**
 * DoOne Suggestion Engine — deterministic scoring.
 * No AI. Pure math. Returns ONE item.
 *
 * score = priority * 0.30 + urgency * 0.25 + time_fit * 0.20
 *       + behavior * 0.10 + momentum * 0.10 + session_progress * 0.05
 */

const WEIGHTS = {
  priority: 0.30,
  urgency: 0.25,
  time_fit: 0.20,
  behavior: 0.10,
  momentum: 0.10,
  session_progress: 0.05,
}

export function scoreItems(items, behaviorData = {}) {
  const now = new Date()
  const hour = now.getHours()
  const day = now.getDay()

  return items.map(item => {
    const scores = {
      priority: scorePriority(item),
      urgency: scoreUrgency(item, now),
      time_fit: scoreTimeFit(item, hour),
      behavior: scoreBehavior(item, behaviorData, hour, day),
      momentum: scoreMomentum(item),
      session_progress: scoreSessionProgress(item),
    }

    const total = Object.entries(WEIGHTS).reduce(
      (sum, [key, weight]) => sum + (scores[key] || 0) * weight,
      0
    )

    return { ...item, _scores: scores, _total: total }
  })
}

export function pickBest(items, behaviorData = {}) {
  if (!items.length) return null
  const scored = scoreItems(items, behaviorData)
  scored.sort((a, b) => b._total - a._total)
  const best = scored[0]

  const reasons = []
  const s = best._scores
  if (s.urgency > 0.7) reasons.push('due soon')
  if (s.priority > 0.7) reasons.push('high priority')
  if (s.momentum > 0.5) reasons.push('you have momentum on this')
  if (s.time_fit > 0.6) reasons.push('fits the time')
  if (s.behavior > 0.5) reasons.push('matches your productive hours')
  if (!reasons.length) reasons.push('best match right now')

  return {
    item: {
      id: best.id,
      title: best.title,
      type: best._type,
      duration: best.estimated_minutes || best.duration || 30,
      priority: best.priority || 2,
      job_id: best.job_id || null,
      job_title: best.job_title || null,
      progress: best._progress || null,
    },
    score: best._total,
    scores: best._scores,
    reason: reasons.join(', '),
  }
}

// --- Factor functions ---

function scorePriority(item) {
  const p = item.priority || 2
  return Math.min(1, (p - 1) / 4)
}

function scoreUrgency(item, now) {
  if (!item.deadline) return 0.3
  const hoursLeft = (new Date(item.deadline) - now) / (1000 * 60 * 60)
  if (hoursLeft <= 0) return 1.0
  if (hoursLeft <= 2) return 0.95
  if (hoursLeft <= 6) return 0.8
  if (hoursLeft <= 24) return 0.6
  if (hoursLeft <= 72) return 0.4
  return 0.2
}

function scoreTimeFit(item, hour) {
  const duration = item.estimated_minutes || item.duration || 30
  // Morning (7-12): good for long tasks. Afternoon (12-17): medium. Evening (17-22): short.
  if (hour >= 7 && hour < 12) {
    return duration >= 45 ? 0.8 : 0.5
  }
  if (hour >= 12 && hour < 17) {
    return duration >= 30 && duration <= 60 ? 0.7 : 0.4
  }
  // Evening — prefer short tasks
  return duration <= 30 ? 0.7 : 0.3
}

function scoreBehavior(item, behaviorData, hour, day) {
  if (!behaviorData.hourly_completion) return 0.5
  const hourRate = behaviorData.hourly_completion[hour] ?? 0.5
  return Math.min(1, hourRate)
}

function scoreMomentum(item) {
  // Session with prior completed siblings = momentum
  if (item._type === 'session' && item._progress) {
    const { completed, total } = item._progress
    if (completed > 0 && completed < total) return 0.8
    if (completed === 0) return 0.4
  }
  return 0.3
}

function scoreSessionProgress(item) {
  if (item._type !== 'session') return 0.3
  if (!item._progress) return 0.5
  const { completed, total } = item._progress
  const ratio = completed / Math.max(1, total)
  // Near completion = higher score (finish what you started)
  if (ratio > 0.7) return 0.9
  if (ratio > 0.3) return 0.6
  return 0.4
}
