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
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            dream: {
              50: '#f0e7ff', 100: '#d9c5ff', 200: '#b68aff', 300: '#9455ff',
              400: '#7c3aed', 500: '#6d28d9', 600: '#5b21b6', 700: '#4c1d95',
              800: '#3b0f7a', 900: '#2e0a5e', 950: '#1a0536'
            },
            night: {
              50: '#e8eaf6', 100: '#c5cae9', 200: '#9fa8da', 300: '#7986cb',
              400: '#5c6bc0', 500: '#3f51b5', 600: '#303f9f', 700: '#283593',
              800: '#1a237e', 900: '#0f1547', 950: '#0a0d2e'
            }
          },
          fontFamily: {
            sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
            display: ['Outfit', 'Inter', 'sans-serif']
          }
        }
      }
    }
  </script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <link rel="stylesheet" href="/static/style.css?v=${Date.now()}">
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
  <script src="/static/app.js?v=${Date.now()}"></script>
</body>
</html>`
}
