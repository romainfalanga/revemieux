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
