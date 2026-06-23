// TLR Service Worker - Notification persistante pour Rêve Mieux
// Gère les notifications sur écran de verrouillage
// La notification ne peut être retirée QUE depuis la page Lucidité (toggleTLR)
// v3.1.0 : 1 bouton (Écouter Rêve Mieux uniquement)

const SW_VERSION = '3.1.0';

// État interne
let tlrActive = false;
let bedtimeTimestamp = null;
let triggerTimestamp = null;
let refreshTimer = null;
let apiToken = null; // JWT token for API calls from SW

// Installation
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activation
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Réception de messages depuis l'app
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;

  switch (data.type) {
    case 'TLR_UPDATE':
      tlrActive = true;
      bedtimeTimestamp = data.bedtimeTimestamp;
      triggerTimestamp = data.triggerTimestamp;
      if (data.token) apiToken = data.token;
      refreshNotification();
      startAutoRefresh();
      break;
    case 'TLR_STOP':
      tlrActive = false;
      bedtimeTimestamp = null;
      triggerTimestamp = null;
      stopAutoRefresh();
      closeTLRNotification();
      break;
    case 'TLR_TRIGGER':
      showTriggerNotification();
      break;
    case 'TLR_SET_TOKEN':
      apiToken = data.token;
      break;
  }
});

// Formatage du countdown en XhMM
function formatCountdownHM(ms) {
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h + 'h' + String(m).padStart(2, '0');
}

// Calcul et affichage de la notification avec countdowns à jour
function refreshNotification() {
  if (!tlrActive || !bedtimeTimestamp || !triggerTimestamp) return;

  const now = Date.now();
  const sleepDiff = bedtimeTimestamp - now;
  const triggerDiff = triggerTimestamp - now;

  let body = 'Est-ce que tu rêves ?\n';

  if (sleepDiff > 0) {
    // Avant bedtime : countdown (max 18h)
    const capped = Math.min(sleepDiff, 18 * 3600000);
    body += 'Dodo dans ' + formatCountdownHM(capped) + '\n';
  } else {
    // Après bedtime : elapsed (max 6h)
    const elapsed = Math.min(Math.abs(sleepDiff), 6 * 3600000);
    body += 'Tu devrais dormir depuis ' + formatCountdownHM(elapsed) + '\n';
  }

  body += 'Déclencheur lucide dans ' + formatCountdownHM(Math.max(0, triggerDiff)) + '\n';
  body += 'Désactiver : page Lucidité';

  self.registration.showNotification('🌙 Rêve Mieux', {
    body: body,
    icon: '/static/icon-192.png',
    badge: '/static/icon-192.png',
    tag: 'tlr-persistent',
    renotify: false,
    requireInteraction: true,
    silent: true,
    ongoing: true,
    actions: [
      { action: 'play-refrain', title: '🎵 Écouter Rêve Mieux' }
    ],
    data: { url: '/', type: 'tlr-persistent' }
  }).catch(() => {});
}

// Enregistrer un reality check via l'API directement depuis le SW (pas besoin de déverrouiller)
async function recordRealityCheck(checkType) {
  if (!apiToken) return;
  const baseUrl = self.location.origin;
  try {
    const resp = await fetch(baseUrl + '/api/reality-checks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiToken
      },
      body: JSON.stringify({ checkType: checkType, wasDreaming: false })
    });
    return resp.ok;
  } catch (err) {
    return false;
  }
}

// Auto-refresh toutes les 60 secondes (autonome, même app fermée)
function startAutoRefresh() {
  stopAutoRefresh();
  refreshTimer = setInterval(() => {
    if (tlrActive) {
      refreshNotification();
    } else {
      stopAutoRefresh();
    }
  }, 60000);
}

function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

// Notification quand le déclencheur se lance
async function showTriggerNotification() {
  try {
    await self.registration.showNotification('Rêve Mieux : Déclencheur Lucide !', {
      body: 'Le refrain se joue à volume ultra-faible. Faites de beaux rêves lucides.',
      icon: '/static/icon-192.png',
      badge: '/static/icon-192.png',
      tag: 'tlr-trigger',
      requireInteraction: true,
      silent: true,
      vibrate: [100],
      data: { url: '/', type: 'tlr-trigger' }
    });
  } catch (err) {}
}

// Fermer la notification persistante (uniquement via TLR_STOP depuis l'app)
async function closeTLRNotification() {
  const notifications = await self.registration.getNotifications({ tag: 'tlr-persistent' });
  notifications.forEach(n => n.close());
  const triggerNotifs = await self.registration.getNotifications({ tag: 'tlr-trigger' });
  triggerNotifs.forEach(n => n.close());
}

// Clic sur la notification
self.addEventListener('notificationclick', (event) => {
  const notifType = event.notification.data?.type;

  // Écouter Rêve Mieux — open app and auto-play refrain
  if (event.action === 'play-refrain') {
    event.notification.close();
    event.waitUntil(
      (async () => {
        if (tlrActive) refreshNotification();
        const clients = await self.clients.matchAll({ type: 'window' });
        if (clients.length > 0) {
          clients[0].focus();
          clients[0].postMessage({ type: 'PLAY_REFRAIN_FROM_SW' });
        } else {
          await self.clients.openWindow('/?autoplay=refrain');
        }
      })()
    );
    return;
  }

  // Clic normal sur le body de la notif persistante : ouvrir l'app (sans auto-play)
  if (notifType === 'tlr-persistent') {
    event.notification.close();
    event.waitUntil(
      (async () => {
        if (tlrActive) refreshNotification();
        const clients = await self.clients.matchAll({ type: 'window' });
        if (clients.length > 0) {
          clients[0].focus();
        } else {
          await self.clients.openWindow('/');
        }
      })()
    );
    return;
  }

  // Autres notifications (trigger, etc.) : comportement normal
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      if (clients.length > 0) {
        clients[0].focus();
      } else {
        return self.clients.openWindow('/');
      }
    })
  );
});

// Quand la notification est swipée/dismissée : la re-créer
self.addEventListener('notificationclose', (event) => {
  const notifType = event.notification.data?.type;

  if (notifType === 'tlr-persistent' && tlrActive) {
    event.waitUntil(
      new Promise(resolve => setTimeout(resolve, 500)).then(() => {
        if (tlrActive) refreshNotification();
      })
    );
  }
});
