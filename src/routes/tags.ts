import { Hono } from 'hono'

type Bindings = { DB: D1Database; JWT_SECRET: string }
type Variables = { userId: number }

export const tagRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Lister les tags de l'utilisateur
tagRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const category = c.req.query('category')
  
  let query = 'SELECT * FROM tags WHERE user_id = ?'
  const params: any[] = [userId]
  
  if (category) {
    query += ' AND category = ?'
    params.push(category)
  }
  
  query += ' ORDER BY usage_count DESC, name ASC'
  
  const tags = await c.env.DB.prepare(query).bind(...params).all<any>()
  return c.json({ tags: tags.results })
})

// Tags groupés par catégorie (pour le filtre journal)
tagRoutes.get('/grouped', async (c) => {
  const userId = c.get('userId')
  const tags = await c.env.DB.prepare(
    'SELECT * FROM tags WHERE user_id = ? ORDER BY category ASC, usage_count DESC, name ASC'
  ).bind(userId).all<any>()

  // Group by category
  const grouped: Record<string, any[]> = {}
  for (const tag of tags.results) {
    const cat = tag.category || 'custom'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(tag)
  }

  return c.json({ grouped })
})

// Créer un tag
tagRoutes.post('/', async (c) => {
  const userId = c.get('userId')
  const { name, category, color } = await c.req.json()
  
  if (!name) return c.json({ error: 'Nom requis' }, 400)
  
  try {
    const result = await c.env.DB.prepare(
      'INSERT INTO tags (user_id, name, category, color) VALUES (?, ?, ?, ?)'
    ).bind(userId, name, category || 'custom', color || '#6366f1').run()
    
    return c.json({ id: result.meta.last_row_id, name, category: category || 'custom', color: color || '#6366f1' }, 201)
  } catch (e) {
    return c.json({ error: 'Ce tag existe déjà' }, 409)
  }
})

// Supprimer un tag
tagRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))
  
  await c.env.DB.prepare('DELETE FROM tags WHERE id = ? AND user_id = ?').bind(id, userId).run()
  return c.json({ message: 'Tag supprimé' })
})
