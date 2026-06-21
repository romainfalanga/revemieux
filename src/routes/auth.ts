import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'

type Bindings = { DB: D1Database; JWT_SECRET: string }
type Variables = { userId: number }

// Simple but secure password hashing using Web Crypto API (available in Workers)
async function hashPassword(password: string, salt?: string): Promise<string> {
  const s = salt || crypto.randomUUID()
  const data = new TextEncoder().encode(password + s)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return s + ':' + hashHex
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt] = stored.split(':')
  const hash = await hashPassword(password, salt)
  return hash === stored
}

// JWT-like token using Web Crypto (HMAC-SHA256)
async function createToken(userId: number, secret: string): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({ 
    sub: userId, 
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 30 * 24 * 3600 // 30 days
  }))
  const data = header + '.' + payload
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  const signature = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  return data + '.' + signature
}

async function verifyToken(token: string, secret: string): Promise<number | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1]))
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    
    const data = parts[0] + '.' + parts[1]
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    )
    const sigBin = Uint8Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
    const valid = await crypto.subtle.verify('HMAC', key, sigBin, new TextEncoder().encode(data))
    return valid ? payload.sub : null
  } catch { return null }
}

export const authMiddleware = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(
  async (c, next) => {
    // Skip auth for auth routes
    if (c.req.path.startsWith('/api/auth')) return next()
    
    const authHeader = c.req.header('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Non authentifié' }, 401)
    }
    const token = authHeader.substring(7)
    const userId = await verifyToken(token, c.env.JWT_SECRET)
    if (!userId) {
      return c.json({ error: 'Token invalide ou expiré' }, 401)
    }
    c.set('userId', userId)
    await next()
  }
)

export const authRoutes = new Hono<{ Bindings: Bindings }>()

// Inscription
authRoutes.post('/register', async (c) => {
  const body = await c.req.json()
  const email = body.email
  const password = body.password
  const displayName = body.displayName
  // Auto-generate username from email if not provided
  const username = body.username || (email ? email.split('@')[0] : '')
  
  if (!email || !username || !password) {
    return c.json({ error: 'Email et mot de passe requis' }, 400)
  }
  if (password.length < 6) {
    return c.json({ error: 'Le mot de passe doit faire au moins 6 caractères' }, 400)
  }
  
  // Check existing
  const existing = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ? OR username = ?'
  ).bind(email, username).first()
  
  if (existing) {
    return c.json({ error: 'Cet email ou nom d\'utilisateur existe déjà' }, 409)
  }
  
  const passwordHash = await hashPassword(password)
  const result = await c.env.DB.prepare(
    'INSERT INTO users (email, username, password_hash, display_name) VALUES (?, ?, ?, ?)'
  ).bind(email, username, passwordHash, displayName || username).run()
  
  const userId = result.meta.last_row_id
  const token = await createToken(userId as number, c.env.JWT_SECRET)
  
  return c.json({ 
    token, 
    user: { id: userId, email, username, displayName: displayName || username }
  })
})

// Connexion
authRoutes.post('/login', async (c) => {
  const { login, password } = await c.req.json()
  
  if (!login || !password) {
    return c.json({ error: 'Identifiant et mot de passe requis' }, 400)
  }
  
  const user = await c.env.DB.prepare(
    'SELECT id, email, username, password_hash, display_name FROM users WHERE email = ? OR username = ?'
  ).bind(login, login).first<any>()
  
  if (!user) {
    return c.json({ error: 'Identifiants incorrects' }, 401)
  }
  
  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) {
    return c.json({ error: 'Identifiants incorrects' }, 401)
  }
  
  // Update last login
  await c.env.DB.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(user.id).run()
  
  const token = await createToken(user.id, c.env.JWT_SECRET)
  
  return c.json({ 
    token, 
    user: { id: user.id, email: user.email, username: user.username, displayName: user.display_name }
  })
})

// Profil
authRoutes.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Non authentifié' }, 401)
  }
  const userId = await verifyToken(authHeader.substring(7), c.env.JWT_SECRET)
  if (!userId) return c.json({ error: 'Token invalide' }, 401)
  
  const user = await c.env.DB.prepare(
    'SELECT id, email, username, display_name, settings, created_at FROM users WHERE id = ?'
  ).bind(userId).first<any>()
  
  if (!user) return c.json({ error: 'Utilisateur non trouvé' }, 404)
  
  return c.json({ 
    user: { 
      id: user.id, email: user.email, username: user.username, 
      displayName: user.display_name, settings: JSON.parse(user.settings || '{}'),
      createdAt: user.created_at
    }
  })
})
