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
  const currentHH = now.getUTCHours()
  const currentMM = now.getUTCMinutes()
  const currentTotalMinutes = currentHH * 60 + currentMM
  const currentTimeUTC = `${String(currentHH).padStart(2, '0')}:${String(currentMM).padStart(2, '0')}`

  // Trouver tous les schedules actifs
  // On utilise une fenêtre de matching au lieu d'un match exact,
  // car le cron externe peut avoir quelques secondes de décalage
  const schedules = await c.env.DB.prepare(
    `SELECT ts.user_id, ts.trigger_time, ts.bedtime, ts.last_triggered_at
     FROM tlr_schedules ts
     WHERE ts.active = 1`
  ).all<any>()

  if (!schedules.results?.length) {
    return c.json({ triggered: 0, time: currentTimeUTC })
  }

  const vapidPub = c.env.VAPID_PUBLIC_KEY
  const vapidPriv = c.env.VAPID_PRIVATE_KEY
  let triggered = 0
  let skipped = 0
  let errors = 0
  const todayStr = now.toISOString().split('T')[0] // "2026-06-23"

  for (const schedule of schedules.results) {
    // Parser le trigger_time du schedule
    const [trigH, trigM] = schedule.trigger_time.split(':').map(Number)
    const trigTotalMinutes = trigH * 60 + trigM
    
    // Fenêtre de matching : trigger_time ± 1 minute (gère le décalage cron)
    let diff = currentTotalMinutes - trigTotalMinutes
    // Gérer le passage minuit (ex: trigger 23:59, cron 00:00)
    if (diff > 720) diff -= 1440
    if (diff < -720) diff += 1440
    
    if (diff < 0 || diff > 1) continue // Pas dans la fenêtre
    
    // Dedup : ne pas re-trigger si déjà triggeré aujourd'hui
    if (schedule.last_triggered_at && schedule.last_triggered_at.startsWith(todayStr)) {
      skipped++
      continue
    }

    // Récupérer toutes les push subscriptions de ce user
    const subs = await c.env.DB.prepare(
      'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?'
    ).bind(schedule.user_id).all<any>()

    if (!subs.results?.length) continue

    let userTriggered = false
    for (const sub of subs.results) {
      const result = await sendWebPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        {
          type: 'TLR_TRIGGER',
          title: '🌙 Déclencheur Lucide',
          body: 'Touche pour écouter le refrain Rêve Mieux',
          url: '/?autoplay=refrain'
        },
        vapidPub,
        vapidPriv
      )

      if (result.success) {
        triggered++
        userTriggered = true
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

    // Marquer comme triggeré aujourd'hui (dedup)
    if (userTriggered) {
      await c.env.DB.prepare(
        'UPDATE tlr_schedules SET last_triggered_at = ? WHERE user_id = ?'
      ).bind(now.toISOString(), schedule.user_id).run()
    }
  }

  return c.json({ triggered, skipped, errors, time: currentTimeUTC })
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
