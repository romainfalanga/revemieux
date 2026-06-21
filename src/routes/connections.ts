import { Hono } from 'hono'

type Bindings = { DB: D1Database; JWT_SECRET: string }
type Variables = { userId: number }

export const connectionRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Obtenir toutes les connexions (pour le graphe)
connectionRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  
  const connections = await c.env.DB.prepare(`
    SELECT dc.*, 
      d1.title as from_title, d1.dream_date as from_date, d1.dream_type as from_type,
      d2.title as to_title, d2.dream_date as to_date, d2.dream_type as to_type
    FROM dream_connections dc
    JOIN dreams d1 ON d1.id = dc.dream_from_id
    JOIN dreams d2 ON d2.id = dc.dream_to_id
    WHERE dc.user_id = ?
    ORDER BY dc.created_at DESC
  `).bind(userId).all<any>()
  
  return c.json({ connections: connections.results })
})

// Obtenir les données complètes du graphe (noeuds + liens)
connectionRoutes.get('/graph', async (c) => {
  const userId = c.get('userId')
  
  // Récupérer tous les rêves comme nœuds
  const dreams = await c.env.DB.prepare(`
    SELECT d.id, d.title, d.dream_date, d.dream_type, d.lucidity_level, d.clarity, d.is_favorite,
      GROUP_CONCAT(DISTINCT de.emotion) as emotions,
      GROUP_CONCAT(DISTINCT t.name) as tags
    FROM dreams d
    LEFT JOIN dream_emotions de ON de.dream_id = d.id
    LEFT JOIN dream_tags dt ON dt.dream_id = d.id
    LEFT JOIN tags t ON t.id = dt.tag_id
    WHERE d.user_id = ?
    GROUP BY d.id
    ORDER BY d.dream_date DESC
  `).bind(userId).all<any>()
  
  // Récupérer toutes les connexions comme liens
  const connections = await c.env.DB.prepare(`
    SELECT dream_from_id as source, dream_to_id as target, 
      connection_type, strength, description
    FROM dream_connections WHERE user_id = ?
  `).bind(userId).all<any>()
  
  // Récupérer les séries pour colorer les nœuds
  const seriesMemberships = await c.env.DB.prepare(`
    SELECT sd.dream_id, ds.id as series_id, ds.name as series_name, ds.color
    FROM series_dreams sd
    JOIN dream_series ds ON ds.id = sd.series_id
    WHERE ds.user_id = ?
  `).bind(userId).all<any>()
  
  const seriesMap: Record<number, any[]> = {}
  for (const sm of seriesMemberships.results) {
    if (!seriesMap[sm.dream_id]) seriesMap[sm.dream_id] = []
    seriesMap[sm.dream_id].push({ id: sm.series_id, name: sm.series_name, color: sm.color })
  }
  
  const nodes = dreams.results.map(d => ({
    id: d.id,
    title: d.title,
    date: d.dream_date,
    type: d.dream_type,
    lucidity: d.lucidity_level,
    clarity: d.clarity,
    favorite: d.is_favorite,
    emotions: d.emotions ? d.emotions.split(',') : [],
    tags: d.tags ? d.tags.split(',') : [],
    series: seriesMap[d.id] || []
  }))
  
  return c.json({ nodes, links: connections.results })
})

// Créer une connexion
connectionRoutes.post('/', async (c) => {
  const userId = c.get('userId')
  const { dreamFromId, dreamToId, connectionType, description, strength } = await c.req.json()
  
  if (!dreamFromId || !dreamToId) {
    return c.json({ error: 'Deux rêves requis pour créer une connexion' }, 400)
  }
  
  // Vérifier que les deux rêves appartiennent à l'utilisateur
  const d1 = await c.env.DB.prepare('SELECT id FROM dreams WHERE id = ? AND user_id = ?').bind(dreamFromId, userId).first()
  const d2 = await c.env.DB.prepare('SELECT id FROM dreams WHERE id = ? AND user_id = ?').bind(dreamToId, userId).first()
  
  if (!d1 || !d2) return c.json({ error: 'Rêves non trouvés' }, 404)
  
  try {
    const result = await c.env.DB.prepare(`
      INSERT INTO dream_connections (user_id, dream_from_id, dream_to_id, connection_type, description, strength)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(userId, dreamFromId, dreamToId, connectionType || 'related', description || null, strength || 3).run()
    
    return c.json({ id: result.meta.last_row_id, message: 'Connexion créée' }, 201)
  } catch (e) {
    return c.json({ error: 'Cette connexion existe déjà' }, 409)
  }
})

// Supprimer une connexion
connectionRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))
  
  await c.env.DB.prepare('DELETE FROM dream_connections WHERE id = ? AND user_id = ?').bind(id, userId).run()
  return c.json({ message: 'Connexion supprimée' })
})
