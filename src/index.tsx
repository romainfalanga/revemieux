import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authRoutes, authMiddleware } from './routes/auth'
import { dreamRoutes } from './routes/dreams'
import { tagRoutes } from './routes/tags'
import { connectionRoutes } from './routes/connections'
import { seriesRoutes } from './routes/series'
import { statsRoutes } from './routes/stats'
import { incubationRoutes } from './routes/incubation'
import { realityCheckRoutes } from './routes/reality-checks'
import { intentionRoutes } from './routes/intentions'
import { pushRoutes, cronRoutes, pushTestRoutes } from './routes/push'
import { renderApp } from './renderer'

type Bindings = {
  DB: D1Database
  JWT_SECRET: string
  VAPID_PUBLIC_KEY: string
  VAPID_PRIVATE_KEY: string
  CRON_SECRET: string
}

const app = new Hono<{ Bindings: Bindings }>()

// CORS
app.use('/api/*', cors())

// Auth routes (public)
app.route('/api/auth', authRoutes)

// Cron endpoint (protégé par secret, pas par auth user)
app.route('/api/cron', cronRoutes)

// Protected API routes
app.use('/api/*', authMiddleware)
app.route('/api/dreams', dreamRoutes)
app.route('/api/tags', tagRoutes)
app.route('/api/connections', connectionRoutes)
app.route('/api/series', seriesRoutes)
app.route('/api/stats', statsRoutes)
app.route('/api/incubation', incubationRoutes)
app.route('/api/reality-checks', realityCheckRoutes)
app.route('/api/intentions', intentionRoutes)
app.route('/api/push', pushRoutes)
app.route('/api/push', pushTestRoutes)

// SPA - serve the app for all non-API routes
app.get('*', (c) => {
  return c.html(renderApp())
})

export default app
