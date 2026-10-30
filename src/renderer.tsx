declare const __ASSET_VERSION__: string
const ASSET_VERSION = __ASSET_VERSION__

export function renderApp(): string {
  return `<!DOCTYPE html>
<html lang="fr" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="theme-color" content="#0f0a1e">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>Rêve Mieux</title>
  <link rel="stylesheet" href="/static/tailwind.css?v=${ASSET_VERSION}">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css" rel="stylesheet">
  <link rel="stylesheet" href="/static/style.css?v=${ASSET_VERSION}">
  <link rel="manifest" href="/manifest.json">
  <link rel="icon" href="/static/favicon-v2.ico" sizes="any">
  <link rel="icon" type="image/png" sizes="16x16" href="/static/favicon-16-v2.png">
  <link rel="icon" type="image/png" sizes="32x32" href="/static/favicon-32-v2.png">
  <link rel="icon" type="image/png" sizes="192x192" href="/static/icon-192-v2.png">
  <link rel="icon" type="image/png" sizes="512x512" href="/static/icon-512-v2.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/static/apple-touch-icon-v2.png">
</head>
<body class="bg-night-950 text-gray-100 font-sans min-h-screen overflow-x-hidden">
  <div id="app">
    <div id="loading-screen" class="fixed inset-0 z-50 flex items-center justify-center bg-night-950">
      <div class="text-center">
        <div class="relative w-20 h-20 mx-auto mb-6">
          <div class="absolute inset-0 rounded-full border-2 border-dream-400/20 animate-ping"></div>
          <div class="absolute inset-2 rounded-full border-2 border-dream-300/40 animate-pulse"></div>
          <img src="/static/logo-192-v2.png" alt="Rêve Mieux" class="absolute inset-0 w-full h-full rounded-full object-cover">
        </div>
        <h2 class="text-xl font-display font-semibold text-dream-200 mb-2">Rêve Mieux</h2>
        <p class="text-sm text-gray-400">Chargement de votre univers onirique...</p>
      </div>
    </div>
  </div>
  <script defer src="/static/emotions.js?v=${ASSET_VERSION}"></script>
  <script id="app-script" defer src="/static/app.js?v=${ASSET_VERSION}" data-chart-src="/static/chart.umd.js?v=${ASSET_VERSION}"></script>
</body>
</html>`
}
