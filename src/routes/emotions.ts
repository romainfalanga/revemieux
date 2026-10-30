import { Hono } from 'hono'

type Env = { Bindings: { DB: D1Database; JWT_SECRET: string }; Variables: { userId: number } }
export const emotionRoutes = new Hono<Env>()
export const normalizeEmotionName = (name: string) => name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
const defaults = new Set(['joy', 'Joie', 'fear', 'Peur', 'anxiety', 'Anxiété', 'wonder', 'Émerveillement', 'Émerveil.', 'sadness', 'Tristesse', 'anger', 'Colère', 'confusion', 'Confusion', 'peace', 'Paix', 'excitement', 'Excitation', 'love', 'Amour', 'nostalgia', 'Nostalgie'].map(normalizeEmotionName))
const validName = (name: unknown): name is string => typeof name === 'string' && name.trim().length >= 1 && name.trim().length <= 60
const duplicate = (error: unknown) => error instanceof Error && /UNIQUE constraint failed/i.test(error.message)

// Validate before any dream write; punctuation is intentionally unrestricted.
export function validateDreamEmotions(body: any): boolean {
  const validList = (list: any) => list === undefined || (Array.isArray(list) && list.every(em =>
    em && validName(em.emotion) && Number.isInteger(em.intensity) && em.intensity >= 1 && em.intensity <= 5
  ) && new Set(list.map(em => normalizeEmotionName(em.emotion))).size === list.length)
  return validList(body.emotions) && (body.phases === undefined || (Array.isArray(body.phases) && body.phases.every((phase: any) => phase && validList(phase.emotions))))
}

emotionRoutes.get('/', async c => {
  const result = await c.env.DB.prepare('SELECT id, name FROM user_emotions WHERE user_id = ? ORDER BY name COLLATE NOCASE, id').bind(c.get('userId')).all()
  return c.json({ emotions: result.results })
})

emotionRoutes.post('/', async c => {
  const body = await c.req.json().catch(() => null)
  if (!validName(body?.name)) return c.json({ error: 'Le nom doit contenir entre 1 et 60 caractères.' }, 400)
  const name = body.name.trim()
  const normalized = normalizeEmotionName(name)
  if (defaults.has(normalized)) return c.json({ error: 'Cette émotion existe déjà.' }, 409)
  try {
    const result = await c.env.DB.prepare('INSERT INTO user_emotions (user_id, name, normalized_name) VALUES (?, ?, ?)').bind(c.get('userId'), name, normalized).run()
    return c.json({ id: result.meta.last_row_id, name }, 201)
  } catch (error) {
    if (duplicate(error)) return c.json({ error: 'Cette émotion existe déjà.' }, 409)
    throw error
  }
})

emotionRoutes.put('/:id', async c => {
  const id = Number(c.req.param('id'))
  const userId = c.get('userId')
  if (!Number.isSafeInteger(id) || id < 1) return c.json({ error: 'Émotion non trouvée.' }, 404)
  const body = await c.req.json().catch(() => null)
  if (!validName(body?.name)) return c.json({ error: 'Le nom doit contenir entre 1 et 60 caractères.' }, 400)
  const name = body.name.trim()
  const normalized = normalizeEmotionName(name)
  if (defaults.has(normalized)) return c.json({ error: 'Cette émotion existe déjà.' }, 409)
  // Resolve the old name inside the transaction, so concurrent renames cannot leave stale associations.
  try {
    const results = await c.env.DB.batch([
      c.env.DB.prepare(`UPDATE dream_emotions SET emotion = ? WHERE dream_id IN (SELECT id FROM dreams WHERE user_id = ?) AND emotion = (SELECT name FROM user_emotions WHERE id = ? AND user_id = ?)` ).bind(name, userId, id, userId),
      c.env.DB.prepare(`UPDATE phase_emotions SET emotion = ? WHERE phase_id IN (SELECT p.id FROM dream_phases p JOIN dreams d ON d.id = p.dream_id WHERE d.user_id = ?) AND emotion = (SELECT name FROM user_emotions WHERE id = ? AND user_id = ?)` ).bind(name, userId, id, userId),
      c.env.DB.prepare('UPDATE user_emotions SET name = ?, normalized_name = ? WHERE id = ? AND user_id = ?').bind(name, normalized, id, userId),
    ])
    if (!results[2].meta.changes) return c.json({ error: 'Émotion non trouvée.' }, 404)
    return c.json({ id, name })
  } catch (error) {
    if (duplicate(error)) return c.json({ error: 'Cette émotion existe déjà.' }, 409)
    throw error
  }
})

emotionRoutes.delete('/:id', async c => {
  const id = Number(c.req.param('id'))
  const userId = c.get('userId')
  if (!Number.isSafeInteger(id) || id < 1) return c.json({ error: 'Émotion non trouvée.' }, 404)
  const results = await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM dream_emotions WHERE dream_id IN (SELECT id FROM dreams WHERE user_id = ?) AND emotion = (SELECT name FROM user_emotions WHERE id = ? AND user_id = ?)').bind(userId, id, userId),
    c.env.DB.prepare('DELETE FROM phase_emotions WHERE phase_id IN (SELECT p.id FROM dream_phases p JOIN dreams d ON d.id = p.dream_id WHERE d.user_id = ?) AND emotion = (SELECT name FROM user_emotions WHERE id = ? AND user_id = ?)').bind(userId, id, userId),
    c.env.DB.prepare('DELETE FROM user_emotions WHERE id = ? AND user_id = ?').bind(id, userId),
  ])
  if (!results[2].meta.changes) return c.json({ error: 'Émotion non trouvée.' }, 404)
  return c.json({ message: 'Émotion supprimée.' })
})
