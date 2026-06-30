import { Hono } from 'hono'

type Bindings = { DB: D1Database; JWT_SECRET: string }
type Variables = { userId: number }

export const dreamRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Lister les rêves (avec pagination et filtres avancés: type, search, tags)
dreamRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '20')
  const type = c.req.query('type')
  const search = c.req.query('search')
  const tagsParam = c.req.query('tags') // comma-separated tag IDs
  const emotionParam = c.req.query('emotion') // emotion name e.g. 'joy'
  const minIntensity = c.req.query('minIntensity') // min intensity for emotion filter
  const maxIntensity = c.req.query('maxIntensity') // max intensity for emotion filter
  const favorites = c.req.query('favorites')
  const offset = (page - 1) * limit

  // Parse tag IDs
  const tagIds: number[] = tagsParam
    ? tagsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
    : []

  // Build the WHERE clause for the base dream selection
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
  if (favorites === '1') {
    where += ' AND d.is_favorite = 1'
  }

  // Emotion filter: find dreams with specific emotion(s) at a given intensity range
  // Supports multiple emotions (comma-separated): dreams must have AT LEAST ONE of the selected emotions
  if (emotionParam) {
    const emotions = emotionParam.split(',').map((e: string) => e.trim()).filter((e: string) => e)
    if (emotions.length === 1) {
      let emotionSubquery = ` AND d.id IN (
        SELECT de_filter.dream_id FROM dream_emotions de_filter
        WHERE de_filter.emotion = ?`
      params.push(emotions[0])
      if (minIntensity) { emotionSubquery += ` AND de_filter.intensity >= ?`; params.push(parseInt(minIntensity)) }
      if (maxIntensity) { emotionSubquery += ` AND de_filter.intensity <= ?`; params.push(parseInt(maxIntensity)) }
      emotionSubquery += `)`
      where += emotionSubquery
    } else if (emotions.length > 1) {
      const placeholders = emotions.map(() => '?').join(',')
      let emotionSubquery = ` AND d.id IN (
        SELECT de_filter.dream_id FROM dream_emotions de_filter
        WHERE de_filter.emotion IN (${placeholders})`
      params.push(...emotions)
      if (minIntensity) { emotionSubquery += ` AND de_filter.intensity >= ?`; params.push(parseInt(minIntensity)) }
      if (maxIntensity) { emotionSubquery += ` AND de_filter.intensity <= ?`; params.push(parseInt(maxIntensity)) }
      emotionSubquery += `)`
      where += emotionSubquery
    }
  }

  // If tag filtering is active, we need to find dreams that have ALL selected tags (intersection)
  let tagFilterSubquery = ''
  if (tagIds.length > 0) {
    // Subquery: dreams that have ALL the specified tag IDs
    const placeholders = tagIds.map(() => '?').join(',')
    tagFilterSubquery = ` AND d.id IN (
      SELECT dt_filter.dream_id FROM dream_tags dt_filter
      WHERE dt_filter.tag_id IN (${placeholders})
      GROUP BY dt_filter.dream_id
      HAVING COUNT(DISTINCT dt_filter.tag_id) = ?
    )`
    params.push(...tagIds, tagIds.length)
  }

  const fullWhere = where + tagFilterSubquery

  const countResult = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM dreams d ${fullWhere}`
  ).bind(...params).first<any>()

  const queryParams = [...params, limit, offset]
  const dreams = await c.env.DB.prepare(`
    SELECT d.*, 
      GROUP_CONCAT(DISTINCT de.emotion || ':' || de.intensity) as emotions,
      GROUP_CONCAT(DISTINCT t.name || ':' || t.category || ':' || t.color || ':' || t.id) as tags
    FROM dreams d
    LEFT JOIN dream_emotions de ON de.dream_id = d.id
    LEFT JOIN dream_tags dt ON dt.dream_id = d.id
    LEFT JOIN tags t ON t.id = dt.tag_id
    ${fullWhere}
    GROUP BY d.id
    ORDER BY d.dream_date DESC, d.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(...queryParams).all<any>()

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

// Obtenir un rêve par ID (avec phases et interprétations)
dreamRoutes.get('/:id', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))

  const dream = await c.env.DB.prepare(
    'SELECT d.* FROM dreams d WHERE d.id = ? AND d.user_id = ?'
  ).bind(id, userId).first<any>()

  if (!dream) return c.json({ error: 'Rêve non trouvé' }, 404)

  // Paralléliser toutes les requêtes indépendantes
  const [emotions, tags, connections, series, phases, globalInterpretations] = await Promise.all([
    c.env.DB.prepare(
      'SELECT emotion, intensity FROM dream_emotions WHERE dream_id = ?'
    ).bind(id).all<any>(),
    c.env.DB.prepare(`
      SELECT t.id, t.name, t.category, t.color FROM tags t
      JOIN dream_tags dt ON dt.tag_id = t.id WHERE dt.dream_id = ?
    `).bind(id).all<any>(),
    c.env.DB.prepare(`
      SELECT dc.*, 
        CASE WHEN dc.dream_from_id = ? THEN dc.dream_to_id ELSE dc.dream_from_id END as connected_dream_id,
        d2.title as connected_dream_title, d2.dream_date as connected_dream_date
      FROM dream_connections dc
      JOIN dreams d2 ON d2.id = CASE WHEN dc.dream_from_id = ? THEN dc.dream_to_id ELSE dc.dream_from_id END
      WHERE dc.dream_from_id = ? OR dc.dream_to_id = ?
    `).bind(id, id, id, id).all<any>(),
    c.env.DB.prepare(`
      SELECT ds.id, ds.name, ds.color, sd.order_index FROM dream_series ds
      JOIN series_dreams sd ON sd.series_id = ds.id WHERE sd.dream_id = ?
    `).bind(id).all<any>(),
    c.env.DB.prepare(
      'SELECT * FROM dream_phases WHERE dream_id = ? ORDER BY order_index ASC'
    ).bind(id).all<any>(),
    c.env.DB.prepare(
      'SELECT id, content, created_at FROM dream_interpretations WHERE dream_id = ? AND phase_id IS NULL'
    ).bind(id).all<any>()
  ])

  // Émotions et interprétations par phase — paralléliser aussi
  const parsedPhases = await Promise.all(phases.results.map(async (phase: any) => {
    const [phaseEmotions, phaseInterpretations] = await Promise.all([
      c.env.DB.prepare(
        'SELECT emotion, intensity FROM phase_emotions WHERE phase_id = ?'
      ).bind(phase.id).all<any>(),
      c.env.DB.prepare(
        'SELECT id, content, created_at FROM dream_interpretations WHERE phase_id = ?'
      ).bind(phase.id).all<any>()
    ])
    return { ...phase, emotions: phaseEmotions.results, interpretations: phaseInterpretations.results }
  }))

  return c.json({
    ...dream,
    emotions: emotions.results,
    tags: tags.results,
    connections: connections.results,
    series: series.results,
    phases: parsedPhases,
    interpretations: globalInterpretations.results
  })
})

// Créer un rêve
dreamRoutes.post('/', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json()
  const { title, content, dreamDate, dreamType, lucidityLevel, clarity, sleepQuality, sleepPeriod, emotions, tags, phases, interpretations, wishedContinuation } = body

  if (!title || !content) {
    return c.json({ error: 'Titre et contenu requis' }, 400)
  }

  const result = await c.env.DB.prepare(`
    INSERT INTO dreams (user_id, title, content, dream_date, dream_type, lucidity_level, clarity, sleep_quality, sleep_period, wished_continuation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    userId, title, content,
    dreamDate || new Date().toISOString().split('T')[0],
    dreamType || 'normal',
    lucidityLevel || 0, clarity || 3, sleepQuality || 0,
    sleepPeriod === 'nap' ? 'nap' : 'night',
    wishedContinuation || null
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

      await c.env.DB.prepare(
        'UPDATE tags SET usage_count = usage_count + 1 WHERE id = ?'
      ).bind(tagRecord.id).run()
    }
  }

  // Ajouter les phases
  if (phases?.length) {
    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i]
      const phaseResult = await c.env.DB.prepare(
        'INSERT INTO dream_phases (dream_id, order_index, title, content) VALUES (?, ?, ?, ?)'
      ).bind(dreamId, i, phase.title || null, phase.content).run()

      const phaseId = phaseResult.meta.last_row_id

      // Émotions de la phase
      if (phase.emotions?.length) {
        for (const em of phase.emotions) {
          await c.env.DB.prepare(
            'INSERT INTO phase_emotions (phase_id, emotion, intensity) VALUES (?, ?, ?)'
          ).bind(phaseId, em.emotion, em.intensity || 3).run()
        }
      }

      // Interprétations de la phase
      if (phase.interpretations?.length) {
        for (const interp of phase.interpretations) {
          await c.env.DB.prepare(
            'INSERT INTO dream_interpretations (dream_id, phase_id, content) VALUES (?, ?, ?)'
          ).bind(dreamId, phaseId, interp.content || interp).run()
        }
      }
    }
  }

  // Interprétations globales
  if (interpretations?.length) {
    for (const interp of interpretations) {
      await c.env.DB.prepare(
        'INSERT INTO dream_interpretations (dream_id, phase_id, content) VALUES (?, NULL, ?)'
      ).bind(dreamId, interp.content || interp).run()
    }
  }

  return c.json({ id: dreamId, message: 'Rêve enregistré !' }, 201)
})

// Modifier un rêve
dreamRoutes.put('/:id', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))
  const body = await c.req.json()

  const existing = await c.env.DB.prepare(
    'SELECT id FROM dreams WHERE id = ? AND user_id = ?'
  ).bind(id, userId).first()
  if (!existing) return c.json({ error: 'Rêve non trouvé' }, 404)

  const { title, content, dreamDate, dreamType, lucidityLevel, clarity, sleepQuality, sleepPeriod, isFavorite, emotions, tags, phases, interpretations, wishedContinuation } = body

  await c.env.DB.prepare(`
    UPDATE dreams SET title = ?, content = ?, dream_date = ?, dream_type = ?,
    lucidity_level = ?, clarity = ?, sleep_quality = ?, sleep_period = ?, is_favorite = ?,
    wished_continuation = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?
  `).bind(title, content, dreamDate, dreamType || 'normal', lucidityLevel || 0, clarity || 3, sleepQuality || 0, sleepPeriod === 'nap' ? 'nap' : 'night', isFavorite ? 1 : 0, wishedContinuation || null, id, userId).run()

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

  // Mettre à jour les phases
  if (phases !== undefined) {
    // Supprimer toutes les anciennes phases et leurs données liées
    const oldPhases = await c.env.DB.prepare(
      'SELECT id FROM dream_phases WHERE dream_id = ?'
    ).bind(id).all<any>()
    
    for (const op of oldPhases.results) {
      await c.env.DB.prepare('DELETE FROM phase_emotions WHERE phase_id = ?').bind(op.id).run()
      await c.env.DB.prepare('DELETE FROM dream_interpretations WHERE phase_id = ?').bind(op.id).run()
    }
    await c.env.DB.prepare('DELETE FROM dream_phases WHERE dream_id = ?').bind(id).run()

    // Recréer les phases
    if (phases?.length) {
      for (let i = 0; i < phases.length; i++) {
        const phase = phases[i]
        const phaseResult = await c.env.DB.prepare(
          'INSERT INTO dream_phases (dream_id, order_index, title, content) VALUES (?, ?, ?, ?)'
        ).bind(id, i, phase.title || null, phase.content).run()

        const phaseId = phaseResult.meta.last_row_id

        if (phase.emotions?.length) {
          for (const em of phase.emotions) {
            await c.env.DB.prepare(
              'INSERT INTO phase_emotions (phase_id, emotion, intensity) VALUES (?, ?, ?)'
            ).bind(phaseId, em.emotion, em.intensity || 3).run()
          }
        }

        if (phase.interpretations?.length) {
          for (const interp of phase.interpretations) {
            await c.env.DB.prepare(
              'INSERT INTO dream_interpretations (dream_id, phase_id, content) VALUES (?, ?, ?)'
            ).bind(id, phaseId, interp.content || interp).run()
          }
        }
      }
    }
  }

  // Mettre à jour les interprétations globales
  if (interpretations !== undefined) {
    await c.env.DB.prepare(
      'DELETE FROM dream_interpretations WHERE dream_id = ? AND phase_id IS NULL'
    ).bind(id).run()

    if (interpretations?.length) {
      for (const interp of interpretations) {
        await c.env.DB.prepare(
          'INSERT INTO dream_interpretations (dream_id, phase_id, content) VALUES (?, NULL, ?)'
        ).bind(id, interp.content || interp).run()
      }
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
