import { Hono } from 'hono'

type Bindings = { DB: D1Database; JWT_SECRET: string }
type Variables = { userId: number }

export const intentionRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// GET /intentions — Liste toutes les intentions avec filtre optionnel
intentionRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const type = c.req.query('type') // 'new_dream', 'dream_continuation', ou vide pour tout
  const status = c.req.query('status') // 'active', 'realized', 'archived', ou vide pour tout

  let sql = `SELECT di.*, 
    d_source.title as source_dream_title,
    d_realized.title as realized_dream_title
    FROM dream_intentions di
    LEFT JOIN dreams d_source ON di.source_dream_id = d_source.id
    LEFT JOIN dreams d_realized ON di.realized_dream_id = d_realized.id
    WHERE di.user_id = ?`
  const params: any[] = [userId]

  if (type) { sql += ` AND di.type = ?`; params.push(type) }
  if (status) { sql += ` AND di.status = ?`; params.push(status) }

  sql += ` ORDER BY di.status = 'active' DESC, di.updated_at DESC`

  const { results } = await c.env.DB.prepare(sql).bind(...params).all()
  return c.json({ intentions: results })
})

// GET /intentions/for-dream/:dreamId — Intentions de suite liées à un rêve
intentionRoutes.get('/for-dream/:dreamId', async (c) => {
  const userId = c.get('userId')
  const dreamId = parseInt(c.req.param('dreamId'))

  const { results } = await c.env.DB.prepare(`
    SELECT di.*, d_realized.title as realized_dream_title
    FROM dream_intentions di
    LEFT JOIN dreams d_realized ON di.realized_dream_id = d_realized.id
    WHERE di.user_id = ? AND di.source_dream_id = ?
    ORDER BY di.status = 'active' DESC, di.updated_at DESC
  `).bind(userId, dreamId).all()

  return c.json({ intentions: results })
})

// GET /intentions/active — Intentions actives uniquement (pour sélecteur dans l'éditeur)
intentionRoutes.get('/active', async (c) => {
  const userId = c.get('userId')

  const { results } = await c.env.DB.prepare(`
    SELECT di.*, d_source.title as source_dream_title
    FROM dream_intentions di
    LEFT JOIN dreams d_source ON di.source_dream_id = d_source.id
    WHERE di.user_id = ? AND di.status = 'active'
    ORDER BY di.updated_at DESC
  `).bind(userId).all()

  return c.json({ intentions: results })
})

// POST /intentions — Créer une intention
intentionRoutes.post('/', async (c) => {
  const userId = c.get('userId')
  const { type, sourceDreamId, title, description } = await c.req.json()

  if (!title?.trim()) return c.json({ error: 'Titre requis' }, 400)
  if (!['new_dream', 'dream_continuation'].includes(type)) return c.json({ error: 'Type invalide' }, 400)
  if (type === 'dream_continuation' && !sourceDreamId) return c.json({ error: 'Rêve source requis pour une suite' }, 400)

  const result = await c.env.DB.prepare(`
    INSERT INTO dream_intentions (user_id, type, source_dream_id, title, description)
    VALUES (?, ?, ?, ?, ?)
  `).bind(userId, type, sourceDreamId || null, title.trim(), description?.trim() || null).run()

  return c.json({ id: result.meta.last_row_id, message: 'Intention créée' }, 201)
})

// PUT /intentions/:id — Modifier une intention
intentionRoutes.put('/:id', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))
  const { title, description, status } = await c.req.json()

  if (title !== undefined && !title?.trim()) return c.json({ error: 'Titre requis' }, 400)
  if (status && !['active', 'realized', 'archived'].includes(status)) return c.json({ error: 'Statut invalide' }, 400)

  // Build dynamic update
  const sets: string[] = ['updated_at = CURRENT_TIMESTAMP']
  const params: any[] = []
  if (title !== undefined) { sets.push('title = ?'); params.push(title.trim()) }
  if (description !== undefined) { sets.push('description = ?'); params.push(description?.trim() || null) }
  if (status) { sets.push('status = ?'); params.push(status) }

  params.push(id, userId)
  await c.env.DB.prepare(`UPDATE dream_intentions SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`).bind(...params).run()

  return c.json({ message: 'Intention mise à jour' })
})

// PUT /intentions/:id/realize — Associer un rêve réalisé à une intention
intentionRoutes.put('/:id/realize', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))
  const { realizedDreamId } = await c.req.json()

  if (!realizedDreamId) return c.json({ error: 'ID du rêve réalisé requis' }, 400)

  await c.env.DB.prepare(`
    UPDATE dream_intentions SET status = 'realized', realized_dream_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).bind(realizedDreamId, id, userId).run()

  return c.json({ message: 'Intention marquée comme réalisée' })
})

// PUT /intentions/:id/unrealize — Dissocier un rêve réalisé
intentionRoutes.put('/:id/unrealize', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))

  await c.env.DB.prepare(`
    UPDATE dream_intentions SET status = 'active', realized_dream_id = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).bind(id, userId).run()

  return c.json({ message: 'Intention réactivée' })
})

// DELETE /intentions/:id — Supprimer une intention
intentionRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))

  await c.env.DB.prepare('DELETE FROM dream_intentions WHERE id = ? AND user_id = ?').bind(id, userId).run()
  return c.json({ message: 'Intention supprimée' })
})
