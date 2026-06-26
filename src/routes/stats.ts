import { Hono } from 'hono'

type Bindings = { DB: D1Database; JWT_SECRET: string }
type Variables = { userId: number }

export const statsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Dashboard statistiques complètes
statsRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const period = c.req.query('period') || '30' // jours
  const days = parseInt(period)

  // Stats générales
  const total = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM dreams WHERE user_id = ?'
  ).bind(userId).first<any>()

  const lucidCount = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM dreams WHERE user_id = ? AND dream_type = ?'
  ).bind(userId, 'lucid').first<any>()

  const recentCount = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM dreams WHERE user_id = ? AND dream_date >= date('now', '-' || ? || ' days')`
  ).bind(userId, days).first<any>()

  // Rêves par semaine (12 dernières semaines)
  const weeklyData = await c.env.DB.prepare(`
    SELECT strftime('%Y-W%W', dream_date) as week,
      COUNT(*) as total,
      SUM(CASE WHEN dream_type = 'lucid' THEN 1 ELSE 0 END) as lucid
    FROM dreams WHERE user_id = ? AND dream_date >= date('now', '-84 days')
    GROUP BY week ORDER BY week ASC
  `).bind(userId).all<any>()

  // Émotions dominantes
  const emotionStats = await c.env.DB.prepare(`
    SELECT de.emotion, COUNT(*) as count, AVG(de.intensity) as avg_intensity
    FROM dream_emotions de
    JOIN dreams d ON d.id = de.dream_id
    WHERE d.user_id = ? AND d.dream_date >= date('now', '-' || ? || ' days')
    GROUP BY de.emotion ORDER BY count DESC LIMIT 10
  `).bind(userId, days).all<any>()

  // Types de rêves
  const typeStats = await c.env.DB.prepare(`
    SELECT dream_type, COUNT(*) as count FROM dreams
    WHERE user_id = ? AND dream_date >= date('now', '-' || ? || ' days')
    GROUP BY dream_type ORDER BY count DESC
  `).bind(userId, days).all<any>()

  // Tags les plus utilisés
  const topTags = await c.env.DB.prepare(`
    SELECT t.name, t.category, t.color, COUNT(*) as count
    FROM tags t
    JOIN dream_tags dt ON dt.tag_id = t.id
    JOIN dreams d ON d.id = dt.dream_id
    WHERE t.user_id = ? AND d.dream_date >= date('now', '-' || ? || ' days')
    GROUP BY t.id ORDER BY count DESC LIMIT 15
  `).bind(userId, days).all<any>()

  // Streak (jours consécutifs de journalisation)
  const recentDates = await c.env.DB.prepare(`
    SELECT DISTINCT dream_date FROM dreams
    WHERE user_id = ? ORDER BY dream_date DESC LIMIT 90
  `).bind(userId).all<any>()

  let streak = 0
  const today = new Date()
  for (let i = 0; i < recentDates.results.length; i++) {
    const expected = new Date(today)
    expected.setDate(expected.getDate() - i)
    const expectedStr = expected.toISOString().split('T')[0]
    if (recentDates.results[i].dream_date === expectedStr) {
      streak++
    } else {
      break
    }
  }

  // Qualité moyenne du sommeil
  const avgSleep = await c.env.DB.prepare(`
    SELECT AVG(sleep_quality) as avg FROM dreams 
    WHERE user_id = ? AND sleep_quality > 0 AND dream_date >= date('now', '-' || ? || ' days')
  `).bind(userId, days).first<any>()

  // Lucidité moyenne
  const avgLucidity = await c.env.DB.prepare(`
    SELECT AVG(lucidity_level) as avg FROM dreams
    WHERE user_id = ? AND dream_date >= date('now', '-' || ? || ' days')
  `).bind(userId, days).first<any>()

  // Taux de rêves lucides
  const lucidRate = total?.count > 0 ? ((lucidCount?.count || 0) / total.count * 100).toFixed(1) : '0'

  return c.json({
    overview: {
      totalDreams: total?.count || 0,
      lucidDreams: lucidCount?.count || 0,
      lucidRate: parseFloat(lucidRate),
      recentDreams: recentCount?.count || 0,
      streak,
      avgSleepQuality: avgSleep?.avg ? parseFloat(avgSleep.avg.toFixed(1)) : 0,
      avgLucidity: avgLucidity?.avg ? parseFloat(avgLucidity.avg.toFixed(1)) : 0
    },
    weeklyData: weeklyData.results,
    emotionStats: emotionStats.results,
    typeStats: typeStats.results,
    topTags: topTags.results
  })
})

// Dashboard complet avec agrégation flexible
statsRoutes.get('/dashboard', async (c) => {
  const userId = c.get('userId')
  // period: 'week' (7j), 'month' (30j), 'year' (365j)
  const period = c.req.query('period') || 'month'
  const days = period === 'week' ? 7 : period === 'year' ? 365 : 30

  // --- Compteurs principaux sur la période ---
  const periodDreams = await c.env.DB.prepare(
    `SELECT COUNT(*) as total,
       SUM(CASE WHEN dream_type = 'lucid' THEN 1 ELSE 0 END) as lucid,
       SUM(CASE WHEN dream_type = 'nightmare' THEN 1 ELSE 0 END) as nightmares,
       SUM(CASE WHEN dream_type = 'recurring' THEN 1 ELSE 0 END) as recurring,
       AVG(sleep_quality) as avg_sleep,
       AVG(lucidity_level) as avg_lucidity,
       SUM(CASE WHEN is_favorite = 1 THEN 1 ELSE 0 END) as favorites
     FROM dreams WHERE user_id = ? AND dream_date >= date('now', '-' || ? || ' days')`
  ).bind(userId, days).first<any>()

  // Compteurs all-time
  const allTimeDreams = await c.env.DB.prepare(
    `SELECT COUNT(*) as total,
       SUM(CASE WHEN dream_type = 'lucid' THEN 1 ELSE 0 END) as lucid
     FROM dreams WHERE user_id = ?`
  ).bind(userId).first<any>()

  // --- Streak ---
  const recentDates = await c.env.DB.prepare(
    `SELECT DISTINCT dream_date FROM dreams WHERE user_id = ? ORDER BY dream_date DESC LIMIT 90`
  ).bind(userId).all<any>()
  let streak = 0
  const today = new Date()
  for (let i = 0; i < recentDates.results.length; i++) {
    const expected = new Date(today)
    expected.setDate(expected.getDate() - i)
    const expectedStr = expected.toISOString().split('T')[0]
    if (recentDates.results[i].dream_date === expectedStr) streak++
    else break
  }

  // --- Evolution temporelle (barres) ---
  let timelineQuery = ''
  let timelineLabel = ''
  if (period === 'week') {
    // Par jour sur 7 jours
    timelineQuery = `
      SELECT dream_date as label, COUNT(*) as total,
        SUM(CASE WHEN dream_type = 'lucid' THEN 1 ELSE 0 END) as lucid
      FROM dreams WHERE user_id = ? AND dream_date >= date('now', '-7 days')
      GROUP BY dream_date ORDER BY dream_date ASC`
    timelineLabel = 'day'
  } else if (period === 'month') {
    // Par semaine sur 30 jours (~5 semaines)
    timelineQuery = `
      SELECT strftime('%Y-W%W', dream_date) as label, COUNT(*) as total,
        SUM(CASE WHEN dream_type = 'lucid' THEN 1 ELSE 0 END) as lucid
      FROM dreams WHERE user_id = ? AND dream_date >= date('now', '-35 days')
      GROUP BY label ORDER BY label ASC`
    timelineLabel = 'week'
  } else {
    // Par mois sur 365 jours
    timelineQuery = `
      SELECT strftime('%Y-%m', dream_date) as label, COUNT(*) as total,
        SUM(CASE WHEN dream_type = 'lucid' THEN 1 ELSE 0 END) as lucid
      FROM dreams WHERE user_id = ? AND dream_date >= date('now', '-365 days')
      GROUP BY label ORDER BY label ASC`
    timelineLabel = 'month'
  }
  const timeline = await c.env.DB.prepare(timelineQuery).bind(userId).all<any>()

  // --- Emotions (toutes, sur la période) ---
  const emotions = await c.env.DB.prepare(`
    SELECT de.emotion, COUNT(*) as count, ROUND(AVG(de.intensity), 1) as avg_intensity
    FROM dream_emotions de JOIN dreams d ON d.id = de.dream_id
    WHERE d.user_id = ? AND d.dream_date >= date('now', '-' || ? || ' days')
    GROUP BY de.emotion ORDER BY count DESC
  `).bind(userId, days).all<any>()

  // --- Types de reves ---
  const types = await c.env.DB.prepare(`
    SELECT dream_type, COUNT(*) as count FROM dreams
    WHERE user_id = ? AND dream_date >= date('now', '-' || ? || ' days')
    GROUP BY dream_type ORDER BY count DESC
  `).bind(userId, days).all<any>()

  // --- Tags par catégorie ---
  const tagsByCategory = await c.env.DB.prepare(`
    SELECT t.category, t.name, t.color, COUNT(*) as count
    FROM tags t JOIN dream_tags dt ON dt.tag_id = t.id JOIN dreams d ON d.id = dt.dream_id
    WHERE t.user_id = ? AND d.dream_date >= date('now', '-' || ? || ' days')
    GROUP BY t.category, t.id ORDER BY t.category, count DESC
  `).bind(userId, days).all<any>()

  // Grouper par catégorie
  const tagCategories: Record<string, any[]> = {}
  for (const tag of tagsByCategory.results) {
    if (!tagCategories[tag.category]) tagCategories[tag.category] = []
    tagCategories[tag.category].push(tag)
  }

  // --- Reality Checks ---
  const rcTotal = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM reality_checks WHERE user_id = ?'
  ).bind(userId).first<any>()

  const rcPeriod = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM reality_checks WHERE user_id = ? AND created_at >= datetime('now', '-' || ? || ' days')`
  ).bind(userId, days).first<any>()

  const rcToday = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM reality_checks WHERE user_id = ? AND date(created_at) = date('now')`
  ).bind(userId).first<any>()

  const rcByType = await c.env.DB.prepare(`
    SELECT check_type, COUNT(*) as count FROM reality_checks
    WHERE user_id = ? AND created_at >= datetime('now', '-' || ? || ' days')
    GROUP BY check_type ORDER BY count DESC
  `).bind(userId, days).all<any>()

  // RC timeline
  let rcTimelineQuery = ''
  if (period === 'week') {
    rcTimelineQuery = `SELECT date(created_at) as label, COUNT(*) as count FROM reality_checks WHERE user_id = ? AND created_at >= datetime('now', '-7 days') GROUP BY label ORDER BY label ASC`
  } else if (period === 'month') {
    rcTimelineQuery = `SELECT strftime('%Y-W%W', created_at) as label, COUNT(*) as count FROM reality_checks WHERE user_id = ? AND created_at >= datetime('now', '-35 days') GROUP BY label ORDER BY label ASC`
  } else {
    rcTimelineQuery = `SELECT strftime('%Y-%m', created_at) as label, COUNT(*) as count FROM reality_checks WHERE user_id = ? AND created_at >= datetime('now', '-365 days') GROUP BY label ORDER BY label ASC`
  }
  const rcTimeline = await c.env.DB.prepare(rcTimelineQuery).bind(userId).all<any>()

  // --- Intentions ---
  const intentionStats = await c.env.DB.prepare(`
    SELECT status, COUNT(*) as count FROM dream_intentions WHERE user_id = ?
    GROUP BY status
  `).bind(userId).all<any>()

  const intentionCounts: Record<string, number> = {}
  for (const row of intentionStats.results) {
    intentionCounts[row.status] = row.count
  }

  // Intentions créées dans la période
  const intentionsPeriod = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM dream_intentions WHERE user_id = ? AND created_at >= datetime('now', '-' || ? || ' days')`
  ).bind(userId, days).first<any>()

  // --- Séries ---
  const seriesCount = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM dream_series WHERE user_id = ?'
  ).bind(userId).first<any>()

  // --- Connexions ---
  const connectionsCount = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM dream_connections dc
     JOIN dreams d ON d.id = dc.dream_id
     WHERE d.user_id = ?`
  ).bind(userId).first<any>()

  // Taux de lucidité
  const lucidRate = periodDreams?.total > 0
    ? parseFloat(((periodDreams.lucid || 0) / periodDreams.total * 100).toFixed(1))
    : 0

  return c.json({
    period,
    days,
    overview: {
      totalPeriod: periodDreams?.total || 0,
      lucidPeriod: periodDreams?.lucid || 0,
      nightmaresPeriod: periodDreams?.nightmares || 0,
      recurringPeriod: periodDreams?.recurring || 0,
      favoritesPeriod: periodDreams?.favorites || 0,
      lucidRate,
      avgSleep: periodDreams?.avg_sleep ? parseFloat(Number(periodDreams.avg_sleep).toFixed(1)) : 0,
      avgLucidity: periodDreams?.avg_lucidity ? parseFloat(Number(periodDreams.avg_lucidity).toFixed(1)) : 0,
      totalAllTime: allTimeDreams?.total || 0,
      lucidAllTime: allTimeDreams?.lucid || 0,
      streak,
      seriesCount: seriesCount?.count || 0,
      connectionsCount: connectionsCount?.count || 0
    },
    timeline: { label: timelineLabel, data: timeline.results },
    emotions: emotions.results,
    types: types.results,
    tagCategories,
    realityChecks: {
      totalAllTime: rcTotal?.count || 0,
      totalPeriod: rcPeriod?.count || 0,
      today: rcToday?.count || 0,
      byType: rcByType.results,
      timeline: rcTimeline.results
    },
    intentions: {
      active: intentionCounts['active'] || 0,
      realized: intentionCounts['realized'] || 0,
      archived: intentionCounts['archived'] || 0,
      total: Object.values(intentionCounts).reduce((a: number, b: number) => a + b, 0),
      createdPeriod: intentionsPeriod?.count || 0
    }
  })
})

// Heatmap calendrier (365 jours)
statsRoutes.get('/heatmap', async (c) => {
  const userId = c.get('userId')
  
  const data = await c.env.DB.prepare(`
    SELECT dream_date, COUNT(*) as count,
      SUM(CASE WHEN dream_type = 'lucid' THEN 1 ELSE 0 END) as lucid_count
    FROM dreams WHERE user_id = ? AND dream_date >= date('now', '-365 days')
    GROUP BY dream_date ORDER BY dream_date ASC
  `).bind(userId).all<any>()
  
  return c.json({ heatmap: data.results })
})
