import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import { sendWebPush, PushSubscription } from '../lib/web-push'

type Bindings = { DB: D1Database; JWT_SECRET: string; VAPID_PUBLIC_KEY: string; VAPID_PRIVATE_KEY: string; CRON_SECRET: string }
type Variables = { userId: number }

export const pushRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// === Endpoints protégés par auth (le user est connecté) ===

// Récupérer la clé publique VAPID (pour le frontend)
pushRoutes.get('/vapid-key', (c) => {
  return c.json({ publicKey: c.env.VAPID_PUBLIC_KEY })
})

// Enregistrer une push subscription
pushRoutes.post('/subscribe', async (c) => {
  const userId = c.get('userId')
  const { endpoint, keys } = await c.req.json<{ endpoint: string; keys: { p256dh: string; auth: string } }>()

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return c.json({ error: 'Subscription invalide' }, 400)
  }

  await c.env.DB.prepare(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) 
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, endpoint) DO UPDATE SET p256dh = ?, auth = ?, created_at = CURRENT_TIMESTAMP`
  ).bind(userId, endpoint, keys.p256dh, keys.auth, keys.p256dh, keys.auth).run()

  return c.json({ success: true })
})

// Désinscrire une push subscription
pushRoutes.delete('/subscribe', async (c) => {
  const userId = c.get('userId')
  const { endpoint } = await c.req.json<{ endpoint: string }>()

  if (endpoint) {
    await c.env.DB.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?')
      .bind(userId, endpoint).run()
  } else {
    // Supprimer toutes les subscriptions du user
    await c.env.DB.prepare('DELETE FROM push_subscriptions WHERE user_id = ?')
      .bind(userId).run()
  }

  return c.json({ success: true })
})

// Activer/mettre à jour le schedule TLR
pushRoutes.post('/tlr-schedule', async (c) => {
  const userId = c.get('userId')
  const { bedtime, triggerTime, active } = await c.req.json<{ bedtime: string; triggerTime: string; active: boolean }>()

  if (!bedtime || !triggerTime) {
    return c.json({ error: 'bedtime et triggerTime requis' }, 400)
  }

  await c.env.DB.prepare(
    `INSERT INTO tlr_schedules (user_id, bedtime, trigger_time, active, updated_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id) DO UPDATE SET bedtime = ?, trigger_time = ?, active = ?, updated_at = CURRENT_TIMESTAMP`
  ).bind(userId, bedtime, triggerTime, active ? 1 : 0, bedtime, triggerTime, active ? 1 : 0).run()

  return c.json({ success: true })
})

// Désactiver le schedule TLR
pushRoutes.delete('/tlr-schedule', async (c) => {
  const userId = c.get('userId')

  await c.env.DB.prepare(
    'UPDATE tlr_schedules SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?'
  ).bind(userId).run()

  return c.json({ success: true })
})

// Récupérer le schedule TLR actuel
pushRoutes.get('/tlr-schedule', async (c) => {
  const userId = c.get('userId')

  const schedule = await c.env.DB.prepare(
    'SELECT * FROM tlr_schedules WHERE user_id = ?'
  ).bind(userId).first<any>()

  return c.json({ schedule: schedule || null })
})

// === Endpoint CRON (protégé par secret, pas par auth user) ===
export const cronRoutes = new Hono<{ Bindings: Bindings }>()

cronRoutes.post('/tlr-check', async (c) => {
  // Vérifier le secret
  const authHeader = c.req.header('Authorization')
  const cronSecret = c.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const now = new Date()
  const currentHH = String(now.getUTCHours()).padStart(2, '0')
  const currentMM = String(now.getUTCMinutes()).padStart(2, '0')
  const currentTimeUTC = `${currentHH}:${currentMM}`

  // Trouver tous les schedules actifs dont le trigger_time correspond à maintenant (UTC)
  // On cherche à la minute près
  const schedules = await c.env.DB.prepare(
    `SELECT ts.user_id, ts.trigger_time, ts.bedtime
     FROM tlr_schedules ts
     WHERE ts.active = 1 AND ts.trigger_time = ?`
  ).bind(currentTimeUTC).all<any>()

  if (!schedules.results?.length) {
    return c.json({ triggered: 0, time: currentTimeUTC })
  }

  const vapidPub = c.env.VAPID_PUBLIC_KEY
  const vapidPriv = c.env.VAPID_PRIVATE_KEY
  let triggered = 0
  let errors = 0

  for (const schedule of schedules.results) {
    // Récupérer toutes les push subscriptions de ce user
    const subs = await c.env.DB.prepare(
      'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?'
    ).bind(schedule.user_id).all<any>()

    if (!subs.results?.length) continue

    for (const sub of subs.results) {
      const result = await sendWebPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        {
          type: 'TLR_TRIGGER',
          title: 'Rêve Mieux : Déclencheur Lucide !',
          body: 'Le refrain va se jouer. Faites de beaux rêves lucides.',
          url: '/?autoplay=refrain',
          triggerTime: schedule.trigger_time
        },
        vapidPub,
        vapidPriv
      )

      if (result.success) {
        triggered++
      } else {
        errors++
        // Si le push endpoint est mort (410 Gone), supprimer la subscription
        if (result.status === 410 || result.status === 404) {
          await c.env.DB.prepare(
            'DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?'
          ).bind(schedule.user_id, sub.endpoint).run()
        }
      }
    }
  }

  return c.json({ triggered, errors, time: currentTimeUTC })
})

// Test endpoint — envoie un push test au user authentifié
export const pushTestRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

pushTestRoutes.post('/test', async (c) => {
  const userId = c.get('userId')

  const subs = await c.env.DB.prepare(
    'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?'
  ).bind(userId).all<any>()

  if (!subs.results?.length) {
    return c.json({ error: 'Aucune subscription push trouvée. Activez d\'abord les notifications.' }, 400)
  }

  const vapidPub = c.env.VAPID_PUBLIC_KEY
  const vapidPriv = c.env.VAPID_PRIVATE_KEY
  const results = []

  for (const sub of subs.results) {
    const result = await sendWebPush(
      { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
      {
        type: 'TLR_TEST',
        title: 'Test Rêve Mieux',
        body: 'Si tu vois cette notification, le push serveur fonctionne !',
        url: '/'
      },
      vapidPub,
      vapidPriv
    )
    results.push(result)
  }

  return c.json({ results })
})
