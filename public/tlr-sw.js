// TLR Service Worker - Notification persistante pour Rêve Mieux
// Gère les notifications sur écran de verrouillage

const SW_VERSION = '1.0.0';

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
      showTLRNotification(data);
      break;
    case 'TLR_STOP':
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
      body += 'Déclencheur lucide dans ' + triggerCountdown;
    } else {
      body += 'Déclencheur en cours...';
    }

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
        { action: 'reality-check', title: 'Reality Check' },
        { action: 'stop', title: 'Désactiver' }
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

// Fermer la notification persistante
async function closeTLRNotification() {
  const notifications = await self.registration.getNotifications({ tag: 'tlr-persistent' });
  notifications.forEach(n => n.close());
  const triggerNotifs = await self.registration.getNotifications({ tag: 'tlr-trigger' });
  triggerNotifs.forEach(n => n.close());
}

// Clic sur la notification = ouvre l'app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'stop') {
    // Envoyer un message à l'app pour stopper TLR
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => client.postMessage({ type: 'TLR_STOP_FROM_SW' }));
        if (clients.length === 0) {
          // App pas ouverte, on ouvre et on laisse l'app gérer
          return self.clients.openWindow('/');
        }
      })
    );
    return;
  }

  if (event.action === 'reality-check') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => client.postMessage({ type: 'REALITY_CHECK_FROM_SW' }));
        if (clients.length > 0) {
          clients[0].focus();
        } else {
          return self.clients.openWindow('/');
        }
      })
    );
    return;
  }

  // Clic normal : ouvrir l'app
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
