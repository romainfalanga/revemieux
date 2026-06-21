import { Hono } from 'hono'

type Bindings = { DB: D1Database; JWT_SECRET: string }
type Variables = { userId: number }

export const realityCheckRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Lister les reality checks récents
realityCheckRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const limit = parseInt(c.req.query('limit') || '50')
  
  const checks = await c.env.DB.prepare(`
    SELECT * FROM reality_checks WHERE user_id = ?
    ORDER BY created_at DESC LIMIT ?
  `).bind(userId, limit).all<any>()
  
  return c.json({ checks: checks.results })
})

// Enregistrer un reality check
realityCheckRoutes.post('/', async (c) => {
  const userId = c.get('userId')
  const { checkType, wasDreaming, note } = await c.req.json()
  
  const result = await c.env.DB.prepare(`
    INSERT INTO reality_checks (user_id, check_type, was_dreaming, note) VALUES (?, ?, ?, ?)
  `).bind(userId, checkType || 'general', wasDreaming ? 1 : 0, note || null).run()
  
  return c.json({ id: result.meta.last_row_id, message: 'Reality check enregistré' }, 201)
})

// Stats des reality checks
realityCheckRoutes.get('/stats', async (c) => {
  const userId = c.get('userId')
  
  const total = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM reality_checks WHERE user_id = ?'
  ).bind(userId).first<any>()
  
  const today = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM reality_checks WHERE user_id = ? AND date(created_at) = date('now')`
  ).bind(userId).first<any>()
  
  const byType = await c.env.DB.prepare(`
    SELECT check_type, COUNT(*) as count FROM reality_checks
    WHERE user_id = ? GROUP BY check_type ORDER BY count DESC
  `).bind(userId).all<any>()
  
  const weekly = await c.env.DB.prepare(`
    SELECT date(created_at) as day, COUNT(*) as count 
    FROM reality_checks WHERE user_id = ? AND created_at >= datetime('now', '-7 days')
    GROUP BY day ORDER BY day ASC
  `).bind(userId).all<any>()
  
  return c.json({
    total: total?.count || 0,
    today: today?.count || 0,
    byType: byType.results,
    weekly: weekly.results
  })
})
