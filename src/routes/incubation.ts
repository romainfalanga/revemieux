import { Hono } from 'hono'

type Bindings = { DB: D1Database; JWT_SECRET: string }
type Variables = { userId: number }

export const incubationRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Lister les intentions
incubationRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  
  const intents = await c.env.DB.prepare(`
    SELECT i.*, ds.name as series_name, d.title as result_dream_title
    FROM incubation_intents i
    LEFT JOIN dream_series ds ON ds.id = i.series_id
    LEFT JOIN dreams d ON d.id = i.result_dream_id
    WHERE i.user_id = ?
    ORDER BY i.target_date DESC
  `).bind(userId).all<any>()
  
  return c.json({ intents: intents.results })
})

// Créer une intention d'incubation
incubationRoutes.post('/', async (c) => {
  const userId = c.get('userId')
  const { seriesId, intentText, targetDate } = await c.req.json()
  
  if (!intentText) return c.json({ error: 'Intention requise' }, 400)
  
  const result = await c.env.DB.prepare(`
    INSERT INTO incubation_intents (user_id, series_id, intent_text, target_date)
    VALUES (?, ?, ?, ?)
  `).bind(userId, seriesId || null, intentText, targetDate || new Date().toISOString().split('T')[0]).run()
  
  return c.json({ id: result.meta.last_row_id, message: 'Intention enregistrée' }, 201)
})

// Mettre à jour une intention (lier au rêve résultant)
incubationRoutes.put('/:id', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))
  const { resultDreamId, successRating } = await c.req.json()
  
  await c.env.DB.prepare(`
    UPDATE incubation_intents SET result_dream_id = ?, success_rating = ? 
    WHERE id = ? AND user_id = ?
  `).bind(resultDreamId || null, successRating || 0, id, userId).run()
  
  return c.json({ message: 'Intention mise à jour' })
})

// Obtenir l'intention active pour ce soir
incubationRoutes.get('/tonight', async (c) => {
  const userId = c.get('userId')
  const today = new Date().toISOString().split('T')[0]
  
  const intent = await c.env.DB.prepare(`
    SELECT i.*, ds.name as series_name, ds.description as series_description
    FROM incubation_intents i
    LEFT JOIN dream_series ds ON ds.id = i.series_id
    WHERE i.user_id = ? AND i.target_date = ? AND i.result_dream_id IS NULL
    ORDER BY i.created_at DESC LIMIT 1
  `).bind(userId, today).first<any>()
  
  // Si liée à une série, récupérer le dernier rêve de la série
  let lastSeriesDream = null
  if (intent?.series_id) {
    lastSeriesDream = await c.env.DB.prepare(`
      SELECT d.title, d.content, d.dream_date FROM dreams d
      JOIN series_dreams sd ON sd.dream_id = d.id
      WHERE sd.series_id = ?
      ORDER BY sd.order_index DESC LIMIT 1
    `).bind(intent.series_id).first<any>()
  }
  
  return c.json({ intent, lastSeriesDream })
})
