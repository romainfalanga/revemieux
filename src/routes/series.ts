import { Hono } from 'hono'

type Bindings = { DB: D1Database; JWT_SECRET: string }
type Variables = { userId: number }

export const seriesRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Lister les séries
seriesRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  
  const series = await c.env.DB.prepare(`
    SELECT ds.*, COUNT(sd.dream_id) as dream_count,
      MAX(d.dream_date) as last_dream_date
    FROM dream_series ds
    LEFT JOIN series_dreams sd ON sd.series_id = ds.id
    LEFT JOIN dreams d ON d.id = sd.dream_id
    WHERE ds.user_id = ?
    GROUP BY ds.id
    ORDER BY ds.updated_at DESC
  `).bind(userId).all<any>()
  
  return c.json({ series: series.results })
})

// Obtenir une série avec ses rêves
seriesRoutes.get('/:id', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))
  
  const series = await c.env.DB.prepare(
    'SELECT * FROM dream_series WHERE id = ? AND user_id = ?'
  ).bind(id, userId).first<any>()
  
  if (!series) return c.json({ error: 'Série non trouvée' }, 404)
  
  const dreams = await c.env.DB.prepare(`
    SELECT d.*, sd.order_index,
      GROUP_CONCAT(DISTINCT de.emotion || ':' || de.intensity) as emotions
    FROM dreams d
    JOIN series_dreams sd ON sd.dream_id = d.id
    LEFT JOIN dream_emotions de ON de.dream_id = d.id
    WHERE sd.series_id = ?
    GROUP BY d.id
    ORDER BY sd.order_index ASC
  `).bind(id).all<any>()
  
  const parsedDreams = dreams.results.map(d => ({
    ...d,
    emotions: d.emotions ? d.emotions.split(',').map((e: string) => {
      const [emotion, intensity] = e.split(':')
      return { emotion, intensity: parseInt(intensity) }
    }) : []
  }))
  
  // Dernière intention d'incubation
  const lastIntent = await c.env.DB.prepare(`
    SELECT * FROM incubation_intents WHERE series_id = ? AND user_id = ?
    ORDER BY created_at DESC LIMIT 1
  `).bind(id, userId).first<any>()
  
  return c.json({ ...series, dreams: parsedDreams, lastIntent })
})

// Créer une série
seriesRoutes.post('/', async (c) => {
  const userId = c.get('userId')
  const { name, description, color, incubationPrompt } = await c.req.json()
  
  if (!name) return c.json({ error: 'Nom requis' }, 400)
  
  const result = await c.env.DB.prepare(`
    INSERT INTO dream_series (user_id, name, description, color, incubation_prompt)
    VALUES (?, ?, ?, ?, ?)
  `).bind(userId, name, description || null, color || '#8b5cf6', incubationPrompt || null).run()
  
  return c.json({ id: result.meta.last_row_id, message: 'Série créée' }, 201)
})

// Mettre à jour une série
seriesRoutes.put('/:id', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))
  const { name, description, color, incubationPrompt } = await c.req.json()
  
  await c.env.DB.prepare(`
    UPDATE dream_series SET name = ?, description = ?, color = ?, incubation_prompt = ?,
    updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?
  `).bind(name, description || null, color || '#8b5cf6', incubationPrompt || null, id, userId).run()
  
  return c.json({ message: 'Série mise à jour' })
})

// Ajouter un rêve à une série
seriesRoutes.post('/:id/dreams', async (c) => {
  const userId = c.get('userId')
  const seriesId = parseInt(c.req.param('id'))
  const { dreamId } = await c.req.json()
  
  // Obtenir le prochain index
  const maxOrder = await c.env.DB.prepare(
    'SELECT MAX(order_index) as max_idx FROM series_dreams WHERE series_id = ?'
  ).bind(seriesId).first<any>()
  
  const nextOrder = (maxOrder?.max_idx ?? -1) + 1
  
  try {
    await c.env.DB.prepare(
      'INSERT INTO series_dreams (series_id, dream_id, order_index) VALUES (?, ?, ?)'
    ).bind(seriesId, dreamId, nextOrder).run()
    
    return c.json({ message: 'Rêve ajouté à la série' })
  } catch (e) {
    return c.json({ error: 'Ce rêve est déjà dans cette série' }, 409)
  }
})

// Retirer un rêve d'une série
seriesRoutes.delete('/:id/dreams/:dreamId', async (c) => {
  const seriesId = parseInt(c.req.param('id'))
  const dreamId = parseInt(c.req.param('dreamId'))
  
  await c.env.DB.prepare(
    'DELETE FROM series_dreams WHERE series_id = ? AND dream_id = ?'
  ).bind(seriesId, dreamId).run()
  
  return c.json({ message: 'Rêve retiré de la série' })
})

// Supprimer une série
seriesRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))
  
  await c.env.DB.prepare('DELETE FROM dream_series WHERE id = ? AND user_id = ?').bind(id, userId).run()
  return c.json({ message: 'Série supprimée' })
})
