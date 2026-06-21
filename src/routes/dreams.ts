import { Hono } from 'hono'

type Bindings = { DB: D1Database; JWT_SECRET: string }
type Variables = { userId: number }

export const dreamRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Lister les rêves (avec pagination et filtres)
dreamRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '20')
  const type = c.req.query('type')
  const search = c.req.query('search')
  const offset = (page - 1) * limit

  let where = 'WHERE d.user_id = ?'
  const params: any[] = [userId]

  if (type && type !== 'all') {
    where += ' AND d.dream_type = ?'
    params.push(type)
  }
  if (search) {
    where += ' AND (d.title LIKE ? OR d.content LIKE ?)'
    params.push(`%${search}%`, `%${search}%`)
  }

  const countResult = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM dreams d ${where}`
  ).bind(...params).first<any>()

  const dreams = await c.env.DB.prepare(`
    SELECT d.*, 
      GROUP_CONCAT(DISTINCT de.emotion || ':' || de.intensity) as emotions,
      GROUP_CONCAT(DISTINCT t.name || ':' || t.category || ':' || t.color || ':' || t.id) as tags
    FROM dreams d
    LEFT JOIN dream_emotions de ON de.dream_id = d.id
    LEFT JOIN dream_tags dt ON dt.dream_id = d.id
    LEFT JOIN tags t ON t.id = dt.tag_id
    ${where}
    GROUP BY d.id
    ORDER BY d.dream_date DESC, d.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(...params, limit, offset).all<any>()

  const parsed = dreams.results.map(d => ({
    ...d,
    emotions: d.emotions ? d.emotions.split(',').map((e: string) => {
      const [emotion, intensity] = e.split(':')
      return { emotion, intensity: parseInt(intensity) }
    }) : [],
    tags: d.tags ? d.tags.split(',').map((t: string) => {
      const [name, category, color, id] = t.split(':')
      return { id: parseInt(id), name, category, color }
    }) : []
  }))

  return c.json({
    dreams: parsed,
    pagination: { page, limit, total: countResult?.total || 0, pages: Math.ceil((countResult?.total || 0) / limit) }
  })
})

// Obtenir un rêve par ID
dreamRoutes.get('/:id', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))

  const dream = await c.env.DB.prepare(`
    SELECT d.* FROM dreams d WHERE d.id = ? AND d.user_id = ?
  `).bind(id, userId).first<any>()

  if (!dream) return c.json({ error: 'Rêve non trouvé' }, 404)

  const emotions = await c.env.DB.prepare(
    'SELECT emotion, intensity FROM dream_emotions WHERE dream_id = ?'
  ).bind(id).all<any>()

  const tags = await c.env.DB.prepare(`
    SELECT t.id, t.name, t.category, t.color FROM tags t
    JOIN dream_tags dt ON dt.tag_id = t.id WHERE dt.dream_id = ?
  `).bind(id).all<any>()

  const connections = await c.env.DB.prepare(`
    SELECT dc.*, 
      CASE WHEN dc.dream_from_id = ? THEN dc.dream_to_id ELSE dc.dream_from_id END as connected_dream_id,
      d2.title as connected_dream_title, d2.dream_date as connected_dream_date
    FROM dream_connections dc
    JOIN dreams d2 ON d2.id = CASE WHEN dc.dream_from_id = ? THEN dc.dream_to_id ELSE dc.dream_from_id END
    WHERE dc.dream_from_id = ? OR dc.dream_to_id = ?
  `).bind(id, id, id, id).all<any>()

  const series = await c.env.DB.prepare(`
    SELECT ds.id, ds.name, ds.color, sd.order_index FROM dream_series ds
    JOIN series_dreams sd ON sd.series_id = ds.id WHERE sd.dream_id = ?
  `).bind(id).all<any>()

  return c.json({
    ...dream,
    emotions: emotions.results,
    tags: tags.results,
    connections: connections.results,
    series: series.results
  })
})

// Créer un rêve
dreamRoutes.post('/', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json()
  const { title, content, dreamDate, dreamType, lucidityLevel, clarity, sleepQuality, emotions, tags } = body

  if (!title || !content) {
    return c.json({ error: 'Titre et contenu requis' }, 400)
  }

  const result = await c.env.DB.prepare(`
    INSERT INTO dreams (user_id, title, content, dream_date, dream_type, lucidity_level, clarity, sleep_quality)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    userId, title, content,
    dreamDate || new Date().toISOString().split('T')[0],
    dreamType || 'normal',
    lucidityLevel || 0, clarity || 3, sleepQuality || 0
  ).run()

  const dreamId = result.meta.last_row_id

  // Ajouter les émotions
  if (emotions?.length) {
    for (const em of emotions) {
      await c.env.DB.prepare(
        'INSERT INTO dream_emotions (dream_id, emotion, intensity) VALUES (?, ?, ?)'
      ).bind(dreamId, em.emotion, em.intensity || 3).run()
    }
  }

  // Ajouter les tags
  if (tags?.length) {
    for (const tag of tags) {
      // Créer le tag s'il n'existe pas
      let tagRecord = await c.env.DB.prepare(
        'SELECT id FROM tags WHERE user_id = ? AND name = ? AND category = ?'
      ).bind(userId, tag.name, tag.category || 'custom').first<any>()

      if (!tagRecord) {
        const tagResult = await c.env.DB.prepare(
          'INSERT INTO tags (user_id, name, category, color) VALUES (?, ?, ?, ?)'
        ).bind(userId, tag.name, tag.category || 'custom', tag.color || '#6366f1').run()
        tagRecord = { id: tagResult.meta.last_row_id }
      }

      await c.env.DB.prepare(
        'INSERT OR IGNORE INTO dream_tags (dream_id, tag_id) VALUES (?, ?)'
      ).bind(dreamId, tagRecord.id).run()

      // Incrementer le compteur d'usage
      await c.env.DB.prepare(
        'UPDATE tags SET usage_count = usage_count + 1 WHERE id = ?'
      ).bind(tagRecord.id).run()
    }
  }

  return c.json({ id: dreamId, message: 'Rêve enregistré !' }, 201)
})

// Modifier un rêve
dreamRoutes.put('/:id', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))
  const body = await c.req.json()

  // Vérifier que le rêve appartient à l'utilisateur
  const existing = await c.env.DB.prepare(
    'SELECT id FROM dreams WHERE id = ? AND user_id = ?'
  ).bind(id, userId).first()
  if (!existing) return c.json({ error: 'Rêve non trouvé' }, 404)

  const { title, content, dreamDate, dreamType, lucidityLevel, clarity, sleepQuality, isFavorite, emotions, tags } = body

  await c.env.DB.prepare(`
    UPDATE dreams SET title = ?, content = ?, dream_date = ?, dream_type = ?,
    lucidity_level = ?, clarity = ?, sleep_quality = ?, is_favorite = ?,
    updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?
  `).bind(title, content, dreamDate, dreamType || 'normal', lucidityLevel || 0, clarity || 3, sleepQuality || 0, isFavorite ? 1 : 0, id, userId).run()

  // Mettre à jour les émotions
  if (emotions) {
    await c.env.DB.prepare('DELETE FROM dream_emotions WHERE dream_id = ?').bind(id).run()
    for (const em of emotions) {
      await c.env.DB.prepare(
        'INSERT INTO dream_emotions (dream_id, emotion, intensity) VALUES (?, ?, ?)'
      ).bind(id, em.emotion, em.intensity || 3).run()
    }
  }

  // Mettre à jour les tags
  if (tags) {
    await c.env.DB.prepare('DELETE FROM dream_tags WHERE dream_id = ?').bind(id).run()
    for (const tag of tags) {
      let tagRecord = await c.env.DB.prepare(
        'SELECT id FROM tags WHERE user_id = ? AND name = ? AND category = ?'
      ).bind(userId, tag.name, tag.category || 'custom').first<any>()

      if (!tagRecord) {
        const tagResult = await c.env.DB.prepare(
          'INSERT INTO tags (user_id, name, category, color) VALUES (?, ?, ?, ?)'
        ).bind(userId, tag.name, tag.category || 'custom', tag.color || '#6366f1').run()
        tagRecord = { id: tagResult.meta.last_row_id }
      }

      await c.env.DB.prepare(
        'INSERT OR IGNORE INTO dream_tags (dream_id, tag_id) VALUES (?, ?)'
      ).bind(id, tagRecord.id).run()
    }
  }

  return c.json({ message: 'Rêve mis à jour' })
})

// Supprimer un rêve
dreamRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))

  const result = await c.env.DB.prepare(
    'DELETE FROM dreams WHERE id = ? AND user_id = ?'
  ).bind(id, userId).run()

  if (!result.meta.changes) return c.json({ error: 'Rêve non trouvé' }, 404)
  return c.json({ message: 'Rêve supprimé' })
})
