// TLR Service Worker - Notification persistante pour Rêve Mieux
// Gère les notifications sur écran de verrouillage
// La notification ne peut être retirée QUE depuis la page Lucidité (toggleTLR)
// v2.0.0 : 3 boutons RC (doigts/lire/heure), RC enregistrés directement depuis SW

const SW_VERSION = '2.0.0';

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
    body += 'Dodo dans ' + formatCountdownHM(sleepDiff) + '\n';
  } else if (triggerDiff > 0) {
    // Bedtime passed but trigger not yet — show elapsed time since bedtime
    const elapsed = Math.abs(sleepDiff);
    body += 'Tu devrais dormir depuis ' + formatCountdownHM(elapsed) + '\n';
  } else {
    body += 'Déclencheur en cours...\n';
  }

  if (triggerDiff > 0) {
    body += 'Déclencheur lucide dans ' + formatCountdownHM(triggerDiff) + '\n';
  } else {
    body += 'Déclencheur en cours...\n';
  }
  body += 'Désactiver : page Lucidité';

  self.registration.showNotification('▶ Rêve Mieux — Tap pour le refrain', {
    body: body,
    icon: '/static/icon-192.png',
    badge: '/static/icon-192.png',
    tag: 'tlr-persistent',
    renotify: false,
    requireInteraction: true,
    silent: true,
    ongoing: true,
    actions: [
      { action: 'rc-hands', title: '✋ Doigts' },
      { action: 'rc-text', title: '📖 Lire' },
      { action: 'rc-time', title: '⏰ Heure' }
    ],
    data: { url: '/', type: 'tlr-persistent' }
  }).catch(() => {});
}

// Enregistrer un reality check via l'API directement depuis le SW (pas besoin de déverrouiller)
async function recordRealityCheck(checkType) {
  if (!apiToken) return;
  try {
    await fetch('/api/reality-checks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiToken
      },
      body: JSON.stringify({ checkType: checkType, wasDreaming: false })
    });
  } catch (err) {
    // Silent fail — will be visible in app next time
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

  // Reality Check actions — record RC directly from SW (no unlock needed)
  if (event.action === 'rc-hands' || event.action === 'rc-text' || event.action === 'rc-time') {
    const checkType = event.action === 'rc-hands' ? 'hands' : event.action === 'rc-text' ? 'text' : 'time';
    // Close and immediately re-show notification (keeps it persistent)
    event.notification.close();
    event.waitUntil(
      (async () => {
        await recordRealityCheck(checkType);
        if (tlrActive) refreshNotification();
        // Notify app if open
        const clients = await self.clients.matchAll({ type: 'window' });
        clients.forEach(client => client.postMessage({ type: 'REALITY_CHECK_FROM_SW', checkType }));
      })()
    );
    return;
  }

  // Clic normal sur la notif persistante : ouvrir l'app et auto-play le refrain
  if (notifType === 'tlr-persistent') {
    event.notification.close();
    event.waitUntil(
      (async () => {
        if (tlrActive) refreshNotification();
        const clients = await self.clients.matchAll({ type: 'window' });
        if (clients.length > 0) {
          clients[0].focus();
          // Demander à l'app de lancer le refrain automatiquement
          clients[0].postMessage({ type: 'PLAY_REFRAIN_FROM_SW' });
        } else {
          // Ouvrir l'app avec un paramètre pour auto-play
          await self.clients.openWindow('/?autoplay=refrain');
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
