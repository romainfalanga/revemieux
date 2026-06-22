// TLR Service Worker - Notification persistante pour Rêve Mieux
// Gère les notifications sur écran de verrouillage
// La notification ne peut être retirée QUE depuis la page Lucidité (toggleTLR)

const SW_VERSION = '1.1.0';

// État interne : la dernière notification connue (pour la re-créer si swipée)
let lastNotifData = null;
let tlrActive = false;

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
      lastNotifData = data;
      showTLRNotification(data);
      break;
    case 'TLR_STOP':
      tlrActive = false;
      lastNotifData = null;
      closeTLRNotification();
      break;
    case 'TLR_TRIGGER':
      showTriggerNotification();
      break;
  }
});

// Affichage / mise à jour de la notification persistante
async function showTLRNotification(data) {
  try {
    const { sleepCountdown, triggerCountdown, status } = data;

    let body = 'Est-ce que tu rêves ?\n';

    if (sleepCountdown) {
      body += 'Dodo dans ' + sleepCountdown + '\n';
    } else {
      body += 'Bonne nuit !\n';
    }

    if (triggerCountdown) {
      body += 'Déclencheur lucide dans ' + triggerCountdown + '\n';
    } else {
      body += 'Déclencheur en cours...\n';
    }
    body += 'Désactiver : page Lucidité → Désactiver TLR';

    await self.registration.showNotification('Rêve Mieux', {
      body: body,
      icon: '/static/icon-192.png',
      badge: '/static/icon-192.png',
      tag: 'tlr-persistent',
      renotify: false,
      requireInteraction: true,
      silent: true,
      ongoing: true,
      actions: [
        { action: 'reality-check', title: '✋ Reality Check' }
      ],
      data: { url: '/', type: 'tlr-persistent' }
    });
  } catch (err) {
    // Silently fail if notifications not supported
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

  if (event.action === 'reality-check') {
    // Ne PAS fermer la notif persistante, juste envoyer le RC
    if (notifType === 'tlr-persistent') {
      // Re-show immédiatement pour qu'elle reste
      event.notification.close();
      event.waitUntil(
        (async () => {
          // Re-créer la notif pour qu'elle reste fixée
          if (tlrActive && lastNotifData) await showTLRNotification(lastNotifData);
          // Envoyer le reality check à l'app
          const clients = await self.clients.matchAll({ type: 'window' });
          clients.forEach(client => client.postMessage({ type: 'REALITY_CHECK_FROM_SW' }));
          if (clients.length > 0) {
            clients[0].focus();
          } else {
            await self.clients.openWindow('/');
          }
        })()
      );
    } else {
      event.notification.close();
    }
    return;
  }

  // Clic normal sur la notif persistante : ouvrir l'app mais NE PAS fermer la notif
  if (notifType === 'tlr-persistent') {
    event.notification.close();
    event.waitUntil(
      (async () => {
        // Re-créer immédiatement la notif
        if (tlrActive && lastNotifData) await showTLRNotification(lastNotifData);
        // Ouvrir / focus l'app
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

// Quand la notification est swipée/dismissée par l'utilisateur : la re-créer
self.addEventListener('notificationclose', (event) => {
  const notifType = event.notification.data?.type;

  // Si c'est la notif TLR persistante et que TLR est toujours actif → la re-créer
  if (notifType === 'tlr-persistent' && tlrActive && lastNotifData) {
    event.waitUntil(
      // Petit délai pour éviter un flash visuel
      new Promise(resolve => setTimeout(resolve, 500)).then(() => {
        if (tlrActive && lastNotifData) {
          return showTLRNotification(lastNotifData);
        }
      })
    );
  }
});
